/**
 * 网店系统 v1 —— 参考云霜凝商店但做了四点优化：
 * 1. 对称的每角色装备表（CharacterState.装备状态），不搞"系统表+洛书晴特例表"双轨
 * 2. 槽位即互斥组：装备定义里一个 槽位 字段，同槽自动卸下（云霜凝要维护三张映射表）
 * 3. 单一 SHOP_ITEMS 目录承载全部属性（云霜凝散在五张表）
 * 4. 消耗品即买即用无库存态；不做已下线的多选批量装载
 *
 * v1 启用范围（见 设计文档/装备与商店目录.md）：
 * - 装备：加速 + 阶段门槛两个钩子生效；风险/越级钥匙字段填数据不接逻辑（越级闸门测试期关闭）
 * - 消耗品：效果全接入（借口短信→疑心冻结字段；安神药/头孢酒→越级药效字段），
 *   在疑心累积规则/越级闸门上线前处于"机制完整但暂时惰性"状态
 * - 特权：植入扩容/精确植入生效；瞬发植入未上架（二期）
 */

import type { SchemaType } from '../../schema';
import type { ThoughtCategoryValue } from './thoughtEngine';

export type CharKey = '秦璐状态' | '苏梦状态';
export type EquipSlot = '内着' | '外装' | '饰品' | '妆容';

export interface ShopItem {
  名称: string;
  分类: '装备' | '消耗品' | '特权';
  槽位?: EquipSlot;
  阶段门槛: number;
  类型倾向: ThoughtCategoryValue[];
  /** 装备中，匹配类型的培育中念头每楼额外进度 */
  加速: number;
  /** 疑心风险档位（v1 仅数据，逻辑待疑心累积规则上线） */
  风险: number;
  /** 越级钥匙：装备中匹配类型有效阶段+1（v1 仅数据，越级闸门测试期关闭） */
  越级钥匙: boolean;
  价格: number;
  简介: string;
  /** 首次装备注入的一次性剧情事件 */
  首穿?: string;
  未上架?: boolean;
}

