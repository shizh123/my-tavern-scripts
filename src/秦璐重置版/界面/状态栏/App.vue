<template>
  <div :class="['ql-root', 'th-stage-' + (char?.当前阶段 ?? 1)]">
    <div class="panel">
      <!-- 顶栏：世界信息 + 货币 -->
      <header class="topbar">
        <div class="world">
          <span>{{ safeWorld.日期 || '——' }}</span>
          <i class="sep"></i>
          <span>{{ safeWorld.时间 || '——' }}</span>
          <i class="sep"></i>
          <span>{{ safeWorld.地点 || '——' }}</span>
        </div>
        <div class="coin" title="货币">◈ {{ data?.系统?.货币 ?? 0 }}</div>
      </header>

      <!-- 角色切换（含在场标记） -->
      <nav class="tabs">
        <button
          v-for="c in charNames"
          :key="c"
          type="button"
          :class="['tab', { active: activeCharacter === c }]"
          @click="selectCharacter(c)"
        >
          <span :class="['presence', { on: presence[c] }]"></span>
          <span class="nm">{{ c }}</span>
          <span class="rl">{{ c === '秦璐' ? '母亲' : '姐姐' }}</span>
        </button>
      </nav>

      <!-- 阶段 · 情绪 · 三维 -->
      <section class="hero">
        <div class="hero-top">
          <div class="stage">
            <span class="stage-no">{{ char?.当前阶段 ?? 1 }}</span>
            <div class="stage-meta">
              <b class="stage-title">{{ char?.阶段标题 ?? '抵抗' }}</b>
              <small>第{{ char?.当前阶段 ?? 1 }}阶段 · {{ presence[activeCharacter] ? '在场' : '不在场' }}</small>
            </div>
          </div>
          <span :class="['emotion', { vuln: isVulnerable }]">{{ char?.当前情绪 ?? '平静' }}</span>
        </div>

        <div class="bars">
          <div class="bar">
            <span class="bl">堕落</span>
            <div class="track"><i class="fill f-corrupt" :style="{ width: (char?.堕落度 ?? 0) + '%' }"></i></div>
            <span class="bv">{{ char?.堕落度 ?? 0 }}</span>
          </div>
          <div class="bar">
            <span class="bl">{{ activeCharacter === '秦璐' ? '儿子' : '弟弟' }}</span>
            <div class="track">
              <i class="fill f-user" :style="{ width: Math.max(0, char?.对主角依存度 ?? 0) + '%' }"></i>
            </div>
            <span class="bv">{{ char?.对主角依存度 ?? 0 }}</span>
          </div>
          <div class="bar">
            <span class="bl">{{ activeCharacter === '秦璐' ? '丈夫' : '爸爸' }}</span>
            <div class="track">
              <i class="fill f-suwen" :style="{ width: Math.max(0, char?.对苏文依存度 ?? 0) + '%' }"></i>
            </div>
            <span class="bv">{{ char?.对苏文依存度 ?? 0 }}</span>
          </div>
        </div>

        <div v-if="isVulnerable" class="vuln-banner"><i>⚡</i> 心防松动 · 此刻可植入越级念头</div>

        <blockquote v-if="char?.当前心理想法" class="inner-voice">{{ char.当前心理想法 }}</blockquote>
        <div v-if="char?.气质描述" class="aura">— {{ char.气质描述 }}</div>
      </section>

      <!-- 念头植入 -->
      <section class="implant">
        <div class="implant-head">
          <span class="ttl">念头植入</span>
          <span class="target">→ {{ activeCharacter }}</span>
          <span class="quota" :title="`本轮已植入 ${quotaUsed}/${quotaLimit}`">
            <i v-for="n in quotaLimit" :key="n" :class="{ used: n <= quotaUsed }"></i>
          </span>
        </div>
        <div class="implant-row">
          <input
            v-model="thoughtContent"
            type="text"
            :maxlength="maxLen"
            :placeholder="`简短念头（${maxLen}字内）…`"
            @keyup.enter="implantThought"
          />
          <span :class="['count', { max: thoughtContent.length >= maxLen }]"
            >{{ thoughtContent.length }}/{{ maxLen }}</span
          >
          <button class="go" :disabled="!thoughtContent.trim()" @click="implantThought">植入</button>
        </div>
        <p v-if="implantMsg" :class="['msg', implantMsgType]">{{ implantMsg }}</p>
      </section>

      <!-- 列表区 -->
      <main class="grid">
        <!-- 念头 -->
        <section class="card">
          <h3>念头 <em>{{ thoughtList.length }}</em></h3>
          <p v-if="thoughtList.length === 0" class="empty">尚无念头，去种下第一颗种子</p>
          <div v-for="t in thoughtList" :key="t.id" class="thought">
            <div class="t-head">
              <span :class="['state', thoughtStatusClass(t.状态)]">{{ t.状态 }}</span>
              <span class="t-type">{{ t.类型 }}</span>
              <span v-if="t.难度 && t.难度 !== '待定'" class="t-diff">{{ t.难度 }}</span>
            </div>
            <div class="t-body">{{ t.内容 }}</div>
            <div v-if="t.状态 === '培育中'" class="t-prog">
              <div class="track"><i class="fill f-grow" :style="{ width: thoughtProgressPercent(t) + '%' }"></i></div>
              <span class="pv">{{ Math.floor(t.开发进度) }}/{{ t.需要楼数 }}</span>
            </div>
            <div v-if="t.状态 === '未达标'" class="t-reject">
              <span>她还接受不了，需先推进关系</span>
              <button class="ghost" @click="discardThought(t.id)">退回</button>
            </div>
          </div>
        </section>

        <div class="col">
          <!-- 习惯 -->
          <section class="card">
            <h3>习惯 <em>{{ habitList.length }}/5</em></h3>
            <p v-if="habitList.length === 0" class="empty">暂无习惯</p>
            <div v-for="(h, i) in habitList" :key="i" class="habit">
              <span class="h-text">{{ h.内容 }}</span>
              <button v-if="habitList.length >= 5" class="ghost gold" @click="sellHabit(i)">出售 +100</button>
            </div>
            <p v-if="habitList.length >= 5" class="note warn">习惯已满，出售腾位后可接纳新习惯</p>
          </section>

          <!-- 苏文 -->
          <section class="card">
            <h3>
              苏文 <span :class="['chip', suwenStatusClass]">{{ suwenStatusDisplay }}</span>
            </h3>
            <div class="s-loc">📍 {{ suwenPos }}</div>
            <div class="bar">
              <span class="bl">疑心</span>
              <div class="track">
                <i :class="['fill', suspicion > 70 ? 'f-danger' : 'f-warn']" :style="{ width: suspicion + '%' }"></i>
              </div>
              <span class="bv">{{ suspicion }}</span>
            </div>
            <p v-if="isAccelerating" class="note warn">⚡ 苏文在附近 · 念头加速中</p>
            <p v-else-if="suwenSafeReason" class="note safe">✓ {{ suwenSafeReason }}</p>
          </section>

          <!-- 仪容 -->
          <section class="card">
            <h3>仪容</h3>
            <div class="tags">
              <span class="tag">{{ char?.服装细节?.整体风格 ?? '居家贤妻' }}</span>
              <span class="tag line">{{ char?.服装细节?.暴露程度 ?? '正常' }}</span>
              <span class="tag line">{{ char?.妆容细节?.浓淡程度 ?? '淡妆' }}</span>
            </div>
            <dl class="attire">
              <div><dt>上装</dt><dd>{{ char?.服装细节?.上装 ?? '—' }}</dd></div>
              <div><dt>下装</dt><dd>{{ char?.服装细节?.下装 ?? '—' }}</dd></div>
              <div><dt>内衣</dt><dd>{{ char?.服装细节?.内衣?.上 ?? '—' }}</dd></div>
              <div><dt>内裤</dt><dd>{{ char?.服装细节?.内衣?.下 ?? '—' }}</dd></div>
              <div><dt>袜</dt><dd>{{ char?.服装细节?.袜裤 ?? '—' }}</dd></div>
            </dl>
          </section>
        </div>
      </main>

      <!-- 网店 -->
      <section class="shop">
        <button type="button" class="shop-toggle" @click="shopOpen = !shopOpen">
          <span class="st-ttl">网 店</span>
          <span class="st-sub">为 {{ activeCharacter }} 选购 · 装备各买各的</span>
          <em>{{ shopOpen ? '收起 ▲' : '展开 ▼' }}</em>
        </button>
        <div v-if="shopOpen" class="shop-body">
          <div v-for="g in shopGroups" :key="g.title" class="shop-group">
            <h4>{{ g.title }}</h4>
            <div
              v-for="item in g.items"
              :key="item.名称"
              :class="['shop-item', { on: item.分类 === '装备' && equipStateOf(item) === '装备中' }]"
            >
              <div class="si-head">
                <span class="si-name">{{ item.名称 }}</span>
                <span v-if="item.槽位" class="si-tag">{{ item.槽位 }}</span>
                <span v-if="item.分类 === '装备' && item.阶段门槛 > 1" class="si-tag dim">阶{{ item.阶段门槛 }}</span>
                <span class="si-price">◈{{ item.价格 }}</span>
              </div>
              <div class="si-desc">{{ item.简介 }}</div>
              <button
                type="button"
                :class="['si-btn', itemUi(item).kind]"
                :disabled="itemUi(item).disabled"
                @click="shopAction(item)"
              >
                {{ itemUi(item).label }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getStageByCorruption, getStageTitle } from '../../stageConfig';
