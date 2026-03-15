/**
 * 阶段外观自动更新模块（5阶段系统）
 * 负责：检查外观约束、阶段变化时设置待更新标记、强制调整不满足要求的外观
 */

import type { SchemaType } from '../../schema';
import {
  getStageConfig,
  getStageTitle,
  getExposureIndex,
  getMakeupIndex,
  type ExposureLevel,
  type MakeupLevel,
} from '../../stageConfig';

/**
 * 记录上次阶段，用于检测阶段变化
 * 使用模块级变量保持状态
 */
let lastQinStage = -1;
let lastSuStage = -1;

/**
 * 初始化阶段记录（在首次运行时调用）
 */
export function initStageTracking(qinStage: number, suStage: number): void {
  if (lastQinStage === -1) lastQinStage = qinStage;
  if (lastSuStage === -1) lastSuStage = suStage;
}

/**
 * 检查并修正外观约束（5阶段系统）
 * 只在不满足最低要求时才调整，保留 AI 的剧情联动改动
 */
function checkAndFixAppearanceConstraints(
  targetKey: '秦璐状态' | '苏梦状态',
  stage: number,
  data: SchemaType,
): boolean {
  const config = getStageConfig(stage);
  if (!config) {
    console.warn(`[阶段外观更新] 未找到阶段 ${stage} 的约束配置`);
    return false;
  }

  const targetState = data[targetKey];
  const characterName = targetKey === '秦璐状态' ? '秦璐' : '苏梦';
  let updated = false;

  // 获取当前暴露程度和妆容浓度
  const currentExposure = targetState.服装细节.暴露程度 as ExposureLevel;
  const currentMakeup = targetState.妆容细节.浓淡程度 as MakeupLevel;

  const currentExposureIndex = getExposureIndex(currentExposure);
  const currentMakeupIndex = getMakeupIndex(currentMakeup);

  const minExposureIndex = getExposureIndex(config.约束.最低暴露程度);
  const minMakeupIndex = getMakeupIndex(config.约束.最低妆容浓度);

  // 检查暴露程度是否满足最低要求
  if (currentExposureIndex < minExposureIndex) {
    console.info(
      `[阶段外观更新] ${characterName} 阶段${stage}(${config.阶段标题}) 暴露程度不足: ` +
        `${currentExposure} < ${config.约束.最低暴露程度}，调整为默认外观`,
    );

    // 只调整暴露程度相关的服装，而非全部覆盖
    targetState.服装细节.暴露程度 = config.默认外观.服装.暴露程度;
    targetState.服装细节.上装 = config.默认外观.服装.上装;
    targetState.服装细节.下装 = config.默认外观.服装.下装;
    targetState.服装细节.整体风格 = config.默认外观.服装.整体风格;
    updated = true;
  }

  // 检查妆容浓度是否满足最低要求
  if (currentMakeupIndex < minMakeupIndex) {
    console.info(
      `[阶段外观更新] ${characterName} 阶段${stage}(${config.阶段标题}) 妆容浓度不足: ` +
        `${currentMakeup} < ${config.约束.最低妆容浓度}，调整为默认妆容`,
    );

    // 只调整妆容浓度相关的项目
    targetState.妆容细节.浓淡程度 = config.默认外观.妆容.浓淡程度;
    targetState.妆容细节.底妆 = config.默认外观.妆容.底妆;
    targetState.妆容细节.眼妆 = config.默认外观.妆容.眼妆;
    targetState.妆容细节.唇妆 = config.默认外观.妆容.唇妆;
    targetState.妆容细节.整体风格 = config.默认外观.妆容.整体风格;
    updated = true;
  }

  // 检查特殊装饰约束
  if (!config.约束.允许特殊装饰 && targetState.服装细节.特殊装饰 !== '无') {
    console.info(`[阶段外观更新] ${characterName} 阶段${stage}(${config.阶段标题}) 不允许特殊装饰，移除`);
    targetState.服装细节.特殊装饰 = '无';
    updated = true;
  }

  // 检查身体改造约束
  if (!config.约束.允许身体改造) {
    const bodyMod = targetState.身体改造;
    if (
      !_.isEmpty(bodyMod.纹身) ||
      bodyMod.穿刺.乳环 ||
      bodyMod.穿刺.乳头环 ||
      bodyMod.穿刺.阴蒂环 ||
      bodyMod.穿刺.舌环 ||
      bodyMod.穿刺.肚脐环 ||
      bodyMod.穿刺.阴唇环 ||
      bodyMod.永久标记.length > 0
    ) {
      console.warn(
        `[阶段外观更新] ${characterName} 阶段${stage}(${config.阶段标题}) 不允许身体改造，但检测到改造项，保留但记录警告`,
      );
      // 不强制移除，只记录警告，因为可能是剧情需要
    }
  }

  if (updated) {
    console.info(
      `[阶段外观更新] ${characterName} 阶段${stage}(${config.阶段标题}) 外观已调整:\n` +
        `  暴露程度: ${targetState.服装细节.暴露程度} (最低要求: ${config.约束.最低暴露程度})\n` +
        `  妆容浓度: ${targetState.妆容细节.浓淡程度} (最低要求: ${config.约束.最低妆容浓度})\n` +
        `  气质: ${targetState.气质描述}`,
    );
  }

  return updated;
}

