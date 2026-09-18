/**
 * 表格边框、滚动、单元格、手柄、加行加列与行列选中。
 * 菜单和范围高亮另文件：浮层 z-index 与格子 chrome 会分开改。
 */
export const editorThemeTableChrome = {
  '.cm-table-block--desktop .cm-table-cell-editor .cm-content': {
    padding: '7px 9px',
    minHeight: '1.5em',
    paddingBottom: '0'
  },
  '.cm-table-block--desktop .cm-table-cell-editor .cm-line': {
    padding: '0 1px'
  },
  // GFM 表格 live preview
  '.cm-table-separator-line': {
    display: 'none !important'
  },
  '.cm-table-line': {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderLeft: '1.5px solid var(--cm-table-border, var(--border-strong))',
    borderRight: '1.5px solid var(--cm-table-border, var(--border-strong))',
    paddingLeft: '2px',
    paddingRight: '2px'
  },
  '.cm-table-line-first': {
    borderTop: '1.5px solid var(--cm-table-border, var(--border-strong))',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    marginTop: '8px'
  },
  '.cm-table-line-last': {
    borderBottom: '1.5px solid var(--cm-table-border, var(--border-strong))',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    marginBottom: '8px'
  },
  '.cm-table-line:not(.cm-table-line-last)': {
    borderBottom: '1px solid var(--cm-table-border, var(--border-strong))'
  },
  '.cm-table-line-active': {
    backgroundColor: 'transparent'
  },
  '.cm-table-header-line': {
    fontWeight: '600',
    backgroundColor: 'var(--cm-table-header-bg, var(--bg-surface-normal))'
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
    borderRight: '1.5px solid var(--cm-table-border, var(--border-strong))',
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
    border: '1px solid var(--cm-table-border, var(--border-strong))',
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
      borderRight: '1px solid var(--cm-table-border, var(--border-strong))',
      borderBottom: '1px solid var(--cm-table-border, var(--border-strong))',
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
  '.cm-table-block:not(.cm-table-block--desktop) .cm-table-preview th': {
    backgroundColor: 'var(--cm-table-header-bg, var(--bg-surface-normal))',
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
    borderColor: 'var(--color-primary)',
    background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
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
    border: '1px solid var(--cm-table-border, var(--border-strong))',
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
  '.cm-table-grid-cell--col-selected': {
    background: 'transparent',
    position: 'relative'
  },
  '.cm-table-grid-cell--col-selected::after': {
    content: '""',
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    borderLeft: '2px solid var(--color-primary)',
    borderRight: '2px solid var(--color-primary)',
    boxSizing: 'border-box'
  },
  '.cm-table-preview thead .cm-table-grid-cell--col-selected::after': {
    borderTop: '2px solid var(--color-primary)'
  },
  '.cm-table-preview tbody tr:last-child .cm-table-grid-cell--col-selected::after': {
    borderBottom: '2px solid var(--color-primary)'
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
    borderTop: '2px solid var(--color-primary)',
    borderBottom: '2px solid var(--color-primary)',
    boxSizing: 'border-box'
  },
  '.cm-table-preview .cm-table-grid-cell--row-selected:first-child::after': {
    borderLeft: '2px solid var(--color-primary)'
  },
  '.cm-table-preview .cm-table-grid-cell--row-selected:last-child::after': {
    borderRight: '2px solid var(--color-primary)'
  },
  '.cm-table-block--col-selected .cm-table-col-handle.cm-table-handle--active': {
    background: 'var(--color-primary)',
    borderRadius: '4px'
  },
  '.cm-table-block--col-selected .cm-table-col-handle.cm-table-handle--active .cm-table-grip-icon':
    {
      fill: '#fff'
    }
}
