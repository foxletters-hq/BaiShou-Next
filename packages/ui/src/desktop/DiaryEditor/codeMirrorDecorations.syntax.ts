import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const livePreviewHighlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  {
    tag: tags.strikethrough,
    textDecoration: 'line-through',
    color: 'var(--text-tertiary)'
  },
  {
    tag: tags.monospace,
    fontFamily: "'Fira Code', 'Courier New', monospace",
    backgroundColor: 'var(--bg-surface-normal)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9em'
  }
])

export function livePreviewSyntaxHighlighting() {
  return syntaxHighlighting(livePreviewHighlight)
}
