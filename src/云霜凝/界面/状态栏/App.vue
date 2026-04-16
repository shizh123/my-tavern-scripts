<template>
  <div class="frost-container" :class="{ 'container-dead': is_bad_ending }">
    <div class="bg-pattern"></div>
    <div
      class="main-panel"
      :class="{ 'panel-frozen': freeze_remaining > 0 && !is_bad_ending, 'panel-dead': is_bad_ending }"
    >
      <div class="panel-decor top" :class="{ 'decor-dead': is_bad_ending }"></div>

      <!-- ═══ 坏结局覆盖层 ═══ -->
      <template v-if="is_bad_ending">
        <div class="bad-ending-overlay">
          <div class="bad-ending-icon">💀</div>
          <div class="bad-ending-title">游戏结束</div>
          <div class="bad-ending-subtitle">苗广的愤怒不可逆转</div>
          <div class="bad-ending-divider"></div>
          <div class="bad-ending-text">
            三百年道侣的信任，在这一刻碎裂殆尽。<br />
            苗广确认了一切——愤怒、背叛、不可原谅。<br />
            治疗终止。云霜凝被带走。<br />
            寒霜门的禁制已将你永远拒之门外。
          </div>
          <div class="bad-ending-stats">
            <span>{{ store.data.时间.玄霜历 }}</span>
            <span class="bad-divider">·</span>
            <span
              >治疗完成 <b>{{ store.data.治疗.完成度.toFixed(1) }}%</b></span
            >
            <span class="bad-divider">·</span>
            <span
              >最终阶段 <b>{{ stage_name }}</b></span
            >
          </div>
          <div class="bad-ending-footer">一切不可挽回。</div>
        </div>
      </template>

      <!-- ═══ 正常游戏UI ═══ -->
      <template v-else>
        <!-- 顶栏 -->
        <header class="header">
          <div class="world-info">
            <span class="info-item">{{ store.data.时间.玄霜历 || '玄霜历九百七十三年·霜降月' }}</span>
            <span class="divider">·</span>
            <span class="info-item ling"
              >灵石 <b class="ling-val">{{ store.data.系统.灵石 }}</b></span
            >
          </div>
          <span class="mode-tag" :class="mode_class">{{ store.data._当前互动模式 }}</span>
        </header>

        <!-- 打断冻结警告 -->
        <div v-if="freeze_remaining > 0" class="interrupt-banner">
          ⚠ 苗广监视中 · 治疗冻结（剩余 {{ freeze_remaining }} 楼）
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
            <button class="mode-btn soul-btn active" @click="exitSoulSpace">
              ⟨ 退出{{ store.data._当前神魂空间角色 === '洛书晴' ? '洛书晴神魂' : '神魂' }} ⟩
            </button>
          </template>
          <template v-else-if="store.data._神魂空间已解锁 && freeze_remaining <= 0">
            <button class="mode-btn soul-btn" @click="handleEnterSoulClick">⟨ 进入神魂 ⟩</button>
          </template>
          <template v-else-if="store.data._神魂空间已解锁 && freeze_remaining > 0">
            <button class="mode-btn soul-btn locked" disabled>⟨ 监视中({{ freeze_remaining }}楼) ⟩</button>
          </template>
          <template v-else>
            <button class="mode-btn soul-btn locked" disabled>⟨ 等待接引 ⟩</button>
          </template>
        </div>

        <!-- 神魂空间角色选择浮层（洛书晴激活后） -->
        <Teleport to="body">
          <div v-if="showSoulPicker" class="soul-picker-mask" @click.self="showSoulPicker = false">
            <div class="soul-picker-dialog">
              <div class="soul-picker-title">进入谁的神魂空间？</div>
              <button class="soul-picker-opt" @click="enterSoulSpaceFor('云霜凝')">
                <div class="soul-picker-name">云霜凝</div>
                <div class="soul-picker-sub">霜雪意识空间</div>
              </button>
              <button class="soul-picker-opt luo" @click="enterSoulSpaceFor('洛书晴')">
                <div class="soul-picker-name">洛书晴</div>
                <div class="soul-picker-sub">闺房意识空间</div>
              </button>
              <button class="soul-picker-cancel" @click="showSoulPicker = false">取消</button>
            </div>
          </div>
        </Teleport>

        <!-- 标签页 -->
        <nav class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: active_tab === tab.id }"
            @click="toggleTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- 面板内容 -->
        <div v-if="active_tab" class="content-area">
          <YunPanel v-if="active_tab === '云霜凝'" />
          <LuoPanel v-else-if="active_tab === '洛书晴'" />
          <MiaoPanel v-else-if="active_tab === '苗广'" />
          <MiaoXuanPanel v-else-if="active_tab === '苗喧'" />
          <ShopPanel v-else-if="active_tab === '商店'" />
        </div>
      </template>

      <div class="panel-decor bottom" :class="{ 'decor-dead': is_bad_ending }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from './store';
