/**
 * 道具数据依赖声明（道具系统 v2 重构 · 2.0.20）
 *
 * 每件"state-aware 道具"在此声明它"关心的字段"。脚本根据声明：
 * 1. 生成本楼动态状态快照时，只输出这些字段的并集（其他一概屏蔽）
 * 2. itemNarrativeBuildersV2 按这些字段挑选文案档位（3 档制）
 *
 * 核心设计（用户确认）：
 * - 3 档文案粒度（初期 / 中期 / 后期）
 * - 双角色独立文案（云霜凝 / 洛书晴 完全不复用）
 * - per-item 字段声明，动态快照只显示本楼道具相关的字段
 * - thirdParty 字段路由：云→苗广，洛→苗喧（对称）
 * - 全局保留：_当前场景角色 + 监视期状态（永不屏蔽）
 *
 * 见 memory/project_spec_道具系统v2重构.md 完整设计
 */

// ──────────────────────────────────────────
// 字段类型
// ──────────────────────────────────────────

export type DevTier = 'early' | 'mid' | 'deep';
export type DefenseTier = 'high' | 'mid' | 'low';
export type TrustTier = 'low' | 'mid' | 'high';
export type StageTier = 'early' | 'mid' | 'deep';

export type CharTarget = '云霜凝' | '洛书晴';

export interface ItemDataDep {
  /** 主要身体部位（挑一个最相关的） */
  bodyPart?: '小嘴' | '胸部' | '小屄' | '屁穴';
  /** 相关的肉体改造项（1~2 项） */
  bodyMods?: Array<'胸部罩杯' | '乳环' | '阴环' | '丰臀' | '淫纹'>;
  /** 相关的服装槽位 */
  clothingSlots?: Array<'上装' | '下装' | '内衣' | '内裤' | '特殊配饰'>;
  /** 心理数值 */
  psych?: Array<'信任度' | '心理防线' | '顺从度'>;
  /** 是否关心治疗/调教阶段 */
  stage?: boolean;
  /** 是否关心第三方（云→苗广，洛→苗喧） */
  thirdParty?: boolean;
  /** 是否参考当前性癖列表（配合触发条件强化） */
  kinkList?: boolean;
}

// ──────────────────────────────────────────
// Tier 映射函数（和现有 getDevLevel 阈值对齐）
// ──────────────────────────────────────────

/** 身体开发数值 0-100 → 3 档（对齐 getDevLevel: 0-19 Lv0 / 20-39 Lv1 / 40-59 Lv2 / 60-79 Lv3 / 80+ Lv4） */
export function getDevTier(value: number): DevTier {
  if (value >= 80) return 'deep';
  if (value >= 40) return 'mid';
  return 'early';
}

/** 心理防线 0-100 → 3 档（高 61-100 抗拒 / 中 21-60 动摇 / 低 0-20 崩溃） */
export function getDefenseTier(value: number): DefenseTier {
  if (value >= 61) return 'high';
  if (value >= 21) return 'mid';
  return 'low';
}

/** 信任度 0-100 → 3 档（低 0-29 / 中 30-69 / 高 70-100） */
export function getTrustTier(value: number): TrustTier {
  if (value >= 70) return 'high';
  if (value >= 30) return 'mid';
  return 'low';
}

/** 顺从度（洛书晴专属）0-100 → 3 档 */
export function getSubmissionTier(value: number): TrustTier {
  if (value >= 70) return 'high';
  if (value >= 30) return 'mid';
  return 'low';
}

/** 治疗/调教阶段 1-10 → 3 档（早 1-4 / 中 5-7 / 深 8-10） */
export function getStageTier(stage: number): StageTier {
  if (stage >= 8) return 'deep';
  if (stage >= 5) return 'mid';
  return 'early';
}

// ──────────────────────────────────────────
// 每道具的字段声明
// ──────────────────────────────────────────

