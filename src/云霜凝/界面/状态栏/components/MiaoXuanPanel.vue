<template>
  <div class="miaoxuan-panel">
    <div class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>苗喧 · {{ store.data.苗喧.心态 }}</span
        ><span class="decor-line"></span>
      </div>

      <div class="stat-row">
        <span class="stat-label">绝望值</span>
        <div class="stat-track">
          <div class="stat-fill despair" :style="{ width: store.data.苗喧.绝望值 + '%' }"></div>
        </div>
        <span class="stat-val">{{ store.data.苗喧.绝望值 }}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">压抑值</span>
        <div class="stat-track">
          <div class="stat-fill pressure" :style="{ width: store.data.苗喧.压抑值 + '%' }"></div>
        </div>
        <span class="stat-val">{{ store.data.苗喧.压抑值 }}</span>
      </div>

      <!-- 倾诉按钮 -->
      <div class="actions">
        <button class="action-btn vent-btn" :disabled="!canVent" @click="onVent">
          <template v-if="ventCooldown > 0">倾诉冷却中（{{ ventCooldown }}楼）</template>
          <template v-else-if="store.data.苗喧.压抑值 < 40">压抑不足（{{ store.data.苗喧.压抑值 }}/40）</template>
          <template v-else>听他倾诉</template>
        </button>
      </div>

      <!-- 2.0.22 场景引擎 v2: 查看反抗按钮 (类倾诉·玩家手动触发·可重复) -->
      <div class="actions">
        <button class="action-btn rebel-btn" :disabled="!canRebel" @click="onRebel">
          <template v-if="rebelCooldown > 0">反抗冷却中（{{ rebelCooldown }}楼）</template>
          <template v-else-if="store.data.苗喧.绝望值 < 40">绝望不足（{{ store.data.苗喧.绝望值 }}/40）</template>
          <template v-else-if="store.data._当前互动模式 === '神魂空间'">神魂空间中不可观看</template>
          <template v-else-if="isBusyInScenario">其他剧情中</template>
          <template v-else>查看反抗</template>
        </button>
      </div>
    </div>

    <div v-if="store.data.苗喧.心理活动" class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>心理活动</span><span class="decor-line"></span>
      </div>
      <div class="thought">{{ store.data.苗喧.心理活动 }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../store';

const store = useDataStore();

function getCurrentFloor(): number {
  return (window as any).SillyTavern?.chat?.length ?? 0;
}

const ventCooldown = computed(() => {
  const floor = getCurrentFloor();
  return Math.max(0, store.data._倾诉冷却结束楼层 - floor);
});

/**
 * 多轮脚本剧情排他检测——任何脚本驱动的多轮副本进行中时为 true。
 */
const isBusyInScenario = computed(() => {
  const d = store.data;
  if (d._当前互动模式 === '神魂空间' || d._神魂空间激活中) return true;
  if (d.苗广.千晶幻术.激活中) return true;
  if (d.苗广.孝敬师父.激活中) return true;
  if (d._特殊场景.进行中) return true;
  if (d._洛书晴激活轮次进度 > 0) return true;
  // 2.0.20: 本楼若已 push 道具事件待发送，也视为忙——防止"道具楼 + 倾诉/反抗"事件叠加
  if (d._待发送道具事件) return true;
  return false;
});

const canVent = computed(() => ventCooldown.value <= 0 && store.data.苗喧.压抑值 >= 40 && !isBusyInScenario.value);

function onVent() {
  if (!canVent.value) return;
  store.pull();
  // 触发倾诉场景：重置压抑值 + 方式3 注入事件让 AI 生成场景
  store.data.苗喧.压抑值 = 0;
  store.data._倾诉冷却结束楼层 = getCurrentFloor() + 5;
  const existing = store.data._待发送道具事件;
  const event = '__苗喧倾诉__';
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.flush();
  triggerSlash('/send （听苗喧倾诉）|/trigger');
}

// 2.0.22 场景引擎 v2: 后期反抗类倾诉机制
const rebelCooldown = computed(() => {
  const floor = getCurrentFloor();
  return Math.max(0, store.data._反抗冷却结束楼层 - floor);
});
const canRebel = computed(
  () =>
    rebelCooldown.value <= 0 &&
    store.data.苗喧.绝望值 >= 40 &&
    !isBusyInScenario.value &&
    store.data._当前互动模式 !== '神魂空间',
);

function onRebel() {
  if (!canRebel.value) return;
  store.pull();
  const floor = getCurrentFloor();
  // 触发反抗场景四个副作用(spec 定稿):
  //   1. 绝望值 -30(不清零 - 反抗失败绝望仍累积,区别于倾诉清零)
  //   2. _反抗冷却结束楼层 = floor + 8(8 楼冷却,比倾诉 5 楼长:反抗副作用多)
  //   3. _苗喧反抗限制中 = true(让孝敬师父按钮可点)
  //   4. _打断冻结至楼层 = floor + 5(5 楼冻结治疗数值)
  store.data.苗喧.绝望值 = Math.max(0, store.data.苗喧.绝望值 - 30);
  store.data._反抗冷却结束楼层 = floor + 8;
  store.data._苗喧反抗限制中 = true;
  store.data._打断冻结至楼层 = floor + 5;
  // 更新 _上次反抗快照(供下次反抗的 data card 参考)
  store.data._上次反抗快照 = { 楼层: floor, 焦点简述: null };
  const existing = store.data._待发送道具事件;
  const event = '__苗喧后期反抗__';
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.flush();
  triggerSlash('/send （查看苗喧的反抗）|/trigger');
}
</script>

<style lang="scss" scoped>
$c-red: #b03040;
$c-red-dim: #701020;
$c-gold: #e8be58;
$c-text: #ffe8ec;
$c-sub: #a07080;

.miaoxuan-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
}

.card {
  background: rgba(30, 8, 14, 0.4);
  border: 1px solid rgba($c-red, 0.2);
  border-radius: 6px;
  padding: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $c-red;
  font-size: 13px;
  margin-bottom: 8px;
  font-weight: 600;
  .decor-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba($c-red, 0.4), transparent);
  }
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 12px;
}
.stat-label {
  width: 60px;
  color: $c-sub;
}
.stat-track {
  flex: 1;
  height: 8px;
  background: rgba($c-red-dim, 0.25);
  border-radius: 4px;
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  transition: width 0.5s;
  &.despair {
    background: linear-gradient(to right, $c-red-dim, $c-red);
  }
  &.pressure {
    background: linear-gradient(to right, #805020, $c-gold);
  }
}
.stat-val {
  width: 30px;
  text-align: right;
  color: $c-text;
}

.actions {
  margin-top: 10px;
}
.action-btn {
  width: 100%;
  padding: 8px;
  background: rgba($c-red, 0.15);
  border: 1px solid rgba($c-red, 0.35);
  color: $c-text;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background: rgba($c-red, 0.25);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

// 2.0.22 反抗按钮: 比倾诉按钮色调更沉/更暗,视觉上区分(反抗=绝望·失败)
.rebel-btn {
  background: rgba($c-red-dim, 0.3);
  border-color: rgba($c-red, 0.55);
  color: lighten($c-red, 15%);
  margin-top: 6px;
  &:hover:not(:disabled) {
    background: rgba($c-red, 0.35);
  }
}

.thought {
  padding: 8px;
  background: rgba($c-red-dim, 0.2);
  border-radius: 4px;
  color: $c-text;
  font-size: 12px;
  line-height: 1.6;
  font-style: italic;
}
</style>
