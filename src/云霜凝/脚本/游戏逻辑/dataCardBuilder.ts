/**
 * 道具系统 v2 (2.0.20) — Data Card 组装器
 *
 * 把 itemDataDeps（字段声明）+ narrativeSemantics（语义映射）+ itemPhysicalSkeletons（物理骨架）
 * 拼成最终的 data card 字符串，由 promptInjection.buildBatchUseEvent 注入到 AI prompt。
 *
 * 完整格式见 memory/project_spec_道具系统v2重构.md "data card 完整格式规范" 段。
 */

import type { Schema as SchemaType } from '../../schema';
import { collectFocusFields } from './itemDataDeps';
import { getPhysicalSkeleton } from './itemPhysicalSkeletons';
import {
  describeBodyPart,
  describeBodyMod,
  describeClothing,
  describePsych,
  describeStage,
  describeThirdParty,
} from './narrativeSemantics';

export type CharTarget = '云霜凝' | '洛书晴';

// ════════════════════════════════════════════════════════════
// 角色 header（约 50-80 字 / 角色）
// ════════════════════════════════════════════════════════════

const CHARACTER_HEADERS: Record<CharTarget, string> = {
  云霜凝: `三百年修士 / 寒霜门掌门 / 地劫寒毒侵入神魂的重伤状态
性格基础: 冷傲、警惕、强大的自控力、对 {{user}} 的身份存疑`,
  洛书晴: `二十一岁圣女 / 寒霜门大弟子 / 清冷骄傲 / 苗喧的未婚妻
性格基础: 大弟子的严守礼数、对师父云霜凝的敬爱、面对变故时的坚忍`,
};

// ════════════════════════════════════════════════════════════
// Baseline (初见值)
// 玩家没有"真实初见快照"持久化存储，我们用默认初始值作为 "初见"。
// 入口 2-5 从已改造状态开局的情况下，对比会不准确——AI 会从叙事连贯性自行调整。
// ════════════════════════════════════════════════════════════

const BODY_PART_BASELINE = 0;
const DEFENSE_BASELINE = 100;
const TRUST_BASELINE_YUN = 5;
const TRUST_BASELINE_LUO = 100;
const SUBMISSION_BASELINE = 0;
const CUP_BASELINE = '默认';

// 根据治疗阶段推断"当前允许的身体开发上限"
function potentialMaxForStage(stage: number): number {
  if (stage <= 3) return 40;
  if (stage <= 6) return 70;
  return 100;
}

// ════════════════════════════════════════════════════════════
// 主入口：构建 data card
// ════════════════════════════════════════════════════════════

