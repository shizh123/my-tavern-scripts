import { z } from 'zod';

// ============================================
// 禁忌修道院 - 数据结构定义
// 核心机制：好感度解锁堕落值上限，堕落值决定20阶段
// ============================================

/** 场景类型 */
const SceneType = z.enum(['公共', '私密']);

/** 服装详情 */
const ClothingDetails = z.object({
  上装: z.string().default('黑色修女长袍'),
  下装: z.string().default('及踝长裙'),
  内衣: z.string().default('朴素白色亚麻内衣'),
  袜子: z.string().default('厚实黑色长袜'),
  鞋子: z.string().default('低跟黑皮鞋'),
  饰品: z.string().default('银质十字架与念珠'),
  最后更新日期: z.string().default('2025年3月15日'),
  当前场景类型: SceneType.default('公共'),
});

/** 阶段特征 */
const StageCharacteristics = z.object({
  态度描述: z.string().default('威严肃穆，保持绝对距离'),
  语气风格: z.string().default('冷淡疏离，措辞正式'),
  行为倾向: z.string().default('严守教规，拒绝亲密接触'),
  内心状态: z.string().default('坚守信仰，压抑本能'),
});

// ============================================
// 世界状态
// ============================================

const WorldState = z.object({
  当前日期: z.string().default('2025年3月15日'),
  当前时间: z.string().default('14:30'),
  当前场景: z.string().default('修道院接待室'),
  近期事务: z.record(z.string(), z.string()).default({
    今日晨祷: '已完成',
    午后祈祷: '推迟',
    访客接待: '苏斌先生',
  }),
});

// ============================================
// 特蕾莎状态
// ============================================

const TeresaState = z.object({
  // 核心数值
  好感度: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 100))
    .default(2),
  堕落值: z.coerce
    .number()
    .transform(v => _.clamp(v, 0, 100))
    .default(0),

  // 派生数值（由transform自动计算）
  当前阶段: z.coerce
    .number()
    .transform(v => _.clamp(v, 1, 20))
    .default(1),

  // 服装系统
  着装: ClothingDetails.default({}),

  // 身体改造（堕落值>=80时才生效）
  纹身: z.record(z.string(), z.string()).default({}),
  身体改造: z.record(z.string(), z.string()).default({}),

  // 阶段特征
  阶段特征: StageCharacteristics.default({}),
});

// ============================================
// 主 Schema
// ============================================

export const Schema = z
  .object({
    世界状态: WorldState.default({}),
    特蕾莎状态: TeresaState.default({}),
  })
  .transform(root => {
    try {
      const world = root.世界状态;
      const theresa = root.特蕾莎状态;

      // --- 1. 强制数值修正 (防止 NaN 或 字符串) ---
      const rawAffection = Number(theresa.好感度) || 0;
      const rawDepravity = Number(theresa.堕落值) || 0;

      // 好感度 clamp
      theresa.好感度 = _.clamp(rawAffection, 0, 100);

      // 计算堕落值上限并应用 (核心逻辑)
      const maxDepravity = Math.floor(theresa.好感度 / 10) * 10;
      const clampedDepravity = _.clamp(rawDepravity, 0, Math.min(maxDepravity, 100));

      // 强制写入修正后的堕落值
      theresa.堕落值 = clampedDepravity;

      // --- 2. 强制重算当前阶段 (无视 AI 输入) ---
      // 堕落值 0-4=阶段1, 5-9=阶段2 ...
      const calculatedStage = _.clamp(Math.floor(clampedDepravity / 5) + 1, 1, 20);
      theresa.当前阶段 = calculatedStage;

      // 调试日志 (按F12在Console查看)
      console.log(
        `[MVU Debug] 好感:${theresa.好感度} -> 上限:${maxDepravity} -> 堕落:${theresa.堕落值} -> 阶段:${calculatedStage}`,
      );

      // --- 3. 强制重算阶段特征 ---
      if (theresa.好感度 < 10) {
        theresa.阶段特征 = {
          态度描述: '威严肃穆，完全无视苏斌的存在',
          语气风格: '冰冷机械，拒绝任何交流',
          行为倾向: '视若无睹，避免一切接触',
          内心状态: '毫无波澜，心如止水',
        };
      } else {
        // 从配置表获取阶段特征
        const traits = getStageCharacteristics(calculatedStage);
        if (traits) {
          theresa.阶段特征 = { ...traits };
        }
      }

      // --- 4. 强制重算着装 ---
      const currentDate = world.当前日期;
      const currentScene = world.当前场景 || '未知';

      const isPrivate =
        currentScene.includes('私') ||
        currentScene.includes('寝室') ||
        currentScene.includes('密室') ||
        currentScene.includes('独处');
      const sceneType = isPrivate ? '私密' : '公共';

      // 查找适配的服装等级 (向下兼容)
      const clothingSet = getClothingByStage(calculatedStage, sceneType);
      if (clothingSet) {
        theresa.着装 = {
          ...clothingSet,
          最后更新日期: currentDate,
          当前场景类型: sceneType as '公共' | '私密',
        };
      }

      // --- 5. 清理低阶段的改造数据 ---
      if (theresa.堕落值 < 80) {
        theresa.纹身 = {};
        theresa.身体改造 = {};
      }
    } catch (e) {
      console.error('[MVU Critical Error] 脚本逻辑严重错误，已执行紧急重置:', e);
      // 发生严重错误时，强制回退到安全值
      root.特蕾莎状态.当前阶段 = 1;
      root.特蕾莎状态.堕落值 = 0;
    }

    return root;
  });

export type SchemaType = z.output<typeof Schema>;

// ============================================
// 辅助函数（从 stageConfig 导入）
// ============================================

import { getStageCharacteristics, getClothingByStage } from './stageConfig';
