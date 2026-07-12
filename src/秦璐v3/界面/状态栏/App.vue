<template>
  <div class="mystic-container">
    <div class="bg-pattern"></div>
    <div class="main-panel">
      <div class="panel-decor top"></div>

      <!-- 头部 -->
      <header class="header">
        <div class="world-info">
          <span class="info-item"><i>📅</i>{{ safeWorld.日期 || '——' }}</span>
          <span class="divider">✦</span>
          <span class="info-item"><i>🕐</i>{{ safeWorld.时间 || '——' }}</span>
          <span class="divider">✦</span>
          <span class="info-item"><i>📍</i>{{ safeWorld.地点 || '——' }}</span>
        </div>
        <div v-if="safeWorld.环境氛围 && safeWorld.环境氛围 !== '日常'" class="environment">
          「 {{ safeWorld.环境氛围 }} 」
        </div>
      </header>

      <!-- 单角色标签（v2：仅秦璐） -->
      <nav class="char-tabs">
        <div class="tab-item active">
          <span class="char-name">秦璐</span>
          <span class="char-role">苏秦集团 · 暗面女王</span>
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
          <div class="target-hint">植入对象：<strong>秦璐</strong></div>
          <div class="input-wrapper">
            <input
              v-model="thoughtContent"
              type="text"
              :maxlength="MAX_LEN"
              :placeholder="`简短念头（${MAX_LEN}字内）...`"
              @keyup.enter="implantThought"
            />
            <span class="char-count" :class="{ 'at-limit': thoughtContent.length >= MAX_LEN }">
              {{ thoughtContent.length }}/{{ MAX_LEN }}
            </span>
            <button class="submit-btn" :disabled="!thoughtContent.trim()" @click="implantThought">
              <span>植入</span>
            </button>
          </div>
          <div v-if="implantMsg" :class="['implant-msg', implantMsgType]">{{ implantMsg }}</div>
        </div>
      </section>

      <!-- 状态展示 -->
      <main class="status-display">
        <!-- 左：数值 + 苏文 -->
        <div class="col-left">
          <!-- 阶段圆环 -->
          <div class="stage-card">
            <div class="stage-ring">
              <svg viewBox="0 0 36 36" class="circular-chart">
                <path
                  class="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="circle"
                  :stroke-dasharray="`${((char?.当前阶段 ?? 1) / 4) * 100}, 100`"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div class="stage-text">
                <span class="label">阶段</span>
                <span class="value">{{ char?.阶段标题 ?? '掌控' }}</span>
              </div>
            </div>
          </div>

          <!-- 三维数值 -->
          <div class="stats-group">
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">🖤 沦陷度</span>
                <span class="num">{{ char?.沦陷度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar stat-corruption" :style="{ width: (char?.沦陷度 ?? 0) + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">👁️ 警觉度</span>
                <span class="num">{{ char?.对念头植入警觉度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar stat-alert" :style="{ width: (char?.对念头植入警觉度 ?? 0) + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💕 儿子依存</span>
                <span class="num">{{ char?.对主角依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-desire"
                  :style="{ width: Math.max(0, char?.对主角依存度 ?? 0) + '%' }"
                ></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💔 丈夫依存</span>
                <span class="num">{{ char?.对苏文依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-husband"
                  :style="{ width: Math.max(0, char?.对苏文依存度 ?? 0) + '%' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- 苏文状态 -->
          <div class="suwen-card">
            <div class="suwen-header">
              <span class="name">苏文</span>
              <span :class="['status-tag', suwenStatusClass]">{{ suwenStatusDisplay }}</span>
            </div>
            <div class="suwen-location">📍 {{ suwenPos }}</div>
            <div class="suspicion-row">
              <span class="label">疑心</span>
              <div class="suspicion-track">
                <div :class="['suspicion-fill', { danger: suspicion > 70 }]" :style="{ width: suspicion + '%' }"></div>
              </div>
              <span class="val">{{ suspicion }}</span>
            </div>
            <div v-if="isAccelerating" class="accel-hint">⚡ 苏文在附近 · 念头加速中</div>
            <div v-else-if="suwenSafeReason" class="safe-indicator">
              <span class="safe-icon">✓</span><span>{{ suwenSafeReason }}</span>
            </div>
          </div>

          <!-- 货币 -->
          <div class="currency-card">
            <span class="label">💰 货币</span>
            <span class="val">{{ data?.系统?.货币 ?? 0 }}</span>
          </div>
        </div>

        <!-- 右：详情 -->
        <div class="col-right">
          <!-- 心境 -->
          <div class="detail-card">
            <div class="section-title">💭 心境</div>
            <div class="emotion-row">
              <span class="label">情绪</span>
              <span :class="['emotion-val', { 'vulnerable-glow': isVulnerable }]">{{ char?.当前情绪 ?? '冷静' }}</span>
            </div>
            <div v-if="isVulnerable" class="vulnerable-hint"><span>⚡</span><span>心防松动 · 可植入越级念头</span></div>
            <div class="thought-bubble" v-if="char?.当前心理想法">「 {{ char.当前心理想法 }} 」</div>
            <div class="temperament" v-if="char?.气质描述">— {{ char.气质描述 }}</div>
          </div>

          <!-- 念头列表 -->
          <div class="detail-card">
            <div class="section-title">
              🌱 念头 <span class="count">({{ thoughtList.length }})</span>
            </div>
            <div v-if="thoughtList.length === 0" class="empty">暂无念头</div>
            <div v-for="t in thoughtList" :key="t.id" class="thought-item">
              <div class="thought-head">
                <span :class="['status-tag', thoughtStatusClass(t.状态)]">{{ t.状态 }}</span>
                <span class="thought-type">{{ t.类型 }}</span>
                <span v-if="t.难度 && t.难度 !== '待定'" class="thought-diff">{{ t.难度 }}</span>
              </div>
              <div class="thought-content">{{ t.内容 }}</div>
              <div v-if="t.状态 === '培育中'" class="thought-progress">
                <div class="progress-track">
                  <div class="progress-bar" :style="{ width: thoughtProgressPercent(t) + '%' }"></div>
                </div>
                <span class="progress-text">{{ Math.floor(t.开发进度) }}/{{ t.需要楼数 }}楼</span>
              </div>
              <div v-if="t.状态 === '未达标'" class="thought-reject">
                <span>她还接受不了，需先推进关系</span>
                <button class="mini-btn" @click="discardThought(t.id)">退回</button>
              </div>
            </div>
          </div>

          <!-- 习惯 -->
          <div class="detail-card">
            <div class="section-title">
              💚 习惯 <span class="count">({{ habitList.length }}/5)</span>
            </div>
            <div v-if="habitList.length === 0" class="empty">暂无习惯</div>
            <div v-for="(h, i) in habitList" :key="i" class="habit-item">
              <span class="habit-text">{{ h.内容 }}</span>
              <button v-if="habitList.length >= 5" class="sell-btn" @click="sellHabit(i)">出售+100</button>
            </div>
            <div v-if="habitList.length >= 5" class="habit-full-tip">⚠ 习惯已满，出售腾位后可接纳新习惯</div>
          </div>

          <!-- 仪容 -->
          <div class="detail-card">
            <div class="section-title">👗 仪容</div>
            <div class="attire-tags">
              <span class="mini-tag">{{ char?.服装细节?.整体风格 ?? '居家但精致的冷艳' }}</span>
              <span class="mini-tag outline">{{ char?.服装细节?.暴露程度 ?? '正常' }}</span>
            </div>
            <div class="clothing-list">
              <span class="clothing-item"
                ><span class="cl">上装</span>{{ char?.服装细节?.上装 ?? '黑色丝绸衬衫' }}</span
              >
              <span class="clothing-item"
                ><span class="cl">下装</span>{{ char?.服装细节?.下装 ?? '烟灰色高腰西裤' }}</span
              >
              <span class="clothing-item"
                ><span class="cl">内衣</span>{{ char?.服装细节?.内衣?.上 ?? '黑色蕾丝无钢圈文胸' }}</span
              >
              <span class="clothing-item"
                ><span class="cl">内裤</span>{{ char?.服装细节?.内衣?.下 ?? '黑色蕾丝丁字裤' }}</span
              >
              <span class="clothing-item"><span class="cl">袜</span>{{ char?.服装细节?.袜裤 ?? '无' }}</span>
            </div>
            <div class="makeup-line">
              💄 {{ char?.妆容细节?.浓淡程度 ?? '淡妆' }} · {{ char?.妆容细节?.整体风格 ?? '冷艳精致' }}
            </div>
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

const MAX_LEN = 20;
const VULNERABLE_EMOTION = '心防松动';

const data = ref<SchemaType | null>(null);
const thoughtContent = ref('');
const implantMsg = ref('');
const implantMsgType = ref<'success' | 'error' | 'warn'>('error');

function getMessageId(): number {
  return SillyTavern.chat?.length ?? 0;
}

async function refreshData() {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    data.value = (_.get(vars, 'stat_data') as SchemaType) ?? null;
  } catch (e) {
    console.warn('[秦璐重置版 v2] 刷新数据失败', e);
  }
}

const char = computed(() => data.value?.秦璐状态 ?? null);

const safeWorld = computed(() => data.value?.世界 ?? { 时间: '', 日期: '', 地点: '', 环境氛围: '日常' });

const suwen = computed(() => data.value?.苏文状态 ?? null);
const suwenPos = computed(() => suwen.value?.当前位置 ?? '客厅');
const suwenStatusDisplay = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '外出工作' : s === '睡眠' ? '睡眠中' : '在家';
});
const suwenStatusClass = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? 'away' : s === '睡眠' ? 'sleeping' : 'home';
});
const suwenSafeReason = computed(() => {
  const s = suwen.value?.当前状态 ?? '在家';
  return s === '外出' ? '苏文外出，可安心进行' : s === '睡眠' ? '苏文熟睡，相对安全' : '';
});

const isAccelerating = computed(() => {
  const p = suwen.value?.当前位置;
  return p === '餐厅' || p === '客厅' || p === '主卧';
});

const suspicion = computed(() => suwen.value?.对秦璐疑心值 ?? 0);

const isVulnerable = computed(() => char.value?.当前情绪 === VULNERABLE_EMOTION);

const thoughtList = computed(() => {
  const thoughts = data.value?.秦璐状态?.念头列表 ?? {};
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

function showMsg(msg: string, type: 'success' | 'error' | 'warn') {
  implantMsg.value = msg;
  implantMsgType.value = type;
  setTimeout(() => (implantMsg.value = ''), 3000);
}

async function implantThought() {
  const content = thoughtContent.value.trim();
  if (!content) return;
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType | undefined;
    if (!d || !d.秦璐状态) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复后再植入', 'warn');
      return;
    }
    const id = `念头_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (!d.秦璐状态.念头列表) d.秦璐状态.念头列表 = {};
    d.秦璐状态.念头列表[id] = {
      内容: content,
      类型: '待判定',
      状态: '判定中',
      难度: '待定',
      需要楼数: 0,
      开发进度: 0,
      植入楼层: getMessageId(),
    };
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    thoughtContent.value = '';
    showMsg(`已植入：${content}`, 'success');
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版 v2] 植入失败', e);
    showMsg('植入失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

async function discardThought(id: string) {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType;
    delete d.秦璐状态.念头列表[id];
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版 v2] 退回失败', e);
  }
}

async function sellHabit(index: number) {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType;
    if (d.秦璐状态.习惯列表.length < 5) {
      showMsg('习惯未满5，不可出售', 'warn');
      return;
    }
    d.秦璐状态.习惯列表.splice(index, 1);
    d.系统.货币 += 100;
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg('变卖习惯 +100货币', 'success');
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版 v2] 变卖失败', e);
  }
}

refreshData();
eventOn(tavern_events.MESSAGE_RECEIVED, () => refreshData());
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => refreshData());
</script>

<style scoped lang="scss">
$c-bg: #0d0d0d;
$c-panel: #1a1a1a;
$c-panel-light: #222;
$c-gold: #d4af37;
$c-gold-dim: #8a7326;
$c-gold-bright: #f0d060;
$c-text: #e0e0e0;
$c-text-dim: #888;
$c-red: #c54b4b;
$c-green: #4caf50;
$c-cyan: #4fc3f7;
$c-orange: #ff9800;
$c-pink: #ff5d8f;
$c-border: #333;

.mystic-container {
  width: 100%;
  background: $c-bg;
  color: $c-text;
  font-family: 'Noto Serif SC', 'STSong', serif;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}
.bg-pattern {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(212, 175, 55, 0.3) 1px, transparent 1px),
    radial-gradient(circle at 80% 70%, rgba(212, 175, 55, 0.2) 1px, transparent 1px);
  background-size:
    30px 30px,
    25px 25px;
  pointer-events: none;
}
.main-panel {
  position: relative;
  padding: 14px;
  background: linear-gradient(135deg, rgba(26, 26, 26, 0.6) 0%, rgba(13, 13, 13, 0.9) 100%);
  backdrop-filter: blur(4px);
}
.panel-decor {
  height: 2px;
  background: linear-gradient(90deg, transparent, $c-gold, transparent);
  margin: 10px 0;
}

// 头部
.header {
  text-align: center;
  margin-bottom: 12px;
}
.world-info {
  display: flex;
  justify-content: center;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: $c-gold-dim;
}
.info-item i {
  margin-right: 3px;
  font-style: normal;
}
.divider {
  color: $c-gold-dim;
  opacity: 0.5;
}
.environment {
  color: $c-gold;
  font-size: 13px;
  margin-top: 5px;
  letter-spacing: 1px;
}

// 角色标签（v2：单角色）
.char-tabs {
  display: flex;
  margin-bottom: 14px;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px;
  border: 1px solid $c-gold;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.03) 100%);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.15);
}
.char-name {
  display: block;
  color: $c-gold;
  font-size: 16px;
  font-weight: 600;
}
.char-role {
  display: block;
  font-size: 11px;
  color: $c-text-dim;
  margin-top: 2px;
}

// 植入（保留原样）
.implant-control {
  margin-bottom: 14px;
}
.control-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.decor-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, $c-gold-dim, transparent);
}
.control-header .title {
  color: $c-gold-bright;
  font-size: 14px;
  letter-spacing: 2px;
  font-weight: 600;
}
.target-hint {
  font-size: 12px;
  color: $c-text-dim;
  margin-bottom: 8px;
}
.target-hint strong {
  color: $c-gold;
}
.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}
.input-wrapper input {
  flex: 1;
  background: $c-panel;
  border: 1px solid $c-border;
  border-radius: 5px;
  padding: 7px 10px;
  color: $c-text;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}
.input-wrapper input:focus {
  border-color: $c-gold-dim;
  outline: none;
}
.char-count {
  font-size: 10px;
  color: #555;
}
.char-count.at-limit {
  color: $c-red;
}
.submit-btn {
  padding: 7px 18px;
  background: linear-gradient(135deg, $c-gold-dim, $c-gold);
  border: none;
  border-radius: 5px;
  color: #000;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, $c-gold, $c-gold-bright);
}
.submit-btn:disabled {
  opacity: 0.35;
}
.implant-msg {
  font-size: 12px;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 4px;
}
.implant-msg.success {
  color: $c-green;
  background: rgba(76, 175, 80, 0.1);
}
.implant-msg.error {
  color: $c-red;
  background: rgba(196, 75, 75, 0.1);
}
.implant-msg.warn {
  color: $c-orange;
  background: rgba(255, 152, 0, 0.1);
}

// 状态展示
.status-display {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 14px;
}
.col-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// 阶段圆环
.stage-card {
  text-align: center;
  padding: 4px 0;
}
.stage-ring {
  position: relative;
  width: 90px;
  height: 90px;
  margin: 0 auto;
}
.circular-chart {
  width: 100%;
  height: 100%;
  transform: rotate(0deg);
}
.circle-bg {
  fill: none;
  stroke: #2a2a2a;
  stroke-width: 2;
}
.circle {
  fill: none;
  stroke: $c-gold;
  stroke-width: 2.8;
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.4));
  transition: stroke-dasharray 0.5s;
}
.stage-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.stage-text .label {
  font-size: 10px;
  color: $c-text-dim;
  letter-spacing: 1px;
}
.stage-text .value {
  font-size: 15px;
  color: $c-gold-bright;
  font-weight: 600;
  margin-top: 2px;
}

// 数值条
.stats-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-item {
  background: $c-panel;
  border-radius: 6px;
  padding: 8px 10px;
}
.stat-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}
.stat-header .name {
  color: $c-text-dim;
}
.stat-header .num {
  color: $c-gold;
  font-weight: 600;
}
.progress-track {
  height: 6px;
  background: #1a1a1a;
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.stat-corruption {
  background: linear-gradient(90deg, #8a2be2, #c54b8f);
  box-shadow: 0 0 6px rgba(197, 75, 143, 0.3);
}
.stat-alert {
  background: linear-gradient(90deg, #4fc3f7, #0288d1);
  box-shadow: 0 0 6px rgba(2, 136, 209, 0.3);
}
.stat-desire {
  background: linear-gradient(90deg, #c54b8f, $c-pink);
}
.stat-husband {
  background: linear-gradient(90deg, #555, #999);
}

// 苏文卡
.suwen-card {
  background: $c-panel;
  border: 1px solid $c-border;
  border-radius: 8px;
  padding: 10px;
}
.suwen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
.suwen-header .name {
  color: $c-gold;
  font-size: 14px;
  font-weight: 600;
}
.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: $c-panel-light;
}
.status-tag.home {
  background: rgba(196, 75, 75, 0.25);
  color: $c-red;
}
.status-tag.away {
  background: rgba(76, 175, 80, 0.25);
  color: $c-green;
}
.status-tag.sleeping {
  background: rgba(79, 195, 247, 0.25);
  color: $c-cyan;
}
.suwen-location {
  font-size: 12px;
  color: $c-text-dim;
  margin-bottom: 8px;
}
.suspicion-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.suspicion-row .label {
  color: $c-text-dim;
}
.suspicion-track {
  flex: 1;
  height: 6px;
  background: #1a1a1a;
  border-radius: 3px;
  overflow: hidden;
}
.suspicion-fill {
  height: 100%;
  background: $c-orange;
  border-radius: 3px;
  transition: width 0.4s;
}
.suspicion-fill.danger {
  background: $c-red;
  box-shadow: 0 0 6px rgba(196, 75, 75, 0.5);
}
.suspicion-row .val {
  color: $c-gold;
  font-weight: 600;
}
.accel-hint {
  font-size: 12px;
  color: $c-orange;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 152, 0, 0.1);
  border-left: 2px solid $c-orange;
  border-radius: 3px;
}
.safe-indicator {
  font-size: 12px;
  color: $c-green;
  margin-top: 8px;
  display: flex;
  gap: 5px;
  align-items: center;
}

// 货币
.currency-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: $c-panel;
  border: 1px solid $c-border;
  border-radius: 8px;
  padding: 10px 14px;
}
.currency-card .label {
  color: $c-text-dim;
  font-size: 13px;
}
.currency-card .val {
  color: $c-gold-bright;
  font-size: 18px;
  font-weight: 700;
}

// 右栏
.col-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-card {
  background: $c-panel;
  border: 1px solid $c-border;
  border-radius: 8px;
  padding: 10px 12px;
}
.section-title {
  color: $c-gold;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  border-bottom: 1px solid $c-border;
  padding-bottom: 4px;
  letter-spacing: 0.5px;
}
.section-title .count {
  color: $c-text-dim;
  font-weight: 400;
  font-size: 11px;
}

// 心境
.emotion-row {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 6px;
}
.emotion-row .label {
  color: $c-text-dim;
}
.emotion-val {
  color: $c-gold;
}
.emotion-val.vulnerable-glow {
  color: $c-pink;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(255, 93, 143, 0.6);
  animation: vuln-pulse 1.5s ease-in-out infinite;
}
@keyframes vuln-pulse {
  0%,
  100% {
    opacity: 1;
    text-shadow: 0 0 8px rgba(255, 93, 143, 0.6);
  }
  50% {
    opacity: 0.75;
    text-shadow: 0 0 14px rgba(255, 93, 143, 0.9);
  }
}
.vulnerable-hint {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 5px 8px;
  background: rgba(255, 93, 143, 0.1);
  border: 1px solid rgba(255, 93, 143, 0.35);
  border-radius: 5px;
  font-size: 11px;
  color: $c-pink;
  margin-bottom: 6px;
}
.thought-bubble {
  font-size: 12px;
  color: #bbb;
  font-style: italic;
  margin-bottom: 4px;
}
.temperament {
  font-size: 11px;
  color: $c-text-dim;
}

// 念头
.empty {
  font-size: 12px;
  color: #444;
  text-align: center;
  padding: 8px 0;
}
.thought-item {
  background: $c-panel-light;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 7px;
  border-left: 2px solid transparent;
  transition: border-color 0.2s;
}
.thought-item:hover {
  border-left-color: $c-gold-dim;
}
.thought-head {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.status-tag.growing {
  background: rgba(76, 175, 80, 0.25);
  color: $c-green;
}
.status-tag.pending {
  background: rgba(79, 195, 247, 0.25);
  color: $c-cyan;
}
.status-tag.rejected {
  background: rgba(196, 75, 75, 0.25);
  color: $c-red;
}
.status-tag.mature {
  background: rgba(212, 175, 55, 0.25);
  color: $c-gold;
}
.thought-type {
  font-size: 11px;
  color: $c-text-dim;
}
.thought-diff {
  font-size: 10px;
  color: $c-orange;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 152, 0, 0.1);
}
.thought-content {
  font-size: 13px;
  color: #ddd;
  margin-bottom: 5px;
}
.thought-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.thought-progress .progress-bar {
  background: linear-gradient(90deg, $c-gold-dim, $c-gold);
}
.progress-text {
  font-size: 10px;
  color: $c-text-dim;
  white-space: nowrap;
}
.thought-reject {
  font-size: 11px;
  color: $c-red;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mini-btn {
  font-size: 10px;
  padding: 2px 10px;
  background: transparent;
  border: 1px solid $c-red;
  border-radius: 3px;
  color: $c-red;
  cursor: pointer;
  transition: all 0.2s;
}
.mini-btn:hover {
  background: rgba(196, 75, 75, 0.2);
}

// 习惯
.habit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: $c-panel-light;
  border-radius: 5px;
  padding: 6px 10px;
  margin-bottom: 5px;
  font-size: 13px;
}
.habit-text {
  color: $c-green;
}
.sell-btn {
  font-size: 10px;
  padding: 3px 10px;
  background: rgba(212, 175, 55, 0.15);
  border: 1px solid $c-gold-dim;
  border-radius: 4px;
  color: $c-gold;
  cursor: pointer;
  transition: all 0.2s;
}
.sell-btn:hover {
  background: rgba(212, 175, 55, 0.25);
}
.habit-full-tip {
  font-size: 11px;
  color: $c-orange;
  margin-top: 6px;
  padding: 4px 8px;
  background: rgba(255, 152, 0, 0.08);
  border-radius: 4px;
}

// 仪容
.attire-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.mini-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(212, 175, 55, 0.1);
  color: $c-gold;
}
.mini-tag.outline {
  background: transparent;
  border: 1px solid $c-gold-dim;
}
.clothing-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}
.clothing-item {
  font-size: 12px;
  color: #ccc;
}
.clothing-item .cl {
  display: inline-block;
  width: 30px;
  color: $c-text-dim;
  font-size: 11px;
}
.makeup-line {
  font-size: 12px;
  color: $c-text-dim;
  padding-top: 4px;
  border-top: 1px solid #2a2a2a;
}

@media (max-width: 480px) {
  .status-display {
    grid-template-columns: 1fr;
  }
}
</style>
