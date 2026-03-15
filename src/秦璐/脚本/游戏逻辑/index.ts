/**
 * 游戏逻辑主入口
 *
 * 合并了以下脚本的功能，消除数据竞争问题：
 * - 时间推进：时间+1小时、位置追踪、苏文作息、疑心值系统、巡逻检测、念头开发进度
 * - 念头成熟检测：念头成熟/过期处理、数值变化、阶段提升
 * - 苏文印象更新：根据疑心值自动更新印象
 * - 阶段外观自动更新：检查外观约束、强制调整不满足要求的外观
 * - 日志清理：
 *   - 念头植入日志清理：清理已通知的旧日志，避免日志无限累积
 *   - 强制事件日志清理：清理阶段突破/打断/巡逻的旧日志（支持ROLL后重新触发）
 *
 * 所有逻辑在同一个事件处理中顺序执行，只进行一次读写，彻底消除数据竞争。
 */

import { Schema, type SchemaType } from '../../schema';
import { advanceTime, isSleepingPillEffective, isHospitalized } from './timeAdvance';
import { checkMatureThoughts } from './thoughtCheck';
import { updateSuwenImpressions } from './impression';
import { checkAndUpdateAppearance, initStageTracking } from './appearance';
import { cleanupThoughtImplantLogs, cleanupForcedEventLogs } from './logCleanup';
import {
  type ThoughtCategory,
  parseAIResponse,
  checkThoughtAllowed,
  getDifficultyLabel,
  getBaseHours,
} from '../../thoughtCategoryLib';

/**
 * 解析 AI 回复中的念头判定结果
 * 格式: 【念头判定】角色:念头内容=类型
 *
 * @param aiText AI 回复内容
 * @returns 解析结果数组
 */
function parseThoughtJudgments(aiText: string): Array<{
  角色: '秦璐' | '苏梦';
  念头内容: string;
  类型: ThoughtCategory;
}> {
  const results: Array<{
    角色: '秦璐' | '苏梦';
    念头内容: string;
    类型: ThoughtCategory;
  }> = [];

  // 匹配格式: 【念头判定】角色:念头内容=类型
  // 支持多行匹配，类型匹配到行尾
  const regex = /【念头判定】(秦璐|苏梦):(.+?)=([^\n\r]+)/g;
  let match;

  while ((match = regex.exec(aiText)) !== null) {
    const [, role, content, typeStr] = match;
    const parsedType = parseAIResponse(typeStr.trim());

    if (parsedType) {
      results.push({
        角色: role as '秦璐' | '苏梦',
        念头内容: content.trim(),
        类型: parsedType,
      });
      console.info(`[念头判定解析] 解析成功: ${role}:${content.trim()}=${parsedType}`);
    } else {
      console.warn(`[念头判定解析] 类型解析失败: ${typeStr.trim()}`);
    }
  }

  return results;
}

/**
 * 处理 AI 判定结果，更新待判定的念头
 *
 * @param data 角色数据
 * @param aiText AI 回复内容
 */
function processThoughtJudgments(data: SchemaType, aiText: string): void {
  const judgments = parseThoughtJudgments(aiText);

  if (judgments.length === 0) {
    return;
  }

  console.info(`[念头判定] 解析到 ${judgments.length} 条判定结果`);

  // 检查安眠药是否生效（秘籍机制：可临时解锁下一阶段念头）
  const sleepingPillActive = isSleepingPillEffective(data);
  if (sleepingPillActive) {
    console.info('[念头判定] 安眠药生效中，临时解锁下一阶段念头');
  }

  // 【终极隐藏模式】检查住院状态
  const hospitalized = isHospitalized(data);
  if (hospitalized) {
    console.info('[念头判定] 住院模式生效中，所有念头固定为简单难度');
  }

  for (const judgment of judgments) {
    // 根据角色获取对应的状态
    const characterState = judgment.角色 === '秦璐' ? data.秦璐状态 : data.苏梦状态;
    const thoughts = characterState.念头培育区;

    // 查找匹配的待判定念头
    const thoughtIndex = thoughts.findIndex(t => t.待判定 && t.念头内容 === judgment.念头内容);

    if (thoughtIndex === -1) {
      // 尝试模糊匹配（念头内容可能有细微差异）
      const fuzzyIndex = thoughts.findIndex(t => t.待判定 && t.念头内容.includes(judgment.念头内容));

      if (fuzzyIndex === -1) {
        console.warn(`[念头判定] 未找到匹配的待判定念头: ${judgment.角色}:${judgment.念头内容}`);
        continue;
      }

      // 使用模糊匹配的结果
      updatePendingThought(characterState, fuzzyIndex, judgment.类型, sleepingPillActive, hospitalized);
    } else {
      updatePendingThought(characterState, thoughtIndex, judgment.类型, sleepingPillActive, hospitalized);
    }
  }
}

