import type { Schema as SchemaType } from '../../schema';

/**
 * 时间推进系统
 *
 * 根据 AI 回复文本自动检测时间变化并推进游戏时间。
 * 时间以小时为单位存储（0.0~23.9），推进逻辑优先级：
 *   1. 跨日词（次日/翌日/隔日/第二天 → +1天重置6时; 数日后 → +3天重置6时）
 *   2. 精确时间词（已是X点/正值X时 → 直接定位）
 *   3. 模糊时间词（清晨/上午/中午… → 映射到固定小时）
 *   4. 兜底：随机推进 15~30 分钟
 *
 * 预处理：扫描前先剥离引号对话内容，只检测叙述文字。
 */

// 模糊时间映射
const VAGUE_TIME_MAP: [string, number][] = [
  ['凌晨', 2.0],
  ['拂晓', 5.5],
  ['清晨', 5.5],
  ['早晨', 7.0],
  ['早上', 7.0],
  ['上午', 9.0],
  ['中午', 12.0],
  ['午时', 12.0],
  ['下午', 14.0],
  ['午后', 14.0],
  ['傍晚', 17.5],
  ['黄昏', 17.5],
  ['夜晚', 20.0],
  ['入夜', 20.0],
  ['深夜', 23.0],
];

// 未来预告词（出现时跳过对应规则）
const FUTURE_HINT_WORDS = ['等到', '若是', '届时', '要等', '明日', '等你', '再过', '若待'];

// 比喻引导词（句中含这些词时，时间词视为修辞而非实际时间）
const SIMILE_WORDS = ['像', '如同', '仿佛', '好似', '犹如', '恰似', '宛如', '好比', '仿若'];

// 精确时间模式：提取小时数（整点）
const EXACT_TIME_PATTERNS = [
  /已是(\d{1,2})点/,
  /正值(\d{1,2})时/,
  /(\d{1,2})时分/,
  /(\d{1,2})点光景/,
  /天色已(\d{1,2})/,
  /(\d{1,2})点钟/,
  /(\d{1,2})时辰/,
];

/**
 * 移除对话引号内容，只保留叙述文字
 */
function stripDialogue(text: string): string {
  return text
    .replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/——[^\n]*/g, '');
}

/**
 * 判断句子是否含有未来预告词
 */
function hasFutureHint(sentence: string): boolean {
  return FUTURE_HINT_WORDS.some(w => sentence.includes(w));
}

/**
 * 判断句子是否含有比喻引导词（时间词出现在比喻中，不代表实际时间变化）
 */
function hasSimileHint(sentence: string): boolean {
  return SIMILE_WORDS.some(w => sentence.includes(w));
}

/**
 * 根据新小时数与当前时间决定是否跨天，返回更新后的天/小时
 *
 * 容差机制：回退 ≤4 小时视为同一天的模糊描述（AI 描写当前时段），保持当前时间不变。
 * 例：当前 21:00，AI 写"夜晚"(20.0)，差 1h → 同一天，不跨日。
 * 例：当前 20:00，AI 写"清晨"(5.5)，差 14.5h → 跨日。
 */
function resolveTimeUpdate(currentDay: number, currentHour: number, newHour: number): { day: number; hour: number } {
  if (newHour >= currentHour) {
    return { day: currentDay, hour: newHour };
  }
  // 回退不超过4小时，视为AI描述当前时段，保持当前时间
  if (currentHour - newHour <= 4) {
    return { day: currentDay, hour: currentHour };
  }
  // 大幅度回退 → 跨日
  return { day: currentDay + 1, hour: newHour };
}

export interface TimeAdvanceResult {
  dayChanged: boolean;
  oldDay: number;
  newDay: number;
  oldHour: number;
  newHour: number;
  reason: string;
}

/**
 * 根据 AI 回复文本推进时间（完全由脚本控制）
 *
 * 时间系统已从 AI SET 改为脚本全权管理。在 VARIABLE_UPDATE_ENDED 中调用，
 * 优先级：跨日关键词 → 精确时间 → 模糊时间 → 兜底+0.5h。
 * AI 的时间 SET 值会被硬保护覆盖，不生效。
 */
