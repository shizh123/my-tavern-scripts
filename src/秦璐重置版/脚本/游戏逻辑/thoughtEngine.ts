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

/** 基础需要楼数（按难度）—— 数值待平衡阶段统一调 */
const FLOORS_BY_DIFFICULTY = {
  简单: 3,
  困难: 6,
};

/** 保留楼数上限：培育中/未达标念头超过 植入楼层+此值 仍未成熟 → 已过期 */
const RETENTION_FLOORS = 30;

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
  const stage = data[characterKey].当前阶段;

  // 心防松动窗口：阶段+1，封顶5
  if (isInVulnerableWindow(currentFloor)) {
    return Math.min(stage + 1, 5);
  }

  // 道具越级（安神药/头孢酒）—— 道具系统细化后接入
  // TODO: 读 data.系统.道具状态 判断是否使用越级道具

  return stage;
}

/**
 * 植入念头（前端调用入口）
 * 乐观植入：立即收下，状态=判定中，分配 ID
 */
export function implantThought(
  data: SchemaType,
  characterKey: '秦璐状态' | '苏梦状态',
  content: string,
  currentFloor: number,
): string {
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

  // 检查是否合格（越级闸门）
  const effectiveStage = getEffectiveStage(data, characterKey, currentFloor);
  const catStage = CATEGORY_STAGE[category];
  if (catStage <= effectiveStage) {
    // 合格 → 培育中
    thought.状态 = '培育中';
    console.info(`[念头判定] ${thoughtId} 类型=${category} 难度=${难度} 需${需要楼数}楼 → 培育中`);
  } else {
    // 不合格 → 未达标（标红、可退回/保留）
    thought.状态 = '未达标';
    console.info(
      `[念头判定] ${thoughtId} 类型=${category} 越级(需阶段${catStage}，有效阶段${effectiveStage}) → 未达标`,
    );
  }
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

    thought.开发进度 += progress;
    console.info(
      `[念头培育] ${characterKey} ${id} +${progress} (加速:${accelerating ? '是' : '否'}, 相关:${relevance ?? 0}) → ${thought.开发进度}/${thought.需要楼数}`,
    );

    // 成熟判定
    if (thought.开发进度 >= thought.需要楼数) {
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
 * - 每个 100 货币
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
  data.系统.货币 += 100;
  console.info(`[习惯变卖] ${characterKey} 出售"${sold.内容}" → 货币+100 (共${data.系统.货币})`);
  return true;
}

/**
 * 玩家退回未达标念头（删除）
 */
export function discardThought(data: SchemaType, characterKey: '秦璐状态' | '苏梦状态', thoughtId: string): void {
  const thought = data[characterKey].念头列表[thoughtId];
  if (thought && thought.状态 === '未达标') {
    delete data[characterKey].念头列表[thoughtId];
    console.info(`[念头退回] ${characterKey} ${thoughtId} 已删除`);
  }
}
