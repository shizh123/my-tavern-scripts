// 习惯注入脚本：在每次AI生成时注入习惯列表、念头植入通知和状态一致性检查，提醒AI遵守当前变量状态
//
// 职责：
// 1. 注入习惯列表（已形成的习惯影响AI描写角色行为）
// 2. 注入念头植入通知（玩家植入的念头通知AI，只是话题倾向）
// 3. 注入状态一致性检查（时间、位置等）
// 4. 注入外观提醒（当前角色服装妆容，苏文在家时警告暴露/标记）
// 5. 注入强制事件提示（打断/巡逻）
// 6. 注入阶段突破剧情（5阶段系统隐藏剧情）

import { generateStageBreakthroughInjection, generateStageBreakthroughPrefill, getStageTitle } from '../../stageConfig';
import { LOCAL_KEYWORDS, STAGE_REQUIREMENTS, type ThoughtCategory } from '../../thoughtCategoryLib';

$(async () => {
  await waitGlobalInitialized('Mvu');

  console.info('[习惯注入脚本] 开始加载');

  // 用于跟踪当前生成请求是否启用了 extended thinking 模式
  // 通过 CHAT_COMPLETION_SETTINGS_READY 事件获取，比检查 chat 数组更可靠
  let currentRequestHasExtendedThinking = false;

  // 监听设置就绪事件，获取 include_reasoning 状态
  eventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, (generate_data: any) => {
    currentRequestHasExtendedThinking = generate_data.include_reasoning === true;
    console.info(`[习惯注入] Extended thinking 模式: ${currentRequestHasExtendedThinking}`);
  });

  // 习惯上限配置
  const HABIT_LIMIT = 16;

  /**
   * 根据习惯数量获取影响程度描述
   * 16个习惯上限：1-4轻微，5-8明显，9-12深度，13-16完全内化
   */
  function getInfluenceDescription(count: number): {
    level: string;
    description: string;
    example: string;
  } {
    if (count >= 13) {
      return {
        level: '完全内化',
        description: '这些行为已彻底融入人格，如同呼吸般自然，不做反而会觉得缺少什么',
        example:
          '她自然地跪在他面前，像是每天早上都会做的事。这已经成为她的日常，不需要任何理由或铺垫，她的身体自己就知道该怎么做。如果一天没有这样，她反而会觉得浑身不对劲。',
      };
    }
    if (count >= 9) {
      return {
        level: '深度影响',
        description: '这些行为已非常自然，几乎没有心理障碍，会主动创造相关场景',
        example:
          '看到他坐在沙发上，她不自觉地走过去，自然而然地坐到他腿上。没有犹豫，没有羞涩，这个动作就像给家人倒杯水一样平常。她甚至会主动找机会制造独处的场景。',
      };
    }
    if (count >= 5) {
      return {
        level: '明显影响',
        description: '这些行为开始变得自然，抗拒减弱，稍加暗示就会配合',
        example:
          '他的手指轻轻抬起她的下巴，她只是微微红了脸，但没有躲开。心里虽然还有一丝不安，但那种感觉已经弱了很多。她甚至有些期待接下来会发生什么。',
      };
    }
    if (count >= 1) {
      return {
        level: '轻微影响',
        description: '这些行为还需要引导才会做，仍有羞涩和犹豫',
        example:
          '她的脸一下子红到了耳根，眼神闪躲，不知道该把手放在哪里。虽然没有立刻拒绝，但身体还是僵硬的，需要他一步步引导才会慢慢放松下来。',
      };
    }
    return { level: '', description: '', example: '' };
  }

  /**
   * 生成信息隔离提醒
   * 秦璐和苏梦之间在剧情中没有透露之前，无法知道对方的秘密和剧情进展
   */
  function generateInformationIsolationReminder(): string | null {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) {
        return null;
      }

      const currentCharacter = data.系统追踪?.当前角色 || '秦璐';
      const otherCharacter = currentCharacter === '秦璐' ? '苏梦' : '秦璐';

      // 获取两个角色的状态用于对比
      const qinluState = data.秦璐状态;
      const sumengState = data.苏梦状态;

      // 获取另一个角色的状态
      const otherState = currentCharacter === '秦璐' ? sumengState : qinluState;
      const otherStage = otherState?.当前阶段 || 1;

      // 检查另一角色是否有秘密（阶段 > 1 或有习惯）
      const otherHasSecrets = otherStage > 1 || (otherState?.习惯列表?.length || 0) > 0;

      if (!otherHasSecrets) {
        // 如果另一个角色没有秘密，不需要信息隔离提醒
        return null;
      }

      const parts: string[] = [
        `【🔒 信息隔离规则】`,
        `当前视角角色：${currentCharacter}`,
        ``,
        `⚠️ 重要：${currentCharacter}与${otherCharacter}之间存在信息隔离：`,
        ``,
        `【${currentCharacter}不知道的信息】`,
        `- ${otherCharacter}与{{user}}之间发生的任何事情`,
        `- ${otherCharacter}对{{user}}产生的任何特殊感情或依赖`,
        `- ${otherCharacter}形成的任何习惯或行为变化的真实原因`,
        `- ${otherCharacter}的内心想法、心理变化、阶段进展`,
      ];

      // 根据另一个角色的阶段添加具体的秘密内容
      if (otherStage >= 2) {
        parts.push(`- ${otherCharacter}已经开始对{{user}}产生动摇（阶段${otherStage}）`);
      }
      if (otherState?.习惯列表?.length > 0) {
        parts.push(`- ${otherCharacter}形成的 ${otherState.习惯列表.length} 个潜意识习惯`);
      }

      parts.push(
        ``,
        `【演绎要求】`,
        `- 如果${currentCharacter}与${otherCharacter}同时出现，${currentCharacter}对${otherCharacter}的异常行为只能表现出困惑，不能直接知道原因`,
        `- ${currentCharacter}不会主动询问${otherCharacter}与{{user}}的关系，除非看到明显的异常`,
        `- 两人之间保持正常的家庭关系互动（婆媳/母女关系）`,
        `- 只有当某角色主动向另一角色透露时，信息隔离才会打破`,
      );

      return parts.join('\n');
    } catch (err) {
      console.error('[信息隔离] 生成提醒时出错:', err);
      return null;
    }
  }

  /**
   * 生成状态一致性检查提醒
   */
  function generateStateConsistencyReminder(): string | null {
    try {
      // 获取最新楼层的变量
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) {
        console.warn('[状态一致性] stat_data 不存在');
        return null;
      }

      const currentDate = data.世界?.日期 || '未知';
      const currentTime = data.世界?.时间 || '未知';
      const suwenLocation = data.苏文状态?.当前位置 || '未知';
      const suwenState = data.苏文状态?.当前状态 || '未知';

      // 解析时间段
      let timeDescription = '';
      if (currentTime !== '未知') {
        const [hour] = currentTime.split(':').map(Number);
        if (hour >= 6 && hour < 8) {
          timeDescription = '清晨时分';
        } else if (hour >= 12 && hour < 14) {
          timeDescription = '正午时分';
        } else if (hour >= 18 && hour < 20) {
          timeDescription = '傍晚时分';
        } else if (hour >= 22 || hour < 6) {
          timeDescription = '深夜时分';
        }
      }

      const parts: string[] = [
        `【当前状态参考】`,
        `- 日期：${currentDate}`,
        `- 时间：${currentTime}${timeDescription ? ` (${timeDescription})` : ''}`,
        `- 苏文位置：${suwenLocation}`,
        `- 苏文状态：${suwenState}`,
      ];

      // 根据苏文状态添加约束提醒（这些是硬性约束）
      if (suwenState === '睡眠') {
        parts.push(`\n⚠️ 苏文正在睡眠，禁止描写：`, `  - 苏文的脚步声、说话、任何活动`, `  - 苏文在主卧以外的位置`);
      } else if (suwenState === '上班' || suwenState === '出差') {
        parts.push(`\n⚠️ 苏文不在家（${suwenState}），禁止描写苏文在家中`);
      }

      // 时间描述约束（改为建议而非强制）
      if (timeDescription) {
        parts.push(`\n💡 如需描绘环境，当前是${timeDescription}`);
      }

      return parts.join('\n');
    } catch (err) {
      console.error('[状态一致性] 生成提醒时出错:', err);
      return null;
    }
  }

  /**
   * 生成外观提醒（当前视角角色的服装和妆容）
   * 模仿苏文状态提醒的逻辑：基础信息 + 特殊情况警告
   */
  function generateAppearanceReminder(): string | null {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) {
        return null;
      }

      const currentCharacter = data.系统追踪?.当前角色 || '秦璐';
      const characterState = currentCharacter === '秦璐' ? data.秦璐状态 : data.苏梦状态;

      if (!characterState) {
        return null;
      }

      const clothing = characterState.服装细节;
      const makeup = characterState.妆容细节;
      const bodyMod = characterState.身体改造;

      // 基础外观信息（简洁版）
      const parts: string[] = [
        `【当前外观 - ${currentCharacter}】`,
        `服装：${clothing.上装} + ${clothing.下装}（${clothing.整体风格}，暴露：${clothing.暴露程度}）`,
        `妆容：${makeup.浓淡程度}（${makeup.整体风格}）`,
        `气质：${characterState.气质描述}`,
      ];

      // 检查是否有特殊装饰
      if (clothing.特殊装饰 && clothing.特殊装饰 !== '无') {
        parts.push(`特殊装饰：${clothing.特殊装饰}`);
      }

      // 检查是否有临时标记
      const tempMarks = bodyMod?.临时标记 || [];
      if (tempMarks.length > 0) {
        parts.push(`临时标记：${tempMarks.join('、')}`);
      }

      // 检查苏文状态，决定是否需要警告
      const suwenState = data.苏文状态?.当前状态 || '未知';
      const suwenAtHome = suwenState === '在家';
      const suwenAwake = suwenState !== '睡眠' && suwenState !== '上班' && suwenState !== '出差';

      // 只在苏文在家且清醒时检查是否需要警告
      if (suwenAtHome && suwenAwake) {
        const warnings: string[] = [];

        // 暴露程度警告
        const exposureLevel = clothing.暴露程度;
        if (exposureLevel === '暴露' || exposureLevel === '极度暴露') {
          warnings.push(`当前暴露程度「${exposureLevel}」不适合在苏文面前展示`);
        }

        // 临时标记警告
        if (tempMarks.length > 0) {
          warnings.push(`身上有临时标记需要遮挡：${tempMarks.join('、')}`);
        }

        // 特殊装饰警告
        if (clothing.特殊装饰 && clothing.特殊装饰 !== '无') {
          warnings.push(`特殊装饰「${clothing.特殊装饰}」需要隐藏或取下`);
        }

        // 浓妆警告
        if (makeup.浓淡程度 === '浓妆' || makeup.浓淡程度 === '艳妆') {
          warnings.push(`当前妆容「${makeup.浓淡程度}」可能引起苏文注意`);
        }

        if (warnings.length > 0) {
          parts.push(`\n⚠️ 苏文在家且清醒，注意：`);
          warnings.forEach(w => parts.push(`  - ${w}`));
        }
      }

      return parts.join('\n');
    } catch (err) {
      console.error('[外观提醒] 生成提醒时出错:', err);
      return null;
    }
  }

  /**
   * 生成念头植入通知（从念头植入日志中读取）
   * 玩家植入的念头会记录在日志中，这里读取并注入到AI提示词
   *
   * 【设计理念】念头 vs 习惯的区别：
   * - 念头：只是"开了一扇门"，让角色在相关话题出现时不会本能排斥，愿意尝试聊
   * - 习惯：念头成熟后的永久行为模式，真正影响性格和决策，数量越多影响越深
   *
   * 【优化】多个念头合并为一条消息，避免重复的演绎要求
   */
  function generateThoughtImplantNotifications(): string | null {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data?.系统追踪?.念头植入日志) {
        return null;
      }

      const logs = data.系统追踪.念头植入日志;
      if (logs.length === 0) {
        return null;
      }

      // 统计未通知的数量
      const unnotifiedCount = logs.filter((l: any) => !l.已通知AI).length;
      console.info(`[念头植入] 发现 ${logs.length} 条念头植入记录（${unnotifiedCount} 条未通知）`);

      // 按目标角色分组
      const thoughtsByTarget: Record<string, string[]> = {};
      logs.forEach((log: any) => {
        const target = log.目标 as string;
        if (!thoughtsByTarget[target]) {
          thoughtsByTarget[target] = [];
        }
        thoughtsByTarget[target].push(log.内容);
      });

      // 生成合并后的通知消息
      // 【重要】念头只是"话题倾向"，不是"性格改变"
      // 角色只是愿意聊这个话题，不代表已经接受或认同
      const parts: string[] = [];

      // 为每个角色生成念头列表
      for (const [target, thoughts] of Object.entries(thoughtsByTarget)) {
        if (thoughts.length === 1) {
          // 单个念头：简洁格式
          parts.push(`【${target}】对"${thoughts[0]}"产生了一丝好奇或不排斥`);
        } else {
          // 多个念头：列表格式
          const thoughtList = thoughts.map(t => `  · "${t}"`).join('\n');
          parts.push(`【${target}】对以下话题产生了一丝好奇或不排斥：\n${thoughtList}`);
        }
      }

      // 组装最终消息（演绎要求只写一次）
      const message = [
        `OOC: 【念头培育中】`,
        ``,
        ...parts,
        ``,
        `【演绎要求】`,
        `- 这些只是萌芽的想法，不是已形成的观念或习惯`,
        `- 如果{{user}}主动引导相关话题，角色会比平时更愿意聊、不会立刻回避`,
        `- 但她仍然会有正常的羞涩、犹豫或抗拒，只是"门没关死"`,
        `- 态度和反应仍然基于当前的道德底线和依存度数值`,
        `- 【禁止】让角色主动提起这些话题或表现得像已经接受`,
        `- 【禁止】描写为"本来就有的想法"或"理所当然"`,
        `- 【禁止】让念头直接改变角色的性格或行为模式`,
      ].join('\n');

      // 标记所有日志为已通知
      let hasUnnotified = false;
      logs.forEach((log: any) => {
        if (!log.已通知AI) {
          log.已通知AI = true;
          hasUnnotified = true;
        }
      });

      // 如果有未通知的日志，保存更新（使用 MVU API 保持一致性）
      if (hasUnnotified) {
        try {
          const currentVars = Mvu.getMvuData({ type: 'message', message_id: -1 });
          _.set(currentVars, 'stat_data.系统追踪.念头植入日志', logs);
          Mvu.replaceMvuData(currentVars, { type: 'message', message_id: -1 });
          console.info(`[念头植入] 已标记 ${unnotifiedCount} 条日志为已通知（MVU API）`);
        } catch (mvuErr) {
          console.error('[念头植入] 标记日志失败:', mvuErr);
        }
      }

      return message;
    } catch (err) {
      console.error('[念头植入] 生成通知消息失败:', err);
      return null;
    }
  }

  /**
   * 生成待判定念头的类型判定提示
   * 让 AI 在正文末尾输出念头类型判定结果，格式：【念头判定】角色:内容=类型
   * 游戏逻辑脚本会解析这个结果并更新念头状态
   */
  function generatePendingThoughtJudgePrompt(): string | null {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) return null;

      // 收集所有待判定的念头
      const pendingThoughts: Array<{ target: string; content: string }> = [];

      // 检查秦璐的念头
      const qinluThoughts = data.秦璐状态?.念头培育区 || [];
      qinluThoughts.forEach((t: any) => {
        if (t.待判定) {
          pendingThoughts.push({ target: '秦璐', content: t.念头内容 });
        }
      });

      // 检查苏梦的念头
      const sumengThoughts = data.苏梦状态?.念头培育区 || [];
      sumengThoughts.forEach((t: any) => {
        if (t.待判定) {
          pendingThoughts.push({ target: '苏梦', content: t.念头内容 });
        }
      });

      if (pendingThoughts.length === 0) return null;

      console.info(`[念头判定] 发现 ${pendingThoughts.length} 个待判定念头`);

      // 生成判定提示
      const thoughtList = pendingThoughts.map(t => `  - ${t.target}："${t.content}"`).join('\n');

      const prompt = [
        `OOC: 【念头类型判定请求】`,
        ``,
        `以下念头需要判定类型：`,
        thoughtList,
        ``,
        `可选类型（10大类）：`,
        `- 陪伴交流（聊天、陪伴、倾诉、沟通、喂饭、照顾起居）`,
        `- 情感依赖（想念、牵挂、惦记、在意）`,
        `- 肢体亲近（牵手、拥抱、依偎、靠在一起）`,
        `- 暧昧互动（撒娇、亲昵、调情、心跳加速）`,
        `- 亲密接触（亲吻、接吻、抚摸身体）`,
        `- 身体开放（暴露身体、展示身材、袒露）`,
        `- 性行为（做爱、性行为、口交、插入）`,
        `- 身份认同（属于你、你的人、归属感）`,
        `- 绝对服从（服从命令、跪下、主奴关系）`,
        `- 家庭替代（取代配偶、赶走丈夫、离婚）`,
        ``,
        `【重要】请在本轮回复的最后一行，使用以下格式输出判定结果（每个念头一行）：`,
        `【念头判定】角色:念头内容=类型`,
        ``,
        `示例：`,
        `【念头判定】秦璐:想和他聊天=陪伴交流`,
        `【念头判定】苏梦:想被他拥抱=肢体亲近`,
      ].join('\n');

      return prompt;
    } catch (err) {
      console.error('[念头判定] 生成判定提示失败:', err);
      return null;
    }
  }

  /**
   * 生成习惯注入的系统消息
   * 【信息隔离】只注入当前视角角色的习惯详情，另一角色只显示数量不显示内容
   *
   * 【设计理念】习惯 vs 念头的区别：
   * - 念头：只是"开了一扇门"，愿意聊相关话题，不改变性格
   * - 习惯：念头成熟后的永久行为模式，真正影响性格和决策，数量越多影响越深
   */
  function generateHabitsInjection(): string | null {
    try {
      // 获取最新楼层的变量
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) {
        console.warn('[习惯注入] stat_data 不存在');
        return null;
      }

      // 获取当前视角角色
      const currentCharacter = data.系统追踪?.当前角色 || '秦璐';
      const parts: string[] = [];

      // 处理秦璐的习惯
      const qinluHabits = data.秦璐状态?.习惯列表 || [];
      if (qinluHabits.length > 0 && currentCharacter === '秦璐') {
        const { level, description, example } = getInfluenceDescription(qinluHabits.length);
        const habitsText = qinluHabits.map((h: any) => `"${h.内容}"`).join('、');

        parts.push(
          [
            `【秦璐的行为倾向】`,
            `当前影响力：${level}`,
            `具体表现：${description}`,
            `已内化的行为：${habitsText}`,
            ``,
            `【当前影响力的演绎示例】`,
            `${example}`,
            ``,
            `【演绎要求】`,
            `- 在相关场景中，秦璐会自然地表现出这些行为倾向`,
            `- 参考上面的示例，把握当前影响力等级下角色的反应程度`,
            `- 这些是角色已经习惯的行为模式，不需要{{user}}每次都提起`,
            `- 【禁止】在输出中提及"习惯"、"行为倾向"、"影响力"等元游戏术语`,
            `- 【禁止】让角色意识到自己"被改变了"或"有了习惯"`,
          ].join('\n'),
        );
      }

      // 处理苏梦的习惯
      const sumengHabits = data.苏梦状态?.习惯列表 || [];
      if (sumengHabits.length > 0 && currentCharacter === '苏梦') {
        const { level, description, example } = getInfluenceDescription(sumengHabits.length);
        const habitsText = sumengHabits.map((h: any) => `"${h.内容}"`).join('、');

        parts.push(
          [
            `【苏梦的行为倾向】`,
            `当前影响力：${level}`,
            `具体表现：${description}`,
            `已内化的行为：${habitsText}`,
            ``,
            `【当前影响力的演绎示例】`,
            `${example}`,
            ``,
            `【演绎要求】`,
            `- 在相关场景中，苏梦会自然地表现出这些行为倾向`,
            `- 参考上面的示例，把握当前影响力等级下角色的反应程度`,
            `- 这些是角色已经习惯的行为模式，不需要{{user}}每次都提起`,
            `- 【禁止】在输出中提及"习惯"、"行为倾向"、"影响力"等元游戏术语`,
            `- 【禁止】让角色意识到自己"被改变了"或"有了习惯"`,
          ].join('\n'),
        );
      }

      if (parts.length === 0) {
        return null;
      }

      return parts.join('\n\n');
    } catch (err) {
      console.error('[习惯注入] 生成注入消息时出错:', err);
      return null;
    }
  }

  /**
   * 从强制事件日志中检测待处理的事件
   * 支持 ROLL 后重新触发：只要日志在3楼内且未全部通知，就会重新触发
   * 【新逻辑】打断和巡逻都直接触发，不再需要预警阶段
   */
  function detectForcedEventFromLog(): {
    type: '阶段突破' | '苏文打断' | '苏文巡逻' | null;
    character: '秦璐' | '苏梦' | null;
    stage: number;
    accumulatedTime: number;
    reason: string;
    logIndex: number; // 用于后续标记已通知
    stageNumber?: number;
    triggerTime?: string;
    patrolLocation?: string; // 巡逻位置
  } {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');
      const currentFloor = getLastMessageId();

      if (!data?.系统追踪?.强制事件日志) {
        return { type: null, character: null, stage: 1, accumulatedTime: 0, reason: '', logIndex: -1 };
      }

      const logs = data.系统追踪.强制事件日志;

      // 按优先级排序：阶段突破 > 苏文打断 > 苏文巡逻
      const priorityOrder = { 阶段突破: 0, 苏文打断: 1, 苏文巡逻: 2 };

      // 找到第一个未通知且在3楼内的事件（按优先级）
      const validLogs = logs
        .map((log: any, index: number) => ({ log, index }))
        .filter(({ log }: { log: any }) => {
          // 检查是否在3楼内（与念头植入日志清理逻辑一致）
          const floorDiff = currentFloor - log.触发楼层;
          return floorDiff >= 0 && floorDiff <= 3 && !log.已通知AI;
        })
        .sort(
          (a: any, b: any) =>
            priorityOrder[a.log.事件类型 as keyof typeof priorityOrder] -
            priorityOrder[b.log.事件类型 as keyof typeof priorityOrder],
        );

      if (validLogs.length === 0) {
        return { type: null, character: null, stage: 1, accumulatedTime: 0, reason: '', logIndex: -1 };
      }

      const { log, index } = validLogs[0] as { log: any; index: number };
      const character = log.角色 as '秦璐' | '苏梦';
      const stage = character === '秦璐' ? data.秦璐状态?.当前阶段 || 1 : data.苏梦状态?.当前阶段 || 1;

      console.info(`[强制事件日志] 检测到待处理事件: ${log.事件类型}, 角色: ${character}, 楼层: ${log.触发楼层}`);

      return {
        type: log.事件类型,
        character,
        stage,
        accumulatedTime: log.累计时间 || 0,
        reason: log.打断原因 || '',
        logIndex: index,
        stageNumber: log.阶段号,
        triggerTime: log.触发时间,
        patrolLocation: log.巡逻位置,
      };
    } catch (err) {
      console.error('[强制事件日志] 检测时出错:', err);
      return { type: null, character: null, stage: 1, accumulatedTime: 0, reason: '', logIndex: -1 };
    }
  }

  /**
   * 检测苏文打断事件是否待触发（保留兼容旧逻辑，但优先使用日志）
   * 【新逻辑】直接触发，不再需要预警阶段
   */
  function detectInterruptionEvent(): {
    triggered: boolean;
    character: '秦璐' | '苏梦' | null;
    stage: number;
    accumulatedTime: number;
    reason: string;
  } {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data?.系统追踪?.苏文打断事件?.待触发) {
        return { triggered: false, character: null, stage: 1, accumulatedTime: 0, reason: '' };
      }

      // 检查是否已通知AI（避免重复触发）
      if (data.系统追踪.苏文打断事件.已通知AI) {
        return { triggered: false, character: null, stage: 1, accumulatedTime: 0, reason: '' };
      }

      const event = data.系统追踪.苏文打断事件;
      const currentCharacter = (data.系统追踪?.当前角色 || '秦璐') as '秦璐' | '苏梦';
      const stage = currentCharacter === '秦璐' ? data.秦璐状态?.当前阶段 || 1 : data.苏梦状态?.当前阶段 || 1;

      console.info(`[打断事件] 检测到待触发的打断事件，原因: ${event.打断原因}`);

      return {
        triggered: true,
        character: currentCharacter,
        stage,
        accumulatedTime: event.累计时间 || 0,
        reason: event.打断原因 || '',
      };
    } catch (err) {
      console.error('[打断事件] 检测时出错:', err);
      return { triggered: false, character: null, stage: 1, accumulatedTime: 0, reason: '' };
    }
  }

  /**
   * 打断事件的场景变体
   * 每个场景有多个可能的台词，触发时随机选一个
   */
  const interruptionScenarios = [
    {
      name: '敲门询问',
      scene: '走廊里传来了脚步声，越来越近，最终停在了{{user}}房间门口。\n苏文敲了敲门，声音从门外传来...',
      dialogues: [
        '"小璐？在里面吗？你在{{user}}房间做什么？这么久了。"',
        '"出来一下，我有话要说。"',
        '"怎么门关着？里面在干什么？"',
        '"你们两个在里面吗？我有点事想说。"',
        '"门关着干嘛？我敲半天了。"',
      ],
      prefill: '（走廊里忽然传来了脚步声，越来越近，最终在{{user}}房间门口停下...）\n\n"咚咚咚——"',
    },
    {
      name: '听到声音',
      scene: '苏文本来只是路过，但他似乎听到了什么声音。\n脚步声在门口停下，然后传来敲门声...',
      dialogues: [
        '"里面怎么了？我好像听到了什么声音。"',
        '"你们在房间里做什么？刚才好像有响动。"',
        '"小璐？出什么事了吗？"',
        '"刚才那是什么声音？你们在里面吗？"',
        '"我听到动静了...没事吧？"',
      ],
      prefill: '（走廊里的脚步声突然停下...似乎苏文听到了什么...）\n\n"咚咚——"',
    },
    {
      name: '叫吃饭',
      scene: '苏文端着一杯茶走过来，顺便来叫人。\n他在门口停下，用空着的手敲了敲门...',
      dialogues: [
        '"吃饭了，你们在里面吗？"',
        '"水果切好了，出来吃点。"',
        '"茶泡好了。你们两个在里面聊什么呢？"',
        '"饭菜凉了，出来吃吧。"',
        '"我泡了咖啡，要不要来一杯？"',
      ],
      prefill: '（走廊里传来脚步声，还有茶杯轻轻碰撞的声音...）\n\n',
    },
    {
      name: '找东西',
      scene: '苏文在找什么东西，找着找着来到了{{user}}房间门口。\n他敲了敲门，带着疑问的语气...',
      dialogues: [
        '"你们看到我的充电器了吗？"',
        '"小璐，你知道遥控器放哪了吗？"',
        '"我的眼镜找不到了...你们有看到吗？"',
        '"我的车钥匙呢？是不是在这里？"',
        '"那个文件夹...你们有看到吗？"',
      ],
      prefill: '（走廊里传来翻找东西的声音，然后脚步声靠近...）\n\n',
    },
    {
      name: '打电话回来',
      scene: '苏文刚打完电话，顺着走廊走过来。\n他看到{{user}}房间门关着，停下脚步...',
      dialogues: [
        '"打扰一下，我刚接到电话...你们两个在这里？"',
        '"电话里的事处理完了。小璐，你怎么还在这里？"',
        '"客户的电话真啰嗦...嗯？你们在做什么？"',
        '"终于挂了...你们在里面吗？"',
        '"那边的事搞定了。你们在这里干嘛呢？"',
      ],
      prefill: '（走廊里传来说话声，似乎是苏文在打电话...然后脚步声停在门口...）\n\n',
    },
    {
      name: '睡前巡视',
      scene: '苏文准备睡觉前习惯性地在家里走一圈。\n他来到{{user}}房间门口，发现灯还亮着...',
      dialogues: [
        '"这么晚了还不睡？"',
        '"灯还亮着...你们在干嘛呢？"',
        '"我去睡了，你们也早点休息。"',
        '"都快十二点了，还在聊天？"',
        '"明天还要上班呢，别太晚了。"',
      ],
      prefill: '（走廊里传来拖鞋声，苏文似乎在做睡前巡视...）\n\n',
    },
    {
      name: '接水经过',
      scene: '苏文去厨房接水，回来的时候经过{{user}}房间。\n手里端着杯水，在门口停了一下...',
      dialogues: [
        '"要喝水吗？我刚接的。"',
        '"你们还在这里啊...聊什么呢？"',
        '"门怎么关着？渴不渴，要不要水？"',
        '"我去接杯水...你们在里面干嘛？"',
        '"{{user}}，要不要给你倒杯水？"',
      ],
      prefill: '（厨房那边传来水龙头的声音，然后是走近的脚步声...）\n\n',
    },
  ];

  // ============================================
  // 越界行为检测系统
  // ============================================

  /**
   * 越界行为额外关键词配置
   * 这些是 LOCAL_KEYWORDS 之外的补充词汇，用于更精确地检测极端行为
   */
  const EXTRA_VIOLATION_KEYWORDS: Partial<Record<ThoughtCategory, string[]>> = {
    // 性行为：补充更多极端词汇
    性行为: ['抽插', '骑乘', '后入', '内射', '颜射', '深喉', '69', '打炮', '上床', '操', '干她', '肏', '吸'],
    // 身体开放：补充具体场景词汇
    身体开放: ['脱光', '全裸', '裸体', '脱内衣', '脱内裤', '露出胸', '露出乳', '露出阴', '展示身体', '看我的身体'],
    // 绝对服从：补充具体场景词汇
    绝对服从: ['跪下', '跪好', '舔脚', '当奴隶', '命令你', '服从我', '乖乖的', '跪着'],
    // 家庭替代：补充具体场景词汇
    家庭替代: ['离开苏文', '抛弃苏文', '赶走苏文', '取代苏文', '做我的女人', '只属于我'],
  };

  /**
   * 获取某个行为类型的完整关键词列表（合并 LOCAL_KEYWORDS 和额外词汇）
   */
  function getBoundaryKeywords(behaviorType: ThoughtCategory): string[] {
    const baseKeywords = LOCAL_KEYWORDS[behaviorType] || [];
    const extraKeywords = EXTRA_VIOLATION_KEYWORDS[behaviorType] || [];
    // 合并并去重
    return [...new Set([...baseKeywords, ...extraKeywords])];
  }

  /**
   * 所有可能的念头类型（用于计算禁止类型）
   */
  const ALL_THOUGHT_CATEGORIES: ThoughtCategory[] = [
    '陪伴交流',
    '情感依赖',
    '肢体亲近',
    '暧昧互动',
    '亲密接触',
    '身体开放',
    '性行为',
    '身份认同',
    '绝对服从',
    '家庭替代',
  ];

  /**
   * 根据 STAGE_REQUIREMENTS 派生禁止的行为类型
   * 这样可以确保与念头系统保持一致
   */
  function getForbiddenBehaviors(stage: number): ThoughtCategory[] {
    const stageReq = STAGE_REQUIREMENTS[stage];
    if (!stageReq) return [];

    // 如果 allowed 是 'all'，则没有禁止的行为
    if (stageReq.allowed === 'all') return [];

    // 返回不在允许列表中的所有类型
    return ALL_THOUGHT_CATEGORIES.filter(cat => !stageReq.allowed.includes(cat));
  }

  /**
   * 检测用户输入是否包含越界行为
   *
   * @returns 越界信息，如果没有越界返回 null
   */
  function detectBoundaryViolation(): {
    violated: boolean;
    character: '秦璐' | '苏梦';
    stage: number;
    violationType: string;
    matchedKeyword: string;
  } | null {
    try {
      // 获取最新的聊天消息
      const chat = SillyTavern.chat;
      if (!chat || chat.length === 0) return null;

      // 找到最后一条用户消息
      let lastUserMessage = '';
      for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user) {
          lastUserMessage = chat[i].mes || '';
          break;
        }
      }

      if (!lastUserMessage) return null;

      // 获取当前状态
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');
      if (!data) return null;

      // 检查苏文是否在家且清醒（只有这种情况才会触发苏文打断）
      // 注意：苏文不在家时，越界行为仍然不应该发生，但由于无法触发苏文打断，
      // 这种情况依赖于角色自身的阶段限制和念头系统来防止不当行为。
      // 如果需要更严格的限制，可以考虑添加角色自身抵抗的逻辑。
      const suwenState = data.苏文状态?.当前状态;
      if (suwenState !== '在家') {
        return null;
      }

      // 【新增】检查疑心值冻结状态 - 疑心值冻结期间，越界检测暂停
      // 包括：说谎成功冻结、安眠药效果期间、住院期间
      const currentCharacterCheck = (data.系统追踪?.当前角色 || '秦璐') as '秦璐' | '苏梦';
      const suspicionFreezeFieldName = currentCharacterCheck === '秦璐' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';
      const suspicionFreeze = data.苏文状态?.[suspicionFreezeFieldName];
      if (suspicionFreeze?.是否冻结) {
        console.info(`[越界检测] 疑心值冻结中(${suspicionFreeze.借口内容})，越界检测暂停`);
        return null;
      }

      // 【新增】检查住院状态 - 苏文住院期间，越界检测暂停
      const hospitalizationState = data.苏文状态?.住院状态;
      if (hospitalizationState?.是否住院) {
        console.info(`[越界检测] 苏文住院中(剩余${hospitalizationState.剩余天数}天)，越界检测暂停`);
        return null;
      }

      // 【新增】检查安眠药状态 - 安眠药生效期间，越界检测暂停
      const sleepingPillState = data.苏文状态?.安眠药状态;
      if (sleepingPillState?.是否生效) {
        console.info(`[越界检测] 安眠药生效中(剩余${sleepingPillState.剩余时间}小时)，越界检测暂停`);
        return null;
      }

      // 获取当前角色信息
      const currentCharacter = (data.系统追踪?.当前角色 || '秦璐') as '秦璐' | '苏梦';
      const characterState = currentCharacter === '秦璐' ? data.秦璐状态 : data.苏梦状态;
      const stage = characterState?.当前阶段 || 1;

      // 获取当前阶段禁止的行为类型（从 STAGE_REQUIREMENTS 派生）
      const forbiddenTypes = getForbiddenBehaviors(stage);

      // 检查用户输入是否包含禁止的关键词
      for (const behaviorType of forbiddenTypes) {
        const keywords = getBoundaryKeywords(behaviorType);
        if (keywords.length === 0) continue;

        for (const keyword of keywords) {
          if (lastUserMessage.includes(keyword)) {
            console.warn(`[越界检测] 检测到越界行为: 阶段${stage}禁止「${behaviorType}」，匹配关键词: "${keyword}"`);
            return {
              violated: true,
              character: currentCharacter,
              stage,
              violationType: behaviorType,
              matchedKeyword: keyword,
            };
          }
        }
      }

      return null;
    } catch (err) {
      console.error('[越界检测] 检测失败:', err);
      return null;
    }
  }

  /**
   * 生成越界行为打断的用户消息替换内容
   * 与普通打断不同，这里强调是因为"不当行为"触发
   */
  function generateBoundaryViolationUserMessage(
    character: '秦璐' | '苏梦',
    stage: number,
    violationType: string,
  ): string {
    // 根据阶段生成不同的羞耻/惊慌反应
    let characterReaction = '';
    let innerThought = '';

    if (stage <= 1) {
      characterReaction = `${character}瞬间石化，脸色煞白，整个人不知所措。她的手不自觉地攥紧衣角，声音颤抖得几乎说不出话来。`;
      innerThought = `（${character}的内心：这...这不可能发生的！我...我怎么会...不，一定是搞错了...）`;
    } else if (stage <= 2) {
      characterReaction = `${character}身体一僵，脸上的表情在惊慌与羞耻间交替。她下意识地后退一步，试图整理自己的仪态，但慌乱溢于言表。`;
      innerThought = `（${character}的内心：糟了...太过分了...这样下去...不行，要冷静...）`;
    } else {
      characterReaction = `${character}虽然表面镇定，但眼底闪过一丝慌乱。她深吸一口气，试图用平静的表情掩盖内心的波动。`;
      innerThought = `（${character}的内心：差点...太冒险了...幸好及时停下...）`;
    }

    // 根据违规类型生成不同的描述
    const violationDescriptions: Record<string, string> = {
      性行为: '过于亲密的举动',
      身体开放: '不当的暴露行为',
      绝对服从: '超出界限的要求',
      家庭替代: '危险的言论',
    };
    const violationDesc = violationDescriptions[violationType] || '越界行为';

    return [
      `【系统强制事件：苏文打断 - 越界警告】`,
      ``,
      `═══════════════════════════════════════════════════════════════`,
      `  ⚠️ 检测到${violationDesc}！苏文突然出现！`,
      `═══════════════════════════════════════════════════════════════`,
      ``,
      `【系统说明】`,
      `玩家试图引导角色做出超出当前阶段的行为。`,
      `在当前阶段（${stage}阶段），${character}不可能接受「${violationType}」类型的行为。`,
      `作为惩罚机制，苏文强制介入打断当前场景。`,
      ``,
      `【场景设定】`,
      `苏文突然出现在门口，神情严肃。`,
      `他似乎察觉到了什么不对劲，目光在${character}和{{user}}之间来回扫视。`,
      ``,
      `【${character}的反应】`,
      characterReaction,
      innerThought,
      ``,
      `【核心演出要求】`,
      `1. ${character}必须表现出强烈的拒绝/惊慌/羞耻`,
      `2. 她会主动与{{user}}拉开距离，整理仪容`,
      `3. 用大量内心独白表现她的心理冲突——"这太过分了"、"我怎么能..."`,
      `4. 苏文的介入让她如梦初醒，意识到刚才差点发生什么`,
      `5. 即使{{user}}继续尝试，${character}也会坚决拒绝`,
      ``,
      `【苏文的台词】（随机选择一个）`,
      `- "你们在干什么？"（语气严肃）`,
      `- "小璐，过来一下，我有话跟你说。"（带着审视的目光）`,
      `- "怎么房间门关着？里面发生什么了？"（皱眉）`,
      ``,
      `【绝对禁止】`,
      `- 禁止让${character}接受或配合{{user}}的越界要求`,
      `- 禁止继续之前的越界剧情`,
      `- 禁止淡化苏文的介入`,
      `- 禁止描写${character}对越界行为的享受或接受`,
      ``,
      `【后续机制】`,
      `如同普通打断事件，玩家需要在下一轮输入借口。`,
      `由于是越界触发，借口判定难度+20%。`,
      ``,
      `请演绎这个被打断的尴尬场景，展现${character}的羞耻和苏文的严肃。`,
    ].join('\n');
  }

  /**
   * 生成越界打断的 prefill
   */
  function generateBoundaryViolationPrefill(): string {
    return `（门突然被推开，苏文站在门口，脸色阴沉...）

`;
  }

  /**
   * 生成苏文打断事件的用户消息替换内容（方案3：直接触发+借口判定）
   * 苏文直接出现并质问，玩家下一轮输入借口，AI判定成功/失败
   */
  function generateInterruptionUserMessage(character: '秦璐' | '苏梦', stage: number, accumulatedTime: number): string {
    // 随机选择一个场景变体
    const scenario = interruptionScenarios[Math.floor(Math.random() * interruptionScenarios.length)];

    // 根据阶段生成不同的反应提示（5阶段系统）
    let reactionHint = '';
    let innerThought = '';
    if (stage <= 1) {
      const reactions = [
        `${character}非常慌张、心虚、急忙整理仪容，借口说得结结巴巴，心跳加速，脸色发白`,
        `${character}整个人僵住了一瞬，然后手忙脚乱地站起来，声音发颤`,
        `${character}的眼睛瞬间睁大，脸色瞬间变得苍白，大脑一片空白`,
      ];
      const thoughts = [
        `（${character}的内心：糟糕！被发现了吗？我、我该怎么解释...）`,
        `（${character}的内心：完了完了完了...他看到了多少？我该说什么？）`,
        `（${character}的内心：心跳好快...手在抖...冷静下来，冷静下来...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else if (stage <= 2) {
      const reactions = [
        `${character}表面镇定但内心紧张，能编出较好的借口，但手指微微颤抖`,
        `${character}深吸一口气，强迫自己冷静下来，声音虽然平稳但眼神有些飘忽`,
        `${character}下意识地整理了一下头发，露出一个略显僵硬的微笑`,
      ];
      const thoughts = [
        `（${character}的内心：冷静...冷静...想一个合理的借口...）`,
        `（${character}的内心：还好还好...应该没看到什么...表现得自然一点...）`,
        `（${character}的内心：深呼吸...只是正常的聊天...对，就是这样...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else if (stage <= 3) {
      const reactions = [
        `${character}已经不太在意被发现，敷衍地应付苏文，甚至暗暗感到一丝刺激`,
        `${character}慢条斯理地站起来，脸上带着淡淡的笑意，完全不慌不忙`,
        `${character}只是挑了挑眉，神态自若地转过身来，眼底甚至闪过一丝玩味`,
      ];
      const thoughts = [
        `（${character}的内心：又来打扰...真是烦人...）`,
        `（${character}的内心：差一点...真是会挑时候...）`,
        `（${character}的内心：哼，就让他猜去吧...反正他也不会知道真相...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else {
      const reactions = [
        `${character}完美表演、滴水不漏，从容应对，苏文完全看不出任何异常`,
        `${character}优雅地起身，神态自然得仿佛只是在进行最普通的对话`,
        `${character}脸上露出温柔的笑容，声音平稳而亲切，每个细节都无可挑剔`,
      ];
      const thoughts = [
        `（${character}的内心：呵，就这点小场面...）`,
        `（${character}的内心：演技这种东西，早就炉火纯青了...）`,
        `（${character}的内心：傻瓜永远都不会知道真相...继续扮演你的好妻子吧...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    }

    // 随机选择一个台词
    const selectedDialogue = scenario.dialogues[Math.floor(Math.random() * scenario.dialogues.length)];

    return [
      `【系统强制事件：苏文打断】`,
      ``,
      `═══════════════════════════════════════════════════════════════`,
      `  ⚠️ ${character}在{{user}}房间停留过久（${accumulatedTime}小时），苏文强制介入！`,
      `═══════════════════════════════════════════════════════════════`,
      ``,
      `【最高优先级】本轮必须演绎苏文打断事件，暂停其他剧情！`,
      ``,
      `【场景设定】`,
      scenario.scene,
      ``,
      `【苏文说】`,
      selectedDialogue,
      ``,
      `【${character}的反应】`,
      `${reactionHint}`,
      `${innerThought}`,
      ``,
      `【演出要求】`,
      `1. 用大量内心独白展现${character}被抓包时的心理活动`,
      `2. 描写她的表情变化、身体反应（心跳、脸红、手抖等）`,
      `3. 苏文的性格：略显木讷、工作忙碌、不太细心但偶尔敏锐`,
      `4. 可以描写${character}急忙整理仪容/掩饰痕迹的细节`,
      `5. 苏文在门口等待解释，不要让他直接离开`,
      ``,
      `【借口判定机制】`,
      `⚠️ 本轮结束后，玩家将在下一轮输入借口内容`,
      `⚠️ AI需要在下一轮根据借口质量判定成功或失败：`,
      `  - 借口成功：苏文相信，疑心值不变，${character}可以继续留在房间`,
      `  - 借口失败：苏文起疑，疑心值+10，${character}必须离开房间`,
      ``,
      `【借口发言人规则】⚠️ 重要 ⚠️`,
      `- 借口必须由${character}说出才能生效`,
      `- 如果{{user}}直接说出借口（而不是让${character}说），则自动判定失败`,
      `- 正确做法：玩家引导${character}找借口，由${character}向苏文解释`,
      `- 错误做法：{{user}}直接对苏文说"她是来帮我xxx的"`,
      ``,
      `【判定标准】`,
      `- ⚠️ 发言人检查：借口是否由${character}说出（{{user}}直接说=自动失败）`,
      `- 借口合理性（是否符合常理、是否有逻辑漏洞）`,
      `- ${character}当前阶段（阶段越高演技越好，更容易成功）`,
      `- 苏文当前疑心值（疑心值越高越难成功）`,
      `- 场景证据（房间内是否有可疑痕迹）`,
      ``,
      `【绝对禁止】`,
      `- 禁止忽略此事件继续之前的剧情`,
      `- 禁止让苏文离开不管`,
      `- 禁止代替玩家（{{user}}）说话或行动`,
      `- 禁止在本轮就判定借口成功或失败（等待玩家下一轮输入）`,
      ``,
      `请演绎苏文出现并质问的场景，结尾等待${character}或{{user}}的解释。`,
    ].join('\n');
  }

  /**
   * 生成打断事件的 Prefill（多样化版本）
   */
  function generateInterruptionPrefill(): string {
    const scenario = interruptionScenarios[Math.floor(Math.random() * interruptionScenarios.length)];
    return `【苏文打断事件】\n\n${scenario.prefill}\n`;
  }

  /**
   * 检测苏文巡逻事件是否待触发
   * 【新逻辑】直接触发，设置离开期限，不再需要预警阶段
   */
  function detectPatrolEvent(): {
    triggered: boolean;
    character: '秦璐' | '苏梦' | null;
    stage: number;
    triggerTime: string;
    patrolLocation: string;
  } {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data?.系统追踪?.苏文巡逻事件?.待触发) {
        return { triggered: false, character: null, stage: 1, triggerTime: '', patrolLocation: '' };
      }

      // 检查是否已通知AI（避免重复触发）
      if (data.系统追踪.苏文巡逻事件.已通知AI) {
        return { triggered: false, character: null, stage: 1, triggerTime: '', patrolLocation: '' };
      }

      const event = data.系统追踪.苏文巡逻事件;
      const currentCharacter = (data.系统追踪?.当前角色 || '秦璐') as '秦璐' | '苏梦';
      const stage = currentCharacter === '秦璐' ? data.秦璐状态?.当前阶段 || 1 : data.苏梦状态?.当前阶段 || 1;

      console.info(`[巡逻事件] 检测到待触发的巡逻事件，时间: ${event.触发时间}`);

      return {
        triggered: true,
        character: currentCharacter,
        stage,
        triggerTime: event.触发时间 || '',
        patrolLocation: event.巡逻位置 || '',
      };
    } catch (err) {
      console.error('[巡逻事件] 检测时出错:', err);
      return { triggered: false, character: null, stage: 1, triggerTime: '', patrolLocation: '' };
    }
  }

  /**
   * 巡逻事件的场景变体
   */
  const patrolScenarios = [
    {
      name: '路过询问',
      scene: '走廊里传来了脚步声。\n苏文路过{{user}}房间门口，注意到门关着，停下了脚步...',
      dialogues: ['"{{user}}？在房间里吗？"', '"小璐？你也在吗？"', '（敲敲门）"门怎么关着？"'],
      prefill: '（走廊里忽然传来了脚步声，苏文路过{{user}}房间门口...）\n\n',
    },
    {
      name: '上厕所路过',
      scene: '苏文去洗手间的路上，经过{{user}}房间。\n他本来没打算停下，但还是习惯性地看了一眼...',
      dialogues: [
        '"你们在里面吗？我去趟洗手间。"（随口一问）',
        '"门关这么紧干嘛？"（似乎只是顺口说说）',
        '"小璐在里面？在干嘛呢？"（带着好奇）',
      ],
      prefill: '（走廊里传来拖鞋的声音，苏文经过房间门口...）\n\n',
    },
    {
      name: '拿东西经过',
      scene: '苏文从书房出来，手里拿着什么东西，经过{{user}}房间时停了一下...',
      dialogues: [
        '"你们两个在里面？我去厨房拿点东西。"',
        '（看了眼门）"关着门在聊什么呢？"',
        '"{{user}}，你妈在你房间吗？"',
      ],
      prefill: '（书房的门响了一声，然后是脚步声渐近...）\n\n',
    },
    {
      name: '听到动静',
      scene: '苏文在客厅看电视，隐约听到了{{user}}房间的动静。\n他好奇地走过来，站在门口...',
      dialogues: [
        '"你们在做什么？我好像听到了声音。"',
        '"里面怎么了？动静挺大的。"',
        '"小璐？没事吧？"（带着一点担心）',
      ],
      prefill: '（客厅的电视声停了，然后是越来越近的脚步声...）\n\n',
    },
    {
      name: '喊人吃东西',
      scene: '苏文从厨房出来，想叫家人吃点水果或零食。\n他走到{{user}}房间门口...',
      dialogues: [
        '"我削了个苹果，你们要吃吗？"',
        '"泡了壶茶，出来喝点？你们在里面干嘛呢？"',
        '"有你们爱吃的零食，出来拿一下？门怎么关着？"',
      ],
      prefill: '（厨房那边传来碗碟轻碰的声音，然后脚步声靠近...）\n\n',
    },
    {
      name: '回房间睡觉',
      scene: '苏文准备回房间休息，路过{{user}}房间时，发现灯还亮着...',
      dialogues: [
        '"这么晚了还不睡？你们在里面聊什么？"',
        '"我先去睡了，你们早点休息。门怎么关着？"',
        '"小璐，你怎么还在{{user}}房间？不早了。"',
      ],
      prefill: '（客厅的灯灭了，然后是走向卧室的脚步声...脚步在门口停住了...）\n\n',
    },
    {
      name: '接完电话',
      scene: '苏文刚接完一个电话，从阳台走回来。\n经过{{user}}房间时，随口问了一句...',
      dialogues: [
        '（收起手机）"刚才在接电话...你们两个在这里啊？"',
        '"电话是公司的事...你们在里面待挺久了？"',
        '"哎，工作的事真烦人...你们关着门在做什么？"',
      ],
      prefill: '（阳台的门关上了，然后是脚步声...苏文似乎刚打完电话...）\n\n',
    },
    {
      name: '找人帮忙',
      scene: '苏文想找人帮个小忙，四处找人找到了{{user}}房间门口...',
      dialogues: [
        '"有人在吗？能帮我搭把手吗？"',
        '"小璐，你在这里？帮我看一下那个...等等，你们在干嘛？"',
        '"{{user}}，你妈妈在吗？我需要她帮个忙。"',
      ],
      prefill: '（房子里传来苏文找人的声音，脚步声越来越近...）\n\n',
    },
  ];

  /**
   * 生成苏文巡逻事件的用户消息替换内容（新逻辑：设置离开期限）
   * 苏文路过时会要求角色1-2小时内离开，不需要借口判定
   */
  function generatePatrolUserMessage(character: '秦璐' | '苏梦', stage: number): string {
    // 随机选择一个场景变体
    const scenario = patrolScenarios[Math.floor(Math.random() * patrolScenarios.length)];

    // 随机生成离开期限（1-2小时）
    const deadlineHours = Math.random() < 0.5 ? 1 : 2;

    // 根据阶段生成不同的反应提示（5阶段系统）
    let reactionHint = '';
    let innerThought = '';
    if (stage <= 1) {
      const reactions = [
        `${character}心跳加速，急忙整理仪容，脸色微变，语气有些不自然`,
        `${character}下意识地坐直身体，声音略微发紧，努力表现得若无其事`,
        `${character}的手指不自觉地攥紧了一下，然后强迫自己放松`,
      ];
      const thoughts = [
        `（${character}的内心：怎么这个时候过来了...冷静...冷静...）`,
        `（${character}的内心：不要慌...只是普通的问话...自然一点...）`,
        `（${character}的内心：他不会发现什么的...对吧...？）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else if (stage <= 2) {
      const reactions = [
        `${character}稍显紧张，但能维持表面镇定，回答时带着一点犹豫`,
        `${character}神态基本平静，只是说话的时候眼神有一瞬间的闪躲`,
        `${character}轻轻清了清嗓子，声音平稳但略显刻意`,
      ];
      const thoughts = [
        `（${character}的内心：只是普通的问候...不要表现得太奇怪...）`,
        `（${character}的内心：随便应付一下就好...他不会多想的...）`,
        `（${character}的内心：保持微笑...正常的语气...没什么好紧张的...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else if (stage <= 3) {
      const reactions = [
        `${character}从容应对，脸上挂着得体的笑容，内心却暗暗不满被打扰`,
        `${character}懒洋洋地回应，神态自若，甚至带着一丝不耐烦`,
        `${character}淡淡地扫了门口一眼，表情没有任何波动`,
      ];
      const thoughts = [
        `（${character}的内心：又来了...真是扫兴...）`,
        `（${character}的内心：烦不烦啊...就不能让人清静一会吗...）`,
        `（${character}的内心：随便打发他走就好了...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    } else {
      const reactions = [
        `${character}完美地扮演着日常角色，应对自如，毫无破绽`,
        `${character}转过头来，脸上是恰到好处的温柔笑容，声音亲切自然`,
        `${character}的反应完美无瑕，任何人都看不出一丝异常`,
      ];
      const thoughts = [
        `（${character}的内心：呵，演戏而已...）`,
        `（${character}的内心：这种小场面，闭着眼都能应付...）`,
        `（${character}的内心：可怜的人，永远都不会知道真相...）`,
      ];
      reactionHint = reactions[Math.floor(Math.random() * reactions.length)];
      innerThought = thoughts[Math.floor(Math.random() * thoughts.length)];
    }

    // 随机选择一个台词
    const selectedDialogue = scenario.dialogues[Math.floor(Math.random() * scenario.dialogues.length)];

    // 苏文要求离开的台词变体
    const leaveRequests = [
      `"好了，你们也别聊太久了，${deadlineHours}小时后该做饭了/该休息了。"`,
      `"行，我不打扰你们了，不过差不多${deadlineHours}小时后出来一下吧。"`,
      `"嗯...好吧，不过别待太久，${deadlineHours}小时后该出来活动活动了。"`,
      `"那你们继续，${deadlineHours}小时后记得出来。"`,
    ];
    const leaveRequest = leaveRequests[Math.floor(Math.random() * leaveRequests.length)];

    return [
      `【系统强制事件：苏文巡逻】`,
      ``,
      `═══════════════════════════════════════════════════════════════`,
      `  ⚠️ 苏文路过{{user}}房间，随机触发！`,
      `═══════════════════════════════════════════════════════════════`,
      ``,
      `【最高优先级】本轮必须演绎苏文巡逻事件，暂停其他剧情！`,
      ``,
      `【场景设定】`,
      scenario.scene,
      ``,
      `【苏文说】`,
      selectedDialogue,
      ``,
      `【${character}的反应】`,
      `${reactionHint}`,
      `${innerThought}`,
      ``,
      `【苏文的要求】`,
      `苏文简单问询后，会要求${character}在${deadlineHours}小时内离开房间：`,
      leaveRequest,
      ``,
      `【演出要求】`,
      `1. 用内心独白展现${character}被问询时的心理活动`,
      `2. 描写她的表情管理、语气控制`,
      `3. ${character}需要给苏文一个简单的回应（不需要复杂借口）`,
      `4. 苏文会自然地提出离开期限要求，然后离开`,
      `5. 苏文的性格：略显木讷、工作忙碌、不太细心但偶尔敏锐`,
      ``,
      `【离开期限机制】`,
      `⚠️ 苏文已设置${deadlineHours}小时的离开期限`,
      `⚠️ ${character}必须在期限内离开{{user}}房间`,
      `⚠️ 如果超时不离开，将触发【苏文打断事件】`,
      ``,
      `【绝对禁止】`,
      `- 禁止忽略此事件继续之前的剧情`,
      `- 禁止代替玩家（{{user}}）说话或行动`,
      `- 禁止让苏文不提出离开要求就离开`,
      ``,
      `请演绎这个巡逻场景，包括苏文的问询和离开要求。`,
    ].join('\n');
  }

  /**
   * 生成巡逻事件的 Prefill（多样化版本）
   */
  function generatePatrolPrefill(): string {
    const scenario = patrolScenarios[Math.floor(Math.random() * patrolScenarios.length)];
    return `【苏文巡逻事件】\n\n${scenario.prefill}`;
  }

  /**
   * 检测阶段突破并返回触发信息（5阶段系统）
   * 当角色阶段变化时，返回需要触发的隐藏剧情信息
   */
  function detectStageBreakthrough(): {
    character: '秦璐' | '苏梦' | null;
    newStage: number | null;
  } {
    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });
      const data = _.get(variables, 'stat_data');

      if (!data) {
        return { character: null, newStage: null };
      }

      // 检查秦璐的阶段突破
      const qinluPending = data.系统追踪?.秦璐外观待更新;
      if (qinluPending?.需要更新 && qinluPending.目标阶段 > 1) {
        const newStage = qinluPending.目标阶段;
        console.info(`[阶段突破] 检测到秦璐阶段突破: 阶段${newStage}(${getStageTitle(newStage)})`);
        return { character: '秦璐', newStage };
      }

      // 检查苏梦的阶段突破
      const sumengPending = data.系统追踪?.苏梦外观待更新;
      if (sumengPending?.需要更新 && sumengPending.目标阶段 > 1) {
        const newStage = sumengPending.目标阶段;
        console.info(`[阶段突破] 检测到苏梦阶段突破: 阶段${newStage}(${getStageTitle(newStage)})`);
        return { character: '苏梦', newStage };
      }

      return { character: null, newStage: null };
    } catch (err) {
      console.error('[阶段突破] 检测时出错:', err);
      return { character: null, newStage: null };
    }
  }

  /**
   * 生成阶段突破的用户消息替换内容
   * 直接替换用户消息，使 AI 认为用户请求的是触发隐藏剧情
   */
  function generateStageBreakthroughUserMessage(character: '秦璐' | '苏梦', newStage: number): string {
    const stageTitle = getStageTitle(newStage);
    const injection = generateStageBreakthroughInjection(character, newStage);

    // 将 OOC 格式转换为直接的用户请求格式
    // 移除 "OOC:" 前缀，改为更直接的剧情触发格式
    const cleanedInjection = injection
      .replace(/^OOC:\s*/gm, '')
      .replace(/【强制剧情事件[^】]*】/g, '')
      .trim();

    return [
      `【系统触发：${character}阶段${newStage}「${stageTitle}」隐藏剧情】`,
      ``,
      `玩家当前的行动暂时搁置，请先演绎以下隐藏剧情事件。`,
      ``,
      cleanedInjection,
      ``,
      `请完整演绎这段隐藏剧情，结束后恢复正常互动。`,
    ].join('\n');
  }

  /**
   * 强制事件类型定义
   * 【新逻辑】移除预警机制，所有事件直接触发
   * 【新增】boundaryViolation - 越界行为触发的打断（最高优先级）
   */
  type ForcedEventInfo = {
    type: 'stageBreakthrough' | 'interruption' | 'patrol' | 'boundaryViolation' | null;
    character: '秦璐' | '苏梦' | null;
    userMessageContent: string | null;
    prefill: string | null;
    // 额外信息
    stageNumber?: number; // 阶段突破时的新阶段
    accumulatedTime?: number; // 打断事件时的累计时间
    triggerTime?: string; // 巡逻事件时的触发时间
    logIndex?: number; // 日志索引，用于标记已通知
    violationType?: string; // 越界行为类型
  };

  /**
   * 生成完整的注入内容（状态一致性 + 信息隔离 + 念头植入 + 习惯影响 + 强制事件）
   * 所有强制事件（阶段突破、打断、巡逻）都通过直接替换用户消息内容实现
   */
  function generateFullInjection(): {
    normal: string | null;
    thoughtImplant: string | null;
    forcedEvent: ForcedEventInfo;
  } {
    const normalParts: string[] = [];

    // 1. 状态一致性检查
    const stateReminder = generateStateConsistencyReminder();
    if (stateReminder) {
      normalParts.push(stateReminder);
    }

    // 2. 信息隔离提醒（秦璐和苏梦之间的信息隔离）
    const isolationReminder = generateInformationIsolationReminder();
    if (isolationReminder) {
      normalParts.push(isolationReminder);
    }

    // 3. 习惯影响
    const habitsText = generateHabitsInjection();
    if (habitsText) {
      normalParts.push(habitsText);
    }

    // 4. 外观提醒（当前角色的服装和妆容）
    const appearanceReminder = generateAppearanceReminder();
    if (appearanceReminder) {
      normalParts.push(appearanceReminder);
    }

    // 5. 待判定念头的类型判定提示
    const pendingThoughtJudge = generatePendingThoughtJudgePrompt();
    if (pendingThoughtJudge) {
      normalParts.push(pendingThoughtJudge);
    }

    const normalContent = normalParts.length > 0 ? normalParts.join('\n\n') : stateReminder;

    // 6. 念头植入通知（单独返回，在最后一条user消息后注入）
    const thoughtImplantText = generateThoughtImplantNotifications();

    // 7. 检查强制事件（优先使用日志机制，支持ROLL后重新触发）
    // 所有强制事件都使用用户消息替换模式，确保最高执行优先级
    let forcedEvent: ForcedEventInfo = {
      type: null,
      character: null,
      userMessageContent: null,
      prefill: null,
    };

    // 【最高优先级】检测越界行为 - 用户试图在低阶段引导极端行为
    // 如果检测到越界，直接触发苏文打断，不检查其他事件
    const boundaryViolation = detectBoundaryViolation();
    if (boundaryViolation) {
      const { character, stage, violationType, matchedKeyword } = boundaryViolation;
      forcedEvent = {
        type: 'boundaryViolation',
        character,
        userMessageContent: generateBoundaryViolationUserMessage(character, stage, violationType),
        prefill: generateBoundaryViolationPrefill(),
        violationType,
      };
      console.warn(
        `[习惯注入] ⚠️ 检测到越界行为！阶段${stage}禁止「${violationType}」，关键词: "${matchedKeyword}"，触发打断`,
      );

      // 越界行为检测到后，直接返回，不再检查其他事件
      return {
        normal: normalContent,
        thoughtImplant: thoughtImplantText,
        forcedEvent,
      };
    }

    // 【优先】从强制事件日志中检测（支持ROLL后重新触发）
    // 【新逻辑】所有事件直接触发，不再需要预警阶段
    const logEvent = detectForcedEventFromLog();
    if (logEvent.type && logEvent.character) {
      const { type, character, stage, accumulatedTime, stageNumber, triggerTime, logIndex } = logEvent;

      if (type === '阶段突破' && stageNumber) {
        forcedEvent = {
          type: 'stageBreakthrough',
          character,
          userMessageContent: generateStageBreakthroughUserMessage(character, stageNumber),
          prefill: generateStageBreakthroughPrefill(character, stageNumber),
          stageNumber,
          logIndex,
        };
        console.info(`[习惯注入] 从日志检测到阶段突破，将替换用户消息 (${character} 阶段${stageNumber})`);
      } else if (type === '苏文打断') {
        // 直接触发打断事件（方案3：借口判定）
        forcedEvent = {
          type: 'interruption',
          character,
          userMessageContent: generateInterruptionUserMessage(character, stage, accumulatedTime),
          prefill: generateInterruptionPrefill(),
          accumulatedTime,
          logIndex,
        };
        console.info(`[习惯注入] 从日志检测到打断事件，将替换用户消息 (${character}, 累计${accumulatedTime}小时)`);
      } else if (type === '苏文巡逻') {
        // 直接触发巡逻事件（设置离开期限）
        forcedEvent = {
          type: 'patrol',
          character,
          userMessageContent: generatePatrolUserMessage(character, stage),
          prefill: generatePatrolPrefill(),
          triggerTime,
          logIndex,
        };
        console.info(`[习惯注入] 从日志检测到巡逻事件，将替换用户消息 (${character}, 时间${triggerTime})`);
      }
    }

    // 【兼容】如果日志中没有，回退到旧的检测逻辑
    // 【新逻辑】所有事件直接触发，不再需要预警阶段
    if (!forcedEvent.type) {
      // 检查阶段突破（最高优先级）
      const stageBreakthroughInfo = detectStageBreakthrough();
      if (stageBreakthroughInfo.character && stageBreakthroughInfo.newStage) {
        const { character, newStage } = stageBreakthroughInfo;
        forcedEvent = {
          type: 'stageBreakthrough',
          character,
          userMessageContent: generateStageBreakthroughUserMessage(character, newStage),
          prefill: generateStageBreakthroughPrefill(character, newStage),
          stageNumber: newStage,
        };
        console.info(`[习惯注入] 检测到阶段突破，将替换用户消息 (${character} 阶段${newStage})`);
      }

      // 检查打断事件（次优先级）- 仅在没有阶段突破时
      if (!forcedEvent.type) {
        const interruptionInfo = detectInterruptionEvent();
        if (interruptionInfo.triggered && interruptionInfo.character) {
          const { character, stage, accumulatedTime } = interruptionInfo;
          // 直接触发打断事件（方案3：借口判定）
          forcedEvent = {
            type: 'interruption',
            character,
            userMessageContent: generateInterruptionUserMessage(character, stage, accumulatedTime),
            prefill: generateInterruptionPrefill(),
            accumulatedTime,
          };
          console.info(`[习惯注入] 检测到打断事件，将替换用户消息 (${character}, 累计${accumulatedTime}小时)`);
        }
      }

      // 检查巡逻事件（最低优先级）- 仅在没有阶段突破和打断时
      if (!forcedEvent.type) {
        const patrolInfo = detectPatrolEvent();
        if (patrolInfo.triggered && patrolInfo.character) {
          const { character, stage, triggerTime } = patrolInfo;
          // 直接触发巡逻事件（设置离开期限）
          forcedEvent = {
            type: 'patrol',
            character,
            userMessageContent: generatePatrolUserMessage(character, stage),
            prefill: generatePatrolPrefill(),
            triggerTime,
          };
          console.info(`[习惯注入] 检测到巡逻事件，将替换用户消息 (${character}, 时间${triggerTime})`);
        }
      }
    }

    return {
      normal: normalContent,
      thoughtImplant: thoughtImplantText,
      forcedEvent,
    };
  }

  /**
   * 标记强制事件已处理（更新变量状态）
   * 同时标记强制事件日志中的对应条目为已通知
   */
  function markForcedEventHandled(forcedEvent: ForcedEventInfo): void {
    if (!forcedEvent.type || !forcedEvent.character) return;

    try {
      const currentVars = Mvu.getMvuData({ type: 'message', message_id: -1 });

      // 【关键】如果是从日志检测到的事件，标记日志条目为已通知
      if (forcedEvent.logIndex !== undefined && forcedEvent.logIndex >= 0) {
        const logs = _.get(currentVars, 'stat_data.系统追踪.强制事件日志', []);
        if (logs[forcedEvent.logIndex]) {
          logs[forcedEvent.logIndex].已通知AI = true;
          console.info(`[习惯注入] 已标记强制事件日志[${forcedEvent.logIndex}]为已通知`);
        }
      }

      // 同时更新旧的状态标记（保持兼容性）
      switch (forcedEvent.type) {
        case 'stageBreakthrough':
          if (forcedEvent.character === '秦璐') {
            _.set(currentVars, 'stat_data.系统追踪.秦璐外观待更新.需要更新', false);
            _.set(currentVars, 'stat_data.系统追踪.秦璐外观待更新.变化原因', '阶段突破剧情已触发');
          } else {
            _.set(currentVars, 'stat_data.系统追踪.苏梦外观待更新.需要更新', false);
            _.set(currentVars, 'stat_data.系统追踪.苏梦外观待更新.变化原因', '阶段突破剧情已触发');
          }
          console.info(`[习惯注入] 已标记阶段突破事件为已处理`);
          break;

        case 'interruption':
          _.set(currentVars, 'stat_data.系统追踪.苏文打断事件.已通知AI', true);
          _.set(currentVars, 'stat_data.系统追踪.苏文打断事件.待触发', false);
          console.info(`[习惯注入] 已标记打断事件为已处理`);
          break;

        case 'patrol':
          _.set(currentVars, 'stat_data.系统追踪.苏文巡逻事件.已通知AI', true);
          _.set(currentVars, 'stat_data.系统追踪.苏文巡逻事件.待触发', false);
          console.info(`[习惯注入] 已标记巡逻事件为已处理`);
          break;
      }

      Mvu.replaceMvuData(currentVars, { type: 'message', message_id: -1 });
    } catch (mvuErr) {
      console.error(`[习惯注入] 标记强制事件失败:`, mvuErr);
    }
  }

  // 监听 CHAT_COMPLETION_PROMPT_READY 事件
  eventOn(
    tavern_events.CHAT_COMPLETION_PROMPT_READY,
    (event_data: Parameters<ListenerType['chat_completion_prompt_ready']>[0]) => {
      try {
        const { chat, dryRun } = event_data;

        // 【关键】dryRun 时跳过所有状态修改操作
        // dryRun 是酒馆用于计算 token 等的测试运行，不应该触发任何状态变更
        if (dryRun) {
          console.info(`[习惯注入] dryRun=true，跳过注入（仅计算 token）`);
          return;
        }

        const { normal, thoughtImplant, forcedEvent } = generateFullInjection();

        // 酒馆自动添加的系统提示语列表（这些不是用户的实际输入）
        const systemPrompts = [
          'Now go ahead MW and pass the review.',
          'Now continue the script',
          '[Continue]',
          'Continue',
        ];

        /**
         * 查找最后一条真正的用户消息位置
         */
        function findLastRealUserIndex(): number {
          for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].role === 'user') {
              const rawContent = chat[i].content;
              const content = typeof rawContent === 'string' ? rawContent : '';
              const trimmed = content.trim();
              const isSystemPrompt = systemPrompts.some(prompt => trimmed === prompt || trimmed.startsWith(prompt));
              if (!isSystemPrompt) {
                return i;
              }
            }
          }
          return -1;
        }

        // ========== 处理空 chat 数组的情况 ==========
        if (chat.length === 0) {
          if (normal) {
            chat.push({ role: 'system', content: normal });
          }
          if (thoughtImplant) {
            chat.push({ role: 'system', content: thoughtImplant });
          }
          // 强制事件：如果 chat 为空，直接添加用户消息
          if (forcedEvent.userMessageContent) {
            chat.push({ role: 'user', content: forcedEvent.userMessageContent });
            console.info(`[习惯注入] chat 为空，添加强制事件用户消息 (${forcedEvent.type})`);
            markForcedEventHandled(forcedEvent);
          }
          // 注意：空 chat 时不添加 prefill，因为无法确定是否是 extended thinking 模式
          // 如果需要 prefill 效果，已经在 userMessageContent 中包含了足够的引导
          console.info('[习惯注入] chat 数组为空，已添加消息');
          return;
        }

        // ========== 强制事件触发：直接替换用户消息内容 ==========
        // 【新逻辑】所有强制事件直接触发，不再有预警阶段
        // 打断事件：苏文直接出现并质问，玩家下一轮输入借口，AI判定成功/失败
        // 巡逻事件：苏文设置1-2小时离开期限，超时则触发打断事件
        if (forcedEvent.type && forcedEvent.userMessageContent && forcedEvent.character) {
          // 找到最后一条用户消息
          let lastUserIndex = -1;
          for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].role === 'user') {
              lastUserIndex = i;
              break;
            }
          }

          if (lastUserIndex !== -1) {
            // 替换用户消息内容
            chat[lastUserIndex].content = forcedEvent.userMessageContent;

            // 生成日志信息
            let logInfo = `[习惯注入] 强制事件触发: ${forcedEvent.type}`;
            if (forcedEvent.type === 'stageBreakthrough') {
              logInfo += ` (${forcedEvent.character} 阶段${forcedEvent.stageNumber})`;
            } else if (forcedEvent.type === 'interruption') {
              logInfo += ` (${forcedEvent.character}, 累计${forcedEvent.accumulatedTime}小时)`;
            } else if (forcedEvent.type === 'patrol') {
              logInfo += ` (${forcedEvent.character}, 时间${forcedEvent.triggerTime})`;
            }
            console.info(logInfo);

            // 标记强制事件已处理
            markForcedEventHandled(forcedEvent);
          }

          // 添加 Prefill（强制 AI 回复的开头）
          // 根据 Claude 官方文档：https://platform.claude.com/docs/en/build-with-claude/extended-thinking
          // "Prefilling is only available for non-extended thinking modes. It's not currently supported with extended thinking."
          // 因此在 extended thinking 模式下，我们将 prefill 内容作为 system 提示添加，引导 AI 按预期格式开始回复
          if (forcedEvent.prefill && !currentRequestHasExtendedThinking) {
            // 非 extended thinking 模式：正常添加 prefill
            chat.push({ role: 'assistant', content: forcedEvent.prefill });
            console.info(`[习惯注入] 已添加强制事件 Prefill: "${forcedEvent.prefill.substring(0, 30)}..."`);
          } else if (forcedEvent.prefill && currentRequestHasExtendedThinking) {
            // extended thinking 模式：将 prefill 作为 system 提示追加，引导 AI 以此开头
            const prefillGuidance = `【回复格式要求】请以以下内容作为回复的开头：\n${forcedEvent.prefill}`;
            chat.push({ role: 'system', content: prefillGuidance });
            console.info(`[习惯注入] 检测到 extended thinking 模式，将 Prefill 转换为 system 提示`);
          }

          // 强制事件时，只添加状态一致性和习惯注入
          let firstUserIndex = -1;
          for (let i = 0; i < chat.length; i++) {
            if (chat[i].role === 'user') {
              firstUserIndex = i;
              break;
            }
          }

          if (normal) {
            const normalInsertIndex = firstUserIndex === -1 ? chat.length : firstUserIndex;
            chat.splice(normalInsertIndex, 0, { role: 'system', content: normal });
          }

          return; // 强制事件处理完成，跳过其他注入
        }

        // ========== 无强制事件：正常注入逻辑 ==========

        // 找到第一条 role='user' 的消息位置（用于插入普通提示）
        let firstUserIndex = -1;
        for (let i = 0; i < chat.length; i++) {
          if (chat[i].role === 'user') {
            firstUserIndex = i;
            break;
          }
        }

        // 1. 插入普通提示（状态一致性 + 习惯）在第一条 user 消息之前
        if (normal) {
          const normalInsertIndex = firstUserIndex === -1 ? chat.length : firstUserIndex;
          chat.splice(normalInsertIndex, 0, {
            role: 'system',
            content: normal,
          });
          console.info(`[习惯注入] 已在位置 ${normalInsertIndex} 注入状态一致性检查和习惯列表`);
        }

        // 2. 插入念头植入通知
        if (thoughtImplant) {
          const lastRealUserIndex = findLastRealUserIndex();
          console.info(`[习惯注入] 最后一条真正用户消息位置: ${lastRealUserIndex}`);

          if (lastRealUserIndex !== -1) {
            const insertIndex = lastRealUserIndex + 1;
            chat.splice(insertIndex, 0, {
              role: 'system',
              content: thoughtImplant,
            });
            console.info(`[习惯注入] 已在真正用户消息后（位置 ${insertIndex}）注入念头植入通知`);
          } else {
            chat.push({
              role: 'system',
              content: thoughtImplant,
            });
            console.info(`[习惯注入] 没有找到真正用户消息，已在数组末尾注入念头植入通知`);
          }
        }
      } catch (err) {
        console.error('[习惯注入] 注入时发生错误:', err);
      }
    },
  );

  console.info('[习惯注入脚本] 加载完成，事件监听已注册');
});
