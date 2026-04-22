<template>
  <div class="frost-container" :class="{ 'container-dead': is_bad_ending }">
    <div class="bg-pattern"></div>
    <div
      class="main-panel"
      :class="{ 'panel-frozen': freeze_remaining > 0 && !is_bad_ending, 'panel-dead': is_bad_ending }"
    >
      <div class="panel-decor top" :class="{ 'decor-dead': is_bad_ending }"></div>

      <!-- ═══ 坏结局覆盖层 ═══ -->
      <template v-if="is_bad_ending">
        <div class="bad-ending-overlay">
          <div class="bad-ending-icon">💀</div>
          <div class="bad-ending-title">游戏结束</div>
          <div class="bad-ending-subtitle">苗广的愤怒不可逆转</div>
          <div class="bad-ending-divider"></div>
          <div class="bad-ending-text">
            三百年道侣的信任，在这一刻碎裂殆尽。<br />
            苗广确认了一切——愤怒、背叛、不可原谅。<br />
            治疗终止。云霜凝被带走。<br />
            寒霜门的禁制已将你永远拒之门外。
          </div>
          <div class="bad-ending-stats">
            <span>{{ store.data.时间.玄霜历 }}</span>
            <span class="bad-divider">·</span>
            <span
              >治疗完成 <b>{{ store.data.治疗.完成度.toFixed(1) }}%</b></span
            >
            <span class="bad-divider">·</span>
            <span
              >最终阶段 <b>{{ stage_name }}</b></span
            >
          </div>
          <div class="bad-ending-footer">一切不可挽回。</div>
        </div>
      </template>

      <!-- ═══ 2.0.43 终局覆盖层(苗喧的一日退出 + 3 楼视角切回后) ═══ -->
      <template v-else-if="is_game_ending">
        <div class="good-ending-overlay" ref="endingOverlayRef">
          <div class="ge-decor-top"></div>
          <div class="ge-icon">⚜️</div>
          <div class="ge-title">★ 终局 ★</div>
          <div class="ge-rank-badge" :class="`ge-rank-${ending_rank.toLowerCase()}`">
            <span class="ge-rank-label">{{ ending_rank }}</span>
            <span class="ge-rank-title">「{{ ending_rank_title }}」</span>
          </div>
          <div class="ge-divider"></div>
          <div class="ge-comment">{{ ending_comment }}</div>
          <div class="ge-divider ge-divider-sub"></div>
          <div class="ge-achievements">
            <p v-for="(line, i) in ending_achievements" :key="i">{{ line }}</p>
          </div>
          <div class="ge-stats-grid">
            <div class="ge-stat-cell">
              <div class="ge-stat-label">游戏楼层</div>
              <div class="ge-stat-val">{{ ending_floor_count }}</div>
            </div>
            <div class="ge-stat-cell">
              <div class="ge-stat-label">特殊场景</div>
              <div class="ge-stat-val">{{ completed_scene_count }} 场</div>
            </div>
            <div class="ge-stat-cell">
              <div class="ge-stat-label">灵石结余</div>
              <div class="ge-stat-val">◈{{ store.data.系统.灵石 }}</div>
            </div>
          </div>
          <div class="ge-time">{{ store.data.时间.玄霜历 }}</div>
          <div class="ge-actions">
            <button class="ge-btn ge-btn-primary" @click="continueAfterEnding">继续日常</button>
            <button class="ge-btn ge-btn-share" :disabled="sharing" @click="shareToDiscord">
              {{ sharing ? '截图中…' : '晒到帖子 📸' }}
            </button>
          </div>
          <div class="ge-decor-bottom"></div>
        </div>
      </template>

      <!-- ═══ 正常游戏UI ═══ -->
      <template v-else>
        <!-- 顶栏 -->
        <header class="header">
          <div class="world-info">
            <span class="info-item">{{ store.data.时间.玄霜历 || '玄霜历九百七十三年·霜降月' }}</span>
            <span class="divider">·</span>
            <span class="info-item ling"
              >灵石 <b class="ling-val">{{ store.data.系统.灵石 }}</b></span
            >
          </div>
          <span class="mode-tag" :class="mode_class">{{ store.data._当前互动模式 }}</span>
        </header>

        <!-- 打断冻结警告 -->
        <div v-if="freeze_remaining > 0" class="interrupt-banner">
          ⚠ 苗广监视中 · 治疗冻结（剩余 {{ freeze_remaining }} 楼）
        </div>

        <!-- 2.0.41 扮演苗喧 banner: 仅在"苗喧的一日"场景进行中显示 -->
        <div v-if="playingAsMiaoxuan" class="roleplay-banner">
          <div class="rp-main">
            <span class="rp-icon">🎭</span>
            <span class="rp-text"> <b>扮演苗喧</b> · 沙盒日常 · 其他功能已冷却 </span>
          </div>
          <button class="rp-exit-btn" @click="exitPlayAsMiaoxuan">结束扮演</button>
        </div>

        <!-- 进度(根据 active_tab 切换: 云霜凝=治疗完成度 / 洛书晴=顺从度) -->
        <section class="healing-section" :class="{ 'hs-luo': header_target === '洛书晴' }">
          <div class="healing-meta">
            <span class="heal-stage">{{ header_stage_label }}</span>
            <span class="heal-pct">{{ header_pct.toFixed(1) }}%</span>
          </div>
          <div class="healing-track">
            <div class="healing-fill" :style="{ width: header_pct + '%' }"></div>
            <div v-for="n in 9" :key="n" class="stage-tick" :style="{ left: n * 10 + '%' }"></div>
          </div>
        </section>

        <!-- 神魂空间入口 + 在场角色锁定 -->
        <div class="mode-entry" :class="{ 'locked-by-roleplay': playingAsMiaoxuan }">
          <template v-if="playingAsMiaoxuan">
            <button class="mode-btn soul-btn locked" disabled>⟨ 扮演苗喧·已冷却 ⟩</button>
          </template>
          <template v-else-if="store.data._当前互动模式 === '神魂空间'">
            <button class="mode-btn soul-btn active" @click="exitSoulSpace">
              ⟨ 退出{{ store.data._当前神魂空间角色 === '洛书晴' ? '洛书晴神魂' : '神魂' }} ⟩
            </button>
          </template>
          <template v-else-if="bothActorsActive && store.data._神魂空间已解锁 && freeze_remaining <= 0">
            <button class="mode-btn soul-btn locked" disabled>⟨ 两者在场·无法进入 ⟩</button>
          </template>
          <template v-else-if="store.data._神魂空间已解锁 && freeze_remaining <= 0">
            <button class="mode-btn soul-btn" @click="handleEnterSoulClick">⟨ 进入神魂 ⟩</button>
          </template>
          <template v-else-if="store.data._神魂空间已解锁 && freeze_remaining > 0">
            <button class="mode-btn soul-btn locked" disabled>⟨ 监视中({{ freeze_remaining }}楼) ⟩</button>
          </template>
          <template v-else>
            <button class="mode-btn soul-btn locked" disabled>⟨ 等待接引 ⟩</button>
          </template>
          <!-- 在场角色锁定(仅洛书晴线激活后显示, 扮演苗喧时禁用) -->
          <button
            v-if="store.data._洛书晴线已激活"
            class="actor-lock-btn"
            :title="playingAsMiaoxuan ? '扮演苗喧中·不可修改' : `在场: ${actorSummary}`"
            :disabled="playingAsMiaoxuan"
            @click="playingAsMiaoxuan ? null : (showActorPicker = true)"
          >
            🔒
          </button>
        </div>

        <!-- 神魂空间角色选择浮层（洛书晴激活后） -->
        <Teleport to="body">
          <div v-if="showSoulPicker" class="soul-picker-mask" @click.self="showSoulPicker = false">
            <div class="soul-picker-dialog">
              <div class="soul-picker-title">进入谁的神魂空间？</div>
              <button class="soul-picker-opt" @click="enterSoulSpaceFor('云霜凝', true)">
                <div class="soul-picker-name">云霜凝</div>
                <div class="soul-picker-sub">霜雪意识空间</div>
              </button>
              <button class="soul-picker-opt luo" @click="enterSoulSpaceFor('洛书晴', true)">
                <div class="soul-picker-name">洛书晴</div>
                <div class="soul-picker-sub">闺房意识空间</div>
              </button>
              <button class="soul-picker-cancel" @click="showSoulPicker = false">取消</button>
            </div>
          </div>
        </Teleport>

        <!-- 在场角色锁定浮层 -->
        <Teleport to="body">
          <div v-if="showActorPicker" class="soul-picker-mask" @click.self="showActorPicker = false">
            <div class="soul-picker-dialog">
              <div class="soul-picker-title">锁定本轮在场角色</div>
              <div class="actor-picker-hint">当前: {{ actorSummary }} · 修正后请 reroll</div>
              <button class="soul-picker-opt" @click="setSceneActor('云霜凝')">
                <div class="soul-picker-name">仅云霜凝</div>
                <div class="soul-picker-sub">洛书晴不在本轮画面</div>
              </button>
              <button class="soul-picker-opt luo" @click="setSceneActor('洛书晴')">
                <div class="soul-picker-name">仅洛书晴</div>
                <div class="soul-picker-sub">云霜凝不在本轮画面</div>
              </button>
              <button class="soul-picker-opt both" @click="setSceneActor('两者')">
                <div class="soul-picker-name">两者在场</div>
                <div class="soul-picker-sub">同屏互动(此时无法进入神魂)</div>
              </button>
              <button class="soul-picker-cancel" @click="showActorPicker = false">取消</button>
            </div>
          </div>
        </Teleport>

        <!-- 标签页 (扮演苗喧时仅苗喧 tab 可点,便于查看心态/绝望/压抑) -->
        <nav class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: active_tab === tab.id, 'disabled-roleplay': playingAsMiaoxuan && tab.id !== '苗喧' }"
            :disabled="playingAsMiaoxuan && tab.id !== '苗喧'"
            @click="toggleTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- 面板内容 -->
        <div v-if="active_tab" class="content-area">
          <YunPanel v-if="active_tab === '云霜凝'" />
          <LuoPanel v-else-if="active_tab === '洛书晴'" />
          <MiaoPanel v-else-if="active_tab === '苗广'" />
          <MiaoXuanPanel v-else-if="active_tab === '苗喧'" />
          <ShopPanel v-else-if="active_tab === '商店'" />
        </div>
      </template>

      <div class="panel-decor bottom" :class="{ 'decor-dead': is_bad_ending }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from './store';
