<template>
  <div :class="['frost-root', 'th-stage-' + themeStage]">
    <div class="bg-pattern"></div>
    <div class="bg-glow"></div>
    <div class="main-panel">
      <div class="panel-decor top"></div>

      <!-- 顶栏：世界信息 + 货币（毛玻璃） -->
      <header class="topbar">
        <div class="world">
          <span>{{ safeWorld.日期 || '——' }}</span>
          <i class="sep"></i>
          <span>{{ safeWorld.时间 || '——' }}</span>
          <i class="sep"></i>
          <span>{{ safeWorld.地点 || '——' }}</span>
        </div>
        <span v-if="recording" class="rec-dot" title="录制中">● REC</span>
        <div class="coin" title="货币" @click="coinTap">
          ◈ {{ data?.系统?.货币 ?? 0 }}
          <span v-if="coinGain" class="coin-gain">+500</span>
        </div>
      </header>

      <!-- 坏结局横幅（锁定后常驻） -->
      <div v-if="badEnd" class="bad-end-banner">☠ 坏结局已锁定 · {{ badEnd }} · 游戏系统全部停止</div>

      <!-- 苏文一行速览（常驻，不单独占页；打断余波期整条变琥珀色脉冲） -->
      <div :class="['suwen-strip', { aftermath: aftermathLeft > 0 }]">
        <span class="sw-name">苏文</span>
        <span :class="['sw-chip', suwenStatusClass]">{{ suwenStatusDisplay }}</span>
        <span class="sw-loc">@ {{ suwenPos }}</span>
        <span v-if="aftermathLeft > 0" class="sw-hint aftermath-hint">👁 余波·他还没走远（剩{{ aftermathLeft }}楼）</span>
        <span v-else-if="suwenAccel" class="sw-hint accel">⚡念头加速中</span>
        <span v-else-if="suwenSafe" class="sw-hint safe">✓ {{ suwenSafe }}</span>
        <span class="sw-sus">疑心 秦 {{ susQin }} · 梦 {{ susMeng }}<i v-if="hasFreeze" title="疑心冻结中">❄</i></span>
      </div>

      <!-- 标签页：角色（含在场点）+ 网店 + 在场锁定 -->
      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          :class="['tab-btn', { active: activeTab === t.id }]"
          @click="toggleTab(t.id)"
        >
          <span v-if="t.presence !== undefined" :class="['presence', { on: t.presence }]"></span>
          <span class="tab-label">{{ t.label }}</span>
        </button>
        <button
          v-if="isLatest"
          type="button"
          :class="['lock-btn', { on: actorLocked }]"
          :title="actorLocked ? '在场角色已锁定（点击调整/解锁）' : '锁定在场角色（纠正 AI 进出场判错）'"
          @click="showLockPicker = !showLockPicker"
        >
          {{ actorLocked ? '🔒' : '🔓' }}
        </button>
      </nav>

      <!-- 在场锁定浮层 -->
      <div v-if="showLockPicker && isLatest" class="lock-picker">
        <span class="lp-label">锁定在场</span>
        <button type="button" @click="setActorLock('秦璐')">仅秦璐</button>
        <button type="button" @click="setActorLock('苏梦')">仅苏梦</button>
        <button type="button" @click="setActorLock('两者')">两者</button>
        <button type="button" class="unlock" :disabled="!actorLocked" @click="setActorLock(null)">解锁</button>
      </div>

      <!-- 内容区（老楼层默认折叠，点 tab 临时展开——对标云霜凝 v2.0.31 性能优化） -->
      <!-- v0.31 旧楼只读：操作本就固定写最新楼(-1)，但旧楼面板显示的是历史数据，
           按历史数据点操作会造成"点了没反应/校验对不上"的困惑——整块禁点，只留查看 -->
      <div v-if="activeTab" class="content-area">
        <div v-if="!isLatest" class="stale-guard">📜 旧楼层仅供回看，购买/植入等操作请回到最新楼层</div>
        <div :class="['panel-host', { readonly: !isLatest }]">
          <CharPanel v-if="activeTab === '秦璐' || activeTab === '苏梦'" :key="activeTab" :name="activeTab" />
          <ShopPanel v-else-if="activeTab === '网店'" />
        </div>
      </div>

      <div class="panel-decor bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import CharPanel from './components/CharPanel.vue';
import ShopPanel from './components/ShopPanel.vue';
import { useDataStore } from './store';

const store = useDataStore();
const data = computed(() => store.data);
const safeWorld = computed(() => data.value?.世界 ?? { 时间: '', 日期: '', 地点: '' });

