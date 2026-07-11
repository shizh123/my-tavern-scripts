<template>
  <div class="char-panel">
    <div class="col">
    <!-- 阶段 · 情绪 -->
    <section class="hero">
      <div class="hero-top">
        <div class="stage">
          <span class="stage-no">{{ char?.当前阶段 ?? 1 }}</span>
          <div class="stage-meta">
            <b class="stage-title">{{ char?.阶段标题 ?? '抵抗' }}</b>
            <small>第{{ char?.当前阶段 ?? 1 }}阶段 · {{ isPresent ? '在场' : '不在场' }}</small>
          </div>
          <!-- v0.37 手动晋阶：堕落度越过门槛后由玩家确认，下一轮 AI 演绎这次转变 -->
          <button
            v-if="canPromote"
            class="promote"
            title="堕落度已越过下一阶段的门槛——点击晋阶，下一轮演绎她跨过这道心理门槛"
            @click="promoteUi"
          >
            晋阶 ▲
          </button>
        </div>
        <span :class="['emotion', { vuln: isVulnerable }]" :title="char?.当前情绪 ?? '平静'">{{
          char?.当前情绪 ?? '平静'
        }}</span>
      </div>

      <div class="bars">
        <div class="bar">
          <span class="bl">堕落</span>
          <div class="track"><i class="fill f-corrupt" :style="{ width: (char?.堕落度 ?? 0) + '%' }"></i></div>
          <span class="bv">{{ char?.堕落度 ?? 0 }}</span>
        </div>
        <div class="bar">
          <span class="bl">{{ name === '秦璐' ? '儿子' : '弟弟' }}</span>
          <div class="track">
            <i class="fill f-user" :style="{ width: Math.max(0, char?.对主角依存度 ?? 0) + '%' }"></i>
          </div>
          <span class="bv">{{ char?.对主角依存度 ?? 0 }}</span>
        </div>
        <div class="bar">
          <span class="bl">{{ name === '秦璐' ? '丈夫' : '爸爸' }}</span>
          <div class="track">
            <i class="fill f-suwen" :style="{ width: Math.max(0, char?.对苏文依存度 ?? 0) + '%' }"></i>
          </div>
          <span class="bv">{{ char?.对苏文依存度 ?? 0 }}</span>
        </div>
      </div>

      <div v-if="isVulnerable" class="vuln-banner"><i>⚡</i> 心防松动 · 此刻可植入越级念头</div>

      <blockquote v-if="char?.当前心理想法" class="inner-voice">{{ char.当前心理想法 }}</blockquote>
      <div v-if="char?.气质描述" class="aura">— {{ char.气质描述 }}</div>
    </section>

    <!-- 念头植入（培育槽制） -->
    <section class="implant">
      <div class="implant-head">
        <span class="ttl">念头植入</span>
        <span class="target">→ {{ name }}</span>
        <span class="quota" :title="`培育槽 ${slotsUsed}/${slotLimit}（判定中+培育中占槽）`">
          <span class="quota-label">培育槽</span>
          <i v-for="n in slotLimit" :key="n" :class="{ used: n <= slotsUsed }"></i>
        </span>
      </div>
      <div class="implant-row">
        <input
          v-model="thoughtContent"
          type="text"
          :maxlength="maxLen"
          :placeholder="`简短念头（${maxLen}字内）…`"
          @keyup.enter="implantThought"
        />
        <span :class="['count', { max: thoughtContent.length >= maxLen }]"
          >{{ thoughtContent.length }}/{{ maxLen }}</span
        >
        <button class="go" :disabled="!thoughtContent.trim()" @click="implantThought">植入</button>
      </div>
      <p v-if="implantMsg" :class="['msg', implantMsgType]">{{ implantMsg }}</p>
    </section>

    <!-- 苏文（重要配角：状态 + 心理活动 + 对本页角色的疑心） -->
    <section class="card">
      <h3>
        苏文 <span :class="['chip', suwenStatusClass]">{{ suwenStatusDisplay }}</span>
      </h3>
      <div class="sw-meta">
        <span>📍 {{ suwenPos }}</span>
        <span class="sw-emo" :title="suwen?.当前情绪 ?? '平静'">{{ suwen?.当前情绪 ?? '平静' }}</span>
      </div>
      <blockquote v-if="suwen?.当前心理想法" class="inner-voice sw-voice">{{ suwen.当前心理想法 }}</blockquote>
      <div class="bar">
        <span class="bl">疑心</span>
        <div class="track">
          <i :class="['fill', suspicion > 70 ? 'f-danger' : 'f-warn']" :style="{ width: suspicion + '%' }"></i>
        </div>
        <span class="bv">{{ suspicion }}</span>
      </div>
      <p v-if="isAccelerating" class="note warn">⚡ 苏文在附近 · 念头加速中</p>
      <p v-else-if="suwenSafeReason" class="note safe">✓ {{ suwenSafeReason }}</p>
      <p v-if="freezeUntil > 0" class="note freeze">❄ 对{{ name }}的疑心冻结中（至 {{ freezeUntil }} 楼）</p>
      <button v-if="povReady" class="pov-btn" @click="enterSuwenPov">👁 苏文视角</button>
      <p v-else-if="povRunning" class="note pov-running">👁 苏文视角进行中 · 共{{ pov?.总楼数 ?? 3 }}幕（主线已暂停）</p>
    </section>
    </div>

    <div class="col">
    <!-- 念头 -->
    <section class="card">
      <h3>念头 <em>{{ thoughtList.length }}</em></h3>
      <p v-if="thoughtList.length === 0" class="empty">尚无念头，去种下第一颗种子</p>
      <div v-for="t in thoughtList" :key="t.id" class="thought">
        <div class="t-head">
          <span :class="['state', thoughtStatusClass(t.状态)]">{{ t.状态 }}</span>
          <span class="t-type">{{ t.类型 }}</span>
          <span v-if="t.难度 && t.难度 !== '待定'" class="t-diff">{{ t.难度 }}</span>
          <button v-if="t.状态 !== '已成熟'" class="ghost t-discard" title="退回（腾出培育槽，无补偿）" @click="discardThought(t.id)">
            退回
          </button>
        </div>
        <div class="t-body">{{ t.内容 }}</div>
        <div v-if="t.状态 === '培育中'" class="t-prog">
          <div class="track"><i class="fill f-grow" :style="{ width: thoughtProgressPercent(t) + '%' }"></i></div>
          <span class="pv">{{ Math.floor(t.开发进度) }}/{{ t.需要楼数 }}</span>
          <span class="t-rate" :title="rateTitle(t)">+{{ thoughtRate(t) }}/楼</span>
        </div>
        <div v-if="t.状态 === '未达标'" class="t-reject">
          <span v-if="crackLeft > 0">她的心防上有一道裂缝（剩{{ crackLeft }}楼）——趁现在</span>
          <!-- v0.37：显示退回原因（此前只有一句"接受不了"，玩家不知道差多少） -->
          <span v-else :title="`越级手段（松动/裂缝/药物/越级钥匙）合计最多把有效阶段抬高 2 级`">{{
            rejectReason(t)
          }}</span>
          <button
            v-if="!sysBadEnd && crackLeft > 0"
            class="ghost retry"
            title="趁心防裂缝再植（有效阶段+1）——若差距仍大，可再叠药物/越级钥匙"
            @click="retryImplantUi(t.id)"
          >
            趁隙再植
          </button>
          <button
            v-if="!sysBadEnd"
            class="ghost force"
            :title="forceCount >= 2 ? '再强行一次，她会碎的' : '她挡不住你——但她的心智会排异，也会被砸出裂缝'"
            @click="forceImplantUi(t.id)"
          >
            {{ forceCount > 0 ? `强行植入 ⚠${forceCount}/3` : '强行植入' }}
          </button>
        </div>
      </div>
    </section>

    <!-- 习惯 -->
    <section class="card">
      <h3>
        习惯 <em>{{ habitList.length }}/5</em>
        <em v-if="engraveQuota > 0" class="quota" title="网店「刻印香炉」购得，用于把习惯固定为刻印习性">📌 名额 ×{{ engraveQuota }}</em>
      </h3>
      <!-- 刻印习性（v0.33）：不占上限、权重加强、不可逆 -->
      <div v-if="engravedList.length > 0" class="engraved-box">
        <div class="eg-title">✦ 刻印习性 {{ engravedList.length }}/{{ ENGRAVE_MAX_PER_CHAR }} · 已成为她的本能</div>
        <div v-for="(h, i) in engravedList" :key="'e' + i" class="habit engraved">
          <span class="h-text">{{ h.内容 }}</span>
        </div>
      </div>
      <p v-if="habitList.length === 0" class="empty">暂无习惯</p>
      <div v-for="(h, i) in habitList" :key="i" class="habit">
        <span class="h-text">{{ h.内容 }}</span>
        <button
          v-if="engraveQuota > 0 && engravedList.length < ENGRAVE_MAX_PER_CHAR"
          class="ghost pin"
          title="消耗 1 刻印名额：固定为刻印习性——不占习惯栏、表现权重加强、不可逆"
          @click="pinHabit(i)"
        >
          📌 刻印
        </button>
        <button v-if="habitList.length >= 5" class="ghost gold" @click="sellHabit(i)">出售 +{{ HABIT_SELL_PRICE }}</button>
      </div>
      <p v-if="habitList.length >= 5" class="note warn">习惯已满，出售或刻印腾位后可接纳新习惯</p>
    </section>

    <!-- 仪容 -->
    <section class="card">
      <h3>仪容</h3>
      <div :class="['stars', { full: outfitStars.full }]" @click="starTap">
        <span
          v-for="(lit, i) in outfitStars.lit"
          :key="i"
          :class="['star', { lit }]"
          :title="OUTFIT_STAR_SLOTS[i]"
          >★</span
        >
        <span class="star-note">{{ starNote }}</span>
      </div>
      <div class="tags">
        <span class="tag">{{ char?.服装细节?.整体风格 ?? '居家贤妻' }}</span>
        <span class="tag line">{{ char?.服装细节?.暴露程度 ?? '正常' }}</span>
        <span class="tag line">{{ char?.妆容细节?.浓淡程度 ?? '淡妆' }}</span>
      </div>
      <div v-if="bodyModNames.length > 0" class="equipped-row">
        <span class="eq-label">改造</span>
        <span v-for="n in bodyModNames" :key="n" class="tag eq">{{ n }}</span>
      </div>
      <!-- v0.33补：图标网格（原单列 dl 右侧大片空白）——自适应 1~2 列，长值省略号+title -->
      <div class="attire">
        <div v-for="a in attireEntries" :key="a.label" class="a-cell" :title="a.label + '：' + a.val">
          <span class="a-ic">{{ a.ic }}</span>
          <div class="a-tx">
            <small>{{ a.label }}</small>
            <b>{{ a.val }}</b>
          </div>
        </div>
      </div>
    </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getStageByCorruption, getStageTitle } from '../../../stageConfig';
