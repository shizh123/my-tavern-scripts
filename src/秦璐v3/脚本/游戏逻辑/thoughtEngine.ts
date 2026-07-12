/**
 * 念头培育引擎 v2 — 楼层驱动 + 苏文位置加速 + 成熟结算
 *
 * v2 变更：
 * - 念头类型替换为新10大类
 * - 堕落度 → 沦陷度
 * - 删除苏梦（characterKey 只有 '秦璐状态'）
 * - 阶段 1-5 → 1-4
 * - CATEGORY_STAGE 完全重映射
 */

import type { SchemaType } from '../../schema';
import { getStageByCorruption, getStageTimeModifier } from '../../stageConfig';
import { isSuwenInAccelerationRoom } from './suwenRoutine';

/** 念头类型（新10大类 + 待判定） */
export type ThoughtCategoryValue =
  | '待判定'
  | '渐生依恋'
  | '情感依赖'
  | '触电感'
  | '玩火自焚'
  | '越界'
  | '身不由己'
  | '沦陷'
  | '身份瓦解'
  | '臣服'
  | '独占欲';

/** 类型对应的推荐阶段（用于算难度=相对当前阶段的跨度） */
const CATEGORY_STAGE: Record<Exclude<ThoughtCategoryValue, '待判定'>, number> = {
  渐生依恋: 1,
  情感依赖: 1,
  触电感: 2,
  玩火自焚: 2,
  越界: 3,
  身不由己: 3,
  沦陷: 4,
  身份瓦解: 3,
  臣服: 4,
  独占欲: 3,
};

/** 基础需要楼数（按难度） */
const FLOORS_BY_DIFFICULTY = {
  简单: 3,
  困难: 6,
};

/** 心防松动窗口：楼层 % 10 <= 3 即处于窗口（10-13楼、20-23楼…） */
export function isInVulnerableWindow(currentFloor: number): boolean {
  return currentFloor % 10 <= 3;
}

/**
 * 根据念头类型 + 角色当前阶段，计算难度和需要楼数
 */
export function calcDifficultyAndFloors(
  category: Exclude<ThoughtCategoryValue, '待判定'>,
  currentStage: number,
): { 难度: '简单' | '困难'; 需要楼数: number } {
  const catStage = CATEGORY_STAGE[category];
  const 难度: '简单' | '困难' = catStage <= currentStage ? '简单' : '困难';
  const 需要楼数 = FLOORS_BY_DIFFICULTY[难度];
  return { 难度, 需要楼数 };
}

/**
 * 检查越级是否被允许（心防松动窗口）
 * 返回有效阶段（用于判断该类型是否合法）
 */
function getEffectiveStage(data: SchemaType, currentFloor: number): number {
  const stage = data.秦璐状态.当前阶段;

  // 心防松动窗口：阶段+1，封顶4
  if (isInVulnerableWindow(currentFloor)) {
    return Math.min(stage + 1, 4);
  }

  return stage;
}

/**
 * 植入念头（前端调用入口）
 * 乐观植入：立即收下，状态=判定中，分配 ID
 */
export function implantThought(data: SchemaType, content: string, currentFloor: number): string {
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
  data.秦璐状态.念头列表[id] = thought;

  // 写入植入日志（ROLL 容错：待通知 AI）
  data.系统.念头植入日志.push({
    目标: '秦璐',
    念头ID: id,
    内容: content,
    植入楼层: currentFloor,
    已通知AI: false,
  });

  console.info(`[念头植入] 秦璐状态 植入 ${id}："${content}" → 判定中`);
  return id;
}

/**
 * AI 判定念头类型后，脚本处理：定难度、定需要楼数、判合格转培育中 / 不合格转未达标
 */
export function resolveThoughtType(
  data: SchemaType,
  thoughtId: string,
  category: ThoughtCategoryValue,
  currentFloor: number,
): void {
  const thought = data.秦璐状态.念头列表[thoughtId];
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
  const { 难度, 需要楼数 } = calcDifficultyAndFloors(category, data.秦璐状态.当前阶段);
  thought.类型 = category;
  thought.难度 = 难度;
  thought.需要楼数 = 需要楼数;

  // 检查是否合格（越级闸门）
  const effectiveStage = getEffectiveStage(data, currentFloor);
  const catStage = CATEGORY_STAGE[category];
  if (catStage <= effectiveStage) {
    // 合格 → 培育中
    thought.状态 = '培育中';
    console.info(`[念头判定] ${thoughtId} 类型=${category} 难度=${难度} 需${需要楼数}楼 → 培育中`);
  } else {
    // 不合格 → 未达标（可退回/保留）
    thought.状态 = '未达标';
    console.info(
      `[念头判定] ${thoughtId} 类型=${category} 越级(需阶段${catStage}，有效阶段${effectiveStage}) → 未达标`,
    );
  }
}

