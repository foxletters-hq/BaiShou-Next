/**
 * MCP 客户端探测与调用失败时抛出的固定错误串。
 * 它们是探测方、运行时与设置页之间的约定串，不是界面文案：翻译后
 * `isMcpClientTimeoutMessage` 等识别会失效。
 */
export const MCP_CLIENT_TIMEOUT_TOKEN = '超时'
export const MCP_CLIENT_CONNECT_TIMEOUT_MESSAGE = '连接超时'
export const MCP_CLIENT_LIST_TOOLS_TIMEOUT_MESSAGE = '获取工具超时'
export const MCP_CLIENT_NOT_CONNECTED_MESSAGE = '外部 MCP 未连接'
