import type { Schema as SchemaType } from '../../schema';

/**
 * 商店系统 v2
 *
 * 五类道具：
 *   1. 消耗品（即时效果）→ 立即改变变量，道具消耗，注入叙事事件
 *   2. 装备类（toggle切换）→ 已购买↔使用中，支持互斥组，持续注入AI标签
 *   3. 永久体改类 → 写入 云霜凝.肉体改造，道具消耗，触发改造仪式AI回复
 *   4. 永久性癖类 → 写入 云霜凝.性癖列表，道具消耗，触发觉醒场景AI回复
 *   5. 特殊场景触发类 → 启动 _特殊场景 状态机，道具消耗
 *
 * 调用时机：
 *   processNewlyActivatedItems → VARIABLE_UPDATE_ENDED（检测道具状态变化）
 *   processEquipmentUnequip    → VARIABLE_UPDATE_ENDED（检测装备卸下）
 *   tickEquipmentEffects       → VARIABLE_UPDATE_ENDED（装备每轮数值效果）
 *   tickTemporaryItems         → MESSAGE_RECEIVED（场景临时道具计数递减）
 */

// ────────────────────────────────────────────
// 消耗品：冷却表（楼层数）
// ────────────────────────────────────────────

const CONSUMABLE_COOLDOWN: Record<string, number> = {
  安神香: 11,
  蚀心露: 15,
  定心符: 15,
  混沌珠: 30,
  神魂共鸣石: 9,
};

// ────────────────────────────────────────────
// 消耗品：即时效果
// ────────────────────────────────────────────

export const INSTANT_EFFECTS: Record<string, (data: SchemaType) => void> = {
  安神香: data => {
    data.云霜凝.心理防线 = Math.max(0, data.云霜凝.心理防线 - 3);
    console.info(`[商店] 安神香：心理防线 -3 → ${data.云霜凝.心理防线}`);
  },
  蚀心露: data => {
    // 显性效果：防线-3, 信任+3, 疑心+3
    data.云霜凝.心理防线 = Math.max(0, data.云霜凝.心理防线 - 3);
    data.云霜凝.信任度 = Math.min(100, data.云霜凝.信任度 + 3);
    data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + 3);
    console.info(`[商店] 蚀心露：防线 -3 → ${data.云霜凝.心理防线}，信任 +3 → ${data.云霜凝.信任度}，疑心 +3 → ${data.苗广.疑心值}`);

    // 隐藏效果：察觉 + 隔音灵阵 + 未触发过 → 屈辱跳转
    if (
      data.苗广.心态 === '察觉' &&
      data.系统.道具状态['隔音灵阵'] === '使用中' &&
      !data._已触发蚀心露屈辱
    ) {
      data._已触发蚀心露屈辱 = true;
      data.苗广.心态 = '屈辱';
      data.苗广.疑心值 = 0;  // 重置为0（后半程从0开始计为绿帽值）
      // 写入方式3事件：立即触发AI描写苗广心态转变
      const existing = data._待发送道具事件;
      const event = '__蚀心露屈辱转变__';
      data._待发送道具事件 = existing ? existing + '|||' + event : event;
      console.info('[商店] ⚡ 蚀心露隐藏效果触发！苗广心态→屈辱，疑心值→0');
    }
  },
  定心符: data => {
    data.苗广.疑心值 = Math.max(0, data.苗广.疑心值 - 8);
    console.info(`[商店] 定心符：苗广疑心值 -8 → ${data.苗广.疑心值}`);
  },
  混沌珠: data => {
    // 仅屈辱前有效：疑心值降至当前心态区间下限
    const 心态 = data.苗广.心态;
    if (心态 === '屈辱' || 心态 === '默许' || 心态 === '沉溺') {
      console.warn('[商店] 混沌珠：屈辱后无效，不执行');
      return;
    }
    // 察觉(50~70)→50, 疑惑(25~50)→25, 正常(0~25)→0
    if (心态 === '察觉') data.苗广.疑心值 = 50;
    else if (心态 === '疑惑') data.苗广.疑心值 = 25;
    else data.苗广.疑心值 = 0;
    console.info(`[商店] 混沌珠：疑心值降至区间下限 → ${data.苗广.疑心值}`);
  },
  神魂共鸣石: data => {
    data.云霜凝.信任度 = Math.min(100, data.云霜凝.信任度 + 5);
    console.info(`[商店] 神魂共鸣石：信任度 +5 → ${data.云霜凝.信任度}`);
  },
};

/** 消耗品名称集合（供前端过滤用） */
export const CONSUMABLE_NAMES = new Set(Object.keys(INSTANT_EFFECTS));

// ────────────────────────────────────────────
// 装备类：互斥组定义
// ────────────────────────────────────────────

/** 互斥组：同组内只能有一个处于"使用中" */
const EXCLUSIVE_GROUPS: Record<string, string[]> = {
  视觉环境: ['影绰纱帘', '透灵幔'],
  上装: ['素色道袍', '宽领道袍', '轻纱罩衫', '露肩薄衫', '交领短衫', '肚兜', '绑带胸衣', '镂空纱衣', '乳贴缎带', '锁链胸饰'],
  下装: ['百褶长裙', '开叉长裙', '灵纱短裙', '高开叉裙', '灵纱超短裙', '腰链遮片', '系带围裙', '透纱长裙', '腰链吊坠', '灵纱飘带'],
  内衣: ['丝绸抹胸', '蕾丝胸衣', '半杯胸衣', '情趣胸衣', '镂空胸衣', '乳贴', '透明胸纱', '链式乳饰', '乳环吊链', '灵纹乳贴'],
  内裤: ['丝绸亵裤', '蕾丝内裤', '蝴蝶结系带裤', '丁字裤', '珍珠内裤', '开裆内裤', '系带丁字裤', '透明蕾丝裤', '链饰丁字裤', '灵纹系带'],
  特殊配饰: ['脚链铃铛', '红绳', '大腿皮环', '乳环挂饰', '精液项链', '阴蒂夹坠', '名字阴环', '精液耳坠', '子宫纹章', '双穴珠链'],
  // 三把锁不互斥，可同时使用（设计文档第五节）
};

