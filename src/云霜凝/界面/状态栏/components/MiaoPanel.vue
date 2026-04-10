<template>
  <div class="miao-panel">
    <!-- 苗广状态卡 -->
    <div class="card card-main">
      <div class="section-title"><span class="decor-line"></span><span>苗广</span><span class="decor-line"></span></div>

      <div class="badges-row">
        <div class="badge" :class="mindClass">{{ store.data.苗广.心态 }}</div>
      </div>

      <!-- 疑心值 / 绿帽值 -->
      <div class="stat-row">
        <span class="stat-lbl">{{ isBackHalf ? '绿帽值' : '疑心值' }}</span>
        <div class="track">
          <div class="fill sus" :class="susClass" :style="{ width: store.data.苗广.疑心值 + '%' }"></div>
          <template v-if="isBackHalf">
            <div class="tick" style="left: 40%"></div>
            <div class="tick" style="left: 75%"></div>
          </template>
          <template v-else>
            <div class="tick" style="left: 25%"></div>
            <div class="tick" style="left: 50%"></div>
            <div class="tick" style="left: 70%"></div>
          </template>
        </div>
        <span class="stat-num">{{ store.data.苗广.疑心值 }}</span>
        <span class="sus-stage" :class="susClass">{{ sus_stage }}</span>
      </div>

      <!-- 孝敬师父按钮 -->
      <div v-if="xjVisible" class="xj-actions">
        <span v-if="xjData.激活中" class="xj-state xj-on">孝敬中 · 第{{ xjCurrentRound }}/3轮</span>
        <template v-else>
          <button class="qj-btn qj-btn-xj" :disabled="!xjCanStart" @click="startXiaojing">⟨ 孝敬师父 ⟩</button>
          <span v-if="xjCooling" class="xj-cd">冷却 {{ xjCdRemain }} 楼</span>
        </template>
      </div>

      <!-- 净灵铃摇铃按钮 -->
      <div v-if="jllEquipped" class="jll-actions">
        <button class="qj-btn qj-btn-jll" :disabled="!jllCanUse" @click="ringBell">⟨ 摇铃 ⟩</button>
        <span v-if="jllOnCooldown" class="jll-cd">冷却中</span>
      </div>
    </div>

    <!-- 千晶幻术卡 -->
    <div class="card card-qj">
      <div class="qj-row">
        <span class="qj-lbl">千晶幻术</span>
        <span v-if="qj.认知改写完成" class="qj-state qj-done">已完成</span>
        <span v-else-if="qj.激活中" class="qj-state qj-on"
          >施术中 · 第{{ qjCurrentRound }}/{{ qjMaxRoundsDisplay }}轮</span
        >
        <span v-else-if="!qjUnlocked" class="qj-locked">阶段≥7 · 苗广≥屈辱</span>
        <span v-else-if="qjCooling" class="qj-cd">冷却 {{ qjCdRemain }} 楼</span>
        <span v-else class="qj-state">就绪</span>

        <span v-if="qj.已使用次数 > 0 && !qj.认知改写完成" class="qj-uses"> {{ qj.已使用次数 }}/3次</span>
      </div>

      <!-- 施术/退出按钮 -->
      <div v-if="!qj.认知改写完成" class="qj-actions">
        <template v-if="qj.激活中">
          <button class="qj-btn qj-btn-exit" @click="exitQianjing">⟨ 退出幻术 ⟩</button>
        </template>
        <template v-else>
          <button class="qj-btn qj-btn-cast" :disabled="!qjCanCast" @click="castQianjing">⟨ 施术 ⟩</button>
        </template>
      </div>

      <div v-if="qj.幻境摘要" class="thought-box qj-content">
        {{ qj.幻境摘要 }}
      </div>
    </div>

    <!-- 心理活动 -->
    <template v-if="store.data.苗广.心理活动">
      <div class="section-title sec-thought">
        <span class="decor-line"></span><span>苗广心理</span><span class="decor-line"></span>
      </div>
      <div class="thought-box">{{ store.data.苗广.心理活动 }}</div>
    </template>

    <!-- 苗喧碎片 -->
    <template v-if="store.data._苗喧碎片">
      <div class="section-title sec-miaoxuan">
        <span class="decor-line"></span><span>苗喧·碎片</span><span class="decor-line"></span>
      </div>
      <div class="thought-box miaoxuan-box">{{ store.data._苗喧碎片 }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';
import { useJingLingLing } from '../../../脚本/游戏逻辑/shopSystem';
import { pickXiaojingScenarioIndex } from '../../../脚本/游戏逻辑/promptInjection';
const store = useDataStore();

/** 检查当前状态栏是否属于最新消息，旧楼层不允许操作 */
function isLatestMessage(): boolean {
  const currentId = getCurrentMessageId();
  const chat = (window as any).SillyTavern?.chat;
  if (!chat || chat.length === 0) return true;
  return currentId === chat.length - 1;
}

const qj = computed(() => store.data.苗广.千晶幻术);

// ── 净灵铃 ──
const jllEquipped = computed(() => store.data.系统.道具状态['净灵铃'] === '使用中');
const jllOnCooldown = computed(() => {
  const currentFloor = (globalThis as any).SillyTavern?.chat?.length ?? 0;
  const lastUsed = store.data._净灵铃上次使用楼层;
  return lastUsed > 0 && currentFloor > 0 && currentFloor - lastUsed < 10;
});
const jllCanUse = computed(() => jllEquipped.value && !jllOnCooldown.value);

function ringBell() {
  if (!jllCanUse.value || !isLatestMessage()) return;
  const result = useJingLingLing(store.data);
  if (result.success) {
    store.data._系统操作中 = true;
    store.flush();
    triggerSlash('/send （摇铃召唤苗广）|/trigger');
  }
}

// ── 孝敬师父 ──
const xjData = computed(() => store.data.苗广.孝敬师父);

// 仅前半程（非绿帽线路）、阶段2+、非其他副本/模式冲突时可见
const xjVisible = computed(() => {
  const 心态 = store.data.苗广.心态;
  const 是前半程 = 心态 !== '屈辱' && 心态 !== '默许' && 心态 !== '沉溺';
  return 是前半程 && store.data.治疗.阶段 >= 2 && !store.data._坏结局已触发;
});

// 启动条件：排除所有不兼容状态
const xjCanStart = computed(() => {
  if (!xjVisible.value || xjData.value.激活中 || xjCooling.value) return false;
  // 神魂空间中不能孝敬师父（苗广感知不到神魂空间内的行为）
  if (store.data._当前互动模式 === '神魂空间') return false;
  // 千晶幻术激活中不能同时进行
  if (store.data.苗广.千晶幻术.激活中) return false;
  // 特殊场景进行中不能同时进行
  if (store.data._特殊场景.进行中) return false;
  return true;
});

const xjCooling = computed(() => {
  const cd = xjData.value.冷却结束楼层;
  return cd > 0 && getCurrentFloor() < cd;
});

const xjCdRemain = computed(() => Math.max(0, xjData.value.冷却结束楼层 - getCurrentFloor()));

const xjCurrentRound = computed(() => {
  const startFloor = store.data._孝敬师父开始楼层;
  if (!startFloor || !xjData.value.激活中) return 0;
  // 显示"已完成的轮数"：每2楼（user+AI）算1轮，clamp到最大轮数
  return Math.max(1, Math.min(3, Math.floor((getCurrentFloor() - startFloor) / 2)));
});

function startXiaojing() {
  if (!xjCanStart.value || !isLatestMessage()) return;
  store.pull();

  // 随机选场景（避免与上次重复）
  const scenarioIdx = pickXiaojingScenarioIndex(store.data.苗广.孝敬师父.上次场景索引);
  store.data.苗广.孝敬师父.激活中 = true;
  store.data.苗广.孝敬师父.上次场景索引 = scenarioIdx;
  store.data._孝敬师父开始楼层 = getCurrentFloor();

  const existing = store.data._待发送道具事件;
  store.data._待发送道具事件 = existing ? existing + '|||__孝敬师父_进入__' : '__孝敬师父_进入__';

  store.data._系统操作中 = true;
  store.flush();
  triggerSlash('/send （孝敬师父）|/trigger');
}

// ── 苗广心态 ──
const mindClass = computed(() => ({
  'mind-normal': store.data.苗广.心态 === '正常',
  'mind-doubt': store.data.苗广.心态 === '疑惑',
  'mind-aware': store.data.苗广.心态 === '察觉',
  danger: store.data.苗广.心态 === '愤怒',
  'mind-humble': store.data.苗广.心态 === '屈辱',
  'mind-permit': store.data.苗广.心态 === '默许',
  'mind-sink': store.data.苗广.心态 === '沉溺',
}));

// 后半程判定：屈辱/默许/沉溺
const isBackHalf = computed(() => ['屈辱', '默许', '沉溺'].includes(store.data.苗广.心态));

const susClass = computed(() => {
  const v = store.data.苗广.疑心值;
  if (isBackHalf.value) {
    // 后半程（绿帽值）：0~40=屈辱, 40~75=默许, 75+=沉溺
    if (v >= 75) return 'sus-sink';
    if (v >= 40) return 'sus-permit';
    return 'sus-low';
  }
  // 前半程（疑心值）：0~25=正常, 25~50=疑惑, 50~70=察觉, 70+=愤怒
  if (v >= 70) return 'sus-max';
  if (v >= 50) return 'sus-high';
  if (v >= 25) return 'sus-mid';
  return 'sus-low';
});

const sus_stage = computed(() => {
  const v = store.data.苗广.疑心值;
  if (isBackHalf.value) {
    if (v >= 75) return '沉溺';
    if (v >= 40) return '默许';
    return '屈辱';
  }
  if (v >= 70) return '愤怒';
  if (v >= 50) return '察觉';
  if (v >= 25) return '疑惑';
  return '正常';
});

// ── 千晶幻术状态 ──
function getCurrentFloor(): number {
  return (window as any).SillyTavern?.chat?.length ?? 0;
}

const qjUnlocked = computed(() => store.data.治疗.阶段 >= 7 && ['屈辱', '默许', '沉溺'].includes(store.data.苗广.心态));

const qjCooling = computed(() => {
  const cd = qj.value.冷却结束楼层;
  return cd > 0 && getCurrentFloor() < cd;
});

const qjCdRemain = computed(() => {
  return Math.max(0, qj.value.冷却结束楼层 - getCurrentFloor());
});

const qjCanCast = computed(() => qjUnlocked.value && !qj.value.激活中 && !qjCooling.value && qj.value.已使用次数 < 3);

// ── 千晶幻术轮次配置（与 promptInjection.ts QIANJING_SESSIONS 一致） ──
const QJ_MAX_ROUNDS = [4, 4, 4]; // 第1~3次施术的最大轮数

// ── 千晶幻术当前轮次 ──
const qjCurrentRound = computed(() => {
  const startFloor = store.data._千晶幻术开始楼层;
  if (!startFloor || !qj.value.激活中) return 0;
  return Math.floor((getCurrentFloor() - startFloor) / 2) + 1;
});

const qjMaxRoundsDisplay = computed(() => {
  const idx = Math.max(0, Math.min(qj.value.已使用次数 - 1, QJ_MAX_ROUNDS.length - 1));
  return QJ_MAX_ROUNDS[idx] ?? 4;
});

// ── 施术（进入千晶幻术副本） ──
function castQianjing() {
  if (!qjCanCast.value || !isLatestMessage()) return;
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件

  store.data.苗广.千晶幻术.激活中 = true;
  store.data.苗广.千晶幻术.已使用次数 += 1;
  store.data._千晶幻术开始楼层 = getCurrentFloor();

  const existing = store.data._待发送道具事件;
  store.data._待发送道具事件 = existing ? existing + '|||__千晶幻术_进入__' : '__千晶幻术_进入__';

  store.data._系统操作中 = true;
  store.flush();
  triggerSlash('/send （千晶幻术施术）|/trigger');
}

// ── 提前退出千晶幻术副本 ──
function exitQianjing() {
  if (!isLatestMessage()) return;
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件

  store.data.苗广.千晶幻术.激活中 = false;
  store.data.苗广.千晶幻术.冷却结束楼层 = getCurrentFloor() + 5;
  if (store.data.苗广.千晶幻术.已使用次数 >= 3) {
    store.data.苗广.千晶幻术.认知改写完成 = true;
  }
  store.data._千晶幻术开始楼层 = 0;

  const existing = store.data._待发送道具事件;
  store.data._待发送道具事件 = existing ? existing + '|||__千晶幻术_提前退出__' : '__千晶幻术_提前退出__';

  store.data._系统操作中 = true;
  store.flush();
  triggerSlash('/send （退出千晶幻术）|/trigger');
}
</script>

<style lang="scss" scoped>
// ── 色彩系统（绛红主题） ──
$c-bg: #0c0406;
$c-pri: #c03050;
$c-pri-d: #8a2038;
$c-acc: #ff6080;
$c-frost: #ffd0d8;
$c-text: #ffe8ec;
$c-sub: #a07080;
$c-good: #40c880;
$c-gold: #e8be58;
$c-warn: #d4b030;
$c-danger: #e05050;

.miao-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ── 卡片容器 ──
.card {
  background: linear-gradient(135deg, rgba($c-gold, 0.05) 0%, rgba($c-bg, 0.5) 100%);
  border: 1px solid rgba($c-gold, 0.14);
  border-radius: 12px;
  padding: 14px 16px;
  backdrop-filter: blur(8px);
  transition: border-color 0.3s;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba($c-gold, 0.1), transparent);
    pointer-events: none;
  }

  &:hover {
    border-color: rgba($c-gold, 0.18);
  }
}
.card-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-qj {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// ── 区域标题 ──
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: rgba($c-gold, 0.85);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
}
.sec-thought {
  color: rgba($c-frost, 0.7);
  margin-bottom: 2px;
}
.decor-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba($c-gold, 0.25), transparent);
}
.sec-thought .decor-line {
  background: linear-gradient(90deg, transparent, rgba($c-frost, 0.2), transparent);
}

