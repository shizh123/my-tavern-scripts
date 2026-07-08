/**
 * 念头培育引擎 — 楼层驱动 + 苏文位置加速 + 成熟结算
 *
 * 设计（见 设计文档/）：
 * - 念头 ID 化字典（Record<id, Thought>），不靠内容反查
 * - 楼层进度：每楼 +1 保底，苏文在加速房额外加速（约 1/3）
 * - 难度 = 相对当前阶段的跨度（方案B）：符合阶段=简单，越级=困难
 * - 成熟结算：堕落度↑、对主角依存↑、对苏文依存↓
 * - 习惯上限 5，满了变卖换货币
 *
 * 念头状态机：判定中 → 培育中/未达标 → 已成熟/退回/保留
 */

import type { SchemaType } from '../../schema';
import { getStageByCorruption } from '../../stageConfig';
import { getEquipBoost, getCultivationSlots, getOutfitStars, hasEscalationKey, queueItemEvent } from './shopSystem';
import { isSuwenInAccelerationRoom } from './suwenRoutine';

/** 念头类型（10大类 + 待判定），沿用旧版 */
export type ThoughtCategoryValue =
  | '待判定'
  | '陪伴交流'
  | '情感依赖'
  | '肢体亲近'
  | '暧昧互动'
  | '亲密接触'
  | '身体开放'
  | '性行为'
  | '身份认同'
  | '绝对服从'
  | '家庭替代';

/** 类型对应的推荐阶段（用于算难度=相对当前阶段的跨度） */
const CATEGORY_STAGE: Record<Exclude<ThoughtCategoryValue, '待判定'>, number> = {
  陪伴交流: 1,
  情感依赖: 1,
  肢体亲近: 2,
  暧昧互动: 2,
  亲密接触: 3,
  身体开放: 3,
  性行为: 4,
  身份认同: 4,
  绝对服从: 5,
  家庭替代: 5,
};

/** 基础需要楼数（按难度）—— v0.22 定稿：5/10（原 3/6 为测试期临时值） */
const FLOORS_BY_DIFFICULTY = {
  简单: 5,
  困难: 10,
};

/** 满配下限：无论加速堆多高，距植入不足此楼数不成熟（简单3/困难4，用户定） */
const MIN_MATURE_FLOORS = {
  简单: 3,
  困难: 4,
};

/** 保留楼数上限：培育中/未达标念头超过 植入楼层+此值 仍未成熟 → 已过期 */
const RETENTION_FLOORS = 30;

/** 变卖习惯所得货币（v0.21：100→300，平衡 35 件商品的收入端；待平衡阶段微调） */
export const HABIT_SELL_PRICE = 300;

/**
 * 培育槽占用数（v0.17：库存限制取代旧的每楼流量限制）
 * 判定中+培育中 计槽（判定中必须计入，否则可囤在判定中绕过限制）；
 * 未达标/已成熟/已过期 不占槽。槽上限见 shopSystem.getCultivationSlots（基础3，植入扩容+1）。
 */
export function countActiveThoughts(
  data: { 秦璐状态: { 念头列表: Record<string, { 状态: string }> }; 苏梦状态: { 念头列表: Record<string, { 状态: string }> } },
  characterKey: '秦璐状态' | '苏梦状态',
): number {
  return Object.values(data[characterKey]?.念头列表 ?? {}).filter(
    t => t.状态 === '判定中' || t.状态 === '培育中',
  ).length;
}

/** 心防松动窗口：楼层 % 10 <= 3 即处于窗口（10-13楼、20-23楼…） */
export function isInVulnerableWindow(currentFloor: number): boolean {
  return currentFloor % 10 <= 3;
}

/**
 * 念头过期判定：培育中/未达标念头超过保留楼数上限 → 已过期
 * 判定中念头不参与过期（等 AI 判定，下一轮重试）
 */
export function isThoughtExpired(thought: { 状态: string; 植入楼层: number }, currentFloor: number): boolean {
  if (thought.状态 === '判定中' || thought.状态 === '已成熟' || thought.状态 === '已过期') return false;
  return currentFloor - thought.植入楼层 >= RETENTION_FLOORS;
}

/**
 * 根据念头类型 + 角色当前阶段，计算难度和需要楼数
 * 难度 = 相对当前阶段的跨度（方案B）
 */