const presence = computed(
  () => data.value?.系统?.在场角色 ?? ({ 秦璐: true, 苏梦: false } as Record<'秦璐' | '苏梦', boolean>),
);

const tabs = computed(() => [
  { id: '秦璐' as const, label: '秦璐', presence: presence.value.秦璐 },
  { id: '苏梦' as const, label: '苏梦', presence: presence.value.苏梦 },
  { id: '网店' as const, label: '网店', presence: undefined },
]);

// ━━━ 苏文速览条 ━━━
const suwen = computed(() => data.value?.苏文状态 ?? null);
const suwenPos = computed(() => suwen.value?.当前位置 ?? '客厅');
const suwenStatusDisplay = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '外出' : s === '睡眠' ? '睡眠' : '在家';
});
const suwenStatusClass = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? 'away' : s === '睡眠' ? 'sleeping' : 'home';
});
const suwenAccel = computed(() => {
  const p = suwen.value?.当前位置;
  return p === '餐厅' || p === '客厅' || p === '主卧';
});
const suwenSafe = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '安全期' : s === '睡眠' ? '熟睡中' : '';
});
const susQin = computed(() => Math.round(suwen.value?.对秦璐疑心值 ?? 0));
const susMeng = computed(() => Math.round(suwen.value?.对苏梦疑心值 ?? 0));
const badEnd = computed(() => data.value?.系统?._坏结局 ?? '');
const recording = computed(() => data.value?.系统?._录像?.录制中 ?? false);
// 打断余波（v0.25）：打断后苏文滞留家中的剩余楼数（>0 时速览条特殊显示）
const aftermathLeft = computed(() => {
  const until = data.value?.系统?._打断余波至楼层 ?? -1;
  if (until < 0) return 0;
  return Math.max(0, until - (SillyTavern.chat?.length ?? 0));
});

// 货币后门：货币区 2.5s 内连点 5 次 → +500，可无限重复（与调试满星同款手势通道）
//   v0.28：窗口 1.5s→2.5s，配合 CSS touch-action:manipulation，兼顾移动端快速连点
let coinTapCount = 0;
let coinTapTimer: ReturnType<typeof setTimeout> | null = null;
const coinGain = ref(false);
async function coinTap() {
  if (!isLatest.value) return; // v0.31 旧楼只读：顶栏后门与内容区遮罩同规则
  coinTapCount++;
  if (coinTapTimer) clearTimeout(coinTapTimer);
  coinTapTimer = setTimeout(() => (coinTapCount = 0), 2500);
  if (coinTapCount < 5) return;
  coinTapCount = 0;
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) return;
    d.系统.货币 = (d.系统.货币 ?? 0) + 500;
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    coinGain.value = true;
    setTimeout(() => (coinGain.value = false), 1200);
    console.info(`[后门] 货币 +500 → ${d.系统.货币}`);
  } catch (e) {
    console.error('[秦璐重置版] 货币后门失败', e);
  }
}
// ━━━ 在场角色锁定（v0.25 对标云霜凝 2.0.31）：玩家手动纠正 AI 进出场判错 ━━━
// 直接写最新楼 MVU（message_id=-1）——iframe store 绑定本楼，flush 写不到 AI 下轮读的位置
const actorLocked = computed(() => data.value?.系统?._在场锁定 ?? false);
const showLockPicker = ref(false);
async function setActorLock(preset: '秦璐' | '苏梦' | '两者' | null) {
  showLockPicker.value = false;
  const 在场 = preset === null ? null : { 秦璐: preset !== '苏梦', 苏梦: preset !== '秦璐' };
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) return;
    if (在场 === null) {
      d.系统._在场锁定 = false;
    } else {
      d.系统.在场角色 = { ...在场 };
      d.系统._在场锁定 = true;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    // 本地 store 同步（UI 立即反馈）
    if (store.data?.系统) {
      store.data.系统._在场锁定 = 在场 !== null;
      if (在场 !== null) store.data.系统.在场角色 = { ...在场 };
    }
    console.info(`[在场锁定] ${在场 === null ? '已解锁' : `锁定为 ${preset}`}`);
  } catch (e) {
    console.error('[秦璐重置版] 在场锁定写入失败', e);
  }
}

const hasFreeze = computed(() => {
  const floor = SillyTavern.chat?.length ?? 0;
  const fq = suwen.value?.对秦璐疑心值冻结;
  const fm = suwen.value?.对苏梦疑心值冻结;
  return (fq?.是否冻结 && floor < fq.冻结结束楼层) || (fm?.是否冻结 && floor < fm.冻结结束楼层);
});

