import { z } from 'zod';

/**
 * 秦璐重置版 — MVU 变量结构（Zod）
 *
 * 核心设计（见 设计文档/）：
 * 1. 三维核心数值：堕落度（合并旧版 道德底线+侵蚀度）/ 对主角依存度 / 对苏文依存度
 * 2. 去时间化：培育/窗口/道具全部楼层驱动；时间/日期仅显示，交给 AI，脚本不算
 * 3. 念头 ID 化字典 + 状态机（判定中/培育中/未达标/已成熟/已过期）
 * 4. 念头判定全交 AI（砍关键词库）；难度=相对当前阶段的跨度
 * 5. 习惯上限 5，满了变卖换货币
 * 6. 苏文=刺激源+越级惩戒；位置由脚本按楼层黑盒作息游标算出；巡逻系统废除
 * 7. 心防松动窗口（楼层%10<=3）越级闸门；安眠药/住院改商店道具
 *
 * 约定：所有 `_前缀` 字段为脚本内部管理，AI 不要修改。
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ============================================
// 基础枚举
// ============================================

/** 阶段标题（5阶段，由堕落度派生） */
const StageTitle = z.enum(['抵抗', '动摇', '沉溺', '疯狂', '圆满']);

/** 念头状态机 */
const ThoughtStatus = z.enum(['判定中', '培育中', '未达标', '已成熟', '已过期']);

/** 念头难度（相对当前阶段的跨度，AI 判类型后脚本算） */
const ThoughtDifficulty = z.enum(['简单', '困难', '待定']);

/**
 * 念头类型（沿用旧版 10 大类，AI 判定时选其一；'待判定' 为未判出）
 * 越往后越越界，对应推荐阶段越高。
 */
const ThoughtCategory = z.enum([
  '待判定',
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
]);

/** 苏文在家时的活动状态 */
const SuwenStatus = z.enum(['在家', '外出', '睡眠']);

/**
 * 地点枚举（补齐三人各自房间）
 * 加速房间 = 餐厅/客厅/主卧（见 设计文档/苏文系统.md §2.2）
 */
const Location = z.enum(['客厅', '餐厅', '厨房', '主卧', '浴室', '秦璐房间', '苏梦房间', '主角房间', '外面']);

// ============================================
// 复合子结构（外观/妆容/身体改造：复用旧版）
// ============================================

/** 服装细节 */
const ClothingDetails = z.object({
  头部: z.string().default('无').describe('发饰、头饰等'),
  上装: z.string().default('米色针织开衫'),
  下装: z.string().default('深灰长裙'),
  内衣: z
    .object({
      上: z.string().default('肉色棉质文胸'),
      下: z.string().default('棉质内裤'),
    })
    .prefault({}),
  袜裤: z.string().default('肉色丝袜'),
  鞋子: z.string().default('室内拖鞋'),
  外套: z.string().default('无').describe('大衣、披肩等'),
  配饰: z.string().default('婚戒').describe('首饰、手表等'),
  特殊装饰: z.string().default('无').describe('项圈、手铐等'),
  整体风格: z.string().default('居家贤妻'),
  暴露程度: z.enum(['保守', '正常', '清凉', '暴露', '极度暴露']).default('正常'),
  整洁度: z.enum(['整洁', '略显凌乱', '凌乱', '破损', '衣不蔽体']).default('整洁'),
});

/** 妆容细节 */
const MakeupDetails = z.object({
  底妆: z.string().default('素颜淡妆'),
  眼妆: z.string().default('无'),
  唇妆: z.string().default('淡粉色唇彩'),
  腮红: z.string().default('自然红晕'),
  特殊妆容: z.string().default('无').describe('纹身妆、泪痕妆等'),
  香氛: z.string().default('无').describe('香水气息'),
  整体风格: z.string().default('清新自然'),
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
  /** 强行植入标记（v0.24 三振）：强植的念头下一楼必被退回 */
  _强植: z.boolean().default(false),
});

