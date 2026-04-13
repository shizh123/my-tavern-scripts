<template>
  <div class="luo-panel">
    <!-- 核心数值 -->
    <div class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>洛书晴 · 第{{ store.data.洛书晴.调教阶段 }}阶</span
        ><span class="decor-line"></span>
      </div>

      <div class="stat-row">
        <span class="stat-label">心理防线</span>
        <div class="stat-track">
          <div class="stat-fill def" :style="{ width: store.data.洛书晴.心理防线 + '%' }"></div>
        </div>
        <span class="stat-val">{{ store.data.洛书晴.心理防线 }}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">顺从度</span>
        <div class="stat-track">
          <div class="stat-fill obey" :style="{ width: store.data.洛书晴.顺从度 + '%' }"></div>
        </div>
        <span class="stat-val">{{ store.data.洛书晴.顺从度 }}</span>
      </div>

      <!-- 卡关提示 -->
      <div v-if="stuckHint" class="stuck-hint">
        {{ stuckHint }}
      </div>
    </div>

    <!-- 身体开发 -->
    <div class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>身体开发</span><span class="decor-line"></span>
      </div>
      <div class="body-grid">
        <div
          v-for="part in bodyParts"
          :key="part"
          class="body-item"
          :class="'lv' + lv(store.data.洛书晴.身体开发[part])"
        >
          <div class="body-label">{{ part }}</div>
          <div class="body-val">{{ store.data.洛书晴.身体开发[part] }}</div>
        </div>
      </div>
    </div>

    <!-- 服装（阶段3+解锁） -->
    <div v-if="store.data.洛书晴.调教阶段 >= 3" class="card">
      <div class="section-title"><span class="decor-line"></span><span>服装</span><span class="decor-line"></span></div>
      <div class="attire-grid">
        <div class="attire-item">
          <span class="a-slot">上装</span><span class="a-val">{{ store.data.洛书晴.服装.上装 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">下装</span><span class="a-val">{{ store.data.洛书晴.服装.下装 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">内衣</span><span class="a-val">{{ store.data.洛书晴.服装.内衣 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">内裤</span><span class="a-val">{{ store.data.洛书晴.服装.内裤 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">特殊配饰</span><span class="a-val">{{ accessoryDisplay || '无' }}</span>
        </div>
      </div>
    </div>

    <!-- 肉体改造（有才显示） -->
    <div v-if="hasBodyMods" class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>肉体改造</span><span class="decor-line"></span>
      </div>
      <div class="tag-grid">
        <div v-if="store.data.洛书晴.肉体改造.胸部 !== '默认'" class="mod-tag">
          <span class="mod-label">胸部</span><span class="mod-value">{{ store.data.洛书晴.肉体改造.胸部 }}</span>
        </div>
        <div v-if="store.data.洛书晴.肉体改造.臀部 !== '默认'" class="mod-tag">
          <span class="mod-label">臀部</span><span class="mod-value">丰满</span>
        </div>
        <div v-if="store.data.洛书晴.肉体改造.乳环" class="mod-tag">
          <span class="mod-label">乳环</span><span class="mod-value">已穿环</span>
        </div>
        <div v-if="store.data.洛书晴.肉体改造.阴环" class="mod-tag">
          <span class="mod-label">阴环</span><span class="mod-value">已穿环</span>
        </div>
        <div v-if="yinwenDisplay" class="mod-tag">
          <span class="mod-label">淫纹</span><span class="mod-value">{{ yinwenDisplay }}</span>
        </div>
      </div>
    </div>

    <!-- 心理活动 -->
    <div v-if="store.data.洛书晴.心理活动" class="card">
      <div class="section-title">
        <span class="decor-line"></span><span>心理活动</span><span class="decor-line"></span>
      </div>
      <div class="thought">{{ store.data.洛书晴.心理活动 }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../store';

const store = useDataStore();

const bodyParts = ['小嘴', '胸部', '小屄', '屁穴'] as const;

function lv(v: number): number {
  if (v >= 80) return 4;
  if (v >= 60) return 3;
  if (v >= 40) return 2;
  if (v >= 20) return 1;
  return 0;
}

const accessoryDisplay = computed(() => {
  const pei = store.data.洛书晴.服装.特殊配饰;
  return [pei.脚踝, pei.颈部, pei.耳部, pei.腰部, pei.大腿, pei.胸部, pei.阴蒂, pei.前后穴]
    .filter(s => s && s.trim().length > 0)
    .join('、');
});

const yinwenDisplay = computed(() => {
  const yw = store.data.洛书晴.肉体改造.淫纹;
  const parts: string[] = [];
  if (yw.腰腹) parts.push(`腰腹·${yw.腰腹}`);
  if (yw.胸前) parts.push(`胸前·${yw.胸前}`);
  if (yw.大腿内侧) parts.push(`大腿内侧·${yw.大腿内侧}`);
  if (yw.臀部) parts.push(`臀部·${yw.臀部}`);
  return parts.join('、');
});

const hasBodyMods = computed(() => {
  const mod = store.data.洛书晴.肉体改造;
  return (
    mod.胸部 !== '默认' ||
    mod.臀部 !== '默认' ||
    mod.乳环 ||
    mod.阴环 ||
    !!(mod.淫纹.腰腹 || mod.淫纹.胸前 || mod.淫纹.大腿内侧 || mod.淫纹.臀部)
  );
});

/** 阶段边界表（与 stateValidation.getLuoStageBound 保持同步） */
const STAGE_BOUNDS: Record<number, { 防线下限: number; 顺从上限: number }> = {
  1: { 防线下限: 90, 顺从上限: 10 },
  2: { 防线下限: 80, 顺从上限: 20 },
  3: { 防线下限: 70, 顺从上限: 30 },
  4: { 防线下限: 60, 顺从上限: 40 },
  5: { 防线下限: 50, 顺从上限: 50 },
  6: { 防线下限: 40, 顺从上限: 60 },
  7: { 防线下限: 30, 顺从上限: 70 },
  8: { 防线下限: 20, 顺从上限: 80 },
  9: { 防线下限: 10, 顺从上限: 90 },
  10: { 防线下限: 0, 顺从上限: 100 },
};

const stuckHint = computed(() => {
  const stage = store.data.洛书晴.调教阶段;
  if (stage >= 10) return '';
  const bound = STAGE_BOUNDS[stage];
  const def = store.data.洛书晴.心理防线;
  const obey = store.data.洛书晴.顺从度;
  if (def <= bound.防线下限 && obey >= bound.顺从上限) {
    return `当前数值已达本阶段上限，等待师父（云霜凝）的治疗进展`;
  }
  return '';
});
</script>

<style lang="scss" scoped>
// ── 色彩系统（洛书晴·粉紫主题，对齐云霜凝面板结构但保持色调区分）──
$c-bg: #0c0406;
$c-pri: #d36c86;
$c-pri-d: #8a3c50;
$c-acc: #ff8fa8;
$c-frost: #ffd0d8;
$c-text: #ffe8ec;
$c-sub: #a07080;

.luo-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ── 卡片容器（对齐云霜凝面板风格）──
.card {
  background: linear-gradient(135deg, rgba($c-pri, 0.07) 0%, rgba($c-bg, 0.5) 100%);
  border: 1px solid rgba($c-pri, 0.15);
  border-radius: 12px;
  padding: 14px 16px;
  transition: border-color 0.3s;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba($c-frost, 0.12), transparent);
    pointer-events: none;
  }

  &:hover {
    border-color: rgba($c-pri, 0.25);
  }
}

// ── 区域标题 ──
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: rgba($c-pri, 0.85);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 10px;
  font-weight: 600;
}
.decor-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba($c-pri, 0.3), transparent);
}

