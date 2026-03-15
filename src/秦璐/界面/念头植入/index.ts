import { createApp } from 'vue';
import waitUntil from 'async-wait-until';
import ThoughtImplant from './ThoughtImplant.vue';

$(async () => {
  console.info('[念头植入界面] 开始加载，等待 MVU...');

  // 等待 MVU 框架初始化（带超时提示）
  try {
    await Promise.race([
      waitGlobalInitialized('Mvu'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MVU 初始化超时（5秒）')), 5000)),
    ]);
    console.info('[念头植入界面] MVU 已就绪');
  } catch (err) {
    console.error('[念头植入界面] MVU 等待失败:', err);
    toastr.error('MVU 框架未加载，请确保变量结构脚本已启用');
    return;
  }

  // 等待当前楼层的 stat_data 存在（最多等待 3 秒，超时后继续）
  // 【修复】不再因为超时而阻止界面挂载，界面会在后续自动刷新数据
  console.info('[念头植入界面] 等待 stat_data 初始化...');
  try {
    await waitUntil(
      () => {
        try {
          const messageId = getCurrentMessageId();
          const vars = Mvu.getMvuData({ type: 'message', message_id: messageId });
          return _.has(vars, 'stat_data');
        } catch {
          return false;
        }
      },
      { timeout: 3000, intervalBetweenAttempts: 100 },
    );
    console.info('[念头植入界面] stat_data 已就绪');
  } catch (err) {
    // 【关键修复】超时后不再 return，继续挂载界面
    // 界面会使用默认数据，并在后续通过事件监听或周期同步获取实际数据
    console.warn('[念头植入界面] stat_data 等待超时，继续挂载界面:', err);
  }

  console.info('[念头植入界面] 开始挂载 Vue');

  // 创建 Vue 应用
  const app = createApp(ThoughtImplant);

  // 全局错误处理器：捕获 Vue 渲染错误，防止界面崩溃
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[念头植入界面] Vue 错误:', err);
    console.error('[念头植入界面] 错误信息:', info);
  };

  // 挂载到 #app
  app.mount('#app');

  console.info('[念头植入界面] 加载完成');
});
