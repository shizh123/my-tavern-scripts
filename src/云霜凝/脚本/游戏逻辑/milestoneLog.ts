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
import { getHealingPhaseName } from './stateValidation';

/** 聊天世界书默认名称：新聊天没绑定时使用这个名字创建一本 */
const DEFAULT_WORLDBOOK_NAME = '云霜凝-milestones';

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

function detectMilestones(newData: SchemaType, oldData: SchemaType, currentFloor: number): Milestone[] {
  const out: Milestone[] = [];

  // 1. 治疗阶段突破
  if (newData.治疗.阶段 > oldData.治疗.阶段) {
    const phaseName = getHealingPhaseName(newData.治疗.阶段);
    out.push({
      type: `stage_up_${newData.治疗.阶段}`,
      floor: currentFloor,
      title: `第${currentFloor}楼·治疗阶段${oldData.治疗.阶段}→${newData.治疗.阶段}·${phaseName}`,
      content: `[里程碑·治疗阶段] 第${currentFloor}楼 治疗阶段 ${oldData.治疗.阶段}→${newData.治疗.阶段}·${phaseName}。当前云霜凝信任${newData.云霜凝.信任度} 防线${newData.云霜凝.心理防线} 完成度${newData.治疗.完成度}%。这是关键转折，后续描写应体现此突破带来的心理与身体状态变化。`,
      keys: ['云霜凝', '治疗', '阶段', '突破'],
    });
  }

  // 2. 苗广心态转变
  if (newData.苗广.心态 !== oldData.苗广.心态) {
    const 是后半程 = ['屈辱', '默许', '沉溺'].includes(newData.苗广.心态);
    const label = 是后半程 ? '绿帽值' : '疑心值';
    out.push({
      type: `miaoguang_mind_${newData.苗广.心态}`,
      floor: currentFloor,
      title: `第${currentFloor}楼·苗广心态 ${oldData.苗广.心态}→${newData.苗广.心态}`,
      content: `[里程碑·苗广心态] 第${currentFloor}楼 苗广心态从「${oldData.苗广.心态}」转变为「${newData.苗广.心态}」。当前${label}=${newData.苗广.疑心值}。苗广对{{user}}和云霜凝的关系态度发生本质变化，后续描写需体现此转变。`,
      keys: ['苗广', '心态', '绿帽', '疑心'],
    });
  }

  // 3. 特殊场景完成（diff 两个 record）
  const oldScenes = oldData._已完成特殊场景 ?? {};
  const newScenes = newData._已完成特殊场景 ?? {};
  for (const sceneName of Object.keys(newScenes)) {
    if (newScenes[sceneName] && !oldScenes[sceneName]) {
      out.push({
        type: `scene_done_${sceneName}`,
        floor: currentFloor,
        title: `第${currentFloor}楼·特殊场景完成·${sceneName}`,
        content: `[里程碑·特殊场景] 第${currentFloor}楼 特殊场景「${sceneName}」完成。此场景的叙事成果（云霜凝心理状态、苗广绿帽进度、洛书晴互动等）已永久刻入游戏历史，后续描写可自然 refer 到此场景曾发生。`,
        keys: ['云霜凝', sceneName, '特殊场景'],
      });
    }
  }

  // 4. 千晶幻术 3 次施术完成
  if (newData.苗广.千晶幻术.认知改写完成 && !oldData.苗广.千晶幻术.认知改写完成) {
    out.push({
      type: 'qianjing_complete',
      floor: currentFloor,
      title: `第${currentFloor}楼·千晶幻术最终封印完成`,
      content: `[里程碑·千晶幻术] 第${currentFloor}楼 千晶幻术三次施术全部完成，苗广认知永久改写：认{{user}}为"义父"、认云霜凝为"娘亲"、自己是"儿子"（对亲生儿子苗喧的父子关系保持不变）。此后苗广私下称呼{{user}}为义父、云霜凝为娘。`,
      keys: ['苗广', '千晶', '义父', '娘亲', '认知改写'],
    });
  }

  // 5. 洛书晴线激活
  if (newData._洛书晴线已激活 && !oldData._洛书晴线已激活) {
    out.push({
      type: 'luo_activated',
      floor: currentFloor,
      title: `第${currentFloor}楼·洛书晴线激活`,
      content: `[里程碑·洛书晴] 第${currentFloor}楼 洛书晴线正式激活。洛书晴不再假装不识{{user}}，开始以云霜凝大弟子身份参与联动场景（婆媳教导/两人同侍等）。苗喧反抗剧情、苗喧观看框架、双重改嫁等后续剧情均以此为起点。`,
      keys: ['洛书晴', '师姐', '天骄'],
    });
  }

  // 6. 坏结局触发
  if (newData._坏结局已触发 && !oldData._坏结局已触发) {
    out.push({
      type: 'bad_ending',
      floor: currentFloor,
      title: `第${currentFloor}楼·坏结局触发`,
      content: `[里程碑·坏结局] 第${currentFloor}楼 坏结局触发：苗广发现{{user}}和云霜凝之间超出治疗范畴的关系，愤怒不可逆。{{user}}被逐出寒霜门，治疗终止，云霜凝被带走。游戏数值已冻结，此后仅余残局氛围描写。`,
      keys: ['坏结局', '苗广', '愤怒'],
    });
  }

  // 7. 神魂空间首次进入
  if (newData._神魂空间已进入过 && !oldData._神魂空间已进入过) {
    out.push({
      type: 'soul_space_first',
      floor: currentFloor,
      title: `第${currentFloor}楼·首次进入神魂空间`,
      content: `[里程碑·神魂空间] 第${currentFloor}楼 {{user}}第一次进入云霜凝的神魂空间。神魂空间是云霜凝识海深处的秘境，苗广无法感知。{{user}}在此可以与云霜凝进行现实中不可能的亲密互动。`,
      keys: ['神魂空间', '识海'],
    });
  }

  // 8. 苗广打断治疗（新触发的冻结）
  const oldFreeze = oldData._打断冻结至楼层 ?? 0;
  const newFreeze = newData._打断冻结至楼层 ?? 0;
  if (newFreeze > oldFreeze && newFreeze > currentFloor) {
    out.push({
      type: `interruption_floor_${currentFloor}`,
      floor: currentFloor,
      title: `第${currentFloor}楼·苗广打断治疗`,
      content: `[里程碑·打断] 第${currentFloor}楼 苗广打断了一次治疗互动。当前苗广心态=${newData.苗广.心态}。此事件标记{{user}}在治疗过程中被直接发现过一次，应影响后续苗广对{{user}}的态度与警戒度。`,
      keys: ['苗广', '打断', '治疗'],
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
async function ensureChatWorldbook(): Promise<string | null> {
  try {
    const existing = (globalThis as any).getChatWorldbookName?.('current') as string | null | undefined;
    if (existing) return existing;
    const created = await (globalThis as any).getOrCreateChatWorldbook?.('current', DEFAULT_WORLDBOOK_NAME);
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
 * 把 milestone 列表转成世界书条目结构并批量写入
 */
async function writeMilestonesToWorldbook(
  worldbookName: string,
  milestones: Milestone[],
  existingTypes: Set<string>,
): Promise<void> {
  // dedupe：已存在的 type 跳过
  const toWrite = milestones.filter(m => !existingTypes.has(m.type));
  if (toWrite.length === 0) return;

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
