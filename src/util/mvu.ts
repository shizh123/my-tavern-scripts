/**
 * 支持动态获取 message_id 的变量选项类型
 * Bug #32 修复：支持传入函数来动态获取 message_id，解决 ES module 缓存导致的问题
 */
type DynamicVariableOption = VariableOption | (() => VariableOption);

/**
 * 解析动态变量选项
 */
function resolveVariableOption(option: DynamicVariableOption): VariableOption {
  return typeof option === 'function' ? option() : option;
}

export function defineMvuDataStore<T extends z.ZodObject>(
  schema: T,
  variable_option: DynamicVariableOption,
  additional_setup?: (data: Ref<z.infer<T>>) => void,
): ReturnType<typeof defineStore> {
  // Bug #32 修复：在 defineStore 调用时解析 variable_option
  // 这确保每个 iframe 实例都能获取到自己的 message_id
  const resolvedOption = resolveVariableOption(variable_option);

  if (
    resolvedOption.type === 'message' &&
    (resolvedOption.message_id === undefined || resolvedOption.message_id === 'latest')
  ) {
    resolvedOption.message_id = -1;
  }

  // Bug #32 修复：store ID 使用解析后的 option
  // 这确保每个楼层的状态栏有独立的 store ID
  return defineStore(
    `mvu_data.${_(resolvedOption)
      .entries()
      .sortBy(entry => entry[0])
      .map(entry => entry[1])
      .join('.')}`,
    errorCatched(() => {
      // Bug #32 修复：在 store setup 函数中再次解析，确保使用最新值
      // 注意：这里重新解析是为了处理 store 初始化时机的问题
      const currentOption = resolveVariableOption(variable_option);
      if (
        currentOption.type === 'message' &&
        (currentOption.message_id === undefined || currentOption.message_id === 'latest')
      ) {
        currentOption.message_id = -1;
      }

      // 使用 safeParse 避免在数据不存在时抛出错误
      const stat_data = _.get(getVariables(currentOption), 'stat_data', {});
      const parseResult = schema.safeParse(stat_data);

      // 获取初始数据：优先使用解析成功的数据，否则尝试生成默认值
      let initialData: z.infer<T>;
      if (parseResult.success) {
        initialData = parseResult.data;
      } else {
        // 尝试用空对象生成默认值，如果失败则使用 undefined（让调用方处理）
        try {
          initialData = schema.parse({});
        } catch {
          // Schema 没有为所有字段提供默认值，跳过初始化
          // 这通常发生在消息变量不存在时（新对话、删除消息等情况）
          console.warn('[MVU] 无法初始化数据存储：变量不存在或 Schema 验证失败，将使用空对象');
          // 创建一个空的代理对象，避免后续访问报错
          initialData = {} as z.infer<T>;
        }
      }
      const data = ref(initialData) as Ref<z.infer<T>>;
      if (additional_setup) {
        additional_setup(data);
      }

      // 连续检测不到 stat_data 的次数（用于区分临时缺失 vs 聊天重置）
      let missCount = 0;
      const MISS_THRESHOLD = 6; // 连续6次(3秒)未检测到→判定为聊天已重置，清空store

      const { pause, resume } = useIntervalFn(() => {
        // Bug #18 八次修复：检查消息变量是否真的存在 stat_data
        // 问题：当 getVariables 返回空对象时，schema.safeParse({}) 会成功返回默认值
        // 这导致真实数据被默认值覆盖

        // Bug #32 修复：使用 currentOption（在 setup 中解析的值），而不是外部的 resolvedOption
        // 这确保轮询使用正确的 message_id
        const variables = getVariables(currentOption);

        // 如果变量对象本身不存在或者没有 stat_data 字段，跳过同步
        // 这可以防止空数据覆盖已有的真实数据
        if (!variables || !_.has(variables, 'stat_data')) {
          // 聊天重置检测：连续多次缺失 stat_data 时，将 store 重置为默认值
          // 避免重置聊天/新建对话后前端仍显示旧游戏数据
          missCount++;
          if (missCount >= MISS_THRESHOLD) {
            try {
              const defaults = schema.parse({});
              if (!_.isEqual(data.value, defaults)) {
                ignoreUpdates(() => {
                  data.value = defaults;
                });
                console.info('[MVU] stat_data 持续缺失，已重置为默认值（聊天可能已重置）');
              }
            } catch {
              // schema 没有完整默认值，忽略
            }
            missCount = 0; // 重置计数，避免反复打日志
          }
          return;
        }
        missCount = 0; // 检测到数据，重置计数

        const stat_data = _.get(variables, 'stat_data', {});
        const result = schema.safeParse(stat_data);
        if (result.error) {
          return;
        }
        if (!_.isEqual(data.value, result.data)) {
          ignoreUpdates(() => {
            data.value = result.data;
          });
        }
        if (!_.isEqual(stat_data, result.data)) {
          updateVariablesWith(variables => _.set(variables, 'stat_data', result.data), currentOption);
        }
      }, 500);

      // 性能优化：iframe 滚出视口时暂停轮询，避免多楼层时大量 iframe 同时轮询
      // 使用父窗口的 IntersectionObserver 观察 iframe 元素在聊天区的可见性
      try {
        if (window.frameElement && window.parent) {
          const ParentIO = (window.parent as any).IntersectionObserver as typeof IntersectionObserver;
          const observer = new ParentIO(
            (entries: IntersectionObserverEntry[]) => {
              if (entries[0]?.isIntersecting) {
                resume();
              } else {
                pause();
              }
            },
            { root: null, threshold: 0 },
          );
          observer.observe(window.frameElement);
          onScopeDispose(() => observer.disconnect());
        }
      } catch {
        // 跨域或不在 iframe 中，忽略（保持默认轮询）
      }

      const { ignoreUpdates } = watchIgnorable(
        data,
        new_data => {
          const result = schema.safeParse(new_data);
          if (result.error) {
            return;
          }
          if (!_.isEqual(new_data, result.data)) {
            ignoreUpdates(() => {
              data.value = result.data;
            });
          }
          // Bug #32 修复：使用 currentOption
          updateVariablesWith(variables => _.set(variables, 'stat_data', result.data), currentOption);
        },
        { deep: true },
      );

      /** 同步刷新 store 数据到 MVU 变量，用于 triggerSlash 前确保数据已持久化 */
      function flush() {
        const result = schema.safeParse(data.value);
        if (!result.error) {
          updateVariablesWith(variables => _.set(variables, 'stat_data', result.data), currentOption);
        }
      }

      /** 从 MVU 拉取最新数据到 store（绕过 500ms 轮询延迟）
       *  用于按钮操作前确保读到脚本侧已清除/修改的值，避免 store 旧值覆盖 MVU */
      function pull() {
        const variables = getVariables(currentOption);
        if (!variables || !_.has(variables, 'stat_data')) return;
        const stat_data = _.get(variables, 'stat_data', {});
        const result = schema.safeParse(stat_data);
        if (result.error) return;
        if (!_.isEqual(data.value, result.data)) {
          ignoreUpdates(() => {
            data.value = result.data;
          });
        }
      }

      return { data, flush, pull };
    }),
  );
}