/**
 * 更新单个待判定念头
 * @param characterState 角色状态
 * @param thoughtIndex 念头索引
 * @param category 念头类型
 * @param isSleepingPillActive 安眠药是否生效（可临时解锁下一阶段念头）
 * @param isHospitalizedActive 住院是否生效（终极隐藏模式：全阶段解锁，固定简单难度）
 */
function updatePendingThought(
  characterState: SchemaType['秦璐状态'],
  thoughtIndex: number,
  category: ThoughtCategory,
  isSleepingPillActive: boolean = false,
  isHospitalizedActive: boolean = false,
): void {
  const thought = characterState.念头培育区[thoughtIndex];

  // 【终极隐藏模式】住院期间，所有念头固定为简单难度，2小时开发时间
  if (isHospitalizedActive) {
    thought.需要时间 = 2;
    thought.难度等级 = '简单';
    thought.待判定 = false;

    console.info(`[念头判定] 🏥 住院模式: "${thought.念头内容}" => 固定简单难度, 2小时`);
    return;
  }

  const stage = characterState.当前阶段;
  const dependency = characterState.对主角依存度;
  const moral = characterState.道德底线;

  // 使用 thoughtCategoryLib 的函数检查是否允许（传入安眠药状态）
  const result = checkThoughtAllowed(category, stage, dependency, moral, isSleepingPillActive);

  if (result.allowed) {
    // 允许：更新开发时间和难度
    thought.需要时间 = result.hours;
    thought.难度等级 = getDifficultyLabel(result.hours);
    thought.待判定 = false;

    console.info(
      `[念头判定] ✅ 念头已更新: "${thought.念头内容}" => 类型=${category}, 难度=${thought.难度等级}, 时间=${thought.需要时间}h`,
    );
  } else {
    // 不允许：设置为会过期的状态（26小时，超过24小时会过期）
    thought.需要时间 = 26;
    thought.难度等级 = '困难';
    thought.待判定 = false;

    console.info(`[念头判定] ⚠️ 念头被拒绝: "${thought.念头内容}" => ${result.reason}，设置为过期`);
  }
}

/**
 * 处理长时间未被AI判定的念头
 * 如果念头处于待判定状态超过一定时间，自动设为最安全的"陪伴交流"类型
 * 这样可以确保念头不会永远卡在待判定状态
 *
 * @param data 角色数据
 */
