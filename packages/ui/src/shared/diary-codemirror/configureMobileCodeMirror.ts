import { EditorView } from '@codemirror/view'

let mobileWebViewConfigured = false

/**
 * Android WebView 上禁用 EditContext，走经典 contenteditable 选区。
 * 参考：codemirror/dev#1451、Joplin #11170、EditorView.EDIT_CONTEXT 官方开关。
 */
export function configureCodeMirrorForMobileWebView(): void {
  if (mobileWebViewConfigured) return
  mobileWebViewConfigured = true
  const ctor = EditorView as typeof EditorView & { EDIT_CONTEXT?: boolean }
  ctor.EDIT_CONTEXT = false
}
