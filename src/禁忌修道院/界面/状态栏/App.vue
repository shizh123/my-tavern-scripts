<template>
  <!-- 加载状态 -->
  <div v-if="!isDataLoaded" class="monastery-wrap loading">
    <div class="orn-line top"></div>
    <div class="load-inner">
      <span class="cross-icon">✝</span>
      <span class="load-text">神启降临中…</span>
    </div>
    <div class="orn-line bottom"></div>
  </div>

  <!-- 正常界面 -->
  <div v-else class="monastery-wrap" :class="themeClass">
    <!-- ── 顶部装饰横线 ── -->
    <div class="orn-line top"></div>

    <!-- ── 标题头部 ── -->
    <header class="hd">
      <div class="hd-left">
        <span class="hd-date">{{ worldData.当前日期 }}</span>
        <span class="hd-sep">·</span>
        <span class="hd-time">{{ worldData.当前时间 }}</span>
      </div>
      <div class="stage-badge" :class="badgeClass">
        <span class="badge-num">{{ teresaData.当前阶段 }}</span>
        <span class="badge-title">{{ stageTitle }}</span>
      </div>
    </header>

    <!-- ── 场景行 ── -->
    <div class="location-row">
      <span class="loc-icon">⛪</span>
      <span class="loc-name">{{ worldData.当前场景 }}</span>
      <span class="scene-pill" :class="isPrivate ? 'priv' : 'pub'">{{ isPrivate ? '私密' : '公共' }}</span>
    </div>

    <!-- ── 角色名 ── -->
    <div class="char-name">
      <span class="char-cross">✝</span>
      <span>特蕾莎·玛格丽特·冯·艾森巴赫</span>
      <span class="char-cross">✝</span>
    </div>

    <!-- ── 数值区 ── -->
    <div class="stats-panel">
      <!-- 好感度 -->
      <div class="stat-row">
        <div class="stat-lbl">
          <i class="fa-solid fa-heart stat-icon aff-icon"></i>
          <span>好感度</span>
        </div>
        <div class="bar-wrap">
          <div class="bar-track">
            <div class="bar-fill aff-fill" :style="{ width: affectionPct + '%' }">
              <div class="bar-shine"></div>
            </div>
          </div>
          <span class="bar-num">{{ teresaData.好感度 }}</span>
        </div>
      </div>

      <!-- 堕落值 -->
      <div class="stat-row">
        <div class="stat-lbl">
          <i class="fa-solid fa-moon stat-icon cor-icon"></i>
          <span>堕落值</span>
        </div>
        <div class="bar-wrap">
          <div class="bar-track">
            <!-- 上限线 -->
            <div class="cap-mark" :style="{ left: corruptionCapPct + '%' }"></div>
            <div class="bar-fill cor-fill" :style="{ width: corruptionPct + '%' }">
              <div class="bar-shine"></div>
            </div>
          </div>
          <span class="bar-num"
            >{{ teresaData.堕落值 }}<span class="bar-cap">/{{ corruptionCap }}</span></span
          >
        </div>
      </div>

      <!-- 上限提示 -->
      <div class="cap-tip">上限 = 好感度 ÷ 10 × 10 = {{ corruptionCap }}</div>

      <!-- 阶段进度格 -->
      <div class="stage-section">
        <div class="stage-num-row">
          <span class="sn-label">当前阶段</span>
          <span class="sn-value">{{ teresaData.当前阶段 }}</span>
          <span class="sn-max">/20</span>
        </div>
        <div class="stage-dots">
          <div v-for="n in 20" :key="n" class="dot" :class="dotClass(n)" :title="getDotTitle(n)"></div>
        </div>
        <div class="stage-range-labels">
          <span>圣洁</span>
          <span>动摇</span>
          <span>沉沦</span>
          <span>堕落</span>
          <span>超越</span>
        </div>
      </div>
    </div>

    <!-- ── Tab 导航 ── -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ── Tab 内容：阶段特征 ── -->
    <div v-show="activeTab === 'traits'" class="tab-panel">
      <div class="trait-grid">
        <div class="trait-card">
          <span class="tc-icon">👁</span>
          <span class="tc-lbl">态度</span>
          <span class="tc-val">{{ stageTraits.态度描述 }}</span>
        </div>
        <div class="trait-card">
          <span class="tc-icon">💬</span>
          <span class="tc-lbl">语气</span>
          <span class="tc-val">{{ stageTraits.语气风格 }}</span>
        </div>
        <div class="trait-card">
          <span class="tc-icon">🌸</span>
          <span class="tc-lbl">行为</span>
          <span class="tc-val">{{ stageTraits.行为倾向 }}</span>
        </div>
        <div class="trait-card">
          <span class="tc-icon">💭</span>
          <span class="tc-lbl">内心</span>
          <span class="tc-val">{{ stageTraits.内心状态 }}</span>
        </div>
      </div>
    </div>

    <!-- ── Tab 内容：当前着装 ── -->
    <div v-show="activeTab === 'clothing'" class="tab-panel">
      <div class="clothing-grid">
        <div v-for="(val, key) in clothingDisplay" :key="key" class="cg-item">
          <span class="cg-key">{{ key }}</span>
          <span class="cg-val">{{ val }}</span>
        </div>
      </div>
      <div class="scene-note" :class="isPrivate ? 'priv' : 'pub'">
        当前场景：{{ isPrivate ? '私密场合' : '公共场合' }}
      </div>
    </div>

    <!-- ── Tab 内容：近期事务 ── -->
    <div v-show="activeTab === 'affairs'" class="tab-panel">
      <div v-if="Object.keys(worldData.近期事务 ?? {}).length === 0" class="empty-tip">暂无近期事务</div>
      <div v-else class="affairs-list">
        <div v-for="(val, key) in worldData.近期事务" :key="key" class="af-item">
          <span class="af-key">{{ key }}</span>
          <span class="af-val">{{ val }}</span>
        </div>
      </div>
    </div>

    <!-- ── 身体改造（堕落值≥80） ── -->
    <div v-if="teresaData.堕落值 >= 80" class="mod-section">
      <div class="mod-header" @click="showMod = !showMod">
        <span class="mod-icon">⛓</span>
        <span>身体改造记录</span>
        <span class="toggle-icon">{{ showMod ? '▼' : '▶' }}</span>
      </div>
      <div v-show="showMod" class="mod-list">
        <div v-for="(val, key) in teresaData.身体改造" :key="key" class="mod-item">
          <span class="mod-k">{{ key }}</span>
          <span class="mod-v">{{ val }}</span>
        </div>
        <div v-for="(val, key) in teresaData.纹身" :key="'tt-' + key" class="mod-item tattoo">
          <span class="mod-k">{{ key }}</span>
          <span class="mod-v">{{ val }}</span>
        </div>
      </div>
    </div>

    <!-- ── 底部装饰横线 ── -->
    <div class="orn-line bottom"></div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from './store';
