/**
 * 云霜凝游戏 - 游戏逻辑主入口
 *
 * 事件处理顺序：
 * 1. CHAT_COMPLETION_PROMPT_READY → 注入状态快照 + 道具事件附加到玩家消息
 * 2. VARIABLE_UPDATE_ENDED        → 自动计算派生状态 + 处理新激活道具
 * 3. MESSAGE_RECEIVED             → 解析AI回复时间词推进时间 + 临时道具计数递减
 * 4. COMMAND_PARSED               → 修复AI输出格式错误
 *
 * 注入方式（均通过 event_data.chat 数组直接操作）：
 *   方式1 - 道具事件：_待发送道具事件 → 附加到玩家消息的 content
 *   方式2 - 状态快照：getStatusSnapshot() → push system message 到 chat 尾部
 */

import { waitUntil } from 'async-wait-until';
import { Schema } from '../../schema';
import { validateAndRecalcState, applyFloorCeiling, calcHealingStage } from './stateValidation';
import { advanceTimeFromText, onDayChanged } from './timeSystem';
import {
  getStatusSnapshot,
  buildBatchUseEvent,
  selectSoulMemory,
  getSpecialSceneTrigger,
  checkMiaoxuanEasterEgg,
  getQianjingEntryTrigger,
  getQianjingRoundGuidance,
  getQianjingExitText,
  getQianjingMaxRounds,
} from './promptInjection';
import {
  processNewlyActivatedItems,
  processEquipmentUnequip,
  tickEquipmentEffects,
  tickTemporaryItems,
  clearSceneTemporaryItems,
  advanceSpecialScene,
} from './shopSystem';

// ────────────────────────────────────────────────────────
// 初始化
// ────────────────────────────────────────────────────────

// 硬保护快照：在 CHAT_COMPLETION_PROMPT_READY 从最新消息捕获（包含前端写入），
// 在 VARIABLE_UPDATE_ENDED 用作回滚基准。比旧变量更可靠——旧变量可能是新消息的默认值，
// 不包含前端在两次 AI 回复之间的修改（灵石扣款、模式切换等）。
import type { ProtectionSnapshot, FreezeBaseline } from './stateValidation';
let _protSnapshot: ProtectionSnapshot | null = null;
let _freezeBaseline: FreezeBaseline | null = null;

// 时间推进楼层守卫（防止同一楼层重复推进时间，如重新生成）
let _lastTimeAdvanceFloor = -1;