import {
  ENGRAVE_MAX_PER_CHAR,
  ITEM_MAP,
  OUTFIT_STAR_SLOTS,
  ROUTE_FULLSTAR,
  getCultivationSlots,
  getEquipBoost,
  getOutfitStars,
  getThoughtMaxLen,
  promoteStage,
} from '../../../脚本/游戏逻辑/shopSystem';
import { isSuwenInAccelerationRoom } from '../../../脚本/游戏逻辑/suwenRoutine';
import { CATEGORY_STAGE, HABIT_SELL_PRICE, countActiveThoughts, forceImplant, retryImplant } from '../../../脚本/游戏逻辑/thoughtEngine';
import { useDataStore } from '../store';

const props = defineProps<{ name: '秦璐' | '苏梦' }>();

const VULNERABLE_EMOTION = '心防松动';

const store = useDataStore();
const data = computed(() => store.data);
const charKey = computed(() => `${props.name}状态` as '秦璐状态' | '苏梦状态');
const char = computed(() => data.value?.[charKey.value] ?? null);

const isPresent = computed(() => data.value?.系统?.在场角色?.[props.name] ?? (props.name === '秦璐'));
const isVulnerable = computed(() => char.value?.当前情绪 === VULNERABLE_EMOTION);

// ━━━ 手动晋阶（v0.37）：堕落度越过下一阶段门槛 → 亮按钮，玩家确认才升 ━━━
const canPromote = computed(() => {
  const c = char.value;
  if (!c || data.value?.系统?._坏结局) return false;
  return getStageByCorruption(c.堕落度 ?? 0) > (c.当前阶段 ?? 1);
});
async function promoteUi() {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d) return;
    const err = promoteStage(d, charKey.value);
    if (err) {
      showMsg(err, 'warn');
      return;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`${props.name}进入第${d[charKey.value].当前阶段}阶段「${d[charKey.value].阶段标题}」——下一轮她会呈现这次转变`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 晋阶失败', e);
  }
}