// ━━━ 老楼层折叠：最新楼共享 localStorage tab；老楼独立 local tab（默认收起） ━━━
const storedTab = useLocalStorage<string | null>('秦璐重置版:status_bar:active_tab', '秦璐');
const localTab = ref<string | null>(null);
const isLatest = ref(true);
let latestTimer: ReturnType<typeof setInterval> | null = null;

function refreshIsLatest() {
  try {
    isLatest.value = getCurrentMessageId() >= (SillyTavern.chat?.length ?? 1) - 1;
  } catch {
    isLatest.value = true;
  }
}
onMounted(() => {
  refreshIsLatest();
  latestTimer = setInterval(refreshIsLatest, 2000);
  // 脚本心跳监察（v0.25 对标云霜凝 2.0.32）：脚本每 5s 写 _top.sessionStorage 心跳，
  // 15s 后心跳仍空/陈旧 → 弹"脚本未加载"错误；sessionStorage gate 防重复弹
  setTimeout(() => {
    try {
      const top = window.parent as any;
      const heartbeat = Number(top?.sessionStorage?.getItem?.('秦璐重置版_脚本心跳') || 0);
      if (heartbeat > 0 && Date.now() - heartbeat < 15000) return;
      if (top?.sessionStorage?.getItem?.('秦璐重置版_加载失败toast已弹')) return;
      top?.toastr?.error?.(
        '⚠️ 游戏逻辑脚本未加载，培育/疑心/商店等系统不会运转。\n请刷新页面或检查酒馆助手脚本是否启用。',
        '秦璐重置版',
        { timeOut: 0, extendedTimeOut: 0 },
      );
      top?.sessionStorage?.setItem?.('秦璐重置版_加载失败toast已弹', '1');
    } catch {}
  }, 15000);
});
onUnmounted(() => {
  if (latestTimer) clearInterval(latestTimer);
});
watch(isLatest, latest => {
  if (!latest) localTab.value = null;
});

const activeTab = computed<string | null>({
  get: () => (isLatest.value ? storedTab.value : localTab.value),
  set: v => {
    if (isLatest.value) storedTab.value = v;
    else localTab.value = v;
  },
});

// 主题色跟随最近选中的角色 tab（切到苏文/网店时保持不变）
const themeCharName = ref<'秦璐' | '苏梦'>('秦璐');
const themeStage = computed(() => data.value?.[`${themeCharName.value}状态`]?.当前阶段 ?? 1);

function toggleTab(id: string) {
  if (id === '秦璐' || id === '苏梦') themeCharName.value = id;
  activeTab.value = activeTab.value === id ? null : id;
}
</script>

<style scoped lang="scss">
// ══════════════════════════════════════════════════════════
// 阶段主题（暖调：暗金 → 动摇紫 → 沉溺粉 → 疯狂品红 → 圆满电紫）
// 层次照云霜凝 frost 三明治，色相是秦璐自己的
// ══════════════════════════════════════════════════════════
.th-stage-1 {
  --acc: #d4b46a;
  --acc2: #9a7f42;
  --bg1: #131009;
  --bg2: #1e1810;
  --line: rgba(212, 180, 106, 0.18);
  --panel: rgba(255, 250, 238, 0.04);
  --glow: rgba(212, 180, 106, 0.14);
  --glow2: rgba(154, 127, 66, 0.1);
}
.th-stage-2 {
  --acc: #c39be0;
  --acc2: #8f6ab0;
  --bg1: #120d18;
  --bg2: #1e1328;
  --line: rgba(195, 155, 224, 0.18);
  --panel: rgba(246, 240, 255, 0.04);
  --glow: rgba(195, 155, 224, 0.15);
  --glow2: rgba(143, 106, 176, 0.1);
}
.th-stage-3 {
  --acc: #ea8fb4;
  --acc2: #b45f84;
  --bg1: #170d13;
  --bg2: #261522;
  --line: rgba(234, 143, 180, 0.2);
  --panel: rgba(255, 240, 248, 0.04);
  --glow: rgba(234, 143, 180, 0.17);
  --glow2: rgba(180, 95, 132, 0.11);
}
.th-stage-4 {
  --acc: #f0559f;
  --acc2: #b32e73;
  --bg1: #1a0a14;
  --bg2: #2c1022;
  --line: rgba(240, 85, 159, 0.22);
  --panel: rgba(255, 235, 246, 0.05);
  --glow: rgba(240, 85, 159, 0.2);
  --glow2: rgba(179, 46, 115, 0.13);
}
.th-stage-5 {
  --acc: #cf7bf5;
  --acc2: #9747c9;
  --bg1: #140a1d;
  --bg2: #221032;
  --line: rgba(207, 123, 245, 0.22);
  --panel: rgba(248, 238, 255, 0.05);
  --glow: rgba(207, 123, 245, 0.2);
  --glow2: rgba(151, 71, 201, 0.13);
}