export interface AppearanceUpdateResult {
  qinluUpdated: boolean;
  sumengUpdated: boolean;
  qinluStageChanged: boolean;
  sumengStageChanged: boolean;
}

/**
 * 检查并处理阶段变化和外观更新（5阶段系统）
 * @param data 变量数据（会被直接修改）
 * @returns 更新结果信息
 */
export function checkAndUpdateAppearance(data: SchemaType): AppearanceUpdateResult {
  const result: AppearanceUpdateResult = {
    qinluUpdated: false,
    sumengUpdated: false,
    qinluStageChanged: false,
    sumengStageChanged: false,
  };

  const tracking = data.系统追踪;

  // 检查秦璐的阶段
  const qinStage = data.秦璐状态.当前阶段;

  // 首次运行时初始化 lastQinStage
  if (lastQinStage === -1) {
    lastQinStage = qinStage;
    console.info(`[阶段外观更新] 初始化秦璐阶段记录: 阶段${qinStage}(${getStageTitle(qinStage)})`);
  }

  const qinIsNewStage = qinStage !== lastQinStage;

  console.info(`[阶段外观调试] 秦璐: 当前阶段=${qinStage}, 上次记录=${lastQinStage}, 是否新阶段=${qinIsNewStage}`);

  if (qinIsNewStage && qinStage >= 1 && qinStage <= 5) {
    console.info(
      `[阶段外观更新] ✅ 秦璐阶段变化: ${lastQinStage}(${getStageTitle(lastQinStage)}) → ${qinStage}(${getStageTitle(qinStage)})`,
    );
    result.qinluStageChanged = true;

    // 设置待更新标记，等待合适的剧情时机
    tracking.秦璐外观待更新 = {
      需要更新: true,
      目标阶段: qinStage,
      变化原因: `阶段提升: ${getStageTitle(lastQinStage)} → ${getStageTitle(qinStage)}`,
    };
    console.info(`[阶段外观调试] 秦璐外观待更新已设置:`, JSON.stringify(tracking.秦璐外观待更新));

    // 【关键】写入强制事件日志（支持ROLL后重新触发）
    // 只有阶段 > 1 才触发隐藏剧情
    if (qinStage > 1) {
      const currentTime = `${data.世界.日期} ${data.世界.时间}`;
      const currentFloor = getLastMessageId();
      tracking.强制事件日志 = tracking.强制事件日志 || [];
      tracking.强制事件日志.push({
        事件类型: '阶段突破',
        角色: '秦璐',
        触发楼层: currentFloor,
        触发时间: currentTime,
        已通知AI: false,
        阶段号: qinStage,
      });
      console.info(`[阶段外观更新] 已写入秦璐阶段突破日志: 阶段${qinStage}, 楼层${currentFloor}`);
    }

    lastQinStage = qinStage;

    // 如果有待更新标记，检查约束是否满足（只在不满足时强制调整）
    const qinUpdated = checkAndFixAppearanceConstraints('秦璐状态', qinStage, data);
    if (qinUpdated) {
      // 约束调整完成，清除待更新标记
      console.info(`[阶段外观调试] ⚠️ 秦璐外观约束调整，清除待更新标记`);
      tracking.秦璐外观待更新.需要更新 = false;
      tracking.秦璐外观待更新.变化原因 = '约束检查后自动调整';
      result.qinluUpdated = true;
    } else {
      console.info(`[阶段外观调试] 秦璐外观约束满足，待更新标记保留为 true`);
    }
  } else if (qinStage >= 1 && qinStage <= 5) {
    // 非新阶段，但如果有待更新标记且AI已更新了外观，检查约束
    console.info(`[阶段外观调试] 秦璐非新阶段，检查待更新标记: ${tracking.秦璐外观待更新?.需要更新}`);
    if (tracking.秦璐外观待更新?.需要更新) {
      const qinUpdated = checkAndFixAppearanceConstraints('秦璐状态', qinStage, data);
      if (qinUpdated) result.qinluUpdated = true;
    }
  }

  // 检查苏梦的阶段
  const suStage = data.苏梦状态.当前阶段;

  // 首次运行时初始化 lastSuStage
  if (lastSuStage === -1) {
    lastSuStage = suStage;
    console.info(`[阶段外观更新] 初始化苏梦阶段记录: 阶段${suStage}(${getStageTitle(suStage)})`);
  }

  const suIsNewStage = suStage !== lastSuStage;

  console.info(`[阶段外观调试] 苏梦: 当前阶段=${suStage}, 上次记录=${lastSuStage}, 是否新阶段=${suIsNewStage}`);

  if (suIsNewStage && suStage >= 1 && suStage <= 5) {
    console.info(
      `[阶段外观更新] ✅ 苏梦阶段变化: ${lastSuStage}(${getStageTitle(lastSuStage)}) → ${suStage}(${getStageTitle(suStage)})`,
    );
    result.sumengStageChanged = true;

    // 设置待更新标记
    tracking.苏梦外观待更新 = {
      需要更新: true,
      目标阶段: suStage,
      变化原因: `阶段提升: ${getStageTitle(lastSuStage)} → ${getStageTitle(suStage)}`,
    };
    console.info(`[阶段外观调试] 苏梦外观待更新已设置:`, JSON.stringify(tracking.苏梦外观待更新));

    // 【关键】写入强制事件日志（支持ROLL后重新触发）
    // 只有阶段 > 1 才触发隐藏剧情
    if (suStage > 1) {
      const currentTime = `${data.世界.日期} ${data.世界.时间}`;
      const currentFloor = getLastMessageId();
      tracking.强制事件日志 = tracking.强制事件日志 || [];
      tracking.强制事件日志.push({
        事件类型: '阶段突破',
        角色: '苏梦',
        触发楼层: currentFloor,
        触发时间: currentTime,
        已通知AI: false,
        阶段号: suStage,
      });
      console.info(`[阶段外观更新] 已写入苏梦阶段突破日志: 阶段${suStage}, 楼层${currentFloor}`);
    }

    lastSuStage = suStage;

    // 检查约束
    const suUpdated = checkAndFixAppearanceConstraints('苏梦状态', suStage, data);
    if (suUpdated) {
      console.info(`[阶段外观调试] ⚠️ 苏梦外观约束调整，清除待更新标记`);
      tracking.苏梦外观待更新.需要更新 = false;
      tracking.苏梦外观待更新.变化原因 = '约束检查后自动调整';
      result.sumengUpdated = true;
    } else {
      console.info(`[阶段外观调试] 苏梦外观约束满足，待更新标记保留为 true`);
    }
  } else if (suStage >= 1 && suStage <= 5) {
    console.info(`[阶段外观调试] 苏梦非新阶段，检查待更新标记: ${tracking.苏梦外观待更新?.需要更新}`);
    if (tracking.苏梦外观待更新?.需要更新) {
      const suUpdated = checkAndFixAppearanceConstraints('苏梦状态', suStage, data);
      if (suUpdated) result.sumengUpdated = true;
    }
  }

  console.info(`[阶段外观调试] 检查完成，结果:`, JSON.stringify(result));
  return result;
}