/** 未达标退回原因（v0.37）：点名类型的推荐阶段，玩家能算出差距 */
function rejectReason(t: any): string {
  const need = t.类型 && t.类型 !== '待判定' ? (CATEGORY_STAGE as any)[t.类型] : undefined;
  if (!need) return '她还接受不了，需先推进关系';
  return `她还接受不了——「${t.类型}」通常要到第${need}阶段（当前第${char.value?.当前阶段 ?? 1}阶段）`;
}

const thoughtContent = ref('');
const implantMsg = ref('');
const implantMsgType = ref<'success' | 'error' | 'warn'>('error');

const maxLen = computed(() => (data.value ? getThoughtMaxLen(data.value as any) : 10));
const slotLimit = computed(() => (data.value ? getCultivationSlots(data.value as any) : 3));
const slotsUsed = computed(() => (data.value ? countActiveThoughts(data.value as any, charKey.value) : 0));

/** 仪容可选行："无"/空值不占行（装备写回变量后自然浮现） */
function shown(v?: string): boolean {
  return !!v && v !== '无';
}

/** 仪容明细（v0.33 补：图标网格布局）——固定五件常显，可选项非"无"才入列 */
const attireEntries = computed(() => {
  const c = char.value;
  const entries: Array<{ ic: string; label: string; val: string }> = [
    { ic: '👚', label: '上装', val: c?.服装细节?.上装 ?? '—' },
    { ic: '👗', label: '下装', val: c?.服装细节?.下装 ?? '—' },
    { ic: '👙', label: '内衣', val: c?.服装细节?.内衣?.上 ?? '—' },
    { ic: '🩲', label: '内裤', val: c?.服装细节?.内衣?.下 ?? '—' },
    { ic: '🧦', label: '袜', val: c?.服装细节?.袜裤 ?? '—' },
    { ic: '👠', label: '鞋', val: c?.服装细节?.鞋子 ?? '—' },
  ];
  const optional: Array<[string, string, string | undefined]> = [
    ['💍', '配饰', c?.服装细节?.配饰],
    ['⛓️', '装饰', c?.服装细节?.特殊装饰],
    ['💄', '唇妆', c?.妆容细节?.唇妆],
    ['👁️', '眼妆', c?.妆容细节?.眼妆],
    ['✨', '妆饰', c?.妆容细节?.特殊妆容],
    ['🌸', '香氛', c?.妆容细节?.香氛],
  ];
  for (const [ic, label, v] of optional) {
    if (shown(v)) entries.push({ ic, label, val: v! });
  }
  return entries;
});

/** 仪容星标（v0.35 路线制）：5 槽 + 体改 = 6 星，全同路线才亮；满星显示路线名 */
const outfitStars = computed(() =>
  data.value
    ? getOutfitStars(data.value as any, charKey.value)
    : { lit: [false, false, false, false, false, false], count: 0, full: false, route: null as any },
);
const debugFullStar = computed(() => data.value?.系统?._调试满星 ?? false);

// 星标区文案：满星才亮出路线（路线是隐藏机制，不满星只给 n/6 让玩家自己研究）
const starNote = computed(() => {
  if (debugFullStar.value) return '⚙ 调试满星 · 培育+1/楼 · 疑心+1/楼';
  const s = outfitStars.value;
  if (s.full && s.route) {
    const r = ROUTE_FULLSTAR[s.route as keyof typeof ROUTE_FULLSTAR];
    return `路线共鸣「${r.图标}${s.route}」· ${r.效果简述}`;
  }
  return `${s.count}/6`;
});

// 测试后门：星标区 2.5s 内连点 5 次切换"调试满星"（模拟满星：培育+1/楼、疑心+1/楼）
//   v0.28：窗口 1.5s→2.5s，配合 CSS touch-action:manipulation，兼顾移动端快速连点
let starTapCount = 0;
let starTapTimer: ReturnType<typeof setTimeout> | null = null;
async function starTap() {
  starTapCount++;
  if (starTapTimer) clearTimeout(starTapTimer);
  starTapTimer = setTimeout(() => (starTapCount = 0), 2500);
  if (starTapCount < 5) return;
  starTapCount = 0;
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) return;
    d.系统._调试满星 = !d.系统._调试满星;
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`调试满星已${d.系统._调试满星 ? '开启' : '关闭'}`, 'warn');
  } catch (e) {
    console.error('[秦璐重置版] 调试满星切换失败', e);
  }
}

/** 已完成的体改（永久，显示在仪容卡） */
const bodyModNames = computed(() => {
  const eq = data.value?.[charKey.value]?.装备状态 ?? {};
  return Object.keys(eq).filter(n => ITEM_MAP[n]?.分类 === '体改');
});