import {
  SHOP_ITEMS,
  buyEquipment,
  toggleEquip,
  useConsumable,
  buyPrivilege,
  getImplantLimit,
  getThoughtMaxLen,
  type ShopItem,
} from '../../脚本/游戏逻辑/shopSystem';
import { countImplantsAtFloor } from '../../脚本/游戏逻辑/thoughtEngine';
import { useDataStore } from './store';

const VULNERABLE_EMOTION = '心防松动';
const charNames = ['秦璐', '苏梦'] as const;

// 用 defineMvuDataStore：每个楼层 iframe 显示自己那一楼的变量（对标云霜凝）
// 修好"旧楼层显示新状态"的 bug
const store = useDataStore();
const data = computed(() => store.data);

const activeCharacter = ref<'秦璐' | '苏梦'>('秦璐');
const thoughtContent = ref('');
const implantMsg = ref('');
const implantMsgType = ref<'success' | 'error' | 'warn'>('error');

/** 当前 iframe 所在楼层（旧楼层的 iframe 会返回自己那楼的 id） */
function getMessageId(): number {
  return getCurrentMessageId();
}

function selectCharacter(c: '秦璐' | '苏梦') {
  activeCharacter.value = c;
}

const char = computed(() => {
  const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
  return data.value?.[key] ?? null;
});

