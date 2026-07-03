<template>
  <div class="suwen-panel">
    <section class="card">
      <h3>
        苏文 <span :class="['chip', statusClass]">{{ statusDisplay }}</span>
      </h3>
      <div class="s-loc">📍 {{ pos }}</div>

      <div class="bar">
        <span class="bl">疑心·秦璐</span>
        <div class="track">
          <i :class="['fill', susQin > 70 ? 'f-danger' : 'f-warn']" :style="{ width: susQin + '%' }"></i>
        </div>
        <span class="bv">{{ susQin }}</span>
      </div>
      <div class="bar">
        <span class="bl">疑心·苏梦</span>
        <div class="track">
          <i :class="['fill', susMeng > 70 ? 'f-danger' : 'f-warn']" :style="{ width: susMeng + '%' }"></i>
        </div>
        <span class="bv">{{ susMeng }}</span>
      </div>

      <p v-if="isAccelerating" class="note warn">⚡ 苏文在附近 · 念头加速中</p>
      <p v-else-if="safeReason" class="note safe">✓ {{ safeReason }}</p>

      <div v-if="freezeBadges.length > 0" class="freeze-row">
        <span v-for="f in freezeBadges" :key="f" class="freeze-badge">❄ {{ f }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../store';

const store = useDataStore();
const data = computed(() => store.data);
const suwen = computed(() => data.value?.苏文状态 ?? null);

const pos = computed(() => suwen.value?.当前位置 ?? '客厅');
const statusDisplay = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '外出工作' : s === '睡眠' ? '睡眠中' : '在家';
});
const statusClass = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? 'away' : s === '睡眠' ? 'sleeping' : 'home';
});
const safeReason = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '苏文外出，可安心进行' : s === '睡眠' ? '苏文熟睡，相对安全' : '';
});
const isAccelerating = computed(() => {
  const p = suwen.value?.当前位置;
  return p === '餐厅' || p === '客厅' || p === '主卧';
});
const susQin = computed(() => suwen.value?.对秦璐疑心值 ?? 0);
const susMeng = computed(() => suwen.value?.对苏梦疑心值 ?? 0);

const freezeBadges = computed(() => {
  const out: string[] = [];
  const floor = SillyTavern.chat?.length ?? 0;
  const fq = suwen.value?.对秦璐疑心值冻结;
  const fm = suwen.value?.对苏梦疑心值冻结;
  if (fq?.是否冻结 && floor < fq.冻结结束楼层) out.push(`对秦璐疑心冻结中（至${fq.冻结结束楼层}楼）`);
  if (fm?.是否冻结 && floor < fm.冻结结束楼层) out.push(`对苏梦疑心冻结中（至${fm.冻结结束楼层}楼）`);
  return out;
});
</script>

<style scoped lang="scss">
$safe: #79c48a;
$warn: #e8a94f;
$danger: #e06868;
$info: #6fb9dc;
$serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;

.suwen-panel {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
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
  }
}
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
.s-loc {
  font-size: 12px;
  color: color-mix(in srgb, var(--acc) 55%, #998);
  margin-bottom: 9px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;

  & + .bar {
    margin-top: 7px;
  }
}
.bl {
  flex: none;
  width: 62px;
  color: color-mix(in srgb, var(--acc) 50%, #998);
  letter-spacing: 0.5px;
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
  transition: width 0.4s;
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
.bv {
  flex: none;
  min-width: 24px;
  text-align: right;
  font-weight: 700;
  font-size: 12px;
  color: #d5cabb;
  font-variant-numeric: tabular-nums;
}
.note {
  margin: 9px 0 0;
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
}
.freeze-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.freeze-badge {
  font-size: 10.5px;
  padding: 2px 10px;
  border-radius: 10px;
  color: $info;
  background: rgba(111, 185, 220, 0.12);
  border: 1px solid rgba(111, 185, 220, 0.3);
}
</style>
