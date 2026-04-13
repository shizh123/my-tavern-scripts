<template>
  <div class="shop-panel">
    <!-- 灵石 + 临时效果 -->
    <div class="shop-header">
      <div class="ling-display">
        <span class="ling-icon">◈</span>
        <span class="ling-val">{{ store.data.系统.灵石 }}</span>
        <span class="ling-unit">灵石</span>
      </div>
      <div class="header-right">
        <div v-if="!_.isEmpty(store.data._临时道具剩余轮次)" class="temp-row">
          <span v-for="(turns, name) in store.data._临时道具剩余轮次" :key="name" class="temp-badge"
            >{{ name }} <span class="temp-turns">{{ turns }}轮</span></span
          >
        </div>
        <div v-if="store.data._特殊场景.进行中" class="scene-badge">
          <span class="scene-icon">⟐</span>
          {{ store.data._特殊场景.进行中 }}
          <span class="scene-progress">进行中</span>
        </div>
      </div>
    </div>

    <!-- 类别标签页 -->
    <nav class="cat-tabs">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-btn"
        :class="[{ active: active_cat === cat.id }, 'tab-' + cat.id]"
        @click="active_cat = cat.id"
      >
        {{ cat.label }}
      </button>
    </nav>

    <!-- 道具信息栏（固定位置，不覆盖道具） -->
    <div class="info-bar" :class="hovered ? 'info-bar--active info-' + active_cat : ''">
      <template v-if="hovered">
        <div class="info-head">
          <span class="info-name">{{ hovered.name }}</span>
          <span class="info-type" :class="'itype-' + active_cat">{{ hovered.type }}</span>
          <span class="info-price"><span class="p-icon">◈</span>{{ hovered.price }}</span>
        </div>
        <div class="info-desc">{{ hovered.desc }}</div>
        <div v-if="!isUnlocked(hovered)" class="info-lock">{{ hovered.unlockDesc }}</div>
      </template>
      <template v-else>
        <div class="info-placeholder">{{ isMobile ? '长按道具查看详情' : '悬停道具查看详情' }}</div>
      </template>
    </div>

    <!-- 道具列表 -->
    <div class="item-list" @scroll="onListScroll">
      <template v-for="entry in grouped_items" :key="entry.type === 'header' ? 'h-' + entry.label : entry.item.name">
        <div v-if="entry.type === 'header'" class="group-header" @click="toggleGroup(entry.label)">
          <span class="group-chevron" :class="{ collapsed: collapsedGroups.has(entry.label) }">‹</span>
          <span class="group-label">{{ entry.label }}</span>
          <span class="group-count">{{ getGroupCount(entry.label) }}</span>
          <span class="group-line"></span>
        </div>
        <div
          v-else-if="!entry.group || !collapsedGroups.has(entry.group)"
          class="item-card"
          :class="[rowClass(entry.item), 'card-' + active_cat, { 'no-hover': isScrolling }]"
          @mouseenter="onCardEnter(entry.item)"
          @mouseleave="onCardLeave"
          @click="handleClick(entry.item)"
        >
          <div class="card-top">
            <span
              v-if="store.data.系统.道具状态[entry.item.name] === '已购买'"
              class="row-check"
              :class="{ checked: isCardChecked(entry.item) }"
            >
              <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" /></svg>
            </span>
            <span class="card-name">{{ entry.item.name }}</span>
          </div>
          <div class="card-bottom">
            <span class="card-price"><span class="p-icon">◈</span>{{ entry.item.price }}</span>
            <span class="card-state" :class="stateClass(entry.item.name)">{{ stateLabel(entry.item) }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 留影石专区（装备页内） -->
    <div v-if="active_cat === '装备'" class="liuying-section">
      <div class="liuying-header">
        <span class="liuying-title">留影石</span>
        <span class="liuying-hint">录制画面·出售给苗广</span>
        <button class="liuying-buy-btn" :disabled="!canBuyLiuyingshi" @click="handleBuyLiuyingshi">
          购买 <span class="p-icon">◈</span>60
        </button>
      </div>
      <div v-if="!liuyingshiUnlocked" class="liuying-lock">阶段≥3 解锁</div>
      <div v-else-if="liuyingshiItems.length === 0" class="liuying-empty">暂无留影石</div>
      <div v-else class="liuying-list">
        <div
          v-for="item in liuyingshiItems"
          :key="item.name"
          class="liuying-item"
          :class="{ 'liuying-recording': item.state === '使用中' }"
        >
          <span class="liuying-name">{{ item.name }}</span>
          <span class="liuying-state" :class="item.state === '使用中' ? 'ls-active' : 'ls-idle'">
            {{ item.state === '使用中' ? '录制中' : '待机' }}
          </span>
          <button class="liuying-toggle-btn" @click="toggleLiuyingshi(item.name)">
            {{ item.state === '使用中' ? '停止' : '录制' }}
          </button>
          <button
            v-if="canSellLiuyingshi && item.state === '使用中'"
            class="liuying-sell-btn"
            :disabled="liuyingshiSellCooldown.inCooldown"
            @click="handleSellLiuyingshi(item.name)"
          >
            <template v-if="liuyingshiSellCooldown.inCooldown">
              冷却中({{ liuyingshiSellCooldown.remainingFloors }}楼)
            </template>
            <template v-else> 出售 <span class="p-icon">◈</span>{{ sellPrice }} </template>
          </button>
        </div>
      </div>
    </div>

    <!-- 淫纹刻印位置选择 + 文字输入 -->
    <Transition name="slide-up">
      <div v-if="showYinwenPicker" class="yinwen-picker">
        <div class="yinwen-title">选择淫纹刻印位置</div>
        <div class="yinwen-options">
          <button
            v-for="pos in YINWEN_POSITIONS"
            :key="pos"
            class="yinwen-opt"
            :class="{ selected: yinwenPos === pos, done: !!store.data.云霜凝.肉体改造.淫纹[pos] }"
            :disabled="!!store.data.云霜凝.肉体改造.淫纹[pos]"
            @click="yinwenPos = pos"
          >
            {{ pos }}<span v-if="store.data.云霜凝.肉体改造.淫纹[pos]" class="done-mark">已有</span>
          </button>
        </div>
        <div v-if="yinwenPos" class="yinwen-text-row">
          <label class="yinwen-text-label">刻印文字（2-8字，留空默认"淫"）</label>
          <input v-model="yinwenText" class="yinwen-text-input" type="text" maxlength="8" placeholder="淫" />
        </div>
      </div>
    </Transition>

    <!-- 确定使用按钮 -->
    <Transition name="slide-up">
      <button
        v-if="checkedItems.size > 0"
        class="confirm-btn"
        :disabled="needYinwenPos && !yinwenPos"
        @click="confirmUse"
      >
        <span class="confirm-text">确定使用</span>
        <span class="confirm-count">{{ checkedItems.size }}件</span>
      </button>
    </Transition>

    <!-- 共用道具目标选择浮层 -->
    <Transition name="fade">
      <div v-if="showTargetDialog" class="target-dialog-mask" @click.self="showTargetDialog = false">
        <div class="target-dialog">
          <div class="target-dialog-title">作用于谁？</div>
          <div class="target-dialog-desc">以下道具可作用于云霜凝或洛书晴</div>
          <div class="target-dialog-items">
            <span v-for="n in sharedItemsPending" :key="n" class="target-dialog-chip">{{ n }}</span>
          </div>
          <div class="target-dialog-btns">
            <button class="target-btn tb-yun" @click="pickTarget('云霜凝')">云霜凝</button>
            <button class="target-btn tb-luo" @click="pickTarget('洛书晴')">洛书晴</button>
          </div>
          <button class="target-dialog-cancel" @click="showTargetDialog = false">取消</button>
        </div>
      </div>
    </Transition>

    <!-- 配对场景选择浮层（单独进行 / 洛书晴参与） -->
    <Transition name="fade">
      <div v-if="showScenePairDialog" class="target-dialog-mask" @click.self="showScenePairDialog = false">
        <div class="target-dialog scene-pair-dialog">
          <div class="target-dialog-title">{{ pendingScenePair }}</div>
          <div class="target-dialog-desc">选择场景参与形式</div>
          <div class="scene-pair-btns">
            <button class="scene-pair-btn scene-pair-solo" @click="pickSceneVersion('solo')">
              <span class="scene-pair-btn-main">单独进行</span>
              <span class="scene-pair-btn-sub">云霜凝独自承受</span>
            </button>
            <button
              class="scene-pair-btn scene-pair-luo"
              :disabled="pendingEnhancedMissing.length > 0"
              @click="pickSceneVersion('luo')"
            >
              <span class="scene-pair-btn-main">洛书晴参与</span>
              <span class="scene-pair-btn-sub">
                {{ pendingEnhancedMissing.length > 0 ? '前置条件未满足' : '云霜凝 + 洛书晴联合' }}
              </span>
            </button>
          </div>
          <div v-if="pendingEnhancedMissing.length > 0" class="scene-pair-missing">
            <div class="scene-pair-missing-title">「洛书晴参与」尚未开启：</div>
            <ul class="scene-pair-missing-list">
              <li v-for="reason in pendingEnhancedMissing" :key="reason">{{ reason }}</li>
            </ul>
          </div>
          <button class="target-dialog-cancel" @click="showScenePairDialog = false">取消</button>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <Transition name="toast-fade">
      <div v-if="toast" class="toast-bar" :class="toast_class">{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import _ from 'lodash';
import { useDataStore } from '../store';
import {
  buyLiuyingshi,
  sellLiuyingshi,
  getConsumableCooldownInfo,
  getLiuyingshiSellCooldownInfo,
  canActivateItem,
  INSTANT_EFFECTS,
  enforceExclusiveGroup,
} from '../../../脚本/游戏逻辑/shopSystem';

const store = useDataStore();

const isMobile = ref(window.matchMedia('(hover: none)').matches);

/** 检查当前状态栏是否属于最新消息，旧楼层不允许商店操作 */
function isLatestMessage(): boolean {
  const currentId = getCurrentMessageId();
  const chat = (window as any).SillyTavern?.chat;
  if (!chat || chat.length === 0) return true;
  return currentId === chat.length - 1;
}

/**
 * 多轮脚本剧情排他检测——任何脚本驱动的多轮副本进行中时，
 * 返回拦截原因字符串；否则返回空字符串。
 */
function busyScenarioReason(): string {
  const d = store.data;
  if (d._特殊场景.进行中) return `场景「${d._特殊场景.进行中}」进行中`;
  if (d.苗广.千晶幻术.激活中) return '千晶幻术施术中';
  if (d.苗广.孝敬师父.激活中) return '孝敬师父进行中';
  if (d._当前互动模式 === '神魂空间' || d._神魂空间激活中) return '神魂空间中';
  if (d._洛书晴激活轮次进度 > 0) return '洛书晴激活剧情中';
  return '';
}

interface ItemDef {
  name: string;
  price: number;
  type: '消耗品' | '装备' | '体改' | '性癖' | '特殊场景';
  desc: string;
  unlockDesc: string;
}

const hovered = ref<ItemDef | null>(null);

// ── 滚动防抖：滚动期间禁止 hover 更新，防止移动端屏闪 ──
const isScrolling = ref(false);
let _scrollTimer: ReturnType<typeof setTimeout> | null = null;
function onListScroll() {
  isScrolling.value = true;
  hovered.value = null;
  if (_scrollTimer) clearTimeout(_scrollTimer);
  _scrollTimer = setTimeout(() => {
    isScrolling.value = false;
  }, 150);
}
function onCardEnter(item: ItemDef) {
  if (!isScrolling.value) hovered.value = item;
}
function onCardLeave() {
  if (!isScrolling.value) hovered.value = null;
}

// ── v2 道具定义 ──────────────────────────────────────────

const ALL_ITEMS: Record<string, ItemDef[]> = {
  消耗品: [
    { name: '安神香', price: 30, type: '消耗品', desc: '焚烧型药香，令人心理防线松懈（防线-3）', unlockDesc: '' },
    {
      name: '蚀心露',
      price: 80,
      type: '消耗品',
      desc: '渗入神魂，防线下降，信任微升，苗广起疑（防线-3，信任+3，疑心+3）',
      unlockDesc: '阶段≥3',
    },
    { name: '定心符', price: 25, type: '消耗品', desc: '安神符箓，苗广疑心平定（疑心-8）', unlockDesc: '阶段≥2' },
    {
      name: '混沌珠',
      price: 80,
      type: '消耗品',
      desc: '紧急回档：疑心值降至当前心态区间下限（仅屈辱前有效）',
      unlockDesc: '阶段≥4',
    },
    {
      name: '神魂共鸣石',
      price: 50,
      type: '消耗品',
      desc: '神魂空间中使用，信任度提升（信任+5）',
      unlockDesc: '阶段≥2',
    },
    // ── 洛书晴专属消耗品（洛书晴线激活后显示，阶段1-2生效，阶段3+失效）──
    {
      name: '安抚符',
      price: 30,
      type: '消耗品',
      desc: '3轮·洛书晴敌意与戒备暂时软化，对{{user}}的反应不会那么激烈（仅洛书晴阶段1-2有效）',
      unlockDesc: '洛书晴线已激活，洛书晴阶段≤2',
    },
    {
      name: '真心符',
      price: 40,
      type: '消耗品',
      desc: '3轮·洛书晴更倾向直接表达内心想法，不再绕弯或回避（仅洛书晴阶段1-2有效）',
      unlockDesc: '洛书晴线已激活，洛书晴阶段≤2',
    },
  ],
  装备: [
    // 环境
    { name: '锚神钉', price: 40, type: '装备', desc: '云霜凝无法中断神魂连接（神魂空间专用）', unlockDesc: '' },
    { name: '影绰纱帘', price: 50, type: '装备', desc: '门外只能看到影子轮廓', unlockDesc: '阶段≥2' },
    { name: '透灵幔', price: 80, type: '装备', desc: '门外完全清晰可见，单向透视', unlockDesc: '阶段≥3' },
    { name: '隔音灵阵', price: 30, type: '装备', desc: '屏蔽人声，床榻震动声可传出', unlockDesc: '阶段≥2' },
    { name: '净灵铃', price: 60, type: '装备', desc: '摇铃召唤苗广照顾云霜凝，冷却10楼层', unlockDesc: '阶段≥2' },
    // 上装（Lv1-Lv5，各2件）
    { name: '素色道袍', price: 8, type: '装备', desc: '端正合身，几乎无暴露（分数1）', unlockDesc: '阶段≥3' },
    { name: '宽领道袍', price: 12, type: '装备', desc: '领口宽大，弯腰时春光乍泄（分数2）', unlockDesc: '阶段≥3' },
    { name: '轻纱罩衫', price: 18, type: '装备', desc: '薄如蝉翼，胸部轮廓若隐若现（分数3）', unlockDesc: '阶段≥4' },
    { name: '露肩薄衫', price: 25, type: '装备', desc: '双肩裸露，锁骨尽显（分数4）', unlockDesc: '阶段≥4' },
    { name: '交领短衫', price: 35, type: '装备', desc: '交领深开，腰腹裸露（分数5）', unlockDesc: '阶段≥5' },
    { name: '肚兜', price: 45, type: '装备', desc: '仅覆盖胸前，背部两侧全露（分数6）', unlockDesc: '阶段≥5' },
    { name: '绑带胸衣', price: 60, type: '装备', desc: '丝带交缠深V至脐，勉强遮挡（分数7）', unlockDesc: '阶段≥7' },
    { name: '镂空纱衣', price: 75, type: '装备', desc: '通体镂空，完全透视（分数8）', unlockDesc: '阶段≥7' },
    { name: '乳贴缎带', price: 90, type: '装备', desc: '缎带绕胸仅贴覆乳尖（分数9）', unlockDesc: '阶段≥9' },
    { name: '锁链胸饰', price: 110, type: '装备', desc: '细链挂身纯装饰无遮蔽（分数10）', unlockDesc: '阶段≥9' },
    // 下装（Lv1-Lv5，各2件）
    { name: '百褶长裙', price: 8, type: '装备', desc: '及踝长裙，端庄保守（分数1）', unlockDesc: '阶段≥3' },
    { name: '开叉长裙', price: 12, type: '装备', desc: '行走间大腿时隐时现（分数2）', unlockDesc: '阶段≥3' },
    { name: '灵纱短裙', price: 18, type: '装备', desc: '仅及大腿中部（分数3）', unlockDesc: '阶段≥4' },
    { name: '高开叉裙', price: 25, type: '装备', desc: '开叉至胯，坐姿即走光（分数4）', unlockDesc: '阶段≥4' },
    { name: '灵纱超短裙', price: 35, type: '装备', desc: '堪堪遮臀，弯腰即露（分数5）', unlockDesc: '阶段≥5' },
    { name: '腰链遮片', price: 45, type: '装备', desc: '细链系腰，前后各一小片薄纱（分数6）', unlockDesc: '阶段≥5' },
    { name: '系带围裙', price: 60, type: '装备', desc: '仅前面一片，两侧全开（分数7）', unlockDesc: '阶段≥7' },
    { name: '透纱长裙', price: 75, type: '装备', desc: '及踝但完全透明（分数8）', unlockDesc: '阶段≥7' },
    { name: '腰链吊坠', price: 90, type: '装备', desc: '细链悬垂流苏，遮若无遮（分数9）', unlockDesc: '阶段≥9' },
    { name: '灵纱飘带', price: 110, type: '装备', desc: '几缕飘带垂落，纯装饰（分数10）', unlockDesc: '阶段≥9' },
    // 内衣（Lv1-Lv5，各2件）
    { name: '丝绸抹胸', price: 8, type: '装备', desc: '贴身包裹，不透（分数1）', unlockDesc: '阶段≥3' },
    { name: '蕾丝胸衣', price: 12, type: '装备', desc: '花纹微透，精致撩人（分数2）', unlockDesc: '阶段≥3' },
    { name: '半杯胸衣', price: 18, type: '装备', desc: '仅托下半，上半外露（分数3）', unlockDesc: '阶段≥4' },
    { name: '情趣胸衣', price: 25, type: '装备', desc: '镂空设计，仅遮关键部位（分数4）', unlockDesc: '阶段≥4' },
    { name: '镂空胸衣', price: 35, type: '装备', desc: '大面积镂空，形同虚设（分数5）', unlockDesc: '阶段≥5' },
    { name: '乳贴', price: 45, type: '装备', desc: '仅覆盖乳尖（分数6）', unlockDesc: '阶段≥5' },
    { name: '透明胸纱', price: 60, type: '装备', desc: '透明薄纱缠绕，遮而不蔽（分数7）', unlockDesc: '阶段≥7' },
    { name: '链式乳饰', price: 75, type: '装备', desc: '细链连接两侧，纯装饰（分数8）', unlockDesc: '阶段≥7' },
    { name: '乳环吊链', price: 90, type: '装备', desc: '乳环上悬挂坠饰（分数9）', unlockDesc: '阶段≥9' },
    { name: '灵纹乳贴', price: 110, type: '装备', desc: '极小灵纹贴片，几乎不可见（分数10）', unlockDesc: '阶段≥9' },
    // 内裤（Lv1-Lv5，各2件）
    { name: '丝绸亵裤', price: 8, type: '装备', desc: '常规贴身裤（分数1）', unlockDesc: '阶段≥3' },
    { name: '蕾丝内裤', price: 12, type: '装备', desc: '精致微透（分数2）', unlockDesc: '阶段≥3' },
    { name: '蝴蝶结系带裤', price: 18, type: '装备', desc: '两侧系带，一拉即解（分数3）', unlockDesc: '阶段≥4' },
    { name: '丁字裤', price: 25, type: '装备', desc: '仅遮前部，臀部全露（分数4）', unlockDesc: '阶段≥4' },
    {
      name: '珍珠内裤',
      price: 35,
      type: '装备',
      desc: '珍珠串线贴合私处，行走时持续刺激（分数5）',
      unlockDesc: '阶段≥5',
    },
    { name: '开裆内裤', price: 45, type: '装备', desc: '关键部位敞开（分数6）', unlockDesc: '阶段≥5' },
    { name: '系带丁字裤', price: 60, type: '装备', desc: '极细带，随时脱落（分数7）', unlockDesc: '阶段≥7' },
    { name: '透明蕾丝裤', price: 75, type: '装备', desc: '完全透视（分数8）', unlockDesc: '阶段≥7' },
    { name: '链饰丁字裤', price: 90, type: '装备', desc: '金属链条贴身（分数9）', unlockDesc: '阶段≥9' },
    { name: '灵纹系带', price: 110, type: '装备', desc: '一根细绳，纯象征（分数10）', unlockDesc: '阶段≥9' },
    // 特殊配饰（Lv1-Lv5，各2件，分数偏高）
    { name: '脚链铃铛', price: 10, type: '装备', desc: '脚踝细链缀铃，行走时叮当作响（分数2）', unlockDesc: '阶段≥3' },
    { name: '红绳', price: 15, type: '装备', desc: '系于腰间贴身红绳（分数3）', unlockDesc: '阶段≥3' },
    { name: '大腿皮环', price: 22, type: '装备', desc: '扣于大腿根部的皮质环带（分数4）', unlockDesc: '阶段≥4' },
    {
      name: '乳环挂饰',
      price: 30,
      type: '装备',
      desc: '乳环上悬挂小瓶，装着{{user}}的体液（分数5）',
      unlockDesc: '阶段≥4',
    },
    {
      name: '精液项链',
      price: 40,
      type: '装备',
      desc: '颈间挂小瓶，装着{{user}}的精液（分数6）',
      unlockDesc: '阶段≥5',
    },
    {
      name: '阴蒂夹坠',
      price: 50,
      type: '装备',
      desc: '夹于阴蒂的坠饰，行走时持续刺激（分数7）',
      unlockDesc: '阶段≥5',
    },
    { name: '名字阴环', price: 65, type: '装备', desc: '阴蒂环内圈刻着{{user}}的名字（分数8）', unlockDesc: '阶段≥7' },
    { name: '精液耳坠', price: 85, type: '装备', desc: '耳垂悬挂的微型精液封存坠（分数9）', unlockDesc: '阶段≥7' },
    {
      name: '子宫纹章',
      price: 100,
      type: '装备',
      desc: '小腹金属纹章，刻{{user}}所有权印（分数10）',
      unlockDesc: '阶段≥9',
    },
    {
      name: '双穴珠链',
      price: 120,
      type: '装备',
      desc: '前后穴各含珠串以腰链相连，持续填充（分数11）',
      unlockDesc: '阶段≥9',
    },
    // 身体器具
    {
      name: '眼罩',
      price: 45,
      type: '装备',
      desc: '视觉剥夺，全部位开发+3/轮',
      unlockDesc: '阶段≥3，防线≤70，信任≥15',
    },
    {
      name: '乳夹',
      price: 50,
      type: '装备',
      desc: '乳尖持续夹持，胸部开发加速+5/轮',
      unlockDesc: '防线≤65，胸部≥40，信任≥25',
    },
    {
      name: '口枷',
      price: 55,
      type: '装备',
      desc: '口腔被撑开，小嘴开发+5/轮',
      unlockDesc: '防线≤65，小嘴≥40，信任≥25',
    },
    {
      name: '肛塞',
      price: 60,
      type: '装备',
      desc: '持续填充感，屁穴开发加速+5/轮',
      unlockDesc: '防线≤60，屁穴≥40，信任≥20',
    },
    { name: '缚灵缎', price: 70, type: '装备', desc: '姿态固定/束缚，无法自主移动', unlockDesc: '防线≤60，信任≥30' },
    {
      name: '震动器',
      price: 80,
      type: '装备',
      desc: '持续振动，小屄开发+5/轮，防线-2/轮',
      unlockDesc: '防线≤50，小屄≥50，信任≥35',
    },
    { name: '项圈', price: 90, type: '装备', desc: '象征支配与从属关系', unlockDesc: '防线≤20，信任≥60' },
    {
      name: '肉棒口罩',
      price: 350,
      type: '装备',
      desc: '外观面纱，内侧持续填充口腔',
      unlockDesc: '阶段≥5，小嘴开发≥40',
    },
    // 环境类
    { name: '暖玉佩', price: 10, type: '装备', desc: '信任度每轮+1', unlockDesc: '' },
  ],
  体改: [
    { name: '丰胸灵乳丹·中', price: 150, type: '体改', desc: '胸部改造→E罩杯', unlockDesc: '阶段≥3，胸部开发≥30' },
    { name: '丰胸灵乳丹·大', price: 250, type: '体改', desc: '胸部改造→G罩杯', unlockDesc: '阶段≥4，胸部开发≥50' },
    { name: '丰胸灵乳丹·极', price: 400, type: '体改', desc: '胸部改造→H罩杯', unlockDesc: '阶段≥6，胸部开发≥70' },
    { name: '丰臀圆玉丹', price: 200, type: '体改', desc: '臀部丰满化', unlockDesc: '阶段≥3，屁穴开发≥30' },
    { name: '乳环', price: 300, type: '体改', desc: '胸部敏感度永久提升', unlockDesc: '阶段≥4，胸部开发≥40' },
    { name: '阴环', price: 300, type: '体改', desc: '小屄敏感度永久提升', unlockDesc: '阶段≥4，小屄开发≥40' },
    {
      name: '淫纹刻印',
      price: 250,
      type: '体改',
      desc: '位置可选（腰腹/胸前/大腿内侧/臀部）',
      unlockDesc: '阶段≥4，防线≤50',
    },
  ],
  性癖: [
    { name: '阿黑颜体质', price: 300, type: '性癖', desc: '高潮时表情崩坏', unlockDesc: '阶段≥3，防线≤50' },
    { name: '潮喷体质', price: 400, type: '性癖', desc: '高强度刺激触发喷液', unlockDesc: '阶段≥4，小屄开发≥60' },
    { name: '母乳体质', price: 350, type: '性癖', desc: '胸部受刺激时分泌灵乳', unlockDesc: '阶段≥4，胸部开发≥50' },
    { name: '露出嗜好', price: 300, type: '性癖', desc: '被看到风险中兴奋加倍', unlockDesc: '阶段≥3，防线≤50' },
    {
      name: '寝取快感',
      price: 500,
      type: '性癖',
      desc: '苗广在场时兴奋翻倍',
      unlockDesc: '阶段≥5，防线≤30，苗广心态≥察觉',
    },
    { name: '哦齁齁体质', price: 500, type: '性癖', desc: '叙事切换为淫媚肉欲文言体', unlockDesc: '阶段≥5，防线≤20' },
    { name: '骚话淫语', price: 300, type: '性癖', desc: '日常不自觉脱口淫秽词汇', unlockDesc: '阶段≥4，防线≤40' },
    {
      name: '隐奸行为',
      price: 400,
      type: '性癖',
      desc: '第三人在场时主动暗示偷欢',
      unlockDesc: '阶段≥4，防线≤40，苗广≥疑惑',
    },
    {
      name: '尿饮嗜好',
      price: 350,
      type: '性癖',
      desc: '对{{user}}尿液产生渴望',
      unlockDesc: '阶段≥5，防线≤20，小嘴≥40',
    },
    { name: '母爱泛滥', price: 300, type: '性癖', desc: '以母亲姿态主动哺育引导', unlockDesc: '阶段≥4，防线≤30' },
    { name: '舔肛嗜好', price: 350, type: '性癖', desc: '对舔肛行为产生渴望', unlockDesc: '阶段≥4，屁穴≥40，防线≤40' },
    { name: '受虐嗜好', price: 350, type: '性癖', desc: '被粗暴对待时产生快感', unlockDesc: '阶段≥4，防线≤40' },
    { name: '精液标记', price: 300, type: '性癖', desc: '渴望被精液沾满身体', unlockDesc: '阶段≥4，防线≤30' },
    {
      name: '口奴体质',
      price: 350,
      type: '性癖',
      desc: '口交依赖，嘴空时感到空虚',
      unlockDesc: '阶段≥4，小嘴≥50，防线≤30',
    },
    {
      name: '肛交嗜好',
      price: 350,
      type: '性癖',
      desc: '对肛交产生快感和渴望',
      unlockDesc: '阶段≥4，屁穴≥50，防线≤40',
    },
    { name: '物化认知', price: 500, type: '性癖', desc: '将自己视为所有物/道具', unlockDesc: '阶段≥6，防线≤15' },
    { name: '痴女化', price: 400, type: '性癖', desc: '从被动转为主动进攻', unlockDesc: '阶段≥5，防线≤25' },
    { name: '身体书写', price: 300, type: '性癖', desc: '渴望被在身上写标记文字', unlockDesc: '阶段≥4，防线≤30' },
    { name: '窒息快感', price: 400, type: '性癖', desc: '呼吸受限时快感倍增', unlockDesc: '阶段≥5，防线≤30' },
    { name: '精液面膜', price: 300, type: '性癖', desc: '渴望颜射，满足陶醉', unlockDesc: '阶段≥4，防线≤30' },
  ],
  场景: [
    { name: '镜前调教', price: 400, type: '特殊场景', desc: '6阶段·面对镜子观察自己', unlockDesc: '阶段≥4，防线≤50' },
    {
      name: '夫前凌辱',
      price: 600,
      type: '特殊场景',
      desc: '6阶段·苗广亲眼目睹一切',
      unlockDesc: '阶段≥5，苗广≥屈辱，需装备影绰纱帘/透灵幔',
    },
    {
      name: '寝取宣告',
      price: 800,
      type: '特殊场景',
      desc: '5阶段·当面宣告占有',
      unlockDesc: '阶段≥7，苗广≥默许，需装备透灵幔',
    },
    {
      name: '绿帽奴调教',
      price: 900,
      type: '特殊场景',
      desc: '6阶段·苗广被进一步调教',
      unlockDesc: '阶段≥8，苗广=沉溺',
    },
    {
      name: '掌门改嫁',
      price: 1000,
      type: '特殊场景',
      desc: '6阶段·苗广主持改嫁',
      unlockDesc: '阶段≥8，千晶幻术完成，苗广=沉溺',
    },
    // ── 联动场景（洛书晴线已激活后） ──
    {
      name: '婆媳教导',
      price: 500,
      type: '特殊场景',
      desc: '5阶段·云霜凝向洛书晴"传授"如何服侍夫君',
      unlockDesc: '洛书晴线已激活，洛≥3，云≥4',
    },
    {
      name: '两人同侍',
      price: 700,
      type: '特殊场景',
      desc: '6阶段·师徒并列侍奉同一人',
      unlockDesc: '洛书晴线已激活，洛≥5，云≥6，需先完成婆媳教导',
    },
    {
      name: '寝取宣告增强',
      price: 900,
      type: '特殊场景',
      desc: '10阶段·洛书晴见证并参与宣告（增强版寝取宣告）',
      unlockDesc: '洛书晴线已激活，洛≥6，云≥7，需先完成两人同侍',
    },
    {
      name: '门缝春光',
      price: 900,
      type: '特殊场景',
      desc: '10阶段·苗广门外偷窥，洛书晴心机萌芽',
      unlockDesc: '洛书晴线已激活，洛≥7，云≥7，苗广≥屈辱，需先完成寝取宣告增强',
    },
    {
      name: '双重目击',
      price: 1000,
      type: '特殊场景',
      desc: '10阶段·苗喧目睹父亲偷窥与门内画面',
      unlockDesc: '洛书晴线已激活，洛≥8，云≥8，苗广≥屈辱，需先完成门缝春光',
    },
    {
      name: '儿媳调教公公',
      price: 1100,
      type: '特殊场景',
      desc: '12阶段·洛书晴主导调教苗广（增强版绿帽奴调教）',
      unlockDesc: '洛书晴线已激活，洛≥8，云≥8，苗广=沉溺，需先完成双重目击',
    },
    {
      name: '双重改嫁',
      price: 1500,
      type: '特殊场景',
      desc: '15阶段·终局·云霜凝改嫁同时洛书晴解除婚约',
      unlockDesc: '洛书晴线已激活，洛≥9，云≥10，千晶幻术完成，苗广=沉溺，需先完成儿媳调教公公',
    },
  ],
};

const categories = [
  { id: '消耗品', label: '消耗品' },
  { id: '装备', label: '装备' },
  { id: '体改', label: '体改' },
  { id: '性癖', label: '性癖' },
  { id: '场景', label: '特殊场景' },
];

const active_cat = useLocalStorage<string>('云霜凝:shop:cat', '消耗品');
const current_items = computed(() => {
  const items = ALL_ITEMS[active_cat.value] ?? [];
  if (active_cat.value === '场景') {
    return items.filter(i => !HIDDEN_SCENES.has(i.name));
  }
  return items;
});

// ── 装备分组 ──
type GroupedEntry = { type: 'header'; label: string } | { type: 'item'; item: ItemDef; group?: string };
const EQUIP_GROUPS: { label: string; names: Set<string> }[] = [
  { label: '环境', names: new Set(['锚神钉', '影绰纱帘', '透灵幔', '隔音灵阵', '净灵铃', '暖玉佩']) },
  {
    label: '上装',
    names: new Set([
      '素色道袍',
      '宽领道袍',
      '轻纱罩衫',
      '露肩薄衫',
      '交领短衫',
      '肚兜',
      '绑带胸衣',
      '镂空纱衣',
      '乳贴缎带',
      '锁链胸饰',
    ]),
  },
  {
    label: '下装',
    names: new Set([
      '百褶长裙',
      '开叉长裙',
      '灵纱短裙',
      '高开叉裙',
      '灵纱超短裙',
      '腰链遮片',
      '系带围裙',
      '透纱长裙',
      '腰链吊坠',
      '灵纱飘带',
    ]),
  },
  {
    label: '内衣',
    names: new Set([
      '丝绸抹胸',
      '蕾丝胸衣',
      '半杯胸衣',
      '情趣胸衣',
      '镂空胸衣',
      '乳贴',
      '透明胸纱',
      '链式乳饰',
      '乳环吊链',
      '灵纹乳贴',
    ]),
  },
  {
    label: '内裤',
    names: new Set([
      '丝绸亵裤',
      '蕾丝内裤',
      '蝴蝶结系带裤',
      '丁字裤',
      '珍珠内裤',
      '开裆内裤',
      '系带丁字裤',
      '透明蕾丝裤',
      '链饰丁字裤',
      '灵纹系带',
    ]),
  },
  {
    label: '特殊配饰',
    names: new Set([
      '脚链铃铛',
      '红绳',
      '大腿皮环',
      '乳环挂饰',
      '精液项链',
      '阴蒂夹坠',
      '名字阴环',
      '精液耳坠',
      '子宫纹章',
      '双穴珠链',
    ]),
  },
  { label: '身体器具', names: new Set(['眼罩', '乳夹', '口枷', '肛塞', '缚灵缎', '震动器', '项圈', '肉棒口罩']) },
];
// 配对场景：点击原版时弹 dialog 让玩家选"单独进行 / 洛书晴参与"
const SCENE_PAIRS: Record<string, string> = {
  寝取宣告: '寝取宣告增强',
  绿帽奴调教: '儿媳调教公公',
  掌门改嫁: '双重改嫁',
};
// 从商店列表中隐藏的场景（仅作为 dialog 里的"洛书晴参与"选项存在）
const HIDDEN_SCENES = new Set(['寝取宣告增强', '儿媳调教公公', '双重改嫁']);
// ── 可折叠分组 ──
const collapsedGroups = reactive(new Set<string>());

function toggleGroup(label: string) {
  if (collapsedGroups.has(label)) collapsedGroups.delete(label);
  else collapsedGroups.add(label);
}

function getGroupCount(label: string): number {
  const group = EQUIP_GROUPS.find(g => g.label === label);
  if (!group) return 0;
  return current_items.value.filter(i => group.names.has(i.name)).length;
}

const grouped_items = computed((): GroupedEntry[] => {
  if (active_cat.value !== '装备') return current_items.value.map(item => ({ type: 'item' as const, item }));
  const result: GroupedEntry[] = [];
  for (const group of EQUIP_GROUPS) {
    const items = current_items.value.filter(i => group.names.has(i.name));
    if (items.length > 0) {
      result.push({ type: 'header', label: group.label });
      items.forEach(item => result.push({ type: 'item', item, group: group.label }));
    }
  }
  return result;
});

// ── 解锁条件检查 ──────────────────────────────────────────

function isUnlocked(item: ItemDef): boolean {
  const d = store.data;
  const name = item.name;

  const conds: Record<string, () => boolean> = {
    // 消耗品
    安神香: () => true,
    蚀心露: () => d.治疗.阶段 >= 3,
    定心符: () => d.治疗.阶段 >= 2,
    混沌珠: () => d.治疗.阶段 >= 4,
    神魂共鸣石: () => d.治疗.阶段 >= 2,
    // 洛书晴专属消耗品：线已激活且洛书晴阶段≤2（阶段3+失效）
    安抚符: () => !!d._洛书晴线已激活 && d.洛书晴.调教阶段 <= 2,
    真心符: () => !!d._洛书晴线已激活 && d.洛书晴.调教阶段 <= 2,
    // 装备：环境
    锚神钉: () => true,
    影绰纱帘: () => d.治疗.阶段 >= 2,
    透灵幔: () => d.治疗.阶段 >= 3,
    隔音灵阵: () => d.治疗.阶段 >= 2,
    净灵铃: () => d.治疗.阶段 >= 2,
    // 装备：服装（Lv1=阶段3, Lv2=阶段4, Lv3=阶段5, Lv4=阶段7, Lv5=阶段9）
    // 上装
    素色道袍: () => d.治疗.阶段 >= 3,
    宽领道袍: () => d.治疗.阶段 >= 3,
    轻纱罩衫: () => d.治疗.阶段 >= 4,
    露肩薄衫: () => d.治疗.阶段 >= 4,
    交领短衫: () => d.治疗.阶段 >= 5,
    肚兜: () => d.治疗.阶段 >= 5,
    绑带胸衣: () => d.治疗.阶段 >= 7,
    镂空纱衣: () => d.治疗.阶段 >= 7,
    乳贴缎带: () => d.治疗.阶段 >= 9,
    锁链胸饰: () => d.治疗.阶段 >= 9,
    // 下装
    百褶长裙: () => d.治疗.阶段 >= 3,
    开叉长裙: () => d.治疗.阶段 >= 3,
    灵纱短裙: () => d.治疗.阶段 >= 4,
    高开叉裙: () => d.治疗.阶段 >= 4,
    灵纱超短裙: () => d.治疗.阶段 >= 5,
    腰链遮片: () => d.治疗.阶段 >= 5,
    系带围裙: () => d.治疗.阶段 >= 7,
    透纱长裙: () => d.治疗.阶段 >= 7,
    腰链吊坠: () => d.治疗.阶段 >= 9,
    灵纱飘带: () => d.治疗.阶段 >= 9,
    // 内衣
    丝绸抹胸: () => d.治疗.阶段 >= 3,
    蕾丝胸衣: () => d.治疗.阶段 >= 3,
    半杯胸衣: () => d.治疗.阶段 >= 4,
    情趣胸衣: () => d.治疗.阶段 >= 4,
    镂空胸衣: () => d.治疗.阶段 >= 5,
    乳贴: () => d.治疗.阶段 >= 5,
    透明胸纱: () => d.治疗.阶段 >= 7,
    链式乳饰: () => d.治疗.阶段 >= 7,
    乳环吊链: () => d.治疗.阶段 >= 9,
    灵纹乳贴: () => d.治疗.阶段 >= 9,
    // 内裤
    丝绸亵裤: () => d.治疗.阶段 >= 3,
    蕾丝内裤: () => d.治疗.阶段 >= 3,
    蝴蝶结系带裤: () => d.治疗.阶段 >= 4,
    丁字裤: () => d.治疗.阶段 >= 4,
    珍珠内裤: () => d.治疗.阶段 >= 5,
    开裆内裤: () => d.治疗.阶段 >= 5,
    系带丁字裤: () => d.治疗.阶段 >= 7,
    透明蕾丝裤: () => d.治疗.阶段 >= 7,
    链饰丁字裤: () => d.治疗.阶段 >= 9,
    灵纹系带: () => d.治疗.阶段 >= 9,
    // 特殊配饰（跟随对应等级）
    脚链铃铛: () => d.治疗.阶段 >= 3,
    红绳: () => d.治疗.阶段 >= 3,
    大腿皮环: () => d.治疗.阶段 >= 4,
    乳环挂饰: () => d.治疗.阶段 >= 4,
    精液项链: () => d.治疗.阶段 >= 5,
    阴蒂夹坠: () => d.治疗.阶段 >= 5,
    名字阴环: () => d.治疗.阶段 >= 7,
    精液耳坠: () => d.治疗.阶段 >= 7,
    子宫纹章: () => d.治疗.阶段 >= 9,
    双穴珠链: () => d.治疗.阶段 >= 9,
    // 装备：身体器具
    眼罩: () => d.治疗.阶段 >= 3 && d.云霜凝.心理防线 <= 70 && d.云霜凝.信任度 >= 15,
    乳夹: () => d.云霜凝.心理防线 <= 65 && d.云霜凝.身体开发.胸部 >= 40 && d.云霜凝.信任度 >= 25,
    口枷: () => d.云霜凝.心理防线 <= 65 && d.云霜凝.身体开发.小嘴 >= 40 && d.云霜凝.信任度 >= 25,
    肛塞: () => d.云霜凝.心理防线 <= 60 && d.云霜凝.身体开发.屁穴 >= 40 && d.云霜凝.信任度 >= 20,
    缚灵缎: () => d.云霜凝.心理防线 <= 60 && d.云霜凝.信任度 >= 30,
    震动器: () => d.云霜凝.心理防线 <= 50 && d.云霜凝.身体开发.小屄 >= 50 && d.云霜凝.信任度 >= 35,
    项圈: () => d.云霜凝.心理防线 <= 20 && d.云霜凝.信任度 >= 60,
    // 装备：辅助灵物
    暖玉佩: () => true,
    // 永久体改
    '丰胸灵乳丹·中': () => d.治疗.阶段 >= 3 && d.云霜凝.身体开发.胸部 >= 30,
    '丰胸灵乳丹·大': () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.胸部 >= 50,
    '丰胸灵乳丹·极': () => d.治疗.阶段 >= 6 && d.云霜凝.身体开发.胸部 >= 70,
    丰臀圆玉丹: () => d.治疗.阶段 >= 3 && d.云霜凝.身体开发.屁穴 >= 30,
    乳环: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.胸部 >= 40,
    阴环: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.小屄 >= 40,
    淫纹刻印: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 50,
    肉棒口罩: () => d.治疗.阶段 >= 5 && d.云霜凝.身体开发.小嘴 >= 40,
    // 永久性癖（设计文档第八节最终20个）
    阿黑颜体质: () => d.治疗.阶段 >= 3 && d.云霜凝.心理防线 <= 50,
    潮喷体质: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.小屄 >= 60,
    母乳体质: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.胸部 >= 50,
    露出嗜好: () => d.治疗.阶段 >= 3 && d.云霜凝.心理防线 <= 50,
    寝取快感: () =>
      d.治疗.阶段 >= 5 && d.云霜凝.心理防线 <= 30 && ['察觉', '屈辱', '默许', '沉溺'].includes(d.苗广.心态),
    哦齁齁体质: () => d.治疗.阶段 >= 5 && d.云霜凝.心理防线 <= 20,
    骚话淫语: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 40,
    隐奸行为: () =>
      d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 40 && ['疑惑', '察觉', '屈辱', '默许', '沉溺'].includes(d.苗广.心态),
    尿饮嗜好: () => d.治疗.阶段 >= 5 && d.云霜凝.心理防线 <= 20 && d.云霜凝.身体开发.小嘴 >= 40,
    母爱泛滥: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 30,
    舔肛嗜好: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.屁穴 >= 40 && d.云霜凝.心理防线 <= 40,
    受虐嗜好: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 40,
    精液标记: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 30,
    口奴体质: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.小嘴 >= 50 && d.云霜凝.心理防线 <= 30,
    肛交嗜好: () => d.治疗.阶段 >= 4 && d.云霜凝.身体开发.屁穴 >= 50 && d.云霜凝.心理防线 <= 40,
    物化认知: () => d.治疗.阶段 >= 6 && d.云霜凝.心理防线 <= 15,
    痴女化: () => d.治疗.阶段 >= 5 && d.云霜凝.心理防线 <= 25,
    身体书写: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 30,
    窒息快感: () => d.治疗.阶段 >= 5 && d.云霜凝.心理防线 <= 30,
    精液面膜: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 30,
    // 特殊场景
    镜前调教: () => d.治疗.阶段 >= 4 && d.云霜凝.心理防线 <= 50,
    夫前凌辱: () =>
      d.治疗.阶段 >= 5 &&
      ['屈辱', '默许', '沉溺'].includes(d.苗广.心态) &&
      (d.系统.道具状态['影绰纱帘'] === '使用中' || d.系统.道具状态['透灵幔'] === '使用中'),
    寝取宣告: () =>
      d.治疗.阶段 >= 7 &&
      ['默许', '沉溺'].includes(d.苗广.心态) &&
      d.系统.道具状态['透灵幔'] === '使用中' &&
      !!d._已完成特殊场景['夫前凌辱'],
    绿帽奴调教: () =>
      d.治疗.阶段 >= 7 && d.苗广.心态 === '沉溺' && !!d._已完成特殊场景['寝取宣告'] && !d.苗广.千晶幻术.认知改写完成,
    掌门改嫁: () => d.治疗.阶段 >= 8 && d.苗广.心态 === '沉溺' && d.苗广.千晶幻术.认知改写完成,
    // ── 联动场景（洛书晴线已激活后） ──
    婆媳教导: () => !!d._洛书晴线已激活 && d.洛书晴.调教阶段 >= 3 && d.治疗.阶段 >= 4,
    两人同侍: () =>
      !!d._洛书晴线已激活 && d.洛书晴.调教阶段 >= 5 && d.治疗.阶段 >= 6 && !!d._已完成特殊场景['婆媳教导'],
    寝取宣告增强: () =>
      !!d._洛书晴线已激活 &&
      d.洛书晴.调教阶段 >= 6 &&
      d.治疗.阶段 >= 7 &&
      d.系统.道具状态['透灵幔'] === '使用中' &&
      ['默许', '沉溺'].includes(d.苗广.心态) &&
      !!d._已完成特殊场景['两人同侍'],
    门缝春光: () =>
      !!d._洛书晴线已激活 &&
      d.洛书晴.调教阶段 >= 7 &&
      d.治疗.阶段 >= 7 &&
      ['屈辱', '默许', '沉溺'].includes(d.苗广.心态) &&
      !!d._已完成特殊场景['寝取宣告增强'],
    双重目击: () =>
      !!d._洛书晴线已激活 &&
      d.洛书晴.调教阶段 >= 8 &&
      d.治疗.阶段 >= 8 &&
      ['屈辱', '默许', '沉溺'].includes(d.苗广.心态) &&
      !!d._已完成特殊场景['门缝春光'],
    儿媳调教公公: () =>
      !!d._洛书晴线已激活 &&
      d.洛书晴.调教阶段 >= 8 &&
      d.治疗.阶段 >= 8 &&
      d.苗广.心态 === '沉溺' &&
      !!d._已完成特殊场景['双重目击'],
    双重改嫁: () =>
      !!d._洛书晴线已激活 &&
      d.洛书晴.调教阶段 >= 9 &&
      d.治疗.阶段 >= 10 &&
      d.苗广.心态 === '沉溺' &&
      d.苗广.千晶幻术.认知改写完成 &&
      !!d._已完成特殊场景['儿媳调教公公'],
  };

  return conds[name] ? conds[name]() : true;
}

// ── 消耗品名单（前端不再直接执行效果，统一由后端 processNewlyActivatedItems 处理） ──
const CONSUMABLE_NAMES = new Set(['安神香', '蚀心露', '定心符', '混沌珠', '神魂共鸣石']);

/** 当前楼层（聊天消息数） */
function getCurrentFloor(): number {
  return (window as any).SillyTavern?.chat?.length ?? 0;
}

/** 查询消耗品冷却状态 */
function getCooldown(name: string): { inCooldown: boolean; remainingFloors: number } {
  return getConsumableCooldownInfo(name, store.data as any, getCurrentFloor());
}

/** 查询道具是否可在当前状态下激活（冷却 + 神魂空间） */
function checkActivate(name: string): { allowed: boolean; reason: string } {
  return canActivateItem(name, store.data as any, getCurrentFloor());
}

// 性癖道具（设计文档第八节最终20个）
const KINK_EFFECTS: Record<string, { name: string; tag: string }> = {
  阿黑颜体质: { name: '阿黑颜体质', tag: '高潮时面部失控——翻白眼、舌外伸、涎液溢出' },
  潮喷体质: { name: '潮喷体质', tag: '高强度刺激时阴道喷液' },
  母乳体质: { name: '母乳体质', tag: '胸部受刺激时分泌灵乳' },
  露出嗜好: { name: '露出嗜好', tag: '有被看到风险时兴奋加倍' },
  寝取快感: { name: '寝取快感', tag: '苗广在场时兴奋翻倍' },
  哦齁齁体质: { name: '哦齁齁体质', tag: '叙事切换为淫媚肉欲文言体' },
  骚话淫语: { name: '骚话淫语', tag: '日常不自觉脱口淫秽词汇' },
  隐奸行为: { name: '隐奸行为', tag: '第三人在场时主动暗示偷欢' },
  尿饮嗜好: { name: '尿饮嗜好', tag: '对{{user}}尿液产生渴望' },
  母爱泛滥: { name: '母爱泛滥', tag: '以母亲姿态主动哺育引导' },
  舔肛嗜好: { name: '舔肛嗜好', tag: '对舔肛行为产生渴望' },
  受虐嗜好: { name: '受虐嗜好', tag: '被粗暴对待时产生快感' },
  精液标记: { name: '精液标记', tag: '渴望被精液沾满身体' },
  口奴体质: { name: '口奴体质', tag: '口交依赖，嘴空时感到空虚' },
  肛交嗜好: { name: '肛交嗜好', tag: '对肛交产生快感和渴望' },
  物化认知: { name: '物化认知', tag: '将自己视为所有物/道具' },
  痴女化: { name: '痴女化', tag: '从被动转为主动进攻' },
  身体书写: { name: '身体书写', tag: '渴望被在身上写标记文字' },
  窒息快感: { name: '窒息快感', tag: '呼吸受限时快感倍增' },
  精液面膜: { name: '精液面膜', tag: '渴望颜射，满足陶醉' },
};

const MAX_KINKS = 3;
function activeKinkCount(): number {
  // 只统计商店性癖，特殊场景奖励（镜前记忆、改嫁认知等）不占槽位
  return Object.keys(store.data.云霜凝.性癖列表).filter(k => k in KINK_EFFECTS).length;
}

// 体改道具
const BODY_MOD_EFFECTS: Record<string, () => void> = {
  '丰胸灵乳丹·中': () => {
    store.data.云霜凝.肉体改造.胸部 = 'E罩杯';
  },
  '丰胸灵乳丹·大': () => {
    store.data.云霜凝.肉体改造.胸部 = 'G罩杯';
  },
  '丰胸灵乳丹·极': () => {
    store.data.云霜凝.肉体改造.胸部 = 'H罩杯';
  },
  丰臀圆玉丹: () => {
    store.data.云霜凝.肉体改造.臀部 = '丰满';
  },
  乳环: () => {
    store.data.云霜凝.肉体改造.乳环 = true;
  },
  阴环: () => {
    store.data.云霜凝.肉体改造.阴环 = true;
  },
};

// 特殊场景轮数
const SCENE_TURNS: Record<string, number> = {
  镜前调教: 6,
  夫前凌辱: 7,
  寝取宣告: 6,
  绿帽奴调教: 8,
  掌门改嫁: 10,
  // 联动场景
  婆媳教导: 5,
  两人同侍: 6,
  寝取宣告增强: 10,
  门缝春光: 10,
  双重目击: 10,
  儿媳调教公公: 12,
  双重改嫁: 15,
  千晶告知洛书晴: 4,
};

// ── 服装→槽位映射 ──
type MainClothingSlot = '上装' | '下装' | '内衣' | '内裤';
type AccessorySubSlot = '脚踝' | '颈部' | '耳部' | '腰部' | '大腿' | '胸部' | '阴蒂' | '前后穴';
type ClothingSlot = MainClothingSlot | '特殊配饰';
const ACCESSORY_SUB_SLOT: Record<string, AccessorySubSlot> = {
  脚链铃铛: '脚踝',
  精液项链: '颈部',
  精液耳坠: '耳部',
  红绳: '腰部',
  子宫纹章: '腰部',
  大腿皮环: '大腿',
  乳环挂饰: '胸部',
  阴蒂夹坠: '阴蒂',
  名字阴环: '阴蒂',
  双穴珠链: '前后穴',
};
const CLOTHING_SLOT: Record<string, ClothingSlot> = {
  素色道袍: '上装',
  宽领道袍: '上装',
  轻纱罩衫: '上装',
  露肩薄衫: '上装',
  交领短衫: '上装',
  肚兜: '上装',
  绑带胸衣: '上装',
  镂空纱衣: '上装',
  乳贴缎带: '上装',
  锁链胸饰: '上装',
  百褶长裙: '下装',
  开叉长裙: '下装',
  灵纱短裙: '下装',
  高开叉裙: '下装',
  灵纱超短裙: '下装',
  腰链遮片: '下装',
  系带围裙: '下装',
  透纱长裙: '下装',
  腰链吊坠: '下装',
  灵纱飘带: '下装',
  丝绸抹胸: '内衣',
  蕾丝胸衣: '内衣',
  半杯胸衣: '内衣',
  情趣胸衣: '内衣',
  镂空胸衣: '内衣',
  乳贴: '内衣',
  透明胸纱: '内衣',
  链式乳饰: '内衣',
  乳环吊链: '内衣',
  灵纹乳贴: '内衣',
  丝绸亵裤: '内裤',
  蕾丝内裤: '内裤',
  蝴蝶结系带裤: '内裤',
  丁字裤: '内裤',
  珍珠内裤: '内裤',
  开裆内裤: '内裤',
  系带丁字裤: '内裤',
  透明蕾丝裤: '内裤',
  链饰丁字裤: '内裤',
  灵纹系带: '内裤',
  脚链铃铛: '特殊配饰',
  红绳: '特殊配饰',
  大腿皮环: '特殊配饰',
  乳环挂饰: '特殊配饰',
  精液项链: '特殊配饰',
  阴蒂夹坠: '特殊配饰',
  名字阴环: '特殊配饰',
  精液耳坠: '特殊配饰',
  子宫纹章: '特殊配饰',
  双穴珠链: '特殊配饰',
};
const CLOTHING_NAMES = new Set(Object.keys(CLOTHING_SLOT));

// 共用道具（洛书晴激活后可选择作用目标）
const EQUIPMENT_NAMES = new Set(['眼罩', '乳夹', '口枷', '肛塞', '缚灵缎', '震动器', '项圈', '肉棒口罩', '锚神钉']);
const LUO_CONSUMABLES = new Set(['安抚符', '真心符', '神魂共鸣石', '安神香']);
function isSharedItem(name: string): boolean {
  if (CLOTHING_NAMES.has(name)) return true;
  if (EQUIPMENT_NAMES.has(name)) return true;
  if (KINK_EFFECTS[name]) return true;
  if (BODY_MOD_EFFECTS[name]) return true;
  if (name === '淫纹刻印') return true;
  if (LUO_CONSUMABLES.has(name)) return true;
  return false;
}

const SLOT_DEFAULTS: Record<MainClothingSlot, string> = {
  上装: '寒霜门道袍',
  下装: '寒霜门长裙',
  内衣: '素白抹胸',
  内裤: '素白亵裤',
};

const CLOTHING_SCORE: Record<string, number> = {
  素色道袍: 1,
  宽领道袍: 2,
  轻纱罩衫: 3,
  露肩薄衫: 4,
  交领短衫: 5,
  肚兜: 6,
  绑带胸衣: 7,
  镂空纱衣: 8,
  乳贴缎带: 9,
  锁链胸饰: 10,
  百褶长裙: 1,
  开叉长裙: 2,
  灵纱短裙: 3,
  高开叉裙: 4,
  灵纱超短裙: 5,
  腰链遮片: 6,
  系带围裙: 7,
  透纱长裙: 8,
  腰链吊坠: 9,
  灵纱飘带: 10,
  丝绸抹胸: 1,
  蕾丝胸衣: 2,
  半杯胸衣: 3,
  情趣胸衣: 4,
  镂空胸衣: 5,
  乳贴: 6,
  透明胸纱: 7,
  链式乳饰: 8,
  乳环吊链: 9,
  灵纹乳贴: 10,
  丝绸亵裤: 1,
  蕾丝内裤: 2,
  蝴蝶结系带裤: 3,
  丁字裤: 4,
  珍珠内裤: 5,
  开裆内裤: 6,
  系带丁字裤: 7,
  透明蕾丝裤: 8,
  链饰丁字裤: 9,
  灵纹系带: 10,
  脚链铃铛: 2,
  红绳: 3,
  大腿皮环: 4,
  乳环挂饰: 5,
  精液项链: 6,
  阴蒂夹坠: 7,
  名字阴环: 8,
  精液耳坠: 9,
  子宫纹章: 10,
  双穴珠链: 11,
};

const EXPOSURE_THRESHOLDS: [number, string][] = [
  [38, '极露'],
  [29, '大露'],
  [20, '半露'],
  [11, '轻露'],
  [1, '微露'],
];

function recalcExposure() {
  const s = store.data.云霜凝.服装;
  const pei = s.特殊配饰;
  const total =
    (CLOTHING_SCORE[s.上装] ?? 0) +
    (CLOTHING_SCORE[s.下装] ?? 0) +
    (CLOTHING_SCORE[s.内衣] ?? 0) +
    (CLOTHING_SCORE[s.内裤] ?? 0) +
    (CLOTHING_SCORE[pei.脚踝] ?? 0) +
    (CLOTHING_SCORE[pei.颈部] ?? 0) +
    (CLOTHING_SCORE[pei.耳部] ?? 0) +
    (CLOTHING_SCORE[pei.腰部] ?? 0) +
    (CLOTHING_SCORE[pei.大腿] ?? 0) +
    (CLOTHING_SCORE[pei.胸部] ?? 0) +
    (CLOTHING_SCORE[pei.阴蒂] ?? 0) +
    (CLOTHING_SCORE[pei.前后穴] ?? 0);
  if (total === 0) {
    s.暴露程度 = '遮蔽';
    return;
  }
  for (const [threshold, level] of EXPOSURE_THRESHOLDS) {
    if (total >= threshold) {
      s.暴露程度 = level as typeof s.暴露程度;
      return;
    }
  }
  s.暴露程度 = '微露';
}

/** 穿上服装：更新槽位、卸下同槽旧装、重算暴露 */
function equipClothing(name: string) {
  const slot = CLOTHING_SLOT[name];
  if (!slot) return;
  if (slot === '特殊配饰') {
    const sub = ACCESSORY_SUB_SLOT[name];
    if (!sub) return;
    // 同子槽位（腰部/阴蒂互斥组）的旧配饰卸下
    for (const [itemName, itemSub] of Object.entries(ACCESSORY_SUB_SLOT)) {
      if (itemSub === sub && itemName !== name && store.data.系统.道具状态[itemName] === '使用中') {
        store.data.系统.道具状态[itemName] = '已购买';
      }
    }
    store.data.系统.道具状态[name] = '使用中';
    store.data.云霜凝.服装.特殊配饰[sub] = name;
    recalcExposure();
    return;
  }
  // 卸下同槽旧服装
  for (const [itemName, itemSlot] of Object.entries(CLOTHING_SLOT)) {
    if (itemSlot === slot && itemName !== name && store.data.系统.道具状态[itemName] === '使用中') {
      store.data.系统.道具状态[itemName] = '已购买';
    }
  }
  store.data.系统.道具状态[name] = '使用中';
  store.data.云霜凝.服装[slot] = name;
  recalcExposure();
}

/** 脱下服装：恢复默认、重算暴露 */
function unequipClothing(name: string) {
  const slot = CLOTHING_SLOT[name];
  if (!slot) return;
  if (slot === '特殊配饰') {
    const sub = ACCESSORY_SUB_SLOT[name];
    if (!sub) return;
    store.data.系统.道具状态[name] = '已购买';
    store.data.云霜凝.服装.特殊配饰[sub] = '';
    recalcExposure();
    return;
  }
  store.data.系统.道具状态[name] = '已购买';
  store.data.云霜凝.服装[slot] = SLOT_DEFAULTS[slot];
  recalcExposure();
}

// 可赠礼的服装（全部服装均可赠礼）
const GIFTABLE_CLOTHING = new Set([...CLOTHING_NAMES]);

// ── 淫纹刻印位置 ──
const YINWEN_POSITIONS = ['腰腹', '胸前', '大腿内侧', '臀部'] as const;
const yinwenPos = ref<string>('');
const yinwenText = ref<string>('');

const needYinwenPos = computed(() => checkedItems.has('淫纹刻印'));
const showYinwenPicker = computed(() => checkedItems.has('淫纹刻印'));

// ── 共用道具目标选择浮层 ──
const showTargetDialog = ref(false);
const sharedItemsPending = computed(() => [...checkedItems].filter(isSharedItem));

// ── 配对场景 dialog（单独进行 / 洛书晴参与） ─────────────────────
const showScenePairDialog = ref(false);
const pendingScenePair = ref(''); // 存原版场景名

function getEnhancedMissing(name: string): string[] {
  const d = store.data;
  const missing: string[] = [];
  if (name === '寝取宣告增强') {
    if (!d._洛书晴线已激活) missing.push('洛书晴尚未进入你的视野');
    if (d.洛书晴.调教阶段 < 6) missing.push(`洛书晴调教阶段需 ≥ 6（当前 ${d.洛书晴.调教阶段}）`);
    if (d.治疗.阶段 < 7) missing.push(`治疗阶段需 ≥ 7（当前 ${d.治疗.阶段}）`);
    if (d.系统.道具状态['透灵幔'] !== '使用中') missing.push('需装备「透灵幔」');
    if (!['默许', '沉溺'].includes(d.苗广.心态)) missing.push('苗广心态需达「默许」或「沉溺」');
    if (!d._已完成特殊场景['两人同侍']) missing.push('需先完成「两人同侍」');
  } else if (name === '儿媳调教公公') {
    if (!d._洛书晴线已激活) missing.push('洛书晴尚未进入你的视野');
    if (d.洛书晴.调教阶段 < 8) missing.push(`洛书晴调教阶段需 ≥ 8（当前 ${d.洛书晴.调教阶段}）`);
    if (d.治疗.阶段 < 8) missing.push(`治疗阶段需 ≥ 8（当前 ${d.治疗.阶段}）`);
    if (d.苗广.心态 !== '沉溺') missing.push('苗广心态需达「沉溺」');
    if (!d._已完成特殊场景['双重目击']) missing.push('需先完成「双重目击」');
  } else if (name === '双重改嫁') {
    if (!d._洛书晴线已激活) missing.push('洛书晴尚未进入你的视野');
    if (d.洛书晴.调教阶段 < 9) missing.push(`洛书晴调教阶段需 ≥ 9（当前 ${d.洛书晴.调教阶段}）`);
    if (d.治疗.阶段 < 10) missing.push(`治疗阶段需 ≥ 10（当前 ${d.治疗.阶段}）`);
    if (d.苗广.心态 !== '沉溺') missing.push('苗广心态需达「沉溺」');
    if (!d.苗广.千晶幻术.认知改写完成) missing.push('千晶幻术认知改写未完成');
    if (!d._已完成特殊场景['儿媳调教公公']) missing.push('需先完成「儿媳调教公公」');
  }
  return missing;
}

const pendingEnhancedMissing = computed(() => {
  const original = pendingScenePair.value;
  if (!original) return [];
  const enhanced = SCENE_PAIRS[original];
  return enhanced ? getEnhancedMissing(enhanced) : [];
});

function openScenePairDialog(originalName: string) {
  pendingScenePair.value = originalName;
  showScenePairDialog.value = true;
}

function pickSceneVersion(version: 'solo' | 'luo') {
  const original = pendingScenePair.value;
  if (!original) {
    showScenePairDialog.value = false;
    return;
  }
  if (version === 'solo') {
    checkedItems.add(original);
  } else {
    const enhanced = SCENE_PAIRS[original];
    if (!enhanced) return;
    if (getEnhancedMissing(enhanced).length > 0) return;
    checkedItems.add(enhanced);
  }
  showScenePairDialog.value = false;
  pendingScenePair.value = '';
}

// 原版卡片的勾选状态：原版名或配对增强版名在 checkedItems 里都算勾选
function isCardChecked(item: ItemDef): boolean {
  if (checkedItems.has(item.name)) return true;
  const paired = SCENE_PAIRS[item.name];
  return paired ? checkedItems.has(paired) : false;
}

// ── 购买/使用逻辑 ──────────────────────────────────────────
const toast = ref('');
const toast_class = ref('');
let toast_timer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string, type: 'ok' | 'err' | 'info' = 'ok') {
  toast.value = msg;
  toast_class.value = `toast-${type}`;
  if (toast_timer) clearTimeout(toast_timer);
  toast_timer = setTimeout(() => {
    toast.value = '';
  }, 2000);
}

// 批量选择集合
const checkedItems = reactive(new Set<string>());

function findItem(name: string): ItemDef | undefined {
  for (const list of Object.values(ALL_ITEMS)) {
    const found = list.find(i => i.name === name);
    if (found) return found;
  }
  return undefined;
}

function handleClick(item: ItemDef) {
  if (!isLatestMessage()) {
    showToast('只能在最新楼层操作商店', 'err');
    return;
  }

  const state = store.data.系统.道具状态[item.name];

  if (!isUnlocked(item)) {
    showToast(`未解锁（${item.unlockDesc}）`, 'err');
    return;
  }

  if (item.type === '特殊场景') {
    const busy = busyScenarioReason();
    if (busy) {
      showToast(busy, 'err');
      return;
    }
  }

  if (item.type === '特殊场景' && store.data._已完成特殊场景[item.name]) {
    showToast(`「${item.name}」已完成`, 'info');
    return;
  }

  if (item.type === '性癖' && isAlreadyOwned(item.name)) {
    if (state === '使用中') {
      const kink = KINK_EFFECTS[item.name];
      if (kink) {
        delete store.data.云霜凝.性癖列表[kink.name];
      }
      store.data.系统.道具状态[item.name] = '已购买';
      showToast(`已卸下「${item.name}」`, 'info');
    } else {
      showToast(`「${item.name}」已拥有`, 'info');
    }
    return;
  }

  if (item.type === '体改' && isAlreadyOwned(item.name)) {
    showToast(`「${item.name}」已拥有`, 'info');
    return;
  }

  // 消耗品冷却检查（阻止购买+使用）
  if (CONSUMABLE_NAMES.has(item.name)) {
    const { inCooldown, remainingFloors } = getCooldown(item.name);
    if (inCooldown) {
      showToast(`「${item.name}」冷却中（还需${remainingFloors}楼）`, 'err');
      return;
    }
  }

  // 神魂空间限制检查
  {
    const { allowed, reason } = checkActivate(item.name);
    if (!allowed) {
      showToast(reason, 'err');
      return;
    }
  }

  if (!state || state === '未购买') {
    if (store.data.系统.灵石 < item.price) {
      showToast(`灵石不足（需 ${item.price}，现有 ${store.data.系统.灵石}）`, 'err');
      return;
    }
    store.data.系统.灵石 -= item.price;
    store.data.系统.道具状态[item.name] = '已购买';
    showToast(`已购买「${item.name}」`, 'ok');
  } else if (state === '已购买') {
    // 配对场景：点击已购买的原版 → 若已勾选（原版或增强版）则取消，否则弹 dialog
    if (SCENE_PAIRS[item.name]) {
      const enhanced = SCENE_PAIRS[item.name];
      if (checkedItems.has(item.name)) {
        checkedItems.delete(item.name);
      } else if (checkedItems.has(enhanced)) {
        checkedItems.delete(enhanced);
      } else {
        openScenePairDialog(item.name);
      }
      return;
    }
    if (checkedItems.has(item.name)) {
      checkedItems.delete(item.name);
    } else {
      // 性癖槽位检查：已激活 + 已勾选中的性癖不能超过上限
      if (KINK_EFFECTS[item.name]) {
        const pendingKinks = [...checkedItems].filter(n => !!KINK_EFFECTS[n]).length;
        if (activeKinkCount() + pendingKinks >= MAX_KINKS) {
          showToast(`性癖槽位已满（${MAX_KINKS}/${MAX_KINKS}）`, 'err');
          return;
        }
      }
      checkedItems.add(item.name);
    }
  } else if (state === '使用中') {
    if (item.type === '装备') {
      if (CLOTHING_SLOT[item.name]) {
        unequipClothing(item.name);
        // 服装卸下事件：通知AI服装被脱下，换回默认
        const slot = CLOTHING_SLOT[item.name] as ClothingSlot;
        const defaultName = slot === '特殊配饰' ? '无' : SLOT_DEFAULTS[slot];
        const event = `卸下服装:${item.name}→${defaultName}`;
        const existing = store.data._待发送道具事件;
        store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
      } else {
        store.data.系统.道具状态[item.name] = '已购买';
        // 装备卸下事件：通知AI装备被移除
        const event = `卸下:${item.name}`;
        const existing = store.data._待发送道具事件;
        store.data._待发送道具事件 = existing ? existing + '|||' + event : event;
      }
      store.flush();
      showToast(`已卸下「${item.name}」`, 'info');
    } else {
      showToast(`「${item.name}」效果生效中`, 'info');
    }
  }
}

// ── 确定使用：批量处理所有勾选的道具 ──
function confirmUse() {
  if (checkedItems.size === 0) return;
  if (!isLatestMessage()) {
    showToast('只能在最新楼层操作商店', 'err');
    return;
  }
  // 若勾选了特殊场景，必须确认无其他多轮剧情进行中
  const hasScene = [...checkedItems].some(n => {
    const it = findItem(n);
    return it?.type === '特殊场景';
  });
  if (hasScene) {
    const busy = busyScenarioReason();
    if (busy) {
      showToast(busy, 'err');
      return;
    }
  }
  // 洛书晴激活 + 有共用道具 → 弹目标选择
  if (store.data._洛书晴线已激活 && sharedItemsPending.value.length > 0) {
    showTargetDialog.value = true;
    return;
  }
  executeConfirmUse('云霜凝');
}

function pickTarget(target: '云霜凝' | '洛书晴') {
  showTargetDialog.value = false;
  executeConfirmUse(target);
}

function executeConfirmUse(target: '云霜凝' | '洛书晴') {
  store.pull(); // 从 MVU 拉取最新数据，防止读到已消费的旧事件
  const names = [...checkedItems];
  const eventNames: string[] = [];
  let needTriggerAI = false;

  for (const name of names) {
    const item = findItem(name);
    if (!item) continue;

    // 二次检查：冷却 + 神魂空间
    const activation = checkActivate(name);
    if (!activation.allowed) {
      showToast(`「${name}」${activation.reason}`, 'err');
      continue;
    }
    if (CONSUMABLE_NAMES.has(name)) {
      const { inCooldown, remainingFloors } = getCooldown(name);
      if (inCooldown) {
        showToast(`「${name}」冷却中（还需${remainingFloors}楼）`, 'err');
        continue;
      }
    }

    // 共用道具且目标=洛书晴：写入 _洛书晴道具状态，后端 processNewlyActivatedLuoItems 处理
    if (target === '洛书晴' && isSharedItem(name)) {
      // 淫纹刻印带位置参数
      if (name === '淫纹刻印') {
        if (!yinwenPos.value) continue;
        const pos = yinwenPos.value;
        const text = (yinwenText.value || '淫').trim().slice(0, 8);
        store.data._洛书晴道具状态[`淫纹刻印·${pos}·${text}`] = '使用中';
        delete store.data.系统.道具状态[name];
        eventNames.push(`洛书晴·淫纹刻印·${pos}·${text}`);
        needTriggerAI = true;
        yinwenPos.value = '';
        yinwenText.value = '';
      } else {
        // 性癖 / 体改 / 服装 / 身体器具 / 洛书晴消耗品
        store.data._洛书晴道具状态[name] = '使用中';
        delete store.data.系统.道具状态[name];
        // 洛书晴所有共用道具激活时都触发 narrative（由 buildLuoItemEvent 动态生成）
        // 性癖：与云霜凝的"性癖觉醒"一致
        // 身体器具：需要"找到她+施加"的叙事门面
        // 体改/服装/消耗品：送衣/仪式/送符剧情
        eventNames.push(`洛书晴·${name}`);
        needTriggerAI = true;
      }
      continue;
    }

    // 消耗品：前端直接执行效果（store.flush不触发VARIABLE_UPDATE_ENDED，
    // 等到AI回复时两边都是'使用中'会走存量修复路径跳过效果）
    if (CONSUMABLE_NAMES.has(name)) {
      // 执行即时效果（防线/信任/疑心等数值变化 + 蚀心露隐藏效果）
      const effect = INSTANT_EFFECTS[name];
      if (effect) {
        effect(store.data as any);
      }
      // 记录冷却 + 清除道具状态（与后端processNewlyActivatedItems同逻辑）
      store.data._消耗品上次使用楼层[name] = getCurrentFloor();
      delete store.data.系统.道具状态[name];
      eventNames.push(name);

      // 蚀心露隐藏效果触发后，追加转变事件并触发AI回复
      if (store.data._已触发蚀心露屈辱 && name === '蚀心露') {
        needTriggerAI = true;
      }
    } else if (KINK_EFFECTS[name]) {
      if (activeKinkCount() >= MAX_KINKS) {
        showToast(`性癖槽位已满（${MAX_KINKS}/${MAX_KINKS}），「${name}」未激活`, 'err');
        continue;
      }
      const { name: kinkName, tag } = KINK_EFFECTS[name];
      store.data.云霜凝.性癖列表[kinkName] = tag;
      store.data.系统.道具状态[name] = '使用中';
      // 性癖不写入 _待发送道具事件：效果通过 buildKinkDirectives() 读取 性癖列表+道具状态 注入
    } else if (name === '淫纹刻印') {
      if (!yinwenPos.value) continue;
      const pos = yinwenPos.value as '腰腹' | '胸前' | '大腿内侧' | '臀部';
      const text = (yinwenText.value || '淫').trim().slice(0, 8);
      if (!store.data.云霜凝.肉体改造.淫纹[pos]) {
        store.data.云霜凝.肉体改造.淫纹[pos] = text;
      }
      delete store.data.系统.道具状态[name];
      eventNames.push(`淫纹刻印·${pos}·${text}`);
      needTriggerAI = true;
      yinwenPos.value = '';
      yinwenText.value = '';
    } else if (BODY_MOD_EFFECTS[name]) {
      BODY_MOD_EFFECTS[name]();
      delete store.data.系统.道具状态[name];
      eventNames.push(name);
      needTriggerAI = true;
    } else if (SCENE_TURNS[name]) {
      store.data._特殊场景.进行中 = name;
      store.data._特殊场景开始楼层 = getCurrentFloor();
      delete store.data.系统.道具状态[name];
      eventNames.push(name);
      needTriggerAI = true;
    } else if (CLOTHING_NAMES.has(name)) {
      // 记录换装前的旧服装（用于生成换装事件）
      const slot = CLOTHING_SLOT[name] as ClothingSlot;
      let oldClothing: string | undefined;
      let slotDefault: string = '';
      if (slot === '特殊配饰') {
        const sub = ACCESSORY_SUB_SLOT[name];
        oldClothing = sub ? store.data.云霜凝.服装.特殊配饰[sub] : undefined;
        slotDefault = '';
      } else if (slot) {
        oldClothing = store.data.云霜凝.服装[slot];
        slotDefault = SLOT_DEFAULTS[slot];
      }
      equipClothing(name);
      if (GIFTABLE_CLOTHING.has(name)) {
        // 如果旧服装不是默认且不同于新服装，生成换装事件而非赠礼
        if (oldClothing && oldClothing !== slotDefault && oldClothing !== name) {
          eventNames.push(`换装:${oldClothing}→${name}`);
        } else {
          eventNames.push(name);
        }
        needTriggerAI = true;
      }
    } else {
      store.data.系统.道具状态[name] = '使用中';
      // 前端处理互斥（store.flush不触发VARIABLE_UPDATE_ENDED，后端会跳过）
      enforceExclusiveGroup(name, store.data as any);
      // 锚神钉是被动装备（状态快照已提示AI），无需触发AI事件
      if (name !== '锚神钉') {
        eventNames.push(name);
      }
    }
  }

  if (eventNames.length > 0) {
    const pending = store.data._待发送道具事件;
    store.data._待发送道具事件 = pending ? pending + '|||' + eventNames.join('|||') : eventNames.join('|||');
  }

  checkedItems.clear();

  // 始终 flush 确保变量写入 SillyTavern，触发 VARIABLE_UPDATE_ENDED 处理消耗品效果
  if (needTriggerAI) {
    store.data._系统操作中 = true;
    store.flush();
    triggerSlash(`/send （使用了${eventNames.join('、')}）|/trigger`);
    showToast(`已使用 ${names.length} 件道具，AI生成中…`, 'ok');
  } else {
    store.flush();
    showToast(`已使用 ${names.length} 件道具`, 'ok');
  }
}

function isAlreadyOwned(name: string): boolean {
  const d = store.data;
  if (KINK_EFFECTS[name]) {
    return name in d.云霜凝.性癖列表;
  }
  const bodyModChecks: Record<string, () => boolean> = {
    '丰胸灵乳丹·中': () => d.云霜凝.肉体改造.胸部 !== '默认',
    '丰胸灵乳丹·大': () => ['G罩杯', 'H罩杯'].includes(d.云霜凝.肉体改造.胸部),
    '丰胸灵乳丹·极': () => d.云霜凝.肉体改造.胸部 === 'H罩杯',
    丰臀圆玉丹: () => d.云霜凝.肉体改造.臀部 !== '默认',
    乳环: () => d.云霜凝.肉体改造.乳环,
    阴环: () => d.云霜凝.肉体改造.阴环,
  };
  if (bodyModChecks[name]) return bodyModChecks[name]();
  return false;
}

function stateLabel(item: ItemDef) {
  if (item.type === '特殊场景' && store.data._已完成特殊场景[item.name]) return '已完成';
  if ((item.type === '性癖' || item.type === '体改') && isAlreadyOwned(item.name)) {
    return store.data.系统.道具状态[item.name] === '使用中' ? '装备中' : '已拥有';
  }
  // 消耗品冷却显示
  if (CONSUMABLE_NAMES.has(item.name)) {
    const { inCooldown, remainingFloors } = getCooldown(item.name);
    if (inCooldown) return `冷却${remainingFloors}楼`;
  }
  return store.data.系统.道具状态[item.name] ?? '未购买';
}
function stateClass(name: string) {
  const item = findItem(name);
  if (item && (item.type === '性癖' || item.type === '体改') && isAlreadyOwned(name)) {
    return store.data.系统.道具状态[name] === '使用中' ? 'st-kink-active' : 'st-owned';
  }
  // 消耗品冷却中
  if (CONSUMABLE_NAMES.has(name) && getCooldown(name).inCooldown) return 'st-cooldown';
  const s = store.data.系统.道具状态[name];
  if (!s) return 'st-none';
  if (s === '已购买') return 'st-bought';
  if (s === '使用中') return 'st-active';
  return '';
}
// ── 留影石 ──────────────────────────────────────────

const liuyingshiUnlocked = computed(() => store.data.治疗.阶段 >= 3);

const canBuyLiuyingshi = computed(() => liuyingshiUnlocked.value && store.data.系统.灵石 >= 60);

const liuyingshiItems = computed(() => {
  const result: { name: string; state: string }[] = [];
  for (const [name, state] of Object.entries(store.data.系统.道具状态)) {
    if (name.startsWith('留影石_')) {
      result.push({ name, state: state as string });
    }
  }
  return result;
});

const canSellLiuyingshi = computed(
  () => ['默许', '沉溺'].includes(store.data.苗广.心态) && !!store.data._已完成特殊场景['夫前凌辱'],
);

const sellPrice = computed(() => (store.data.苗广.心态 === '沉溺' ? 800 : 500));

const liuyingshiSellCooldown = computed(() => getLiuyingshiSellCooldownInfo(store.data as any, getCurrentFloor()));

function handleBuyLiuyingshi() {
  if (!isLatestMessage()) {
    showToast('只能在最新楼层操作商店', 'err');
    return;
  }
  const result = buyLiuyingshi(store.data);
  if (result.success) {
    showToast(`已购买「${result.itemName}」`, 'ok');
  } else {
    showToast(result.reason, 'err');
  }
}

function toggleLiuyingshi(name: string) {
  if (!isLatestMessage()) {
    showToast('只能在最新楼层操作商店', 'err');
    return;
  }
  const state = store.data.系统.道具状态[name];
  if (state === '使用中') {
    store.data.系统.道具状态[name] = '已购买';
    showToast(`${name} 停止录制`, 'info');
  } else {
    store.data.系统.道具状态[name] = '使用中';
    showToast(`${name} 开始录制`, 'ok');
  }
}

function handleSellLiuyingshi(name: string) {
  if (!isLatestMessage()) {
    showToast('只能在最新楼层操作商店', 'err');
    return;
  }
  const result = sellLiuyingshi(store.data, name, getCurrentFloor());
  if (result.success) {
    store.flush();
    triggerSlash('/send （留影石出售）|/trigger');
    showToast(`出售成功，获得 ${sellPrice.value} 灵石`, 'ok');
  } else {
    showToast(result.reason, 'err');
  }
}

function rowClass(item: ItemDef) {
  if (!isUnlocked(item)) return 'row-locked';
  if (item.type === '特殊场景' && store.data._已完成特殊场景[item.name]) return 'row-done';
  if ((item.type === '性癖' || item.type === '体改') && isAlreadyOwned(item.name)) {
    return store.data.系统.道具状态[item.name] === '使用中' ? 'row-active' : 'row-done';
  }
  const s = store.data.系统.道具状态[item.name];
  if (s === '使用中') return 'row-active';
  if (s === '已购买') return checkedItems.has(item.name) ? 'row-bought row-selected' : 'row-bought';
  return '';
}
</script>

<style lang="scss" scoped>
// ── 色彩系统（绛红主题） ──
$c-bg: #0c0406;
$c-panel: #160810;
$c-pri: #c03050;
$c-pri-l: #d84868;
$c-acc: #ff6080;
$c-frost: #ffd0d8;
$c-text: #ffe8ec;
$c-sub: #a07080;
$c-mute: #6a3848;
$c-good: #40c880;
$c-gold: #e8be58;
$c-gold-l: #f8e080;
$c-warn: #d4b030;
$c-danger: #e05050;

// 分类色（提亮）
$cat-消耗品: #58c8d8;
$cat-装备: #d86878;
$cat-体改: #f078a8;
$cat-性癖: #d860b0;
$cat-场景: #d8a040;

.shop-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// ━━━ 头部 ━━━
.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba($c-pri, 0.08) 0%, rgba($c-panel, 0.9) 100%);
  border: 1px solid rgba($c-pri, 0.15);
  border-radius: 12px;
  position: relative;
  overflow: hidden;

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
}
.ling-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ling-icon {
  font-size: 1.2rem;
  color: $c-gold;
  filter: drop-shadow(0 0 5px rgba($c-gold, 0.5));
}
.ling-val {
  font-size: 1.5rem;
  font-weight: 900;
  color: $c-gold-l;
  line-height: 1;
  text-shadow: 0 0 10px rgba($c-gold, 0.3);
  font-variant-numeric: tabular-nums;
}
.ling-unit {
  font-size: 0.72rem;
  color: rgba($c-gold, 0.6);
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.temp-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.temp-badge {
  font-size: 0.6rem;
  padding: 3px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba($c-warn, 0.1) 0%, rgba($c-warn, 0.03) 100%);
  border: 1px solid rgba($c-warn, 0.2);
  color: $c-gold-l;
  font-weight: 600;
  .temp-turns {
    color: rgba($c-warn, 0.6);
    margin-left: 3px;
  }
}
.scene-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba($c-acc, 0.1) 0%, rgba($c-acc, 0.03) 100%);
  border: 1px solid rgba($c-acc, 0.25);
  color: $c-frost;
  .scene-icon {
    font-size: 0.7rem;
    color: $c-acc;
  }
  .scene-progress {
    color: $c-acc;
    font-weight: 900;
    background: rgba($c-acc, 0.12);
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.58rem;
  }
}

