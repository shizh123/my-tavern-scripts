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

      <!-- 未读反抗事件红点 -->
      <div v-if="store.data._苗喧未读反抗事件" class="unread-event">
        <span class="unread-dot"></span>
        <span class="unread-label">有新情况</span>
        <button class="unread-view-btn" :disabled="isBusyInScenario" @click="onViewRebellion">
          {{ isBusyInScenario ? '其他剧情中' : '查看详情' }}
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

function onViewRebellion() {
  const type = store.data._苗喧未读反抗事件;
  if (!type) return;
  // 其他多轮剧情进行中时不允许查看反抗事件
  if (isBusyInScenario.value) return;
  store.pull();
  store.data._苗喧未读反抗事件 = null;
  const existing = store.data._待发送道具事件;
  const event = `__苗喧反抗_${type}__`;
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.flush();
  triggerSlash('/send （查看苗喧的情况）|/trigger');
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

.unread-event {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba($c-gold, 0.12);
  border-left: 2px solid $c-gold;
  border-radius: 3px;
}
.unread-dot {
  width: 8px;
  height: 8px;
  background: $c-gold;
  border-radius: 50%;
  animation: blink 1.5s infinite;
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.unread-label {
  color: $c-gold;
  font-size: 12px;
  flex: 1;
}
.unread-view-btn {
  background: rgba($c-gold, 0.2);
  border: 1px solid rgba($c-gold, 0.4);
  color: $c-gold;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
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
