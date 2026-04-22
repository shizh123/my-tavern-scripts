// ────────────────────────────────────────────────────────────
// 里程碑日志 (Milestone Log)
//
// 把游戏关键转折点（阶段突破 / 苗广心态转变 / 特殊场景完成 / 千晶完成 /
// 洛书晴激活 / 坏结局 / 神魂空间首次 / 打断）以绿灯条目形式写入聊天世界书。
//
// 设计目标:
// - AI 在中后期（/hide 清理老楼层后）仍然能 refer 到早期事件，减少 OOC
// - 零 AI 调用：纯代码直接写世界书，不占用 AI turn 也不额外耗 token/额度
// - 不依赖第三方插件：走酒馆原生 chat worldbook + 绿灯 keyword 触发
// - 降级安全：所有 API 调用 try/catch，失败只 warn 不影响主流程
// - 新聊天自动清空：写入目标是"聊天世界书"(chat worldbook)，新聊天默认为空
// - 回退楼层保护：写入前删掉 `extra.milestone_floor > currentFloor` 的条目
//
// 使用方式: 在 VARIABLE_UPDATE_ENDED 回调末尾调用
//   detectAndWriteMilestones(newData, oldData, currentFloor).catch(...);
// ────────────────────────────────────────────────────────────

import type { Schema as SchemaType } from '../../schema';

/** 聊天世界书默认名称：新聊天没绑定时使用这个名字创建一本 */
const DEFAULT_WORLDBOOK_NAME = '云霜凝-milestones';

/**
 * 特殊场景"发生了什么"实质概括(给 AI refer 用, 玩家 hide 老楼后也能读懂)
 * 不写楼层、不写当时数值、只写事件内容, 短小精悍。
 */
const SCENE_SUMMARIES: Record<string, string> = {
  镜前调教: '{{user}} 让云霜凝在铜镜前面对自己被调教的画面, 她痛苦接受"镜中人是自己"。',
  夫前凌辱: '{{user}} 当着苗广面(帷幔外)调教云霜凝, 苗广听/看到全程, 屈辱中生理反应但未爆发。',
  寝取宣告: '{{user}} 逼云霜凝向帷幔外的苗广亲口道歉 + 宣告身体归属 {{user}}, 苗广通过透灵幔清楚听见看见。',
  绿帽奴调教: '{{user}} 进一步调教云霜凝, 苗广心态从默许转向沉溺。',
  掌门改嫁: '苗广主动提出请 {{user}} 正式迎娶云霜凝, 云霜凝改嫁。',
  婆媳教导: '云霜凝以师母身份向洛书晴传授"服从调教"的处世心得。',
  两人同侍: '云霜凝和洛书晴首次一起伺候 {{user}}。',
  寝取宣告增强: '云霜凝 + 洛书晴 + 苗广 + {{user}} 四人同场的加强版寝取宣告。',
  门缝春光: '苗广门缝偷窥 {{user}} 与云霜凝, 洛书晴心机觉醒。',
  双重目击: '苗喧亲眼目击父亲苗广偷窥 + 门内画面, 苗喧绝望感首次具象化。',
  儿媳调教公公: '洛书晴反向调教苗广, 强化绿帽奴路径。',
  双重改嫁:
    '云霜凝和洛书晴双双改嫁 {{user}}, 苗喧被强迫见证全程, 家族秩序彻底颠倒。苗广已被千晶幻术改写认知, 叫 {{user}} 义父、叫云霜凝娘亲。',
  千晶告知洛书晴: '云霜凝告诉洛书晴她对苗广施了千晶幻术, 师徒共谋默契加深。',
  苗喧的一日: '苗喧麻木度过双重改嫁后的一日(后日谈, 他视角的钝痛日常)。',
  未知: '云霜凝在老祖遗物中发现临终私记, 揭露此界是"祂"的牧场、寒霜门是筛选流水线、她是第 88 位成品。云霜凝向 {{user}} 展开反"祂"战略 + 情感托付。',
};

/** 条目 `extra` 字段的 marker，区分我们的条目 vs 玩家/其他脚本写的条目 */
const MILESTONE_MARKER = 'yunshuangning_milestone';

// ────────────────────────────────────────────────────────────
// 里程碑类型
// ────────────────────────────────────────────────────────────

interface Milestone {
  /** 唯一类型标识，用于 dedupe。同 type 同 floor 不重复写 */
  type: string;
  /** 触发楼层，用于回退保护 */
  floor: number;
  /** 人类可读标题，显示在世界书编辑器里 */
  title: string;
  /** 注入给 AI 看的正文 */
  content: string;
  /** 绿灯触发关键词 */
  keys: string[];
}

// ────────────────────────────────────────────────────────────
// 检测：对比新旧状态，派生本轮应写入的 milestone 列表
// ────────────────────────────────────────────────────────────

