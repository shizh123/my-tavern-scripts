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
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../schema';
import { validateAndRecalcState, calcHealingStage } from './stateValidation';
import { detectAndWriteMilestones } from './milestoneLog';
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
  getSpecialSceneMaxRounds,
  getSpecialSceneRoundGuidance,
  hasSceneV3,
  buildSceneV3BeatMessage,
  SCENE_V3_BEAT_MARKER,
  LUO_FIRST_MEET_MAX_ROUNDS,
  XIAOJING_MAX_ROUNDS,
  getXiaojingEntryTrigger,
  getXiaojingRoundGuidance,
  isXiaojingRebellionScene,
} from './promptInjection';
import {
  processNewlyActivatedItems,
  processNewlyActivatedLuoItems,
  processEquipmentUnequip,
  tickEquipmentEffects,
  tickTemporaryItems,
  clearSceneTemporaryItems,
  applySpecialSceneConsequences,
  syncClothingFromState,
} from './shopSystem';
import { reloadOnChatChange } from '@/util/script';

// ────────────────────────────────────────────────────────
// 初始化
// ────────────────────────────────────────────────────────

// 硬保护快照：在 CHAT_COMPLETION_PROMPT_READY 从最新消息捕获（包含前端写入），
// 在 VARIABLE_UPDATE_ENDED 用作回滚基准。比旧变量更可靠——旧变量可能是新消息的默认值，
// 不包含前端在两次 AI 回复之间的修改（灵石扣款、模式切换等）。
import type { ProtectionSnapshot, FreezeBaseline } from './stateValidation';
let _protSnapshot: ProtectionSnapshot | null = null;
let _freezeBaseline: FreezeBaseline | null = null;
// 脚本管理的打断冻结楼层（VARIABLE_UPDATE_ENDED 写入，MESSAGE_RECEIVED 恢复）
// 防止 getMvuData() 读到 stale 缓存（0）覆盖脚本设置的冻结值
let _scriptFreezeUntil = 0;
// 脚本管理的消耗品冷却楼层（VARIABLE_UPDATE_ENDED 写入，MESSAGE_RECEIVED 恢复）
// 防止 getMvuData() 读到 stale 缓存导致 processNewlyActivatedItems 双火重复触发消耗品
let _scriptConsumableCooldowns: Record<string, number> = {};
// 上次消费的道具事件（重roll保护：楼层号相同说明是重roll，重注入事件文本）
let _lastConsumedEvent: { floor: number; items: string[] } = { floor: -1, items: [] };
// 监视解除通知门控 (2.0.37)
// 原实现: 模块变量 _freezeNoticeSent, reload 后归零 → 条件重新成立 → 重复 bake 进 user 消息
// 新实现: 用 MVU 持久字段 data._监视解除已发送楼层 做门控, reload 也不会重发
// 通知本身仍 bake 到 user 消息, 给 AI 保留"监视在哪楼解除"的时间锚

// 时间推进楼层守卫（防止同一楼层重复推进时间，如重新生成）

// AI 生成周期标志：CHAT_COMPLETION_PROMPT_READY 设 true，MESSAGE_RECEIVED 设 false。
// 用于区分"AI 回复后的变量更新"与"手动 MVU 重新处理"。
// 手动重新处理时硬保护/去重不应介入，否则会用旧快照覆盖正确的重新解析结果。
let _isInAiCycle = false;

// 道具系统 v2 (2.0.20)：本楼跳过分阶段引导标志。
// Phase 1.6 设置：当 richEvent 非空 + 任一分阶段系统激活 → true，本楼让位给道具叙事。
// Phase 1.7/1.8/1.9 + stateValidation 洛书晴激活推进 都读这个 flag。
// 每楼 Phase 1.6 开头无条件重置为 false（防止上楼残值泄漏）。
let _本楼跳过分阶段引导 = false;
export const isSkipPhaseGuide = () => _本楼跳过分阶段引导;

// 道具系统 v2：清零指定场景的引导延后楼数（场景退出时调用，防 stale 影响下一次激活）
type DelayScene = '千晶' | '孝敬' | '特殊场景' | '洛书晴激活';
const _DELAY_FIELD: Record<DelayScene, string> = {
  千晶: '_千晶引导延后楼数',
  孝敬: '_孝敬引导延后楼数',
  特殊场景: '_特殊场景引导延后楼数',
  洛书晴激活: '_洛书晴激活引导延后楼数',
};
function resetSceneDelayCount(scenes: DelayScene | DelayScene[] | 'all', data: any, raw: any): void {
  const targets: DelayScene[] =
    scenes === 'all' ? (Object.keys(_DELAY_FIELD) as DelayScene[]) : Array.isArray(scenes) ? scenes : [scenes];
  let changed = false;
  for (const s of targets) {
    const f = _DELAY_FIELD[s];
    if (data[f] !== 0) {
      data[f] = 0;
      _.set(raw, `stat_data.${f}`, 0);
      changed = true;
    }
  }
  if (changed) Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
}

