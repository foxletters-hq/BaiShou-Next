/** 底部输入栏 + 工具条的大致高度，用于「回到底部」悬浮按钮定位 */
export const INPUT_DOCK_HEIGHT = 136
/** 编辑态：保存按钮与 token 行距键盘顶部的留白 */
export const BUBBLE_EDIT_KEYBOARD_BUFFER = 72
/** 编辑态且键盘收起时：保存/token 与底部工具栏之间的额外间距 */
export const BUBBLE_EDIT_DOCK_GAP = 16

export const IDLE_LIVE_COMPRESSION = {
  phase: 'auto' as const,
  summary: '',
  reasoning: '',
  isActive: false
}

/** 列表内流式助手气泡的稳定 key，落库前后保持同一挂载点 */
export const LIVE_ASSISTANT_STREAM_KEY = 'live-assistant-stream'
/** linger 结束后再保留 live 展示，等布局稳定后再释放 minHeight */
export const HOLD_LIVE_PRESENTATION_MS = 320

export type IdleLiveCompression = typeof IDLE_LIVE_COMPRESSION
