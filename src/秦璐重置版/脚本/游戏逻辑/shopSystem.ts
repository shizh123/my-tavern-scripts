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
import { getStageByCorruption, getStageConfig, getStageTitle } from '../../stageConfig';
import type { ThoughtCategoryValue } from './thoughtEngine';

export type CharKey = '秦璐状态' | '苏梦状态';
export type EquipSlot = '内着' | '外装' | '饰品' | '妆容';

export interface ShopItem {
  名称: string;
  分类: '装备' | '消耗品' | '特权' | '体改';
  槽位?: EquipSlot;
  阶段门槛: number;
  类型倾向: ThoughtCategoryValue[];
  /** 装备中（体改=已改造即永久生效），匹配类型的培育中念头每楼额外进度 */
  加速: number;
  /** 疑心风险档位（v1 仅数据，逻辑待疑心累积规则上线） */
  风险: number;
  /** 越级钥匙：装备中匹配类型有效阶段+1（v1 仅数据，越级闸门测试期关闭） */
  越级钥匙: boolean;
  价格: number;
  简介: string;
  /** 首次装备/改造注入的一次性剧情事件 */
  首穿?: string;
  /** 体改专用：改造时一次性结算的堕落度（花钱买的堕落刻度） */
  堕落度加成?: number;
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
  {
    名称: '无痕丁字裤',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 2,
    类型倾向: ['身体开放'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 180,
    简介: '几乎不存在的一条线，时刻提醒她它的存在',
    首穿: '她穿上那条几乎不存在的丁字裤做家务，陌生的异物感让她一整天心不在焉',
  },
  {
    名称: '情趣三点式',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 3,
    类型倾向: ['身体开放', '性行为'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 350,
    简介: '三块布料和几根细带，穿上不是为了遮',
    首穿: '她锁上门穿好那套三点式，对着镜子侧过身——布料遮住的部分少得可怜，她却没有立刻脱下来',
  },
  {
    名称: '开裆连裤袜',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 480,
    简介: '看起来是端庄的连裤袜，只有她知道那处开口',
    首穿: '她穿上那双连裤袜，表面与平日无异——只有她自己知道走动时那处开口带来的凉意',
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
  {
    名称: '紧身瑜伽套装',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 2,
    类型倾向: ['肢体亲近', '暧昧互动'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 200,
    简介: '"在家锻炼"是最好的借口，曲线是最好的语言',
    首穿: '她换上瑜伽服在客厅拉伸，紧贴的布料勾出每一寸曲线——她说只是想锻炼身体',
  },
  {
    名称: '露脐短打',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 3,
    类型倾向: ['暧昧互动'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 280,
    简介: '这个年纪穿这个？她犹豫了很久，还是穿了',
    首穿: '她第一次穿上露脐的短上衣，反复在镜子前打量腰腹——"会不会太年轻了……"嘴上这么说，却没换下来',
  },
  {
    名称: '真空围裙',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 4,
    类型倾向: ['身体开放', '性行为'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 520,
    简介: '厨房里最危险的穿法，背后一览无余',
    首穿: '趁家里只有你们两人，她只系着围裙站进了厨房——转身盛汤时，裸露的背影让空气都凝固了',
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
  {
    名称: '情侣项链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 2,
    类型倾向: ['情感依赖', '身份认同'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 150,
    简介: '成对的那一条在你脖子上',
    首穿: '她戴上项链才反应过来这是成对的——另一条在你身上。她摸着吊坠愣了一会儿，没有摘',
  },
  {
    名称: '肚脐链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 3,
    类型倾向: ['身体开放'],
    加速: 1,
    风险: 1,
    越级钥匙: false,
    价格: 280,
    简介: '藏在衣服下的细链，贴着小腹微凉',
    首穿: '她把那条细链系在腰腹上，衣服一盖谁也看不见——可正因为看不见，才像个秘密',
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
  {
    名称: '鲜红美甲',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 2,
    类型倾向: ['暧昧互动'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 150,
    简介: '十指鲜红，做家务时格外扎眼',
    首穿: '她涂好鲜红的指甲，晾干时忽然想到——这双手明天还要给全家做饭。想着想着，耳根有点热',
  },
  {
    名称: '催情香水',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 1.5,
    风险: 1,
    越级钥匙: false,
    价格: 480,
    简介: '喷在耳后与锁骨，气味只对凑得够近的人生效',
    首穿: '她把那支香水喷在耳后和锁骨，甜腻的气味在皮肤上化开——只有凑得足够近的人才闻得到',
  },
  // ━━━━ 体改（一次性改造，永久生效不占槽；花钱买的堕落刻度） ━━━━
  {
    名称: '肚脐环',
    分类: '体改',
    阶段门槛: 4,
    类型倾向: ['暧昧互动'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 400,
    堕落度加成: 4,
    简介: '第一枚穿刺，藏在衣服下的小小叛逆',
    首穿: '她躺在穿刺店的椅子上，针穿过脐缘的刺痛让她攥紧了拳——回家的路上，她一直隔着衣服摸那枚小环',
  },
  {
    名称: '舌环',
    分类: '体改',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 500,
    堕落度加成: 4,
    简介: '说话时看不见，用处只有彼此知道',
    首穿: '舌尖多了一粒金属珠，她说话时总不自觉抵着上颚——她很清楚这东西是做什么用的',
  },
  {
    名称: '乳头环',
    分类: '体改',
    阶段门槛: 4,
    类型倾向: ['身体开放'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 600,
    堕落度加成: 4,
    简介: '每一次布料摩擦都是提醒',
    首穿: '两侧的刺痛过去后，是挥之不去的敏感——她换衣服时对着镜子看了很久那两点银光',
  },
  {
    名称: '后腰蝶纹',
    分类: '体改',
    阶段门槛: 4,
    类型倾向: ['暧昧互动'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 550,
    堕落度加成: 4,
    简介: '弯腰时若隐若现的一只蝴蝶',
    首穿: '纹身师的针在后腰游走了两个小时。回家后她背对镜子撩起衣摆——那只蝴蝶正停在最暧昧的位置',
  },
  {
    名称: '下腹淫纹',
    分类: '体改',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 700,
    堕落度加成: 5,
    简介: '小腹上那枚纹样的含义，懂的人一眼就懂',
    首穿: '她要求纹身师照着那张图纹在小腹——针尖游走时她脸红得像烧起来，因为她知道这个纹样意味着什么',
  },
  {
    名称: '阴蒂环',
    分类: '体改',
    阶段门槛: 5,
    类型倾向: ['性行为'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 800,
    堕落度加成: 5,
    简介: '最私密处的永久饰品，每一步都是折磨与享受',
    首穿: '这是她做过最出格的决定。愈合的那几天她走路都小心翼翼——从此每一步轻微的牵动都在提醒她自己变成了什么',
  },
  {
    名称: '隆胸手术',
    分类: '体改',
    阶段门槛: 5,
    类型倾向: ['身体开放'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 1200,
    堕落度加成: 6,
    简介: '以"变得更好看"为名，身体从此为欲望服务',
    首穿: '拆线那天她站在镜子前，胸前的弧度陌生又饱满——旧衣服全都紧了，她心跳着想：他会注意到的',
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
    简介: '每名角色培育槽 3 → 4',
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
// 装备 ↔ 仪容字段写回（对标云霜凝 syncClothing）
// 装备时写入服装/妆容显示字段；卸下（含同槽替换）时恢复当前阶段默认外观
// ────────────────────────────────────────────

type ClothingPart =
  | '上装'
  | '下装'
  | '内衣上'
  | '内衣下'
  | '袜裤'
  | '配饰'
  | '特殊装饰'
  | '唇妆'
  | '眼妆'
  | '特殊妆容'
  | '香氛';

/** 物品名 → 写入的仪容字段。服装细节/妆容细节 变量是穿着的唯一事实源，每件装备都必须有映射 */
const CLOTHING_WRITE: Record<string, Partial<Record<ClothingPart, string>>> = {
  蕾丝内衣: { 内衣上: '黑色蕾丝文胸', 内衣下: '黑色蕾丝内裤' },
  无痕丁字裤: { 内衣下: '无痕丁字裤' },
  情趣三点式: { 内衣上: '情趣三点式·细带束乳', 内衣下: '情趣三点式·细绳裆' },
  开衩情趣内衣: { 内衣上: '开衩连体情趣内衣' },
  隐形乳贴: { 内衣上: '隐形乳贴（未穿文胸）' },
  开裆连裤袜: { 袜裤: '开裆连裤袜' },
  修身连衣裙: { 上装: '修身连衣裙', 下装: '（连衣裙一体）' },
  低胸针织衫: { 上装: '低胸针织衫' },
  露脐短打: { 上装: '露脐短打上衣' },
  紧身瑜伽套装: { 上装: '紧身瑜伽上衣', 下装: '紧身瑜伽裤' },
  透视睡裙: { 上装: '透视薄纱睡裙', 下装: '（睡裙一体）' },
  真空围裙: { 上装: '真空围裙（裸身仅围裙）', 下装: '无' },
  红绳手链: { 配饰: '红绳手链' },
  情侣项链: { 配饰: '情侣项链（成对的那条在他身上）' },
  素圈戒指: { 配饰: '他送的素圈戒指（婚戒已摘下）' },
  贴颈链: { 特殊装饰: '贴颈链' },
  肚脐链: { 特殊装饰: '肚脐链' },
  正红色口红: { 唇妆: '正红色口红' },
  魅惑晚妆: { 眼妆: '魅惑晚妆·眼尾上挑', 唇妆: '浓艳红唇' },
  鲜红美甲: { 特殊妆容: '十指鲜红长甲' },
  雾致香水: { 香氛: '若有似无的雾致香水' },
  催情香水: { 香氛: '耳后与锁骨的甜腻催情香' },
};

function setClothingPart(data: SchemaType, charKey: CharKey, part: ClothingPart, text: string): void {
  const c = data[charKey];
  switch (part) {
    case '上装':
      c.服装细节.上装 = text;
      break;
    case '下装':
      c.服装细节.下装 = text;
      break;
    case '内衣上':
      c.服装细节.内衣.上 = text;
      break;
    case '内衣下':
      c.服装细节.内衣.下 = text;
      break;
    case '袜裤':
      c.服装细节.袜裤 = text;
      break;
    case '配饰':
      c.服装细节.配饰 = text;
      break;
    case '特殊装饰':
      c.服装细节.特殊装饰 = text;
      break;
    case '唇妆':
      c.妆容细节.唇妆 = text;
      break;
    case '眼妆':
      c.妆容细节.眼妆 = text;
      break;
    case '特殊妆容':
      c.妆容细节.特殊妆容 = text;
      break;
    case '香氛':
      c.妆容细节.香氛 = text;
      break;
  }
}

/** 装备时写入该物品的仪容字段 */
function applyClothingParts(data: SchemaType, charKey: CharKey, itemName: string): void {
  const write = CLOTHING_WRITE[itemName];
  if (!write) return;
  for (const [part, text] of Object.entries(write)) {
    setClothingPart(data, charKey, part as ClothingPart, text as string);
  }
}

/** 卸下时把该物品写过的字段恢复为当前阶段默认外观 */
function restoreClothingParts(data: SchemaType, charKey: CharKey, itemName: string): void {
  const write = CLOTHING_WRITE[itemName];
  if (!write) return;
  const cfg = getStageConfig(data[charKey].当前阶段);
  if (!cfg) return;
  const d = cfg.默认外观;
  const defaults: Record<ClothingPart, string> = {
    上装: d.服装.上装,
    下装: d.服装.下装,
    内衣上: d.服装.内衣上,
    内衣下: d.服装.内衣下,
    袜裤: d.服装.袜裤,
    配饰: d.服装.配饰,
    特殊装饰: d.服装.特殊装饰,
    唇妆: d.妆容.唇妆,
    眼妆: d.妆容.眼妆,
    特殊妆容: d.妆容.特殊妆容,
    香氛: '无',
  };
  for (const part of Object.keys(write) as ClothingPart[]) {
    setClothingPart(data, charKey, part, defaults[part]);
  }
}

// ────────────────────────────────────────────
// 购买 / 装备 / 卸下
// ────────────────────────────────────────────

/** 追加一条一次性剧情事件（下一轮注入 AI 后清空） */
export function queueItemEvent(data: SchemaType, charKey: CharKey, text: string): void {
  const charName = charKey === '秦璐状态' ? '秦璐' : '苏梦';
  const event = `${charName}：${text}`;
  data.系统._待发送道具事件 = data.系统._待发送道具事件
    ? `${data.系统._待发送道具事件}|${event}`
    : event;
}

/** 购买装备（各买各的）。能买即能穿：购买同样吃阶段门槛。返回错误信息，null=成功 */
export function buyEquipment(data: SchemaType, charKey: CharKey, name: string): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '装备') return '未知装备';
  if (data[charKey].装备状态[name]) return '已购买过';
  if (data[charKey].当前阶段 < item.阶段门槛) return `她还接受不了（需阶段${item.阶段门槛}）`;
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  data[charKey].装备状态[name] = '已购买';
  console.info(`[网店] ${charKey} 购入「${name}」-${item.价格} (余${data.系统.货币})`);
  return null;
}

/**
 * 装备/卸下 toggle。装备时同槽自动卸下。
 * 换装叙事桥：每次装备/卸下都注入一次性换装事件（首穿用专属文案，之后用通用文案），
 * 否则 AI 只见变量突变、无叙事依据，会跟随历史正文忽略换装。
 * 返回 { error } 或 { firstWear }
 */
export function toggleEquip(
  data: SchemaType,
  charKey: CharKey,
  name: string,
): { error?: string; firstWear?: boolean } {
  if (data.系统._坏结局) return { error: '结局已锁定' };
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '装备' || !item.槽位) return { error: '未知装备' };
  const state = data[charKey].装备状态[name];
  if (!state) return { error: '未购买' };

  // 卸下：恢复该件写过的仪容字段为当前阶段默认
  if (state === '装备中') {
    data[charKey].装备状态[name] = '已购买';
    restoreClothingParts(data, charKey, name);
    queueItemEvent(data, charKey, `她已换下「${name}」，相应部位恢复日常穿着（以服装/妆容细节变量为准）`);
    console.info(`[网店] ${charKey} 卸下「${name}」`);
    return {};
  }

  // 装备：阶段门槛
  if (data[charKey].当前阶段 < item.阶段门槛) {
    return { error: `她还接受不了（需阶段${item.阶段门槛}）` };
  }
  // 槽位即互斥组：同槽自动卸下（并恢复其仪容字段，随后由新件覆盖；换装事件由新件统一承载）
  for (const [other, s] of Object.entries(data[charKey].装备状态)) {
    if (other !== name && s === '装备中' && ITEM_MAP[other]?.槽位 === item.槽位) {
      data[charKey].装备状态[other] = '已购买';
      restoreClothingParts(data, charKey, other);
      console.info(`[网店] ${charKey} 同槽卸下「${other}」`);
    }
  }
  data[charKey].装备状态[name] = '装备中';
  applyClothingParts(data, charKey, name);

  // 换装事件：首穿用专属文案（只发一次，MVU 持久字段防 reload 重置），复穿用通用文案
  const wearKey = `${charKey}:${name}`;
  let firstWear = false;
  if (item.首穿 && !data.系统._已首穿[wearKey]) {
    data.系统._已首穿[wearKey] = true;
    queueItemEvent(data, charKey, item.首穿);
    firstWear = true;
  } else {
    queueItemEvent(data, charKey, `她已换上「${name}」（服装/妆容细节变量已同步，请让她自然完成换装或以新装扮登场）`);
  }
  console.info(`[网店] ${charKey} 装备「${name}」${firstWear ? '（首穿）' : ''}`);
  return { firstWear };
}

/** 装备加速合计：装备中的仪容 + 已完成的体改（永久生效不占槽），类型倾向匹配 */
export function getEquipBoost(data: SchemaType, charKey: CharKey, category: ThoughtCategoryValue): number {
  let boost = 0;
  for (const [name, state] of Object.entries(data[charKey].装备状态)) {
    const item = ITEM_MAP[name];
    if (!item) continue;
    const active = state === '装备中' || (item.分类 === '体改' && state === '已购买');
    if (!active) continue;
    if (item.类型倾向.includes(category)) boost += item.加速;
  }
  return boost;
}

/**
 * 体改（一次性购买即改造）：写入 身体改造 字段 + 堕落度结算 + 阶段校正 + 改造事件
 * 永久生效、不可卸下、各买各的；阶段门槛对齐 stageConfig 允许身体改造(阶4+)
 */
export function buyBodyMod(data: SchemaType, charKey: CharKey, name: string): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '体改') return '未知改造项目';
  if (data[charKey].装备状态[name]) return '已完成该改造';
  if (data[charKey].当前阶段 < item.阶段门槛) return `她还接受不了（需阶段${item.阶段门槛}）`;
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  data[charKey].装备状态[name] = '已购买';

  // 写入身体改造字段（schema 现成结构）
  const mod = data[charKey].身体改造;
  switch (name) {
    case '肚脐环':
      mod.穿刺.肚脐环 = true;
      break;
    case '舌环':
      mod.穿刺.舌环 = true;
      break;
    case '乳头环':
      mod.穿刺.乳头环 = true;
      break;
    case '阴蒂环':
      mod.穿刺.阴蒂环 = true;
      break;
    case '后腰蝶纹':
      mod.纹身['后腰'] = '一只展翅的蝴蝶，弯腰时若隐若现';
      break;
    case '下腹淫纹':
      mod.纹身['下腹'] = '一枚淫靡的纹样，情动时仿佛在发烫';
      break;
    case '隆胸手术':
      mod.体态变化 = '胸部隆至G罩杯，旧衣尽紧，身形愈发淫靡';
      break;
  }

  // 堕落度结算 + 阶段校正（体改 = 花钱买的堕落刻度）
  if (item.堕落度加成) {
    data[charKey].堕落度 = Math.min(100, data[charKey].堕落度 + item.堕落度加成);
    const ns = getStageByCorruption(data[charKey].堕落度);
    if (ns > data[charKey].当前阶段) {
      data[charKey].当前阶段 = ns;
      data[charKey].阶段标题 = getStageTitle(ns) as any;
      console.info(`[体改] ${charKey} 阶段提升 → ${ns}`);
    }
  }

  // 改造事件（一次性，购买即唯一，无需额外幂等标记）
  if (item.首穿) {
    const charName = charKey === '秦璐状态' ? '秦璐' : '苏梦';
    const event = `${charName}：${item.首穿}`;
    data.系统._待发送道具事件 = data.系统._待发送道具事件
      ? `${data.系统._待发送道具事件}|${event}`
      : event;
  }
  console.info(`[体改] ${charKey} 完成「${name}」-${item.价格} 堕落+${item.堕落度加成 ?? 0} (余${data.系统.货币})`);
  return null;
}

/** 装备中的物品名列表（快照注入用） */
export function getEquippedNames(data: SchemaType, charKey: CharKey): string[] {
  return Object.entries(data[charKey].装备状态)
    .filter(([, s]) => s === '装备中')
    .map(([n]) => n);
}

/** 已完成的体改项目名列表（永久；快照/界面共用） */
export function getBodyModNames(data: SchemaType, charKey: CharKey): string[] {
  return Object.keys(data[charKey].装备状态).filter(n => ITEM_MAP[n]?.分类 === '体改');
}

/**
 * 装备中的"非日常"装扮（风险 ≥ 1；修身连衣裙/红绳手链等风险 0 的正常衣物不列入）
 * 用于快照【装扮意识】动态提示——只提醒 AI 演绎值得她"有意识"的大胆装扮
 */
export function getDaringEquippedNames(data: SchemaType, charKey: CharKey): string[] {
  return getEquippedNames(data, charKey).filter(n => (ITEM_MAP[n]?.风险 ?? 0) >= 1);
}

/**
 * 仪容星标（v0.22）：5 星 = 4 个装备槽各有网店装备 + 任意体改
 * 满星 = 全套加成：所有培育中念头 +1/楼（无视类型匹配）+ 苏文疑心 +1/楼（高收益高风险）
 */
export const OUTFIT_STAR_SLOTS = ['内着', '外装', '饰品', '妆容', '体改'] as const;

export function getOutfitStars(data: SchemaType, charKey: CharKey): { lit: boolean[]; count: number; full: boolean } {
  // 调试后门：模拟满星（星标区连点5次切换，测试满星冲刺/疑心循环）
  if (data.系统._调试满星) {
    return { lit: OUTFIT_STAR_SLOTS.map(() => true), count: OUTFIT_STAR_SLOTS.length, full: true };
  }
  const equipped = getEquippedNames(data, charKey);
  const lit = OUTFIT_STAR_SLOTS.map(slot =>
    slot === '体改'
      ? Object.keys(data[charKey].装备状态).some(n => ITEM_MAP[n]?.分类 === '体改')
      : equipped.some(n => ITEM_MAP[n]?.槽位 === slot),
  );
  const count = lit.filter(Boolean).length;
  return { lit, count, full: count === OUTFIT_STAR_SLOTS.length };
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
  if (data.系统._坏结局) return '结局已锁定';
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
  if (data.系统._坏结局) return '结局已锁定';
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

/** 每名角色培育槽上限（基础3 + 植入扩容特权；判定中+培育中计槽） */
export function getCultivationSlots(data: { 系统: { 道具状态: Record<string, string> } }): number {
  return 3 + (data.系统.道具状态['植入扩容'] === '已购买' ? 1 : 0);
}

/** 念头字数上限（基础10 + 精确植入特权→20） */
export function getThoughtMaxLen(data: { 系统: { 道具状态: Record<string, string> } }): number {
  return data.系统.道具状态['精确植入'] === '已购买' ? 20 : 10;
}
