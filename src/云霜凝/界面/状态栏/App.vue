<template>
  <div class="frost-container">
    <div class="bg-pattern"></div>
    <div class="main-panel">
      <div class="panel-decor top"></div>

      <!-- 顶栏 -->
      <header class="header">
        <div class="world-info">
          <span class="info-item">第 <b>{{ store.data.时间.第几天 }}</b> 天</span>
          <span class="divider">·</span>
          <span class="info-item">{{ formatted_time }}</span>
          <span class="divider">·</span>
          <span class="info-item ling">灵石 <b class="ling-val">{{ store.data.系统.灵石 }}</b></span>
        </div>
        <span class="mode-tag" :class="mode_class">{{ store.data._当前互动模式 }}</span>
      </header>

      <!-- 打断冻结警告 -->
      <div v-if="freeze_remaining > 0" class="interrupt-banner">
        ⚠ 苗广打断治疗，暂时无法继续
      </div>

      <!-- 治疗进度 -->
      <section class="healing-section">
        <div class="healing-meta">
          <span class="heal-stage">阶段 {{ store.data.治疗.阶段 }}·{{ stage_name }}</span>
          <span class="heal-pct">{{ store.data.治疗.完成度.toFixed(1) }}%</span>
        </div>
        <div class="healing-track">
          <div class="healing-fill" :style="{ width: store.data.治疗.完成度 + '%' }"></div>
          <div v-for="n in 9" :key="n" class="stage-tick" :style="{ left: n * 10 + '%' }"></div>
        </div>
      </section>

      <!-- 神魂空间入口 -->
      <div class="mode-entry">
        <template v-if="store.data._当前互动模式 === '神魂空间'">
          <button class="mode-btn soul-btn active" @click="exitSoulSpace">⟨ 退出神魂 ⟩</button>
        </template>
        <template v-else-if="store.data._神魂空间已解锁">
          <button class="mode-btn soul-btn" @click="enterSoulSpace">⟨ 进入神魂 ⟩</button>
        </template>
        <template v-else>
          <button class="mode-btn soul-btn locked" disabled>⟨ 等待接引 ⟩</button>
        </template>
      </div>

      <!-- 标签页 -->
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: active_tab === tab.id }"
          @click="toggleTab(tab.id)"
        >{{ tab.label }}</button>
      </nav>

      <!-- 面板内容 -->
      <div v-if="active_tab" class="content-area">
        <YunPanel  v-if="active_tab === '云霜凝'" />
        <MiaoPanel v-else-if="active_tab === '苗广'" />
        <ShopPanel v-else-if="active_tab === '商店'" />
      </div>

      <div class="panel-decor bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from './store';
import YunPanel  from './components/YunPanel.vue';
import MiaoPanel from './components/MiaoPanel.vue';
import ShopPanel from './components/ShopPanel.vue';

const store = useDataStore();

const tabs = [
  { id: '云霜凝', label: '云霜凝' },
  { id: '苗广',   label: '苗广'   },
  { id: '商店',   label: '商店'   },
];
const active_tab = useLocalStorage<string | null>('云霜凝:status_bar:active_tab', null);

function toggleTab(id: string) {
  active_tab.value = active_tab.value === id ? null : id;
}

const STAGE_NAMES = ['', '破冰', '初感', '温润', '渐通', '融合', '深化', '贯通', '共鸣', '圆融', '圆满'];
const stage_name = computed(() => STAGE_NAMES[Math.min(10, Math.max(1, store.data.治疗.阶段))] ?? '');

const formatted_time = computed(() => {
  const h = store.data.时间.当前小时;
  const hour = Math.floor(h);
  const min  = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
});

const freeze_remaining = computed(() => {
  const floor = (window as any).SillyTavern?.chat?.length ?? 0;
  return floor > 0 ? Math.max(0, store.data._打断冻结至楼层 - floor) : 0;
});

const mode_class = computed(() => ({
  'mode-soul':  store.data._当前互动模式 === '神魂空间',
  'mode-real':  store.data._当前互动模式 === '现实互动',
  'mode-daily': store.data._当前互动模式 === '日常',
}));

/** 检查当前状态栏是否属于最新消息 */
function isLatestMessage(): boolean {
  const currentId = getCurrentMessageId();
  const chat = (window as any).SillyTavern?.chat;
  if (!chat || chat.length === 0) return true;
  return currentId === chat.length - 1;
}

function enterSoulSpace() {
  if (!isLatestMessage()) return;
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件
  store.data._当前互动模式 = '神魂空间';
  store.data._神魂空间激活中 = true;
  const existing = store.data._待发送道具事件;
  const event = '__神魂空间入口__';
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.flush();
}