$(() => {
  (async () => {
    const _top = (window.parent ?? window) as any;
    try {
      const mvuInitTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('等待 Mvu 初始化超时（>10s），请检查 MVU 插件是否启用')), 10000),
      );
      await Promise.race([waitGlobalInitialized('Mvu'), mvuInitTimeout]);
      registerMvuSchema(Schema);

      // 2.0.22 根因修复: 清理旧 listener 防止累积爆炸
      //
      // 问题: reloadOnChatChange() 的实现是 `window.location.reload()`——这是 iframe 内的
      // navigation,不触发酒馆助手的"脚本关闭自动卸载"钩子。结果每次切聊天后:
      //   1. iframe document 重新加载,脚本重新执行
      //   2. eventOn 传的是新的 arrow function 对象,酒馆助手按 reference 去重不识别
      //   3. 旧 listener 依然留在事件总线上继续跑
      //   4. 新 listener 加入一起跑
      // 每切一次聊天累积一个。玩家反馈一次 AI 请求状态快照重复 9 次 = 9 个 listener。
      // 此外 VARIABLE_UPDATE_ENDED / MESSAGE_RECEIVED 也会累积,可能导致数值回滚跑 N 次/
      // 时间推进 N 次等副作用。reloadOnChatChange 自身的 CHAT_CHANGED listener 也会累积——
      // 累积后每切聊天会 reload N 次,复合爆炸。
      //
      // 修法: 初始化开头先 eventClearEvent 清掉"本 iframe 中"所有相关事件的 listener。
      // 只要 reload 后的 iframe 仍被酒馆助手识别为同一个 iframe (从症状看是的,
      // 否则旧 listener 应该自动卸载),此清理能精确干掉累积的旧 listener,不影响其他脚本。
      eventClearEvent(tavern_events.CHAT_COMPLETION_PROMPT_READY);
      eventClearEvent(tavern_events.MESSAGE_RECEIVED);
      eventClearEvent(tavern_events.CHAT_CHANGED);
      eventClearEvent(Mvu.events.VARIABLE_UPDATE_ENDED);
      eventClearEvent(Mvu.events.COMMAND_PARSED);

      reloadOnChatChange();
      // 2.0.22: toast dedup —— 用 sessionStorage gate 防止切换聊天/手动重载时反复弹出。
      // sessionStorage 在 window.location.reload() 后保留,但浏览器关闭后清空,
      // 所以"切聊天 reload"不会重弹,"重启浏览器/刷新酒馆页面"会重弹一次(玩家想确认脚本正常)。
      const ALREADY_TOASTED_KEY = '云霜凝_脚本toast已弹';
      if (!sessionStorage.getItem(ALREADY_TOASTED_KEY)) {
        _top.toastr?.success?.('游戏逻辑脚本加载正常', '云霜凝');
        sessionStorage.setItem(ALREADY_TOASTED_KEY, '1');
      }
      sessionStorage.setItem('云霜凝_脚本已加载', String(Date.now()));
      // 2.0.32: 心跳 + 清失败 gate，让状态栏 iframe 能跨 iframe 监察脚本是否在跑。
      // 脚本 iframe reload(切聊天)时 setInterval 随 iframe 销毁,不会累积。
      try {
        _top.sessionStorage?.setItem?.('云霜凝_脚本心跳', String(Date.now()));
        _top.sessionStorage?.removeItem?.('云霜凝_加载失败toast已弹');
        setInterval(() => {
          try {
            _top.sessionStorage?.setItem?.('云霜凝_脚本心跳', String(Date.now()));
          } catch {}
        }, 5000);
      } catch {}
      console.info('[云霜凝] 游戏逻辑脚本已加载（Schema 已注册）');
    } catch (err) {
      console.error('[云霜凝] 游戏逻辑脚本加载失败:', err);
      _top.toastr?.error?.(
        `游戏逻辑脚本加载失败：${(err as Error)?.message ?? String(err)}\n请 F12 查看控制台`,
        '云霜凝',
        { timeOut: 0, extendedTimeOut: 0 },
      );
      return;
    }

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

        _isInAiCycle = true;

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
            // 2.0.22 Bug 1 修复: 退出时清空 _神魂记忆场景,防止云霜凝的记忆场景泄漏到下次进入
            // (尤其是泄漏到洛书晴神魂空间——洛书晴空间不应该有 _神魂记忆场景)
            // 云霜凝入口再次触发时会重新 selectSoulMemory 决定记忆场景
            data._神魂记忆场景 = '';
            _.set(raw, 'stat_data._当前互动模式', '日常');
            _.set(raw, 'stat_data._神魂空间激活中', false);
            _.set(raw, 'stat_data._神魂记忆场景', '');
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info('[云霜凝] 退出神魂空间：模式已切换为日常，记忆场景已清空');
          } else if (hasEntry) {
            data._当前互动模式 = '神魂空间';
            data._神魂空间激活中 = true;
            _.set(raw, 'stat_data._当前互动模式', '神魂空间');
            _.set(raw, 'stat_data._神魂空间激活中', true);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info('[云霜凝] 神魂空间引导：模式已切换为神魂空间');
          }

          // 标记神魂空间已进入过（自动引导/手动入口都算"进入过",防止卡在首次引导循环）
          // 2.0.23 修: 原来只对 __神魂空间入口__(手动按钮)设 _神魂空间已进入过=true,
          // 入口一玩到第 5 楼 stateValidation 自动 push __神魂空间引导__,模式虽切换但
          // 标志不更新 → buildStatusSnapshot 永远走"首次引导"分支 → 玩家每轮看到"请详细
          // 描写首次进入感官体验",卡在循环。
          // 修复:hasEntry(任一入口 event)都标记进入过。selectSoulMemory 仍只对手动按钮
          // 触发(阶段 3+ 才有记忆场景,自动引导是阶段 1 不需要选记忆)。
          if (hasEntry) {
            let memoryUpdated = false;
            if (!data._神魂空间已进入过) {
              data._神魂空间已进入过 = true;
              _.set(raw, 'stat_data._神魂空间已进入过', true);
              memoryUpdated = true;
              console.info('[云霜凝] 首次进入神魂空间，已标记');
            }
            if (items.includes('__神魂空间入口__')) {
              // 选择记忆场景（阶段3+时生效,手动按钮才需要）
              selectSoulMemory(data);
              _.set(raw, 'stat_data._神魂记忆场景', data._神魂记忆场景);
              _.set(raw, 'stat_data._新婚夜已触发', data._新婚夜已触发);
              _.set(raw, 'stat_data._记忆进入次数', data._记忆进入次数);
              if (data._神魂记忆场景) {
                console.info(`[云霜凝] 神魂记忆场景：${data._神魂记忆场景}`);
              }
              memoryUpdated = true;
            }
            if (memoryUpdated) Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
          }
        }

        // ── 记录本轮消费的事件 + 楼层（重roll保护：供 Phase 1.3b 使用）──
        const currentFloor = SillyTavern.chat?.length ?? 0;
        if (items.length > 0) {
          _lastConsumedEvent = { floor: currentFloor, items: [...items] };
        }

        // ── Phase 1.3: 蚀心露屈辱转变事件重注入（重roll保护） ──
        // 场景：蚀心露触发转变后玩家重roll，_待发送道具事件已被消费清空，
        // AI收不到转变事件文本 → 口胡。检测：_protSnapshot 已标记屈辱但当前数据还没有。
        if (_protSnapshot?.已触发蚀心露屈辱 && !data._已触发蚀心露屈辱 && !items.includes('__蚀心露屈辱转变__')) {
          const reinjected = buildBatchUseEvent(['__蚀心露屈辱转变__'], data);
          richEvent = richEvent ? richEvent + '\n\n' + reinjected : reinjected;
          // 同步更新数据，防止后续逻辑再次误判
          data._已触发蚀心露屈辱 = true;
          data.苗广.心态 = '屈辱';
          data.苗广.疑心值 = 0;
          _.set(raw, 'stat_data._已触发蚀心露屈辱', true);
          _.set(raw, 'stat_data.苗广.心态', '屈辱');
          _.set(raw, 'stat_data.苗广.疑心值', 0);
          Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
          console.info('[云霜凝] 蚀心露屈辱转变事件重注入（重roll保护）');
        }

        // ── Phase 1.3b: 通用道具事件重注入（重roll保护）──
        // 场景：净灵铃/神魂入口等前端道具事件首次消费后，玩家重roll导致事件文本丢失。
        // 检测：本轮无新事件（items=[]）且楼层号与上次消费楼层相同（重roll时chat长度不变）。
        // 排除已有专用保护的事件，避免与 Phase 1.3/1.4/1.5 重复注入。
        {
          const DEDICATED_EVENTS = ['__蚀心露屈辱转变__', '__打断治疗__', '__打断治疗_神魂__', '__坏结局_愤怒__'];
          if (items.length === 0 && _lastConsumedEvent.floor === currentFloor && _lastConsumedEvent.items.length > 0) {
            const rerollItems = _lastConsumedEvent.items.filter(e => !DEDICATED_EVENTS.includes(e));
            if (rerollItems.length > 0) {
              const reinjected = buildBatchUseEvent(rerollItems, data);
              richEvent = richEvent ? richEvent + '\n\n' + reinjected : reinjected;
              console.info('[云霜凝] 道具事件重注入（重roll保护）:', rerollItems.join(', '));
            }
          }
        }

        // ── Phase 1.4: 坏结局持续锁定（每轮强制注入，覆盖一切其他事件） ──
        // 2.0.22 场景引擎 v2: 原 3 个硬编码模板按 floor % 3 轮换,含大量具体画面/台词示例
        // (空荡房间/药香/霜花/寒霜门禁制/云霜凝的眼神...),违反 v2 AI-first 原则。
        // 改为单条只含事实 + 约束 + 禁止的指引,余韵由 AI 按当前情境自主生成。
        if (data._坏结局已触发) {
          // 触发楼不注入锁定模板（触发楼由 __坏结局_愤怒__ 事件处理）
          const isTriggerFloor = items.includes('__坏结局_愤怒__');
          if (!isTriggerFloor) {
            richEvent = `[坏结局·锁定中·叙事原则·必读]

游戏已结束。苗广已确认真相,愤怒爆发,{{user}} 被逐出寒霜门,治疗中断,
云霜凝被苗广带走,不可挽回。

▍本轮叙事内容
- 只写结局后的余韵(环境 / 心境 / 残留感受 / {{user}} 当下所见所想)
- AI 按当前情境自主选择焦点和角度,不必每轮重复相同画面

▍绝对禁止
- ✗ 禁止描写任何治疗互动 / 角色对话 / 剧情推进
- ✗ 禁止写苗广原谅 / 和解 / 挽回可能
- ✗ 禁止云霜凝 / 苗广出场 (他们已不在 {{user}} 可及范围)
- ✗ 禁止输出任何 SET 命令或数值变化
- ✗ 禁止替 {{user}} 说话或做决定`;
            console.info('[云霜凝] 坏结局持续锁定 v2 指引注入');
          }
        }

        // ── Phase 1.5: 打断冻结期持续提示 / 解除提示 ──
        {
          // 优先使用脚本管理的冻结值（getMvuData可能读到stale 0）
          const freezeUntil = _scriptFreezeUntil > 0 ? _scriptFreezeUntil : data._打断冻结至楼层;

          // 打断事件重注入（重roll保护）：冻结刚触发但事件文本已被消费
          // 检测：_scriptFreezeUntil > 0 但 MVU 数据还是 0（stale），且当前没有打断事件
          if (
            _scriptFreezeUntil > 0 &&
            data._打断冻结至楼层 === 0 &&
            !items.includes('__打断治疗__') &&
            !items.includes('__打断治疗_神魂__')
          ) {
            // 判断是否在神魂空间中被打断（神魂空间激活中已被切为false）
            const isFromSoul =
              data._当前互动模式 === '日常' && !data._神魂空间激活中 && _protSnapshot?.当前互动模式 === '神魂空间';
            const event = isFromSoul ? '__打断治疗_神魂__' : '__打断治疗__';
            const reinjected = buildBatchUseEvent([event], data);
            richEvent = richEvent ? richEvent + '\n\n' + reinjected : reinjected;
            // 同步冻结值到 MVU
            data._打断冻结至楼层 = _scriptFreezeUntil;
            _.set(raw, 'stat_data._打断冻结至楼层', _scriptFreezeUntil);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info(`[云霜凝] 打断事件重注入（重roll保护）：${event}`);
          }

          if (freezeUntil > 0 && currentFloor < freezeUntil) {
            // 冻结中：注入监视提示
            const freezeNotice = `【系统强制状态：苗广监视期】⚠️ 最高优先级 ⚠️
═══════════════════════════════════════
苗广打断治疗后正处于高度警惕状态，频繁查看云霜凝的房间（剩余${freezeUntil - currentFloor}楼）。

【强制规则 - 违反将导致游戏崩溃】
1. 禁止任何治疗互动：信任度、心理防线、完成度、身体开发数值不得变化
2. 禁止任何亲密/暧昧描写：肢体接触、暗示性对话、挑逗行为一律禁止
3. 禁止进入神魂空间：苗广的灵压干扰阻断了神魂连接
4. 必须描写紧张氛围：走廊脚步声、门外停顿、苗广不定时推门查看
5. {{user}}和云霜凝只能进行日常寒暄、正经话题

【场景氛围】
苗广虽不常驻房间内，但会不定时推门查看，每次停留数息后才离开。云霜凝和{{user}}都能感受到门外偶尔传来的脚步声和灵压波动。任何试图恢复治疗的行为都会被苗广察觉。
═══════════════════════════════════════`;
            richEvent = richEvent ? richEvent + '\n\n' + freezeNotice : freezeNotice;
            console.info(`[云霜凝] 打断冻结持续提示注入（剩余${freezeUntil - currentFloor}楼）`);
          } else if (freezeUntil > 0 && currentFloor >= freezeUntil && data._监视解除已发送楼层 < freezeUntil) {
            // 冻结刚结束: 注入一次性解除提示到 user 消息(bake 进 chat history 做时间锚)
            //
            // 2.0.37 修 reload 重发 bug: 门控从模块变量 _freezeNoticeSent 改为 MVU 持久字段
            //   data._监视解除已发送楼层。旧实现 reload 后模块变量归零,条件重新成立 →
            //   每次 reload 都再烤一份到当前 user 消息, chat history 累积多份。
            //   持久字段 reload 后仍在 → 每次冻结只烤一次。
            //
            // 注意:必须用 >= 而非 ===，因为 chat.length 每轮+2（user+AI），
            // 奇偶不匹配时 === 永远命中不了目标楼层。
            //
            // 关键:不再把 _打断冻结至楼层 清零——stateValidation.ts:603 的冷却闸门
            // `currentFloor >= _打断冻结至楼层 + INTERRUPT_COOLDOWN` 需要它作为锚点。
            // 清零会让冷却闸门变成 `currentFloor >= 8` 恒为 true，导致监视结束后
            // 立即可以触发新的打断 → "监视结束立刻被监视"死循环。
            //
            // 下次新的打断覆写 _打断冻结至楼层 到更大值时, 新值 > data._监视解除已发送楼层,
            // 门控重新放行,新冻结周期结束后能再发一次解除通知。
            const unfreezeNotice = `【监视解除】苗广的监视告一段落，{{user}}和云霜凝又有了单独相处的空间，治疗互动可以恢复。
不要继续描写苗广的监视行为，苗广当前不在房间内。回归正常互动节奏。`;
            richEvent = richEvent ? richEvent + '\n\n' + unfreezeNotice : unfreezeNotice;
            data._监视解除已发送楼层 = freezeUntil;
            _.set(raw, 'stat_data._监视解除已发送楼层', freezeUntil);
            Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
            console.info(
              `[云霜凝] 打断冻结结束,解除提示已注入(持久化门控 _监视解除已发送楼层=${freezeUntil})`,
            );
          }
        }

        // ── Phase 1.6: 道具楼让位机制（2.0.20 新增） ──
        // 当 richEvent 非空 + 任一分阶段引导系统激活中：
        //   · 跳过本楼分阶段引导（让位给道具叙事）—— 用 richEvent 判断（覆盖 reroll）
        //   · 仅在首次消费时（items.length > 0）累加对应延后字段（reroll 不重复 +1）
        //   · 打断/坏结局事件则一次性清零所有 4 个延后字段（场景被强制中断）
        // skip flag 通过 module variable _本楼跳过分阶段引导 共享给 Phase 1.7/1.8/1.9 + stateValidation
        {
          _本楼跳过分阶段引导 = false; // 每楼无条件重置

          // 通用兜底：打断/坏结局触发 → 清零 all
          const isInterrupted =
            items.includes('__打断治疗__') || items.includes('__打断治疗_神魂__') || items.includes('__坏结局_愤怒__');
          if (isInterrupted) {
            resetSceneDelayCount('all', data, raw);
            console.info('[云霜凝] Phase 1.6: 打断/坏结局触发，清零所有引导延后字段');
          }

          if (richEvent) {
            const currentFloor = SillyTavern.chat?.length ?? 0;
            const qjActive = data.苗广.千晶幻术.激活中 && data._千晶幻术开始楼层 > 0;
            const xjActive = data.苗广.孝敬师父.激活中 && data._孝敬师父开始楼层 > 0;
            // 2.0.32: 洛书晴现实初遇排除在"道具楼让位"外——本场景由脚本硬触发,
            // 不应被道具事件让延后楼数累加,否则 Phase 1.9b nominalRound(不减 delay)
            // 和 buildStatusSnapshot 的 round(减 delay)会错位,玩家体验卡轮。
            const sceneActive =
              !!data._特殊场景.进行中 && data._特殊场景开始楼层 > 0 && data._特殊场景.进行中 !== '洛书晴现实初遇';
            const luoActivating = data._洛书晴激活轮次进度 >= 1 && data._洛书晴激活轮次进度 < 5;
            const anyActive = qjActive || xjActive || sceneActive || luoActivating;

            if (anyActive) {
              _本楼跳过分阶段引导 = true;

              // 仅在首次消费时累加（reroll 时 items=[] 但 richEvent 由 Phase 1.3b 重注入）
              if (items.length > 0) {
                let changed = false;
                if (qjActive) {
                  data._千晶引导延后楼数 += 1;
                  _.set(raw, 'stat_data._千晶引导延后楼数', data._千晶引导延后楼数);
                  changed = true;
                }
                if (xjActive) {
                  data._孝敬引导延后楼数 += 1;
                  _.set(raw, 'stat_data._孝敬引导延后楼数', data._孝敬引导延后楼数);
                  changed = true;
                }
                if (sceneActive) {
                  data._特殊场景引导延后楼数 += 1;
                  _.set(raw, 'stat_data._特殊场景引导延后楼数', data._特殊场景引导延后楼数);
                  changed = true;
                }
                if (luoActivating) {
                  data._洛书晴激活引导延后楼数 += 1;
                  _.set(raw, 'stat_data._洛书晴激活引导延后楼数', data._洛书晴激活引导延后楼数);
                  changed = true;
                }
                if (changed) Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
              }
              console.info(
                `[云霜凝] Phase 1.6: 道具楼让位 (qj=${qjActive} xj=${xjActive} scene=${sceneActive} luo=${luoActivating}, items=${items.length}, floor=${currentFloor})`,
              );
            }
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
            // 双轨：nominal 用于 auto-exit（防永不退出）；actual 扣延后楼数用于引导注入
            const nominalRound = Math.floor((currentFloor - qjStartFloor) / 2) + 1;
            const actualRound = Math.floor((currentFloor - qjStartFloor - data._千晶引导延后楼数) / 2) + 1;

            // 2.0.20 修法：最后一轮（actualRound == maxRounds）注入"最后一轮"引导后立即清场——
            // roundGuidance[maxRounds] 本身已经包含"退出识海 + 苗广醒来"等结束动作，
            // 不再单独触发 exitText 楼，避免玩家在 maxRounds+1 楼"还能继续在副本里玩一轮"。
            // 兜底：若 nominalRound 越过 maxRounds（reroll/异常），仍清场。
            const isFinalRound = !_本楼跳过分阶段引导 && actualRound >= maxRounds;
            const isOvershoot = nominalRound > maxRounds;

            if (isFinalRound || isOvershoot) {
              // ── 注入最后一轮引导（仅 isFinalRound 情况，且当前未越界）──
              // v2(2.0.22): rewriteBeat 空格拼接,融入玩家口吻
              if (isFinalRound && !isOvershoot) {
                const beat = getQianjingRoundGuidance(已使用次数, maxRounds);
                if (beat) {
                  for (let i = chat.length - 1; i >= 0; i--) {
                    if (chat[i].role === 'user') {
                      const content = chat[i].content;
                      chat[i].content = typeof content === 'string' ? content + ' ' + beat : beat;
                      break;
                    }
                  }
                }
              }

              // ── 立即清场 ──
              data.苗广.千晶幻术.激活中 = false;
              data.苗广.千晶幻术.冷却结束楼层 = currentFloor + 4;
              if (已使用次数 >= 3) {
                data.苗广.千晶幻术.认知改写完成 = true;
              }
              data._千晶幻术开始楼层 = 0;
              _.set(raw, 'stat_data.苗广.千晶幻术.激活中', false);
              _.set(raw, 'stat_data.苗广.千晶幻术.冷却结束楼层', currentFloor + 4);
              _.set(raw, 'stat_data.苗广.千晶幻术.认知改写完成', data.苗广.千晶幻术.认知改写完成);
              _.set(raw, 'stat_data._千晶幻术开始楼层', 0);
              Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
              resetSceneDelayCount('千晶', data, raw);

              if (isOvershoot) {
                console.warn(
                  `[云霜凝] 千晶幻术第${已使用次数}次 nominalRound=${nominalRound} 越过 maxRounds=${maxRounds}，强制清场（兜底）`,
                );
              } else {
                console.info(
                  `[云霜凝] 千晶幻术第${已使用次数}次·第${maxRounds}/${maxRounds}轮（最终轮）已注入并自动清场`,
                );
              }
            } else if (!_本楼跳过分阶段引导 && actualRound >= 2) {
              // ── 中间轮：注入逐轮 rewriteBeat（actualRound 扣延后楼数）──
              // v2: 空格拼接融入玩家口吻
              const beat = getQianjingRoundGuidance(已使用次数, actualRound);
              if (beat) {
                for (let i = chat.length - 1; i >= 0; i--) {
                  if (chat[i].role === 'user') {
                    const content = chat[i].content;
                    chat[i].content = typeof content === 'string' ? content + ' ' + beat : beat;
                    break;
                  }
                }
                console.info(`[云霜凝] 千晶幻术第${已使用次数}次·第${actualRound}/${maxRounds}轮 rewriteBeat 已注入`);
              }
            }
          }
        }

        // ── Phase 1.8: 孝敬师父轮次追踪与自动退出 ──
        {
          const currentFloor = SillyTavern.chat?.length ?? 0;
          const xjActive = data.苗广.孝敬师父.激活中;
          const xjStartFloor = data._孝敬师父开始楼层;
          const hasXjEntry = items.includes('__孝敬师父_进入__');

          if (xjActive && !hasXjEntry && xjStartFloor > 0) {
            const scenarioIdx = Math.max(0, data.苗广.孝敬师父.上次场景索引);
            const maxRounds = XIAOJING_MAX_ROUNDS;
            const nominalRound = Math.floor((currentFloor - xjStartFloor) / 2) + 1;
            const actualRound = Math.floor((currentFloor - xjStartFloor - data._孝敬引导延后楼数) / 2) + 1;

            // 2.0.20: 最后一轮注入引导后立即清场（同千晶幻术）
            const isFinalRound = !_本楼跳过分阶段引导 && actualRound >= maxRounds;
            const isOvershoot = nominalRound > maxRounds;

            if (isFinalRound || isOvershoot) {
              // ── 注入最后一轮引导（仅 isFinalRound 情况，且当前未越界）──
              if (isFinalRound && !isOvershoot) {
                const guidance = getXiaojingRoundGuidance(scenarioIdx, maxRounds);
                if (guidance) {
                  for (let i = chat.length - 1; i >= 0; i--) {
                    if (chat[i].role === 'user') {
                      const content = chat[i].content;
                      chat[i].content = typeof content === 'string' ? content + '\n\n' + guidance : guidance;
                      break;
                    }
                  }
                }
              }

              // ── 立即清场 ──
              data.苗广.孝敬师父.激活中 = false;
              data.苗广.孝敬师父.冷却结束楼层 = currentFloor + 5;
              data._孝敬师父开始楼层 = 0;

              // 降低疑心值 5~8（前半程才生效）
              const 心态 = data.苗广.心态;
              const 是前半程 = 心态 !== '屈辱' && 心态 !== '默许' && 心态 !== '沉溺';
              if (是前半程) {
                const reduction = 5 + Math.floor(Math.random() * 4); // 5~8
                const oldSus = data.苗广.疑心值;
                data.苗广.疑心值 = Math.max(0, data.苗广.疑心值 - reduction);
                console.info(`[云霜凝] 孝敬师父完成，疑心值 -${reduction}（${oldSus} → ${data.苗广.疑心值}）`);
              }

              // v2(2.0.22) · 反抗类基调(scenarioIdx 复用为基调编号,1 不是反抗,2-6 都是)清场:
              //   清 _苗喧反抗限制中 + 设 _扰动冷却结束楼层 = currentFloor + 15(双向扰动冷却机制)
              if (isXiaojingRebellionScene(scenarioIdx)) {
                data._苗喧反抗限制中 = false;
                data._苗喧反抗限制触发楼层 = 0;
                data._扰动冷却结束楼层 = currentFloor + 15;
                _.set(raw, 'stat_data._苗喧反抗限制中', false);
                _.set(raw, 'stat_data._苗喧反抗限制触发楼层', 0);
                _.set(raw, 'stat_data._扰动冷却结束楼层', currentFloor + 15);
                console.info('[云霜凝] 孝敬师父反抗类基调完成，_苗喧反抗限制中 → false，_扰动冷却结束楼层 → +15');
              }

              _.set(raw, 'stat_data.苗广.孝敬师父.激活中', false);
              _.set(raw, 'stat_data.苗广.孝敬师父.冷却结束楼层', currentFloor + 5);
              _.set(raw, 'stat_data.苗广.疑心值', data.苗广.疑心值);
              _.set(raw, 'stat_data._孝敬师父开始楼层', 0);
              Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
              resetSceneDelayCount('孝敬', data, raw);

              if (isOvershoot) {
                console.warn(
                  `[云霜凝] 孝敬师父 nominalRound=${nominalRound} 越过 maxRounds=${maxRounds}，强制清场（兜底）`,
                );
              } else {
                console.info(`[云霜凝] 孝敬师父·第${maxRounds}/${maxRounds}轮（最终轮）已注入并自动清场`);
              }
            } else if (!_本楼跳过分阶段引导 && actualRound >= 2) {
              // ── 注入逐轮引导（actualRound 扣延后）──
              const guidance = getXiaojingRoundGuidance(scenarioIdx, actualRound);
              if (guidance) {
                for (let i = chat.length - 1; i >= 0; i--) {
                  if (chat[i].role === 'user') {
                    const content = chat[i].content;
                    chat[i].content = typeof content === 'string' ? content + '\n\n' + guidance : guidance;
                    break;
                  }
                }
                console.info(`[云霜凝] 孝敬师父·第${actualRound}/${maxRounds}轮引导已注入`);
              }
            }
          }
        }

        // ── Phase 1.9: 特殊场景轮次追踪与自动退出（类似千晶幻术 Phase 1.7）──
        // 2.0.22 Finding X 修复: 只处理 SPECIAL_SCENE_GUIDES 里注册的场景(maxRounds > 0)。
        // '洛书晴现实初遇' 不在 SPECIAL_SCENE_GUIDES(走独立 buildStatusSnapshot 分支 + Phase 1.9b 清场),
        // 原判定 `sceneName && sceneStartFloor > 0` 会让它进入,拿 maxRounds=0 的 fallback
        // 让 nominalRound=1 满足 isOvershoot,场景第 1 轮就被清场,session 9 a44d142 的 4 轮
        // beat guide 永不生效。
        //
        // 2.0.36 场景引擎 v3: 如果场景有 v3 字段,beat 注入改为 system msg(Phase 3.6 推送,
        // 不污染 user msg,marker cleanup 幂等),否则走 v2 path(user msg 拼接)。
        let _v3BeatPendingPush: string | null = null;
        {
          const currentFloor = SillyTavern.chat?.length ?? 0;
          const sceneName = data._特殊场景.进行中;
          const sceneStartFloor = data._特殊场景开始楼层;

          if (sceneName && sceneStartFloor > 0 && getSpecialSceneMaxRounds(sceneName) > 0) {
            const maxRounds = getSpecialSceneMaxRounds(sceneName);
            const nominalRound = Math.floor((currentFloor - sceneStartFloor) / 2) + 1;
            const actualRound = Math.floor((currentFloor - sceneStartFloor - data._特殊场景引导延后楼数) / 2) + 1;
            const isV3Scene = hasSceneV3(sceneName);

            // 2.0.27 修: 清场条件从 rewriteBeat 注入解耦。
            // 原逻辑 isFinalRound 要求 !_本楼跳过分阶段引导,导致道具楼永远不触发最终轮清场;
            // isOvershoot 要求 nominalRound 超过 maxRounds,但 reroll 时 cf 不变,
            // 若玩家在最终轮卡 reroll(尤其是道具 reroll 重注入),场景永远不清。
            // 改法: 达到最终轮就清场(强制);道具楼跳过 beat 注入但仍清场。
            const 达到最终轮 = actualRound >= maxRounds;
            const isOvershoot = nominalRound > maxRounds;
            const 应清场 = 达到最终轮 || isOvershoot;
            const 可注入最终beat = 达到最终轮 && !isOvershoot && !_本楼跳过分阶段引导;

            if (应清场) {
              // ── 注入最后一轮引导（非道具楼 + 未越界时才注入）──
              if (可注入最终beat) {
                if (isV3Scene) {
                  // v3: 存 pending,等 Phase 3.6 push 为 system msg
                  _v3BeatPendingPush = buildSceneV3BeatMessage(sceneName, maxRounds);
                } else {
                  // v2: 空格拼到 user 消息末尾
                  const beat = getSpecialSceneRoundGuidance(sceneName, maxRounds);
                  if (beat) {
                    for (let i = chat.length - 1; i >= 0; i--) {
                      if (chat[i].role === 'user') {
                        const content = chat[i].content;
                        chat[i].content = typeof content === 'string' ? content + ' ' + beat : beat;
                        break;
                      }
                    }
                  }
                }
              }

              // ── 立即清场 ──
              applySpecialSceneConsequences(sceneName, data);
              data._已完成特殊场景[sceneName] = true;
              data._特殊场景.进行中 = '';
              data._特殊场景开始楼层 = 0;
              _.set(raw, 'stat_data._已完成特殊场景', data._已完成特殊场景);
              _.set(raw, 'stat_data._特殊场景.进行中', '');
              _.set(raw, 'stat_data._特殊场景开始楼层', 0);
              Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
              resetSceneDelayCount('特殊场景', data, raw);

              if (isOvershoot) {
                console.warn(
                  `[云霜凝] 特殊场景「${sceneName}」 nominalRound=${nominalRound} 越过 maxRounds=${maxRounds}，强制清场（兜底）`,
                );
              } else if (可注入最终beat) {
                console.info(
                  `[云霜凝] 特殊场景「${sceneName}」·第${maxRounds}/${maxRounds}轮（最终轮）已注入并自动清场 [${isV3Scene ? 'v3' : 'v2'}]`,
                );
              } else {
                console.info(
                  `[云霜凝] 特殊场景「${sceneName}」·第${maxRounds}/${maxRounds}轮(道具楼)无 beat 注入,仍强制清场`,
                );
              }
            } else if (!_本楼跳过分阶段引导) {
              if (isV3Scene) {
                // v3: 每轮(含第1轮)注入 beat 为 system msg,让 Phase 3.6 处理 push
                const v3Msg = buildSceneV3BeatMessage(sceneName, actualRound);
                if (v3Msg) {
                  _v3BeatPendingPush = v3Msg;
                  console.info(
                    `[云霜凝] 特殊场景v3·${sceneName}·第${actualRound}/${maxRounds}轮 beat 将注入(system msg)`,
                  );
                }
              } else if (actualRound >= 2) {
                // v2: 从第 2 轮开始拼接到 user 消息末尾(第 1 轮只靠 entryText)
                const beat = getSpecialSceneRoundGuidance(sceneName, actualRound);
                if (beat) {
                  for (let i = chat.length - 1; i >= 0; i--) {
                    if (chat[i].role === 'user') {
                      const content = chat[i].content;
                      chat[i].content = typeof content === 'string' ? content + ' ' + beat : beat;
                      break;
                    }
                  }
                  console.info(`[云霜凝] 特殊场景·${sceneName}·第${actualRound}/${maxRounds}轮 rewriteBeat 已注入`);
                }
              }
            }
          }
        }

        // ── Phase 1.9b: 洛书晴现实初遇专用清场 ──
        // 本场景不在 SPECIAL_SCENE_GUIDES,由 buildStatusSnapshot 独立 4 轮 beat 引导路径处理,
        // Phase 1.9 已经 skip 它。此处在 nominalRound > LUO_FIRST_MEET_MAX_ROUNDS(4)时自动清场,
        // 避免 _特殊场景.进行中 永久卡住。
        {
          const currentFloor = SillyTavern.chat?.length ?? 0;
          if (data._特殊场景.进行中 === '洛书晴现实初遇' && data._特殊场景开始楼层 > 0) {
            const sceneStartFloor = data._特殊场景开始楼层;
            const nominalRound = Math.floor((currentFloor - sceneStartFloor) / 2) + 1;
            if (nominalRound > LUO_FIRST_MEET_MAX_ROUNDS) {
              data._已完成特殊场景['洛书晴现实初遇'] = true;
              data._特殊场景.进行中 = '';
              data._特殊场景开始楼层 = 0;
              _.set(raw, 'stat_data._已完成特殊场景', data._已完成特殊场景);
              _.set(raw, 'stat_data._特殊场景.进行中', '');
              _.set(raw, 'stat_data._特殊场景开始楼层', 0);
              Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
              resetSceneDelayCount('特殊场景', data, raw);
              console.info(`[云霜凝] 洛书晴现实初遇·第${LUO_FIRST_MEET_MAX_ROUNDS}轮完成,自动清场`);
            }
          }
        }

        // ── Phase 2: 构建状态快照（注入在 Phase 3 之后执行，避免被事件替换覆盖）──
        // v2: pendingItems 传入 getStatusSnapshot 用于动态焦点收窄。
        // reroll 情况 items=[]，但 richEvent 由 Phase 1.3b 重注入 → 从 _lastConsumedEvent 兜底。
        const effectivePending =
          items.length > 0
            ? items
            : richEvent && _lastConsumedEvent.floor === currentFloor
              ? _lastConsumedEvent.items
              : [];
        const snapshot = getStatusSnapshot(data, effectivePending);

        // ── Phase 3: 注入事件文本到玩家消息 + 特殊场景触发 ──
        if (richEvent) {
          // 打断事件：替换玩家消息（强制AI演绎打断场景）
          const isInterruption =
            items.includes('__打断治疗__') || items.includes('__打断治疗_神魂__') || items.includes('__坏结局_愤怒__');

          // 2.0.30: 幂等清理旧的"场景强制切换"system 消息,防止 reroll 时累积
          // chat 是 SillyTavern.chat 直接引用,splice 会污染 history,reroll 重注入事件会再 splice
          if (isInterruption) {
            const SCENE_BREAK_MARKER = '【系统指令：场景强制切换】';
            for (let i = chat.length - 1; i >= 0; i--) {
              const msg = chat[i];
              const content = msg?.content;
              if (msg?.role === 'system' && typeof content === 'string' && content.includes(SCENE_BREAK_MARKER)) {
                chat.splice(i, 1);
              }
            }
          }

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
            resetSceneDelayCount('千晶', data, raw);
            console.info(`[云霜凝] 千晶幻术第${data.苗广.千晶幻术.已使用次数}次提前退出`);
          }

          // 千晶幻术入场触发：替换玩家消息 + 预填指令
          // v2(2.0.22): 首轮 rewriteBeat[1] 空格拼接到 entryText 末尾(融入玩家口吻)
          if (items.includes('__千晶幻术_进入__')) {
            const qjTrigger = getQianjingEntryTrigger(data.苗广.千晶幻术.已使用次数, data.苗广.千晶幻术.幻境摘要);
            const beat1 = getQianjingRoundGuidance(data.苗广.千晶幻术.已使用次数, 1);
            const userMsgWithBeat = beat1 ? qjTrigger.userMessage + ' ' + beat1 : qjTrigger.userMessage;
            const combined =
              userMsgWithBeat + `\n\n【AI必须以以下内容作为回复开头，然后继续展开】\n${qjTrigger.prefill}`;
            for (let i = chat.length - 1; i >= 0; i--) {
              if (chat[i].role === 'user') {
                chat[i].content = combined;
                break;
              }
            }
            console.info(
              `[云霜凝] 千晶幻术第${data.苗广.千晶幻术.已使用次数}次入场触发${beat1 ? ' (含首轮 rewriteBeat)' : ''}`,
            );
          }

          // 孝敬师父入场触发：替换玩家消息 + 预填指令
          if (items.includes('__孝敬师父_进入__')) {
            const scenarioIdx = Math.max(0, data.苗广.孝敬师父.上次场景索引);
            const xjTrigger = getXiaojingEntryTrigger(scenarioIdx);
            const combined =
              xjTrigger.userMessage + `\n\n【AI必须以以下内容作为回复开头，然后继续展开】\n${xjTrigger.prefill}`;
            for (let i = chat.length - 1; i >= 0; i--) {
              if (chat[i].role === 'user') {
                chat[i].content = combined;
                break;
              }
            }
            console.info(`[云霜凝] 孝敬师父入场触发（场景${scenarioIdx}）`);
          }

          // 特殊场景方式3触发：替换玩家消息 + 预填指令
          // v2(2.0.22): 首轮 rewriteBeat[1] 空格拼接到 entryText 末尾(融入玩家口吻)
          for (const name of items) {
            const trigger = getSpecialSceneTrigger(name);
            if (trigger) {
              const beat1 = getSpecialSceneRoundGuidance(name, 1);
              const userMsgWithBeat = beat1 ? trigger.userMessage + ' ' + beat1 : trigger.userMessage;
              const combined =
                userMsgWithBeat + `\n\n【AI必须以以下内容作为回复开头，然后继续展开】\n${trigger.prefill}`;
              for (let i = chat.length - 1; i >= 0; i--) {
                if (chat[i].role === 'user') {
                  chat[i].content = combined;
                  break;
                }
              }
              console.info(`[云霜凝] 特殊场景方式3触发: ${name}${beat1 ? ' (含首轮 rewriteBeat)' : ''}`);
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
        //
        // 2.0.22: 幂等注入修复——先清理 chat 里所有旧的状态快照 system messages,再 push 新的。
        // 根因: event_data.chat 或 listener 泄漏导致 snapshot 累积(玩家反馈一条消息里看到 9
        // 份孝敬师父快照重复)。无论根因是 chat 是 SillyTavern.chat 的引用(上次 push 留在
        // history 下次请求又带进来) 还是 CHAT_COMPLETION_PROMPT_READY listener 泄漏
        // (多个 listener 每次 AI 请求都各 push 一次),清理+push 都能做到幂等注入。
        if (snapshot) {
          // 清理所有旧状态快照 system messages
          // 主标记: [当前游戏状态快照 (所有新分支都带此前缀)
          // 兼容标记: [洛书晴激活剧情进行中 / [洛书晴现实初遇·第 — 2.0.29 及之前的残留
          //          (彼时这俩分支没带主前缀 → 清理器匹配不到 → reroll/删楼回档累积多份)
          const SNAPSHOT_MARKERS = ['[当前游戏状态快照', '[洛书晴激活剧情进行中', '[洛书晴现实初遇·第'];
          for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            const content = msg?.content;
            if (
              msg?.role === 'system' &&
              typeof content === 'string' &&
              SNAPSHOT_MARKERS.some(m => content.includes(m))
            ) {
              chat.splice(i, 1);
            }
          }
          const lastMsg = chat[chat.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            chat.splice(chat.length - 1, 0, { role: 'system', content: snapshot });
            console.info('[云霜凝] 状态快照: 插入到 prefill 之前（清理后）');
          } else {
            chat.push({ role: 'system', content: snapshot });
            console.info('[云霜凝] 状态快照: push 到末尾（清理后）');
          }
        }

        // ── Phase 3.6: v3 场景 beat 注入 (2.0.36 · 场景引擎 v3) ──
        // 幂等清理 + push 新 beat: 类似 Phase 3.5 snapshot 策略,确保 chat history 不被污染
        // - 无论是否在场景中,都清理旧 [场景节拍·ᅠ system msg(场景退出后也会清掉上一场残留)
        // - 仅当 Phase 1.9 决定要注入(_v3BeatPendingPush 非空)时 push 新 beat
        {
          for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            const content = msg?.content;
            if (msg?.role === 'system' && typeof content === 'string' && content.includes(SCENE_V3_BEAT_MARKER)) {
              chat.splice(i, 1);
            }
          }
          if (_v3BeatPendingPush) {
            const lastMsg2 = chat[chat.length - 1];
            if (lastMsg2 && lastMsg2.role === 'assistant') {
              chat.splice(chat.length - 1, 0, { role: 'system', content: _v3BeatPendingPush });
              console.info('[云霜凝] v3 beat: 插入到 prefill 之前(清理后)');
            } else {
              chat.push({ role: 'system', content: _v3BeatPendingPush });
              console.info('[云霜凝] v3 beat: push 到末尾(清理后)');
            }
          }
        }

        // ── Phase 4: 苗喧彩蛋（优先级最低，有道具事件时跳过）──
        const miaoxuanTriggered = pendingRaw ? false : checkMiaoxuanEasterEgg(data, currentFloor);
        if (miaoxuanTriggered) {
          // 持久化触发楼层 + 碎片文本（显示在前端状态栏）
          _.set(raw, 'stat_data._苗喧上次触发楼层', data._苗喧上次触发楼层);
          _.set(raw, 'stat_data._苗喧碎片', data._苗喧碎片);
          Mvu.replaceMvuData(raw, { type: 'message', message_id: -1 });
          console.info('[云霜凝] 苗喧碎片已更新至状态栏');
        }
        // ── 修复：前端消耗品同步疑心值到快照 ──
        // 定心符/混沌珠/蚀心露在前端直接修改疑心值并 flush 到 MVU，
        // 但 _protSnapshot.疑心值 仍持有旧值。若不在此处同步，
        // 下方快照捕获会优先使用旧 _protSnapshot.疑心值，硬保护随后将其回滚，
        // 导致消耗品效果被完全吞掉（如定心符-8后下一楼反而+13）。
        if (_protSnapshot && items.some(e => ['定心符', '混沌珠', '蚀心露'].includes(e))) {
          _protSnapshot.疑心值 = data.苗广.疑心值;
          _protSnapshot.心态 = data.苗广.心态;
        }

        // ── 捕获硬保护快照（包含前端写入，用作 VARIABLE_UPDATE_ENDED 回滚基准）──
        // 蚀心露屈辱刚触发：旧快照残留前半程疑心值，必须强制为0（绿帽值从0开始）
        // 仅用 event 检测，不用 data flag——开场白 yaml（如入口 4/5）会预设
        // _已触发蚀心露屈辱=true 但不会 push 事件。若用 data flag 会误把入口预设的
        // 高绿帽值（如入口 5 的 80）拍成 0/屈辱。事件只在 shopSystem 蚀心露按钮真正触发
        // 转变时才 push，正好用来区分"yaml 预设"和"运行时按钮触发"。
        const 蚀心露刚触发 = !_protSnapshot?.已触发蚀心露屈辱 && items.includes('__蚀心露屈辱转变__');
        _protSnapshot = {
          灵石: data.系统.灵石,
          神魂空间已解锁: data._神魂空间已解锁,
          神魂空间已进入过: data._神魂空间已进入过,
          当前互动模式: data._当前互动模式,
          神魂空间激活中: data._神魂空间激活中,
          // 疑心值/心态由脚本全权管理，前端不能直接写入，保留 VARIABLE_UPDATE_ENDED 更新的值
          // 若从 getMvuData 读取，会因 MVU 缓存未同步而读到旧值，导致每轮重置（2→4→2 循环 bug）
          // 例外：蚀心露刚触发时强制捕获0，否则旧快照的前半程疑心值会被硬保护回滚回去
          疑心值: 蚀心露刚触发 ? 0 : (_protSnapshot?.疑心值 ?? data.苗广.疑心值),
          心态: 蚀心露刚触发 ? '屈辱' : (_protSnapshot?.心态 ?? data.苗广.心态),
          // 蚀心露屈辱标记由 processNewlyActivatedItems 设置，保留脚本已写入的值
          // 同时检查事件队列：MVU 可能未传播 flag，但事件在队列中说明已触发
          已触发蚀心露屈辱:
            _protSnapshot?.已触发蚀心露屈辱 || data._已触发蚀心露屈辱 || items.includes('__蚀心露屈辱转变__'),
          服装: { ...data.云霜凝.服装 },
          道具状态: { ...data.系统.道具状态 },
        };
        if (蚀心露刚触发) {
          console.info('[云霜凝] 蚀心露刚触发，快照疑心值强制为0（绿帽值从0开始）');
        }
      } catch (e) {
        console.error('[云霜凝] CHAT_COMPLETION_PROMPT_READY 处理失败:', e);
      }
    });

    // ────────────────────────────────────────────────────
    // 事件2：变量更新完成 → 自动计算派生状态 + 处理新激活道具
    // ────────────────────────────────────────────────────
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (新变量: object, 旧变量: object) => {
      try {
        // 守卫：仅在 AI 生成周期内处理（CHAT_COMPLETION_PROMPT_READY → VARIABLE_UPDATE_ENDED → MESSAGE_RECEIVED）
        // _isInAiCycle: 区分"AI 回复后的变量更新"与"手动 MVU 重新处理"
        //   手动重新处理时硬保护/去重不应介入，否则旧快照会覆盖重新解析的正确结果
        // _protSnapshot: 页面刷新/store 初始化写回也会触发此事件，若不跳过会叠加被动灵石
        if (!_isInAiCycle || !_protSnapshot) return;

        const newData = Schema.parse(_.get(新变量, 'stat_data') ?? {});
        const oldData = Schema.parse(_.get(旧变量, 'stat_data') ?? {});

        // 处理本轮新激活的道具（消耗品/装备/体改/性癖/特殊场景）
        const currentFloor = SillyTavern.chat?.length ?? 0;

        // 状态自动计算（治疗阶段、苗广心态、灵石里程碑、delta cap）
        // _protSnapshot 包含前端写入（灵石扣款、模式切换等），旧变量可能是新消息默认值
        // _freezeBaseline: 打断触发时捕获的治疗基线，冻结期间用作回滚基准
        _freezeBaseline = validateAndRecalcState(newData, oldData, currentFloor, _protSnapshot, _freezeBaseline);
        processNewlyActivatedItems(newData, oldData, currentFloor);
        // 洛书晴独立道具状态表（共用道具各买各的）
        if (newData._洛书晴线已激活) {
          processNewlyActivatedLuoItems(newData, oldData, currentFloor);
        }

        // 处理装备卸下（使用中→已购买），传入快照道具状态防止AI篡改
        processEquipmentUnequip(newData, oldData, _protSnapshot?.道具状态);

        // 装备每轮数值效果（身体器具加速、暖玉佩信任等）
        tickEquipmentEffects(newData);

        // 服装同步：从道具状态重建服装字段（修复快照不一致导致服装被回滚的问题）
        syncClothingFromState(newData);

        // 若打断冻结刚被触发（从0变为>0），清除场景临时道具
        if (newData._打断冻结至楼层 > oldData._打断冻结至楼层) {
          clearSceneTemporaryItems(newData);
        }

        // 阶段最终校正（delta cap 可能改完成度）
        newData.治疗.阶段 = calcHealingStage(newData.治疗.完成度);

        // 里程碑日志：检测关键转折并写入聊天世界书（fire-and-forget，降级 safe）
        // 失败不影响主流程，玩家没装"数据库"插件也照常工作——走酒馆原生 chat worldbook
        detectAndWriteMilestones(newData, oldData, currentFloor).catch(e => {
          console.warn('[云霜凝] milestone 写入失败，忽略:', e);
        });

        // 将计算结果写回
        _.set(新变量, 'stat_data', newData);

        // 疑心值/心态由脚本全权管理，直接更新快照
        // 原因：replaceMvuData 会再次触发 VARIABLE_UPDATE_ENDED，第二次触发时若 _protSnapshot
        // 未更新，楼层去重会将疑心值硬重置回旧 base（2→4→2 交替循环 bug）
        if (_protSnapshot) {
          _protSnapshot.疑心值 = newData.苗广.疑心值;
          _protSnapshot.心态 = newData.苗广.心态;
          // 蚀心露屈辱由 processNewlyActivatedItems 设置，一旦 true 不可逆
          _protSnapshot.已触发蚀心露屈辱 = _protSnapshot.已触发蚀心露屈辱 || newData._已触发蚀心露屈辱;
        }
        // 打断冻结楼层由脚本全权管理，保存到模块变量
        // 原因：MESSAGE_RECEIVED 的 getMvuData() 可能读到 stale 缓存（0），
        // replaceMvuData 会将 0 写回，导致冻结只持续1楼
        _scriptFreezeUntil = newData._打断冻结至楼层;
        // 消耗品冷却楼层由 processNewlyActivatedItems 写入，保存到模块变量
        // 防止 stale MVU 丢失冷却记录导致消耗品双火重复触发
        _scriptConsumableCooldowns = { ...newData._消耗品上次使用楼层 };

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
    // 注：开场白 → 入口 的 JSONPatch 应用逻辑已迁移到
    //      src/云霜凝/界面/主页/主页.html 的 selectEntry() 里。
    //      原因：setChatMessage 的 swipe 切换不触发 MESSAGE_SWIPED 事件
    //      （那个事件只由 UI swipe 按钮触发），所以脚本侧的 handler 不会
    //      被触发。改为主页 iframe 在点击入口按钮时直接通过
    //      insertOrAssignVariables 写入 message 0 的 stat_data。
    // ────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────
    // 事件3：AI回复到达 → 临时道具计数递减 + 特殊场景推进
    // 注意：时间推进已移至 VARIABLE_UPDATE_ENDED 统一处理，避免两个事件抢写导致天数回滚
    // ────────────────────────────────────────────────────
    eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
      try {
        _isInAiCycle = false;

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
        } else {
          console.info('[云霜凝] 系统操作触发的回复，跳过临时道具/场景推进');
        }

        // 清除系统操作标记（本轮已处理完毕）
        data._系统操作中 = false;

        // 更新保护快照：从当前 MVU 数据读取最新状态（灵石/服装等前端可写字段）
        _protSnapshot = {
          灵石: data.系统.灵石,
          神魂空间已解锁: data._神魂空间已解锁,
          神魂空间已进入过: data._神魂空间已进入过,
          当前互动模式: data._当前互动模式,
          神魂空间激活中: data._神魂空间激活中,
          // 疑心值/心态已由 VARIABLE_UPDATE_ENDED 末尾直接更新，此处保留该值
          疑心值: _protSnapshot?.疑心值 ?? data.苗广.疑心值,
          心态: _protSnapshot?.心态 ?? data.苗广.心态,
          // 蚀心露屈辱标记：一旦 true 不可逆，保留脚本已写入的值
          已触发蚀心露屈辱: _protSnapshot?.已触发蚀心露屈辱 || data._已触发蚀心露屈辱,
          服装: { ...data.云霜凝.服装 },
          道具状态: { ...data.系统.道具状态 },
        };

        // _打断冻结至楼层 由脚本全权管理，getMvuData() 可能读到 stale 缓存（0）
        // 用模块变量 _scriptFreezeUntil 恢复正确值，防止 replaceMvuData 将冻结重置
        data._打断冻结至楼层 = _scriptFreezeUntil;

        // 消耗品冷却楼层由脚本管理，stale MVU 可能丢失冷却记录
        // 用模块变量恢复，防止 processNewlyActivatedItems 双火重复触发消耗品
        for (const [item, floor] of Object.entries(_scriptConsumableCooldowns)) {
          if (floor > 0 && (!data._消耗品上次使用楼层[item] || data._消耗品上次使用楼层[item] < floor)) {
            data._消耗品上次使用楼层[item] = floor;
          }
        }

        // 更新冻结基线：冻结结束后清除
        if (_freezeBaseline) {
          const currentFloor = (globalThis as any).SillyTavern?.chat?.length ?? 0;
          if (_scriptFreezeUntil > 0 && currentFloor < _scriptFreezeUntil) {
            // 冻结仍在生效：用当前治疗数值更新基线
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
