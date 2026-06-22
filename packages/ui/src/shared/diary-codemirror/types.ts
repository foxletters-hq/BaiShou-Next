/**
 * CodeMirror 日记编辑器桥接协议（RN ↔ WebView）
 * @see 方案第 7 节
 */

/** WebView 内 ImageWidget / attachment 插件注入的平台能力（方案 1.3） */
export interface DiaryCmPlatform {
  resolveAttachmentUrl(srcRaw: string): string
  onImageAction?(
    action: 'delete' | 'copy' | 'open',
    payload: { from: number; to: number; src: string; srcRaw: string }
  ): void
  onExternalImagePreview?(resolvedSrc: string): void
  /** mobile: 点击图片后将光标移到 Markdown 行之后 */
  onImageTap?(payload: { from: number; to: number }): void
  /** mobile: touch 宽度调整; desktop: mouse */
  interactionMode: 'mouse' | 'touch'
  /** mobile: 首行 #标签 编辑 */
  tagLineMode?: boolean
  /** mobile: viewport=WebView 内滚动; document=转发 RN 外层滚动 */
  scrollMode?: 'viewport' | 'document'
}

export type DiaryCmInteractionMode = DiaryCmPlatform['interactionMode']

/** init 消息携带的主题色，供 WebView CM 样式使用 */
export interface DiaryCmTheme {
  isDark: boolean
  textPrimary: string
  textSecondary: string
  bgEditor: string
  borderColor: string
  primary: string
  /** 标签四色前景，与 DiaryCard 配色槽一致 */
  tagColors: [string, string, string, string]
}

export interface DiaryCmInitPayload {
  content: string
  placeholder?: string
  theme: DiaryCmTheme
  interactionMode: DiaryCmInteractionMode
  /** 默认 true；false 时为只读预览 */
  editable?: boolean
  scrollMode?: 'viewport' | 'document'
  tagLineMode?: boolean
  tagColorRegistry?: DiaryTagColorRegistry
  /** WebView 内滚动时需预留的底部遮挡（RN 浮动工具栏等） */
  scrollInsets?: DiaryCmSetScrollInsetsPayload
}

export type DiaryTagColorRegistry = Record<string, number>

// ---------------------------------------------------------------------------
// RN → WebView
// ---------------------------------------------------------------------------

export interface DiaryCmSetContentPayload {
  content: string
}

export interface DiaryCmInsertAtCursorPayload {
  text: string
}

export interface DiaryCmSetSelectionPayload {
  start: number
  end: number
}

export interface DiaryCmResolveUrlResponsePayload {
  requestId: string
  /** null 表示解析失败或超时，WebView 应显示 broken image */
  url: string | null
}

export interface DiaryCmSetEditablePayload {
  editable: boolean
}

export interface DiaryCmSetTagColorRegistryPayload {
  registry: DiaryTagColorRegistry
}

/** WebView 内滚动时预留的底部遮挡高度（如 RN 浮动工具栏） */
export interface DiaryCmSetScrollInsetsPayload {
  bottom: number
}

export type DiaryCmToWebViewMessage =
  | { type: 'init'; payload: DiaryCmInitPayload }
  | { type: 'setContent'; payload: DiaryCmSetContentPayload }
  | { type: 'setTagColorRegistry'; payload: DiaryCmSetTagColorRegistryPayload }
  | { type: 'insertAtCursor'; payload: DiaryCmInsertAtCursorPayload }
  | { type: 'setSelection'; payload: DiaryCmSetSelectionPayload }
  | { type: 'setEditable'; payload: DiaryCmSetEditablePayload }
  | { type: 'setScrollInsets'; payload: DiaryCmSetScrollInsetsPayload }
  | { type: 'scrollCaretIntoView' }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'resolveUrlResponse'; payload: DiaryCmResolveUrlResponsePayload }
  /** RN 未收到 ready 时请求 WebView 重新发送 ready */
  | { type: 'requestReady' }