export const ITEM_DATA_DEPS: Record<string, ItemDataDep> = {
  // ═══ 身体器具（9 件） ═══
  乳夹: {
    bodyPart: '胸部',
    bodyMods: ['乳环', '胸部罩杯'],
    clothingSlots: ['上装', '内衣'],
    psych: ['心理防线'],
  },
  肛塞: {
    bodyPart: '屁穴',
    clothingSlots: ['下装', '内裤'],
    psych: ['心理防线'],
  },
  震动器: {
    bodyPart: '小屄',
    bodyMods: ['阴环'],
    clothingSlots: ['下装', '内裤'],
    psych: ['心理防线'],
  },
  口枷: {
    bodyPart: '小嘴',
    psych: ['心理防线'],
  },
  缚灵缎: {
    psych: ['心理防线', '信任度'],
    stage: true,
  },
  眼罩: {
    psych: ['心理防线', '信任度'],
  },
  项圈: {
    psych: ['心理防线', '信任度'],
    stage: true,
  },
  暖玉佩: {
    psych: ['信任度'],
    stage: true,
  },
  肉棒口罩: {
    bodyPart: '小嘴',
    psych: ['心理防线'],
    stage: true,
  },

  // ═══ 环境装备（5 件） ═══
  锚神钉: {
    psych: ['心理防线'],
    // 神魂空间专用，不需要第三方
  },
  影绰纱帘: {
    thirdParty: true,
    psych: ['心理防线'],
  },
  透灵幔: {
    thirdParty: true,
    psych: ['心理防线'],
  },
  隔音灵阵: {
    thirdParty: true,
  },
  净灵铃: {
    thirdParty: true,
    stage: true,
  },

  // ═══ 体改（7 件） ═══
  '丰胸灵乳丹·中': {
    bodyMods: ['胸部罩杯'],
    psych: ['心理防线'],
    stage: true,
  },
  '丰胸灵乳丹·大': {
    bodyMods: ['胸部罩杯'],
    psych: ['心理防线'],
    stage: true,
  },
  '丰胸灵乳丹·极': {
    bodyMods: ['胸部罩杯'],
    psych: ['心理防线'],
    stage: true,
  },
  丰臀圆玉丹: {
    bodyMods: ['丰臀'],
    psych: ['心理防线'],
    stage: true,
  },
  乳环: {
    bodyPart: '胸部',
    psych: ['心理防线'],
    stage: true,
  },
  阴环: {
    bodyPart: '小屄',
    psych: ['心理防线'],
    stage: true,
  },
  淫纹刻印: {
    bodyMods: ['淫纹'],
    psych: ['心理防线'],
    stage: true,
  },

  // ═══ 性癖觉醒（20 件） ═══
  // 所有性癖觉醒文案都走"3 档 × tone register"（早期仪式感 / 中期矛盾 / 后期俏皮）
  阿黑颜体质: {
    psych: ['心理防线', '信任度'],
    stage: true,
    kinkList: true,
  },
  潮喷体质: {
    bodyPart: '小屄',
    psych: ['心理防线'],
    stage: true,
  },
  母乳体质: {
    bodyPart: '胸部',
    bodyMods: ['胸部罩杯'],
    psych: ['心理防线'],
    stage: true,
  },
  露出嗜好: {
    psych: ['心理防线', '信任度'],
    stage: true,
    thirdParty: true,
  },
  寝取快感: {
    psych: ['心理防线'],
    stage: true,
    thirdParty: true,
  },
  哦齁齁体质: {
    psych: ['心理防线'],
    stage: true,
  },
  骚话淫语: {
    psych: ['心理防线', '信任度'],
    stage: true,
  },
  隐奸行为: {
    psych: ['心理防线'],
    thirdParty: true,
    stage: true,
  },
  尿饮嗜好: {
    bodyPart: '小嘴',
    psych: ['心理防线'],
    stage: true,
  },
  母爱泛滥: {
    psych: ['信任度'],
    stage: true,
  },
  舔肛嗜好: {
    bodyPart: '屁穴',
    psych: ['心理防线'],
    stage: true,
  },
  受虐嗜好: {
    psych: ['心理防线'],
    stage: true,
  },
  精液标记: {
    psych: ['心理防线'],
    stage: true,
  },
  口奴体质: {
    bodyPart: '小嘴',
    psych: ['心理防线'],
    stage: true,
  },
  肛交嗜好: {
    bodyPart: '屁穴',
    psych: ['心理防线'],
    stage: true,
  },
  物化认知: {
    psych: ['心理防线', '信任度'],
    stage: true,
  },
  痴女化: {
    psych: ['心理防线'],
    stage: true,
  },
  身体书写: {
    psych: ['心理防线'],
    stage: true,
  },
  窒息快感: {
    psych: ['心理防线'],
    stage: true,
  },
  精液面膜: {
    psych: ['心理防线'],
    stage: true,
  },
  傻白甜: {
    psych: ['心理防线'],
    stage: true,
  },

  // ═══ 非静默消耗品（3 件） ═══
  安神香: {
    psych: ['信任度'],
  },
  蚀心露: {
    thirdParty: true,
    psych: ['心理防线'],
    stage: true,
  },
  神魂共鸣石: {
    psych: ['信任度'],
    stage: true,
  },

  // ═══ 静默消耗品（不走 v2 剧情系统，保持静默）═══
  // 定心符 / 混沌珠 / 安抚符 / 真心符 故意不在此处声明，
  // 走现有 itemEventMap 或完全静默路径。

  // ═══ 服装 ═══
  // 服装 60+ 件走通用模板（见 itemNarrativeBuildersV2 的 buildClothingGiftEvent），
  // 不在此处每件单独声明。通用模板关心：
  //   - 身体部位（根据槽位推断：上装/内衣→胸部，下装/内裤→屁穴/小屄）
  //   - 心理防线
  //   - 当前穿着的同槽位道具（替换前后对比）
  //   - 是否已有累积赠礼（"第一次收到 vs 第 N 次"）

  // ═══ 特殊配饰 ═══
  // 配饰 10 件走部分共用模板 + 轻度 per-item 定制。同样不在此处声明。
};