import YunPanel from './components/YunPanel.vue';
import LuoPanel from './components/LuoPanel.vue';
import MiaoPanel from './components/MiaoPanel.vue';
import MiaoXuanPanel from './components/MiaoXuanPanel.vue';
import ShopPanel from './components/ShopPanel.vue';

const store = useDataStore();

const tabs = computed(() => {
  const base = [
    { id: '云霜凝', label: '云霜凝' },
    { id: '苗广', label: '苗广' },
  ];
  // 洛书晴激活后：新增洛书晴 + 苗喧 tab
  if (store.data._洛书晴线已激活) {
    base.push({ id: '洛书晴', label: '洛书晴' }, { id: '苗喧', label: '苗喧' });
  }
  base.push({ id: '商店', label: '商店' });
  return base;
});
const active_tab = useLocalStorage<string | null>('云霜凝:status_bar:active_tab', null);
const showSoulPicker = ref(false);

function toggleTab(id: string) {
  active_tab.value = active_tab.value === id ? null : id;
}

const STAGE_NAMES = ['', '破冰', '初感', '温润', '渐通', '融合', '深化', '贯通', '共鸣', '圆融', '圆满'];
const stage_name = computed(() => STAGE_NAMES[Math.min(10, Math.max(1, store.data.治疗.阶段))] ?? '');

const freeze_remaining = computed(() => {
  const floor = (window as any).SillyTavern?.chat?.length ?? 0;
  return floor > 0 ? Math.max(0, store.data._打断冻结至楼层 - floor) : 0;
});

const is_bad_ending = computed(() => !!store.data._坏结局已触发);

const mode_class = computed(() => ({
  'mode-soul': store.data._当前互动模式 === '神魂空间',
  'mode-real': store.data._当前互动模式 === '现实互动',
  'mode-daily': store.data._当前互动模式 === '日常',
}));

/** 检查当前状态栏是否属于最新消息 */
function isLatestMessage(): boolean {
  const currentId = getCurrentMessageId();
  const chat = (window as any).SillyTavern?.chat;
  if (!chat || chat.length === 0) return true;
  return currentId === chat.length - 1;
}

function handleEnterSoulClick() {
  if (!isLatestMessage()) return;
  // 多轮脚本剧情排他：任何脚本驱动的多轮副本进行中时，禁止进入神魂空间
  if (store.data._特殊场景.进行中) return;
  if (store.data.苗广.千晶幻术.激活中) return;
  if (store.data.苗广.孝敬师父.激活中) return;
  // 洛书晴线已激活 → 弹角色选择浮层
  if (store.data._洛书晴线已激活) {
    showSoulPicker.value = true;
    return;
  }
  // 激活剧情进行中（兜底：理论上此时模式应已是神魂空间）
  if (store.data._洛书晴激活轮次进度 > 0) {
    enterSoulSpaceFor('洛书晴');
    return;
  }
  // 新婚夜已触发但激活剧情未开始 → 强制走洛书晴激活
  // 玩家以为是云霜凝的神魂空间，实际被潜意识拉入洛书晴的闺房意识
  if (store.data._新婚夜已触发) {
    enterSoulSpaceFor('洛书晴');
    return;
  }
  // 默认 → 进云霜凝（阶段3+首次会自动触发新婚夜）
  enterSoulSpaceFor('云霜凝');
}