function handlePendingThoughtTimeout(data: SchemaType): void {
  const currentTime = `${data.世界.日期} ${data.世界.时间}`;

  // 【终极隐藏模式】检查住院状态
  const hospitalized = isHospitalized(data);

  (['秦璐状态', '苏梦状态'] as const).forEach(characterKey => {
    const characterState = data[characterKey];
    if (!characterState) return;

    const characterName = characterKey === '秦璐状态' ? '秦璐' : '苏梦';

    characterState.念头培育区.forEach((thought, index) => {
      if (!thought.待判定) return;

      // 检查是否已经超过一定时间（2小时游戏内时间）
      // 判断条件：植入时间 + 2小时 < 当前时间
      try {
        const [datePart, timePart] = thought.植入时间.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        const implantTime = new Date(year, month - 1, day, hour, minute);

        const [curDatePart, curTimePart] = currentTime.split(' ');
        const [curYear, curMonth, curDay] = curDatePart.split('/').map(Number);
        const [curHour, curMinute] = curTimePart.split(':').map(Number);
        const curTime = new Date(curYear, curMonth - 1, curDay, curHour, curMinute);

        // 如果超过2小时（7200000毫秒）还没被判定，自动设为默认类型
        const timeDiff = curTime.getTime() - implantTime.getTime();
        if (timeDiff >= 2 * 60 * 60 * 1000) {
          // 【终极隐藏模式】住院期间，固定简单难度和2小时开发时间
          if (hospitalized) {
            thought.需要时间 = 2;
            thought.难度等级 = '简单';
            thought.待判定 = false;

            console.info(
              `[念头判定超时] 🏥 住院模式: ${characterName} 念头"${thought.念头内容}"` +
                `超时未判定，固定为简单难度，2小时`,
            );
          } else {
            // 默认设为"陪伴交流"类型（最安全的类型）
            const defaultCategory: ThoughtCategory = '陪伴交流';
            const stage = characterState.当前阶段;
            const hours = getBaseHours(stage);

            thought.需要时间 = hours;
            thought.难度等级 = getDifficultyLabel(hours);
            thought.待判定 = false;

            console.info(
              `[念头判定超时] ${characterName} 念头"${thought.念头内容}"超时未被AI判定，` +
                `自动设为"${defaultCategory}"类型，难度=${thought.难度等级}，时间=${hours}h`,
            );
          }
        }
      } catch (err) {
        console.warn(`[念头判定超时] 解析时间失败:`, err);
      }
    });
  });
}