// ──────────────────────────────────────────
// Helper: 是否为 v2 state-aware 道具
// ──────────────────────────────────────────

export function isStateAwareItem(name: string): boolean {
  return name in ITEM_DATA_DEPS;
}

// ──────────────────────────────────────────
// Helper: 合并多个道具的 data deps → 动态快照字段集
// ──────────────────────────────────────────

export interface SnapshotFocusFields {
  /** 要显示的身体部位 */
  bodyParts: Set<'小嘴' | '胸部' | '小屄' | '屁穴'>;
  /** 要显示的肉体改造项 */
  bodyMods: Set<string>;
  /** 要显示的服装槽位 */
  clothingSlots: Set<string>;
  /** 要显示的心理数值 */
  psych: Set<'信任度' | '心理防线' | '顺从度'>;
  /** 是否显示阶段 */
  showStage: boolean;
  /** 是否显示第三方（苗广或苗喧）状态 */
  showThirdParty: boolean;
  /** 是否显示性癖列表 */
  showKinkList: boolean;
  /** 涉及的目标角色集合 */
  targets: Set<CharTarget>;
}

/**
 * 从本楼道具列表构建"动态快照焦点字段集"。
 * 未知道具（不在 ITEM_DATA_DEPS 里）会导致 fallback（显示全量快照）——
 * 调用方决定是否 fallback，此函数只收集已知字段。
 *
 * 道具名可能带 "洛书晴·" 前缀，此函数自动 strip 并记录 target。
 */
export function collectFocusFields(itemNames: string[]): SnapshotFocusFields | null {
  const focus: SnapshotFocusFields = {
    bodyParts: new Set(),
    bodyMods: new Set(),
    clothingSlots: new Set(),
    psych: new Set(),
    showStage: false,
    showThirdParty: false,
    showKinkList: false,
    targets: new Set(),
  };

  let allKnown = true;

  for (const rawName of itemNames) {
    // 过滤内部系统事件
    if (rawName.startsWith('__') && rawName.endsWith('__')) continue;
    // 过滤换装/卸下等特殊前缀
    if (rawName.startsWith('换装:') || rawName.startsWith('卸下:') || rawName.startsWith('卸下服装:')) continue;
    if (rawName.startsWith('洛书晴·卸下:') || rawName.startsWith('洛书晴·卸下服装:')) continue;

    let name = rawName;
    if (rawName.startsWith('洛书晴·')) {
      name = rawName.slice('洛书晴·'.length);
      focus.targets.add('洛书晴');
    } else {
      focus.targets.add('云霜凝');
    }

    // 淫纹刻印带位置前缀："淫纹刻印·腰腹·淫"
    const coreName = name.startsWith('淫纹刻印·') ? '淫纹刻印' : name;

    const dep = ITEM_DATA_DEPS[coreName];
    if (!dep) {
      allKnown = false;
      continue;
    }

    if (dep.bodyPart) focus.bodyParts.add(dep.bodyPart);
    if (dep.bodyMods) dep.bodyMods.forEach(m => focus.bodyMods.add(m));
    if (dep.clothingSlots) dep.clothingSlots.forEach(s => focus.clothingSlots.add(s));
    if (dep.psych) dep.psych.forEach(p => focus.psych.add(p));
    if (dep.stage) focus.showStage = true;
    if (dep.thirdParty) focus.showThirdParty = true;
    if (dep.kinkList) focus.showKinkList = true;
  }

  // 如果有任何未知道具（比如静默消耗品 混沌珠 / 定心符），
  // 或焦点字段集为空（e.g. 只有内部事件），返回 null 让调用方 fallback
  if (!allKnown || focus.targets.size === 0) return null;

  return focus;
}
