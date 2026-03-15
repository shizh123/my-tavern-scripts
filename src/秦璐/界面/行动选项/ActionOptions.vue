<template>
  <div v-if="options.length > 0" class="options-container">
    <!-- 背景纹理层 -->
    <div class="bg-pattern"></div>

    <!-- 主面板 -->
    <div class="options-panel">
      <!-- 顶部装饰线 -->
      <div class="panel-decor"></div>

      <!-- 标题 -->
      <div class="options-header">
        <span class="decor-line"></span>
        <span class="title">命运抉择</span>
        <span class="decor-line"></span>
      </div>

      <!-- 选项网格 -->
      <div :class="['options-grid', { 'grid-4col': options.length >= 6 }]">
        <div
          v-for="(option, index) in options"
          :key="index"
          :class="['option-btn', { sending: sendingIndex === index }]"
          :style="{ animationDelay: index * 0.08 + 's' }"
          @click="handleOptionClick(option, index)"
        >
          <span class="option-icon">◇</span>
          <span class="option-text">{{ option }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';

const options = ref<string[]>([]);
const sendingIndex = ref<number>(-1);
const isHiding = ref(false);

// 通知 iframe 高度变化
const updateIframeHeight = () => {
  nextTick(() => {
    // 方法1: 触发 resize 事件让酒馆助手重新计算高度
    window.dispatchEvent(new Event('resize'));

    // 方法2: 直接设置 iframe 高度
    const iframe = window.frameElement as HTMLIFrameElement | null;
    if (iframe) {
      const contentHeight = document.body.scrollHeight;
      iframe.style.height = contentHeight > 0 ? `${contentHeight}px` : '0px';
    }
  });
};

// 发送到输入框
const sendToChatBox = (text: string) => {
  if (!text || ['…', '...'].includes(text.trim()) || text.trim().length === 0) return;

  try {
    let $textarea = $(parent.document).find('#send_textarea');
    if ($textarea.length === 0) $textarea = $('#send_textarea');

    if ($textarea.length === 0) {
      // 降级为直接发送
      if (typeof triggerSlash === 'function') {
        triggerSlash(`/send ${text}|/trigger`);
      }
      return;
    }

    const currentContent = ($textarea.val() as string) || '';
    if (currentContent.includes(text.trim())) return;

    const separator = currentContent.trim() ? '\n' : '';
    const newContent = currentContent + separator + text.trim();

    $textarea.val(newContent);
    $textarea.trigger('input');
    $textarea.focus();
  } catch {
    if (typeof triggerSlash === 'function') {
      triggerSlash(`/send ${text}|/trigger`);
    }
  }
};

// 处理选项点击
const handleOptionClick = (option: string, index: number) => {
  if (sendingIndex.value !== -1 || isHiding.value) return;

  sendingIndex.value = index;
  // 去除开头的数字序号
  const textToSend = option.replace(/^\d+\.\s*/, '').trim();
  sendToChatBox(textToSend);

  // 隐藏面板
  setTimeout(() => {
    isHiding.value = true;
    options.value = [];
    // 更新 iframe 高度
    updateIframeHeight();
  }, 300);
};

// 初始化：解析消息中的选项
const initOptions = () => {
  if (typeof getCurrentMessageId !== 'function' || typeof getChatMessages !== 'function') return;

  const msgId = getCurrentMessageId();
  const messages = getChatMessages(msgId);
  if (!messages || messages.length === 0) return;

  const lastMsg = messages[0];
  if (!lastMsg || !lastMsg.message) return;

  const match = lastMsg.message.match(/<options>((?:(?!<options>).)*?)<\/options>/s);
  if (match && match[1]) {
    const parsedOptions = match[1]
      .split('|')
      .map((o: string) => o.trim())
      .filter((o: string) => o && !['…', '...'].includes(o));

    if (parsedOptions.length > 0) {
      options.value = parsedOptions;
    }
  }
};

onMounted(() => {
  setTimeout(initOptions, 300);
});
</script>

<style lang="scss" scoped>
@use 'sass:color';

// ========== 配色系统（与念头植入保持一致）==========
$c-bg: #0d0d0d;
$c-panel: rgba(18, 18, 18, 0.98);
$c-gold: #d4af37;
$c-gold-dim: #8a7326;
$c-red: #8a1c1c;
$c-text: #e0e0e0;
$c-text-sub: #888;
$font-serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;
$font-sans: 'Roboto', sans-serif;

// ========== 容器 ==========
.options-container {
  position: relative;
  width: 100%;
  font-family: $font-sans;
  color: $c-text;
  background: $c-bg;
  overflow: hidden;
}

// ========== 背景纹理 ==========
.bg-pattern {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image:
    // 暗红光晕
    radial-gradient(ellipse at 30% 0%, rgba($c-red, 0.1), transparent 50%),
    radial-gradient(ellipse at 70% 100%, rgba($c-red, 0.08), transparent 50%),
    // 金色点缀
    radial-gradient(circle at 50% 50%, rgba($c-gold, 0.03), transparent 60%),
    // 织物暗纹
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 1px,
      rgba(255, 255, 255, 0.02) 1px,
      rgba(255, 255, 255, 0.02) 2px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 1px,
      rgba(255, 255, 255, 0.02) 1px,
      rgba(255, 255, 255, 0.02) 2px
    );
  z-index: 0;
}

