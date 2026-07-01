/**
 * 苏文位置引擎 — 楼层驱动的黑盒生活节律
 *
 * 设计（见 设计文档/苏文系统.md §四）：
 * - 楼层 = 时间流逝：玩家每推进一楼，苏文位置随之变化
 * - 黑盒、不告知：楼层→位置的映射原理是脚本内部的事，不告诉玩家、不告诉 AI
 * - 模板循环游标：按作息模板一段段走，走完循环下一天
 * - 关键词跳转：检测玩家输入"第二天/几日后"等，重置游标到对应段
 * - 每段至少停留 2 楼
 *
 * 追踪：使用 系统._苏文作息游标 记录已推进的楼层基准（绝对楼层）。
 */

import type { SchemaType } from '../../schema';

/** 苏文在家时的活动状态 */
export type SuwenStatusValue = '在家' | '外出' | '睡眠';

/** 一个作息模板段 */
interface RoutineSegment {
  状态: SuwenStatusValue;
  位置: string;
  楼数: number;
}

/**
 * 工作日模板（有班）
 * 周一二四用此模板
 */
const WORKDAY_ROUTINE: RoutineSegment[] = [
  { 状态: '在家', 位置: '主卧', 楼数: 2 }, // 起床洗漱
  { 状态: '外出', 位置: '外面', 楼数: 7 }, // 上班（安全期）
  { 状态: '在家', 位置: '餐厅', 楼数: 2 }, // 晚饭
  { 状态: '在家', 位置: '客厅', 楼数: 3 }, // 看电视
  { 状态: '睡眠', 位置: '主卧', 楼数: 2 },
];

/**
 * 在家日模板（周末 / 半天班在家段）
 * 周六日用此模板
 */
const HOME_DAY_ROUTINE: RoutineSegment[] = [
  { 状态: '睡眠', 位置: '主卧', 楼数: 2 }, // 赖床
  { 状态: '在家', 位置: '餐厅', 楼数: 2 }, // 早午饭
  { 状态: '在家', 位置: '客厅', 楼数: 3 },
  { 状态: '在家', 位置: '厨房', 楼数: 2 }, // 走动
  { 状态: '在家', 位置: '客厅', 楼数: 3 },
  { 状态: '睡眠', 位置: '主卧', 楼数: 3 },
];

/**
 * 周三：上午外出，下午在家（意外刺激窗口）
 * 上午段按工作日，下午段改在家
 */
const WEDNESDAY_ROUTINE: RoutineSegment[] = [
  { 状态: '在家', 位置: '主卧', 楼数: 2 },
  { 状态: '外出', 位置: '外面', 楼数: 5 }, // 上午上班
  { 状态: '在家', 位置: '餐厅', 楼数: 2 }, // 下午回家晚饭
  { 状态: '在家', 位置: '客厅', 楼数: 3 }, // 下午在家（意外）
  { 状态: '在家', 位置: '客厅', 楼数: 2 }, // 晚上继续
  { 状态: '睡眠', 位置: '主卧', 楼数: 2 },
];

/**
 * 周五：上午在家，下午外出
 */
const FRIDAY_ROUTINE: RoutineSegment[] = [
  { 状态: '在家', 位置: '主卧', 楼数: 2 },
  { 状态: '在家', 位置: '餐厅', 楼数: 2 }, // 上午在家
  { 状态: '在家', 位置: '客厅', 楼数: 3 }, // 上午在家（意外）
  { 状态: '外出', 位置: '外面', 楼数: 5 }, // 下午上班
  { 状态: '在家', 位置: '餐厅', 楼数: 2 }, // 晚饭
  { 状态: '睡眠', 位置: '主卧', 楼数: 2 },
];

/** 一周七天的模板序列（索引 0=周一 … 6=周日） */
const WEEK_ROUTINES: RoutineSegment[][] = [
  WORKDAY_ROUTINE, // 周一
  WORKDAY_ROUTINE, // 周二
  WEDNESDAY_ROUTINE, // 周三
  WORKDAY_ROUTINE, // 周四
  FRIDAY_ROUTINE, // 周五
  HOME_DAY_ROUTINE, // 周六
  HOME_DAY_ROUTINE, // 周日
];

/** 一周的总楼数（用于游标取模定位星期） */
const WEEK_TOTAL_FLOORS = WEEK_ROUTINES.reduce(
  (sum, routine) => sum + routine.reduce((s, seg) => s + seg.楼数, 0),
  0,
);

/** 关键词跳转目标段（重置游标） */
interface JumpTarget {
  关键词: string[];
  偏移: number; // 相对当前一周开始的楼层偏移
}

/** 简单跳转词表（待细化） */
const JUMP_KEYWORDS: JumpTarget[] = [
  { 关键词: ['第二天', '第二日', '明天', '次日'], 偏移: -1 }, // 跳到下一天开头（特殊处理）
  { 关键词: ['第二天早上', '次日清晨', '第二天早晨'], 偏移: -1 },
  { 关键词: ['第二天晚上', '次日晚上'], 偏移: -1 },
];