function enterSoulSpaceFor(role: '云霜凝' | '洛书晴') {
  if (!isLatestMessage()) return;
  showSoulPicker.value = false;
  store.pull();
  store.data._当前神魂空间角色 = role;
  store.data._当前互动模式 = '神魂空间';
  store.data._神魂空间激活中 = true;
  // 显式锁定 _当前场景角色，不依赖 stateValidation 后置兜底
  // (历史 bug:某些事件链下 stateValidation 未跑/时序错位,actorLine 残留旧值)
  store.data._当前场景角色 = { 云霜凝: role === '云霜凝', 洛书晴: role === '洛书晴' };
  const existing = store.data._待发送道具事件;
  // 洛书晴首次进入尚未激活线时触发第一次激活剧情
  let event = '__神魂空间入口__';
  if (role === '洛书晴') {
    if (!store.data._洛书晴线已激活 && store.data._洛书晴激活轮次进度 === 0) {
      store.data._洛书晴激活轮次进度 = 1;
      event = '__洛书晴激活剧情_轮1__';
    } else {
      event = '__神魂空间入口_洛书晴__';
    }
  }
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.data._系统操作中 = true;
  store.flush();
  triggerSlash(`/send （进入${role}神魂空间）|/trigger`);
}

// 兼容占位：旧名称 enterSoulSpace 已合并进 handleEnterSoulClick

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

<style lang="scss">
// ── 神魂空间角色选择浮层（非 scoped，因 Teleport 到 body） ──
.soul-picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.soul-picker-dialog {
  min-width: 280px;
  background: linear-gradient(170deg, #1a0a10 0%, #0c0406 100%);
  border: 1px solid rgba(192, 48, 80, 0.4);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.soul-picker-title {
  color: #ffe8ec;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 14px;
}
.soul-picker-opt {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 10px;
  background: rgba(192, 48, 80, 0.15);
  border: 1px solid rgba(192, 48, 80, 0.35);
  border-radius: 6px;
  color: #ffe8ec;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  &:hover {
    background: rgba(192, 48, 80, 0.3);
  }
  &.luo {
    background: rgba(211, 108, 134, 0.15);
    border-color: rgba(211, 108, 134, 0.4);
    &:hover {
      background: rgba(211, 108, 134, 0.3);
    }
  }
}
.soul-picker-name {
  font-size: 14px;
  font-weight: 600;
}
.soul-picker-sub {
  font-size: 11px;
  color: #a07080;
  margin-top: 2px;
}
.soul-picker-cancel {
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px solid rgba(160, 112, 128, 0.3);
  color: #a07080;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
  &:hover {
    color: #ffe8ec;
  }
}
</style>

<style lang="scss" scoped>
// ── 色彩系统（绛红主题） ──
$c-bg: #0c0406;
$c-bg2: #1a0a10;
$c-ice: #c03050;
$c-ice-dim: #8a2038;
$c-acc: #ff6080;
$c-frost: #ffd0d8;
$c-text: #ffe8ec;
$c-sub: #a07080;
$c-gold: #e8be58;
$c-danger: #e05050;
$c-good: #40c880;
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
  position: absolute;
  inset: 0;
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
  transition:
    border-color 0.6s,
    box-shadow 0.6s;

  &.panel-frozen {
    animation: frozenGlow 2.5s ease-in-out infinite;
  }
}

@keyframes frozenGlow {
  0%,
  100% {
    border-color: rgba($c-ice, 0.25);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 8px rgba($c-ice, 0.08),
      inset 0 1px 0 rgba($c-frost, 0.05);
  }
  50% {
    border-color: rgba($c-acc, 0.5);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 20px rgba($c-acc, 0.2),
      0 0 40px rgba($c-ice, 0.1),
      inset 0 1px 0 rgba($c-frost, 0.08);
  }
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
    background: linear-gradient(
      90deg,
      transparent 5%,
      rgba($c-ice, 0.3) 30%,
      rgba($c-acc, 0.2) 50%,
      rgba($c-ice, 0.3) 70%,
      transparent 95%
    );
    height: 1px;
    &::after {
      display: none;
    }
  }
}

