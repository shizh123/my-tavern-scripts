<template>
  <div class="yun-panel">
    <!-- 心理状态 -->
    <div class="card">
      <div class="section-title sec-mental">
        <span class="decor-line"></span><span>心理状态</span><span class="decor-line"></span>
      </div>
      <div class="stat-list">
        <div class="stat-row">
          <span class="stat-lbl lbl-trust">信任度</span>
          <div class="track"><div class="fill trust" :style="{ width: store.data.云霜凝.信任度 + '%' }"></div></div>
          <span class="stat-num num-trust">{{ store.data.云霜凝.信任度 }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-lbl lbl-defense">心理防线</span>
          <div class="track"><div class="fill defense" :style="{ width: store.data.云霜凝.心理防线 + '%' }"></div></div>
          <span class="stat-num num-defense">{{ store.data.云霜凝.心理防线 }}</span>
        </div>
      </div>
    </div>

    <!-- 身体开发 -->
    <div class="card">
      <div class="section-title sec-body">
        <span class="decor-line"></span><span>身体开发</span><span class="decor-line"></span>
      </div>
      <div class="body-grid">
        <div v-for="(val, part) in store.data.云霜凝.身体开发" :key="part" class="body-item">
          <span class="body-lbl">{{ part }}</span>
          <div class="track"><div class="fill body" :style="{ width: val + '%' }"></div></div>
          <span class="lv-badge" :class="lvClass(val)">Lv{{ lv(val) }}</span>
          <span class="body-num">{{ val }}</span>
        </div>
      </div>
    </div>

    <!-- 服装 -->
    <div class="card">
      <div class="section-title sec-attire">
        <span class="decor-line"></span><span>外观</span><span class="decor-line"></span>
      </div>
      <div class="attire-grid">
        <div class="attire-item">
          <span class="a-slot">上装</span>
          <span class="a-val">{{ store.data.云霜凝.服装.上装 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">下装</span>
          <span class="a-val">{{ store.data.云霜凝.服装.下装 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">内衣</span>
          <span class="a-val">{{ store.data.云霜凝.服装.内衣 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">内裤</span>
          <span class="a-val">{{ store.data.云霜凝.服装.内裤 }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">特殊配饰</span>
          <span class="a-val">{{ accessoryDisplay || '无' }}</span>
        </div>
        <div class="attire-item">
          <span class="a-slot">性具</span>
          <span class="a-val">{{ activeSexToys.length > 0 ? activeSexToys.join('、') : '空' }}</span>
        </div>
        <div class="attire-item attire-expose">
          <span class="a-slot">暴露程度</span>
          <span class="a-val" :class="exposeClass">{{ store.data.云霜凝.服装.暴露程度 }}</span>
        </div>
      </div>
    </div>

    <!-- 肉体改造（有才显示） -->
    <template v-if="hasBodyMods">
      <div class="card">
        <div class="section-title sec-mod">
          <span class="decor-line"></span><span>肉体改造</span><span class="decor-line"></span>
        </div>
        <div class="tag-grid">
          <div v-if="store.data.云霜凝.肉体改造.胸部 !== '默认'" class="mod-tag">
            <span class="mod-label">胸部</span>
            <span class="mod-value">{{ store.data.云霜凝.肉体改造.胸部 }}</span>
          </div>
          <div v-if="store.data.云霜凝.肉体改造.臀部 !== '默认'" class="mod-tag">
            <span class="mod-label">臀部</span>
            <span class="mod-value">丰满</span>
          </div>
          <div v-if="store.data.云霜凝.肉体改造.乳环" class="mod-tag">
            <span class="mod-label">乳环</span>
            <span class="mod-value">已穿环</span>
          </div>
          <div v-if="store.data.云霜凝.肉体改造.阴环" class="mod-tag">
            <span class="mod-label">阴环</span>
            <span class="mod-value">已穿环</span>
          </div>
          <div v-if="yinwenDisplay" class="mod-tag">
            <span class="mod-label">淫纹</span>
            <span class="mod-value">{{ yinwenDisplay }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 性癖（有才显示） -->
    <template v-if="!_.isEmpty(store.data.云霜凝.性癖列表)">
      <div class="card">
        <div class="section-title sec-kink">
          <span class="decor-line"></span><span>性癖档案</span><span class="decor-line"></span>
        </div>
        <div class="kink-wrap">
          <span v-for="(_tag, name) in store.data.云霜凝.性癖列表" :key="name" class="kink-chip">{{ name }}</span>
        </div>
      </div>
    </template>

    <!-- 性具（有才显示） -->
    <template v-if="activeSexToys.length > 0">
      <div class="card">
        <div class="section-title sec-toy">
          <span class="decor-line"></span><span>性具</span><span class="decor-line"></span>
        </div>
        <div class="toy-wrap">
          <span v-for="name in activeSexToys" :key="name" class="toy-chip">{{ name }}</span>
        </div>
      </div>
    </template>

    <!-- 当前生效道具（有才显示） -->
    <template v-if="activeItems.length > 0 || hasTempItems">
      <div class="card">
        <div class="section-title sec-item">
          <span class="decor-line"></span><span>当前道具</span><span class="decor-line"></span>
        </div>
        <div class="active-items">
          <span v-for="name in activeItems" :key="name" class="active-tag">{{ name }}</span>
          <span v-for="(turns, name) in store.data._临时道具剩余轮次" :key="'tmp-' + name" class="active-tag temp-tag"
            >{{ name }} <span class="temp-turns">{{ turns }}轮</span></span
          >
        </div>
      </div>
    </template>

    <!-- 心理活动 -->
    <template v-if="store.data.云霜凝.心理活动">
      <div class="section-title sec-thought">
        <span class="decor-line"></span><span>心理活动</span><span class="decor-line"></span>
      </div>
      <div class="thought-box">{{ store.data.云霜凝.心理活动 }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import _ from 'lodash';
import { useDataStore } from '../store';
import { CLOTHING_SLOT, KINK_ITEM_MAP, CONSUMABLE_NAMES } from '../../../脚本/游戏逻辑/shopSystem';
const store = useDataStore();

function lv(v: number) {
  if (v >= 80) return 4;
  if (v >= 60) return 3;
  if (v >= 40) return 2;
  if (v >= 20) return 1;
  return 0;
}
function lvClass(v: number) {
  return ['lv0', 'lv1', 'lv2', 'lv3', 'lv4'][lv(v)];
}
const exposeClass = computed(() => {
  const map: Record<string, string> = {
    遮蔽: '',
    微露: 'ex-min',
    轻露: 'ex-low',
    半露: 'ex-mid',
    大露: 'ex-high',
    极露: 'ex-max',
  };
  return map[store.data.云霜凝.服装.暴露程度] ?? '';
});
const yinwenDisplay = computed(() => {
  const yw = store.data.云霜凝.肉体改造.淫纹;
  const parts: string[] = [];
  if (yw.腰腹) parts.push(`腰腹·${yw.腰腹}`);
  if (yw.胸前) parts.push(`胸前·${yw.胸前}`);
  if (yw.大腿内侧) parts.push(`大腿内侧·${yw.大腿内侧}`);
  if (yw.臀部) parts.push(`臀部·${yw.臀部}`);
  return parts.join('、');
});
const accessoryDisplay = computed(() => {
  const pei = store.data.云霜凝.服装.特殊配饰;
  return [pei.脚踝, pei.颈部, pei.耳部, pei.腰部, pei.大腿, pei.胸部, pei.阴蒂, pei.前后穴]
    .filter(s => s && s.trim().length > 0)
    .join('、');
});
const hasBodyMods = computed(() => {
  const mod = store.data.云霜凝.肉体改造;
  return (
    mod.胸部 !== '默认' ||
    mod.臀部 !== '默认' ||
    mod.乳环 ||
    mod.阴环 ||
    !!(mod.淫纹.腰腹 || mod.淫纹.胸前 || mod.淫纹.大腿内侧 || mod.淫纹.臀部)
  );
});

// 身体器具（性具）列表
const SEX_TOY_NAMES = new Set(['眼罩', '乳夹', '口枷', '肛塞', '缚灵缎', '震动器', '项圈', '肉棒口罩']);

const activeSexToys = computed(() =>
  Object.entries(store.data.系统.道具状态)
    .filter(([name, state]) => state === '使用中' && SEX_TOY_NAMES.has(name))
    .map(([name]) => name),
);

const activeItems = computed(() =>
  Object.entries(store.data.系统.道具状态)
    .filter(
      ([name, state]) =>
        state === '使用中' &&
        !SEX_TOY_NAMES.has(name) &&
        !CLOTHING_SLOT[name] &&
        !KINK_ITEM_MAP[name] &&
        !CONSUMABLE_NAMES.has(name),
    )
    .map(([name]) => name),
);

const hasTempItems = computed(() => !_.isEmpty(store.data._临时道具剩余轮次));
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

.yun-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ── 卡片容器 ──
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
  color: $c-sub;
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

// 区域标题颜色区分
.sec-mental {
  color: rgba($c-acc, 0.85);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba($c-acc, 0.3), transparent);
  }
}
.sec-body {
  color: rgba(#d09060, 0.9);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba(#d09060, 0.3), transparent);
  }
}
.sec-attire {
  color: rgba(#80b0d8, 0.9);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba(#80b0d8, 0.3), transparent);
  }
}
.sec-mod {
  color: rgba($c-danger, 0.8);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba($c-danger, 0.3), transparent);
  }
}
.sec-kink {
  color: rgba(#d060a0, 0.85);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba(#d060a0, 0.3), transparent);
  }
}
.sec-toy {
  color: rgba(#e04880, 0.85);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba(#e04880, 0.3), transparent);
  }
}
.sec-item {
  color: rgba($c-good, 0.85);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba($c-good, 0.3), transparent);
  }
}
.sec-thought {
  color: rgba($c-frost, 0.75);
  .decor-line {
    background: linear-gradient(90deg, transparent, rgba($c-frost, 0.25), transparent);
  }
}

// ── 进度条通用 ──
.stat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-lbl {
  width: 60px;
  font-size: 0.88rem;
  flex-shrink: 0;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.lbl-trust {
  color: rgba($c-good, 0.8);
}
.lbl-defense {
  color: rgba($c-acc, 0.75);
}
.stat-num {
  width: 32px;
  text-align: right;
  font-size: 1rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.num-trust {
  color: lighten($c-good, 12%);
  text-shadow: 0 0 8px rgba($c-good, 0.2);
}
.num-defense {
  color: $c-frost;
  text-shadow: 0 0 8px rgba($c-acc, 0.2);
}

.track {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba($c-pri, 0.15);
  border-radius: 5px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}
.fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.2) 0%, rgba(#fff, 0.05) 40%, transparent 60%);
    border-radius: 5px;
  }

  &.trust {
    background: linear-gradient(90deg, darken($c-good, 10%), $c-good, lighten($c-good, 10%));
    box-shadow: 0 0 10px rgba($c-good, 0.35);
  }
  &.defense {
    background: linear-gradient(90deg, $c-pri-d, $c-pri, $c-acc);
    box-shadow: 0 0 10px rgba($c-pri, 0.35);
  }
  &.body {
    background: linear-gradient(90deg, darken(#d09060, 10%), #d09060);
    box-shadow: 0 0 8px rgba(#d09060, 0.25);
  }
}

// ── 身体开发 ──
.body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.body-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(#d09060, 0.03);
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: rgba(#d09060, 0.06);
  }
}
.body-lbl {
  width: 28px;
  font-size: 0.84rem;
  color: rgba(#d09060, 0.9);
  flex-shrink: 0;
  font-weight: 600;
}
.body-num {
  width: 24px;
  text-align: right;
  font-size: 0.8rem;
  color: rgba(#d09060, 0.7);
  font-variant-numeric: tabular-nums;
}
.lv-badge {
  font-size: 0.68rem;
  font-weight: 900;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  white-space: nowrap;

  &.lv0 {
    color: rgba($c-sub, 0.45);
  }
  &.lv1 {
    color: $c-warn;
    background: rgba($c-warn, 0.1);
    border: 1px solid rgba($c-warn, 0.15);
  }
  &.lv2 {
    color: #d08030;
    background: rgba(#d08030, 0.1);
    border: 1px solid rgba(#d08030, 0.15);
  }
  &.lv3 {
    color: #d05040;
    background: rgba(#d05040, 0.1);
    border: 1px solid rgba(#d05040, 0.15);
    box-shadow: 0 0 4px rgba(#d05040, 0.1);
  }
  &.lv4 {
    color: $c-danger;
    background: rgba($c-danger, 0.12);
    border: 1px solid rgba($c-danger, 0.2);
    box-shadow: 0 0 6px rgba($c-danger, 0.15);
    animation: lvPulse 2s ease-in-out infinite;
  }
}
@keyframes lvPulse {
  0%,
  100% {
    box-shadow: 0 0 6px rgba($c-danger, 0.15);
  }
  50% {
    box-shadow: 0 0 10px rgba($c-danger, 0.25);
  }
}

// ── 服装/外观 ──
.attire-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.attire-item {
  background: linear-gradient(135deg, rgba(#80b0d8, 0.08) 0%, rgba($c-bg, 0.35) 100%);
  border: 1px solid rgba(#80b0d8, 0.15);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.86rem;
  backdrop-filter: blur(4px);
  transition: all 0.2s;

  &:hover {
    border-color: rgba(#80b0d8, 0.25);
    background: linear-gradient(135deg, rgba(#80b0d8, 0.09) 0%, rgba($c-bg, 0.3) 100%);
  }
}
.attire-expose {
  grid-column: 1 / -1;
  text-align: center;
  background: linear-gradient(135deg, rgba($c-acc, 0.04) 0%, rgba($c-bg, 0.3) 100%);
  border-color: rgba($c-acc, 0.1);
}
.a-slot {
  display: block;
  font-size: 0.68rem;
  color: rgba(#80b0d8, 0.65);
  margin-bottom: 4px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  font-weight: 600;
}
.a-val {
  color: #c8e0f8;
  font-weight: bold;
  font-size: 0.9rem;
}

.ex-min {
  color: rgba($c-warn, 0.6);
}
.ex-low {
  color: $c-warn;
}
.ex-mid {
  color: #d07030;
  font-weight: bold;
  text-shadow: 0 0 4px rgba(#d07030, 0.2);
}
.ex-high {
  color: #d04040;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(#d04040, 0.2);
}
.ex-max {
  color: $c-danger;
  font-weight: bold;
  text-shadow: 0 0 8px rgba($c-danger, 0.3);
  animation: exPulse 1.5s ease-in-out infinite;
}
@keyframes exPulse {
  0%,
  100% {
    text-shadow: 0 0 8px rgba($c-danger, 0.3);
  }
  50% {
    text-shadow: 0 0 14px rgba($c-danger, 0.5);
  }
}

// ── 当前生效道具 ──
.active-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.active-tag {
  font-size: 0.8rem;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 12px;
  color: lighten($c-good, 10%);
  border: 1px solid rgba($c-good, 0.3);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.04) 100%);
  box-shadow: 0 0 8px rgba($c-good, 0.08);
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, rgba($c-good, 0.18) 0%, rgba($c-good, 0.06) 100%);
    box-shadow: 0 0 12px rgba($c-good, 0.12);
  }

  &.temp-tag {
    color: $c-gold;
    border-color: rgba($c-gold, 0.3);
    background: linear-gradient(135deg, rgba($c-gold, 0.12) 0%, rgba($c-gold, 0.04) 100%);
    box-shadow: 0 0 8px rgba($c-gold, 0.08);
    .temp-turns {
      color: rgba($c-warn, 0.8);
      margin-left: 4px;
      font-size: 0.6rem;
    }
  }
}

// ── 肉体改造标签 ──
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mod-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba($c-danger, 0.1) 0%, rgba($c-danger, 0.03) 100%);
  border: 1px solid rgba($c-danger, 0.2);
  border-radius: 8px;
  font-size: 0.82rem;
  transition: all 0.2s;

  &:hover {
    border-color: rgba($c-danger, 0.3);
    background: linear-gradient(135deg, rgba($c-danger, 0.12) 0%, rgba($c-danger, 0.04) 100%);
  }
}
.mod-label {
  color: rgba($c-danger, 0.7);
  font-weight: 600;
  font-size: 0.68rem;
  letter-spacing: 0.3px;
}
.mod-value {
  color: rgba(#e0a0c0, 0.9);
  font-weight: bold;
}

// ── 性具标签 ──
.toy-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.toy-empty {
  font-size: 0.82rem;
  color: rgba(#aaa, 0.5);
  font-style: italic;
}
.toy-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba(#e04880, 0.12) 0%, rgba(#e04880, 0.04) 100%);
  border: 1px solid rgba(#e04880, 0.25);
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: bold;
  color: #f0a0c0;
  text-shadow: 0 0 6px rgba(#e04880, 0.1);
  transition: all 0.2s;

  &:hover {
    border-color: rgba(#e04880, 0.4);
    background: linear-gradient(135deg, rgba(#e04880, 0.18) 0%, rgba(#e04880, 0.06) 100%);
    box-shadow: 0 0 8px rgba(#e04880, 0.12);
  }
}

// ── 性癖标签 ──
.kink-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kink-chip {
  display: inline-block;
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba(#d060a0, 0.12) 0%, rgba(#d060a0, 0.04) 100%);
  border: 1px solid rgba(#d060a0, 0.22);
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: bold;
  color: #e8b0d0;
  text-shadow: 0 0 6px rgba(#d060a0, 0.1);
  transition: all 0.2s;

  &:hover {
    border-color: rgba(#d060a0, 0.35);
    background: linear-gradient(135deg, rgba(#d060a0, 0.15) 0%, rgba(#d060a0, 0.05) 100%);
    box-shadow: 0 0 8px rgba(#d060a0, 0.1);
  }
}

// ── 心理活动 ──
.thought-box {
  background: linear-gradient(135deg, rgba($c-pri, 0.08) 0%, rgba($c-bg, 0.4) 100%);
  border: 1px solid rgba($c-acc, 0.15);
  border-left: 3px solid rgba($c-acc, 0.4);
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
    content: '"';
    position: absolute;
    top: 4px;
    left: 10px;
    font-size: 1.8rem;
    color: rgba($c-acc, 0.12);
    font-family: Georgia, serif;
    line-height: 1;
  }
}

// ── 响应式 ──
@media (max-width: 480px) {
  .body-grid {
    grid-template-columns: 1fr;
  }
  .attire-grid {
    grid-template-columns: 1fr 1fr;
  }
  .attire-expose {
    grid-column: 1 / -1;
  }
  .card {
    padding: 10px 12px;
  }
}
@media (max-width: 320px) {
  .attire-grid {
    grid-template-columns: 1fr;
  }
}
</style>