function detectMilestones(newData: SchemaType, _oldData: SchemaType, currentFloor: number): Milestone[] {
  const out: Milestone[] = [];

  // 2.0.32 修: 从 "old→new transition 比对" 改为 "扫描 new 当前态"。
  // 原因: 场景完成标记由 CHAT_COMPLETION_PROMPT_READY 的 Phase 1 脚本预设 +
  //      Mvu.replaceMvuData 同步写入,等到 VARIABLE_UPDATE_ENDED 触发时 oldData 已含
  //      true,transition 永远不跳变 → 2.0.31 砍到剩 2 种后等于里程碑全失效。
  // 改用 "扫当前态 + writeMilestonesToWorldbook 的 existingTypes dedupe" 兜底,
  // 不再依赖 transition 时机。

  // 特殊场景完成——每场景独立
  // floor 字段仅供内部 cleanupFutureMilestones 回退保护用, 不暴露给 AI
  const newScenes = newData._已完成特殊场景 ?? {};
  for (const sceneName of Object.keys(newScenes)) {
    if (newScenes[sceneName]) {
      const summary = SCENE_SUMMARIES[sceneName] ?? '';
      out.push({
        type: `scene_done_${sceneName}`,
        floor: currentFloor,
        title: `特殊场景·${sceneName} 已完成`,
        content: `「${sceneName}」已完成。${summary}此事件已成为游戏历史,后续相关叙事可自然 refer。`,
        keys: [sceneName], // 仅场景名作为触发词, 避免高频词常驻激活
      });
    }
  }

  // 千晶幻术 3 次施术完成——涉及称谓 canon, 老楼被 hide 后 AI 仍需靠此记住
  if (newData.苗广.千晶幻术.认知改写完成) {
    out.push({
      type: 'qianjing_complete',
      floor: currentFloor,
      title: `千晶幻术·认知改写完成`,
      content: `千晶幻术三次施术已完成。苗广记忆被永久改写: 他现在认 {{user}} 为"义父"、认云霜凝为"娘亲"、自己是"儿子"(对亲生儿子苗喧的父子关系保持不变)。私下称呼 {{user}} 为义父、云霜凝为娘。`,
      keys: ['千晶幻术', '义父', '娘亲', '认知改写'], // 用具体名词,按需激活
    });
  }

  return out;
}

// ────────────────────────────────────────────────────────────
// 写入：调酒馆原生 chat worldbook API
// ────────────────────────────────────────────────────────────

/**
 * 获取当前聊天绑定的世界书；没有则创建一本默认的
 * 失败返回 null（降级 safe）
 */
/**
 * 生成当前聊天专属的 worldbook 名字
 * 2.0.27 修: 原代码用固定名 "云霜凝-milestones",新聊天未绑定 lorebook 时,
 * getOrCreateChatWorldbook 会复用同名旧 worldbook(上次聊天留下的),
 * 导致新聊天看到的全是旧记忆。
 * 改为基于 SillyTavern.getCurrentChatId() 生成唯一名,每个聊天独立一本。
 */
function getWorldbookNameForCurrentChat(): string {
  try {
    const chatId = (globalThis as any).SillyTavern?.getCurrentChatId?.();
    if (chatId && typeof chatId === 'string') {
      return `${DEFAULT_WORLDBOOK_NAME}-${chatId}`;
    }
  } catch {}
  // fallback: 时间戳(保证唯一,但 F5 会生成新名。受 existing 分支保护,已绑定不受影响)
  return `${DEFAULT_WORLDBOOK_NAME}-${Date.now()}`;
}

async function ensureChatWorldbook(): Promise<string | null> {
  try {
    // 1. 当前聊天已绑定 chat worldbook → 直接用(保护手动绑定的玩家)
    const existing = (globalThis as any).getChatWorldbookName?.('current') as string | null | undefined;
    if (existing) return existing;
    // 2. 未绑定 → 用聊天 id 生成唯一名字,避免撞旧同名 worldbook
    const uniqueName = getWorldbookNameForCurrentChat();
    const created = await (globalThis as any).getOrCreateChatWorldbook?.('current', uniqueName);
    return typeof created === 'string' ? created : null;
  } catch (e) {
    console.warn('[云霜凝] 获取/创建聊天世界书失败:', e);
    return null;
  }
}

/**
 * 读取指定世界书中所有我们写的 milestone 条目的 type 集合，用于 dedupe
 */
async function getExistingMilestoneTypes(worldbookName: string): Promise<Set<string>> {
  try {
    const entries = await (globalThis as any).getWorldbook?.(worldbookName);
    if (!Array.isArray(entries)) return new Set();
    const types = new Set<string>();
    for (const entry of entries) {
      if (entry?.extra?.[MILESTONE_MARKER] && typeof entry?.extra?.milestone_type === 'string') {
        types.add(entry.extra.milestone_type);
      }
    }
    return types;
  } catch {
    return new Set();
  }
}

/**
 * 回退楼层保护：删掉所有 milestone_floor > currentFloor 的条目
 * 只删我们自己的条目（带 MILESTONE_MARKER），不动其他脚本/玩家写的条目
 */