// ━━━ 顶栏 ━━━
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.1);
  background: linear-gradient(180deg, rgba($c-ice, 0.04) 0%, rgba($c-ice, 0.01) 100%);
  backdrop-filter: blur(8px);
  flex-wrap: wrap;
  gap: 8px;
}
.world-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: $c-sub;
}
.info-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;

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
.divider {
  opacity: 0.15;
  color: $c-ice;
  font-size: 0.6em;
}
.mode-tag {
  font-size: 0.75rem;
  font-weight: bold;
  padding: 4px 14px;
  border-radius: 14px;
  border: 1px solid;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}
.mode-soul {
  color: #ff8898;
  border-color: rgba(#ff6080, 0.4);
  background: linear-gradient(135deg, rgba(#ff6080, 0.12) 0%, rgba(#ff6080, 0.04) 100%);
  box-shadow:
    0 0 12px rgba(#ff6080, 0.15),
    inset 0 0 8px rgba(#ff6080, 0.05);
}
.mode-real {
  color: lighten($c-good, 8%);
  border-color: rgba($c-good, 0.4);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.04) 100%);
  box-shadow:
    0 0 12px rgba($c-good, 0.15),
    inset 0 0 8px rgba($c-good, 0.05);
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
  font-size: 0.82rem;
  font-weight: bold;
  padding: 6px 16px;
  text-align: center;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba($c-danger, 0.2);
  animation: bannerPulse 2s ease-in-out infinite;
}
@keyframes bannerPulse {
  0%,
  100% {
    background-color: rgba($c-danger, 0.06);
  }
  50% {
    background-color: rgba($c-danger, 0.1);
  }
}

// ━━━ 治疗进度 ━━━
.healing-section {
  padding: 12px 16px 14px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.healing-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 0.78rem;
}
.heal-stage {
  color: $c-acc;
  font-weight: bold;
  font-size: 0.88rem;
  letter-spacing: 0.8px;
  text-shadow: 0 0 6px rgba($c-acc, 0.15);
}
.heal-pct {
  color: $c-frost;
  font-weight: 900;
  font-size: 1.05rem;
  text-shadow: 0 0 8px rgba($c-ice, 0.25);
}
.healing-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba($c-ice, 0.15);
  border-radius: 5px;
  position: relative;
  overflow: visible;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
.healing-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, $c-ice-dim, $c-ice, $c-acc);
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 12px rgba($c-ice, 0.4),
    0 0 4px rgba($c-acc, 0.3);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.18) 0%, rgba(#fff, 0.05) 40%, transparent 60%);
    border-radius: 5px;
  }
}
.stage-tick {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: rgba($c-frost, 0.18);
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba($c-frost, 0.25);
  }
}

// ━━━ 模式入口 ━━━
.mode-entry {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.mode-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 0.86rem;
  font-family: $font-main;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: bold;
  letter-spacing: 1.5px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.04) 0%, transparent 50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover::before {
    opacity: 1;
  }
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
    box-shadow:
      0 0 16px rgba(#ff6080, 0.15),
      inset 0 0 12px rgba(#ff6080, 0.05);
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
  flex: 1;
  padding: 9px 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: $c-sub;
  font-size: 0.92rem;
  font-family: $font-main;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  letter-spacing: 0.8px;
  text-align: center;

  &:hover {
    color: $c-frost;
    background: rgba($c-ice, 0.06);
    border-color: rgba($c-ice, 0.08);
  }

  &.active {
    color: #fff;
    font-weight: bold;
    background: linear-gradient(135deg, rgba($c-ice, 0.12) 0%, rgba($c-acc, 0.08) 100%);
    border-color: rgba($c-acc, 0.2);
    box-shadow:
      0 2px 8px rgba($c-ice, 0.1),
      inset 0 0 8px rgba($c-acc, 0.04);
    text-shadow: 0 0 8px rgba($c-acc, 0.3);
  }
}

// ━━━ 内容区 ━━━
.content-area {
  padding: 14px 16px;
  animation: contentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes contentIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ━━━ 坏结局 ━━━
.container-dead {
  &::before {
    background:
      radial-gradient(ellipse at 50% 0%, rgba($c-danger, 0.12), transparent 60%),
      radial-gradient(ellipse at 50% 100%, rgba(0, 0, 0, 0.5), transparent 70%);
  }
}

.panel-dead {
  animation: deadGlow 3s ease-in-out infinite;
  border-color: rgba($c-danger, 0.3);
}

@keyframes deadGlow {
  0%,
  100% {
    border-color: rgba($c-danger, 0.2);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.6),
      0 0 12px rgba($c-danger, 0.08),
      inset 0 0 30px rgba(0, 0, 0, 0.3);
  }
  50% {
    border-color: rgba($c-danger, 0.45);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.6),
      0 0 25px rgba($c-danger, 0.15),
      0 0 50px rgba($c-danger, 0.06),
      inset 0 0 30px rgba(0, 0, 0, 0.3);
  }
}