/**
 * 计算游标在一周内的位置
 * @param cursor 绝对楼层游标
 * @returns { dayIndex: 星期几(0-6), segmentIndex: 当天第几段, segmentFloorOffset: 当前段内已走的楼数 }
 */
function locateCursor(cursor: number): {
  dayIndex: number;
  segmentIndex: number;
  segmentFloorOffset: number;
} {
  const relFloor = ((cursor % WEEK_TOTAL_FLOORS) + WEEK_TOTAL_FLOORS) % WEEK_TOTAL_FLOORS;
  let remaining = relFloor;
  let dayIndex = 0;
  for (let d = 0; d < WEEK_ROUTINES.length; d++) {
    const routine = WEEK_ROUTINES[d];
    const dayTotal = routine.reduce((s, seg) => s + seg.楼数, 0);
    if (remaining < dayTotal) {
      dayIndex = d;
      let segOffset = remaining;
      for (let s = 0; s < routine.length; s++) {
        if (segOffset < routine[s].楼数) {
          return { dayIndex: d, segmentIndex: s, segmentFloorOffset: segOffset };
        }
        segOffset -= routine[s].楼数;
      }
      return { dayIndex: d, segmentIndex: routine.length - 1, segmentFloorOffset: 0 };
    }
    remaining -= dayTotal;
  }
  // 兜底
  return { dayIndex: 0, segmentIndex: 0, segmentFloorOffset: 0 };
}

/**
 * 根据游标获取苏文当前状态/位置
 */
export function getSuwenPosition(cursor: number): { 状态: SuwenStatusValue; 位置: string } {
  const { dayIndex, segmentIndex } = locateCursor(cursor);
  const segment = WEEK_ROUTINES[dayIndex][segmentIndex];
  return { 状态: segment.状态, 位置: segment.位置 };
}

/**
 * 检测玩家输入是否含跳转关键词，返回应跳转到的游标（null=无跳转）
 * "第二天"类：跳到下一天开头
 */
export function detectJump(playerInput: string, currentCursor: number): number | null {
  const text = playerInput;
  for (const target of JUMP_KEYWORDS) {
    for (const kw of target.关键词) {
      if (text.includes(kw)) {
        // 跳到下一天开头：找到当前天在周内的结束位置
        const { dayIndex } = locateCursor(currentCursor);
        // 计算下一天开始的绝对游标
        const weekStart = Math.floor(currentCursor / WEEK_TOTAL_FLOORS) * WEEK_TOTAL_FLOORS;
        let nextDayStart = weekStart;
        for (let d = 0; d <= dayIndex; d++) {
          nextDayStart += WEEK_ROUTINES[d].reduce((s, seg) => s + seg.楼数, 0);
        }
        return nextDayStart;
      }
    }
  }
  return null;
}

/**
 * 判断苏文是否在加速房间（餐厅/客厅/主卧）
 * 见 设计文档/苏文系统.md §2.1：只看苏文位置，女角色位置不参与
 */
export function isSuwenInAccelerationRoom(cursor: number): boolean {
  const { 位置 } = getSuwenPosition(cursor);
  return 位置 === '餐厅' || 位置 === '客厅' || 位置 === '主卧';
}

/**
 * 判断苏文是否在家（非外出、非睡眠算在家）
 */
export function isSuwenHome(cursor: number): boolean {
  const { 状态 } = getSuwenPosition(cursor);
  return 状态 === '在家';
}

/**
 * 主推进函数：根据当前楼层更新苏文位置游标
 * 应在 VARIABLE_UPDATE_ENDED 调用（AI 回复后的写阶段）
 *
 * @param data MVU 数据（会被直接修改）
 * @param currentFloor 当前消息楼层 ID
 * @param playerInput 玩家本轮输入文本（用于检测跳转关键词）
 */
export function advanceSuwenRoutine(
  data: SchemaType,
  currentFloor: number,
  playerInput: string,
): void {
  const sys = data.系统;
  const lastFloor = sys._上次处理楼层;

  // 防同楼重复推进（ROLL 保护）
  if (currentFloor === lastFloor) {
    console.info(`[苏文作息] 楼层 ${currentFloor} 与上次相同，跳过游标推进`);
  } else {
    // 检测跳转
    const jumpTarget = detectJump(playerInput, sys._苏文作息游标);
    if (jumpTarget !== null) {
      sys._苏文作息游标 = jumpTarget;
      console.info(`[苏文作息] 检测到跳转关键词，游标跳至 ${jumpTarget}`);
    } else {
      // 正常推进一楼
      sys._苏文作息游标 += 1;
    }
    sys._上次处理楼层 = currentFloor;
  }

  // 根据游标算出苏文状态/位置，写入变量
  const { 状态, 位置 } = getSuwenPosition(sys._苏文作息游标);
  data.苏文状态.当前状态 = 状态;
  data.苏文状态.当前位置 = 位置 as any;

  console.info(
    `[苏文作息] 游标=${sys._苏文作息游标} → 苏文${状态}@${位置}` +
      (isSuwenInAccelerationRoom(sys._苏文作息游标) ? ' [加速房]' : ''),
  );
}
