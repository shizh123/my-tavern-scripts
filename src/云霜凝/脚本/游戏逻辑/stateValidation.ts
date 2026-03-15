import type { Schema as SchemaType } from '../../schema';
import { applyLockRetreat } from './shopSystem';

/**
 * 基于楼层号的确定性伪随机（防止重新生成绕过随机事件）
 * 同一楼层无论重新生成多少次，返回值相同（0~1）
 */
function seededRandom(floor: number): number {
  const x = Math.sin(floor * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * 状态自动计算与验证
 *
 * 每轮变量更新后执行：
 * 1. 治疗阶段 由 完成度 自动计算（每10点一档，阶段1-10）
 * 2. 苗广心态 由 疑心值 自动推算（但屈辱/默许/沉溺是特殊状态，保留不覆盖）
 * 3. 灵石里程碑发放（治疗阶段突破时一次性奖励）
 * 4. 锁值道具逻辑（寒心锁/破心锁/断情锁）
 * 5. 装备每轮数值效果
 */

/**
 * 由完成度计算治疗阶段（每10点一档，1-10）
 */
export function calcHealingStage(完成度: number): number {
  return Math.min(10, Math.max(1, Math.ceil(完成度 / 10)));
}

/**
 * 由疑心值推算苗广心态
 *
 * 前半程(疑心值): 0~25=正常, 25~50=疑惑, 50~70=察觉, 70+=愤怒(坏结局)
 * 后半程(绿帽值): 屈辱/默许/沉溺 由绿帽值自动推算
 *   0~40=屈辱, 40~75=默许, 75+=沉溺
 */
export function calcMiaoguangMind(疑心值: number, 当前心态: string): string {
  // 后半程：屈辱/默许/沉溺 由绿帽值（同变量）自动推算
  if (当前心态 === '屈辱' || 当前心态 === '默许' || 当前心态 === '沉溺') {
    if (疑心值 >= 75) return '沉溺';
    if (疑心值 >= 40) return '默许';
    return '屈辱';
  }

  // 前半程：疑心值驱动
  if (疑心值 >= 70) return '愤怒';
  if (疑心值 >= 50) return '察觉';
  if (疑心值 >= 25) return '疑惑';
  return '正常';
}

/**
 * 里程碑灵石奖励映射
 */
function getMilestoneReward(stage: number): number {
  if (stage <= 3) return 50;
  if (stage <= 6) return 100;
  return 200;
}

// ────────────────────────────────────────────
// 10. 楼层天花板 clamp 系统
// ────────────────────────────────────────────

/**
 * 楼层天花板表：30档（5楼一档，150楼完美结局）
 * 每档 [信任上限, 防线下限, 完成度上限, 身体开发上限]
 * 索引0 = 1-5楼, 索引1 = 6-10楼, ..., 索引29 = 146-150楼
 */
/**
 * S型慢热曲线（前慢→中快→后慢）
 *
 * 阶段1 冷启动 (1-25楼):    信任 8→17,   防线 95→85, 完成度≤10, 身体≤10  — 有感知的探索期
 * 阶段2 升温期 (26-55楼):   信任 20→40,  防线 80→60, 完成度≤35, 身体≤35  — 道具解锁，节奏加快
 * 阶段3 主推进 (56-110楼):  信任 45→83,  防线 55→16, 完成度≤88, 身体≤88  — 核心体验，最大变化
 * 阶段4 深入期 (111-140楼): 信任 86→99,  防线 13→1,  完成度≤99, 身体≤99  — 逐渐收尾
 * 阶段5 终局   (141-150楼): 信任 100,    防线 0,     完成度100, 身体100  — 完美结局
 */
const FLOOR_CEILING_TABLE: [number, number, number, number][] = [
  //       [信任, 防线, 完成度, 身体开发]
  // ── 阶段1：冷启动（1-25楼）──
  [8,  95,   3,  2],    // 1-5
  [10, 93,   5,  4],    // 6-10
  [12, 91,   6,  5],    // 11-15
  [14, 88,   8,  7],    // 16-20
  [17, 85,  10, 10],    // 21-25
  // ── 阶段2：升温期（26-55楼）──
  [20, 80,  14, 14],    // 26-30
  [24, 76,  18, 18],    // 31-35
  [28, 72,  22, 22],    // 36-40
  [32, 68,  26, 26],    // 41-45
  [36, 64,  30, 30],    // 46-50
  [40, 60,  35, 35],    // 51-55
  // ── 阶段3：主推进期（56-110楼）──
  [45, 55,  40, 40],    // 56-60
  [50, 50,  45, 45],    // 61-65
  [55, 45,  50, 50],    // 66-70
  [60, 40,  56, 56],    // 71-75
  [65, 35,  62, 62],    // 76-80
  [68, 32,  68, 68],    // 81-85
  [72, 28,  74, 74],    // 86-90
  [75, 25,  78, 78],    // 91-95
  [78, 22,  82, 82],    // 96-100
  [80, 19,  85, 85],    // 101-105
  [83, 16,  88, 88],    // 106-110
  // ── 阶段4：深入期（111-140楼）──
  [86, 13,  91, 91],    // 111-115
  [89, 10,  93, 93],    // 116-120
  [92,  7,  95, 95],    // 121-125
  [95,  4,  97, 97],    // 126-130
  [97,  2,  98, 98],    // 131-135
  [99,  1,  99, 99],    // 136-140
  // ── 阶段5：终局（141-150楼）──
  [100, 0, 100, 100],   // 141-145
  [100, 0, 100, 100],   // 146-150
];

/**
 * 根据当前楼层获取天花板
 * 楼层0或负数返回第一档，超过150返回最后一档
 */
export function getFloorCeiling(floor: number): {
  信任上限: number; 防线下限: number; 完成度上限: number; 身体开发上限: number;
} {
  const idx = Math.min(FLOOR_CEILING_TABLE.length - 1, Math.max(0, Math.ceil(floor / 5) - 1));
  const [trustMax, defMin, compMax, bodyMax] = FLOOR_CEILING_TABLE[idx];
  return { 信任上限: trustMax, 防线下限: defMin, 完成度上限: compMax, 身体开发上限: bodyMax };
}

/**
 * 执行一轮全量状态验证与自动计算
 * 在 VARIABLE_UPDATE_ENDED 中调用
 */
export function validateAndRecalcState(新变量: SchemaType, 旧变量: SchemaType, currentFloor?: number): void {
  // ── 0. 硬保护 ──────────────────────────────────────
  // 灵石：AI篡改无条件回滚，脚本重新计算
  新变量.系统.灵石 = 旧变量.系统.灵石;
  // 天数+小时：AI篡改无条件回滚，时间推进完全由脚本控制（在 VARIABLE_UPDATE_ENDED 中调用 advanceTimeFromText）
  新变量.时间.第几天 = 旧变量.时间.第几天;
  新变量.时间.当前小时 = 旧变量.时间.当前小时;

  // 三把锁现在是"每轮回退"而非"锁定"，不再还原数值
  // AI的数值变化正常应用，三把锁回退在阶段6单独执行

  // ── 1. 治疗阶段自动计算 ──────────────────────────
  const oldStage = 旧变量.治疗.阶段;
  const newStage = calcHealingStage(新变量.治疗.完成度);
  新变量.治疗.阶段 = newStage;

  // ── 2. 治疗阶段突破 → 里程碑灵石 ───────────────────
  if (newStage > oldStage) {
    for (let s = oldStage + 1; s <= newStage; s++) {
      const key = `阶段${s}`;
      if (!新变量._已发放里程碑灵石[key]) {
        const reward = getMilestoneReward(s);
        新变量.系统.灵石 += reward;
        新变量._已发放里程碑灵石[key] = true;
        console.info(`[状态验证] 阶段${s}突破！发放里程碑灵石 +${reward}，当前灵石: ${新变量.系统.灵石}`);
      }
    }
  }

  // ── 3. 苗广心态自动推算 ──────────────────────────
  // 阶段1保护：疑心值上限5，阶段1几乎冻结疑心增长
  if (新变量.治疗.阶段 <= 1 && 新变量.苗广.疑心值 > 5) {
    新变量.苗广.疑心值 = 5;
    console.info('[状态验证] 阶段1保护：疑心值上限5');
  }
  const oldMind = 旧变量.苗广.心态;
  新变量.苗广.心态 = calcMiaoguangMind(新变量.苗广.疑心值, 新变量.苗广.心态) as SchemaType['苗广']['心态'];
  const newMind = 新变量.苗广.心态;

  // ── 3b. 苗广心态进入新阶段 → 里程碑灵石 ──────────────
  if (newMind !== oldMind) {
    const mindMilestoneRewards: Partial<Record<SchemaType['苗广']['心态'], number>> = {
      疑惑: 30,
      察觉: 40,
      屈辱: 50,
      默许: 50,
      沉溺: 60,
    };
    const reward = mindMilestoneRewards[newMind];
    const key = `心态-${newMind}`;
    if (reward && !新变量._已发放苗广心态灵石[key]) {
      新变量.系统.灵石 += reward;
      新变量._已发放苗广心态灵石[key] = true;
      console.info(`[状态验证] 苗广心态→${newMind}，里程碑灵石 +${reward}，当前灵石: ${新变量.系统.灵石}`);
    }
  }

  // ── 4. 环境被动疑心/绿帽增长（每次治疗互动触发） ────
  // 治疗互动判定：云霜凝数值发生变化即算一次
  {
    let clampedTrust = 新变量.云霜凝.信任度;
    let clampedDefense = 新变量.云霜凝.心理防线;
    let clampedCompletion = 新变量.治疗.完成度;
    const clampedBody = {
      小嘴: 新变量.云霜凝.身体开发.小嘴,
      胸部: 新变量.云霜凝.身体开发.胸部,
      小屄: 新变量.云霜凝.身体开发.小屄,
      屁穴: 新变量.云霜凝.身体开发.屁穴,
    };
    if (currentFloor && currentFloor > 0) {
      const ceiling = getFloorCeiling(currentFloor);
      clampedTrust = Math.min(clampedTrust, ceiling.信任上限);
      clampedDefense = Math.max(clampedDefense, ceiling.防线下限);
      clampedCompletion = Math.min(clampedCompletion, ceiling.完成度上限);
      for (const part of ['小嘴', '胸部', '小屄', '屁穴'] as const) {
        clampedBody[part] = Math.min(clampedBody[part], ceiling.身体开发上限);
      }
    }

    // 只有治疗推进方向的变化才算治疗互动（信任↑、防线↓、完成度↑、身体开发↑）
    // 数值退步（AI随机波动等）不会引起苗广疑心
    const hasValueChange =
      clampedTrust > 旧变量.云霜凝.信任度 ||
      clampedDefense < 旧变量.云霜凝.心理防线 ||
      clampedCompletion > 旧变量.治疗.完成度 ||
      clampedBody.小嘴 > 旧变量.云霜凝.身体开发.小嘴 ||
      clampedBody.胸部 > 旧变量.云霜凝.身体开发.胸部 ||
      clampedBody.小屄 > 旧变量.云霜凝.身体开发.小屄 ||
      clampedBody.屁穴 > 旧变量.云霜凝.身体开发.屁穴;

    if (hasValueChange) {
      const items = 新变量.系统.道具状态;
      const 有隔音 = items['隔音灵阵'] === '使用中';
      const 有影绰 = items['影绰纱帘'] === '使用中';
      const 有透灵 = items['透灵幔'] === '使用中';

      const 心态 = 新变量.苗广.心态;
      const 是后半程 = 心态 === '屈辱' || 心态 === '默许' || 心态 === '沉溺';

      let increment = 0;

      if (是后半程) {
        // ── 后半程：绿帽值增长（主动推进苗广堕落）──
        if (有透灵 && 有隔音)       increment = 5;  // 看清一切但听不到
        else if (有透灵)             increment = 6;  // 看清一切+听到声音
        else if (有影绰 && 有隔音)   increment = 3;  // 只看到影子
        else if (有影绰)             increment = 4;  // 看到影子+听到声音
        else if (有隔音)             increment = 0;  // 什么都感知不到
        else                         increment = 1;  // 都不装

        // 服装暴露叠加加成
        const 暴露 = 新变量.云霜凝.服装.暴露程度;
        const exposureBonus: Record<string, number> = {
          '遮蔽': 0, '微露': 0, '轻露': 1, '半露': 2, '大露': 3, '极露': 4,
        };
        increment += exposureBonus[暴露] ?? 0;
      } else {
        // ── 前半程：疑心值增长（风险管理）──
        if (有隔音) {
          increment = 2;  // 隔音灵阵减弱但无法完全消除（灵力波动仍可感知）
        } else {
          increment = 5;  // 无遮蔽治疗：声音泄漏+灵力异常
        }

        // 服装暴露叠加（苗广进房查看时注意到）
        const 暴露 = 新变量.云霜凝.服装.暴露程度;
        if (暴露 === '半露') increment += 2;
        else if (暴露 === '大露' || 暴露 === '极露') increment += 3;
        else if (暴露 === '轻露') increment += 1;
        // 微露和遮蔽不加成
      }

      // 神魂空间减免：苗广无法感知神魂空间内的活动，增长大幅降低
      if (新变量._当前互动模式 === '神魂空间') {
        increment = Math.round(increment * 0.3);
      }

      if (increment > 0) {
        新变量.苗广.疑心值 = Math.min(100, 新变量.苗广.疑心值 + increment);
        console.info(`[状态验证] 治疗互动 → ${是后半程 ? '绿帽值' : '疑心值'} +${increment}${新变量._当前互动模式 === '神魂空间' ? '(神魂×0.3)' : ''} → ${新变量.苗广.疑心值}`);
      }
    }
  }

  // ── 4b. 蚀心露+隔音灵阵隐藏组合检测（察觉→屈辱，一次性）──
  // 此检测在 shopSystem.ts 消耗品处理时触发，此处做后备验证
  // 实际触发逻辑在 shopSystem.ts 的蚀心露效果中

  // ── 4c. 打断冻结逻辑已合并至第9节（硬回滚） ──

  // ── 5. 坏结局判断：愤怒（不可逆锁定，参考赵霞双重锁定机制） ────
  if (新变量._坏结局已触发) {
    // 已锁定：冻结所有治疗数值，防止回档后继续游戏
    新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度;
    新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线;
    新变量.治疗.完成度 = 旧变量.治疗.完成度;
    新变量.治疗.阶段 = 旧变量.治疗.阶段;
    新变量.苗广.心态 = '愤怒';
    新变量.苗广.疑心值 = 旧变量.苗广.疑心值;
    console.warn('[状态验证] ⚠️ 坏结局已锁定，所有数值冻结');
    return; // 跳过后续所有计算
  }
  if (新变量.苗广.心态 === '愤怒') {
    新变量._坏结局已触发 = true;
    // 注入坏结局事件
    const existing = 新变量._待发送道具事件;
    const event = '__坏结局_愤怒__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.warn('[状态验证] ⚠️ 苗广愤怒→坏结局触发！游戏锁死');
    return;
  }

  // ── 6. 身体开发幅度限制（脚本二次限制） ──────────────
  const MAX_BODY_DELTA = 8;
  const bodyParts = ['小嘴', '胸部', '小屄', '屁穴'] as const;
  for (const part of bodyParts) {
    const oldVal = 旧变量.云霜凝.身体开发[part];
    const newVal = 新变量.云霜凝.身体开发[part];
    if (newVal - oldVal > MAX_BODY_DELTA) {
      新变量.云霜凝.身体开发[part] = oldVal + MAX_BODY_DELTA;
      console.warn(`[状态验证] 身体开发.${part} 增幅过大，限制至 +${MAX_BODY_DELTA}`);
    }
  }

  // ── 6b. 核心数值单轮变化幅度限制（防止AI乱加数值） ──────
  // 注意：此限制包含了道具效果的合计变化，阈值设置宽松以容纳合法的道具+AI叠加
  // 三把锁不再锁定数值，所有幅度限制对所有情况生效
  {
    const trustDelta = 新变量.云霜凝.信任度 - 旧变量.云霜凝.信任度;
    const MAX_TRUST_DELTA = 10;
    if (trustDelta > MAX_TRUST_DELTA) {
      新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度 + MAX_TRUST_DELTA;
      console.warn(`[状态验证] 信任度增幅过大(+${trustDelta})，限制至 +${MAX_TRUST_DELTA}`);
    } else if (trustDelta < -MAX_TRUST_DELTA) {
      新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度 - MAX_TRUST_DELTA;
      console.warn(`[状态验证] 信任度降幅过大(${trustDelta})，限制至 -${MAX_TRUST_DELTA}`);
    }
  }
  {
    const defDelta = 新变量.云霜凝.心理防线 - 旧变量.云霜凝.心理防线;
    const MAX_DEF_DELTA = 15;
    if (defDelta > MAX_DEF_DELTA) {
      新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线 + MAX_DEF_DELTA;
      console.warn(`[状态验证] 心理防线增幅过大(+${defDelta})，限制至 +${MAX_DEF_DELTA}`);
    } else if (defDelta < -MAX_DEF_DELTA) {
      新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线 - MAX_DEF_DELTA;
      console.warn(`[状态验证] 心理防线降幅过大(${defDelta})，限制至 -${MAX_DEF_DELTA}`);
    }
  }
  {
    const suspDelta = 新变量.苗广.疑心值 - 旧变量.苗广.疑心值;
    const MAX_SUSP_DELTA = 20;
    if (suspDelta > MAX_SUSP_DELTA) {
      新变量.苗广.疑心值 = 旧变量.苗广.疑心值 + MAX_SUSP_DELTA;
      console.warn(`[状态验证] 疑心值增幅过大(+${suspDelta})，限制至 +${MAX_SUSP_DELTA}`);
    } else if (suspDelta < -MAX_SUSP_DELTA) {
      新变量.苗广.疑心值 = 旧变量.苗广.疑心值 - MAX_SUSP_DELTA;
      console.warn(`[状态验证] 疑心值降幅过大(${suspDelta})，限制至 -${MAX_SUSP_DELTA}`);
    }
  }
  {
    const compDelta = 新变量.治疗.完成度 - 旧变量.治疗.完成度;
    const MAX_COMP_DELTA = 2;
    if (compDelta > MAX_COMP_DELTA) {
      新变量.治疗.完成度 = 旧变量.治疗.完成度 + MAX_COMP_DELTA;
      console.warn(`[状态验证] 完成度增幅过大(+${compDelta})，限制至 +${MAX_COMP_DELTA}`);
    } else if (compDelta < -MAX_COMP_DELTA) {
      新变量.治疗.完成度 = 旧变量.治疗.完成度 - MAX_COMP_DELTA;
      console.warn(`[状态验证] 完成度降幅过大(${compDelta})，限制至 -${MAX_COMP_DELTA}`);
    }
  }

  // ── 7. 打断治疗概率判定（脚本驱动，单层掷骰） ────────
  // 阶段1免疫，阶段2+按阶段基础概率 + 疑心加成，cap 35%
  // 隔音灵阵 ×0.5，神魂空间 ×0.5
  // 使用楼层号做种子的确定性伪随机，防止玩家通过重新生成绕过打断
  // 冻结5楼 + 冷却10楼 = 冻结结束后玩家有10楼自由推进窗口（不回滚、不触发打断）
  {
    const INTERRUPT_COOLDOWN = 8; // 冻结结束后的安全窗口（楼层数）

    const hasValueChange =
      新变量.云霜凝.信任度 !== 旧变量.云霜凝.信任度 ||
      新变量.云霜凝.心理防线 !== 旧变量.云霜凝.心理防线 ||
      新变量.治疗.完成度 !== 旧变量.治疗.完成度;

    const 心态 = 新变量.苗广.心态;
    const 是前半程 = 心态 !== '屈辱' && 心态 !== '默许' && 心态 !== '沉溺';
    // 用旧阶段判定：必须上一轮已确认在阶段2+才可能被打断
    // 防止AI写的高完成度被天花板压回阶段1时误触发打断
    const stage = 旧变量.治疗.阶段;

    if (
      hasValueChange &&
      是前半程 &&
      stage >= 2 &&
      (currentFloor ?? 0) >= 新变量._打断冻结至楼层 + INTERRUPT_COOLDOWN
    ) {
      // 阶段基础概率
      const stageBase: Record<number, number> = { 2: 0.08, 3: 0.15, 4: 0.20, 5: 0.25 };
      let prob = stageBase[Math.min(stage, 5)] ?? 0.25;

      // 疑心值加成（加法制）
      if (新变量.苗广.疑心值 >= 50) prob += 0.10;
      else if (新变量.苗广.疑心值 >= 25) prob += 0.05;

      // cap 35%
      prob = Math.min(0.35, prob);

      // 道具修正（乘法）
      if (新变量.系统.道具状态['隔音灵阵'] === '使用中') prob *= 0.5;
      if (新变量._当前互动模式 === '神魂空间') prob *= 0.5;

      // 确定性伪随机：同一楼层重新生成结果不变
      const floor = currentFloor ?? 0;
      const roll = seededRandom(floor);
      if (roll < prob) {
        新变量._打断冻结至楼层 = floor + 4;
        let events = '';
        if (新变量._当前互动模式 === '神魂空间') {
          // 强制退出神魂空间：立即改变量，确保下一轮AI不会继续神魂空间剧情
          新变量._当前互动模式 = '日常';
          新变量._神魂空间激活中 = false;
          events = '__打断治疗_神魂__';
          console.warn(`[状态验证] ⚡ 神魂空间中被打断！已强制退出 + 打断治疗`);
        } else {
          events = '__打断治疗__';
        }
        const existing = 新变量._待发送道具事件;
        新变量._待发送道具事件 = existing ? existing + '|||' + events : events;
        console.warn(`[状态验证] ⚡ 打断治疗触发！概率${(prob * 100).toFixed(1)}%，掷骰${roll.toFixed(3)} < ${prob.toFixed(3)}（楼层种子）`);
      } else {
        console.info(`[状态验证] 打断治疗未触发：概率${(prob * 100).toFixed(1)}%，掷骰${roll.toFixed(3)} ≥ ${prob.toFixed(3)}（楼层种子）`);
      }
    }
  }

  // ── 8. 千晶幻术解锁条件验证 ───────────────────────
  if (新变量.苗广.千晶幻术.激活中 && 新变量.治疗.阶段 < 7) {
    新变量.苗广.千晶幻术.激活中 = false;
    console.warn('[状态验证] 千晶幻术未解锁（阶段<7），已强制关闭');
  }
  // 千晶幻术不再依赖苗广位置（位置已改为脚本驱动）

  // ── 8. 数值变化 → 灵石奖励（宽松经济，所有治疗相关数值变化都给灵石） ──────
  // 注：神魂空间解锁已移至 MESSAGE_RECEIVED 基于楼层触发
  {
    let totalReward = 0;
    const details: string[] = [];

    // 信任度变化（增减都算）
    const trustDelta = Math.abs(Math.floor(新变量.云霜凝.信任度 - 旧变量.云霜凝.信任度));
    if (trustDelta > 0) {
      const r = Math.min(15, Math.max(3, trustDelta * 3));
      totalReward += r;
      details.push(`信任Δ${trustDelta}→${r}`);
    }

    // 防线变化（增减都算）
    const defenseDelta = Math.abs(Math.floor(新变量.云霜凝.心理防线 - 旧变量.云霜凝.心理防线));
    if (defenseDelta > 0) {
      const r = Math.min(15, Math.max(3, defenseDelta * 2));
      totalReward += r;
      details.push(`防线Δ${defenseDelta}→${r}`);
    }

    // 完成度变化（增减都算）
    const compDelta = Math.abs(Math.floor(新变量.治疗.完成度 - 旧变量.治疗.完成度));
    if (compDelta > 0) {
      const r = Math.min(15, Math.max(3, compDelta * 3));
      totalReward += r;
      details.push(`完成度Δ${compDelta}→${r}`);
    }

    // 身体开发变化（增减都算）
    for (const part of ['小嘴', '胸部', '小屄', '屁穴'] as const) {
      const bodyDelta = Math.abs(Math.floor(新变量.云霜凝.身体开发[part] - 旧变量.云霜凝.身体开发[part]));
      if (bodyDelta > 0) {
        const r = Math.min(10, Math.max(2, bodyDelta * 2));
        totalReward += r;
        details.push(`${part}Δ${bodyDelta}→${r}`);
      }
    }

    if (totalReward > 0) {
      新变量.系统.灵石 += totalReward;
      console.info(`[状态验证] 数值变化灵石奖励 +${totalReward}（${details.join(', ')}），当前灵石: ${新变量.系统.灵石}`);
    }
  }

  // ── 8b. 每轮被动灵石收入（基础5 + 完成度加成） ──────────
  {
    const passiveIncome = 5 + Math.floor(新变量.治疗.完成度 / 10);
    新变量.系统.灵石 += passiveIncome;
    console.info(`[状态验证] 被动灵石 +${passiveIncome}（基础5 + 完成度加成${Math.floor(新变量.治疗.完成度 / 10)}），当前灵石: ${新变量.系统.灵石}`);
  }

  // ── 9. 打断冻结：纯楼层计时，到期自动解除 ──────────────────
  {
    const floor = currentFloor ?? 0;
    if (新变量._打断冻结至楼层 > 0 && floor > 0 && floor < 新变量._打断冻结至楼层) {
      // 冻结期间 → 回滚治疗数值
      新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度;
      新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线;
      新变量.治疗.完成度 = 旧变量.治疗.完成度;
      新变量.云霜凝.身体开发.小嘴 = 旧变量.云霜凝.身体开发.小嘴;
      新变量.云霜凝.身体开发.胸部 = 旧变量.云霜凝.身体开发.胸部;
      新变量.云霜凝.身体开发.小屄 = 旧变量.云霜凝.身体开发.小屄;
      新变量.云霜凝.身体开发.屁穴 = 旧变量.云霜凝.身体开发.屁穴;
      新变量.治疗.阶段 = calcHealingStage(新变量.治疗.完成度);
      console.warn(`[状态验证] 打断冻结中（剩余${新变量._打断冻结至楼层 - floor}楼），治疗数值已回滚`);
    }
  }

  // ── 9b. 三把锁每轮回退（信任-2/防线+3/完成度-0.5）──────
  applyLockRetreat(新变量);

  // ── 10. 天花板 clamp 已移至 applyFloorCeiling()，在所有效果之后最后执行 ──

  // ── 11. 地仙境突破剧情（阶段3+且现实互动中，一次性方式1注入） ──
  if (
    新变量.治疗.阶段 >= 3 &&
    新变量._当前互动模式 === '现实互动' &&
    !新变量._已发放里程碑灵石['地仙境突破']
  ) {
    新变量._已发放里程碑灵石['地仙境突破'] = true;
    const existing = 新变量._待发送道具事件;
    const event = '__地仙境突破__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info('[状态验证] 地仙境突破剧情触发！阶段3+且在现实互动中');
  }
}

/**
 * 楼层天花板 clamp（必须在所有数值效果之后最后执行）
 * 信任度不超过楼层上限，心理防线不低于楼层下限
 * 完成度不超过楼层上限，身体开发不超过楼层上限
 * 三把锁与天花板不冲突：三把锁往反方向拉（降信任/升防线），天花板限制正方向
 */
export function applyFloorCeiling(data: SchemaType, currentFloor: number): void {
  if (currentFloor <= 0) return;

  const ceiling = getFloorCeiling(currentFloor);

  if (data.云霜凝.信任度 > ceiling.信任上限) {
    console.info(`[天花板] 信任度 ${data.云霜凝.信任度} → ${ceiling.信任上限}（楼层${currentFloor}上限）`);
    data.云霜凝.信任度 = ceiling.信任上限;
  }
  if (data.云霜凝.心理防线 < ceiling.防线下限) {
    console.info(`[天花板] 心理防线 ${data.云霜凝.心理防线} → ${ceiling.防线下限}（楼层${currentFloor}下限）`);
    data.云霜凝.心理防线 = ceiling.防线下限;
  }
  if (data.治疗.完成度 > ceiling.完成度上限) {
    console.info(`[天花板] 完成度 ${data.治疗.完成度} → ${ceiling.完成度上限}（楼层${currentFloor}上限）`);
    data.治疗.完成度 = ceiling.完成度上限;
  }
  const bodyParts = ['小嘴', '胸部', '小屄', '屁穴'] as const;
  for (const part of bodyParts) {
    if (data.云霜凝.身体开发[part] > ceiling.身体开发上限) {
      console.info(`[天花板] ${part}开发 ${data.云霜凝.身体开发[part]} → ${ceiling.身体开发上限}（楼层${currentFloor}上限）`);
      data.云霜凝.身体开发[part] = ceiling.身体开发上限;
    }
  }
}

/**
 * 获取治疗阶段名称
 */
export function getHealingPhaseName(stage: number): string {
  const names = ['', '破冰', '初感', '温润', '渐通', '融合', '深化', '贯通', '共鸣', '圆融', '圆满'];
  return names[Math.min(10, Math.max(1, stage))] ?? '未知';
}

/**
 * 获取苗广疑心值阶段描述（前半程）
 */
export function getMiaoguangSuspicionStage(疑心值: number, 心态: string): string {
  // 后半程：绿帽值描述
  if (心态 === '屈辱' || 心态 === '默许' || 心态 === '沉溺') {
    if (疑心值 >= 75) return '沉溺';
    if (疑心值 >= 40) return '默许';
    return '屈辱';
  }
  // 前半程：疑心值描述
  if (疑心值 >= 70) return '愤怒';
  if (疑心值 >= 60) return '察觉深化';
  if (疑心值 >= 50) return '察觉';
  if (疑心值 >= 35) return '疑惑深化';
  if (疑心值 >= 25) return '疑惑';
  return '正常';
}

// ────────────────────────────────────────────
// 道具解锁条件（v2：支持多维条件）
// ────────────────────────────────────────────

interface UnlockCondition {
  阶段?: number;       // 治疗阶段 ≥
  防线?: number;       // 心理防线 ≤
  信任度?: number;     // 信任度 ≥
  胸部开发?: number;   // 胸部开发 ≥
  小屄开发?: number;   // 小屄开发 ≥
  屁穴开发?: number;   // 屁穴开发 ≥
  小嘴开发?: number;   // 小嘴开发 ≥
  苗广心态?: string[]; // 苗广心态 ∈
  装备任一?: string[]; // 任一装备处于"使用中"
  千晶幻术完成?: boolean; // 千晶幻术5次完成（认知改写完成）
}

const ITEM_UNLOCK_CONDITIONS: Record<string, UnlockCondition> = {
  // ── 消耗品 ──
  安神香: {},
  蚀心露: { 阶段: 3 },
  定心符: {},
  混沌珠: { 阶段: 4 },
  神魂共鸣石: { 阶段: 2 },

  // ── 装备：环境 ──
  锚神钉: {},
  影绰纱帘: { 阶段: 2 },
  透灵幔: { 阶段: 2 },
  隔音灵阵: { 阶段: 2 },
  净灵铃: { 阶段: 2 },

  // ── 装备：上装（Lv1=3, Lv2=4, Lv3=5, Lv4=7, Lv5=9）──
  素色道袍: { 阶段: 3 }, 宽领道袍: { 阶段: 3 },
  轻纱罩衫: { 阶段: 4 }, 露肩薄衫: { 阶段: 4 },
  交领短衫: { 阶段: 5 }, 肚兜: { 阶段: 5 },
  绑带胸衣: { 阶段: 7 }, 镂空纱衣: { 阶段: 7 },
  乳贴缎带: { 阶段: 9 }, 锁链胸饰: { 阶段: 9 },
  // ── 装备：下装 ──
  百褶长裙: { 阶段: 3 }, 开叉长裙: { 阶段: 3 },
  灵纱短裙: { 阶段: 4 }, 高开叉裙: { 阶段: 4 },
  灵纱超短裙: { 阶段: 5 }, 腰链遮片: { 阶段: 5 },
  系带围裙: { 阶段: 7 }, 透纱长裙: { 阶段: 7 },
  腰链吊坠: { 阶段: 9 }, 灵纱飘带: { 阶段: 9 },
  // ── 装备：内衣 ──
  丝绸抹胸: { 阶段: 3 }, 蕾丝胸衣: { 阶段: 3 },
  半杯胸衣: { 阶段: 4 }, 情趣胸衣: { 阶段: 4 },
  镂空胸衣: { 阶段: 5 }, 乳贴: { 阶段: 5 },
  透明胸纱: { 阶段: 7 }, 链式乳饰: { 阶段: 7 },
  乳环吊链: { 阶段: 9 }, 灵纹乳贴: { 阶段: 9 },
  // ── 装备：内裤 ──
  丝绸亵裤: { 阶段: 3 }, 蕾丝内裤: { 阶段: 3 },
  蝴蝶结系带裤: { 阶段: 4 }, 丁字裤: { 阶段: 4 },
  珍珠内裤: { 阶段: 5 }, 开裆内裤: { 阶段: 5 },
  系带丁字裤: { 阶段: 7 }, 透明蕾丝裤: { 阶段: 7 },
  链饰丁字裤: { 阶段: 9 }, 灵纹系带: { 阶段: 9 },
  // ── 装备：特殊配饰 ──
  脚链铃铛: { 阶段: 3 }, 红绳: { 阶段: 3 },
  大腿皮环: { 阶段: 4 }, 乳环挂饰: { 阶段: 4 },
  精液项链: { 阶段: 5 }, 阴蒂夹坠: { 阶段: 5 },
  名字阴环: { 阶段: 7 }, 精液耳坠: { 阶段: 7 },
  子宫纹章: { 阶段: 9 }, 双穴珠链: { 阶段: 9 },

  // ── 装备：身体器具（需阶段门槛：早期身体寒毒严重无法承受器具）──
  眼罩: { 阶段: 3, 防线: 70, 信任度: 15 },
  乳夹: { 阶段: 4, 防线: 65, 胸部开发: 40, 信任度: 25 },
  口枷: { 阶段: 4, 防线: 65, 小嘴开发: 40, 信任度: 25 },
  肛塞: { 阶段: 5, 防线: 60, 屁穴开发: 40, 信任度: 20 },
  缚灵缎: { 阶段: 4, 防线: 60, 信任度: 30 },
  震动器: { 阶段: 5, 防线: 50, 小屄开发: 50, 信任度: 35 },
  项圈: { 阶段: 7, 防线: 20, 信任度: 60 },
  肉棒口罩: { 阶段: 5, 小嘴开发: 40 },

  // ── 装备：辅助灵物 ──
  暖玉佩: {},
  寒心锁: { 阶段: 3 },
  破心锁: { 阶段: 3 },
  断情锁: { 阶段: 4 },

  // ── 永久体改 ──
  '丰胸灵乳丹·中': { 阶段: 3, 胸部开发: 30 },
  '丰胸灵乳丹·大': { 阶段: 4, 胸部开发: 50 },
  '丰胸灵乳丹·极': { 阶段: 6, 胸部开发: 70 },
  丰臀圆玉丹: { 阶段: 3, 屁穴开发: 30 },
  乳环: { 阶段: 4, 胸部开发: 40 },
  阴环: { 阶段: 4, 小屄开发: 40 },
  淫纹刻印: { 阶段: 4, 防线: 50 },
  堕落烙印: { 阶段: 6, 防线: 20 },

  // ── 永久性癖（设计文档第八节最终20个） ──
  阿黑颜体质: { 阶段: 3, 防线: 50 },
  潮喷体质: { 阶段: 4, 小屄开发: 60 },
  母乳体质: { 阶段: 4, 胸部开发: 50 },
  露出嗜好: { 阶段: 3, 防线: 50 },
  寝取快感: { 阶段: 5, 防线: 30, 苗广心态: ['察觉', '屈辱', '默许', '沉溺'] },
  哦齁齁体质: { 阶段: 5, 防线: 20 },
  骚话淫语: { 阶段: 4, 防线: 40 },
  隐奸行为: { 阶段: 4, 防线: 40, 苗广心态: ['疑惑', '察觉', '屈辱', '默许', '沉溺'] },
  尿饮嗜好: { 阶段: 5, 防线: 20, 小嘴开发: 40 },
  母爱泛滥: { 阶段: 4, 防线: 30 },
  舔肛嗜好: { 阶段: 4, 屁穴开发: 40, 防线: 40 },
  受虐嗜好: { 阶段: 4, 防线: 40 },
  精液标记: { 阶段: 4, 防线: 30 },
  口奴体质: { 阶段: 4, 小嘴开发: 50, 防线: 30 },
  肛交嗜好: { 阶段: 4, 屁穴开发: 50, 防线: 40 },
  物化认知: { 阶段: 6, 防线: 15 },
  痴女化: { 阶段: 5, 防线: 25 },
  身体书写: { 阶段: 4, 防线: 30 },
  窒息快感: { 阶段: 5, 防线: 30 },
  精液面膜: { 阶段: 4, 防线: 30 },

  // ── 留影石 ──
  留影石: { 阶段: 3 },

  // ── 千晶幻术 ──
  千晶幻术: { 阶段: 7, 苗广心态: ['屈辱', '默许', '沉溺'] },

  // ── 特殊场景 ──
  镜前调教: { 阶段: 4, 防线: 50 },
  夫前凌辱: { 阶段: 5, 苗广心态: ['屈辱', '默许', '沉溺'], 装备任一: ['影绰纱帘', '透灵幔'] },
  寝取宣告: { 阶段: 7, 苗广心态: ['默许', '沉溺'], 装备任一: ['透灵幔'] },
  绿帽奴调教: { 阶段: 8, 苗广心态: ['沉溺'] },
  掌门改嫁: { 阶段: 8, 苗广心态: ['沉溺'], 千晶幻术完成: true },
};

/**
 * 检查道具解锁条件
 */
export function canUnlockItem(itemName: string, data: SchemaType): boolean {
  const cond = ITEM_UNLOCK_CONDITIONS[itemName];
  if (!cond) return true; // 未注册的道具默认可用

  if (cond.阶段 !== undefined && data.治疗.阶段 < cond.阶段) return false;
  if (cond.防线 !== undefined && data.云霜凝.心理防线 > cond.防线) return false;
  if (cond.信任度 !== undefined && data.云霜凝.信任度 < cond.信任度) return false;
  if (cond.胸部开发 !== undefined && data.云霜凝.身体开发.胸部 < cond.胸部开发) return false;
  if (cond.小屄开发 !== undefined && data.云霜凝.身体开发.小屄 < cond.小屄开发) return false;
  if (cond.屁穴开发 !== undefined && data.云霜凝.身体开发.屁穴 < cond.屁穴开发) return false;
  if (cond.小嘴开发 !== undefined && data.云霜凝.身体开发.小嘴 < cond.小嘴开发) return false;
  if (cond.苗广心态 !== undefined && !cond.苗广心态.includes(data.苗广.心态)) return false;
  if (cond.装备任一 !== undefined) {
    const hasAny = cond.装备任一.some(name => data.系统.道具状态[name] === '使用中');
    if (!hasAny) return false;
  }
  if (cond.千晶幻术完成 && !data.苗广.千晶幻术.认知改写完成) return false;

  return true;
}

/**
 * 获取道具解锁条件描述文本（UI显示用）
 */
export function getUnlockDescription(itemName: string): string {
  const cond = ITEM_UNLOCK_CONDITIONS[itemName];
  if (!cond) return '';

  const parts: string[] = [];
  if (cond.阶段 !== undefined) parts.push(`阶段≥${cond.阶段}`);
  if (cond.防线 !== undefined) parts.push(`防线≤${cond.防线}`);
  if (cond.信任度 !== undefined) parts.push(`信任度≥${cond.信任度}`);
  if (cond.胸部开发 !== undefined) parts.push(`胸部开发≥${cond.胸部开发}`);
  if (cond.小屄开发 !== undefined) parts.push(`小屄开发≥${cond.小屄开发}`);
  if (cond.屁穴开发 !== undefined) parts.push(`屁穴开发≥${cond.屁穴开发}`);
  if (cond.小嘴开发 !== undefined) parts.push(`小嘴开发≥${cond.小嘴开发}`);
  if (cond.苗广心态 !== undefined) parts.push(`苗广心态∈[${cond.苗广心态.join('/')}]`);
  if (cond.装备任一 !== undefined) parts.push(`需装备[${cond.装备任一.join('/')}]之一`);
  if (cond.千晶幻术完成) parts.push('千晶幻术完成');

  return parts.length > 0 ? parts.join('，') : '无';
}

// ────────────────────────────────────────────
// 道具价格表（v2）
// ────────────────────────────────────────────

export const ITEM_PRICE: Record<string, number> = {
  // 消耗品
  安神香: 30,
  蚀心露: 80,
  定心符: 25,
  混沌珠: 80,
  神魂共鸣石: 50,

  // 装备：环境
  锚神钉: 40,
  影绰纱帘: 50,
  透灵幔: 80,
  隔音灵阵: 30,
  净灵铃: 60,

  // 装备：上装
  素色道袍: 8, 宽领道袍: 12, 轻纱罩衫: 18, 露肩薄衫: 25, 交领短衫: 35,
  肚兜: 45, 绑带胸衣: 60, 镂空纱衣: 75, 乳贴缎带: 90, 锁链胸饰: 110,
  // 装备：下装
  百褶长裙: 8, 开叉长裙: 12, 灵纱短裙: 18, 高开叉裙: 25, 灵纱超短裙: 35,
  腰链遮片: 45, 系带围裙: 60, 透纱长裙: 75, 腰链吊坠: 90, 灵纱飘带: 110,
  // 装备：内衣
  丝绸抹胸: 8, 蕾丝胸衣: 12, 半杯胸衣: 18, 情趣胸衣: 25, 镂空胸衣: 35,
  乳贴: 45, 透明胸纱: 60, 链式乳饰: 75, 乳环吊链: 90, 灵纹乳贴: 110,
  // 装备：内裤
  丝绸亵裤: 8, 蕾丝内裤: 12, 蝴蝶结系带裤: 18, 丁字裤: 25, 珍珠内裤: 35,
  开裆内裤: 45, 系带丁字裤: 60, 透明蕾丝裤: 75, 链饰丁字裤: 90, 灵纹系带: 110,
  // 装备：特殊配饰
  脚链铃铛: 10, 红绳: 15, 大腿皮环: 22, 乳环挂饰: 30, 精液项链: 40,
  阴蒂夹坠: 50, 名字阴环: 65, 精液耳坠: 85, 子宫纹章: 100, 双穴珠链: 120,

  // 装备：身体器具
  乳夹: 50,
  肛塞: 60,
  震动器: 80,
  口枷: 55,
  缚灵缎: 70,
  眼罩: 45,
  项圈: 90,
  肉棒口罩: 350,

  // 装备：辅助灵物
  暖玉佩: 10,
  寒心锁: 60,
  破心锁: 60,
  断情锁: 80,

  // 永久体改
  '丰胸灵乳丹·中': 150,
  '丰胸灵乳丹·大': 250,
  '丰胸灵乳丹·极': 400,
  丰臀圆玉丹: 200,
  乳环: 300,
  阴环: 300,
  淫纹刻印: 250,
  堕落烙印: 500,

  // 永久性癖（设计文档第八节最终20个）
  阿黑颜体质: 300,
  潮喷体质: 400,
  母乳体质: 350,
  露出嗜好: 300,
  寝取快感: 500,
  哦齁齁体质: 500,
  骚话淫语: 300,
  隐奸行为: 400,
  尿饮嗜好: 350,
  母爱泛滥: 300,
  舔肛嗜好: 350,
  受虐嗜好: 350,
  精液标记: 300,
  口奴体质: 350,
  肛交嗜好: 350,
  物化认知: 500,
  痴女化: 400,
  身体书写: 300,
  窒息快感: 400,
  精液面膜: 300,

  // 留影石
  留影石: 60,

  // 特殊场景
  镜前调教: 400,
  夫前凌辱: 600,
  寝取宣告: 800,
  绿帽奴调教: 900,
  掌门改嫁: 1000,
};

// 兼容旧接口：保留 ITEM_MIN_STAGE 映射（从 ITEM_UNLOCK_CONDITIONS 自动生成）
export const ITEM_MIN_STAGE: Record<string, number> = {};
for (const [name, cond] of Object.entries(ITEM_UNLOCK_CONDITIONS)) {
  ITEM_MIN_STAGE[name] = cond.阶段 ?? 1;
}

export function canUseItem(itemName: string, data: SchemaType): boolean {
  return canUnlockItem(itemName, data);
}
