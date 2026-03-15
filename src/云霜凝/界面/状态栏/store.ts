import { defineMvuDataStore } from '@/util/mvu';
import { Schema } from '../../schema';

// Bug #32 修复：使用函数形式避免 ES module 缓存导致所有 iframe 共享同一个 message_id
export const useDataStore = defineMvuDataStore(Schema, () => ({ type: 'message', message_id: getCurrentMessageId() }));
