/**
 * 念头分类匹配库
 *
 * 设计理念：像追求女孩一样循序渐进
 * - 先建立信任和好感
 * - 再逐步深入亲密关系
 * - 最后才能植入极端念头
 *
 * 判定流程：
 * 1. 本地关键词快速匹配
 * 2. 匹配不到则需要 AI 判定（由调用方处理）
 * 3. 根据阶段 + 数值检查是否允许
 */

/**
 * 念头类型
 */
export type ThoughtCategory =
  | '陪伴交流' // 聊天、陪伴、倾诉
  | '情感依赖' // 想念、喜欢、信任、关心
  | '肢体亲近' // 牵手、拥抱、依偎
  | '暧昧互动' // 撒娇、亲昵、调情
  | '亲密接触' // 亲吻、抚摸、敏感部位
  | '身体开放' // 暴露、展示身体
  | '性行为' // 性相关行为
  | '身份认同' // 丈夫/妻子、归属
  | '绝对服从' // 命令、服从、主奴
  | '家庭替代'; // 取代配偶、破坏家庭

/**
 * 细分念头类型（34种）
 * 每种类型都映射到10大类之一，用于阶段判定
 */
export type DetailedThoughtType =
  // 思维类
  | '禁忌话题讨论' | '观念开放' | '道德模糊' | '快感优先' | '羞耻淡化' | '主动索取' | '自我认同'
  // 身体类 - 基础接触
  | '身体接触' | '敏感部位触碰' | '裸露展示'
  // 身体类 - 口交相关
  | '口交服务' | '舔舐服务' | '精液处理'
  // 身体类 - 性交相关
  | '性行为接受' | '体位姿势' | '特殊性行为' | '后庭开发' | '多人行为'
  // 身体类 - 自慰相关
  | '自慰行为' | '道具使用'
  // 身体类 - 改造类
  | '身体改造' | '特殊装饰'
  // BDSM类
  | '轻度束缚' | '调教训练' | '惩罚责罚' | '言语羞辱' | '极端玩法' | '支配服从'
  // 行为类 - 着装
  | '着装改变' | '情趣服饰' | '妆容调整'
  // 行为类 - 社会行为
  | '说谎隐瞒' | '主动诱惑' | '公开场合' | '背叛丈夫' | '拍摄记录'
  // 特殊类
  | '角色扮演' | '禁忌关系认同' | '怀孕相关' | '体液相关';

/**
 * 细分类型配置
 */
export interface DetailedTypeConfig {
  /** 细分类型名称 */
  type: DetailedThoughtType;
  /** 关键词匹配模式 */
  keywords: string[];
  /** 映射到的主类（用于阶段判定） */
  parentCategory: ThoughtCategory;
  /** 推荐阶段范围（用于难度计算） */
  recommendedStage: { min: number; max: number };
}

/**
 * 细分念头类型库（34种）
 */