function exitSoulSpace() {
  if (!isLatestMessage()) return;
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件
  store.data._当前互动模式 = '日常';
  store.data._神魂空间激活中 = false;
  const existing = store.data._待发送道具事件;
  const event = '__退出神魂空间__';
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.data._系统操作中 = true;
  store.flush();
  triggerSlash('/send （退出神魂空间）|/trigger');
}
</script>

<style lang="scss" scoped>
// ── 色彩系统（绛红主题） ──
$c-bg:      #0c0406;
$c-bg2:     #1a0a10;
$c-ice:     #c03050;
$c-ice-dim: #8a2038;
$c-acc:     #ff6080;
$c-frost:   #ffd0d8;
$c-text:    #ffe8ec;
$c-sub:     #a07080;
$c-gold:    #e8be58;
$c-danger:  #e05050;
$c-good:    #40c880;
$font-main: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif;

.frost-container {
  width: 100%;
  position: relative;
  background: linear-gradient(170deg, $c-bg 0%, #0c0a1e 30%, $c-bg2 60%, darken($c-bg, 2%) 100%);
  color: $c-text;
  font-family: $font-main;
  font-size: 14px;
  line-height: 1.5;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% -5%, rgba($c-ice, 0.15), transparent 50%),
      radial-gradient(ellipse at 85% 105%, rgba($c-ice-dim, 0.1), transparent 50%),
      radial-gradient(circle at 50% 50%, rgba($c-acc, 0.02), transparent 70%);
    pointer-events: none;
  }
}

.bg-pattern {
  position: absolute; inset: 0;
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 20px, rgba($c-ice, 0.018) 20px, rgba($c-ice, 0.018) 21px),
    repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba($c-ice, 0.012) 20px, rgba($c-ice, 0.012) 21px);
  pointer-events: none;
}

.main-panel {
  position: relative;
  border: 1px solid rgba($c-ice, 0.18);
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba($c-ice, 0.04),
    inset 0 1px 0 rgba($c-frost, 0.05);
}

.panel-decor {
  height: 2px;
  background: linear-gradient(90deg, transparent 2%, $c-ice-dim 20%, $c-acc 50%, $c-ice-dim 80%, transparent 98%);
  opacity: 0.8;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: -1px 30% -1px 30%;
    background: rgba($c-acc, 0.3);
    filter: blur(4px);
    pointer-events: none;
  }

  &.bottom {
    background: linear-gradient(90deg, transparent 5%, rgba($c-ice, 0.3) 30%, rgba($c-acc, 0.2) 50%, rgba($c-ice, 0.3) 70%, transparent 95%);
    height: 1px;
    &::after { display: none; }
  }
}

// ━━━ 顶栏 ━━━
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.1);
  background: linear-gradient(180deg, rgba($c-ice, 0.04) 0%, rgba($c-ice, 0.01) 100%);
  backdrop-filter: blur(8px);
  flex-wrap: wrap; gap: 8px;
}
.world-info {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.9rem; color: $c-sub;
}
.info-item {
  display: inline-flex; align-items: center; gap: 3px;

  b {
    color: $c-frost;
    text-shadow: 0 0 8px rgba($c-acc, 0.2);
    font-weight: 800;
  }
}
.ling {
  padding: 2px 8px;
  background: linear-gradient(135deg, rgba($c-gold, 0.08) 0%, rgba($c-gold, 0.02) 100%);
  border: 1px solid rgba($c-gold, 0.15);
  border-radius: 12px;
}
.ling-val {
  color: $c-gold;
  text-shadow: 0 0 8px rgba($c-gold, 0.25);
  font-weight: 900;
}
.divider { opacity: 0.15; color: $c-ice; font-size: 0.6em; }

.mode-tag {
  font-size: 0.75rem; font-weight: bold;
  padding: 4px 14px; border-radius: 14px;
  border: 1px solid; letter-spacing: 0.8px;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}
