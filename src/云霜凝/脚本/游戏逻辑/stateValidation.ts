import type { Schema as SchemaType } from '../../schema';
import { isSkipPhaseGuide } from './index';

/** 道具系统 v2 (2.0.20)：清零所有 4 个分阶段引导延后字段（打断/坏结局/手动重置场景使用） */
function clearAllPhaseDelays(d: SchemaType): void {
  d._千晶引导延后楼数 = 0;
  d._孝敬引导延后楼数 = 0;
  d._特殊场景引导延后楼数 = 0;
  d._洛书晴激活引导延后楼数 = 0;
}

/** 上次疑心值增长的楼层（防止重新生成时重复叠加） */
let _lastSuspicionFloor = -1;

/** 上次打断惩罚疑心值涨的楼层（防止打断楼 reroll 累加导致快速 GG） */
let _lastInterruptFloor = -1;

/** 上次苗喧绝望值被动涨的楼层 */
let _lastMiaoXuanPassiveFloor = -1;
/** 上次苗喧压抑值涨的楼层 */
let _lastMiaoXuanPressureFloor = -1;

/** 冻结期间是否有治疗尝试（冻结开始时重置，结束时判定奖励） */
let _freezeHadTreatmentAttempt = false;
/** 冻结结束奖励是否已发放（防止重roll重复发放） */
let _freezeRewardGiven = false;

/**
 * 硬保护快照类型
 *
 * 在 CHAT_COMPLETION_PROMPT_READY 从最新消息捕获（包含前端写入），
 * 作为 VARIABLE_UPDATE_ENDED 中硬保护的回滚基准。
 * 比旧变量更可靠——旧变量可能是新消息的默认值，不含前端修改。
 */
export interface ProtectionSnapshot {
  灵石: number;
  神魂空间已解锁: boolean;
  神魂空间已进入过: boolean;
  当前互动模式: string;
  神魂空间激活中: boolean;
  疑心值: number;
  心态: string;
  已触发蚀心露屈辱: boolean;
  服装: {
    上装: string;
    下装: string;
    内衣: string;
    内裤: string;
    特殊配饰: {
      脚踝: string;
      颈部: string;
      耳部: string;
      腰部: string;
      大腿: string;
      胸部: string;
      阴蒂: string;
      前后穴: string;
    };
    暴露程度: string;
  };
  道具状态: Record<string, string>;
}

/**
 * 打断冻结基线：打断触发时捕获治疗数值，冻结期间用作回滚基准。
 * MESSAGE_RECEIVED 中更新，冻结结束时清除。
 */
export interface FreezeBaseline {
  信任度: number;
  心理防线: number;
  完成度: number;
  身体开发: { 小嘴: number; 胸部: number; 小屄: number; 屁穴: number };
}

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
/**
 * 由绝望值推算苗喧心态
 *
 * 0-15=蔑视, 16-30=困惑, 31-50=不安, 51-70=恐惧, 71-90=崩溃, 91-100=失去
 */
export function calcMiaoxuanMind(绝望值: number): '蔑视' | '困惑' | '不安' | '恐惧' | '崩溃' | '失去' {
  if (绝望值 >= 91) return '失去';
  if (绝望值 >= 71) return '崩溃';
  if (绝望值 >= 51) return '恐惧';
  if (绝望值 >= 31) return '不安';
  if (绝望值 >= 16) return '困惑';
  return '蔑视';
}

/**
 * 洛书晴阶段边界表（防线下限 + 顺从上限，刚好等于下一阶段跳转门槛）
 */
export function getLuoStageBound(stage: number): { 防线下限: number; 顺从上限: number } {
  const bounds: Record<number, { 防线下限: number; 顺从上限: number }> = {
    1: { 防线下限: 90, 顺从上限: 10 },
    2: { 防线下限: 80, 顺从上限: 20 },
    3: { 防线下限: 70, 顺从上限: 30 },
    4: { 防线下限: 60, 顺从上限: 40 },
    5: { 防线下限: 50, 顺从上限: 50 },
    6: { 防线下限: 40, 顺从上限: 60 },
    7: { 防线下限: 30, 顺从上限: 70 },
    8: { 防线下限: 20, 顺从上限: 80 },
    9: { 防线下限: 10, 顺从上限: 90 },
    10: { 防线下限: 0, 顺从上限: 100 },
  };
  return bounds[Math.max(1, Math.min(10, Math.floor(stage)))] ?? bounds[1];
}

/**
 * 洛书晴阶段跳转条件（当前阶段 → 下一阶段需要：防线≤X, 顺从≥Y, 云霜凝阶段≥Z）
 * 阶段10 无跳转
 */
export function getLuoStageJumpRequirement(
  fromStage: number,
): { 防线上限: number; 顺从下限: number; 云霜凝阶段下限: number } | null {
  const table: Record<number, { 防线上限: number; 顺从下限: number; 云霜凝阶段下限: number }> = {
    1: { 防线上限: 90, 顺从下限: 10, 云霜凝阶段下限: 1 },
    2: { 防线上限: 80, 顺从下限: 20, 云霜凝阶段下限: 4 },
    3: { 防线上限: 70, 顺从下限: 30, 云霜凝阶段下限: 5 },
    4: { 防线上限: 60, 顺从下限: 40, 云霜凝阶段下限: 6 },
    5: { 防线上限: 50, 顺从下限: 50, 云霜凝阶段下限: 7 },
    6: { 防线上限: 40, 顺从下限: 60, 云霜凝阶段下限: 7 },
    7: { 防线上限: 30, 顺从下限: 70, 云霜凝阶段下限: 8 },
    8: { 防线上限: 20, 顺从下限: 80, 云霜凝阶段下限: 9 },
    9: { 防线上限: 10, 顺从下限: 90, 云霜凝阶段下限: 10 },
  };
  return table[fromStage] ?? null;
}

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
 * 2.0.18 经济调整：全部翻倍（50/100/200 → 100/200/400）
 */
function getMilestoneReward(stage: number): number {
  if (stage <= 3) return 100;
  if (stage <= 6) return 200;
  return 400;
}

/**
 * 特殊场景的在场女角色映射表
 * 只追踪云霜凝和洛书晴，用于驱动 buildStatusSnapshot 的注入过滤
 * 特殊场景进行中时脚本强制锁定该字段，AI 修改会被回滚
 */
export const SCENE_ACTORS: Record<string, { 云霜凝: boolean; 洛书晴: boolean }> = {
  // 云霜凝独占场景
  镜前调教: { 云霜凝: true, 洛书晴: false },
  夫前凌辱: { 云霜凝: true, 洛书晴: false },
  寝取宣告: { 云霜凝: true, 洛书晴: false },
  绿帽奴调教: { 云霜凝: true, 洛书晴: false },
  掌门改嫁: { 云霜凝: true, 洛书晴: false },
  // 洛书晴联动场景（双人在场）
  婆媳教导: { 云霜凝: true, 洛书晴: true },
  两人同侍: { 云霜凝: true, 洛书晴: true },
  寝取宣告增强: { 云霜凝: true, 洛书晴: true },
  门缝春光: { 云霜凝: true, 洛书晴: true },
  双重目击: { 云霜凝: true, 洛书晴: true },
  儿媳调教公公: { 云霜凝: true, 洛书晴: true },
  双重改嫁: { 云霜凝: true, 洛书晴: true },
  千晶告知洛书晴: { 云霜凝: true, 洛书晴: true },
  // 真相揭露场景: 云霜凝独自念笔记给玩家, 洛书晴不在场(明确不登记)
  未知: { 云霜凝: true, 洛书晴: false },
  // 后日谈: 苗喧视角场景, 云/洛作为背景出现(轮3/5/6),登记在场让 snapshot 注入她们的现状数据
  苗喧的一日: { 云霜凝: true, 洛书晴: true },
  // 脚本内部触发的自动场景
  洛书晴现实初遇: { 云霜凝: true, 洛书晴: true },
};

/**
 * 执行一轮全量状态验证与自动计算
 * 在 VARIABLE_UPDATE_ENDED 中调用
 *
 * 每轮变量更新后执行：
 * 1. 治疗阶段 由 完成度 自动计算
 * 2. 苗广心态 由 疑心值 自动推算（屈辱/默许/沉溺是特殊状态，保留不覆盖）
 * 3. 灵石里程碑发放（治疗阶段突破时一次性奖励）
 * 4. 装备每轮数值效果
 */
