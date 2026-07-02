import { createApp } from 'vue';
import waitUntil from 'async-wait-until';
import App from './App.vue';

$(async () => {
  console.info('[秦璐重置版] 状态栏开始加载，等待 MVU...');

  try {
    await Promise.race([
      waitGlobalInitialized('Mvu'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MVU 初始化超时（5秒）')), 5000)),
    ]);
    console.info('[秦璐重置版] MVU 已就绪');
  } catch (err) {
    console.error('[秦璐重置版] MVU 等待失败:', err);
    toastr.error('MVU 框架未加载，请确保变量结构脚本已启用');
    return;
  }

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
  } catch {
    // 超时也继续挂载，后续自动刷新
  }

  const app = createApp(App);
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[秦璐重置版] Vue 错误:', err, info);
  };
  app.mount('#app');
  console.info('[秦璐重置版] 状态栏加载完成');
});