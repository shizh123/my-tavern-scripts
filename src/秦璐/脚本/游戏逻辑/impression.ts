/**
 * 苏文印象更新模块
 * 负责：根据疑心值自动更新苏文对秦璐和苏梦的基础印象
 * 细节描述由 AI 自由补充，脚本不处理
 */

import type { SchemaType } from '../../schema';

/**
 * 根据疑心值获取对秦璐的基础印象
 * 每5点疑心值一个阶段，共20个阶段
 */
function getQinluImpression(suspicion: number): string {
  const stage = Math.floor(suspicion / 5);

  const impressions = [
    '我的贤内助', // 0-4
    '温柔体贴的老婆', // 5-9
    '还是老样子', // 10-14
    '她最近有点心不在焉', // 15-19
    '她行为有些反常', // 20-24
    '她心思不知在哪', // 25-29
    '她在隐瞒什么', // 30-34
    '她肯定有事瞒着我', // 35-39
    '她的举止让我不安', // 40-44
    '她在背着我做什么？', // 45-49
    '她行为很可疑', // 50-54
    '她一定有问题', // 55-59
    '她肯定背着我干了什么', // 60-64
    '她在骗我', // 65-69
    '她背叛了我的信任', // 70-74
    '她可能背叛了我', // 75-79
    '她肯定出轨了', // 80-84
    '这个不忠的女人', // 85-89
    '她彻底变了', // 90-94
    '她已经不是我认识的那个人了', // 95-100
  ];

  return impressions[Math.min(stage, 19)] || impressions[19];
}

/**
 * 根据疑心值获取对苏梦的基础印象
 * 每5点疑心值一个阶段，共20个阶段
 */
function getSumengImpression(suspicion: number): string {
  const stage = Math.floor(suspicion / 5);

  const impressions = [
    '我的乖女儿', // 0-4
    '懂事的好孩子', // 5-9
    '还挺听话的', // 10-14
    '她最近有点心不在焉', // 15-19
    '她行为有些反常', // 20-24
    '她心思不知在哪', // 25-29
    '她在隐瞒什么', // 30-34
    '她肯定有事瞒着我', // 35-39
    '她的举止让我担心', // 40-44
    '她在背着我做什么？', // 45-49
    '她行为很可疑', // 50-54
    '她一定有问题', // 55-59
    '她肯定背着我干了什么', // 60-64
    '她在骗我', // 65-69
    '她背叛了我的信任', // 70-74
    '她是不是学坏了', // 75-79
    '她肯定学坏了', // 80-84
    '这孩子被带坏了', // 85-89
    '她彻底变了', // 90-94
    '她已经不是我认识的那个孩子了', // 95-100
  ];

  return impressions[Math.min(stage, 19)] || impressions[19];
}

export interface ImpressionUpdateResult {
  qinluChanged: boolean;
  sumengChanged: boolean;
  qinluOldImpression?: string;
  qinluNewImpression?: string;
  sumengOldImpression?: string;
  sumengNewImpression?: string;
}

/**
 * 更新苏文的基础印象
 * 只更新基础印象，细节描述由 AI 自由补充
 * @param data 变量数据（会被直接修改）
 * @returns 更新结果信息
 */
export function updateSuwenImpressions(data: SchemaType): ImpressionUpdateResult {
  const result: ImpressionUpdateResult = {
    qinluChanged: false,
    sumengChanged: false,
  };

  // 获取疑心值
  const qinluSuspicion = data.苏文状态.对秦璐疑心值;
  const sumengSuspicion = data.苏文状态.对苏梦疑心值;

  // 计算新的基础印象
  const newQinluImpression = getQinluImpression(qinluSuspicion);
  const newSumengImpression = getSumengImpression(sumengSuspicion);

  // 检查是否需要更新基础印象
  if (data.苏文状态.对秦璐印象.基础印象 !== newQinluImpression) {
    result.qinluOldImpression = data.苏文状态.对秦璐印象.基础印象;
    result.qinluNewImpression = newQinluImpression;
    data.苏文状态.对秦璐印象.基础印象 = newQinluImpression;
    result.qinluChanged = true;
    console.info(`[印象更新] 秦璐基础印象: "${result.qinluOldImpression}" → "${newQinluImpression}"`);
  }

  if (data.苏文状态.对苏梦印象.基础印象 !== newSumengImpression) {
    result.sumengOldImpression = data.苏文状态.对苏梦印象.基础印象;
    result.sumengNewImpression = newSumengImpression;
    data.苏文状态.对苏梦印象.基础印象 = newSumengImpression;
    result.sumengChanged = true;
    console.info(`[印象更新] 苏梦基础印象: "${result.sumengOldImpression}" → "${newSumengImpression}"`);
  }

  return result;
}