export function validateAndRecalcState(
  新变量: SchemaType,
  旧变量: SchemaType,
  currentFloor?: number,
  snapshot?: ProtectionSnapshot | null,
  freezeBaseline?: FreezeBaseline | null,
): FreezeBaseline | null {
  // ── 0. 硬保护 ──────────────────────────────────────
  // 使用 PROMPT_READY 捕获的快照作为基准（包含前端写入：灵石扣款、模式切换等）。
  // 旧变量可能是新消息的默认值，不含前端修改，导致前端操作被回滚。
  // 无快照时降级使用旧变量（首次加载/重新生成等边界情况）。
  const base = snapshot
    ? {
        灵石: snapshot.灵石,
        神魂空间已解锁: snapshot.神魂空间已解锁,
        神魂空间已进入过: snapshot.神魂空间已进入过,
        当前互动模式: snapshot.当前互动模式,
        神魂空间激活中: snapshot.神魂空间激活中,
        疑心值: snapshot.疑心值,
        心态: snapshot.心态,
        已触发蚀心露屈辱: snapshot.已触发蚀心露屈辱,
        服装: { ...snapshot.服装 },
        道具状态: { ...snapshot.道具状态 },
      }
    : {
        灵石: 旧变量.系统.灵石,
        神魂空间已解锁: 旧变量._神魂空间已解锁,
        神魂空间已进入过: 旧变量._神魂空间已进入过,
        当前互动模式: 旧变量._当前互动模式,
        神魂空间激活中: 旧变量._神魂空间激活中,
        疑心值: 旧变量.苗广.疑心值,
        心态: 旧变量.苗广.心态,
        已触发蚀心露屈辱: 旧变量._已触发蚀心露屈辱,
        服装: { ...旧变量.云霜凝.服装 },
        道具状态: { ...旧变量.系统.道具状态 },
      };

  // 灵石：回滚到快照值（包含前端购买扣款），脚本在后续步骤中叠加奖励
  新变量.系统.灵石 = base.灵石;
  // 时间.玄霜历：AI 通过 SET 命令自由更新，脚本不冻结
  // 脚本管理字段：AI不得修改，回滚到快照值（前端按钮/脚本控制）
  // 一次性 boolean 用 OR 逻辑：快照可能因 MVU 传播延迟而丢失前端写入，
  // 只要任一来源（快照/旧变量/AI写入）为 true，就保持 true 不可逆
  新变量._神魂空间已解锁 = base.神魂空间已解锁 || 旧变量._神魂空间已解锁 || 新变量._神魂空间已解锁;
  新变量._神魂空间已进入过 = base.神魂空间已进入过 || 旧变量._神魂空间已进入过 || 新变量._神魂空间已进入过;
  新变量._当前互动模式 = base.当前互动模式 as SchemaType['_当前互动模式'];
  新变量._神魂空间激活中 = base.神魂空间激活中;
  // 疑心值：脚本全权管理（被动增长在后续步骤中计算），AI不得修改
  新变量.苗广.疑心值 = base.疑心值;
  // 2.0.32: _坏结局已触发 AI 保护——脚本全权管理,AI 不得主动写入。
  //   单向锁:由下方 line 577 根据心态='愤怒'(疑心≥70)自动置 true;一旦 true 不可被 AI 改 false。
  //   历史 bug: AI 读到 prompt 里"愤怒不可逆/游戏结束" 误解, 直接写 _坏结局已触发=true,
  //   line 566 "已锁"分支匹配 → 强制心态='愤怒' + 冻结数值, 玩家疑心才 55 就"被死"。
  新变量._坏结局已触发 = 旧变量._坏结局已触发;
  // 蚀心露屈辱标记：前端触发的一次性状态，一旦 true 不可逆
  新变量._已触发蚀心露屈辱 = base.已触发蚀心露屈辱 || 旧变量._已触发蚀心露屈辱 || 新变量._已触发蚀心露屈辱;
  // 蚀心露屈辱刚触发时强制重置疑心值为0（快照可能未捕获到前端的重置，
  // 因为 store.flush() 写入当前消息后 /send 创建新消息，MVU 数据可能未传播）
  // 门控：仅在 base.心态==='屈辱' 时触发——shopSystem 蚀心露按钮会同时设
  // 心态='屈辱' + 疑心值=0，所以"心态=屈辱"是真触发的可靠特征。
  // 入口 4/5 yaml 预设 _已触发=true 但 心态=默许/沉溺，不在此分支，绕开误重置。
  if (base.已触发蚀心露屈辱 && !旧变量._已触发蚀心露屈辱 && base.心态 === '屈辱') {
    新变量.苗广.疑心值 = 0;
    console.info('[状态验证] 蚀心露屈辱刚触发，疑心值强制重置为0（绿帽值从0开始）');
  }
  // 蚀心露屈辱已触发但快照心态仍在前半程 → 强制校正为屈辱
  // 防止 MVU 传播延迟/页面刷新导致快照捕获到旧心态，calcMiaoguangMind 走错分支
  const 前半程心态 = ['正常', '疑惑', '察觉', '愤怒'];
  if (新变量._已触发蚀心露屈辱 && 前半程心态.includes(base.心态)) {
    console.warn(`[状态验证] 蚀心露屈辱已触发但快照心态为「${base.心态}」，强制校正为「屈辱」`);
    base.心态 = '屈辱';
  }
  // 服装：脚本管理（商店装备切换触发），AI不得修改
  // 快照包含前端操作（玩家换装），回滚后 processNewlyActivatedItems/processEquipmentUnequip 会更新
  新变量.云霜凝.服装.上装 = base.服装.上装;
  新变量.云霜凝.服装.下装 = base.服装.下装;
  新变量.云霜凝.服装.内衣 = base.服装.内衣;
  新变量.云霜凝.服装.内裤 = base.服装.内裤;
  新变量.云霜凝.服装.特殊配饰 = { ...base.服装.特殊配饰 };
  新变量.云霜凝.服装.暴露程度 = base.服装.暴露程度 as SchemaType['云霜凝']['服装']['暴露程度'];

  // ── 0b. 神魂空间自动解锁（floor>=5 时首次触发）──────────
  // 必须在硬保护之后执行：先恢复旧值防止AI篡改，再判断是否需要解锁
  // 额外守卫：_神魂空间已进入过 为 true 说明早已解锁过，防止快照丢失导致重复触发
  if (currentFloor && currentFloor >= 5 && !新变量._神魂空间已解锁 && !新变量._神魂空间已进入过) {
    新变量._神魂空间已解锁 = true;
    新变量._当前互动模式 = '神魂空间';
    新变量._神魂空间激活中 = true;
    // 追加而非覆盖，防止吞掉已有的道具事件（如蚀心露转变事件）
    const existing = 新变量._待发送道具事件;
    const event = '__神魂空间引导__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info('[状态验证] 楼层>=5，神魂空间已解锁，引导事件已注入');
  }

  // ── 0c. 神魂空间"已进入过"自愈兜底（2.0.23）──
  // 历史 bug:自动引导路径(__神魂空间引导__)在 PROMPT_READY 处理时漏设
  // _神魂空间已进入过=true,导致 buildStatusSnapshot 永远走"首次引导"分支,
  // 玩家在神魂空间多轮对话仍每轮看到"请详细描写首次进入感官体验"。
  // 自愈条件:模式已是神魂空间,但标志为 false → 补设 true。
  // 新存档第 5 楼自动触发后,下一轮 VARIABLE_UPDATE_ENDED 会跑到这里补设;
  // 老存档卡死的玩家也会在下一轮自动恢复。
  if (新变量._当前互动模式 === '神魂空间' && !新变量._神魂空间已进入过) {
    新变量._神魂空间已进入过 = true;
    console.warn('[状态验证] 自愈: 已在神魂空间但 _神魂空间已进入过=false,补设 true(防卡死首次引导循环)');
  }

  // ── 1. 治疗阶段自动计算 ──────────────────────────
  const oldStage = 旧变量.治疗.阶段;
  const newStage = calcHealingStage(新变量.治疗.完成度);
  新变量.治疗.阶段 = newStage;

  // ── 2. 治疗阶段突破 → 里程碑灵石 ───────────────────
  // 6b 的 delta cap 已经把 AI 乱输入截回合法范围，直接用新阶段判定即可
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

  // ── 2b. 苗喧前期反抗事件触发（设计文档 line 104-111） ──
  // 阶段3完成（oldStage<4 && newStage>=4）→ 反抗#1
  // 阶段5完成（oldStage<6 && newStage>=6）→ 反抗#2
  // 触发时写入 _待发送道具事件，下一回合 AI 演绎苗喧告状剧情；
  // 同时设置 _苗喧反抗限制中 = true，玩家灵石/治疗推进被 ×0.4 削减，
  // 解除方式：(1) 玩家点击孝敬师父按钮进入副本（MiaoPanel.startXiaojing）
  //           (2) 触发 10 楼后自动软兜底清除（避免玩家卡死）
  //
  // 2.0.22 门控汇总(5 道门):
  //   1. 神魂空间: 苗喧告状是"苗喧冲进苗广丹房"的观看框架,和神魂空间沉浸氛围冲突
  //   2. 打断冻结: 苗广刚闯入气氛紧张,反抗事件进来会让家庭剧撞车
  //   3. 洛书晴线已激活: 苗喧是洛书晴的未婚夫,洛线未激活时苗喧不应出场(修复原始 bug)
  //   4. 双向扰动冷却(session 7 定稿 · 2.0.22): 打断冻结或反抗限制刚结束后 15 楼内不触发另一种扰动,避免玩家连续卡扰动
  //   5. 阶段跳转瞬间: oldStage < X && newStage >= X (原有条件)
  // 任一门控未通过 → 跳过触发,走下方 2b-fix 自愈分支等时机合适时补触发
  const 非神魂空间 = 新变量._当前互动模式 !== '神魂空间';
  const 非打断冻结 = (currentFloor ?? 0) >= 新变量._打断冻结至楼层;
  const 洛已激活 = !!新变量._洛书晴线已激活;
  const 非扰动冷却 = (currentFloor ?? 0) >= 新变量._扰动冷却结束楼层;
  const 反抗通用门控 = 非神魂空间 && 非打断冻结 && 洛已激活 && 非扰动冷却;
  if (oldStage < 4 && newStage >= 4 && 新变量._苗喧前期反抗已触发 < 1 && 反抗通用门控) {
    新变量._苗喧前期反抗已触发 = 1;
    新变量._苗喧反抗限制中 = true;
    新变量._苗喧反抗限制触发楼层 = currentFloor ?? 0;
    const existing = 新变量._待发送道具事件;
    const event = '__苗喧前期反抗_1__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info('[状态验证] 苗喧前期反抗#1 触发（阶段3完成）→ _苗喧反抗限制中 = true');
  }
  if (oldStage < 6 && newStage >= 6 && 新变量._苗喧前期反抗已触发 < 2 && 反抗通用门控) {
    新变量._苗喧前期反抗已触发 = 2;
    新变量._苗喧反抗限制中 = true;
    新变量._苗喧反抗限制触发楼层 = currentFloor ?? 0;
    const existing = 新变量._待发送道具事件;
    const event = '__苗喧前期反抗_2__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info('[状态验证] 苗喧前期反抗#2 触发（阶段5完成）→ _苗喧反抗限制中 = true');
  }

  // ── 2b-fix. 苗喧前期反抗·自愈兜底（2.0.22） ──
  // 处理以下场景的补触发:
  //   1. 神魂空间中跨过治疗阶段 3/5 完成点 → 原始 2b 门控跳过
  //   2. 打断冻结中跨过完成点 → 同上
  //   3. 阶段跨过完成点时洛书晴线还未激活 → 之后玩家激活洛线时需要补触发
  // 幂等 gate: 用 `_苗喧前期反抗已触发` 计数器检测"应该跑过但没跑过",
  // 用 else if 保证同楼只补一个(避免 #1 和 #2 并发注入两段剧情),下一轮再补另一个。
  if (反抗通用门控) {
    if (新变量.治疗.阶段 >= 4 && 新变量._苗喧前期反抗已触发 < 1) {
      新变量._苗喧前期反抗已触发 = 1;
      新变量._苗喧反抗限制中 = true;
      新变量._苗喧反抗限制触发楼层 = currentFloor ?? 0;
      const existing = 新变量._待发送道具事件;
      const event = '__苗喧前期反抗_1__';
      新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
      console.warn(`[状态验证] 自愈触发: 苗喧前期反抗#1（治疗阶段=${新变量.治疗.阶段} 已过3完成点但未触发,补触发）`);
    } else if (新变量.治疗.阶段 >= 6 && 新变量._苗喧前期反抗已触发 < 2) {
      新变量._苗喧前期反抗已触发 = 2;
      新变量._苗喧反抗限制中 = true;
      新变量._苗喧反抗限制触发楼层 = currentFloor ?? 0;
      const existing = 新变量._待发送道具事件;
      const event = '__苗喧前期反抗_2__';
      新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
      console.warn(`[状态验证] 自愈触发: 苗喧前期反抗#2（治疗阶段=${新变量.治疗.阶段} 已过5完成点但未触发,补触发）`);
    }
  }

  // ── 2c. 苗喧反抗限制 10 楼软兜底：玩家不点孝敬师父也自动解除 ──
  if (
    新变量._苗喧反抗限制中 &&
    新变量._苗喧反抗限制触发楼层 > 0 &&
    (currentFloor ?? 0) >= 新变量._苗喧反抗限制触发楼层 + 10
  ) {
    新变量._苗喧反抗限制中 = false;
    新变量._苗喧反抗限制触发楼层 = 0;
    console.info(
      `[状态验证] 苗喧反抗限制 10 楼兜底自动解除（触发楼层 ${旧变量._苗喧反抗限制触发楼层} + 10 <= 当前 ${currentFloor}）`,
    );
  }

  // ── 3. 苗广心态自动推算 ──────────────────────────
  // 阶段1保护：疑心值上限5，阶段1几乎冻结疑心增长
  if (新变量.治疗.阶段 <= 1 && 新变量.苗广.疑心值 > 5) {
    新变量.苗广.疑心值 = 5;
    console.info('[状态验证] 阶段1保护：疑心值上限5');
  }
  const oldMind = 旧变量.苗广.心态;
  // 用快照心态（而非AI写的值）作为基准：防止AI不知道蚀心露转变，写回旧心态导致calcMiaoguangMind走错分支
  新变量.苗广.心态 = calcMiaoguangMind(新变量.苗广.疑心值, base.心态) as SchemaType['苗广']['心态'];
  const newMind = 新变量.苗广.心态;

  // ── 3b. 苗广心态进入新阶段 → 里程碑灵石 ──────────────
  // 2.0.18 经济调整：全部翻倍
  if (newMind !== oldMind) {
    const mindMilestoneRewards: Partial<Record<SchemaType['苗广']['心态'], number>> = {
      疑惑: 60,
      察觉: 80,
      屈辱: 100,
      默许: 100,
      沉溺: 120,
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
    const hasValueChange =
      新变量.云霜凝.信任度 > 旧变量.云霜凝.信任度 ||
      新变量.云霜凝.心理防线 < 旧变量.云霜凝.心理防线 ||
      新变量.治疗.完成度 > 旧变量.治疗.完成度 ||
      新变量.云霜凝.身体开发.小嘴 > 旧变量.云霜凝.身体开发.小嘴 ||
      新变量.云霜凝.身体开发.胸部 > 旧变量.云霜凝.身体开发.胸部 ||
      新变量.云霜凝.身体开发.小屄 > 旧变量.云霜凝.身体开发.小屄 ||
      新变量.云霜凝.身体开发.屁穴 > 旧变量.云霜凝.身体开发.屁穴;

    const isInFreeze = 新变量._打断冻结至楼层 > 0 && (currentFloor ?? 0) < 新变量._打断冻结至楼层;

    // 冻结期间治疗尝试标记（冻结结束时判定奖励用）
    if (hasValueChange && isInFreeze) {
      _freezeHadTreatmentAttempt = true;
    }

    // 孝敬师父期间跳过疑心值增长（正在帮苗广做事，不应有治疗泄露风险）
    if (hasValueChange && !新变量.苗广.孝敬师父.激活中) {
      const items = 新变量.系统.道具状态;
      const 有隔音 = items['隔音灵阵'] === '使用中';
      const 有影绰 = items['影绰纱帘'] === '使用中';
      const 有透灵 = items['透灵幔'] === '使用中';

      const 心态 = 新变量.苗广.心态;
      const 是后半程 = 心态 === '屈辱' || 心态 === '默许' || 心态 === '沉溺';

      let increment = 0;

      if (是后半程) {
        // ── 后半程：绿帽值增长（主动推进苗广堕落）──
        if (有透灵 && 有隔音)
          increment = 5; // 看清一切但听不到
        else if (有透灵)
          increment = 6; // 看清一切+听到声音
        else if (有影绰 && 有隔音)
          increment = 3; // 只看到影子
        else if (有影绰)
          increment = 4; // 看到影子+听到声音
        else if (有隔音)
          increment = 0; // 什么都感知不到
        else increment = 1; // 都不装

        // 服装暴露叠加加成
        const 暴露 = 新变量.云霜凝.服装.暴露程度;
        const exposureBonus: Record<string, number> = {
          遮蔽: 0,
          微露: 0,
          轻露: 1,
          半露: 2,
          大露: 3,
          极露: 4,
        };
        increment += exposureBonus[暴露] ?? 0;

        // 后半程环境道具系数:有透灵 ×0.8 / 有影绰(无透灵) ×0.5
        // 其它(都不装/仅隔音)保持——基础值本身已很低
        const 道具系数 = 有透灵 ? 0.8 : 有影绰 ? 0.5 : 1.0;
        increment = Math.round(increment * 道具系数);
      } else {
        // ── 前半程：疑心值增长（风险管理）──
        if (有隔音) {
          increment = 2; // 隔音灵阵减弱但无法完全消除（灵力波动仍可感知）
        } else {
          increment = 5; // 无遮蔽治疗：声音泄漏+灵力异常
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

      // 打断冻结期间减免：苗广已打断过，治疗被回滚，未发现新证据，仅维持戒备
      if (isInFreeze) {
        increment = Math.max(1, Math.ceil(increment * 0.3));
      }

      if (increment > 0) {
        // 楼层去重：同一楼层重新生成时不重复叠加疑心值
        if (currentFloor !== undefined && currentFloor === _lastSuspicionFloor) {
          console.info(`[状态验证] 疑心值跳过：楼层${currentFloor}已增长过（重新生成保护）`);
        } else {
          if (currentFloor !== undefined) _lastSuspicionFloor = currentFloor;
          新变量.苗广.疑心值 = Math.min(100, 新变量.苗广.疑心值 + increment);
          console.info(
            `[状态验证] 治疗互动 → ${是后半程 ? '绿帽值' : '疑心值'} +${increment}${新变量._当前互动模式 === '神魂空间' ? '(神魂×0.3)' : ''} → ${新变量.苗广.疑心值}`,
          );
        }
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
    return freezeBaseline ?? null; // 跳过后续所有计算
  }
  if (新变量.苗广.心态 === '愤怒') {
    新变量._坏结局已触发 = true;
    // 神魂空间中触发坏结局：强制退出（同打断处理）
    if (新变量._当前互动模式 === '神魂空间') {
      新变量._当前互动模式 = '日常';
      新变量._神魂空间激活中 = false;
      console.warn('[状态验证] ⚠️ 神魂空间中触发坏结局，已强制退出');
    }
    // v2: 清零所有分阶段引导延后字段（场景被强制中断）
    clearAllPhaseDelays(新变量);
    // 注入坏结局事件
    const existing = 新变量._待发送道具事件;
    const event = '__坏结局_愤怒__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.warn('[状态验证] ⚠️ 苗广愤怒→坏结局触发！游戏锁死');
    return freezeBaseline ?? null;
  }

  // ── 6. 核心数值单轮 delta cap（唯一作用：兜底 AI 违反单轮增量指令） ──────
  // yaml 规则告诉 AI "每轮 +N"，这里给 1.5~2 倍 buffer 作为硬兜底
  // 正常 AI 输出不会撞 cap，玩家感觉不到；AI 乱输出 +15 会被截回
  {
    // 信任度 推进 +2 / 衰退 -1 (2.0.25: 衰退 cap 比推进更严,避免 AI 日常小扣累积成衰退)
    const trustDelta = 新变量.云霜凝.信任度 - 旧变量.云霜凝.信任度;
    if (trustDelta > 2) {
      新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度 + 2;
      console.warn(`[delta cap] 信任度增幅 +${trustDelta} → +2`);
    } else if (trustDelta < -1) {
      新变量.云霜凝.信任度 = 旧变量.云霜凝.信任度 - 1;
      console.warn(`[delta cap] 信任度降幅 ${trustDelta} → -1`);
    }
  }
  {
    // 心理防线 推进 -2(降) / 衰退 +1(升) (2.0.25: 筑墙回升 cap 比接受亲密更严)
    const defDelta = 新变量.云霜凝.心理防线 - 旧变量.云霜凝.心理防线;
    if (defDelta > 1) {
      新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线 + 1;
      console.warn(`[delta cap] 心理防线增幅(回升) +${defDelta} → +1`);
    } else if (defDelta < -2) {
      新变量.云霜凝.心理防线 = 旧变量.云霜凝.心理防线 - 2;
      console.warn(`[delta cap] 心理防线降幅(推进) ${defDelta} → -2`);
    }
  }
  {
    // 治疗完成度 推进 +3 / 衰退 -1 (2.0.25: 衰退 cap 收紧,防 AI 日常小扣累积)
    const compDelta = 新变量.治疗.完成度 - 旧变量.治疗.完成度;
    if (compDelta > 3) {
      新变量.治疗.完成度 = 旧变量.治疗.完成度 + 3;
      console.warn(`[delta cap] 完成度增幅 +${compDelta} → +3`);
    } else if (compDelta < -1) {
      新变量.治疗.完成度 = 旧变量.治疗.完成度 - 1;
      console.warn(`[delta cap] 完成度降幅 ${compDelta} → -1`);
    }
    // 苗喧反抗限制中：治疗推进 ×0.4（设计文档 line 108）
    const afterCapDelta = 新变量.治疗.完成度 - 旧变量.治疗.完成度;
    if (新变量._苗喧反抗限制中 && afterCapDelta > 0) {
      const reduced = Math.floor(afterCapDelta * 0.4);
      新变量.治疗.完成度 = 旧变量.治疗.完成度 + reduced;
      console.info(`[状态验证] 苗喧反抗限制中：完成度推进 +${afterCapDelta} → +${reduced}（×0.4）`);
    }
  }
  {
    // 身体开发每部位 推进 +3 / 不可衰退 (2.0.25: 身体开发是累积状态,无衰退机制)
    const bodyParts = ['小嘴', '胸部', '小屄', '屁穴'] as const;
    for (const part of bodyParts) {
      const oldVal = 旧变量.云霜凝.身体开发[part];
      const bodyDelta = 新变量.云霜凝.身体开发[part] - oldVal;
      if (bodyDelta > 3) {
        新变量.云霜凝.身体开发[part] = oldVal + 3;
        console.warn(`[delta cap] 身体开发.${part} 增幅 +${bodyDelta} → +3`);
      } else if (bodyDelta < 0) {
        新变量.云霜凝.身体开发[part] = oldVal;
        console.warn(`[delta cap] 身体开发.${part} 不可衰退,回滚负 delta ${bodyDelta}`);
      }
    }
  }
  // 疑心值 delta clamp 已移除：疑心值由硬保护+脚本全权管理，AI无法修改

  // ── 7. 打断治疗概率判定（脚本驱动，单层掷骰） ────────
  // 阶段1免疫，阶段2+按阶段基础概率 + 疑心加成，cap 35%
  // 隔音灵阵 ×0.5，神魂空间 ×0.5
  // 使用楼层号做种子的确定性伪随机，防止玩家通过重新生成绕过打断
  // 冻结5楼 + 冷却8楼 = 冻结结束后玩家有8楼自由推进窗口（不回滚、不触发打断）
  {
    const INTERRUPT_COOLDOWN = 8; // 冻结结束后的安全窗口（楼层数）

    const hasValueChange =
      新变量.云霜凝.信任度 !== 旧变量.云霜凝.信任度 ||
      新变量.云霜凝.心理防线 !== 旧变量.云霜凝.心理防线 ||
      新变量.治疗.完成度 !== 旧变量.治疗.完成度;

    const 心态 = 新变量.苗广.心态;
    const 是前半程 = 心态 !== '屈辱' && 心态 !== '默许' && 心态 !== '沉溺';
    // 用旧阶段判定：必须上一轮已确认在阶段2+才可能被打断
    const stage = 旧变量.治疗.阶段;

    if (
      hasValueChange &&
      是前半程 &&
      stage >= 2 &&
      !新变量.苗广.孝敬师父.激活中 &&
      // 2.0.27 · 多轮 AI 剧情免疫打断:
      //   特殊场景(12 个)/ 千晶幻术 / 洛书晴激活剧情 / 苗喧反抗限制中 都不应插入打断
      //   苗喧反抗理论上与打断不共存,为防御性编程仍加此 gate
      !新变量._特殊场景.进行中 &&
      !新变量.苗广.千晶幻术.激活中 &&
      新变量._洛书晴激活轮次进度 === 0 &&
      !新变量._苗喧反抗限制中 &&
      (currentFloor ?? 0) >= 新变量._打断冻结至楼层 + INTERRUPT_COOLDOWN &&
      // 2.0.22 · 双向扰动冷却 gate: 反抗限制刚解除后 15 楼内不触发打断
      // INTERRUPT_COOLDOWN(8 楼)已间接 gate 大部分场景,此门控覆盖"反抗限制解除→打断"路径
      (currentFloor ?? 0) >= 新变量._扰动冷却结束楼层
    ) {
      // 阶段基础概率
      const stageBase: Record<number, number> = { 2: 0.08, 3: 0.15, 4: 0.2, 5: 0.25 };
      let prob = stageBase[Math.min(stage, 5)] ?? 0.25;

      // 疑心值加成（加法制）
      if (新变量.苗广.疑心值 >= 50) prob += 0.1;
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
        新变量._打断冻结至楼层 = floor + 5;
        _freezeHadTreatmentAttempt = false; // 冻结开始，重置治疗尝试标记
        _freezeRewardGiven = false;
        // v2: 清零所有分阶段引导延后字段（进行中的场景被打断治疗强制中断）
        clearAllPhaseDelays(新变量);
        // 疑心值惩罚：察觉心态+8，其他+5
        // 楼层去重：同一打断楼 reroll 时不重复叠加(防止 reroll 多次直接 GG)
        // 其他打断副作用(冻结至楼层/事件 push/模式切换)幂等,reroll 重设无害,不在此守卫内
        if (currentFloor !== undefined && currentFloor === _lastInterruptFloor) {
          console.info(`[状态验证] 打断重 roll：楼层${currentFloor}已加过疑心值，跳过`);
        } else {
          if (currentFloor !== undefined) _lastInterruptFloor = currentFloor;
          const suspicionPenalty = 心态 === '察觉' ? 8 : 5;
          新变量.苗广.疑心值 += suspicionPenalty;
          console.warn(
            `[状态验证] 打断触发疑心值惩罚 +${suspicionPenalty}（心态=${心态}），当前疑心值=${新变量.苗广.疑心值}`,
          );
        }
        // 打断触发时捕获治疗数值基线（冻结期间用作回滚基准）
        freezeBaseline = {
          信任度: 新变量.云霜凝.信任度,
          心理防线: 新变量.云霜凝.心理防线,
          完成度: 新变量.治疗.完成度,
          身体开发: { ...新变量.云霜凝.身体开发 },
        };
        let events = '';
        if (新变量._当前互动模式 === '神魂空间') {
          // 强制退出神魂空间：立即改变量，确保下一轮AI不会继续神魂空间剧情
          新变量._当前互动模式 = '日常';
          新变量._神魂空间激活中 = false;
          events = '__打断治疗_神魂__';
          // 2.0.22 · 记录本次打断自神魂空间触发，供 N+4 楼 push __打断结束__ event 时 dispatch 分版文本
          新变量._打断自神魂空间 = true;
          console.warn(`[状态验证] ⚡ 神魂空间中被打断！已强制退出 + 打断治疗`);
        } else {
          events = '__打断治疗__';
          新变量._打断自神魂空间 = false;
        }
        const existing = 新变量._待发送道具事件;
        新变量._待发送道具事件 = existing ? existing + '|||' + events : events;
        console.warn(
          `[状态验证] ⚡ 打断治疗触发！概率${(prob * 100).toFixed(1)}%，掷骰${roll.toFixed(3)} < ${prob.toFixed(3)}（楼层种子）`,
        );
      } else {
        console.info(
          `[状态验证] 打断治疗未触发：概率${(prob * 100).toFixed(1)}%，掷骰${roll.toFixed(3)} ≥ ${prob.toFixed(3)}（楼层种子）`,
        );
      }
    }
  }

  // ── 8. 千晶幻术解锁条件验证 ───────────────────────
  if (新变量.苗广.千晶幻术.激活中 && (新变量.治疗.阶段 < 7 || !新变量._已完成特殊场景['寝取宣告'])) {
    新变量.苗广.千晶幻术.激活中 = false;
    console.warn('[状态验证] 千晶幻术未解锁（阶段<7或寝取宣告未完成），已强制关闭');
  }
  // 千晶幻术完成后冻结幻境摘要为旧值，防止AI继续更新
  if (新变量.苗广.千晶幻术.认知改写完成 && !新变量.苗广.千晶幻术.激活中) {
    新变量.苗广.千晶幻术.幻境摘要 = 旧变量.苗广.千晶幻术.幻境摘要;
  }

  // ── 8. 数值变化 → 灵石奖励（宽松经济，所有治疗相关数值变化都给灵石） ──────
  // 注：神魂空间解锁已移至 MESSAGE_RECEIVED 基于楼层触发
  // 2.0.18 经济调整：每项 min/max 翻倍，总和上限约从 85 → 170
  {
    let totalReward = 0;
    const details: string[] = [];

    // 信任度变化（增减都算）
    const trustDelta = Math.abs(Math.floor(新变量.云霜凝.信任度 - 旧变量.云霜凝.信任度));
    if (trustDelta > 0) {
      const r = Math.min(30, Math.max(6, trustDelta * 6));
      totalReward += r;
      details.push(`信任Δ${trustDelta}→${r}`);
    }

    // 防线变化（增减都算）
    const defenseDelta = Math.abs(Math.floor(新变量.云霜凝.心理防线 - 旧变量.云霜凝.心理防线));
    if (defenseDelta > 0) {
      const r = Math.min(30, Math.max(6, defenseDelta * 4));
      totalReward += r;
      details.push(`防线Δ${defenseDelta}→${r}`);
    }

    // 完成度变化（增减都算）
    const compDelta = Math.abs(Math.floor(新变量.治疗.完成度 - 旧变量.治疗.完成度));
    if (compDelta > 0) {
      const r = Math.min(30, Math.max(6, compDelta * 6));
      totalReward += r;
      details.push(`完成度Δ${compDelta}→${r}`);
    }

    // 身体开发变化（增减都算）
    for (const part of ['小嘴', '胸部', '小屄', '屁穴'] as const) {
      const bodyDelta = Math.abs(Math.floor(新变量.云霜凝.身体开发[part] - 旧变量.云霜凝.身体开发[part]));
      if (bodyDelta > 0) {
        const r = Math.min(20, Math.max(4, bodyDelta * 4));
        totalReward += r;
        details.push(`${part}Δ${bodyDelta}→${r}`);
      }
    }

    if (totalReward > 0) {
      // 苗喧反抗限制中：灵石奖励 ×0.4（设计文档 line 108）
      if (新变量._苗喧反抗限制中) {
        const orig = totalReward;
        totalReward = Math.max(1, Math.floor(totalReward * 0.4));
        console.info(`[状态验证] 苗喧反抗限制中：灵石奖励 +${orig} → +${totalReward}（×0.4）`);
      }
      新变量.系统.灵石 += totalReward;
      console.info(
        `[状态验证] 数值变化灵石奖励 +${totalReward}（${details.join(', ')}），当前灵石: ${新变量.系统.灵石}`,
      );
    }
  }

  // ── 8b. 每轮被动灵石收入（固定 30） ──────────
  // 2.0.18 经济调整：固定 30/轮（之前 5-15 动态），玩家反馈太抠
  {
    let passiveIncome = 30;
    // 苗喧反抗限制中：被动灵石 ×0.4
    if (新变量._苗喧反抗限制中) {
      const orig = passiveIncome;
      passiveIncome = Math.max(1, Math.floor(passiveIncome * 0.4));
      console.info(`[状态验证] 苗喧反抗限制中：被动灵石 +${orig} → +${passiveIncome}（×0.4）`);
    }
    新变量.系统.灵石 += passiveIncome;
    console.info(`[状态验证] 被动灵石 +${passiveIncome}，当前灵石: ${新变量.系统.灵石}`);
  }

  // ── 9. 打断冻结：纯楼层计时，到期自动解除 ──────────────────
  {
    const floor = currentFloor ?? 0;
    if (新变量._打断冻结至楼层 > 0 && floor > 0 && floor < 新变量._打断冻结至楼层) {
      if (freezeBaseline) {
        // 冻结期间 → 回滚到基线（打断触发时捕获，每轮由 MESSAGE_RECEIVED 更新）
        新变量.云霜凝.信任度 = freezeBaseline.信任度;
        新变量.云霜凝.心理防线 = freezeBaseline.心理防线;
        新变量.治疗.完成度 = freezeBaseline.完成度;
        新变量.云霜凝.身体开发.小嘴 = freezeBaseline.身体开发.小嘴;
        新变量.云霜凝.身体开发.胸部 = freezeBaseline.身体开发.胸部;
        新变量.云霜凝.身体开发.小屄 = freezeBaseline.身体开发.小屄;
        新变量.云霜凝.身体开发.屁穴 = freezeBaseline.身体开发.屁穴;
        新变量.治疗.阶段 = calcHealingStage(新变量.治疗.完成度);
        console.warn(`[状态验证] 打断冻结中（剩余${新变量._打断冻结至楼层 - floor}楼），治疗数值已回滚至基线`);
      } else {
        // 无基线（边界情况：页面刷新后冻结仍在生效）→ 仅阻止AI推进，不回滚
        console.warn(`[状态验证] 打断冻结中（剩余${新变量._打断冻结至楼层 - floor}楼），无基线，跳过回滚`);
      }
      // 2.0.22 · 场景引擎 v2 · 打断结束 event 注入（冻结最后一楼判定）
      // 判定用 `floor === _打断冻结至楼层 - 1`（冻结最后一楼）而非"跨边界"，
      // 保证玩家主动解冻（MiaoPanel.startXiaojing 把 _打断冻结至楼层 设为 currentFloor）时
      // 不会误触发 — 那时 floor === _打断冻结至楼层 走 else if 分支，不走 if。
      // event 内容让 AI 在下一楼（玩家消费 event 后）写"苗广找借口自然离开"，气氛缓和。
      if (floor === 新变量._打断冻结至楼层 - 1) {
        const existing = 新变量._待发送道具事件;
        const endEvent = '__打断结束__';
        新变量._待发送道具事件 = existing ? existing + '|||' + endEvent : endEvent;
        console.info(`[状态验证] 打断冻结最后一楼 → push ${endEvent} event（自神魂=${新变量._打断自神魂空间}）`);
      }
    } else if (
      新变量._打断冻结至楼层 > 0 &&
      floor > 0 &&
      floor >= 新变量._打断冻结至楼层 &&
      !_freezeRewardGiven &&
      // 2.0.22 · 跨 iframe reload 幂等 guard: "冷却楼 < 打断楼" = "本次冻结还没处理过结束那一帧"
      // _freezeRewardGiven 是 module 变量,iframe reload(切聊天/F5)后重置为 false,
      // 会让此分支重跑,导致 (a) 疑心值 -3 奖励重复发放 (b) 扰动冷却重复延长 15 楼。
      // _扰动冷却结束楼层 是 schema 字段(存 chat variables 里,reload 保留),
      // 第一次进入此分支时被设为 floor+15(必然 > 打断楼),之后 reload 重跑此 guard
      // 会 false 跳过整个分支。两道 guard = 双保险(module 变量同 tick 防重 + schema 字段跨 reload 防重)
      新变量._扰动冷却结束楼层 < 新变量._打断冻结至楼层
    ) {
      // 冻结刚结束：全程无治疗尝试 → 疑心值 -3 奖励
      _freezeRewardGiven = true;
      if (!_freezeHadTreatmentAttempt) {
        新变量.苗广.疑心值 = Math.max(0, 新变量.苗广.疑心值 - 3);
        console.info(`[状态验证] 打断冻结结束奖励：全程无治疗尝试，疑心值 -3 → ${新变量.苗广.疑心值}`);
      } else {
        console.info('[状态验证] 打断冻结结束：冻结期间有治疗尝试，无奖励');
      }
      // 双向扰动冷却: 设 15 楼冷却(同时兼作下次进此分支的 guard 值)
      新变量._扰动冷却结束楼层 = floor + 15;
      console.info(`[状态验证] 打断冻结结束 → 扰动冷却至 ${floor + 15} 楼`);
      // 2.0.22 · 清 _打断自神魂空间 字段（本次打断周期结束，字段使命完成）
      // __打断结束__ event 若已 push（N+4 楼）此时已带着正确的字段值消费完毕；
      // 若玩家主动解冻(走此 else if 但 floor === _打断冻结至楼层,event 没 push),字段清了也无影响
      新变量._打断自神魂空间 = false;
    }
  }

  // ── 11. 地仙境突破剧情（阶段3+且现实互动中，一次性方式1注入） ──
  // 2.0.22 门控: `_当前互动模式 === '现实互动'` 已隐式排除神魂空间。
  // 新增打断冻结门控——冻结期间苗广刚闯入气氛紧张,突破剧情进来会撞车。
  // 冻结结束后,下一轮 stateValidation 仍会跑到这个分支,因为 _已发放里程碑灵石 未被设置,
  // 条件满足时自动补触发(天然幂等,不需要单独的自愈分支)。
  if (
    新变量.治疗.阶段 >= 3 &&
    新变量._当前互动模式 === '现实互动' &&
    !新变量._已发放里程碑灵石['地仙境突破'] &&
    (currentFloor ?? 0) >= 新变量._打断冻结至楼层
  ) {
    新变量._已发放里程碑灵石['地仙境突破'] = true;
    const existing = 新变量._待发送道具事件;
    const event = '__地仙境突破__';
    新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info('[状态验证] 地仙境突破剧情触发！阶段3+且在现实互动中');
  }

  // ── 11a. 洛书晴激活剧情轮次推进（5 轮后正式激活） ──
  // v2 (2.0.20): 本楼若是道具楼（_本楼跳过分阶段引导=true），跳过推进——
  // 这一楼让位给道具叙事，AI 没有看到本轮引导，进度不应推进。
  if (新变量._洛书晴激活轮次进度 >= 1 && 新变量._洛书晴激活轮次进度 < 5) {
    if (isSkipPhaseGuide()) {
      console.info('[状态验证] 洛书晴激活进度推进被跳过（本楼为道具楼）');
    } else {
      // 本轮已经展示了第 N 轮的引导，下一轮推进到 N+1
      // 使用旧值作为基准避免重复+1（前端可能已经写过1）
      const next = (旧变量._洛书晴激活轮次进度 || 0) + 1;
      if (next > 旧变量._洛书晴激活轮次进度 && next <= 5) {
        新变量._洛书晴激活轮次进度 = next;
      }
    }
  } else if (新变量._洛书晴激活轮次进度 === 5 && !新变量._洛书晴线已激活) {
    // 第5轮完成 → 正式激活洛书晴线
    新变量._洛书晴线已激活 = true;
    新变量._洛书晴激活轮次进度 = 0; // 重置
    新变量._当前互动模式 = '日常';
    新变量._神魂空间激活中 = false;
    新变量._洛书晴激活引导延后楼数 = 0; // v2: 清零延后计数
    console.info('[状态验证] 洛书晴线已正式激活！');
  }

  // ── 11b. 洛书晴数值硬限制 + 阶段边界截断 + 自动阶段跳转 ──
  if (新变量._洛书晴线已激活) {
    // (1) 阶段脚本管理：AI 不得改调教阶段，强制回滚
    新变量.洛书晴.调教阶段 = 旧变量.洛书晴.调教阶段 || 1;
    // (2) 服装/肉体改造/性癖列表：脚本管理，AI 不得修改
    新变量.洛书晴.服装 = { ...旧变量.洛书晴.服装, 特殊配饰: { ...旧变量.洛书晴.服装.特殊配饰 } };
    新变量.洛书晴.肉体改造 = { ...旧变量.洛书晴.肉体改造, 淫纹: { ...旧变量.洛书晴.肉体改造.淫纹 } };
    新变量.洛书晴.性癖列表 = { ...旧变量.洛书晴.性癖列表 };

    // (3) 心理防线 推进 -4(降) / 衰退 +1(升) (2.0.25: 衰退 cap 收紧)
    {
      const delta = 新变量.洛书晴.心理防线 - 旧变量.洛书晴.心理防线;
      if (delta > 1) {
        新变量.洛书晴.心理防线 = 旧变量.洛书晴.心理防线 + 1;
        console.warn(`[状态验证] 洛书晴心理防线回升过大(+${delta}),限制至 +1`);
      } else if (delta < -4) {
        新变量.洛书晴.心理防线 = 旧变量.洛书晴.心理防线 - 4;
        console.warn(`[状态验证] 洛书晴心理防线降幅过大(${delta}),限制至 -4`);
      }
    }

    // (4) 顺从度 推进 +4 / 衰退 -1 (2.0.25: 衰退 cap 收紧)
    {
      const delta = 新变量.洛书晴.顺从度 - 旧变量.洛书晴.顺从度;
      if (delta > 4) {
        新变量.洛书晴.顺从度 = 旧变量.洛书晴.顺从度 + 4;
        console.warn(`[状态验证] 洛书晴顺从度增幅过大(+${delta}),限制至 +4`);
      } else if (delta < -1) {
        新变量.洛书晴.顺从度 = 旧变量.洛书晴.顺从度 - 1;
        console.warn(`[状态验证] 洛书晴顺从度降幅过大(${delta}),限制至 -1`);
      }
    }

    // (5) 身体开发 单轮单部位 推进 +4 / 不可衰退 (2.0.25: 身体开发无衰退机制)
    {
      const parts = ['小嘴', '胸部', '小屄', '屁穴'] as const;
      for (const part of parts) {
        const oldVal = 旧变量.洛书晴.身体开发[part];
        const newVal = 新变量.洛书晴.身体开发[part];
        const delta = newVal - oldVal;
        if (delta > 4) {
          新变量.洛书晴.身体开发[part] = oldVal + 4;
          console.warn(`[状态验证] 洛书晴身体开发.${part} 增幅过大,限制至 +4`);
        } else if (delta < 0) {
          新变量.洛书晴.身体开发[part] = oldVal;
          console.warn(`[状态验证] 洛书晴身体开发.${part} 不可衰退,回滚负 delta ${delta}`);
        }
      }
    }

    // (6) 阶段边界硬截断：防线 ≥ 下限，顺从 ≤ 上限
    {
      const bound = getLuoStageBound(新变量.洛书晴.调教阶段);
      if (新变量.洛书晴.心理防线 < bound.防线下限) {
        新变量.洛书晴.心理防线 = bound.防线下限;
      }
      if (新变量.洛书晴.顺从度 > bound.顺从上限) {
        新变量.洛书晴.顺从度 = bound.顺从上限;
      }
    }

    // (7) 自动阶段跳转检查：数值达上限 + 云霜凝阶段达同步门槛
    {
      const currentStage = 新变量.洛书晴.调教阶段;
      const req = getLuoStageJumpRequirement(currentStage);
      if (req) {
        const 防线到位 = 新变量.洛书晴.心理防线 <= req.防线上限;
        const 顺从到位 = 新变量.洛书晴.顺从度 >= req.顺从下限;
        const 云霜凝到位 = 新变量.治疗.阶段 >= req.云霜凝阶段下限;
        if (防线到位 && 顺从到位 && 云霜凝到位) {
          新变量.洛书晴.调教阶段 = currentStage + 1;
          console.info(
            `[状态验证] 洛书晴阶段跳转: ${currentStage} → ${currentStage + 1}（防线${新变量.洛书晴.心理防线} 顺从${新变量.洛书晴.顺从度} 云霜凝阶段${新变量.治疗.阶段}）`,
          );
          // 阶段 2 → 3 瞬间：触发"洛书晴现实初遇"脚本场景
          // 2.0.22 门控:必须同时排除神魂空间 + 打断冻结期
          //   · 神魂空间: 现实初遇是"洛书晴物理归山拜见师父",和意识领域完全冲突
          //   · 打断冻结期: 苗广刚闯入气氛紧张,家庭剧进来完全违和(玩家反馈的 bug)
          // 玩家退出神魂空间 / 冻结结束后,走下方 11b-fix 自愈分支补触发
          const 非神魂空间_洛 = 新变量._当前互动模式 !== '神魂空间';
          const 非打断冻结_洛 = (currentFloor ?? 0) >= 新变量._打断冻结至楼层;
          if (currentStage === 2 && 非神魂空间_洛 && 非打断冻结_洛) {
            const existing = 新变量._待发送道具事件;
            const event = '__洛书晴现实初遇__';
            新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
            新变量._特殊场景.进行中 = '洛书晴现实初遇';
            新变量._特殊场景开始楼层 = currentFloor ?? 0;
          }
        }
      }
    }

    // ── 11b-fix. 洛书晴现实初遇·自愈兜底（2.0.21 加, 2.0.22 补神魂空间门控） ──
    // 处理以下卡死场景的补触发:
    //   1. swipe / 删楼 / 早期版本 bug / 手动改 mvu → 调教阶段已 ≥3 但场景未完成
    //   2. 玩家在神魂空间中推进条件满足 → 原始触发点被神魂空间门控跳过 → 退出神魂空间后需要补触发
    // 上方 currentStage === 2 的"瞬间分支"只在跳转那一帧成立,一旦错过永远没有第二次机会。
    //
    // 2.0.22 补充门控: 必须排除神魂空间——原 2.0.21 修法没考虑到"玩家在云霜凝神魂空间里时
    // 洛书晴条件满足"会让 AI 收到两个冲突场景约束(神魂空间 + 现实初遇),写出矛盾剧情。
    // 玩家退出神魂空间后,下一轮 stateValidation 跑到这里自动补触发。
    if (
      新变量.洛书晴.调教阶段 >= 3 &&
      !新变量._已完成特殊场景['洛书晴现实初遇'] &&
      !新变量._特殊场景.进行中 &&
      新变量._当前互动模式 !== '神魂空间' &&
      (currentFloor ?? 0) >= 新变量._打断冻结至楼层
    ) {
      const existing = 新变量._待发送道具事件;
      const event = '__洛书晴现实初遇__';
      新变量._待发送道具事件 = existing ? existing + '|||' + event : event;
      新变量._特殊场景.进行中 = '洛书晴现实初遇';
      新变量._特殊场景开始楼层 = currentFloor ?? 0;
      console.warn(
        `[状态验证] 自愈触发: 洛书晴现实初遇（调教阶段=${新变量.洛书晴.调教阶段} 已≥3 但场景未完成,补触发）`,
      );
    }
  }

  // ── 11c. 苗喧数值联动（仅激活后） ──
  if (新变量._洛书晴线已激活) {
    // 脚本管理字段：绝望值/压抑值/心态，AI 不得修改
    新变量.苗喧.绝望值 = 旧变量.苗喧.绝望值;
    新变量.苗喧.压抑值 = 旧变量.苗喧.压抑值;

    // 绝望值被动背景氛围 + 苗广心态联动（阶梯式）
    {
      const floor = currentFloor ?? 0;
      // 被动慢涨：每 8 楼 +1（用楼层号做计数）
      if (floor > 0 && floor % 8 === 0 && floor !== _lastMiaoXuanPassiveFloor) {
        _lastMiaoXuanPassiveFloor = floor;
        新变量.苗喧.绝望值 = Math.min(100, 新变量.苗喧.绝望值 + 1);
      }
      // 苗广心态联动：心态进入新阶段时阶梯增加
      const oldMiaoGMind = 旧变量.苗广.心态;
      const newMiaoGMind = 新变量.苗广.心态;
      if (oldMiaoGMind !== newMiaoGMind) {
        const jump: Partial<Record<typeof newMiaoGMind, number>> = {
          屈辱: 10,
          默许: 15,
          沉溺: 20,
        };
        const bonus = jump[newMiaoGMind] ?? 0;
        if (bonus > 0) {
          新变量.苗喧.绝望值 = Math.min(100, 新变量.苗喧.绝望值 + bonus);
          console.info(`[状态验证] 苗喧绝望值+${bonus}（苗广心态→${newMiaoGMind}）`);
        }
      }

      // 千晶幻术认知改写完成瞬间：苗喧绝望+30（设计文档 line 75）
      // 父亲的灵魂被改写成"儿子"——苗喧全家唯一清醒者的崩溃点
      if (!旧变量.苗广.千晶幻术.认知改写完成 && 新变量.苗广.千晶幻术.认知改写完成) {
        新变量.苗喧.绝望值 = Math.min(100, 新变量.苗喧.绝望值 + 30);
        console.info('[状态验证] 苗喧绝望值+30（千晶幻术认知改写完成）');
      }
    }

    // 压抑值被动慢涨：每楼 +2（神魂空间内不涨，苗喧观察不到）
    if (
      新变量._当前互动模式 !== '神魂空间' &&
      currentFloor !== undefined &&
      currentFloor !== _lastMiaoXuanPressureFloor
    ) {
      _lastMiaoXuanPressureFloor = currentFloor;
      新变量.苗喧.压抑值 = Math.min(100, 新变量.苗喧.压抑值 + 2);
    }

    // 心态由绝望值映射
    新变量.苗喧.心态 = calcMiaoxuanMind(新变量.苗喧.绝望值);

    // ── 11c2. 后期反抗事件（2.0.22 场景引擎 v2 · 已删除 3 类自动触发） ──
    // v1 3 个一次性反抗事件（千晶后求父 / 掌门改嫁前 / 找未婚妻求助）在此处
    // 按条件自动触发 + 写入 _苗喧未读反抗事件 + UI 显示红点。
    // v2 改为玩家手动按按钮触发（类倾诉）: 绝望值 ≥ 40 时 MiaoXuanPanel
    // 的"查看反抗"按钮可点,点击后 push __苗喧后期反抗__ event + 一次性
    // 副作用(绝望值 -30 / _反抗冷却结束楼层 +8 / _苗喧反抗限制中=true /
    // _打断冻结至楼层 +5)。3 类硬编码剧情全部删除,AI 按 chat history
    // 自主生成每次反抗的焦点和对象。
  } else {
    // 未激活：冻结所有苗喧数值为 0/蔑视
    新变量.苗喧.绝望值 = 0;
    新变量.苗喧.压抑值 = 0;
    新变量.苗喧.心态 = '蔑视';
    新变量.苗喧.心理活动 = '';
  }

  // ── 12. 阶段最终校正：delta clamp/冻结可能修改完成度，阶段需重算 ──
  const finalStage = calcHealingStage(新变量.治疗.完成度);
  if (finalStage !== 新变量.治疗.阶段) {
    console.info(`[状态验证] 阶段校正: ${新变量.治疗.阶段} → ${finalStage}（完成度=${新变量.治疗.完成度}）`);
    新变量.治疗.阶段 = finalStage;
  }

  // ── 13. 当前场景角色管理 ────────────────────────────
  // 特殊场景进行中 / 单人神魂空间：脚本强制锁定，回滚 AI 修改
  // 日常 / 现实互动自由模式 / 双人神魂空间：放行 AI 的 JSONPatch 修改
  {
    const 旧场景 = 旧变量._特殊场景.进行中;
    const 新场景 = 新变量._特殊场景.进行中;
    const 旧神魂 = 旧变量._神魂空间激活中;
    const 新神魂 = 新变量._神魂空间激活中;

    if (新场景 && SCENE_ACTORS[新场景]) {
      // 特殊场景进行中：强制锁定为 SCENE_ACTORS 映射值
      const locked = SCENE_ACTORS[新场景];
      if (新变量._当前场景角色.云霜凝 !== locked.云霜凝 || 新变量._当前场景角色.洛书晴 !== locked.洛书晴) {
        新变量._当前场景角色 = { ...locked };
        if (旧场景 !== 新场景) {
          console.info(`[状态验证] 特殊场景「${新场景}」进入，场景角色锁定为`, locked);
        }
      }
    } else if (旧场景 && !新场景) {
      // 特殊场景结束：保留最后锁定值，交给 AI 下一轮调整
      console.info(`[状态验证] 特殊场景「${旧场景}」结束，场景角色解锁（保留最后值）`);
    } else if (!旧神魂 && 新神魂) {
      // 神魂空间进入：根据 _当前神魂空间角色 单选写入
      const target = 新变量._当前神魂空间角色;
      新变量._当前场景角色 = {
        云霜凝: target === '云霜凝',
        洛书晴: target === '洛书晴',
      };
      console.info(`[状态验证] 神魂空间进入，场景角色锁定为`, 新变量._当前场景角色);
    } else if (旧神魂 && !新神魂) {
      // 神魂空间退出：重置为主场景默认（云霜凝）
      新变量._当前场景角色 = { 云霜凝: true, 洛书晴: false };
      console.info('[状态验证] 神魂空间退出，场景角色重置为云霜凝');
    } else if (新神魂 && !新场景) {
      // 单人神魂空间进行中：强制保持与 _当前神魂空间角色 一致
      // （双人神魂空间无 flag，靠 AI 显式通过 JSONPatch 声明，脚本不干预）
      const target = 新变量._当前神魂空间角色;
      const expected = {
        云霜凝: target === '云霜凝',
        洛书晴: target === '洛书晴',
      };
      // 2.0.22 Bug 2 修复: 检测 _当前神魂空间角色 是否刚切换(云霜凝↔洛书晴)
      // 若刚切换: 强制锁定到新角色,不考虑 aiAddedCompanion
      //   (原代码误把"上一轮残留的 _当前场景角色"当作"AI 故意添加同伴",导致切换后旧角色残留)
      // 若未切换: 保留 aiAddedCompanion 判断,允许 AI 通过 JSONPatch 进入双人模式
      const 角色刚切换 = 旧变量._当前神魂空间角色 !== 新变量._当前神魂空间角色;
      if (角色刚切换) {
        新变量._当前场景角色 = expected;
        console.info(
          `[状态验证] 神魂空间角色切换: ${旧变量._当前神魂空间角色} → ${target}，场景角色强制重置为`,
          expected,
        );
      } else {
        // 只在 AI 没有把另一位设置为 true 时才锁定（允许 AI 进入双人模式）
        const aiAddedCompanion =
          (target === '云霜凝' && 新变量._当前场景角色.洛书晴) || (target === '洛书晴' && 新变量._当前场景角色.云霜凝);
        if (!aiAddedCompanion) {
          新变量._当前场景角色 = expected;
        }
      }
    }
    // 日常 / 现实互动自由模式（!新神魂 && !新场景）：完全放行 AI 的 JSONPatch 修改
  }

  // ── 12. 绿帽值转换提醒（疑心值跨阈值弹 toast） ────────
  // 仅前半程(蚀心露屈辱未触发)生效;sessionStorage 去重,纯 UI 提示不入 mvu(避免污染 AI 数据)
  // 一次只发跨越的最低档,防止疑心值一口气跨多档时弹多个 toast
  if (!新变量._已触发蚀心露屈辱 && 新变量.苗广.疑心值 > 旧变量.苗广.疑心值) {
    const oldSusp = 旧变量.苗广.疑心值;
    const newSusp = 新变量.苗广.疑心值;
    const SS_KEY = '云霜凝_绿帽提醒最高阈值';
    let sentMax = 0;
    try {
      sentMax = parseInt(sessionStorage.getItem(SS_KEY) ?? '0', 10) || 0;
    } catch {}
    // 2.0.29 改: 文案去掉具体数值(toast 显示值和游戏 UI 不一致混淆玩家)。
    // 改为 4 档纯状态描述递进: 起疑 → 累积 → 察觉 → 危急。
    const HINTS: Array<{
      threshold: number;
      level: 'info' | 'warning' | 'error';
      title: string;
      body: string;
    }> = [
      {
        threshold: 30,
        level: 'info',
        title: '云霜凝·提示',
        body: '⚠ 苗广开始起疑。建议尽早谋划，设法将其疑心转化为绿帽值。',
      },
      {
        threshold: 40,
        level: 'info',
        title: '云霜凝·警告',
        body: '⚠⚠ 苗广疑心持续累积。转化窗口正在收紧，请尽快行动。',
      },
      {
        threshold: 50,
        level: 'warning',
        title: '云霜凝·紧急警告',
        body: '⚠⚠⚠ 苗广疑心已到关键节点！立刻寻机将疑心转化为绿帽值，错过此时机将极难挽回。',
      },
      { threshold: 60, level: 'error', title: '云霜凝·危急', body: '🚨 危急！苗广愤怒一触即发，再不转化必致坏结局！' },
    ];
    for (const h of HINTS) {
      if (oldSusp < h.threshold && newSusp >= h.threshold && sentMax < h.threshold) {
        try {
          sessionStorage.setItem(SS_KEY, String(h.threshold));
        } catch {}
        try {
          const _top = (window.parent ?? window) as any;
          _top.toastr?.[h.level]?.(h.body, h.title, { timeOut: 12000, extendedTimeOut: 5000 });
        } catch {}
        console.info(`[状态验证] 绿帽值提醒触发: 疑心值跨越 ${h.threshold}(${oldSusp}→${newSusp})`);
        break;
      }
    }
  }

  // 返回 freezeBaseline（新创建或透传），由 index.ts 管理生命周期
  return freezeBaseline ?? null;
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
  阶段?: number; // 治疗阶段 ≥
  防线?: number; // 心理防线 ≤
  信任度?: number; // 信任度 ≥
  胸部开发?: number; // 胸部开发 ≥
  小屄开发?: number; // 小屄开发 ≥
  屁穴开发?: number; // 屁穴开发 ≥
  小嘴开发?: number; // 小嘴开发 ≥
  苗广心态?: string[]; // 苗广心态 ∈
  装备任一?: string[]; // 任一装备处于"使用中"
  千晶幻术完成?: boolean; // 千晶幻术3次完成（认知改写完成）
  千晶幻术未完成?: boolean; // 千晶幻术未完成（认知改写未完成）
  需完成场景?: string[]; // 需要已完成的特殊场景
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
  素色道袍: { 阶段: 3 },
  宽领道袍: { 阶段: 3 },
  轻纱罩衫: { 阶段: 4 },
  露肩薄衫: { 阶段: 4 },
  交领短衫: { 阶段: 5 },
  肚兜: { 阶段: 5 },
  绑带胸衣: { 阶段: 7 },
  镂空纱衣: { 阶段: 7 },
  乳贴缎带: { 阶段: 9 },
  锁链胸饰: { 阶段: 9 },
  // ── 装备：下装 ──
  百褶长裙: { 阶段: 3 },
  开叉长裙: { 阶段: 3 },
  灵纱短裙: { 阶段: 4 },
  高开叉裙: { 阶段: 4 },
  灵纱超短裙: { 阶段: 5 },
  腰链遮片: { 阶段: 5 },
  系带围裙: { 阶段: 7 },
  透纱长裙: { 阶段: 7 },
  腰链吊坠: { 阶段: 9 },
  灵纱飘带: { 阶段: 9 },
  // ── 装备：内衣 ──
  丝绸抹胸: { 阶段: 3 },
  蕾丝胸衣: { 阶段: 3 },
  半杯胸衣: { 阶段: 4 },
  情趣胸衣: { 阶段: 4 },
  镂空胸衣: { 阶段: 5 },
  乳贴: { 阶段: 5 },
  透明胸纱: { 阶段: 7 },
  链式乳饰: { 阶段: 7 },
  乳环吊链: { 阶段: 9 },
  灵纹乳贴: { 阶段: 9 },
  // ── 装备：内裤 ──
  丝绸亵裤: { 阶段: 3 },
  蕾丝内裤: { 阶段: 3 },
  蝴蝶结系带裤: { 阶段: 4 },
  丁字裤: { 阶段: 4 },
  珍珠内裤: { 阶段: 5 },
  开裆内裤: { 阶段: 5 },
  系带丁字裤: { 阶段: 7 },
  透明蕾丝裤: { 阶段: 7 },
  链饰丁字裤: { 阶段: 9 },
  灵纹系带: { 阶段: 9 },
  // ── 装备：特殊配饰 ──
  脚链铃铛: { 阶段: 3 },
  红绳: { 阶段: 3 },
  大腿皮环: { 阶段: 4 },
  乳环挂饰: { 阶段: 4 },
  精液项链: { 阶段: 5 },
  阴蒂夹坠: { 阶段: 5 },
  名字阴环: { 阶段: 7 },
  精液耳坠: { 阶段: 7 },
  子宫纹章: { 阶段: 9 },
  双穴珠链: { 阶段: 9 },

  // ── 装备：身体器具（需阶段门槛：早期身体寒毒严重无法承受器具）──
  眼罩: { 阶段: 3, 防线: 70, 信任度: 15 },
  乳夹: { 阶段: 4, 防线: 65, 胸部开发: 40, 信任度: 25 },
  口枷: { 阶段: 4, 防线: 65, 小嘴开发: 40, 信任度: 25 },
  肛塞: { 阶段: 5, 防线: 60, 屁穴开发: 40, 信任度: 20 },
  缚灵缎: { 阶段: 4, 防线: 60, 信任度: 30 },
  震动器: { 阶段: 5, 防线: 50, 小屄开发: 50, 信任度: 35 },
  项圈: { 阶段: 7, 防线: 20, 信任度: 60 },
  肉棒口罩: { 阶段: 5, 小嘴开发: 40 },

  // ── 装备：环境类（暖玉佩从辅助灵物移到此处）──
  // 暖玉佩 无门槛，普通的温暖灵物

  // ── 洛书晴专属消耗品（方式2注入型，仅阶段1-2有效，阶段3+脚本自动失效）──
  安抚符: {},
  真心符: {},

  // ── 永久体改 ──
  '丰胸灵乳丹·中': { 阶段: 3, 胸部开发: 30 },
  '丰胸灵乳丹·大': { 阶段: 4, 胸部开发: 50 },
  '丰胸灵乳丹·极': { 阶段: 6, 胸部开发: 70 },
  丰臀圆玉丹: { 阶段: 3, 屁穴开发: 30 },
  乳环: { 阶段: 4, 胸部开发: 40 },
  阴环: { 阶段: 4, 小屄开发: 40 },
  淫纹刻印: { 阶段: 4, 防线: 50 },

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
  千晶幻术: { 阶段: 7, 苗广心态: ['屈辱', '默许', '沉溺'], 需完成场景: ['寝取宣告'] },

  // ── 特殊场景 ──
  镜前调教: { 阶段: 4, 防线: 50 },
  夫前凌辱: { 阶段: 5, 苗广心态: ['屈辱', '默许', '沉溺'], 装备任一: ['影绰纱帘', '透灵幔'] },
  寝取宣告: { 阶段: 7, 苗广心态: ['默许', '沉溺'], 装备任一: ['透灵幔'], 需完成场景: ['夫前凌辱'] },
  绿帽奴调教: { 阶段: 7, 苗广心态: ['沉溺'], 需完成场景: ['寝取宣告'], 千晶幻术未完成: true },
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
  if (cond.千晶幻术未完成 && data.苗广.千晶幻术.认知改写完成) return false;
  if (cond.需完成场景 !== undefined) {
    const done = data._已完成特殊场景;
    if (!cond.需完成场景.every(s => !!done[s])) return false;
  }

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
  if (cond.千晶幻术未完成) parts.push('千晶幻术未完成');
  if (cond.需完成场景 !== undefined) parts.push(`需完成[${cond.需完成场景.join('+')}]`);

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
  素色道袍: 8,
  宽领道袍: 12,
  轻纱罩衫: 18,
  露肩薄衫: 25,
  交领短衫: 35,
  肚兜: 45,
  绑带胸衣: 60,
  镂空纱衣: 75,
  乳贴缎带: 90,
  锁链胸饰: 110,
  // 装备：下装
  百褶长裙: 8,
  开叉长裙: 12,
  灵纱短裙: 18,
  高开叉裙: 25,
  灵纱超短裙: 35,
  腰链遮片: 45,
  系带围裙: 60,
  透纱长裙: 75,
  腰链吊坠: 90,
  灵纱飘带: 110,
  // 装备：内衣
  丝绸抹胸: 8,
  蕾丝胸衣: 12,
  半杯胸衣: 18,
  情趣胸衣: 25,
  镂空胸衣: 35,
  乳贴: 45,
  透明胸纱: 60,
  链式乳饰: 75,
  乳环吊链: 90,
  灵纹乳贴: 110,
  // 装备：内裤
  丝绸亵裤: 8,
  蕾丝内裤: 12,
  蝴蝶结系带裤: 18,
  丁字裤: 25,
  珍珠内裤: 35,
  开裆内裤: 45,
  系带丁字裤: 60,
  透明蕾丝裤: 75,
  链饰丁字裤: 90,
  灵纹系带: 110,
  // 装备：特殊配饰
  脚链铃铛: 10,
  红绳: 15,
  大腿皮环: 22,
  乳环挂饰: 30,
  精液项链: 40,
  阴蒂夹坠: 50,
  名字阴环: 65,
  精液耳坠: 85,
  子宫纹章: 100,
  双穴珠链: 120,

  // 装备：身体器具
  乳夹: 50,
  肛塞: 60,
  震动器: 80,
  口枷: 55,
  缚灵缎: 70,
  眼罩: 45,
  项圈: 90,
  肉棒口罩: 350,

  // 装备：环境类（暖玉佩移到此类）

  // 洛书晴专属消耗品
  安抚符: 30,
  真心符: 40,

  // 永久体改
  '丰胸灵乳丹·中': 150,
  '丰胸灵乳丹·大': 250,
  '丰胸灵乳丹·极': 400,
  丰臀圆玉丹: 200,
  乳环: 300,
  阴环: 300,
  淫纹刻印: 250,

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