// ── 徽章 ──
.badges-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.82rem;
  font-weight: bold;
  padding: 5px 14px;
  border-radius: 14px;
  border: 1px solid;
  letter-spacing: 0.8px;
  transition: all 0.3s;
}
.neutral {
  color: rgba($c-sub, 0.85);
  border-color: rgba($c-sub, 0.25);
  background: linear-gradient(135deg, rgba($c-sub, 0.08) 0%, transparent 100%);
}
.danger {
  color: $c-danger;
  border-color: rgba($c-danger, 0.4);
  background: linear-gradient(135deg, rgba($c-danger, 0.14) 0%, rgba($c-danger, 0.04) 100%);
  box-shadow: 0 0 10px rgba($c-danger, 0.15);
  animation: dangerPulse 2s ease-in-out infinite;
}
@keyframes dangerPulse {
  0%,
  100% {
    box-shadow: 0 0 10px rgba($c-danger, 0.15);
  }
  50% {
    box-shadow: 0 0 16px rgba($c-danger, 0.25);
  }
}
.mind-normal {
  color: rgba($c-sub, 0.65);
  border-color: rgba($c-sub, 0.2);
  background: transparent;
}
.mind-doubt {
  color: $c-warn;
  border-color: rgba($c-warn, 0.35);
  background: linear-gradient(135deg, rgba($c-warn, 0.12) 0%, rgba($c-warn, 0.03) 100%);
  box-shadow: 0 0 6px rgba($c-warn, 0.08);
}
.mind-aware {
  color: #c07030;
  border-color: rgba(#c07030, 0.4);
  background: linear-gradient(135deg, rgba(#c07030, 0.12) 0%, rgba(#c07030, 0.03) 100%);
  box-shadow: 0 0 8px rgba(#c07030, 0.12);
}
.mind-humble {
  color: $c-warn;
  border-color: rgba($c-warn, 0.35);
  background: linear-gradient(135deg, rgba($c-warn, 0.12) 0%, rgba($c-warn, 0.03) 100%);
  box-shadow: 0 0 6px rgba($c-warn, 0.08);
}
.mind-permit {
  color: lighten($c-good, 5%);
  border-color: rgba($c-good, 0.35);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.03) 100%);
  box-shadow: 0 0 8px rgba($c-good, 0.1);
}
.mind-sink {
  color: lighten($c-acc, 5%);
  border-color: rgba($c-acc, 0.45);
  background: linear-gradient(135deg, rgba($c-acc, 0.15) 0%, rgba($c-acc, 0.04) 100%);
  box-shadow: 0 0 12px rgba($c-acc, 0.15);
}

// ── 疑心值进度条 ──
.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stat-lbl {
  width: 50px;
  font-size: 0.88rem;
  color: rgba($c-gold, 0.85);
  flex-shrink: 0;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.stat-num {
  width: 30px;
  text-align: right;
  font-size: 1rem;
  font-weight: 900;
  color: $c-frost;
  text-shadow: 0 0 8px rgba($c-acc, 0.2);
  font-variant-numeric: tabular-nums;
}
.track {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba($c-pri, 0.15);
  border-radius: 5px;
  position: relative;
  overflow: visible;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
  min-width: 80px;
}
.fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 5px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.2) 0%, rgba(#fff, 0.05) 40%, transparent 60%);
    border-radius: 5px;
  }
}
.sus-low {
  background: linear-gradient(90deg, $c-pri-d, $c-pri);
  box-shadow: 0 0 8px rgba($c-pri, 0.25);
}
.sus-mid {
  background: linear-gradient(90deg, darken($c-warn, 8%), $c-warn);
  box-shadow: 0 0 8px rgba($c-warn, 0.3);
}
.sus-high {
  background: linear-gradient(90deg, #b04530, #d05040);
  box-shadow: 0 0 10px rgba(#d05040, 0.3);
}
.sus-max {
  background: linear-gradient(90deg, darken($c-danger, 8%), $c-danger);
  box-shadow: 0 0 12px rgba($c-danger, 0.35);
}
.sus-permit {
  background: linear-gradient(90deg, darken($c-good, 8%), $c-good);
  box-shadow: 0 0 8px rgba($c-good, 0.25);
}
.sus-sink {
  background: linear-gradient(90deg, darken($c-acc, 8%), $c-acc);
  box-shadow: 0 0 10px rgba($c-acc, 0.3);
}
.tick {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: rgba($c-frost, 0.2);
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba($c-frost, 0.3);
  }
}
.sus-stage {
  font-size: 0.66rem;
  font-weight: 600;
  min-width: 52px;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 8px;

  &.sus-low {
    color: rgba($c-sub, 0.7);
    background: transparent;
    box-shadow: none;
  }
  &.sus-mid {
    color: $c-warn;
    background: rgba($c-warn, 0.06);
    box-shadow: none;
  }
  &.sus-high {
    color: #d05040;
    background: rgba(#d05040, 0.06);
    box-shadow: none;
  }
  &.sus-max {
    color: $c-danger;
    background: rgba($c-danger, 0.08);
    box-shadow: none;
    animation: dangerPulse 2s ease-in-out infinite;
  }
  &.sus-permit {
    color: $c-good;
    background: rgba($c-good, 0.06);
    box-shadow: none;
  }
  &.sus-sink {
    color: $c-acc;
    background: rgba($c-acc, 0.06);
    box-shadow: none;
  }
}

// ── 千晶幻术 ──
.qj-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  flex-wrap: wrap;
}
.qj-lbl {
  color: rgba($c-gold, 0.75);
  letter-spacing: 0.5px;
  font-weight: 600;
}
.qj-state {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid rgba($c-sub, 0.2);
  color: rgba($c-sub, 0.65);
  font-size: 0.7rem;
  font-weight: 600;
}
.qj-on {
  color: lighten($c-acc, 5%);
  border-color: rgba($c-acc, 0.4);
  background: linear-gradient(135deg, rgba($c-acc, 0.14) 0%, rgba($c-acc, 0.04) 100%);
  box-shadow: 0 0 8px rgba($c-acc, 0.15);
  animation: qjPulse 2.5s ease-in-out infinite;
}
@keyframes qjPulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba($c-acc, 0.15);
  }
  50% {
    box-shadow: 0 0 14px rgba($c-acc, 0.3);
  }
}
.qj-cd {
  color: $c-warn;
  font-size: 0.68rem;
  font-weight: 600;
  text-shadow: 0 0 4px rgba($c-warn, 0.15);
}
.qj-locked {
  color: rgba($c-sub, 0.45);
  font-size: 0.64rem;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border: 1px solid rgba($c-sub, 0.1);
  border-radius: 8px;
}
.qj-done {
  color: $c-good;
  border-color: rgba($c-good, 0.35);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.03) 100%);
  box-shadow: 0 0 8px rgba($c-good, 0.12);
}
.qj-uses {
  color: rgba($c-frost, 0.7);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 6px;
  border: 1px solid rgba($c-acc, 0.15);
  border-radius: 8px;
}