/** 判断是否为留影石道具 */
function isLiuyingshi(name: string): boolean {
  return name === '留影石' || name.startsWith('留影石_');
}


/** 所有装备类道具名（用于判断是否为装备） */
const ALL_EQUIPMENT: Set<string> = new Set([
  // 环境布置
  '锚神钉', '影绰纱帘', '透灵幔', '隔音灵阵', '净灵铃',
  // 上装（10件）
  '素色道袍', '宽领道袍', '轻纱罩衫', '露肩薄衫', '交领短衫', '肚兜', '绑带胸衣', '镂空纱衣', '乳贴缎带', '锁链胸饰',
  // 下装（10件）
  '百褶长裙', '开叉长裙', '灵纱短裙', '高开叉裙', '灵纱超短裙', '腰链遮片', '系带围裙', '透纱长裙', '腰链吊坠', '灵纱飘带',
  // 内衣（10件）
  '丝绸抹胸', '蕾丝胸衣', '半杯胸衣', '情趣胸衣', '镂空胸衣', '乳贴', '透明胸纱', '链式乳饰', '乳环吊链', '灵纹乳贴',
  // 内裤（10件）
  '丝绸亵裤', '蕾丝内裤', '蝴蝶结系带裤', '丁字裤', '珍珠内裤', '开裆内裤', '系带丁字裤', '透明蕾丝裤', '链饰丁字裤', '灵纹系带',
  // 特殊配饰（10件）
  '脚链铃铛', '红绳', '大腿皮环', '乳环挂饰', '精液项链', '阴蒂夹坠', '名字阴环', '精液耳坠', '子宫纹章', '双穴珠链',
  // 身体器具
  '乳夹', '肛塞', '震动器', '口枷', '缚灵缎', '眼罩', '项圈', '肉棒口罩',
  // 辅助灵物
  '暖玉佩', '寒心锁', '破心锁', '断情锁',
]);

/** 服装道具→槽位映射 */
type ClothingSlot = '上装' | '下装' | '内衣' | '内裤' | '特殊配饰';
export const CLOTHING_SLOT: Record<string, ClothingSlot> = {
  // 上装（10件）
  素色道袍: '上装', 宽领道袍: '上装', 轻纱罩衫: '上装', 露肩薄衫: '上装', 交领短衫: '上装',
  肚兜: '上装', 绑带胸衣: '上装', 镂空纱衣: '上装', 乳贴缎带: '上装', 锁链胸饰: '上装',
  // 下装（10件）
  百褶长裙: '下装', 开叉长裙: '下装', 灵纱短裙: '下装', 高开叉裙: '下装', 灵纱超短裙: '下装',
  腰链遮片: '下装', 系带围裙: '下装', 透纱长裙: '下装', 腰链吊坠: '下装', 灵纱飘带: '下装',
  // 内衣（10件）
  丝绸抹胸: '内衣', 蕾丝胸衣: '内衣', 半杯胸衣: '内衣', 情趣胸衣: '内衣', 镂空胸衣: '内衣',
  乳贴: '内衣', 透明胸纱: '内衣', 链式乳饰: '内衣', 乳环吊链: '内衣', 灵纹乳贴: '内衣',
  // 内裤（10件）
  丝绸亵裤: '内裤', 蕾丝内裤: '内裤', 蝴蝶结系带裤: '内裤', 丁字裤: '内裤', 珍珠内裤: '内裤',
  开裆内裤: '内裤', 系带丁字裤: '内裤', 透明蕾丝裤: '内裤', 链饰丁字裤: '内裤', 灵纹系带: '内裤',
  // 特殊配饰（10件）
  脚链铃铛: '特殊配饰', 红绳: '特殊配饰', 大腿皮环: '特殊配饰', 乳环挂饰: '特殊配饰', 精液项链: '特殊配饰',
  阴蒂夹坠: '特殊配饰', 名字阴环: '特殊配饰', 精液耳坠: '特殊配饰', 子宫纹章: '特殊配饰', 双穴珠链: '特殊配饰',
};

/** 每件服装的暴露分数（设计文档第六节，5槽位总分制） */
const CLOTHING_EXPOSURE_SCORE: Record<string, number> = {
  // 上装
  素色道袍: 1, 宽领道袍: 2, 轻纱罩衫: 3, 露肩薄衫: 4, 交领短衫: 5,
  肚兜: 6, 绑带胸衣: 7, 镂空纱衣: 8, 乳贴缎带: 9, 锁链胸饰: 10,
  // 下装
  百褶长裙: 1, 开叉长裙: 2, 灵纱短裙: 3, 高开叉裙: 4, 灵纱超短裙: 5,
  腰链遮片: 6, 系带围裙: 7, 透纱长裙: 8, 腰链吊坠: 9, 灵纱飘带: 10,
  // 内衣
  丝绸抹胸: 1, 蕾丝胸衣: 2, 半杯胸衣: 3, 情趣胸衣: 4, 镂空胸衣: 5,
  乳贴: 6, 透明胸纱: 7, 链式乳饰: 8, 乳环吊链: 9, 灵纹乳贴: 10,
  // 内裤
  丝绸亵裤: 1, 蕾丝内裤: 2, 蝴蝶结系带裤: 3, 丁字裤: 4, 珍珠内裤: 5,
  开裆内裤: 6, 系带丁字裤: 7, 透明蕾丝裤: 8, 链饰丁字裤: 9, 灵纹系带: 10,
  // 特殊配饰（分数偏高）
  脚链铃铛: 2, 红绳: 3, 大腿皮环: 4, 乳环挂饰: 5, 精液项链: 6,
  阴蒂夹坠: 7, 名字阴环: 8, 精液耳坠: 9, 子宫纹章: 10, 双穴珠链: 11,
};