import { getStageTitle } from '../../stageConfig';
import type { StageCharacteristics } from '../../stageConfig';
import type { SchemaType } from '../../schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _store = useDataStore() as any;
const data = computed<SchemaType | undefined>(() => _store.data);

// ── Tab 状态 ──────────────────────────────────
const tabs = [
  { key: 'traits', label: '阶段特征' },
  { key: 'clothing', label: '当前着装' },
  { key: 'affairs', label: '近期事务' },
];
const activeTab = ref<string>('traits');
const showMod = ref(false);

// ── 数据加载检查 ──────────────────────────────
const isDataLoaded = computed(() => data.value !== undefined);

// ── 世界状态 ──────────────────────────────────
const worldData = computed(
  () =>
    data.value?.世界状态 ?? {
      当前日期: '加载中',
      当前时间: '--:--',
      当前场景: '未知场景',
      近期事务: {},
    },
);

// ── 特蕾莎状态 ────────────────────────────────
const teresaData = computed(
  () =>
    data.value?.特蕾莎状态 ?? {
      好感度: 0,
      堕落值: 0,
      当前阶段: 1,
      着装: {},
      纹身: {},
      身体改造: {},
      阶段特征: {},
    },
);

// ── 阶段特征 ──────────────────────────────────
const stageTraits = computed((): StageCharacteristics => {
  const raw = teresaData.value.阶段特征;
  if ('态度描述' in raw) return raw as StageCharacteristics;
  return {
    态度描述: '威严肃穆，保持绝对距离',
    语气风格: '冷淡疏离，措辞正式',
    行为倾向: '严守教规，拒绝亲密接触',
    内心状态: '坚守信仰，压抑本能',
  };
});