// ━━━ 分类标签 ━━━
.cat-tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba($c-mute, 0.12);
  border-radius: 12px;
  border: 1px solid rgba($c-pri, 0.1);
}
.cat-btn {
  flex: 1;
  padding: 8px 4px;
  text-align: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: $c-sub;
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.5px;
  font-weight: 500;

  &:hover {
    color: $c-frost;
    background: rgba($c-pri, 0.1);
  }

  &.active {
    color: #fff;
    font-weight: bold;
    text-shadow: 0 0 8px rgba($c-acc, 0.3);
    border-color: rgba(#fff, 0.05);
  }
  &.active.tab-消耗品 {
    background: linear-gradient(135deg, rgba($cat-消耗品, 0.25) 0%, rgba($cat-消耗品, 0.08) 100%);
    box-shadow:
      0 2px 8px rgba($cat-消耗品, 0.15),
      inset 0 0 8px rgba($cat-消耗品, 0.05);
  }
  &.active.tab-装备 {
    background: linear-gradient(135deg, rgba($cat-装备, 0.25) 0%, rgba($cat-装备, 0.08) 100%);
    box-shadow:
      0 2px 8px rgba($cat-装备, 0.15),
      inset 0 0 8px rgba($cat-装备, 0.05);
  }
  &.active.tab-体改 {
    background: linear-gradient(135deg, rgba($cat-体改, 0.25) 0%, rgba($cat-体改, 0.08) 100%);
    box-shadow:
      0 2px 8px rgba($cat-体改, 0.15),
      inset 0 0 8px rgba($cat-体改, 0.05);
  }
  &.active.tab-性癖 {
    background: linear-gradient(135deg, rgba($cat-性癖, 0.25) 0%, rgba($cat-性癖, 0.08) 100%);
    box-shadow:
      0 2px 8px rgba($cat-性癖, 0.15),
      inset 0 0 8px rgba($cat-性癖, 0.05);
  }
  &.active.tab-场景 {
    background: linear-gradient(135deg, rgba($cat-场景, 0.25) 0%, rgba($cat-场景, 0.08) 100%);
    box-shadow:
      0 2px 8px rgba($cat-场景, 0.15),
      inset 0 0 8px rgba($cat-场景, 0.05);
  }
}

// ━━━ 道具信息栏 ━━━
.info-bar {
  height: 80px;
  overflow-y: auto;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba($c-panel, 0.65);
  border: 1px solid rgba($c-mute, 0.18);
  transition:
    background 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;

  &--active {
    background: rgba($c-panel, 0.9);
  }
  &.info-消耗品 {
    border-color: rgba($cat-消耗品, 0.25);
    background: linear-gradient(135deg, rgba($cat-消耗品, 0.04) 0%, rgba($c-panel, 0.85) 100%);
  }
  &.info-装备 {
    border-color: rgba($cat-装备, 0.25);
    background: linear-gradient(135deg, rgba($cat-装备, 0.04) 0%, rgba($c-panel, 0.85) 100%);
  }
  &.info-体改 {
    border-color: rgba($cat-体改, 0.25);
    background: linear-gradient(135deg, rgba($cat-体改, 0.04) 0%, rgba($c-panel, 0.85) 100%);
  }
  &.info-性癖 {
    border-color: rgba($cat-性癖, 0.25);
    background: linear-gradient(135deg, rgba($cat-性癖, 0.04) 0%, rgba($c-panel, 0.85) 100%);
  }
  &.info-场景 {
    border-color: rgba($cat-场景, 0.25);
    background: linear-gradient(135deg, rgba($cat-场景, 0.04) 0%, rgba($c-panel, 0.85) 100%);
  }
}
.info-placeholder {
  color: rgba($c-sub, 0.5);
  font-size: 0.78rem;
  text-align: center;
  line-height: 64px; // 垂直居中：80px - padding 16px = 64px
  letter-spacing: 1px;
}
.info-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.info-name {
  font-size: 0.92rem;
  font-weight: bold;
  color: $c-frost;
  text-shadow: 0 0 4px rgba($c-acc, 0.1);
}
.info-type {
  font-size: 0.62rem;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.3px;
  font-weight: 600;
  &.itype-消耗品 {
    color: $cat-消耗品;
    border: 1px solid rgba($cat-消耗品, 0.3);
    background: rgba($cat-消耗品, 0.06);
  }
  &.itype-装备 {
    color: $cat-装备;
    border: 1px solid rgba($cat-装备, 0.3);
    background: rgba($cat-装备, 0.06);
  }
  &.itype-体改 {
    color: $cat-体改;
    border: 1px solid rgba($cat-体改, 0.3);
    background: rgba($cat-体改, 0.06);
  }
  &.itype-性癖 {
    color: $cat-性癖;
    border: 1px solid rgba($cat-性癖, 0.3);
    background: rgba($cat-性癖, 0.06);
  }
  &.itype-场景 {
    color: $cat-场景;
    border: 1px solid rgba($cat-场景, 0.3);
    background: rgba($cat-场景, 0.06);
  }
}
.info-price {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.82rem;
  color: $c-gold;
  font-weight: bold;
  margin-left: auto;
  .p-icon {
    font-size: 0.6rem;
    opacity: 0.7;
  }
}
.info-desc {
  font-size: 0.82rem;
  color: rgba($c-text, 0.75);
  line-height: 1.4;
  margin-top: 3px;
}
.info-lock {
  font-size: 0.72rem;
  color: rgba($c-danger, 0.8);
  margin-top: 3px;
  padding: 2px 0;
}

// ━━━ 道具列表（网格卡片布局） ━━━
.item-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 2px;
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba($c-pri, 0.3);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba($c-pri, 0.5);
  }
}