/** 习惯（成熟念头转化，上限 5，满了变卖） */
const Habit = z.object({
  内容: z.string().describe('已固化的行为/思维'),
  形成楼层: z.coerce.number().default(-1),
});

// ============================================
// 角色状态（秦璐 / 苏梦 同构）
// ============================================

const CharacterState = z.object({
  // ━━━━ 三维核心数值 ━━━━
  /** 堕落度（合并旧版 道德底线+侵蚀度）：越高越堕落，驱动阶段 + 内容闸门 */
  堕落度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),
  对主角依存度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(20),
  对苏文依存度: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(80),

  // ━━━━ 派生（脚本由堕落度算出后写回，AI 不要改） ━━━━
  当前阶段: z.coerce
    .number()
    .transform(v => clamp(Math.floor(v), 1, 5))
    .prefault(1),
  阶段标题: StageTitle.default('抵抗'),

  // ━━━━ 心理（AI 每轮更新） ━━━━
  当前心理想法: z.string().default('').describe('内心独白，AI 每轮更新'),
  当前情绪: z.string().default('平静'),

  // ━━━━ 位置（AI 选择题，脚本兜底；不参与苏文加速判定，仅叙事/显示用） ━━━━
  当前位置: Location.default('客厅'),

  // ━━━━ 外在表现 ━━━━
  服装细节: ClothingDetails.prefault({}),
  妆容细节: MakeupDetails.prefault({}),
  身体改造: BodyModification.prefault({}),
  气质描述: z.string().default('温柔贤淑的家庭主妇'),

  // ━━━━ 念头 & 习惯 ━━━━
  /** 念头列表：ID 字典（key 寻址，不靠内容反查） */
  念头列表: z.record(z.string(), Thought).prefault({}),
  /** 习惯列表：上限 5，满了变卖换货币 */
  习惯列表: z.array(Habit).default([]),

  // ━━━━ 网店装备（界面/脚本管理，AI 不要改） ━━━━
  /** 装备状态：key=物品名，缺省=未购买；装备各买各的（对标云霜凝但对称化） */
  装备状态: z.record(z.string(), z.enum(['已购买', '装备中'])).prefault({}),
  /** 越级药效（安神药+1/头孢酒+2，消耗品使用后写入；脚本管理） */
  _越级加成: z.coerce.number().default(0),
  _越级加成至楼层: z.coerce.number().default(-1),
  /** 疑心主通道基准（v0.23）：已折算过疑心的堕落度水位；-1=未初始化（首次不补收） */
  _疑心已结算堕落度: z.coerce.number().default(-1),
  /** 三振计数（v0.24）：连续强行植入次数，正常植入成功转培育中即清零；3 次 → 坏结局 */
  _强植三振: z.coerce.number().default(0),
  /** 经济结算水位（v0.25）：已折算成货币的堕落度；-1=旧档首见校准不补发（她的堕落是你的资本） */
  _货币已结算堕落度: z.coerce.number().default(-1),
  /** 阶段突破奖励水位（v0.25）：已发过奖励的最高阶段；-1=旧档首见校准不补发 */
  _已奖励阶段: z.coerce.number().default(-1),
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
  /** 当前状态/位置：由脚本按楼层黑盒作息游标算出（见 苏文系统.md §四） */
  当前状态: SuwenStatus.default('在家'),
  当前位置: Location.default('客厅').describe('脚本按楼层作息算出，AI 不要改'),
  当前情绪: z.string().default('平静').describe('AI 每轮更新'),
  /** 心理活动（v0.19）：被瞒在鼓里的丈夫视角，AI 每轮更新（不论在不在场，维持心理轨迹） */
  当前心理想法: z
    .string()
    .default('家里最近挺平静的，璐璐把家里打理得很好，孩子们也懂事。')
    .describe('60-100字第一人称内心独白，AI 每轮更新'),

  // 疑心值（保留，玩家可用道具降；完整规则测试中再设计）
  对秦璐疑心值: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),
  对苏梦疑心值: z.coerce
    .number()
    .transform(v => clamp(v, 0, 100))
    .prefault(0),
  对秦璐疑心值冻结: SuspicionFreeze.prefault({}),
  对苏梦疑心值冻结: SuspicionFreeze.prefault({}),
});

