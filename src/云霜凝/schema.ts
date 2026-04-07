import { z } from 'zod';

/**
 * 云霜凝游戏 - 数据结构定义
 *
 * 核心设计：
 * 1. 治疗系统：完成度驱动阶段，阶段解锁商店道具
 * 2. 双场景：神魂空间 / 现实互动（阶段3解锁现实）
 * 3. 苗广风险：疑心值驱动心态，心态决定结局走向
 * 4. 商店系统v2：灵石货币，五类道具（消耗品/装备/体改/性癖/特殊场景）
 */

export const Schema = z.object({
  // ============================================
  // 治疗进度
  // ============================================
  治疗: z
    .object({
      完成度: z.coerce
        .number()
        .transform(v => Math.round(v * 10) / 10)
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(0),
      // 由脚本根据完成度自动计算，AI不要修改
      阶段: z.coerce
        .number()
        .transform(v => Math.max(1, Math.min(10, Math.floor(v))))
        .prefault(1),
    })
    .prefault({ 完成度: 0, 阶段: 1 }),

  // ============================================
  // 云霜凝状态
  // ============================================
  云霜凝: z
    .object({
      信任度: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(5),
      心理防线: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(100),

      身体开发: z
        .object({
          小嘴: z.coerce
            .number()
            .transform(v => Math.max(0, Math.min(100, v)))
            .prefault(0),
          胸部: z.coerce
            .number()
            .transform(v => Math.max(0, Math.min(100, v)))
            .prefault(0),
          小屄: z.coerce
            .number()
            .transform(v => Math.max(0, Math.min(100, v)))
            .prefault(0),
          屁穴: z.coerce
            .number()
            .transform(v => Math.max(0, Math.min(100, v)))
            .prefault(0),
        })
        .prefault({ 小嘴: 0, 胸部: 0, 小屄: 0, 屁穴: 0 }),

      // 永久性癖（特殊场景奖励：镜前记忆、改嫁认知等），不占商店性癖3槽位
      // 商店购买的性癖通过 系统.道具状态 管理（已购买/使用中切换，最多3个使用中）
      性癖列表: z.record(z.string(), z.string()).prefault({}),

      // 永久肉体改造（体改道具写入，状态快照每轮注入覆盖角色卡原始描述）
      肉体改造: z
        .object({
          胸部: z.enum(['默认', 'E罩杯', 'G罩杯', 'H罩杯']).prefault('默认'),
          臀部: z.enum(['默认', '丰满']).prefault('默认'),
          乳环: z.boolean().prefault(false),
          阴环: z.boolean().prefault(false),
          淫纹位置: z.array(z.enum(['腰腹', '胸前', '大腿内侧'])).prefault([]),
          堕落烙印: z.boolean().prefault(false),
        })
        .prefault({ 胸部: '默认', 臀部: '默认', 乳环: false, 阴环: false, 淫纹位置: [], 堕落烙印: false }),

      服装: z
        .object({
          上装: z.string().prefault('寒霜门道袍'),
          下装: z.string().prefault('寒霜门长裙'),
          内衣: z.string().prefault('素白抹胸'),
          内裤: z.string().prefault('素白亵裤'),
          特殊配饰: z.string().prefault('无'),
          暴露程度: z.enum(['遮蔽', '微露', '轻露', '半露', '大露', '极露']).prefault('遮蔽'),
        })
        .prefault({
          上装: '寒霜门道袍',
          下装: '寒霜门长裙',
          内衣: '素白抹胸',
          内裤: '素白亵裤',
          特殊配饰: '无',
          暴露程度: '遮蔽',
        }),

      // AI每轮生成；正常100-150字，千晶幻术激活时300-500字（针对苗广的幻境内容）
      心理活动: z.string().prefault(''),
    })
    .prefault({
      信任度: 5,
      心理防线: 100,
      身体开发: { 小嘴: 0, 胸部: 0, 小屄: 0, 屁穴: 0 },
      性癖列表: {},
      肉体改造: { 胸部: '默认', 臀部: '默认', 乳环: false, 阴环: false, 淫纹位置: [], 堕落烙印: false },
      服装: {
        上装: '寒霜门道袍',
        下装: '寒霜门长裙',
        内衣: '素白抹胸',
        内裤: '素白亵裤',
        特殊配饰: '无',
        暴露程度: '遮蔽',
      },
      心理活动: '',
    }),

  // ============================================
  // 苗广状态
  // ============================================
  苗广: z
    .object({
      疑心值: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(0),
      // 前半程(疑心值): 0~25=正常(无知), 25~50=疑惑, 50~70=察觉, 70+=愤怒(坏结局)
      // 后半程(绿帽值，同变量): 触发屈辱后重置为0, 0~40=屈辱, 40~75=默许, 75+=沉溺
      // 察觉→屈辱: 蚀心露+隔音灵阵隐藏组合一次性跳转
      心态: z.enum(['正常', '疑惑', '察觉', '愤怒', '屈辱', '默许', '沉溺']).prefault('正常'),
      // AI每轮生成，约100-150字
      心理活动: z.string().prefault(''),

      千晶幻术: z
        .object({
          激活中: z.boolean().prefault(false),
          冷却结束楼层: z.coerce
            .number()
            .transform(v => Math.max(0, Math.floor(v)))
            .prefault(0),
          已使用次数: z.coerce
            .number()
            .transform(v => Math.max(0, Math.min(5, Math.floor(v))))
            .prefault(0),
          幻境摘要: z.string().prefault(''),
          认知改写完成: z.boolean().prefault(false),
        })
        .prefault({ 激活中: false, 冷却结束楼层: 0, 已使用次数: 0, 幻境摘要: '', 认知改写完成: false }),

      // 孝敬师父系统：主动帮苗广做事降低疑心值
      孝敬师父: z
        .object({
          激活中: z.boolean().prefault(false),
          冷却结束楼层: z.coerce
            .number()
            .transform(v => Math.max(0, Math.floor(v)))
            .prefault(0),
          // 上次使用的场景索引（避免连续重复）
          上次场景索引: z.coerce
            .number()
            .transform(v => Math.max(-1, Math.floor(v)))
            .prefault(-1),
        })
        .prefault({ 激活中: false, 冷却结束楼层: 0, 上次场景索引: -1 }),
    })
    .prefault({
      疑心值: 0,
      心态: '正常',
      心理活动: '',
      千晶幻术: { 激活中: false, 冷却结束楼层: 0, 已使用次数: 0, 幻境摘要: '', 认知改写完成: false },
      孝敬师父: { 激活中: false, 冷却结束楼层: 0, 上次场景索引: -1 },
    }),

  // ============================================
  // 系统（{{user}}脑内商店）
  // ============================================
  系统: z
    .object({
      灵石: z.coerce
        .number()
        .transform(v => Math.max(0, Math.floor(v)))
        .prefault(100),
      // 道具三状态：未购买 / 已购买 / 使用中
      道具状态: z.record(z.string(), z.enum(['未购买', '已购买', '使用中'])).prefault({}),
    })
    .prefault({ 灵石: 100, 道具状态: {} }),

  // ============================================
  // 时间（脚本自动推进，AI不要修改）
  // ============================================
  时间: z
    .object({
      第几天: z.coerce
        .number()
        .transform(v => Math.max(1, Math.floor(v)))
        .prefault(1),
      // 以小时为单位存储，如 14.5 = 14:30
      当前小时: z.coerce
        .number()
        .transform(v => {
          const clamped = Math.max(0, Math.min(23.9, v));
          return Math.round(clamped * 10) / 10;
        })
        .prefault(8.0),
    })
    .prefault({ 第几天: 1, 当前小时: 8.0 }),

  // ============================================
  // 内部标志（下划线前缀，AI不要修改）
  // ============================================
  // 坏结局锁定标志（愤怒触发后不可逆，防回档）
  _坏结局已触发: z.boolean().prefault(false),
  // 打断治疗冻结：触发打断后记录当前楼层+5，冻结期间云霜凝治疗数值不变
  _打断冻结至楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 蚀心露+隔音灵阵隐藏组合是否已触发过（一次性，察觉→屈辱）
  _已触发蚀心露屈辱: z.boolean().prefault(false),
  // 消耗品上次使用的楼层号（用于冷却判断，key=道具名，value=楼层号）
  _消耗品上次使用楼层: z.record(z.string(), z.coerce.number()).prefault({}),
  // 净灵铃上次使用的天数（每天限用1次）
  _净灵铃上次使用楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 本轮待发送给AI的道具使用事件（方式3注入）
  _待发送道具事件: z.string().prefault(''),
  // 当前是否处于神魂空间副本
  _神魂空间激活中: z.boolean().prefault(false),
  // 当前互动模式：神魂空间 / 现实互动
  _当前互动模式: z.enum(['神魂空间', '现实互动', '日常']).prefault('日常'),
  // 阶段里程碑是否已发放过灵石（防止重复，key格式："阶段N"）
  _已发放里程碑灵石: z.record(z.string(), z.boolean()).prefault({}),
  // 苗广心态进入新阶段的灵石奖励追踪（key格式："心态-疑惑"等，防止重复发放）
  _已发放苗广心态灵石: z.record(z.string(), z.boolean()).prefault({}),
  // 场景临时道具剩余生效轮次（key=道具名，value=剩余轮数；到0时自动移除）
  _临时道具剩余轮次: z
    .record(
      z.string(),
      z.coerce.number().transform(v => Math.max(0, Math.floor(v))),
    )
    .prefault({}),
  // 特殊场景状态机（里程碑剧情多轮引导）
  _特殊场景: z
    .object({
      进行中: z.string().prefault(''), // 场景名，空串=无进行中场景
      当前阶段: z.coerce
        .number()
        .transform(v => Math.max(0, Math.floor(v)))
        .prefault(0),
      总阶段数: z.coerce
        .number()
        .transform(v => Math.max(0, Math.floor(v)))
        .prefault(0),
      当前阶段轮次: z.coerce
        .number()
        .transform(v => Math.max(0, Math.floor(v)))
        .prefault(0), // 当前阶段已经过的轮数
    })
    .prefault({ 进行中: '', 当前阶段: 0, 总阶段数: 0, 当前阶段轮次: 0 }),
  // 已完成的特殊场景列表（防止重复触发）
  _已完成特殊场景: z.record(z.string(), z.boolean()).prefault({}),
  // 神魂空间是否已解锁（首次信任度增加后解锁）
  _神魂空间已解锁: z.boolean().prefault(false),
  // 神魂空间是否已进入过（区分首次完整接引 vs 后续简化进入）
  _神魂空间已进入过: z.boolean().prefault(false),
  // 神魂记忆场景：当前激活的记忆名（空=普通神魂空间）
  _神魂记忆场景: z.string().prefault(''),
  // 新婚夜记忆是否已触发（首次进入神魂空间时固定触发）
  _新婚夜已触发: z.boolean().prefault(false),
  // 记忆进入次数（key=记忆名，value=次数）
  _记忆进入次数: z
    .record(
      z.string(),
      z.coerce.number().transform(v => Math.max(0, Math.floor(v))),
    )
    .prefault({}),
  // 系统操作标记（道具使用、模式切换等触发的triggerSlash，MESSAGE_RECEIVED应跳过时间推进）
  _系统操作中: z.boolean().prefault(false),
  // 留影石录制计数（每购买一块+1，key="留影石_N"表示第N块）
  _留影石计数: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 留影石上次出售楼层（全局冷却，出售后需间隔N楼才能再次出售任意留影石）
  _留影石上次出售楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 苗喧彩蛋：上次触发的楼层（频率控制，每10~15楼触发一次）
  _苗喧上次触发楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 苗喧碎片：当前显示在状态栏的叙事片段
  _苗喧碎片: z.string().prefault(''),
  // 千晶幻术当前施术开始的楼层（用于计算当前第几轮）
  _千晶幻术开始楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 孝敬师父当前开始的楼层（用于计算当前第几轮）
  _孝敬师父开始楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
});

export type Schema = z.output<typeof Schema>;
