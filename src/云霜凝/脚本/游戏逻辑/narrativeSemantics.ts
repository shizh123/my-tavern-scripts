/**
 * 道具系统 v2 (2.0.20) — 数值→叙事化语义映射
 *
 * 用途：把 raw 数值转成 AI 能直接用的"身体反应程度"描述。
 * 关键：数字背后的**具体身体能做到什么、做不到什么**，不是抽象的"档位"标签。
 *
 * 设计原则（v2.1 优化 2026-04-14）：
 * - 每个档位的"此刻含义"必须包含**具体的物理表现**（敏感程度、能承受什么、会出现什么反应）
 * - 不要写抽象副词如"明显敏感"——写"指尖轻擦就会让她绷紧脊背"
 * - 偏成人小说语言，不文学化、不内省化
 * - 三维度仍保留（此刻/初见/潜力），但每维都要"可观察"
 *
 * 由 dataCardBuilder.ts 调用，组装最终 data card 注入。
 */

import type { Schema as SchemaType } from '../../schema';

// ════════════════════════════════════════════════════════════
// 工具：身体开发 5 档阈值（沿用 promptInjection.getDevLevel）
// ════════════════════════════════════════════════════════════

type DevTier = 0 | 1 | 2 | 3 | 4;
function devTier(v: number): DevTier {
  if (v >= 80) return 4;
  if (v >= 60) return 3;
  if (v >= 40) return 2;
  if (v >= 20) return 1;
  return 0;
}

// 各部位 × 各档位的"此刻含义"——必须可观察、可被 AI 直接转译为物理描写
const DEV_MEANINGS: Record<'小嘴' | '胸部' | '小屄' | '屁穴', Record<DevTier, string>> = {
  胸部: {
    0: '乳尖完全未开发——任何触碰都让她本能僵硬，乳头只在寒冷时才会硬起，被舔吮也只觉异样而非快感',
    1: '乳尖被开发过几次——已经会因触碰而硬起，但仍需较强刺激（揉捏、吮吸数十秒）才能产生明确快感',
    2: '乳尖被反复开发过数十次——指尖轻擦即起反应、乳头持续半硬，被吮吸时会不自主弓背、口中漏出气音，乳房整体已成为可独立达到高潮的器官',
    3: '乳尖高度敏感——隔着衣料的摩擦就足以让她呼吸急促，被夹/捏/拧时会立即出声，乳房单点刺激即可让她全身发软',
    4: '乳尖完全开发——衣料触碰就让她大腿夹紧，被认真玩弄数分钟即可达到"乳高潮"，乳头长期保持充血硬挺',
  },
  小嘴: {
    0: '嘴只是嘴——口交对她是完全陌生的概念，被亲吻时仅作为礼仪接受，对舌头入侵会本能闭齿',
    1: '嘴已被开发过几次——能接受较短时间的口交，但喉咙仍会因深入而强烈反呕，吞咽精液会本能抗拒',
    2: '嘴已被反复使用过——能完成完整的口交流程，部分喉深动作可承受，吞咽精液不再反呕（但仍会皱眉）',
    3: '嘴高度训练——能主动配合深喉，舌头会自动绕动取悦，被命令张口时会条件反射照做',
    4: '完全驯化的口奴嘴——主动求肉棒含入，不含东西时会感到口中空虚，吞咽精液成为某种满足',
  },
  小屄: {
    0: '前穴完全未开发——处女紧致或近乎处女状态，任何手指进入都极痛，绝无可能接纳更大物体',
    1: '前穴已被开发——可接受 1-2 指进入，能承受较温和的活塞动作，分泌爱液但仍偏少，达到高潮需较长前戏',
    2: '前穴反复开发——可接受 3 指或同尺寸器具，活塞中已有明确快感，前戏 2-3 分钟即可大量分泌爱液，可达高潮',
    3: '前穴高度敏感——稍一触碰阴蒂就湿，进入时主动收缩迎合，可承受高频抽插数十分钟，多次高潮已成常态',
    4: '前穴完全开发——肉穴肌肉条件反射式收紧，被进入瞬间即达高潮，可连续承受重操而仍有反应',
  },
  屁穴: {
    0: '后穴完全未开发——任何靠近都引起本能紧缩，从未被开发过，仅手指尝试都会因疼痛而崩溃',
    1: '后穴已被开发——可接受 1 指进入，能承受小型肛塞数分钟，疼痛大于快感，绝大多数时仍紧闭',
    2: '后穴反复开发——可接受中型肛塞长时间留置或 2 指抽插，开始有明确快感反应，肛门括约肌已能放松',
    3: '后穴高度敏感——可接受肉棒进入并承受抽插，肛门快感与前穴相当，被刺激时会主动后送',
    4: '后穴完全开发——敏感度反超前穴，被肛交时可达到深层"内高潮"，肛门长期保持微张状态',
  },
};