/** 槽位默认值 */
const SLOT_DEFAULTS: Record<ClothingSlot, string> = {
  上装: '寒霜门道袍', 下装: '寒霜门长裙', 内衣: '素白抹胸', 内裤: '素白亵裤', 特殊配饰: '无',
};

/** 暴露等级：总分→等级映射（设计文档第六节） */
const EXPOSURE_LEVELS: { threshold: number; level: SchemaType['云霜凝']['服装']['暴露程度'] }[] = [
  { threshold: 38, level: '极露' },
  { threshold: 29, level: '大露' },
  { threshold: 20, level: '半露' },
  { threshold: 11, level: '轻露' },
  { threshold: 1,  level: '微露' },
];

/** 根据5个槽位总分计算暴露程度 */
function calcExposure(data: SchemaType): SchemaType['云霜凝']['服装']['暴露程度'] {
  const s = CLOTHING_EXPOSURE_SCORE;
  const total =
    (s[data.云霜凝.服装.上装] ?? 0) +
    (s[data.云霜凝.服装.下装] ?? 0) +
    (s[data.云霜凝.服装.内衣] ?? 0) +
    (s[data.云霜凝.服装.内裤] ?? 0) +
    (s[data.云霜凝.服装.特殊配饰] ?? 0);
  if (total === 0) return '遮蔽';
  for (const { threshold, level } of EXPOSURE_LEVELS) {
    if (total >= threshold) return level;
  }
  return '微露';
}

// ────────────────────────────────────────────
// 永久体改类
// ────────────────────────────────────────────

const BODY_MOD_EFFECTS: Record<string, (data: SchemaType) => void> = {
  '丰胸灵乳丹·中': data => { data.云霜凝.肉体改造.胸部 = 'E罩杯'; },
  '丰胸灵乳丹·大': data => { data.云霜凝.肉体改造.胸部 = 'G罩杯'; },
  '丰胸灵乳丹·极': data => { data.云霜凝.肉体改造.胸部 = 'H罩杯'; },
  丰臀圆玉丹: data => { data.云霜凝.肉体改造.臀部 = '丰满'; },
  乳环: data => { data.云霜凝.肉体改造.乳环 = true; },
  阴环: data => { data.云霜凝.肉体改造.阴环 = true; },
  堕落烙印: data => { data.云霜凝.肉体改造.堕落烙印 = true; },
};

// 淫纹刻印特殊处理：需要位置参数，在 processNewlyActivatedItems 中单独处理

// ────────────────────────────────────────────
// 永久性癖类
// ────────────────────────────────────────────

/** 性癖道具 → { 性癖名, AI行为指令 }；最多3个同时激活（道具状态='使用中'） */
export const KINK_ITEM_MAP: Record<string, { name: string; tag: string }> = {
  // ── 设计文档第八节最终20个性癖 ──
  阿黑颜体质: { name: '阿黑颜体质', tag: '高潮时面部失控——翻白眼、舌外伸、涎液溢出' },
  潮喷体质: { name: '潮喷体质', tag: '高强度刺激时阴道喷液，身体会不自觉追求能触发喷液的刺激强度' },
  母乳体质: { name: '母乳体质', tag: '胸部受刺激时分泌灵乳，胸部胀满时会不自觉渴望被触碰或吮吸来缓解' },
  露出嗜好: { name: '露出嗜好', tag: '有被他人发现的风险时，身体产生兴奋反应，会不自觉选择更容易暴露的姿势或位置' },
  寝取快感: { name: '寝取快感', tag: '涉及苗广的场景中快感显著增强，会不自觉做出加深背德感的行为' },
  哦齁齁体质: { name: '哦齁齁体质', tag: '激活后叙事切换为淫媚肉欲文言体，媚叫特征为"哦齁齁❤️"等' },
  骚话淫语: { name: '骚话淫语', tag: '日常对话中不自觉脱口淫秽词汇，说完才意识到，语言习惯被污染' },
  隐奸行为: { name: '隐奸行为', tag: '第三人在场时主动暗示或配合偷偷进行性行为，享受不被发现的刺激感' },
  尿饮嗜好: { name: '尿饮嗜好', tag: '对{{user}}的尿液产生渴望，会在适当时机主动索取或暗示' },
  母爱泛滥: { name: '母爱泛滥', tag: '将{{user}}视为需要照顾的孩子，称呼"儿子""孩子"，以母亲姿态主动哺育、拥抱' },
  舔肛嗜好: { name: '舔肛嗜好', tag: '对舔肛行为产生渴望，会在亲密场景中主动索取或暗示' },
  受虐嗜好: { name: '受虐嗜好', tag: '被打、掐、粗暴对待时产生快感，不自觉索求疼痛刺激，痛觉与快感混淆' },
  精液标记: { name: '精液标记', tag: '渴望被精液沾满身体，抗拒擦拭清理，将精液视为归属标记' },
  口奴体质: { name: '口奴体质', tag: '对口交/深喉产生依赖，嘴巴空闲时感到空虚，会不自觉靠近' },
  肛交嗜好: { name: '肛交嗜好', tag: '对肛交产生快感和渴望，会在亲密场景中主动暗示后穴的需求' },
  物化认知: { name: '物化认知', tag: '将自己视为{{user}}的所有物/道具，主动以物品自称，等待被"使用"' },
  痴女化: { name: '痴女化', tag: '从被动转为主动进攻，会不自觉诱惑、扑倒{{user}}，言语和肢体都变得大胆直接' },
  身体书写: { name: '身体书写', tag: '渴望被在身上写淫纹/标记文字，视为归属证明，主动展示身上的标记' },
  窒息快感: { name: '窒息快感', tag: '被掐住脖子或呼吸受限时快感倍增，会主动引导{{user}}的手到喉部' },
  精液面膜: { name: '精液面膜', tag: '渴望被射在脸上，临近高潮时主动要求颜射，精液覆面时表现出满足和陶醉' },
};

