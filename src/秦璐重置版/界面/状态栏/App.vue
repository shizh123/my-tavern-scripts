<template>
  <div :class="['mystic-container', 'th-stage-' + (char?.当前阶段 ?? 1)]">
    <div class="bg-pattern"></div>
    <div class="bg-glow"></div>
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

      <!-- 角色切换 -->
      <nav class="char-tabs">
        <div
          v-for="c in ['秦璐', '苏梦']"
          :key="c"
          :class="['tab-item', { active: activeCharacter === c }]"
          @click="selectCharacter(c)"
        >
          <span class="char-name">{{ c }}</span>
          <span class="char-role">{{ c === '秦璐' ? '母亲' : '姐姐' }}</span>
        </div>
      </nav>

      <!-- 念头植入 -->
      <section class="implant-control">
        <div class="control-header">
          <span class="decor-line"></span>
          <span class="title">✦ 念头植入 ✦</span>
          <span class="decor-line"></span>
        </div>
        <div class="input-group">
          <div class="target-hint">
            植入对象：<strong>{{ activeCharacter }}</strong>
          </div>
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
                <span class="name">💕 {{ activeCharacter === '秦璐' ? '儿子依存' : '弟弟依存' }}</span>
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
                <span class="name">💔 {{ activeCharacter === '秦璐' ? '丈夫依存' : '爸爸依存' }}</span>
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
            <div class="section-title"><span class="st-mark">✦</span> 心境</div>
            <div class="emotion-row">
              <span class="label">情绪</span>
              <span :class="['emotion-val', { 'vulnerable-glow': isVulnerable }]">{{ char?.当前情绪 ?? '平静' }}</span>
            </div>
            <div v-if="isVulnerable" class="vulnerable-hint"><span class="vh-icon">⚡</span><span>心防松动 · 可植入越级念头</span></div>
            <div class="thought-bubble" v-if="char?.当前心理想法">「 {{ char.当前心理想法 }} 」</div>
            <div class="temperament" v-if="char?.气质描述">— {{ char.气质描述 }}</div>
          </div>

          <!-- 念头列表 -->
          <div class="detail-card">
            <div class="section-title">
              <span class="st-mark">✦</span> 念头 <span class="count">({{ thoughtList.length }})</span>
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
              <span class="st-mark">✦</span> 习惯 <span class="count">({{ habitList.length }}/5)</span>
            </div>
            <div v-if="habitList.length === 0" class="empty">暂无习惯</div>
            <div v-for="(h, i) in habitList" :key="i" class="habit-item">
              <span class="habit-text">{{ h.内容 }}</span>
              <button v-if="habitList.length >= 5" class="sell-btn" @click="sellHabit(i)">出售+100</button>
            </div>
            <div v-if="habitList.length >= 5" class="habit-full-tip">⚠ 习惯已满，出售腾位后可接纳新习惯</div>
          </div>

          <!-- 仪容（外观，后续接道具系统） -->
          <div class="detail-card">
            <div class="section-title"><span class="st-mark">✦</span> 仪容</div>
            <div class="attire-tags">
              <span class="mini-tag">{{ char?.服装细节?.整体风格 ?? '居家贤妻' }}</span>
              <span class="mini-tag outline">{{ char?.服装细节?.暴露程度 ?? '正常' }}</span>
            </div>
            <div class="clothing-list">
              <span class="clothing-item"><span class="cl">上装</span>{{ char?.服装细节?.上装 ?? '米色针织开衫' }}</span>
              <span class="clothing-item"><span class="cl">下装</span>{{ char?.服装细节?.下装 ?? '深灰长裙' }}</span>
              <span class="clothing-item"><span class="cl">内衣</span>{{ char?.服装细节?.内衣?.上 ?? '肉色棉质文胸' }}</span>
              <span class="clothing-item"><span class="cl">内裤</span>{{ char?.服装细节?.内衣?.下 ?? '棉质内裤' }}</span>
              <span class="clothing-item"><span class="cl">袜</span>{{ char?.服装细节?.袜裤 ?? '肉色丝袜' }}</span>
            </div>
            <div class="makeup-line">💄 {{ char?.妆容细节?.浓淡程度 ?? '淡妆' }} · {{ char?.妆容细节?.整体风格 ?? '清新自然' }}</div>
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
import { getStageByCorruption, getStageTitle } from '../../stageConfig';