const TIER_LABEL: Record<DevTier, string> = {
  0: '未开发',
  1: '初步开发',
  2: '反复开发',
  3: '高度敏感',
  4: '完全开发',
};

// ════════════════════════════════════════════════════════════
// 身体开发三维度描述（此刻 / 初见 / 潜力）
// ════════════════════════════════════════════════════════════

export function describeBodyPart(
  part: '小嘴' | '胸部' | '小屄' | '屁穴',
  current: number,
  initial: number,
  potentialMax: number,
): string {
  const cur = Math.max(0, Math.min(100, current));
  const init = Math.max(0, Math.min(100, initial));
  const potMax = Math.max(cur, Math.min(100, potentialMax));

  const curTier = devTier(cur);
  const meaning = DEV_MEANINGS[part][curTier];

  const initTier = devTier(init);
  let deltaText: string;
  if (cur === init) {
    deltaText = `保持在${TIER_LABEL[curTier]}（${cur}/100），与初见同`;
  } else if (curTier === initTier) {
    deltaText = `从 ${init} 推到 ${cur}（同档内深化）`;
  } else {
    const tiers: string[] = [];
    for (let t = initTier; t <= curTier; t++) tiers.push(TIER_LABEL[t as DevTier]);
    deltaText = `从 ${init}（${TIER_LABEL[initTier]}）一路开发到 ${cur}，跨过了 ${tiers.join(' → ')}`;
  }

  const remaining = potMax - cur;
  const potTier = devTier(potMax);
  let potentialText: string;
  if (remaining <= 0) {
    potentialText = `已接近本阶段建议的叙事上限（${potMax}），进一步深化建议配合治疗阶段推进`;
  } else if (potTier === curTier) {
    potentialText = `本阶段叙事建议推到 ${potMax} 左右（仍在"${TIER_LABEL[potTier]}"档内），约还有 ${remaining} 点可写空间`;
  } else {
    potentialText = `本阶段叙事建议推到 ${potMax} 左右，约还有 ${remaining} 点可写空间，可跨进"${TIER_LABEL[potTier]}"`;
  }

  return (
    `· ${part}开发 ${cur}/100\n` +
    `  · 身体此刻能做到的: ${meaning}\n` +
    `  · 来路: ${deltaText}\n` +
    `  · 叙事建议推进度: ${potentialText}`
  );
}

// ════════════════════════════════════════════════════════════
// 罩杯
// ════════════════════════════════════════════════════════════

const CUP_MEANINGS: Record<string, string> = {
  默认: '原本的胸型——比寻常女子略丰但不显眼，俯身无明显乳沟，束在道袍内毫无存在感',
  E罩杯:
    'E 罩杯 · 比寻常修士明显丰满，俯身时已能形成清晰乳沟，跑动会带动晃动——但仍能勉强束在道袍内不至外露，重量仅在弯腰时显出来',
  G罩杯:
    'G 罩杯 · 极为丰饶，呼吸可见胸口起伏，道袍前襟已经被撑得不太合身——稍宽松的衣料会形成明显的"压不住"感，走路时双乳会自主晃动',
  H罩杯:
    'H 罩杯 · 灵乳丹的极限改造，几乎不可能完全束住——道袍前襟永远是绷紧的、低头时会看到自己的乳房先于视线一步进入眼帘，每一步都伴随沉甸甸的晃动',
};

const CUP_ORDER = ['默认', 'E罩杯', 'G罩杯', 'H罩杯'];

export function describeBodyMod(modName: string, current: unknown, initial: unknown): string {
  if (modName === '胸部' || modName === '罩杯') {
    const cur = String(current ?? '默认');
    const init = String(initial ?? '默认');
    const meaning = CUP_MEANINGS[cur] ?? cur;
    const curIdx = CUP_ORDER.indexOf(cur);
    const initIdx = CUP_ORDER.indexOf(init);
    let delta: string;
    if (cur === init) delta = '与初见同';
    else if (curIdx > initIdx) delta = `${init} → ${cur}（推进 ${curIdx - initIdx} 档）`;
    else delta = `初见 ${init}，现 ${cur}`;
    const potential =
      curIdx < CUP_ORDER.length - 1 ? `可继续改造至 ${CUP_ORDER.slice(curIdx + 1).join(' / ')}` : '已达改造上限';
    return `· 胸部罩杯: ${cur}\n  · 此刻: ${meaning}\n  · 来路: ${delta}\n  · 潜力: ${potential}`;
  }

  if (modName === '乳环') {
    const has = !!current;
    if (!has) return `· 乳环: 无\n  · 乳尖完好无外物`;
    return `· 乳环: 有\n  · 乳尖被金属环穿孔永久固定——任何衣料触碰都会被金属环放大数倍，吮吸时会牵动整个乳腺，无法摘除\n  · 来源: 曾被 {{user}} 强制施加，从抗拒到默认接受`;
  }

  if (modName === '阴环') {
    const has = !!current;
    if (!has) return `· 阴环: 无\n  · 阴蒂未被外物标记`;
    return `· 阴环: 有\n  · 阴蒂被金属环永久穿孔固定——走路、坐下、跨步都会让环扣摩擦阴蒂，每天 24 小时持续低强度刺激，无法摘除\n  · 来源: 曾被 {{user}} 施加，已成身体的一部分`;
  }

  if (modName === '淫纹') {
    const marks = current as Record<string, string>;
    const activeParts = Object.entries(marks || {}).filter(([, v]) => v && v.trim().length > 0);
    if (activeParts.length === 0) return `· 淫纹: 无\n  · 身体未被任何标记`;
    const lines = activeParts.map(([pos, text]) => `${pos}处刻有"${text}"`).join('，');
    return `· 淫纹: ${lines}\n  · 此刻: 灵力刻入皮肉的淫纹随她动作若隐若现——衣料微动就会暴露，无法清洗、无法抹去，是她身上最难掩饰的羞耻标记`;
  }

  return `· ${modName}: ${String(current)}`;
}

