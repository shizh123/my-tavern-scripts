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
import { getBodyModNames, getDaringEquippedNames, getEquippedNames, getOutfitStars, getSuspicionFloor } from './shopSystem';
import { advanceSuwenRoutine, previewSuwenPosition } from './suwenRoutine';
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

/** 本次生成是否为重roll/继续（chat 末条已是 AI 消息；新楼生成时末条是玩家输入） */
function isRerollGeneration(): boolean {
  const chat = SillyTavern.chat ?? [];
  const last = chat[chat.length - 1];
  return !!last && !last.is_user;
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
      在场角色: { ...data.系统.在场角色 },
      _在场锁定: data.系统._在场锁定,
      // 打断/苏文视角状态（v0.28）：重roll 打断楼时 MVU 从上一楼变量重建，
      // 待看/档位记录/余波会整体丢失（按钮永远不亮）——纳入快照按"进度保留"恢复
      _苏文视角: { ...data.系统._苏文视角 },
      _已触发打断档位: { ...data.系统._已触发打断档位 },
      _打断余波至楼层: data.系统._打断余波至楼层,
      _打断冷却至楼层: data.系统._打断冷却至楼层,
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

  // 苏文状态：脚本管理字段强制回滚（疑心值 v0.22 起由满星结算脚本管理，回滚后再结算）
  if (snap.苏文状态) {
    data.苏文状态.当前状态 = snap.苏文状态.当前状态;
    data.苏文状态.当前位置 = snap.苏文状态.当前位置;
    data.苏文状态.对秦璐疑心值 = snap.苏文状态.对秦璐疑心值 as number;
    data.苏文状态.对苏梦疑心值 = snap.苏文状态.对苏梦疑心值 as number;
  }
  // 系统：游标/货币回滚（货币由脚本结算管理，AI 不应直改）
  if (snap.系统) {
    data.系统._苏文作息游标 = snap.系统._苏文作息游标;
    if (snap.系统.货币 !== undefined) data.系统.货币 = snap.系统.货币;
    // 在场锁定（v0.25）：锁定标志本身防 AI 动；锁定期间 在场角色 转脚本管理，回滚 AI 的进出场改动
    if (snap.系统._在场锁定 !== undefined) data.系统._在场锁定 = snap.系统._在场锁定 as boolean;
    if (snap.系统._在场锁定 && snap.系统.在场角色) {
      data.系统.在场角色 = { ...(snap.系统.在场角色 as { 秦璐: boolean; 苏梦: boolean }) };
    }
    // 打断/苏文视角状态恢复（v0.28 重roll保护）：快照来自本次生成时的最新楼数据，
    // 永远 ≥ 重建基准（上一楼）——整体覆盖 pov、并集档位、取大余波；随后引擎照常推进
    if (snap.系统._苏文视角) {
      data.系统._苏文视角 = { ...(snap.系统._苏文视角 as typeof data.系统._苏文视角) };
    }
    if (snap.系统._已触发打断档位) {
      for (const [k, v] of Object.entries(snap.系统._已触发打断档位 as Record<string, boolean>)) {
        if (v) data.系统._已触发打断档位[k] = true;
      }
    }
    if (typeof snap.系统._打断余波至楼层 === 'number') {
      data.系统._打断余波至楼层 = Math.max(data.系统._打断余波至楼层, snap.系统._打断余波至楼层);
    }
    if (typeof snap.系统._打断冷却至楼层 === 'number') {
      data.系统._打断冷却至楼层 = Math.max(data.系统._打断冷却至楼层, snap.系统._打断冷却至楼层);
    }
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
 * 疑心结算（v0.23 完整版）：
 * - 主通道：她的堕落度每 +2 → 疑心 +1（×0.5 折算，覆盖念头成熟/体改/卖习惯全部来源）——
 *   攻略本身就是暴露，"瞒"因此成为必修课
 * - 满星（4槽+体改）期间额外 +1/楼（v0.22 保留）
 * - 无增长的楼每楼回落 0.5，但**降不破下限棘轮**（堕落度×0.25——看见了就无法当没看见）
 * - 借口短信/出游余温冻结期间不涨不落，到期自动解冻；触顶 100 → 坏结局锁定
 * - 分期补收（v0.31）：主通道每楼最多 +2——解冻账单/多念头同楼成熟不再一楼跳变，
 *   未收部分留在水位线上逐楼续收（总量守恒，延期不免除；满星 +1/楼 不占此额度）
 * 数值待平衡期统一调。
 */
const SUSPICION_RISE_CAP_PER_FLOOR = 2;
function settleSuspicion(data: SchemaType, currentFloor: number): void {
  if (data.系统._坏结局) return;
  // 每楼最多触发一次打断（两角色同楼都够档时只演一位；另一位档位不标记，等冷却后按存量补触发）
  let interruptFiredThisFloor = false;
  for (const name of ['秦璐', '苏梦'] as const) {
    const charKey = `${name}状态` as '秦璐状态' | '苏梦状态';
    const susKey = `对${name}疑心值` as '对秦璐疑心值' | '对苏梦疑心值';
    const freezeKey = `对${name}疑心值冻结` as '对秦璐疑心值冻结' | '对苏梦疑心值冻结';
    const freeze = data.苏文状态[freezeKey];
    if (freeze.是否冻结) {
      if (currentFloor >= freeze.冻结结束楼层) {
        freeze.是否冻结 = false;
        console.info(`[疑心] 对${name}的冻结到期解除`);
      } else {
        continue; // 冻结中：不涨不落（堕落度增量挂在基准上，解冻后照常补收）
      }
    }

    // 主通道：堕落度增量 ×0.5（基准水位持久化，UI 侧改动如体改/卖习惯也会在下一楼被收到）
    const char = data[charKey];
    if (char._疑心已结算堕落度 < 0) {
      char._疑心已结算堕落度 = char.堕落度; // 老存档首次初始化，不补收历史
    }
    let rise = 0;
    if (char.堕落度 > char._疑心已结算堕落度) {
      // 分期补收（v0.31）：本楼最多收 +2，水位线只按实收推进，余账下楼继续
      const owed = char.堕落度 - char._疑心已结算堕落度;
      const collect = Math.min(Math.round(owed * 0.5), SUSPICION_RISE_CAP_PER_FLOOR);
      rise += collect;
      char._疑心已结算堕落度 += Math.min(collect * 2, owed);
    } else if (char.堕落度 < char._疑心已结算堕落度) {
      char._疑心已结算堕落度 = char.堕落度; // 容错（堕落度理论上不降）
    }
    // 满星附加
    const full = getOutfitStars(data, charKey).full;
    if (full) rise += 1;

    const before = data.苏文状态[susKey];
    const floorMin = getSuspicionFloor(data, charKey);
    let after: number;
    if (rise > 0) {
      after = Math.min(100, before + rise);
    } else {
      // 回落：只降不升，且不破下限棘轮
      after = before > floorMin ? Math.max(floorMin, before - 0.5) : before;
    }
    if (after !== before) {
      data.苏文状态[susKey] = after;
      console.info(
        `[疑心] 苏文对${name} ${before}→${after}（涨${rise}${full ? ' 含满星' : ''}，下限${floorMin}）`,
      );
    }
    // 触顶 → 坏结局锁定（下一轮快照只注入终局指引，引擎/商店全停）
    if (after >= 100) {
      data.系统._坏结局 = `疑心爆表·${name}`;
      console.warn(`[坏结局] 苏文对${name}疑心爆表，存档锁定`);
      return;
    }
    // 打断触发（v0.30 冷却存量制，用户设计；替代 v0.23 跨档瞬间制）：
    // - 两次打断至少间隔 12 楼：冷却内跨档不触发也不标记（疑心值照涨，欠账玩家可见）
    // - 冷却外每楼按"当前疑心值"结算：最高未触发档 ≤ 当前值 → 触发该档并连带标记其下档位
    //   （非冷却期首次涨过某档 = 当楼即触发，与旧跨档语义一致）
    // - 拆弹：冷却期内玩家把疑心降回档下（自然回落/借口短信），到期就不触发，该档等再涨上来
    // - 已触发档位一生一次不重演；同楼两角色只演一位（另一位冷却后补）
    if (interruptFiredThisFloor) continue;
    if (data.系统._打断冷却至楼层 >= 0 && currentFloor < data.系统._打断冷却至楼层) continue;
    let firedTier = 0;
    for (let t = 10; t <= 90; t += 10) {
      if (after >= t && !data.系统._已触发打断档位[`${name}:${t}`]) {
        firedTier = t;
      }
    }
    if (firedTier > 0) {
      for (let t = 10; t <= firedTier; t += 10) {
        data.系统._已触发打断档位[`${name}:${t}`] = true;
      }
      data.系统._打断冷却至楼层 = currentFloor + 12;
      interruptFiredThisFloor = true;
      const dir = INTERRUPT_DIRECTIONS[firedTier];
      const event = `【苏文打断·疑心${firedTier}】本轮请让苏文中止${name}当前的场面。方向：${dir}。只定方向不定细节——打断的具体理由/借口必须从当前上下文与家庭日常里生成（不要凭空发明道具或情节），他的台词、时机与她的反应由你按上下文与当前阶段演绎；他并没有实据，这次打断不揭穿任何真相`;
      data.系统._待发送道具事件 = data.系统._待发送道具事件
        ? `${data.系统._待发送道具事件}|${event}`
        : event;
      data.系统._苏文视角 = {
        待看: true,
        剩余楼: 0,
        总楼数: 3,
        目标: name,
        档位: firedTier,
        上次处理楼层: -1,
      };
      // 打断落地（v0.25）：人都出现了，位置数据不能还写外出/睡眠——强制在场，
      // 并开启余波窗口（打断楼+后3楼）：作息游标暂停（他滞留家中），快照注入行为收敛提示
      data.苏文状态.当前状态 = '在家';
      data.苏文状态.当前位置 = data.世界.地点;
      data.系统._打断余波至楼层 = currentFloor + 4;
      console.info(
        `[打断] 苏文对${name}疑心达到${firedTier}档触发打断（冷却至楼${currentFloor + 12}），事件已注入（苏文强制在场@${data.世界.地点}，余波至楼${currentFloor + 4}），苏文视角待看`,
      );
    }
  }
}

/**
 * 经济结算（v0.25）："她的堕落是你的资本"从口号落地为系统规则
 * - 堕落度增量 ×20 折算货币（水位线制，镜像疑心结算；-1=旧档首见校准不补发）
 * - 阶段突破一次性奖励：升入 2/3/4/5 阶 → +200/400/600/800（每角色每阶一次）
 * 数值待平衡期统一调。
 */
const CORRUPTION_COIN_RATE = 20;
const STAGE_BREAK_REWARDS: Record<number, number> = { 2: 200, 3: 400, 4: 600, 5: 800 };

function settleEconomy(data: SchemaType): void {
  for (const name of ['秦璐', '苏梦'] as const) {
    const char = data[`${name}状态` as '秦璐状态' | '苏梦状态'];
    // 堕落度增量 → 货币（独立水位线，与疑心结算互不干扰）
    if (char._货币已结算堕落度 < 0) {
      char._货币已结算堕落度 = char.堕落度; // 旧档首见校准，不补发历史
    } else if (char.堕落度 > char._货币已结算堕落度) {
      const delta = char.堕落度 - char._货币已结算堕落度;
      const gain = Math.round(delta * CORRUPTION_COIN_RATE);
      data.系统.货币 += gain;
      char._货币已结算堕落度 = char.堕落度;
      console.info(`[经济] ${name} 堕落度+${delta} → 货币+${gain}（共${data.系统.货币}）`);
    } else if (char.堕落度 < char._货币已结算堕落度) {
      char._货币已结算堕落度 = char.堕落度; // 容错跟落，防同段堕落重复发钱
    }
    // 阶段突破一次性奖励
    if (char._已奖励阶段 < 0) {
      char._已奖励阶段 = char.当前阶段; // 旧档首见校准，不补发历史
    } else if (char.当前阶段 > char._已奖励阶段) {
      let total = 0;
      for (let s = char._已奖励阶段 + 1; s <= char.当前阶段; s++) total += STAGE_BREAK_REWARDS[s] ?? 0;
      char._已奖励阶段 = char.当前阶段;
      if (total > 0) {
        data.系统.货币 += total;
        console.info(`[经济] ${name} 阶段突破至${char.当前阶段} → 奖励+${total}（共${data.系统.货币}）`);
      }
    }
  }
}

/**
 * 打断方向（v0.23，v0.25 去具象化）：疑心每跨一个 10 点档触发一次苏文打断，档位一生一次。
 * 9 条只给"猜疑强度与姿态"的方向，**不给任何具体理由/道具/引语**（会变固定模板，教训7）——
 * 打断的借口、台词、时机与她的反应全部由 AI 从玩家自己的上下文里生成。
 */
const INTERRUPT_DIRECTIONS: Record<number, string> = {
  10: '一次纯属不巧的出现——理由从当前场景自然长出来，他自己都没多想，纯粹的日常',
  20: '顺口的关心变成了顺路的一眼——理由依旧日常无心，但离开前他多停了半秒',
  30: '说不清的违和感让他借故过来转一圈——借口本身不重要，他的眼神在屋里停了停',
  40: '他开始核实——用一个此情此景说得通的理由接近，目光落在细节上（衣着/距离/神色），停留得比平时久',
  50: '第一次带着目的接近——脚步放轻，先听了一会儿才出声，出现的时机是挑过的',
  60: '试探性打断——用一个问题破门，问题指向他此刻最在意的疑点；进来后不急着走，观察反应',
  70: '不该出现的时间出现——悄然折返或提前归来，预警只有一瞬',
  80: '几乎是守候——他挑了最可能撞见什么的时机，出现得又快又静，脸上没有笑',
  90: '带着接近确认的猜疑登场——不敲门，直接进来，第一眼就在找证据',
};

/** POV 三幕的本幕方向（与打断文案同一原则：只给结构，"他注意到了什么"全部取自玩家自己的剧情） */
const POV_ACT_DIRECTIONS: Record<number, string> = {
  1: '铺垫——他这段日子的视角与最初的违和感（素材取自上下文里真实发生过的变化：她的装扮/习惯/神态/作息，选他作为丈夫最可能注意到的）',
  2: '发酵——上下文里他可能接触到的痕迹在他心里串联成线，自我解释开始站不住，他决定去看一眼',
  3: '收束——走向那扇门；以他推门打断的那一刻结束（与主线被打断的场面同一时刻，从他的眼睛看）',
};

/** 当前楼层是否属于苏文视角插叙（含"已计数楼层"的 ROLL 重生成，防幕数错位/漏冻结） */
function isPovFloor(data: SchemaType, floor: number): boolean {
  const pov = data.系统._苏文视角;
  return pov.剩余楼 > 0 || (pov.档位 > 0 && pov.上次处理楼层 >= 0 && pov.上次处理楼层 === floor);
}

/** 本楼所属幕数（1~总楼数）；ROLL 重生成已计数楼层时回退一幕 */
function getPovAct(data: SchemaType, floor: number): number {
  const pov = data.系统._苏文视角;
  const act = pov.上次处理楼层 === floor ? pov.总楼数 - pov.剩余楼 : pov.总楼数 - pov.剩余楼 + 1;
  return Math.min(Math.max(act, 1), pov.总楼数);
}

/**
 * 疑心阶梯提示（30/60/90）：脚本告知 AI 苏文的猜疑演绎强度，AI 不改数值只演态度
 * <30 不注入（无事）；爆表走坏结局块
 */
function suspicionHint(name: '秦璐' | '苏梦', v: number): string | null {
  if (v >= 90) return `  🔥 他对${name}的疑心濒临爆发：阴沉冷淡、暗中翻查，一触即发`;
  if (v >= 60) return `  ⚠⚠ 他对${name}明显起疑：盘问变多、留意她的行踪与手机、家中气氛发紧`;
  if (v >= 30) return `  ⚠ 他对${name}有些起疑：会多看两眼、状似无意地盘问，但仍愿意相信家人`;
  return null;
}

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
/** v0.24 恢复（v0.21 测试期曾暂停；后门可快速测试后无保留理由） */
const ENABLE_STAGE_RESTRAINTS = true;

const STAGE_RESTRAINTS: Record<number, string> = {
  1: '已列念头/习惯的影响只在内部呈现（走神/脸红/视线停留/梦境/对他莫名多一分关注），没有念头时她的内心就是纯粹的日常。禁止：主动谈性或身体话题（被提及会慌乱岔开）、超出母亲/姐姐常态的主动肢体接触、任何暧昧性质的主动行动。',
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
function buildStatusSnapshot(data: SchemaType, promptFloor: number): string {
  // 坏结局已锁定：只注入终局指引，其余系统块全部停止（文本按结局类型分支）
  if (data.系统._坏结局) {
    const be = data.系统._坏结局;
    const narrative = be.startsWith('三振')
      ? [
          `【坏结局·已锁定】${be}：第三次强行的精神侵入撕裂了她的心智，她的人格正在崩解。`,
          '培育、判定、商店等系统已全部停止（不再输出任何判定指令）。',
          '请演绎她崩溃的终局篇章——语无伦次、自我瓦解、认不出眼前的人，这个家再也回不去了，不再开启新的剧情线。',
        ]
      : [
          `【坏结局·已锁定】${be}：苏文积压的疑心终于爆发，他已经摊牌。`,
          '培育、判定、商店等系统已全部停止（不再输出任何判定指令）。',
          '请围绕摊牌之后的后果演绎终局篇章——质问、崩解、收场，不再开启新的剧情线。',
        ];
    return ['════════ 当前游戏状态 ════════', ...narrative, '══════════════════════════'].join('\n');
  }

  // 苏文视角插叙（v0.23）：POV 进行中只注入本幕指引，主线各系统块全部不出现
  const pov = data.系统._苏文视角;
  if (isPovFloor(data, getCurrentFloor())) {
    const act = getPovAct(data, getCurrentFloor());
    return [
      `════════ 苏文视角（插叙 · 第${act}/${pov.总楼数}幕）════════`,
      '主线已暂停。本幕以苏文为唯一视角焦点（推荐第一人称内心流，全程不切入她们的私密视角），',
      `演绎他一步步走向那次打断的过程（触发背景：他对${pov.目标}的疑心已达${pov.档位}——${INTERRUPT_DIRECTIONS[pov.档位] ?? ''}）。`,
      `▷ 本幕方向：${POV_ACT_DIRECTIONS[act] ?? POV_ACT_DIRECTIONS[3]}`,
      '规则：',
      '- 素材只用上下文里真实发生过的剧情（她的变化/装扮/异常举动），不虚构未发生的事',
      '- 他没有实据，也不在这一段获得实据——疑心的答案不在此揭晓',
      '- 本段不推进主线；变量只更新 苏文状态.当前情绪/当前心理想法（若有变化）',
      '══════════════════════════',
    ].join('\n');
  }

  const lines: string[] = [];
  lines.push('════════ 当前游戏状态 ════════');

  const floor = getCurrentFloor();
  const present = getPresentCharacters(data);

  // ━━━━ 在场角色状态行 ━━━━
  //   心防松动是脚本覆写的（AI 上下文里没有），附在状态行上
  //   穿着不再单独注入：装备写入 服装/妆容细节 变量（唯一事实源），换装靠一次性换装事件桥接
  for (const name of present) {
    const charKey = `${name}状态` as '秦璐状态' | '苏梦状态';
    const char = data[charKey];
    const vulnerable =
      char.当前情绪 === '心防松动' ? ' ⚡她此刻心防松动，比平时更容易接受亲密试探' : '';
    lines.push(`【${name}】第${char.当前阶段}阶段「${char.阶段标题}」${vulnerable}`);

    // 装扮意识（v0.22）：只提示"非日常"装扮（风险≥1），正常衣物不打扰；
    // 满星时追加动态全套清单（按玩家实际装备生成，不做任何"来历/谁知情"的叙事断言——
    // 玩家路线各异，尤其不能让写苏文心理的 AI 把这份信息泄进苏文视角）
    const daring = getDaringEquippedNames(data, charKey);
    if (daring.length > 0) {
      let fullSet = '';
      if (getOutfitStars(data, charKey).full) {
        const mods = getBodyModNames(data, charKey);
        fullSet = `。她今天从内到外的整套装扮：${getEquippedNames(data, charKey).join('、')}${
          mods.length > 0 ? `，身上还有${mods.join('、')}` : ''
        }——请体现这种整体的私密意识`;
      }
      lines.push(
        `【${name}·装扮意识】她此刻身上有刻意的装扮：${daring.join('、')}——演绎中自然体现她对它们的意识（异物感/遮掩动作/走神/怕被注意），不必每件都写${fullSet}。此信息仅属于她的私密认知，苏文等其他角色并不知情（除非正文中已被发现）`,
      );
    }
  }

  // 录像（v0.23）：录制中提示镜头存在（AI 演画面质感）
  if (data.系统._录像.录制中) {
    lines.push('【录像】一枚隐蔽的镜头正在记录当前场景——画面自带被记录的质感（角色是否意识到镜头由剧情决定）');
  }

  // 在场锁定（v0.25）：玩家手动纠正 AI 进出场判错，锁定期间 AI 不得增减在场角色
  if (data.系统._在场锁定) {
    lines.push(
      `【在场锁定】玩家已锁定在场角色：${present.join('、')}——本轮不要让其他攻略角色登场，也不要让在场者离场`,
    );
  }

  // 苏文位置：脚本黑盒作息算出，快照是 AI 唯一获知通道，必须每轮注入
  // v0.29 预演注入：作息推进发生在写阶段（AI 回复后），此处直接读变量拿到的是
  //   上一楼的状态——跨段楼/跳转楼快照必错一段，v0.28 的锚定反而把 AI 摁在旧处境
  //   （症状：状态栏已"外出"，心理活动还是"回卧室躺一会"）。预演与写阶段同输入
  //   同算法，注入的即本楼落地值
  const suwen = previewSuwenPosition(data, promptFloor, getLastUserMessage(), isRerollGeneration());
  lines.push(`【苏文】${suwen.状态} @ ${suwen.位置}`);
  // 心理活动锚定（v0.28）：当前心理想法由 AI 写，但必须符合脚本算出的处境——
  //   否则会出现"外出上班却在想着再睡一会"这类与位置矛盾的独白
  {
    const 处境 =
      suwen.状态 === '外出'
        ? '他此刻不在家（上班/通勤/在外办事），心理活动须落在外面的处境，绝不能写成在家、在房间、赖床/再睡一会等居家内容'
        : suwen.状态 === '睡眠'
          ? `他此刻在${suwen.位置}睡眠，心理活动是睡前/半梦半醒的思绪`
          : `他此刻在家中的${suwen.位置}，心理活动须符合这个位置与在家状态`;
    lines.push(
      `  ▷ 苏文·心理活动锚定：${处境}（当前心理想法要与上面这行位置一致，不得自相矛盾；若他上一轮的心理想法与此处境已不符，本轮必须重写该字段）`,
    );
  }
  // 疑心阶梯（30/60/90）：告知 AI 苏文的猜疑演绎强度（数值脚本管理，AI 只演态度）
  for (const name of ['秦璐', '苏梦'] as const) {
    const hint = suspicionHint(name, data.苏文状态[`对${name}疑心值`]);
    if (hint) lines.push(hint);
  }
  // 打断余波（v0.25）：打断后 2~3 楼行为尺度收敛——不冻结培育（念头在内心），收的是"出口"
  if (data.系统._打断余波至楼层 >= 0 && promptFloor < data.系统._打断余波至楼层) {
    lines.push(
      '  🌫 打断余波：他刚打断过这里，注意力还没移开、人也没走远——这几轮她们的越界收进眼神与暗流（行为出口临时收敛一档），等风头过去；具体如何收敛按上下文与当前阶段演绎',
    );
  }

  // ━━━━ 一次性剧情事件（首穿等；脚本写入，写阶段转存 _已注入事件） ━━━━
  // v0.25 重roll保护：同楼重生成（转存楼层 >= 本次生成楼层）时重放转存内容——
  // 否则事件已被上一次写阶段消费，重roll 版本收不到指引，AI 会口胡。
  // 重放时刻意忽略 _待发送道具事件（那是引擎上一周期为下一楼产出的，等真正的下一楼再注入）
  const injectedEv = data.系统._已注入事件;
  const rerollReplay = !!injectedEv.内容 && injectedEv.楼层 >= promptFloor;
  const evText = rerollReplay ? injectedEv.内容 : data.系统._待发送道具事件;
  if (evText) {
    if (rerollReplay) console.info(`[事件] 同楼重roll，重放已消费事件（楼层${injectedEv.楼层}）`);
    lines.push('');
    lines.push(`【本轮剧情事件（一次性，请自然融入演绎，不要复述本提示）】`);
    for (const ev of evText.split('|').filter(Boolean)) {
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
    if (growing.length > 0) hasGrowing = true;
    lines.push('');
    if (growing.length > 0 || habits.length > 0) {
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
      // 心理来源白名单（v0.30）：影响清单即全集——防 AI 从人设/氛围自发脑补
      // "压抑的欲望"（玩家反馈：不撩不植念头也发情）
      lines.push(
        `  ▷ 心理来源限定：她超出阶段基线的暧昧/欲望向心理，只能来自上面列出的念头与习惯——没列出的 = 不存在，不要自发添加或放大`,
      );
    } else if (char.当前阶段 <= 1) {
      // v0.30 平常心基线：原先无念头/习惯时整块跳过——恰好在最需要约束的场景
      // （没植念头也没撩）什么都没说，AI 只剩人设和氛围可脑补
      const 身份 = name === '秦璐' ? '一位普通的母亲' : '一个普通的姐姐';
      lines.push(
        `【${name}·当前无念头影响】她此刻没有任何念头/习惯在起作用，就是${身份}：内心戏围绕家务/学业/家人/日常琐事展开，不要自发生成任何暧昧、性张力、身体意识或"压抑的欲望"类描写`,
      );
    } else {
      lines.push(
        `【${name}·当前无念头影响】她此刻没有额外念头/习惯在起作用，心理基线以下方阶段约束为准，不要在此之外自发加码暧昧/欲望描写`,
      );
    }
    // 阶段禁区：出口按阶段限幅（念头决定想什么，阶段决定敢什么）
    // v0.30 起常驻注入（原先挂在影响块内，无念头时连约束一起消失）
    if (ENABLE_STAGE_RESTRAINTS) {
      lines.push(
        `  ▷ 阶段约束（第${char.当前阶段}阶段「${char.阶段标题}」）：${STAGE_RESTRAINTS[char.当前阶段] ?? STAGE_RESTRAINTS[1]}`,
      );
      // 越界应对（v0.30）：只给底线不给动作剧本（教训6/7——写具体反应会坍缩成固定戏码）；
      // 明确"拒绝≠关系受损"，保住攻略性——被拒的信号是"她现在还不行"，不是"这条线死了"
      lines.push(
        `  ▷ 越界应对：若苏斌的言行超出本阶段禁区，她本轮不会配合——但如何回应必须从她的人设、她对他的感情与当下情境里长出来（错愕、心疼、自责、担心他是不是压力太大……形式由你按上下文演绎），不要模板化的翻脸；拒绝不损害她对他的爱，也不会点燃她的欲望`,
      );
    }
  }

  // 已成熟待腾位/习惯栏容量/货币/依存度：玩家侧或脚本内部信息，不注入给 AI

  // ━━━━ AI 判定通道 1：待判定念头 → 类型判定（未判出就持续注入） ━━━━
  //   不按在场过滤：类型判定是纯语义分类，不需要角色在场
  //   v0.23 校对修复：撤掉"植入后≤3楼"窗口——POV 插叙 3 幕 + 打断楼会烧穿窗口，
  //   念头永远卡在判定中还占培育槽；判定中即注入，判出即消失，无骚扰面
  //   10大类枚举/只判类型 等完整规则常驻世界书「变量输出格式」
  const pendingLines: string[] = [];
  for (const name of ['秦璐', '苏梦'] as const) {
    const charKey = `${name}状态` as '秦璐状态' | '苏梦状态';
    for (const [id, t] of Object.entries(data[charKey].念头列表)) {
      if (t.状态 === '判定中') {
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

  // ━━━━ AI 判定通道 3：影像归档（停止录制后一次性，写完即消失） ━━━━
  const pendingTapes = Object.entries(data.系统.影像列表).filter(([, t]) => t.状态 === '待摘要');
  if (pendingTapes.length > 0) {
    lines.push('');
    lines.push(`━━━ 判定任务 C：影像归档 ━━━`);
    for (const [id] of pendingTapes) {
      lines.push(
        `  replace /系统/影像列表/${id}/摘要 = 50字以内，概括刚才那段被录制的剧情中最私密/最不可示人的画面`,
      );
    }
    lines.push(`只写摘要，不要修改影像的其它字段，不要在正文里提及归档这件事。`);
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
      const _top = (window.parent ?? window) as any;
      _top.toastr?.error?.(
        `游戏逻辑脚本加载失败：${(err as Error)?.message ?? String(err)}\n请 F12 查看控制台`,
        '秦璐重置版',
        { timeOut: 0, extendedTimeOut: 0 },
      );
      return;
    }

    // 脚本心跳（v0.25 对标云霜凝 2.0.32）：每 5s 往 _top.sessionStorage 写心跳，
    // 状态栏 iframe 延迟 15s 检测——心跳空/陈旧则弹"脚本未加载"错误提示。
    // 脚本 iframe reload（切聊天）时 setInterval 随 iframe 销毁，不会累积。
    try {
      const _top = (window.parent ?? window) as any;
      _top.sessionStorage?.setItem?.('秦璐重置版_脚本心跳', String(Date.now()));
      _top.sessionStorage?.removeItem?.('秦璐重置版_加载失败toast已弹');
      setInterval(() => {
        try {
          _top.sessionStorage?.setItem?.('秦璐重置版_脚本心跳', String(Date.now()));
        } catch {}
      }, 5000);
    } catch {}

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

        // 1. 心防松动窗口：脚本后写覆盖当前情绪（对所有在场角色生效；坏结局/苏文视角期间不覆写）
        //    楼层 % 10 <= 3 → 覆写为"心防松动"（已确认方向，待界面发光字体配合）
        if (!data.系统._坏结局 && !isPovFloor(data, messageId) && isInVulnerableWindow(messageId)) {
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
        const snapshot = SNAPSHOT_MARKER + ']\n' + buildStatusSnapshot(data, messageId);
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

        // 1.1 旧档迁移（v0.28）：苏梦气质描述曾因 initvar 缺字段回落到秦璐的字段级默认
        //     （'温柔贤淑的家庭主妇'）。该字段 AI/脚本均不写，旧档会一直错——幂等纠正。
        if (newData.苏梦状态.气质描述 === '温柔贤淑的家庭主妇') {
          newData.苏梦状态.气质描述 = '活泼开朗的大学生';
          console.info('[迁移] 苏梦气质描述从泄漏默认纠正为「活泼开朗的大学生」');
        }

        // 1.4 一次性事件消费转存（v0.23 清空前移；v0.25 重roll保护升级为转存制）：
        //     - 本楼重roll（转存楼层===currentFloor）：PROMPT_READY 已用转存内容重放，
        //       待发送里是引擎上一周期为下一楼产出的事件，原样保留到真正的下一楼
        //     - 正常过楼：待发送非空 = 刚注入过本楼 → 转存后清空；为空则清掉过期转存
        {
          const injected = newData.系统._已注入事件;
          if (injected.内容 && injected.楼层 === currentFloor) {
            // 重roll：待发送与转存都不动
          } else if (newData.系统._待发送道具事件) {
            injected.楼层 = currentFloor;
            injected.内容 = newData.系统._待发送道具事件;
            newData.系统._待发送道具事件 = '';
          } else {
            injected.楼层 = -1;
            injected.内容 = '';
          }
        }

        // 1.5 坏结局锁定：引擎全停（回滚保护仍生效）
        if (newData.系统._坏结局) {
          _.set(新变量, 'stat_data', newData);
          _isInAiCycle = false;
          return;
        }

        // 1.6 苏文视角插叙（v0.23）：主线引擎全部冻结，只推进幕数（按楼层防 ROLL 重复扣；
        //     含"已计数楼层"的 ROLL 重生成——那也是 POV 楼，不能放引擎跑）
        if (isPovFloor(newData, currentFloor)) {
          const pov = newData.系统._苏文视角;
          if (pov.剩余楼 > 0 && currentFloor !== pov.上次处理楼层) {
            pov.剩余楼 -= 1;
            pov.上次处理楼层 = currentFloor;
            // 打断余波窗口被 POV 插叙占用时按楼顺延（防烧穿——判定任务A同款教训）
            if (newData.系统._打断余波至楼层 >= currentFloor) {
              newData.系统._打断余波至楼层 += 1;
            }
            console.info(`[苏文视角] 第${pov.总楼数 - pov.剩余楼}/${pov.总楼数}幕完成，剩余${pov.剩余楼}`);
          }
          _.set(新变量, 'stat_data', newData);
          _isInAiCycle = false;
          return;
        }

        // 2. 推进苏文作息游标（楼层驱动黑盒节律）
        //    v0.25 打断余波：窗口内游标暂停——他因打断滞留家中（状态/位置维持打断落地时的强制值，
        //    回滚机制每轮从快照恢复），窗口过后从暂停处恢复流动；过期清理标志
        if (newData.系统._打断余波至楼层 >= 0 && currentFloor <= newData.系统._打断余波至楼层) {
          newData.苏文状态.当前状态 = '在家';
          console.info(
            `[苏文作息] 打断余波中（至楼${newData.系统._打断余波至楼层}），游标暂停，苏文滞留@${newData.苏文状态.当前位置}`,
          );
        } else {
          if (newData.系统._打断余波至楼层 >= 0) {
            newData.系统._打断余波至楼层 = -1;
            console.info('[苏文作息] 打断余波结束，作息恢复流动');
          }
          advanceSuwenRoutine(newData, currentFloor, playerInput);
        }

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

        // 4.25 苏梦引场倒数（隐藏钩子：秦璐穿上任意阶段2+外装启动，v0.25 放宽）：归零 → 注入苏梦登场剧情（一次性）
        {
          const intro = newData.系统._苏梦引场;
          if (!intro.已触发 && intro.剩余楼 > 0) {
            intro.剩余楼 -= 1;
            if (intro.剩余楼 === 0) {
              intro.已触发 = true;
              intro.剩余楼 = -1;
              // 引场要让苏梦登场，若玩家恰好锁了在场角色会顶掉她的入场——自动解锁（v0.25）
              newData.系统._在场锁定 = false;
              const event =
                '苏梦：她不经意撞见了母亲此刻的样子（推门/厨房/走廊——按当前场景自然选择），由衷地赞美了母亲的变化。本轮让苏梦自然登场并留下鲜明的存在感（记得将 /系统/在场角色/苏梦 置为 true），登场方式与对话完全按上下文演绎';
              newData.系统._待发送道具事件 = newData.系统._待发送道具事件
                ? `${newData.系统._待发送道具事件}|${event}`
                : event;
              console.info('[隐藏钩子] 苏梦引场触发');
            }
          }
        }

        // 4.3 影像归档就绪：AI 写完摘要 → 标记已就绪（前端"给她看"按钮解锁）
        for (const [id, tape] of Object.entries(newData.系统.影像列表)) {
          if (tape.状态 === '待摘要' && tape.摘要) {
            tape.状态 = '已就绪';
            console.info(`[录像] ${id} 摘要归档完成：${tape.摘要}`);
          }
        }

        // 4.4 满星疑心结算（回滚已恢复基准值，在此之上涨/落）
        settleSuspicion(newData, currentFloor);

        // 4.45 经济结算（v0.25）：堕落度增量折算货币 + 阶段突破奖励（坏结局楼不发钱）
        if (!newData.系统._坏结局) settleEconomy(newData);

        // （原 4.5 事件清空已前移至 1.4——本周期新产生的事件保留到下一轮注入）

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
