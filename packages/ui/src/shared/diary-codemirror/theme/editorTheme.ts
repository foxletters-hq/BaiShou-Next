import { EditorView } from '@codemirror/view'
import { IMAGE_SIZE_CONFIG } from '../utils/image-utils'

export const editorTheme = EditorView.baseTheme({
  '.cm-editor': {
    height: '100%',
    fontSize: '16px',
    lineHeight: '24px',
    backgroundColor: 'var(--bg-editor)'
  },
  '.cm-editor.cm-focused': {
    outline: 'none !important'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    padding: '16px 24px',
    minHeight: '100%',
    paddingBottom: '20vh',
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

  // 渲染标题（禁止 inline-block，会触发 InlineCoordsScan 无限递归）
  '.cm-rendered-h1': {
    fontSize: '1.8em',
    fontWeight: '700'
  },
  '.cm-rendered-h2': {
    fontSize: '1.5em',
    fontWeight: '600'
  },
  '.cm-rendered-h3': {
    fontSize: '1.3em',
    fontWeight: '600'
  },
  '.cm-rendered-h4': {
    fontSize: '1.1em',
    fontWeight: '600'
  },
  '.cm-rendered-h5': {
    fontSize: '1.05em',
    fontWeight: '600'
  },
  '.cm-rendered-h6': {
    fontSize: '1em',
    fontWeight: '600',
    color: 'var(--text-secondary)'
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
    margin: '8px 0'
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

  // GFM 表格 live preview
  '.cm-table-separator-line': {
    display: 'none !important'
  },
  '.cm-table-line': {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderLeft: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    borderRight: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    paddingLeft: '2px',
    paddingRight: '2px'
  },
  '.cm-table-line-first': {
    borderTop: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    marginTop: '12px'
  },
  '.cm-table-line-last': {
    borderBottom: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    marginBottom: '12px'
  },
  '.cm-table-line:not(.cm-table-line-last)': {
    borderBottom: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.14)))'
  },
  '.cm-table-line-active': {
    backgroundColor: 'transparent'
  },
  '.cm-table-header-line': {
    fontWeight: '600',
    backgroundColor: 'var(--cm-table-header-bg, var(--bg-surface-normal, rgba(0, 0, 0, 0.04)))'
  },
  '.cm-table-row-line': {
    backgroundColor: 'var(--bg-editor, transparent)'
  },
  '.cm-table-cell': {
    display: 'inline-block',
    verticalAlign: 'top',
    width: 'calc(100% / var(--cm-table-cols, 1))',
    maxWidth: 'calc(100% / var(--cm-table-cols, 1))',
    minWidth: '0',
    padding: '6px 12px',
    boxSizing: 'border-box',
    borderRight: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.18)))',
    wordBreak: 'break-word',
    whiteSpace: 'normal'
  },
  '.cm-table-cell-last': {
    borderRight: 'none'
  },
  '.cm-table-header-cell': {
    fontWeight: '600',
    color: 'var(--text-primary)'
  },

  // Obsidian 风格表格块预览与操作控件
  '.cm-table-block': {
    margin: '12px 0',
    width: '100%',
    maxWidth: '100%',
    position: 'relative',
    userSelect: 'auto'
  },
  '.cm-table-chrome-top': {
    display: 'flex',
    alignItems: 'stretch',
    gap: '0',
    marginBottom: '2px'
  },
  '.cm-table-chrome-corner': {
    width: '28px',
    flexShrink: '0'
  },
  '.cm-table-col-handles': {
    display: 'flex',
    flex: '1',
    gap: '0',
    minWidth: '0'
  },
  '.cm-table-chrome-body': {
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) 28px',
    gridTemplateRows: 'auto 28px',
    columnGap: '4px',
    rowGap: '4px',
    alignItems: 'stretch',
    position: 'relative'
  },
  '.cm-table-main-column': {
    display: 'contents'
  },
  '.cm-table-row-handles': {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    width: '28px',
    flexShrink: '0',
    gridColumn: '1',
    gridRow: '1',
    alignSelf: 'start'
  },
  '.cm-table-grid-shell': {
    gridColumn: '2',
    gridRow: '1',
    minWidth: '0',
    border: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-editor, transparent)'
  },
  '.cm-table-preview': {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: '14px',
    border: 'none',
    borderRadius: '0'
  },
  '.cm-table-preview th, .cm-table-preview td': {
    borderRight: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.18)))',
    borderBottom: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.14)))',
    padding: '8px 10px',
    verticalAlign: 'top',
    wordBreak: 'break-word',
    cursor: 'text'
  },
  '.cm-table-cell-editable': {
    outline: 'none',
    minHeight: '1.4em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'text',
    userSelect: 'text'
  },
  '.cm-table-cell-editable:focus': {
    boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--color-primary, #5ba8f5) 45%, transparent)',
    borderRadius: '4px'
  },
  '.cm-table-preview th': {
    backgroundColor: 'var(--cm-table-header-bg, var(--bg-surface-normal, rgba(0, 0, 0, 0.04)))',
    fontWeight: '600'
  },
  '.cm-table-preview tr:last-child td': {
    borderBottom: 'none'
  },
  '.cm-table-preview th:last-child, .cm-table-preview td:last-child': {
    borderRight: 'none'
  },
  '.cm-table-handle': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
    borderRadius: '6px',
    background: 'var(--bg-surface-normal, rgba(0, 0, 0, 0.03))',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    lineHeight: '1',
    padding: '0',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none'
  },
  '.cm-table-handle--touch': {
    cursor: 'pointer'
  },
  '.cm-table-handle--dragging': {
    opacity: '0.55',
    cursor: 'grabbing'
  },
  '.cm-table-handle--drop-target': {
    borderColor: 'var(--color-primary, #5ba8f5)',
    background: 'color-mix(in srgb, var(--color-primary, #5ba8f5) 12%, transparent)'
  },
  '.cm-table-col-handle': {
    flex: '0 0 auto',
    minHeight: '24px',
    margin: '0'
  },
  '.cm-table-row-handle': {
    flex: '0 0 auto',
    minHeight: '0',
    margin: '0'
  },
  '.cm-table-row-handle--header': {
    cursor: 'default',
    opacity: '0.45'
  },
  '.cm-table-add-btn': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    background: 'var(--bg-surface-normal, rgba(0, 0, 0, 0.02))',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    lineHeight: '1',
    padding: '0',
    cursor: 'pointer',
    flexShrink: '0',
    touchAction: 'manipulation'
  },
  '.cm-table-add-col': {
    gridColumn: '3',
    gridRow: '1',
    alignSelf: 'stretch',
    width: '28px',
    minHeight: '0'
  },
  '.cm-table-add-row': {
    gridColumn: '2',
    gridRow: '2',
    width: '100%',
    height: '28px',
    minHeight: '28px'
  },
  '.cm-table-context-menu-layer': {
    position: 'fixed',
    inset: '0',
    zIndex: '199',
    pointerEvents: 'auto'
  },
  '.cm-table-context-menu-backdrop': {
    position: 'absolute',
    inset: '0',
    background: 'transparent',
    pointerEvents: 'auto'
  },
  '.cm-table-context-menu': {
    position: 'fixed',
    zIndex: '200',
    minWidth: '120px',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-surface, #fff)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
  },
  '.cm-table-context-menu-item': {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  '.cm-table-context-menu-item:disabled': {
    opacity: '0.45',
    cursor: 'default'
  },
  '.cm-table-context-menu-item:not(:disabled):hover': {
    background: 'var(--bg-surface-normal, rgba(0, 0, 0, 0.05))'
  },

  '.cm-code': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9em'
  },
  '.cm-codeBlock': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    margin: '16px 0',
    fontSize: '13px',
    overflowX: 'auto',
    lineHeight: '1.6'
  },

  // 围栏代码块（Decoration.mark 为行内 span，禁止 block 属性）
  '.cm-rendered-codeBlock': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    fontSize: '13px',
    lineHeight: '1.6'
  },
  '.cm-code-line': {
    backgroundColor: 'var(--bg-surface-normal) !important'
  },
  '.cm-activeLine.cm-code-line': {
    backgroundColor: 'var(--bg-surface-normal) !important'
  },
  '.cm-code-line-top': {
    paddingTop: '8px !important',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  },
  '.cm-code-line-bottom': {
    paddingBottom: '8px !important',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px'
  },
  '.cm-rendered-codeMark': {
    color: 'var(--text-tertiary)',
    fontSize: '0.85em',
    userSelect: 'none'
  },
  '.cm-link': {
    color: 'var(--color-primary)',
    textDecoration: 'none'
  },
  '.cm-url': {
    color: 'var(--text-tertiary)',
    fontSize: '0.85em'
  },
  '.cm-strikethrough': {
    textDecoration: 'line-through',
    color: 'var(--text-tertiary)'
  },
  '.cm-strong': { fontWeight: '700' },
  '.cm-emphasis': { fontStyle: 'italic' },
  '.cm-image': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  '.cm-image-container': {
    position: 'relative',
    display: 'block',
    maxWidth: '100%',
    width: 'fit-content',
    margin: '8px 0',
    boxSizing: 'border-box'
  },
  '.cm-image-container.cm-image-container--unsized': {
    maxWidth: `min(100%, ${IMAGE_SIZE_CONFIG.defaultDisplayWidth}px)`
  },
  '.cm-image-resizable': {
    display: 'block',
    maxWidth: '100%',
    width: 'auto',
    height: 'auto',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  '.cm-placeholder': {
    color: 'var(--text-tertiary)',
    opacity: '0.6',
    fontSize: '15px',
    lineHeight: '1.7'
  },
  '.cm-diary-tag-token': {
    display: 'inline',
    borderRadius: '10px',
    padding: '1px 6px',
    margin: '0 4px 0 0',
    fontSize: 'inherit',
    fontWeight: '500',
    lineHeight: 'inherit',
    verticalAlign: 'baseline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone'
  },
  '.cm-diary-tag-c0': {
    color: 'var(--tag-0-fg, #3b82f6)',
    backgroundColor: 'color-mix(in srgb, var(--tag-0-fg, #3b82f6) 15%, transparent)'
  },
  '.cm-diary-tag-c1': {
    color: 'var(--tag-1-fg, #10b981)',
    backgroundColor: 'color-mix(in srgb, var(--tag-1-fg, #10b981) 15%, transparent)'
  },
  '.cm-diary-tag-c2': {
    color: 'var(--tag-2-fg, #f59e0b)',
    backgroundColor: 'color-mix(in srgb, var(--tag-2-fg, #f59e0b) 15%, transparent)'
  },
  '.cm-diary-tag-c3': {
    color: 'var(--tag-3-fg, #8b5cf6)',
    backgroundColor: 'color-mix(in srgb, var(--tag-3-fg, #8b5cf6) 15%, transparent)'
  },
  '& .cm-line:has(.cm-diary-tag-token)': {
    lineHeight: 'inherit'
  }
})

