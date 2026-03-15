import { z } from 'zod';

// ============================================
// 基础类型定义
// ============================================

/** 阶段标题（5阶段系统） */
const StageTitle = z.enum(['抵抗', '动摇', '沉溺', '疯狂', '圆满']);

/** 念头难度 */
const ThoughtDifficulty = z.enum(['简单', '中等', '困难', '待定']);

/** 苏文状态枚举 */
const SuwenStatus = z.enum(['在家', '出差', '上班', '睡眠']);

// ============================================
// 复合结构定义
// ============================================

/** 念头培育区中的念头 */
const TemporaryThought = z.object({
  念头内容: z.string(),
  植入时间: z.string().describe('格式: YYYY/MM/DD HH:mm'),
  过期时间: z.string().describe('植入时间+24h'),
  需要时间: z.coerce.number().describe('3-5小时，根据难度计算；待判定时为0'),
  难度等级: ThoughtDifficulty.default('中等'),
  开发进度: z.coerce.number().default(0).describe('累积的相关互动时间（小时）'),
  待判定: z.boolean().default(false).describe('本地无法匹配类型时为true，等待AI判定'),
});

/** 习惯 */
const Habit = z.object({
  内容: z.string().describe('具体的行为或思维模式'),
  形成时间: z.string().describe('格式: YYYY/MM/DD HH:mm'),
});

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
    .default({}),
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
  整体风格: z.string().default('清新自然'),
  浓淡程度: z.enum(['素颜', '淡妆', '日常妆', '浓妆', '艳妆']).default('淡妆'),
});

/** 身体改造 */
const BodyModification = z.object({
  纹身: z.record(z.string(), z.string()).default({}).describe('部位: 纹身内容'),
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
    .default({}),
  乳晕改造: z.string().default('无').describe('如：增大、变色、穿刺等'),
  永久标记: z.array(z.string()).default([]).describe('烙印、伤疤等'),
  临时标记: z.array(z.string()).default([]).describe('吻痕、精液痕迹等'),
  体态变化: z.string().default('无').describe('因开发导致的身体变化'),
});

// ============================================
// 角色状态定义
// ============================================

/** 秦璐/苏梦状态 */
const CharacterState = z.object({
  // ━━━━━━ 核心三维数值 ━━━━━━
  道德底线: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 100))
    .default(90),
  对主角依存度: z.coerce
    .number()
    .transform(v => _.clamp(v, -50, 100))
    .default(20),
  对苏文依存度: z.coerce
    .number()
    .transform(v => _.clamp(v, -50, 100))
    .default(80),

  // ━━━━━━ 派生数值 ━━━━━━
  潜意识侵蚀度: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 150))
    .default(0),
  当前阶段: z.coerce
    .number()
    .transform(v => _.clamp(v, 1, 5))
    .default(1),
  阶段标题: StageTitle.default('抵抗'),

  // ━━━━━━ 心理状态 ━━━━━━
  当前心理想法: z.string().default('').describe('秦璐当前的内心独白，AI每轮更新'),
  当前情绪: z.string().default('平静'),

  // ━━━━━━ 外在表现 ━━━━━━
  服装细节: ClothingDetails.default({}),
  妆容细节: MakeupDetails.default({}),
  身体改造: BodyModification.default({}),
  气质描述: z.string().default('温柔贤淑的家庭主妇'),

  // ━━━━━━ 习惯系统 ━━━━━━
  习惯列表: z.array(Habit).default([]),
  念头培育区: z
    .array(TemporaryThought)
    .transform(thoughts => {
      // 自动去重：基于念头内容
      const seen = new Set<string>();
      return thoughts.filter(thought => {
        if (seen.has(thought.念头内容)) {
          return false;
        }
        seen.add(thought.念头内容);
        return true;
      });
    })
    .default([]),
});

/** 苏文位置枚举 */
const SuwenLocation = z.enum(['客厅', '餐厅', '厨房', '主卧', '浴室', '主角房间', '外面']);

/** 疑心值冻结状态 */
const SuspicionFreeze = z.object({
  是否冻结: z.boolean().default(false),
  借口内容: z.string().default(''),
  冻结开始时间: z.string().default(''),
  冻结结束时间: z.string().default(''),
});

/** 印象结构（基础印象 + AI细节描述） */
const Impression = z.object({
  基础印象: z.string().default('').describe('由脚本根据疑心值自动生成，AI不要修改'),
  细节描述: z.string().default('').describe('AI可以补充具体原因，不超过20字'),
});

