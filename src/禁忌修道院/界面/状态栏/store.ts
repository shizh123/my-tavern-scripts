import { defineMvuDataStore } from '@/util/mvu';
import { Schema } from '../../schema';

/**
 * 禁忌修道院状态栏 Store
 * 使用函数形式的 variable_option 确保每个 iframe 获取正确的 message_id
 */
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
