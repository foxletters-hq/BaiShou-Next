import { EditorView } from '@codemirror/view'

/** 工作台编辑区：全宽正文，与三栏布局对齐 */
export const workbenchEditorTheme = EditorView.baseTheme({
  '&.workbench-cm-editor': {
    height: '100%'
  },
  '&.workbench-cm-editor .cm-editor': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: '16px',
    lineHeight: '1.7'
  },
  '&.workbench-cm-editor .cm-scroller': {
    overflow: 'auto',
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
    background: 'var(--bg-surface)'
  },
  '&.workbench-cm-editor .cm-content': {
    maxWidth: 'none',
    marginInline: '0',
    padding: '32px 40px 20vh',
    minHeight: '100%',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
    background: 'var(--bg-surface)'
  },
  '&.workbench-cm-editor .cm-line': {
    padding: '0'
  },
  '&.workbench-cm-editor .cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-primary, #5ba8f5) 6%, transparent) !important'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-line-h1': {
    fontSize: '1.45em',
    fontWeight: '700',
    lineHeight: '1.25',
    paddingTop: '0.35em',
    paddingBottom: '0.15em'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-line-h2': {
    fontSize: '1.25em',
    fontWeight: '700',
    lineHeight: '1.3',
    paddingTop: '0.3em',
    paddingBottom: '0.1em'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-line-h3': {
    fontSize: '1.12em',
    fontWeight: '600',
    lineHeight: '1.35',
    paddingTop: '0.25em'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-line-h4, &.workbench-cm-editor .cm-line.cm-wb-line-h5, &.workbench-cm-editor .cm-line.cm-wb-line-h6':
    {
      fontWeight: '600',
      paddingTop: '0.2em'
    },
  '&.workbench-cm-editor .cm-rendered-h1': {
    fontSize: '1.45em',
    fontWeight: '700'
  },
  '&.workbench-cm-editor .cm-rendered-h2': {
    fontSize: '1.25em',
    fontWeight: '700'
  },
  '&.workbench-cm-editor .cm-rendered-h3': {
    fontSize: '1.12em',
    fontWeight: '600'
  },
  '&.workbench-cm-editor .cm-rendered-h4, &.workbench-cm-editor .cm-rendered-h5, &.workbench-cm-editor .cm-rendered-h6':
    {
      fontWeight: '600'
    },
  '&.workbench-cm-editor .cm-line.cm-wb-hr': {
    position: 'relative',
    minHeight: '1.5em'
  },
  '&.workbench-cm-editor .cm-wb-hr-widget': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    margin: '14px 0',
    borderTop: '1px solid var(--border-control, #d6d6d6)',
    verticalAlign: 'middle',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  },
  '&.workbench-cm-editor .cm-rendered-link': {
    color: 'var(--color-primary, #5ba8f5)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer'
  },
  '&.workbench-cm-editor .cm-blockquote': {
    borderLeft: '3px solid var(--border-control)',
    paddingLeft: '1em',
    color: 'var(--text-secondary)'
  },
  '&.workbench-cm-editor .cm-code': {
    fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', Menlo, monospace",
    backgroundColor: 'var(--bg-surface-low)',
    padding: '0.1em 0.35em',
    borderRadius: '4px',
    fontSize: '0.9em'
  },
  '&.workbench-cm-editor .cm-code-line': {
    backgroundColor: 'var(--bg-surface-low) !important'
  },
  '&.workbench-cm-editor .cm-placeholder': {
    color: 'var(--text-tertiary)',
    opacity: '0.75'
  }
})
