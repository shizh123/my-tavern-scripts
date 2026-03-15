/**
 * 时间推进模块
 * 负责：时间推进（含时间跳跃检测）、位置追踪、苏文作息、疑心值系统、巡逻检测、念头开发进度
 *
 * 时间推进规则：
 * - 默认每回合推进1小时
 * - 当玩家输入包含时间跳跃关键词时，自动跳跃相应时间
 * - 时间跳跃由脚本完全控制，AI无法直接修改时间/日期/星期
 */

import type { SchemaType } from '../../schema';

// ========== 时间跳跃关键词配置 ==========
interface TimeJumpRule {
  keywords: string[];
  hours?: number; // 固定小时数
  days?: number; // 固定天数
  targetHour?: number; // 目标时间点（如早上8点）
  nextDay?: boolean; // 是否跳到下一天
}

const TIME_JUMP_RULES: TimeJumpRule[] = [
  // 具体时间跳跃（天数）
  { keywords: ['一个星期后', '一周后'], days: 7 },
  { keywords: ['几天后', '几天之后'], days: 5 },
  { keywords: ['一天后'], days: 1 },
  { keywords: ['两天后'], days: 2 },
  { keywords: ['三天后'], days: 3 },
  { keywords: ['一个月后'], days: 30 },
  { keywords: ['几个月后'], days: 90 },
  { keywords: ['半年后'], days: 180 },
  { keywords: ['一年后'], days: 365 },

  // 次日相关
  { keywords: ['第二天', '次日', '隔天', '明天'], nextDay: true, targetHour: 8 },
  { keywords: ['后天'], days: 2, targetHour: 8 },
  { keywords: ['大后天'], days: 3, targetHour: 8 },

  // 小时跳跃
  { keywords: ['几个小时后', '几小时后'], hours: 3 },
  { keywords: ['一小时后'], hours: 1 },
  { keywords: ['两小时后'], hours: 2 },
  { keywords: ['三小时后'], hours: 3 },
  { keywords: ['半小时后'], hours: 1 }, // 向上取整到1小时
  { keywords: ['过了一会', '过了很久', '过了一段时间'], hours: 2 },

  // 时间段跳跃（跳到当天或次日的指定时间）
  { keywords: ['早上', '早晨', '清晨'], targetHour: 7 },
  { keywords: ['上午'], targetHour: 10 },
  { keywords: ['中午', '午后'], targetHour: 12 },
  { keywords: ['下午'], targetHour: 15 },
  { keywords: ['傍晚', '黄昏'], targetHour: 18 },
  { keywords: ['晚上'], targetHour: 20 },
  { keywords: ['深夜', '午夜'], targetHour: 23 },
  { keywords: ['凌晨'], nextDay: true, targetHour: 2 },

  // 场景时间跳跃
  { keywords: ['吃早饭', '早餐'], targetHour: 8 },
  { keywords: ['吃午饭', '午餐'], targetHour: 12 },
  { keywords: ['吃晚饭', '晚餐'], targetHour: 19 },
  { keywords: ['睡觉前', '睡前'], targetHour: 22 },
  { keywords: ['起床后'], targetHour: 7 },
  { keywords: ['下班后', '放学后'], targetHour: 18 },

  // 直接时间设定
  { keywords: ['时间来到', '时间跳转', '场景切换到'], hours: 3 }, // 默认跳3小时
];

/**
 * 检测玩家输入中的时间跳跃关键词，返回需要跳跃的小时数
 * @param userInput 玩家输入
 * @param currentHour 当前小时
 * @returns 需要跳跃的小时数（0表示不跳跃，使用默认+1小时）
 */
function detectTimeJump(userInput: string, currentHour: number): number {
  if (!userInput) return 0;

  // 【关键修复】如果文本中包含住院/头孢+酒/安眠药关键词，跳过时间跳跃检测
  // 这避免了"住院一天"、"第二天还在医院"、"安眠药效果持续几小时"等描述误触发时间跳跃
  const specialItemPatterns = [
    // 住院相关
    '头孢.*酒',
    '酒.*头孢',
    '住院',
    '紧急送医',
    '双硫仑',
    '头孢菌素',
    '喂头孢',
    '服用头孢',
    '吃头孢',
    // 安眠药相关
    '安眠药',
    '安眠藥',
    '服用安眠',
    '吃下安眠',
    '喂安眠',
    '餵安眠',
    '下药',
    '下藥',
    '迷药',
    '迷藥',
    '睡眠药',
    '睡眠藥',
  ];
  const hasSpecialItemKeyword = specialItemPatterns.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(userInput);
  });

  if (hasSpecialItemKeyword) {
    console.info('[时间跳跃] 检测到特殊道具相关内容（住院/安眠药），跳过时间跳跃检测，使用默认+1小时');
    return 0; // 使用默认+1小时
  }

  for (const rule of TIME_JUMP_RULES) {
    const matched = rule.keywords.some(keyword => userInput.includes(keyword));
    if (!matched) continue;

    console.info(`[时间跳跃] 检测到关键词: ${rule.keywords.find(k => userInput.includes(k))}`);

    // 固定天数跳跃
    if (rule.days !== undefined) {
      let hours = rule.days * 24;
      // 如果有目标时间点，调整到那个时间
      if (rule.targetHour !== undefined) {
        const hoursUntilTarget = (rule.targetHour - currentHour + 24) % 24;
        hours = (rule.days - 1) * 24 + hoursUntilTarget;
        if (hoursUntilTarget === 0) hours += 24; // 如果恰好是目标时间，跳到下一天的目标时间
      }
      console.info(`[时间跳跃] 天数跳跃: ${rule.days}天 = ${hours}小时`);
      return hours;
    }

    // 固定小时跳跃
    if (rule.hours !== undefined) {
      console.info(`[时间跳跃] 小时跳跃: ${rule.hours}小时`);
      return rule.hours;
    }

    // 目标时间点跳跃
    if (rule.targetHour !== undefined) {
      let hoursUntilTarget = rule.targetHour - currentHour;

      // 如果是次日，或者目标时间已过，跳到次日
      if (rule.nextDay || hoursUntilTarget <= 0) {
        hoursUntilTarget += 24;
      }

      console.info(`[时间跳跃] 目标时间跳跃: 当前${currentHour}点 → ${rule.targetHour}点 = ${hoursUntilTarget}小时`);
      return hoursUntilTarget;
    }
  }

  return 0; // 无匹配，使用默认+1小时
}

// ========== 位置相关工具函数 ==========
// LOCATION_KEYWORDS 已废弃，现在直接从 世界.地点 读取位置

const SPACE_GROUPS: Record<string, string[]> = {
  公共区域: ['客厅', '餐厅', '厨房'],
  主角房间: ['主角房间'],
  苏梦房间: ['苏梦房间'],
  主卧: ['主卧'],
  浴室: ['浴室'],
  外面: ['外面'],
};