export function calcDifficultyAndFloors(
  category: Exclude<ThoughtCategoryValue, '待判定'>,
  currentStage: number,
): { 难度: '简单' | '困难'; 需要楼数: number } {
  const catStage = CATEGORY_STAGE[category];
  // 类型推荐阶段 <= 当前阶段 → 简单；越级 → 困难
  const 难度: '简单' | '困难' = catStage <= currentStage ? '简单' : '困难';
  const 需要楼数 = FLOORS_BY_DIFFICULTY[难度];
  return { 难度, 需要楼数 };
}

/**
 * 检查越级是否被允许（心防松动窗口 / 道具解锁）
 * 返回有效阶段（用于判断该类型是否合法）
 */
function getEffectiveStage(data: SchemaType, characterKey: '秦璐状态' | '苏梦状态', currentFloor: number): number {
  const char = data[characterKey];
  let stage = char.当前阶段;

  // 心防松动窗口：阶段+1
  if (isInVulnerableWindow(currentFloor)) {
    stage += 1;
  }

  // 裂纹窗口（v0.25）：强植被排异弹回后 3 楼内，她的心防带着裂缝——阶段+1（可与药效/松动叠加）
  if (char._裂纹至楼层 >= 0 && currentFloor <= char._裂纹至楼层) {
    stage += 1;
  }

  // 道具越级药效（安神药+1/头孢酒+2，消耗品使用后在有效楼数内生效）
  if (char._越级加成 > 0 && currentFloor <= char._越级加成至楼层) {
    stage += char._越级加成;
  }

  return Math.min(stage, 5);
}

/**
 * 植入念头（前端调用入口）
 * 乐观植入：立即收下，状态=判定中，分配 ID
 * 培育槽限制：目标角色 判定中+培育中 达到槽上限时拒绝，返回 null
 */