export function buildDataCard(items: string[], target: CharTarget, data: SchemaType): string {
  if (items.length === 0) return '';

  const focusFields = collectFocusFields(items);

  // ─── 段 1: 标题 ───
  let card = '【本轮道具使用·数据解读】\n\n';

  // ─── 段 2: 目标 header ───
  card += `【目标】${target}\n${CHARACTER_HEADERS[target]}\n\n`;

  // ─── 段 3: 当前相关状态（动态焦点：按 focusFields 输出三维度描述） ───
  card += '【当前相关状态】\n\n';

  const charData = target === '云霜凝' ? data.云霜凝 : data.洛书晴;
  const stage = target === '云霜凝' ? data.治疗.阶段 : data.洛书晴.调教阶段;
  const potMax = potentialMaxForStage(stage);
  const trustBaseline = target === '云霜凝' ? TRUST_BASELINE_YUN : TRUST_BASELINE_LUO;

  const lines: string[] = [];

  if (focusFields) {
    // 治疗/调教阶段（某些道具要求）
    if (focusFields.showStage) {
      lines.push(describeStage(stage));
    }

    // 身体开发
    for (const part of focusFields.bodyParts) {
      lines.push(describeBodyPart(part, charData.身体开发[part] ?? 0, BODY_PART_BASELINE, potMax));
    }

    // 体改
    for (const mod of focusFields.bodyMods) {
      if (mod === '胸部罩杯') {
        lines.push(describeBodyMod('胸部', charData.肉体改造.胸部, CUP_BASELINE));
      } else if (mod === '乳环') {
        lines.push(describeBodyMod('乳环', charData.肉体改造.乳环, false));
      } else if (mod === '阴环') {
        lines.push(describeBodyMod('阴环', charData.肉体改造.阴环, false));
      } else if (mod === '淫纹') {
        lines.push(describeBodyMod('淫纹', charData.肉体改造.淫纹, null));
      }
    }

    // 服装（含暴露程度）
    for (const slot of focusFields.clothingSlots) {
      const cur = (charData.服装 as any)[slot] ?? '';
      lines.push(describeClothing(slot, cur, cur /* baseline 取当前作最小对比 */));
    }

    // 心理数值
    // 洛侧 `信任度` 请求自动转译为 `顺从度`（洛书晴 schema 无信任度字段，顺从度是语义对等字段）
    const psychSeen = new Set<string>();
    for (const psych of focusFields.psych) {
      if (psych === '心理防线' && !psychSeen.has('心理防线')) {
        lines.push(describePsych('心理防线', charData.心理防线 ?? 100, DEFENSE_BASELINE));
        psychSeen.add('心理防线');
      } else if (psych === '信任度' && target === '云霜凝' && !psychSeen.has('信任度')) {
        lines.push(describePsych('信任度', (data.云霜凝 as any).信任度 ?? 0, trustBaseline));
        psychSeen.add('信任度');
      } else if (
        (psych === '顺从度' || (psych === '信任度' && target === '洛书晴')) &&
        target === '洛书晴' &&
        !psychSeen.has('顺从度')
      ) {
        lines.push(describePsych('顺从度', (data.洛书晴 as any).顺从度 ?? 0, SUBMISSION_BASELINE));
        psychSeen.add('顺从度');
      }
    }

    // 第三方视角
    if (focusFields.showThirdParty) {
      lines.push(describeThirdParty(target, data));
    }
  }

  if (lines.length === 0) {
    lines.push('（本轮道具未声明相关字段，AI 自行判断当前状态）');
  }
  card += lines.join('\n\n') + '\n\n';

  // ─── 段 4: 本轮动作 ───
  card += '【本轮动作】\n';
  items.forEach((name, i) => {
    card += `${i + 1}. ${name}\n`;
  });
  card += '\n';

  // ─── 段 5: 物理骨架 ───
  card += '【物理骨架】\n';
  for (const name of items) {
    // 淫纹刻印带位置参数 "淫纹刻印·<pos>·<text>" → 查 core "淫纹刻印"
    const coreLookup = name.startsWith('淫纹刻印·') ? '淫纹刻印' : name;
    const skel = getPhysicalSkeleton(coreLookup);
    if (skel) {
      card += `${name}: ${skel}\n`;
    }
  }
  card += '\n';

  // ─── 段 6: AI 指令（色情小说化 + 数据→物理反应映射，禁内心独白） ───
  const multiHint =
    items.length > 1 ? '\n- **多件合并**: 本轮多件道具用蒙太奇笔法串联成一段连贯叙事，不要分段写"道具1 → 道具2 → 道具3"' : '';
  card += `【AI 指令 · 必读】

**文风要求**：本轮按**成人色情小说**的笔法描写——画面优先、动作优先、感官优先。**不要写大段内心独白**。

**数据使用方式**：上方"当前相关状态" block 已经用大白话告诉你她此刻的身体能做到什么、敏感到什么程度、她会做出什么反应。**直接把那些"能做到的事"转译成可观察的物理表现**：
- 身体开发档位的描述说"乳尖被反复开发数十次，指尖轻擦即起反应" → 你写"{{user}}的指尖刚擦过，她的乳头就硬挺起来，乳房不自觉颤了一下"
- 心理防线的描述说"嘴上拒绝身体不动" → 你写"她皱了皱眉低声说不要，可身体并没有躲开"
- 罩杯描述说"道袍永远绷紧、低头先看到乳房" → 你写"她低头看着自己被乳夹夹住的部分时，丰盈的胸前先于视线一步进入眼帘"
- 治疗阶段的"允许什么不允许什么"是硬边界——**绝不能写阶段不允许的内容**（早期不能写实际性交，中期不能写极端 BDSM 等）

**画面铺陈**：
- 优先写感官细节（触觉/视觉/听觉/嗅觉）：金属冷触贴上皮肤、衣料摩擦、喘息声、汗珠、咬唇、眼神涣散、大腿夹紧等
- 描写顺序：动作 → 身体反应 → 表情 → 一两句台词或喘音
- 改造存在感（乳环/阴环/罩杯/淫纹等）通过物理触感呼应——金属被按压、环扣被牵动、丰乳因晃动而沉甸甸

**历史对比的写法**（关键）：
- 状态 block 里"来路"字段告诉你她从哪里走来 —— **把这种对比融进具体动作里，不要单独成段写"她回想起..."**
- 反例（错）：另起一段 "她想起从前那个连乳尖被触碰都会震怒的自己……"
- 正例（对）：在某个动作的迟疑里、某句喘息的中断里、某个眼神的恍惚里**让历史的重量浸透出来**——比如 "她半阖着眼挺胸送上去，这个动作她现在做得熟练，熟练得让她那点残余的羞耻感反而更刺眼"

**内心独白配额**: 全文心理描写不超过 2 句，且必须紧贴一个具体动作或感官——禁止"她想 / 她记得 / 她意识到"开头的独立段落。

**不要做的事**：
- ❌ 不要写文学化的内心剖析
- ❌ 不要复述数据里的数字（"她的胸部开发已达 55"）
- ❌ 不要写"她想起从前..."这种独立的回忆段
- ❌ 不要在场景外补"那时的她还不知道..."这种叙述者口吻${multiHint}

**目标**: 让玩家读完觉得**"哦操，刚才那个画面真的爽"**——而不是"哦，AI 写得很有文学性"。
`;

  return card;
}