// ── 分组标题（可折叠） ──
.group-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 4px;
  margin-top: 2px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:first-child {
    margin-top: 0;
  }
  &:hover {
    opacity: 0.85;
  }
}
.group-chevron {
  font-size: 0.8rem;
  color: rgba($cat-装备, 0.7);
  transition: transform 0.25s ease;
  transform: rotate(-90deg);
  line-height: 1;

  &.collapsed {
    transform: rotate(0deg);
  }
}
.group-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: rgba($cat-装备, 0.75);
  letter-spacing: 1px;
  text-transform: uppercase;
  white-space: nowrap;
}
.group-count {
  font-size: 0.6rem;
  color: rgba($cat-装备, 0.4);
  font-weight: 600;
}
.group-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba($cat-装备, 0.2), transparent);
}

// ── 道具卡片 ──
.item-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba($c-panel, 0.55);
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
  border: 1px solid rgba($c-mute, 0.12);
  min-height: 52px;
  position: relative;
  overflow: hidden;

  // 顶部高光
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(#fff, 0.04), transparent);
    pointer-events: none;
  }

  // 分类色底部边框
  &.card-消耗品 {
    border-bottom: 2px solid rgba($cat-消耗品, 0.2);
  }
  &.card-装备 {
    border-bottom: 2px solid rgba($cat-装备, 0.2);
  }
  &.card-体改 {
    border-bottom: 2px solid rgba($cat-体改, 0.2);
  }
  &.card-性癖 {
    border-bottom: 2px solid rgba($cat-性癖, 0.2);
  }
  &.card-场景 {
    border-bottom: 2px solid rgba($cat-场景, 0.2);
  }

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    &.card-消耗品 {
      border-bottom-color: $cat-消耗品;
      background: rgba($cat-消耗品, 0.06);
    }
    &.card-装备 {
      border-bottom-color: $cat-装备;
      background: rgba($cat-装备, 0.06);
    }
    &.card-体改 {
      border-bottom-color: $cat-体改;
      background: rgba($cat-体改, 0.06);
    }
    &.card-性癖 {
      border-bottom-color: $cat-性癖;
      background: rgba($cat-性癖, 0.06);
    }
    &.card-场景 {
      border-bottom-color: $cat-场景;
      background: rgba($cat-场景, 0.06);
    }
  }

  &.row-bought {
    background: linear-gradient(135deg, rgba($c-gold, 0.06) 0%, rgba($c-panel, 0.45) 100%);
    border-color: rgba($c-gold, 0.2);
    border-bottom-color: rgba($c-gold, 0.4);
  }
  &.row-active {
    background: linear-gradient(135deg, rgba($c-good, 0.08) 0%, rgba($c-panel, 0.45) 100%);
    border-color: rgba($c-good, 0.2);
    border-bottom-color: $c-good;
    box-shadow: 0 0 12px rgba($c-good, 0.06);
  }
  &.row-locked {
    opacity: 0.2;
    cursor: not-allowed;
    &:hover {
      transform: none;
      box-shadow: none;
      background: rgba($c-panel, 0.45);
      border-color: rgba($c-mute, 0.12);
    }
  }
  &.row-done {
    opacity: 0.25;
    cursor: default;
    &:hover {
      transform: none;
      box-shadow: none;
      background: rgba($c-panel, 0.45);
      border-color: rgba($c-mute, 0.12);
    }
  }
  &.row-selected {
    background: linear-gradient(135deg, rgba($c-acc, 0.12) 0%, rgba($c-acc, 0.04) 100%);
    border-color: rgba($c-acc, 0.25);
    border-bottom-color: $c-acc;
    box-shadow: 0 0 10px rgba($c-acc, 0.08);
  }
  // 滚动期间禁止 hover 视觉效果，防止移动端屏闪
  &.no-hover {
    pointer-events: none;
  }
}

