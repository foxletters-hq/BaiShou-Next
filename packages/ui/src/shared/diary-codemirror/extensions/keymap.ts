import { keymap } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'

export function toggleMarkdownMark(view: EditorView, marker: string): boolean {
  const { from, to } = view.state.selection.main
  const selText = view.state.sliceDoc(from, to)
  const mLen = marker.length

  if (selText.length > 0) {
    const before = view.state.sliceDoc(Math.max(0, from - mLen), from)
    const after = view.state.sliceDoc(to, to + mLen)
    if (before === marker && after === marker) {
      view.dispatch({
        changes: [
          { from: to, to: to + mLen },
          { from: from - mLen, to: from }
        ],
        selection: { anchor: from - mLen, head: to }
      })
    } else {
      view.dispatch({
        changes: { from, to, insert: `${marker}${selText}${marker}` },
        selection: { anchor: from + mLen, head: to + mLen }
      })
    }
    return true
  }

  view.dispatch({
    changes: { from, insert: `${marker}${marker}` },
    selection: { anchor: from + mLen }
  })
  return true
}

/**
 * 切换当前行的块级前缀（如 `> `、`- `、`##### `）。
 * - 若当前行已有相同前缀，则移除该前缀；
 * - 若是标题前缀且当前行已有其他级别标题前缀，则替换为新标题前缀；
 * - 否则在行首插入该前缀（无论光标在行首还是行中）。
 */
export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)

  if (line.text.startsWith(prefix)) {
    const removeLen = prefix.length
    const nextAnchor = Math.max(line.from, from - removeLen)
    const nextHead = Math.max(line.from, to - removeLen)
    view.dispatch({
      changes: { from: line.from, to: line.from + removeLen, insert: '' },
      selection: { anchor: nextAnchor, head: nextHead }
    })
    return true
  }

  const isHeadingPrefix = /^#{1,6}\s+$/.test(prefix)
  const existingHeading = isHeadingPrefix ? line.text.match(/^#{1,6}\s+/) : null
  if (existingHeading) {
    const oldLen = existingHeading[0].length
    const delta = prefix.length - oldLen
    view.dispatch({
      changes: { from: line.from, to: line.from + oldLen, insert: prefix },
      selection: {
        anchor: Math.max(line.from + prefix.length, from + delta),
        head: Math.max(line.from + prefix.length, to + delta)
      }
    })
    return true
  }

  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
    selection: { anchor: from + prefix.length, head: to + prefix.length }
  })
  return true
}

/** 插入或包裹围栏代码块 ``` */
export function insertFencedCodeBlock(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const line = view.state.doc.lineAt(from)

  if (selected.length > 0) {
    const leadingNewline = from > line.from ? '\n' : ''
    const insert = `${leadingNewline}\`\`\`\n${selected}\n\`\`\``
    const codeStart = from + leadingNewline.length + 4
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: codeStart, head: codeStart + selected.length }
    })
    return true
  }

  const needLeadingNewline = line.text.trim().length > 0
  const prefix = needLeadingNewline ? '\n```\n' : '```\n'
  const suffix = '\n```'
  const insertPos = needLeadingNewline ? line.to : line.from
  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: `${prefix}${suffix}` },
    selection: { anchor: insertPos + prefix.length }
  })
  return true
}

/** 插入 Markdown 链接 `[text](url)` */
export function insertMarkdownLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.length > 0) {
    const insert = `[${selected}](url)`
    const urlStart = from + selected.length + 3
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: urlStart, head: urlStart + 3 }
    })
    return true
  }
  const insert = '[](url)'
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + 1 }
  })
  return true
}

export const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => toggleMarkdownMark(v, '**') },
  { key: 'Mod-i', run: (v) => toggleMarkdownMark(v, '*') },
  { key: 'Mod-q', run: (v) => toggleMarkdownMark(v, '`') },
  { key: 'Mod-w', run: (v) => insertFencedCodeBlock(v) },
  { key: 'Mod-Shift-x', run: (v) => toggleMarkdownMark(v, '~~') },
  { key: 'Mod-k', run: (v) => insertMarkdownLink(v) }
])
