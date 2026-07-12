import { z } from 'zod';

/**
 * 秦璐重置版 v2 — MVU 变量结构（Zod）
 *
 * 核心设计：
 * 1. 三维核心数值：沦陷度（替换堕落度）/ 对主角依存度 / 对苏文依存度
 * 2. 去时间化：培育/窗口全部楼层驱动；时间/日期仅显示，交给 AI，脚本不算
 * 3. 念头 ID 化字典 + 状态机（判定中/培育中/未达标/已成熟/已过期）
 * 4. 念头判定全交 AI；难度=相对当前阶段的跨度
 * 5. 习惯上限 5，满了变卖换货币
 * 6. 苏文=刺激源+越级惩戒；位置由脚本按楼层黑盒作息游标算出
 * 7. 心防松动窗口（楼层%10<=3）越级闸门
 *
 * v2 变更（vs 旧版）：
 * - 阶段 5→4：掌控/动摇/陷落/臣服
 * - 念头类型全部重做：渐生依恋/情感依赖/触电感/玩火自焚/越界/身不由己/沦陷/身份瓦解/臣服/独占欲
 * - 删除苏梦全部字段
 * - 堕落度 → 沦陷度
 * - 秦璐默认外观从主妇改为冷艳猎手
 *
 * 约定：所有 `_前缀` 字段为脚本内部管理，AI 不要修改。
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ============================================
// 基础枚举
// ============================================

/** 阶段标题（4阶段，由沦陷度派生） */
const StageTitle = z.enum(['掌控', '动摇', '陷落', '臣服']);

/** 念头状态机 */
const ThoughtStatus = z.enum(['判定中', '培育中', '未达标', '已成熟', '已过期']);

/** 念头难度（相对当前阶段的跨度，AI 判类型后脚本算） */
const ThoughtDifficulty = z.enum(['简单', '困难', '待定']);

/**
 * 念头类型（新10大类，AI 判定时选其一；'待判定' 为未判出）
 * 按攻击秦璐三道防线的顺序排列：情感隔离 → 控制权 → 自我定义 → 终极归属
 */
const ThoughtCategory = z.enum([
  '待判定',
  '渐生依恋',
  '情感依赖',
  '触电感',
  '玩火自焚',
  '越界',
  '身不由己',
  '沦陷',
  '身份瓦解',
  '臣服',
  '独占欲',
]);

/** 苏文在家时的活动状态 */
const SuwenStatus = z.enum(['在家', '外出', '睡眠']);

/**
 * 地点枚举（v2：删苏梦房间，加秦璐书房/庭院/交易所）
 */
const Location = z.enum([
  '客厅',
  '餐厅',
  '厨房',
  '主卧',
  '浴室',
  '秦璐书房',
  '秦璐房间',
  '主角房间',
  '庭院',
  '交易所',
  '外面',
]);

// ============================================
// 复合子结构（外观/妆容/身体改造）
// ============================================

/** 服装细节 */
const ClothingDetails = z.object({
  头部: z.string().default('无').describe('发饰、头饰等'),
  上装: z.string().default('黑色丝绸衬衫，领口解开两颗扣子'),
  下装: z.string().default('烟灰色高腰西裤'),
  内衣: z
    .object({
      上: z.string().default('黑色蕾丝无钢圈文胸'),
      下: z.string().default('黑色蕾丝丁字裤'),
    })
    .prefault({}),
  袜裤: z.string().default('无'),
  鞋子: z.string().default('室内绒面拖鞋'),
  外套: z.string().default('无').describe('大衣、披肩等'),
  配饰: z.string().default('婚戒、珍珠耳钉').describe('首饰、手表等'),
  特殊装饰: z.string().default('左手腕一道极淡的旧疤痕').describe('项圈、手铐等'),
  整体风格: z.string().default('居家但精致的冷艳'),
  暴露程度: z.enum(['保守', '正常', '清凉', '暴露', '极度暴露']).default('正常'),
  整洁度: z.enum(['整洁', '略显凌乱', '凌乱', '破损', '衣不蔽体']).default('一丝不苟'),
});