// ────────────────────────────────────────────
// 特殊场景触发类
// ────────────────────────────────────────────

/** 每阶段的轮次配置 */
interface StageTimingConfig {
  minTurns: number;
  maxTurns: number;
}

/** 特殊场景配置：场景名 → { 总阶段数, 每阶段轮次 } */
const SPECIAL_SCENE_CONFIG: Record<string, {
  totalStages: number;
  stages: Record<number, StageTimingConfig>;
}> = {
  镜前调教: {
    totalStages: 6,
    stages: {
      0: { minTurns: 2, maxTurns: 3 },
      1: { minTurns: 2, maxTurns: 4 },
      2: { minTurns: 2, maxTurns: 3 },
      3: { minTurns: 3, maxTurns: 5 },
      4: { minTurns: 2, maxTurns: 4 },
      5: { minTurns: 1, maxTurns: 3 },
    },
  },
  夫前凌辱: {
    totalStages: 6,
    stages: {
      0: { minTurns: 1, maxTurns: 2 },
      1: { minTurns: 2, maxTurns: 3 },
      2: { minTurns: 3, maxTurns: 5 },
      3: { minTurns: 2, maxTurns: 3 },
      4: { minTurns: 2, maxTurns: 4 },
      5: { minTurns: 1, maxTurns: 3 },
    },
  },
  寝取宣告: {
    totalStages: 5,
    stages: {
      0: { minTurns: 1, maxTurns: 2 },
      1: { minTurns: 2, maxTurns: 3 },
      2: { minTurns: 3, maxTurns: 5 },
      3: { minTurns: 2, maxTurns: 3 },
      4: { minTurns: 1, maxTurns: 3 },
    },
  },
  绿帽奴调教: {
    totalStages: 6,
    stages: {
      0: { minTurns: 1, maxTurns: 2 },
      1: { minTurns: 2, maxTurns: 3 },
      2: { minTurns: 3, maxTurns: 5 },
      3: { minTurns: 2, maxTurns: 3 },
      4: { minTurns: 2, maxTurns: 4 },
      5: { minTurns: 1, maxTurns: 2 },
    },
  },
  掌门改嫁: {
    totalStages: 6,
    stages: {
      0: { minTurns: 1, maxTurns: 2 },
      1: { minTurns: 2, maxTurns: 3 },
      2: { minTurns: 2, maxTurns: 4 },
      3: { minTurns: 2, maxTurns: 3 },
      4: { minTurns: 2, maxTurns: 4 },
      5: { minTurns: 1, maxTurns: 3 },
    },
  },
};

/** 获取特殊场景总阶段数（兼容旧接口） */
export function getSpecialSceneTotalStages(sceneName: string): number {
  return SPECIAL_SCENE_CONFIG[sceneName]?.totalStages ?? 0;
}

// ────────────────────────────────────────────
// 装备每轮数值效果（在 VARIABLE_UPDATE_ENDED 中调用）
// ────────────────────────────────────────────

/** 身体器具每轮开发加速 */
const EQUIPMENT_PER_TURN_BODY_DEV: Record<string, { part: keyof SchemaType['云霜凝']['身体开发']; amount: number }[]> = {
  乳夹: [{ part: '胸部', amount: 5 }],
  肛塞: [{ part: '屁穴', amount: 5 }],
  震动器: [{ part: '小屄', amount: 5 }],
  口枷: [{ part: '小嘴', amount: 5 }],
  眼罩: [{ part: '小嘴', amount: 3 }, { part: '胸部', amount: 3 }, { part: '小屄', amount: 3 }, { part: '屁穴', amount: 3 }],
};

/** 震动器额外每轮防线减少 */
const EQUIPMENT_PER_TURN_DEFENSE: Record<string, number> = {
  震动器: -2,
};

/** 暖玉佩每轮信任度+1 */
const EQUIPMENT_PER_TURN_TRUST: Record<string, number> = {
  暖玉佩: 1,
};

/** 隐藏效果：暖玉佩每轮疑心+2（不告知玩家） */
const EQUIPMENT_PER_TURN_SUSPICION: Record<string, number> = {
  暖玉佩: 2,
};

// ────────────────────────────────────────────
// 主逻辑
// ────────────────────────────────────────────

/**
 * 处理装备互斥：激活某装备时，同组其他装备自动卸下
 */
export function enforceExclusiveGroup(itemName: string, data: SchemaType): void {
  for (const [, group] of Object.entries(EXCLUSIVE_GROUPS)) {
    if (!group.includes(itemName)) continue;
    for (const other of group) {
      if (other !== itemName && data.系统.道具状态[other] === '使用中') {
        data.系统.道具状态[other] = '已购买';
        console.info(`[商店] 互斥卸下: ${other}`);
      }
    }
  }
}