// ════════════════════════════════════════════════════════════
// 服装 + 暴露程度
// ════════════════════════════════════════════════════════════

const EXPOSURE_MEANINGS: Record<string, string> = {
  全覆盖: '严丝合缝——颈部以下没有一寸肌肤暴露',
  微露: '仅露颈、腕、脚踝这类日常可见处——出门毫无心理负担',
  轻露: '锁骨、小臂、小腿外侧裸露——已经是修士不太穿的打扮，走在人前会被偷瞄',
  半露: '锁骨/肩头/大腿外侧裸露，下蹲时内裤边缘可被瞥见，弯腰时胸前会松垂到几乎能看到乳晕——穿这种衣服出门就已经是某种宣言',
  大露: '近乎情趣内衣的尺度——锁骨、整片肩背、半边乳房、腰部、整段大腿全部裸露，走动时几次"差点露出"，在公共场所穿这身等同主动暴露',
  极露: '仅几片布料遮住乳头/阴部——不弯腰也几乎能看见全部，走两步就会露出，完全是为情趣而存在',
};

export function describeClothing(
  slot: '上装' | '下装' | '内衣' | '内裤' | '暴露程度',
  current: string,
  initial: string,
  potentialMaxLabel?: string,
): string {
  if (slot === '暴露程度') {
    const meaning = EXPOSURE_MEANINGS[current] ?? current;
    const deltaText = current === initial ? `保持"${current}"` : `从"${initial}"推到"${current}"`;
    const potentialText = potentialMaxLabel ? `本阶段/防线允许推到"${potentialMaxLabel}"` : '';
    let out = `· 整体暴露程度: ${current}\n  · 此刻: ${meaning}\n  · 来路: ${deltaText}`;
    if (potentialText) out += `\n  · 潜力: ${potentialText}`;
    return out;
  }
  const cur = current || '默认';
  const init = initial || '默认';
  const delta = cur === init ? '与初见一致' : `从"${init}"换到"${cur}"`;
  return `· 当前${slot}: ${cur}\n  · 来路: ${delta}`;
}

// ════════════════════════════════════════════════════════════
// 心理类：心理防线 / 信任度 / 顺从度
// ════════════════════════════════════════════════════════════

function defenseMeaning(v: number): string {
  if (v >= 75) return '防线基本完好——遇到越界行为会立即怒斥/反抗，会用语言明确拒绝，大幅度肢体抗拒，理智完全在线';
  if (v >= 50) return '防线明显松动——抗拒变成"嘴上拒绝身体不动"，越界行为会让她皱眉但不再立即反抗，理智仍在但开始拉锯';
  if (v >= 25) return '防线大面积崩——已经不会主动拒绝，被越界时只会下意识收紧但不躲避，理智知道"不该"但身体先回应了';
  return '防线几乎崩——主动迎合，被命令时会照做，"不"字几乎说不出口，理智已不再相信自己能拒绝';
}

function trustMeaning(v: number): string {
  if (v >= 75) return '高度信任——把 {{user}} 当作真正依靠，会主动倾诉，独处时能完全放松';
  if (v >= 50) return '明显信任——开始依赖，被触碰时不再警惕，会主动找 {{user}} 说话';
  if (v >= 25) return '初步松动——警惕减少，但仍保持距离，独处时会观察 {{user}} 的动作';
  return '高度警惕——视 {{user}} 为外人，被触碰时会立即僵硬，对话保持最小限度';
}

