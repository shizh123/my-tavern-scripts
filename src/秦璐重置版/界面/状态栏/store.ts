import { defineMvuDataStore } from '@/util/mvu';
import { Schema } from '../../schema';

// 关键：使用函数形式 + getCurrentMessageId()
// 每个楼层 iframe 各自的 store 定位到自己所在楼层的 MVU 数据。
// 旧楼层 → 该楼消息里保存的旧变量；当前楼 → 当前变量。
// 若沿用 message_id: -1（永远最新），旧楼层会显示当前状态，与酒馆楼层的数据不同步。
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