// ========== 主面板 ==========
.options-panel {
  position: relative;
  z-index: 1;
  padding: 16px 20px;
  background: $c-panel;
  border: 1px solid rgba($c-gold, 0.15);
  border-bottom: 1px dashed rgba($c-gold, 0.1);
  backdrop-filter: blur(5px);
}

// ========== 顶部装饰线 ==========
.panel-decor {
  position: absolute;
  top: 6px;
  left: 15px;
  right: 15px;
  height: 1px;
  background: linear-gradient(90deg, transparent, $c-gold, transparent);
  opacity: 0.3;
}

// ========== 标题 ==========
.options-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 14px;

  .title {
    color: $c-gold;
    font-size: 12px;
    font-family: $font-serif;
    letter-spacing: 3px;
    text-shadow: 0 0 8px rgba($c-gold, 0.3);
  }

  .decor-line {
    height: 1px;
    width: 50px;
    background: linear-gradient(90deg, transparent, $c-gold-dim, transparent);
    opacity: 0.6;
  }
}

// ========== 选项网格 ==========
.options-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;

  // 中等宽度：两列
  @media (min-width: 400px) {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  // 宽屏时 6+ 选项使用四列
  &.grid-4col {
    @media (min-width: 700px) {
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
  }
}

// ========== 选项按钮 ==========
.option-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba($c-gold, 0.12);
  border-left: 2px solid $c-gold-dim;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  animation: fadeSlideIn 0.5s ease forwards;
  opacity: 0;

  // 四列布局时更紧凑
  .grid-4col & {
    padding: 8px 10px;
    gap: 6px;
  }

  &:hover {
    background: rgba($c-gold, 0.08);
    border-color: rgba($c-gold, 0.4);
    border-left-color: $c-gold;
    transform: translateX(3px);
    box-shadow:
      0 0 15px rgba($c-gold, 0.1),
      inset 0 0 20px rgba($c-gold, 0.03);

    .option-icon {
      color: $c-gold;
      text-shadow: 0 0 8px $c-gold;
    }

    .option-text {
      color: #fff;
    }
  }

  &.sending {
    background: rgba($c-red, 0.4);
    border-color: $c-red;
    border-left-color: #ff4500;

    .option-icon {
      color: #ff6b6b;
    }

    .option-text {
      color: #ffcccc;
    }
  }
}

.option-icon {
  font-size: 10px;
  color: $c-gold-dim;
  transition: all 0.3s;
}

.option-text {
  flex: 1;
  font-size: 13px;
  color: $c-text;
  font-family: $font-serif;
  transition: color 0.3s;
  line-height: 1.4;

  // 四列布局时字体稍小
  .grid-4col & {
    font-size: 12px;
  }
}

// ========== 动画 ==========
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