$font-main: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif;
$font-serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;

// ══════════════════════════════════════════════════════════
// frost 三明治：多段渐变底 + 斜纹底纹 + 径向光晕
// ══════════════════════════════════════════════════════════
.frost-root {
  width: 100%;
  position: relative;
  background: linear-gradient(170deg, var(--bg1) 0%, #14100b 30%, var(--bg2) 60%, var(--bg1) 100%);
  color: #e8dfd0;
  font-family: $font-main;
  font-size: 14px;
  line-height: 1.55;
  border-radius: 12px;
  overflow: hidden;
  transition: background 0.6s;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% -5%, var(--glow), transparent 50%),
      radial-gradient(ellipse at 85% 105%, var(--glow2), transparent 50%),
      radial-gradient(circle at 50% 50%, var(--glow2), transparent 70%);
    pointer-events: none;
    transition: background 0.6s;
  }
}
.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 20px, color-mix(in srgb, var(--acc) 4%, transparent) 20px, color-mix(in srgb, var(--acc) 4%, transparent) 21px),
    repeating-linear-gradient(-45deg, transparent, transparent 20px, color-mix(in srgb, var(--acc) 3%, transparent) 20px, color-mix(in srgb, var(--acc) 3%, transparent) 21px);
  pointer-events: none;
}
.bg-glow {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 22% 28%, var(--glow2), transparent 26%),
    radial-gradient(circle at 76% 66%, var(--glow2), transparent 30%);
  pointer-events: none;
  animation: glow-drift 14s ease-in-out infinite alternate;
}
@keyframes glow-drift {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0.7;
  }
  100% {
    transform: translate(9px, -7px) scale(1.05);
    opacity: 1;
  }
}

.main-panel {
  position: relative;
  z-index: 1;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px color-mix(in srgb, var(--acc) 5%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: border-color 0.6s, box-shadow 0.6s;
}
.panel-decor {
  height: 2px;
  background: linear-gradient(90deg, transparent 3%, var(--acc2) 25%, var(--acc) 50%, var(--acc2) 75%, transparent 97%);
  opacity: 0.7;

  &.bottom {
    height: 1px;
    opacity: 0.45;
  }
}

// ━━━ 顶栏（毛玻璃） ━━━
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 5%, transparent) 0%, transparent 100%);
  backdrop-filter: blur(8px);
}
.world {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: color-mix(in srgb, var(--acc) 65%, #b7a);
  letter-spacing: 0.5px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--acc) 50%, transparent);
  flex: none;
}
.coin {
  position: relative;
  flex: none;
  font-size: 13px;
  font-weight: 700;
  color: var(--acc);
  text-shadow: 0 0 10px var(--glow);
  touch-action: manipulation; // 后门连点：掐掉移动端点击延迟与双击缩放
  padding: 2px 12px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(4px);

  font-variant-numeric: tabular-nums;

  .coin-gain {
    position: absolute;
    right: 6px;
    top: -4px;
    font-size: 11px;
    color: #79c48a;
    text-shadow: 0 0 8px rgba(121, 196, 138, 0.6);
    animation: coin-float 1.2s ease-out forwards;
    pointer-events: none;
  }
}
@keyframes coin-float {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-14px);
  }
}

// ━━━ 录制指示灯 ━━━
.rec-dot {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #e05555;
  animation: rec-blink 1.2s steps(2, start) infinite;
}
@keyframes rec-blink {
  50% {
    opacity: 0.25;
  }
}

// ━━━ 坏结局横幅 ━━━
.bad-end-banner {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(224, 104, 104, 0.55);
  background: linear-gradient(160deg, rgba(224, 104, 104, 0.18), rgba(0, 0, 0, 0.32));
  color: #e06868;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-align: center;
  text-shadow: 0 0 10px rgba(224, 104, 104, 0.5);
  animation: bad-end-throb 2.4s ease-in-out infinite;
}
@keyframes bad-end-throb {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(224, 104, 104, 0.15);
  }
  50% {
    box-shadow: 0 0 16px rgba(224, 104, 104, 0.35);
  }
}