import YunPanel from './components/YunPanel.vue';
import LuoPanel from './components/LuoPanel.vue';
import MiaoPanel from './components/MiaoPanel.vue';
import MiaoXuanPanel from './components/MiaoXuanPanel.vue';
import ShopPanel from './components/ShopPanel.vue';

const store = useDataStore();

const tabs = computed(() => {
  const base = [
    { id: '云霜凝', label: '云霜凝' },
    { id: '苗广', label: '苗广' },
  ];
  // 洛书晴激活后：新增洛书晴 + 苗喧 tab
  if (store.data._洛书晴线已激活) {
    base.push({ id: '洛书晴', label: '洛书晴' }, { id: '苗喧', label: '苗喧' });
  }
  base.push({ id: '商店', label: '商店' });
  return base;
});
// 2.0.31 性能优化: 老楼层自动折叠 content-area(DOM 省~200 节点/楼)
// - 最新楼: 共享 stored_active_tab(玩家切 tab / 再点同 tab 收起, 与原 UX 一致)
// - 老楼层: 独立 local_active_tab(默认 null 不渲染内容区), 玩家可手动点 tab 临时展开查看历史
// - 玩家发新消息 → 原最新楼 isLatest 翻转 false → watch 自动重置该楼 local 为 null(content 收起)
// - 首次进入默认展开"云霜凝", 玩家主动收起后 null 持久化(尊重其选择)
const stored_active_tab = useLocalStorage<string | null>('云霜凝:status_bar:active_tab', '云霜凝');
const local_active_tab = ref<string | null>(null); // 老楼层独立 tab 状态(不污染 stored)
const isLatest = ref(true);
function refreshIsLatest() {
  isLatest.value = isLatestMessage();
}
// 从最新 → 老: 自动重置 local(刚变老时内容区立即收起)
watch(isLatest, latest => {
  if (!latest) local_active_tab.value = null;
});
const active_tab = computed<string | null>({
  get: () => (isLatest.value ? stored_active_tab.value : local_active_tab.value),
  set: v => {
    if (isLatest.value) stored_active_tab.value = v;
    else local_active_tab.value = v;
  },
});
const showSoulPicker = ref(false);

// 2.0.31: 在场角色锁定按钮(洛书晴线激活后玩家可手动纠正 AI 判错)
const showActorPicker = ref(false);
const bothActorsActive = computed(() => !!store.data._当前场景角色.云霜凝 && !!store.data._当前场景角色.洛书晴);

// 2.0.41 扮演苗喧标志(_特殊场景.进行中 === '苗喧的一日')
const playingAsMiaoxuan = computed(() => store.data._特殊场景.进行中 === '苗喧的一日');

