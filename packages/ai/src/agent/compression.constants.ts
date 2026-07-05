/** 压缩相关统一常量 */

/** 拉取会话消息上限（压缩 / 窗口 / 调用链共用） */
export const COMPRESSION_MESSAGE_FETCH_LIMIT = 2000

/** 压缩后异步 prune：保护最近 tool 输出估算 token */
export const PRUNE_PROTECT_TOKENS = 40_000

/** 至少剪出这么多 token 才执行 prune */
export const PRUNE_MINIMUM_TOKENS = 20_000

/** 历史 tool payload 保护窗口：最近 N 个用户回合保留完整内容 */
export const PRUNE_PROTECT_USER_TURNS = 5

/** 单个 tool payload 超过此字节数时，即使在保护窗口内也提前修剪 */
export const TOOL_PAYLOAD_MAX_BYTES = 1024 * 1024

/** 修剪后保留的正文预览长度（字符数） */
export const TOOL_PAYLOAD_PREVIEW_CHARS = 800

/** 保护窗口外 prune 时：单字段超过此字节数才裁剪 result/大参数 */
export const TOOL_PAYLOAD_PRUNE_FIELD_MAX_BYTES = 32 * 1024

/** 入库兜底：整段 tool payload 超过此字节数才立即瘦身 */
export const TOOL_PAYLOAD_STORE_MAX_BYTES = 512 * 1024

/** 送入摘要模型的单条 tool 文本上限 */
export const TOOL_OUTPUT_MAX_CHARS = 8_000

/** 压缩任务最短间隔（ms），避免双触发连打 */
export const COMPRESSION_DEBOUNCE_MS = 3_000