// ━━━ 苏文卡（对本页角色视角） ━━━
const suwen = computed(() => data.value?.苏文状态 ?? null);
const suwenPos = computed(() => suwen.value?.当前位置 ?? '客厅');
const suwenStatusDisplay = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '外出工作' : s === '睡眠' ? '睡眠中' : '在家';
});
const suwenStatusClass = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? 'away' : s === '睡眠' ? 'sleeping' : 'home';
});
const suwenSafeReason = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '苏文外出，可安心进行' : s === '睡眠' ? '苏文熟睡，相对安全' : '';
});
const isAccelerating = computed(() => {
  const p = suwen.value?.当前位置;
  return p === '餐厅' || p === '客厅' || p === '主卧';
});
const suspicion = computed(() =>
  Math.round(props.name === '秦璐' ? suwen.value?.对秦璐疑心值 ?? 0 : suwen.value?.对苏梦疑心值 ?? 0),
);
const freezeUntil = computed(() => {
  const f = props.name === '秦璐' ? suwen.value?.对秦璐疑心值冻结 : suwen.value?.对苏梦疑心值冻结;
  const floor = SillyTavern.chat?.length ?? 0;
  return f?.是否冻结 && floor < f.冻结结束楼层 ? f.冻结结束楼层 : 0;
});

// ━━━ 苏文视角（v0.23）：打断后点亮按钮，点击进入 3 幕插叙 POV ━━━
const pov = computed(() => data.value?.系统?._苏文视角 ?? null);
const povReady = computed(() => !!pov.value?.待看 && pov.value?.目标 === props.name && !data.value?.系统?._坏结局);
const povRunning = computed(() => (pov.value?.剩余楼 ?? 0) > 0 && pov.value?.目标 === props.name);

async function enterSuwenPov() {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    const p = d?.系统?._苏文视角;
    if (!p?.待看) return;
    p.待看 = false;
    p.剩余楼 = p.总楼数 ?? 3;
    p.上次处理楼层 = -1;
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`已切入苏文视角（共${p.剩余楼}幕）——第一幕开始`, 'success');
    // 立即触发第一幕（对标云霜凝 退出神魂空间：写完状态直接 /send + /trigger，
    // 不再让玩家手动发消息；PROMPT_READY 检测到 剩余楼>0 即注入 POV 指引）
    await triggerSlash('/send （进入苏文视角）|/trigger');
  } catch (e) {
    console.error('[秦璐重置版] 进入苏文视角失败', e);
  }
}

const thoughtList = computed(() => {
  const thoughts = data.value?.[charKey.value]?.念头列表 ?? {};
  return Object.entries(thoughts).map(([id, t]) => ({ id, ...(t as any) }));
});
const habitList = computed(() => char.value?.习惯列表 ?? []);
const engravedList = computed(() => char.value?.刻印习性列表 ?? []);
const engraveQuota = computed(() => data.value?.系统?._刻印名额 ?? 0);

// 加速来源明细（v0.33 A）：与 tickThoughtProgress 同公式的"当前每楼进度"预览
// （相关度是 AI 每轮现判的，只在 title 里注明"剧情相关另 +1~2"）
function thoughtRateParts(t: any): { total: number; parts: string[] } {
  const parts: string[] = ['保底 1'];
  let total = 1;
  if (data.value && isSuwenInAccelerationRoom(data.value.系统?._苏文作息游标 ?? 0)) {
    total += 0.5;
    parts.push('加速房 +0.5');
  }
  if (data.value && t.类型 && t.类型 !== '待判定') {
    const eb = getEquipBoost(data.value as any, charKey.value, t.类型);
    if (eb > 0) {
      total += eb;
      parts.push(`装备定向 +${eb}`);
    }
  }
  const stars = outfitStars.value;
  if (stars.full) {
    if (stars.route) {
      // 路线满星（v0.35）：只喂本路线类型
      const r = ROUTE_FULLSTAR[stars.route as keyof typeof ROUTE_FULLSTAR];
      if (t.类型 && t.类型 !== '待判定' && r.培育类型.includes(t.类型)) {
        total += r.培育加成;
        parts.push(`路线共鸣 +${r.培育加成}`);
      }
    } else {
      total += 1;
      parts.push('满星共鸣 +1');
    }
  }
  return { total, parts };
}
function thoughtRate(t: any): number {
  return thoughtRateParts(t).total;
}
function rateTitle(t: any): string {
  return `${thoughtRateParts(t).parts.join(' · ')}；剧情与念头相关时 AI 另判 +1~2`;
}

function thoughtStatusClass(s: string) {
  if (s === '培育中') return 'growing';
  if (s === '判定中') return 'pending';
  if (s === '未达标') return 'rejected';
  if (s === '已成熟') return 'mature';
  if (s === '已过期') return 'expired';
  return '';
}
function thoughtProgressPercent(t: any) {
  return Math.min(100, ((t.开发进度 ?? 0) / (t.需要楼数 || 1)) * 100);
}
function showMsg(msg: string, type: 'success' | 'error' | 'warn') {
  implantMsg.value = msg;
  implantMsgType.value = type;
  setTimeout(() => (implantMsg.value = ''), 3000);
}