// ── 千晶幻术按钮 ──
.qj-actions {
  display: flex;
  justify-content: center;
  padding: 2px 0;
}
.qj-btn {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  padding: 6px 24px;
  border-radius: 16px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.3s;
  background: transparent;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }
}
.qj-btn-cast {
  color: $c-acc;
  border-color: rgba($c-acc, 0.4);
  background: linear-gradient(135deg, rgba($c-acc, 0.08) 0%, transparent 100%);
  box-shadow: 0 0 8px rgba($c-acc, 0.1);

  &:hover:not(:disabled) {
    border-color: rgba($c-acc, 0.6);
    box-shadow: 0 0 14px rgba($c-acc, 0.2);
    background: linear-gradient(135deg, rgba($c-acc, 0.14) 0%, rgba($c-acc, 0.04) 100%);
  }
}
.qj-btn-exit {
  color: $c-warn;
  border-color: rgba($c-warn, 0.4);
  background: linear-gradient(135deg, rgba($c-warn, 0.08) 0%, transparent 100%);
  box-shadow: 0 0 8px rgba($c-warn, 0.1);

  &:hover {
    border-color: rgba($c-warn, 0.6);
    box-shadow: 0 0 14px rgba($c-warn, 0.2);
    background: linear-gradient(135deg, rgba($c-warn, 0.14) 0%, rgba($c-warn, 0.04) 100%);
  }
}

