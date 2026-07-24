import type { EditorView } from '@codemirror/view'

/** 编辑器正文右键菜单解析/执行时的上下文 */
export interface EditorMenuContext {
  view: EditorView
  hasSelection: boolean
  readOnly: boolean
  /** 可选文档标识，供后续 workbench 贡献项使用 */
  docUri?: string
}
