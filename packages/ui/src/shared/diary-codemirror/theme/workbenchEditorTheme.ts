import { EditorView } from '@codemirror/view'

/** 工作台编辑区：全宽正文，与三栏布局对齐 */
export const workbenchEditorTheme = EditorView.baseTheme({
  '&.workbench-cm-editor': {
    height: '100%',
    '--bg-editor': 'var(--wb-editor-bg, #ffffff)',
    '--text-primary': 'var(--wb-editor-fg, #24292f)',
    '--text-secondary': 'var(--wb-editor-fg-muted, #57606a)',
    '--text-tertiary': 'var(--wb-editor-fg-faint, #8c959f)',
    '--border-subtle': 'var(--wb-editor-border, #d0d7de)',
    '--bg-surface-normal': 'var(--wb-editor-code-bg, #f6f8fa)'
  },
  '&.workbench-cm-editor .cm-editor': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: 'var(--wb-editor-body-size, 16px)',
    lineHeight: 'var(--wb-editor-body-leading, 1.7)'
  },
  '&.workbench-cm-editor .cm-scroller': {
    overflow: 'auto',
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif",
    background: 'var(--wb-editor-bg, #ffffff)'
  },
  '&.workbench-cm-editor .cm-content': {
    maxWidth: 'none',
    marginInline: '0',
    padding: '32px 40px 20vh',
    minHeight: '100%',
    color: 'var(--wb-editor-fg, #24292f)',
    caretColor: 'var(--wb-editor-fg, #24292f)',
    background: 'var(--wb-editor-bg, #ffffff)'
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
    position: 'relative'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-hr::after': {
    content: '""',
    position: 'absolute',
    left: '0',
    right: '0',
    top: '50%',
    borderTop: '1px solid var(--wb-editor-border, #d0d7de)',
    pointerEvents: 'none'
  },
  '&.workbench-cm-editor .cm-rendered-link': {
    color: 'var(--color-primary, #5ba8f5)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer'
  },
  '&.workbench-cm-editor .cm-blockquote': {
    borderLeft: '3px solid var(--wb-editor-border, #d0d7de)',
    paddingLeft: '1em',
    color: 'var(--wb-editor-fg-muted, #57606a)'
  },
  '&.workbench-cm-editor .cm-code': {
    fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', Menlo, monospace",
    backgroundColor: 'var(--wb-editor-code-bg, #f6f8fa)',
    padding: '0.1em 0.35em',
    borderRadius: '4px',
    fontSize: '0.9em'
  },
  '&.workbench-cm-editor .cm-code-line': {
    backgroundColor: 'var(--wb-editor-code-bg, #f6f8fa) !important'
  },
  '&.workbench-cm-editor .cm-placeholder': {
    color: 'var(--wb-editor-fg-faint, #8c959f)',
    opacity: '0.75'
  }
})