const safeWorld = computed(() => data.value?.世界 ?? { 时间: '', 日期: '', 地点: '' });

/** 在场角色（AI 每轮维护；旧存档无此字段时按默认兜底） */
const presence = computed(
  () => data.value?.系统?.在场角色 ?? ({ 秦璐: true, 苏梦: false } as Record<'秦璐' | '苏梦', boolean>),
);

/** 本楼已用植入额度（两角色合计） */
const quotaUsed = computed(() => {
  const d = data.value;
  if (!d) return 0;
  return countImplantsAtFloor(d as any, SillyTavern.chat?.length ?? 0);
});

/** 植入上限/字数上限（受网店特权影响） */
const quotaLimit = computed(() => (data.value ? getImplantLimit(data.value as any) : 3));
const maxLen = computed(() => (data.value ? getThoughtMaxLen(data.value as any) : 10));

// ━━━━ 网店 ━━━━
const shopOpen = ref(false);

const shopGroups = computed(() => [
  { title: '装备（同槽互斥，装备中生效）', items: SHOP_ITEMS.filter(i => i.分类 === '装备') },
  { title: '消耗品（即买即用，作用于当前角色）', items: SHOP_ITEMS.filter(i => i.分类 === '消耗品') },
  { title: '特权（全局永久）', items: SHOP_ITEMS.filter(i => i.分类 === '特权') },
]);

function equipStateOf(item: ShopItem): '未购买' | '已购买' | '装备中' {
  const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
  return (data.value?.[key]?.装备状态?.[item.名称] as '已购买' | '装备中' | undefined) ?? '未购买';
}