export function implantThought(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  content: string,
  currentFloor: number,
): string | null {
  if (data.系统._坏结局) {
    console.warn(`[念头植入] 坏结局已锁定，拒绝："${content}"`);
    return null;
  }
  const slots = getCultivationSlots(data);
  if (countActiveThoughts(data, characterKey) >= slots) {
    console.warn(`[念头植入] ${characterKey} 培育槽已满(${slots})，拒绝："${content}"`);
    return null;
  }
  const id = `念头_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const thought = {
    内容: content,
    类型: '待判定' as ThoughtCategoryValue,
    状态: '判定中' as const,
    难度: '待定' as const,
    需要楼数: 0,
    开发进度: 0,
    植入楼层: currentFloor,
  };
  data[characterKey].念头列表[id] = thought;

  // 写入植入日志（ROLL 容错：待通知 AI）
  data.系统.念头植入日志.push({
    目标: characterKey === '秦璐状态' ? '秦璐' : '苏梦',
    念头ID: id,
    内容: content,
    植入楼层: currentFloor,
    已通知AI: false,
  });

  console.info(`[念头植入] ${characterKey} 植入 ${id}："${content}" → 判定中`);
  return id;
}

/**
 * AI 判定念头类型后，脚本处理：定难度、定需要楼数、判合格转培育中 / 不合格转未达标
 *
 * @param data
 * @param characterKey
 * @param thoughtId
 * @param category AI 判定的类型（若 AI 没判出则仍为"待判定"，保持判定中重试）
 * @param currentFloor
 */
export function resolveThoughtType(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  thoughtId: string,
  category: ThoughtCategoryValue,
  currentFloor: number,
): void {
  const thought = data[characterKey].念头列表[thoughtId];
  if (!thought) {
    console.warn(`[念头判定] 找不到念头 ${thoughtId}`);
    return;
  }

  // AI 没判出类型 → 保持判定中，下一轮重试
  if (category === '待判定') {
    console.info(`[念头判定] ${thoughtId} 仍未判出类型，保持判定中`);
    return;
  }

  // 判出类型了 → 定难度、定需要楼数
  const { 难度, 需要楼数 } = calcDifficultyAndFloors(category, data[characterKey].当前阶段);
  thought.类型 = category;
  thought.难度 = 难度;
  thought.需要楼数 = 需要楼数;

  // 越级闸门（v0.24 恢复）：类型推荐阶段 > 有效阶段 → 退回（未达标）
  // 有效阶段 = 基础阶段 + 心防松动窗口(+1) + 药效越级(安神药+1/头孢酒+2) + 越级钥匙装备(匹配类型+1)
  const keyBonus = hasEscalationKey(data, characterKey, category) ? 1 : 0;
  const effectiveStage = Math.min(5, getEffectiveStage(data, characterKey, currentFloor) + keyBonus);
  const catStage = CATEGORY_STAGE[category];
  if (catStage > effectiveStage) {
    thought.状态 = '未达标';
    console.info(
      `[念头判定] ${thoughtId} 类型=${category} 越级(需阶段${catStage}，有效阶段${effectiveStage}${keyBonus ? '·含越级钥匙' : ''}) → 未达标退回`,
    );
    return;
  }
  thought.状态 = '培育中';
  // 正常植入成功进入培育 → 三振连续计数清零（连续语义，用户定）
  if (data[characterKey]._强植三振 > 0) {
    data[characterKey]._强植三振 = 0;
    console.info(`[三振] ${characterKey} 正常植入成功，连续计数清零`);
  }
  console.info(`[念头判定] ${thoughtId} 类型=${category} 难度=${难度} 需${需要楼数}楼 → 培育中`);
}

/**
 * 强行植入（v0.24 三振）：对"未达标"念头强推。诱惑派入口、惩罚亮：
 * - 前 2 次：假意进入培育中（_强植 标记），下一楼必被心智排异退回；注入排异反应事件
 * - 连续第 3 次：三振——坏结局锁定（正常植入成功会清零计数）
 */
export function forceImplant(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  thoughtId: string,
): { error?: string; count?: number; bad?: boolean } {
  if (data.系统._坏结局) return { error: '结局已锁定' };
  const thought = data[characterKey].念头列表[thoughtId];
  if (!thought || thought.状态 !== '未达标') return { error: '只有被退回的念头可以强行植入' };

  const charName = characterKey === '秦璐状态' ? '秦璐' : '苏梦';
  const count = (data[characterKey]._强植三振 ?? 0) + 1;
  data[characterKey]._强植三振 = count;

  if (count >= 3) {
    // 三振出局：坏结局锁定（快照转终局指引，引擎/商店全停）
    data.系统._坏结局 = `三振崩溃·${charName}`;
    console.warn(`[三振] ${characterKey} 第3次强行植入，心智崩溃，存档锁定`);
    return { count, bad: true };
  }

  thought.状态 = '培育中';
  thought._强植 = true;
  queueItemEvent(
    data,
    characterKey,
    `{{user}}把「${thought.内容}」强行压进了她的心智——本轮演绎剧烈的排异反应：突如其来的失控、生理性的抗拒与痛苦（这道念头正在伤害她，不要让它生效），但这次粗暴的撞击也在她的心防上留下了一道裂缝${count === 2 ? '。这已是第二次，她的眼神里出现了裂纹' : ''}`,
  );
  console.warn(`[三振] ${characterKey} 强行植入「${thought.内容}」（连续${count}/3）`);
  return { count };
}

/**
 * 趁隙再植（v0.25 裂纹窗口）：对已判型的"未达标"念头重新过一次越级闸门——
 * 裂纹/心防松动/药效/越级钥匙此刻可能已把有效阶段抬够。
 * 成功 → 培育中（刷新植入楼层）+ 三振连续计数清零（等同正常植入成功）。
 * 返回错误信息，null=成功
 */
export function retryImplant(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  thoughtId: string,
  currentFloor: number,
): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const thought = data[characterKey].念头列表[thoughtId];
  if (!thought || thought.状态 !== '未达标') return '只有被退回的念头可以再植';
  if (thought.类型 === '待判定') return '类型未判定，无法再植';
  const slots = getCultivationSlots(data);
  if (countActiveThoughts(data, characterKey) >= slots) return `培育槽已满（${slots}）`;

  const category = thought.类型 as Exclude<ThoughtCategoryValue, '待判定'>;
  const keyBonus = hasEscalationKey(data, characterKey, category) ? 1 : 0;
  const effectiveStage = Math.min(5, getEffectiveStage(data, characterKey, currentFloor) + keyBonus);
  const catStage = CATEGORY_STAGE[category];
  if (catStage > effectiveStage) {
    return `她仍然接受不了（需阶段${catStage}，当前有效阶段${effectiveStage}）`;
  }

  const { 难度, 需要楼数 } = calcDifficultyAndFloors(category, data[characterKey].当前阶段);
  thought.难度 = 难度;
  thought.需要楼数 = 需要楼数;
  thought.开发进度 = 0;
  thought.植入楼层 = currentFloor;
  thought.状态 = '培育中';
  if (data[characterKey]._强植三振 > 0) {
    data[characterKey]._强植三振 = 0;
    console.info(`[三振] ${characterKey} 趁隙再植成功，连续计数清零`);
  }
  console.info(`[裂纹窗口] ${characterKey} ${thoughtId} 趁隙再植 → 培育中（${难度}/${需要楼数}楼）`);
  return null;
}

/**
 * 每楼推进念头培育进度（VARIABLE_UPDATE_ENDED 调用）
 * - 保底 +1 楼
 * - 苏文在加速房 → 额外加速（约 1/3，等效进度 ×1.5 那些楼）
 * - 进度 >= 需要楼数 → 成熟
 */
export function tickThoughtProgress(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  currentFloor: number,
  relevanceMap: Record<string, number>,
): void {
  const character = data[characterKey];
  const thoughts = character.念头列表;
  const accelerating = isSuwenInAccelerationRoom(data.系统._苏文作息游标);

  for (const [id, thought] of Object.entries(thoughts)) {
    // 强植排异（v0.24 三振）：强行压入的念头下一楼必被心智弹出 → 退回未达标
    // v0.25 裂纹窗口：暴力撞击在心防上砸出裂缝——之后 3 楼有效阶段+1，未达标念头可趁隙再植
    if (thought._强植 && thought.状态 === '培育中') {
      thought.状态 = '未达标';
      thought._强植 = false;
      character._裂纹至楼层 = currentFloor + 3;
      console.info(`[三振] ${characterKey} ${id} 强植排异 → 退回未达标（心防裂纹至楼${currentFloor + 3}）`);
      continue;
    }
    // 过期判定：培育中/未达标超保留楼数 → 已过期（判定中不参与，等 AI 重试）
    if (isThoughtExpired(thought, currentFloor)) {
      thought.状态 = '已过期' as any;
      console.info(`[念头过期] ${characterKey} ${id} 超${RETENTION_FLOORS}楼未成熟 → 已过期`);
      continue;
    }
    if (thought.状态 !== '培育中') continue;

    // 保底 +1
    let progress = 1;
    // 苏文在加速房 → 额外 +0.5（约 1/3 加速：原本需 N 楼，加速条件下等效 2N/3 楼）
    if (accelerating) {
      progress += 0.5;
    }
    // AI 相关性加速：高度相关 +2 / 轻微相关 +1
    const relevance = relevanceMap[id];
    if (relevance === 2) {
      progress += 2;
    } else if (relevance === 1) {
      progress += 1;
    }
    // 装备加速：装备中且类型倾向匹配的仪容装备
    let equipBoost = 0;
    if (thought.类型 !== '待判定') {
      equipBoost = getEquipBoost(data, characterKey, thought.类型);
      progress += equipBoost;
    }
    // 满星全套加成（v0.22）：4 槽网店装备 + 体改齐备 → 所有培育中念头 +1/楼，无视类型匹配
    // （代价：满星期间苏文疑心 +1/楼，结算在 index.ts）
    if (getOutfitStars(data, characterKey).full) {
      progress += 1;
    }

    thought.开发进度 += progress;
    console.info(
      `[念头培育] ${characterKey} ${id} +${progress} (加速:${accelerating ? '是' : '否'}, 相关:${relevance ?? 0}, 装备:${equipBoost}) → ${thought.开发进度}/${thought.需要楼数}`,
    );

    // 成熟判定：进度达标 + 满配下限（距植入至少 简单3/困难4 楼，防满星瞬发）
    const minFloors = MIN_MATURE_FLOORS[thought.难度 as '简单' | '困难'] ?? 3;
    if (thought.开发进度 >= thought.需要楼数 && currentFloor - thought.植入楼层 >= minFloors) {
      matureThought(data, characterKey, id, currentFloor);
    }
  }
}

/**
 * 念头成熟 → 转习惯 + 数值结算
 * - 堕落度↑（困难更多）
 * - 对主角依存↑
 * - 对苏文依存↓（按对主角依存分档）
 * - 习惯上限 5，满了需玩家变卖腾位（此处若满则不转，等界面处理）
 */
function matureThought(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  thoughtId: string,
  currentFloor: number,
): void {
  const character = data[characterKey];
  const thought = character.念头列表[thoughtId];
  if (!thought) return;

  // 习惯上限 5：满了不自动转，标记状态等界面变卖腾位后补转入
  if (character.习惯列表.length >= 5) {
    thought.状态 = '已成熟' as any; // 标记已成熟但习惯栏满，待变卖
    console.info(`[念头成熟] ${characterKey} ${thoughtId} 成熟但习惯已满5，待变卖腾位`);
    return;
  }

  // 转习惯 + 数值结算（抽取为公共函数，补转入复用）
  transferThoughtToHabit(data, characterKey, thoughtId, currentFloor);
}

/**
 * 把已成熟念头转入习惯 + 执行数值结算 + 删除念头
 * matureThought 与补转入（变卖腾位后）共用
 */
function transferThoughtToHabit(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  thoughtId: string,
  currentFloor: number,
): void {
  const character = data[characterKey];
  const thought = character.念头列表[thoughtId];
  if (!thought) return;

  // 转习惯
  character.习惯列表.push({
    内容: thought.内容,
    形成楼层: currentFloor,
  });

  // 数值结算（数值待平衡阶段统一调，此处先给骨架值）
  const isHard = thought.难度 === '困难';
  character.堕落度 += isHard ? 8 : 6;
  character.对主角依存度 += isHard ? 4 : 3;

  // 对苏文依存↓：按对主角依存分档
  const dep = character.对主角依存度;
  let suwenDecrease = -2;
  if (dep >= 80) suwenDecrease = -5;
  else if (dep >= 60) suwenDecrease = -4;
  else if (dep >= 30) suwenDecrease = -3;
  if (isHard) suwenDecrease = Math.floor(suwenDecrease * 1.2);
  character.对苏文依存度 += suwenDecrease;

  // 阶段更新（由堕落度派生）
  const newStage = getStageByCorruption(character.堕落度);
  if (newStage > character.当前阶段) {
    character.当前阶段 = newStage;
    console.info(`[念头成熟] ${characterKey} 阶段提升 → ${newStage}`);
  }

  // 删除已转入习惯的念头
  delete character.念头列表[thoughtId];

  console.info(
    `[念头转习惯] ${characterKey} "${thought.内容}" → 习惯 ` +
      `(堕落度${character.堕落度}, 主角依存${character.对主角依存度}, 苏文依存${character.对苏文依存度})`,
  );
}

/**
 * 变卖习惯换货币（前端界面调用）
 * - 习惯满 5 才能卖（未满不卖）
 * - 每个 HABIT_SELL_PRICE 货币
 * - 习惯消失，阶段不回退
 */
export function sellHabit(data: SchemaType, characterKey: '秦璐状态' | '苏梦状态', habitIndex: number): boolean {
  const character = data[characterKey];
  if (character.习惯列表.length < 5) {
    console.warn(`[习惯变卖] ${characterKey} 习惯未满5，不可出售`);
    return false;
  }
  if (habitIndex < 0 || habitIndex >= character.习惯列表.length) {
    console.warn(`[习惯变卖] 无效索引 ${habitIndex}`);
    return false;
  }

  const sold = character.习惯列表.splice(habitIndex, 1)[0];
  data.系统.货币 += HABIT_SELL_PRICE;
  console.info(`[习惯变卖] ${characterKey} 出售"${sold.内容}" → 货币+${HABIT_SELL_PRICE} (共${data.系统.货币})`);
  return true;
}

/**
 * 玩家退回念头（删除，无补偿）
 * v0.17 放宽：判定中/培育中 也可退回（主动止损腾培育槽）；已过期可清理。
 * 已成熟不可退回（等变卖腾位转习惯）。
 */
export function discardThought(data: SchemaType, characterKey: '秦璐状态' | '苏梦状态', thoughtId: string): void {
  const thought = data[characterKey].念头列表[thoughtId];
  if (thought && thought.状态 !== '已成熟') {
    delete data[characterKey].念头列表[thoughtId];
    console.info(`[念头退回] ${characterKey} ${thoughtId}（${thought.状态}）已删除`);
  }
}
