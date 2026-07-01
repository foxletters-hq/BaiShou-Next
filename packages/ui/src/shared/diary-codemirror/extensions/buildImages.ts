import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { ImageWidget } from '../widgets/ImageWidget'
import { isCursorOnLine } from './cursor'
import type { DiaryCmPlatform } from '../types'

const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/g

export type ImageRange = { from: number; to: number }

export function collectImageDecorations(
  state: EditorState,
  cursors: number[],
  platform: DiaryCmPlatform | undefined,
  marks: { from: number; to: number; value: Decoration }[]
): ImageRange[] {
  const resolveUrl = platform?.resolveAttachmentUrl
  const tree = syntaxTree(state)
  const doc = state.doc
  const docText = doc.toString()
  const imageRanges: ImageRange[] = []
  let match

  while ((match = IMAGE_MARKDOWN_REGEX.exec(docText)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length

    const pos = matchStart
    const nodeAtPos = tree.resolveInner(pos, 1)
    let insideCode = false
    let curr: typeof nodeAtPos | null = nodeAtPos
    while (curr) {
      if (curr.name === 'FencedCode' || curr.name === 'CodeBlock' || curr.name === 'InlineCode') {
        insideCode = true
        break
      }
      curr = curr.parent
    }
    if (insideCode) continue

    const line = doc.lineAt(matchStart)
    const onActiveLine = isCursorOnLine(line.from, line.to, cursors)
    const showLinkBar = platform?.interactionMode !== 'touch' && onActiveLine

    const alt = match[1] ?? ''
    const srcRaw = match[2] ?? ''
    const widthStr = match[3]
    const width = widthStr ? parseInt(widthStr, 10) : undefined
    const validWidth = width && !isNaN(width) && width > 0 ? width : undefined

    const src = resolveUrl ? resolveUrl(srcRaw) : srcRaw

    if (matchStart >= matchEnd) continue

    imageRanges.push({ from: matchStart, to: matchEnd })
    marks.push({
      from: matchStart,
      to: matchEnd,
      value: Decoration.replace({
        widget: new ImageWidget(
          src,
          alt,
          validWidth,
          matchStart,
          matchEnd,
          showLinkBar,
          srcRaw,
          platform
        )
      })
    })
  }

  return imageRanges
}