async function cleanupFutureMilestones(worldbookName: string, currentFloor: number): Promise<void> {
  try {
    await (globalThis as any).deleteWorldbookEntries?.(
      worldbookName,
      (entry: any) => {
        if (!entry?.extra?.[MILESTONE_MARKER]) return false;
        const floor = typeof entry?.extra?.milestone_floor === 'number' ? entry.extra.milestone_floor : 0;
        return floor > currentFloor;
      },
      { render: 'debounced' },
    );
  } catch (e) {
    console.warn('[云霜凝] 回退清理 milestone 失败（非致命）:', e);
  }
}

/**
 * 2.0.43 重复创建修复:
 * 把并发 in-flight 集合 + 本 session 已写入集合合并成一个**持久**的模块级 set。
 * 写入后不清除, 整个 session 内同 `worldbookName:type` 只写一次。
 *
 * 根因: 原 _inFlightTypes 在 createWorldbookEntries 返回后的 finally 里 delete,
 * 但 `render: 'debounced'` 让底层 persist 延后; 玩家 reroll 触发 VARIABLE_UPDATE_ENDED 再跑一次时,
 * 读 existingTypes 可能还没读到刚写的(debounced 未 flush) → 再写一遍 → 重复。
 *
 * 新策略: 模块变量只在 iframe reload / 切聊天后清零, 正常 reroll 期间持久保留,
 * 同一 session 内杜绝重复写入。
 *
 * 按 worldbookName 分 key 防止新聊天看不到条目(新聊天 worldbookName 不同 → 新 key → 允许写)。
 */
const _writtenTypesInSession = new Set<string>();

/**
 * 把 milestone 列表转成世界书条目结构并批量写入
 */
async function writeMilestonesToWorldbook(
  worldbookName: string,
  milestones: Milestone[],
  existingTypes: Set<string>,
): Promise<void> {
  // dedupe：已存在于 worldbook + 本 session 已写入过 → 跳过
  const toWrite = milestones.filter(m => {
    const sessionKey = `${worldbookName}:${m.type}`;
    return !existingTypes.has(m.type) && !_writtenTypesInSession.has(sessionKey);
  });
  if (toWrite.length === 0) return;

  // 立即标记本 session 已写入, 后续 reroll/重触发读不到 debounced 未 flush 的 entry 也能拦下
  for (const m of toWrite) _writtenTypesInSession.add(`${worldbookName}:${m.type}`);

  const entries = toWrite.map(m => ({
    name: m.title,
    enabled: true,
    content: m.content,
    strategy: {
      type: 'selective' as const,
      keys: m.keys as (string | RegExp)[],
      keys_secondary: { logic: 'and_any' as const, keys: [] as (string | RegExp)[] },
      scan_depth: 'same_as_global' as const,
    },
    position: {
      type: 'at_depth' as const,
      role: 'system' as const,
      depth: 2,
      order: 100,
    },
    probability: 100,
    extra: {
      [MILESTONE_MARKER]: true,
      milestone_type: m.type,
      milestone_floor: m.floor,
    },
  }));

  try {
    await (globalThis as any).createWorldbookEntries?.(worldbookName, entries, { render: 'debounced' });
    console.info(`[云霜凝] milestone 已写入 ${toWrite.length} 条 → ${worldbookName}`);
  } catch (e) {
    console.warn('[云霜凝] 写入 milestone 失败（非致命）:', e);
    // 写入失败不 rollback _writtenTypesInSession — 宁可漏写一次(下次玩家触发同事件时还能写)
    // 也不要冒重复写的风险。用户可手动从世界书添加。
    for (const m of toWrite) _writtenTypesInSession.delete(`${worldbookName}:${m.type}`);
  }
}

// ────────────────────────────────────────────────────────────
// 对外：一站式入口
// ────────────────────────────────────────────────────────────

/**
 * 检测本轮 milestone 并写入聊天世界书。
 * 降级 safe：任何环节失败都只 console.warn，不抛错不影响主流程。
 *
 * 使用方式：在 VARIABLE_UPDATE_ENDED 回调末尾 fire-and-forget 调用：
 *   detectAndWriteMilestones(newData, oldData, currentFloor).catch(e => {
 *     console.warn('[云霜凝] milestone 写入失败，忽略:', e);
 *   });
 */
export async function detectAndWriteMilestones(
  newData: SchemaType,
  oldData: SchemaType,
  currentFloor: number,
): Promise<void> {
  const milestones = detectMilestones(newData, oldData, currentFloor);
  if (milestones.length === 0) return;

  const worldbookName = await ensureChatWorldbook();
  if (!worldbookName) return;

  await cleanupFutureMilestones(worldbookName, currentFloor);
  const existingTypes = await getExistingMilestoneTypes(worldbookName);
  await writeMilestonesToWorldbook(worldbookName, milestones, existingTypes);
}