/**
 * 每楼推进念头培育进度（VARIABLE_UPDATE_ENDED 调用）
 * - 保底 +1 楼
 * - 苏文在加速房 → 额外加速
 * - 进度 >= 需要楼数 → 成熟
 */
export function tickThoughtProgress(data: SchemaType, currentFloor: number): void {
  const character = data.秦璐状态;
  const thoughts = character.念头列表;
  const accelerating = isSuwenInAccelerationRoom(data.系统._苏文作息游标);

  for (const [id, thought] of Object.entries(thoughts)) {
    if (thought.状态 !== '培育中') continue;

    // 保底 +1
    let progress = 1;
    // 苏文在加速房 → 额外 +0.5
    if (accelerating) {
      progress += 0.5;
    }
    // 秦璐警觉度 → 抵抗减速（0=不设防，100=完全戒备）
    const alert = character.对念头植入警觉度 ?? 0;
    progress *= 1 - alert / 100;
    // 阶段修正系数（越高阶段念头生长越快，已有字段，现接入）
    const stageMod = getStageTimeModifier(character.当前阶段);
    progress /= stageMod;

    thought.开发进度 += progress;
    console.info(
      `[念头培育] 秦璐状态 ${id} +${progress} (加速:${accelerating ? '是' : '否'}) → ${thought.开发进度}/${thought.需要楼数}`,
    );

    // 成熟判定
    if (thought.开发进度 >= thought.需要楼数) {
      matureThought(data, id, currentFloor);
    }
  }
}

/**
 * 念头成熟 → 转习惯 + 数值结算
 * - 沦陷度↑（困难更多）
 * - 对主角依存↑
 * - 对苏文依存↓（按对主角依存分档）
 * - 习惯上限 5，满了需玩家变卖腾位
 */
function matureThought(data: SchemaType, thoughtId: string, currentFloor: number): void {
  const character = data.秦璐状态;
  const thought = character.念头列表[thoughtId];
  if (!thought) return;

  // 习惯上限 5：满了不自动转，标记状态等界面变卖
  if (character.习惯列表.length >= 5) {
    thought.状态 = '已成熟' as any;
    console.info(`[念头成熟] 秦璐状态 ${thoughtId} 成熟但习惯已满5，待变卖腾位`);
    return;
  }

  // 转习惯
  character.习惯列表.push({
    内容: thought.内容,
    形成楼层: currentFloor,
  });

  // 数值结算
  const isHard = thought.难度 === '困难';
  character.沦陷度 += isHard ? 8 : 6;
  character.对主角依存度 += isHard ? 4 : 3;

  // 对苏文依存↓：按对主角依存分档
  const dep = character.对主角依存度;
  let suwenDecrease = -2;
  if (dep >= 80) suwenDecrease = -5;
  else if (dep >= 60) suwenDecrease = -4;
  else if (dep >= 30) suwenDecrease = -3;
  if (isHard) suwenDecrease = Math.floor(suwenDecrease * 1.2);
  character.对苏文依存度 += suwenDecrease;

  // 阶段更新（由沦陷度派生）
  const newStage = getStageByCorruption(character.沦陷度);
  if (newStage > character.当前阶段) {
    character.当前阶段 = newStage;
    console.info(`[念头成熟] 秦璐状态 阶段提升 → ${newStage}`);
  }

  // 删除已成熟的念头
  delete character.念头列表[thoughtId];

  console.info(
    `[念头成熟] 秦璐状态 "${thought.内容}" → 习惯 ` +
      `(沦陷度${character.沦陷度}, 主角依存${character.对主角依存度}, 苏文依存${character.对苏文依存度})`,
  );
}

/**
 * 变卖习惯换货币（前端界面调用）
 */
export function sellHabit(data: SchemaType, habitIndex: number): boolean {
  const character = data.秦璐状态;
  if (character.习惯列表.length < 5) {
    console.warn(`[习惯变卖] 秦璐状态 习惯未满5，不可出售`);
    return false;
  }
  if (habitIndex < 0 || habitIndex >= character.习惯列表.length) {
    console.warn(`[习惯变卖] 无效索引 ${habitIndex}`);
    return false;
  }

  const sold = character.习惯列表.splice(habitIndex, 1)[0];
  data.系统.货币 += 100;
  console.info(`[习惯变卖] 秦璐状态 出售"${sold.内容}" → 货币+100 (共${data.系统.货币})`);
  return true;
}

/**
 * 玩家退回未达标念头（删除）
 */
export function discardThought(data: SchemaType, thoughtId: string): void {
  const thought = data.秦璐状态.念头列表[thoughtId];
  if (thought && thought.状态 === '未达标') {
    delete data.秦璐状态.念头列表[thoughtId];
    console.info(`[念头退回] 秦璐状态 ${thoughtId} 已删除`);
  }
}