// ── 核心数值进度条 ──
.stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
  font-size: 0.75rem;
}
.stat-label {
  width: 60px;
  color: $c-sub;
  letter-spacing: 0.05em;
}
.stat-track {
  flex: 1;
  height: 8px;
  background: rgba($c-pri-d, 0.2);
  border-radius: 4px;
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  transition: width 0.5s;
  border-radius: 4px;
  &.def {
    background: linear-gradient(to right, $c-pri-d, $c-pri);
  }
  &.obey {
    background: linear-gradient(to right, #e8be58, $c-acc);
  }
}
.stat-val {
  width: 32px;
  text-align: right;
  color: $c-text;
  font-weight: 600;
}

.stuck-hint {
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(232, 190, 88, 0.1);
  border-left: 2px solid #e8be58;
  color: #e8be58;
  font-size: 0.7rem;
  border-radius: 3px;
}

// ── 身体开发网格 ──
.body-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.body-item {
  background: rgba($c-pri-d, 0.15);
  border-radius: 6px;
  padding: 8px 4px;
  text-align: center;
  font-size: 0.7rem;
  &.lv0 {
    color: $c-sub;
  }
  &.lv1 {
    color: #a0a0c0;
  }
  &.lv2 {
    color: $c-pri;
  }
  &.lv3 {
    color: $c-acc;
  }
  &.lv4 {
    color: $c-frost;
    background: rgba($c-pri, 0.25);
  }
}
.body-label {
  color: $c-sub;
}
.body-val {
  font-weight: 600;
  margin-top: 3px;
}

// ── 服装槽 ──
.attire-grid {
  display: grid;
  gap: 6px;
}
.attire-item {
  display: flex;
  font-size: 0.75rem;
  .a-slot {
    width: 64px;
    color: $c-sub;
    letter-spacing: 0.05em;
  }
  .a-val {
    flex: 1;
    color: $c-text;
  }
}

// ── 肉体改造标签 ──
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mod-tag {
  background: rgba($c-pri, 0.15);
  border: 1px solid rgba($c-pri, 0.3);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.7rem;
  .mod-label {
    color: $c-sub;
    margin-right: 6px;
  }
  .mod-value {
    color: $c-pri;
    font-weight: 600;
  }
}

// ── 心理活动 ──
.thought {
  padding: 10px 12px;
  background: rgba($c-pri-d, 0.15);
  border-radius: 6px;
  color: $c-text;
  font-size: 0.78rem;
  line-height: 1.7;
  font-style: italic;
  border-left: 2px solid rgba($c-pri, 0.35);
}
</style>