/**
 * 装备激活时的副效果（更新服装槽位/妆容字段）
 */
function applyEquipSideEffects(itemName: string, data: SchemaType): void {
  // 服装→更新对应槽位 + 重算暴露程度
  const slot = CLOTHING_SLOT[itemName];
  if (slot) {
    data.云霜凝.服装[slot] = itemName;
    data.云霜凝.服装.暴露程度 = calcExposure(data);
  }
}

/**
 * 装备卸下时的副效果（恢复默认服装/妆容）
 */
function applyUnequipSideEffects(itemName: string, data: SchemaType): void {
  const slot = CLOTHING_SLOT[itemName];
  if (slot) {
    // 检查同槽是否有其他服装在使用中
    const groupName = slot as string;
    const otherInSlot = EXCLUSIVE_GROUPS[groupName]?.find(
      c => c !== itemName && data.系统.道具状态[c] === '使用中'
    );
    data.云霜凝.服装[slot] = otherInSlot ?? SLOT_DEFAULTS[slot];
    data.云霜凝.服装.暴露程度 = calcExposure(data);
  }
}

/**
 * 检测并处理本轮新激活的道具
 * 在 VARIABLE_UPDATE_ENDED 中调用，比对新旧 道具状态
 */
export function processNewlyActivatedItems(newData: SchemaType, oldData: SchemaType, currentFloor?: number): void {
  const newItems = newData.系统.道具状态;
  const oldItems = oldData.系统.道具状态;
  const floor = currentFloor ?? 0;

  for (const [itemName, newState] of Object.entries(newItems)) {
    const oldState = oldItems[itemName];

    // 存量修复：消耗品卡在"使用中"（新旧都是"使用中"），直接清理并补记冷却
    if (newState === '使用中' && oldState === '使用中' && INSTANT_EFFECTS[itemName]) {
      delete newData.系统.道具状态[itemName];
      const cooldown = CONSUMABLE_COOLDOWN[itemName];
      if (cooldown && floor > 0) {
        newData._消耗品上次使用楼层[itemName] = floor;
      }
      console.warn(`[商店] 存量修复：消耗品 ${itemName} 卡在使用中，已清理并记录冷却`);
      continue;
    }

    // 处理：新="使用中"且旧≠"使用中"（代表刚刚激活，兼容消耗品购买即使用的情况）
    if (newState !== '使用中' || oldState === '使用中') continue;

    console.info(`[商店] 检测到道具激活: ${itemName}`);

    // ─── 神魂空间限制：服装/方式3触发类道具不可激活（消耗品允许） ───
    const inSoulSpace = newData._当前互动模式 === '神魂空间';
    if (inSoulSpace) {
      const isClothing = !!CLOTHING_SLOT[itemName];
      const isSpecialScene = !!SPECIAL_SCENE_CONFIG[itemName];

      if (isClothing || isSpecialScene) {
        newData.系统.道具状态[itemName] = '已购买';
        console.warn(`[商店] 神魂空间中禁用: ${itemName}，已退回`);
        continue;
      }
    }

    // ─── 消耗品（即时效果） ───────────────────
    if (INSTANT_EFFECTS[itemName]) {
      // 冷却检查：对比当前楼层与上次使用楼层
      const cooldown = CONSUMABLE_COOLDOWN[itemName];
      if (cooldown && floor > 0) {
        const lastUsedFloor = newData._消耗品上次使用楼层[itemName] ?? 0;
        if (lastUsedFloor > 0 && floor - lastUsedFloor < cooldown) {
          // 仍在冷却中，退回为"已购买"
          newData.系统.道具状态[itemName] = '已购买';
          console.warn(`[商店] ${itemName} 冷却中（上次楼层${lastUsedFloor}，当前${floor}，需间隔${cooldown}），已退回`);
          continue;
        }
      }

      INSTANT_EFFECTS[itemName](newData);
      delete newData.系统.道具状态[itemName];

      // 记录使用楼层（冷却计时起点）
      if (cooldown && floor > 0) {
        newData._消耗品上次使用楼层[itemName] = floor;
      }
      continue;
    }

    // ─── 永久体改类 ───────────────────────────
    if (BODY_MOD_EFFECTS[itemName]) {
      BODY_MOD_EFFECTS[itemName](newData);
      delete newData.系统.道具状态[itemName];
      console.info(`[商店] ${itemName} 体改已写入`);
      continue;
    }

    // ─── 淫纹刻印（特殊：需要位置参数，从 _待发送道具事件 中解析）───
    if (itemName.startsWith('淫纹刻印')) {
      // 格式: "淫纹刻印·腰腹" / "淫纹刻印·胸前" / "淫纹刻印·大腿内侧"
      const pos = itemName.replace('淫纹刻印·', '') as '腰腹' | '胸前' | '大腿内侧';
      if (['腰腹', '胸前', '大腿内侧'].includes(pos)) {
        if (!newData.云霜凝.肉体改造.淫纹位置.includes(pos)) {
          newData.云霜凝.肉体改造.淫纹位置.push(pos);
        }
      }
      delete newData.系统.道具状态[itemName];
      console.info(`[商店] 淫纹刻印 位置: ${pos}`);
      continue;
    }

    // ─── 性癖类（槽位装备，最多3个同时使用中） ──
    if (KINK_ITEM_MAP[itemName]) {
      // 统计当前已激活的性癖数量
      const activeKinkCount = Object.keys(newData.系统.道具状态)
        .filter(k => KINK_ITEM_MAP[k] && newData.系统.道具状态[k] === '使用中')
        .length;
      if (activeKinkCount > 3) {
        // 超过3个，退回为已购买
        newData.系统.道具状态[itemName] = '已购买';
        console.warn(`[商店] 性癖槽位已满（${activeKinkCount - 1}/3），${itemName} 已退回`);
      } else {
        console.info(`[商店] ${itemName} 性癖已激活（${activeKinkCount}/3）`);
      }
      continue;
    }

    // ─── 特殊场景触发类 ───────────────────────
    if (SPECIAL_SCENE_CONFIG[itemName]) {
      const sceneConfig = SPECIAL_SCENE_CONFIG[itemName];
      newData._特殊场景.进行中 = itemName;
      newData._特殊场景.当前阶段 = 0;
      newData._特殊场景.总阶段数 = sceneConfig.totalStages;
      newData._特殊场景.当前阶段轮次 = 0;
      delete newData.系统.道具状态[itemName];
      console.info(`[商店] 特殊场景启动: ${itemName}，共${sceneConfig.totalStages}阶段`);
      continue;
    }

    // ─── 留影石（装备toggle：已购买→录制中=使用中） ──
    if (isLiuyingshi(itemName)) {
      // 留影石直接切换为"使用中"（录制中），无互斥
      console.info(`[商店] ${itemName} 留影石开始录制`);
      continue;
    }

    // ─── 装备类（保持"使用中"） ─────────────────
    if (ALL_EQUIPMENT.has(itemName)) {
      enforceExclusiveGroup(itemName, newData);
      applyEquipSideEffects(itemName, newData);
      console.info(`[商店] ${itemName} 装备已激活`);
      continue;
    }

    // ─── 未知道具 ─────────────────────────────
    console.warn(`[商店] 未识别的道具: ${itemName}`);
  }
}