// ---------------------------------------------------------------------------
// WebView → RN
// ---------------------------------------------------------------------------

export interface DiaryCmChangePayload {
  content: string
}

export interface DiaryCmSelectionChangePayload {
  start: number
  end: number
}

export interface DiaryCmResolveUrlRequestPayload {
  requestId: string
  srcRaw: string
}

export type DiaryCmImageActionType = 'delete' | 'copy' | 'open'

export interface DiaryCmImageActionPayload {
  action: DiaryCmImageActionType
  from: number
  to: number
  srcRaw: string
}

export interface DiaryCmImagePreviewPayload {
  srcRaw: string
  resolvedUrl: string
}

export interface DiaryCmContentHeightPayload {
  height: number
}

/** 光标在编辑器内容坐标系中的位置（用于 RN 外层 ScrollView 滚入视野） */
export interface DiaryCmCaretViewportPayload {
  top: number
  bottom: number
}

/** 触摸滑动增量，由 WebView 转发给 RN 外层 ScrollView */
export interface DiaryCmPanScrollPayload {
  deltaY: number
}

export type DiaryCmFromWebViewMessage =
  | { type: 'ready' }
  | { type: 'change'; payload: DiaryCmChangePayload }
  | { type: 'selectionChange'; payload: DiaryCmSelectionChangePayload }
  | { type: 'resolveUrlRequest'; payload: DiaryCmResolveUrlRequestPayload }
  | { type: 'imageAction'; payload: DiaryCmImageActionPayload }
  | { type: 'imagePreview'; payload: DiaryCmImagePreviewPayload }
  | { type: 'contentHeight'; payload: DiaryCmContentHeightPayload }
  | { type: 'caretViewport'; payload: DiaryCmCaretViewportPayload }
  | { type: 'panScroll'; payload: DiaryCmPanScrollPayload }
  | { type: 'focus' }
  | { type: 'blur' }

/** 桥接协议联合类型（S-7） */
export type DiaryCmBridgeProtocol = DiaryCmToWebViewMessage | DiaryCmFromWebViewMessage

/** M1 兼容别名 */
export type DiaryCmImageAction = DiaryCmImageActionType

/** M1 兼容别名：WebView → RN */
export type DiaryCmGuestMessage = DiaryCmFromWebViewMessage

/** M1 兼容别名：RN → WebView */
export type DiaryCmHostMessage = DiaryCmToWebViewMessage

export const DIARY_CM_RESOLVE_URL_TIMEOUT_MS = 10_000

/**
 * 竞态规则（方案 7.3）：
 *
 * 1. ready 前队列：RN 在收到 WebView `ready` 之前，除 `init` 外的 RN→WebView 命令
 *    一律入队；`ready` 后先 flush 队列再处理后续命令。
 * 2. 回声抑制：RN 主动 `setContent`（切换日记 / 外部 state 同步）时，应忽略 WebView
 *    随即回传的同内容 `change`，避免 RN state ↔ WebView 无限循环。
 * 3. resolveUrlRequest：每个 requestId 在 RN 侧登记 10s 超时；超时后回传
 *    `resolveUrlResponse { url: null }`，WebView 显示 broken image。
 */

export function isDiaryCmFromWebViewMessage(value: unknown): value is DiaryCmFromWebViewMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) return false
  const type = (value as { type: unknown }).type
  return (
    type === 'ready' ||
    type === 'change' ||
    type === 'selectionChange' ||
    type === 'resolveUrlRequest' ||
    type === 'imageAction' ||
    type === 'imagePreview' ||
    type === 'contentHeight' ||
    type === 'caretViewport' ||
    type === 'panScroll' ||
    type === 'focus' ||
    type === 'blur'
  )
}

export function parseDiaryCmFromWebViewMessage(raw: string): DiaryCmFromWebViewMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isDiaryCmFromWebViewMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function serializeDiaryCmToWebViewMessage(message: DiaryCmToWebViewMessage): string {
  return JSON.stringify(message)
}
