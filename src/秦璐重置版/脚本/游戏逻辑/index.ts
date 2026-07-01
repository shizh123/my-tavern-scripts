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
import { advanceSuwenRoutine, isInVulnerableWindow } from './suwenRoutine';
import {
  tickThoughtProgress,
  resolveThoughtType,
  type ThoughtCategoryValue,
} from './thoughtEngine';
import { reloadOnChatChange } from '@/util/script';

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

/**
 * 构建注入给 AI 的状态快照（精简、按需知情）
 * 对接"世界书精简原则"：只注入当前相关的，不注入脚本算法/废弃系统
 */
function buildStatusSnapshot(data: SchemaType): string {
  const lines: string[] = [];
  lines.push('════════ 当前游戏状态 ════════');

  // 当前角色（聚焦）
  const currentChar = data.系统.当前角色;
  const charKey = `${currentChar}状态` as '秦璐状态' | '苏梦状态';
  const char = data[charKey];

  lines.push(`【当前调教对象】${currentChar}`);
  lines.push(`【堕落度】${char.堕落度} → 第${char.当前阶段}阶段「${char.阶段标题}」`);
  lines.push(`【对主角依存】${char.对主角依存度} / 【对苏文依存】${char.对苏文依存度}`);
  lines.push(`【情绪】${char.当前情绪} | 【位置】${char.当前位置}`);
  if (char.当前心理想法) {
    lines.push(`【内心】${char.当前心理想法}`);
  }

  // 苏文状态（仅位置/状态，不注入疑心值算法）
  lines.push(`【苏文】${data.苏文状态.当前状态} @ ${data.苏文状态.当前位置}`);

  // 心防松动窗口提示（脚本检测后写）
  const floor = getCurrentFloor();
  if (isInVulnerableWindow(floor)) {
    lines.push(`⚡【心防松动】此刻可植入越级念头`);
  }

  // 念头培育中（只显示在场角色的）
  const thoughts = Object.entries(char.念头列表).filter(([, t]) => t.状态 === '培育中');
  if (thoughts.length > 0) {
    lines.push(`【培育中念头】`);
    for (const [id, t] of thoughts) {
      lines.push(`  ${id}：「${t.内容}」${t.难度} ${t.开发进度}/${t.需要楼数}楼`);
    }
  }

  // 习惯（上限5，满了提示变卖）
  if (char.习惯列表.length > 0) {
    lines.push(`【习惯】(${char.习惯列表.length}/5)`);
    for (const h of char.习惯列表) {
      lines.push(`  · ${h.内容}`);
    }
    if (char.习惯列表.length >= 5) {
      lines.push(`  ⚠ 习惯已满，需变卖腾位（变卖+100货币）`);
    }
  }

  // 货币
  lines.push(`【货币】${data.系统.货币}`);

  // 待判定念头 → 注入 AI 判定请求
  const pending = Object.entries(char.念头列表).filter(([, t]) => t.状态 === '判定中');
  if (pending.length > 0) {
    lines.push('');
    lines.push('【请判定以下念头的类型】从10大类中选一个，写入对应字段：');
    lines.push('可选：陪伴交流/情感依赖/肢体亲近/暧昧互动/亲密接触/身体开放/性行为/身份认同/绝对服从/家庭替代');
    for (const [id, t] of pending) {
      lines.push(`  ${charKey}.念头列表.${id}.类型 ← 判定「${t.内容}」`);
    }
  }

  lines.push('══════════════════════════');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────

$(() => {
  console.info('[秦璐重置版] 游戏逻辑主入口启动');

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
    _isInAiCycle = true;
    try {
      const messageId = getCurrentFloor();
      const vars = Mvu.getMvuData({ type: 'message', message_id: messageId });
      const data = Schema.parse(_.get(vars, 'stat_data') ?? {}) as SchemaType;

      // 1. 心防松动窗口：脚本后写覆盖当前情绪
      //    楼层 % 10 <= 3 → 覆写为"心防松动"（已确认方向，待界面发光字体配合）
      if (isInVulnerableWindow(messageId)) {
        const ck = `${data.系统.当前角色}状态` as '秦璐状态' | '苏梦状态';
        if (data[ck].当前情绪 !== '心防松动') {
          data[ck].当前情绪 = '心防松动';
          console.info(`[心防松动] 楼层${messageId} 覆写${data.系统.当前角色}情绪→心防松动`);
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
      // push 新快照
      chat.push({ role: 'system', content: snapshot });
    } catch (err) {
      console.error('[秦璐重置版] PROMPT_READY 处理失败:', err);
    }
  });

  // ─────────────────────────────────────────────────────
  // 写阶段：派生计算 + 推进（对标云霜凝 VARIABLE_UPDATE_ENDED）
  // ─────────────────────────────────────────────────────
  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (新变量: object, 旧变量: object) => {
    try {
      // 守卫：仅在 AI 生成周期内处理
      if (!_isInAiCycle || !_protSnapshot) return;

      const newData = Schema.parse(_.get(新变量, 'stat_data') ?? {}) as SchemaType;
      const oldData = Schema.parse(_.get(旧变量, 'stat_data') ?? {}) as SchemaType;
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

      // 4. 推进念头培育进度（含苏文加速）+ 成熟结算
      for (const charKey of ['秦璐状态', '苏梦状态'] as const) {
        tickThoughtProgress(newData, charKey, currentFloor);
      }

      // 5. 写回
      _.set(新变量, 'stat_data', newData);
    } catch (err) {
      console.error('[秦璐重置版] VARIABLE_UPDATE_ENDED 处理失败:', err);
    }
  });

  // ─────────────────────────────────────────────────────
  // 后处理：刷新快照 + 结束 AI 周期（对标云霜凝 MESSAGE_RECEIVED）
  // ─────────────────────────────────────────────────────
  eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
    _isInAiCycle = false;
    try {
      // 刷新保护快照（AI 回复后数据已落地）
      const messageId = getCurrentFloor();
      const vars = Mvu.getMvuData({ type: 'message', message_id: messageId });
      const data = Schema.parse(_.get(vars, 'stat_data') ?? {}) as SchemaType;
      captureProtectionSnapshot(data);
      console.info('[秦璐重置版] MESSAGE_RECEIVED 快照已刷新');
    } catch (err) {
      console.error('[秦璐重置版] MESSAGE_RECEIVED 处理失败:', err);
    }
  });

  console.info('[秦璐重置版] 事件监听注册完成');
});