const MAX_LEN = 20;
const VULNERABLE_EMOTION = '心防松动';

const data = ref<SchemaType | null>(null);
const activeCharacter = ref<'秦璐' | '苏梦'>('秦璐');
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

const safeWorld = computed(
  () => data.value?.世界 ?? { 时间: '', 日期: '', 地点: '', 环境氛围: '日常' },
);

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

const suspicion = computed(() =>
  activeCharacter.value === '秦璐'
    ? suwen.value?.对秦璐疑心值 ?? 0
    : suwen.value?.对苏梦疑心值 ?? 0,
);

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

function showMsg(msg: string, type: 'success' | 'error' | 'warn') {
  implantMsg.value = msg;
  implantMsgType.value = type;
  setTimeout(() => (implantMsg.value = ''), 3000);
}

async function implantThought() {
  const content = thoughtContent.value.trim();
  if (!content) return;
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType | undefined;
    if (!d || !d[key]) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复后再植入', 'warn');
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
      植入楼层: getMessageId(),
    };
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    thoughtContent.value = '';
    showMsg(`已植入：${content}`, 'success');
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版] 植入失败', e);
    showMsg('植入失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

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

async function sellHabit(index: number) {
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as SchemaType;
    if (d[key].习惯列表.length < 5) {
      showMsg('习惯未满5，不可出售', 'warn');
      return;
    }
    d[key].习惯列表.splice(index, 1);
    d.系统.货币 += 100;

    // 腾位后补转入：把标记"已成熟"的待转念头按植入楼层补转入习惯
    const pending = Object.entries(d[key].念头列表)
      .filter(([, t]) => t.状态 === '已成熟')
      .sort((a, b) => a[1].植入楼层 - b[1].植入楼层);
    for (const [pid, pt] of pending) {
      if (d[key].习惯列表.length >= 5) break;
      const isHard = pt.难度 === '困难';
      d[key].习惯列表.push({ 内容: pt.内容, 形成楼层: getMessageId() });
      d[key].堕落度 += isHard ? 8 : 6;
      d[key].对主角依存度 += isHard ? 4 : 3;
      const dep = d[key].对主角依存度;
      let sd = -2;
      if (dep >= 80) sd = -5;
      else if (dep >= 60) sd = -4;
      else if (dep >= 30) sd = -3;
      if (isHard) sd = Math.floor(sd * 1.2);
      d[key].对苏文依存度 += sd;
      delete d[key].念头列表[pid];
      console.info(`[习惯腾位补转] ${key} ${pid} 补转入习惯`);
    }

    // 补转入后阶段校正（由堕落度派生）
    const ns = getStageByCorruption(d[key].堕落度);
    if (ns > d[key].当前阶段) {
      d[key].当前阶段 = ns;
      d[key].阶段标题 = getStageTitle(ns) as any;
      console.info(`[习惯腾位补转] ${key} 阶段提升 → ${ns}`);
    }

    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg('变卖习惯 +100货币', 'success');
    await refreshData();
  } catch (e) {
    console.error('[秦璐重置版] 变卖失败', e);
  }
}

refreshData();
eventOn(tavern_events.MESSAGE_RECEIVED, () => refreshData());
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => refreshData());
</script>