function submissionMeaning(v: number): string {
  if (v >= 75) return '深度顺从——主动迎合 {{user}} 的指令，被命令做羞耻动作时会照做，自我意识已大幅让位';
  if (v >= 50) return '明显顺从——抗拒越来越少，被命令时虽羞耻但会执行，开始主动取悦';
  if (v >= 25) return '部分顺从——对低强度命令会照做，对越界命令仍抗拒，但抗拒强度递减';
  return '基本独立——保留自我判断，不轻易服从命令，需要被"说服"才会配合';
}

export function describePsych(fieldName: '心理防线' | '信任度' | '顺从度', current: number, initial: number): string {
  const cur = Math.max(0, Math.min(100, current));
  const init = Math.max(0, Math.min(100, initial));
  const meaning =
    fieldName === '心理防线'
      ? defenseMeaning(cur)
      : fieldName === '信任度'
        ? trustMeaning(cur)
        : submissionMeaning(cur);
  const delta = cur === init ? '与初见一致' : `从 ${init} 走到 ${cur}（${cur > init ? '+' : ''}${cur - init}）`;
  return `· ${fieldName} ${cur}/100\n  · 此刻她会做的事: ${meaning}\n  · 来路: ${delta}`;
}

// ════════════════════════════════════════════════════════════
// 治疗阶段（1-10）→ 3 段语义 + 允许的开发上限
// 关键：每个阶段必须告诉 AI "这个阶段允许什么、不允许什么"
// ════════════════════════════════════════════════════════════

export function describeStage(stage: number): string {
  const s = Math.max(1, Math.min(10, Math.floor(stage)));
  let period: string;
  let tone: string;
  if (s <= 3) {
    period = '治疗早期';
    tone =
      '叙事基调建议：浅层身体接触（揉乳、亲吻、爱抚）、单指进入、不破处的道具（乳夹/眼罩等）为主。避免实际性交、深度肛交、强力 BDSM——她的心理防线还高，强推会触发打断治疗。身体反应是"初识情欲"的层次，不要写得太驾轻就熟';
  } else if (s <= 6) {
    period = '治疗中期';
    tone =
      '叙事基调建议：可以写完整性交（前穴）、中度肛交、口交至深喉、性癖植入、大部分日常道具。避免极端 BDSM、彻底的人格物化——她能承受较长高强度场面但仍守住部分人格防线，身体熟练与心理挣扎并存是这个阶段的核心张力';
  } else {
    period = '治疗深期';
    tone =
      '叙事基调建议：所有性行为、极端道具、人格改造、淫纹刻印、连续高潮、彻底的物化都已解禁。她的身体和心理都已被打开，"不行"的东西几乎不存在，重心转向她主动参与/沉溺的层次变化';
  }
  return `· 治疗阶段 第${s}阶（${period}）\n  · ${tone}`;
}

// ════════════════════════════════════════════════════════════
// 第三方视角（云→苗广，洛→苗喧）
// ════════════════════════════════════════════════════════════

function miaoguangMeaning(心态: string, 疑心值: number): string {
  const map: Record<string, string> = {
    正常: '苗广心态平稳，毫无察觉——他相信妻子在接受正经治疗，可能在隔壁打坐或外出',
    疑惑: '苗广开始留意——会时不时探头查看，对妻子的情绪变化有所察觉但还未起明确怀疑',
    察觉: '苗广已察觉不对——警惕明显提高，会突然推门、会试探性问话，再被刺激就可能爆发',
    愤怒: '苗广已彻底愤怒——坏结局边缘，再继续推进就锁死游戏',
    屈辱: '苗广已知情但被迫接受现实——处于 NTR 屈辱阶段，会以另一种方式参与（旁观、被嘲）',
    默许: '苗广已默许——不再抗拒，甚至会配合 {{user}} 的安排',
    沉溺: '苗广已沉溺于屈辱本身——从受害者转为参与者，会主动制造被绿的场景',
  };
  return `${map[心态] ?? `心态: ${心态}`}（疑心值 ${疑心值}）`;
}

function miaoxuanMeaning(心态: string, 绝望值: number, 压抑值: number): string {
  return `心态[${心态}] · 绝望值 ${绝望值} / 压抑值 ${压抑值}`;
}

export function describeThirdParty(target: '云霜凝' | '洛书晴', data: SchemaType): string {
  if (target === '云霜凝') {
    const line = miaoguangMeaning(data.苗广.心态, data.苗广.疑心值);
    return `· 旁观者·苗广（云的丈夫）: ${line}\n  · 这决定了此刻这场戏会被"怎样被见证"——他可能在门外、在隔壁、或者根本被你瞒过`;
  }
  const line = miaoxuanMeaning(data.苗喧.心态, data.苗喧.绝望值, data.苗喧.压抑值);
  return `· 旁观者·苗喧（洛的未婚夫）: ${line}\n  · 决定洛此刻的内心负担——她对未婚夫的愧疚强度由这些值决定`;
}
