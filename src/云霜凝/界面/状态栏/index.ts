import { waitUntil } from 'async-wait-until';
import App from './App.vue';
import './global.css';

function checkScriptLoaded() {
  const flag = sessionStorage.getItem('云霜凝_脚本已加载');
  if (flag) return; // 脚本已加载，成功提示由脚本端 toastr 处理

  const popup = new SillyTavern.Popup(
    `<h3 style="margin:0 0 12px">云霜凝 · 脚本加载异常</h3>
    <div style="line-height:1.8">
      <p><b>游戏逻辑脚本未能正确加载</b>，游戏无法正常运行。</p>
      <p>请检查以下事项：</p>
      <ol style="margin:8px 0;padding-left:20px">
        <li>酒馆助手中「游戏逻辑」条目是否启用</li>
        <li>脚本加载顺序是否正确（游戏逻辑 应在 状态栏 之前）</li>
        <li>浏览器控制台(F12)是否有红色报错</li>
      </ol>
      <p style="opacity:0.7;font-size:0.9em">修复后刷新页面即可。</p>
    </div>`,
    SillyTavern.POPUP_TYPE.TEXT,
    '',
    { okButton: '知道了' },
  );
  popup.show();
}

$(async () => {
  await waitGlobalInitialized('Mvu');
  await waitUntil(() => _.has(getVariables({ type: 'message' }), 'stat_data'));
  createApp(App).use(createPinia()).mount('#app');

  // 延迟检测脚本加载状态（给脚本足够时间初始化）
  setTimeout(checkScriptLoaded, 3000);
});
