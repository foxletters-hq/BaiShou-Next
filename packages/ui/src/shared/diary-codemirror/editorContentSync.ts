import type { EditorView } from '@codemirror/view'
import { diarySyntaxTreeGrowthEffect } from './extensions/diarySyntaxTreeGrowth'

export function clampPosToDoc(pos: number, docLength: number): number {
  return Math.max(0, Math.min(pos, docLength))
}

export interface ReplaceEditorDocumentOptions {
  scrollIntoView?: boolean
  refreshSyntaxTree?: boolean
  preserveScrollTop?: boolean
}

/** 全量替换编辑器正文，并将选区钳制在新文档范围内（避免 Selection points outside of document） */
export function replaceEditorDocumentContent(
  view: EditorView,
  content: string,
  options: ReplaceEditorDocumentOptions = {}
): boolean {
  const current = view.state.doc.toString()
  if (content === current) return false

  const { anchor, head } = view.state.selection.main
  const mapPos = (pos: number) => clampPosToDoc(pos, content.length)
  const scrollTop = view.scrollDOM.scrollTop
  const refreshSyntaxTree = options.refreshSyntaxTree !== false

  view.dispatch({
    changes: { from: 0, to: current.length, insert: content },
    selection: { anchor: mapPos(anchor), head: mapPos(head) },
    ...(refreshSyntaxTree ? { effects: diarySyntaxTreeGrowthEffect.of(null) } : {}),
    scrollIntoView: options.scrollIntoView ?? false
  })

  if (options.preserveScrollTop !== false && options.scrollIntoView === false) {
    view.scrollDOM.scrollTop = scrollTop
  }

  if (refreshSyntaxTree) {
    requestAnimationFrame(() => {
      if (!view.dom.isConnected) return
      view.dispatch({ effects: diarySyntaxTreeGrowthEffect.of(null) })
    })
  }

  return true
}
