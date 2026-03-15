/**
 * 日志清理模块
 *
 * 包含：
 * 1. 念头植入日志清理
 * 2. 强制事件日志清理（阶段突破、苏文打断、苏文巡逻）
 *
 * 清理规则：
 * 1. 未通知的日志：永久保留（直到成功注入）
 * 2. 已通知的日志：只保留距离当前楼层不超过3楼的（支持ROLL）
 * 3. 特殊处理：触发楼层 < 0 的旧日志（无效数据），如果已通知则强制清理
 *    注意：触发楼层 = 0 是有效的（第0楼是初始化楼层）
 */

import type { SchemaType } from '../../schema';

export interface LogCleanupResult {
  beforeCount: number;
  afterCount: number;
  cleanedCount: number;
}

/**
 * 清理念头植入日志
 * @param data 变量数据（会被直接修改）
 * @param currentFloor 当前楼层号
 * @returns 清理结果统计
 */
export function cleanupThoughtImplantLogs(data: SchemaType, currentFloor: number): LogCleanupResult {
  const beforeCount = data.系统追踪.念头植入日志.length;

  console.info(`[念头植入清理] 当前楼层: ${currentFloor}, 清理前日志数: ${beforeCount}`);

  data.系统追踪.念头植入日志 = data.系统追踪.念头植入日志.filter(log => {
    // 未通知的日志永久保留（无论植入楼层是什么）
    if (!log.已通知AI) {
      console.info(`[念头植入清理] 保留未通知日志: 楼层${log.植入楼层} - ${log.内容}`);
      return true;
    }

    // 特殊处理：植入楼层 < 0 且已通知的，强制删除（无效数据）
    // 注意：植入楼层 = 0 是有效的（第0楼是初始化楼层）
    if (log.植入楼层 < 0) {
      console.info(`[念头植入清理] 删除无效楼层日志(楼层${log.植入楼层}): ${log.内容}`);
      return false;
    }

    // 已通知的日志，检查距离
    const floorDiff = currentFloor - log.植入楼层;
    const shouldKeep = floorDiff <= 3;

    if (shouldKeep) {
      console.info(`[念头植入清理] 保留已通知日志(${floorDiff}楼内): 楼层${log.植入楼层} - ${log.内容}`);
    } else {
      console.info(`[念头植入清理] 删除已通知日志(${floorDiff}楼外): 楼层${log.植入楼层} - ${log.内容}`);
    }

    return shouldKeep;
  });

  const afterCount = data.系统追踪.念头植入日志.length;
  const cleanedCount = beforeCount - afterCount;

  if (cleanedCount > 0) {
    console.info(`[念头植入清理] ✅ 清理了 ${cleanedCount} 条旧日志（剩余 ${afterCount} 条）`);
  } else {
    console.info(`[念头植入清理] ✅ 无需清理，所有日志均在3楼内`);
  }

  return { beforeCount, afterCount, cleanedCount };
}

/**
 * 清理强制事件日志
 * @param data 变量数据（会被直接修改）
 * @param currentFloor 当前楼层号
 * @returns 清理结果统计
 */
export function cleanupForcedEventLogs(data: SchemaType, currentFloor: number): LogCleanupResult {
  if (!data.系统追踪.强制事件日志) {
    data.系统追踪.强制事件日志 = [];
    return { beforeCount: 0, afterCount: 0, cleanedCount: 0 };
  }

  const beforeCount = data.系统追踪.强制事件日志.length;

  console.info(`[强制事件清理] 当前楼层: ${currentFloor}, 清理前日志数: ${beforeCount}`);

  data.系统追踪.强制事件日志 = data.系统追踪.强制事件日志.filter(log => {
    // 未通知的日志永久保留（无论触发楼层是什么）
    if (!log.已通知AI) {
      console.info(`[强制事件清理] 保留未通知日志: ${log.事件类型} - ${log.角色} - 楼层${log.触发楼层}`);
      return true;
    }

    // 特殊处理：触发楼层 < 0 且已通知的，强制删除（无效数据）
    if (log.触发楼层 < 0) {
      console.info(`[强制事件清理] 删除无效楼层日志(楼层${log.触发楼层}): ${log.事件类型}`);
      return false;
    }

    // 已通知的日志，检查距离
    const floorDiff = currentFloor - log.触发楼层;
    const shouldKeep = floorDiff <= 3;

    if (shouldKeep) {
      console.info(
        `[强制事件清理] 保留已通知日志(${floorDiff}楼内): ${log.事件类型} - ${log.角色} - 楼层${log.触发楼层}`,
      );
    } else {
      console.info(
        `[强制事件清理] 删除已通知日志(${floorDiff}楼外): ${log.事件类型} - ${log.角色} - 楼层${log.触发楼层}`,
      );
    }

    return shouldKeep;
  });

  const afterCount = data.系统追踪.强制事件日志.length;
  const cleanedCount = beforeCount - afterCount;

  if (cleanedCount > 0) {
    console.info(`[强制事件清理] ✅ 清理了 ${cleanedCount} 条旧日志（剩余 ${afterCount} 条）`);
  } else {
    console.info(`[强制事件清理] ✅ 无需清理，所有日志均在3楼内`);
  }

  return { beforeCount, afterCount, cleanedCount };
}