/** 首批 18 件：12 装备（4槽×3档）+ 3 消耗品 + 3 特权。数值待平衡阶段统一调 */
export const SHOP_ITEMS: ShopItem[] = [
  // ━━━━ 内着（身体开放/性行为域） ━━━━
  {
    名称: '蕾丝内衣',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 2,
    类型倾向: ['身体开放'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 150,
    简介: '贴身的秘密，只有她自己知道',
    首穿: '她背着丈夫，把你买的蕾丝内衣贴身穿上了——一整天都心不在焉地感觉着它的存在',
  },
  {
    名称: '开衩情趣内衣',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 3,
    类型倾向: ['身体开放', '性行为'],
    加速: 1,
    风险: 2,
    越级钥匙: true,
    价格: 300,
    简介: '穿上它，某些念头就不再遥远',
    首穿: '她锁上房门试穿了那件开衩内衣，在镜子前站了很久，脸越来越红',
  },
  {
    名称: '隐形乳贴',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 500,
    简介: '从此她与"真空"之间只隔一层薄薄的贴片',
    首穿: '她第一次不穿内衣、只贴着乳贴出现在家人面前，每一步都心跳如鼓',
  },
  // ━━━━ 外装（肢体亲近/暧昧互动域） ━━━━
  {
    名称: '修身连衣裙',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 1,
    类型倾向: ['肢体亲近'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 100,
    简介: '恰到好处地勾勒身形，靠近变得自然',
    首穿: '她穿上你挑的连衣裙照了照镜子，久违地觉得自己还很美',
  },
  {
    名称: '低胸针织衫',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 3,
    类型倾向: ['暧昧互动', '肢体亲近'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 250,
    简介: '弯腰的每一个瞬间都是暗示',
    首穿: '她犹豫了很久还是穿上了那件低胸针织衫，出门前对着镜子拉了三次领口',
  },
  {
    名称: '透视睡裙',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 4,
    类型倾向: ['暧昧互动', '身体开放'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 450,
    简介: '夜里的家，从此有了别的意味',
    首穿: '深夜，她穿着那件半透的睡裙走出房间倒水，知道你可能会看见',
  },
  // ━━━━ 饰品（身份认同/绝对服从/家庭替代域） ━━━━
  {
    名称: '红绳手链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 1,
    类型倾向: ['情感依赖'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 100,
    简介: '你亲手替她系上的，她舍不得摘',
    首穿: '你替她把红绳系在手腕上，她低头看了很久，嘴角有藏不住的笑',
  },
  {
    名称: '贴颈链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 3,
    类型倾向: ['绝对服从'],
    加速: 1,
    风险: 1,
    越级钥匙: false,
    价格: 300,
    简介: '像项圈又不是项圈，贴着喉咙的归属感',
    首穿: '她戴上那条贴颈链，手指抚过喉前的搭扣，心里浮起一个说不清的词——"属于"',
  },
  {
    名称: '素圈戒指',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 5,
    类型倾向: ['家庭替代'],
    加速: 1.5,
    风险: 2,
    越级钥匙: true,
    价格: 600,
    简介: '你送的。戴上它意味着什么，她比谁都清楚',
    首穿: '她摘下了婚戒，把你送的素圈戒指戴上无名指——对着那只手看了很久很久',
  },
  // ━━━━ 妆容（情感依赖/暧昧互动域） ━━━━
  {
    名称: '雾致香水',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 1,
    类型倾向: ['情感依赖'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 100,
    简介: '若有似无的香气，是为谁喷的',
    首穿: '她在手腕上试了那支香水，出门前又在耳后补了一点——平时她从不这样',
  },
  {
    名称: '正红色口红',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 3,
    类型倾向: ['暧昧互动'],
    加速: 1,
    风险: 1,
    越级钥匙: false,
    价格: 250,
    简介: '这个色号，不是涂给丈夫看的',
    首穿: '她对着镜子涂上正红色的口红，抿了抿唇——镜子里的女人陌生又鲜活',
  },
  {
    名称: '魅惑晚妆',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 4,
    类型倾向: ['暧昧互动', '性行为'],
    加速: 1.5,
    风险: 2,
    越级钥匙: false,
    价格: 450,
    简介: '眼尾上挑的那一笔，画的是欲望',
    首穿: '她照着教程画了个从没画过的晚妆，眼尾微挑、唇色浓艳——她知道今晚想让谁看到',
  },
  // ━━━━ 消耗品（即买即用） ━━━━
  {
    名称: '借口短信',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 80,
    简介: '一条及时的解释短信，冻结苏文对她的疑心 10 楼',
  },
  {
    名称: '安神药',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 200,
    简介: '她今晚格外放松——5 楼内有效阶段 +1（越级闸门恢复后生效）',
  },
  {
    名称: '头孢酒',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 350,
    简介: '意识的门槛被泡软了——3 楼内有效阶段 +2（越级闸门恢复后生效）',
  },
  // ━━━━ 特权（全局永久，货币终极去处） ━━━━
  {
    名称: '植入扩容',
    分类: '特权',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 800,
    简介: '每楼植入上限 3 → 4',
  },
  {
    名称: '精确植入',
    分类: '特权',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 600,
    简介: '念头字数上限 10 → 20，后期行为编程必备',
  },
  {
    名称: '瞬发植入',
    分类: '特权',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 1500,
    简介: '免判定直植（二期上架）',
    未上架: true,
  },
];

export const ITEM_MAP: Record<string, ShopItem> = Object.fromEntries(SHOP_ITEMS.map(i => [i.名称, i]));

// ────────────────────────────────────────────
// 购买 / 装备 / 卸下
// ────────────────────────────────────────────

/** 购买装备（各买各的）。返回错误信息，null=成功 */
export function buyEquipment(data: SchemaType, charKey: CharKey, name: string): string | null {
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '装备') return '未知装备';
  if (data[charKey].装备状态[name]) return '已购买过';
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  data[charKey].装备状态[name] = '已购买';
  console.info(`[网店] ${charKey} 购入「${name}」-${item.价格} (余${data.系统.货币})`);
  return null;
}

/**
 * 装备/卸下 toggle。装备时同槽自动卸下；首次装备写入首穿事件。
 * 返回 { error } 或 { firstWear }
 */
export function toggleEquip(
  data: SchemaType,
  charKey: CharKey,
  name: string,
): { error?: string; firstWear?: boolean } {
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '装备' || !item.槽位) return { error: '未知装备' };
  const state = data[charKey].装备状态[name];
  if (!state) return { error: '未购买' };

  // 卸下
  if (state === '装备中') {
    data[charKey].装备状态[name] = '已购买';
    console.info(`[网店] ${charKey} 卸下「${name}」`);
    return {};
  }

  // 装备：阶段门槛
  if (data[charKey].当前阶段 < item.阶段门槛) {
    return { error: `她还接受不了（需阶段${item.阶段门槛}）` };
  }
  // 槽位即互斥组：同槽自动卸下
  for (const [other, s] of Object.entries(data[charKey].装备状态)) {
    if (other !== name && s === '装备中' && ITEM_MAP[other]?.槽位 === item.槽位) {
      data[charKey].装备状态[other] = '已购买';
      console.info(`[网店] ${charKey} 同槽卸下「${other}」`);
    }
  }
  data[charKey].装备状态[name] = '装备中';

  // 首穿事件（只发一次，MVU 持久字段防 reload 重置）
  const wearKey = `${charKey}:${name}`;
  let firstWear = false;
  if (item.首穿 && !data.系统._已首穿[wearKey]) {
    data.系统._已首穿[wearKey] = true;
    const charName = charKey === '秦璐状态' ? '秦璐' : '苏梦';
    const event = `${charName}：${item.首穿}`;
    data.系统._待发送道具事件 = data.系统._待发送道具事件
      ? `${data.系统._待发送道具事件}|${event}`
      : event;
    firstWear = true;
  }
  console.info(`[网店] ${charKey} 装备「${name}」${firstWear ? '（首穿）' : ''}`);
  return { firstWear };
}

/** 装备加速合计：该角色装备中、类型倾向匹配的加速值之和 */
export function getEquipBoost(data: SchemaType, charKey: CharKey, category: ThoughtCategoryValue): number {
  let boost = 0;
  for (const [name, state] of Object.entries(data[charKey].装备状态)) {
    if (state !== '装备中') continue;
    const item = ITEM_MAP[name];
    if (item && item.类型倾向.includes(category)) boost += item.加速;
  }
  return boost;
}

/** 装备中的物品名列表（快照注入用） */
export function getEquippedNames(data: SchemaType, charKey: CharKey): string[] {
  return Object.entries(data[charKey].装备状态)
    .filter(([, s]) => s === '装备中')
    .map(([n]) => n);
}

// ────────────────────────────────────────────
// 消耗品（即买即用，目标=当前角色）
// ────────────────────────────────────────────

export function useConsumable(
  data: SchemaType,
  charKey: CharKey,
  name: string,
  currentFloor: number,
): string | null {
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '消耗品') return '未知消耗品';
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;

  const charName = charKey === '秦璐状态' ? '秦璐' : '苏梦';
  if (name === '借口短信') {
    const freezeKey = charKey === '秦璐状态' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';
    data.苏文状态[freezeKey] = {
      是否冻结: true,
      借口内容: '一条及时的解释短信',
      冻结结束楼层: currentFloor + 10,
    };
  } else if (name === '安神药') {
    data[charKey]._越级加成 = 1;
    data[charKey]._越级加成至楼层 = currentFloor + 5;
  } else if (name === '头孢酒') {
    data[charKey]._越级加成 = 2;
    data[charKey]._越级加成至楼层 = currentFloor + 3;
  }
  console.info(`[网店] 对${charName}使用「${name}」-${item.价格} (余${data.系统.货币})`);
  return null;
}

// ────────────────────────────────────────────
// 特权（全局永久，复用 系统.道具状态）
// ────────────────────────────────────────────

export function buyPrivilege(data: SchemaType, name: string): string | null {
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '特权') return '未知特权';
  if (item.未上架) return '暂未上架';
  if (data.系统.道具状态[name] === '已购买') return '已购买过';
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  data.系统.道具状态[name] = '已购买';
  console.info(`[网店] 特权「${name}」解锁 -${item.价格} (余${data.系统.货币})`);
  return null;
}

/** 每楼植入上限（基础3 + 植入扩容特权） */
export function getImplantLimit(data: { 系统: { 道具状态: Record<string, string> } }): number {
  return 3 + (data.系统.道具状态['植入扩容'] === '已购买' ? 1 : 0);
}

/** 念头字数上限（基础10 + 精确植入特权→20） */
export function getThoughtMaxLen(data: { 系统: { 道具状态: Record<string, string> } }): number {
  return data.系统.道具状态['精确植入'] === '已购买' ? 20 : 10;
}