// ── 着装（过滤掉内部字段） ────────────────────
const clothingDisplay = computed(() => {
  const c = teresaData.value.着装 ?? {};
  const excluded = new Set(['最后更新日期', '当前场景类型']);
  return Object.fromEntries(Object.entries(c).filter(([k]) => !excluded.has(k)));
});

// ── 进度条计算 ────────────────────────────────
const affectionPct = computed(() => teresaData.value.好感度);
const corruptionCap = computed(() => Math.floor(teresaData.value.好感度 / 10) * 10);
const corruptionCapPct = computed(() => corruptionCap.value);
const corruptionPct = computed(() => teresaData.value.堕落值);

// ── 场景判断 ──────────────────────────────────
const isPrivate = computed(() => {
  const s = worldData.value.当前场景 ?? '';
  return ['私', '卧室', '浴室', '密室', '寝室'].some(kw => s.includes(kw));
});

// ── 阶段标题 ──────────────────────────────────
const stageTitle = computed(() => getStageTitle(teresaData.value.当前阶段));

// ── 主题类（5档） ─────────────────────────────
const themeClass = computed(() => {
  const s = teresaData.value.当前阶段;
  if (s <= 2) return 'th-holy';
  if (s <= 6) return 'th-waver';
  if (s <= 12) return 'th-fall';
  if (s <= 18) return 'th-corrupt';
  return 'th-beyond';
});

// ── 阶段徽章类 ────────────────────────────────
const badgeClass = computed(() => {
  const s = teresaData.value.当前阶段;
  if (s <= 2) return 'badge-holy';
  if (s <= 6) return 'badge-waver';
  if (s <= 12) return 'badge-fall';
  if (s <= 18) return 'badge-corrupt';
  return 'badge-beyond';
});

// ── 阶段点类 ──────────────────────────────────
function dotClass(n: number) {
  const s = teresaData.value.当前阶段;
  if (n === s) return 'dot-current';
  if (n < s) return 'dot-done';
  return '';
}

// ── 阶段点提示 ────────────────────────────────
const stageTitlesMap: Record<number, string> = {
  1: '圣洁威严',
  2: '暗流涌动',
  3: '心湖微澜',
  4: '欲念萌芽',
  5: '理智动摇',
  6: '欲火初燃',
  7: '情欲觉醒',
  8: '沉沦边缘',
  9: '肉欲支配',
  10: '欲望臣服',
  11: '淫欲放纵',
  12: '完全沉沦',
  13: '欲海沉浮',
  14: '灵肉献祭',
  15: '极致淫乱',
  16: '肉体烙印',
  17: '深度改造',
  18: '极限蜕变',
  19: '超越凡俗',
  20: '返璞归真',
};
function getDotTitle(n: number) {
  return `阶段${n}：${stageTitlesMap[n] ?? ''}`;
}
</script>

<style scoped>
/* ══ CSS 变量（主题） ══════════════════════════════════════ */
.th-holy {
  --pri: #c9a84c;
  --sec: #8b6a2a;
  --acc: #f5d87a;
  --bg1: #120d06;
  --bg2: #1e1509;
}
.th-waver {
  --pri: #9f6fc9;
  --sec: #6a4a8b;
  --acc: #d4a8f5;
  --bg1: #100a18;
  --bg2: #1a1228;
}
.th-fall {
  --pri: #c96fa0;
  --sec: #8b4a70;
  --acc: #f5a8d0;
  --bg1: #180a12;
  --bg2: #281220;
}
.th-corrupt {
  --pri: #c040c0;
  --sec: #802080;
  --acc: #f050f0;
  --bg1: #140814;
  --bg2: #201020;
}
.th-beyond {
  --pri: #7050d0;
  --sec: #4a3098;
  --acc: #a080ff;
  --bg1: #080514;
  --bg2: #120a28;
}