<style scoped lang="scss">
// ══════════════════════════════════════════════════════════
// 主题色彩系统：随阶段切换主题色（CSS 变量驱动）
// 阶段1 保守居家(暗金) → 阶段5 彻底沦陷(艳粉/品红光晕)
// ══════════════════════════════════════════════════════════
.th-stage-1 {
  --pri: #c9a84c; // 暗金
  --sec: #8a7026;
  --acc: #f0d060;
  --bg1: #100c08;
  --bg2: #1c1410;
  --glow: rgba(212, 175, 55, 0.25);
  --glow-soft: rgba(240, 208, 96, 0.12);
}
.th-stage-2 {
  --pri: #b888d8; // 动摇紫
  --sec: #7a5a9a;
  --acc: #d8a8f0;
  --bg1: #120a18;
  --bg2: #1d1228;
  --glow: rgba(184, 136, 216, 0.28);
  --glow-soft: rgba(216, 168, 240, 0.14);
}
.th-stage-3 {
  --pri: #e070a0; // 沉溺粉
  --sec: #a04070;
  --acc: #ff9ec4;
  --bg1: #180a14;
  --bg2: #261220;
  --glow: rgba(224, 112, 160, 0.32);
  --glow-soft: rgba(255, 158, 196, 0.16);
}
.th-stage-4 {
  --pri: #e0409a; // 疯狂品红
  --sec: #a02060;
  --acc: #ff60c0;
  --bg1: #1a0614;
  --bg2: #2a0a22;
  --glow: rgba(224, 64, 154, 0.4);
  --glow-soft: rgba(255, 96, 192, 0.2);
}
.th-stage-5 {
  --pri: #c060e8; // 圆满紫蓝艳丽
  --sec: #8040a8;
  --acc: #ff80f0;
  --bg1: #100818;
  --bg2: #1c0a2c;
  --glow: rgba(192, 96, 232, 0.42);
  --glow-soft: rgba(255, 128, 240, 0.22);
}

$c-red: #c54b4b;
$c-green: #4caf50;
$c-cyan: #4fc3f7;
$c-orange: #ff9800;

// ══════════════════════════════════════════════════════════
// 容器 + 背景氛围
// ══════════════════════════════════════════════════════════
.mystic-container {
  width: 100%;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  color: #e8e0d4;
  font-family: 'Noto Serif SC', 'STSong', 'SimSun', serif;
  font-size: 14px;
  line-height: 1.55;
  background: linear-gradient(165deg, var(--bg1) 0%, var(--bg2) 60%, var(--bg1) 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 12% -8%, var(--glow), transparent 55%),
      radial-gradient(ellipse at 88% 108%, var(--glow-soft), transparent 55%),
      radial-gradient(circle at 50% 50%, var(--glow-soft), transparent 70%);
    pointer-events: none;
    z-index: 0;
    transition: background 0.6s ease;
  }
}

// 羊皮纸/网格纹理：双向叠加极淡白线
.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255, 255, 255, 0.018) 28px, rgba(255, 255, 255, 0.018) 29px),
    repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255, 255, 255, 0.013) 28px, rgba(255, 255, 255, 0.013) 29px);
  pointer-events: none;
  z-index: 0;
}

// 第二层氛围光晕(径向斑点)
.bg-glow {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 30%, var(--glow-soft), transparent 25%),
    radial-gradient(circle at 75% 65%, var(--glow-soft), transparent 28%);
  pointer-events: none;
  z-index: 0;
  animation: glow-drift 12s ease-in-out infinite alternate;
}

@keyframes glow-drift {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0.7;
  }
  100% {
    transform: translate(8px, -6px) scale(1.06);
    opacity: 1;
  }
}

.main-panel {
  position: relative;
  z-index: 1;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--pri) 22%, transparent);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.55) 100%);
  backdrop-filter: blur(6px);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px color-mix(in srgb, var(--pri) 6%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition:
    border-color 0.6s,
    box-shadow 0.6s;
}

// ══════════════════════════════════════════════════════════
// 装饰横线（带 ✦ 符号）
// ══════════════════════════════════════════════════════════
.panel-decor {
  height: 2px;
  background: linear-gradient(90deg, transparent 2%, var(--sec) 20%, var(--acc) 50%, var(--sec) 80%, transparent 98%);
  margin: 10px 0;
  position: relative;
  opacity: 0.85;

  &.top::before,
  &.top::after,
  &.bottom::before,
  &.bottom::after {
    content: '✦';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    color: var(--acc);
    background: var(--bg1);
    padding: 0 5px;
    z-index: 2;
  }
  &.top::before,
  &.bottom::before {
    left: 10px;
  }
  &.top::after,
  &.bottom::after {
    right: 10px;
  }

  &.bottom {
    background: linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--pri) 35%, transparent) 30%, color-mix(in srgb, var(--acc) 22%, transparent) 50%, color-mix(in srgb, var(--pri) 35%, transparent) 70%, transparent 95%);
    height: 1px;
  }
}