.card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-check {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  border: 1.5px solid rgba($c-sub, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($c-bg, 0.5);
  flex-shrink: 0;
  transition: all 0.15s;

  svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: transparent;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  &.checked {
    background: linear-gradient(135deg, $c-acc, $c-pri);
    border-color: $c-acc;
    box-shadow: 0 0 6px rgba($c-acc, 0.4);
    svg {
      stroke: #fff;
    }
  }
}
.card-name {
  font-size: 0.84rem;
  color: $c-frost;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;

  .row-active & {
    color: lighten($c-good, 12%);
    text-shadow: 0 0 4px rgba($c-good, 0.1);
  }
  .row-locked & {
    color: rgba($c-sub, 0.5);
  }
}
.card-price {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: rgba($c-gold, 0.75);
  font-weight: 600;
  .p-icon {
    font-size: 0.56rem;
    opacity: 0.6;
  }
}
.card-state {
  font-size: 0.64rem;
  font-weight: bold;
  letter-spacing: 0.3px;
  padding: 2px 6px;
  border-radius: 4px;
}
.st-none {
  color: rgba($c-sub, 0.4);
}
.st-bought {
  color: $c-gold;
  background: rgba($c-gold, 0.08);
}
.st-active {
  color: $c-good;
  background: rgba($c-good, 0.08);
}
.st-kink-active {
  color: $cat-性癖;
  background: rgba($cat-性癖, 0.12);
}
.st-owned {
  color: rgba($c-sub, 0.55);
  background: rgba($c-sub, 0.08);
}
.st-cooldown {
  color: #e07c4a;
  background: rgba(#e07c4a, 0.08);
  font-size: 0.58rem;
}

// ━━━ 留影石 ━━━
.liuying-section {
  padding: 12px 14px;
  border: 1px solid rgba($cat-装备, 0.18);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba($cat-装备, 0.04) 0%, rgba($c-panel, 0.55) 100%);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba($cat-装备, 0.12), transparent);
    pointer-events: none;
  }
}
.liuying-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.liuying-title {
  font-size: 0.88rem;
  font-weight: bold;
  color: $c-frost;
}
.liuying-hint {
  font-size: 0.7rem;
  color: rgba($c-sub, 0.65);
  flex: 1;
}
.liuying-buy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid rgba($cat-装备, 0.3);
  background: linear-gradient(135deg, rgba($cat-装备, 0.14) 0%, rgba($c-panel, 0.6) 100%);
  color: $c-frost;
  font-size: 0.76rem;
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  .p-icon {
    font-size: 0.52rem;
    color: $c-gold;
  }

  &:hover:not(:disabled) {
    border-color: rgba($cat-装备, 0.5);
    background: linear-gradient(135deg, rgba($cat-装备, 0.22) 0%, rgba($c-panel, 0.6) 100%);
    box-shadow: 0 0 8px rgba($cat-装备, 0.1);
  }
  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
}
.liuying-lock {
  font-size: 0.66rem;
  color: rgba($c-danger, 0.55);
  text-align: center;
  padding: 6px;
}
.liuying-empty {
  font-size: 0.66rem;
  color: rgba($c-sub, 0.35);
  text-align: center;
  padding: 6px;
}
.liuying-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.liuying-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba($c-panel, 0.45);
  border-left: 2px solid rgba($c-sub, 0.2);
  transition: all 0.15s;

  &.liuying-recording {
    border-left-color: $c-danger;
    background: linear-gradient(90deg, rgba($c-danger, 0.05) 0%, rgba($c-panel, 0.45) 100%);
    animation: recordPulse 2s ease-in-out infinite;
  }
}
@keyframes recordPulse {
  0%,
  100% {
    border-left-color: rgba($c-danger, 0.8);
  }
  50% {
    border-left-color: rgba($c-danger, 0.4);
  }
}
.liuying-name {
  font-size: 0.82rem;
  color: $c-frost;
  font-weight: 600;
}
.liuying-state {
  font-size: 0.58rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 8px;
  margin-right: auto;
}
.ls-idle {
  color: rgba($c-sub, 0.55);
  border: 1px solid rgba($c-sub, 0.18);
}
.ls-active {
  color: $c-danger;
  border: 1px solid rgba($c-danger, 0.3);
  background: rgba($c-danger, 0.08);
  box-shadow: 0 0 4px rgba($c-danger, 0.1);
}
.liuying-toggle-btn {
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid rgba($c-sub, 0.25);
  background: transparent;
  color: $c-frost;
  font-size: 0.64rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: rgba($cat-装备, 0.4);
    background: rgba($cat-装备, 0.08);
  }
}
.liuying-sell-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid rgba($c-gold, 0.3);
  background: linear-gradient(135deg, rgba($c-gold, 0.12) 0%, transparent 100%);
  color: $c-gold-l;
  font-size: 0.64rem;
  font-weight: bold;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  .p-icon {
    font-size: 0.5rem;
  }

  &:hover:not(:disabled) {
    border-color: rgba($c-gold, 0.5);
    background: linear-gradient(135deg, rgba($c-gold, 0.2) 0%, transparent 100%);
    box-shadow: 0 0 8px rgba($c-gold, 0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: rgba($c-gold, 0.15);
    background: rgba($c-gold, 0.04);
  }
}