$(async () => {
  await waitGlobalInitialized('Mvu');

  let isFirstMessageAfterInit = false;
  // 防重复执行：使用 "message_id:swipe_id" 作为唯一标识
  // 这样 ROLL 后自动视为新消息（swipe_id 不同），无需额外检测
  const processedEvents = new Set<string>();

  // 获取消息的 swipe_id
  function getSwipeId(messageId: number): number {
    try {
      const chat = SillyTavern.chat;
      if (chat && chat[messageId]) {
        return chat[messageId].swipe_id ?? 0;
      }
    } catch (err) {
      console.warn(`[游戏逻辑] 获取 swipe_id 失败:`, err);
    }
    return 0;
  }

  // 监听变量初始化事件
  eventOn(Mvu.events.VARIABLE_INITIALIZED, () => {
    isFirstMessageAfterInit = true;
  });

  // 核心处理函数
  async function processGameLogic(message_id: number, eventType: string) {
    try {
      const swipeId = getSwipeId(message_id);
      const messageKey = `${message_id}:${swipeId}`;
      console.info(
        `[游戏逻辑] processGameLogic 进入: message_id=${message_id}, swipe_id=${swipeId}, eventType=${eventType}`,
      );

      // 检查是否跳过时间推进（仅对 MESSAGE_RECEIVED 生效）
      if (eventType === 'MESSAGE_RECEIVED' && isFirstMessageAfterInit) {
        isFirstMessageAfterInit = false;
        console.info(`[游戏逻辑] 跳过初始化后的第一条消息: ${message_id}`);
        return;
      }

      // 去重逻辑：
      // - MESSAGE_SWIPED 事件表示用户主动点击 ROLL，应该总是执行（清除旧记录后执行）
      // - 其他事件使用 message_id:swipe_id 去重
      if (eventType === 'MESSAGE_SWIPED') {
        // ROLL 操作：清除该 message_id 的所有旧记录，确保能重新处理
        const keysToRemove = Array.from(processedEvents).filter(key => key.startsWith(`${message_id}:`));
        keysToRemove.forEach(key => processedEvents.delete(key));
        console.info(`[游戏逻辑] ROLL 操作，清除 ${keysToRemove.length} 条旧记录: ${keysToRemove.join(', ')}`);
      } else {
        // 非 ROLL 事件：正常去重
        if (processedEvents.has(messageKey)) {
          console.info(`[游戏逻辑] 跳过已处理的消息: ${messageKey} (事件类型: ${eventType})`);
          return;
        }
      }

      processedEvents.add(messageKey);
      console.info(`[游戏逻辑] 消息 ${messageKey} 开始处理`);

      // 清理旧的记录，避免内存泄漏（只保留最近 100 条）
      if (processedEvents.size > 100) {
        const oldestKeys = Array.from(processedEvents).slice(0, processedEvents.size - 100);
        oldestKeys.forEach(key => processedEvents.delete(key));
      }

      const actualLastId = getLastMessageId();
      console.info(`[游戏逻辑] 开始处理 ${eventType} 事件，消息 ID: ${message_id}，实际最新楼层: ${actualLastId}`);

      // 【关键】确保处理的是最新楼层
      const targetMessageId = actualLastId;
      if (targetMessageId !== message_id) {
        console.warn(`[游戏逻辑] ⚠️ 传入ID(${message_id})与最新楼层(${targetMessageId})不一致，使用最新楼层`);
      }

      // 读取变量
      const currentVars = Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
      const statData = _.get(currentVars, 'stat_data');

      if (!statData) {
        console.warn('[游戏逻辑] stat_data 不存在');
        return;
      }

      const data = Schema.parse(statData);

      // 【关键】在任何逻辑执行前，先初始化阶段追踪
      // 这样 checkMatureThoughts 改变阶段后，checkAndUpdateAppearance 才能正确检测到变化
      initStageTracking(data.秦璐状态.当前阶段, data.苏梦状态.当前阶段);
      console.info(`[游戏逻辑] 阶段追踪已初始化: 秦璐=${data.秦璐状态.当前阶段}, 苏梦=${data.苏梦状态.当前阶段}`);

      // 获取对话消息
      let userText = '';
      let aiText = '';
      try {
        const lastMessages = getChatMessages(-1);
        const prevMessages = getChatMessages(-2);
        const lastMessage = lastMessages.length > 0 ? lastMessages[0] : null;
        const userMessage = prevMessages.length > 0 ? prevMessages[0] : null;
        userText = userMessage && userMessage.role === 'user' ? (userMessage.message ?? '') : '';
        aiText = lastMessage && lastMessage.role === 'assistant' ? (lastMessage.message ?? '') : '';
      } catch (msgErr) {
        console.warn('[游戏逻辑] 获取消息失败:', msgErr);
      }

      // 执行所有逻辑
      const timeResult = advanceTime(data, userText, aiText);
      if (!timeResult) {
        console.error('[游戏逻辑] 时间推进失败');
        return;
      }

      // 处理 AI 对待判定念头的判定结果（在其他逻辑之前，确保念头状态正确）
      if (aiText) {
        processThoughtJudgments(data, aiText);
      }

      // 处理超时未被AI判定的念头（2小时游戏时间后自动设为默认类型）
      handlePendingThoughtTimeout(data);

      checkMatureThoughts(data);
      updateSuwenImpressions(data);
      checkAndUpdateAppearance(data);
      cleanupThoughtImplantLogs(data, targetMessageId);
      cleanupForcedEventLogs(data, targetMessageId);

      // 验证并写入
      const validatedData = Schema.parse(data);
      _.set(currentVars, 'stat_data', validatedData);
      await Mvu.replaceMvuData(currentVars, { type: 'message', message_id: targetMessageId });

      console.info(
        `[游戏逻辑] 数据已写入楼层 ${targetMessageId}，时间: ${validatedData.世界?.日期} ${validatedData.世界?.时间}`,
      );

      // 验证写入结果
      const verifyVars = Mvu.getMvuData({ type: 'message', message_id: targetMessageId });
      const verifyData = _.get(verifyVars, 'stat_data');

      if (verifyData?.世界?.时间 !== timeResult.newTime || verifyData?.世界?.日期 !== timeResult.newDate) {
        console.error('[游戏逻辑] 时间写入不一致');
        console.error(`期望: ${timeResult.newDate} ${timeResult.newTime}`);
        console.error(`实际: ${verifyData?.世界?.日期} ${verifyData?.世界?.时间}`);
      } else {
        console.info(`[游戏逻辑] ✅ ${eventType} 处理完成，时间: ${timeResult.newDate} ${timeResult.newTime}`);
      }
    } catch (err) {
      console.error('[游戏逻辑] 执行错误:', err);
    }
  }

  // 监听新消息接收事件
  eventOn(tavern_events.MESSAGE_RECEIVED, message_id => {
    const id = Number(message_id);
    console.info(`[游戏逻辑] 收到 MESSAGE_RECEIVED 事件，message_id=${id}`);
    setTimeout(() => {
      processGameLogic(id, 'MESSAGE_RECEIVED');
    }, 300);
  });

  // 监听消息ROLL（重新生成）事件
  eventOn(tavern_events.MESSAGE_SWIPED, message_id => {
    const id = Number(message_id);
    console.info(`[游戏逻辑] 收到 MESSAGE_SWIPED 事件，message_id=${id}`);
    setTimeout(() => {
      processGameLogic(id, 'MESSAGE_SWIPED');
    }, 300);
    // 广播刷新事件，通知所有前端界面刷新数据
    setTimeout(() => {
      console.info('[游戏逻辑] 广播 IFRAME_DATA_REFRESH 事件 (MESSAGE_SWIPED)');
      eventEmit('IFRAME_DATA_REFRESH', { reason: 'MESSAGE_SWIPED', message_id: id });
    }, 500);
  });

  // 监听消息删除事件
  eventOn(tavern_events.MESSAGE_DELETED, message_id => {
    const id = Number(message_id);
    console.info(`[游戏逻辑] 收到 MESSAGE_DELETED 事件，message_id=${id}`);

    // 【关键】清除被删除楼层及之后所有楼层的处理记录
    // 这样删除后重新生成的楼层能够正确执行游戏逻辑
    const keysToRemove = Array.from(processedEvents).filter(key => {
      const keyMessageId = parseInt(key.split(':')[0], 10);
      return keyMessageId >= id;
    });
    if (keysToRemove.length > 0) {
      keysToRemove.forEach(key => processedEvents.delete(key));
      console.info(`[游戏逻辑] MESSAGE_DELETED 清除 ${keysToRemove.length} 条处理记录: ${keysToRemove.join(', ')}`);
    }

    // 广播刷新事件，通知所有前端界面刷新数据
    setTimeout(() => {
      console.info('[游戏逻辑] 广播 IFRAME_DATA_REFRESH 事件 (MESSAGE_DELETED)');
      eventEmit('IFRAME_DATA_REFRESH', { reason: 'MESSAGE_DELETED', message_id: id });
    }, 300);
  });

  // 监听生成结束事件（作为备选，确保 ROLL 后也能处理）
  eventOn(tavern_events.GENERATION_ENDED, message_id => {
    console.info(`[游戏逻辑] 收到 GENERATION_ENDED 事件，原始 message_id=${message_id}`);
    // GENERATION_ENDED 事件的 message_id 可能在消息实际创建前就触发，导致 ID 无效
    // 因此使用 getLastMessageId() 获取最新消息的实际 ID
    setTimeout(() => {
      try {
        const actualMessageId = getLastMessageId();
        console.info(`[游戏逻辑] GENERATION_ENDED 使用实际 message_id=${actualMessageId}`);
        // 使用 message_id:swipe_id 去重，ROLL 后 swipe_id 变化会自动视为新消息
        processGameLogic(actualMessageId, 'GENERATION_ENDED');
      } catch (err) {
        console.warn(`[游戏逻辑] GENERATION_ENDED 获取最新消息失败，尝试使用原始 ID:`, err);
        processGameLogic(Number(message_id), 'GENERATION_ENDED');
      }
    }, 300);
    // 广播刷新事件，确保新创建的 iframe 能刷新数据
    // 这对于删除后重新生成的情况特别重要，因为 MESSAGE_DELETED 时 iframe 还不存在
    setTimeout(() => {
      try {
        const actualMessageId = getLastMessageId();
        console.info('[游戏逻辑] 广播 IFRAME_DATA_REFRESH 事件 (GENERATION_ENDED)');
        eventEmit('IFRAME_DATA_REFRESH', { reason: 'GENERATION_ENDED', message_id: actualMessageId });
      } catch (err) {
        console.warn('[游戏逻辑] GENERATION_ENDED 广播刷新事件失败:', err);
      }
    }, 800);
  });

  console.info('[游戏逻辑脚本] 加载完成，已注册 MESSAGE_RECEIVED, MESSAGE_SWIPED 和 GENERATION_ENDED 监听');
});