// ══════════════════════════════════════════════════════════
// 头部
// ══════════════════════════════════════════════════════════
.header {
  text-align: center;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px dashed color-mix(in srgb, var(--pri) 18%, transparent);
}
.world-info {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: color-mix(in srgb, var(--pri) 70%, #fff 10%);
  letter-spacing: 0.5px;
}
.info-item i {
  margin-right: 4px;
  font-style: normal;
  opacity: 0.85;
}
.divider {
  color: var(--acc);
  opacity: 0.4;
  font-size: 0.7em;
}
.environment {
  margin-top: 6px;
  font-size: 13px;
  letter-spacing: 1.5px;
  color: var(--acc);
  text-shadow: 0 0 10px var(--glow);
  animation: env-breathe 4s ease-in-out infinite;
}

@keyframes env-breathe {
  0%,
  100% {
    opacity: 0.85;
    text-shadow: 0 0 8px var(--glow);
  }
  50% {
    opacity: 1;
    text-shadow: 0 0 16px var(--glow);
  }
}

// ══════════════════════════════════════════════════════════
// 角色切换 Tabs
// ══════════════════════════════════════════════════════════
.char-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--acc), transparent);
    opacity: 0;
    transition: opacity 0.25s;
  }

  &:hover {
    border-color: color-mix(in srgb, var(--pri) 45%, transparent);
    transform: translateY(-2px);
  }

  &.active {
    border-color: color-mix(in srgb, var(--pri) 70%, transparent);
    background: linear-gradient(135deg, color-mix(in srgb, var(--pri) 16%, transparent) 0%, color-mix(in srgb, var(--acc) 6%, transparent) 100%);
    box-shadow:
      0 0 18px color-mix(in srgb, var(--pri) 25%, transparent),
      inset 0 0 14px color-mix(in srgb, var(--acc) 6%, transparent);

    &::before {
      opacity: 1;
    }
  }
}
.char-name {
  display: block;
  color: var(--acc);
  font-size: 17px;
  font-weight: 700;
  text-shadow: 0 0 10px var(--glow-soft);
  letter-spacing: 1px;
}
.char-role {
  display: block;
  font-size: 11px;
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
  margin-top: 3px;
  letter-spacing: 1.5px;
}

// ══════════════════════════════════════════════════════════
// 念头植入
// ══════════════════════════════════════════════════════════
.implant-control {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid color-mix(in srgb, var(--pri) 16%, transparent);
  border-radius: 8px;
  position: relative;
}
.control-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.decor-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--sec), transparent);
}
.control-header .title {
  color: var(--acc);
  font-size: 14px;
  letter-spacing: 3px;
  font-weight: 700;
  text-shadow: 0 0 10px var(--glow-soft);
  white-space: nowrap;
}
.target-hint {
  font-size: 12px;
  color: color-mix(in srgb, var(--pri) 60%, #fff 5%);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}
.target-hint strong {
  color: var(--acc);
  font-weight: 700;
  text-shadow: 0 0 6px var(--glow-soft);
}
.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}
.input-wrapper input {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid color-mix(in srgb, var(--pri) 22%, transparent);
  border-radius: 6px;
  padding: 8px 12px;
  color: #e8e0d4;
  font-size: 13px;
  font-family: inherit;
  letter-spacing: 0.5px;
  transition: all 0.2s;

  &:focus {
    border-color: var(--acc);
    outline: none;
    box-shadow: 0 0 10px var(--glow-soft);
  }
  &::placeholder {
    color: color-mix(in srgb, var(--pri) 40%, transparent);
  }
}
.char-count {
  font-size: 10px;
  color: #555;
  white-space: nowrap;
}
.char-count.at-limit {
  color: $c-red;
  font-weight: 700;
}
.submit-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, var(--sec), var(--pri));
  border: none;
  border-radius: 6px;
  color: #1a0a08;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 2px;
  transition: all 0.2s;
  box-shadow: 0 0 12px color-mix(in srgb, var(--pri) 30%, transparent);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--pri), var(--acc));
    box-shadow: 0 0 18px var(--glow);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