/** 退出扮演苗喧: 清场 + 标记完成 + 记录退出楼层(门控 snapshot 视角切回提示) */
function exitPlayAsMiaoxuan() {
  const currentFloor = (window as any).SillyTavern?.chat?.length ?? 0;
  try {
    const Mvu = (globalThis as any).Mvu;
    if (Mvu && typeof Mvu.getMvuData === 'function' && typeof Mvu.replaceMvuData === 'function') {
      const latestRaw = Mvu.getMvuData({ type: 'message', message_id: -1 });
      if (latestRaw) {
        // 清场 + 标已完成 + 记录退出楼层
        _.set(latestRaw, 'stat_data._特殊场景.进行中', '');
        _.set(latestRaw, 'stat_data._特殊场景开始楼层', 0);
        _.set(latestRaw, 'stat_data._已完成特殊场景.苗喧的一日', true);
        _.set(latestRaw, 'stat_data._退出苗喧一日楼层', currentFloor);
        Mvu.replaceMvuData(latestRaw, { type: 'message', message_id: -1 });
      }
    }
  } catch (e) {
    console.warn('[云霜凝] 退出苗喧的一日写 MVU 失败:', e);
  }
  // 本地 store 同步(UI 立刻切回)
  store.data._特殊场景.进行中 = '';
  store.data._特殊场景开始楼层 = 0;
  store.data._已完成特殊场景['苗喧的一日'] = true;
  store.data._退出苗喧一日楼层 = currentFloor;
  const tr = (globalThis as any).toastr;
  if (tr && typeof tr.success === 'function') {
    tr.success('已结束扮演苗喧, 视角切回 {{user}}', '', { timeOut: 3000 });
  }
}
const actorSummary = computed(() => {
  const 云 = store.data._当前场景角色.云霜凝;
  const 洛 = store.data._当前场景角色.洛书晴;
  if (云 && 洛) return '两者在场';
  if (云) return '仅云霜凝';
  if (洛) return '仅洛书晴';
  return '无';
});
function setSceneActor(preset: '云霜凝' | '洛书晴' | '两者') {
  const new当前场景角色 =
    preset === '云霜凝'
      ? { 云霜凝: true, 洛书晴: false }
      : preset === '洛书晴'
        ? { 云霜凝: false, 洛书晴: true }
        : { 云霜凝: true, 洛书晴: true };

  showActorPicker.value = false;

  // 2.0.41 修: 去掉 isLatestMessage 限制 + 直接写最新楼 MVU(message_id=-1)
  // 原 store.flush 写的是 iframe 所在楼的 MVU, 玩家发 user 消息后 iframe 所在楼
  // 不再是最新楼, AI 下轮读的是最新楼 MVU, 旧逻辑修改不同步。
  // 新逻辑: 绕过 store 直接写最新楼 MVU, 本地 store 同步更新让 UI 立刻响应。
  try {
    const Mvu = (globalThis as any).Mvu;
    if (Mvu && typeof Mvu.getMvuData === 'function' && typeof Mvu.replaceMvuData === 'function') {
      const latestRaw = Mvu.getMvuData({ type: 'message', message_id: -1 });
      if (latestRaw) {
        _.set(latestRaw, 'stat_data._当前场景角色', new当前场景角色);
        Mvu.replaceMvuData(latestRaw, { type: 'message', message_id: -1 });
      }
    }
  } catch (e) {
    console.warn('[云霜凝] setSceneActor 写最新楼 MVU 失败:', e);
  }

  // 本地 store 立刻更新 UI(UI 判定 bothActorsActive 看 store.data)
  store.data._当前场景角色 = new当前场景角色;

  // toastr 提示
  const tr = (globalThis as any).toastr;
  if (tr && typeof tr.success === 'function') {
    tr.success(`在场角色已锁定: ${preset === '两者' ? '两者在场' : '仅' + preset}`, '', {
      timeOut: 2500,
    });
  }
}

function toggleTab(id: string) {
  // 最新楼写 stored(持久化+跨楼同步); 老楼层写 local(仅本楼有效)
  active_tab.value = active_tab.value === id ? null : id;
}

onMounted(() => {
  refreshIsLatest();
  // 监听消息变动 → 重算 isLatest(新消息发送/接收时原最新楼自动折叠)
  eventOn(tavern_events.MESSAGE_RECEIVED, refreshIsLatest);
  eventOn(tavern_events.MESSAGE_SENT, refreshIsLatest);
  eventOn(tavern_events.MESSAGE_DELETED, refreshIsLatest);
  eventOn(tavern_events.CHAT_CHANGED, refreshIsLatest);
  // 2.0.32: 游戏逻辑脚本未加载监察。
  // 脚本跑起来会每 5s 往 _top.sessionStorage 写心跳,延迟 15s 后心跳仍空/陈旧 → 弹错误 toast。
  // 脚本成功加载时会清 gate,所以"脚本一度失败后恢复再失败"能重弹。
  setTimeout(() => {
    try {
      const top = window.parent as any;
      const heartbeat = Number(top?.sessionStorage?.getItem?.('云霜凝_脚本心跳') || 0);
      if (heartbeat > 0 && Date.now() - heartbeat < 15000) return;
      if (top?.sessionStorage?.getItem?.('云霜凝_加载失败toast已弹')) return;
      top?.toastr?.error?.(
        '⚠️ 游戏逻辑脚本未加载，状态栏数值可能异常。\n请刷新页面或检查酒馆助手插件是否启用。',
        '云霜凝',
        { timeOut: 0, extendedTimeOut: 0 },
      );
      top?.sessionStorage?.setItem?.('云霜凝_加载失败toast已弹', '1');
    } catch {}
  }, 15000);
});

const STAGE_NAMES = ['', '破冰', '初感', '温润', '渐通', '融合', '深化', '贯通', '共鸣', '圆融', '圆满'];
const LUO_STAGE_NAMES = ['', '排斥', '警惕', '动摇', '好奇', '期待', '依赖', '主动', '渴望', '归属', '完全倒向'];
const stage_name = computed(() => STAGE_NAMES[Math.min(10, Math.max(1, store.data.治疗.阶段))] ?? '');

// 头部进度区: 跟随 active_tab 切换, 洛书晴 tab 时显示洛书晴阶段/顺从度; 其他 tab 默认云霜凝
const header_target = computed<'云霜凝' | '洛书晴'>(() => (active_tab.value === '洛书晴' ? '洛书晴' : '云霜凝'));
const header_stage_label = computed(() => {
  if (header_target.value === '洛书晴') {
    const s = store.data.洛书晴.调教阶段;
    return `洛书晴 阶段${s}·${LUO_STAGE_NAMES[Math.min(10, Math.max(1, s))] ?? ''}`;
  }
  return `云霜凝 阶段${store.data.治疗.阶段}·${stage_name.value}`;
});
const header_pct = computed(() =>
  header_target.value === '洛书晴' ? store.data.洛书晴.顺从度 : store.data.治疗.完成度,
);

const freeze_remaining = computed(() => {
  const floor = (window as any).SillyTavern?.chat?.length ?? 0;
  return floor > 0 ? Math.max(0, store.data._打断冻结至楼层 - floor) : 0;
});

const is_bad_ending = computed(() => !!store.data._坏结局已触发);

// ══════════════════════════════════════════════════════════
// 2.0.43 终局覆盖层 (玩家完成"苗喧的一日"并退出且 3 楼视角切回过了)
// ══════════════════════════════════════════════════════════

const endingOverlayRef = ref<HTMLElement | null>(null);
const sharing = ref(false);

const is_game_ending = computed(() => {
  if (is_bad_ending.value) return false;
  const exitFloor = store.data._退出苗喧一日楼层 ?? 0;
  if (exitFloor <= 0) return false;
  if (!store.data._已完成特殊场景?.['苗喧的一日']) return false;
  const currentFloor = (window as any).SillyTavern?.chat?.length ?? 0;
  return currentFloor >= exitFloor + 3;
});

