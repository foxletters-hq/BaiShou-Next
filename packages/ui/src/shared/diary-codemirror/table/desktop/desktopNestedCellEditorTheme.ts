import { EditorView } from '@codemirror/view'

/** 桌面嵌套单元格 CM 主题：继承 td/th align，padding 与 view 一致 */
export const desktopNestedCellEditorTheme = EditorView.theme({
  '&': {
    height: 'auto',
    width: '100%',
    outline: 'none'
  },
  '.cm-scroller': {
    overflow: 'hidden',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    padding: '7px 9px',
    minHeight: '1.5em',
    lineHeight: '1.5'
  },
  '.cm-line': {
    padding: '0 1px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
})