.mode-soul {
  color: #ff8898;
  border-color: rgba(#ff6080, 0.4);
  background: linear-gradient(135deg, rgba(#ff6080, 0.12) 0%, rgba(#ff6080, 0.04) 100%);
  box-shadow: 0 0 12px rgba(#ff6080, 0.15), inset 0 0 8px rgba(#ff6080, 0.05);
}
.mode-real {
  color: lighten($c-good, 8%);
  border-color: rgba($c-good, 0.4);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.04) 100%);
  box-shadow: 0 0 12px rgba($c-good, 0.15), inset 0 0 8px rgba($c-good, 0.05);
}
.mode-daily {
  color: rgba($c-sub, 0.8);
  border-color: rgba($c-sub, 0.2);
  background: rgba($c-sub, 0.04);
}

// ━━━ 中断警告 ━━━
.interrupt-banner {
  background: linear-gradient(90deg, rgba($c-danger, 0.12) 0%, rgba($c-danger, 0.06) 50%, rgba($c-danger, 0.12) 100%);
  border-bottom: 1px solid rgba($c-danger, 0.25);
  color: $c-danger;
  font-size: 0.82rem; font-weight: bold;
  padding: 6px 16px; text-align: center;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba($c-danger, 0.2);
  animation: bannerPulse 2s ease-in-out infinite;
}
@keyframes bannerPulse {
  0%, 100% { background-color: rgba($c-danger, 0.06); }
  50% { background-color: rgba($c-danger, 0.1); }
}

// ━━━ 治疗进度 ━━━
.healing-section {
  padding: 12px 16px 14px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.healing-meta {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 8px; font-size: 0.78rem;
}
.heal-stage {
  color: $c-acc; font-weight: bold;
  font-size: 0.88rem;
  letter-spacing: 0.8px;
  text-shadow: 0 0 6px rgba($c-acc, 0.15);
}
.heal-pct {
  color: $c-frost; font-weight: 900;
  font-size: 1.05rem;
  text-shadow: 0 0 8px rgba($c-ice, 0.25);
}
.healing-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba($c-ice, 0.15);
  border-radius: 5px;
  position: relative; overflow: visible;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
.healing-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, $c-ice-dim, $c-ice, $c-acc);
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba($c-ice, 0.4), 0 0 4px rgba($c-acc, 0.3);

  &::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.18) 0%, rgba(#fff, 0.05) 40%, transparent 60%);
    border-radius: 5px;
  }
}
.stage-tick {
  position: absolute; top: -4px; bottom: -4px;
  width: 1px;
  background: rgba($c-frost, 0.18);
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: -1px; left: -1px;
    width: 3px; height: 3px;
    border-radius: 50%;
    background: rgba($c-frost, 0.25);
  }
}

// ━━━ 模式入口 ━━━
.mode-entry {
  display: flex; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.mode-btn {
  flex: 1; padding: 10px;
  border: 1px solid; border-radius: 8px;
  font-size: 0.86rem; font-family: $font-main;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: bold; letter-spacing: 1.5px;
  position: relative; overflow: hidden;

  &::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.04) 0%, transparent 50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover::before { opacity: 1; }
}
.soul-btn {
  color: #ff6080;
  border-color: rgba(#ff6080, 0.2);
  background: transparent;

  &:hover:not(:disabled) {
    background: rgba(#ff6080, 0.06);
    border-color: rgba(#ff6080, 0.4);
    box-shadow: 0 0 16px rgba(#ff6080, 0.08);
  }
  &.active {
    color: #fff;
    border-color: rgba(#ff6080, 0.5);
    background: linear-gradient(135deg, rgba(#ff6080, 0.15) 0%, rgba(#ff6080, 0.06) 100%);
    box-shadow: 0 0 16px rgba(#ff6080, 0.15), inset 0 0 12px rgba(#ff6080, 0.05);
    text-shadow: 0 0 8px rgba(#ff6080, 0.4);
  }
  &.locked {
    color: rgba($c-sub, 0.3);
    border-color: rgba($c-sub, 0.1);
    cursor: not-allowed;
    opacity: 0.4;
  }
}

// ━━━ 标签页 ━━━
.tabs {
  display: flex;
  padding: 6px 10px;
  gap: 4px;
  background: rgba($c-ice, 0.02);
  border-bottom: 1px solid rgba($c-ice, 0.06);
}
.tab-btn {
  flex: 1; padding: 9px 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: $c-sub;
  font-size: 0.92rem; font-family: $font-main;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative; letter-spacing: 0.8px;
  text-align: center;

  &:hover {
    color: $c-frost;
    background: rgba($c-ice, 0.06);
    border-color: rgba($c-ice, 0.08);
  }

  &.active {
    color: #fff; font-weight: bold;
    background: linear-gradient(135deg, rgba($c-ice, 0.12) 0%, rgba($c-acc, 0.08) 100%);
    border-color: rgba($c-acc, 0.2);
    box-shadow: 0 2px 8px rgba($c-ice, 0.1), inset 0 0 8px rgba($c-acc, 0.04);
    text-shadow: 0 0 8px rgba($c-acc, 0.3);
  }
}

// ━━━ 内容区 ━━━
.content-area {
  padding: 14px 16px;
  animation: contentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes contentIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

// ━━━ 移动端适配 ━━━
@media (max-width: 360px) {
  .header { padding: 10px 12px; gap: 6px; }
  .world-info { gap: 6px; font-size: 0.78rem; }
  .healing-section { padding: 10px 12px 12px; }
  .mode-entry { padding: 8px 12px; }
  .tabs { padding: 4px 8px; }
  .content-area { padding: 12px; }
}
</style>
