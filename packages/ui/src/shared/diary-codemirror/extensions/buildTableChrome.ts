import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { parseTableFromDoc } from '../table/table.model'
import { TableBlockWidget } from '../widgets/TableBlockWidget'
import type { DiaryCmPlatform } from '../types'

export type TableBlockRange = { from: number; to: number }

/** 始终用 Obsidian 风格块级预览替换整张表（编辑也在 widget 内完成） */
export function collectTableBlockWidgets(
  state: EditorState,
  _cursors: number[],
  marks: { from: number; to: number; value: Decoration }[],
  platform?: DiaryCmPlatform
): TableBlockRange[] {
  const tree = syntaxTree(state)
  const doc = state.doc
  const blocked: TableBlockRange[] = []

  tree.iterate({
    enter(node) {
      if (node.type.name !== 'Table') return

      const table = parseTableFromDoc(doc, node.from, node.to)
      if (!table) return

      blocked.push({ from: table.from, to: table.to })
      marks.push({
        from: table.from,
        to: table.to,
        value: Decoration.replace({
          widget: new TableBlockWidget(table, platform),
          block: true,
          inclusive: true
        })
      })
    }
  })

  return blocked
}

export function isPosInsideTableBlocks(pos: number, blocks: TableBlockRange[]): boolean {
  return blocks.some((b) => pos >= b.from && pos <= b.to)
}

export function rangeOverlapsTableBlocks(
  from: number,
  to: number,
  blocks: TableBlockRange[]
): boolean {
  return blocks.some((b) => from < b.to && to > b.from)
}
