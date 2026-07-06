import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { ImageWidget } from '../widgets/ImageWidget'
import { ImagePlaceholderWidget } from '../widgets/ImagePlaceholderWidget'
import { isCursorOnLine } from './cursor'
import { pushReplaceDecoration, type DecorationMark } from './decorationMarks'
import type { DiaryCmPlatform } from '../types'

const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/g

export type ImageRange = { from: number; to: number }

export type CollectImageDecorationsOptions = {
  visibleRanges?: readonly { from: number; to: number }[]
  /** 视口外使用轻量占位，避免一次性挂载大量图片 widget */
  offscreenPlaceholder?: boolean
}

function isInsideCodeBlock(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state)
  const nodeAtPos = tree.resolveInner(pos, 1)
  let curr: typeof nodeAtPos | null = nodeAtPos
  while (curr) {
    if (curr.name === 'FencedCode' || curr.name === 'CodeBlock' || curr.name === 'InlineCode') {
      return true
    }
    curr = curr.parent
  }
  return false
}

function intersectsVisible(
  from: number,
  to: number,
  visibleRanges: readonly { from: number; to: number }[] | undefined
): boolean {
  if (!visibleRanges || visibleRanges.length === 0) return true
  for (const range of visibleRanges) {
    if (from < range.to && to > range.from) return true
  }
  return false
}

export function scanImageRanges(state: EditorState): ImageRange[] {
  const docText = state.doc.toString()
  const imageRanges: ImageRange[] = []
  const regex = new RegExp(IMAGE_MARKDOWN_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(docText)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    if (isInsideCodeBlock(state, matchStart)) continue
    if (matchStart >= matchEnd) continue
    imageRanges.push({ from: matchStart, to: matchEnd })
  }

  return imageRanges
}

export function collectImageDecorations(
  state: EditorState,
  cursors: number[],
  platform: DiaryCmPlatform | undefined,
  marks: DecorationMark[],
  options?: CollectImageDecorationsOptions
): ImageRange[] {
  const resolveUrl = platform?.resolveAttachmentUrl
  const doc = state.doc
  const docText = doc.toString()
  const imageRanges: ImageRange[] = []
  const regex = new RegExp(IMAGE_MARKDOWN_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(docText)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    if (isInsideCodeBlock(state, matchStart)) continue

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

    const inView = intersectsVisible(matchStart, matchEnd, options?.visibleRanges)
    if (!inView) {
      if (options?.offscreenPlaceholder) {
        pushReplaceDecoration(marks, doc, matchStart, matchEnd, {
          widget: new ImagePlaceholderWidget(validWidth, alt)
        })
      }
      continue
    }

    pushReplaceDecoration(marks, doc, matchStart, matchEnd, {
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
  }

  return imageRanges
}