/* ══ 容器 ══════════════════════════════════════════════════ */
.monastery-wrap {
  width: 100%;
  padding: 10px 12px 12px;
  background: linear-gradient(160deg, var(--bg1) 0%, var(--bg2) 100%);
  background-attachment: local;
  font-family: 'Noto Serif SC', 'SimSun', serif;
  color: #ddd;
  position: relative;
}

/* 羊皮纸纹路 */
.monastery-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 28px,
      rgba(255, 255, 255, 0.02) 28px,
      rgba(255, 255, 255, 0.02) 29px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 28px,
      rgba(255, 255, 255, 0.015) 28px,
      rgba(255, 255, 255, 0.015) 29px
    );
  pointer-events: none;
  z-index: 0;
}

.monastery-wrap > * {
  position: relative;
  z-index: 1;
}

/* 加载态 */
.monastery-wrap.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.load-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 0;
}
.cross-icon {
  font-size: 28px;
  color: #c9a84c;
  animation: holy-pulse 2s ease-in-out infinite;
}
.load-text {
  font-size: 14px;
  color: #a0906a;
  letter-spacing: 2px;
  animation: holy-pulse 2s ease-in-out infinite;
}

@keyframes holy-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

/* ══ 装饰横线 ══════════════════════════════════════════════ */
.orn-line {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--pri) 20%, var(--acc) 50%, var(--pri) 80%, transparent 100%);
  margin: 6px 0;
  position: relative;
}

.orn-line.top::before,
.orn-line.top::after,
.orn-line.bottom::before,
.orn-line.bottom::after {
  content: '✦';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: var(--acc);
  background: var(--bg1);
  padding: 0 4px;
}
.orn-line.top::before,
.orn-line.bottom::before {
  left: 8px;
}
.orn-line.top::after,
.orn-line.bottom::after {
  right: 8px;
}

/* ══ 头部 ══════════════════════════════════════════════════ */
.hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0;
}

.hd-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #907060;
  letter-spacing: 0.5px;
}
.hd-sep {
  color: var(--pri);
  opacity: 0.5;
}
.hd-date,
.hd-time {
  color: #b09070;
}

/* 阶段徽章 */
.stage-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--pri);
  font-size: 12px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--pri) 40%, transparent);
}
.badge-num {
  font-size: 18px;
  font-weight: bold;
  color: var(--acc);
  line-height: 1;
}
.badge-title {
  color: var(--pri);
  letter-spacing: 1px;
}

.badge-holy {
  background: rgba(201, 168, 76, 0.12);
}
.badge-waver {
  background: rgba(159, 111, 201, 0.12);
}
.badge-fall {
  background: rgba(201, 111, 160, 0.12);
}
.badge-corrupt {
  background: rgba(192, 64, 192, 0.12);
}
.badge-beyond {
  background: rgba(112, 80, 208, 0.12);
}

/* ══ 场景行 ═══════════════════════════════════════════════ */
.location-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.25);
  border-left: 2px solid var(--pri);
  margin-bottom: 8px;
  font-size: 13px;
}
.loc-icon {
  font-size: 14px;
}
.loc-name {
  color: var(--acc);
  font-weight: bold;
  flex: 1;
}
.scene-pill {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
}
.scene-pill.pub {
  background: rgba(60, 120, 60, 0.3);
  color: #90d090;
}
.scene-pill.priv {
  background: rgba(120, 40, 60, 0.35);
  color: #e09090;
}

/* ══ 角色名 ═══════════════════════════════════════════════ */
.char-name {
  text-align: center;
  font-size: 13px;
  color: var(--pri);
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}
.char-cross {
  font-size: 12px;
  opacity: 0.6;
}

/* ══ 数值面板 ════════════════════════════════════════════ */
.stats-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.stat-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 66px;
  font-size: 12px;
  color: #a09080;
}
.stat-icon {
  font-size: 13px;
}
.aff-icon {
  color: #e87090;
}
.cor-icon {
  color: #a060d0;
}

.bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-track {
  flex: 1;
  height: 10px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: visible;
}

.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
  position: relative;
  overflow: hidden;
}

