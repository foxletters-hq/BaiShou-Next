import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.baseTheme({
  '.cm-editor': {
    height: '100%',
    fontSize: '15px',
    lineHeight: '1.7',
  },
  '.cm-editor.cm-focused': {
    outline: 'none !important',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    padding: '16px 24px',
    minHeight: '100%',
    paddingBottom: '20vh',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important',
  },
  '&.cm-focused .cm-activeLine': {
    backgroundColor: 'transparent !important',
  },
  '.cm-selectionBackground': {
    backgroundColor:
      'var(--color-primary-light, rgba(99, 102, 241, 0.2)) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text-primary)',
  },

  // 渲染标题（禁止 inline-block，会触发 InlineCoordsScan 无限递归）
  '.cm-rendered-h1': {
    fontSize: '1.8em',
    fontWeight: '700',
  },
  '.cm-rendered-h2': {
    fontSize: '1.5em',
    fontWeight: '600',
  },
  '.cm-rendered-h3': {
    fontSize: '1.3em',
    fontWeight: '600',
  },
  '.cm-rendered-h4': {
    fontSize: '1.1em',
    fontWeight: '600',
  },
  '.cm-rendered-h5': {
    fontSize: '1.05em',
    fontWeight: '600',
  },
  '.cm-rendered-h6': {
    fontSize: '1em',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },

  '.cm-rendered-link': {
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    cursor: 'pointer',
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
  },
  '.cm-code': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9em',
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
    lineHeight: '1.6',
  },

  // 围栏代码块（Decoration.mark 为行内 span，禁止 block 属性）
  '.cm-rendered-codeBlock': {
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  '.cm-rendered-codeMark': {
    color: 'var(--text-tertiary)',
    fontSize: '0.85em',
    userSelect: 'none',
  },
  '.cm-link': {
    color: 'var(--color-primary)',
    textDecoration: 'none',
  },
  '.cm-url': {
    color: 'var(--text-tertiary)',
    fontSize: '0.85em',
  },
  '.cm-strikethrough': {
    textDecoration: 'line-through',
    color: 'var(--text-tertiary)',
  },
  '.cm-strong': { fontWeight: '700' },
  '.cm-emphasis': { fontStyle: 'italic' },
  '.cm-image': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  '.cm-placeholder': {
    color: 'var(--text-tertiary)',
    opacity: '0.6',
  },
});