/** 移动端 WebView：RN 外层 ScrollView 负责滚动，CM 随内容撑高 */
export const mobileTouchEditorLayoutTheme = EditorView.theme({
  '.cm-content': {
    padding: '8px 0',
    paddingBottom: 'min(40vh, 280px)'
  },
  '.cm-editor': {
    height: 'auto !important',
    overflow: 'visible !important'
  },
  '.cm-scroller': {
    overflow: 'visible !important',
    height: 'auto !important',
    maxHeight: 'none !important'
  },
  '.cm-line': {
    minHeight: '1.5em'
  },
  '& .cm-line:has(.cm-diary-tag-token)': {
    minHeight: '0'
  },
  '.cm-image-container': {
    marginTop: '8px',
    marginBottom: '20px'
  },
  '.cm-image-link-bar': {
    display: 'none !important'
  }
})

/** 移动端 WebView 固定视口：编辑器区域内滚动，顶部 RN 栏固定 */
export const mobileTouchViewportTheme = EditorView.theme({
  '.cm-content': {
    padding: '8px 0',
    paddingBottom: 'max(min(40vh, 280px), var(--diary-bottom-scroll-inset, 0px))'
  },
  '.cm-editor': {
    height: '100%'
  },
  '.cm-scroller': {
    overflow: 'auto',
    height: '100%'
  },
  '.cm-line': {
    minHeight: '1.5em'
  },
  '& .cm-line:has(.cm-diary-tag-token)': {
    minHeight: '0'
  },
  '.cm-image-container': {
    marginTop: '8px',
    marginBottom: '20px'
  },
  '.cm-image-link-bar': {
    display: 'none !important'
  }
})