function getSpaceGroup(location: string): string | null {
  for (const [group, locations] of Object.entries(SPACE_GROUPS)) {
    if (locations.includes(location)) return group;
  }
  return null;
}

function isSameSpace(location1: string, location2: string): boolean {
  const group1 = getSpaceGroup(location1);
  const group2 = getSpaceGroup(location2);
  if (!group1 || !group2) return false;
  return group1 === group2;
}

// matchLocation 已废弃，现在直接从 世界.地点 读取位置

export function parseTime(timeStr: string, dateStr: string): Date {
  const [year, month, day] = dateStr.split('/').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// ========== 安眠药关键词配置 ==========
const SLEEPING_PILL_KEYWORDS = [
  '安眠药',
  '安眠藥',
  '吃下安眠',
  '服用安眠',
  '喂安眠',
  '餵安眠',
  '下药',
  '下藥',
  '迷药',
  '迷藥',
  '睡眠药',
  '睡眠藥',
];

// 安眠药冷却时间（小时）- 48小时 = 2天
const SLEEPING_PILL_COOLDOWN_HOURS = 48;

// ========== 头孢+酒关键词配置（终极隐藏模式） ==========
const HOSPITALIZATION_KEYWORDS = [
  // 头孢类抗生素 + 酒的组合
  '头孢.*酒',
  '酒.*头孢',
  '頭孢.*酒',
  '酒.*頭孢',
  '头孢菌素.*酒',
  '酒.*头孢菌素',
  // 直接触发词
  '喂头孢',
  '喂酒.*头孢',
  '头孢.*喝酒',
  '吃头孢.*喝酒',
  '喝酒.*吃头孢',
  '服用头孢.*饮酒',
  '饮酒.*服用头孢',
  // 双硫仑反应相关
  '双硫仑',
  '雙硫侖',
  // 简化触发词（用户可能直接写）
  '头孢加酒',
  '酒加头孢',
  '头孢配酒',
  '酒配头孢',
];

// 住院时间（天数）- 15天
const HOSPITALIZATION_DAYS = 15;

/**
 * 检测文本中是否包含安眠药相关关键词
 */
function detectSleepingPill(text: string): boolean {
  if (!text) return false;
  return SLEEPING_PILL_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * 检测文本中是否包含头孢+酒相关关键词（终极隐藏模式触发）
 */
function detectHospitalization(text: string): boolean {
  if (!text) return false;
  // 使用正则匹配（支持 .* 通配符）
  return HOSPITALIZATION_KEYWORDS.some(pattern => {
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  });
}

/**
 * 激活头孢+酒住院效果（终极隐藏模式）
 * @param data 变量数据
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @param currentFloor 当前消息楼层ID（用于ROLL检测）
 * @returns 是否成功激活
 */
function activateHospitalization(
  data: SchemaType,
  currentDate: string,
  currentTime: string,
  currentFloor: number,
): boolean {
  const hospState = data.苏文状态.住院状态;
  const lastTriggerFloor = hospState?.触发楼层 ?? -1;

  // 【ROLL支持】如果是同一楼层的重复触发，且已住院，直接返回true（保持现有状态）
  if (lastTriggerFloor === currentFloor && hospState?.是否住院) {
    console.info(`[头孢+酒] 检测到ROLL（楼层${currentFloor}），住院状态已激活，保持现有状态`);
    return true;
  }

  // 如果已经在住院中，不能重复触发
  if (hospState?.是否住院) {
    console.warn('[头孢+酒] 苏文已在住院中，无法重复触发');
    return false;
  }

  const startTime = parseTime(currentTime, currentDate);
  const endTime = new Date(startTime.getTime());
  endTime.setDate(endTime.getDate() + HOSPITALIZATION_DAYS); // 15天后出院

  const endYear = endTime.getFullYear();
  const endMonth = String(endTime.getMonth() + 1).padStart(2, '0');
  const endDay = String(endTime.getDate()).padStart(2, '0');
  const endHour = String(endTime.getHours()).padStart(2, '0');
  const endMinute = String(endTime.getMinutes()).padStart(2, '0');

  data.苏文状态.住院状态 = {
    是否住院: true,
    住院开始时间: `${currentDate} ${currentTime}`,
    住院结束时间: `${endYear}/${endMonth}/${endDay} ${endHour}:${endMinute}`,
    剩余天数: HOSPITALIZATION_DAYS,
    触发楼层: currentFloor,
  };

  // 【关键】住院期间，两个角色的疑心值冻结15天
  const freezeEndTime = `${endYear}/${endMonth}/${endDay} ${endHour}:${endMinute}`;
  data.苏文状态.对秦璐疑心值冻结 = {
    是否冻结: true,
    借口内容: '苏文住院中',
    冻结开始时间: `${currentDate} ${currentTime}`,
    冻结结束时间: freezeEndTime,
  };
  data.苏文状态.对苏梦疑心值冻结 = {
    是否冻结: true,
    借口内容: '苏文住院中',
    冻结开始时间: `${currentDate} ${currentTime}`,
    冻结结束时间: freezeEndTime,
  };

  console.info(
    `[头孢+酒] 终极隐藏模式触发！苏文因头孢+酒反应紧急住院，将于 ${data.苏文状态.住院状态.住院结束时间} 出院`,
  );
  console.info(`[头孢+酒] 疑心值冻结15天，秦璐/苏梦可全阶段植入念头`);
  return true;
}

/**
 * 更新住院状态（检查是否出院，计算剩余天数）
 * @param data 变量数据
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @returns 是否仍在住院
 */
function updateHospitalizationState(data: SchemaType, currentDate: string, currentTime: string): boolean {
  const hospState = data.苏文状态.住院状态;
  if (!hospState?.是否住院) return false;

  const endTimeStr = hospState.住院结束时间;
  if (!endTimeStr || !endTimeStr.includes(' ')) return false;

  const [endDatePart, endTimePart] = endTimeStr.split(' ');
  if (!endDatePart || !endTimePart) return false;

  const endTime = parseTime(endTimePart, endDatePart);
  const currentTimeObj = parseTime(currentTime, currentDate);

  if (currentTimeObj >= endTime) {
    // 住院结束，苏文出院
    data.苏文状态.住院状态 = {
      是否住院: false,
      住院开始时间: '',
      住院结束时间: '',
      剩余天数: 0,
      触发楼层: -1,
    };
    console.info('[头孢+酒] 苏文出院，恢复正常状态');
    return false;
  }

  // 计算剩余天数
  const remainingMs = endTime.getTime() - currentTimeObj.getTime();
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  data.苏文状态.住院状态.剩余天数 = remainingDays;

  return true;
}

/**
 * 检查安眠药冷却时间是否已过
 * @param lastUseTime 上次使用时间
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @returns 是否可以使用（冷却已过）
 */
function isSleepingPillCooldownOver(lastUseTime: string, currentDate: string, currentTime: string): boolean {
  if (!lastUseTime || !lastUseTime.includes(' ')) return true;

  const [lastDatePart, lastTimePart] = lastUseTime.split(' ');
  if (!lastDatePart || !lastTimePart) return true;

  const lastTime = parseTime(lastTimePart, lastDatePart);
  const current = parseTime(currentTime, currentDate);
  const hoursDiff = (current.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

  return hoursDiff >= SLEEPING_PILL_COOLDOWN_HOURS;
}

/**
 * 激活安眠药效果
 * @param data 变量数据
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @param currentFloor 当前消息楼层ID（用于ROLL检测）
 * @returns 是否成功激活（冷却未过则返回false）
 */
function activateSleepingPill(
  data: SchemaType,
  currentDate: string,
  currentTime: string,
  currentFloor: number,
): boolean {
  const pillState = data.苏文状态.安眠药状态;
  const lastUseTime = pillState.上次使用时间;
  const lastTriggerFloor = pillState.触发楼层 ?? -1;

  // 【ROLL支持】如果是同一楼层的重复触发，且安眠药已生效，直接返回true（保持现有状态）
  if (lastTriggerFloor === currentFloor && pillState.是否生效) {
    console.info(`[安眠药] 检测到ROLL（楼层${currentFloor}），安眠药已生效，保持现有状态`);
    return true;
  }

  // 【ROLL支持】如果是同一楼层的重复触发，跳过冷却检查（视为同一次使用）
  const isRollTrigger = lastTriggerFloor === currentFloor;
  if (!isRollTrigger) {
    // 不是ROLL，正常检查冷却时间
    if (!isSleepingPillCooldownOver(lastUseTime, currentDate, currentTime)) {
      console.warn('[安眠药] 安眠药冷却中（48小时），无法使用');
      return false;
    }
  } else {
    console.info(`[安眠药] 检测到ROLL（楼层${currentFloor}），跳过冷却检查`);
  }

  const startTime = parseTime(currentTime, currentDate);
  const endTime = new Date(startTime.getTime());
  endTime.setHours(endTime.getHours() + 6); // 6小时后失效

  const endYear = endTime.getFullYear();
  const endMonth = String(endTime.getMonth() + 1).padStart(2, '0');
  const endDay = String(endTime.getDate()).padStart(2, '0');
  const endHour = String(endTime.getHours()).padStart(2, '0');
  const endMinute = String(endTime.getMinutes()).padStart(2, '0');

  data.苏文状态.安眠药状态 = {
    是否生效: true,
    生效开始时间: `${currentDate} ${currentTime}`,
    生效结束时间: `${endYear}/${endMonth}/${endDay} ${endHour}:${endMinute}`,
    剩余时间: 6,
    上次使用时间: `${currentDate} ${currentTime}`,
    触发楼层: currentFloor,
  };

  console.info(`[安眠药] 苏文服用安眠药，陷入沉睡，将于 ${data.苏文状态.安眠药状态.生效结束时间} 苏醒`);
  return true;
}

/**
 * 更新安眠药状态（检查是否过期，计算剩余时间）
 * @param data 变量数据
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @returns 安眠药是否仍在生效
 */
function updateSleepingPillState(data: SchemaType, currentDate: string, currentTime: string): boolean {
  const pillState = data.苏文状态.安眠药状态;
  if (!pillState.是否生效) return false;

  const endTimeStr = pillState.生效结束时间;
  if (!endTimeStr || !endTimeStr.includes(' ')) return false;

  const [endDatePart, endTimePart] = endTimeStr.split(' ');
  if (!endDatePart || !endTimePart) return false;

  const endTime = parseTime(endTimePart, endDatePart);
  const currentTimeObj = parseTime(currentTime, currentDate);

  if (currentTimeObj >= endTime) {
    // 安眠药效果结束，但保留上次使用时间用于冷却判定，触发楼层重置
    const lastUseTime = pillState.上次使用时间;
    data.苏文状态.安眠药状态 = {
      是否生效: false,
      生效开始时间: '',
      生效结束时间: '',
      剩余时间: 0,
      上次使用时间: lastUseTime,
      触发楼层: -1, // 效果结束后重置触发楼层
    };
    console.info('[安眠药] 苏文从沉睡中苏醒');
    return false;
  }

  // 计算剩余时间（小时）
  const remainingMs = endTime.getTime() - currentTimeObj.getTime();
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  data.苏文状态.安眠药状态.剩余时间 = remainingHours;

  return true;
}

// ========== 苏文作息 ==========
function updateSuwenSchedule(data: SchemaType, dateStr: string, timeStr: string): void {
  const [hour, minute] = timeStr.split(':').map(Number);
  const timeInMinutes = hour * 60 + minute;
  const [year, month, day] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let newStatus: '在家' | '出差' | '上班' | '睡眠' = '在家';
  let newLocation: '客厅' | '餐厅' | '厨房' | '主卧' | '浴室' | '主角房间' | '外面' = '客厅';

  if (isWeekend) {
    if (timeInMinutes >= 23 * 60 || timeInMinutes < 7 * 60) {
      newStatus = '睡眠';
      newLocation = '主卧';
    } else if (timeInMinutes >= 7 * 60 && timeInMinutes < 8 * 60) {
      newStatus = '在家';
      newLocation = '主卧';
    } else if (timeInMinutes >= 8 * 60 && timeInMinutes < 9 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
    } else if (timeInMinutes >= 9 * 60 && timeInMinutes < 12 * 60) {
      newStatus = '在家';
      newLocation = '客厅';
    } else if (timeInMinutes >= 12 * 60 && timeInMinutes < 13 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
    } else if (timeInMinutes >= 13 * 60 && timeInMinutes < 18 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.3 ? '外面' : '客厅';
    } else if (timeInMinutes >= 18 * 60 && timeInMinutes < 19 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
    } else if (timeInMinutes >= 19 * 60 && timeInMinutes < 22 * 60) {
      newStatus = '在家';
      newLocation = '客厅';
    } else if (timeInMinutes >= 22 * 60 && timeInMinutes < 23 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.5 ? '主卧' : '浴室';
    }
  } else {
    // 工作日：根据星期几决定上午班还是下午班
    // 周一、周三、周五：上午班 (8:00-12:00)
    // 周二、周四：下午班 (13:00-18:00)
    const isMorningShift = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;

    if (timeInMinutes >= 23 * 60 || timeInMinutes < 6 * 60) {
      newStatus = '睡眠';
      newLocation = '主卧';
    } else if (timeInMinutes >= 6 * 60 && timeInMinutes < 7 * 60) {
      newStatus = '在家';
      newLocation = '主卧';
    } else if (timeInMinutes >= 7 * 60 && timeInMinutes < 8 * 60) {
      newStatus = '在家';
      newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
    } else if (isMorningShift) {
      // 上午班：8:00-12:00 上班，下午在家
      if (timeInMinutes >= 8 * 60 && timeInMinutes < 12 * 60) {
        newStatus = '上班';
        newLocation = '外面';
      } else if (timeInMinutes >= 12 * 60 && timeInMinutes < 13 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
      } else if (timeInMinutes >= 13 * 60 && timeInMinutes < 18 * 60) {
        newStatus = '在家';
        newLocation = '客厅';
      } else if (timeInMinutes >= 18 * 60 && timeInMinutes < 19 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
      } else if (timeInMinutes >= 19 * 60 && timeInMinutes < 22 * 60) {
        newStatus = '在家';
        newLocation = '客厅';
      } else if (timeInMinutes >= 22 * 60 && timeInMinutes < 23 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '主卧' : '浴室';
      }
    } else {
      // 下午班：上午在家，13:00-18:00 上班
      if (timeInMinutes >= 8 * 60 && timeInMinutes < 12 * 60) {
        newStatus = '在家';
        newLocation = '客厅';
      } else if (timeInMinutes >= 12 * 60 && timeInMinutes < 13 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '餐厅' : '厨房';
      } else if (timeInMinutes >= 13 * 60 && timeInMinutes < 18 * 60) {
        newStatus = '上班';
        newLocation = '外面';
      } else if (timeInMinutes >= 18 * 60 && timeInMinutes < 19 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '客厅' : '厨房';
      } else if (timeInMinutes >= 19 * 60 && timeInMinutes < 22 * 60) {
        newStatus = '在家';
        newLocation = '客厅';
      } else if (timeInMinutes >= 22 * 60 && timeInMinutes < 23 * 60) {
        newStatus = '在家';
        newLocation = Math.random() < 0.5 ? '主卧' : '浴室';
      }
    }
  }

  const patrolActive = data.系统追踪?.苏文巡逻事件?.待触发;
  if (patrolActive) {
    if (data.苏文状态.当前状态 !== newStatus) {
      data.苏文状态.当前状态 = newStatus;
    }
    return;
  }

  if (data.苏文状态.当前状态 !== newStatus || data.苏文状态.当前位置 !== newLocation) {
    data.苏文状态.当前状态 = newStatus;
    data.苏文状态.当前位置 = newLocation;
  }
}

// ========== 巡逻配置 ==========
const PATROL_CONFIG = {
  baseProbability: 0.15,
  timeModifiers: {
    morning: { start: 7, end: 12, modifier: 1.0 },
    afternoon: { start: 12, end: 18, modifier: 1.2 },
    evening: { start: 18, end: 22, modifier: 0.8 },
    night: { start: 22, end: 7, modifier: 0.3 },
  },
  suspicionModifiers: [
    { min: 0, max: 20, modifier: 0.8 },
    { min: 20, max: 40, modifier: 1.0 },
    { min: 40, max: 60, modifier: 1.3 },
    { min: 60, max: 80, modifier: 1.6 },
    { min: 80, max: 100, modifier: 2.0 },
  ],
  cooldownHours: 2,
};

function getTimeModifier(hour: number): number {
  const { timeModifiers } = PATROL_CONFIG;
  if (hour >= timeModifiers.morning.start && hour < timeModifiers.morning.end) return timeModifiers.morning.modifier;
  if (hour >= timeModifiers.afternoon.start && hour < timeModifiers.afternoon.end)
    return timeModifiers.afternoon.modifier;
  if (hour >= timeModifiers.evening.start && hour < timeModifiers.evening.end) return timeModifiers.evening.modifier;
  return timeModifiers.night.modifier;
}

function getSuspicionModifier(suspicion: number): number {
  for (const range of PATROL_CONFIG.suspicionModifiers) {
    if (suspicion >= range.min && suspicion < range.max) return range.modifier;
  }
  return 1.0;
}

function calculatePatrolProbability(hour: number, suspicion: number): number {
  const probability = PATROL_CONFIG.baseProbability * getTimeModifier(hour) * getSuspicionModifier(suspicion);
  return Math.min(0.8, Math.max(0, probability));
}

function isPatrolCooldownOver(lastPatrolTime: string, currentDate: string, currentTime: string): boolean {
  if (!lastPatrolTime || !lastPatrolTime.includes(' ')) return true;
  const [lastDatePart, lastTimePart] = lastPatrolTime.split(' ');
  if (!lastDatePart || !lastTimePart) return true;
  const lastTime = parseTime(lastTimePart, lastDatePart);
  const current = parseTime(currentTime, currentDate);
  const hoursDiff = (current.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
  return hoursDiff >= PATROL_CONFIG.cooldownHours;
}

/**
 * 判断是否应该累积疑心值
 *
 * 新逻辑：
 * 1. 苏文醒着且在家 = 累积窗口开启
 * 2. 窗口内，角色在主角房间的每小时都累积
 * 3. 窗口关闭时（睡觉/上班），如果累积 < 2 小时则作废
 */
function shouldIncreaseSuspicion(
  suwenState: SchemaType['苏文状态'],
  characterLocation: string,
  suwenLocation: string,
  currentCharacter: '秦璐' | '苏梦',
): boolean {
  const freezeField = currentCharacter === '秦璐' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';

  // 1. 疑心值冻结时不累积
  if (suwenState[freezeField].是否冻结) return false;

  // 2. 苏文睡眠时不累积（察觉不到）
  if (suwenState.当前状态 === '睡眠') return false;

  // 3. 苏文上班/出差时不累积（不在家察觉不到）
  if (suwenState.当前状态 === '出差' || suwenState.当前状态 === '上班') return false;

  // 4. 苏文在外面时不累积
  if (suwenLocation === '外面') return false;

  // 5. 角色必须在主角房间（位置未知也视为在主角房间）
  if (characterLocation !== '主角房间' && characterLocation !== '' && characterLocation) {
    return false;
  }

  // 6. 角色和苏文不能在同一空间（苏文在主角房间时不累积）
  if (isSameSpace(characterLocation || '主角房间', suwenLocation)) return false;

  return true;
}

function extractKeywords(thoughtContent: string): string[] {
  const keywords: string[] = [thoughtContent];
  const segments = thoughtContent.split(/[，。、；：！？\s]+/).filter(s => s.length >= 2);
  keywords.push(...segments);
  for (let len = 2; len <= Math.min(4, thoughtContent.length); len++) {
    for (let i = 0; i <= thoughtContent.length - len; i++) {
      const word = thoughtContent.slice(i, i + len);
      if (!/^[，。、；：！？\s]+$/.test(word)) keywords.push(word);
    }
  }
  return [...new Set(keywords)];
}

function checkThoughtRelevance(thoughtContent: string, userMessage: string, aiMessage: string): number {
  const keywords = extractKeywords(thoughtContent);
  const combinedText = `${userMessage} ${aiMessage}`.toLowerCase();
  let matchCount = 0;
  let exactMatch = false;
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      matchCount++;
      if (keyword === thoughtContent) exactMatch = true;
    }
  }
  if (exactMatch || matchCount >= 5) return 3;
  if (matchCount >= 3) return 2;
  if (matchCount >= 1) return 1;
  return 0;
}

// ========== 安眠药状态导出函数 ==========
/**
 * 检查安眠药是否正在生效
 * @param data 变量数据
 * @returns 安眠药是否生效
 */
export function isSleepingPillEffective(data: SchemaType): boolean {
  return data.苏文状态.安眠药状态?.是否生效 === true;
}

/**
 * 获取安眠药剩余时间（小时）
 * @param data 变量数据
 * @returns 剩余时间（小时），如果未生效返回0
 */
export function getSleepingPillRemainingHours(data: SchemaType): number {
  if (!isSleepingPillEffective(data)) return 0;
  return data.苏文状态.安眠药状态.剩余时间 || 0;
}

/**
 * 检查安眠药冷却是否已过
 * @param data 变量数据
 * @param currentDate 当前日期
 * @param currentTime 当前时间
 * @returns 是否可以使用安眠药
 */
export function canUseSleepingPill(data: SchemaType, currentDate: string, currentTime: string): boolean {
  const lastUseTime = data.苏文状态.安眠药状态?.上次使用时间 || '';
  return isSleepingPillCooldownOver(lastUseTime, currentDate, currentTime);
}

// ========== 住院状态导出函数（终极隐藏模式） ==========
/**
 * 检查苏文是否住院中（头孢+酒终极隐藏模式）
 * @param data 变量数据
 * @returns 是否住院中
 */
export function isHospitalized(data: SchemaType): boolean {
  return data.苏文状态.住院状态?.是否住院 === true;
}

/**
 * 获取住院剩余天数
 * @param data 变量数据
 * @returns 剩余天数，如果未住院返回0
 */
export function getHospitalizationRemainingDays(data: SchemaType): number {
  if (!isHospitalized(data)) return 0;
  return data.苏文状态.住院状态.剩余天数 || 0;
}

/**
 * 获取住院结束时间
 * @param data 变量数据
 * @returns 住院结束时间字符串，如果未住院返回空字符串
 */
export function getHospitalizationEndTime(data: SchemaType): string {
  if (!isHospitalized(data)) return '';
  return data.苏文状态.住院状态.住院结束时间 || '';
}

// ========== 主导出函数 ==========
export interface TimeAdvanceResult {
  oldTime: string;
  oldDate: string;
  newTime: string;
  newDate: string;
}

/**
 * 执行时间推进逻辑
 * @param data 变量数据（会被直接修改）
 * @param userText 用户输入文本
 * @param aiText AI输出文本
 * @returns 时间变化信息
 */
export function advanceTime(data: SchemaType, userText: string, aiText: string): TimeAdvanceResult | null {
  const oldDate = data.世界?.日期;
  const oldTime = data.世界?.时间;

  if (!oldTime || !oldDate || !oldTime.includes(':') || !oldDate.includes('/')) {
    console.error('[时间推进] 时间格式无效!', { 时间: oldTime, 日期: oldDate });
    return null;
  }

  // ===== 计算新时间 =====
  const [hours, minutes] = oldTime.split(':').map(Number);
  const [year, month, day] = oldDate.split('/').map(Number);

  if (isNaN(hours) || isNaN(minutes) || isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error('[时间推进] 时间解析失败!', { hours, minutes, year, month, day });
    return null;
  }

  // ===== 检测时间跳跃 =====
  const jumpHours = detectTimeJump(userText, hours);
  const hoursToAdvance = jumpHours > 0 ? jumpHours : 1; // 默认+1小时
  const isTimeJump = jumpHours > 1; // 是否是时间跳跃（超过1小时）

  if (jumpHours > 0) {
    console.info(`[时间推进] 检测到时间跳跃，推进 ${hoursToAdvance} 小时`);
  }

  const currentDate = new Date(year, month - 1, day, hours, minutes);
  currentDate.setHours(currentDate.getHours() + hoursToAdvance);

  const newHours = String(currentDate.getHours()).padStart(2, '0');
  const newMinutes = String(currentDate.getMinutes()).padStart(2, '0');
  const newTime = `${newHours}:${newMinutes}`;
  const newYear = currentDate.getFullYear();
  const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const newDay = String(currentDate.getDate()).padStart(2, '0');
  const newDate = `${newYear}/${newMonth}/${newDay}`;

  // ===== 计算星期 =====
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
  const newWeekDay = weekDays[currentDate.getDay()];

  // ===== 更新时间 =====
  data.世界.时间 = newTime;
  data.世界.日期 = newDate;
  data.世界.星期 = newWeekDay;
  (data as any)._推进前时间 = `${oldDate} ${oldTime}`;

  // ===== 位置追踪 =====
  const tracking = data.系统追踪;

  // 直接从 世界.地点 读取位置（AI 通过 MVU 命令更新，比从 AI 文本匹配更可靠）
  const worldLocation = data.世界?.地点 || '';
  const isInSonRoom = worldLocation.includes('主角房间');
  const currentLocationFromWorld = isInSonRoom ? '主角房间' : worldLocation.split(' - ').pop() || '客厅';

  const oldLocation = tracking.当前所在位置;
  if (oldLocation !== currentLocationFromWorld) {
    tracking.当前所在位置 = currentLocationFromWorld;
    tracking.进入当前位置时间 = `${newDate} ${newTime}`;
    console.info(`[位置追踪] 位置变化: ${oldLocation} → ${currentLocationFromWorld}`);

    // 角色离开主角房间，只有在打断事件已通知AI后才清除
    if (oldLocation === '主角房间' && !isInSonRoom) {
      // 危险时间累计由疑心值追踪逻辑统一管理，这里不重置
      if (tracking.苏文打断事件?.待触发 && tracking.苏文打断事件?.已通知AI) {
        console.info('[位置追踪] 角色离开主角房间，打断事件已通知AI，清除打断事件标记');
        tracking.苏文打断事件.待触发 = false;
        tracking.苏文打断事件.已通知AI = false;
        tracking.苏文打断事件.打断原因 = '';
        tracking.苏文打断事件.累计时间 = 0;
      } else if (tracking.苏文打断事件?.待触发) {
        console.info('[位置追踪] 角色离开主角房间，但打断事件尚未通知AI，保留打断事件');
      }
    }
  }
  tracking.上次更新时间 = `${newDate} ${newTime}`;

  // ===== 苏文作息 =====
  updateSuwenSchedule(data, newDate, newTime);

  // ===== 头孢+酒检测与状态更新（终极隐藏模式，优先于安眠药） =====
  const combinedText = `${userText} ${aiText}`;
  const currentFloor = getLastMessageId();

  if (detectHospitalization(combinedText)) {
    // 尝试激活住院效果（支持ROLL）
    activateHospitalization(data, newDate, newTime, currentFloor);
  }

  // 更新住院状态（检查是否出院）
  const isHospitalized = updateHospitalizationState(data, newDate, newTime);

  // 如果住院中，强制苏文状态为出差（在医院）
  if (isHospitalized) {
    data.苏文状态.当前状态 = '出差';
    data.苏文状态.当前位置 = '外面';
    console.info(`[头孢+酒] 苏文住院中，剩余 ${data.苏文状态.住院状态.剩余天数} 天`);
  }

  // ===== 安眠药检测与状态更新 =====
  // 检测用户/AI文本中是否包含安眠药关键词（住院期间安眠药无效）
  if (!isHospitalized && detectSleepingPill(combinedText)) {
    // 尝试激活安眠药效果（会检查冷却时间，支持ROLL）
    activateSleepingPill(data, newDate, newTime, currentFloor);
  }

  // 更新安眠药状态（检查是否过期）
  const isSleepingPillActive = !isHospitalized && updateSleepingPillState(data, newDate, newTime);

  // 如果安眠药生效，强制苏文状态为沉睡
  if (isSleepingPillActive) {
    data.苏文状态.当前状态 = '睡眠';
    data.苏文状态.当前位置 = '主卧';
    console.info(`[安眠药] 苏文处于安眠药沉睡状态，剩余 ${data.苏文状态.安眠药状态.剩余时间} 小时`);
  }

  // ===== 疑心值追踪（双角色独立系统） =====
  const currentLocation = tracking.当前所在位置;
  const currentCharacter = tracking.当前角色 || '秦璐';
  const suwenLocation = data.苏文状态.当前位置 || '客厅';
  const suwenStatus = data.苏文状态.当前状态;

  console.info(`[疑心值追踪] 时间: ${oldDate} ${oldTime} → ${newDate} ${newTime}`);
  console.info(
    `[疑心值追踪] 当前角色="${currentCharacter}", 当前位置="${currentLocation}", 苏文位置="${suwenLocation}", 苏文状态="${suwenStatus}"`,
  );

  // 【关键】初始化角色独立的危险时间累计（兼容旧数据）
  if (tracking.秦璐危险时间累计 === undefined) {
    tracking.秦璐危险时间累计 = currentCharacter === '秦璐' ? tracking.危险时间累计 || 0 : 0;
  }
  if (tracking.苏梦危险时间累计 === undefined) {
    tracking.苏梦危险时间累计 = currentCharacter === '苏梦' ? tracking.危险时间累计 || 0 : 0;
  }

  // 只对当前激活角色进行危险判定（因为只有当前角色在主角房间才会有互动）
  const isInDanger =
    currentLocation === '主角房间' &&
    shouldIncreaseSuspicion(data.苏文状态, currentLocation, suwenLocation, currentCharacter);

  // 获取当前角色的危险时间累计字段
  const dangerTimeField = currentCharacter === '秦璐' ? '秦璐危险时间累计' : '苏梦危险时间累计';
  const currentDangerTime = tracking[dangerTimeField] || 0;

  console.info(`[疑心值追踪] ${currentCharacter}: isInDanger=${isInDanger}, 危险时间累计=${currentDangerTime}`);

  if (isInDanger) {
    // 在危险状态，累积时间 +1
    tracking[dangerTimeField] = currentDangerTime + 1;
    console.info(`[疑心值追踪] ${currentCharacter} 累积 +1 小时，当前累计=${tracking[dangerTimeField]}小时`);

    // 累积 2-3 小时：疑心值 +5
    if (tracking[dangerTimeField] >= 2 && tracking[dangerTimeField] < 4) {
      const suspicionField = currentCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
      data.苏文状态[suspicionField] += 5;
      console.info(`[疑心值追踪] ${currentCharacter} 累积达到 ${tracking[dangerTimeField]} 小时，疑心值 +5`);
    }

    // 累积 4+ 小时：疑心值 +10，触发打断事件
    if (tracking[dangerTimeField] >= 4) {
      const suspicionField = currentCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
      data.苏文状态[suspicionField] += 10;
      tracking.苏文打断事件 = {
        待触发: true,
        已通知AI: false,
        打断原因: `${currentCharacter}在主角房间停留超过4小时`,
        累计时间: tracking[dangerTimeField],
        等待借口: false,
        借口结果: '待定',
      };
      console.info(
        `[疑心值追踪] ${currentCharacter} 累积达到 ${tracking[dangerTimeField]} 小时，疑心值 +10，触发打断事件`,
      );

      // 【关键】写入强制事件日志（支持ROLL后重新触发）
      const currentFloor = getLastMessageId();
      tracking.强制事件日志 = tracking.强制事件日志 || [];
      tracking.强制事件日志.push({
        事件类型: '苏文打断',
        角色: currentCharacter,
        触发楼层: currentFloor,
        触发时间: `${newDate} ${newTime}`,
        已通知AI: false,
        累计时间: tracking[dangerTimeField],
        打断原因: `${currentCharacter}在主角房间停留超过4小时`,
      });
      console.info(`[疑心值追踪] 已写入苏文打断日志: ${currentCharacter}, 楼层${currentFloor}`);

      tracking[dangerTimeField] = 0;
    }
  } else {
    // 不在危险状态（窗口关闭或角色离开主角房间）
    if (currentDangerTime > 0) {
      // 判断是否是窗口关闭（苏文睡觉/上班）
      const isWindowClosed =
        data.苏文状态.当前状态 === '睡眠' ||
        data.苏文状态.当前状态 === '上班' ||
        data.苏文状态.当前状态 === '出差' ||
        suwenLocation === '外面';

      if (isWindowClosed) {
        // 窗口关闭：如果累积 < 2 小时，则作废
        if (currentDangerTime < 2) {
          console.warn(
            `[疑心值追踪] ${currentCharacter} 窗口关闭（苏文状态="${data.苏文状态.当前状态}"），累积不足2小时（${currentDangerTime}h），累积作废`,
          );
          tracking[dangerTimeField] = 0;
        } else {
          // 累积已经触发过疑心值增长，保留结果并清零累积
          console.info(
            `[疑心值追踪] ${currentCharacter} 窗口关闭（苏文状态="${data.苏文状态.当前状态}"），累积已达标（${currentDangerTime}h），保留结果并清零`,
          );
          tracking[dangerTimeField] = 0;
        }
      } else {
        // 角色离开主角房间但窗口仍开启：累积暂停，不清零
        console.info(
          `[疑心值追踪] ${currentCharacter} 角色离开主角房间（当前位置="${currentLocation}"），累积暂停但保留（${currentDangerTime}h）`,
        );
      }
    }

    // 注意：不再在这里清除打断事件标记
    // 打断事件应该由 AI 响应后通过其他机制清除，而不是因为不在危险状态就自动清除
    // 否则会导致：触发打断 → 危险时间清零 → 下一轮判定不在危险状态 → 打断被错误清除
  }

  // ===== 疑心值衰减 =====
  const lastDecayDate = tracking.上次衰减日期 || newDate;
  if (lastDecayDate !== newDate) {
    const [lastYear, lastMonth, lastDay] = lastDecayDate.split('/').map(Number);
    const [curYear, curMonth, curDay] = newDate.split('/').map(Number);
    const lastDateObj = new Date(lastYear, lastMonth - 1, lastDay);
    const currentDateObj = new Date(curYear, curMonth - 1, curDay);
    const daysPassed = Math.floor((currentDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPassed > 0) {
      const totalDecay = daysPassed * 2;
      (['对秦璐疑心值', '对苏梦疑心值'] as const).forEach(suspicionField => {
        const oldValue = data.苏文状态[suspicionField];
        data.苏文状态[suspicionField] = Math.max(0, oldValue - totalDecay);
      });
      tracking.上次衰减日期 = newDate;
    }
  }

  // 同处一室降低疑心值
  if (!isInDanger && isSameSpace(currentLocation, suwenLocation) && data.苏文状态.当前状态 === '在家') {
    const suspicionField = currentCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
    const freezeField = currentCharacter === '秦璐' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';
    if (!data.苏文状态[freezeField].是否冻结 && data.苏文状态[suspicionField] > 0) {
      data.苏文状态[suspicionField] = Math.max(0, data.苏文状态[suspicionField] - 1);
    }
  }

  // ===== 念头开发进度 =====
  (['秦璐状态', '苏梦状态'] as const).forEach(characterKey => {
    const character = data[characterKey];
    if (!character) return;
    character.念头培育区.forEach(thought => {
      // 【关键】时间跳跃时，念头当做完成1小时的进展，避免因过期时间被跳过而全部消失
      // 同时延长过期时间，使其相对于新时间仍有剩余时间
      if (isTimeJump) {
        const oldProgress = thought.开发进度;
        thought.开发进度 += 1; // 时间跳跃给予1小时进展

        // 延长过期时间：过期时间 = 新时间 + 12小时
        // 这确保时间跳跃后念头不会立即过期
        const newDateObj = parseTime(newTime, newDate);
        newDateObj.setHours(newDateObj.getHours() + 12); // 给予至少12小时的剩余时间
        const extendedYear = newDateObj.getFullYear();
        const extendedMonth = String(newDateObj.getMonth() + 1).padStart(2, '0');
        const extendedDay = String(newDateObj.getDate()).padStart(2, '0');
        const extendedHour = String(newDateObj.getHours()).padStart(2, '0');
        const extendedMinute = String(newDateObj.getMinutes()).padStart(2, '0');
        thought.过期时间 = `${extendedYear}/${extendedMonth}/${extendedDay} ${extendedHour}:${extendedMinute}`;

        console.info(
          `[念头开发] 时间跳跃处理 ${characterKey}: "${thought.念头内容}" ` +
            `进度 ${oldProgress} → ${thought.开发进度}, 过期时间延长至 ${thought.过期时间}`,
        );
      } else {
        // 正常时间推进：根据相关性增加进度
        const relevance = checkThoughtRelevance(thought.念头内容, userText, aiText);
        const progressGain = [0, 0.5, 1, 1.5][relevance];
        if (progressGain > 0) thought.开发进度 += progressGain;
      }
    });
  });

  // ===== 巡逻检测 =====
  const patrolEvent = tracking.苏文巡逻事件;
  const freezeField = currentCharacter === '秦璐' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';
  if (
    isInDanger &&
    !patrolEvent.待触发 &&
    !data.苏文状态[freezeField].是否冻结 &&
    isPatrolCooldownOver(patrolEvent.上次巡逻时间, newDate, newTime)
  ) {
    const suspicionField = currentCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
    const patrolProbability = calculatePatrolProbability(parseInt(newHours), data.苏文状态[suspicionField]);
    const roll = Math.random();
    if (roll < patrolProbability) {
      // 计算离开期限（1-2小时）
      const deadlineHours = 1 + Math.floor(Math.random() * 2); // 1 或 2 小时
      const deadlineTime = parseTime(newTime, newDate);
      deadlineTime.setHours(deadlineTime.getHours() + deadlineHours);
      const deadlineHH = String(deadlineTime.getHours()).padStart(2, '0');
      const deadlineMM = String(deadlineTime.getMinutes()).padStart(2, '0');

      tracking.苏文巡逻事件 = {
        待触发: true,
        已通知AI: false,
        触发时间: `${newDate} ${newTime}`,
        巡逻位置: '主角房间门口',
        上次巡逻时间: `${newDate} ${newTime}`,
        离开期限: `${deadlineHH}:${deadlineMM}`,
        期限小时数: deadlineHours,
      };

      // 【关键】写入强制事件日志（支持ROLL后重新触发）
      const currentFloor = getLastMessageId();
      tracking.强制事件日志 = tracking.强制事件日志 || [];
      tracking.强制事件日志.push({
        事件类型: '苏文巡逻',
        角色: currentCharacter,
        触发楼层: currentFloor,
        触发时间: `${newDate} ${newTime}`,
        已通知AI: false,
      });
      console.info(`[疑心值追踪] 已写入苏文巡逻日志: ${currentCharacter}, 楼层${currentFloor}`);

      // 使用角色独立的危险时间累计
      tracking[dangerTimeField] = 0;
    }
  }

  // 处理巡逻事件离开期限检查（新逻辑：超时未离开则触发打断事件）
  if (patrolEvent.待触发 && patrolEvent.已通知AI && patrolEvent.离开期限) {
    // 【关键】从强制事件日志中获取巡逻事件触发时的角色，而不是使用当前角色
    let patrolCharacter: '秦璐' | '苏梦' = currentCharacter;
    const patrolLog = tracking.强制事件日志?.find((log: any) => log.事件类型 === '苏文巡逻' && log.已通知AI);
    if (patrolLog) {
      patrolCharacter = patrolLog.角色 as '秦璐' | '苏梦';
      console.info(`[巡逻事件] 从日志获取触发角色: ${patrolCharacter}`);
    } else {
      console.warn(`[巡逻事件] 未找到巡逻日志，使用当前角色: ${currentCharacter}`);
    }

    // 检查角色是否已离开主角房间
    const patrolCharacterLocation = tracking.当前角色 === patrolCharacter ? tracking.当前所在位置 : '客厅';
    const hasLeft = patrolCharacterLocation !== '主角房间';

    if (hasLeft) {
      // 角色已离开，清除巡逻事件
      console.info(`[巡逻事件] ${patrolCharacter}已离开主角房间，巡逻事件结束`);
      tracking.苏文巡逻事件.待触发 = false;
      tracking.苏文巡逻事件.已通知AI = false;
      tracking.苏文巡逻事件.离开期限 = '';
      tracking.苏文巡逻事件.期限小时数 = 0;
    } else {
      // 角色未离开，检查是否超时
      const [deadlineHH, deadlineMM] = patrolEvent.离开期限.split(':').map(Number);
      const currentTimeObj = parseTime(newTime, newDate);
      const deadlineTimeObj = parseTime(newTime, newDate);
      deadlineTimeObj.setHours(deadlineHH, deadlineMM, 0, 0);

      // 处理跨日情况：如果期限时间小于触发时间，说明期限在第二天
      const triggerTimeParts = patrolEvent.触发时间.split(' ')[1]?.split(':');
      if (triggerTimeParts) {
        const triggerHH = parseInt(triggerTimeParts[0]);
        if (deadlineHH < triggerHH) {
          deadlineTimeObj.setDate(deadlineTimeObj.getDate() + 1);
        }
      }

      if (currentTimeObj >= deadlineTimeObj) {
        // 超时未离开，触发打断事件
        console.info(`[巡逻事件] ${patrolCharacter}超时未离开（期限${patrolEvent.离开期限}），触发打断事件`);
        const suspicionField = patrolCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
        data.苏文状态[suspicionField] += 10;

        // 设置打断事件
        tracking.苏文打断事件 = {
          待触发: true,
          已通知AI: false,
          打断原因: `${patrolCharacter}无视苏文警告，超时未离开主角房间`,
          累计时间: patrolEvent.期限小时数,
          等待借口: false,
          借口结果: '待定',
        };

        // 写入打断事件日志
        const currentFloor = getLastMessageId();
        tracking.强制事件日志 = tracking.强制事件日志 || [];
        tracking.强制事件日志.push({
          事件类型: '苏文打断',
          角色: patrolCharacter,
          触发楼层: currentFloor,
          触发时间: `${newDate} ${newTime}`,
          已通知AI: false,
          累计时间: patrolEvent.期限小时数,
          打断原因: `${patrolCharacter}无视苏文警告，超时未离开主角房间`,
        });

        // 清除巡逻事件
        tracking.苏文巡逻事件.待触发 = false;
        tracking.苏文巡逻事件.已通知AI = false;
        tracking.苏文巡逻事件.离开期限 = '';
        tracking.苏文巡逻事件.期限小时数 = 0;
      } else {
        console.info(`[巡逻事件] ${patrolCharacter}尚未离开，剩余时间至${patrolEvent.离开期限}`);
      }
    }
  }

  // ===== 打断事件借口结果处理 =====
  // 当 AI 判定借口成功/失败后，脚本自动处理后续逻辑
  const interruptionEvent = tracking.苏文打断事件;
  if (interruptionEvent.待触发 && interruptionEvent.已通知AI && interruptionEvent.借口结果 !== '待定') {
    // 【关键】从强制事件日志中获取打断事件触发时的角色
    let interruptionCharacter: '秦璐' | '苏梦' = currentCharacter;
    const interruptionLog = tracking.强制事件日志?.find((log: any) => log.事件类型 === '苏文打断' && log.已通知AI);
    if (interruptionLog) {
      interruptionCharacter = interruptionLog.角色 as '秦璐' | '苏梦';
      console.info(`[打断事件] 从日志获取触发角色: ${interruptionCharacter}`);
    }

    const suspicionField = interruptionCharacter === '秦璐' ? '对秦璐疑心值' : '对苏梦疑心值';
    const freezeField = interruptionCharacter === '秦璐' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';

    if (interruptionEvent.借口结果 === '成功') {
      // 借口成功：自动设置疑心值冻结
      // 冻结时长默认2小时（角色承诺的离开时间）
      const freezeHours = 2;
      const freezeEndTime = parseTime(newTime, newDate);
      freezeEndTime.setHours(freezeEndTime.getHours() + freezeHours);
      const freezeEndYear = freezeEndTime.getFullYear();
      const freezeEndMonth = String(freezeEndTime.getMonth() + 1).padStart(2, '0');
      const freezeEndDay = String(freezeEndTime.getDate()).padStart(2, '0');
      const freezeEndHour = String(freezeEndTime.getHours()).padStart(2, '0');
      const freezeEndMinute = String(freezeEndTime.getMinutes()).padStart(2, '0');

      data.苏文状态[freezeField] = {
        是否冻结: true,
        借口内容: interruptionEvent.打断原因 || '借口成功',
        冻结开始时间: `${newDate} ${newTime}`,
        冻结结束时间: `${freezeEndYear}/${freezeEndMonth}/${freezeEndDay} ${freezeEndHour}:${freezeEndMinute}`,
      };
      console.info(`[打断事件] 借口成功，疑心值冻结至 ${data.苏文状态[freezeField].冻结结束时间}`);
    } else if (interruptionEvent.借口结果 === '失败') {
      // 借口失败：额外疑心值+10（触发时已+10，总共+20）
      data.苏文状态[suspicionField] += 10;
      console.info(`[打断事件] 借口失败，疑心值额外+10（总共+20），${interruptionCharacter}必须离开主角房间`);
    }

    // 清除打断事件状态
    tracking.苏文打断事件 = {
      待触发: false,
      已通知AI: false,
      打断原因: '',
      累计时间: 0,
      等待借口: false,
      借口结果: '待定',
    };
    console.info(`[打断事件] 借口结果处理完成: ${interruptionEvent.借口结果}`);
  }

  // ===== 疑心值冻结检查 =====
  (['对秦璐疑心值冻结', '对苏梦疑心值冻结'] as const).forEach(freezeFieldName => {
    const characterName = freezeFieldName === '对秦璐疑心值冻结' ? '秦璐' : '苏梦';
    const suspicionField = freezeFieldName === '对秦璐疑心值冻结' ? '对秦璐疑心值' : '对苏梦疑心值';
    if (data.苏文状态[freezeFieldName].是否冻结) {
      const freezeEndTimeStr = data.苏文状态[freezeFieldName].冻结结束时间;
      if (freezeEndTimeStr && freezeEndTimeStr.includes(' ')) {
        const [freezeDatePart, freezeTimePart] = freezeEndTimeStr.split(' ');
        if (freezeDatePart && freezeTimePart) {
          const freezeEndTime = parseTime(freezeTimePart, freezeDatePart);
          const currentTimeObj = parseTime(newTime, newDate);
          if (currentTimeObj >= freezeEndTime) {
            if (tracking.当前角色 === characterName && tracking.当前所在位置 === '主角房间') {
              data.苏文状态[suspicionField] += 8;
            }
            data.苏文状态[freezeFieldName].是否冻结 = false;
            data.苏文状态[freezeFieldName].借口内容 = '';
            data.苏文状态[freezeFieldName].冻结开始时间 = '';
            data.苏文状态[freezeFieldName].冻结结束时间 = '';
          }
        }
      }
    }
  });

  return { oldTime, oldDate, newTime, newDate };
}
