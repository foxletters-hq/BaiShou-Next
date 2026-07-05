import {
  keymap,
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { shouldSkipDiaryTagExtractionLine } from '@baishou/shared'
import {
  getActiveDiaryTagColorRegistry,
  resolveActiveDiaryTagColorIndex,
  setActiveDiaryTagColorRegistry
} from './diary-tag-color-state'

export { setActiveDiaryTagColorRegistry, getActiveDiaryTagColorRegistry }

export const refreshDiaryTagColorRegistryEffect = StateEffect.define<Record<string, number>>()

const TAG_TOKEN_RE = /#([^\s#]+)/g

function extractTagsFromTagLine(line: string): string[] {
  const tags: string[] = []
  const seen = new Set<string>()
  for (const match of line.matchAll(TAG_TOKEN_RE)) {
    const tag = match[1]?.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

function collectTagDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc
  const marks: { from: number; to: number; value: Decoration }[] = []

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    const line = doc.line(lineNum)
    if (shouldSkipDiaryTagExtractionLine(line.text)) continue

    for (const match of line.text.matchAll(TAG_TOKEN_RE)) {
      const index = match.index ?? 0
      const from = line.from + index
      const to = from + match[0].length
      const tagName = match[1] ?? ''
      const colorIndex = resolveActiveDiaryTagColorIndex(tagName)
      marks.push(
        Decoration.mark({
          class: `cm-diary-tag-token cm-diary-tag-c${colorIndex}`
        }).range(from, to)
      )
    }
  }

  return marks.length ? Decoration.set(marks, true) : Decoration.none
}

export const diaryTagLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = collectTagDecorations(view)
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(refreshDiaryTagColorRegistryEffect))
        )
      ) {
        this.decorations = collectTagDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

function runDiaryTagEnter(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)

  // 列表行交给 listContinuation 处理
  if (/^\s*[-*+]\s/.test(line.text)) return false

  if (shouldSkipDiaryTagExtractionLine(line.text)) return false

  const lineText = line.text
  const cursorInLine = head - line.from
  const beforeCursor = lineText.slice(0, cursorInLine)
  const afterCursor = lineText.slice(cursorInLine)

  const incompleteTag = beforeCursor.match(/#([^\s#]*)$/)
  if (incompleteTag) {
    const tagName = incompleteTag[1] ?? ''
    if (tagName) {
      view.dispatch({
        changes: { from: head, insert: ' ' },
        selection: { anchor: head + 1 }
      })
      return true
    }
  }

  const trailing = (beforeCursor + afterCursor).trimEnd()
  const hasTags = extractTagsFromTagLine(trailing).length > 0 || trailing === '#'
  if (!hasTags && trailing === '') {
    view.dispatch({
      changes: { from: line.to, insert: '\n' },
      selection: { anchor: line.to + 1 }
    })
    return true
  }

  if (afterCursor.trim() === '') {
    view.dispatch({
      changes: { from: line.to, insert: '\n' },
      selection: { anchor: line.to + 1 }
    })
    return true
  }

  return false
}

/** 内联 #标签：Enter 完成当前标签或换行 */
export const diaryTagLineKeymap = keymap.of([
  {
    key: 'Enter',
    run: runDiaryTagEnter,
    shift: runDiaryTagEnter
  }
])