// ━━━ 淫纹 ━━━
.yinwen-picker {
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba($c-acc, 0.05) 0%, rgba($c-panel, 0.4) 100%);
  border: 1px solid rgba($c-acc, 0.18);
  border-radius: 8px;
}
.yinwen-title {
  font-size: 0.7rem;
  color: rgba($c-sub, 0.8);
  margin-bottom: 6px;
  font-weight: 600;
}
.yinwen-options {
  display: flex;
  gap: 6px;
}
.yinwen-opt {
  flex: 1;
  padding: 6px 0;
  text-align: center;
  border: 1px solid rgba($c-acc, 0.18);
  border-radius: 8px;
  background: transparent;
  color: $c-frost;
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: rgba($c-acc, 0.35);
    background: rgba($c-acc, 0.06);
  }
  &.selected {
    color: #fff;
    font-weight: bold;
    border-color: rgba($c-acc, 0.5);
    background: linear-gradient(135deg, rgba($c-acc, 0.15) 0%, rgba($c-acc, 0.06) 100%);
    box-shadow: 0 0 8px rgba($c-acc, 0.12);
  }
  &.done {
    opacity: 0.25;
    cursor: not-allowed;
    color: rgba($c-sub, 0.4);
  }
}
.done-mark {
  display: block;
  font-size: 0.54rem;
  color: rgba($c-sub, 0.35);
  margin-top: 2px;
}
.yinwen-text-row {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.yinwen-text-label {
  font-size: 0.62rem;
  color: rgba($c-sub, 0.7);
}
.yinwen-text-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba($c-acc, 0.25);
  border-radius: 6px;
  background: rgba($c-panel, 0.6);
  color: $c-frost;
  font-size: 0.78rem;
  font-family: inherit;
  &:focus {
    outline: none;
    border-color: rgba($c-acc, 0.5);
    box-shadow: 0 0 6px rgba($c-acc, 0.15);
  }
  &::placeholder {
    color: rgba($c-sub, 0.4);
  }
}