.implant-msg {
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 5px;
  letter-spacing: 0.5px;
}
.implant-msg.success {
  color: $c-green;
  background: rgba(76, 175, 80, 0.12);
  border-left: 2px solid $c-green;
}
.implant-msg.error {
  color: $c-red;
  background: rgba(196, 75, 75, 0.12);
  border-left: 2px solid $c-red;
}
.implant-msg.warn {
  color: $c-orange;
  background: rgba(255, 152, 0, 0.12);
  border-left: 2px solid $c-orange;
}

// ══════════════════════════════════════════════════════════
// 状态展示两栏布局
// ══════════════════════════════════════════════════════════
.status-display {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 16px;
}
.col-left,
.col-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

// ══════════════════════════════════════════════════════════
// 阶段圆环
// ══════════════════════════════════════════════════════════
.stage-card {
  text-align: center;
  padding: 8px 0 4px;
}
.stage-ring {
  position: relative;
  width: 110px;
  height: 110px;
  margin: 0 auto;
}
.circular-chart {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 8px var(--glow));
}
.circle-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 2.4;
}
.circle {
  fill: none;
  stroke: var(--acc);
  stroke-width: 2.8;
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px var(--acc));
  transition: stroke-dasharray 0.6s ease;
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
  color: color-mix(in srgb, var(--pri) 60%, #fff 5%);
  letter-spacing: 2px;
}
.stage-text .value {
  font-size: 17px;
  color: var(--acc);
  font-weight: 700;
  margin-top: 3px;
  text-shadow: 0 0 12px var(--glow);
  letter-spacing: 2px;
}

// ══════════════════════════════════════════════════════════
// 通用卡片基类
// ══════════════════════════════════════════════════════════
%card-base {
  position: relative;
  background: linear-gradient(160deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 100%);
  border: 1px solid color-mix(in srgb, var(--pri) 16%, transparent);
  border-radius: 9px;
  padding: 12px 14px;
  backdrop-filter: blur(3px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--acc) 50%, transparent), transparent);
    pointer-events: none;
  }
}