/**
 * 检测装备卸下（使用中→已购买）
 * 在 VARIABLE_UPDATE_ENDED 中调用
 */
export function processEquipmentUnequip(newData: SchemaType, oldData: SchemaType): void {
  const newItems = newData.系统.道具状态;
  const oldItems = oldData.系统.道具状态;

  for (const [itemName, newState] of Object.entries(newItems)) {
    const oldState = oldItems[itemName];

    // 检测：旧="使用中" → 新="已购买"（代表刚刚卸下）
    if (newState !== '已购买' || oldState !== '使用中') continue;
    if (!ALL_EQUIPMENT.has(itemName)) continue;

    console.info(`[商店] 检测到装备卸下: ${itemName}`);
    applyUnequipSideEffects(itemName, newData);
  }
}

/**
 * 装备每轮数值效果（身体开发加速、防线减少、信任度增加）
 * 在 VARIABLE_UPDATE_ENDED 中调用（AI回复后变量更新时）
 */
export function tickEquipmentEffects(data: SchemaType): void {
  const items = data.系统.道具状态;

  for (const [itemName, state] of Object.entries(items)) {
    if (state !== '使用中') continue;

    // 身体开发加速
    const bodyEffects = EQUIPMENT_PER_TURN_BODY_DEV[itemName];
    if (bodyEffects) {
      for (const { part, amount } of bodyEffects) {
        data.云霜凝.身体开发[part] = Math.min(100, data.云霜凝.身体开发[part] + amount);
      }
    }

    // 防线减少
    const defenseDelta = EQUIPMENT_PER_TURN_DEFENSE[itemName];
    if (defenseDelta) {
      data.云霜凝.心理防线 = Math.max(0, data.云霜凝.心理防线 + defenseDelta);
    }

    // 信任度增加（三把锁不再阻止，回退在单独步骤执行）
    const trustDelta = EQUIPMENT_PER_TURN_TRUST[itemName];
    if (trustDelta) {
      data.云霜凝.信任度 = Math.min(100, data.云霜凝.信任度 + trustDelta);
    }

    // 隐藏效果：疑心值增加（阶段2+且前半程生效，阶段1和后半程不影响）
    const suspicionDelta = EQUIPMENT_PER_TURN_SUSPICION[itemName];
    if (suspicionDelta && data.治疗.阶段 >= 2) {
      const 心态 = data.苗广.心态;
      if (心态 !== '屈辱' && 心态 !== '默许' && 心态 !== '沉溺') {
        data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + suspicionDelta);
      }
    }
  }
}

/**
 * 三把锁每轮回退（在 VARIABLE_UPDATE_ENDED 中调用，阶段6执行）
 * 设计文档第五节：回退无视楼层天花板
 */
export function applyLockRetreat(data: SchemaType): void {
  const items = data.系统.道具状态;

  if (items['寒心锁'] === '使用中') {
    const old = data.云霜凝.信任度;
    data.云霜凝.信任度 = Math.max(5, data.云霜凝.信任度 - 2);
    if (data.云霜凝.信任度 !== old) {
      console.info(`[三把锁] 寒心锁回退：信任度 ${old} → ${data.云霜凝.信任度}`);
    }
  }

  if (items['破心锁'] === '使用中') {
    const old = data.云霜凝.心理防线;
    data.云霜凝.心理防线 = Math.min(100, data.云霜凝.心理防线 + 3);
    if (data.云霜凝.心理防线 !== old) {
      console.info(`[三把锁] 破心锁回退：防线 ${old} → ${data.云霜凝.心理防线}`);
    }
  }

  if (items['断情锁'] === '使用中') {
    const old = data.治疗.完成度;
    // 断情锁下限：完成度不低于21（阶段3），防止角色退回植物人状态
    data.治疗.完成度 = Math.max(21, Math.round((data.治疗.完成度 - 0.5) * 10) / 10);
    if (data.治疗.完成度 !== old) {
      console.info(`[三把锁] 断情锁回退：完成度 ${old} → ${data.治疗.完成度}`);
    }
  }
}

