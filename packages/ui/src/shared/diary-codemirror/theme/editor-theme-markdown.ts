import { DIARY_EDITOR_OVERLAY_Z } from '../editorOverlayZIndex'
import { IMAGE_SIZE_CONFIG } from '../utils/image-utils'

/**
 * 代码块、图片、占位、日记标签与表格 tooltip。
 * 这些是正文装饰，不是表格格子结构，单独改图片/标签时不必打开 chrome 表。
 */
export const editorThemeMarkdown = {
  '.cm-code': {
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    backgroundColor: 'var(--bg-surface-normal)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: 'inherit'
  },
  '.cm-codeBlock': {
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
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
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    backgroundColor: 'var(--bg-surface-normal)',
    fontSize: '13px',
    lineHeight: '1.6'
  },
  '.cm-code-line': {
    backgroundColor: 'var(--bg-code-block) !important',
    fontFamily: 'var(--font-family-main, var(--font-family, inherit))',
    paddingLeft: '12px !important',
    paddingRight: '12px !important',
    minHeight: '1.5em',
    lineHeight: '1.5'
  },
  '.cm-code-line .cm-rendered-inline-code': {
    backgroundColor: 'transparent !important',
    padding: '0 !important',
    margin: '0 !important',
    borderRadius: '0 !important'
  },
  '.cm-activeLine.cm-code-line': {
    backgroundColor: 'var(--bg-code-block) !important'
  },
  '.cm-line.cm-wb-properties': {
    backgroundColor:
      'color-mix(in srgb, var(--text-primary) 4%, var(--bg-surface-low, var(--bg-editor)))',
    padding: '4px 12px'
  },
  '.cm-line.cm-wb-properties-first': {
    paddingTop: '14px',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  },
  '.cm-line.cm-wb-properties-last': {
    paddingBottom: '26px',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px'
  },
  '.cm-wb-property-key': {
    color: 'var(--text-secondary)',
    fontWeight: '600'
  },
  '.cm-line.cm-wb-hr': {
    position: 'relative',
    minHeight: '1.5em',
    paddingTop: '14px',
    paddingBottom: '14px'
  },
  '.cm-wb-hr-widget': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    margin: '0',
    borderTop: '1px solid var(--border-control)',
    verticalAlign: 'middle',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  },
  '.cm-code-line-top': {
    paddingTop: '20px !important',
    minHeight: 'calc(1.5em + 20px)',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  },
  '.cm-code-line-bottom': {
    paddingBottom: '20px !important',
    minHeight: 'calc(1.5em + 20px)',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px'
  },
  '.cm-code-line-top.cm-code-line-bottom': {
    minHeight: 'calc(1.5em + 40px)'
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
    display: 'inline-block',
    borderRadius: '10px',
    padding: '1px 8px',
    margin: '0 6px 0 0',
    fontSize: '16px',
    fontWeight: '500',
    lineHeight: '24px',
    verticalAlign: 'baseline',
    boxSizing: 'border-box'
  },
  '.cm-diary-tag-c0': {
    color: 'var(--tag-0-fg)',
    backgroundColor: 'color-mix(in srgb, var(--tag-0-fg) 15%, transparent)'
  },
  '.cm-diary-tag-c1': {
    color: 'var(--tag-1-fg)',
    backgroundColor: 'color-mix(in srgb, var(--tag-1-fg) 15%, transparent)'
  },
  '.cm-diary-tag-c2': {
    color: 'var(--tag-2-fg)',
    backgroundColor: 'color-mix(in srgb, var(--tag-2-fg) 15%, transparent)'
  },
  '.cm-diary-tag-c3': {
    color: 'var(--tag-3-fg)',
    backgroundColor: 'color-mix(in srgb, var(--tag-3-fg) 15%, transparent)'
  },
  '& .cm-line:has(.cm-diary-tag-token)': {
    lineHeight: 'inherit'
  },

  /* 行列菜单用实底，z-index 略高于正文右键菜单，避免半透明叠到正文上 */
  '.cm-tooltip.tbl-menu-tooltip': {
    border: 'none',
    padding: 0,
    backgroundColor: 'transparent',
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.tableMenu),
    boxSizing: 'border-box',
    overflow: 'visible'
  },
  '.cm-tooltip.tbl-menu-tooltip .tbl-menu': {
    backgroundColor: 'var(--bg-surface-raised)',
    border: '1px solid var(--border-muted)',
    boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12))',
    borderRadius: 'var(--radius-sm, 8px)',
    zIndex: String(DIARY_EDITOR_OVERLAY_Z.tableMenu)
  }
}