// ── 净灵铃 ──
.jll-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 2px 0;
}
.qj-btn-jll {
  color: $c-gold;
  border-color: rgba($c-gold, 0.4);
  background: linear-gradient(135deg, rgba($c-gold, 0.08) 0%, transparent 100%);
  box-shadow: 0 0 8px rgba($c-gold, 0.1);

  &:hover:not(:disabled) {
    border-color: rgba($c-gold, 0.6);
    box-shadow: 0 0 14px rgba($c-gold, 0.2);
    background: linear-gradient(135deg, rgba($c-gold, 0.14) 0%, rgba($c-gold, 0.04) 100%);
  }
}
.jll-cd {
  color: rgba($c-sub, 0.6);
  font-size: 0.68rem;
  font-weight: 600;
}

// ── 孝敬师父 ──
.xj-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 2px 0;
}
.qj-btn-xj {
  color: $c-good;
  border-color: rgba($c-good, 0.4);
  background: linear-gradient(135deg, rgba($c-good, 0.08) 0%, transparent 100%);
  box-shadow: 0 0 8px rgba($c-good, 0.1);

  &:hover:not(:disabled) {
    border-color: rgba($c-good, 0.6);
    box-shadow: 0 0 14px rgba($c-good, 0.2);
    background: linear-gradient(135deg, rgba($c-good, 0.14) 0%, rgba($c-good, 0.04) 100%);
  }
}
.xj-btn {
  font-size: 0.7rem;
  padding: 4px 16px;
}
.xj-state {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}
.xj-on {
  color: $c-good;
  border: 1px solid rgba($c-good, 0.4);
  background: linear-gradient(135deg, rgba($c-good, 0.14) 0%, rgba($c-good, 0.04) 100%);
  box-shadow: 0 0 8px rgba($c-good, 0.15);
}
.xj-cd {
  color: rgba($c-sub, 0.6);
  font-size: 0.68rem;
  font-weight: 600;
}