// ══════════════════════════════════════════════════════════
// 三维数值
// ══════════════════════════════════════════════════════════
.stats-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-item {
  @extend %card-base;
  padding: 10px 12px;
}
.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.stat-header .name {
  color: color-mix(in srgb, var(--pri) 65%, #fff 5%);
}
.stat-header .num {
  color: var(--acc);
  font-weight: 800;
  font-size: 15px;
  text-shadow: 0 0 8px var(--glow-soft);
}
.progress-track {
  position: relative;
  height: 7px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}
.progress-bar {
  position: relative;
  height: 100%;
  border-radius: 4px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 45%, transparent 60%);
    border-radius: 4px;
  }
}
.stat-corruption {
  background: linear-gradient(90deg, $c-orange, $c-red);
  box-shadow: 0 0 8px rgba(196, 75, 75, 0.4);
}
.stat-desire {
  background: linear-gradient(90deg, color-mix(in srgb, var(--sec) 80%, #ff5d8f), var(--acc));
  box-shadow: 0 0 8px var(--glow-soft);
}
.stat-husband {
  background: linear-gradient(90deg, #555, #999);
}

// ══════════════════════════════════════════════════════════
// 苏文状态卡
// ══════════════════════════════════════════════════════════
.suwen-card {
  @extend %card-base;
}
.suwen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.suwen-header .name {
  color: var(--acc);
  font-size: 15px;
  font-weight: 700;
  text-shadow: 0 0 8px var(--glow-soft);
  letter-spacing: 1px;
}
.status-tag {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  letter-spacing: 0.5px;
  font-weight: 600;
}
.status-tag.home {
  background: rgba(196, 75, 75, 0.22);
  color: #e07070;
  border-color: rgba(196, 75, 75, 0.35);
}
.status-tag.away {
  background: rgba(76, 175, 80, 0.22);
  color: #80d080;
  border-color: rgba(76, 175, 80, 0.35);
}
.status-tag.sleeping {
  background: rgba(79, 195, 247, 0.22);
  color: $c-cyan;
  border-color: rgba(79, 195, 247, 0.35);
}
.suwen-location {
  font-size: 12px;
  color: color-mix(in srgb, var(--pri) 60%, #fff 5%);
  margin-bottom: 9px;
}
.suspicion-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.suspicion-row .label {
  color: color-mix(in srgb, var(--pri) 60%, #fff 5%);
  letter-spacing: 1px;
}
.suspicion-track {
  flex: 1;
  position: relative;
  height: 6px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  overflow: hidden;
}
.suspicion-fill {
  height: 100%;
  background: linear-gradient(90deg, $c-orange, #ffb040);
  border-radius: 3px;
  transition: width 0.4s;
}
.suspicion-fill.danger {
  background: linear-gradient(90deg, $c-red, #ff6060);
  box-shadow: 0 0 8px rgba(196, 75, 75, 0.6);
  animation: sus-pulse 1.4s ease-in-out infinite;
}
@keyframes sus-pulse {
  0%,
  100% {
    box-shadow: 0 0 6px rgba(196, 75, 75, 0.5);
  }
  50% {
    box-shadow: 0 0 14px rgba(196, 75, 75, 0.85);
  }
}
.suspicion-row .val {
  color: var(--acc);
  font-weight: 800;
  min-width: 26px;
  text-align: right;
}
.accel-hint {
  font-size: 12px;
  color: $c-orange;
  margin-top: 9px;
  padding: 5px 9px;
  background: rgba(255, 152, 0, 0.1);
  border-left: 2px solid $c-orange;
  border-radius: 3px;
  text-shadow: 0 0 6px rgba(255, 152, 0, 0.25);
}
.safe-indicator {
  font-size: 12px;
  color: $c-green;
  margin-top: 9px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.safe-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(76, 175, 80, 0.25);
  border: 1px solid $c-green;
  font-size: 10px;
  font-weight: 700;
}

// ══════════════════════════════════════════════════════════
// 货币
// ══════════════════════════════════════════════════════════
.currency-card {
  @extend %card-base;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}
.currency-card .label {
  color: color-mix(in srgb, var(--pri) 65%, #fff 5%);
  font-size: 13px;
  letter-spacing: 1px;
}
.currency-card .val {
  color: var(--acc);
  font-size: 20px;
  font-weight: 800;
  text-shadow: 0 0 12px var(--glow);
  font-family: 'Noto Serif SC', serif;
}

// ══════════════════════════════════════════════════════════
// 右栏详情卡
// ══════════════════════════════════════════════════════════
.detail-card {
  @extend %card-base;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--acc);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--pri) 18%, transparent);
  letter-spacing: 1px;
  text-shadow: 0 0 8px var(--glow-soft);
}
.st-mark {
  color: var(--pri);
  font-size: 11px;
  opacity: 0.85;
}
.section-title .count {
  margin-left: auto;
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
  font-weight: 400;
  font-size: 11px;
  letter-spacing: 0.5px;
}

// ══════════════════════════════════════════════════════════
// 心境
// ══════════════════════════════════════════════════════════
.emotion-row {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 7px;
  letter-spacing: 0.5px;
}
.emotion-row .label {
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
}
.emotion-val {
  color: var(--acc);
  font-weight: 600;
  text-shadow: 0 0 6px var(--glow-soft);
}
.emotion-val.vulnerable-glow {
  color: #ff5d8f;
  font-weight: 800;
  animation: vuln-pulse 1.4s ease-in-out infinite;
  font-size: 15px;
  letter-spacing: 1px;
}
@keyframes vuln-pulse {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(255, 93, 143, 0.6), 0 0 16px rgba(255, 93, 143, 0.3);
  }
  50% {
    text-shadow: 0 0 14px rgba(255, 93, 143, 0.95), 0 0 28px rgba(255, 93, 143, 0.5);
  }
}
// 心防松动整体卡片脉冲发光特效
.detail-card:has(.vulnerable-hint) {
  animation: card-vuln-pulse 1.6s ease-in-out infinite;
  border-color: rgba(255, 93, 143, 0.45);
}
@keyframes card-vuln-pulse {
  0%,
  100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 0 8px rgba(255, 93, 143, 0.18);
  }
  50% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 0 18px rgba(255, 93, 143, 0.45),
      0 0 36px rgba(255, 93, 143, 0.15);
  }
}
.vulnerable-hint {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 6px 10px;
  background: linear-gradient(90deg, rgba(255, 93, 143, 0.14), rgba(255, 93, 143, 0.06));
  border: 1px solid rgba(255, 93, 143, 0.4);
  border-radius: 6px;
  font-size: 11px;
  color: #ff7fa8;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.vh-icon {
  animation: vh-shake 0.6s ease-in-out infinite alternate;
}
@keyframes vh-shake {
  0% {
    transform: rotate(-8deg);
  }
  100% {
    transform: rotate(8deg);
  }
}
.thought-bubble {
  font-size: 12px;
  color: #c8c0b4;
  font-style: italic;
  margin-bottom: 5px;
  padding: 5px 9px;
  background: rgba(0, 0, 0, 0.22);
  border-left: 2px solid color-mix(in srgb, var(--pri) 40%, transparent);
  border-radius: 0 4px 4px 0;
  letter-spacing: 0.3px;
}
.temperament {
  font-size: 11px;
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
  font-style: italic;
  letter-spacing: 0.5px;
}

// ══════════════════════════════════════════════════════════
// 念头列表
// ══════════════════════════════════════════════════════════
.empty {
  font-size: 12px;
  color: color-mix(in srgb, var(--pri) 40%, transparent);
  text-align: center;
  padding: 10px 0;
  letter-spacing: 1px;
  font-style: italic;
}
.thought-item {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 7px;
  padding: 9px 11px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
  transition: all 0.25s;

  &:last-child {
    margin-bottom: 0;
  }
  &:hover {
    background: rgba(0, 0, 0, 0.4);
    border-left-color: var(--pri);
    transform: translateX(2px);
  }
}
.thought-head {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-bottom: 5px;
  flex-wrap: wrap;
}
.status-tag.growing {
  background: rgba(76, 175, 80, 0.22);
  color: #80d080;
  border-color: rgba(76, 175, 80, 0.35);
}
.status-tag.pending {
  background: rgba(79, 195, 247, 0.22);
  color: $c-cyan;
  border-color: rgba(79, 195, 247, 0.35);
}
.status-tag.rejected {
  background: rgba(196, 75, 75, 0.22);
  color: #e07070;
  border-color: rgba(196, 75, 75, 0.35);
}
.status-tag.mature {
  background: color-mix(in srgb, var(--pri) 22%, transparent);
  color: var(--acc);
  border-color: color-mix(in srgb, var(--pri) 50%, transparent);
  text-shadow: 0 0 6px var(--glow-soft);
}
.thought-type {
  font-size: 11px;
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
  letter-spacing: 0.5px;
}
.thought-diff {
  font-size: 10px;
  color: $c-orange;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 152, 0, 0.12);
  border: 1px solid rgba(255, 152, 0, 0.25);
  font-weight: 600;
}
.thought-content {
  font-size: 13px;
  color: #ddd5c8;
  margin-bottom: 6px;
  line-height: 1.5;
  letter-spacing: 0.3px;
}
.thought-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.thought-progress .progress-track {
  flex: 1;
}
.thought-progress .progress-bar {
  background: linear-gradient(90deg, var(--sec), var(--acc));
  box-shadow: 0 0 6px var(--glow-soft);
}
.progress-text {
  font-size: 10px;
  color: color-mix(in srgb, var(--pri) 55%, #fff 5%);
  white-space: nowrap;
  letter-spacing: 0.5px;
}
.thought-reject {
  font-size: 11px;
  color: #e07070;
  display: flex;
  justify-content: space-between;
  align-items: center;
  letter-spacing: 0.3px;
}
.mini-btn {
  font-size: 10px;
  padding: 3px 11px;
  background: transparent;
  border: 1px solid $c-red;
  border-radius: 4px;
  color: #e07070;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;

  &:hover {
    background: rgba(196, 75, 75, 0.22);
    box-shadow: 0 0 8px rgba(196, 75, 75, 0.3);
  }
}

// ══════════════════════════════════════════════════════════
// 习惯
// ══════════════════════════════════════════════════════════
.habit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 6px;
  padding: 7px 11px;
  margin-bottom: 6px;
  font-size: 13px;
  border-left: 2px solid color-mix(in srgb, var(--pri) 30%, transparent);
  transition: all 0.2s;

  &:last-child {
    margin-bottom: 0;
  }
  &:hover {
    background: rgba(0, 0, 0, 0.4);
    border-left-color: var(--acc);
  }
}
.habit-text {
  color: #80d080;
  letter-spacing: 0.3px;
}
.sell-btn {
  font-size: 10px;
  padding: 4px 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--pri) 25%, transparent), color-mix(in srgb, var(--acc) 12%, transparent));
  border: 1px solid var(--acc);
  border-radius: 5px;
  color: var(--acc);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow: 0 0 6px var(--glow-soft);
  box-shadow: 0 0 8px color-mix(in srgb, var(--pri) 18%, transparent);

  &:hover {
    background: linear-gradient(135deg, var(--pri), var(--acc));
    color: #1a0a08;
    box-shadow: 0 0 16px var(--glow);
    transform: translateY(-1px);
  }
}
.habit-full-tip {
  font-size: 11px;
  color: $c-orange;
  margin-top: 8px;
  padding: 5px 9px;
  background: rgba(255, 152, 0, 0.1);
  border-radius: 4px;
  border-left: 2px solid $c-orange;
  letter-spacing: 0.3px;
}

