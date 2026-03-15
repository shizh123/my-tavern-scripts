/**
 * 念头成熟检测模块
 * 负责：念头成熟/过期处理、数值变化、阶段提升、习惯淡化
 */

import type { SchemaType } from '../../schema';
import { getStageByCorruption, getStageTitle } from '../../stageConfig';

// 习惯上限配置
const HABIT_LIMIT = 16;

function isThoughtExpired(thought: { 过期时间: string }, currentTime: string): boolean {
  const expirationTime = parseTimeStr(thought.过期时间);
  const current = parseTimeStr(currentTime);
  return current >= expirationTime;
}

function parseTimeStr(timeStr: string): Date {
  const [datePart, timePart] = timeStr.split(' ');
  const [year, month, day] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function calculateRewards(
  difficulty: '简单' | '中等' | '困难',
  currentSubinDependency: number,
): {
  道德底线变化: number;
  对主角依存度变化: number;
  对苏文依存度变化: number;
  潜意识侵蚀度变化: number;
} {
  const baseRewards = {
    道德底线变化: difficulty === '困难' ? -3 : -2,
    对主角依存度变化: difficulty === '困难' ? 4 : 3,
    潜意识侵蚀度变化: difficulty === '困难' ? 6 : 5,
  };

  let suwenDecrease = -2;
  if (currentSubinDependency >= 80) {
    suwenDecrease = -5;
  } else if (currentSubinDependency >= 60) {
    suwenDecrease = -4;
  } else if (currentSubinDependency >= 30) {
    suwenDecrease = -3;
  }

  if (difficulty === '困难') {
    suwenDecrease = Math.floor(suwenDecrease * 1.2);
  }

  return {
    ...baseRewards,
    对苏文依存度变化: suwenDecrease,
  };
}

function calculatePenalties(): {
  道德底线变化: number;
  对主角依存度变化: number;
} {
  return {
    道德底线变化: 3,
    对主角依存度变化: -2,
  };
}

export interface ThoughtCheckResult {
  matureCount: number;
  expiredCount: number;
  stageChanges: Array<{ character: string; oldStage: number; newStage: number }>;
}

/**
 * 检查并处理成熟/过期的念头
 * @param data 变量数据（会被直接修改）
 * @returns 处理结果信息
 */
export function checkMatureThoughts(data: SchemaType): ThoughtCheckResult {
  const formationTime = (data as any)._推进前时间 || `${data.世界.日期} ${data.世界.时间}`;
  console.info(`[念头成熟] 习惯形成时间: ${formationTime}`);

  let matureCount = 0;
  let expiredCount = 0;
  const stageChanges: Array<{ character: string; oldStage: number; newStage: number }> = [];

  (['秦璐状态', '苏梦状态'] as const).forEach(characterKey => {
    const character = data[characterKey];
    if (!character) return;

    const thoughts = character.念头培育区;
    const now = `${data.世界.日期} ${data.世界.时间}`;
    const characterName = characterKey === '秦璐状态' ? '秦璐' : '苏梦';

    console.info(`[念头成熟] ${characterKey} 当前时间: ${now}, 念头数: ${thoughts.length}`);

    const matureThoughts: Array<{ thought: (typeof thoughts)[0]; index: number; difficulty: string }> = [];
    const expiredThoughts: Array<{ thought: (typeof thoughts)[0]; index: number; difficulty: string }> = [];

    thoughts.forEach((thought, index) => {
      const expired = isThoughtExpired(thought, now);
      // 待判定的念头不能成熟（需要时间为0时也不算成熟）
      // 只有需要时间 > 0 且 开发进度 >= 需要时间 时才算成熟
      const isMature = !thought.待判定 && thought.需要时间 > 0 && thought.开发进度 >= thought.需要时间;

      console.info(
        `[念头成熟] ${characterKey} 念头[${index}]: "${thought.念头内容}" ` +
          `进度=${thought.开发进度}/${thought.需要时间} 待判定=${thought.待判定} 过期=${expired} 成熟=${isMature}`,
      );

      if (expired) {
        expiredThoughts.push({ thought, index, difficulty: thought.难度等级 });
      } else if (isMature) {
        matureThoughts.push({ thought, index, difficulty: thought.难度等级 });
      }
    });

    // 处理成熟念头
    if (matureThoughts.length > 0) {
      console.info(`[念头成熟] ${characterKey} 有 ${matureThoughts.length} 个念头成熟!`);
      matureCount += matureThoughts.length;

      matureThoughts.forEach(m => {
        const rewards = calculateRewards(m.difficulty as '简单' | '中等' | '困难', character.对主角依存度);

        console.info(`[念头成熟] ${characterKey} 处理成熟念头: "${m.thought.念头内容}"`);

        // 生成习惯
        const newHabit = {
          内容: m.thought.念头内容,
          形成时间: formationTime,
        };
        character.习惯列表.push(newHabit);

        // 【习惯淡化机制】超过上限时，删除最旧的习惯
        if (character.习惯列表.length > HABIT_LIMIT) {
          const removedHabit = character.习惯列表.shift(); // 删除第一个（最旧的）
          console.info(
            `[念头成熟] ${characterKey} 习惯数量超过上限(${HABIT_LIMIT})，最旧习惯淡化消失: "${removedHabit?.内容}"`,
          );
        }

        console.info(`[念头成熟] ${characterKey} 新增习惯, 当前习惯数: ${character.习惯列表.length}`);

        // 应用奖励
        const oldMoral = character.道德底线;
        const oldSubin = character.对主角依存度;
        const oldSuwen = character.对苏文依存度;
        const oldCorruption = character.潜意识侵蚀度;

        character.道德底线 += rewards.道德底线变化;
        character.对主角依存度 += rewards.对主角依存度变化;
        character.对苏文依存度 += rewards.对苏文依存度变化;
        character.潜意识侵蚀度 += rewards.潜意识侵蚀度变化;

        console.info(
          `[念头成熟] ${characterKey} 数值变化: ` +
            `道德${oldMoral}→${character.道德底线}, ` +
            `主角依存${oldSubin}→${character.对主角依存度}, ` +
            `苏文依存${oldSuwen}→${character.对苏文依存度}, ` +
            `侵蚀度${oldCorruption}→${character.潜意识侵蚀度}`,
        );

        // 检查阶段提升（5阶段系统）
        const oldStage = character.当前阶段;
        const corruption = character.潜意识侵蚀度;
        const newStage = getStageByCorruption(corruption);

        if (newStage > oldStage) {
          character.当前阶段 = newStage;
          character.阶段标题 = getStageTitle(newStage);
          console.info(
            `[念头成熟] ${characterKey} 阶段提升: ${oldStage}(${getStageTitle(oldStage)}) → ${newStage}(${getStageTitle(newStage)})`,
          );
          stageChanges.push({ character: characterName, oldStage, newStage });
        }
      });
    }

    // 处理过期念头
    if (expiredThoughts.length > 0) {
      expiredCount += expiredThoughts.length;
      expiredThoughts.forEach(m => {
        console.info(`[念头成熟] ${characterKey} 念头过期: "${m.thought.念头内容}"`);
        if (m.difficulty === '困难') {
          const penalties = calculatePenalties();
          character.道德底线 += penalties.道德底线变化;
          character.对主角依存度 += penalties.对主角依存度变化;
          console.info(`[念头成熟] ${characterKey} 困难念头惩罚已应用`);
        }
      });
    }

    // 删除已处理的念头
    const allProcessed = [...matureThoughts, ...expiredThoughts].sort((a, b) => b.index - a.index);
    allProcessed.forEach(m => {
      thoughts.splice(m.index, 1);
    });

    if (allProcessed.length > 0) {
      console.info(`[念头成熟] ${characterKey} 删除了 ${allProcessed.length} 个念头`);
    }
  });

  console.info(`[念头成熟] 总计: 成熟=${matureCount}, 过期=${expiredCount}`);

  return { matureCount, expiredCount, stageChanges };
}