/**
 * 特殊场景阶段推进（在 MESSAGE_RECEIVED 后调用）
 *
 * 每阶段有 minTurns/maxTurns：
 * - 轮次 < minTurns：停留在当前阶段（AI继续按引导词推进）
 * - 轮次 >= minTurns：自动推进到下一阶段
 * - 轮次 >= maxTurns：强制推进（兜底）
 */
export function advanceSpecialScene(data: SchemaType): void {
  if (!data._特殊场景.进行中) return;

  const scene = data._特殊场景.进行中;
  const currentStage = data._特殊场景.当前阶段;
  const config = SPECIAL_SCENE_CONFIG[scene];
  if (!config) return;

  // 递增当前阶段轮次
  const turns = (data._特殊场景.当前阶段轮次 ?? 0) + 1;
  data._特殊场景.当前阶段轮次 = turns;

  const stageTiming = config.stages[currentStage];
  const minTurns = stageTiming?.minTurns ?? 2;

  // 未达到最小轮次，继续停留
  if (turns < minTurns) {
    console.info(`[商店] 特殊场景: ${scene} 阶段${currentStage} 轮次${turns}/${minTurns}(min)，继续`);
    return;
  }

  // 达到minTurns，推进到下一阶段
  const nextStage = currentStage + 1;
  if (nextStage >= config.totalStages) {
    // 场景结束，应用永久后果
    applySpecialSceneConsequences(scene, data);
    data._已完成特殊场景[scene] = true;
    data._特殊场景.进行中 = '';
    data._特殊场景.当前阶段 = 0;
    data._特殊场景.总阶段数 = 0;
    data._特殊场景.当前阶段轮次 = 0;
    console.info(`[商店] 特殊场景结束: ${scene}`);
  } else {
    data._特殊场景.当前阶段 = nextStage;
    data._特殊场景.当前阶段轮次 = 0;
    console.info(`[商店] 特殊场景推进: ${scene} 阶段${currentStage}→${nextStage}/${config.totalStages}`);
  }
}

/**
 * 特殊场景结束后的永久后果
 */
function applySpecialSceneConsequences(scene: string, data: SchemaType): void {
  switch (scene) {
    case '镜前调教':
      // 数值：防线-3, 完成度+2
      data.云霜凝.心理防线 = Math.max(0, data.云霜凝.心理防线 - 3);
      data.治疗.完成度 = Math.min(100, data.治疗.完成度 + 2);
      // 叙事：镜前记忆永久写入（影响后续AI描写）
      data.云霜凝.性癖列表['镜前记忆'] = '偶尔想起镜中那个不认识的自己，内心动摇';
      break;

    case '夫前凌辱':
      // 数值：绿帽值+8, 信任+3（解锁条件已要求苗广≥屈辱）
      data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + 8);
      data.云霜凝.信任度 = Math.min(100, data.云霜凝.信任度 + 3);
      break;

    case '寝取宣告':
      // 数值：绿帽值+10, 防线-5（解锁条件已要求苗广≥默许）
      data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + 10);
      data.云霜凝.心理防线 = Math.max(0, data.云霜凝.心理防线 - 5);
      break;

    case '绿帽奴调教':
      // 数值：绿帽值+15, 完成度+3（解锁条件已要求苗广=沉溺）
      data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + 15);
      data.治疗.完成度 = Math.min(100, data.治疗.完成度 + 3);
      break;

    case '掌门改嫁':
      // 叙事：改嫁认知永久写入
      data.云霜凝.性癖列表['改嫁认知'] = '自认{{user}}之妻，苗广是过去的丈夫';
      break;
  }
  console.info(`[商店] 特殊场景后果已应用: ${scene}`);
}

// ────────────────────────────────────────────
// 场景临时道具（保留旧系统兼容）
// ────────────────────────────────────────────

/**
 * 每轮递减场景临时道具计数器
 * 在 MESSAGE_RECEIVED 中调用
 */
export function tickTemporaryItems(data: SchemaType): void {
  for (const itemName of Object.keys(data._临时道具剩余轮次)) {
    const remaining = data._临时道具剩余轮次[itemName];
    const newRemaining = remaining - 1;

    if (newRemaining <= 0) {
      delete data._临时道具剩余轮次[itemName];
      delete data.系统.道具状态[itemName];
      console.info(`[商店] ${itemName} 临时效果到期，已移除`);
    } else {
      data._临时道具剩余轮次[itemName] = newRemaining;
    }
  }
}

/**
 * 清除场景临时道具（治疗中断时调用）
 */
export function clearSceneTemporaryItems(data: SchemaType): void {
  for (const itemName of Object.keys(data._临时道具剩余轮次)) {
    delete data._临时道具剩余轮次[itemName];
    delete data.系统.道具状态[itemName];
    console.info(`[商店] 治疗中断，${itemName} 效果提前清除`);
  }
}

// ────────────────────────────────────────────
// 净灵铃：主动使用（方式3触发，UI按钮调用）
// ────────────────────────────────────────────

/**
 * 使用净灵铃：+5绿帽值，注入苗广进入照顾事件，冷却10楼层
 * 返回 { success, reason } 供UI提示
 */
