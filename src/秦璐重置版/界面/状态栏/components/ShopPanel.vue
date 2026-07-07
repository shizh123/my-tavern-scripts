<template>
  <div class="shop-panel">
    <!-- 页头：货币 + 选购对象 -->
    <div class="shop-header">
      <div class="money">
        <span class="m-icon">◈</span>
        <span class="m-val">{{ money }}</span>
        <span class="m-unit">货币</span>
      </div>
      <div class="target-switch">
        <span class="ts-label">为谁选购</span>
        <button
          v-for="c in charNames"
          :key="c"
          type="button"
          :class="['ts-btn', { active: targetChar === c }]"
          @click="targetChar = c"
        >
          {{ c }}
        </button>
      </div>
    </div>

    <!-- 类别标签页 -->
    <nav class="cat-tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        type="button"
        :class="['cat-btn', { active: activeCat === cat }]"
        @click="activeCat = cat"
      >
        {{ cat }}
      </button>
    </nav>

    <!-- 详情栏（固定位置，点选道具查看） -->
    <div :class="['info-bar', { active: selected }]">
      <template v-if="selected">
        <div class="info-head">
          <span class="info-name">{{ selected.名称 }}</span>
          <span v-if="selected.槽位" class="info-tag">{{ selected.槽位 }}</span>
          <span v-if="selected.分类 === '装备' && selected.阶段门槛 > 1" class="info-tag dim">需阶段{{ selected.阶段门槛 }}</span>
          <span class="info-price">◈{{ selected.价格 }}</span>
        </div>
        <div class="info-desc">{{ selected.简介 }}</div>
        <div v-if="selected.分类 === '装备'" class="info-effect">
          加速 +{{ selected.加速 }}/楼 · {{ selected.类型倾向.join('/') }}
        </div>
        <div v-else-if="selected.分类 === '体改'" class="info-effect">
          永久加速 +{{ selected.加速 }}/楼 · {{ selected.类型倾向.join('/') }} · 堕落度 +{{ selected.堕落度加成 ?? 0 }}
        </div>
      </template>
      <template v-else>
        <div class="info-placeholder">点击道具查看详情</div>
      </template>
    </div>

    <!-- 道具列表（装备按槽位分组） -->
    <div class="item-list">
      <template v-for="entry in listEntries" :key="entry.kind === 'header' ? 'h-' + entry.label : entry.item!.名称">
        <div v-if="entry.kind === 'header'" class="group-header">
          <span class="group-label">{{ entry.label }}</span>
          <span class="group-line"></span>
        </div>
        <div
          v-else
          :class="['item-card', { selected: selected?.名称 === entry.item!.名称, on: isEquippedByTarget(entry.item!) }]"
          @click="selected = entry.item!"
        >
          <div class="card-top">
            <span class="card-name">{{ entry.item!.名称 }}</span>
            <span class="card-price">◈{{ entry.item!.价格 }}</span>
          </div>
          <div class="card-bot">
            <span v-if="entry.item!.分类 === '装备' || entry.item!.分类 === '体改'" class="owners">
              <span v-if="ownerState('秦璐状态', entry.item!.名称)" :class="['owner', { using: ownerState('秦璐状态', entry.item!.名称) === '装备中' }]">秦</span>
              <span v-if="ownerState('苏梦状态', entry.item!.名称)" :class="['owner', 'meng', { using: ownerState('苏梦状态', entry.item!.名称) === '装备中' }]">梦</span>
            </span>
            <button
              type="button"
              :class="['card-btn', itemUi(entry.item!).kind]"
              :disabled="itemUi(entry.item!).disabled"
              @click.stop="shopAction(entry.item!)"
            >
              {{ itemUi(entry.item!).label }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 影像档案（特别页专属：录制生成的影像，归档后可给她们看） -->
    <div v-if="activeCat === '特别' && tapeEntries.length > 0" class="tape-list">
      <div class="group-header">
        <span class="group-label">影像档案</span>
        <span class="group-line"></span>
      </div>
      <div v-for="[id, t] in tapeEntries" :key="id" class="tape-card">
        <div class="tape-main">
          <span class="tape-name">📼 {{ id }}</span>
          <span :class="['tape-desc', { pending: t.状态 !== '已就绪' }]">
            {{ t.状态 === '已就绪' ? t.摘要 : '归档中…（AI 下一轮整理摘要）' }}
          </span>
        </div>
        <button type="button" class="card-btn equip" :disabled="t.状态 !== '已就绪'" @click="watchTape(id)">
          给{{ targetChar }}看
        </button>
      </div>
    </div>

    <p v-if="msg" :class="['msg', msgType]">{{ msg }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  SHOP_ITEMS,
  CAMERA_NAME,
  buyCamera,
  buyEquipment,
  buyBodyMod,
  showTape,
  toggleEquip,
  toggleRecording,
  useConsumable,
  buyPrivilege,
  type ShopItem,
  type EquipSlot,
} from '../../../脚本/游戏逻辑/shopSystem';
import { useDataStore } from '../store';

const charNames = ['秦璐', '苏梦'] as const;
const categories = ['装备', '体改', '消耗品', '特权', '特别'] as const;
const SLOT_ORDER: EquipSlot[] = ['内着', '外装', '饰品', '妆容'];

const store = useDataStore();
const data = computed(() => store.data);
const money = computed(() => data.value?.系统?.货币 ?? 0);

const targetChar = ref<'秦璐' | '苏梦'>('秦璐');
const targetKey = computed(() => `${targetChar.value}状态` as '秦璐状态' | '苏梦状态');
const activeCat = ref<(typeof categories)[number]>('装备');
const selected = ref<ShopItem | null>(null);

const msg = ref('');
const msgType = ref<'success' | 'warn' | 'error'>('success');
function showMsg(m: string, t: 'success' | 'warn' | 'error') {
  msg.value = m;
  msgType.value = t;
  setTimeout(() => (msg.value = ''), 3000);
}

type ListEntry = { kind: 'header'; label: string } | { kind: 'item'; item: ShopItem };

const listEntries = computed<ListEntry[]>(() => {
  const items = SHOP_ITEMS.filter(i => i.分类 === activeCat.value);
  if (activeCat.value !== '装备') return items.map(i => ({ kind: 'item' as const, item: i }));
  const out: ListEntry[] = [];
  for (const slot of SLOT_ORDER) {
    const slotItems = items.filter(i => i.槽位 === slot);
    if (slotItems.length === 0) continue;
    out.push({ kind: 'header', label: slot });
    out.push(...slotItems.map(i => ({ kind: 'item' as const, item: i })));
  }
  return out;
});

/** 影像档案（录制生成；已就绪可观看） */
const tapeEntries = computed<[string, { 摘要: string; 状态: string }][]>(() =>
  Object.entries(data.value?.系统?.影像列表 ?? {}),
);

async function watchTape(tapeId: string) {
  try {
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) return;
    const err = showTape(d, targetKey.value, tapeId);
    if (err) {
      showMsg(err, 'warn');
      return;
    }
    await Mvu.replaceMvuData(vars, { type: 'message', message_id: -1 });
    showMsg(`已安排${targetChar.value}观看——下一轮演绎观看剧情（影像已销毁）`, 'success');
  } catch (e) {
    console.error('[秦璐重置版] 观看影像失败', e);
    showMsg('操作失败：' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}

function ownerState(key: '秦璐状态' | '苏梦状态', name: string): '已购买' | '装备中' | undefined {
  return data.value?.[key]?.装备状态?.[name] as any;
}
function isEquippedByTarget(item: ShopItem): boolean {
  return item.分类 === '装备' && ownerState(targetKey.value, item.名称) === '装备中';
}

function itemUi(item: ShopItem): { label: string; disabled: boolean; kind: 'buy' | 'equip' | 'unequip' | 'use' | 'none' } {
  if (item.分类 === '特别') {
    if (data.value?.系统?.道具状态?.[item.名称] !== '已购买') {
      return { label: '购买', disabled: money.value < item.价格, kind: 'buy' };
    }
    return data.value?.系统?._录像?.录制中
      ? { label: '⏹ 停止录制', disabled: false, kind: 'unequip' }
      : { label: '● 开始录制', disabled: false, kind: 'equip' };
  }
  if (item.分类 === '特权') {
    if (item.未上架) return { label: '未上架', disabled: true, kind: 'none' };
    if (data.value?.系统?.道具状态?.[item.名称] === '已购买') return { label: '已生效', disabled: true, kind: 'none' };
    return { label: '购买', disabled: money.value < item.价格, kind: 'buy' };
  }
  if (item.分类 === '消耗品') {
    return { label: `对${targetChar.value}使用`, disabled: money.value < item.价格, kind: 'use' };
  }
  if (item.分类 === '体改') {
    if (ownerState(targetKey.value, item.名称)) return { label: '已改造', disabled: true, kind: 'none' };
    const stage = data.value?.[targetKey.value]?.当前阶段 ?? 1;
    if (stage < item.阶段门槛) return { label: `需阶段${item.阶段门槛}`, disabled: true, kind: 'none' };
    return { label: '改造', disabled: money.value < item.价格, kind: 'buy' };
  }
  // 装备：能买即能穿——购买与装备同吃阶段门槛
  const st = ownerState(targetKey.value, item.名称);
  const stage = data.value?.[targetKey.value]?.当前阶段 ?? 1;
  if (!st) {
    if (stage < item.阶段门槛) return { label: `需阶段${item.阶段门槛}`, disabled: true, kind: 'none' };
    return { label: '购买', disabled: money.value < item.价格, kind: 'buy' };
  }
  if (st === '装备中') return { label: '卸下', disabled: false, kind: 'unequip' };
  if (stage < item.阶段门槛) return { label: `需阶段${item.阶段门槛}`, disabled: true, kind: 'none' };
  return { label: '装备', disabled: false, kind: 'equip' };
}

async function shopAction(item: ShopItem) {
  const ui = itemUi(item);
  if (ui.disabled || ui.kind === 'none') return;
  try {
    const key = targetKey.value;
    const vars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    const d = _.get(vars, 'stat_data') as any;
    if (!d?.系统) {
      showMsg('变量未初始化，请先发一条消息让 AI 回复', 'warn');
      return;
    }
    let err: string | null = null;
    let extra = '';
    if (item.分类 === '特别') {
      if (ui.kind === 'buy') {
        err = buyCamera(d);
      } else {
        const r = toggleRecording(d, SillyTavern.chat?.length ?? 0, targetChar.value);
        err = r.error ?? null;
        if (r.started) extra = `，镜头已就位（目标：${targetChar.value}）`;
        if (r.stopped) extra = r.overwrote
          ? '，影像已生成（覆盖旧影像）——AI 下一轮归档摘要'
          : '，影像已生成——AI 下一轮归档摘要后即可给她们看';
      }
    } else if (item.分类 === '特权') {
      err = buyPrivilege(d, item.名称);
    } else if (item.分类 === '消耗品') {
      err = useConsumable(d, key, item.名称, SillyTavern.chat?.length ?? 0);
    } else if (item.分类 === '体改') {
      err = buyBodyMod(d, key, item.名称);
      if (!err) extra = '，改造完成（永久）——下一轮她会有反应';
    } else if (ui.kind === 'buy') {
      err = buyEquipment(d, key, item.名称);
    } else {
      const r = toggleEquip(d, key, item.名称);
      err = r.error ?? null;
      if (r.firstWear) extra = '，下一轮将演绎你把它交给她';
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
</script>

<style scoped lang="scss">
$safe: #79c48a;
$warn: #e8a94f;
$danger: #e06868;
$serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;

.shop-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

// ━━━ 页头 ━━━
.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.money {
  display: flex;
  align-items: baseline;
  gap: 5px;

  .m-icon {
    color: var(--acc);
    text-shadow: 0 0 8px var(--glow);
  }
  .m-val {
    font-size: 18px;
    font-weight: 800;
    color: var(--acc);
    text-shadow: 0 0 12px var(--glow);
    font-variant-numeric: tabular-nums;
  }
  .m-unit {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 45%, #887);
    letter-spacing: 1px;
  }
}
.target-switch {
  display: flex;
  align-items: center;
  gap: 6px;

  .ts-label {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 45%, #887);
    letter-spacing: 1px;
    margin-right: 2px;
  }
  .ts-btn {
    padding: 4px 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.28);
    color: #b9ad9a;
    font-size: 12px;
    font-family: inherit;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.25s;

    &.active {
      color: var(--acc);
      font-weight: 700;
      border-color: color-mix(in srgb, var(--acc) 55%, transparent);
      background: color-mix(in srgb, var(--acc) 12%, transparent);
      text-shadow: 0 0 8px var(--glow);
    }
  }
}

// ━━━ 类别 tabs ━━━
.cat-tabs {
  display: flex;
  gap: 6px;
}
.cat-btn {
  flex: 1;
  padding: 7px 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.24);
  color: #b9ad9a;
  font-size: 12px;
  font-family: inherit;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.25s;

  &.active {
    color: var(--acc);
    font-weight: 700;
    border-color: color-mix(in srgb, var(--acc) 50%, transparent);
    background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 13%, transparent), transparent);
  }
}

// ━━━ 详情栏 ━━━
.info-bar {
  min-height: 52px;
  padding: 8px 12px;
  border: 1px dashed var(--line);
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.22);
  transition: border-color 0.25s;

  &.active {
    border-style: solid;
    border-color: color-mix(in srgb, var(--acc) 40%, transparent);
    background: color-mix(in srgb, var(--acc) 5%, rgba(0, 0, 0, 0.22));
  }
}
.info-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.info-name {
  font-family: $serif;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--acc);
  text-shadow: 0 0 8px var(--glow);
}
.info-tag {
  font-size: 9.5px;
  padding: 0 7px;
  border-radius: 8px;
  color: var(--acc);
  background: color-mix(in srgb, var(--acc) 13%, transparent);

  &.dim {
    color: $warn;
    background: rgba(232, 169, 79, 0.12);
  }
}
.info-price {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--acc);
  font-variant-numeric: tabular-nums;
}
.info-desc {
  margin-top: 3px;
  font-size: 11.5px;
  color: #b7ab98;
  letter-spacing: 0.3px;
}
.info-effect {
  margin-top: 2px;
  font-size: 10.5px;
  color: color-mix(in srgb, var(--acc) 60%, #998);
}
.info-placeholder {
  font-size: 11px;
  font-style: italic;
  color: color-mix(in srgb, var(--acc) 32%, #665);
  text-align: center;
  padding: 8px 0;
}

// ━━━ 列表：双列网格 + 固定最小高度（切类目不跳高） ━━━
.item-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  align-content: start;
  min-height: 210px;
}
@media (min-width: 640px) {
  .item-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.group-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;

  .group-label {
    font-size: 10.5px;
    color: color-mix(in srgb, var(--acc) 55%, #998);
    letter-spacing: 2px;
  }
  .group-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--line), transparent);
  }
}
.item-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 9px;
  border-radius: 8px;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  background: rgba(0, 0, 0, 0.24);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.36);
  }
  &.selected {
    border-color: color-mix(in srgb, var(--acc) 35%, transparent);
  }
  &.on {
    border-left-color: var(--acc);
    background: color-mix(in srgb, var(--acc) 7%, rgba(0, 0, 0, 0.24));
  }
}
.card-top {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.card-bot {
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-name {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: #e0d8ca;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.owners {
  display: inline-flex;
  gap: 3px;
}
.owner {
  font-size: 9px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: color-mix(in srgb, var(--acc) 75%, #ba9);
  background: color-mix(in srgb, var(--acc) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--acc) 30%, transparent);

  &.using {
    color: #16100a;
    background: var(--acc);
    font-weight: 700;
    box-shadow: 0 0 6px var(--glow);
  }
  &.meng.using {
    filter: hue-rotate(20deg);
  }
}
.card-price {
  flex: none;
  font-size: 10.5px;
  color: var(--acc);
  font-variant-numeric: tabular-nums;
}
.card-btn {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--acc) 50%, transparent);
  background: transparent;
  color: var(--acc);
  font-size: 10.5px;
  font-family: inherit;
  letter-spacing: 0.5px;
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
// ━━━ 影像档案 ━━━
.tape-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tape-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.24);

  .card-btn {
    flex: none;
    width: auto;
  }
}
.tape-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tape-name {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--acc);
}
.tape-desc {
  font-size: 11px;
  color: #b7ab98;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.pending {
    font-style: italic;
    color: color-mix(in srgb, var(--acc) 35%, #665);
  }
}

.msg {
  margin: 0;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11.5px;

  &.success {
    color: $safe;
    background: rgba(121, 196, 138, 0.1);
    border-left: 2px solid $safe;
  }
  &.warn {
    color: $warn;
    background: rgba(232, 169, 79, 0.1);
    border-left: 2px solid $warn;
  }
  &.error {
    color: $danger;
    background: rgba(224, 104, 104, 0.1);
    border-left: 2px solid $danger;
  }
}
</style>