/** 妆容细节 */
const MakeupDetails = z.object({
  底妆: z.string().default('轻薄粉底，自然肤色'),
  眼妆: z.string().default('淡棕色眼影，极细眼线'),
  唇妆: z.string().default('豆沙色哑光唇釉'),
  腮红: z.string().default('自然修容'),
  特殊妆容: z.string().default('无').describe('纹身妆、泪痕妆等'),
  香氛: z.string().default('淡淡的檀木与白麝香').describe('香水气息'),
  整体风格: z.string().default('冷艳精致'),
  浓淡程度: z.enum(['素颜', '淡妆', '日常妆', '浓妆', '艳妆']).default('淡妆'),
});

/** 身体改造 */
const BodyModification = z.object({
  纹身: z.record(z.string(), z.string()).prefault({}).describe('部位: 纹身内容'),
  穿刺: z
    .object({
      耳环: z.boolean().default(false),
      乳环: z.boolean().default(false),
      乳头环: z.boolean().default(false),
      阴蒂环: z.boolean().default(false),
      舌环: z.boolean().default(false),
      肚脐环: z.boolean().default(false),
      阴唇环: z.boolean().default(false),
      其他: z.array(z.string()).default([]),
    })
    .prefault({}),
  乳晕改造: z.string().default('无').describe('如：增大、变色、穿刺等'),
  永久标记: z.array(z.string()).default([]).describe('烙印、伤疤等'),
  临时标记: z.array(z.string()).default([]).describe('吻痕、精液痕迹等'),
  体态变化: z.string().default('无').describe('因开发导致的身体变化'),
});

// ============================================
// 念头 & 习惯
// ============================================

/**
 * 念头（ID 化字典的值；key = `念头_时间戳[_随机]`，由前端生成）
 * - 内容：玩家原文，AI 不许改（脚本保护）
 * - 类型：唯一让 AI 写的字段（待判定→具体类型）
 * - 其余由脚本管理
 */
const Thought = z.object({
  内容: z.string().describe('玩家输入原文，AI 不要修改'),
  类型: ThoughtCategory.default('待判定').describe('唯一让 AI 判定写入的字段'),
  状态: ThoughtStatus.default('判定中'),
  难度: ThoughtDifficulty.default('待定'),
  需要楼数: z.coerce.number().default(0).describe('成熟所需楼层数，类型判定后由脚本按难度设定'),
  开发进度: z.coerce.number().default(0).describe('累积楼层进度（含加速）'),
  植入楼层: z.coerce.number().default(-1),
});

/** 习惯（成熟念头转化，上限 5，满了变卖） */
const Habit = z.object({
  内容: z.string().describe('已固化的行为/思维'),
  形成楼层: z.coerce.number().default(-1),
});

// ============================================
// 秦璐状态
// ============================================

const CharacterState = z.object({
  // ━━━━ 三维核心数值 ━━━━
  /** 沦陷度（替换旧版堕落度）：越高越沦陷，驱动阶段 + 内容闸门 */
  沦陷度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),
  对主角依存度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(5),
  对苏文依存度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),

  // ━━━━ 派生（脚本由沦陷度算出后写回，AI 不要改） ━━━━
  当前阶段: z.coerce
    .number()
    .transform(v => clamp(Math.floor(v), 1, 4))
    .prefault(1),
  阶段标题: StageTitle.default('掌控'),

  // ━━━━ 心理（AI 每轮更新） ━━━━
  当前心理想法: z
    .string()
    .default('交易所下个月的拍卖名单该定了。{{user}}最近的训练可以加点料——他太顺了。')
    .describe('80-150字第一人称内心独白，AI 每轮更新。必须冷、锋利、自我意识清晰'),
  当前情绪: z.string().default('冷静'),

  // ━━━━ 位置（AI 选择题，脚本兜底） ━━━━
  当前位置: Location.default('客厅'),

  // ━━━━ 外在表现 ━━━━
  服装细节: ClothingDetails.prefault({}),
  妆容细节: MakeupDetails.prefault({}),
  身体改造: BodyModification.prefault({}),
  气质描述: z.string().default('冷艳危险的豪门主母，苏秦集团暗面女王'),

  // ━━━━ 念头 & 习惯 ━━━━
  /** 念头列表：ID 字典（key 寻址，不靠内容反查） */
  念头列表: z.record(z.string(), Thought).prefault({}),
  /** 习惯列表：上限 5，满了变卖换货币 */
  习惯列表: z.array(Habit).default([]),
});

