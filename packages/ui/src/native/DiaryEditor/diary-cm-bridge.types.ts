import type { RefObject } from 'react'
import type { WebView } from 'react-native-webview'
import type {
  DiaryCmConfirmRequestPayload,
  DiaryCmImageActionPayload,
  DiaryCmMarkdownMark,
  DiaryCmTableSheetRequestPayload,
  DiaryCmTableSheetResponsePayload,
  DiaryCmTheme,
  DiaryTagColorRegistry
} from '../../shared/diary-codemirror/types'

export interface UseDiaryCodeMirrorBridgeOptions {
  content: string
  placeholder?: string
  theme: DiaryCmTheme
  /** 默认 true；false 时 WebView 内 CM 为只读预览 */
  editable?: boolean
  onChange?: (content: string) => void
  onSelectionChange?: (start: number, end: number) => void
  onFocus?: () => void
  onBlur?: () => void
  onContentHeight?: (height: number) => void
  /** 光标在编辑器内的纵向位置，供 RN 外层滚动 */
  onCaretViewport?: (top: number, bottom: number) => void
  /** WebView 内滑动手势转发给 RN 外层 ScrollView */
  onPanScroll?: (deltaY: number) => void
  tagColorRegistry?: DiaryTagColorRegistry
  onImageAction?: (payload: DiaryCmImageActionPayload) => void
  onImagePreview?: (srcRaw: string, resolvedUrl: string) => void
  /** attachment/xxx → data: 或 file: URI */
  resolveAttachmentUrl?: (srcRaw: string) => Promise<string | null>
  /** WebView 内滚动时需预留的底部遮挡高度（如 RN 浮动工具栏） */
  bottomScrollInset?: number
  /** 表格把手菜单等场景：收起系统输入法 */
  onDismissKeyboard?: () => void
  /** 表格删除等破坏性操作确认 */
  onConfirmRequest?: (
    payload: DiaryCmConfirmRequestPayload,
    respond: (confirmed: boolean) => void
  ) => void
  /** 表格把手菜单（RN 原生底部抽屉，显示在 Markdown 工具栏之上） */
  onTableSheetRequest?: (
    payload: DiaryCmTableSheetRequestPayload,
    respond: (response: DiaryCmTableSheetResponsePayload) => void
  ) => void
}

export interface DiaryCodeMirrorBridgeApi {
  webViewRef: RefObject<WebView | null>
  onWebViewMessage: (event: { nativeEvent: { data: string } }) => void
  onWebViewLoadStart: () => void
  onWebViewLoadEnd: () => void
  focusAtOffset: (offset: number) => void
  blur: () => void
  insertAtCursor: (text: string) => void
  insertAtRange: (start: number, end: number, text: string) => void
  undo: () => void
  redo: () => void
  toggleMarkdownMark: (marker: DiaryCmMarkdownMark) => void
  isReady: () => boolean
  setScrollInsets: (bottom: number, keyboardVisible?: boolean) => void
  scrollCaretIntoView: () => void
  deleteRange: (from: number, to: number) => void
}