// ============================================
// 世界（时间/日期仅显示，AI 维护，脚本不算）
// ============================================

const WorldState = z.object({
  时间: z.string().default('清晨').describe('仅氛围显示，AI 按剧情自由维护，脚本不参与计算'),
  日期: z.string().default('').describe('仅氛围显示，剧情跨天时由 AI 更新'),
  地点: Location.default('客厅').describe('AI 从固定地点枚举中选择当前场景'),
});

// ============================================
// 系统（道具/货币/事件/内部标志）
// ============================================

/** 念头植入日志（ROLL 容错：记录待通知 AI 的植入操作） */
const ThoughtImplantLog = z.object({
  目标: z.enum(['秦璐', '苏梦']),
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

  /** 道具状态（云霜凝同款 Record） */
  道具状态: z.record(z.string(), z.enum(['未购买', '已购买', '使用中'])).prefault({}),

  /** @deprecated 已由 在场角色 取代（快照不再读它），保留兼容旧存档 */
  当前角色: z.enum(['秦璐', '苏梦']).default('秦璐'),

  /**
   * 在场角色（对标云霜凝 _当前场景角色）
   * AI 每轮维护：进场写 true / 离场写 false / 每轮复核
   * 驱动快照注入过滤：不在场角色的状态/念头影响/相关度判定整块跳过
   * 脚本兜底：两者皆 false 时按秦璐在场处理
   */
  在场角色: z
    .object({
      秦璐: z.boolean().default(true),
      苏梦: z.boolean().default(false),
    })
    .prefault({}),

  /** 念头植入日志（解决 ROLL 后注入丢失） */
  念头植入日志: z.array(ThoughtImplantLog).default([]),

  /** 本轮相关念头加速（AI 写入，脚本读取后清空）
   *  格式：{ "念头ID": 相关度 } 相关度 ∈ {2:高度相关, 1:轻微相关}
   *  AI 通过 JSONPatch insert/replace 写入；脚本在 VARIABLE_UPDATE_ENDED 据此给培育中念头加进度
   */
  本轮相关念头: z.record(z.string(), z.coerce.number().default(0)).prefault({}),

  /** 首穿记录：key="角色状态:物品名"，首次装备事件只发一次（对标云霜凝 _已觉醒性癖） */
  _已首穿: z.record(z.string(), z.boolean()).prefault({}),

  /**
   * 影像档案（v0.23 录像系统）：停止录制生成一份，AI 写 50 字摘要归档（判定任务 C），
   * 就绪后可给任一女角色观看（堕落度 +N，耳濡目染通道），观看即消耗删除。
   * key 固定 `影像_角色名`——每角色同时只存一份，重录覆盖
   */
  影像列表: z
    .record(
      z.string(),
      z.object({
        摘要: z.string().default('').describe('AI 归档：50字内概括被记录的画面'),
        录制起止: z.string().default(''),
        状态: z.enum(['待摘要', '已就绪']).default('待摘要'),
      }),
    )
    .prefault({}),

  // ━━━━ 内部标志（脚本管理，AI 不要修改） ━━━━
  /** 录像状态（v0.23）：设备购买走 道具状态；此处只记录制进行态 */
  _录像: z
    .object({
      录制中: z.boolean().default(false),
      起始楼层: z.coerce.number().default(-1),
      目标: z.enum(['秦璐', '苏梦']).default('秦璐'),
    })
    .prefault({}),
  /** 苏梦引场钩子（v0.23，v0.25 放宽为任意阶段2+外装）：秦璐穿上后倒数 N 楼触发苏梦登场剧情（一次性） */
  _苏梦引场: z
    .object({
      剩余楼: z.coerce.number().default(-1),
      已触发: z.boolean().default(false),
    })
    .prefault({}),
  /** 打断档位记录（v0.23）：疑心每跨10点档触发一次打断，档位一生一次；key=`角色:档位` */
  _已触发打断档位: z.record(z.string(), z.boolean()).prefault({}),
  /** 打断余波（v0.25）：打断楼+后3楼苏文滞留家中（作息游标暂停），行为尺度收敛；-1=无余波 */
  _打断余波至楼层: z.coerce.number().default(-1),
  /** 苏文视角（v0.23）：打断后点亮按钮 → 3 幕插叙 POV，期间主线引擎冻结 */
  _苏文视角: z
    .object({
      待看: z.boolean().default(false),
      剩余楼: z.coerce.number().default(0),
      总楼数: z.coerce.number().default(3),
      目标: z.enum(['秦璐', '苏梦']).default('秦璐'),
      档位: z.coerce.number().default(0),
      上次处理楼层: z.coerce.number().default(-1),
    })
    .prefault({}),
  /** 调试后门：模拟满星（状态栏星标区连点5次切换；测试满星冲刺/疑心循环用） */
  _调试满星: z.boolean().default(false),
  /** 坏结局锁定（脚本写入，如 '疑心爆表·秦璐'；非空后培育/商店全停，快照只注入终局指引） */
  _坏结局: z.string().default(''),
  /** 待发送道具事件（| 分隔，脚本写、下一轮 AI 演绎，注入后转存 _已注入事件） */
  _待发送道具事件: z.string().default(''),
  /** 已注入事件转存（v0.25 重roll保护）：记录已注入某楼的事件文本，同楼重roll 时重注入防 AI 口胡 */
  _已注入事件: z
    .object({
      楼层: z.coerce.number().default(-1),
      内容: z.string().default(''),
    })
    .prefault({}),
  /** 消耗品冷却（v0.25）：key=道具名，value=上次使用楼层（冷却楼数定义在 SHOP_ITEMS） */
  _消耗品上次使用楼层: z.record(z.string(), z.coerce.number()).prefault({}),
  /** 在场角色锁定（v0.25）：true 时 在场角色 转脚本管理（回滚 AI 改动），玩家手动纠正 AI 判错用 */
  _在场锁定: z.boolean().default(false),
  /** 苏文作息游标：已推进的楼层基准（黑盒，决定苏文位置） */
  _苏文作息游标: z.coerce.number().default(0),
  /** 上次处理楼层（防 ROLL 重复推进游标） */
  _上次处理楼层: z.coerce.number().default(-1),
});

// ============================================
// 主 Schema
// ============================================

export const Schema = z.object({
  世界: WorldState.prefault({}),
  秦璐状态: CharacterState.prefault({
    当前心理想法: '今天也是平平淡淡的一天，晚饭做好了等他们回来。儿子最近好像长大了些，不用我太操心了。',
  }),
  苏梦状态: CharacterState.prefault({
    堕落度: 0,
    对主角依存度: 25,
    对苏文依存度: 70,
    服装细节: {
      头部: '黑色发圈',
      上装: '白色棉麻衬衫',
      下装: '浅蓝牛仔裤',
      内衣: { 上: '白色蕾丝文胸', 下: '白色棉质内裤' },
      袜裤: '白色短袜',
      鞋子: '帆布鞋',
      整体风格: '青春休闲',
    },
    妆容细节: { 浓淡程度: '素颜' },
    当前心理想法: '在家有点无聊，弟弟今天也在，偶尔说说话也还行吧。',
    气质描述: '活泼开朗的大学生',
    当前位置: '苏梦房间',
  }),
  苏文状态: SuwenState.prefault({}),
  系统: SystemState.prefault({}),
});

export type SchemaType = z.output<typeof Schema>;
