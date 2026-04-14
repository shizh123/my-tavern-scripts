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
          淫纹: z
            .object({
              腰腹: z.string().prefault(''),
              胸前: z.string().prefault(''),
              大腿内侧: z.string().prefault(''),
              臀部: z.string().prefault(''),
            })
            .prefault({ 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' }),
        })
        .prefault({
          胸部: '默认',
          臀部: '默认',
          乳环: false,
          阴环: false,
          淫纹: { 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' },
        }),

      服装: z
        .object({
          上装: z.string().prefault('寒霜门道袍'),
          下装: z.string().prefault('寒霜门长裙'),
          内衣: z.string().prefault('素白抹胸'),
          内裤: z.string().prefault('素白亵裤'),
          特殊配饰: z
            .object({
              脚踝: z.string().prefault(''),
              颈部: z.string().prefault(''),
              耳部: z.string().prefault(''),
              腰部: z.string().prefault(''),
              大腿: z.string().prefault(''),
              胸部: z.string().prefault(''),
              阴蒂: z.string().prefault(''),
              前后穴: z.string().prefault(''),
            })
            .prefault({
              脚踝: '',
              颈部: '',
              耳部: '',
              腰部: '',
              大腿: '',
              胸部: '',
              阴蒂: '',
              前后穴: '',
            }),
          暴露程度: z.enum(['遮蔽', '微露', '轻露', '半露', '大露', '极露']).prefault('遮蔽'),
        })
        .prefault({
          上装: '寒霜门道袍',
          下装: '寒霜门长裙',
          内衣: '素白抹胸',
          内裤: '素白亵裤',
          特殊配饰: {
            脚踝: '',
            颈部: '',
            耳部: '',
            腰部: '',
            大腿: '',
            胸部: '',
            阴蒂: '',
            前后穴: '',
          },
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
      肉体改造: {
        胸部: '默认',
        臀部: '默认',
        乳环: false,
        阴环: false,
        淫纹: { 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' },
      },
      服装: {
        上装: '寒霜门道袍',
        下装: '寒霜门长裙',
        内衣: '素白抹胸',
        内裤: '素白亵裤',
        特殊配饰: {
          脚踝: '',
          颈部: '',
          耳部: '',
          腰部: '',
          大腿: '',
          胸部: '',
          阴蒂: '',
          前后穴: '',
        },
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
  // 洛书晴状态（激活后才显示/注入）
  // ============================================
  洛书晴: z
    .object({
      心理防线: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(100),
      顺从度: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(0),
      // 脚本管理，由数值门槛+云霜凝阶段同步驱动
      调教阶段: z.coerce
        .number()
        .transform(v => Math.max(1, Math.min(10, Math.floor(v))))
        .prefault(1),

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

      // 共用性癖道具写入此表，与云霜凝独立（3槽位"使用中"上限由脚本在 _洛书晴道具状态 处维护）
      性癖列表: z.record(z.string(), z.string()).prefault({}),

      // 阶段≥3 解锁的现实限定肉体改造
      肉体改造: z
        .object({
          胸部: z.enum(['默认', 'E罩杯', 'G罩杯', 'H罩杯']).prefault('默认'),
          臀部: z.enum(['默认', '丰满']).prefault('默认'),
          乳环: z.boolean().prefault(false),
          阴环: z.boolean().prefault(false),
          淫纹: z
            .object({
              腰腹: z.string().prefault(''),
              胸前: z.string().prefault(''),
              大腿内侧: z.string().prefault(''),
              臀部: z.string().prefault(''),
            })
            .prefault({ 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' }),
        })
        .prefault({
          胸部: '默认',
          臀部: '默认',
          乳环: false,
          阴环: false,
          淫纹: { 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' },
        }),

      // 阶段≥3 解锁的现实限定服装（初始为寒霜门天骄装束，和云霜凝共用款式列表）
      服装: z
        .object({
          上装: z.string().prefault('寒霜门弟子服'),
          下装: z.string().prefault('寒霜门白裙'),
          内衣: z.string().prefault('素白抹胸'),
          内裤: z.string().prefault('素白亵裤'),
          特殊配饰: z
            .object({
              脚踝: z.string().prefault(''),
              颈部: z.string().prefault(''),
              耳部: z.string().prefault(''),
              腰部: z.string().prefault(''),
              大腿: z.string().prefault(''),
              胸部: z.string().prefault(''),
              阴蒂: z.string().prefault(''),
              前后穴: z.string().prefault(''),
            })
            .prefault({
              脚踝: '',
              颈部: '',
              耳部: '',
              腰部: '',
              大腿: '',
              胸部: '',
              阴蒂: '',
              前后穴: '',
            }),
        })
        .prefault({
          上装: '寒霜门弟子服',
          下装: '寒霜门白裙',
          内衣: '素白抹胸',
          内裤: '素白亵裤',
          特殊配饰: {
            脚踝: '',
            颈部: '',
            耳部: '',
            腰部: '',
            大腿: '',
            胸部: '',
            阴蒂: '',
            前后穴: '',
          },
        }),

      // AI每轮生成；约100-150字
      心理活动: z.string().prefault(''),
    })
    .prefault({
      心理防线: 100,
      顺从度: 0,
      调教阶段: 1,
      身体开发: { 小嘴: 0, 胸部: 0, 小屄: 0, 屁穴: 0 },
      性癖列表: {},
      肉体改造: {
        胸部: '默认',
        臀部: '默认',
        乳环: false,
        阴环: false,
        淫纹: { 腰腹: '', 胸前: '', 大腿内侧: '', 臀部: '' },
      },
      服装: {
        上装: '寒霜门弟子服',
        下装: '寒霜门白裙',
        内衣: '素白抹胸',
        内裤: '素白亵裤',
        特殊配饰: {
          脚踝: '',
          颈部: '',
          耳部: '',
          腰部: '',
          大腿: '',
          胸部: '',
          阴蒂: '',
          前后穴: '',
        },
      },
      心理活动: '',
    }),

  // ============================================
  // 苗喧状态（洛书晴激活后才显示/注入；激活前只有隐藏彩蛋用 _苗喧碎片）
  // ============================================
  苗喧: z
    .object({
      绝望值: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(0),
      压抑值: z.coerce
        .number()
        .transform(v => Math.max(0, Math.min(100, v)))
        .prefault(0),
      // 脚本根据绝望值区间映射：蔑视/困惑/不安/恐惧/崩溃/失去
      心态: z.enum(['蔑视', '困惑', '不安', '恐惧', '崩溃', '失去']).prefault('蔑视'),
      // AI每轮生成，约100-150字
      心理活动: z.string().prefault(''),
    })
    .prefault({ 绝望值: 0, 压抑值: 0, 心态: '蔑视', 心理活动: '' }),

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
  // 时间（玄霜历叙事字符串，AI 通过 SET 命令更新）
  // ============================================
  时间: z
    .object({
      玄霜历: z.string().prefault('玄霜历九百七十三年·霜降月'),
    })
    .prefault({ 玄霜历: '玄霜历九百七十三年·霜降月' }),

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
  // 特殊场景状态（里程碑剧情轮次制引导）
  _特殊场景: z
    .object({
      进行中: z.string().prefault(''), // 场景名，空串=无进行中场景
    })
    .prefault({ 进行中: '' }),
  // 特殊场景当前开始的楼层（用于计算当前第几轮，类似千晶幻术）
  _特殊场景开始楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
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

  // ── 道具系统 v2: 分阶段引导延后楼数（2.0.20 新增） ──
  // 当玩家在分阶段引导期间使用道具，本楼引导让位给道具叙事，引导推迟到下一非道具楼。
  // 公式: actualRound = floor((currentFloor - startFloor - 延后) / 2) + 1
  // auto-exit 用名义 round（不扣延后），保证场景不会因连续用道具永不结束。
  // 场景退出时（含 auto-exit / 提前退出 / 打断 / 坏结局）必须清零对应字段。
  _千晶引导延后楼数: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  _孝敬引导延后楼数: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 共享给所有 _特殊场景.进行中 的子场景（含掌门改嫁、洛书晴现实初遇等）
  _特殊场景引导延后楼数: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 洛书晴激活剧情（5 轮显式计数器，stateValidation 推进进度时检查此值决定是否跳过推进）
  _洛书晴激活引导延后楼数: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),

  // ── 洛书晴/苗喧线相关隐藏变量 ──
  // 洛书晴线是否已激活（新婚之夜后第一次点击进入神魂空间触发）
  _洛书晴线已激活: z.boolean().prefault(false),
  // 洛书晴激活剧情的当前轮次进度（0-5，0=未开始，1-5=第N轮，5完成后自动切换正式激活）
  _洛书晴激活轮次进度: z.coerce
    .number()
    .transform(v => Math.max(0, Math.min(5, Math.floor(v))))
    .prefault(0),
  // 苗喧前期惩罚反抗事件已触发次数（0-2）
  _苗喧前期反抗已触发: z.coerce
    .number()
    .transform(v => Math.max(0, Math.min(2, Math.floor(v))))
    .prefault(0),
  // 当前是否有未解除的苗喧反抗限制（孝敬师父按钮激活条件之一）
  _苗喧反抗限制中: z.boolean().prefault(false),
  // 苗喧反抗限制触发楼层（10 楼后若玩家不点孝敬师父会自动清除）
  _苗喧反抗限制触发楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 后期反抗事件未读：null=无，否则为事件名（如 "千晶后苗喧求父"）
  _苗喧未读反抗事件: z.string().nullable().prefault(null),
  // 倾诉按钮冷却结束楼层
  _倾诉冷却结束楼层: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 当前神魂空间角色（按钮点击后的遮罩层选择结果）
  _当前神魂空间角色: z.enum(['云霜凝', '洛书晴']).prefault('云霜凝'),
  // 洛书晴独立的道具状态表（与系统.道具状态分开，共用道具各买各的）
  _洛书晴道具状态: z.record(z.string(), z.enum(['未购买', '已购买', '使用中'])).prefault({}),
  // 2.0.20: 已觉醒性癖追踪——key="云霜凝:性癖名" 或 "洛书晴:性癖名"。
  // 第一次装载时 push 觉醒 event 到 _待发送道具事件，标记后后续装载静默。
  // 移除/卸下不重置，保持"曾觉醒"永久记录——避免重复触发相同性癖的觉醒叙事。
  _已觉醒性癖: z.record(z.string(), z.boolean()).prefault({}),
  // 洛书晴安抚符消耗品生效楼层（方式2注入型；阶段3+不再生效）
  _洛书晴_安抚符生效至: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),
  // 洛书晴真心符消耗品生效楼层（方式2注入型；阶段3+不再生效）
  _洛书晴_真心符生效至: z.coerce
    .number()
    .transform(v => Math.max(0, Math.floor(v)))
    .prefault(0),

  // 当前场景在场角色（只追踪两位女角色）
  // - 特殊场景进行中 / 单人神魂空间：脚本锁定，AI 修改会被回滚
  // - 日常 / 现实互动自由模式 / 双人神魂空间：AI 通过 JSONPatch 每轮维护
  // 该字段驱动 buildStatusSnapshot 的注入过滤：不在场的角色其身体开发/肉体改造/服装等大块数据整体跳过
  _当前场景角色: z
    .object({
      云霜凝: z.boolean().prefault(true),
      洛书晴: z.boolean().prefault(false),
    })
    .prefault({ 云霜凝: true, 洛书晴: false }),
});

export type Schema = z.output<typeof Schema>;
