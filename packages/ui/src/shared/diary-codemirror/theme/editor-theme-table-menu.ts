import { DIARY_EDITOR_OVERLAY_Z } from '../editorOverlayZIndex'

/**
 * 表格右键菜单、底栏与范围高亮。
 * 依赖 overlay z-index，不能和格子边框/手柄写在一起，否则改浮层会误伤表格结构。
 */
export const editorThemeTableMenu = {
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
    background: 'var(--bg-surface)',
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
    background: 'var(--bg-surface-normal)'
  },
  '.cm-table-context-menu-item--destructive': {
    color: 'var(--color-error)'
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
    background: 'var(--bg-surface)',
    borderTop: '1px solid var(--border-subtle)',
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
    background: 'var(--border-subtle)',
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
    background: 'var(--bg-surface-normal)',
    border: 'none',
    boxShadow: 'inset 0 0 0 1px var(--border-subtle)'
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
    borderBottom: '1px solid var(--border-subtle)',
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
    background: 'var(--bg-surface-normal)'
  },
  '.cm-table-sheet-item:last-child': {
    borderBottom: 'none'
  },
  '.cm-table-sheet-item:disabled': {
    opacity: '0.45'
  },
  '.cm-table-sheet-item--destructive': {
    color: 'var(--color-error)'
  },
  '.cm-table-block--range-dragging .cm-table-cell-view, .cm-table-block--range-dragging .cm-table-cell-editor':
    {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      cursor: 'cell'
    },
  '.cm-table-grid-cell--range-selected': {
    background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
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
  }
}