/** 安眠药状态 */
const SleepingPillState = z.object({
  是否生效: z.boolean().default(false).describe('安眠药是否正在生效'),
  生效开始时间: z.string().default('').describe('安眠药开始生效的时间，格式: YYYY/MM/DD HH:mm'),
  生效结束时间: z.string().default('').describe('安眠药失效的时间（6小时后），格式: YYYY/MM/DD HH:mm'),
  剩余时间: z.coerce.number().default(0).describe('剩余生效时间（小时）'),
  上次使用时间: z.string().default('').describe('上次使用安眠药的时间，用于48小时冷却判定'),
  触发楼层: z.coerce.number().default(-1).describe('触发安眠药的消息楼层ID，用于ROLL时判断是否重复触发'),
});

/** 头孢+酒住院状态（终极隐藏模式） */
const HospitalizationState = z.object({
  是否住院: z.boolean().default(false).describe('苏文是否因头孢+酒住院'),
  住院开始时间: z.string().default('').describe('住院开始时间，格式: YYYY/MM/DD HH:mm'),
  住院结束时间: z.string().default('').describe('住院结束时间（15天后），格式: YYYY/MM/DD HH:mm'),
  剩余天数: z.coerce.number().default(0).describe('剩余住院天数'),
  触发楼层: z.coerce.number().default(-1).describe('触发住院的消息楼层ID，用于ROLL时判断是否重复触发'),
});

/** 苏文状态 */
const SuwenState = z.object({
  当前状态: SuwenStatus.default('在家'),
  当前位置: SuwenLocation.default('客厅').describe('苏文当前所在位置'),
  当前情绪: z.string().default('平静'),

  // 安眠药状态
  安眠药状态: SleepingPillState.default({}),

  // 头孢+酒住院状态（终极隐藏模式）
  住院状态: HospitalizationState.default({}),

  // 对秦璐的疑心与印象
  对秦璐疑心值: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 100))
    .default(0),
  对秦璐印象: Impression.default({ 基础印象: '我的贤内助', 细节描述: '' }),
  对秦璐疑心值冻结: SuspicionFreeze.default({}),

  // 对苏梦的疑心与印象
  对苏梦疑心值: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 100))
    .default(0),
  对苏梦印象: Impression.default({ 基础印象: '我的乖女儿', 细节描述: '' }),
  对苏梦疑心值冻结: SuspicionFreeze.default({}),
});

// ============================================
// 世界状态定义
// ============================================

const WorldState = z.object({
  时间: z.string().default('07:30').describe('格式: HH:mm'),
  日期: z.string().default('2024/11/20').describe('格式: YYYY/MM/DD'),
  星期: z.enum(['周一', '周二', '周三', '周四', '周五', '周六', '周日']).default('周三').describe('根据日期自动计算'),
  地点: z.string().default('家 - 客厅'),
  环境氛围: z.string().default('日常'),
});

// ============================================
// 系统追踪定义
// ============================================

/** 外观待更新标记 */
const AppearancePendingUpdate = z.object({
  需要更新: z.boolean().default(false).describe('阶段变化时设为true，外观更新后设为false'),
  目标阶段: z.coerce.number().default(0).describe('需要更新到的目标阶段'),
  变化原因: z.string().default('').describe('如：阶段提升、剧情换装等'),
});

/** 苏文打断事件（方案3：直接触发+借口判定） */
const SuwenInterruption = z.object({
  待触发: z.boolean().default(false).describe('是否有待触发的打断事件'),
  已通知AI: z.boolean().default(false).describe('是否已通过系统消息通知AI'),
  打断原因: z.string().default('').describe('如：在主角房间停留过久'),
  累计时间: z.coerce.number().default(0).describe('触发打断时的累计危险时间'),
  // 借口判定相关（玩家下一轮输入借口，AI判定成功/失败）
  等待借口: z.boolean().default(false).describe('是否正在等待玩家输入借口'),
  借口结果: z.enum(['待定', '成功', '失败']).default('待定').describe('借口判定结果'),
});