$(() => {
  (async () => {
    await waitGlobalInitialized('Mvu');
    console.info('[云霜凝] 游戏逻辑脚本已加载');

    // ────────────────────────────────────────────────────
    // 事件1：AI生成前 → 注入状态快照 + 附加道具事件到玩家消息
    // 参考赵霞：直接操作 event_data.chat（发给API的数组）
    // ────────────────────────────────────────────────────
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, event_data => {
      try {
        const { chat, dryRun } = event_data;

        if (dryRun) {
          console.info('[云霜凝] dryRun=true，跳过注入');
          return;
        }

        const raw = Mvu.getMvuData({ type: 'message', message_id: -1 });
        const data = Schema.parse(_.get(raw, 'stat_data') ?? {});

        // ── Phase 1: 预处理待发送事件（构建事件文本 + 更新 data 状态）──
        // 事件文本用 ORIGINAL data（如首次进入文本），状态更新在快照构建前完成
        const pendingRaw = data._待发送道具事件;
        let items: string[] = [];
        let richEvent = '';
        if (pendingRaw) {
          // ── 立即清除事件队列（BUG修复）──
          // 前端 store 每 500ms 从 MVU 轮询同步数据。如果不在此处立即清除，
          // store 会在下次按钮操作时将已消费的旧事件重新 flush 回 MVU，
          // 导致道具事件被反复注入 AI 提示词（"卡在发送道具"死循环）。
          _.set(raw, 'stat_data._待发送道具事件', '');
          Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });

          items = pendingRaw
            .split('|||')
            .map(s => s.trim())
            .filter(Boolean);
          // 构建事件文本时使用原始 data（首次进入判定需要原始 _神魂空间已进入过）
          richEvent = buildBatchUseEvent(items, data);

          // 神魂空间模式切换：退出优先于引导（用户可能在同一批事件中先入后出）
          // __神魂空间引导__: 自动解锁（首次进入，stateValidation触发）
          // __神魂空间入口__: 手动按钮进入（前端 flush 可能未传播到新消息，必须在此处切换）
          const hasEntry = items.includes('__神魂空间引导__') || items.includes('__神魂空间入口__');
          // __打断治疗_神魂__: 打断系统强制退出神魂空间（VARIABLE_UPDATE_ENDED触发，
          // 但MVU数据可能未传播到新消息，必须在此处也显式切换）
          const hasExit = items.includes('__退出神魂空间__') || items.includes('__打断治疗_神魂__');

          if (hasExit) {
            // 退出优先级最高：即使引导事件也存在，用户已明确退出
            data._当前互动模式 = '日常';
            data._神魂空间激活中 = false;
            _.set(raw, 'stat_data._当前互动模式', '日常');
            _.set(raw, 'stat_data._神魂空间激活中', false);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info('[云霜凝] 退出神魂空间：模式已切换为日常');
          } else if (hasEntry) {
            data._当前互动模式 = '神魂空间';
            data._神魂空间激活中 = true;
            _.set(raw, 'stat_data._当前互动模式', '神魂空间');
            _.set(raw, 'stat_data._神魂空间激活中', true);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info('[云霜凝] 神魂空间引导：模式已切换为神魂空间');
          }

          // 标记神魂空间已进入过（在快照构建前更新，确保快照使用正确状态）
          if (items.includes('__神魂空间入口__')) {
            if (!data._神魂空间已进入过) {
              data._神魂空间已进入过 = true;
              _.set(raw, 'stat_data._神魂空间已进入过', true);
              console.info('[云霜凝] 首次进入神魂空间，已标记');
            }
            // 选择记忆场景（阶段3+时生效）
            selectSoulMemory(data);
            _.set(raw, 'stat_data._神魂记忆场景', data._神魂记忆场景);
            _.set(raw, 'stat_data._新婚夜已触发', data._新婚夜已触发);
            _.set(raw, 'stat_data._记忆进入次数', data._记忆进入次数);
            if (data._神魂记忆场景) {
              console.info(`[云霜凝] 神魂记忆场景：${data._神魂记忆场景}`);
            }
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
          }
        }

        // ── Phase 1.5: 打断冻结期持续提示 / 解除提示 ──
        {
          const currentFloor = SillyTavern.chat?.length ?? 0;
          const freezeUntil = data._打断冻结至楼层;
          if (freezeUntil > 0 && currentFloor < freezeUntil) {
            // 冻结中：注入监视提示
            const freezeNotice = `【苗广监视中】苗广对{{user}}和云霜凝的接触保持高度警惕，随时可能推门查看。在这种压迫性的监视下，任何实质性的治疗互动都无法进行。
{{user}}和云霜凝只能进行日常对话、安抚情绪等不会引起苗广怀疑的互动。描写苗广随时可能出现的压力感——但苗广不常驻房间内。`;
            richEvent = richEvent ? richEvent + '\n\n' + freezeNotice : freezeNotice;
            console.info(`[云霜凝] 打断冻结持续提示注入（剩余${freezeUntil - currentFloor}楼）`);
          } else if (freezeUntil > 0 && currentFloor === freezeUntil) {
            // 冻结刚结束：注入解除提示，引导AI回归正常剧情
            const unfreezeNotice = `【监视解除】苗广的监视告一段落，{{user}}和云霜凝又有了单独相处的空间，治疗互动可以恢复。
不要继续描写苗广的监视行为，苗广当前不在房间内。回归正常互动节奏。`;
            richEvent = richEvent ? richEvent + '\n\n' + unfreezeNotice : unfreezeNotice;
            // 清除冻结标记，后续轮次不再注入
            data._打断冻结至楼层 = 0;
            _.set(raw, 'stat_data._打断冻结至楼层', 0);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info('[云霜凝] 打断冻结结束，已注入解除提示并清除标记');
          }
        }

        // ── Phase 1.7: 千晶幻术轮次追踪与自动退出 ──
        {
          const currentFloor = SillyTavern.chat?.length ?? 0;
          const qjActive = data.苗广.千晶幻术.激活中;
          const qjStartFloor = data._千晶幻术开始楼层;
          // 仅在千晶幻术激活且不是入场事件轮时处理（入场事件由 __千晶幻术_进入__ 处理）
          const hasQjEntry = items.includes('__千晶幻术_进入__');

          if (qjActive && !hasQjEntry && qjStartFloor > 0) {
            const 已使用次数 = data.苗广.千晶幻术.已使用次数;
            const maxRounds = getQianjingMaxRounds(已使用次数);
            const currentRound = Math.floor((currentFloor - qjStartFloor) / 2) + 1;

            if (currentRound > maxRounds) {
              // ── 自动退出：轮次已满 ──
              data.苗广.千晶幻术.激活中 = false;
              data.苗广.千晶幻术.冷却结束楼层 = currentFloor + 4;
              if (已使用次数 >= 5) {
                data.苗广.千晶幻术.认知改写完成 = true;
              }
              data._千晶幻术开始楼层 = 0;

              // 持久化变量
              _.set(raw, 'stat_data.苗广.千晶幻术.激活中', false);
              _.set(raw, 'stat_data.苗广.千晶幻术.冷却结束楼层', currentFloor + 4);
              _.set(raw, 'stat_data.苗广.千晶幻术.认知改写完成', data.苗广.千晶幻术.认知改写完成);
              _.set(raw, 'stat_data._千晶幻术开始楼层', 0);
              Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });

              const exitText = getQianjingExitText(已使用次数, false);
              // 替换user消息为退出事件
              for (let i = chat.length - 1; i >= 0; i--) {
                if (chat[i].role === 'user') {
                  chat[i].content = exitText;
                  break;
                }
              }
              console.info(`[云霜凝] 千晶幻术第${已使用次数}次自动退出（${maxRounds}轮已满），冷却4楼`);
            } else if (currentRound >= 2) {
              // ── 注入逐轮引导 ──
              const guidance = getQianjingRoundGuidance(已使用次数, currentRound);
              if (guidance) {
                for (let i = chat.length - 1; i >= 0; i--) {
                  if (chat[i].role === 'user') {
                    const content = chat[i].content;
                    chat[i].content = typeof content === 'string' ? content + '\n\n' + guidance : guidance;
                    break;
                  }
                }
                console.info(`[云霜凝] 千晶幻术第${已使用次数}次·第${currentRound}/${maxRounds}轮引导已注入`);
              }
            }
          }
        }

        // ── Phase 2: 构建状态快照（注入在 Phase 3 之后执行，避免被事件替换覆盖）──
        const snapshot = getStatusSnapshot(data);

        // ── Phase 3: 注入事件文本到玩家消息 + 特殊场景触发 ──
        if (richEvent) {
          // 打断事件：替换玩家消息（强制AI演绎打断场景）
          const isInterruption =
            items.includes('__打断治疗__') || items.includes('__打断治疗_神魂__') || items.includes('__坏结局_愤怒__');

          for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].role === 'user') {
              if (isInterruption) {
                // 打断事件：在 user 消息前插入 system 场景切换指令，截断上文影响
                const sceneBreak = items.includes('__打断治疗_神魂__')
                  ? `【系统指令：场景强制切换】
以上所有神魂空间内的对话和描写已经结束。神魂连接已被外力强制切断，神魂空间已关闭。
从此刻起，场景回到现实世界。严禁继续描写、引用或延续神魂空间内的任何内容。
下方是本轮必须演绎的强制事件。`
                  : `【系统指令：场景强制切换】
以上治疗互动已被打断。苗广介入，场景发生剧变。
严禁继续延续之前的治疗互动剧情。下方是本轮必须演绎的强制事件。`;
                chat.splice(i, 0, { role: 'system', content: sceneBreak });
                // 替换玩家输入（splice 后 user 消息在 i+1）
                chat[i + 1].content = richEvent;
              } else {
                const content = chat[i].content;
                chat[i].content = typeof content === 'string' ? richEvent + '\n' + content : richEvent;
              }
              break;
            }
          }

          // 千晶幻术提前退出触发：替换玩家消息
          if (items.includes('__千晶幻术_提前退出__')) {
            const exitText = getQianjingExitText(data.苗广.千晶幻术.已使用次数, true);
            for (let i = chat.length - 1; i >= 0; i--) {
              if (chat[i].role === 'user') {
                chat[i].content = exitText;
                break;
              }
            }
            console.info(`[云霜凝] 千晶幻术第${data.苗广.千晶幻术.已使用次数}次提前退出`);
          }

          // 千晶幻术入场触发：替换玩家消息 + 预填指令
          if (items.includes('__千晶幻术_进入__')) {
            const qjTrigger = getQianjingEntryTrigger(data.苗广.千晶幻术.已使用次数, data.苗广.千晶幻术.幻境摘要);
            const combined =
              qjTrigger.userMessage + `\n\n【AI必须以以下内容作为回复开头，然后继续展开】\n${qjTrigger.prefill}`;
            for (let i = chat.length - 1; i >= 0; i--) {
              if (chat[i].role === 'user') {
                chat[i].content = combined;
                break;
              }
            }
            console.info(`[云霜凝] 千晶幻术第${data.苗广.千晶幻术.已使用次数}次入场触发`);
          }

          // 特殊场景方式3触发：替换玩家消息 + 预填指令
          for (const name of items) {
            const trigger = getSpecialSceneTrigger(name);
            if (trigger) {
              // 将场景触发词 + 预填指令合并到最后一条 user 消息
              const combined =
                trigger.userMessage + `\n\n【AI必须以以下内容作为回复开头，然后继续展开】\n${trigger.prefill}`;
              for (let i = chat.length - 1; i >= 0; i--) {
                if (chat[i].role === 'user') {
                  chat[i].content = combined;
                  break;
                }
              }
              console.info(`[云霜凝] 特殊场景方式3触发: ${name}`);
              break; // 一次只触发一个特殊场景
            }
          }

          console.info('[云霜凝] 道具事件已附加到玩家消息:', items.join(', '));
        }

        // ── Phase 3.5: 注入状态快照 ──
        // 必须在 Phase 3 之后执行：Phase 3 可能替换整个 user 消息内容（打断/千晶/特殊场景），
        // 在此之后注入快照，确保无论 Phase 3 如何处理，快照都不会丢失。
        //
        // 恢复 232a8b5 的注入策略（已验证 Gemini 生效）：
        //   - 有 prefill（Gemini）→ chat 末尾是 assistant，splice 到它之前
        //   - 无 prefill（Claude）→ push 到末尾
        if (snapshot) {
          const lastMsg = chat[chat.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            chat.splice(chat.length - 1, 0, { role: 'system', content: snapshot });
            console.info('[云霜凝] 状态快照: 插入到 prefill 之前');
          } else {
            chat.push({ role: 'system', content: snapshot });
            console.info('[云霜凝] 状态快照: push 到末尾');
          }
        }

        // ── Phase 4: 苗喧彩蛋（优先级最低，有道具事件时跳过）──
        const currentFloor = SillyTavern.chat?.length ?? 0;
        const miaoxuanTriggered = pendingRaw ? false : checkMiaoxuanEasterEgg(data, currentFloor);
        if (miaoxuanTriggered) {
          // 持久化触发楼层 + 碎片文本（显示在前端状态栏）
          _.set(raw, 'stat_data._苗喧上次触发楼层', data._苗喧上次触发楼层);
          _.set(raw, 'stat_data._苗喧碎片', data._苗喧碎片);
          Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
          console.info('[云霜凝] 苗喧碎片已更新至状态栏');
        }
        // ── 捕获硬保护快照（包含前端写入，用作 VARIABLE_UPDATE_ENDED 回滚基准）──
        _protSnapshot = {
          灵石: data.系统.灵石,
          第几天: data.时间.第几天,
          当前小时: data.时间.当前小时,
          神魂空间已解锁: data._神魂空间已解锁,
          神魂空间已进入过: data._神魂空间已进入过,
          当前互动模式: data._当前互动模式,
          神魂空间激活中: data._神魂空间激活中,
          // 疑心值/心态由脚本全权管理，前端不能直接写入，保留 VARIABLE_UPDATE_ENDED 更新的值
          // 若从 getMvuData 读取，会因 MVU 缓存未同步而读到旧值，导致每轮重置（2→4→2 循环 bug）
          疑心值: _protSnapshot?.疑心值 ?? data.苗广.疑心值,
          心态: _protSnapshot?.心态 ?? data.苗广.心态,
          已触发蚀心露屈辱: data._已触发蚀心露屈辱,
          服装: { ...data.云霜凝.服装 },
          道具状态: { ...data.系统.道具状态 },
        };
      } catch (e) {
        console.error('[云霜凝] CHAT_COMPLETION_PROMPT_READY 处理失败:', e);
      }
    });

    // ────────────────────────────────────────────────────
    // 事件2：变量更新完成 → 自动计算派生状态 + 处理新激活道具
    // ────────────────────────────────────────────────────
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (新变量: object, 旧变量: object) => {
      try {
        const newData = Schema.parse(_.get(新变量, 'stat_data') ?? {});
        const oldData = Schema.parse(_.get(旧变量, 'stat_data') ?? {});

        // 处理本轮新激活的道具（消耗品/装备/体改/性癖/特殊场景）
        const currentFloor = SillyTavern.chat?.length ?? 0;

        // 状态自动计算（治疗阶段、苗广心态、灵石里程碑、各种限制、天花板clamp）
        // _protSnapshot 包含前端写入（灵石扣款、模式切换等），旧变量可能是新消息默认值
        // _freezeBaseline: 打断触发时捕获的治疗基线，冻结期间用作回滚基准
        _freezeBaseline = validateAndRecalcState(newData, oldData, currentFloor, _protSnapshot, _freezeBaseline);
        processNewlyActivatedItems(newData, oldData, currentFloor);

        // 处理装备卸下（使用中→已购买），传入快照道具状态防止AI篡改
        processEquipmentUnequip(newData, oldData, _protSnapshot?.道具状态);

        // 装备每轮数值效果（身体器具加速、暖玉佩信任等）
        tickEquipmentEffects(newData);

        // 若打断冻结刚被触发（从0变为>0），清除场景临时道具
        if (newData._打断冻结至楼层 > oldData._打断冻结至楼层) {
          clearSceneTemporaryItems(newData);
        }

        // ── 时间推进（统一在此处执行，避免与 MESSAGE_RECEIVED 冲突导致天数回滚）──
        if (currentFloor > _lastTimeAdvanceFloor && currentFloor > 0) {
          _lastTimeAdvanceFloor = currentFloor;
          const chatArr = (window as any).SillyTavern?.chat;
          const lastAiMsg = chatArr?.findLast?.((m: { is_user: boolean }) => !m.is_user);
          const aiText: string = lastAiMsg?.mes ?? '';
          if (aiText) {
            const timeResult = advanceTimeFromText(newData, aiText);
            if (timeResult.dayChanged) {
              onDayChanged(newData);
            }
            console.info(
              `[云霜凝] 时间推进: ${timeResult.reason}`,
              `| ${timeResult.oldDay}天${timeResult.oldHour.toFixed(1)}h → ${timeResult.newDay}天${timeResult.newHour.toFixed(1)}h`,
            );
          }
        }

        // 天花板 clamp（所有效果之后最后执行）
        applyFloorCeiling(newData, currentFloor);
        newData.治疗.阶段 = calcHealingStage(newData.治疗.完成度);

        // 将计算结果写回
        _.set(新变量, 'stat_data', newData);

        // 疑心值/心态由脚本全权管理，直接更新快照
        // 原因：replaceMvuData 会再次触发 VARIABLE_UPDATE_ENDED，第二次触发时若 _protSnapshot
        // 未更新，楼层去重会将疑心值硬重置回旧 base（2→4→2 交替循环 bug）
        if (_protSnapshot) {
          _protSnapshot.疑心值 = newData.苗广.疑心值;
          _protSnapshot.心态 = newData.苗广.心态;
        }

        console.info(
          '[云霜凝] 状态验证完成：',
          `治疗${newData.治疗.完成度.toFixed(1)}%·阶段${newData.治疗.阶段}`,
          `| 苗广[${newData.苗广.心态}·疑心${newData.苗广.疑心值}]`,
          `| 灵石${newData.系统.灵石}`,
        );
      } catch (e) {
        console.error('[云霜凝] VARIABLE_UPDATE_ENDED 处理失败:', e);
      }
    });

    // ────────────────────────────────────────────────────
    // 事件3：AI回复到达 → 临时道具计数递减 + 特殊场景推进
    // 注意：时间推进已移至 VARIABLE_UPDATE_ENDED 统一处理，避免两个事件抢写导致天数回滚
    // ────────────────────────────────────────────────────
    eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
      try {
        await waitUntil(() => {
          const raw = Mvu.getMvuData({ type: 'message', message_id: -1 });
          return _.has(raw, 'stat_data');
        });

        const raw = Mvu.getMvuData({ type: 'message', message_id: -1 });
        const data = Schema.parse(_.get(raw, 'stat_data') ?? {});

        // 检测是否为系统操作触发的回复（道具使用、模式切换等）
        const isSystemAction = data._系统操作中;

        if (!isSystemAction) {
          // 临时道具轮次递减（每轮-1，到期则移除）
          tickTemporaryItems(data);

          // 特殊场景阶段推进（每轮AI回复后+1阶段）
          advanceSpecialScene(data);
        } else {
          console.info('[云霜凝] 系统操作触发的回复，跳过临时道具/场景推进');
        }

        // 清除系统操作标记（本轮已处理完毕）
        data._系统操作中 = false;

        // 更新保护快照：从当前 MVU 数据读取最新状态（灵石/服装等前端可写字段）
        _protSnapshot = {
          灵石: data.系统.灵石,
          第几天: data.时间.第几天,
          当前小时: data.时间.当前小时,
          神魂空间已解锁: data._神魂空间已解锁,
          神魂空间已进入过: data._神魂空间已进入过,
          当前互动模式: data._当前互动模式,
          神魂空间激活中: data._神魂空间激活中,
          // 疑心值/心态已由 VARIABLE_UPDATE_ENDED 末尾直接更新，此处保留该值
          疑心值: _protSnapshot?.疑心值 ?? data.苗广.疑心值,
          心态: _protSnapshot?.心态 ?? data.苗广.心态,
          已触发蚀心露屈辱: data._已触发蚀心露屈辱,
          服装: { ...data.云霜凝.服装 },
          道具状态: { ...data.系统.道具状态 },
        };

        // 更新冻结基线：冻结期间累积三把锁等效果，冻结结束后清除
        if (_freezeBaseline) {
          if (data._打断冻结至楼层 > 0) {
            // 冻结仍在生效：用当前治疗数值更新基线（含三把锁回退效果）
            _freezeBaseline = {
              信任度: data.云霜凝.信任度,
              心理防线: data.云霜凝.心理防线,
              完成度: data.治疗.完成度,
              身体开发: { ...data.云霜凝.身体开发 },
            };
          } else {
            // 冻结已结束：清除基线
            _freezeBaseline = null;
            console.info('[云霜凝] 打断冻结基线已清除');
          }
        }

        // 写回变量
        await Mvu.replaceMvuData(_.set(_.cloneDeep(raw), 'stat_data', data), { type: 'message', message_id: -1 });
      } catch (e) {
        console.error('[云霜凝] MESSAGE_RECEIVED 处理失败:', e);
      }
    });

    // ────────────────────────────────────────────────────
    // 事件4：MVU命令解析完成 → 修复AI格式错误
    // ────────────────────────────────────────────────────
    eventOn(
      Mvu.events.COMMAND_PARSED,
      (_variables: any, commands: Array<{ args: string[] }>, _message_content: string) => {
        commands.forEach(cmd => {
          // 修复AI在中文字段名中插入的多余连字符（如 "云-霜-凝" → "云霜凝"）
          cmd.args[0] = cmd.args[0].replaceAll('-', '');
        });
      },
    );
  })();
});
