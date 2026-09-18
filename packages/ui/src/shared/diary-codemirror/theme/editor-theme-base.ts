/**
 * 编辑器壳、选区、光标、语法隐藏、标题、引用、列表与行内代码/链接。
 * 在表格规则之前切开：正文排版和表格 heightmap / 控件不是同一套改动原因。
 */
export const editorThemeBase = {
  '.cm-editor': {
    height: '100%',
    fontSize: 'var(--content-font-size-lg, 16px)',
    lineHeight: '1.5',
    backgroundColor: 'var(--bg-surface)'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    padding: '16px 24px',
    minHeight: '100%',
    paddingBottom: '0',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)'
  },
  '.cm-line': {
    padding: '0'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important'
  },
  '&.cm-focused .cm-activeLine': {
    backgroundColor: 'transparent !important'
  },
  '::selection': {
    backgroundColor: 'var(--color-primary-light, rgba(99, 102, 241, 0.35)) !important'
  },
  '.cm-content ::selection': {
    backgroundColor: 'var(--color-primary-light, rgba(99, 102, 241, 0.35)) !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text-primary)'
  },

  // 隐藏语法 widget（零宽，与列表圆点同 replace 机制）
  '.cm-syntax-hidden-widget': {
    display: 'inline-block',
    width: '0',
    overflow: 'hidden',
    fontSize: '0',
    lineHeight: '0',
    verticalAlign: 'baseline',
    pointerEvents: 'none'
  },

  // 兼容旧探测
  '.cm-markdown-syntax-hidden': {
    display: 'inline-block',
    width: '0',
    overflow: 'hidden',
    opacity: '0',
    fontSize: '0',
    lineHeight: '0',
    verticalAlign: 'baseline',
    pointerEvents: 'none'
  },

  // 标题字号只挂行级 class。HighlightStyle 也会打同名 class，若写在
  // `.cm-rendered-hN` 上会行内再放大一档，posAtCoords 扫描会偏。
  '.cm-line.cm-rendered-h1': {
    fontSize: '1.8em',
    fontWeight: '700'
  },
  '.cm-line.cm-rendered-h2': {
    fontSize: '1.5em',
    fontWeight: '600'
  },
  '.cm-line.cm-rendered-h3': {
    fontSize: '1.3em',
    fontWeight: '600'
  },
  '.cm-line.cm-rendered-h4': {
    fontSize: '1.1em',
    fontWeight: '600'
  },
  '.cm-line.cm-rendered-h5': {
    fontSize: '1.15em',
    fontWeight: '600'
  },
  '.cm-line.cm-rendered-h6': {
    fontSize: '1em',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },

  '.cm-rendered-blockquote-content': {
    borderLeft: '3px solid var(--color-primary)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },

  '.cm-line.cm-rendered-blockquote': {
    borderLeft: '3px solid var(--color-primary)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },

  '.cm-rendered-blockquote': {
    borderLeft: '3px solid var(--color-primary)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },

  '.cm-rendered-inline-code': {
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    fontSize: 'inherit',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-surface-normal)',
    borderRadius: '0.35rem',
    padding: '0.08em 0.35em',
    margin: '-0.08em 0',
    lineHeight: 'inherit',
    wordBreak: 'break-word'
  },

  '.cm-rendered-inline-code .cm-rendered-inline-code, .cm-rendered-inline-code .cm-code': {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0
  },

  '.cm-syntax-hidden-mark': {
    display: 'inline-block',
    width: '0',
    overflow: 'hidden',
    opacity: '0',
    verticalAlign: 'top'
  },

  '.cm-rendered-link': {
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    cursor: 'pointer'
  },

  // CM6 内置语法高亮覆盖
  '.cm-heading': { fontWeight: '600' },
  'h1.cm-heading': { fontSize: '1.8em' },
  'h2.cm-heading': { fontSize: '1.5em' },
  'h3.cm-heading': { fontSize: '1.3em' },
  'h4.cm-heading': { fontSize: '1.1em' },
  '.cm-blockquote': {
    borderLeft: '3px solid var(--color-primary)',
    paddingLeft: '16px',
    color: 'var(--text-secondary)',
    margin: '8px 0',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))'
  },
  '.cm-list-bullet': {
    display: 'inline-block',
    width: '1.1em',
    marginRight: '0.2em',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    userSelect: 'none',
    pointerEvents: 'none',
    verticalAlign: 'baseline'
  },
  '.cm-heading-mark': {
    color: 'var(--text-tertiary)',
    fontWeight: '500'
  },
  '.cm-list-number': {
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: '500'
  }
}
