import { EditorView } from '@codemirror/view'

/** 工作台编辑区：全宽正文，与三栏布局对齐 */
export const workbenchEditorTheme = EditorView.baseTheme({
  '&.workbench-cm-editor': {
    height: '100%',
    /* 与侧栏文件树 .nameBtn 同一档，标题 inherit 后不再用 em 放大 */
    fontSize: 'var(--ui-fs-md)',
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
  /* 打开文档会把光标放在首行标题，不能用主色洗底，否则像默认选中 */
  '&.workbench-cm-editor .cm-activeLine': {
    backgroundColor: 'transparent !important'
  },
  '&.workbench-cm-editor .cm-activeLine.cm-code-line': {
    backgroundColor: 'var(--bg-surface-low) !important'
  },
  '&.workbench-cm-editor .cm-activeLine.cm-wb-properties': {
    backgroundColor:
      'color-mix(in srgb, var(--text-primary) 7%, var(--bg-surface-low, var(--bg-surface))) !important'
  },
  '&.workbench-cm-editor ::selection, &.workbench-cm-editor .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent) !important',
    color: 'var(--text-primary) !important'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h1': {
    fontSize: 'inherit',
    fontWeight: '700',
    lineHeight: '1.35'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h2': {
    fontSize: 'inherit',
    fontWeight: '700',
    lineHeight: '1.35'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h3': {
    fontSize: 'inherit',
    fontWeight: '600',
    lineHeight: '1.4'
  },
  '&.workbench-cm-editor .cm-line.cm-rendered-h4, &.workbench-cm-editor .cm-line.cm-rendered-h5, &.workbench-cm-editor .cm-line.cm-rendered-h6':
    {
      fontSize: 'inherit',
      fontWeight: '600'
    },
  /* 笔记正文：阅读区字号 + 行级标题放大。字号只挂 .cm-line，避免行内再放大导致点击落点偏移 */
  '&.workbench-cm-editor.workbench-cm-doc': {
    fontSize: 'var(--content-font-size-md)',
    lineHeight: '1.7'
  },
  '&.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h1': {
    fontSize: '1.6em',
    fontWeight: '700',
    lineHeight: '1.3',
    paddingTop: '0.55em'
  },
  '&.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h2': {
    fontSize: '1.35em',
    fontWeight: '700',
    lineHeight: '1.35',
    paddingTop: '0.45em'
  },
  '&.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h3': {
    fontSize: '1.2em',
    fontWeight: '600',
    lineHeight: '1.4',
    paddingTop: '0.35em'
  },
  '&.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h4, &.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h5, &.workbench-cm-editor.workbench-cm-doc .cm-line.cm-rendered-h6':
    {
      fontSize: '1.05em',
      fontWeight: '600'
    },
  '&.workbench-cm-editor h1.cm-heading, &.workbench-cm-editor h2.cm-heading, &.workbench-cm-editor h3.cm-heading, &.workbench-cm-editor h4.cm-heading':
    {
      fontSize: 'inherit'
    },
  '&.workbench-cm-editor .cm-line.cm-wb-properties': {
    backgroundColor:
      'color-mix(in srgb, var(--text-primary) 4%, var(--bg-surface-low, var(--bg-surface)))',
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
    color: 'var(--text-secondary)',
    fontWeight: '600'
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