function itemUi(item: ShopItem): { label: string; disabled: boolean; kind: 'buy' | 'equip' | 'unequip' | 'use' | 'none' } {
  const money = data.value?.系统?.货币 ?? 0;
  if (item.分类 === '特权') {
    if (item.未上架) return { label: '未上架', disabled: true, kind: 'none' };
    if (data.value?.系统?.道具状态?.[item.名称] === '已购买') return { label: '已生效', disabled: true, kind: 'none' };
    return { label: '购买', disabled: money < item.价格, kind: 'buy' };
  }
  if (item.分类 === '消耗品') {
    return { label: '使用', disabled: money < item.价格, kind: 'use' };
  }
  const st = equipStateOf(item);
  if (st === '未购买') return { label: '购买', disabled: money < item.价格, kind: 'buy' };
  if (st === '装备中') return { label: '卸下', disabled: false, kind: 'unequip' };
  if ((char.value?.当前阶段 ?? 1) < item.阶段门槛) return { label: `需阶段${item.阶段门槛}`, disabled: true, kind: 'none' };
  return { label: '装备', disabled: false, kind: 'equip' };
}

async function shopAction(item: ShopItem) {
  const ui = itemUi(item);
  if (ui.disabled || ui.kind === 'none') return;
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复', 'warn');
      return;
    }
    let err: string | null = null;
    let extra = '';
    if (item.分类 === '特权') {
      err = buyPrivilege(d, item.名称);
    } else if (item.分类 === '消耗品') {
      err = useConsumable(d, key, item.名称, SillyTavern.chat?.length ?? 0);
    } else if (ui.kind === 'buy') {
      err = buyEquipment(d, key, item.名称);
    } else {
      const r = toggleEquip(d, key, item.名称);
      err = r.error ?? null;
      if (r.firstWear) extra = '，她第一次穿上它——下一轮会有反应';
    }
    if (err) {
      showMsg(err, 'warn');
      return;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`「${item.名称}」操作成功${extra}`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 网店操作失败', e);
    showMsg('操作失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

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
  return Object.entries(thoughts).map(([id, t]) => ({ id, ...(t as any) }));
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
    // 植入总是写到"最新楼"（AI 未来会基于最新变量判定），不写到当前浏览的旧楼
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d || !d[key]) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复后再植入', 'warn');
      return;
    }
    // 每楼植入上限：秦璐+苏梦合计（基础3，植入扩容特权+1），AI 回复后额度刷新
    const floorNow = SillyTavern.chat?.length ?? 0;
    const limit = getImplantLimit(d);
    const implanted = countImplantsAtFloor(d, floorNow);
    if (implanted >= limit) {
      showMsg(`本轮已植入${limit}条念头，等她回应后再继续`, 'warn');
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
      植入楼层: floorNow,
    };
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    thoughtContent.value = '';
    showMsg(`已植入（本轮 ${implanted + 1}/${limit}）：${content}`, 'success');
    // store 会通过 500ms 轮询自动更新
  } catch (e) {
    console.error('[秦璐重置版] 植入失败', e);
    showMsg('植入失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

async function discardThought(id: string) {
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    delete d[key].念头列表[id];
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
  } catch (e) {
    console.error('[秦璐重置版] 退回失败', e);
  }
}

async function sellHabit(index: number) {
  try {
    const key = `${activeCharacter.value}状态` as '秦璐状态' | '苏梦状态';
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (d[key].习惯列表.length < 5) {
      showMsg('习惯未满5，不可出售', 'warn');
      return;
    }
    d[key].习惯列表.splice(index, 1);
    d.系统.货币 += 100;

    // 腾位后补转入：把标记"已成熟"的待转念头按植入楼层补转入习惯
    const pending = Object.entries(d[key].念头列表)
      .filter(([, t]: any) => t.状态 === '已成熟')
      .sort((a: any, b: any) => a[1].植入楼层 - b[1].植入楼层);
    for (const [pid, pt] of pending as any) {
      if (d[key].习惯列表.length >= 5) break;
      const isHard = pt.难度 === '困难';
      d[key].习惯列表.push({ 内容: pt.内容, 形成楼层: SillyTavern.chat?.length ?? 0 });
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
  } catch (e) {
    console.error('[秦璐重置版] 变卖失败', e);
  }
}
</script>

<style scoped lang="scss">
// ══════════════════════════════════════════════════════════
// 阶段主题：随堕落阶段推移，界面从暗金走向艳紫
// 只定义 5 个变量，其余全部派生——克制是层次的前提
// ══════════════════════════════════════════════════════════
.th-stage-1 {
  --acc: #d2b273; // 暗金 · 保守居家
  --acc2: #9a7f42;
  --bg: #131009;
  --panel: rgba(255, 252, 240, 0.035);
  --line: rgba(210, 178, 115, 0.16);
}
.th-stage-2 {
  --acc: #c39be0; // 动摇紫
  --acc2: #8f6ab0;
  --bg: #120d18;
  --panel: rgba(246, 240, 255, 0.04);
  --line: rgba(195, 155, 224, 0.16);
}
.th-stage-3 {
  --acc: #ea8fb4; // 沉溺粉
  --acc2: #b45f84;
  --bg: #170d13;
  --panel: rgba(255, 240, 248, 0.04);
  --line: rgba(234, 143, 180, 0.18);
}
.th-stage-4 {
  --acc: #f0559f; // 疯狂品红
  --acc2: #b32e73;
  --bg: #1a0a14;
  --panel: rgba(255, 235, 246, 0.05);
  --line: rgba(240, 85, 159, 0.2);
}
.th-stage-5 {
  --acc: #cf7bf5; // 圆满电紫
  --acc2: #9747c9;
  --bg: #140a1d;
  --panel: rgba(248, 238, 255, 0.05);
  --line: rgba(207, 123, 245, 0.2);
}

// 阶段无关的功能色
$vuln: #ff6b9d; // 心防松动 · 唯一允许高调发光的颜色
$safe: #79c48a;
$warn: #e8a94f;
$danger: #e06868;
$info: #6fb9dc;

$serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;

// ══════════════════════════════════════════════════════════
// 根容器
// ══════════════════════════════════════════════════════════
.ql-root {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  background:
    radial-gradient(130% 80% at 88% -12%, color-mix(in srgb, var(--acc) 9%, transparent), transparent 55%),
    radial-gradient(100% 60% at 0% 105%, color-mix(in srgb, var(--acc2) 7%, transparent), transparent 50%),
    var(--bg);
  color: #d9d2c7;
  font-family: -apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  transition: border-color 0.5s;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 16px;
}

// ══════════════════════════════════════════════════════════
// 顶栏
// ══════════════════════════════════════════════════════════
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.world {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: color-mix(in srgb, var(--acc) 55%, #999);
  letter-spacing: 0.4px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--acc) 45%, transparent);
  flex: none;
}
.coin {
  flex: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--acc);
  letter-spacing: 0.5px;
  padding: 2px 10px;
  border-radius: 20px;
  background: var(--panel);
  border: 1px solid var(--line);
}

