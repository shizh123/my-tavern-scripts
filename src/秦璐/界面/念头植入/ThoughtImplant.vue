<template>
  <div class="mystic-container">
    <!-- 背景纹理层 -->
    <div class="bg-pattern"></div>

    <!-- 主面板 -->
    <div class="main-panel">
      <!-- 顶部装饰 -->
      <div class="panel-decor top"></div>

      <!-- 头部信息 -->
      <header class="header">
        <div class="world-info">
          <span class="info-item">
            <i class="icon">📅</i>
            {{ safeWorld.日期 }}
          </span>
          <span class="info-item weekday" :class="weekdayClass">
            {{ safeWorld.星期 }}
          </span>
          <span class="divider">✦</span>
          <span class="info-item">
            <i class="icon">🕐</i>
            {{ safeWorld.时间 }}
          </span>
          <span class="divider">✦</span>
          <span class="info-item">
            <i class="icon">📍</i>
            {{ safeWorld.地点 }}
          </span>
        </div>
        <div v-if="safeWorld.环境氛围 !== '日常'" class="environment">
          「 {{ safeWorld.环境氛围 }} 」
        </div>
      </header>

      <!-- 角色切换（点击同时设置查看角色和植入目标） -->
      <nav class="char-tabs">
        <div
          v-for="char in ['秦璐', '苏梦']"
          :key="char"
          :class="['tab-item', { active: activeCharacter === char }]"
          @click="selectCharacter(char)"
        >
          <span class="char-name">{{ char }}</span>
          <span class="char-role">{{ char === '秦璐' ? '母亲' : '姐姐' }}</span>
        </div>
      </nav>

      <!-- 核心操作区：念头植入 -->
      <section class="implant-control">
        <div class="control-header">
          <span class="decor-line"></span>
          <span class="title">神识干涉</span>
          <span class="decor-line"></span>
        </div>

        <div class="input-group">
          <!-- 当前植入目标提示 -->
          <div class="target-hint">
            <span class="hint-text">植入对象：<strong>{{ implantTarget }}</strong></span>
          </div>

          <div class="input-wrapper">
            <input
              v-model="thoughtContent"
              type="text"
              :maxlength="MAX_THOUGHT_LENGTH"
              :placeholder="isThoughtLimitReached ? '已达念头上限，无法植入更多' : `简短念头（${MAX_THOUGHT_LENGTH}字内）...`"
              :disabled="isThoughtLimitReached"
              @keyup.enter="implantThought"
            />
            <span class="char-count" :class="{ 'at-limit': thoughtContent.length >= MAX_THOUGHT_LENGTH }">
              {{ thoughtContent.length }}/{{ MAX_THOUGHT_LENGTH }}
            </span>
            <button class="submit-btn" :disabled="!canImplant" @click="implantThought">
              <span>植入</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 状态展示区 -->
      <main class="status-display">
        <!-- 左侧：核心数值 -->
        <div class="col-left">
          <!-- 境界圆环 -->
          <div class="stage-card">
            <div class="stage-ring">
              <svg viewBox="0 0 36 36" class="circular-chart">
                <path
                  class="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="circle"
                  :stroke-dasharray="`${((currentCharacter?.当前阶段 ?? 1) / 5) * 100}, 100`"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div class="stage-text">
                <span class="label">境界</span>
                <span class="value">{{ currentCharacter?.阶段标题 ?? '初始' }}</span>
              </div>
            </div>
          </div>

          <!-- 核心数值 -->
          <div class="stats-group">
            <div class="stat-item">
              <div class="stat-header">
                <span class="name">🛡️ 道德底线</span>
                <span class="num">{{ currentCharacter?.道德底线 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-moral"
                  :style="{ width: (currentCharacter?.道德底线 ?? 0) + '%' }"
                ></div>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💕 {{ activeCharacter === '秦璐' ? '主角依存' : '弟弟依存' }}</span>
                <span class="num">{{ currentCharacter?.对主角依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-desire"
                  :style="{ width: Math.max(0, (currentCharacter?.对主角依存度 ?? 0) + 50) / 1.5 + '%' }"
                ></div>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-header">
                <span class="name">💔 {{ activeCharacter === '秦璐' ? '苏文依存' : '对父好感' }}</span>
                <span class="num">{{ currentCharacter?.对苏文依存度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-husband"
                  :style="{ width: Math.max(0, (currentCharacter?.对苏文依存度 ?? 0) + 50) / 1.5 + '%' }"
                ></div>
              </div>
            </div>

            <div class="stat-item">
              <div class="stat-header">
                <span class="name">🌀 侵蚀程度</span>
                <span class="num">{{ currentCharacter?.潜意识侵蚀度 ?? 0 }}</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-bar stat-corruption"
                  :style="{ width: Math.min(100, (currentCharacter?.潜意识侵蚀度 ?? 0) / 1.5) + '%' }"
                ></div>
              </div>
            </div>
          </div>

          <!-- 苏文状态 -->
          <div class="suwen-card">
            <div class="suwen-header">
              <span class="name">苏文</span>
              <span :class="['status-tag', { 'sleeping-pill': isSleepingPillActive, 'hospitalized': isHospitalized }]">{{ suwenStatusDisplay }}</span>
            </div>

            <div class="suspicion-row">
              <span class="label">疑心</span>
              <div :class="['suspicion-track', { frozen: currentSuspicionFreeze?.是否冻结 }]">
                <div
                  :class="['suspicion-fill', { danger: currentSuspicion > 70 }]"
                  :style="{ width: currentSuspicion + '%' }"
                ></div>
                <div v-if="currentSuspicionFreeze?.是否冻结" class="freeze-overlay"></div>
              </div>
              <span class="val">{{ currentSuspicion }}</span>
              <span v-if="currentSuspicionFreeze?.是否冻结" class="freeze-icon">❄️</span>
            </div>

            <div v-if="currentSuspicionFreeze?.是否冻结" class="freeze-info">
              <div class="freeze-reason">🔒 {{ currentSuspicionFreeze?.借口内容 ?? '' }}</div>
              <div class="freeze-time">剩余：{{ remainingFreezeTime }}</div>
            </div>

            <div class="impression-row">
              <span class="label">印象</span>
              <span class="impression-text">{{ currentImpression }}</span>
            </div>
            <div v-if="currentImpressionDetail" class="impression-detail-row">
              <span class="detail-text">「{{ currentImpressionDetail }}」</span>
            </div>

            <!-- 危险监控区域 -->
            <div v-if="showDangerMonitor" class="danger-monitor">
              <div class="monitor-header">
                <span class="monitor-icon">⚠️</span>
                <span class="monitor-title">危险监控</span>
                <span :class="['risk-badge', riskLevel]">{{ riskLevelText }}</span>
              </div>

              <!-- 打断倒计时 -->
              <div class="monitor-item">
                <div class="item-header">
                  <span class="item-icon">⏱️</span>
                  <span class="item-label">打断倒计时</span>
                  <span class="item-value">{{ dangerTimeDisplay }}</span>
                </div>
                <div class="monitor-track">
                  <div
                    :class="['monitor-fill', dangerTimeColorClass]"
                    :style="{ width: dangerTimePercent + '%' }"
                  ></div>
                </div>
                <div class="item-detail">
                  {{ remainingInterruptionTime }}
                </div>
              </div>

              <!-- 巡逻状态 -->
              <div class="monitor-item">
                <div class="item-header">
                  <span class="item-icon">👁️</span>
                  <span class="item-label">巡逻冷却</span>
                  <span class="item-value">{{ patrolCooldownDisplay }}</span>
                </div>
                <div class="monitor-track">
                  <div
                    class="monitor-fill patrol"
                    :style="{ width: patrolCooldownPercent + '%' }"
                  ></div>
                </div>
                <div class="item-detail">
                  {{ patrolStatusText }}
                </div>
              </div>

              <!-- 当前触发概率 -->
              <div class="probability-row">
                <span class="prob-label">巡逻触发概率</span>
                <span :class="['prob-value', probabilityColorClass]">{{ currentPatrolProbability }}%</span>
              </div>
            </div>

            <!-- 安全提示（苏文不在家/睡眠时） -->
            <div v-else-if="suwenSafeReason" :class="['safe-indicator', { 'sleeping-pill-active': isSleepingPillActive, 'hospitalized-active': isHospitalized }]">
              <span class="safe-icon">{{ isHospitalized ? '🏥' : (isSleepingPillActive ? '🔮' : '✓') }}</span>
              <span class="safe-text">{{ suwenSafeReason }}</span>
            </div>
          </div>
        </div>

        <!-- 右侧：详情 -->
        <div class="col-right">
          <!-- 心境区 -->
          <div class="mental-section">
            <div class="section-title">💭 心境</div>
            <div class="mental-content">
              <div class="emotion-row">
                <span class="label">情绪</span>
                <span class="emotion-val">{{ currentCharacter?.当前情绪 ?? '平静' }}</span>
              </div>
              <div class="thought-bubble">
                <template v-if="currentCharacter?.当前心理想法">
                  「 {{ currentCharacter.当前心理想法 }} 」
                </template>
                <template v-else>
                  <span class="empty-thought">（内心暂无波澜）</span>
                </template>
              </div>
              <div class="temperament">— {{ currentCharacter?.气质描述 ?? '未知' }}</div>
            </div>
          </div>

          <!-- 培育中的念头 -->
          <div v-if="(currentCharacter?.念头培育区?.length ?? 0) > 0" class="thoughts-section">
            <div class="section-title">
              🌱 培育中 ({{ currentCharacter?.念头培育区?.length ?? 0 }})
            </div>
            <div class="thought-list">
              <div v-for="(t, index) in (currentCharacter?.念头培育区 ?? [])" :key="t.念头内容" class="thought-item" :class="{ pending: t.待判定 }">
                <div class="thought-main">
                  <div class="thought-content">{{ t.念头内容 }}</div>
                  <div class="thought-meta">
                    <span :class="['diff-tag', t.难度等级]">{{ t.难度等级 }}</span>
                    <span v-if="t.待判定" class="progress-text pending-text">等待AI判定...</span>
                    <span v-else class="progress-text">{{ t.开发进度 }}/{{ t.需要时间 }}时</span>
                  </div>
                  <div class="thought-bar" :class="{ 'pending-bar': t.待判定 }">
                    <div
                      v-if="!t.待判定"
                      class="thought-fill"
                      :style="{ width: ((t.开发进度 ?? 0) / (t.需要时间 || 1)) * 100 + '%' }"
                    ></div>
                    <div v-else class="thought-fill pending-fill"></div>
                  </div>
                </div>
                <button class="delete-thought-btn" @click="handleDeleteThought(index)" title="删除此念头">
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <!-- 已形成习惯 -->
          <div v-if="(currentCharacter?.习惯列表?.length ?? 0) > 0" class="habits-section">
            <div class="section-title">
              🔗 已成习惯 ({{ currentCharacter?.习惯列表?.length ?? 0 }})
              <span :class="['influence-badge', habitInfluenceLevel]">{{ habitInfluenceText }}</span>
            </div>
            <div class="habit-tags">
              <span v-for="h in (currentCharacter?.习惯列表 ?? [])" :key="h.内容" class="habit-tag">
                {{ h.内容 }}
              </span>
            </div>
          </div>

          <!-- 仪容区 -->
          <div class="appearance-section">
            <div class="section-title">👗 当前仪容</div>

            <!-- 服装 -->
            <div class="appearance-category">
              <div class="category-header">
                <span class="cat-icon">👚</span>
                <span class="cat-name">服装</span>
                <span class="cat-tags">
                  <span class="mini-tag">{{ currentCharacter?.服装细节?.整体风格 ?? '未知' }}</span>
                  <span class="mini-tag outline">{{ currentCharacter?.服装细节?.暴露程度 ?? '正常' }}</span>
                  <span v-if="currentCharacter?.服装细节?.整洁度 && currentCharacter.服装细节.整洁度 !== '整洁'" class="mini-tag warn">
                    {{ currentCharacter.服装细节.整洁度 }}
                  </span>
                </span>
              </div>
              <div class="category-details">
                <div class="detail-row">
                  <span class="d-label">上装</span>
                  <span class="d-value">{{ currentCharacter?.服装细节?.上装 ?? '---' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">下装</span>
                  <span class="d-value">{{ currentCharacter?.服装细节?.下装 ?? '---' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">内衣</span>
                  <span class="d-value">{{ currentCharacter?.服装细节?.内衣?.上 ?? '---' }} / {{ currentCharacter?.服装细节?.内衣?.下 ?? '---' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">袜裤</span>
                  <span class="d-value">{{ currentCharacter?.服装细节?.袜裤 ?? '---' }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">鞋子</span>
                  <span class="d-value">{{ currentCharacter?.服装细节?.鞋子 ?? '---' }}</span>
                </div>
                <div v-if="currentCharacter?.服装细节?.配饰 && currentCharacter.服装细节.配饰 !== '无'" class="detail-row">
                  <span class="d-label">配饰</span>
                  <span class="d-value">{{ currentCharacter.服装细节.配饰 }}</span>
                </div>
                <div v-if="currentCharacter?.服装细节?.特殊装饰 && currentCharacter.服装细节.特殊装饰 !== '无'" class="detail-row highlight">
                  <span class="d-label">特殊</span>
                  <span class="d-value">{{ currentCharacter.服装细节.特殊装饰 }}</span>
                </div>
              </div>
            </div>

            <!-- 妆容 -->
            <div class="appearance-category">
              <div class="category-header">
                <span class="cat-icon">💄</span>
                <span class="cat-name">妆容</span>
                <span class="cat-tags">
                  <span class="mini-tag">{{ currentCharacter?.妆容细节?.整体风格 ?? '自然' }}</span>
                  <span class="mini-tag outline">{{ currentCharacter?.妆容细节?.浓淡程度 ?? '淡妆' }}</span>
                </span>
              </div>
              <div class="category-details">
                <div class="detail-row">
                  <span class="d-label">底妆</span>
                  <span class="d-value">{{ currentCharacter?.妆容细节?.底妆 ?? '---' }}</span>
                </div>
                <div v-if="currentCharacter?.妆容细节?.眼妆 && currentCharacter.妆容细节.眼妆 !== '无'" class="detail-row">
                  <span class="d-label">眼妆</span>
                  <span class="d-value">{{ currentCharacter.妆容细节.眼妆 }}</span>
                </div>
                <div class="detail-row">
                  <span class="d-label">唇妆</span>
                  <span class="d-value">{{ currentCharacter?.妆容细节?.唇妆 ?? '---' }}</span>
                </div>
                <div v-if="currentCharacter?.妆容细节?.特殊妆容 && currentCharacter.妆容细节.特殊妆容 !== '无'" class="detail-row highlight">
                  <span class="d-label">特殊</span>
                  <span class="d-value">{{ currentCharacter.妆容细节.特殊妆容 }}</span>
                </div>
              </div>
            </div>

            <!-- 身体改造 -->
            <div v-if="hasBodyMods" class="appearance-category danger-zone">
              <div class="category-header">
                <span class="cat-icon">🔥</span>
                <span class="cat-name">身体印记</span>
              </div>
              <div class="bodymod-content">
                <!-- 纹身 -->
                <div v-if="Object.keys(currentCharacter?.身体改造?.纹身 ?? {}).length > 0" class="mod-group">
                  <span class="mod-icon">🖤</span>
                  <span class="mod-label">纹身</span>
                  <div class="mod-items">
                    <span
                      v-for="(content, part) in (currentCharacter?.身体改造?.纹身 ?? {})"
                      :key="part"
                      class="mod-tag"
                    >
                      {{ part }}：{{ content }}
                    </span>
                  </div>
                </div>

                <!-- 穿刺 -->
                <div v-if="activePiercings.length > 0" class="mod-group">
                  <span class="mod-icon">💎</span>
                  <span class="mod-label">穿刺</span>
                  <div class="mod-items">
                    <span v-for="p in activePiercings" :key="p" class="mod-tag">{{ p }}</span>
                  </div>
                </div>

                <!-- 永久标记 -->
                <div v-if="(currentCharacter?.身体改造?.永久标记?.length ?? 0) > 0" class="mod-group">
                  <span class="mod-icon">🔥</span>
                  <span class="mod-label">永久标记</span>
                  <div class="mod-items">
                    <span v-for="m in (currentCharacter?.身体改造?.永久标记 ?? [])" :key="m" class="mod-tag danger">
                      {{ m }}
                    </span>
                  </div>
                </div>

                <!-- 临时标记 -->
                <div v-if="(currentCharacter?.身体改造?.临时标记?.length ?? 0) > 0" class="mod-group">
                  <span class="mod-icon">💋</span>
                  <span class="mod-label">临时标记</span>
                  <div class="mod-items">
                    <span v-for="m in (currentCharacter?.身体改造?.临时标记 ?? [])" :key="m" class="mod-tag temp">
                      {{ m }}
                    </span>
                  </div>
                </div>

                <!-- 体态变化 -->
                <div v-if="currentCharacter?.身体改造?.体态变化 && currentCharacter.身体改造.体态变化 !== '无'" class="mod-group">
                  <span class="mod-icon">✨</span>
                  <span class="mod-label">体态变化</span>
                  <span class="mod-text">{{ currentCharacter.身体改造.体态变化 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- 底部装饰 -->
      <div class="panel-decor bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { Schema, type SchemaType } from '../../schema';
import { judgeThought } from '../../thoughtCategoryLib';

// ==================== 楼层信息 ====================
// 获取当前界面所在的楼层ID
const messageId = getCurrentMessageId();
// 是否是最新楼层（动态计算）
const isLatestFloor = ref(false);
// 数据是否已加载完成
const isDataReady = ref(false);

// ==================== 数据状态 ====================
const activeCharacter = ref<'秦璐' | '苏梦'>('秦璐');
const implantTarget = ref<'秦璐' | '苏梦'>('秦璐');
const thoughtContent = ref('');

// 创建默认数据的函数
function createDefaultData(): SchemaType {
  return Schema.parse({});
}

const data = ref<SchemaType>(createDefaultData());

// ==================== 数据清理和解析 ====================
// 清理并解析MVU数据（过滤掉损坏的日志）
function parseCleanData(rawStatData: any) {
  // 先克隆数据，避免修改原始数据
  const clonedData = klona(rawStatData);

  // 清理损坏的日志数据（植入楼层为NaN的旧数据）
  if (clonedData?.系统追踪?.念头植入日志) {
    clonedData.系统追踪.念头植入日志 = clonedData.系统追踪.念头植入日志.filter((log: any) => {
      return typeof log.植入楼层 === 'number' && !isNaN(log.植入楼层);
    });
  }
  return Schema.parse(clonedData);
}

// ==================== 数据刷新 ====================
function refreshData() {
  try {
    console.info(`[状态面板] ========== 开始刷新数据 ==========`);
    console.info(`[状态面板] 当前楼层: ${messageId}, 是否最新: ${isLatestFloor.value}`);

    // 【核心修复】始终读取当前楼层自己的数据，而不是最新楼层的数据
    // 这确保每个楼层显示的是该楼层对应的游戏状态
    const targetId = messageId;

    // 使用 Mvu.getMvuData 读取数据
    let variables: any;
    try {
      variables = Mvu.getMvuData({ type: 'message', message_id: targetId });
    } catch (mvuErr) {
      console.warn(`[状态面板] MVU 数据读取失败，使用当前数据:`, mvuErr);
      return; // 保持当前数据不变
    }

    const statData = _.get(variables, 'stat_data');

    // 如果 stat_data 不存在或为空，保持当前数据
    if (!statData || typeof statData !== 'object') {
      console.warn(`[状态面板] stat_data 不存在或无效，保持当前数据`);
      return;
    }

    console.info(`[状态面板] 读取到的数据:`, {
      有stat_data: !!statData,
      时间: statData?.世界?.时间,
      日期: statData?.世界?.日期,
      秦璐念头数: statData?.秦璐状态?.念头培育区?.length || 0,
      苏梦念头数: statData?.苏梦状态?.念头培育区?.length || 0,
      苏文状态: statData?.苏文状态?.当前状态,
      苏文位置: statData?.苏文状态?.当前位置,
      苏文疑心值_秦璐: statData?.苏文状态?.对秦璐疑心值,
      苏文疑心值_苏梦: statData?.苏文状态?.对苏梦疑心值,
    });

    if (statData?.秦璐状态?.念头培育区?.length > 0) {
      console.info(`[状态面板] 秦璐念头详情:`, statData.秦璐状态.念头培育区.map((t: any) => ({
        内容: t.念头内容,
        进度: `${t.开发进度}/${t.需要时间}`,
      })));
    }

    // 解析数据，如果解析失败则保持当前数据
    try {
      const parsedData = parseCleanData(statData);
      data.value = parsedData;
      isDataReady.value = true;
      console.info(`[状态面板] ✅ 楼层 ${messageId} 数据已刷新，苏文状态:`, {
        当前状态: parsedData?.苏文状态?.当前状态,
        当前位置: parsedData?.苏文状态?.当前位置,
        对秦璐疑心值: parsedData?.苏文状态?.对秦璐疑心值,
        data_苏文状态: data.value?.苏文状态?.当前状态,
        data_苏文位置: data.value?.苏文状态?.当前位置,
      });
      // 使用 nextTick 确认 Vue 更新后的状态
      nextTick(() => {
        console.info(`[状态面板] Vue nextTick 后，suwenStatusDisplay 应为:`, {
          苏文状态_当前状态: data.value?.苏文状态?.当前状态,
          苏文状态_当前位置: data.value?.苏文状态?.当前位置,
        });
      });
    } catch (parseErr) {
      console.error(`[状态面板] 数据解析失败，保持当前数据:`, parseErr);
    }
  } catch (err) {
    console.error(`[状态面板] ❌ 楼层 ${messageId} 数据刷新失败:`, err);
    // 发生错误时不修改数据，保持界面稳定
  }
}

// 检查并更新是否是最新楼层
function updateLatestFloorStatus() {
  const lastId = getLastMessageId();
  const wasLatest = isLatestFloor.value;
  isLatestFloor.value = messageId === lastId;

  // 如果从最新变成非最新，需要重新读取自己楼层的数据（固定历史状态）
  if (wasLatest && !isLatestFloor.value) {
    console.info(`[状态面板] 楼层 ${messageId} 不再是最新楼层，切换为只读模式`);
    refreshData();
  }
}

// 【关键修复】积极重试机制：当初始化时数据不存在，持续尝试获取
let aggressiveRetryTimer: ReturnType<typeof setInterval> | null = null;
function startAggressiveRetry() {
  // 如果已经在重试，不要重复启动
  if (aggressiveRetryTimer) return;

  let retryCount = 0;
  const maxRetries = 30; // 最多重试30次（共15秒）

  console.info(`[状态面板] 楼层 ${messageId} 启动积极重试机制`);

  aggressiveRetryTimer = setInterval(() => {
    retryCount++;

    try {
      const variables = Mvu.getMvuData({ type: 'message', message_id: messageId });
      const statData = _.get(variables, 'stat_data');

      if (statData && typeof statData === 'object') {
        // 数据已存在，停止重试
        console.info(`[状态面板] 楼层 ${messageId} 积极重试成功（第${retryCount}次）`);
        clearInterval(aggressiveRetryTimer!);
        aggressiveRetryTimer = null;

        try {
          data.value = parseCleanData(statData);
          console.info(`[状态面板] ✅ 楼层 ${messageId} 数据已通过积极重试获取`);
        } catch (parseErr) {
          console.warn(`[状态面板] 积极重试解析失败:`, parseErr);
        }
        return;
      }

      // 达到最大重试次数
      if (retryCount >= maxRetries) {
        console.warn(`[状态面板] 楼层 ${messageId} 积极重试已达上限（${maxRetries}次），停止重试`);
        clearInterval(aggressiveRetryTimer!);
        aggressiveRetryTimer = null;
      }
    } catch (err) {
      console.warn(`[状态面板] 积极重试出错（第${retryCount}次）:`, err);
    }
  }, 500); // 每500ms重试一次
}

// ==================== 生命周期 ====================
onMounted(() => {
  try {
    // 初始化时检查是否是最新楼层
    // 注意：新楼层创建时，getLastMessageId() 可能返回旧值
    // 因此我们延迟 50ms 再检查
    const checkLatestFloorAndInit = () => {
      try {
        const lastId = getLastMessageId();
        isLatestFloor.value = messageId === lastId;
        console.info(`[状态面板] 楼层 ${messageId} 加载，最新楼层: ${lastId}，是否最新: ${isLatestFloor.value}`);

        // 【核心修复】始终读取当前楼层自己的数据
        const targetId = messageId;

        // 安全地读取数据
        let variables: any;
        try {
          variables = Mvu.getMvuData({ type: 'message', message_id: targetId });
        } catch (mvuErr) {
          console.warn(`[状态面板] 初始化时 MVU 读取失败:`, mvuErr);
          isDataReady.value = true; // 使用默认数据
          return;
        }

        const statData = _.get(variables, 'stat_data');
        if (statData && typeof statData === 'object') {
          try {
            data.value = parseCleanData(statData);
            isDataReady.value = true;
          } catch (parseErr) {
            console.warn(`[状态面板] 初始化时数据解析失败:`, parseErr);
            isDataReady.value = true; // 使用默认数据
          }
        } else {
          // 【优化】只有最新楼层才需要积极重试
          // 历史楼层数据不存在是正常的（早期聊天可能没有变量），不需要重试
          if (isLatestFloor.value) {
            console.warn(`[状态面板] 楼层 ${messageId} 初始化时 stat_data 不存在，启动积极重试`);
            isDataReady.value = true; // 先显示默认数据
            startAggressiveRetry();
          } else {
            console.info(`[状态面板] 楼层 ${messageId} (非最新) stat_data 不存在，使用默认数据`);
            isDataReady.value = true; // 使用默认数据，不重试
          }
        }

        // 从数据中读取当前角色并同步到UI（同时同步植入目标）
        if (data.value?.系统追踪?.当前角色) {
          activeCharacter.value = data.value.系统追踪.当前角色;
          implantTarget.value = data.value.系统追踪.当前角色;
          console.info(`[状态面板] 已同步当前角色和植入目标: ${activeCharacter.value}`);
        }

        console.info(`[状态面板] 数据加载成功 (读取楼层: ${targetId})`);

        // 念头植入注入已移至习惯注入脚本处理，此处无需设置监听器
      } catch (initErr) {
        console.error(`[状态面板] 初始化检查失败:`, initErr);
        isDataReady.value = true; // 确保界面能显示
      }
    };

    // 立即执行一次初始化
    checkLatestFloorAndInit();

    // 【重要】延迟刷新：等待游戏逻辑脚本完成后再读取数据
    // 游戏逻辑在 MESSAGE_RECEIVED 后 300ms 执行
    // 执行需要约 100-200ms（读取+处理+写入+验证）
    // 等待 600ms 确保数据已写入完成
    // 【优化】只有最新楼层才需要延迟刷新，历史楼层数据已固定
    if (isLatestFloor.value) {
      setTimeout(() => {
        try {
          // 更新最新楼层状态
          const lastId = getLastMessageId();
          const wasLatest = isLatestFloor.value;
          isLatestFloor.value = messageId === lastId;

          console.info(`[状态面板] 楼层 ${messageId} 延迟刷新: wasLatest=${wasLatest}, isNowLatest=${isLatestFloor.value}`);

          // 最新楼层刷新数据，确保显示正确的游戏状态
          console.info(`[状态面板] 楼层 ${messageId} 执行延迟刷新（600ms）`);
          refreshData();
        } catch (delayErr) {
          console.error(`[状态面板] 延迟刷新失败:`, delayErr);
        }
      }, 600);
    }

    // 监听 AI 消息接收事件
    eventOn(tavern_events.MESSAGE_RECEIVED, () => {
      try {
        // 更新最新楼层状态
        updateLatestFloorStatus();

        // 当前楼层收到消息后，延迟刷新自己的数据
        // 游戏逻辑脚本在 300ms 后执行并更新当前楼层的数据
        // 所以最新楼层需要在游戏逻辑完成后刷新
        if (isLatestFloor.value) {
          // 延迟 600ms 等待游戏逻辑完成（300ms 延迟 + 200ms 执行 + 100ms 余量）
          setTimeout(() => {
            try {
              console.info(`[状态面板] 楼层 ${messageId} 因 MESSAGE_RECEIVED 事件刷新（600ms）`);
              refreshData();
            } catch (refreshErr) {
              console.error(`[状态面板] MESSAGE_RECEIVED 刷新失败:`, refreshErr);
            }
          }, 600);
        }
      } catch (eventErr) {
        console.error(`[状态面板] MESSAGE_RECEIVED 事件处理失败:`, eventErr);
      }
    });

    // 监听消息ROLL（重新生成）事件
    eventOn(tavern_events.MESSAGE_SWIPED, swipedMessageId => {
      console.info(`[状态面板] MESSAGE_SWIPED 事件收到，swipedMessageId=${swipedMessageId}, 当前楼层=${messageId}, 类型: ${typeof swipedMessageId}`);
      try {
        // 【修复】ROLL 时，最新楼层的界面应该刷新
        // swipedMessageId 可能不可靠，所以检查当前楼层是否是最新楼层
        const lastId = getLastMessageId();
        const isCurrentLatest = messageId === lastId;
        const isSwipedCurrent = Number(swipedMessageId) === messageId;

        console.info(`[状态面板] MESSAGE_SWIPED 检查: lastId=${lastId}, isCurrentLatest=${isCurrentLatest}, isSwipedCurrent=${isSwipedCurrent}`);

        // 如果是当前楼层被ROLL，或者当前是最新楼层
        if (isSwipedCurrent || isCurrentLatest) {
          console.info(`[状态面板] 楼层 ${messageId} 检测到 MESSAGE_SWIPED 事件，准备刷新`);

          // 【关键修复】ROLL 后重置数据为默认值，强制清除旧 swipe 的缓存数据
          // 这确保界面不会显示旧 swipe 的数据
          data.value = createDefaultData();
          isDataReady.value = false;

          // 【修复】使用多次重试机制，确保能读取到新 swipe 的数据
          // 游戏逻辑: 300ms 延迟 + ~300ms 执行 + 写入时间
          // 首次尝试在 800ms 后，之后每 500ms 重试一次
          let retryCount = 0;
          const maxRetries = 10; // 最多重试 10 次（共 5.8 秒）

          const tryRefresh = () => {
            retryCount++;
            try {
              console.info(`[状态面板] 楼层 ${messageId} MESSAGE_SWIPED 刷新尝试 ${retryCount}/${maxRetries}`);

              // 读取数据
              const variables = Mvu.getMvuData({ type: 'message', message_id: messageId });
              const statData = _.get(variables, 'stat_data');

              // 检查数据是否有效（非空且有实际内容）
              if (statData && typeof statData === 'object' && Object.keys(statData).length > 0) {
                // 检查时间字段是否存在，作为数据有效性的标志
                const hasValidTime = statData?.世界?.时间 && statData?.世界?.日期;
                if (hasValidTime) {
                  try {
                    const parsedData = parseCleanData(statData);
                    data.value = parsedData;
                    isDataReady.value = true;
                    console.info(`[状态面板] ✅ MESSAGE_SWIPED 刷新成功（第 ${retryCount} 次），时间: ${parsedData?.世界?.日期} ${parsedData?.世界?.时间}`);
                    return; // 成功，停止重试
                  } catch (parseErr) {
                    console.warn(`[状态面板] MESSAGE_SWIPED 数据解析失败:`, parseErr);
                  }
                } else {
                  console.info(`[状态面板] MESSAGE_SWIPED 数据无效（缺少时间字段），将重试`);
                }
              } else {
                console.info(`[状态面板] MESSAGE_SWIPED stat_data 为空或不存在，将重试`);
              }

              // 如果还有重试次数，继续重试
              if (retryCount < maxRetries) {
                setTimeout(tryRefresh, 500);
              } else {
                console.warn(`[状态面板] MESSAGE_SWIPED 重试次数已用尽，保持当前状态`);
                isDataReady.value = true; // 确保界面可显示
              }
            } catch (refreshErr) {
              console.error(`[状态面板] MESSAGE_SWIPED 刷新失败:`, refreshErr);
              if (retryCount < maxRetries) {
                setTimeout(tryRefresh, 500);
              } else {
                isDataReady.value = true;
              }
            }
          };

          // 首次尝试延迟 800ms
          setTimeout(tryRefresh, 800);
        }
      } catch (eventErr) {
        console.error(`[状态面板] MESSAGE_SWIPED 事件处理失败:`, eventErr);
      }
    });

    // 记录当前楼层的 swipe_id，用于检测 ROLL
    let lastKnownSwipeId: number | undefined = undefined;
    try {
      const chat = SillyTavern.chat;
      if (chat && chat[messageId]) {
        lastKnownSwipeId = chat[messageId].swipe_id ?? 0;
        console.info(`[状态面板] 楼层 ${messageId} 初始 swipe_id: ${lastKnownSwipeId}`);
      }
    } catch (err) {
      console.warn(`[状态面板] 获取初始 swipe_id 失败:`, err);
    }

    // 检测是否是新的 swipe（ROLL 检测）
    function detectSwipeChange(): boolean {
      try {
        const chat = SillyTavern.chat;
        if (!chat || !chat[messageId]) return false;

        const currentSwipeId = chat[messageId].swipe_id ?? 0;
        if (lastKnownSwipeId !== undefined && currentSwipeId !== lastKnownSwipeId) {
          console.info(`[状态面板] 检测到 ROLL: 楼层 ${messageId} swipe_id 从 ${lastKnownSwipeId} 变为 ${currentSwipeId}`);
          lastKnownSwipeId = currentSwipeId;
          return true;
        }
        lastKnownSwipeId = currentSwipeId;
        return false;
      } catch (err) {
        return false;
      }
    }

    // 监听生成结束事件（作为备选，确保 ROLL 后也能刷新）
    eventOn(tavern_events.GENERATION_ENDED, generatedMessageId => {
      console.info(`[状态面板] GENERATION_ENDED 事件收到，原始 generatedMessageId=${generatedMessageId}, 当前楼层=${messageId}`);
      try {
        // GENERATION_ENDED 事件的 message_id 可能无效，需要使用 getLastMessageId() 获取实际 ID
        const actualMessageId = getLastMessageId();
        const isCurrentLatest = messageId === actualMessageId;

        // 【关键修复】检测是否发生了 ROLL（swipe_id 变化）
        const isRoll = detectSwipeChange();

        console.info(`[状态面板] GENERATION_ENDED 检查: actualMessageId=${actualMessageId}, isCurrentLatest=${isCurrentLatest}, isLatestFloor=${isLatestFloor.value}, isRoll=${isRoll}`);

        // 如果是当前楼层或检测到 ROLL，刷新数据
        if (isCurrentLatest || isLatestFloor.value || isRoll) {
          console.info(`[状态面板] 楼层 ${messageId} 检测到 GENERATION_ENDED 事件，准备刷新 (isRoll=${isRoll})`);

          // 如果是 ROLL，先重置数据
          if (isRoll) {
            data.value = createDefaultData();
            isDataReady.value = false;
          }

          // 【修复】增加延迟到 800ms，确保游戏逻辑脚本完成
          setTimeout(() => {
            try {
              console.info(`[状态面板] 楼层 ${messageId} 因 GENERATION_ENDED 事件刷新（800ms）`);
              refreshData();
            } catch (refreshErr) {
              console.error(`[状态面板] GENERATION_ENDED 刷新失败:`, refreshErr);
            }
          }, 800);
        }
      } catch (eventErr) {
        console.error(`[状态面板] GENERATION_ENDED 事件处理失败:`, eventErr);
      }
    });

    // 【新增】监听 IFRAME_DATA_REFRESH 事件（由游戏逻辑脚本在 ROLL/删除/生成完成时广播）
    eventOn('IFRAME_DATA_REFRESH', (eventData: { reason: string; message_id: number }) => {
      console.info(`[状态面板] 收到 IFRAME_DATA_REFRESH 事件:`, eventData);
      try {
        const { reason, message_id: eventMessageId } = eventData;

        // 判断是否需要响应此事件
        const lastId = getLastMessageId();
        const isCurrentLatest = messageId === lastId;
        const isTargetFloor = messageId === eventMessageId;

        console.info(`[状态面板] IFRAME_DATA_REFRESH 检查: reason=${reason}, eventMessageId=${eventMessageId}, currentMessageId=${messageId}, lastId=${lastId}, isCurrentLatest=${isCurrentLatest}, isTargetFloor=${isTargetFloor}`);

        // 最新楼层 或 目标楼层 需要响应
        if (isCurrentLatest || isTargetFloor) {
          console.info(`[状态面板] 楼层 ${messageId} 因 ${reason} 事件触发刷新`);

          // ROLL 或删除后，先重置数据再刷新（GENERATION_ENDED 不重置，因为可能已有数据）
          if (reason === 'MESSAGE_SWIPED' || reason === 'MESSAGE_DELETED') {
            data.value = createDefaultData();
            isDataReady.value = false;
          }

          // 延迟刷新，确保游戏逻辑已完成处理
          // GENERATION_ENDED 事件已经延迟 800ms 广播，这里只需短延迟
          const delay = reason === 'GENERATION_ENDED' ? 100 : 300;
          setTimeout(() => {
            try {
              console.info(`[状态面板] 楼层 ${messageId} 执行 IFRAME_DATA_REFRESH 刷新（${delay}ms）`);
              refreshData();
            } catch (refreshErr) {
              console.error(`[状态面板] IFRAME_DATA_REFRESH 刷新失败:`, refreshErr);
              isDataReady.value = true; // 确保界面可显示
            }
          }, delay);
        }
      } catch (eventErr) {
        console.error(`[状态面板] IFRAME_DATA_REFRESH 事件处理失败:`, eventErr);
      }
    });

    // 【ROLL修复】周期性数据同步 - 作为后备机制
    // 当事件监听失败或被跳过时，确保数据仍能同步
    // 仅对最新楼层启用，避免不必要的性能开销
    const { pause: pauseIntervalSync, resume: resumeIntervalSync } = useIntervalFn(() => {
      try {
        // 检查是否仍是最新楼层
        const lastId = getLastMessageId();
        const stillLatest = messageId === lastId;

        if (stillLatest) {
          // 读取当前变量数据
          const variables = Mvu.getMvuData({ type: 'message', message_id: messageId });
          const statData = _.get(variables, 'stat_data');

          if (statData && typeof statData === 'object') {
            // 对比数据是否有变化
            const newTime = statData?.世界?.时间;
            const newDate = statData?.世界?.日期;
            const currentTime = data.value?.世界?.时间;
            const currentDate = data.value?.世界?.日期;

            // 如果时间或日期变化，说明数据已更新
            if (newTime !== currentTime || newDate !== currentDate) {
              console.info(`[状态面板] 周期同步检测到数据变化: ${currentDate} ${currentTime} -> ${newDate} ${newTime}`);
              try {
                const parsedData = parseCleanData(statData);
                data.value = parsedData;
                console.info(`[状态面板] ✅ 周期同步完成，楼层 ${messageId}`);
              } catch (parseErr) {
                console.warn(`[状态面板] 周期同步解析失败:`, parseErr);
              }
            }
          }
        } else {
          // 不再是最新楼层，暂停周期同步
          console.info(`[状态面板] 楼层 ${messageId} 不再是最新，暂停周期同步`);
          pauseIntervalSync();
        }
      } catch (syncErr) {
        console.warn(`[状态面板] 周期同步出错:`, syncErr);
      }
    }, 1000); // 每秒检查一次

    // 初始时根据是否最新楼层决定是否启用周期同步
    if (!isLatestFloor.value) {
      pauseIntervalSync();
    }
  } catch (err) {
    console.error('[状态面板] 数据加载失败:', err);
    isDataReady.value = true; // 确保界面能显示
  }
});

// ==================== 角色选择函数 ====================
// 点击角色面板时同时设置查看角色和植入目标
function selectCharacter(char: '秦璐' | '苏梦') {
  activeCharacter.value = char;
  implantTarget.value = char;
}

// ==================== 监听角色切换 ====================
// 当用户切换角色tab时，更新系统追踪中的当前角色
watch(activeCharacter, newCharacter => {
  try {
    if (data.value?.系统追踪?.当前角色 !== newCharacter) {
      if (data.value?.系统追踪) {
        data.value.系统追踪.当前角色 = newCharacter;
        saveCurrentCharacter(); // 部分更新：仅保存当前角色，避免覆盖时间等数据
        console.info(`[角色切换] 当前角色已更新为: ${newCharacter}`);
      }
    }
  } catch (err) {
    console.error(`[角色切换] 切换失败:`, err);
  }
});

// ==================== 安全数据访问（供模板使用）====================
// 世界信息的安全访问
const safeWorld = computed(() => {
  try {
    return {
      日期: data.value?.世界?.日期 ?? '----/--/--',
      时间: data.value?.世界?.时间 ?? '--:--',
      星期: data.value?.世界?.星期 ?? '周三',
      地点: data.value?.世界?.地点 ?? '未知',
      环境氛围: data.value?.世界?.环境氛围 ?? '日常',
    };
  } catch {
    return { 日期: '----/--/--', 时间: '--:--', 星期: '周三', 地点: '未知', 环境氛围: '日常' };
  }
});

// 星期样式类（工作日/休息日区分）
const weekdayClass = computed(() => {
  const weekday = safeWorld.value.星期;
  if (weekday === '周六' || weekday === '周日') {
    return 'weekend';
  }
  // 工作日根据上午班/下午班区分
  if (weekday === '周一' || weekday === '周三' || weekday === '周五') {
    return 'morning-shift';
  }
  return 'afternoon-shift';
});

// ==================== 计算属性 ====================
const currentCharacter = computed(() => {
  try {
    const char = activeCharacter.value === '秦璐' ? data.value?.秦璐状态 : data.value?.苏梦状态;
    // 确保返回有效对象，即使数据不存在也返回默认值
    return char ?? createDefaultData().秦璐状态;
  } catch {
    return createDefaultData().秦璐状态;
  }
});

// 念头植入数量上限
const MAX_THOUGHTS = 5;
// 念头内容字数上限
const MAX_THOUGHT_LENGTH = 10;

// 当前角色的念头数量
const currentThoughtCount = computed(() => {
  try {
    const target = implantTarget.value;
    const stateKey = `${target}状态` as '秦璐状态' | '苏梦状态';
    return data.value[stateKey]?.念头培育区?.length ?? 0;
  } catch {
    return 0;
  }
});

// 是否已达到念头上限
const isThoughtLimitReached = computed(() => currentThoughtCount.value >= MAX_THOUGHTS);

// 只有最新楼层、有输入内容、未达上限且未超字数才能植入
const canImplant = computed(() => {
  try {
    const content = thoughtContent.value.trim();
    return isLatestFloor.value && content.length > 0 && content.length <= MAX_THOUGHT_LENGTH && !isThoughtLimitReached.value;
  } catch {
    return false;
  }
});

// 身体改造检测
const hasBodyMods = computed(() => {
  try {
    const mods = currentCharacter.value?.身体改造;
    if (!mods) return false;
    return (
      Object.keys(mods.纹身 || {}).length > 0 ||
      Object.values(mods.穿刺 || {}).some(v => v === true || (Array.isArray(v) && v.length > 0)) ||
      (mods.永久标记?.length || 0) > 0 ||
      (mods.临时标记?.length || 0) > 0 ||
      mods.体态变化 !== '无'
    );
  } catch {
    return false;
  }
});

// 获取活跃的穿刺列表
const activePiercings = computed(() => {
  try {
    const p = currentCharacter.value?.身体改造?.穿刺;
    if (!p) return [];
    const list: string[] = [];
    if (p.耳环) list.push('耳环');
    if (p.乳环) list.push('乳环');
    if (p.乳头环) list.push('乳头环');
    if (p.阴蒂环) list.push('阴蒂环');
    if (p.舌环) list.push('舌环');
    if (p.肚脐环) list.push('肚脐环');
    if (p.阴唇环) list.push('阴唇环');
    if (p.其他 && p.其他.length > 0) list.push(...p.其他);
    return list;
  } catch {
    return [];
  }
});

// 习惯影响程度
const habitInfluenceLevel = computed(() => {
  try {
    const count = currentCharacter.value?.习惯列表?.length || 0;
    if (count >= 13) return 'extreme';
    if (count >= 8) return 'strong';
    if (count >= 4) return 'moderate';
    return 'weak';
  } catch {
    return 'weak';
  }
});

const habitInfluenceText = computed(() => {
  try {
    const count = currentCharacter.value?.习惯列表?.length || 0;
    if (count >= 13) return '完全内化';
    if (count >= 8) return '深度影响';
    if (count >= 4) return '明显影响';
    if (count >= 1) return '轻微影响';
    return '';
  } catch {
    return '';
  }
});

// 当前角色的疑心值（根据选择的角色动态显示）
const currentSuspicion = computed(() => {
  try {
    return activeCharacter.value === '秦璐'
      ? (data.value.苏文状态?.对秦璐疑心值 ?? 0)
      : (data.value.苏文状态?.对苏梦疑心值 ?? 0);
  } catch {
    return 0;
  }
});

// 当前角色的基础印象（从变量读取，由脚本自动生成）
const currentImpression = computed(() => {
  try {
    const impression = activeCharacter.value === '秦璐'
      ? (data.value.苏文状态?.对秦璐印象?.基础印象 ?? '我的贤内助')
      : (data.value.苏文状态?.对苏梦印象?.基础印象 ?? '我的乖女儿');
    // 限制12个字符，超出则截断并添加省略号
    return impression.length > 12 ? impression.slice(0, 11) + '…' : impression;
  } catch {
    return '未知';
  }
});

// 当前角色的印象细节（从变量读取，由AI补充）
const currentImpressionDetail = computed(() => {
  try {
    const detail = activeCharacter.value === '秦璐'
      ? (data.value.苏文状态?.对秦璐印象?.细节描述 ?? '')
      : (data.value.苏文状态?.对苏梦印象?.细节描述 ?? '');
    // 限制20个字符，超出则截断并添加省略号
    if (!detail) return '';
    return detail.length > 20 ? detail.slice(0, 19) + '…' : detail;
  } catch {
    return '';
  }
});

// 当前角色的疑心值冻结状态
const currentSuspicionFreeze = computed(() => {
  try {
    const defaultFreeze = { 是否冻结: false, 冻结结束时间: '' };
    if (activeCharacter.value === '秦璐') {
      return data.value.苏文状态?.对秦璐疑心值冻结 ?? defaultFreeze;
    }
    return data.value.苏文状态?.对苏梦疑心值冻结 ?? defaultFreeze;
  } catch {
    return { 是否冻结: false, 冻结结束时间: '' };
  }
});

// 安眠药是否生效
const isSleepingPillActive = computed(() => {
  try {
    return data.value.苏文状态?.安眠药状态?.是否生效 === true;
  } catch {
    return false;
  }
});

// 安眠药剩余时间（小时）
const sleepingPillRemainingHours = computed(() => {
  try {
    if (!isSleepingPillActive.value) return 0;
    return data.value.苏文状态?.安眠药状态?.剩余时间 || 0;
  } catch {
    return 0;
  }
});

// 住院状态是否生效（终极隐藏模式）
const isHospitalized = computed(() => {
  try {
    return data.value.苏文状态?.住院状态?.是否住院 === true;
  } catch {
    return false;
  }
});

// 住院剩余天数
const hospitalizationRemainingDays = computed(() => {
  try {
    if (!isHospitalized.value) return 0;
    return data.value.苏文状态?.住院状态?.剩余天数 || 0;
  } catch {
    return 0;
  }
});

// 苏文状态显示（状态 + 位置）
const suwenStatusDisplay = computed(() => {
  try {
    const status = data.value.苏文状态?.当前状态;
    const location = data.value.苏文状态?.当前位置;

    if (!status) return '未知';

    // 【住院状态】显示特殊文字（终极隐藏模式）
    if (isHospitalized.value) {
      return `住院 (${hospitalizationRemainingDays.value}天)`;
    }

    // 【安眠药沉睡状态】显示特殊文字
    if (isSleepingPillActive.value) {
      return `沉睡 (${sleepingPillRemainingHours.value}h)`;
    }

    // 如果是睡眠状态，只显示"睡眠"
    if (status === '睡眠') {
      return '睡眠';
    }

    // 如果是出差或上班，只显示状态
    if (status === '出差' || status === '上班') {
      return status;
    }

    // 在家状态，显示位置
    if (status === '在家' && location) {
      return `在家 - ${location}`;
    }

    return status;
  } catch {
    return '未知';
  }
});

// 剩余冻结时间
const remainingFreezeTime = computed(() => {
  try {
    if (!currentSuspicionFreeze.value?.是否冻结) return '';

    const endTimeStr = currentSuspicionFreeze.value?.冻结结束时间;
    if (!endTimeStr) return '未知';

    // 解析当前时间
    const dateStr = data.value.世界?.日期;
    const timeStr = data.value.世界?.时间;
    if (!dateStr || !timeStr) return '计算中...';

    const [curYear, curMonth, curDay] = dateStr.split('/').map(Number);
    const [curHour, curMinute] = timeStr.split(':').map(Number);
    const current = new Date(curYear, curMonth - 1, curDay, curHour, curMinute);

    // 解析结束时间
    const [endDate, endTime] = endTimeStr.split(' ');
    const [endYear, endMonth, endDay] = endDate.split('/').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay, endHour, endMinute);

    // 计算差值
    const diffMs = end.getTime() - current.getTime();
    if (diffMs <= 0) return '即将解除';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}时${minutes}分`;
  } catch {
    return '计算中...';
  }
});

// ==================== 危险监控计算属性 ====================
const INTERRUPTION_THRESHOLD = 4; // 打断阈值：4小时
const PATROL_COOLDOWN = 2; // 巡逻冷却：2小时

// 苏文是否在家且清醒（危险状态）
const isSuwenDangerous = computed(() => {
  try {
    const status = data.value.苏文状态?.当前状态;
    return status === '在家';
  } catch {
    return false;
  }
});

// 苏文安全原因（用于显示安全提示）
const suwenSafeReason = computed(() => {
  try {
    // 【住院状态】终极隐藏模式特殊显示
    if (isHospitalized.value) {
      return `🏥 终极模式 - 全阶段念头解锁 (${hospitalizationRemainingDays.value}天)`;
    }
    // 【安眠药状态】特殊显示
    if (isSleepingPillActive.value) {
      return `🔮 秘籍生效中 - 可临时解锁下一阶段念头 (${sleepingPillRemainingHours.value}h)`;
    }
    const status = data.value.苏文状态?.当前状态;
    if (status === '出差') return '安全 - 苏文出差中';
    if (status === '上班') return '安全 - 苏文上班中';
    if (status === '睡眠') return '安全 - 苏文在睡觉';
    return null;
  } catch {
    return null;
  }
});

// 是否在主角房间
// 使用 世界.地点 而非 系统追踪.当前所在位置，因为前者由 AI 直接更新，更可靠
const isInSonRoom = computed(() => {
  try {
    const location = data.value.世界?.地点;
    // 世界.地点 格式为 "家 - 主角房间"，需要检查是否包含 "主角房间"
    return location?.includes('主角房间') ?? false;
  } catch {
    return false;
  }
});

// 是否显示危险监控
const showDangerMonitor = computed(() => {
  try {
    return isSuwenDangerous.value && isInSonRoom.value;
  } catch {
    return false;
  }
});

// 危险时间累计（使用当前角色独立的危险时间累计）
const dangerTime = computed(() => {
  try {
    // 根据当前选择的角色获取对应的危险时间累计
    const fieldName = activeCharacter.value === '秦璐' ? '秦璐危险时间累计' : '苏梦危险时间累计';
    const value = data.value.系统追踪?.[fieldName];
    return typeof value === 'number' ? value : 0;
  } catch {
    return 0;
  }
});

// 危险时间百分比
const dangerTimePercent = computed(() => {
  try {
    const time = dangerTime.value;
    if (typeof time !== 'number' || isNaN(time)) return 0;
    return Math.min(100, (time / INTERRUPTION_THRESHOLD) * 100);
  } catch {
    return 0;
  }
});

// 危险时间显示
const dangerTimeDisplay = computed(() => {
  try {
    const time = dangerTime.value;
    if (typeof time !== 'number' || isNaN(time)) return `0 / ${INTERRUPTION_THRESHOLD} 时`;
    return `${time.toFixed(1)} / ${INTERRUPTION_THRESHOLD} 时`;
  } catch {
    return `0 / ${INTERRUPTION_THRESHOLD} 时`;
  }
});

// 剩余打断时间
const remainingInterruptionTime = computed(() => {
  try {
    const time = dangerTime.value;
    if (typeof time !== 'number' || isNaN(time)) return '计算中...';
    const remaining = INTERRUPTION_THRESHOLD - time;
    if (remaining <= 0) return '即将打断！';
    const hours = Math.floor(remaining);
    const minutes = Math.round((remaining - hours) * 60);
    return `距离强制打断还剩: ${hours}时${minutes}分`;
  } catch {
    return '计算中...';
  }
});

// 危险时间颜色类
const dangerTimeColorClass = computed(() => {
  try {
    const percent = dangerTimePercent.value;
    if (typeof percent !== 'number' || isNaN(percent)) return 'safe';
    if (percent >= 75) return 'danger';
    if (percent >= 50) return 'warning';
    if (percent >= 25) return 'caution';
    return 'safe';
  } catch {
    return 'safe';
  }
});

// 巡逻冷却时间计算
const patrolCooldownTime = computed(() => {
  try {
    const lastPatrolTime = data.value.系统追踪?.苏文巡逻事件?.上次巡逻时间;
    if (!lastPatrolTime) return PATROL_COOLDOWN; // 没有巡逻过，冷却已满

    const dateStr = data.value.世界?.日期;
    const timeStr = data.value.世界?.时间;
    if (!dateStr || !timeStr || !dateStr.includes('/') || !timeStr.includes(':')) {
      return PATROL_COOLDOWN;
    }

    // 解析当前时间
    const [curYear, curMonth, curDay] = dateStr.split('/').map(Number);
    const [curHour, curMinute] = timeStr.split(':').map(Number);
    if (isNaN(curYear) || isNaN(curMonth) || isNaN(curDay) || isNaN(curHour) || isNaN(curMinute)) {
      return PATROL_COOLDOWN;
    }
    const current = new Date(curYear, curMonth - 1, curDay, curHour, curMinute);

    // 解析上次巡逻时间
    if (!lastPatrolTime.includes(' ')) return PATROL_COOLDOWN;
    const [lastDate, lastTime] = lastPatrolTime.split(' ');
    if (!lastDate || !lastTime || !lastDate.includes('/') || !lastTime.includes(':')) {
      return PATROL_COOLDOWN;
    }
    const [lastYear, lastMonth, lastDay] = lastDate.split('/').map(Number);
    const [lastHour, lastMinute] = lastTime.split(':').map(Number);
    if (isNaN(lastYear) || isNaN(lastMonth) || isNaN(lastDay) || isNaN(lastHour) || isNaN(lastMinute)) {
      return PATROL_COOLDOWN;
    }
    const last = new Date(lastYear, lastMonth - 1, lastDay, lastHour, lastMinute);

    // 计算已过时间（小时）
    const diffMs = current.getTime() - last.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, Math.min(PATROL_COOLDOWN, diffHours));
  } catch {
    return PATROL_COOLDOWN;
  }
});

// 巡逻冷却百分比
const patrolCooldownPercent = computed(() => {
  const time = patrolCooldownTime.value;
  if (typeof time !== 'number' || isNaN(time)) return 100;
  return (time / PATROL_COOLDOWN) * 100;
});

// 巡逻冷却显示
const patrolCooldownDisplay = computed(() => {
  const time = patrolCooldownTime.value;
  if (typeof time !== 'number' || isNaN(time)) return `${PATROL_COOLDOWN} / ${PATROL_COOLDOWN} 时`;
  return `${time.toFixed(1)} / ${PATROL_COOLDOWN} 时`;
});

// 巡逻状态文字
const patrolStatusText = computed(() => {
  const time = patrolCooldownTime.value;
  if (typeof time !== 'number' || isNaN(time)) return '计算中...';
  if (time < PATROL_COOLDOWN) {
    const remaining = PATROL_COOLDOWN - time;
    const minutes = Math.round(remaining * 60);
    return `冷却中: ${minutes}分后可触发`;
  }
  return '巡逻冷却已满，随时可能触发';
});

// 计算当前巡逻触发概率
const currentPatrolProbability = computed(() => {
  try {
    // 基础概率 15%
    let probability = 15;

    // 时间段修正
    const timeStr = data.value.世界?.时间;
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hour] = timeStr.split(':').map(Number);
    if (isNaN(hour)) return 0;

    let timeMultiplier = 1.0;
    if (hour >= 7 && hour < 12) timeMultiplier = 1.0;
    else if (hour >= 12 && hour < 18) timeMultiplier = 1.2;
    else if (hour >= 18 && hour < 22) timeMultiplier = 0.8;
    else timeMultiplier = 0.3; // 22:00-07:00

    // 疑心值修正
    const suspicion = currentSuspicion.value ?? 0;
    let suspicionMultiplier = 1.0;
    if (suspicion < 20) suspicionMultiplier = 0.8;
    else if (suspicion < 40) suspicionMultiplier = 1.0;
    else if (suspicion < 60) suspicionMultiplier = 1.3;
    else if (suspicion < 80) suspicionMultiplier = 1.6;
    else suspicionMultiplier = 2.0;

    // 冷却检查
    const cooldown = patrolCooldownTime.value;
    if (typeof cooldown === 'number' && cooldown < PATROL_COOLDOWN) {
      return 0; // 冷却中无法触发
    }

    probability = probability * timeMultiplier * suspicionMultiplier;
    return Math.round(probability * 10) / 10; // 保留一位小数
  } catch {
    return 0;
  }
});

// 概率颜色类
const probabilityColorClass = computed(() => {
  try {
    const prob = currentPatrolProbability.value;
    if (typeof prob !== 'number' || isNaN(prob)) return 'none';
    if (prob >= 25) return 'high';
    if (prob >= 15) return 'medium';
    if (prob > 0) return 'low';
    return 'none';
  } catch {
    return 'none';
  }
});

// 风险等级
const riskLevel = computed(() => {
  try {
    const dangerPercent = dangerTimePercent.value;
    const prob = currentPatrolProbability.value;

    if (typeof dangerPercent !== 'number' || typeof prob !== 'number') return 'low';
    if (dangerPercent >= 75 || prob >= 25) return 'critical';
    if (dangerPercent >= 50 || prob >= 18) return 'high';
    if (dangerPercent >= 25 || prob >= 10) return 'medium';
    return 'low';
  } catch {
    return 'low';
  }
});

// 风险等级文字
const riskLevelText = computed(() => {
  try {
    switch (riskLevel.value) {
      case 'critical': return '极危险';
      case 'high': return '高风险';
      case 'medium': return '中风险';
      default: return '低风险';
    }
  } catch {
    return '低风险';
  }
});

// ==================== 方法 ====================
// 部分更新：仅保存当前角色选择
function saveCurrentCharacter() {
  if (!isLatestFloor.value) {
    console.warn('[状态面板] 旧楼层不允许保存数据');
    return;
  }
  updateVariablesWith(
    vars => _.set(vars, 'stat_data.系统追踪.当前角色', data.value.系统追踪.当前角色),
    { type: 'message', message_id: -1 },
  );
}

// 部分更新：仅保存念头相关数据
// 【重要】必须使用 Mvu.replaceMvuData 而不是 updateVariablesWith
// 因为习惯注入脚本使用 Mvu.getMvuData 读取数据，两者必须使用同一套 API
async function saveThoughtData(target: '秦璐' | '苏梦') {
  if (!isLatestFloor.value) {
    console.warn('[状态面板] 旧楼层不允许保存数据');
    return;
  }
  try {
    const stateKey = `${target}状态` as const;
    // 获取当前 MVU 数据
    const currentVars = Mvu.getMvuData({ type: 'message', message_id: -1 });
    // 更新念头相关数据
    _.set(currentVars, `stat_data.${stateKey}.念头培育区`, data.value[stateKey].念头培育区);
    _.set(currentVars, 'stat_data.系统追踪.念头植入日志', data.value.系统追踪.念头植入日志);
    // 使用 MVU API 保存
    await Mvu.replaceMvuData(currentVars, { type: 'message', message_id: -1 });
    console.info(`[念头植入] 数据已通过 MVU API 保存到最新楼层`);
  } catch (err) {
    console.error('[念头植入] 保存数据失败:', err);
  }
}

function calculateExpireTime(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('/').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  d.setHours(d.getHours() + 24);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 根据开发时间计算难度等级显示
 * - 困难：>=6小时（包括AI判定失败的23小时和被拒绝的26小时）
 * - 中等：>=4小时
 * - 简单：<4小时
 */
function getDifficultyLabel(hours: number): '简单' | '中等' | '困难' {
  if (hours >= 6) return '困难';
  if (hours >= 4) return '中等';
  return '简单';
}

// 注意：念头植入的 AI 通知功能已移至 脚本/习惯注入/index.ts
// AI 判定念头类型的功能也移至习惯注入脚本，在下次 AI 回复时进行判定
// 该脚本是单例，统一处理：习惯列表注入、念头植入通知、状态一致性检查、强制事件提示
// 日志清理功能已移至 脚本/游戏逻辑/logCleanup.ts

// 植入状态
const isImplanting = ref(false);

async function implantThought() {
  if (!canImplant.value || isImplanting.value) return;

  isImplanting.value = true;

  try {
    const target = implantTarget.value;
    const stateKey = `${target}状态` as '秦璐状态' | '苏梦状态';
    const targetState = data.value[stateKey];

    const plantTime = `${data.value.世界.日期} ${data.value.世界.时间}`;
    const expireTime = calculateExpireTime(data.value.世界.日期, data.value.世界.时间);
    const content = thoughtContent.value.trim();

    // 获取角色当前状态
    const stage = targetState.当前阶段;
    const dependency = targetState.对主角依存度;
    const moral = targetState.道德底线;

    // 本地判定（传入秘籍状态：安眠药/住院，可解锁更多念头）
    const judgeResult = judgeThought(content, stage, dependency, moral, {
      isSleepingPillActive: isSleepingPillActive.value,
      isHospitalized: isHospitalized.value,
    });

    // 判断是否需要延迟到 AI 判定
    // 【终极隐藏模式】住院状态下，所有念头直接判定为"简单"，无需AI判定
    const needsPending = judgeResult.needAI && !isHospitalized.value;

    let newThought;
    if (needsPending) {
      // 本地无法匹配，设置为待判定状态
      console.info(`[念头植入] 念头"${content}"需要 AI 判定，设置为待定状态`);
      newThought = {
        念头内容: content,
        植入时间: plantTime,
        过期时间: expireTime,
        需要时间: 0, // 待判定时为0
        难度等级: '待定' as const,
        开发进度: 0,
        待判定: true,
      };
    } else if (isHospitalized.value) {
      // 【终极隐藏模式】住院期间，所有念头固定为"简单"难度，2小时开发时间
      console.info(`[念头植入] 住院模式：念头"${content}"直接设为简单难度`);
      newThought = {
        念头内容: content,
        植入时间: plantTime,
        过期时间: expireTime,
        需要时间: 2,
        难度等级: '简单' as const,
        开发进度: 0,
        待判定: false,
      };
    } else {
      // 本地匹配成功
      const { category, allowed, hours: needHours, reason } = judgeResult;
      const difficulty = getDifficultyLabel(needHours);

      // 显示判定结果
      if (!allowed && reason) {
        console.warn(`[念头植入] 念头被拒绝: ${reason}`);
        toastr.warning(
          `⚠️ ${reason}\n念头开发时间${needHours}小时，将会过期`,
          '念头超出当前阶段',
          { timeOut: 5000 },
        );
      } else if (category) {
        console.info(`[念头植入] 念头类型: ${category}，难度: ${difficulty}，需要${needHours}小时`);
      }

      newThought = {
        念头内容: content,
        植入时间: plantTime,
        过期时间: expireTime,
        需要时间: needHours,
        难度等级: difficulty,
        开发进度: 0,
        待判定: false,
      };
    }

    // 1. 更新念头培育区
    targetState.念头培育区.push(newThought);

    // 2. 添加到念头植入日志（待通知AI）
    const currentFloor = getLastMessageId();
    if (typeof currentFloor !== 'number') {
      console.error('[念头植入] 无法获取当前楼层ID:', currentFloor);
      toastr.error('无法获取楼层信息，植入失败');
      return;
    }

    data.value.系统追踪.念头植入日志.push({
      目标: target,
      内容: content,
      植入时间: plantTime,
      植入楼层: currentFloor,
      已通知AI: false,
    });

    // 3. 保存念头相关数据（部分更新，避免覆盖时间等数据）
    await saveThoughtData(target);

    console.info(
      `[念头植入] 已向${target}植入念头："${content}"` +
        `，待判定：${needsPending}`,
    );

    thoughtContent.value = '';

    if (needsPending) {
      toastr.info(
        `已向${target}植入念头\n难度：待定（等待AI判定）\n将在AI回复后确定开发时间`,
        '',
        { timeOut: 3000 },
      );
    } else {
      const { category, hours: needHours, willExpire } = judgeResult;
      const difficulty = getDifficultyLabel(needHours);
      if (!willExpire) {
        const categoryInfo = category ? `【${category}】` : '';
        toastr.success(
          `已向${target}植入念头${categoryInfo}\n难度：${difficulty}，需${needHours}小时\n将在你下次发送消息时通知AI`,
          '',
          { timeOut: 3000 },
        );
      }
    }
  } catch (err) {
    console.error('[念头植入] 失败:', err);
    toastr.error('植入失败');
  } finally {
    isImplanting.value = false;
  }
}

/**
 * 删除正在培育的念头
 * @param index 念头在数组中的索引
 */
async function handleDeleteThought(index: number) {
  const target = implantTarget.value;
  const stateKey = `${target}状态` as '秦璐状态' | '苏梦状态';
  const thoughts = data.value[stateKey]?.念头培育区;

  if (!thoughts || index < 0 || index >= thoughts.length) {
    console.error('[删除念头] 无效的索引:', index);
    return;
  }

  const thought = thoughts[index];
  const thoughtContent = thought.念头内容;

  // 确认删除
  if (!confirm(`确定要删除念头"${thoughtContent}"吗？\n\n删除后无法恢复。`)) {
    return;
  }

  try {
    console.info(`[删除念头] 开始删除${target}的念头: "${thoughtContent}" (索引${index})`);

    // 从数组中删除念头
    thoughts.splice(index, 1);

    // 保存数据
    await saveThoughtData(target);

    console.info(`[删除念头] 成功删除${target}的念头: "${thoughtContent}"`);
    toastr.success(`已删除念头："${thoughtContent}"`, '', { timeOut: 2000 });
  } catch (err) {
    console.error('[删除念头] 失败:', err);
    toastr.error('删除失败');
  }
}
</script>

<style lang="scss" scoped>
@use 'sass:color';

// ========== 配色系统 ==========
$c-bg: #0d0d0d;
$c-panel: rgba(18, 18, 18, 0.98);
$c-gold: #d4af37;
$c-gold-dim: #8a7326;
$c-red: #8a1c1c;
$c-red-light: #c54b4b;
$c-text: #e0e0e0;
$c-text-sub: #888;
$c-green: #4caf50;
$c-purple: #9c27b0;
$c-blue: #4fc3f7;
$c-cyan: #4fc3f7; // 待判定状态颜色
$c-orange: #ff9800;
$font-serif: 'Noto Serif SC', 'Songti SC', 'STSong', serif;
$font-sans: 'Roboto', sans-serif;

// ========== 容器 ==========
.mystic-container {
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
    radial-gradient(ellipse at 20% 0%, rgba($c-red, 0.12), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba($c-red, 0.1), transparent 50%),
    // 金色点缀
    radial-gradient(circle at 50% 50%, rgba($c-gold, 0.04), transparent 60%),
    // 织物暗纹 - 更明显的交叉纹理
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 1px,
      rgba(255, 255, 255, 0.025) 1px,
      rgba(255, 255, 255, 0.025) 2px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 1px,
      rgba(255, 255, 255, 0.025) 1px,
      rgba(255, 255, 255, 0.025) 2px
    ),
    // 额外的大间距暗纹
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 20px,
      rgba($c-gold, 0.015) 20px,
      rgba($c-gold, 0.015) 21px
    ),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 20px,
      rgba($c-gold, 0.015) 20px,
      rgba($c-gold, 0.015) 21px
    );
  z-index: 0;
}

// ========== 主面板 ==========
.main-panel {
  position: relative;
  z-index: 1;
  padding: 20px 24px;
  background: $c-panel;
  border: 1px solid rgba($c-gold, 0.15);
  backdrop-filter: blur(5px);
}

// ========== 装饰线 ==========
.panel-decor {
  position: absolute;
  left: 15px;
  right: 15px;
  height: 1px;
  background: linear-gradient(90deg, transparent, $c-gold, transparent);
  opacity: 0.4;

  &.top { top: 8px; }
  &.bottom { bottom: 8px; }
}

// ========== 头部 ==========
.header {
  text-align: center;
  margin-bottom: 18px;

  .world-info {
    font-family: $font-serif;
    color: $c-gold;
    font-size: 13px;
    letter-spacing: 1px;

    .info-item {
      .icon {
        margin-right: 4px;
        font-style: normal;
      }

      // 星期显示样式
      &.weekday {
        margin-left: 6px;
        padding: 2px 8px;
        font-size: 11px;
        border-radius: 3px;
        font-weight: bold;

        // 周末（苏文全天在家）
        &.weekend {
          background: rgba($c-red, 0.15);
          color: $c-red-light;
          border: 1px solid rgba($c-red, 0.3);
        }

        // 上午班工作日（周一、三、五）
        &.morning-shift {
          background: rgba($c-gold, 0.1);
          color: $c-gold;
          border: 1px solid rgba($c-gold, 0.2);
        }

        // 下午班工作日（周二、四）
        &.afternoon-shift {
          background: rgba($c-blue, 0.1);
          color: $c-blue;
          border: 1px solid rgba($c-blue, 0.2);
        }
      }
    }

    .divider {
      margin: 0 10px;
      font-size: 8px;
      color: $c-gold-dim;
    }
  }

  .environment {
    font-size: 11px;
    color: $c-text-sub;
    margin-top: 4px;
    font-style: italic;
  }
}

// ========== 角色标签 ==========
.char-tabs {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba($c-gold, 0.1);
  padding-bottom: 15px;

  .tab-item {
    position: relative;
    padding: 8px 24px;
    cursor: pointer;
    text-align: center;
    transition: all 0.3s;
    border: 1px solid transparent;

    .char-name {
      display: block;
      font-size: 18px;
      font-family: $font-serif;
      font-weight: bold;
      color: $c-text-sub;
      transition: color 0.3s;
    }

    .char-role {
      font-size: 10px;
      color: rgba($c-text-sub, 0.5);
      letter-spacing: 2px;
    }

    &:hover .char-name {
      color: $c-text;
    }

    &.active {
      border: 1px solid rgba($c-gold, 0.3);
      background: rgba($c-gold, 0.05);

      .char-name {
        color: $c-gold;
        text-shadow: 0 0 10px rgba($c-gold, 0.3);
      }

      .char-role {
        color: $c-gold-dim;
      }

      &::after {
        content: '';
        position: absolute;
        bottom: -16px;
        left: 50%;
        width: 6px;
        height: 6px;
        background: $c-gold;
        transform: translateX(-50%) rotate(45deg);
        box-shadow: 0 0 5px $c-gold;
      }
    }
  }
}

// ========== 念头植入区 ==========
.implant-control {
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border: 1px solid rgba($c-gold, 0.12);
  margin-bottom: 20px;

  .control-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;

    .title {
      color: $c-gold;
      font-size: 12px;
      letter-spacing: 3px;
    }

    .decor-line {
      height: 1px;
      width: 40px;
      background: $c-gold-dim;
      opacity: 0.5;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .target-hint {
      display: flex;
      align-items: center;
      justify-content: center;

      .hint-text {
        font-size: 12px;
        color: $c-text-sub;

        strong {
          color: $c-gold;
          font-weight: bold;
        }
      }
    }

    .input-wrapper {
      flex: 1;
      display: flex;
      position: relative;

      input {
        flex: 1;
        height: 34px;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba($c-text-sub, 0.3);
        border-right: none;
        color: $c-text;
        padding: 0 50px 0 12px;
        font-family: $font-serif;
        outline: none;

        &::placeholder {
          color: rgba($c-text-sub, 0.6);
        }

        &:focus {
          border-color: $c-gold;
          background: rgba(0, 0, 0, 0.6);
        }
      }

      .char-count {
        position: absolute;
        right: 70px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        color: rgba($c-text-sub, 0.6);
        pointer-events: none;

        &.at-limit {
          color: $c-gold;
        }
      }

      .submit-btn {
        background: linear-gradient(135deg, $c-red, color.adjust($c-red, $lightness: -10%));
        border: 1px solid $c-red;
        color: #ddd;
        padding: 0 20px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover:not(:disabled) {
          filter: brightness(1.2);
          box-shadow: 0 0 10px rgba($c-red, 0.4);
        }

        &:disabled {
          filter: grayscale(1);
          cursor: not-allowed;
          opacity: 0.5;
        }
      }
    }
  }
}

// ========== 状态展示区 ==========
.status-display {
  display: flex;
  gap: 24px;
  min-height: 300px;

  .col-left {
    flex: 0 0 180px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .col-right {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
    max-height: 450px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: $c-gold-dim;
      border-radius: 2px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }
}

// ========== 境界圆环 ==========
.stage-card {
  text-align: center;

  .stage-ring {
    position: relative;
    width: 110px;
    margin: 0 auto;

    .circular-chart {
      display: block;
      margin: 0 auto;
      max-width: 100%;
    }

    .circle-bg {
      fill: none;
      stroke: rgba($c-text-sub, 0.15);
      stroke-width: 2.5;
    }

    .circle {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke: $c-gold;
      filter: drop-shadow(0 0 3px $c-gold);
      transition: stroke-dasharray 0.5s ease;
    }

    .stage-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;

      .label {
        font-size: 10px;
        color: $c-text-sub;
      }

      .value {
        font-size: 14px;
        color: $c-text;
        font-family: $font-serif;
        font-weight: bold;
      }
    }
  }
}

// ========== 数值组 ==========
.stats-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  .stat-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: $c-text-sub;
    margin-bottom: 3px;

    .name {
      font-size: 10px;
    }

    .num {
      color: $c-text;
      font-weight: bold;
    }
  }

  .progress-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;

    .progress-bar {
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s;

      &.stat-moral { background: linear-gradient(90deg, $c-green, color.adjust($c-green, $lightness: -10%)); }
      &.stat-desire { background: linear-gradient(90deg, $c-red, color.adjust($c-red, $lightness: 10%)); }
      &.stat-husband { background: linear-gradient(90deg, $c-blue, color.adjust($c-blue, $lightness: -15%)); }
      &.stat-corruption { background: linear-gradient(90deg, $c-purple, color.adjust($c-purple, $lightness: 10%)); }
    }
  }
}

// ========== 苏文卡片 ==========
.suwen-card {
  border: 1px solid rgba($c-text-sub, 0.2);
  padding: 10px;
  background: rgba(0, 0, 0, 0.25);
  overflow: hidden;

  .suwen-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .name {
      font-size: 12px;
      color: $c-text;
      font-weight: bold;
    }

    .status-tag {
      font-size: 10px;
      padding: 2px 6px;
      background: rgba($c-text-sub, 0.2);
      color: $c-text-sub;

      // 安眠药沉睡状态 - 红色高亮
      &.sleeping-pill {
        background: rgba($c-red, 0.3);
        color: $c-red;
        font-weight: bold;
        animation: sleeping-pulse 2s ease-in-out infinite;
      }

      // 住院状态（终极隐藏模式）- 金色高亮
      &.hospitalized {
        background: rgba(255, 215, 0, 0.4);
        color: #ffd700;
        font-weight: bold;
        animation: hospitalized-pulse 2s ease-in-out infinite;
        text-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
      }
    }
  }

  // 安眠药沉睡动画
  @keyframes sleeping-pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 4px rgba($c-red, 0.5);
    }
    50% {
      opacity: 0.8;
      box-shadow: 0 0 8px rgba($c-red, 0.8);
    }
  }

  // 住院状态动画（终极隐藏模式）
  @keyframes hospitalized-pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 6px rgba(255, 215, 0, 0.6);
    }
    50% {
      opacity: 0.9;
      box-shadow: 0 0 12px rgba(255, 215, 0, 0.9);
    }
  }

  .suspicion-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: $c-text-sub;
    margin-bottom: 6px;

    .label { flex: 0 0 28px; }

    .suspicion-track {
      flex: 1;
      height: 5px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      position: relative;
      overflow: hidden;

      .suspicion-fill {
        height: 100%;
        background: $c-orange;
        border-radius: 2px;
        transition: width 0.3s;

        &.danger {
          background: $c-red;
        }
      }

      // 冻结状态
      &.frozen {
        .suspicion-fill {
          background: $c-blue;
          animation: freeze-pulse 2s ease-in-out infinite;
        }
      }

      .freeze-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba($c-blue, 0.3), transparent);
        animation: freeze-shimmer 3s linear infinite;
      }
    }

    .val {
      flex: 0 0 20px;
      text-align: right;
      color: $c-text;
    }

    .freeze-icon {
      font-size: 12px;
      animation: freeze-bounce 1s ease-in-out infinite;
    }
  }

  .freeze-info {
    background: rgba($c-blue, 0.1);
    border: 1px solid rgba($c-blue, 0.2);
    padding: 6px 8px;
    margin-bottom: 6px;
    font-size: 10px;

    .freeze-reason {
      color: $c-blue;
      margin-bottom: 2px;
    }

    .freeze-time {
      color: $c-text-sub;
      font-size: 9px;
    }
  }

  .impression-row {
    display: flex;
    gap: 6px;
    font-size: 10px;
    overflow: hidden;

    .label {
      color: $c-text-sub;
      flex: 0 0 28px;
    }

    .impression-text {
      color: $c-text;
      font-style: italic;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0; // 允许 flex 子元素收缩到小于内容宽度
    }
  }

  .impression-detail-row {
    margin-top: 2px;
    padding-left: 34px;
    font-size: 9px;
    overflow: hidden;

    .detail-text {
      color: $c-text-sub;
      font-style: italic;
      opacity: 0.8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: block;
      max-width: 100%; // 允许填满父容器而不溢出
    }
  }

  // ========== 危险监控区域 ==========
  .danger-monitor {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed rgba($c-red, 0.3);

    .monitor-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;

      .monitor-icon {
        font-size: 12px;
      }

      .monitor-title {
        font-size: 11px;
        color: $c-red-light;
        font-weight: bold;
        letter-spacing: 1px;
      }

      .risk-badge {
        margin-left: auto;
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 2px;

        &.low {
          background: rgba($c-green, 0.15);
          color: $c-green;
        }
        &.medium {
          background: rgba($c-orange, 0.15);
          color: $c-orange;
        }
        &.high {
          background: rgba($c-red, 0.2);
          color: $c-red-light;
        }
        &.critical {
          background: rgba($c-red, 0.3);
          color: #ff6b6b;
          animation: risk-pulse 1s ease-in-out infinite;
        }
      }
    }

    .monitor-item {
      margin-bottom: 8px;

      .item-header {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        margin-bottom: 3px;

        .item-icon {
          font-size: 10px;
        }

        .item-label {
          color: $c-text-sub;
        }

        .item-value {
          margin-left: auto;
          color: $c-text;
          font-weight: bold;
          font-size: 9px;
        }
      }

      .monitor-track {
        height: 4px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 2px;
        overflow: hidden;

        .monitor-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.5s ease;

          &.safe {
            background: linear-gradient(90deg, $c-green, color.adjust($c-green, $lightness: -5%));
          }
          &.caution {
            background: linear-gradient(90deg, #c9b022, #a89a1c);
          }
          &.warning {
            background: linear-gradient(90deg, $c-orange, color.adjust($c-orange, $lightness: -10%));
          }
          &.danger {
            background: linear-gradient(90deg, $c-red, $c-red-light);
            animation: danger-pulse 1.5s ease-in-out infinite;
          }
          &.patrol {
            background: linear-gradient(90deg, $c-blue, color.adjust($c-blue, $lightness: -15%));
          }
        }
      }

      .item-detail {
        font-size: 9px;
        color: $c-text-sub;
        margin-top: 2px;
        text-align: right;
      }
    }

    .probability-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dotted rgba($c-text-sub, 0.2);

      .prob-label {
        color: $c-text-sub;
      }

      .prob-value {
        font-weight: bold;

        &.none {
          color: $c-text-sub;
        }
        &.low {
          color: $c-green;
        }
        &.medium {
          color: $c-orange;
        }
        &.high {
          color: $c-red-light;
        }
      }
    }
  }

  // ========== 安全提示 ==========
  .safe-indicator {
    margin-top: 10px;
    padding: 8px;
    background: rgba($c-green, 0.08);
    border: 1px solid rgba($c-green, 0.2);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;

    .safe-icon {
      color: $c-green;
      font-weight: bold;
    }

    .safe-text {
      color: $c-green;
    }

    // 安眠药生效状态 - 特殊紫红色高亮
    &.sleeping-pill-active {
      background: rgba($c-red, 0.15);
      border: 1px solid rgba($c-red, 0.4);
      animation: sleeping-pill-glow 2s ease-in-out infinite;

      .safe-icon {
        color: $c-red;
        font-size: 14px;
      }

      .safe-text {
        color: $c-red;
        font-weight: bold;
      }
    }

    // 住院状态（终极隐藏模式）- 金色高亮
    &.hospitalized-active {
      background: rgba(255, 215, 0, 0.2);
      border: 1px solid rgba(255, 215, 0, 0.5);
      animation: hospitalized-glow 2s ease-in-out infinite;

      .safe-icon {
        color: #ffd700;
        font-size: 16px;
        text-shadow: 0 0 6px rgba(255, 215, 0, 0.8);
      }

      .safe-text {
        color: #ffd700;
        font-weight: bold;
        text-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
      }
    }
  }

  // 安眠药生效发光动画
  @keyframes sleeping-pill-glow {
    0%, 100% {
      box-shadow: 0 0 5px rgba($c-red, 0.3);
    }
    50% {
      box-shadow: 0 0 15px rgba($c-red, 0.6);
    }
  }

  // 住院状态发光动画（终极隐藏模式）
  @keyframes hospitalized-glow {
    0%, 100% {
      box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
    }
    50% {
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    }
  }
}

// 危险脉动动画
@keyframes danger-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes risk-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

// 冻结动画
@keyframes freeze-pulse {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.6; filter: brightness(1.3); }
}

@keyframes freeze-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes freeze-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

// ========== 通用 Section 标题 ==========
.section-title {
  font-size: 11px;
  color: $c-gold-dim;
  border-bottom: 1px solid rgba($c-gold, 0.1);
  padding-bottom: 4px;
  margin-bottom: 10px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  &:first-child {
    margin-top: 0;
  }

  .influence-badge {
    font-size: 9px;
    padding: 1px 6px;
    margin-left: auto;

    &.weak { color: $c-text-sub; }
    &.moderate { color: $c-gold; background: rgba($c-gold, 0.1); }
    &.strong { color: $c-red-light; background: rgba($c-red, 0.1); }
    &.extreme { color: $c-red-light; background: rgba($c-red, 0.2); font-weight: bold; }
  }
}

// ========== 心境区 ==========
.mental-section {
  .mental-content {
    background: rgba(255, 255, 255, 0.02);
    padding: 10px 12px;
    border-left: 2px solid $c-gold;

    .emotion-row {
      font-size: 12px;
      margin-bottom: 6px;

      .label {
        color: $c-text-sub;
        margin-right: 8px;
      }

      .emotion-val {
        color: $c-gold;
      }
    }

    .thought-bubble {
      font-size: 13px;
      color: $c-text;
      font-family: $font-serif;
      line-height: 1.6;
      font-style: italic;
      margin-bottom: 8px;

      .empty-thought {
        color: $c-text-sub;
        font-size: 12px;
      }
    }

    .temperament {
      font-size: 11px;
      color: $c-text-sub;
      text-align: right;
    }
  }
}

// ========== 念头列表 ==========
.thoughts-section {
  .thought-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .thought-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);

    .thought-main {
      flex: 1;
      min-width: 0; // 防止flex子元素溢出
    }

    .thought-content {
      font-size: 12px;
      color: $c-text;
      margin-bottom: 6px;
    }

    .thought-meta {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: $c-text-sub;
      margin-bottom: 4px;

      .diff-tag {
        padding: 1px 5px;
        border-radius: 2px;

        &.简单 { color: $c-green; background: rgba($c-green, 0.1); }
        &.中等 { color: $c-orange; background: rgba($c-orange, 0.1); }
        &.困难 { color: $c-red-light; background: rgba($c-red, 0.1); }
        &.待定 { color: $c-cyan; background: rgba($c-cyan, 0.1); }
      }

      .pending-text {
        color: $c-cyan;
        font-style: italic;
      }
    }

    .thought-bar {
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1px;
      overflow: hidden; // 防止动画溢出

      .thought-fill {
        height: 100%;
        background: $c-gold;
        border-radius: 1px;
        transition: width 0.3s;
      }

      &.pending-bar {
        .pending-fill {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba($c-cyan, 0.5), transparent);
          animation: pending-shimmer 2s linear infinite;
        }
      }
    }

    &.pending {
      border-color: rgba($c-cyan, 0.3);
    }
  }

  // 删除按钮
  .delete-thought-btn {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.3);
    color: #888;
    font-size: 14px;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: rgba(138, 28, 28, 0.3);
      border-color: rgba(197, 75, 75, 0.5);
      color: $c-red-light;
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

@keyframes pending-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

// ========== 习惯区 ==========
.habits-section {
  .habit-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .habit-tag {
    font-size: 11px;
    padding: 4px 10px;
    background: rgba($c-red, 0.1);
    border: 1px solid rgba($c-red, 0.25);
    color: $c-text;
  }
}

// ========== 仪容区 ==========
.appearance-section {
  .appearance-category {
    margin-bottom: 12px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 10px;

    &.danger-zone {
      border-color: rgba($c-red, 0.2);
      background: rgba($c-red, 0.05);
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .cat-icon {
        font-size: 14px;
      }

      .cat-name {
        font-size: 12px;
        color: $c-text;
        font-weight: bold;
      }

      .cat-tags {
        margin-left: auto;
        display: flex;
        gap: 4px;
      }

      .mini-tag {
        font-size: 9px;
        padding: 2px 6px;
        background: rgba($c-gold, 0.15);
        color: $c-gold;

        &.outline {
          background: transparent;
          border: 1px solid rgba($c-text-sub, 0.3);
          color: $c-text-sub;
        }

        &.warn {
          background: rgba($c-orange, 0.15);
          color: $c-orange;
        }
      }
    }

    .category-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px 12px;

      .detail-row {
        display: flex;
        font-size: 10px;

        .d-label {
          flex: 0 0 36px;
          color: $c-text-sub;
        }

        .d-value {
          color: $c-text;
          flex: 1;
        }

        &.highlight {
          .d-value {
            color: $c-gold;
          }
        }
      }
    }
  }

  // 身体改造内容
  .bodymod-content {
    .mod-group {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 10px;

      &:last-child {
        margin-bottom: 0;
      }

      .mod-icon {
        font-size: 12px;
        flex: 0 0 16px;
      }

      .mod-label {
        flex: 0 0 48px;
        color: $c-text-sub;
      }

      .mod-items {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .mod-tag {
        padding: 2px 6px;
        background: rgba($c-red, 0.15);
        border: 1px solid rgba($c-red, 0.3);
        color: $c-text;

        &.danger {
          background: rgba($c-red, 0.25);
          color: $c-red-light;
        }

        &.temp {
          background: rgba($c-purple, 0.15);
          border-color: rgba($c-purple, 0.3);
        }
      }

      .mod-text {
        color: $c-text;
      }
    }
  }
}

// ==================== 移动端响应式适配 ====================
@media screen and (max-width: 480px) {
  // 主面板减小内边距
  .main-panel {
    padding: 12px 10px;
  }

  // 头部信息换行显示
  .header {
    margin-bottom: 12px;

    .world-info {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px 8px;
      font-size: 11px;

      .divider {
        display: none; // 隐藏分隔符
      }

      .info-item.weekday {
        font-size: 10px;
        padding: 1px 6px;
      }
    }
  }

  // 角色标签缩小间距
  .char-tabs {
    gap: 15px;
    margin-bottom: 15px;
    padding-bottom: 12px;

    .tab-item {
      padding: 6px 16px;

      .char-name {
        font-size: 15px;
      }

      .char-role {
        font-size: 9px;
      }
    }
  }

  // 念头植入区
  .implant-control {
    padding: 10px;
    margin-bottom: 15px;

    .control-header {
      margin-bottom: 10px;

      .title {
        font-size: 11px;
        letter-spacing: 2px;
      }

      .decor-line {
        width: 25px;
      }
    }

    .input-group {
      .target-hint .hint-text {
        font-size: 11px;
      }

      .input-wrapper {
        input {
          height: 32px;
          font-size: 12px;
          padding: 0 10px;
        }

        .submit-btn {
          padding: 0 14px;
          font-size: 12px;
        }
      }
    }
  }

  // 核心变化：状态展示区改为纵向布局
  .status-display {
    flex-direction: column;
    gap: 15px;
    min-height: auto;

    .col-left {
      flex: none;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .col-right {
      flex: none;
      max-height: none;
      padding-right: 0;
    }
  }

  // 境界圆环适配
  .stage-card {
    .stage-ring {
      width: 90px;

      .stage-text {
        .label {
          font-size: 9px;
        }
        .value {
          font-size: 12px;
        }
      }
    }
  }

  // 核心数值组
  .stats-group {
    gap: 8px;

    .stat-item {
      .stat-header {
        font-size: 10px;

        .name {
          font-size: 10px;
        }
      }

      .progress-track {
        height: 4px;
      }
    }
  }

  // 苏文卡片
  .suwen-card {
    padding: 8px;

    .suwen-header {
      margin-bottom: 6px;

      .name {
        font-size: 11px;
      }

      .status-tag {
        font-size: 9px;
        padding: 1px 5px;
      }
    }

    .suspicion-row {
      font-size: 9px;
      gap: 4px;

      .label {
        flex: 0 0 24px;
      }

      .suspicion-track {
        height: 4px;
      }

      .val {
        flex: 0 0 18px;
      }
    }

    .freeze-info {
      padding: 5px 6px;
      font-size: 9px;

      .freeze-time {
        font-size: 8px;
      }
    }

    .impression-row {
      font-size: 9px;

      .label {
        flex: 0 0 24px;
      }
    }

    .impression-detail-row {
      padding-left: 28px;
      font-size: 8px;
    }

    // 危险监控
    .danger-monitor {
      margin-top: 8px;
      padding-top: 8px;

      .monitor-header {
        margin-bottom: 8px;

        .monitor-icon {
          font-size: 11px;
        }

        .monitor-title {
          font-size: 10px;
        }

        .risk-badge {
          font-size: 8px;
          padding: 1px 5px;
        }
      }

      .monitor-item {
        margin-bottom: 6px;

        .item-header {
          font-size: 9px;

          .item-value {
            font-size: 8px;
          }
        }

        .monitor-track {
          height: 3px;
        }

        .item-detail {
          font-size: 8px;
        }
      }

      .probability-row {
        font-size: 9px;
        margin-top: 6px;
        padding-top: 5px;
      }
    }

    .safe-indicator {
      padding: 6px;
      font-size: 9px;
    }
  }

  // 区块标题
  .section-title {
    font-size: 10px;
    margin-top: 12px;
    margin-bottom: 8px;
    padding-bottom: 3px;

    .influence-badge {
      font-size: 8px;
      padding: 1px 4px;
    }
  }

  // 心境区
  .mental-section {
    .mental-content {
      padding: 8px 10px;

      .emotion-row {
        font-size: 11px;
        margin-bottom: 4px;
      }

      .thought-bubble {
        font-size: 12px;
        line-height: 1.5;
        margin-bottom: 6px;

        .empty-thought {
          font-size: 11px;
        }
      }

      .temperament {
        font-size: 10px;
      }
    }
  }

  // 念头列表
  .thoughts-section {
    .thought-list {
      gap: 6px;
    }

    .thought-item {
      padding: 8px;

      .thought-content {
        font-size: 11px;
        margin-bottom: 4px;
      }

      .thought-meta {
        font-size: 9px;

        .diff-tag {
          padding: 0 4px;
        }
      }

      .thought-bar {
        height: 2px;
      }
    }
  }

  // 习惯区
  .habits-section {
    .habit-tags {
      gap: 4px;
    }

    .habit-tag {
      font-size: 10px;
      padding: 3px 8px;
    }
  }

  // 仪容区
  .appearance-section {
    .appearance-category {
      margin-bottom: 10px;
      padding: 8px;

      .category-header {
        margin-bottom: 6px;

        .cat-icon {
          font-size: 12px;
        }

        .cat-name {
          font-size: 11px;
        }

        .mini-tag {
          font-size: 8px;
          padding: 1px 4px;
        }
      }

      .category-details {
        grid-template-columns: 1fr; // 单列显示
        gap: 3px;

        .detail-row {
          font-size: 9px;

          .d-label {
            flex: 0 0 32px;
          }
        }
      }
    }

    .bodymod-content {
      .mod-group {
        font-size: 9px;
        margin-bottom: 6px;

        .mod-icon {
          font-size: 10px;
          flex: 0 0 14px;
        }

        .mod-label {
          flex: 0 0 40px;
        }

        .mod-tag {
          padding: 1px 4px;
          font-size: 9px;
        }
      }
    }
  }
}

// 中等屏幕适配（平板竖屏等）
@media screen and (min-width: 481px) and (max-width: 768px) {
  .main-panel {
    padding: 15px 18px;
  }

  .status-display {
    gap: 18px;

    .col-left {
      flex: 0 0 160px;
    }
  }

  .stage-card .stage-ring {
    width: 100px;
  }

  .appearance-section .appearance-category .category-details {
    grid-template-columns: 1fr; // 中等屏幕也用单列
  }
}
</style>
