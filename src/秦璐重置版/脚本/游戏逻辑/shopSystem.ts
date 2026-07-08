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
  分类: '装备' | '消耗品' | '特权' | '体改' | '特别';
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
  /** 消耗品专用（v0.25）：使用后 N 楼内不可再次使用（防连刷降疑/药效叠加） */
  冷却楼数?: number;
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
  {
    名称: '连体塑身衣',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 2,
    类型倾向: ['身体开放'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 200,
    简介: '从颈到胯的紧致包裹，曲线一览无余',
  },
  {
    名称: '黑丝吊袜带',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 3,
    类型倾向: ['暧昧互动', '性行为'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 320,
    简介: '长袜与腰间的细带，是最经典的暗号',
  },
  {
    名称: '珍珠链内裤',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 4,
    类型倾向: ['性行为'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 520,
    简介: '一串珍珠替代了布料，走动即是折磨',
  },
  {
    名称: '镂空连体网衣',
    分类: '装备',
    槽位: '内着',
    阶段门槛: 5,
    类型倾向: ['性行为', '绝对服从'],
    加速: 2,
    风险: 3,
    越级钥匙: true,
    价格: 800,
    简介: '与其说是穿上，不如说是被网住',
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
  {
    名称: '情侣家居服',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 1,
    类型倾向: ['陪伴交流', '情感依赖'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 120,
    简介: '成套的另一件在你衣柜里——家里心照不宣的小秘密',
  },
  {
    名称: '包臀热裤',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 2,
    类型倾向: ['暧昧互动'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 220,
    简介: '腿型和臀线毫无保留',
  },
  {
    名称: '侧开衩旗袍',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 3,
    类型倾向: ['暧昧互动', '身体开放'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 350,
    简介: '走一步开衩滑到大腿——古典是最好的伪装',
  },
  {
    名称: '他的白衬衫',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 4,
    类型倾向: ['家庭替代', '身份认同'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 480,
    简介: '从你衣柜里拿走的那件——下摆刚好遮住的长度，只穿这一件',
  },
  {
    名称: '酒红缎面裙',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 3,
    类型倾向: ['暧昧互动'],
    加速: 1,
    风险: 1,
    越级钥匙: false,
    价格: 320,
    简介: '缎面流光衬得气色极好——好看到家里人都会注意到',
  },
  {
    名称: '暗扣高领裙',
    分类: '装备',
    槽位: '外装',
    阶段门槛: 5,
    类型倾向: ['家庭替代', '性行为'],
    加速: 2,
    风险: 1,
    越级钥匙: false,
    价格: 750,
    简介: '他眼里无可挑剔的端庄——侧缝那道隐形拉链的位置，只有你知道',
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
  {
    名称: '珍珠耳坠',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 1,
    类型倾向: ['情感依赖'],
    加速: 0.5,
    风险: 0,
    越级钥匙: false,
    价格: 120,
    简介: '摇曳在耳畔的温柔，是他挑的',
  },
  {
    名称: '纤细脚链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 2,
    类型倾向: ['暧昧互动', '亲密接触'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 180,
    简介: '踝骨上的一线银光，低头才看得见',
  },
  {
    名称: '玫瑰锁骨链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 3,
    类型倾向: ['暧昧互动'],
    加速: 1,
    风险: 2,
    越级钥匙: false,
    价格: 300,
    简介: '一朵玫瑰悬在锁骨窝，引人视线下移',
  },
  {
    名称: '铃铛脚链',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 4,
    类型倾向: ['绝对服从'],
    加速: 1.5,
    风险: 2,
    越级钥匙: false,
    价格: 480,
    简介: '走一步响一声——她的位置，你永远知道',
  },
  {
    名称: '皮质颈环',
    分类: '装备',
    槽位: '饰品',
    阶段门槛: 4,
    类型倾向: ['绝对服从'],
    加速: 1.5,
    风险: 3,
    越级钥匙: true,
    价格: 650,
    简介: '不是项链——戴上它意味着什么，她会慢慢懂',
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
  {
    名称: '水光唇釉',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 2,
    类型倾向: ['亲密接触'],
    加速: 0.5,
    风险: 1,
    越级钥匙: false,
    价格: 160,
    简介: '看起来就很软的唇，让人想验证',
  },
  {
    名称: '桃花眼妆',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 3,
    类型倾向: ['暧昧互动', '情感依赖'],
    加速: 1,
    风险: 1,
    越级钥匙: false,
    价格: 260,
    简介: '眼尾晕开的粉，看谁都像含情',
  },
  {
    名称: '同源沐浴露',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 5,
    类型倾向: ['身份认同', '绝对服从'],
    加速: 2,
    风险: 3,
    越级钥匙: false,
    价格: 680,
    简介: '和你用同一瓶——从此她身上是你的气味，洗不掉的那种',
  },
  {
    名称: '发情红晕妆',
    分类: '装备',
    槽位: '妆容',
    阶段门槛: 5,
    类型倾向: ['性行为'],
    加速: 2,
    风险: 2,
    越级钥匙: false,
    价格: 700,
    简介: '妆出来的红晕？还是妆不掉的那种',
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
    冷却楼数: 10,
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
    冷却楼数: 5,
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
    冷却楼数: 5,
    简介: '意识的门槛被泡软了——3 楼内有效阶段 +2（越级闸门恢复后生效）',
  },
  // ━━━━ 苏文安抚类（v0.23）：使用后由她去执行，弹出一楼安抚剧情 + 降疑心 ━━━━
  {
    名称: '精心家宴',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 150,
    冷却楼数: 6,
    简介: '她为苏文操办一桌好菜——疑心 -10（降不破堕落度铸成的下限）',
  },
  {
    名称: '贴心小礼物',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 250,
    冷却楼数: 8,
    简介: '一份妥帖的礼物悄悄送到苏文手上——疑心 -15（静默生效，不占剧情）',
  },
  {
    名称: '周末全家出游',
    分类: '消耗品',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 400,
    冷却楼数: 15,
    简介: '一场家人环绕的出游——疑心 -25 并冻结 5 楼',
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
  // ━━━━ 特别（v0.23 录像系统：一次买断设备，录制→归档→给她们看） ━━━━
  {
    名称: '云台微型相机',
    分类: '特别',
    阶段门槛: 1,
    类型倾向: [],
    加速: 0,
    风险: 0,
    越级钥匙: false,
    价格: 600,
    简介: '一次买断。开始/停止录制，停止后 AI 归档影像；影像可给任一女角色观看——她看着屏幕里的画面，认知被重塑（堕落度+4）',
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
  // v0.23 扩充 +12（全部走现有字段，无新槽位/新字段）
  连体塑身衣: { 内衣上: '肉色连体塑身衣', 内衣下: '（塑身衣连体）' },
  黑丝吊袜带: { 袜裤: '黑丝长袜配吊袜带' },
  珍珠链内裤: { 内衣下: '珍珠链内裤' },
  情侣家居服: { 上装: '情侣家居服上衣', 下装: '情侣家居服长裤' },
  包臀热裤: { 下装: '包臀超短热裤' },
  侧开衩旗袍: { 上装: '侧开衩旗袍', 下装: '（旗袍一体）' },
  他的白衬衫: { 上装: '只穿一件{{user}}的白衬衫', 下装: '无' },
  酒红缎面裙: { 上装: '酒红缎面连衣裙', 下装: '（连衣裙一体）' },
  珍珠耳坠: { 配饰: '珍珠耳坠' },
  纤细脚链: { 特殊装饰: '纤细脚链' },
  玫瑰锁骨链: { 配饰: '玫瑰吊坠锁骨链' },
  水光唇釉: { 唇妆: '水光唇釉' },
  桃花眼妆: { 眼妆: '桃花眼妆·眼尾晕粉' },
  // v0.25 高阶补全 +6（阶4饰品×2 + 阶5内着/外装/妆容×4，填终局空档；无新槽位/新字段）
  镂空连体网衣: { 内衣上: '镂空连体网衣（上身）', 内衣下: '镂空连体网衣（关键处无遮挡）' },
  暗扣高领裙: { 上装: '端庄的深色高领连衣裙（侧缝隐形拉链可一拉到底）', 下装: '（连衣裙一体）' },
  铃铛脚链: { 特殊装饰: '细银铃铛脚链（走动轻响）' },
  皮质颈环: { 特殊装饰: '黑色细皮质颈环' },
  同源沐浴露: { 香氛: '与{{user}}同源的沐浴露气息（像被气味标记过）' },
  发情红晕妆: { 特殊妆容: '眼下与耳垂晕着常驻的红（像时刻带着情热）' },
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

/** 追加一条一次性剧情事件（下一轮注入 AI 后清空）；消毒 | 分隔符防事件串裂 */
export function queueItemEvent(data: SchemaType, charKey: CharKey, text: string): void {
  const charName = charKey === '秦璐状态' ? '秦璐' : '苏梦';
  const event = `${charName}：${text.replace(/\|/g, '，')}`;
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
    queueItemEvent(data, charKey, `{{user}}让她换下「${name}」，相应部位恢复日常穿着（以服装/妆容细节变量为准）`);
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

  // 隐藏钩子（v0.23，无任何 UI 暗示）：秦璐穿上惹眼外装 → 3 楼后触发苏梦登场剧情（一次性）
  // 目的：引出苏梦这个角色的存在；登场方式完全按上下文演绎，不硬编码场面
  // v0.25 放宽（用户反馈防漏触发）：原仅酒红缎面裙 → 任意阶段2+外装都触发（阶1外装太日常不算"变化"）
  if (charKey === '秦璐状态' && item.槽位 === '外装' && item.阶段门槛 >= 2) {
    // 老存档守卫：字段可能未被 Schema 补齐
    if (!data.系统._苏梦引场) {
      (data.系统 as any)._苏梦引场 = { 剩余楼: -1, 已触发: false };
    }
    if (!data.系统._苏梦引场.已触发 && data.系统._苏梦引场.剩余楼 < 0) {
      data.系统._苏梦引场.剩余楼 = 3;
      console.info(`[隐藏钩子] 秦璐穿上「${name}」（阶${item.阶段门槛}外装），苏梦引场倒数 3 楼`);
    }
  }

  // 换装事件（v0.23 云霜凝式物理骨架）：事件 = {{user}} 本轮的交付动作，
  // 她的反应交给 AI 按当前阶段生成——不写"她已穿上"的既成事实（那会跳过赠送环节，0.22 试用反馈）。
  // 首穿标记仍走 MVU 持久字段防 reload 重置；装备类的 首穿 专属文案自此弃用（体改仍用）
  const wearKey = `${charKey}:${name}`;
  const firstWear = !data.系统._已首穿[wearKey];
  if (firstWear) data.系统._已首穿[wearKey] = true;
  queueItemEvent(
    data,
    charKey,
    firstWear
      ? `{{user}}把新买的「${name}」交给她，让她换上（${item.槽位}；他第一次送她这样的东西）——本轮请演绎这次交付与她按当前阶段的反应，此后以服装/妆容细节变量为准持续体现新装扮`
      : `{{user}}让她换上「${name}」（${item.槽位}）——此后以服装/妆容细节变量为准体现新装扮`,
  );
  console.info(`[网店] ${charKey} 装备「${name}」${firstWear ? '（首穿）' : ''}`);
  return { firstWear };
}

/** 越级钥匙（v0.24 接入）：装备中且类型倾向匹配的越级钥匙装备 → 该类型有效阶段 +1 */
export function hasEscalationKey(data: SchemaType, charKey: CharKey, category: ThoughtCategoryValue): boolean {
  return Object.entries(data[charKey].装备状态).some(([name, state]) => {
    const item = ITEM_MAP[name];
    return state === '装备中' && !!item?.越级钥匙 && item.类型倾向.includes(category);
  });
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

  // 改造事件（一次性，购买即唯一，无需额外幂等标记）；
  // v0.23：加"在{{user}}的安排下"前缀，锚定改造是玩家推动的，不凭空发生
  if (item.首穿) {
    queueItemEvent(data, charKey, `在{{user}}的安排下，${item.首穿}`);
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

/**
 * 疑心下限棘轮（v0.23）：回落/降疑手段都不能低于 她堕落度×0.25——
 * 有些变化他看见了就无法当没看见（纹身、气质、眼神）
 */
export function getSuspicionFloor(data: SchemaType, charKey: CharKey): number {
  return Math.floor(data[charKey].堕落度 * 0.25);
}

/** 降低苏文对该角色的疑心（受下限棘轮约束） */
function lowerSuspicion(data: SchemaType, charKey: CharKey, amount: number): void {
  const susKey = charKey === '秦璐状态' ? '对秦璐疑心值' : '对苏梦疑心值';
  const floorMin = getSuspicionFloor(data, charKey);
  const before = data.苏文状态[susKey];
  data.苏文状态[susKey] = Math.max(floorMin, before - amount);
  console.info(`[疑心] ${susKey} ${before}→${data.苏文状态[susKey]}（降疑${amount}，下限${floorMin}）`);
}

export function useConsumable(
  data: SchemaType,
  charKey: CharKey,
  name: string,
  currentFloor: number,
): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const item = ITEM_MAP[name];
  if (!item || item.分类 !== '消耗品') return '未知消耗品';
  // 冷却（v0.25 对标云霜凝）：防降疑道具连刷 / 药效叠加
  const cdLeft = getConsumableCooldownLeft(data, name, currentFloor);
  if (cdLeft > 0) return `冷却中（还需 ${cdLeft} 楼）`;
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  if (item.冷却楼数) {
    if (!data.系统._消耗品上次使用楼层) (data.系统 as any)._消耗品上次使用楼层 = {}; // 老存档守卫
    data.系统._消耗品上次使用楼层[name] = currentFloor;
  }

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
  } else if (name === '精心家宴') {
    // 苏文安抚类：她去执行，弹一楼安抚剧情（方向不定细节，角色无关原则）
    lowerSuspicion(data, charKey, 10);
    queueItemEvent(
      data,
      charKey,
      `在{{user}}的安排下，她今晚为苏文精心操办了一桌家宴——本轮请演绎这场饭桌上的安抚，方向：让他觉得"家还是那个家"；她的姿态与细节按上下文和当前阶段演绎`,
    );
  } else if (name === '贴心小礼物') {
    // 静默型安抚：效果直接生效，不弹剧情（对标借口短信；礼物在幕后送达）
    lowerSuspicion(data, charKey, 15);
  } else if (name === '周末全家出游') {
    lowerSuspicion(data, charKey, 25);
    const freezeKey = charKey === '秦璐状态' ? '对秦璐疑心值冻结' : '对苏梦疑心值冻结';
    data.苏文状态[freezeKey] = {
      是否冻结: true,
      借口内容: '周末全家出游的余温',
      冻结结束楼层: currentFloor + 5,
    };
    queueItemEvent(
      data,
      charKey,
      `在{{user}}的安排下，全家这个周末安排了一次出游——本轮请演绎出游的温馨画面，方向：苏文在家人环绕中放下疑虑；细节按上下文演绎`,
    );
  }
  console.info(`[网店] 对${charName}使用「${name}」-${item.价格} (余${data.系统.货币})`);
  return null;
}

/** 消耗品剩余冷却楼数（0=可用）；前端按钮与 useConsumable 共用 */
export function getConsumableCooldownLeft(data: SchemaType, name: string, currentFloor: number): number {
  const cd = ITEM_MAP[name]?.冷却楼数;
  if (!cd) return 0;
  const last = data.系统._消耗品上次使用楼层?.[name];
  if (last === undefined || last < 0) return 0;
  return Math.max(0, cd - (currentFloor - last));
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

// ────────────────────────────────────────────
// 录像系统（v0.23）：设备买断 → 录制 toggle → 停止生成影像（AI 归档摘要）→ 给她们看
// ────────────────────────────────────────────

export const CAMERA_NAME = '云台微型相机';
/** 观看影像的堕落度增量（经主通道自动折算疑心；数值待平衡） */
export const TAPE_CORRUPTION_GAIN = 4;

/** 购买录像设备（一次买断，走 系统.道具状态） */
export function buyCamera(data: SchemaType): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const item = ITEM_MAP[CAMERA_NAME];
  if (data.系统.道具状态[CAMERA_NAME] === '已购买') return '已购买过';
  if (data.系统.货币 < item.价格) return '货币不足';
  data.系统.货币 -= item.价格;
  data.系统.道具状态[CAMERA_NAME] = '已购买';
  console.info(`[录像] 设备购入 -${item.价格} (余${data.系统.货币})`);
  return null;
}

/**
 * 开始/停止录制。录制绑定目标角色（商店"为谁选购"），
 * 每角色同时只存一份影像（key 固定 `影像_角色名`），重录覆盖旧影像。
 * 停止时生成待摘要影像（AI 下一轮归档）
 */
export function toggleRecording(
  data: SchemaType,
  currentFloor: number,
  targetName: '秦璐' | '苏梦',
): { error?: string; started?: boolean; stopped?: boolean; tapeId?: string; overwrote?: boolean } {
  if (data.系统._坏结局) return { error: '结局已锁定' };
  if (data.系统.道具状态[CAMERA_NAME] !== '已购买') return { error: '未购买设备' };
  // 老存档守卫：UI 直接操作裸 stat_data，新字段在首个 AI 周期 Schema 补齐前可能缺失
  if (!data.系统._录像) {
    (data.系统 as any)._录像 = { 录制中: false, 起始楼层: -1, 目标: '秦璐' };
  }
  if (!data.系统.影像列表) {
    (data.系统 as any).影像列表 = {};
  }
  const rec = data.系统._录像;
  if (!rec.录制中) {
    rec.录制中 = true;
    rec.起始楼层 = currentFloor;
    rec.目标 = targetName;
    console.info(`[录像] 开始录制（目标${targetName}）@${currentFloor}`);
    return { started: true };
  }
  rec.录制中 = false;
  const tapeId = `影像_${rec.目标}`;
  const overwrote = !!data.系统.影像列表[tapeId];
  data.系统.影像列表[tapeId] = {
    摘要: '',
    录制起止: `${rec.起始楼层}~${currentFloor}`,
    状态: '待摘要',
  };
  rec.起始楼层 = -1;
  console.info(`[录像] 停止录制，生成 ${tapeId}（待摘要）${overwrote ? '，覆盖旧影像' : ''}`);
  return { stopped: true, tapeId, overwrote };
}

/**
 * 给角色观看影像（A/E 合一）：观看者堕落度 +4（给自己看=认知冲击；给另一位看=耳濡目染带坏），
 * 弹一楼观看剧情（引用 AI 归档的摘要），影像即看即毁
 */
export function showTape(data: SchemaType, charKey: CharKey, tapeId: string): string | null {
  if (data.系统._坏结局) return '结局已锁定';
  const tape = data.系统.影像列表?.[tapeId];
  if (!tape) return '影像不存在';
  if (tape.状态 !== '已就绪' || !tape.摘要) return '影像还在归档中（等 AI 下一轮整理摘要）';

  data[charKey].堕落度 = Math.min(100, data[charKey].堕落度 + TAPE_CORRUPTION_GAIN);
  const ns = getStageByCorruption(data[charKey].堕落度);
  if (ns > data[charKey].当前阶段) {
    data[charKey].当前阶段 = ns;
    data[charKey].阶段标题 = getStageTitle(ns) as any;
    console.info(`[录像] ${charKey} 观后阶段提升 → ${ns}`);
  }
  queueItemEvent(
    data,
    charKey,
    `在{{user}}的安排下，她看了一段影像（画面：${tape.摘要}）——本轮演绎这次观看与她按当前阶段的反应，方向：屏幕里的画面正在重塑她对自己/这个家的认知`,
  );
  delete data.系统.影像列表[tapeId];
  console.info(`[录像] ${charKey} 观看 ${tapeId}，堕落+${TAPE_CORRUPTION_GAIN}，影像已销毁`);
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
