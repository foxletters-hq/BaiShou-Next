import { EditorView } from '@codemirror/view'

/**
 * 移动端两种滚动模型单独成文件：这里会覆盖 .cm-editor / .cm-scroller。
 * 不能并进桌面 baseTheme，否则桌面会丢掉固定高度滚动。
 */
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
