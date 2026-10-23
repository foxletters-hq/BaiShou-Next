/**
 * 编辑器壳、选区、光标、语法隐藏、标题、引用、列表与行内代码/链接。
 * 在表格规则之前切开：正文排版和表格 heightmap / 控件不是同一套改动原因。
 */
export const editorThemeBase = {
  '&.cm-editor': {
    height: '100%',
    // 日记正文采用阅读档字号（默认 16px，随 --ui-font-scale 缩放），避免 14px UI 字号偏小。
    // 必须用 &.cm-editor：baseTheme 会把 .cm-editor 编译成后代选择器，匹配不到编辑器根节点。
    fontSize: 'var(--content-font-size-lg, 16px)',
    lineHeight: '1.6',
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
    backgroundColor: 'var(--text-selection-bg) !important',
    color: 'var(--text-selection-fg) !important'
  },
  '.cm-content ::selection': {
    backgroundColor: 'var(--text-selection-bg) !important',
    color: 'var(--text-selection-fg) !important'
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
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    fontSize: 'inherit'
  },

  '.cm-line.cm-rendered-blockquote': {
    borderLeft: '3px solid var(--color-primary)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    fontSize: 'inherit'
  },

  '.cm-rendered-blockquote': {
    borderLeft: '3px solid var(--color-primary)',
    padding: '0 0 0 12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    fontSize: 'inherit'
  },

  '.cm-line > .cm-widgetBuffer': {
    verticalAlign: 'baseline',
    height: '0'
  },

  '.cm-rendered-inline-code': {
    // 对齐 Obsidian：等宽字体 + 略小字号，圆角灰底完整包住字形与光标。
    // 配合 ::before 零宽字形锚定基线，点击展开/收起反引号时灰底与行高均不跳动。
    display: 'inline-block',
    fontFamily: 'var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
    fontSize: '0.9em',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-surface-normal)',
    borderRadius: '4px',
    padding: '0.12em 0.35em 0.1em',
    margin: '0',
    lineHeight: '1.3',
    boxSizing: 'border-box',
    verticalAlign: 'baseline',
    wordBreak: 'break-word',
    maxWidth: '100%',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone'
  },

  '.cm-rendered-inline-code::before': {
    content: '"\\60\\4e00"',
    display: 'inline-block',
    width: '0',
    overflow: 'hidden',
    // width:0 会让多个字符换行，把灰底撑成两行高；保留单行以只锚定基线。
    whiteSpace: 'nowrap',
    visibility: 'hidden',
    userSelect: 'none',
    pointerEvents: 'none'
  },

  '.cm-rendered-inline-code .cm-rendered-inline-code::before, .cm-code-line .cm-rendered-inline-code::before':
    {
      content: 'none',
      display: 'none'
    },

  '.cm-rendered-inline-code .cm-rendered-inline-code, .cm-rendered-inline-code .cm-code': {
    display: 'inline',
    height: 'auto',
    fontSize: 'inherit',
    lineHeight: 'inherit',
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