// ============================================
// 苏文状态
// ============================================

/** 疑心值冻结（楼层化） */
const SuspicionFreeze = z.object({
  是否冻结: z.boolean().default(false),
  借口内容: z.string().default(''),
  冻结结束楼层: z.coerce.number().default(-1).describe('当前楼层 >= 此值则解冻'),
});

const SuwenState = z.object({
  /** 当前状态/位置：由脚本按楼层黑盒作息游标算出 */
  当前状态: SuwenStatus.default('在家'),
  当前位置: Location.default('客厅').describe('脚本按楼层作息算出，AI 不要改'),
  当前情绪: z.string().default('疲惫'),
  /** 60-100字第一人称——被瞒在鼓里但隐约不安的丈夫视角 */
  当前心理想法: z
    .string()
    .default('今天的董事会又被她抢了话。算了——争不过。{{user}}最近好像和她走得更近了……应该是我的错觉。')
    .describe('AI 每轮更新，不论在不在场。被瞒在鼓里的丈夫视角，对家中微妙变化的感知与自我解释'),

  /** 疑心值：对秦璐的怀疑程度（脚本管理，玩家可用道具降） */
  对秦璐疑心值: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),
  对秦璐疑心值冻结: SuspicionFreeze.prefault({}),
});

// ============================================
// 世界（时间/日期仅显示，AI 维护，脚本不算）
// ============================================

const WorldState = z.object({
  时间: z.string().default('夜晚').describe('仅氛围显示，AI 自由维护，脚本不参与计算'),
  日期: z.string().default('2024/11/20').describe('仅氛围显示，AI 自由维护'),
  地点: z.string().default('家 - 客厅'),
  环境氛围: z.string().default('日常').describe('场景氛围：日常/暧昧/紧张/情色/剑拔弩张等'),
});

// ============================================
// 系统（道具/货币/事件/内部标志）
// ============================================

/** 念头植入日志（ROLL 容错：记录待通知 AI 的植入操作） */
const ThoughtImplantLog = z.object({
  目标: z.enum(['秦璐']),
  念头ID: z.string(),
  内容: z.string(),
  植入楼层: z.coerce.number(),
  已通知AI: z.boolean().default(false),
});

const SystemState = z.object({
  /** 单一货币（主来源：变卖习惯 100/个） */
  货币: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),

  /** 道具状态 */
  道具状态: z.record(z.string(), z.enum(['未购买', '已购买', '使用中'])).prefault({}),

  /** 当前操作对象 */
  当前角色: z.enum(['秦璐']).default('秦璐'),

  /** 在场角色追踪 */
  在场角色: z
    .object({
      秦璐: z.boolean().default(true),
    })
    .prefault({}),

  /** 念头植入日志（解决 ROLL 后注入丢失） */
  念头植入日志: z.array(ThoughtImplantLog).default([]),

  /** AI 本轮写入的培育中念头相关度（脚本读取后清空） */
  本轮相关念头: z.record(z.string(), z.coerce.number().default(0)).prefault({}),

  // ━━━━ 内部标志（脚本管理，AI 不要修改） ━━━━
  /** 待发送道具事件 */
  _待发送道具事件: z.string().default(''),
  /** 苏文作息游标：已推进的楼层基准（黑盒，决定苏文位置） */
  _苏文作息游标: z.coerce.number().default(0),
  /** 上次处理楼层（防 ROLL 重复推进游标） */
  _上次处理楼层: z.coerce.number().default(-1),
  /** 在场锁定 */
  _在场锁定: z.boolean().default(false),
});

// ============================================
// 主 Schema
// ============================================

export const Schema = z.object({
  世界: WorldState.prefault({}),
  秦璐状态: CharacterState.prefault({}),
  苏文状态: SuwenState.prefault({}),
  系统: SystemState.prefault({}),
});

export type SchemaType = z.output<typeof Schema>;
