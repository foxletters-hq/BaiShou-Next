import { EditorView } from '@codemirror/view'
import { DIARY_EDITOR_OVERLAY_Z } from '../editorOverlayZIndex'
import { IMAGE_SIZE_CONFIG } from '../utils/image-utils'

export const editorTheme = EditorView.baseTheme({
  '.cm-editor': {
    height: '100%',
    fontSize: '16px',
    lineHeight: '24px',
    backgroundColor: 'var(--bg-surface, #ffffff)'
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
    paddingBottom: '0',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)'
  },
  '.cm-table-block--desktop .cm-table-cell-editor .cm-content': {
    padding: '7px 9px',
    minHeight: '1.5em',
    paddingBottom: '0'
  },
  '.cm-table-block--desktop .cm-table-cell-editor .cm-line': {
    padding: '0 1px'
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

  // 渲染标题（行级 class，避免 inline mark 触发坐标扫描问题）
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
    fontSize: '1.15em',
    fontWeight: '600'
  },
  '.cm-rendered-h6': {
    fontSize: '1em',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },

  '.cm-rendered-blockquote-content': {
    borderLeft: '3px solid var(--color-primary)',
    paddingLeft: '0.75rem',
    color: 'var(--text-secondary)'
  },

  '.cm-rendered-inline-code': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    fontSize: '0.88em',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-surface-normal)',
    borderRadius: '0.35rem',
    padding: '0.08em 0.35em',
    wordBreak: 'break-word'
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
    marginTop: '8px'
  },
  '.cm-table-line-last': {
    borderBottom: '1.5px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.22)))',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    marginBottom: '8px'
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
    padding: '4px 10px',
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

  // Live Preview 表格块预览与操作控件
  '.cm-table-block': {
    // 用 padding 而非 margin，让 CM heightmap 与 DOM 高度一致（atomic-editor 策略）
    padding: '4px 0 2px',
    width: '100%',
    maxWidth: '100%',
    position: 'relative',
    userSelect: 'auto',
    pointerEvents: 'auto'
  },
  '.cm-table-block:not(.cm-table-block--touch):not(.cm-table-block--desktop):hover .cm-table-handle':
    {
      opacity: '0.45',
      pointerEvents: 'auto'
    },
  '.cm-table-block:not(.cm-table-block--touch):not(.cm-table-block--desktop) .cm-table-corner-menu':
    {
      opacity: '0.55',
      pointerEvents: 'auto'
    },
  '.cm-table-block:not(.cm-table-block--touch):not(.cm-table-block--desktop):hover .cm-table-corner-menu':
    {
      opacity: '1',
      pointerEvents: 'auto'
    },
  '.cm-table-block:not(.cm-table-block--touch):not(.cm-table-block--desktop) .cm-table-add-btn': {
    opacity: '0.45',
    pointerEvents: 'auto'
  },
  '.cm-table-block:not(.cm-table-block--touch):not(.cm-table-block--desktop):hover .cm-table-add-btn':
    {
      opacity: '1',
      pointerEvents: 'auto'
    },
  '.cm-table-scroll-host': {
    overflowX: 'auto',
    maxWidth: '100%'
  },
  '.cm-table-block--touch .cm-table-chrome-body': {
    columnGap: '2px',
    rowGap: '2px'
  },
  '.cm-table-block--touch .cm-table-corner-menu': {
    opacity: '0',
    pointerEvents: 'none'
  },
  '.cm-table-block--touch .cm-table-add-btn': {
    opacity: '0',
    pointerEvents: 'none'
  },
  '.cm-table-block--touch.cm-table-block--has-active-cell .cm-table-handle': {
    opacity: '0.55',
    pointerEvents: 'auto'
  },
  '.cm-table-block--touch.cm-table-block--has-active-cell .cm-table-handle--active': {
    opacity: '1'
  },
  '.cm-table-block--touch.cm-table-block--has-active-cell .cm-table-corner-menu': {
    opacity: '1',
    pointerEvents: 'auto'
  },
  '.cm-table-block--touch.cm-table-block--has-active-cell .cm-table-add-btn': {
    opacity: '1',
    pointerEvents: 'auto'
  },
  '.cm-table-block--touch.cm-table-block--row-selected .cm-table-handle, .cm-table-block--touch.cm-table-block--col-selected .cm-table-handle':
    {
      opacity: '0.55',
      pointerEvents: 'auto'
    },
  '.cm-table-block--touch.cm-table-block--row-selected .cm-table-handle--active, .cm-table-block--touch.cm-table-block--col-selected .cm-table-handle--active':
    {
      opacity: '1'
    },
  '.cm-table-block--touch.cm-table-block--row-selected .cm-table-corner-menu, .cm-table-block--touch.cm-table-block--col-selected .cm-table-corner-menu':
    {
      opacity: '1',
      pointerEvents: 'auto'
    },
  '.cm-table-block--touch.cm-table-block--row-selected .cm-table-add-btn, .cm-table-block--touch.cm-table-block--col-selected .cm-table-add-btn':
    {
      opacity: '1',
      pointerEvents: 'auto'
    },
  '.cm-table-cursor-after': {
    display: 'none'
  },
  '.cm-table-chrome-top': {
    display: 'flex',
    alignItems: 'stretch',
    gap: '2px',
    marginBottom: '2px',
    position: 'relative',
    zIndex: '5'
  },
  '.cm-table-chrome-corner': {
    width: '24px',
    flexShrink: '0'
  },
  '.cm-table-corner-menu': {
    height: '24px',
    minWidth: '24px',
    minHeight: '24px',
    position: 'relative',
    zIndex: '6',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--text-tertiary, rgba(0, 0, 0, 0.35))',
    lineHeight: '1',
    padding: '0',
    cursor: 'pointer',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  '.cm-table-col-handles': {
    display: 'flex',
    flex: '1',
    gap: '0',
    minWidth: '0'
  },
  '.cm-table-chrome-body': {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr) 24px',
    gridTemplateRows: 'auto 24px',
    columnGap: '2px',
    rowGap: '2px',
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
    width: '24px',
    flexShrink: '0',
    gridColumn: '1',
    gridRow: '1',
    alignSelf: 'start',
    position: 'relative',
    zIndex: '5'
  },
  '.cm-table-grid-shell': {
    gridColumn: '2',
    gridRow: '1',
    minWidth: '0',
    border: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.16)))',
    borderRadius: '0',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-editor, transparent)'
  },
  '.cm-table-preview': {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: '14px',
    lineHeight: '1.35',
    border: 'none',
    borderRadius: '0'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-preview th, .cm-table-block:not(.cm-table-block--desktop) .cm-table-preview td':
    {
      borderRight: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.12)))',
      borderBottom: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.1)))',
      padding: '10px 12px',
      verticalAlign: 'top',
      wordBreak: 'break-word',
      cursor: 'text'
    },
  '.cm-table-grid-cell': {
    padding: '0',
    position: 'relative'
  },
  '.cm-table-grid-cell[align="left"] .cm-table-cell-view, .cm-table-grid-cell[align="left"] .cm-table-cell-source':
    {
      textAlign: 'left'
    },
  '.cm-table-grid-cell[align="center"] .cm-table-cell-view, .cm-table-grid-cell[align="center"] .cm-table-cell-source':
    {
      textAlign: 'center'
    },
  '.cm-table-grid-cell[align="right"] .cm-table-cell-view, .cm-table-grid-cell[align="right"] .cm-table-cell-source':
    {
      textAlign: 'right'
    },
  '.cm-table-cell-source': {
    display: 'block',
    width: '100%',
    minHeight: '2em',
    margin: '0',
    padding: '0',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    lineHeight: '1.5',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    boxSizing: 'border-box',
    cursor: 'text'
  },
  '.cm-table-cell-source:focus': {
    outline: 'none',
    boxShadow: 'none'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-cell-inner': {
    position: 'relative',
    width: '100%',
    minHeight: '2em'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-cell-view': {
    display: 'block',
    width: '100%',
    minHeight: '2em',
    padding: '0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    cursor: 'default'
  },
  '.cm-table-cell-view--hidden': {
    display: 'none'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-cell-editor': {
    position: 'absolute',
    inset: '0',
    minHeight: '2em'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-cell-editor .cm-editor': {
    height: '100%'
  },
  '.cm-table-block--range-dragging .cm-table-cell-view, .cm-table-block--range-dragging .cm-table-cell-editor':
    {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      cursor: 'cell'
    },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-preview th': {
    backgroundColor: 'var(--cm-table-header-bg, var(--bg-surface-normal, rgba(0, 0, 0, 0.04)))',
    fontWeight: '600'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-preview tr:last-child td': {
    borderBottom: 'none'
  },
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-preview th:last-child, .cm-table-block:not(.cm-table-block--desktop) .cm-table-preview td:last-child':
    {
      borderRight: 'none'
    },
  '.cm-table-handle': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--text-tertiary, rgba(0, 0, 0, 0.35))',
    lineHeight: '1',
    padding: '0',
    cursor: 'grab',
    opacity: '0',
    pointerEvents: 'none',
    touchAction: 'manipulation',
    minWidth: '24px',
    minHeight: '24px',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    position: 'relative'
  },
  '.cm-table-grip-icon, .cm-table-grid-icon': {
    fill: 'currentColor',
    display: 'block',
    flexShrink: '0'
  },
  '.cm-table-block--touch .cm-table-handle::before': {
    content: '""',
    position: 'absolute',
    inset: '-8px'
  },
  '.cm-table-handle--active, .cm-table-handle--dragging, .cm-table-handle--drop-target': {
    opacity: '1',
    pointerEvents: 'auto'
  },
  '.cm-table-block--has-active-cell:not(.cm-table-block--desktop) .cm-table-handle': {
    opacity: '0.45',
    pointerEvents: 'auto'
  },
  '.cm-table-block--has-active-cell:not(.cm-table-block--desktop) .cm-table-corner-menu': {
    opacity: '1',
    pointerEvents: 'auto'
  },
  '.cm-table-block--has-active-cell:not(.cm-table-block--desktop) .cm-table-add-btn': {
    opacity: '1',
    pointerEvents: 'auto'
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
    opacity: '0'
  },
  '.cm-table-row-handle--header.cm-table-handle--active': {
    opacity: '0.75'
  },
  '.cm-table-add-btn': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRadius: '6px',
    border: '1px solid var(--cm-table-border, var(--border-strong, rgba(0, 0, 0, 0.14)))',
    background: 'transparent',
    color: 'var(--text-tertiary, rgba(0, 0, 0, 0.35))',
    fontSize: '16px',
    lineHeight: '1',
    padding: '0',
    cursor: 'pointer',
    flexShrink: '0',
    touchAction: 'manipulation',
    position: 'relative',
    zIndex: '6'
  },
  '.cm-table-add-btn-icon': {
    fontWeight: '300',
    lineHeight: '1',
    userSelect: 'none',
    pointerEvents: 'none'
  },
  '.cm-table-add-col': {
    gridColumn: '3',
    gridRow: '1',
    alignSelf: 'stretch',
    width: '24px',
    minHeight: '0'
  },
  '.cm-table-add-row': {
    gridColumn: '2',
    gridRow: '2',
    width: '100%',
    height: '24px',
    minHeight: '24px'
  },
  '.cm-table-context-menu-layer': {
    position: 'fixed',
    inset: '0',
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.menuBackdrop),
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
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.menu),
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
  '.cm-table-context-menu-item--destructive': {
    color: 'var(--color-danger, #e5484d)'
  },
  '.cm-table-sheet-layer': {
    position: 'fixed',
    zIndex: '2147483000',
    pointerEvents: 'auto'
  },
  '.cm-table-sheet-layer--open .cm-table-sheet-backdrop': {
    opacity: '1'
  },
  '.cm-table-sheet-backdrop': {
    position: 'absolute',
    inset: '0',
    background: 'rgba(0, 0, 0, 0.45)',
    opacity: '0',
    transition: 'opacity 0.22s ease-out',
    WebkitBackdropFilter: 'blur(2px)',
    backdropFilter: 'blur(2px)'
  },
  '.cm-table-sheet': {
    position: 'absolute',
    zIndex: '1',
    left: '0',
    right: '0',
    borderRadius: '20px 20px 0 0',
    background: 'var(--bg-surface, #fff)',
    borderTop: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
    boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '72vh',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  '.cm-table-sheet-grabber': {
    width: '36px',
    height: '4px',
    borderRadius: '999px',
    background: 'var(--border-subtle, rgba(0, 0, 0, 0.2))',
    margin: '8px auto 2px',
    flexShrink: '0'
  },
  '.cm-table-sheet-title': {
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '0.01em',
    color: 'var(--text-secondary)',
    padding: '6px 20px 12px',
    flexShrink: '0'
  },
  '.cm-table-sheet-body': {
    padding: '0 12px calc(16px + env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch'
  },
  '.cm-table-sheet-group': {
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'var(--bg-surface-normal, rgba(0, 0, 0, 0.04))',
    border: 'none',
    boxShadow: 'inset 0 0 0 1px var(--border-subtle, rgba(0, 0, 0, 0.06))'
  },
  '.cm-table-sheet-group--destructive': {
    marginTop: '2px'
  },
  '.cm-table-sheet-item': {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minHeight: '52px',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.06))',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '1.3',
    padding: '14px 16px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent'
  },
  '.cm-table-sheet-item:active:not(:disabled)': {
    background: 'var(--bg-surface-normal, rgba(0, 0, 0, 0.06))'
  },
  '.cm-table-sheet-item:last-child': {
    borderBottom: 'none'
  },
  '.cm-table-sheet-item:disabled': {
    opacity: '0.45'
  },
  '.cm-table-sheet-item--destructive': {
    color: 'var(--color-danger, #e5484d)'
  },
  '.cm-table-grid-cell--col-selected': {
    background: 'transparent',
    position: 'relative'
  },
  '.cm-table-grid-cell--col-selected::after': {
    content: '""',
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    borderLeft: '2px solid var(--color-primary, #5b9bd5)',
    borderRight: '2px solid var(--color-primary, #5b9bd5)',
    boxSizing: 'border-box'
  },
  '.cm-table-preview thead .cm-table-grid-cell--col-selected::after': {
    borderTop: '2px solid var(--color-primary, #5b9bd5)'
  },
  '.cm-table-preview tbody tr:last-child .cm-table-grid-cell--col-selected::after': {
    borderBottom: '2px solid var(--color-primary, #5b9bd5)'
  },
  '.cm-table-grid-cell--row-selected': {
    background: 'transparent',
    position: 'relative'
  },
  '.cm-table-grid-cell--row-selected::after': {
    content: '""',
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    borderTop: '2px solid var(--color-primary, #5b9bd5)',
    borderBottom: '2px solid var(--color-primary, #5b9bd5)',
    boxSizing: 'border-box'
  },
  '.cm-table-preview .cm-table-grid-cell--row-selected:first-child::after': {
    borderLeft: '2px solid var(--color-primary, #5b9bd5)'
  },
  '.cm-table-preview .cm-table-grid-cell--row-selected:last-child::after': {
    borderRight: '2px solid var(--color-primary, #5b9bd5)'
  },
  '.cm-table-grid-cell--range-selected': {
    background: 'color-mix(in srgb, var(--color-primary, #5b9bd5) 14%, transparent)'
  },
  '.cm-table-block--range-dragging': {
    userSelect: 'none',
    WebkitUserSelect: 'none'
  },
  '.cm-table-block--range-dragging .cm-table-cell-source': {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'cell'
  },
  '.cm-table-block--range-selected': {
    outline: 'none'
  },
  '.cm-table-block--col-selected .cm-table-col-handle.cm-table-handle--active': {
    background: 'var(--color-primary, #5b9bd5)',
    borderRadius: '4px'
  },
  '.cm-table-block--col-selected .cm-table-col-handle.cm-table-handle--active .cm-table-grip-icon':
    {
      fill: '#fff'
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

  // 围栏代码块行级灰底（inline live preview）
  '.cm-rendered-codeBlock': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    fontSize: '13px',
    lineHeight: '1.6'
  },
  '.cm-code-line': {
    backgroundColor: 'var(--bg-code-block, #eceef2) !important',
    paddingLeft: '12px !important',
    paddingRight: '12px !important'
  },
  '.cm-activeLine.cm-code-line': {
    backgroundColor: 'var(--bg-code-block, #eceef2) !important'
  },
  '.cm-code-line-top': {
    paddingTop: '12px !important',
    marginTop: '8px',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  },
  '.cm-code-line-bottom': {
    paddingBottom: '12px !important',
    marginBottom: '8px',
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
  '.cm-image-placeholder': {
    display: 'block',
    width: '100%',
    minHeight: '96px',
    margin: '8px 0',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-normal)',
    border: '1px dashed var(--border-subtle)',
    boxSizing: 'border-box'
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
  },

  /* codemirror-markdown-tables：行列菜单实底 + 略高于正文右键菜单 */
  '.cm-tooltip.tbl-menu-tooltip': {
    border: 'none',
    padding: 0,
    backgroundColor: 'transparent',
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.tableMenu),
    boxSizing: 'border-box',
    overflow: 'visible'
  },
  '.cm-tooltip.tbl-menu-tooltip .tbl-menu': {
    backgroundColor: 'var(--bg-surface-raised, #ffffff)',
    border: '1px solid var(--border-muted, rgba(0, 0, 0, 0.08))',
    boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12))',
    borderRadius: 'var(--radius-sm, 8px)',
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.tableMenu)
  }
})

/** 移动端 WebView：RN 外层 ScrollView 负责滚动，CM 随内容撑高 */
export const mobileTouchEditorLayoutTheme = EditorView.theme({
  '.cm-content': {
    padding: '8px 0',
    paddingBottom: 'min(40vh, 280px)',
    userSelect: 'text',
    WebkitUserSelect: 'text'
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
    paddingBottom: 'max(min(40vh, 280px), var(--diary-bottom-scroll-inset, 0px))',
    userSelect: 'text',
    WebkitUserSelect: 'text'
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