// ══════════════════════════════════════════════════════════
// 角色切换
// ══════════════════════════════════════════════════════════
.tabs {
  display: flex;
  gap: 8px;
}
.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.25s, background 0.25s;

  &:hover {
    border-color: color-mix(in srgb, var(--acc) 40%, transparent);
  }
  &.active {
    border-color: color-mix(in srgb, var(--acc) 55%, transparent);
    background: linear-gradient(150deg, color-mix(in srgb, var(--acc) 13%, transparent), transparent 70%);

    .nm {
      color: var(--acc);
    }
  }
}
.presence {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  flex: none;
  transition: background 0.3s, box-shadow 0.3s;

  &.on {
    background: $safe;
    box-shadow: 0 0 6px rgba(121, 196, 138, 0.7);
  }
}
.nm {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #cfc6b8;
  transition: color 0.25s;
}
.rl {
  font-size: 10.5px;
  color: color-mix(in srgb, var(--acc) 42%, #888);
  letter-spacing: 1px;
}

// ══════════════════════════════════════════════════════════
// 阶段 · 情绪 · 三维
// ══════════════════════════════════════════════════════════
.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.stage {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.stage-no {
  flex: none;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--acc) 60%, transparent);
  color: var(--acc);
  font-size: 18px;
  font-weight: 800;
  font-family: $serif;
  background: radial-gradient(circle, color-mix(in srgb, var(--acc) 10%, transparent), transparent 70%);
}
.stage-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;

  .stage-title {
    font-family: $serif;
    font-size: 16px;
    font-weight: 700;
    color: var(--acc);
    letter-spacing: 3px;
    line-height: 1.3;
  }
  small {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 42%, #888);
    letter-spacing: 0.6px;
  }
}
.emotion {
  flex: none;
  font-size: 12px;
  color: #cfc6b8;
  padding: 3px 12px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.25);
  letter-spacing: 1px;

  &.vuln {
    color: $vuln;
    border-color: rgba(255, 107, 157, 0.5);
    font-weight: 700;
    animation: vuln-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes vuln-pulse {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(255, 107, 157, 0.25);
  }
  50% {
    box-shadow: 0 0 14px rgba(255, 107, 157, 0.6);
  }
}

