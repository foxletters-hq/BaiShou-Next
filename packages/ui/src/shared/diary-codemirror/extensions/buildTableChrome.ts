import type { EditorState } from '@codemirror/state'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'

export type TableBlockRange = { from: number; to: number }

/** 已被 tablePreviewField widget 接管的 Table 节点 key（nodeFrom，供 live preview 跳过重复装饰） */
export function collectTableBlockRanges(state: EditorState): TableBlockRange[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const blocked: TableBlockRange[] = []

  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return
      blocked.push({ from: node.from, to: node.to })
    }
  })

  return blocked
}

export function rangeOverlapsTableBlocks(
  from: number,
  to: number,
  blocks: TableBlockRange[]
): boolean {
  return blocks.some((b) => from < b.to && to > b.from)
}
