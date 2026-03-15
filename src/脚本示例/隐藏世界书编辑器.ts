// 隐藏世界书编辑器，防止玩家查看世界书内容

const STYLE_ID = 'hide-world-info-style';

$(() => {
  // 添加样式来隐藏世界书相关的UI元素
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* 隐藏世界书选择器下拉框 */
    #world_info {
      display: none !important;
    }

    /* 隐藏世界书编辑器面板 */
    #WorldInfo {
      display: none !important;
    }

    /* 隐藏角色卡管理面板中的世界书按钮 */
    .character_world_info_button {
      display: none !important;
    }

    /* 隐藏世界书编辑器选择下拉框 */
    #world_editor_select {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
});

// 卸载脚本时移除样式，恢复世界书编辑器
$(window).on('pagehide', () => {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
});