.decor-dead {
  background: linear-gradient(
    90deg,
    transparent 5%,
    rgba($c-danger, 0.25) 30%,
    rgba($c-danger, 0.4) 50%,
    rgba($c-danger, 0.25) 70%,
    transparent 95%
  );
  opacity: 0.6;

  &::after {
    background: rgba($c-danger, 0.2);
  }

  &.bottom {
    background: linear-gradient(
      90deg,
      transparent 5%,
      rgba($c-danger, 0.15) 30%,
      rgba($c-danger, 0.25) 50%,
      rgba($c-danger, 0.15) 70%,
      transparent 95%
    );
  }
}

.bad-ending-overlay {
  padding: 28px 20px 24px;
  text-align: center;
  animation: badEndingFadeIn 1.2s ease-out;
}

@keyframes badEndingFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bad-ending-icon {
  font-size: 2.4rem;
  margin-bottom: 10px;
  animation: iconPulse 3s ease-in-out infinite;
  filter: grayscale(0.3);
}

@keyframes iconPulse {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.bad-ending-title {
  font-size: 1.4rem;
  font-weight: 900;
  color: $c-danger;
  letter-spacing: 4px;
  text-shadow:
    0 0 16px rgba($c-danger, 0.35),
    0 0 40px rgba($c-danger, 0.1);
  margin-bottom: 4px;
}

.bad-ending-subtitle {
  font-size: 0.82rem;
  color: rgba($c-danger, 0.7);
  letter-spacing: 1.5px;
  font-weight: 600;
  margin-bottom: 16px;
}

.bad-ending-divider {
  width: 60%;
  height: 1px;
  margin: 0 auto 16px;
  background: linear-gradient(90deg, transparent, rgba($c-danger, 0.3), transparent);
}

.bad-ending-text {
  font-size: 0.86rem;
  line-height: 2;
  color: rgba($c-frost, 0.6);
  font-style: italic;
  letter-spacing: 0.5px;
  margin-bottom: 20px;
}

.bad-ending-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: rgba($c-sub, 0.7);
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba($c-danger, 0.12);
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  b {
    color: rgba($c-frost, 0.8);
    font-weight: 800;
  }
}

.bad-divider {
  color: rgba($c-danger, 0.25);
  font-size: 0.6em;
}

.bad-ending-footer {
  font-size: 0.75rem;
  color: rgba($c-danger, 0.4);
  letter-spacing: 2px;
  font-weight: 600;
}

// ━━━ 移动端适配 ━━━
@media (max-width: 360px) {
  .header {
    padding: 10px 12px;
    gap: 6px;
  }
  .world-info {
    gap: 6px;
    font-size: 0.78rem;
  }
  .healing-section {
    padding: 10px 12px 12px;
  }
  .mode-entry {
    padding: 8px 12px;
  }
  .tabs {
    padding: 4px 8px;
  }
  .content-area {
    padding: 12px;
  }
}
</style>