// 三维数值：一行一条，紧凑
.bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
}
.bl {
  flex: none;
  width: 34px;
  color: color-mix(in srgb, var(--acc) 48%, #999);
  letter-spacing: 1px;
}
.track {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.f-corrupt {
  background: linear-gradient(90deg, var(--acc2), var(--acc));
}
.f-user {
  background: linear-gradient(90deg, #b3577e, #e58bab);
}
.f-suwen {
  background: linear-gradient(90deg, #4e5560, #8a93a1);
}
.f-grow {
  background: linear-gradient(90deg, var(--acc2), var(--acc));
}
.f-warn {
  background: linear-gradient(90deg, #c98f3d, $warn);
}
.f-danger {
  background: linear-gradient(90deg, #b34848, $danger);
}
.bv {
  flex: none;
  min-width: 24px;
  text-align: right;
  font-weight: 700;
  font-size: 12px;
  color: #cfc6b8;
  font-variant-numeric: tabular-nums;
}

// 心防松动横幅：全界面唯一的高调元素
.vuln-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 157, 0.45);
  background: linear-gradient(90deg, rgba(255, 107, 157, 0.14), rgba(255, 107, 157, 0.03));
  color: $vuln;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  animation: vuln-pulse 1.6s ease-in-out infinite;

  i {
    font-style: normal;
    animation: vuln-sway 0.7s ease-in-out infinite alternate;
  }
}
@keyframes vuln-sway {
  from {
    transform: rotate(-8deg);
  }
  to {
    transform: rotate(8deg);
  }
}

// 内心独白：衬线引文，"她的声音"
.inner-voice {
  margin: 0;
  padding: 8px 12px;
  border-left: 2px solid color-mix(in srgb, var(--acc) 50%, transparent);
  border-radius: 0 6px 6px 0;
  background: rgba(0, 0, 0, 0.22);
  font-family: $serif;
  font-size: 12.5px;
  font-style: italic;
  color: #c4bbae;
  letter-spacing: 0.3px;
}
.aura {
  font-size: 11px;
  font-style: italic;
  color: color-mix(in srgb, var(--acc) 45%, #888);
  text-align: right;
  letter-spacing: 0.5px;
}

// ══════════════════════════════════════════════════════════
// 念头植入
// ══════════════════════════════════════════════════════════
.implant {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--acc) 26%, transparent);
  border-radius: 10px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 6%, transparent), transparent 60%);
}
.implant-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ttl {
  font-family: $serif;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--acc);
  letter-spacing: 2px;
}
.target {
  font-size: 11.5px;
  color: color-mix(in srgb, var(--acc) 55%, #999);
  letter-spacing: 0.5px;
}
.quota {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    transition: background 0.3s;

    &.used {
      background: var(--acc);
      box-shadow: 0 0 5px color-mix(in srgb, var(--acc) 60%, transparent);
    }
  }
}
.implant-row {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    color: #e2dbcf;
    font-size: 13px;
    font-family: inherit;
    letter-spacing: 0.5px;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--acc) 65%, transparent);
    }
    &::placeholder {
      color: color-mix(in srgb, var(--acc) 30%, #666);
    }
  }
}
.count {
  flex: none;
  font-size: 10px;
  color: #666;
  font-variant-numeric: tabular-nums;

  &.max {
    color: $danger;
    font-weight: 700;
  }
}
.go {
  flex: none;
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--acc2), var(--acc));
  color: #16100a;
  font-size: 13px;
  font-weight: 800;
  font-family: inherit;
  letter-spacing: 3px;
  cursor: pointer;
  transition: filter 0.2s, transform 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
