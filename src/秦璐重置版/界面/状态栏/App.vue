<template>
  <div class="mystic-container">
    <div class="bg-pattern"></div>
    <div class="main-panel">
      <div class="panel-decor top"></div>

      <!-- 头部信息 -->
      <header class="header">
        <div class="world-info">
          <span class="info-item"><i class="icon">📅</i>{{ safeWorld.日期 }}</span>
          <span class="divider">✦</span>
          <span class="info-item"><i class="icon">🕐</i>{{ safeWorld.时间 }}</span>
          <span class="divider">✦</span>
          <span class="info-item"><i class="icon">📍</i>{{ safeWorld.地点 }}</span>
        </div>
        <div v-if="safeWorld.环境氛围 !== '日常'" class="environment">「 {{ safeWorld.环境氛围 }} 」</div>
      </header>

      <!-- 角色切换 -->
      <nav class="char-tabs">
        <div
          v-for="char in ['秦璐', '苏梦']"
          :key="char"
          :class="['tab-item', { active: activeCharacter === char }]"
          @click="selectCharacter(char)"
        >
          <span class="char-name">{{ char }}</span>
          <span class="char-role">{{ char === '秦璐' ? '母亲' : '姐姐' }}</span>
        </div>
      </nav>

      <!-- 念头植入 -->
      <section class="implant-control">
        <div class="control-header">
          <span class="decor-line"></span>
          <span class="title">念头植入</span>
          <span class="decor-line"></span>
        </div>
        <div class="input-group">
          <div class="target-hint">植入对象：<strong>{{ activeCharacter }}</strong></div>
          <div class="input-wrapper">
            <input
              v-model="thoughtContent"
              type="text"
              :maxlength="MAX_THOUGHT_LENGTH"
              :placeholder="`简短念头（${MAX_THOUGHT_LENGTH}字内）...`"
              @keyup.enter="implantThought"
            />
            <span class="char-count" :class="{ 'at-limit': thoughtContent.length >= MAX_THOUGHT_LENGTH }">
              {{ thoughtContent.length }}/{{ MAX_THOUGHT_LENGTH }}
            </span>
            <button class="submit-btn" :disabled="!thoughtContent.trim()" @click="implantThought">
              <span>植入</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 状态展示区 -->
      <main class="status-display">
        <!-- 左侧：核心数值 + 苏文 -->
        <div class="col-left">
          <!-- 阶段圆环 -->
          <div class="stage-card">
            <div class="stage-ring">
              <svg viewBox="0 0 36 36" class="circular-chart">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path
                  class="circle"
                  :stroke-dasharray="`${((char?.当前阶段 ?? 1) / 5) * 100}, 100`"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div class="stage-text">
                <span class="label">阶段</span>
                <span class="value">{{ char?.阶段标题 ?? '初始' }}</span>
              </div>
            </div>
          </div>

          <!-- 三维数值 -->
          <div class="stats-group">
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">🔥 堕落度</span>
                <span class="num">{{ char?.堕落度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar stat-corruption" :style="{ width: (char?.堕落度 ?? 0) + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💕 主角依存</span>
                <span class="num">{{ char?.对主角依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar stat-desire" :style="{ width: Math.max(0, char?.对主角依存度 ?? 0) + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💔 苏文依存</span>
                <span class="num">{{ char?.对苏文依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar stat-husband" :style="{ width: Math.max(0, char?.对苏文依存度 ?? 0) + '%' }"></div>
              </div>
            </div>
          </div>

          <!-- 苏文状态 -->
          <div class="suwen-card">
            <div class="suwen-header">
              <span class="name">苏文</span>
              <span :class="['status-tag', suwenStatusClass]">{{ suwenStatusDisplay }}</span>
            </div>
            <div class="suwen-location">📍 {{ data?.苏文状态?.当前位置 ?? '客厅' }}</div>
            <div class="suspicion-row">
              <span class="label">疑心</span>
              <div class="suspicion-track">
                <div :class="['suspicion-fill', { danger: currentSuspicion > 70 }]" :style="{ width: currentSuspicion + '%' }"></div>
              </div>
              <span class="val">{{ currentSuspicion }}</span>
            </div>
            <!-- 加速提示 -->
            <div v-if="isAccelerating" class="accel-hint">⚡ 苏文在场·念头加速中</div>
            <div v-else-if="suwenSafeReason" class="safe-indicator">
              <span class="safe-icon">✓</span><span class="safe-text">{{ suwenSafeReason }}</span>
            </div>
          </div>
        </div>

        <!-- 右侧：详情 -->
        <div class="col-right">
          <!-- 心境 -->
          <div class="mental-section">
            <div class="section-title">💭 心境</div>
            <div class="mental-content">
              <div class="emotion-row">
                <span class="label">情绪</span>
                <span :class="['emotion-val', { 'vulnerable-glow': isVulnerable }]">{{ char?.当前情绪 ?? '平静' }}</span>
              </div>
              <!-- 心防松动提示 -->
              <div v-if="isVulnerable" class="vulnerable-hint">
                <span class="vulnerable-icon">⚡</span>
                <span>心防松动 · 可植入越级念头</span>
              </div>
              <div class="thought-bubble">
                <template v-if="char?.当前心理想法">「 {{ char.当前心理想法 }} 」</template>
              </div>
            </div>
          </div>

          <!-- 培育中的念头 -->
          <div class="thought-section">
            <div class="section-title">🌱 培育中念头</div>
            <div v-if="thoughtList.length === 0" class="empty">暂无</div>
            <div v-for="t in thoughtList" :key="t.id" class="thought-item">
              <div class="thought-head">
                <span :class="['status-tag', thoughtStatusClass(t.状态)]">{{ t.状态 }}</span>
                <span class="thought-type">{{ t.类型 }}</span>
              </div>
              <div class="thought-content">{{ t.内容 }}</div>
              <div v-if="t.状态 === '培育中'" class="thought-progress">
                <div class="progress-track"><div class="progress-bar" :style="{ width: thoughtProgressPercent(t) + '%' }"></div></div>
                <span class="progress-text">{{ Math.floor(t.开发进度) }}/{{ t.需要楼数 }}楼</span>
              </div>
              <div v-if="t.状态 === '未达标'" class="thought-reject">
                她现在还接受不了，需要先推进关系
                <button class="mini-btn" @click="discardThought(t.id)">退回</button>
              </div>
            </div>
          </div>

          <!-- 习惯 -->
          <div class="habit-section">
            <div class="section-title">💚 习惯 ({{ habitList.length }}/5)</div>
            <div v-if="habitList.length === 0" class="empty">暂无</div>
            <div v-for="(h, i) in habitList" :key="i" class="habit-item">
              <span class="habit-text">{{ h.内容 }}</span>
              <button v-if="habitList.length >= 5" class="sell-btn" @click="sellHabit(i)">出售+100</button>
            </div>
            <div v-if="habitList.length >= 5" class="habit-full-tip">⚠ 习惯已满，出售腾位后可接纳新习惯</div>
          </div>

          <!-- 货币 -->
          <div class="currency-section">
            <span class="section-title">💰 货币</span>
            <span class="currency-val">{{ data?.系统?.货币 ?? 0 }}</span>
          </div>
        </div>
      </main>

      <div class="panel-decor bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SchemaType } from '../../schema';

const MAX_THOUGHT_LENGTH = 50;
const VULNERABLE_EMOTION = '心防松动';

const data = ref<SchemaType | null>(null);
const activeCharacter = ref<'秦璐' | '苏梦'>('秦璐');
const thoughtContent = ref('');

function getCurrentMessageId(): number {
  return getCurrentMessageId2();
}
function getCurrentMessageId2(): number {
  return SillyTavern.chat?.length ?? 0;
}

async function refreshData() {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    data.value = _.get(vars, 'stat_data') as SchemaType;
  } catch (e) {
    console.warn('[秦璐重置版] 刷新数据失败', e);
  }
}

function selectCharacter(c: '秦璐' | '苏梦') {
  activeCharacter.value = c;
  refreshData();
}

const char = computed(() => {
  const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
  return data.value?.[key] ?? null;
});

const safeWorld = computed(() => data.value?.世界 ?? { 时间: '', 日期: '', 地点: '', 环境氛围: '日常' });

const currentSuspicion = computed(() => {
  return activeCharacter.value === '秦璐'
    ? data.value?.苏文状态?.对秦璐疑心值 ?? 0
    : data.value?.苏文状态?.对苏梦疑心值 ?? 0;
});

const suwenStatusDisplay = computed(() => {
  const s = data.value?.苏文状态?.当前状态 ?? '在家';
  if (s === '外出') return '外出工作';
  if (s === '睡眠') return '睡眠中';
  return '在家';
});

const suwenStatusClass = computed(() => {
  const s = data.value?.苏文状态?.当前状态 ?? '在家';
  if (s === '外出') return 'away';
  if (s === '睡眠') return 'sleeping';
  return 'home';
});

const suwenSafeReason = computed(() => {
  const s = data.value?.苏文状态?.当前状态 ?? '在家';
  if (s === '外出') return '苏文外出，可安心进行';
  if (s === '睡眠') return '苏文熟睡，相对安全';
  return '';
});

// 苏文在加速房（餐厅/客厅/主卧）→ 念头加速
const isAccelerating = computed(() => {
  const loc = data.value?.苏文状态?.当前位置;
  return loc === '餐厅' || loc === '客厅' || loc === '主卧';
});

// 心防松动（情绪覆写为"心防松动"）
const isVulnerable = computed(() => char.value?.当前情绪 === VULNERABLE_EMOTION);

const thoughtList = computed(() => {
  const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
  const thoughts = data.value?.[key]?.念头列表 ?? {};
  return Object.entries(thoughts).map(([id, t]) => ({ id, ...t }));
});

const habitList = computed(() => char.value?.习惯列表 ?? []);

function thoughtStatusClass(s: string) {
  if (s === '培育中') return 'growing';
  if (s === '判定中') return 'pending';
  if (s === '未达标') return 'rejected';
  if (s === '已成熟') return 'mature';
  return '';
}

function thoughtProgressPercent(t: any) {
  return Math.min(100, ((t.开发进度 ?? 0) / (t.需要楼数 || 1)) * 100);
}

// 念头植入（乐观植入：立即写入，状态=判定中）
async function implantThought() {
  const content = thoughtContent.value.trim();
  if (!content) return;
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType | undefined;
    if (!d || !d[key]) {
      toastr.warning('变量未初始化，请先发一条消息让 AI 回复后再植入');
      console.warn('[秦璐重置版] stat_data 或角色状态不存在，无法植入');
      return;
    }
    const id = `念头_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (!d[key].念头列表) d[key].念头列表 = {};
    d[key].念头列表[id] = {
      内容: content,
      类型: '待判定',
      状态: '判定中',
      难度: '待定',
      需要楼数: 0,
      开发进度: 0,
      植入楼层: getCurrentMessageId(),
    };
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    thoughtContent.value = '';
    console.info(`[秦璐重置版] 植入念头 ${id}：「${content}」`);
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版] 植入失败', e);
    toastr.error('植入失败');
  }
}

// 退回未达标念头
async function discardThought(id: string) {
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType;
    delete d[key].念头列表[id];
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版] 退回失败', e);
  }
}

// 变卖习惯（满5才能卖）
async function sellHabit(index: number) {
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType;
    if (d[key].习惯列表.length < 5) {
      toastr.warning('习惯未满5，不可出售');
      return;
    }
    d[key].习惯列表.splice(index, 1);
    d.系统.货币 += 100;
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    console.info('[秦璐重置版] 变卖习惯 +100货币');
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版] 变卖失败', e);
  }
}

// 初始化 + 监听数据变化
refreshData();
eventOn(tavern_events.MESSAGE_RECEIVED, () => refreshData());
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => refreshData());
</script>

<style scoped lang="scss">
$c-bg: #0d0d0d;
$c-panel: #1a1a1a;
$c-gold: #d4af37;
$c-gold-dim: #8a7326;
$c-text: #e0e0e0;
$c-red: #c54b4b;
$c-green: #4caf50;
$c-cyan: #4fc3f7;
$c-orange: #ff9800;
$c-pink: #ff5d8f;

.mystic-container {
  width: 100%;
  background: $c-bg;
  color: $c-text;
  font-family: 'Noto Serif SC', serif;
  position: relative;
}
.bg-pattern { position: absolute; inset: 0; opacity: 0.03; background-image: radial-gradient($c-gold 1px, transparent 1px); background-size: 20px 20px; pointer-events: none; }
.main-panel { position: relative; padding: 12px; }
.panel-decor { height: 2px; background: linear-gradient(90deg, transparent, $c-gold, transparent); margin: 8px 0; }

.header { text-align: center; margin-bottom: 10px; }
.world-info { display: flex; justify-content: center; gap: 8px; align-items: center; font-size: 12px; color: $c-gold-dim; }
.info-item .icon { margin-right: 2px; }
.divider { color: $c-gold-dim; }
.environment { color: $c-gold; font-size: 13px; margin-top: 4px; }

.char-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.tab-item { flex: 1; text-align: center; padding: 8px; border: 1px solid #333; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: $c-panel; }
.tab-item.active { border-color: $c-gold; background: rgba(212,175,55,0.1); }
.tab-item:hover { border-color: $c-gold-dim; }
.char-name { display: block; color: $c-gold; font-size: 15px; }
.char-role { display: block; font-size: 11px; color: #888; }

.implant-control { margin-bottom: 12px; }
.control-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.decor-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, $c-gold-dim, transparent); }
.control-header .title { color: $c-gold; font-size: 14px; }
.target-hint { font-size: 12px; color: #aaa; margin-bottom: 6px; }
.input-wrapper { display: flex; gap: 6px; align-items: center; position: relative; }
.input-wrapper input { flex: 1; background: $c-panel; border: 1px solid #333; border-radius: 4px; padding: 6px 8px; color: $c-text; font-size: 13px; }
.char-count { font-size: 10px; color: #666; }
.char-count.at-limit { color: $c-red; }
.submit-btn { padding: 6px 16px; background: linear-gradient(135deg, $c-gold-dim, $c-gold); border: none; border-radius: 4px; color: #000; cursor: pointer; font-weight: 700; }
.submit-btn:disabled { opacity: 0.4; }

.status-display { display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px; }

.col-left { display: flex; flex-direction: column; gap: 10px; }
.stage-card { text-align: center; }
.stage-ring { position: relative; width: 80px; height: 80px; margin: 0 auto; }
.circular-chart { width: 100%; height: 100%; }
.circle-bg { fill: none; stroke: #333; stroke-width: 2; }
.circle { fill: none; stroke: $c-gold; stroke-width: 2.5; stroke-linecap: round; }
.stage-text { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.stage-text .label { font-size: 10px; color: #888; }
.stage-text .value { font-size: 14px; color: $c-gold; }

.stats-group { display: flex; flex-direction: column; gap: 8px; }
.stat-item { }
.stat-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
.stat-header .num { color: $c-gold; }
.progress-track { height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
.progress-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
.stat-corruption { background: linear-gradient(90deg, $c-orange, $c-red); }
.stat-desire { background: linear-gradient(90deg, #c54b8f, $c-pink); }
.stat-husband { background: linear-gradient(90deg, #555, #888); }

.suwen-card { background: $c-panel; border: 1px solid #333; border-radius: 6px; padding: 8px; }
.suwen-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.suwen-header .name { color: $c-gold; font-size: 13px; }
.status-tag { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #333; }
.status-tag.home { background: rgba(196,75,75,0.3); color: $c-red; }
.status-tag.away { background: rgba(76,175,80,0.3); color: $c-green; }
.status-tag.sleeping { background: rgba(79,195,247,0.3); color: $c-cyan; }
.suwen-location { font-size: 11px; color: #aaa; margin-bottom: 6px; }
.suspicion-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.suspicion-track { flex: 1; height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
.suspicion-fill { height: 100%; background: $c-orange; border-radius: 3px; }
.suspicion-fill.danger { background: $c-red; }
.accel-hint { font-size: 11px; color: $c-orange; margin-top: 6px; }
.safe-indicator { font-size: 11px; color: $c-green; margin-top: 6px; display: flex; gap: 4px; align-items: center; }

.col-right { display: flex; flex-direction: column; gap: 10px; }
.section-title { color: $c-gold; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 3px; }
.mental-section { }
.mental-content { background: $c-panel; border-radius: 6px; padding: 8px; }
.emotion-row { display: flex; gap: 6px; align-items: center; font-size: 13px; margin-bottom: 6px; }
.emotion-val { color: $c-gold; }
.emotion-val.vulnerable-glow { color: $c-pink; font-weight: 700; text-shadow: 0 0 6px rgba(255,93,143,0.6); animation: vuln-pulse 1.6s ease-in-out infinite; }
@keyframes vuln-pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
.vulnerable-hint { display: flex; gap: 4px; align-items: center; padding: 4px 6px; background: rgba(255,93,143,0.12); border: 1px solid rgba(255,93,143,0.4); border-radius: 4px; font-size: 11px; color: $c-pink; margin-bottom: 6px; }
.thought-bubble { font-size: 12px; color: #ccc; font-style: italic; min-height: 16px; }

.thought-section { }
.empty { font-size: 12px; color: #555; }
.thought-item { background: $c-panel; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; }
.thought-head { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
.thought-type { font-size: 11px; color: #888; }
.status-tag.growing { background: rgba(76,175,80,0.3); color: $c-green; }
.status-tag.pending { background: rgba(79,195,247,0.3); color: $c-cyan; }
.status-tag.rejected { background: rgba(196,75,75,0.3); color: $c-red; }
.status-tag.mature { background: rgba(212,175,55,0.3); color: $c-gold; }
.thought-content { font-size: 12px; color: #ddd; margin-bottom: 4px; }
.thought-progress { display: flex; align-items: center; gap: 6px; }
.thought-progress .progress-bar { background: $c-green; }
.progress-text { font-size: 10px; color: #888; white-space: nowrap; }
.thought-reject { font-size: 11px; color: $c-red; display: flex; justify-content: space-between; align-items: center; }
.mini-btn { font-size: 10px; padding: 2px 8px; background: #333; border: 1px solid $c-red; border-radius: 3px; color: $c-red; cursor: pointer; }

.habit-section { }
.habit-item { display: flex; justify-content: space-between; align-items: center; background: $c-panel; border-radius: 4px; padding: 4px 8px; margin-bottom: 4px; font-size: 12px; }
.habit-text { color: $c-green; }
.sell-btn { font-size: 10px; padding: 2px 8px; background: rgba(212,175,55,0.2); border: 1px solid $c-gold-dim; border-radius: 3px; color: $c-gold; cursor: pointer; }
.habit-full-tip { font-size: 11px; color: $c-orange; margin-top: 4px; }

.currency-section { display: flex; justify-content: space-between; align-items: center; }
.currency-val { color: $c-gold; font-size: 16px; font-weight: 700; }
</style>