.aff-fill {
  background: linear-gradient(90deg, #c0405a, #f08090);
}
.cor-fill {
  background: linear-gradient(90deg, #7030a0, #c060e0);
}

.bar-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% {
    left: -60%;
  }
  60%,
  100% {
    left: 120%;
  }
}

/* 上限标记 */
.cap-mark {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: #ffd700;
  border-radius: 1px;
  box-shadow: 0 0 5px rgba(255, 215, 0, 0.7);
  z-index: 2;
}

.bar-num {
  font-size: 12px;
  color: #c0b090;
  min-width: 44px;
  text-align: right;
}
.bar-cap {
  color: #706050;
}

.cap-tip {
  text-align: center;
  font-size: 10px;
  color: rgba(255, 215, 0, 0.5);
  margin-bottom: 10px;
}

/* 阶段区 */
.stage-section {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding-top: 10px;
}

.stage-num-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}
.sn-label {
  font-size: 11px;
  color: #808080;
}
.sn-value {
  font-size: 30px;
  font-weight: bold;
  color: var(--acc);
  text-shadow: 0 0 12px var(--pri);
  line-height: 1;
}
.sn-max {
  font-size: 14px;
  color: #404040;
}

.stage-dots {
  display: flex;
  justify-content: center;
  gap: 5px;
  flex-wrap: nowrap;
  margin-bottom: 4px;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.3s ease;
  cursor: default;
}
.dot-done {
  background: var(--sec);
  border-color: var(--pri);
}
.dot-current {
  background: var(--acc);
  border-color: #fff;
  box-shadow: 0 0 7px var(--acc);
  transform: scale(1.25);
  border-radius: 3px;
}

.stage-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #505050;
  padding: 0 2px;
}

/* ══ Tab 导航 ════════════════════════════════════════════ */
.tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0;
}

.tab-btn {
  flex: 1;
  padding: 6px 4px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #707070;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 1px;
}
.tab-btn:hover {
  color: var(--pri);
}
.tab-btn.active {
  color: var(--acc);
  border-bottom-color: var(--pri);
}

/* ══ Tab 面板 ════════════════════════════════════════════ */
.tab-panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 10px;
  margin-bottom: 8px;
}

/* 特征网格 */
.trait-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.trait-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.tc-icon {
  font-size: 13px;
}
.tc-lbl {
  font-size: 10px;
  color: var(--pri);
  letter-spacing: 1px;
}
.tc-val {
  font-size: 12px;
  color: #c0c0c0;
  line-height: 1.4;
}

/* 着装网格 */
.clothing-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cg-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
}
.cg-key {
  min-width: 36px;
  color: #807060;
}
.cg-val {
  flex: 1;
  color: #c8c0b0;
}
.scene-note {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  padding: 4px;
  border-radius: 4px;
}
.scene-note.pub {
  background: rgba(60, 120, 60, 0.15);
  color: #80c080;
}
.scene-note.priv {
  background: rgba(120, 40, 60, 0.2);
  color: #e09090;
}

/* 近期事务 */
.empty-tip {
  text-align: center;
  color: #505050;
  font-size: 12px;
  padding: 10px 0;
}
.affairs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.af-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  padding: 5px 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  border-left: 2px solid var(--sec);
}
.af-key {
  color: #a09070;
  min-width: 80px;
}
.af-val {
  flex: 1;
  color: #c0c0c0;
}

/* ══ 身体改造 ════════════════════════════════════════════ */
.mod-section {
  border: 1px solid rgba(192, 64, 192, 0.3);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}
.mod-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(120, 0, 120, 0.2);
  cursor: pointer;
  font-size: 13px;
  color: #d080d0;
  user-select: none;
}
.mod-header:hover {
  background: rgba(120, 0, 120, 0.3);
}
.mod-icon {
  font-size: 14px;
}
.toggle-icon {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.6;
}
.mod-list {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
}
.mod-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(192, 64, 192, 0.15);
  color: #c0b0c0;
}
.mod-item:last-child {
  border-bottom: none;
}
.mod-k {
  min-width: 60px;
  color: #a060a0;
}
.mod-v {
  flex: 1;
}
.mod-item.tattoo .mod-k {
  color: #d080c0;
}
.mod-item.tattoo .mod-v {
  color: #f0a0e0;
}
</style>