.msg {
  margin: 0;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11.5px;
  letter-spacing: 0.4px;

  &.success {
    color: $safe;
    background: rgba(121, 196, 138, 0.1);
    border-left: 2px solid $safe;
  }
  &.error {
    color: $danger;
    background: rgba(224, 104, 104, 0.1);
    border-left: 2px solid $danger;
  }
  &.warn {
    color: $warn;
    background: rgba(232, 169, 79, 0.1);
    border-left: 2px solid $warn;
  }
}

// ══════════════════════════════════════════════════════════
// 列表区布局：移动端单列，≥640px 双列
// ══════════════════════════════════════════════════════════
.grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
@media (min-width: 640px) {
  .grid {
    display: grid;
    grid-template-columns: 1.08fr 0.92fr;
    align-items: start;
  }
}

// ══════════════════════════════════════════════════════════
// 卡片
// ══════════════════════════════════════════════════════════
.card {
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);

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

    em {
      margin-left: auto;
      font-style: normal;
      font-size: 11px;
      font-weight: 400;
      color: color-mix(in srgb, var(--acc) 45%, #888);
      font-variant-numeric: tabular-nums;
    }
  }
}
.empty {
  margin: 0;
  padding: 8px 0;
  text-align: center;
  font-size: 11.5px;
  font-style: italic;
  color: color-mix(in srgb, var(--acc) 32%, #666);
  letter-spacing: 1px;
}
.note {
  margin: 8px 0 0;
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 11px;
  letter-spacing: 0.3px;

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

// ══════════════════════════════════════════════════════════
// 念头条目
// ══════════════════════════════════════════════════════════
.thought {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.24);
  border-left: 2px solid transparent;
  transition: border-color 0.25s, background 0.25s;

  & + .thought {
    margin-top: 7px;
  }
  &:hover {
    background: rgba(0, 0, 0, 0.36);
    border-left-color: var(--acc);
  }
}
.t-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.state {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
  letter-spacing: 0.5px;

  &.growing {
    color: $safe;
    background: rgba(121, 196, 138, 0.14);
  }
  &.pending {
    color: $info;
    background: rgba(111, 185, 220, 0.14);
  }
  &.rejected {
    color: $danger;
    background: rgba(224, 104, 104, 0.14);
  }
  &.mature {
    color: var(--acc);
    background: color-mix(in srgb, var(--acc) 16%, transparent);
  }
}
.t-type {
  font-size: 10.5px;
  color: color-mix(in srgb, var(--acc) 48%, #999);
  letter-spacing: 0.5px;
}
.t-diff {
  font-size: 10px;
  color: $warn;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid rgba(232, 169, 79, 0.35);
}
.t-body {
  font-family: $serif;
  font-size: 13px;
  color: #ddd5c8;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}
.t-prog {
  display: flex;
  align-items: center;
  gap: 8px;

  .track {
    flex: 1;
  }
  .pv {
    flex: none;
    font-size: 10px;
    color: color-mix(in srgb, var(--acc) 50%, #999);
    font-variant-numeric: tabular-nums;
  }
}
.t-reject {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: $danger;
}

// 通用幽灵按钮
.ghost {
  flex: none;
  padding: 3px 11px;
  border: 1px solid $danger;
  border-radius: 6px;
  background: transparent;
  color: $danger;
  font-size: 10.5px;
  font-family: inherit;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(224, 104, 104, 0.15);
  }
  &.gold {
    border-color: color-mix(in srgb, var(--acc) 60%, transparent);
    color: var(--acc);

    &:hover {
      background: color-mix(in srgb, var(--acc) 14%, transparent);
    }
  }
}

// ══════════════════════════════════════════════════════════
// 习惯
// ══════════════════════════════════════════════════════════
.habit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.24);
  border-left: 2px solid color-mix(in srgb, var(--acc) 35%, transparent);

  & + .habit {
    margin-top: 6px;
  }
}
.h-text {
  font-family: $serif;
  font-size: 12.5px;
  color: #cfe3d0;
  letter-spacing: 0.3px;
}

// ══════════════════════════════════════════════════════════
// 苏文
// ══════════════════════════════════════════════════════════
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
  color: color-mix(in srgb, var(--acc) 55%, #999);
  margin-bottom: 8px;
  letter-spacing: 0.4px;
}

// ══════════════════════════════════════════════════════════
// 仪容
// ══════════════════════════════════════════════════════════
.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tag {
  font-size: 10.5px;
  padding: 2px 10px;
  border-radius: 12px;
  color: var(--acc);
  background: color-mix(in srgb, var(--acc) 12%, transparent);
  letter-spacing: 0.5px;

  &.line {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--acc) 35%, transparent);
    color: color-mix(in srgb, var(--acc) 70%, #aaa);
  }
}
.attire {
  margin: 0;
  display: flex;
  flex-direction: column;

  > div {
    display: flex;
    gap: 10px;
    padding: 3px 0;
    font-size: 11.5px;

    & + div {
      border-top: 1px dashed color-mix(in srgb, var(--acc) 10%, transparent);
    }
  }
  dt {
    flex: none;
    width: 30px;
    color: color-mix(in srgb, var(--acc) 45%, #888);
    letter-spacing: 1px;
    font-size: 10.5px;
    line-height: inherit;
  }
  dd {
    margin: 0;
    color: #c4bbae;
  }
}

// ══════════════════════════════════════════════════════════
// 网店
// ══════════════════════════════════════════════════════════
.shop {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  overflow: hidden;
}
.shop-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 13px;
  background: none;
  border: none;
  color: inherit;
  font-family: inherit;
  cursor: pointer;

  .st-ttl {
    font-family: $serif;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--acc);
    letter-spacing: 3px;
  }
  .st-sub {
    font-size: 11px;
    color: color-mix(in srgb, var(--acc) 45%, #888);
  }
  em {
    margin-left: auto;
    font-style: normal;
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 50%, #999);
  }
}
.shop-body {
  padding: 0 13px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.shop-group h4 {
  margin: 0 0 7px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  font-weight: 600;
  color: color-mix(in srgb, var(--acc) 55%, #999);
  letter-spacing: 1px;
}
.shop-item {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'head btn'
    'desc btn';
  gap: 2px 10px;
  align-items: center;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  border-left: 2px solid transparent;

  & + .shop-item {
    margin-top: 6px;
  }
  &.on {
    border-left-color: var(--acc);
    background: color-mix(in srgb, var(--acc) 7%, rgba(0, 0, 0, 0.22));
  }
}
.si-head {
  grid-area: head;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.si-name {
  font-size: 12.5px;
  font-weight: 700;
  color: #ddd5c8;
}
.si-tag {
  font-size: 9.5px;
  padding: 0 6px;
  border-radius: 8px;
  color: var(--acc);
  background: color-mix(in srgb, var(--acc) 13%, transparent);

  &.dim {
    color: $warn;
    background: rgba(232, 169, 79, 0.12);
  }
}
.si-price {
  margin-left: auto;
  font-size: 11px;
  color: var(--acc);
  font-variant-numeric: tabular-nums;
}
.si-desc {
  grid-area: desc;
  font-size: 10.5px;
  color: #9a917f;
  letter-spacing: 0.3px;
}
.si-btn {
  grid-area: btn;
  padding: 5px 13px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--acc) 50%, transparent);
  background: transparent;
  color: var(--acc);
  font-size: 11px;
  font-family: inherit;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background 0.2s, filter 0.2s;

  &.buy {
    border: none;
    background: linear-gradient(135deg, var(--acc2), var(--acc));
    color: #16100a;
    font-weight: 700;

    &:hover:not(:disabled) {
      filter: brightness(1.12);
    }
  }
  &.equip:hover,
  &.use:hover {
    background: color-mix(in srgb, var(--acc) 14%, transparent);
  }
  &.unequip {
    border-color: rgba(224, 104, 104, 0.5);
    color: $danger;

    &:hover {
      background: rgba(224, 104, 104, 0.12);
    }
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

// ══════════════════════════════════════════════════════════
// 窄屏微调
// ══════════════════════════════════════════════════════════
@media (max-width: 380px) {
  .panel {
    padding: 10px 10px 14px;
  }
  .stage-title {
    letter-spacing: 2px;
  }
  .go {
    padding: 8px 14px;
    letter-spacing: 1px;
  }
}
</style>
