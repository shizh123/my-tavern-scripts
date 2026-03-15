/**
 * 禁忌修道院 - 主脚本
 *
 * 包含以下功能（MVU 框架由独立的 MVU/index.ts 脚本加载）：
 *  1. Zod Schema 注册
 *  2. 核心数值保护（防止 AI 篡改关键字段）
 *  3. 游戏逻辑（时间推进、阶段特征、着装更新、数值清理）
 */

// ── 1. Schema 注册 ─────────────────────────────────────────────────────────
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema, type SchemaType } from '../../schema';
import { getStageCharacteristics, getClothingByStage } from '../../stageConfig';

$(() => {
  registerMvuSchema(Schema);
  console.info('[禁忌修道院] Schema 已注册');
});

// ── 3 & 4. 核心数值保护 + 游戏逻辑 ────────────────────────────────────────
$(async () => {
  await waitGlobalInitialized('Mvu');

  // ════════════════════════════════════════════════════════
  // § 核心数值保护
  // ════════════════════════════════════════════════════════

  /** 完全保护字段：AI 输出的任何修改命令均被拦截 */
  const FULLY_PROTECTED: string[] = [
    '世界状态.当前日期',
    '世界状态.当前时间',
    '特蕾莎状态.当前阶段',
    '特蕾莎状态.阶段特征',
  ];

  /** 条件保护字段：堕落值 < 80 时拦截 */
  const CONDITIONAL_PROTECTED: string[] = ['特蕾莎状态.纹身', '特蕾莎状态.身体改造'];

  function matchesField(path: string, field: string): boolean {
    return path === field || path.endsWith('.' + field) || path.includes('.' + field + '.');
  }

  function isFullyProtected(path: string): boolean {
    return FULLY_PROTECTED.some(f => matchesField(path, f));
  }

  function isConditionalProtected(path: string): boolean {
    return CONDITIONAL_PROTECTED.some(f => matchesField(path, f));
  }

  function getCurrentDepravity(): number {
    try {
      const vars = Mvu.getMvuData({ type: 'message', message_id: getLastMessageId() });
      return Number(_.get(vars, 'stat_data.特蕾莎状态.堕落值', 0)) || 0;
    } catch {
      return 0;
    }
  }

  eventOn(Mvu.events.COMMAND_PARSED, (_variables: any, commands: any[], _message_content: string) => {
    const depravity = getCurrentDepravity();
    let intercepted = 0;

    for (let i = commands.length - 1; i >= 0; i--) {
      const path: string = commands[i].args?.[0] ?? '';
      if (!path) continue;

      if (isFullyProtected(path) || (isConditionalProtected(path) && depravity < 80)) {
        console.warn(`[核心数值保护] 拦截 ${commands[i].type} "${path}"`);
        commands.splice(i, 1);
        intercepted++;
      }
    }

    if (intercepted > 0) {
      console.warn(`[核心数值保护] 共拦截 ${intercepted} 个命令，剩余 ${commands.length} 个`);
    }
  });

  console.info('[核心数值保护] 监听器已注册');

  // ════════════════════════════════════════════════════════
  // § 游戏逻辑辅助函数
  // ════════════════════════════════════════════════════════

  /** 根据好感度和阶段更新特蕾莎的阶段特征 */
  function updateStageTraits(data: SchemaType): void {
    const teresa = data.特蕾莎状态;

    if (teresa.好感度 < 10) {
      teresa.阶段特征 = {
        态度描述: '威严肃穆，完全无视苏斌的存在',
        语气风格: '冰冷机械，拒绝任何交流',
        行为倾向: '视若无睹，避免一切接触',
        内心状态: '毫无波澜，心如止水',
      };
      console.info('[游戏逻辑] 好感度<10，阶段特征设为完全无视');
      return;
    }

    const traits = getStageCharacteristics(teresa.当前阶段);
    if (traits) {
      teresa.阶段特征 = {
        态度描述: traits.态度描述,
        语气风格: traits.语气风格,
        行为倾向: traits.行为倾向,
        内心状态: traits.内心状态,
      };
      console.info(`[游戏逻辑] 阶段特征已更新: 阶段${teresa.当前阶段}`);
    }
  }

  /** 根据阶段和场景类型更新着装 */
  function updateClothing(data: SchemaType): void {
    const teresa = data.特蕾莎状态;
    const world = data.世界状态;
    const scene = world.当前场景 ?? '';
    const isPrivate = ['私', '卧室', '浴室', '密室', '私人', '寝室'].some(kw => scene.includes(kw));
    const sceneType = isPrivate ? '私密' : '公共';

    // 场景类型和日期均未变化时跳过
    if (teresa.着装?.当前场景类型 === sceneType && teresa.着装?.最后更新日期 === world.当前日期) {
      return;
    }

    const clothing = getClothingByStage(teresa.当前阶段, sceneType);
    teresa.着装 = {
      上装: clothing.上装,
      下装: clothing.下装,
      内衣: clothing.内衣,
      袜子: clothing.袜子,
      鞋子: clothing.鞋子,
      饰品: clothing.饰品,
      最后更新日期: world.当前日期,
      当前场景类型: sceneType,
    };
    console.info(`[游戏逻辑] 着装已更新: 阶段${teresa.当前阶段} - ${sceneType}`);
  }

  /** 堕落值 < 80 时清除纹身和身体改造 */
  function cleanupModifications(data: SchemaType): void {
    const teresa = data.特蕾莎状态;
    if (teresa.堕落值 < 80) {
      const hasTattoos = Object.keys(teresa.纹身 ?? {}).length > 0;
      const hasMods = Object.keys(teresa.身体改造 ?? {}).length > 0;
      if (hasTattoos || hasMods) {
        teresa.纹身 = {};
        teresa.身体改造 = {};
        console.info('[游戏逻辑] 堕落值<80，已清空纹身和身体改造');
      }
    }
  }

  /** 清理近期事务，只保留最近N条（节省token） */
  function cleanupRecentAffairs(data: SchemaType, maxItems: number = 8): void {
    const world = data.世界状态;
    const affairs = world.近期事务 ?? {};
    const entries = Object.entries(affairs);

    // 如果事务数量超过限制，只保留最后N条
    if (entries.length > maxItems) {
      const kept = entries.slice(-maxItems);
      world.近期事务 = Object.fromEntries(kept);
      console.info(`[游戏逻辑] 近期事务已清理: ${entries.length} -> ${maxItems} 条`);
    }
  }

  /** 每回合推进时间，根据用户输入关键词决定推进量 */
  function advanceTime(data: SchemaType, userText: string): void {
    const world = data.世界状态;
    const timeMatch = (world.当前时间 ?? '00:00').match(/(\d+):(\d+)/);
    if (!timeMatch) return;

    let hour = parseInt(timeMatch[1], 10);
    let minute = parseInt(timeMatch[2], 10);

    // 跨日跳跃
    if (['第二天', '次日', '翌日'].some(kw => userText.includes(kw))) {
      const dm = (world.当前日期 ?? '2025年3月15日').match(/(\d+)年(\d+)月(\d+)日/);
      if (dm) {
        const d = new Date(+dm[1], +dm[2] - 1, +dm[3] + 1);
        world.当前日期 = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      }
      world.当前时间 = '06:00';
      console.info('[游戏逻辑] 时间跳跃到第二天早上');
      return;
    }

    // 推进量
    let advance = 30;
    if (['几小时后', '数小时后'].some(kw => userText.includes(kw))) advance = 180;
    else if (['一小时后', '1小时后'].some(kw => userText.includes(kw))) advance = 60;
    else if (['半小时后', '30分钟后'].some(kw => userText.includes(kw))) advance = 30;

    minute += advance;
    while (minute >= 60) {
      minute -= 60;
      hour++;
    }

    if (hour >= 24) {
      hour -= 24;
      const dm = (world.当前日期 ?? '2025年3月15日').match(/(\d+)年(\d+)月(\d+)日/);
      if (dm) {
        const d = new Date(+dm[1], +dm[2] - 1, +dm[3] + 1);
        world.当前日期 = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      }
    }

    world.当前时间 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    console.info(`[游戏逻辑] 时间推进到 ${world.当前日期} ${world.当前时间}`);
  }

  // ════════════════════════════════════════════════════════
  // § 主处理流程
  // ════════════════════════════════════════════════════════

  async function processGameLogic(messageId: number, eventType: string): Promise<void> {
    try {
      console.info(`[游戏逻辑] 开始处理 ${eventType}，消息 ID: ${messageId}`);

      const targetId = getLastMessageId();
      const currentVars = Mvu.getMvuData({ type: 'message', message_id: targetId });
      const statData = _.get(currentVars, 'stat_data');

      if (!statData) {
        console.warn('[游戏逻辑] stat_data 不存在，跳过');
        return;
      }

      const data = Schema.parse(statData);

      // 获取用户输入文本（用于时间推进关键词判断）
      let userText = '';
      try {
        const prev = getChatMessages(-2);
        const userMsg = prev[0];
        userText = userMsg?.role === 'user' ? (userMsg.message ?? '') : '';
      } catch {
        // 获取失败时忽略，时间推进使用默认值
      }

      // 顺序执行（Schema.parse 会自动计算堕落值上限和阶段）
      advanceTime(data, userText);
      updateStageTraits(data);
      updateClothing(data);
      cleanupModifications(data);
      cleanupRecentAffairs(data); // 清理近期事务，保留最近8条

      const validated = Schema.parse(data);
      _.set(currentVars, 'stat_data', validated);
      await Mvu.replaceMvuData(currentVars, { type: 'message', message_id: targetId });

      console.info(
        `[游戏逻辑] ✅ ${eventType} 完成 | ` +
          `好感:${validated.特蕾莎状态.好感度} ` +
          `堕落:${validated.特蕾莎状态.堕落值}` +
          `(上限:${Math.floor(validated.特蕾莎状态.好感度 / 10) * 10}) ` +
          `阶段:${validated.特蕾莎状态.当前阶段}`,
      );
    } catch (err) {
      console.error('[游戏逻辑] 执行错误:', err);
    }
  }

  // ════════════════════════════════════════════════════════
  // § 事件监听
  // ════════════════════════════════════════════════════════

  let isFirstAfterInit = false;
  const processedMessages = new Set<string>();

  eventOn(Mvu.events.VARIABLE_INITIALIZED, () => {
    isFirstAfterInit = true;
  });

  async function handleMessage(messageId: number, eventType: string): Promise<void> {
    // 获取当前 swipe 标识
    const swipeId: number = (() => {
      try {
        return (SillyTavern.chat?.[messageId] as any)?.swipe_id ?? 0;
      } catch {
        return 0;
      }
    })();
    const key = `${messageId}:${swipeId}`;

    // 初始化后第一条消息跳过（防止重复处理）
    if (eventType === 'MESSAGE_RECEIVED' && isFirstAfterInit) {
      isFirstAfterInit = false;
      console.info(`[游戏逻辑] 跳过初始化后第一条消息: ${messageId}`);
      return;
    }

    if (eventType === 'MESSAGE_SWIPED') {
      // ROLL 时清除同 messageId 的旧记录
      Array.from(processedMessages)
        .filter(k => k.startsWith(`${messageId}:`))
        .forEach(k => processedMessages.delete(k));
    } else {
      if (processedMessages.has(key)) {
        console.info(`[游戏逻辑] 跳过已处理消息: ${key}`);
        return;
      }
    }

    processedMessages.add(key);

    // 防止 Set 无限增长
    if (processedMessages.size > 100) {
      Array.from(processedMessages)
        .slice(0, processedMessages.size - 100)
        .forEach(k => processedMessages.delete(k));
    }

    await processGameLogic(messageId, eventType);
  }

  eventOn(tavern_events.MESSAGE_RECEIVED, id => {
    setTimeout(() => handleMessage(Number(id), 'MESSAGE_RECEIVED'), 300);
  });

  eventOn(tavern_events.MESSAGE_SWIPED, id => {
    setTimeout(() => handleMessage(Number(id), 'MESSAGE_SWIPED'), 300);
  });

  eventOn(tavern_events.GENERATION_ENDED, () => {
    setTimeout(() => {
      try {
        handleMessage(getLastMessageId(), 'GENERATION_ENDED');
      } catch {
        /* ignore */
      }
    }, 300);
  });

  console.info('[禁忌修道院] 主脚本加载完成');
});