// ━━━ 共用道具目标选择浮层 ━━━
.target-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
}
.target-dialog {
  width: min(320px, 90vw);
  padding: 18px 20px;
  background: linear-gradient(145deg, rgba($c-panel, 0.96) 0%, rgba($c-bg, 0.98) 100%);
  border: 1px solid rgba($c-acc, 0.3);
  border-radius: 12px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
  color: $c-frost;
}
.target-dialog-title {
  font-size: 0.95rem;
  font-weight: bold;
  margin-bottom: 6px;
  color: $c-acc;
  text-align: center;
}
.target-dialog-desc {
  font-size: 0.7rem;
  color: rgba($c-sub, 0.75);
  text-align: center;
  margin-bottom: 10px;
}
.target-dialog-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 14px;
  justify-content: center;
}
.target-dialog-chip {
  padding: 3px 8px;
  background: rgba($c-acc, 0.1);
  border: 1px solid rgba($c-acc, 0.2);
  border-radius: 10px;
  font-size: 0.68rem;
  color: rgba($c-frost, 0.85);
}
.target-dialog-btns {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.target-btn {
  flex: 1;
  padding: 10px 0;
  border: 1px solid rgba($c-acc, 0.35);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba($c-pri, 0.25) 0%, rgba($c-acc, 0.15) 100%);
  color: $c-frost;
  font-size: 0.85rem;
  font-family: inherit;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: rgba($c-acc, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba($c-acc, 0.2);
  }
  &.tb-luo {
    background: linear-gradient(135deg, rgba(#a855f7, 0.25) 0%, rgba(#7c3aed, 0.15) 100%);
    border-color: rgba(#a855f7, 0.35);
    &:hover {
      border-color: rgba(#a855f7, 0.6);
      box-shadow: 0 4px 12px rgba(#a855f7, 0.2);
    }
  }
}
.target-dialog-cancel {
  width: 100%;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: rgba($c-sub, 0.6);
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
  &:hover {
    color: $c-sub;
  }
}

// ━━━ 配对场景选择浮层（单独进行 / 洛书晴参与） ━━━
.scene-pair-dialog {
  width: min(340px, 92vw);
}
.scene-pair-btns {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}
.scene-pair-btn {
  flex: 1;
  padding: 14px 8px;
  border: 1px solid rgba($c-acc, 0.35);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba($c-pri, 0.25) 0%, rgba($c-acc, 0.12) 100%);
  color: $c-frost;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &:hover:not(:disabled) {
    border-color: rgba($c-acc, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba($c-acc, 0.2);
  }
  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }
  &.scene-pair-luo:not(:disabled) {
    background: linear-gradient(135deg, rgba(#a855f7, 0.25) 0%, rgba(#7c3aed, 0.12) 100%);
    border-color: rgba(#a855f7, 0.4);
    &:hover {
      border-color: rgba(#a855f7, 0.65);
      box-shadow: 0 4px 12px rgba(#a855f7, 0.22);
    }
  }
}
.scene-pair-btn-main {
  font-size: 0.92rem;
  font-weight: bold;
  letter-spacing: 1px;
}
.scene-pair-btn-sub {
  font-size: 0.62rem;
  color: rgba($c-frost, 0.65);
  letter-spacing: 0.5px;
}
.scene-pair-missing {
  margin: 10px 0 6px;
  padding: 8px 10px;
  border: 1px dashed rgba(#a855f7, 0.3);
  border-radius: 6px;
  background: rgba(#a855f7, 0.05);
}
.scene-pair-missing-title {
  font-size: 0.66rem;
  color: rgba(#d8b4fe, 0.85);
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}
.scene-pair-missing-list {
  margin: 0;
  padding-left: 16px;
  font-size: 0.66rem;
  color: rgba($c-sub, 0.9);
  line-height: 1.6;
  li {
    margin-bottom: 1px;
  }
}

// ━━━ 确定按钮 ━━━
.confirm-btn {
  width: 100%;
  padding: 9px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-family: inherit;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, $c-pri 0%, $c-acc 100%);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 3px 12px rgba($c-pri, 0.25);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(#fff, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
  &:hover {
    box-shadow: 0 4px 16px rgba($c-acc, 0.3);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
    opacity: 0.9;
  }
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    &:hover {
      box-shadow: 0 3px 12px rgba($c-pri, 0.25);
      transform: none;
    }
  }
}
.confirm-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  letter-spacing: 1.5px;
}
.confirm-count {
  font-size: 0.66rem;
  color: rgba(#fff, 0.85);
  background: rgba(#fff, 0.15);
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

// ━━━ Toast ━━━
.toast-bar {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: bold;
  text-align: center;

  &.toast-ok {
    color: lighten($c-good, 8%);
    border: 1px solid rgba($c-good, 0.25);
    background: linear-gradient(135deg, rgba($c-good, 0.08) 0%, rgba($c-good, 0.02) 100%);
    box-shadow: 0 0 8px rgba($c-good, 0.06);
  }
  &.toast-err {
    color: $c-danger;
    border: 1px solid rgba($c-danger, 0.25);
    background: linear-gradient(135deg, rgba($c-danger, 0.08) 0%, rgba($c-danger, 0.02) 100%);
    box-shadow: 0 0 8px rgba($c-danger, 0.06);
  }
  &.toast-info {
    color: $c-frost;
    border: 1px solid rgba($c-sub, 0.2);
    background: linear-gradient(135deg, rgba($c-pri, 0.06) 0%, rgba($c-pri, 0.02) 100%);
  }
}

// ━━━ 过渡 ━━━
.slide-up-enter-active {
  transition:
    opacity 0.25s,
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.toast-fade-enter-active {
  transition: opacity 0.2s;
}
.toast-fade-leave-active {
  transition: opacity 0.15s;
}
.toast-fade-enter-from {
  opacity: 0;
}
.toast-fade-leave-to {
  opacity: 0;
}

// ━━━ 移动端适配 ━━━
@media (max-width: 360px) {
  .shop-header {
    padding: 10px;
    flex-wrap: wrap;
  }
  .cat-tabs {
    gap: 2px;
  }
  .cat-btn {
    font-size: 0.7rem;
    padding: 6px 2px;
  }
  .item-card {
    padding: 8px 10px;
  }
  .info-bar {
    height: 92px;
    padding: 6px 10px;
  }
  .info-placeholder {
    line-height: 80px; // 92px - padding 12px
  }
  .liuying-item {
    flex-wrap: wrap;
  }
  .liuying-sell-btn {
    margin-left: auto;
  }
  .item-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .info-bar {
    height: 92px; // 移动端文字换行更多，给更多空间
  }
  .info-placeholder {
    line-height: 76px; // 92px - padding 16px
  }
  .item-list {
    max-height: 300px;
  }
  .yinwen-options {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
