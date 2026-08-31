import { EditorView } from '@codemirror/view'

/** 工作台编辑区：全宽正文，与三栏布局对齐 */
export const workbenchEditorTheme = EditorView.baseTheme({
  '&.workbench-cm-editor': {
    height: '100%',
    fontSize: 'var(--ui-fs-xl, var(--content-font-size-lg, 16px))',
    lineHeight: '1.5'
  },
  '&.workbench-cm-editor.cm-focused': {
    outline: 'none'
  },
  '&.workbench-cm-editor .cm-editor': {
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: 'inherit',
    lineHeight: 'inherit'
  },
  '&.workbench-cm-editor .cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    lineHeight: '1.5',
    background: 'var(--bg-surface)'
  },
  '&.workbench-cm-editor .cm-content': {
    maxWidth: 'none',
    marginInline: '0',
    /* 左右/顶留白在 WorkbenchLivePreviewEditor 容器上，避免计入点击坐标 */
    padding: '0 0 20vh',
    minHeight: '100%',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
    background: 'var(--bg-surface)',
    lineHeight: '1.5'
  },
  '&.workbench-cm-editor .cm-line': {
    padding: '0'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-blockquote': {
    borderLeft: '3px solid var(--color-primary, #5ba8f5)',
    /* 必须用完整 padding 盖过上方 .cm-line { padding: 0 }，否则竖线贴字 */
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-blockquote-content': {
    borderLeft: '3px solid var(--color-primary, #5ba8f5)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },
  '&.workbench-cm-editor .cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-primary, #5ba8f5) 6%, transparent) !important'
  },
  '&.workbench-cm-editor .cm-activeLine.cm-code-line': {
    backgroundColor: 'var(--bg-surface-low) !important'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h1': {
    fontSize: '1.45em',
    fontWeight: '700',
    lineHeight: '1.35'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h2': {
    fontSize: '1.25em',
    fontWeight: '700',
    lineHeight: '1.35'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h3': {
    fontSize: '1.12em',
    fontWeight: '600',
    lineHeight: '1.4'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h4, &.workbench-cm-editor .cm-line.cm-rendered-h5, &.workbench-cm-editor .cm-line.cm-rendered-h6':
    {
      fontWeight: '600'
    },
  '&.workbench-cm-editor .cm-line.cm-wb-properties': {
    backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, var(--bg-surface-low, var(--bg-surface)))',
    padding: '4px 12px',
    fontSize: '0.92em',
    lineHeight: '1.45'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-properties-first': {
    paddingTop: '14px',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-properties-last': {
    paddingBottom: '26px',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px'
  },
  '&.workbench-cm-editor .cm-wb-property-key': {
    color: 'var(--text-tertiary)',
    fontWeight: '600',
    fontSize: '0.92em'
  },
  '&.workbench-cm-editor .cm-line.cm-wb-hr': {
    position: 'relative',
    minHeight: '1.5em',
    paddingTop: '14px',
    paddingBottom: '14px'
  },
  '&.workbench-cm-editor .cm-wb-hr-widget': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    margin: '0',
    borderTop: '1px solid var(--border-control)',
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
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },
  '&.workbench-cm-editor .cm-code': {
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    backgroundColor: 'var(--bg-surface-low)',
    padding: '0.1em 0.35em',
    borderRadius: '4px',
    fontSize: 'inherit'
  },
  '&.workbench-cm-editor .cm-code-line': {
    backgroundColor: 'var(--bg-surface-low) !important',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },
  '&.workbench-cm-editor .cm-placeholder': {
    color: 'var(--text-tertiary)',
    opacity: '0.75'
  }
})
