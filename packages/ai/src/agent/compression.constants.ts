/** 压缩相关统一常量 */

/** 拉取会话消息上限（压缩 / 窗口 / 调用链共用） */
export const COMPRESSION_MESSAGE_FETCH_LIMIT = 2000

/** 压缩后异步 prune：保护最近 tool 输出估算 token */
export const PRUNE_PROTECT_TOKENS = 40_000

/** 至少剪出这么多 token 才执行 prune */
export const PRUNE_MINIMUM_TOKENS = 20_000

/** 送入摘要模型的单条 tool 文本上限 */
export const TOOL_OUTPUT_MAX_CHARS = 2_000

/** 压缩任务最短间隔（ms），避免双触发连打 */
export const COMPRESSION_DEBOUNCE_MS = 3_000