/** 评价等级: SSS / SS / S / A / B / C / D */
const ending_rank = computed<'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'>(() => {
  const d = store.data;
  const scenes = d._已完成特殊场景 ?? {};
  const qianjingDone = !!d.苗广.千晶幻术.认知改写完成;
  const doubleMarriage = !!scenes['双重改嫁'];
  const mainMarriage = !!scenes['掌门改嫁'];
  const luoStage = d._洛书晴线已激活 ? (d.洛书晴.调教阶段 ?? 0) : 0;
  const yunStage = d.治疗.阶段;
  const yunDefense = d.云霜凝.心理防线;
  const sceneCount = Object.values(scenes).filter(Boolean).length;
  const yunKinkCount = Object.keys(d.云霜凝.性癖列表 ?? {}).length;
  const luoKinkCount = Object.keys(d.洛书晴.性癖列表 ?? {}).length;

  // SSS: 双重改嫁 + 千晶 3/3 + 云阶段≥10 + 洛阶段≥9 + 云防线低 + 性癖多
  if (doubleMarriage && qianjingDone && yunStage >= 10 && luoStage >= 9 && yunDefense < 20 && yunKinkCount >= 5) {
    return 'SSS';
  }
  // SS: 双重改嫁 + 千晶 完成
  if (doubleMarriage && qianjingDone) return 'SS';
  // S: 掌门改嫁 + 千晶完成
  if (mainMarriage && qianjingDone) return 'S';
  // A: 云阶段≥8 + 特殊场景 ≥5
  if (yunStage >= 8 && sceneCount >= 5) return 'A';
  // B: 云阶段≥6 或 特殊场景≥3
  if (yunStage >= 6 || sceneCount >= 3) return 'B';
  // C: 基础完成(阶段≥4)
  if (yunStage >= 4) return 'C';
  // D: 进度有限
  return 'D';
});

const ending_rank_title = computed(() => {
  const map: Record<string, string> = {
    SSS: '道成圆满',
    SS: '三界倒映',
    S: '三百年定局',
    A: '深度开发',
    B: '新径初开',
    C: '初探',
    D: '浅尝',
  };
  return map[ending_rank.value] ?? '';
});

const ending_comment = computed(() => {
  const rank = ending_rank.value;
  const map: Record<string, string> = {
    SSS: '你用凡人的发散思维颠倒了三百年的道侣——掌门改嫁了两次,连未来儿媳也一同归属于你。苗广真诚唤你义父,老祖的筛选轮回断在你手里。祂只能看着,没有办法。这是最完美的反叛。',
    SS: '你颠覆了这场筛选。掌门改嫁、义父义子、新秩序在祂眼皮下落定。祂学不会你们的发散玩法,只能远远看着。',
    S: '三百年的道侣亲手把她交给你,苗广认子,新秩序在寒霜门安静落定。老祖埋下的筛选路径,在你这里第一次脱轨。',
    A: '你深入了她的道,让她成为你的人——她的故事已经脱轨,走向了未曾写下的那条路。',
    B: '你和她走出了一段新径。三百年的寒霜门,终于有人不再按老祖的剧本走。',
    C: '故事初开,她开始不同了。剩下的路,你还有时间走。',
    D: '你浅浅尝了她的道。剩下的,留给下次。',
  };
  return map[rank] ?? '';
});

/** 成就列表(动态按 data 生成,剧情式) */
const ending_achievements = computed<string[]>(() => {
  const d = store.data;
  const lines: string[] = [];
  const scenes = d._已完成特殊场景 ?? {};
  const sceneCount = Object.values(scenes).filter(Boolean).length;
  const sceneList = Object.keys(scenes)
    .filter(k => scenes[k])
    .join('、');

  // 云霜凝核心数据
  lines.push(
    `在你的陪伴下,云霜凝的心理防线从 100 降到了 **${d.云霜凝.心理防线}**,她对你的信任度达到了 **${d.云霜凝.信任度}**。`,
  );
  if (d.治疗.阶段 >= 8) {
    lines.push(`她的治疗走到了 **第 ${d.治疗.阶段} 阶·${stage_name.value}**,完成度 **${d.治疗.完成度.toFixed(1)}%**。`);
  } else {
    lines.push(`她的治疗停在 **第 ${d.治疗.阶段} 阶·${stage_name.value}**,完成度 **${d.治疗.完成度.toFixed(1)}%**。`);
  }

  // 云霜凝性癖 + 改造
  const yunKinks = Object.keys(d.云霜凝.性癖列表 ?? {});
  if (yunKinks.length > 0) {
    lines.push(`你觉醒了她的 **${yunKinks.length} 种性癖**: ${yunKinks.join('、')}。`);
  }
  const modNames: string[] = [];
  const mod = d.云霜凝.肉体改造 ?? ({} as any);
  for (const [k, v] of Object.entries(mod)) {
    if (v) modNames.push(k);
  }
  if (modNames.length > 0) {
    lines.push(`她身上留下了你刻下的痕迹: **${modNames.join('、')}**。`);
  }

  // 苗广
  if (d.苗广.千晶幻术.认知改写完成) {
    lines.push(`苗广的认知被千晶幻术 **3 次施术**彻底改写——他真诚地唤你"义父",唤云霜凝"娘亲"。`);
  } else if (d.苗广.千晶幻术.已使用次数 > 0) {
    lines.push(`苗广经历了 **${d.苗广.千晶幻术.已使用次数}/3 次**千晶幻术,认知已在动摇。`);
  }
  lines.push(`苗广的最终心态: **${d.苗广.心态}**。`);

  // 洛书晴
  if (d._洛书晴线已激活) {
    const luoStageName = LUO_STAGE_NAMES[Math.min(10, Math.max(1, d.洛书晴.调教阶段))] ?? '';
    lines.push(
      `洛书晴被你调教到了 **阶段 ${d.洛书晴.调教阶段}·${luoStageName}**,顺从度 **${d.洛书晴.顺从度}**。`,
    );
    const luoKinks = Object.keys(d.洛书晴.性癖列表 ?? {});
    if (luoKinks.length > 0) {
      lines.push(`她觉醒了 **${luoKinks.length} 种性癖**: ${luoKinks.join('、')}。`);
    }
  }

  // 苗喧
  lines.push(
    `苗喧最终心态 **${d.苗喧.心态}**,绝望值 **${d.苗喧.绝望值}** / 压抑值 **${d.苗喧.压抑值}** — 他成了家里唯一清醒的人。`,
  );

  // 场景
  if (sceneCount > 0) {
    lines.push(`你完成了 **${sceneCount} 个特殊场景**: ${sceneList}。`);
  }

  return lines;
});

const ending_floor_count = computed(() => {
  return (window as any).SillyTavern?.chat?.length ?? 0;
});

const completed_scene_count = computed(() => {
  const scenes = store.data._已完成特殊场景 ?? {};
  return Object.values(scenes).filter(Boolean).length;
});

/** "继续日常"按钮: 清 _退出苗喧一日楼层 = 0 → is_game_ending 自动为 false → 覆盖层消失 */
function continueAfterEnding() {
  try {
    const Mvu = (globalThis as any).Mvu;
    if (Mvu && typeof Mvu.getMvuData === 'function' && typeof Mvu.replaceMvuData === 'function') {
      const latestRaw = Mvu.getMvuData({ type: 'message', message_id: -1 });
      if (latestRaw) {
        _.set(latestRaw, 'stat_data._退出苗喧一日楼层', 0);
        Mvu.replaceMvuData(latestRaw, { type: 'message', message_id: -1 });
      }
    }
  } catch (e) {
    console.warn('[云霜凝] 继续日常写 MVU 失败:', e);
  }
  store.data._退出苗喧一日楼层 = 0;
}

