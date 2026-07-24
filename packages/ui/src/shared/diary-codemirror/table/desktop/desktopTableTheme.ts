import { EditorView } from '@codemirror/view'

/** ckant 对齐的桌面表格主题（仅 .cm-table-block--desktop） */
export const desktopTableTheme = EditorView.baseTheme({
  '.cm-table-block--desktop': {
    '--tbl-theme-row-background': 'var(--bg-surface)',
    '--tbl-theme-header-row-background': 'var(--bg-surface-normal)',
    '--tbl-theme-even-row-background': 'var(--tbl-theme-row-background)',
    '--tbl-theme-odd-row-background':
      'color-mix(in srgb, var(--tbl-theme-row-background), var(--text-primary) 3%)',
    '--tbl-theme-border-color': 'var(--border-subtle)',
    '--tbl-theme-border-hover-color':
      'color-mix(in srgb, var(--tbl-theme-border-color), var(--text-primary) 12%)',
    '--tbl-theme-border-active-color':
      'color-mix(in srgb, var(--tbl-theme-border-color), var(--color-primary) 45%)',
    '--tbl-theme-outline-color': 'var(--color-primary)',
    '--tbl-theme-text-color': 'var(--text-primary, inherit)',
    '--tbl-overlay': 'transparent',
    padding: '2px 0 6px',
    width: '100%',
    maxWidth: '100%',
    overflow: 'visible'
  },

  '.cm-table-block--desktop[data-tbl-hoverable="true"] .cm-tbl-handle--header, .cm-table-block--desktop[data-tbl-hoverable="true"] .cm-tbl-table-handle':
    {
      opacity: '1'
    },

  '.cm-table-block--desktop:not([data-tbl-hoverable="true"]) .cm-tbl-handle[data-type="border"], .cm-table-block--desktop:not([data-tbl-hoverable="true"]) .cm-tbl-table-handle':
    {
      display: 'none'
    },

  '.cm-table-block--desktop .cm-tbl-handle[data-type="border"]': {
    backgroundColor: 'var(--tbl-theme-border-hover-color)',
    opacity: '0',
    pointerEvents: 'auto'
  },

  '.cm-table-block--desktop .cm-tbl-handle[data-type="border"]:hover, .cm-table-block--desktop .cm-tbl-handle[data-type="border"][data-active]':
    {
      opacity: '1'
    },

  '.cm-table-block--desktop .cm-tbl-handle[data-type="border"][data-active]': {
    backgroundColor: 'var(--tbl-theme-border-active-color)'
  },

  '.cm-table-block--desktop .cm-tbl-widget': {
    boxSizing: 'border-box',
    overflow: 'visible'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-scroll': {
    overflow: 'visible',
    padding: '17px 18px 18px 17px',
    marginLeft: '0'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-hscroll': {
    overflowX: 'auto',
    overflowY: 'visible',
    maxWidth: '100%'
  },

  '.cm-table-block--desktop:not([data-tbl-handle-position="outside"]) .cm-tbl-scroll': {
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '12px 14px 14px 10px',
    marginLeft: '-6px'
  },

  '.cm-table-block--desktop:not([data-tbl-handle-position="outside"]) .cm-tbl-hscroll': {
    overflow: 'visible',
    maxWidth: '100%'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-table-shell': {
    position: 'relative',
    display: 'inline-block',
    minWidth: 'min(100%, 240px)',
    verticalAlign: 'top',
    overflow: 'visible',
    padding: '0',
    margin: '0',
    width: 'fit-content',
    whiteSpaceCollapse: 'collapse'
  },

  '.cm-table-block--desktop:not([data-tbl-handle-position="outside"]) .cm-tbl-table-shell': {
    position: 'relative',
    display: 'inline-block',
    minWidth: 'min(100%, 240px)',
    verticalAlign: 'top',
    overflow: 'visible'
  },

  '.cm-table-block--desktop .cm-tbl-table': {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    tableLayout: 'fixed',
    fontSize: 'inherit',
    lineHeight: '1.5',
    border: 'none',
    color: 'var(--tbl-theme-text-color)',
    overflow: 'visible',
    touchAction: 'none'
  },

  '.cm-table-block--desktop .cm-tbl-table thead .cm-tbl-cell, .cm-table-block--desktop .cm-tbl-table tbody .cm-tbl-cell':
    {
      height: 'inherit'
    },

  '.cm-table-block--desktop .cm-tbl-table tbody tr, .cm-table-block--desktop .cm-tbl-table thead tr':
    {
      height: '0'
    },

  '@supports (-moz-appearance: none)': {
    '.cm-table-block--desktop .cm-tbl-table tbody tr, .cm-table-block--desktop .cm-tbl-table thead tr':
      {
        height: 'fit-content'
      }
  },

  '.cm-table-block--desktop .cm-tbl-table thead .cm-tbl-cell': {
    '--tbl-row-background': 'var(--tbl-theme-header-row-background)'
  },

  '.cm-table-block--desktop .cm-tbl-table tbody tr:nth-child(odd) .cm-tbl-data-cell': {
    '--tbl-row-background': 'var(--tbl-theme-even-row-background)'
  },

  '.cm-table-block--desktop .cm-tbl-table tbody tr:nth-child(even) .cm-tbl-data-cell': {
    '--tbl-row-background': 'var(--tbl-theme-odd-row-background)'
  },

  '.cm-table-block--desktop .cm-tbl-cell': {
    boxSizing: 'content-box',
    position: 'relative',
    verticalAlign: 'top',
    padding: '0',
    border: 'none',
    minWidth: 'calc(4ch + 20px)',
    userSelect: 'none',
    backgroundColor: 'var(--tbl-row-background, var(--tbl-theme-row-background))',
    scrollMarginLeft: '1px',
    scrollMarginRight: '1px'
  },

  '.cm-table-block--desktop .cm-tbl-cell:first-child': {
    scrollMarginLeft: '16px'
  },

  '.cm-table-block--desktop .cm-tbl-cell:last-child': {
    scrollMarginRight: '16px'
  },

  '.cm-table-block--desktop .cm-tbl-cell[align="left"] .cm-table-cell-view, .cm-table-block--desktop .cm-tbl-cell[align="left"] .cm-table-cell-editor .cm-content, .cm-table-block--desktop .cm-tbl-cell[align="left"] .cm-table-cell-editor .cm-line':
    {
      textAlign: 'left'
    },

  '.cm-table-block--desktop .cm-tbl-cell[align="center"] .cm-table-cell-view, .cm-table-block--desktop .cm-tbl-cell[align="center"] .cm-table-cell-editor .cm-content, .cm-table-block--desktop .cm-tbl-cell[align="center"] .cm-table-cell-editor .cm-line':
    {
      textAlign: 'center'
    },

  '.cm-table-block--desktop .cm-tbl-cell[align="right"] .cm-table-cell-view, .cm-table-block--desktop .cm-tbl-cell[align="right"] .cm-table-cell-editor .cm-content, .cm-table-block--desktop .cm-tbl-cell[align="right"] .cm-table-cell-editor .cm-line':
    {
      textAlign: 'right'
    },

  '.cm-table-block--desktop .cm-tbl-header-cell:not([align])': {
    textAlign: 'left'
  },

  '.cm-table-block--desktop .cm-tbl-data-cell:not([align]) .cm-table-cell-view, .cm-table-block--desktop .cm-tbl-data-cell:not([align]) .cm-table-cell-editor .cm-content, .cm-table-block--desktop .cm-tbl-data-cell:not([align]) .cm-table-cell-editor .cm-line':
    {
      textAlign: 'left'
    },

  '.cm-table-block--desktop .cm-tbl-header-cell': {
    fontWeight: '600'
  },

  '.cm-table-block--desktop .cm-tbl-cell[data-border~="top"]': {
    borderTop: '1px solid var(--tbl-theme-border-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-border~="right"]': {
    borderRight: '1px solid var(--tbl-theme-border-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-border~="bottom"]': {
    borderBottom: '1px solid var(--tbl-theme-border-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-border~="left"]': {
    borderLeft: '1px solid var(--tbl-theme-border-color)'
  },

  '.cm-table-block--desktop .cm-tbl-cell[data-outline]::after': {
    display: 'block',
    position: 'absolute',
    top: '-1px',
    left: '-1px',
    width: 'calc(100% + 2px)',
    height: 'calc(100% + 2px)',
    pointerEvents: 'none',
    content: '""',
    boxSizing: 'border-box',
    zIndex: '3'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-outline~="top"]::after': {
    borderTop: '2px solid var(--tbl-theme-outline-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-outline~="right"]::after': {
    borderRight: '2px solid var(--tbl-theme-outline-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-outline~="bottom"]::after': {
    borderBottom: '2px solid var(--tbl-theme-outline-color)'
  },
  '.cm-table-block--desktop .cm-tbl-cell[data-outline~="left"]::after': {
    borderLeft: '2px solid var(--tbl-theme-outline-color)'
  },

  '.cm-table-block--desktop .cm-table-cell-inner': {
    position: 'relative',
    width: '100%',
    minHeight: '1.5em',
    height: '100%'
  },

  '.cm-table-block--desktop .cm-table-cell-view': {
    margin: '0',
    padding: '7px 10px',
    width: '100%',
    height: '100%',
    minHeight: '1.5em',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    cursor: 'default',
    color: 'var(--tbl-theme-text-color)'
  },

  '.cm-table-block--desktop .cm-table-cell-view--hidden': {
    display: 'none'
  },

  '.cm-table-block--desktop .cm-table-cell-editor': {
    position: 'relative',
    width: '100%',
    minWidth: '0',
    height: '100%',
    zIndex: '2'
  },

  '.cm-table-block--desktop .cm-table-cell-editor .cm-editor': {
    width: '100%',
    height: 'auto',
    background: 'transparent'
  },

  '.cm-table-block--desktop .cm-table-cell-editor .cm-scroller': {
    overflow: 'visible'
  },

  '.cm-table-block--desktop .cm-table-cell-editor .cm-content': {
    padding: '7px 9px',
    lineHeight: '1.5',
    minHeight: '1.5em',
    width: '100%',
    boxSizing: 'border-box'
  },

  '.cm-table-block--desktop .cm-table-cell-editor .cm-line': {
    padding: '0 1px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },

  '.cm-table-block--desktop .cm-tbl-handle': {
    display: 'flex',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: '4',
    opacity: '0',
    transition: 'opacity 150ms ease 50ms, background-color 120ms ease',
    touchAction: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    color: 'var(--tbl-theme-border-hover-color)',
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
    boxSizing: 'content-box',
    minWidth: '0',
    minHeight: '0',
    borderRadius: '0'
  },

  '.cm-table-block--desktop .cm-tbl-handle--header[data-active], .cm-table-block--desktop .cm-tbl-handle--header:hover':
    {
      opacity: '1'
    },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-handle--header': {
    zIndex: '300',
    color: 'var(--tbl-theme-border-hover-color)',
    border: '1px solid transparent',
    transition: 'none'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-handle--header:hover': {
    borderColor: 'var(--tbl-theme-border-color)',
    backgroundColor:
      'color-mix(in srgb, var(--tbl-theme-border-color), var(--tbl-theme-header-row-background) 80%)'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-handle--header[data-active]':
    {
      backgroundColor: 'var(--tbl-theme-outline-color)',
      borderColor: 'var(--tbl-theme-outline-color)',
      color: '#ffffff'
    },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-table-col-handle': {
    top: '-17px',
    left: '-1px',
    width: 'calc(100% + 2px)',
    height: '15px',
    borderBottom: 'none'
  },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-table-row-handle': {
    top: '-1px',
    left: '-17px',
    width: '15px',
    height: '100%',
    borderRight: 'none'
  },

  '.cm-table-block--desktop .cm-tbl-handle--border-right, .cm-table-block--desktop .cm-tbl-handle[data-type="border"][data-location="col"]':
    {
      top: '-1px',
      right: '-2px',
      width: '3px',
      height: 'calc(100% + 2px)',
      backgroundColor: 'var(--tbl-theme-border-hover-color)'
    },

  '.cm-table-block--desktop .cm-tbl-handle--border-bottom, .cm-table-block--desktop .cm-tbl-handle[data-type="border"][data-location="row"]':
    {
      bottom: '-2px',
      left: '-1px',
      width: 'calc(100% + 2px)',
      height: '3px',
      backgroundColor: 'var(--tbl-theme-border-hover-color)'
    },

  '.cm-table-block--desktop .cm-tbl-grip-h, .cm-table-block--desktop .cm-tbl-grip-v': {
    display: 'block',
    fill: 'currentColor',
    opacity: '0.85',
    pointerEvents: 'none',
    zIndex: '333'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle--corner': {
    left: 'calc(100% - 1px)',
    top: 'calc(100% - 1px)',
    zIndex: '250',
    width: '15px',
    height: '15px',
    borderTop: '1px dashed var(--tbl-theme-border-color)',
    borderLeft: '1px dashed var(--tbl-theme-border-color)',
    borderRight: '1px solid var(--tbl-theme-border-color)',
    borderBottom: '1px solid var(--tbl-theme-border-color)'
  },

  '.cm-table-block--desktop .cm-tbl-blocking-overlay': {
    position: 'absolute',
    inset: '0',
    zIndex: '350',
    background: 'transparent',
    pointerEvents: 'auto'
  },

  '.cm-table-block--desktop .cm-tbl-select-all-overlay': {
    position: 'absolute',
    inset: '0',
    zIndex: '340',
    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
    pointerEvents: 'none',
    transition: 'background 120ms ease'
  },

  '.cm-table-block--desktop.cm-table-block--has-active-cell .cm-tbl-select-all-overlay': {
    background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle': {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--tbl-theme-border-color)',
    background:
      'color-mix(in srgb, var(--tbl-theme-border-color), var(--tbl-theme-header-row-background) 80%)',
    color: 'var(--tbl-theme-border-hover-color)',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 150ms ease 50ms',
    padding: '0',
    zIndex: '5',
    boxSizing: 'content-box'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle:hover, .cm-table-block--desktop .cm-tbl-table-handle[data-active]':
    {
      opacity: '1'
    },

  '.cm-table-block--desktop[data-tbl-handle-position="outside"] .cm-tbl-table-handle--menu': {
    top: '-17px',
    left: '-17px',
    width: '15px',
    height: '15px',
    borderRight: 'none',
    borderBottom: 'none'
  },

  '.cm-table-block--desktop:not([data-tbl-handle-position="outside"]) .cm-tbl-table-handle--menu': {
    top: '-1px',
    left: '-1px',
    width: '14px',
    height: '14px',
    borderRight: 'none',
    borderBottom: 'none'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle--add-col': {
    top: '0',
    left: '100%',
    width: '15px',
    height: 'calc(100% - 2px)',
    border: '1px solid var(--tbl-theme-border-color)',
    borderLeft: 'none'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle--add-row': {
    top: '100%',
    left: '0',
    width: 'calc(100% - 2px)',
    height: '15px',
    border: '1px solid var(--tbl-theme-border-color)',
    borderTop: 'none'
  },

  '.cm-table-block--desktop .cm-tbl-table-handle--corner:hover ~ .cm-tbl-table-handle--add-col, .cm-table-block--desktop .cm-tbl-table-handle--corner[data-active] ~ .cm-tbl-table-handle--add-col, .cm-table-block--desktop .cm-tbl-table-handle--corner:hover ~ .cm-tbl-table-handle--add-row, .cm-table-block--desktop .cm-tbl-table-handle--corner[data-active] ~ .cm-tbl-table-handle--add-row':
    {
      opacity: '1'
    },

  '.cm-table-block--desktop .cm-tbl-table-handle--corner:hover ~ .cm-tbl-table-handle--add-col, .cm-table-block--desktop .cm-tbl-table-handle--corner[data-active] ~ .cm-tbl-table-handle--add-col':
    {
      borderBottom: 'none'
    },

  '.cm-table-block--desktop .cm-tbl-table-handle--corner:hover ~ .cm-tbl-table-handle--add-row, .cm-table-block--desktop .cm-tbl-table-handle--corner[data-active] ~ .cm-tbl-table-handle--add-row':
    {
      borderRight: 'none'
    },

  '.cm-table-block--desktop .cm-tbl-plus': {
    display: 'block',
    flexShrink: '0',
    pointerEvents: 'none',
    color: 'var(--tbl-theme-border-hover-color)',
    opacity: '0.9'
  },

  '.cm-table-block--desktop.cm-table-block--range-dragging .cm-table-cell-view, .cm-table-block--desktop.cm-table-block--range-dragging .cm-table-cell-editor':
    {
      userSelect: 'none',
      cursor: 'cell'
    },

  '.cm-editor .cm-content .cm-table-block--desktop ::selection, .cm-editor .cm-content .cm-table-block--desktop .cm-table-cell-view::selection':
    {
      backgroundColor: 'transparent !important'
    }
})