/** 苏文巡逻事件（新逻辑：设置离开期限） */
const SuwenPatrol = z.object({
  待触发: z.boolean().default(false).describe('是否有待触发的巡逻事件'),
  已通知AI: z.boolean().default(false).describe('是否已通过系统消息通知AI'),
  触发时间: z.string().default('').describe('巡逻触发的时间'),
  巡逻位置: z.string().default('').describe('苏文巡逻经过的位置'),
  上次巡逻时间: z.string().default('').describe('上次巡逻触发的时间，用于冷却'),
  // 离开期限相关（苏文要求1-2小时内离开，超时触发打断事件）
  离开期限: z.string().default('').describe('苏文要求离开的截止时间，格式: HH:mm'),
  期限小时数: z.coerce.number().default(0).describe('苏文设置的离开期限小时数（1-2小时）'),
});

/** 念头植入日志 */
const ThoughtImplantLog = z.object({
  目标: z.enum(['秦璐', '苏梦']),
  内容: z.string(),
  植入时间: z.string().describe('格式: YYYY/MM/DD HH:mm'),
  植入楼层: z.coerce.number().describe('记录植入时的消息楼层ID'),
  已通知AI: z.boolean().default(false).describe('是否已通过系统消息通知AI'),
});

/** 强制事件日志（阶段突破/打断/巡逻，支持ROLL后重新触发） */
const ForcedEventLog = z.object({
  事件类型: z.enum(['阶段突破', '苏文打断', '苏文巡逻']),
  角色: z.enum(['秦璐', '苏梦']),
  触发楼层: z.coerce.number().describe('记录触发时的消息楼层ID'),
  触发时间: z.string().describe('格式: YYYY/MM/DD HH:mm'),
  已通知AI: z.boolean().default(false).describe('是否已通过用户消息替换通知AI'),
  // 事件特定数据
  阶段号: z.coerce.number().optional().describe('阶段突破时的新阶段'),
  累计时间: z.coerce.number().optional().describe('打断事件时的累计危险时间'),
  打断原因: z.string().optional().describe('打断事件的原因'),
  巡逻位置: z.string().optional().describe('巡逻事件的位置'),
});

const SystemTracking = z.object({
  当前所在位置: z.string().default('客厅'),
  当前角色: z.enum(['秦璐', '苏梦']).default('秦璐').describe('当前所在位置的是哪个角色'),
  进入当前位置时间: z.string().default(''),
  上次更新时间: z.string().default(''),
  上次衰减日期: z.string().default('').describe('上次疑心值自然衰减的日期，格式: YYYY/MM/DD'),
  危险时间累计: z.coerce.number().default(0).describe('【已废弃】兼容旧数据，新逻辑使用角色独立的危险时间累计'),
  秦璐危险时间累计: z.coerce.number().default(0).describe('秦璐在主角房间且苏文在家清醒的累计小时数'),
  苏梦危险时间累计: z.coerce.number().default(0).describe('苏梦在主角房间且苏文在家清醒的累计小时数'),
  秦璐外观待更新: AppearancePendingUpdate.default({}),
  苏梦外观待更新: AppearancePendingUpdate.default({}),
  苏文打断事件: SuwenInterruption.default({}),
  苏文巡逻事件: SuwenPatrol.default({}),

  // 念头植入日志系统（解决ROLL消息后注入丢失问题）
  念头植入日志: z.array(ThoughtImplantLog).default([]).describe('记录待通知AI的念头植入操作'),

  // 强制事件日志系统（阶段突破/打断/巡逻，支持ROLL后重新触发）
  强制事件日志: z.array(ForcedEventLog).default([]).describe('记录待通知AI的强制事件'),
});

// ============================================
// 主 Schema
// ============================================

export const Schema = z.object({
  世界: WorldState.default({}),

  秦璐状态: CharacterState.default({}),

  苏梦状态: CharacterState.default({
    道德底线: 85,
    对主角依存度: 25,
    对苏文依存度: 70,
    服装细节: {
      头部: '黑色发圈',
      上装: '白色棉麻衬衫',
      下装: '浅蓝牛仔裤',
      内衣: {
        上: '白色蕾丝文胸',
        下: '白色棉质内裤',
      },
      袜裤: '白色短袜',
      鞋子: '帆布鞋',
      整体风格: '青春休闲',
    },
    妆容细节: {
      浓淡程度: '素颜',
    },
    气质描述: '活泼开朗的大学生',
  }),

  苏文状态: SuwenState.default({}),

  系统追踪: SystemTracking.default({}),
});

export type SchemaType = z.infer<typeof Schema>;
