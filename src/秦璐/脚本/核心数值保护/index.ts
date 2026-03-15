/**
 * 核心数值保护脚本
 *
 * 保护以下数值不被 AI 直接修改：
 *
 * 世界状态（由脚本完全控制，AI不可修改）：
 * - 世界.时间
 * - 世界.日期
 * - 世界.星期
 *
 * 时间推进说明：
 * - 默认每回合自动推进1小时
 * - 当玩家输入包含时间跳跃关键词时（如"第二天"、"几小时后"等），
 *   脚本会自动检测并跳跃相应时间
 * - AI无需也无法修改时间相关变量
 *
 * 角色核心数值（仅能通过念头系统变化）：
 * - 道德底线
 * - 对主角依存度
 * - 对苏文依存度
 * - 潜意识侵蚀度
 * - 当前阶段
 * - 阶段标题
 *
 * 念头系统数值（由脚本自动计算）：
 * - 念头培育区.*.开发进度
 * - 念头培育区.*.需要时间
 * - 念头培育区.*.过期时间
 */

$(async () => {
  await waitGlobalInitialized('Mvu');

  // 世界时间字段（始终保护，AI不可修改）
  const WORLD_PROTECTED_FIELDS: string[] = [
    '世界.时间',
    '世界.日期',
    '世界.星期',
  ];

  // 需要保护的角色字段（秦璐和苏梦都适用）
  const CHARACTER_PROTECTED_FIELDS = [
    '道德底线',
    '对主角依存度',
    '对苏文依存度',
    '潜意识侵蚀度',
    '当前阶段',
    '阶段标题',
  ];

  // 念头系统保护字段（这些由脚本自动计算，AI不应修改）
  const THOUGHT_PROTECTED_FIELDS = [
    '开发进度',
    '需要时间',
    '过期时间',
  ];

  // 角色前缀
  const CHARACTER_PREFIXES = ['秦璐状态', '苏梦状态'];

  // 检查路径是否匹配念头系统保护字段
  // 念头培育区是数组，路径格式如：秦璐状态.念头培育区.0.开发进度
  function isThoughtFieldProtected(path: string): boolean {
    // 检查是否包含 念头培育区 且以保护字段结尾
    if (!path.includes('念头培育区')) return false;
    return THOUGHT_PROTECTED_FIELDS.some(field => path.endsWith('.' + field));
  }

  // 检查路径是否匹配世界保护字段
  function isWorldProtectedField(path: string): boolean {
    return WORLD_PROTECTED_FIELDS.some(field => {
      return path === field || path.endsWith('.' + field) || path.includes('.' + field + '.');
    });
  }

  // 检查路径是否匹配角色保护字段
  function isCharacterProtectedField(path: string): boolean {
    for (const prefix of CHARACTER_PREFIXES) {
      for (const field of CHARACTER_PROTECTED_FIELDS) {
        const fullPath = `${prefix}.${field}`;
        if (path === fullPath || path.endsWith('.' + fullPath) || path.includes('.' + fullPath + '.')) {
          return true;
        }
      }
    }
    return false;
  }

  // 监听命令解析事件
  eventOn(Mvu.events.COMMAND_PARSED, (_variables: any, commands: any[], _message_content: string) => {
    console.info(`[核心数值保护] 解析到 ${commands.length} 个命令`);

    let interceptCount = 0;
    // 从后往前遍历，便于删除
    for (let i = commands.length - 1; i >= 0; i--) {
      const command = commands[i];
      const path = command.args?.[0];

      if (path) {
        // 检查世界保护字段（始终拦截）
        if (isWorldProtectedField(path)) {
          console.warn(`[核心数值保护] 拦截世界字段: ${command.type} "${path}"`);
          commands.splice(i, 1);
          interceptCount++;
          continue;
        }

        // 检查角色保护字段（始终拦截）
        if (isCharacterProtectedField(path)) {
          console.warn(`[核心数值保护] 拦截角色字段: ${command.type} "${path}"`);
          commands.splice(i, 1);
          interceptCount++;
          continue;
        }

        // 检查念头系统保护字段（始终拦截）
        if (isThoughtFieldProtected(path)) {
          console.warn(`[核心数值保护] 拦截念头字段: ${command.type} "${path}"`);
          commands.splice(i, 1);
          interceptCount++;
        }
      }
    }

    if (interceptCount > 0) {
      console.warn(`[核心数值保护] 共拦截 ${interceptCount} 个命令，剩余 ${commands.length} 个命令`);
    }
  });

  console.info('[核心数值保护] 脚本加载完成');
});
