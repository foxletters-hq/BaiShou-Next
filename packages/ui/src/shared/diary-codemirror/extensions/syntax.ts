import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const livePreviewHighlight = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-rendered-h1' },
  { tag: tags.heading2, class: 'cm-rendered-h2' },
  { tag: tags.heading3, class: 'cm-rendered-h3' },
  { tag: tags.heading4, class: 'cm-rendered-h4' },
  { tag: tags.heading5, class: 'cm-rendered-h5' },
  { tag: tags.heading6, class: 'cm-rendered-h6' },
  { tag: tags.quote, class: 'cm-rendered-blockquote-content' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  {
    tag: tags.strikethrough,
    textDecoration: 'line-through',
    color: 'var(--text-tertiary)'
  },
  {
    tag: tags.monospace,
    class: 'cm-rendered-inline-code'
  }
])

export function livePreviewSyntaxHighlighting() {
  return syntaxHighlighting(livePreviewHighlight)
}