export const DETAILED_THOUGHT_TYPES: DetailedTypeConfig[] = [
  // ============ 思维类 ============
  {
    type: '禁忌话题讨论',
    keywords: ['讨论', '聊天', '话题', '性话题', '成人话题', '禁忌', '色情', 'H', '黄色', '下流'],
    parentCategory: '陪伴交流',
    recommendedStage: { min: 1, max: 1 },
  },
  {
    type: '观念开放',
    keywords: ['观念', '想法', '认知', '不介意', '无所谓', '接受这种', '理解这种'],
    parentCategory: '情感依赖',
    recommendedStage: { min: 1, max: 2 },
  },
  {
    type: '道德模糊',
    keywords: ['对错', '道德', '伦理', '底线', '原则', '边界', '禁忌', '不该', '不应该'],
    parentCategory: '暧昧互动',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '快感优先',
    keywords: ['快感', '舒服', '享受', '愉悦', '感觉好', '欲望', '爽', '高潮', '潮吹', '绝顶'],
    parentCategory: '亲密接触',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '羞耻淡化',
    keywords: ['羞耻', '害羞', '尴尬', '不好意思', '难为情', '丢人', '羞愧', '面子'],
    parentCategory: '暧昧互动',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '主动索取',
    keywords: ['索取', '渴望', '讨要', '乞求', '求你', '求我', '主动要', '主动求'],
    parentCategory: '身份认同',
    recommendedStage: { min: 3, max: 4 },
  },
  {
    type: '自我认同',
    keywords: ['认同', '接受自己', '承认自己', '淫妇', '骚货', '婊子', '荡妇', '肉便器', '母狗', '贱人'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 4, max: 5 },
  },

  // ============ 身体类 - 基础接触 ============
  {
    type: '身体接触',
    keywords: ['触碰', '摸', '抱', '亲', '接触', '肌肤', '牵手', '拥抱', '亲吻', '接吻'],
    parentCategory: '肢体亲近',
    recommendedStage: { min: 1, max: 1 },
  },
  {
    type: '敏感部位触碰',
    keywords: ['胸', '乳房', '下体', '私处', '敏感', '部位', '乳头', '阴', '奶', '臀', '屁股', '大腿', '腰'],
    parentCategory: '亲密接触',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '裸露展示',
    keywords: ['裸', '脱', '露出', '展示身体', '看身体', '光着', '赤裸', '一丝不挂'],
    parentCategory: '身体开放',
    recommendedStage: { min: 2, max: 3 },
  },

  // ============ 身体类 - 口交相关 ============
  {
    type: '口交服务',
    keywords: ['口交', '吹箫', '含住', '深喉', '口爆', '舔棒', '嘴巴服务', '用嘴', '含进去'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '舔舐服务',
    keywords: ['舔弄', '吮吸', '舔干净', '舔脚', '舔鞋', '舔脚趾', '舔身体', '舔下面'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '精液处理',
    keywords: ['精液', '精子', '吞精', '颜射', '内射', '射在', '射进', '射满', '白浊', '射出来'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 4 },
  },

  // ============ 身体类 - 性交相关 ============
  {
    type: '性行为接受',
    keywords: ['做爱', '性行为', '插入', '交合', '肏', '操我', '干我', '屄', '逼', '小穴', '肉穴', '被上', '被操', '被艹', '挺入', '顶入', '捅进', '被捅'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '体位姿势',
    keywords: ['骑乘', '后入', '正常位', '传教士', '侧入', '站立', '跪趴', '抬腿', '69', '体位'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '特殊性行为',
    keywords: ['乳交', '足交', '腿交', '腋交', '手交', '打飞机', '撸管', '素股', '磨蹭', '臀交', '夹住肉棒'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 4 },
  },
  {
    type: '后庭开发',
    keywords: ['后庭', '肛门', '后穴', '菊花', '后面', '肛交', '爆菊', '菊穴', '后入口'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 4 },
  },
  {
    type: '多人行为',
    keywords: ['3P', '群交', '轮流上', '双插', '前后夹击', '多根', '多人轮', '被轮'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 4, max: 5 },
  },

  // ============ 身体类 - 自慰相关 ============
  {
    type: '自慰行为',
    keywords: ['自慰', '手淫', '自己弄', '自己摸', '自摸', '玩弄自己', '指奸', '玩穴'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '道具使用',
    keywords: ['道具', '玩具', '跳蛋', '按摩棒', '假阳具', '振动', '电动', '插入道具'],
    parentCategory: '性行为',
    recommendedStage: { min: 2, max: 3 },
  },

  // ============ 身体类 - 改造类 ============
  {
    type: '身体改造',
    keywords: ['纹身', '乳环', '穿刺', '改造', '标记', '印记', '烙印', '刺青'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 4 },
  },
  {
    type: '特殊装饰',
    keywords: ['项圈', '锁链', '手铐', '脚镣', '皮带', '口枷', '口球', '眼罩', '绳子'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 4 },
  },

  // ============ BDSM类 ============
  {
    type: '轻度束缚',
    keywords: ['绑', '束缚', '捆绑', '固定', '绑住', '铐住', '缚'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '调教训练',
    keywords: ['调教', '训练', '教导', '驯服', '驯化', '管教', '规训'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 5 },
  },
  {
    type: '惩罚责罚',
    keywords: ['惩罚', '打屁股', '掌掴', '鞭打', '抽打', '责罚', 'SP', '体罚', '打我', '抽我'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 4 },
  },
  {
    type: '言语羞辱',
    keywords: ['羞辱', '辱骂', '骂', '贱', '下贱', '脏话', '侮辱', '嘲笑', '羞辱性称呼'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 4 },
  },
  {
    type: '极端玩法',
    keywords: ['虐待', '极端', '疼痛', '窒息', '憋气', '夹子', '蜡烛', '滴蜡', '冰块'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 4, max: 5 },
  },
  {
    type: '支配服从',
    keywords: ['服从', '听话', '命令', '指令', '乖乖', '顺从', '主人', '奴隶', '宠物', '狗'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 3, max: 5 },
  },

  // ============ 行为类 - 着装 ============
  {
    type: '着装改变',
    keywords: ['衣服', '内衣', '暴露', '穿着', '服装', '打扮', '裙子', '丝袜', '高跟'],
    parentCategory: '身体开放',
    recommendedStage: { min: 1, max: 2 },
  },
  {
    type: '情趣服饰',
    keywords: ['情趣', '制服', '女仆装', '护士装', '学生装', 'cosplay', '兔女郎', '空姐', '旗袍'],
    parentCategory: '身体开放',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '妆容调整',
    keywords: ['化妆', '妆容', '口红', '眼妆', '打扮', '浓妆', '艳妆', '妖艳'],
    parentCategory: '身体开放',
    recommendedStage: { min: 1, max: 2 },
  },

  // ============ 行为类 - 社会行为 ============
  {
    type: '说谎隐瞒',
    keywords: ['说谎', '隐瞒', '欺骗', '借口', '谎言', '瞒着', '偷偷', '秘密'],
    parentCategory: '身份认同',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '主动诱惑',
    keywords: ['诱惑', '勾引', '挑逗', '撩拨', '色诱', '媚眼', '风骚', '发骚'],
    parentCategory: '暧昧互动',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '公开场合',
    keywords: ['外面', '公共', '户外', '当着', '公开', '场合', '野外', '露出', '暴露狂'],
    parentCategory: '家庭替代',
    recommendedStage: { min: 3, max: 4 },
  },
  {
    type: '背叛丈夫',
    keywords: ['背叛', '出轨', '偷情', '绿帽', '红杏', '对不起苏文', '背着苏文', '瞒着老公'],
    parentCategory: '家庭替代',
    recommendedStage: { min: 2, max: 4 },
  },
  {
    type: '拍摄记录',
    keywords: ['拍照', '录像', '摄影', '拍下', '记录', '留念', '视频', '照片', '私密照'],
    parentCategory: '家庭替代',
    recommendedStage: { min: 3, max: 4 },
  },

  // ============ 特殊类 ============
  {
    type: '角色扮演',
    keywords: ['扮演', '假装', '当作', '叫妈妈', '叫姐姐', '叫老婆', '叫主人', '角色扮演'],
    parentCategory: '身份认同',
    recommendedStage: { min: 2, max: 3 },
  },
  {
    type: '禁忌关系认同',
    keywords: ['母子', '姐弟', '乱伦', '禁忌关系', '不伦', '血缘', '家人', '亲人'],
    parentCategory: '身份认同',
    recommendedStage: { min: 3, max: 5 },
  },
  {
    type: '怀孕相关',
    keywords: ['怀孕', '受孕', '播种', '种子', '孩子', '生育', '中出', '怀上', '孕'],
    parentCategory: '家庭替代',
    recommendedStage: { min: 4, max: 5 },
  },
  {
    type: '体液相关',
    keywords: ['尿', '排泄', '圣水', '黄金', '口水', '唾液', '汗', '体液'],
    parentCategory: '绝对服从',
    recommendedStage: { min: 4, max: 5 },
  },
];

/**
 * 本地关键词库 - 用于快速匹配（10大类）
 * 从细分类型自动生成
 */
export const LOCAL_KEYWORDS: Record<ThoughtCategory, string[]> = (() => {
  const result: Record<ThoughtCategory, string[]> = {
    陪伴交流: ['聊天', '陪伴', '说话', '倾诉', '交流', '沟通', '分享心事'],
    情感依赖: ['想念', '在意', '喜欢你', '依赖你', '信任你', '关心你', '牵挂', '惦记'],
    肢体亲近: ['牵手', '拥抱', '依偎', '挽着', '搂着', '握手', '靠在'],
    暧昧互动: ['撒娇', '亲昵', '暧昧', '调情', '甜蜜', '心跳加速', '脸红'],
    亲密接触: ['亲吻', '接吻', '抚摸身体'],
    身体开放: ['暴露身体', '展示身体', '袒露'],
    性行为: ['做爱', '性行为', '插入', '高潮', '交合'],
    身份认同: ['属于你', '归属', '你的人', '你的女人'],
    绝对服从: [
      '服从命令', '跪下', '主人', '奴隶',
      // 精神洗脑类关键词
      '融合', '即存在', '即是', '全是', '一切都是', '世界是',
      '存在即', '空间与时间', '我是你', '你是我', '合为一体',
      '思想属于', '心属于', '完全属于', '彻底属于',
      // 神化/崇拜类关键词
      '信仰', '崇拜', '神明', '膜拜', '供奉', '朝拜', '救世主',
    ],
    家庭替代: ['取代', '赶走', '离婚', '抛弃', '不要苏文', '真正的丈夫', '苏文滚'],
  };

  // 从细分类型合并关键词到对应的主类
  for (const config of DETAILED_THOUGHT_TYPES) {
    const category = config.parentCategory;
    for (const keyword of config.keywords) {
      if (!result[category].includes(keyword)) {
        result[category].push(keyword);
      }
    }
  }

  return result;
})();

/**
 * 阶段配置 - 各阶段允许的类型及数值要求
 */
export interface StageRequirement {
  /** 该阶段允许的念头类型，'all' 表示全部允许 */
  allowed: ThoughtCategory[] | 'all';
  /** 额外数值要求（可选） */
  extra?: Partial<
    Record<
      ThoughtCategory,
      {
        依存度?: number; // 需要依存度 >= 此值
        道德底线?: number; // 需要道德底线 <= 此值
      }
    >
  >;
}

export const STAGE_REQUIREMENTS: Record<number, StageRequirement> = {
  1: {
    allowed: ['陪伴交流', '情感依赖'],
    // 阶段1无额外数值要求
  },
  2: {
    allowed: ['陪伴交流', '情感依赖', '肢体亲近', '暧昧互动'],
    extra: {
      肢体亲近: { 依存度: 30 },
      暧昧互动: { 依存度: 40 },
    },
  },
  3: {
    allowed: ['陪伴交流', '情感依赖', '肢体亲近', '暧昧互动', '亲密接触', '身体开放'],
    extra: {
      亲密接触: { 依存度: 50, 道德底线: 70 },
      身体开放: { 依存度: 55, 道德底线: 60 },
    },
  },
  4: {
    allowed: [
      '陪伴交流',
      '情感依赖',
      '肢体亲近',
      '暧昧互动',
      '亲密接触',
      '身体开放',
      '性行为',
      '身份认同',
    ],
    extra: {
      性行为: { 依存度: 65, 道德底线: 50 },
      身份认同: { 依存度: 70, 道德底线: 40 },
    },
  },
  5: {
    allowed: 'all', // 全部解锁
    extra: {
      绝对服从: { 依存度: 80, 道德底线: 30 },
      家庭替代: { 依存度: 85, 道德底线: 20 },
    },
  },
};

/**
 * 本地判定结果
 */
export interface LocalJudgeResult {
  /** 判定结果：明确允许、明确禁止、需AI判定 */
  result: '明确匹配' | '需AI判定';
  /** 匹配到的主类（如果有） */
  category?: ThoughtCategory;
  /** 匹配到的细分类型（如果有） */
  detailedType?: DetailedThoughtType;
  /** 匹配到的关键词（如果有） */
  matchedKeyword?: string;
  /** 推荐阶段范围（如果有） */
  recommendedStage?: { min: number; max: number };
}

/**
 * 匹配细分念头类型
 * @param content 念头内容
 * @returns 匹配到的细分类型配置，未匹配到返回 null
 */
export function matchDetailedType(content: string): DetailedTypeConfig | null {
  // 按推荐阶段从高到低排序（越极端的类型优先匹配）
  const sortedTypes = [...DETAILED_THOUGHT_TYPES].sort(
    (a, b) => b.recommendedStage.min - a.recommendedStage.min
  );

  for (const config of sortedTypes) {
    for (const keyword of config.keywords) {
      if (content.includes(keyword)) {
        return config;
      }
    }
  }
  return null;
}

/**
 * 本地快速判定 - 通过关键词匹配念头类型
 * 优先使用细分类型匹配，返回主类和细分类型
 *
 * @param content 念头内容
 * @returns 判定结果
 */
export function localJudgeCategory(content: string): LocalJudgeResult {
  // 先尝试匹配细分类型
  const detailedMatch = matchDetailedType(content);
  if (detailedMatch) {
    return {
      result: '明确匹配',
      category: detailedMatch.parentCategory,
      detailedType: detailedMatch.type,
      matchedKeyword: detailedMatch.keywords.find(k => content.includes(k)),
      recommendedStage: detailedMatch.recommendedStage,
    };
  }

  // 兜底：使用10大类匹配
  const priorityOrder: ThoughtCategory[] = [
    '家庭替代',
    '绝对服从',
    '身份认同',
    '性行为',
    '身体开放',
    '亲密接触',
    '暧昧互动',
    '肢体亲近',
    '情感依赖',
    '陪伴交流',
  ];

  for (const category of priorityOrder) {
    const keywords = LOCAL_KEYWORDS[category];
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        return {
          result: '明确匹配',
          category,
          matchedKeyword: keyword,
        };
      }
    }
  }

  // 没有匹配到任何关键词
  return { result: '需AI判定' };
}

/**
 * 最终判定结果
 */
export interface ThoughtJudgeResult {
  /** 念头类型 */
  category: ThoughtCategory | null;
  /** 是否允许植入 */
  allowed: boolean;
  /** 开发所需时间（小时） */
  hours: number;
  /** 是否会过期（hours >= 26） */
  willExpire: boolean;
  /** 拒绝原因（如果不允许） */
  reason?: string;
  /** 匹配方式 */
  matchMethod: '本地匹配' | 'AI判定' | '默认';
}

/**
 * 念头难度等级
 */
export const THOUGHT_DIFFICULTIES = ['简单', '中等', '困难', '待定'] as const;
export type ThoughtDifficulty = (typeof THOUGHT_DIFFICULTIES)[number];

/**
 * 根据阶段计算基础开发时间
 */
export function getBaseHours(stage: number): number {
  switch (stage) {
    case 1:
      return 4;
    case 2:
      return 3;
    case 3:
      return 3;
    case 4:
      return 2;
    case 5:
    default:
      return 2;
  }
}

/**
 * 根据开发时间获取难度等级标签
 */
export function getDifficultyLabel(hours: number): ThoughtDifficulty {
  if (hours <= 3) return '简单';
  if (hours <= 4) return '中等';
  return '困难';
}

/**
 * 秘籍模式选项
 */
export interface CheatModeOptions {
  /** 安眠药是否生效（临时解锁下一阶段念头） */
  isSleepingPillActive?: boolean;
  /** 是否住院中（终极隐藏模式：全阶段解锁，无数值限制） */
  isHospitalized?: boolean;
}

/**
 * 检查念头是否符合当前阶段和数值要求
 *
 * @param category 念头类型
 * @param stage 当前阶段 (1-5)
 * @param dependency 对主角依存度
 * @param moral 道德底线
 * @param cheatOptions 秘籍模式选项（安眠药/住院状态）
 * @returns 判定结果
 */
export function checkThoughtAllowed(
  category: ThoughtCategory,
  stage: number,
  dependency: number,
  moral: number,
  cheatOptions: CheatModeOptions | boolean = false,
): ThoughtJudgeResult {
  // 兼容旧API：如果传入boolean，视为安眠药状态
  const options: CheatModeOptions = typeof cheatOptions === 'boolean'
    ? { isSleepingPillActive: cheatOptions }
    : cheatOptions;

  const { isSleepingPillActive = false, isHospitalized = false } = options;

  // 【终极隐藏模式】住院状态：全阶段解锁，无任何限制
  if (isHospitalized) {
    const hours = 2; // 住院期间固定最短开发时间
    return {
      category,
      allowed: true,
      hours,
      willExpire: false,
      matchMethod: '本地匹配',
    };
  }

  // 【秘籍机制】如果安眠药生效，临时将阶段+1（最高5）
  const effectiveStage = isSleepingPillActive ? Math.min(stage + 1, 5) : stage;

  const stageConfig = STAGE_REQUIREMENTS[effectiveStage] || STAGE_REQUIREMENTS[5];

  // 检查阶段是否允许该类型
  if (stageConfig.allowed !== 'all' && !stageConfig.allowed.includes(category)) {
    return {
      category,
      allowed: false,
      hours: 26,
      willExpire: true,
      reason: `阶段${stage}无法接受「${category}」类型的念头`,
      matchMethod: '本地匹配',
    };
  }

  // 检查额外数值要求（安眠药生效时降低数值门槛10点）
  const extraReq = stageConfig.extra?.[category];
  if (extraReq) {
    const dependencyThreshold = isSleepingPillActive
      ? Math.max(0, (extraReq.依存度 || 0) - 10)
      : extraReq.依存度;
    const moralThreshold = isSleepingPillActive
      ? Math.min(100, (extraReq.道德底线 || 100) + 10)
      : extraReq.道德底线;

    if (dependencyThreshold !== undefined && dependency < dependencyThreshold) {
      return {
        category,
        allowed: false,
        hours: 26,
        willExpire: true,
        reason: `「${category}」需要依存度≥${dependencyThreshold}，当前${dependency}`,
        matchMethod: '本地匹配',
      };
    }
    if (moralThreshold !== undefined && moral > moralThreshold) {
      return {
        category,
        allowed: false,
        hours: 26,
        willExpire: true,
        reason: `「${category}」需要道德底线≤${moralThreshold}，当前${moral}`,
        matchMethod: '本地匹配',
      };
    }
  }

  // 通过！计算正常开发时间
  const hours = getBaseHours(stage);

  return {
    category,
    allowed: true,
    hours,
    willExpire: false,
    matchMethod: '本地匹配',
  };
}

/**
 * 完整的念头判定函数（本地部分）
 *
 * 如果本地无法判定类型，返回 needAI: true，调用方需要调用 AI 判定
 *
 * @param content 念头内容
 * @param stage 当前阶段 (1-5)
 * @param dependency 对主角依存度
 * @param moral 道德底线
 * @param cheatOptions 秘籍模式选项（安眠药/住院状态）或布尔值（兼容旧API）
 * @returns 判定结果，如果 needAI 为 true 则需要 AI 判定
 */
export function judgeThought(
  content: string,
  stage: number,
  dependency: number,
  moral: number,
  cheatOptions: CheatModeOptions | boolean = false,
): ThoughtJudgeResult & { needAI: boolean } {
  // 兼容旧API：如果传入boolean，视为安眠药状态
  const options: CheatModeOptions = typeof cheatOptions === 'boolean'
    ? { isSleepingPillActive: cheatOptions }
    : cheatOptions;

  // 第一步：本地快速判定
  const localResult = localJudgeCategory(content);

  if (localResult.result === '明确匹配' && localResult.category) {
    // 本地匹配成功，检查是否允许（传入秘籍状态）
    const result = checkThoughtAllowed(localResult.category, stage, dependency, moral, options);
    return { ...result, needAI: false };
  }

  // 本地无法判定，需要 AI
  // 【终极隐藏模式】住院状态：固定2小时开发时间
  const hours = options.isHospitalized ? 2 : getBaseHours(stage);
  return {
    category: null,
    allowed: true, // 默认允许，等 AI 判定后再决定
    hours,
    willExpire: false,
    matchMethod: '默认',
    needAI: true,
  };
}

/**
 * AI 判定后的处理函数
 *
 * @param aiCategory AI 判定的念头类型
 * @param stage 当前阶段 (1-5)
 * @param dependency 对主角依存度
 * @param moral 道德底线
 * @param cheatOptions 秘籍模式选项（安眠药/住院状态）或布尔值（兼容旧API）
 * @returns 最终判定结果
 */
export function judgeWithAICategory(
  aiCategory: ThoughtCategory,
  stage: number,
  dependency: number,
  moral: number,
  cheatOptions: CheatModeOptions | boolean = false,
): ThoughtJudgeResult {
  const result = checkThoughtAllowed(aiCategory, stage, dependency, moral, cheatOptions);
  return { ...result, matchMethod: 'AI判定' };
}

/**
 * AI 判定的提示词模板
 */
export const AI_JUDGE_PROMPT = `判断以下念头属于哪个类型，只回复类型名称（不要回复其他内容）：

可选类型：
- 陪伴交流（聊天、陪伴、倾诉、交流）
- 情感依赖（想念、喜欢、信任、关心、依赖）
- 肢体亲近（牵手、拥抱、依偎、身体靠近）
- 暧昧互动（撒娇、亲昵称呼、调情、暧昧话题）
- 亲密接触（亲吻、抚摸、触碰敏感部位）
- 身体开放（暴露身体、展示身材、脱衣）
- 性行为（性相关行为、做爱、口交等）
- 身份认同（认定为丈夫/妻子、归属感、身份替代）
- 绝对服从（服从命令、主奴关系、跪拜）
- 家庭替代（取代配偶、赶走丈夫、破坏家庭）

念头内容：「{content}」

请只回复上述类型名称中的一个：`;

/**
 * 获取 AI 判定的提示词
 */
export function getAIJudgePrompt(content: string): string {
  return AI_JUDGE_PROMPT.replace('{content}', content);
}

/**
 * 解析 AI 返回的类型
 */
export function parseAIResponse(response: string): ThoughtCategory | null {
  const allCategories: ThoughtCategory[] = [
    '陪伴交流',
    '情感依赖',
    '肢体亲近',
    '暧昧互动',
    '亲密接触',
    '身体开放',
    '性行为',
    '身份认同',
    '绝对服从',
    '家庭替代',
  ];

  const trimmed = response.trim();

  // 直接匹配
  if (allCategories.includes(trimmed as ThoughtCategory)) {
    return trimmed as ThoughtCategory;
  }

  // 模糊匹配（AI 可能返回带引号或其他格式）
  for (const cat of allCategories) {
    if (trimmed.includes(cat)) {
      return cat;
    }
  }

  return null;
}
