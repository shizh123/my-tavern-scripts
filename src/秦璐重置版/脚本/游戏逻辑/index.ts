/**
 * 秦璐重置版 - 游戏逻辑主入口
 *
 * 事件处理顺序（对标云霜凝，读写分离）：
 * 1. CHAT_COMPLETION_PROMPT_READY → 注入状态快照 + 心防松动提示 + 念头判定请求
 * 2. VARIABLE_UPDATE_ENDED        → 推进苏文作息游标 + 念头培育进度 + 成熟结算
 * 3. MESSAGE_RECEIVED             → 刷新保护快照 + 解析 AI 写入的念头类型
 *
 * 注入方式（通过 event_data.chat 数组操作）：
 *   方式1 - 状态快照：buildStatusSnapshot() → push system message 到 chat 尾部
 *   方式2 - 念头判定请求：待判定念头 → 附加到 system message
 */

import type { SchemaType } from '../../schema';
import { Schema } from '../../schema';
import { getStageByCorruption, getStageTitle } from '../../stageConfig';
import { getEquippedNames } from './shopSystem';
import { advanceSuwenRoutine } from './suwenRoutine';
import { tickThoughtProgress, resolveThoughtType, isInVulnerableWindow, type ThoughtCategoryValue } from './thoughtEngine';
import { reloadOnChatChange } from '@/util/script';
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// ────────────────────────────────────────────────────────
// 初始化
// ────────────────────────────────────────────────────────

// AI 生成周期标志：CHAT_COMPLETION_PROMPT_READY 设 true，MESSAGE_RECEIVED 设 false。
// 用于区分"AI 回复后的变量更新"与"手动 MVU 重新处理"。
let _isInAiCycle = false;

// 硬保护快照：防止 AI 乱改脚本管理字段（堕落度/阶段/苏文位置/念头进度/游标等）
let _protSnapshot: Partial<SchemaType> | null = null;

// 快照注入幂等标记（防 ROLL/删楼累积多份）
const SNAPSHOT_MARKER = '[当前游戏状态快照';

// 心防松动状态覆写：脚本后写覆盖角色 当前情绪
let _pendingVulnerableFloor = -1;

// ────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────

/** 获取当前楼层 */
function getCurrentFloor(): number {
  return SillyTavern.chat?.length ?? 0;
}

/** 获取当前玩家输入文本（用于检测跳转关键词、念头判定等） */
function getLastUserMessage(): string {
  const chat = SillyTavern.chat ?? [];
  for (let i = chat.length - 1; i >= 0; i--) {
    if (chat[i].is_user) return chat[i].mes ?? '';
  }
  return '';
}

/** 获取最后一条 AI 回复文本 */
function getLastAiMessage(): string {
  const chat = SillyTavern.chat ?? [];
  for (let i = chat.length - 1; i >= 0; i--) {
    if (!chat[i].is_user) return chat[i].mes ?? '';
  }
  return '';
}

/**
 * 捕获硬保护快照（脚本管理字段的当前值）
 * 在 CHAT_COMPLETION_PROMPT_READY 末尾从最新消息数据捕获
 */
function captureProtectionSnapshot(data: SchemaType): void {
  _protSnapshot = {
    秦璐状态: {
      堕落度: data.秦璐状态.堕落度,
      当前阶段: data.秦璐状态.当前阶段,
      对主角依存度: data.秦璐状态.对主角依存度,
      对苏文依存度: data.秦璐状态.对苏文依存度,
      念头列表: { ...data.秦璐状态.念头列表 },
      习惯列表: [...data.秦璐状态.习惯列表],
    } as any,
    苏梦状态: {
      堕落度: data.苏梦状态.堕落度,
      当前阶段: data.苏梦状态.当前阶段,
      对主角依存度: data.苏梦状态.对主角依存度,
      对苏文依存度: data.苏梦状态.对苏文依存度,
      念头列表: { ...data.苏梦状态.念头列表 },
      习惯列表: [...data.苏梦状态.习惯列表],
    } as any,
    苏文状态: {
      当前状态: data.苏文状态.当前状态,
      当前位置: data.苏文状态.当前位置,
      对秦璐疑心值: data.苏文状态.对秦璐疑心值,
      对苏梦疑心值: data.苏文状态.对苏梦疑心值,
    } as any,
    系统: {
      货币: data.系统.货币,
      道具状态: { ...data.系统.道具状态 },
      _苏文作息游标: data.系统._苏文作息游标,
    } as any,
  };
}