// ══════════════════════════════════════════════════════════
// 仪容
// ══════════════════════════════════════════════════════════
.attire-tags {
  display: flex;
  gap: 7px;
  margin-bottom: 9px;
  flex-wrap: wrap;
}
.mini-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--pri) 14%, transparent);
  color: var(--acc);
  border: 1px solid color-mix(in srgb, var(--pri) 30%, transparent);
  letter-spacing: 0.5px;
  text-shadow: 0 0 5px var(--glow-soft);
}
.mini-tag.outline {
  background: transparent;
  border: 1px solid var(--pri);
}
.clothing-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 7px;
}
.clothing-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #c8c0b4;
  padding: 2px 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--pri) 10%, transparent);
  letter-spacing: 0.3px;
}
.clothing-item .cl {
  display: inline-block;
  min-width: 32px;
  color: color-mix(in srgb, var(--pri) 60%, #fff 5%);
  font-size: 11px;
  letter-spacing: 1px;
}
.clothing-item:last-child {
  border-bottom: none;
}
.makeup-line {
  font-size: 12px;
  color: color-mix(in srgb, var(--pri) 65%, #fff 5%);
  padding-top: 6px;
  margin-top: 2px;
  border-top: 1px solid color-mix(in srgb, var(--pri) 14%, transparent);
  letter-spacing: 0.5px;
}

// ══════════════════════════════════════════════════════════
// 移动端响应式
// ══════════════════════════════════════════════════════════
@media (max-width: 600px) {
  .main-panel {
    padding: 12px;
  }
  .status-display {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .world-info {
    gap: 6px;
    font-size: 11px;
  }
  .char-tabs {
    gap: 8px;
  }
  .char-name {
    font-size: 15px;
  }
  .stage-ring {
    width: 92px;
    height: 92px;
  }
}

@media (max-width: 380px) {
  .control-header .title {
    font-size: 12px;
    letter-spacing: 2px;
  }
  .currency-card .val {
    font-size: 18px;
  }
}
</style>