async function implantThought() {
  const content = thoughtContent.value.trim();
  if (!content) return;
  try {
    const key = charKey.value;
    // 植入总是写到"最新楼"（AI 未来会基于最新变量判定），不写到当前浏览的旧楼
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d || !d[key]) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复后再植入', 'warn');
      return;
    }
    if (d.系统?._坏结局) {
      showMsg('坏结局已锁定，游戏系统全部停止', 'error');
      return;
    }
    // 培育槽限制：判定中+培育中 ≤ 槽上限（基础3，植入扩容+1）
    const slots = getCultivationSlots(d);
    const used = countActiveThoughts(d, key);
    if (used >= slots) {
      showMsg(`${props.name}的培育槽已满（${slots}），等念头成熟或退回腾槽`, 'warn');
      return;
    }
    const id = `念头_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (!d[key].念头列表) d[key].念头列表 = {};
    d[key].念头列表[id] = {
      内容: content,
      类型: '待判定',
      状态: '判定中',
      难度: '待定',
      需要楼数: 0,
      开发进度: 0,
      植入楼层: SillyTavern.chat?.length ?? 0,
    };
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    thoughtContent.value = '';
    showMsg(`已植入（培育槽 ${used + 1}/${slots}）：${content}`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 植入失败', e);
    showMsg('植入失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

// ━━━ 三振（v0.24）：强行植入被退回的念头——诱惑入口，惩罚亮牌 ━━━
const sysBadEnd = computed(() => data.value?.系统?._坏结局 ?? '');
const forceCount = computed(() => data.value?.[charKey.value]?._强植三振 ?? 0);
// 裂纹窗口（v0.25）：强植弹回后 3 楼内有效阶段+1，未达标念头可趁隙再植
const crackLeft = computed(() => {
  const until = data.value?.[charKey.value]?._裂纹至楼层 ?? -1;
  if (until < 0) return 0;
  return Math.max(0, until - (SillyTavern.chat?.length ?? 0));
});

async function retryImplantUi(id: string) {
  try {
    const key = charKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.[key]) return;
    const err = retryImplant(d, key, id, SillyTavern.chat?.length ?? 0);
    if (err) {
      showMsg(err, 'warn');
      return;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg('趁隙再植成功——念头已进入培育（三振计数清零）', 'success');
  } catch (e) {
    console.error('[秦璐重置版] 趁隙再植失败', e);
  }
}

async function forceImplantUi(id: string) {
  try {
    const key = charKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.[key]) return;
    const r = forceImplant(d, key, id);
    if (r.error) {
      showMsg(r.error, 'warn');
      return;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    if (r.bad) {
      showMsg('☠ 三振——她的心智崩溃了，坏结局锁定', 'error');
    } else if (r.count === 2) {
      showMsg('⚠ 强行压入（连续 2/3）——她的眼神出现了裂纹，再一次将是崩溃', 'error');
    } else {
      showMsg('强行压入了——下一轮她会剧烈排异（连续 1/3）', 'warn');
    }
  } catch (e) {
    console.error('[秦璐重置版] 强行植入失败', e);
  }
}

async function discardThought(id: string) {
  try {
    const key = charKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    const t = d?.[key]?.念头列表?.[id];
    if (!t || t.状态 === '已成熟') return;
    delete d[key].念头列表[id];
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg('已退回，培育槽腾出一格', 'success');
  } catch (e) {
    console.error('[秦璐重置版] 退回失败', e);
  }
}

/** 腾位后补转入（变卖/刻印共用）：把标记"已成熟"的待转念头按植入楼层补转入习惯 + 阶段校正 */
function backfillMatureThoughts(d: any, key: string): void {
  const pending = Object.entries(d[key].念头列表)
    .filter(([, t]: any) => t.状态 === '已成熟')
    .sort((a: any, b: any) => a[1].植入楼层 - b[1].植入楼层);
  for (const [pid, pt] of pending as any) {
    if (d[key].习惯列表.length >= 5) break;
    const isHard = pt.难度 === '困难';
    d[key].习惯列表.push({ 内容: pt.内容, 形成楼层: SillyTavern.chat?.length ?? 0 });
    d[key].堕落度 += isHard ? 8 : 6;
    d[key].对主角依存度 += isHard ? 4 : 3;
    const dep = d[key].对主角依存度;
    let sd = -2;
    if (dep >= 80) sd = -5;
    else if (dep >= 60) sd = -4;
    else if (dep >= 30) sd = -3;
    if (isHard) sd = Math.floor(sd * 1.2);
    d[key].对苏文依存度 += sd;
    delete d[key].念头列表[pid];
    console.info(`[习惯腾位补转] ${key} ${pid} 补转入习惯`);
  }
  // v0.37 手动晋阶：补转后达标只记待晋（"可晋阶"按钮会亮），不再自动跳阶
  if (getStageByCorruption(d[key].堕落度) > d[key].当前阶段) {
    console.info(`[习惯腾位补转] ${key} 堕落度已越过下一阶段门槛（待玩家晋阶）`);
  }
}

async function sellHabit(index: number) {
  try {
    const key = charKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (d.系统?._坏结局) {
      showMsg('坏结局已锁定，游戏系统全部停止', 'error');
      return;
    }
    if (d[key].习惯列表.length < 5) {
      showMsg('习惯未满5，不可出售', 'warn');
      return;
    }
    d[key].习惯列表.splice(index, 1);
    d.系统.货币 += HABIT_SELL_PRICE;
    backfillMatureThoughts(d, key);
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`变卖习惯 +${HABIT_SELL_PRICE}货币`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 变卖失败', e);
  }
}

/** 刻印（v0.33）：消耗1名额把习惯固定为刻印习性——不占5条上限、权重加强、不可逆 */
async function pinHabit(index: number) {
  try {
    const key = charKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (d.系统?._坏结局) {
      showMsg('坏结局已锁定，游戏系统全部停止', 'error');
      return;
    }
    if ((d.系统._刻印名额 ?? 0) < 1) {
      showMsg('没有刻印名额——网店·特权页购买「刻印香炉」', 'warn');
      return;
    }
    if (!d[key].刻印习性列表) d[key].刻印习性列表 = []; // 老存档守卫
    if (d[key].刻印习性列表.length >= ENGRAVE_MAX_PER_CHAR) {
      showMsg(`她的刻印已满（每角色最多 ${ENGRAVE_MAX_PER_CHAR} 条）`, 'warn');
      return;
    }
    const [habit] = d[key].习惯列表.splice(index, 1);
    if (!habit) {
      showMsg('习惯不存在', 'error');
      return;
    }
    d[key].刻印习性列表.push(habit);
    d.系统._刻印名额 -= 1;
    backfillMatureThoughts(d, key); // 刻印同样腾出习惯位
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`「${habit.内容}」已刻进她的本能`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 刻印失败', e);
  }
}
</script>

<style scoped lang="scss">
$vuln: #ff6b9d;
$safe: #79c48a;
$warn: #e8a94f;
$danger: #e06868;
$info: #6fb9dc;
$serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;

// 移动端单列；宽屏两列并排（左：状态+植入，右：念头/习惯/仪容），压缩整体高度
.char-panel {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}
@media (min-width: 560px) {
  .char-panel {
    display: grid;
    grid-template-columns: 1.02fr 0.98fr;
    align-items: start;
  }
}

// ━━━ hero ━━━
.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: linear-gradient(160deg, var(--panel), rgba(0, 0, 0, 0.25));
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.stage {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
/* v0.37 手动晋阶按钮：金色呼吸提示"门槛已到" */
.promote {
  flex: none;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 200, 87, 0.6);
  background: linear-gradient(90deg, rgba(255, 200, 87, 0.2), rgba(255, 200, 87, 0.05));
  color: #ffc857;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
  animation: promote-pulse 2.2s ease-in-out infinite;
}
@keyframes promote-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 200, 87, 0);
  }
  50% {
    box-shadow: 0 0 10px 1px rgba(255, 200, 87, 0.35);
  }
}
.stage-no {
  flex: none;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--acc) 65%, transparent);
  color: var(--acc);
  font-size: 19px;
  font-weight: 800;
  font-family: $serif;
  background: radial-gradient(circle, color-mix(in srgb, var(--acc) 12%, transparent), transparent 70%);
  text-shadow: 0 0 12px var(--glow);
  box-shadow: 0 0 14px color-mix(in srgb, var(--acc) 15%, transparent);
}
.stage-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;

  .stage-title {
    font-family: $serif;
    font-size: 16px;
    font-weight: 700;
    color: var(--acc);
    letter-spacing: 3px;
    line-height: 1.3;
    text-shadow: 0 0 10px var(--glow);
  }
  small {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 45%, #998);
    letter-spacing: 0.6px;
  }
}
.emotion {
  flex: none;
  font-size: 12px;
  color: #d5cabb;
  padding: 3px 12px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.28);
  letter-spacing: 1px;
  // v0.32：AI 偶尔把情绪写成整句，钳制显示防撑破布局（完整文本悬停 title 可看）
  max-width: 11em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.vuln {
    color: $vuln;
    border-color: rgba(255, 107, 157, 0.5);
    font-weight: 700;
    animation: vuln-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes vuln-pulse {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(255, 107, 157, 0.25);
  }
  50% {
    box-shadow: 0 0 14px rgba(255, 107, 157, 0.6);
  }
}

// ━━━ 三维 ━━━
.bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
}
.bl {
  flex: none;
  width: 34px;
  color: color-mix(in srgb, var(--acc) 50%, #998);
  letter-spacing: 1px;
}
.track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.5);
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}
.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 60%);
    border-radius: 3px;
  }
}
.f-corrupt {
  background: linear-gradient(90deg, var(--acc2), var(--acc));
  box-shadow: 0 0 8px var(--glow);
}
.f-user {
  background: linear-gradient(90deg, #b3577e, #e58bab);
}
.f-suwen {
  background: linear-gradient(90deg, #4e5560, #8a93a1);
}
.f-grow {
  background: linear-gradient(90deg, var(--acc2), var(--acc));
  box-shadow: 0 0 6px var(--glow);
}
.bv {
  flex: none;
  min-width: 24px;
  text-align: right;
  font-weight: 700;
  font-size: 12px;
  color: #d5cabb;
  font-variant-numeric: tabular-nums;
}

.vuln-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 157, 0.45);
  background: linear-gradient(90deg, rgba(255, 107, 157, 0.15), rgba(255, 107, 157, 0.03));
  color: $vuln;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  animation: vuln-pulse 1.6s ease-in-out infinite;

  i {
    font-style: normal;
    animation: vuln-sway 0.7s ease-in-out infinite alternate;
  }
}
@keyframes vuln-sway {
  from {
    transform: rotate(-8deg);
  }
  to {
    transform: rotate(8deg);
  }
}

.inner-voice {
  margin: 0;
  padding: 8px 12px;
  border-left: 2px solid color-mix(in srgb, var(--acc) 55%, transparent);
  border-radius: 0 6px 6px 0;
  background: rgba(0, 0, 0, 0.24);
  font-family: $serif;
  font-size: 12.5px;
  font-style: italic;
  color: #cabfaf;
  letter-spacing: 0.3px;
}
.aura {
  font-size: 11px;
  font-style: italic;
  color: color-mix(in srgb, var(--acc) 48%, #887);
  text-align: right;
  letter-spacing: 0.5px;
}

// ━━━ 植入 ━━━
.implant {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--acc) 30%, transparent);
  border-radius: 10px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 7%, transparent), transparent 60%);
  backdrop-filter: blur(4px);
}
.implant-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ttl {
  font-family: $serif;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--acc);
  letter-spacing: 2px;
  text-shadow: 0 0 8px var(--glow);
}
.target {
  font-size: 11.5px;
  color: color-mix(in srgb, var(--acc) 58%, #998);
  letter-spacing: 0.5px;
}
.quota {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;

  .quota-label {
    font-size: 9.5px;
    color: color-mix(in srgb, var(--acc) 45%, #887);
    letter-spacing: 1px;
    margin-right: 2px;
  }
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    transition: background 0.3s;

    &.used {
      background: var(--acc);
      box-shadow: 0 0 6px var(--glow);
    }
  }
}
.implant-row {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.38);
    color: #e6ddcf;
    font-size: 13px;
    font-family: inherit;
    letter-spacing: 0.5px;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--acc) 70%, transparent);
      box-shadow: 0 0 10px var(--glow);
    }
    &::placeholder {
      color: color-mix(in srgb, var(--acc) 32%, #666);
    }
  }
}
.count {
  flex: none;
  font-size: 10px;
  color: #766;
  font-variant-numeric: tabular-nums;

  &.max {
    color: $danger;
    font-weight: 700;
  }
}
.go {
  flex: none;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--acc2), var(--acc));
  color: #16100a;
  font-size: 13px;
  font-weight: 800;
  font-family: inherit;
  letter-spacing: 3px;
  cursor: pointer;
  box-shadow: 0 0 12px color-mix(in srgb, var(--acc) 25%, transparent);
  transition: filter 0.2s, transform 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
.msg {
  margin: 0;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  letter-spacing: 0.4px;

  &.success {
    color: $safe;
    background: rgba(121, 196, 138, 0.1);
    border-left: 2px solid $safe;
  }
  &.error {
    color: $danger;
    background: rgba(224, 104, 104, 0.1);
    border-left: 2px solid $danger;
  }
  &.warn {
    color: $warn;
    background: rgba(232, 169, 79, 0.1);
    border-left: 2px solid $warn;
  }
}

// ━━━ 卡片 ━━━
.card {
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  backdrop-filter: blur(3px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 9px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--line);
    font-family: $serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--acc);
    letter-spacing: 2px;
    text-shadow: 0 0 8px var(--glow);

    em {
      margin-left: auto;
      font-style: normal;
      font-size: 11px;
      font-weight: 400;
      color: color-mix(in srgb, var(--acc) 48%, #887);
      font-variant-numeric: tabular-nums;
    }
  }
}
.empty {
  margin: 0;
  padding: 8px 0;
  text-align: center;
  font-size: 11.5px;
  font-style: italic;
  color: color-mix(in srgb, var(--acc) 35%, #665);
  letter-spacing: 1px;
}
.note {
  margin: 8px 0 0;
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 11px;

  &.warn {
    color: $warn;
    background: rgba(232, 169, 79, 0.09);
    border-left: 2px solid $warn;
  }
  &.safe {
    color: $safe;
    background: rgba(121, 196, 138, 0.08);
    border-left: 2px solid $safe;
  }
  &.freeze {
    color: $info;
    background: rgba(111, 185, 220, 0.09);
    border-left: 2px solid $info;
  }
  &.pov-running {
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 8%, transparent);
    border-left: 2px solid var(--acc);
  }
}

// ━━━ 苏文视角按钮（打断后点亮，发光跳动） ━━━
.pov-btn {
  width: 100%;
  margin-top: 2px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--acc) 60%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 18%, transparent), rgba(0, 0, 0, 0.25));
  color: var(--acc);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  letter-spacing: 2px;
  cursor: pointer;
  animation: pov-throb 1.6s ease-in-out infinite;
  transition: filter 0.2s;

  &:hover {
    filter: brightness(1.15);
  }
}
@keyframes pov-throb {
  0%,
  100% {
    box-shadow: 0 0 5px var(--glow);
    transform: translateY(0);
  }
  50% {
    box-shadow:
      0 0 14px var(--glow),
      0 0 26px var(--glow2);
    transform: translateY(-1px);
  }
}

// ━━━ 苏文卡 ━━━
.chip {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 10px;
  border-radius: 10px;
  letter-spacing: 0.5px;

  &.home {
    color: $danger;
    background: rgba(224, 104, 104, 0.14);
  }
  &.away {
    color: $safe;
    background: rgba(121, 196, 138, 0.14);
  }
  &.sleeping {
    color: $info;
    background: rgba(111, 185, 220, 0.14);
  }
}
.sw-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in srgb, var(--acc) 55%, #998);
  margin-bottom: 8px;

  .sw-emo {
    font-size: 11px;
    padding: 1px 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
    color: #cfc6b8;
    max-width: 10em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.sw-voice {
  margin-bottom: 9px;
  border-left-color: color-mix(in srgb, var(--acc) 30%, #778);
  color: #b3aa9c;
}
.f-warn {
  background: linear-gradient(90deg, #c98f3d, $warn);
}
.f-danger {
  background: linear-gradient(90deg, #b34848, $danger);
  animation: sus-pulse 1.4s ease-in-out infinite;
}
@keyframes sus-pulse {
  0%,
  100% {
    box-shadow: 0 0 5px rgba(224, 104, 104, 0.5);
  }
  50% {
    box-shadow: 0 0 12px rgba(224, 104, 104, 0.85);
  }
}

// ━━━ 念头条目 ━━━
.thought {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.26);
  border-left: 2px solid transparent;
  transition: border-color 0.25s, background 0.25s;

  & + .thought {
    margin-top: 7px;
  }
  &:hover {
    background: rgba(0, 0, 0, 0.38);
    border-left-color: var(--acc);
  }
}
.t-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.state {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
  letter-spacing: 0.5px;

  &.growing {
    color: $safe;
    background: rgba(121, 196, 138, 0.14);
  }
  &.pending {
    color: $info;
    background: rgba(111, 185, 220, 0.14);
  }
  &.rejected {
    color: $danger;
    background: rgba(224, 104, 104, 0.14);
  }
  &.mature {
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 16%, transparent);
  }
  &.expired {
    color: #999;
    background: rgba(255, 255, 255, 0.08);
  }
}
.t-type {
  font-size: 10.5px;
  color: color-mix(in srgb, var(--acc) 50%, #998);
}
.t-diff {
  font-size: 10px;
  color: $warn;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid rgba(232, 169, 79, 0.35);
}
.t-discard {
  margin-left: auto;
}
.t-body {
  font-family: $serif;
  font-size: 13px;
  color: #e0d8ca;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}
.t-prog {
  display: flex;
  align-items: center;
  gap: 8px;

  .track {
    flex: 1;
  }
  .pv {
    flex: none;
    font-size: 10px;
    color: color-mix(in srgb, var(--acc) 52%, #998);
    font-variant-numeric: tabular-nums;
  }

  // 加速来源标签（v0.33 A）：+N/楼，悬停显示分解
  .t-rate {
    flex: none;
    font-size: 10px;
    padding: 0 6px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--acc) 30%, transparent);
    color: var(--acc);
    font-variant-numeric: tabular-nums;
    cursor: help;
  }
}
.t-reject {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: $danger;

  .force {
    border-color: rgba(224, 104, 104, 0.7);
    color: $danger;
    font-weight: 700;
    animation: force-lure 2.2s ease-in-out infinite;

    &:hover {
      background: rgba(224, 104, 104, 0.16);
    }
  }

  // 裂纹窗口（v0.25）：绿色脉冲——机会通道，与红色强植的不归路形成对照
  .retry {
    border-color: rgba(121, 196, 138, 0.7);
    color: $safe;
    font-weight: 700;
    animation: retry-glow 1.8s ease-in-out infinite;

    &:hover {
      background: rgba(121, 196, 138, 0.16);
    }
  }
}
@keyframes force-lure {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(224, 104, 104, 0);
  }
  50% {
    box-shadow: 0 0 9px rgba(224, 104, 104, 0.45);
  }
}
@keyframes retry-glow {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(121, 196, 138, 0);
  }
  50% {
    box-shadow: 0 0 9px rgba(121, 196, 138, 0.5);
  }
}

.ghost {
  flex: none;
  padding: 2px 10px;
  border: 1px solid rgba(224, 104, 104, 0.55);
  border-radius: 6px;
  background: transparent;
  color: $danger;
  font-size: 10px;
  font-family: inherit;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(224, 104, 104, 0.15);
  }
  &.gold {
    padding: 3px 11px;
    border-color: color-mix(in srgb, var(--acc) 60%, transparent);
    color: var(--acc);

    &:hover {
      background: color-mix(in srgb, var(--acc) 14%, transparent);
    }
  }
}

// ━━━ 习惯 ━━━
.habit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.26);
  border-left: 2px solid color-mix(in srgb, var(--acc) 40%, transparent);

  & + .habit {
    margin-top: 6px;
  }
}

// 刻印习性（v0.33）：金色专属区块
.quota {
  margin-left: 8px;
  color: #e8c76a;
  font-style: normal;
  cursor: help;
}
.engraved-box {
  margin-bottom: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid rgba(232, 199, 106, 0.35);
  background: linear-gradient(180deg, rgba(232, 199, 106, 0.08), rgba(232, 199, 106, 0.02));

  .eg-title {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: #e8c76a;
    margin-bottom: 5px;
  }
}
.habit.engraved {
  background: rgba(232, 199, 106, 0.07);
  border-left-color: #e8c76a;

  .h-text {
    color: #efe0b8;
  }
}
.pin {
  border-color: rgba(232, 199, 106, 0.55);
  color: #e8c76a;
  white-space: nowrap;
}
.h-text {
  font-family: $serif;
  font-size: 12.5px;
  color: #cfe3d0;
}

// ━━━ 仪容星标（满星脉冲） ━━━
.stars {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: -2px 0 6px;
  touch-action: manipulation; // 后门连点：掐掉移动端点击延迟与双击缩放
}
.star {
  font-size: 13px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.14);
  transition: color 0.3s, text-shadow 0.3s;

  &.lit {
    color: var(--acc);
    text-shadow: 0 0 6px var(--glow);
  }
}
.stars.full .star {
  animation: star-pulse 1.8s ease-in-out infinite;

  @for $i from 1 through 5 {
    &:nth-child(#{$i}) {
      animation-delay: #{($i - 1) * 0.12}s;
    }
  }
}
@keyframes star-pulse {
  0%,
  100% {
    text-shadow: 0 0 4px var(--glow);
  }
  50% {
    text-shadow:
      0 0 12px var(--glow),
      0 0 22px var(--glow2);
  }
}
.star-note {
  margin-left: 5px;
  font-size: 9.5px;
  letter-spacing: 0.5px;
  color: color-mix(in srgb, var(--acc) 40%, #776);
}
.stars.full .star-note {
  color: var(--acc);
  text-shadow: 0 0 8px var(--glow);
}

// ━━━ 仪容 ━━━
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tag {
  font-size: 10.5px;
  padding: 2px 10px;
  border-radius: 12px;
  color: var(--acc);
  background: color-mix(in srgb, var(--acc) 13%, transparent);
  letter-spacing: 0.5px;

  &.line {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--acc) 38%, transparent);
    color: color-mix(in srgb, var(--acc) 72%, #aa9);
  }
  &.eq {
    background: linear-gradient(135deg, color-mix(in srgb, var(--acc) 22%, transparent), color-mix(in srgb, var(--acc) 8%, transparent));
    box-shadow: 0 0 8px color-mix(in srgb, var(--acc) 12%, transparent);
  }
}
.equipped-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;

  .eq-label {
    font-size: 10px;
    color: color-mix(in srgb, var(--acc) 45%, #887);
    letter-spacing: 1px;
  }
}
.attire {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 5px;

  .a-cell {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid color-mix(in srgb, var(--acc) 10%, transparent);
    min-width: 0;
  }
  .a-ic {
    flex: none;
    font-size: 14px;
    opacity: 0.85;
  }
  .a-tx {
    min-width: 0;
    display: flex;
    flex-direction: column;

    small {
      font-size: 9.5px;
      letter-spacing: 1px;
      color: color-mix(in srgb, var(--acc) 48%, #887);
    }
    b {
      font-weight: 500;
      font-size: 11.5px;
      color: #cabfaf;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