// ━━━ 苏文速览条 ━━━
.suwen-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--acc) 8%, transparent);
  background: rgba(0, 0, 0, 0.18);
  font-size: 11px;
  color: color-mix(in srgb, var(--acc) 50%, #998);
}
.sw-name {
  font-weight: 700;
  color: color-mix(in srgb, var(--acc) 70%, #ba9);
  letter-spacing: 1px;
}
.sw-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 0 8px;
  border-radius: 9px;

  &.home {
    color: #e06868;
    background: rgba(224, 104, 104, 0.14);
  }
  &.away {
    color: #79c48a;
    background: rgba(121, 196, 138, 0.14);
  }
  &.sleeping {
    color: #6fb9dc;
    background: rgba(111, 185, 220, 0.14);
  }
}
.sw-loc {
  letter-spacing: 0.5px;
}
.sw-hint {
  font-size: 10px;

  &.accel {
    color: #e8a94f;
  }
  &.safe {
    color: #79c48a;
  }
  &.aftermath-hint {
    color: #e8a94f;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
}

// 打断余波：整条速览琥珀色脉冲（他还没走远）
.suwen-strip.aftermath {
  border-bottom-color: rgba(232, 169, 79, 0.45);
  background: linear-gradient(90deg, rgba(232, 169, 79, 0.1), rgba(0, 0, 0, 0.18) 60%);
  animation: aftermath-throb 2.2s ease-in-out infinite;
}
@keyframes aftermath-throb {
  0%,
  100% {
    box-shadow: inset 0 -1px 0 rgba(232, 169, 79, 0.1);
  }
  50% {
    box-shadow: inset 0 -1px 0 rgba(232, 169, 79, 0.4);
  }
}
.sw-sus {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;

  i {
    font-style: normal;
    color: #6fb9dc;
    margin-left: 4px;
  }
}

// ━━━ 标签页 ━━━
.tabs {
  display: flex;
  gap: 6px;
  padding: 10px 12px 0;
}
.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 6px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 9px 9px 0 0;
  background: rgba(0, 0, 0, 0.25);
  color: #b9ad9a;
  font-family: inherit;
  font-size: 13.5px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 7%, rgba(0, 0, 0, 0.25));
  }
  &.active {
    color: var(--acc);
    font-weight: 700;
    border-color: var(--line);
    background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 13%, transparent), color-mix(in srgb, var(--acc) 3%, transparent));
    text-shadow: 0 0 10px var(--glow);
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--acc) 25%, transparent);
  }
}
.presence {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  flex: none;
  transition: background 0.3s, box-shadow 0.3s;

  &.on {
    background: #79c48a;
    box-shadow: 0 0 6px rgba(121, 196, 138, 0.8);
  }
}

// ━━━ 在场锁定 ━━━
.lock-btn {
  flex: none;
  width: 38px;
  padding: 9px 0;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 9px 9px 0 0;
  background: rgba(0, 0, 0, 0.25);
  font-size: 13px;
  cursor: pointer;
  opacity: 0.55;
  transition: all 0.25s;

  &:hover {
    opacity: 1;
  }
  &.on {
    opacity: 1;
    border-color: var(--line);
    background: color-mix(in srgb, var(--acc) 12%, rgba(0, 0, 0, 0.25));
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--acc) 25%, transparent);
  }
}
.lock-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 8px 12px 0;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.28);

  .lp-label {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 50%, #887);
    letter-spacing: 1px;
    margin-right: 2px;
  }
  button {
    padding: 4px 12px;
    border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent);
    border-radius: 14px;
    background: transparent;
    color: var(--acc);
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.2s;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--acc) 13%, transparent);
    }
    &.unlock {
      border-color: rgba(224, 104, 104, 0.5);
      color: #e06868;
    }
    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }
}

// ━━━ 内容区 ━━━
.content-area {
  padding: 12px;
  border-top: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 3%, transparent), transparent 12%);
}

// 旧楼只读（v0.31）：面板整块禁点，仅供回看
.stale-guard {
  margin-bottom: 10px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--acc) 35%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--acc) 8%, transparent);
  color: var(--acc);
  font-size: 12px;
  letter-spacing: 0.05em;
}
.panel-host.readonly {
  pointer-events: none;
  opacity: 0.72;
  filter: saturate(0.75);
}

@media (max-width: 380px) {
  .topbar {
    padding: 9px 10px;
  }
  .tabs {
    gap: 4px;
    padding: 8px 8px 0;
  }
  .tab-btn {
    font-size: 12.5px;
    padding: 8px 4px;
  }
  .content-area {
    padding: 10px 8px;
  }
}
</style>
