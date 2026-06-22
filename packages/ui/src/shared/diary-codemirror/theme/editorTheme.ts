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
    display: 'inline-block',
    borderRadius: '12px',
    padding: '2px 8px',
    margin: '3px 4px 3px 0',
    fontWeight: '500',
    lineHeight: '1.35',
    verticalAlign: 'top',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone'
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
    lineHeight: '2.25'
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