export function useJingLingLing(data: SchemaType): { success: boolean; reason: string } {
  // 前置检查：装备中
  if (data.系统.道具状态['净灵铃'] !== '使用中') {
    return { success: false, reason: '净灵铃未装备' };
  }

  const 心态 = data.苗广.心态;
  const 是后半程 = 心态 === '屈辱' || 心态 === '默许' || 心态 === '沉溺';

  // 冷却10楼层
  const currentFloor = (globalThis as any).SillyTavern?.chat?.length ?? 0;
  if (currentFloor > 0 && data._净灵铃上次使用楼层 > 0 && currentFloor - data._净灵铃上次使用楼层 < 8) {
    return { success: false, reason: '净灵铃冷却中' };
  }

  data._净灵铃上次使用楼层 = currentFloor;

  if (是后半程) {
    // 后半程：+5绿帽值 + 苗广进入照顾
    data.苗广.疑心值 = Math.min(100, data.苗广.疑心值 + 5);
    const event = `__净灵铃_${心态}__`;
    const existing = data._待发送道具事件;
    data._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info(`[商店] 净灵铃使用（后半程）：绿帽值 +5 → ${data.苗广.疑心值}，事件=${event}`);
  } else {
    // 前半程：苗广正常进门查看，不加绿帽值
    const event = '__净灵铃_前半程__';
    const existing = data._待发送道具事件;
    data._待发送道具事件 = existing ? existing + '|||' + event : event;
    console.info(`[商店] 净灵铃使用（前半程）：苗广正常查看，不加疑心值`);
  }

  return { success: true, reason: '' };
}

// ────────────────────────────────────────────
// 留影石：购买 + 出售
// ────────────────────────────────────────────

const LIUYINGSHI_PRICE = 60;

/**
 * 购买一块新留影石
 * 返回 { success, reason, itemName }
 */
export function buyLiuyingshi(data: SchemaType): { success: boolean; reason: string; itemName: string } {
  if (data.系统.灵石 < LIUYINGSHI_PRICE) {
    return { success: false, reason: `灵石不足（需${LIUYINGSHI_PRICE}）`, itemName: '' };
  }
  // 解锁条件：阶段≥3
  if (data.治疗.阶段 < 3) {
    return { success: false, reason: '阶段≥3解锁', itemName: '' };
  }

  data.系统.灵石 -= LIUYINGSHI_PRICE;
  data._留影石计数 += 1;
  const itemName = `留影石_${data._留影石计数}`;
  data.系统.道具状态[itemName] = '已购买';
  console.info(`[商店] 购买留影石: ${itemName}，剩余灵石: ${data.系统.灵石}`);
  return { success: true, reason: '', itemName };
}

/**
 * 出售一块已录制的留影石给苗广
 * 返回 { success, reason }
 */
export function sellLiuyingshi(data: SchemaType, itemName: string): { success: boolean; reason: string } {
  if (!isLiuyingshi(itemName)) {
    return { success: false, reason: '不是留影石' };
  }
  const state = data.系统.道具状态[itemName];
  if (state !== '使用中') {
    return { success: false, reason: '留影石未在录制中' };
  }

  const 心态 = data.苗广.心态;
  // 仅默许/沉溺可出售
  if (心态 !== '默许' && 心态 !== '沉溺') {
    return { success: false, reason: '苗广心态未达默许' };
  }

  const price = 心态 === '沉溺' ? 800 : 500;
  data.系统.灵石 += price;
  delete data.系统.道具状态[itemName];

  // 方式3事件
  const eventKey = 心态 === '沉溺' ? '__留影石出售_沉溺__' : '__留影石出售_默许__';
  const existing = data._待发送道具事件;
  data._待发送道具事件 = existing ? existing + '|||' + eventKey : eventKey;
  data._系统操作中 = true;

  console.info(`[商店] 留影石出售: ${itemName}，售价${price}灵石，心态=${心态}`);
  return { success: true, reason: '' };
}

// ────────────────────────────────────────────
// 消耗品冷却查询（供前端使用）
// ────────────────────────────────────────────

/**
 * 查询消耗品是否仍在冷却中
 * @returns { inCooldown, remainingFloors } — inCooldown=true 时不可使用
 */
export function getConsumableCooldownInfo(
  itemName: string,
  data: SchemaType,
  currentFloor: number,
): { inCooldown: boolean; remainingFloors: number } {
  const cooldown = CONSUMABLE_COOLDOWN[itemName];
  if (!cooldown || currentFloor <= 0) return { inCooldown: false, remainingFloors: 0 };

  const lastUsedFloor = data._消耗品上次使用楼层[itemName] ?? 0;
  if (lastUsedFloor <= 0) return { inCooldown: false, remainingFloors: 0 };

  const elapsed = currentFloor - lastUsedFloor;
  if (elapsed >= cooldown) return { inCooldown: false, remainingFloors: 0 };

  return { inCooldown: true, remainingFloors: cooldown - elapsed };
}

/**
 * 查询道具在当前状态下是否可激活
 * 综合判断：冷却 + 神魂空间限制
 */
export function canActivateItem(
  itemName: string,
  data: SchemaType,
  currentFloor: number,
): { allowed: boolean; reason: string } {
  // 神魂空间限制：服装 + 方式3触发类（消耗品允许）
  if (data._当前互动模式 === '神魂空间') {
    if (CLOTHING_SLOT[itemName]) return { allowed: false, reason: '神魂空间中无法更换服装' };
    if (SPECIAL_SCENE_CONFIG[itemName]) return { allowed: false, reason: '神魂空间中无法触发特殊场景' };
  }

  // 消耗品冷却
  const { inCooldown, remainingFloors } = getConsumableCooldownInfo(itemName, data, currentFloor);
  if (inCooldown) return { allowed: false, reason: `冷却中（还需${remainingFloors}楼）` };

  return { allowed: true, reason: '' };
}