/**
 * 回滚脚本管理字段（防 AI 乱改）
 */
function rollbackProtectedFields(data: SchemaType): void {
  if (!_protSnapshot) return;
  const snap = _protSnapshot;

  // 角色核心数值：堕落度/阶段/依存度 强制回滚（v0.21 补缺——此前只捕获未回滚，
  // AI 私改 当前阶段+堕落度 会造成"第2阶段「抵抗」"这类标题错位）
  // 脚本自己的结算（念头成熟/体改）发生在回滚之后或写回之前，不受影响
  for (const charKey of ['秦璐状态', '苏梦状态'] as const) {
    const sc = snap[charKey];
    if (!sc) continue;
    data[charKey].堕落度 = sc.堕落度 as number;
    data[charKey].当前阶段 = sc.当前阶段 as number;
    data[charKey].阶段标题 = getStageTitle(sc.当前阶段 as number) as any;
    data[charKey].对主角依存度 = sc.对主角依存度 as number;
    data[charKey].对苏文依存度 = sc.对苏文依存度 as number;
  }

  // 苏文状态：脚本管理字段强制回滚
  if (snap.苏文状态) {
    data.苏文状态.当前状态 = snap.苏文状态.当前状态;
    data.苏文状态.当前位置 = snap.苏文状态.当前位置;
  }
  // 系统：游标/货币回滚（货币由变卖习惯管理，AI 不应直改）
  if (snap.系统) {
    data.系统._苏文作息游标 = snap.系统._苏文作息游标;
    if (snap.系统.货币 !== undefined) data.系统.货币 = snap.系统.货币;
  }

  // 念头"内容"保护：AI 只许改"类型"，不许改"内容"
  for (const charKey of ['秦璐状态', '苏梦状态'] as const) {
    const snapThoughts = snap[charKey]?.念头列表;
    if (snapThoughts) {
      for (const [id, snapThought] of Object.entries(snapThoughts)) {
        const cur = data[charKey].念头列表[id];
        if (cur && cur.内容 !== snapThought.内容) {
          cur.内容 = snapThought.内容; // 回滚内容
        }
      }
    }
  }
}

// ────────────────────────────────────────────────────────
// 状态快照构建（对标云霜凝 buildStatusSnapshot）
// ────────────────────────────────────────────────────────

/** 在场角色列表（AI 每轮维护 系统.在场角色；兜底：全 false 时按秦璐在场） */
function getPresentCharacters(data: SchemaType): Array<'秦璐' | '苏梦'> {
  const present = (['秦璐', '苏梦'] as const).filter(name => data.系统.在场角色[name]);
  return present.length > 0 ? [...present] : ['秦璐'];
}

/**
 * 阶段禁区（v0.17）：念头决定她"想什么"，阶段决定她"敢什么"
 * 影响从低阶段就全量存在（走神/脸红/异常举动不设门槛），阶段限制的是行为/话题的出口。
 * 按在场角色动态注入到影响块末尾；通用原则常驻世界书「念头习惯表现」。
 */
/** v0.21 测试期暂停阶段约束注入（用户要求）；正式版改回 true */
const ENABLE_STAGE_RESTRAINTS = false;

const STAGE_RESTRAINTS: Record<number, string> = {
  1: '影响只在内部呈现（走神/脸红/视线停留/梦境/对他莫名多一分关注）。禁止：主动谈性或身体话题（被提及会慌乱岔开）、超出母亲/姐姐常态的主动肢体接触、任何暧昧性质的主动行动。',
  2: '允许被动接擦边话题、说出口才惊觉的双关。禁止：露骨字眼、主动制造身体接触（顺势的短暂接触可以，事后心慌）、性质明确的邀约。',
  3: '允许独处时的暗示性话题、主动制造亲近的机会，有台阶就顺势而为。禁止：人前越界、直白的性邀约（但可以"不拒绝"）。',
  4: '私下几乎全解禁——会直白说出欲望并主动行动。禁止：苏文可感知范围内的任何越界（这是风险管理，不是道德）。',
  5: '无禁区。克制只在需要伪装时出现，且是她乐在其中的表演。',
};