export function advanceTimeFromText(data: SchemaType, aiText: string): TimeAdvanceResult {
  const currentDay = data.时间.第几天;
  const currentHour = data.时间.当前小时;

  const stripped = stripDialogue(aiText);

  // ────────────────────────────────────────────
  // 跨日词检测（多天跳跃）
  // ────────────────────────────────────────────
  const crossDayPatterns: [RegExp, number][] = [
    [/数日后|几日后|数天后/, 3],
    [/次日|翌日|隔日|第二天/, 1],
  ];

  for (const [pattern, addDays] of crossDayPatterns) {
    const sentences = stripped.split(/[。！？\n]/);
    for (const s of sentences) {
      if (pattern.test(s) && !hasFutureHint(s) && !hasSimileHint(s)) {
        const newDay = currentDay + addDays;
        data.时间.第几天 = newDay;
        return {
          dayChanged: true,
          oldDay: currentDay,
          newDay,
          oldHour: currentHour,
          newHour: currentHour,
          reason: `跨日词: ${pattern}`,
        };
      }
    }
  }

  // ────────────────────────────────────────────
  // 精确时间词检测（已是X点/正值X时）
  // ────────────────────────────────────────────
  {
    const sentences = stripped.split(/[。！？\n]/);
    for (const s of sentences) {
      if (hasFutureHint(s) || hasSimileHint(s)) continue;
      for (const pattern of EXACT_TIME_PATTERNS) {
        const m = pattern.exec(s);
        if (m) {
          const hour = parseInt(m[1], 10);
          if (hour >= 0 && hour <= 23) {
            const result = resolveTimeUpdate(currentDay, currentHour, hour);
            data.时间.第几天 = result.day;
            data.时间.当前小时 = result.hour;
            return {
              dayChanged: result.day !== currentDay,
              oldDay: currentDay,
              newDay: result.day,
              oldHour: currentHour,
              newHour: result.hour,
              reason: `精确时间词: ${m[0]}`,
            };
          }
        }
      }
    }
  }

  // ────────────────────────────────────────────
  // 模糊时间词检测（清晨/上午/夜晚…）
  // ────────────────────────────────────────────
  {
    const sentences = stripped.split(/[。！？\n]/);
    for (const s of sentences) {
      if (hasFutureHint(s) || hasSimileHint(s)) continue;
      for (const [keyword, hour] of VAGUE_TIME_MAP) {
        if (s.includes(keyword)) {
          const result = resolveTimeUpdate(currentDay, currentHour, hour);
          data.时间.第几天 = result.day;
          data.时间.当前小时 = result.hour;
          return {
            dayChanged: result.day !== currentDay,
            oldDay: currentDay,
            newDay: result.day,
            oldHour: currentHour,
            newHour: result.hour,
            reason: `模糊时间词: ${keyword}`,
          };
        }
      }
    }
  }

  // ────────────────────────────────────────────
  // 兜底：无时间词时固定推进 30 分钟
  // ────────────────────────────────────────────
  {
    let newHour = currentHour + 0.5;
    let newDay = currentDay;
    if (newHour >= 24) {
      newHour -= 24;
      newDay += 1;
    }
    data.时间.第几天 = newDay;
    data.时间.当前小时 = newHour;
    return {
      dayChanged: newDay !== currentDay,
      oldDay: currentDay,
      newDay,
      oldHour: currentHour,
      newHour,
      reason: '兜底推进+0.5h',
    };
  }
}

/**
 * 格式化时间显示（用于前端展示）
 */
export function formatTimeDisplay(data: SchemaType): string {
  const day = data.时间.第几天;
  const hour = data.时间.当前小时;
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const hStr = h.toString().padStart(2, '0');
  const mStr = m.toString().padStart(2, '0');
  return `第${day}天 ${hStr}:${mStr}`;
}

/**
 * 获取当前时段名称
 */
export function getTimeOfDay(hour: number): string {
  if (hour < 5) return '深夜';
  if (hour < 8) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午后';
  if (hour < 17) return '下午';
  if (hour < 20) return '傍晚';
  return '夜晚';
}

/**
 * 跨天时重置当天状态（每天结算）
 */
export function onDayChanged(data: SchemaType): void {
  // 打断冻结现在是楼层制，不再需要跨天重置

  // 千晶幻术：激活/退出由前端按钮控制，不在此处重置

  // 治疗完成度自然衰退
  const heartDecayRate = getMiaoguangDecayRate(data.苗广.心态);
  data.治疗.完成度 = Math.max(0, data.治疗.完成度 - heartDecayRate);

  console.info(`[时间系统] 跨天：第${data.时间.第几天}天，自然衰退 -${heartDecayRate}`);
}

/**
 * 获取苗广心态对应的治疗完成度每日衰退值
 */
function getMiaoguangDecayRate(心态: string): number {
  switch (心态) {
    case '愤怒':
      return 4;
    case '疑惑':
    case '察觉':
      return 2;
    default: // 正常/默许/沉溺
      return 1;
  }
}