// ── 千晶幻境内容 ──
.qj-content {
  border-color: rgba($c-acc, 0.2);
  border-left: 3px solid rgba($c-acc, 0.35);
  background: linear-gradient(135deg, rgba($c-acc, 0.06) 0%, rgba($c-bg, 0.3) 100%);
  color: rgba($c-acc, 0.85);
}

// ── 苗喧碎片 ──
.sec-miaoxuan {
  color: rgba(#88aacc, 0.7);
  margin-bottom: 2px;
}
.sec-miaoxuan .decor-line {
  background: linear-gradient(90deg, transparent, rgba(#88aacc, 0.2), transparent);
}
.miaoxuan-box {
  border-color: rgba(#88aacc, 0.2);
  border-left: 3px solid rgba(#88aacc, 0.35);
  background: linear-gradient(135deg, rgba(#88aacc, 0.06) 0%, rgba($c-bg, 0.3) 100%);
  color: rgba(#b8ccdd, 0.9);

  &::before {
    color: rgba(#88aacc, 0.08);
  }
}

// ── 心理活动 ──
.thought-box {
  background: linear-gradient(135deg, rgba($c-pri, 0.08) 0%, rgba($c-bg, 0.4) 100%);
  border: 1px solid rgba($c-gold, 0.15);
  border-left: 3px solid rgba($c-gold, 0.35);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 0.88rem;
  line-height: 1.7;
  color: rgba($c-frost, 0.9);
  font-style: italic;
  white-space: pre-wrap;
  backdrop-filter: blur(4px);
  position: relative;

  &::before {
    content: '\201C';
    position: absolute;
    top: 4px;
    left: 10px;
    font-size: 1.8rem;
    color: rgba($c-gold, 0.08);
    font-family: Georgia, serif;
    line-height: 1;
  }
}

// ── 响应式 ──
@media (max-width: 360px) {
  .card {
    padding: 10px 12px;
  }
  .badges-row {
    gap: 6px;
  }
}
</style>