/**
 * 构建注入给 AI 的状态快照（精简、按需知情）
 * 对接"世界书精简原则"：只注入当前相关的，不注入脚本算法/废弃系统
 * - 只注入脚本管理、AI 无法从上下文推出的信息（阶段/心防松动/苏文位置）
 *   情绪/位置/内心/依存度是 AI 自己写的或纯数值，正文已承载，不回注
 * - 按 系统.在场角色 过滤：不在场角色的状态/影响/相关度判定整块跳过（对标云霜凝）
 */
function buildStatusSnapshot(data: SchemaType): string {
  const lines: string[] = [];
  lines.push('════════ 当前游戏状态 ════════');

  const floor = getCurrentFloor();
  const present = getPresentCharacters(data);

  // ━━━━ 在场角色状态行 ━━━━
  //   心防松动是脚本覆写的（AI 上下文里没有），附在状态行上
  //   穿着：网店装备是脚本管理的（AI 自由写的服装细节不含它），需注入告知
  for (const name of present) {
    const charKey = `${name}状态` as '秦璐状态' | '苏梦状态';
    const char = data[charKey];
    const vulnerable =
      char.当前情绪 === '心防松动' ? ' ⚡她此刻心防松动，比平时更容易接受亲密试探' : '';
    lines.push(`【${name}】第${char.当前阶段}阶段「${char.阶段标题}」${vulnerable}`);
    const equipped = getEquippedNames(data, charKey);
    if (equipped.length > 0) {
      lines.push(`【${name}·穿着】${equipped.join('、')}（请在描写中自然体现）`);
    }
  }

  // 苏文位置：脚本黑盒作息算出，快照是 AI 唯一获知通道，必须每轮注入
  lines.push(`【苏文】${data.苏文状态.当前状态} @ ${data.苏文状态.当前位置}`);

  // ━━━━ 一次性剧情事件（首穿等；脚本写入，注入一轮后在写阶段清空） ━━━━
  if (data.系统._待发送道具事件) {
    lines.push('');
    lines.push(`【本轮剧情事件（一次性，请自然融入演绎，不要复述本提示）】`);
    for (const ev of data.系统._待发送道具事件.split('|').filter(Boolean)) {
      lines.push(`  · ${ev}`);
    }
  }

  // ━━━━ 念头/习惯动态影响 baseline：仅在场角色（不在场无从表现） ━━━━
  //   想法层/行为层语义 + 元系统词禁令已常驻世界书「念头习惯表现」（蓝灯），此处只列动态清单
  //   念头附 ID 供判定任务 B 引用，避免重复列表
  let hasGrowing = false;
  for (const name of present) {
    const char = data[`${name}状态` as '秦璐状态' | '苏梦状态'];
    const growing = Object.entries(char.念头列表).filter(([, t]) => t.状态 === '培育中');
    const habits = char.习惯列表;
    if (growing.length === 0 && habits.length === 0) continue;
    if (growing.length > 0) hasGrowing = true;
    lines.push('');
    lines.push(`【${name}当下受以下念头/习惯的影响，请在演绎中自然体现】`);
    if (growing.length > 0) {
      lines.push(`  念头（想法层）：`);
      for (const [id, t] of growing) {
        lines.push(`  · 「${t.内容}」（${id}）`);
      }
    }
    if (habits.length > 0) {
      lines.push(`  习惯（行为层）：`);
      for (const h of habits) {
        lines.push(`  · 「${h.内容}」`);
      }
    }
    // 阶段禁区：影响恒在，出口按阶段限幅（念头决定想什么，阶段决定敢什么）
    // v0.21 测试期由 ENABLE_STAGE_RESTRAINTS 暂停
    if (ENABLE_STAGE_RESTRAINTS) {
      lines.push(
        `  ▷ 阶段约束（第${char.当前阶段}阶段「${char.阶段标题}」）：${STAGE_RESTRAINTS[char.当前阶段] ?? STAGE_RESTRAINTS[1]}`,
      );
    }
  }

  // 已成熟待腾位/习惯栏容量/货币/依存度：玩家侧或脚本内部信息，不注入给 AI

  // ━━━━ AI 判定通道 1：待判定念头 → 类型判定（植入后≤3楼动态注入） ━━━━
  //   不按在场过滤：类型判定是纯语义分类，不需要角色在场；
  //   若过滤，趁角色不在提前植入的念头会错过 3 楼注入窗口，永远卡在判定中
  //   10大类枚举/只判类型 等完整规则常驻世界书「变量输出格式」
  const pendingLines: string[] = [];
  for (const name of ['秦璐', '苏梦'] as const) {
    const charKey = `${name}状态` as '秦璐状态' | '苏梦状态';
    for (const [id, t] of Object.entries(data[charKey].念头列表)) {
      if (t.状态 === '判定中' && floor - t.植入楼层 <= 3) {
        pendingLines.push(`  ${id}：「${t.内容}」（写入 /${charKey}/念头列表/${id}/类型）`);
      }
    }
  }
  if (pendingLines.length > 0) {
    lines.push('');
    lines.push(`━━━ 判定任务 A：新念头类型判定 ━━━`);
    lines.push(...pendingLines);
    lines.push(`对以上每条按括号内路径 replace 类型 = 10大类之一（规则见「变量输出格式」）。不要在正文里替她接受或拒绝这些念头。`);
  }

  // ━━━━ AI 判定通道 2：培育中念头 → 相关度判定（仅在场角色） ━━━━
  //   念头清单不再重复——ID 已附在上方"想法层"清单里
  if (hasGrowing) {
    lines.push('');
    lines.push(`━━━ 判定任务 B：培育中念头相关度 ━━━`);
    lines.push(`判定本轮剧情与上方"想法层"清单中各念头的相关度：replace /系统/本轮相关念头 = { "<念头ID>": 2或1 }（2=高度相关；1=轻微相关；不相关不列入）。`);
  }

  lines.push('══════════════════════════');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────

$(() => {
  (async () => {
    console.info('[秦璐重置版] 游戏逻辑主入口启动');

    // 等 Mvu 就绪 + 注册 schema（对标云霜凝，否则 getMvuData 拿不到 stat_data / 默认值）
    try {
      const mvuInitTimeout = new Promise<never>((_r, reject) =>
        setTimeout(() => reject(new Error('等待 Mvu 初始化超时（>10s）')), 10000),
      );
      await Promise.race([waitGlobalInitialized('Mvu'), mvuInitTimeout]);
      registerMvuSchema(Schema);
      console.info('[秦璐重置版] Mvu 已就绪，Schema 已注册');
    } catch (err) {
      console.error('[秦璐重置版] Mvu 初始化失败：', err);
      return;
    }

    // 清理本 iframe 累积的旧 listener（防 reload 累积爆炸——云霜凝踩坑经验）
    eventClearEvent(tavern_events.MESSAGE_RECEIVED);
    eventClearEvent(tavern_events.CHAT_CHANGED);
    eventClearEvent(tavern_events.CHAT_COMPLETION_PROMPT_READY);
    eventClearEvent(Mvu.events.VARIABLE_UPDATE_ENDED);
    eventClearEvent(Mvu.events.COMMAND_PARSED);
    reloadOnChatChange();

    // ─────────────────────────────────────────────────────
    // 读阶段：注入状态快照（对标云霜凝 Phase 3.5）
    // ─────────────────────────────────────────────────────
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, (event_data: any) => {
      // dryRun=true 是预热请求，跳过注入（对标云霜凝）；dryRun=false 才是真实生成
      if (event_data?.dryRun) {
        console.info('[秦璐重置版] dryRun=true，跳过注入');
        return;
      }
      _isInAiCycle = true;
      try {
        const messageId = getCurrentFloor();
        const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
        const data = Schema.parse(_.get(vars, 'stat_data') ?? {}) as SchemaType;

        // 1. 心防松动窗口：脚本后写覆盖当前情绪（对所有在场角色生效）
        //    楼层 % 10 <= 3 → 覆写为"心防松动"（已确认方向，待界面发光字体配合）
        if (isInVulnerableWindow(messageId)) {
          for (const name of getPresentCharacters(data)) {
            const ck = `${name}状态` as '秦璐状态' | '苏梦状态';
            if (data[ck].当前情绪 !== '心防松动') {
              data[ck].当前情绪 = '心防松动';
              console.info(`[心防松动] 楼层${messageId} 覆写${name}情绪→心防松动`);
            }
          }
        }

        // 2. 捕获硬保护快照（含前端写入：念头植入、习惯变卖、道具购买等）
        captureProtectionSnapshot(data);

        // 3. 构建快照 + 注入（幂等 marker 防重复）
        const snapshot = SNAPSHOT_MARKER + ']\n' + buildStatusSnapshot(data);
        const chat = event_data.chat ?? [];
        // 清理旧快照
        for (let i = chat.length - 1; i >= 0; i--) {
          if (chat[i].role === 'system' && (chat[i].content ?? '').includes(SNAPSHOT_MARKER)) {
            chat.splice(i, 1);
          }
        }
        // 注入策略（对标云霜凝）：末尾若为 assistant prefill（Gemini），插到它之前；否则 push 到末尾
        const lastMsg = chat[chat.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          chat.splice(chat.length - 1, 0, { role: 'system', content: snapshot });
          console.info('[秦璐重置版] 状态快照: 插入到 prefill 之前');
        } else {
          chat.push({ role: 'system', content: snapshot });
          console.info('[秦璐重置版] 状态快照: push 到末尾');
        }
      } catch (err) {
        console.error('[秦璐重置版] PROMPT_READY 处理失败:', err);
      }
    });

    // ─────────────────────────────────────────────────────
    // 写阶段：派生计算 + 推进（对标云霜凝 VARIABLE_UPDATE_ENDED）
    // ─────────────────────────────────────────────────────
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (新变量: object, _旧变量: object) => {
      try {
        // 守卫：仅在 AI 生成周期内处理
        if (!_isInAiCycle || !_protSnapshot) return;

        const newData = Schema.parse(_.get(新变量, 'stat_data') ?? {}) as SchemaType;
        const currentFloor = getCurrentFloor();
        const playerInput = getLastUserMessage();

        // 1. 回滚脚本管理字段（防 AI 乱改）
        rollbackProtectedFields(newData);

        // 2. 推进苏文作息游标（楼层驱动黑盒节律）
        advanceSuwenRoutine(newData, currentFloor, playerInput);

        // 3. 解析 AI 写入的念头类型（待判定→具体类型）
        for (const charKey of ['秦璐状态', '苏梦状态'] as const) {
          const char = newData[charKey];
          for (const [id, thought] of Object.entries(char.念头列表)) {
            if (thought.状态 === '判定中' && thought.类型 !== '待判定') {
              // AI 已判出类型 → 脚本处理（定难度、判合格）
              resolveThoughtType(newData, charKey, id, thought.类型 as ThoughtCategoryValue, currentFloor);
            }
          }
          // 阶段校正（由堕落度派生）
          const newStage = getStageByCorruption(char.堕落度);
          if (newStage !== char.当前阶段) {
            char.当前阶段 = newStage;
            char.阶段标题 = getStageTitle(newStage) as any;
            console.info(`[秦璐重置版] ${charKey} 阶段校正 → ${newStage}「${getStageTitle(newStage)}」`);
          }
        }

        // 4. 推进念头培育进度（含苏文加速 + AI相关度加速 + 装备加速）+ 成熟结算
        //    relevanceMap 只读一次，两个角色共用（念头ID全局唯一），处理完再清空
        const relevanceMap = newData.系统.本轮相关念头 ?? {};
        for (const charKey of ['秦璐状态', '苏梦状态'] as const) {
          tickThoughtProgress(newData, charKey, currentFloor, relevanceMap);
        }
        newData.系统.本轮相关念头 = {};

        // 4.5 一次性剧情事件已注入过本轮生成 → 清空（首穿等只演一次）
        newData.系统._待发送道具事件 = '';

        // 5. 写回
        _.set(新变量, 'stat_data', newData);
        _isInAiCycle = false;
      } catch (err) {
        console.error('[秦璐重置版] VARIABLE_UPDATE_ENDED 处理失败:', err);
        _isInAiCycle = false;
      }
    });

    // ─────────────────────────────────────────────────────
    // 后处理：刷新快照 + 结束 AI 周期（对标云霜凝 MESSAGE_RECEIVED）
    // ─────────────────────────────────────────────────────
    eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
      try {
        // 刷新保护快照（AI 回复后数据已落地）
        const messageId = getCurrentFloor();
        const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
        const data = Schema.parse(_.get(vars, 'stat_data') ?? {}) as SchemaType;
        captureProtectionSnapshot(data);
        console.info('[秦璐重置版] MESSAGE_RECEIVED 快照已刷新');
      } catch (err) {
        console.error('[秦璐重置版] MESSAGE_RECEIVED 处理失败:', err);
      }
    });

    console.info('[秦璐重置版] 事件监听注册完成');
  })();
});