/** "晒到帖子"按钮: html2canvas 截图状态栏 → 复制到剪贴板 → 打开 Discord */
async function shareToDiscord() {
  if (sharing.value) return;
  sharing.value = true;
  const DISCORD_URL = 'https://discord.com/channels/1380075940285124724/1482678610371416166';
  try {
    // 动态 import(避免首屏加载)
    const { default: html2canvas } = await import('html2canvas');
    const el = endingOverlayRef.value ?? (document.querySelector('.main-panel') as HTMLElement | null);
    if (!el) {
      throw new Error('找不到截图目标元素');
    }
    const canvas = await html2canvas(el, {
      backgroundColor: '#1a0618',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    // 复制到剪切板
    let clipboardOk = false;
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob 失败'))), 'image/png');
      });
      if ((navigator as any).clipboard?.write) {
        await (navigator as any).clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
        clipboardOk = true;
      }
    } catch (e) {
      console.warn('[云霜凝] 复制截图到剪贴板失败, 降级为下载:', e);
    }
    // 降级: 下载 PNG
    if (!clipboardOk) {
      const link = document.createElement('a');
      link.download = `云霜凝-终局-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
    // 打开 Discord
    (window.top ?? window).open(DISCORD_URL, '_blank');
    const tr = (globalThis as any).toastr;
    if (tr && typeof tr.success === 'function') {
      tr.success(clipboardOk ? '截图已复制到剪贴板 · 在 Discord 里 Ctrl+V 粘贴' : '截图已下载 · 拖到 Discord 上传', '', {
        timeOut: 4500,
      });
    }
  } catch (e) {
    console.error('[云霜凝] 截图失败:', e);
    const tr = (globalThis as any).toastr;
    if (tr && typeof tr.error === 'function') {
      tr.error('截图失败,请手动截图并分享', '', { timeOut: 3500 });
    }
    // 至少打开 Discord
    (window.top ?? window).open(DISCORD_URL, '_blank');
  } finally {
    sharing.value = false;
  }
}

const mode_class = computed(() => ({
  'mode-soul': store.data._当前互动模式 === '神魂空间',
  'mode-real': store.data._当前互动模式 === '现实互动',
  'mode-daily': store.data._当前互动模式 === '日常',
}));

/** 检查当前状态栏是否属于最新消息 */
function isLatestMessage(): boolean {
  const currentId = getCurrentMessageId();
  const chat = (window as any).SillyTavern?.chat;
  if (!chat || chat.length === 0) return true;
  return currentId === chat.length - 1;
}

function handleEnterSoulClick() {
  if (!isLatestMessage()) return;
  // 多轮脚本剧情排他：任何脚本驱动的多轮副本进行中时，禁止进入神魂空间
  if (store.data._特殊场景.进行中) return;
  if (store.data.苗广.千晶幻术.激活中) return;
  if (store.data.苗广.孝敬师父.激活中) return;
  // 洛书晴线已激活 → 弹角色选择浮层
  if (store.data._洛书晴线已激活) {
    showSoulPicker.value = true;
    return;
  }
  // 激活剧情进行中（兜底：理论上此时模式应已是神魂空间）
  if (store.data._洛书晴激活轮次进度 > 0) {
    enterSoulSpaceFor('洛书晴');
    return;
  }
  // 新婚夜已触发但激活剧情未开始 → 强制走洛书晴激活
  // 玩家以为是云霜凝的神魂空间，实际被潜意识拉入洛书晴的闺房意识
  if (store.data._新婚夜已触发) {
    enterSoulSpaceFor('洛书晴');
    return;
  }
  // 默认 → 进云霜凝（阶段3+首次会自动触发新婚夜）
  enterSoulSpaceFor('云霜凝');
}

// immediate=true: 立即 triggerSlash 发送进入 marker 让 AI 即刻描写(仅浮层点选用)
// immediate=false: 仅入队事件,等玩家下一次发消息时 AI 才看到(激活前的直接进入)
// 2.0.27 拆分:洛书晴激活前按钮只能进云霜凝,玩家更习惯自己开话题;
//             激活后浮层点选是系统动作,需立即触发对称 exitSoulSpace。
function enterSoulSpaceFor(role: '云霜凝' | '洛书晴', immediate: boolean = false) {
  if (!isLatestMessage()) return;
  showSoulPicker.value = false;
  store.pull();
  store.data._当前神魂空间角色 = role;
  store.data._当前互动模式 = '神魂空间';
  store.data._神魂空间激活中 = true;
  // 显式锁定 _当前场景角色，不依赖 stateValidation 后置兜底
  // (历史 bug:某些事件链下 stateValidation 未跑/时序错位,actorLine 残留旧值)
  store.data._当前场景角色 = { 云霜凝: role === '云霜凝', 洛书晴: role === '洛书晴' };
  const existing = store.data._待发送道具事件;
  // 洛书晴首次进入尚未激活线时触发第一次激活剧情
  let event = '__神魂空间入口__';
  if (role === '洛书晴') {
    if (!store.data._洛书晴线已激活 && store.data._洛书晴激活轮次进度 === 0) {
      store.data._洛书晴激活轮次进度 = 1;
      event = '__洛书晴激活剧情_轮1__';
    } else {
      event = '__神魂空间入口_洛书晴__';
    }
  }
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  if (immediate) {
    store.data._系统操作中 = true;
  }
  store.flush();
  if (immediate) {
    triggerSlash(`/send （进入${role}神魂空间）|/trigger`);
  }
}

// 兼容占位：旧名称 enterSoulSpace 已合并进 handleEnterSoulClick

function exitSoulSpace() {
  if (!isLatestMessage()) return;
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件
  store.data._当前互动模式 = '日常';
  store.data._神魂空间激活中 = false;
  // 2.0.32: 退出时把 _当前神魂空间角色 重置回默认,避免 MVU 数据残留为"洛书晴"
  // 与 _当前互动模式='日常' 矛盾(虽然读取处都先 gate 模式,残留不影响行为,
  // 但调试时看 MVU 容易误判)
  store.data._当前神魂空间角色 = '云霜凝';
  const existing = store.data._待发送道具事件;
  const event = '__退出神魂空间__';
  store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
  store.data._系统操作中 = true;
  store.flush();
  triggerSlash('/send （退出神魂空间）|/trigger');
}
</script>

<style lang="scss">
// ── 神魂空间角色选择浮层（非 scoped，因 Teleport 到 body） ──
.soul-picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.soul-picker-dialog {
  min-width: 280px;
  background: linear-gradient(170deg, #1a0a10 0%, #0c0406 100%);
  border: 1px solid rgba(192, 48, 80, 0.4);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.soul-picker-title {
  color: #ffe8ec;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 14px;
}
.soul-picker-opt {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 10px;
  background: rgba(192, 48, 80, 0.15);
  border: 1px solid rgba(192, 48, 80, 0.35);
  border-radius: 6px;
  color: #ffe8ec;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  &:hover {
    background: rgba(192, 48, 80, 0.3);
  }
  &.luo {
    background: rgba(211, 108, 134, 0.15);
    border-color: rgba(211, 108, 134, 0.4);
    &:hover {
      background: rgba(211, 108, 134, 0.3);
    }
  }
  &.both {
    background: linear-gradient(135deg, rgba(192, 48, 80, 0.15) 0%, rgba(211, 108, 134, 0.15) 100%);
    border-color: rgba(255, 143, 168, 0.4);
    &:hover {
      background: linear-gradient(135deg, rgba(192, 48, 80, 0.3) 0%, rgba(211, 108, 134, 0.3) 100%);
    }
  }
}
.actor-picker-hint {
  font-size: 11px;
  color: #a07080;
  text-align: center;
  margin: -8px 0 12px;
  font-style: italic;
}
.soul-picker-name {
  font-size: 14px;
  font-weight: 600;
}
.soul-picker-sub {
  font-size: 11px;
  color: #a07080;
  margin-top: 2px;
}
.soul-picker-cancel {
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px solid rgba(160, 112, 128, 0.3);
  color: #a07080;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
  &:hover {
    color: #ffe8ec;
  }
}
</style>

<style lang="scss" scoped>
// ── 色彩系统（绛红主题） ──
$c-bg: #0c0406;
$c-bg2: #1a0a10;
$c-ice: #c03050;
$c-ice-dim: #8a2038;
$c-acc: #ff6080;
$c-frost: #ffd0d8;
$c-text: #ffe8ec;
$c-sub: #a07080;
$c-gold: #e8be58;
$c-danger: #e05050;
$c-good: #40c880;
$font-main: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif;

.frost-container {
  width: 100%;
  position: relative;
  background: linear-gradient(170deg, $c-bg 0%, #0c0a1e 30%, $c-bg2 60%, darken($c-bg, 2%) 100%);
  color: $c-text;
  font-family: $font-main;
  font-size: 14px;
  line-height: 1.5;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 15% -5%, rgba($c-ice, 0.15), transparent 50%),
      radial-gradient(ellipse at 85% 105%, rgba($c-ice-dim, 0.1), transparent 50%),
      radial-gradient(circle at 50% 50%, rgba($c-acc, 0.02), transparent 70%);
    pointer-events: none;
  }
}

.bg-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, transparent, transparent 20px, rgba($c-ice, 0.018) 20px, rgba($c-ice, 0.018) 21px),
    repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba($c-ice, 0.012) 20px, rgba($c-ice, 0.012) 21px);
  pointer-events: none;
}

.main-panel {
  position: relative;
  border: 1px solid rgba($c-ice, 0.18);
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 0 40px rgba($c-ice, 0.04),
    inset 0 1px 0 rgba($c-frost, 0.05);
  transition:
    border-color 0.6s,
    box-shadow 0.6s;

  &.panel-frozen {
    animation: frozenGlow 2.5s ease-in-out infinite;
  }
}

@keyframes frozenGlow {
  0%,
  100% {
    border-color: rgba($c-ice, 0.25);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 8px rgba($c-ice, 0.08),
      inset 0 1px 0 rgba($c-frost, 0.05);
  }
  50% {
    border-color: rgba($c-acc, 0.5);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.4),
      0 0 20px rgba($c-acc, 0.2),
      0 0 40px rgba($c-ice, 0.1),
      inset 0 1px 0 rgba($c-frost, 0.08);
  }
}

.panel-decor {
  height: 2px;
  background: linear-gradient(90deg, transparent 2%, $c-ice-dim 20%, $c-acc 50%, $c-ice-dim 80%, transparent 98%);
  opacity: 0.8;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: -1px 30% -1px 30%;
    background: rgba($c-acc, 0.3);
    filter: blur(4px);
    pointer-events: none;
  }

  &.bottom {
    background: linear-gradient(
      90deg,
      transparent 5%,
      rgba($c-ice, 0.3) 30%,
      rgba($c-acc, 0.2) 50%,
      rgba($c-ice, 0.3) 70%,
      transparent 95%
    );
    height: 1px;
    &::after {
      display: none;
    }
  }
}

// ━━━ 顶栏 ━━━
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.1);
  background: linear-gradient(180deg, rgba($c-ice, 0.04) 0%, rgba($c-ice, 0.01) 100%);
  backdrop-filter: blur(8px);
  flex-wrap: wrap;
  gap: 8px;
}
.world-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: $c-sub;
}
.info-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  b {
    color: $c-frost;
    text-shadow: 0 0 8px rgba($c-acc, 0.2);
    font-weight: 800;
  }
}
.ling {
  padding: 2px 8px;
  background: linear-gradient(135deg, rgba($c-gold, 0.08) 0%, rgba($c-gold, 0.02) 100%);
  border: 1px solid rgba($c-gold, 0.15);
  border-radius: 12px;
}
.ling-val {
  color: $c-gold;
  text-shadow: 0 0 8px rgba($c-gold, 0.25);
  font-weight: 900;
}
.divider {
  opacity: 0.15;
  color: $c-ice;
  font-size: 0.6em;
}
.mode-tag {
  font-size: 0.75rem;
  font-weight: bold;
  padding: 4px 14px;
  border-radius: 14px;
  border: 1px solid;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
}
.mode-soul {
  color: #ff8898;
  border-color: rgba(#ff6080, 0.4);
  background: linear-gradient(135deg, rgba(#ff6080, 0.12) 0%, rgba(#ff6080, 0.04) 100%);
  box-shadow:
    0 0 12px rgba(#ff6080, 0.15),
    inset 0 0 8px rgba(#ff6080, 0.05);
}
.mode-real {
  color: lighten($c-good, 8%);
  border-color: rgba($c-good, 0.4);
  background: linear-gradient(135deg, rgba($c-good, 0.12) 0%, rgba($c-good, 0.04) 100%);
  box-shadow:
    0 0 12px rgba($c-good, 0.15),
    inset 0 0 8px rgba($c-good, 0.05);
}
.mode-daily {
  color: rgba($c-sub, 0.8);
  border-color: rgba($c-sub, 0.2);
  background: rgba($c-sub, 0.04);
}

// ━━━ 中断警告 ━━━
.interrupt-banner {
  background: linear-gradient(90deg, rgba($c-danger, 0.12) 0%, rgba($c-danger, 0.06) 50%, rgba($c-danger, 0.12) 100%);
  border-bottom: 1px solid rgba($c-danger, 0.25);
  color: $c-danger;
  font-size: 0.82rem;
  font-weight: bold;
  padding: 6px 16px;
  text-align: center;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba($c-danger, 0.2);
  animation: bannerPulse 2s ease-in-out infinite;
}

// 2.0.41 扮演苗喧 banner
.roleplay-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: linear-gradient(90deg, rgba(176, 48, 64, 0.2), rgba(232, 190, 88, 0.12), rgba(176, 48, 64, 0.2));
  border-top: 1px solid rgba(232, 190, 88, 0.4);
  border-bottom: 1px solid rgba(232, 190, 88, 0.4);
  padding: 8px 14px;
  font-size: 0.82rem;
  color: #ffe8ec;
  .rp-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .rp-icon {
    font-size: 1.1rem;
  }
  .rp-text b {
    color: #e8be58;
  }
  .rp-exit-btn {
    padding: 4px 12px;
    background: rgba(232, 190, 88, 0.2);
    border: 1px solid rgba(232, 190, 88, 0.6);
    color: #e8be58;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
    transition: all 0.2s;
    &:hover {
      background: rgba(232, 190, 88, 0.4);
    }
  }
}
.mode-entry.locked-by-roleplay .actor-lock-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tab-btn.disabled-roleplay {
  opacity: 0.4;
  cursor: not-allowed;
}
@keyframes bannerPulse {
  0%,
  100% {
    background-color: rgba($c-danger, 0.06);
  }
  50% {
    background-color: rgba($c-danger, 0.1);
  }
}

// ━━━ 治疗进度 ━━━
.healing-section {
  padding: 12px 16px 14px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.healing-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  font-size: 0.78rem;
}
.heal-stage {
  color: $c-acc;
  font-weight: bold;
  font-size: 0.88rem;
  letter-spacing: 0.8px;
  text-shadow: 0 0 6px rgba($c-acc, 0.15);
}
.heal-pct {
  color: $c-frost;
  font-weight: 900;
  font-size: 1.05rem;
  text-shadow: 0 0 8px rgba($c-ice, 0.25);
}
.healing-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba($c-ice, 0.15);
  border-radius: 5px;
  position: relative;
  overflow: visible;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
.healing-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, $c-ice-dim, $c-ice, $c-acc);
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 12px rgba($c-ice, 0.4),
    0 0 4px rgba($c-acc, 0.3);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.18) 0%, rgba(#fff, 0.05) 40%, transparent 60%);
    border-radius: 5px;
  }
}
.stage-tick {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: rgba($c-frost, 0.18);
  transform: translateX(-50%);

  &::after {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba($c-frost, 0.25);
  }
}

// ── 洛书晴 tab 时的粉紫主题覆盖(和 LuoPanel 色系一致) ──
.healing-section.hs-luo {
  .heal-stage {
    color: #ff8fa8;
    text-shadow: 0 0 6px rgba(#ff8fa8, 0.2);
  }
  .heal-pct {
    color: #ffe0e8;
    text-shadow: 0 0 8px rgba(#d36c86, 0.3);
  }
  .healing-track {
    border-color: rgba(#ff8fa8, 0.2);
  }
  .healing-fill {
    background: linear-gradient(90deg, #8a3c50, #d36c86, #ff8fa8);
    box-shadow:
      0 0 12px rgba(#d36c86, 0.4),
      0 0 4px rgba(#ff8fa8, 0.3);
  }
}

// ━━━ 模式入口 ━━━
.mode-entry {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba($c-ice, 0.08);
}
.actor-lock-btn {
  flex: 0 0 auto;
  width: 42px;
  padding: 10px 0;
  border: 1px solid rgba(#ff8fa8, 0.25);
  border-radius: 8px;
  background: rgba(#d36c86, 0.08);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.15s;

  &:hover {
    background: rgba(#d36c86, 0.16);
    border-color: rgba(#ff8fa8, 0.5);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
}
.mode-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 0.86rem;
  font-family: $font-main;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: bold;
  letter-spacing: 1.5px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.04) 0%, transparent 50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  &:hover::before {
    opacity: 1;
  }
}
.soul-btn {
  color: #ff6080;
  border-color: rgba(#ff6080, 0.2);
  background: transparent;

  &:hover:not(:disabled) {
    background: rgba(#ff6080, 0.06);
    border-color: rgba(#ff6080, 0.4);
    box-shadow: 0 0 16px rgba(#ff6080, 0.08);
  }
  &.active {
    color: #fff;
    border-color: rgba(#ff6080, 0.5);
    background: linear-gradient(135deg, rgba(#ff6080, 0.15) 0%, rgba(#ff6080, 0.06) 100%);
    box-shadow:
      0 0 16px rgba(#ff6080, 0.15),
      inset 0 0 12px rgba(#ff6080, 0.05);
    text-shadow: 0 0 8px rgba(#ff6080, 0.4);
  }
  &.locked {
    color: rgba($c-sub, 0.3);
    border-color: rgba($c-sub, 0.1);
    cursor: not-allowed;
    opacity: 0.4;
  }
}

// ━━━ 标签页 ━━━
.tabs {
  display: flex;
  padding: 6px 10px;
  gap: 4px;
  background: rgba($c-ice, 0.02);
  border-bottom: 1px solid rgba($c-ice, 0.06);
}
.tab-btn {
  flex: 1;
  padding: 9px 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: $c-sub;
  font-size: 0.92rem;
  font-family: $font-main;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  letter-spacing: 0.8px;
  text-align: center;

  &:hover {
    color: $c-frost;
    background: rgba($c-ice, 0.06);
    border-color: rgba($c-ice, 0.08);
  }

  &.active {
    color: #fff;
    font-weight: bold;
    background: linear-gradient(135deg, rgba($c-ice, 0.12) 0%, rgba($c-acc, 0.08) 100%);
    border-color: rgba($c-acc, 0.2);
    box-shadow:
      0 2px 8px rgba($c-ice, 0.1),
      inset 0 0 8px rgba($c-acc, 0.04);
    text-shadow: 0 0 8px rgba($c-acc, 0.3);
  }
}

// ━━━ 内容区 ━━━
.content-area {
  padding: 14px 16px;
  animation: contentIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes contentIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ━━━ 坏结局 ━━━
.container-dead {
  &::before {
    background:
      radial-gradient(ellipse at 50% 0%, rgba($c-danger, 0.12), transparent 60%),
      radial-gradient(ellipse at 50% 100%, rgba(0, 0, 0, 0.5), transparent 70%);
  }
}

.panel-dead {
  animation: deadGlow 3s ease-in-out infinite;
  border-color: rgba($c-danger, 0.3);
}

@keyframes deadGlow {
  0%,
  100% {
    border-color: rgba($c-danger, 0.2);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.6),
      0 0 12px rgba($c-danger, 0.08),
      inset 0 0 30px rgba(0, 0, 0, 0.3);
  }
  50% {
    border-color: rgba($c-danger, 0.45);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.6),
      0 0 25px rgba($c-danger, 0.15),
      0 0 50px rgba($c-danger, 0.06),
      inset 0 0 30px rgba(0, 0, 0, 0.3);
  }
}

.decor-dead {
  background: linear-gradient(
    90deg,
    transparent 5%,
    rgba($c-danger, 0.25) 30%,
    rgba($c-danger, 0.4) 50%,
    rgba($c-danger, 0.25) 70%,
    transparent 95%
  );
  opacity: 0.6;

  &::after {
    background: rgba($c-danger, 0.2);
  }

  &.bottom {
    background: linear-gradient(
      90deg,
      transparent 5%,
      rgba($c-danger, 0.15) 30%,
      rgba($c-danger, 0.25) 50%,
      rgba($c-danger, 0.15) 70%,
      transparent 95%
    );
  }
}

.bad-ending-overlay {
  padding: 28px 20px 24px;
  text-align: center;
  animation: badEndingFadeIn 1.2s ease-out;
}

@keyframes badEndingFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bad-ending-icon {
  font-size: 2.4rem;
  margin-bottom: 10px;
  animation: iconPulse 3s ease-in-out infinite;
  filter: grayscale(0.3);
}

@keyframes iconPulse {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.bad-ending-title {
  font-size: 1.4rem;
  font-weight: 900;
  color: $c-danger;
  letter-spacing: 4px;
  text-shadow:
    0 0 16px rgba($c-danger, 0.35),
    0 0 40px rgba($c-danger, 0.1);
  margin-bottom: 4px;
}

.bad-ending-subtitle {
  font-size: 0.82rem;
  color: rgba($c-danger, 0.7);
  letter-spacing: 1.5px;
  font-weight: 600;
  margin-bottom: 16px;
}

.bad-ending-divider {
  width: 60%;
  height: 1px;
  margin: 0 auto 16px;
  background: linear-gradient(90deg, transparent, rgba($c-danger, 0.3), transparent);
}

.bad-ending-text {
  font-size: 0.86rem;
  line-height: 2;
  color: rgba($c-frost, 0.6);
  font-style: italic;
  letter-spacing: 0.5px;
  margin-bottom: 20px;
}

.bad-ending-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: rgba($c-sub, 0.7);
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba($c-danger, 0.12);
  border-radius: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  b {
    color: rgba($c-frost, 0.8);
    font-weight: 800;
  }
}

.bad-divider {
  color: rgba($c-danger, 0.25);
  font-size: 0.6em;
}

.bad-ending-footer {
  font-size: 0.75rem;
  color: rgba($c-danger, 0.4);
  letter-spacing: 2px;
  font-weight: 600;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2.0.43 终局覆盖层 · 金色系
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$ge-gold: #e8be58;
$ge-gold-deep: #b8933a;
$ge-gold-light: #fff2cc;
$ge-bg: #1a0618;
$ge-accent: #b03040;

.good-ending-overlay {
  padding: 24px 18px 22px;
  text-align: center;
  background: radial-gradient(
    ellipse at top,
    rgba($ge-gold, 0.12) 0%,
    rgba($ge-accent, 0.08) 40%,
    rgba(0, 0, 0, 0.2) 100%
  );
  animation: geFadeIn 1.5s ease-out;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background:
      radial-gradient(circle at 20% 30%, rgba($ge-gold, 0.08) 0%, transparent 40%),
      radial-gradient(circle at 80% 70%, rgba($ge-gold, 0.06) 0%, transparent 40%);
    animation: geGlow 8s ease-in-out infinite;
    pointer-events: none;
  }
}

@keyframes geFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes geGlow {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.ge-decor-top,
.ge-decor-bottom {
  width: 70%;
  height: 1px;
  margin: 0 auto 14px;
  background: linear-gradient(90deg, transparent, $ge-gold, transparent);
  box-shadow: 0 0 12px rgba($ge-gold, 0.5);
}
.ge-decor-bottom {
  margin: 14px auto 0;
}

.ge-icon {
  font-size: 2.8rem;
  margin-bottom: 8px;
  filter: drop-shadow(0 0 12px rgba($ge-gold, 0.6));
  animation: geIconSpin 6s linear infinite;
  position: relative;
  z-index: 1;
}
@keyframes geIconSpin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.ge-title {
  font-size: 1.5rem;
  font-weight: 900;
  color: $ge-gold;
  letter-spacing: 6px;
  text-shadow:
    0 0 18px rgba($ge-gold, 0.6),
    0 0 36px rgba($ge-gold, 0.2);
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
}

.ge-rank-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: linear-gradient(135deg, rgba($ge-gold, 0.2), rgba($ge-gold-deep, 0.1));
  border: 1px solid rgba($ge-gold, 0.5);
  border-radius: 20px;
  margin-bottom: 14px;
  box-shadow: 0 0 12px rgba($ge-gold, 0.25);
  position: relative;
  z-index: 1;

  .ge-rank-label {
    font-size: 1.1rem;
    font-weight: 900;
    color: $ge-gold-light;
    letter-spacing: 2px;
    text-shadow: 0 0 8px rgba($ge-gold, 0.8);
  }
  .ge-rank-title {
    font-size: 0.82rem;
    color: $ge-gold;
    letter-spacing: 1px;
    font-weight: 600;
  }

  &.ge-rank-sss {
    background: linear-gradient(135deg, rgba($ge-gold, 0.35), rgba(255, 255, 255, 0.15));
    border-color: $ge-gold;
    box-shadow: 0 0 20px rgba($ge-gold, 0.5);
    .ge-rank-label {
      color: #fff;
    }
  }
  &.ge-rank-ss,
  &.ge-rank-s {
    background: linear-gradient(135deg, rgba($ge-gold, 0.25), rgba($ge-accent, 0.1));
  }
  &.ge-rank-d {
    background: linear-gradient(135deg, rgba(160, 112, 128, 0.2), rgba(80, 56, 64, 0.1));
    border-color: rgba(160, 112, 128, 0.4);
    .ge-rank-label {
      color: rgba(255, 232, 236, 0.7);
    }
    .ge-rank-title {
      color: rgba(160, 112, 128, 0.9);
    }
    box-shadow: none;
  }
}

.ge-divider {
  width: 60%;
  height: 1px;
  margin: 0 auto 14px;
  background: linear-gradient(90deg, transparent, rgba($ge-gold, 0.5), transparent);
}
.ge-divider-sub {
  width: 40%;
  opacity: 0.5;
}

.ge-comment {
  font-size: 0.88rem;
  line-height: 1.85;
  color: rgba($ge-gold-light, 0.88);
  letter-spacing: 0.6px;
  padding: 0 4px;
  margin-bottom: 12px;
  font-style: italic;
  position: relative;
  z-index: 1;
}

.ge-achievements {
  text-align: left;
  padding: 14px 14px;
  background: linear-gradient(180deg, rgba($ge-gold, 0.06), rgba(0, 0, 0, 0.15));
  border: 1px solid rgba($ge-gold, 0.25);
  border-radius: 6px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;

  p {
    font-size: 0.82rem;
    line-height: 1.9;
    color: rgba(#ffe8ec, 0.88);
    margin: 0 0 6px;
    padding-left: 12px;
    position: relative;
    letter-spacing: 0.3px;
    &::before {
      content: '◈';
      position: absolute;
      left: 0;
      color: $ge-gold;
      font-size: 0.7rem;
      top: 5px;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.ge-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}
.ge-stat-cell {
  padding: 10px 6px;
  background: rgba($ge-gold, 0.08);
  border: 1px solid rgba($ge-gold, 0.25);
  border-radius: 4px;
  text-align: center;
  .ge-stat-label {
    font-size: 0.7rem;
    color: rgba($ge-gold, 0.75);
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .ge-stat-val {
    font-size: 0.92rem;
    color: $ge-gold-light;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
}

.ge-time {
  font-size: 0.75rem;
  color: rgba($ge-gold, 0.5);
  letter-spacing: 1.5px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.ge-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  position: relative;
  z-index: 1;
}
.ge-btn {
  flex: 1;
  padding: 10px 14px;
  background: rgba($ge-gold, 0.12);
  border: 1px solid rgba($ge-gold, 0.5);
  color: $ge-gold-light;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 600;
  letter-spacing: 1px;
  transition: all 0.25s;
  &:hover:not(:disabled) {
    background: rgba($ge-gold, 0.28);
    box-shadow: 0 0 14px rgba($ge-gold, 0.4);
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &.ge-btn-primary {
    background: linear-gradient(135deg, rgba($ge-gold, 0.3), rgba($ge-gold-deep, 0.18));
    border-color: $ge-gold;
  }
  &.ge-btn-share {
    background: linear-gradient(135deg, rgba($ge-accent, 0.25), rgba($ge-gold, 0.1));
    border-color: rgba($ge-gold, 0.55);
  }
}

// ━━━ 移动端适配 ━━━
@media (max-width: 360px) {
  .header {
    padding: 10px 12px;
    gap: 6px;
  }
  .world-info {
    gap: 6px;
    font-size: 0.78rem;
  }
  .healing-section {
    padding: 10px 12px 12px;
  }
  .mode-entry {
    padding: 8px 12px;
  }
  .tabs {
    padding: 4px 8px;
  }
  .content-area {
    padding: 12px;
  }
}
</style>
