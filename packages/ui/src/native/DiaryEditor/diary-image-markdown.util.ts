/** 与 web DiaryEditor/image-utils 对齐的 Markdown 图片解析 */

export interface ParsedDiaryImage {
  alt: string
  src: string
  width?: number
  from: number
  to: number
}

export const DIARY_IMAGE_SIZE = {
  minWidth: 100,
  maxWidth: 1200,
  step: 10
} as const

/** 编辑态内联图片预览占位行数（与 TextInput lineHeight 对齐） */
export const DIARY_INLINE_IMAGE_SLOT_LINES = 9
export const DIARY_INLINE_IMAGE_LINE_HEIGHT = 24
export const DIARY_INLINE_IMAGE_PREVIEW_HEIGHT =
  DIARY_INLINE_IMAGE_SLOT_LINES * DIARY_INLINE_IMAGE_LINE_HEIGHT

const IMAGE_LINE_REGEX = /^!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)\s*$/

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/g

export type InlineImageBlock = Extract<DiaryContentBlock, { type: 'image' }>

export type DiaryContentBlock =
  | { type: 'text'; content: string; from: number; to: number }
  | {
      type: 'image'
      alt: string
      src: string
      width?: number
      raw: string
      from: number
      to: number
    }

export function parseDiaryContentBlocks(content: string): DiaryContentBlock[] {
  const blocks: DiaryContentBlock[] = []
  const re = new RegExp(IMAGE_REGEX.source, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    const from = match.index
    if (from > lastIndex) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex, from),
        from: lastIndex,
        to: from
      })
    }

    const widthStr = match[3]
    const width = widthStr ? parseInt(widthStr, 10) : undefined
    blocks.push({
      type: 'image',
      alt: match[1] ?? '',
      src: match[2] ?? '',
      width: width && !isNaN(width) && width > 0 ? width : undefined,
      raw: match[0],
      from,
      to: from + match[0].length
    })
    lastIndex = from + match[0].length
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: 'text',
      content: content.slice(lastIndex),
      from: lastIndex,
      to: content.length
    })
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'text', content, from: 0, to: content.length })
  }

  return blocks
}

export function serializeDiaryContentBlocks(blocks: DiaryContentBlock[]): string {
  return blocks.map((block) => (block.type === 'text' ? block.content : block.raw)).join('')
}

export function extractDiaryAttachmentSrcs(content: string): string[] {
  const srcs = new Set<string>()
  const re = new RegExp(IMAGE_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const src = match[2]
    if (src) srcs.add(src)
  }
  return [...srcs]
}

export function getInlineImageBlocks(content: string): InlineImageBlock[] {
  return parseDiaryContentBlocks(content).filter(
    (block): block is InlineImageBlock => block.type === 'image'
  )
}

export function getLineIndexForOffset(content: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, content.length))
  if (clamped === 0) return 0
  return content.slice(0, clamped).split('\n').length - 1
}

export function isImageMarkdownLine(line: string): boolean {
  return IMAGE_LINE_REGEX.test(line)
}

/** 为缺少占位空行的旧日记补齐预览区域，避免多张图片 overlay 叠在一起 */
export function ensureInlineImagePreviewSlots(content: string): string {
  const re = new RegExp(IMAGE_REGEX.source, 'g')
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    const imageEnd = match.index + match[0].length
    result += content.slice(lastIndex, imageEnd)

    let pos = imageEnd
    let blankCount = 0
    while (pos < content.length && content[pos] === '\n') {
      blankCount += 1
      pos += 1
    }

    result += content.slice(imageEnd, pos)
    if (blankCount < DIARY_INLINE_IMAGE_SLOT_LINES) {
      result += '\n'.repeat(DIARY_INLINE_IMAGE_SLOT_LINES - blankCount)
    }

    lastIndex = pos
  }

  result += content.slice(lastIndex)
  return result
}

/** 编辑态隐藏图片 Markdown 原文（等长空格），避免与预览图重叠显示 */
export function maskImageMarkdownLines(content: string): string {
  return content
    .split('\n')
    .map((line) => (isImageMarkdownLine(line) ? ' '.repeat(line.length) : line))
    .join('\n')
}

/** 将编辑后的遮罩文本合并回真实 Markdown */
export function mergeMaskedEditorContent(original: string, maskedEdited: string): string {
  if (original === maskedEdited) return original

  const origLines = original.split('\n')
  const editLines = maskedEdited.split('\n')

  if (origLines.length === editLines.length) {
    const merged: string[] = []
    for (let i = 0; i < origLines.length; i++) {
      const orig = origLines[i]!
      const edit = editLines[i]!
      if (isImageMarkdownLine(orig)) {
        if (edit === ' '.repeat(orig.length)) {
          merged.push(orig)
        }
        continue
      }
      merged.push(edit)
    }
    return merged.join('\n')
  }

  const merged: string[] = []
  let editIndex = 0
  for (let i = 0; i < origLines.length; i++) {
    const orig = origLines[i]!
    if (isImageMarkdownLine(orig)) {
      const mask = ' '.repeat(orig.length)
      while (editIndex < editLines.length && editLines[editIndex] !== mask) {
        merged.push(editLines[editIndex]!)
        editIndex += 1
      }
      if (editIndex < editLines.length && editLines[editIndex] === mask) {
        merged.push(orig)
        editIndex += 1
      }
      continue
    }

    if (editIndex < editLines.length) {
      merged.push(editLines[editIndex]!)
      editIndex += 1
    } else {
      merged.push(orig)
    }
  }

  while (editIndex < editLines.length) {
    merged.push(editLines[editIndex]!)
    editIndex += 1
  }

  return merged.join('\n')
}

/** 插入图片 Markdown 并在其后预留预览占位空行 */
export function buildInlineImageInsertSnippet(markdown: string): string {
  const trimmed = markdown.trimEnd()
  return `${trimmed}\n${'\n'.repeat(DIARY_INLINE_IMAGE_SLOT_LINES)}`
}

/** 点击图片后，将光标放到图片预览区域之后 */
export function getCursorOffsetAfterInlineImage(
  content: string,
  imageBlock: Pick<InlineImageBlock, 'from' | 'to'>
): number {
  let pos = imageBlock.to
  if (content[pos] === '\n') pos += 1
  let skipped = 0
  while (pos < content.length && content[pos] === '\n' && skipped < DIARY_INLINE_IMAGE_SLOT_LINES) {
    pos += 1
    skipped += 1
  }
  return pos
}

export function findImageAtOffset(text: string, offset: number): ParsedDiaryImage | null {
  const re = new RegExp(IMAGE_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const from = match.index
    const to = from + match[0].length
    if (offset >= from && offset <= to) {
      const widthStr = match[3]
      const width = widthStr ? parseInt(widthStr, 10) : undefined
      return {
        alt: match[1] ?? '',
        src: match[2] ?? '',
        width: width && !isNaN(width) && width > 0 ? width : undefined,
        from,
        to
      }
    }
  }
  return null
}

export function buildImageMarkdown(alt: string, src: string, width?: number): string {
  if (width !== undefined) {
    return `![${alt}](${src} | ${width})`
  }
  return `![${alt}](${src})`
}

/** 渲染前剥离宽度语法，移动端以默认尺寸显示图片 */
export function stripImageWidthInMarkdown(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(([^ |)]+)\s*\|\s*(\d+)\)/g, '![$1]($2)')
}

/** 从已解析的 img src 中去掉宽度后缀（| 283 或 ?width=283） */
export function parseImageSrcWithoutWidth(rawSrc: string): string {
  if (!rawSrc) return ''
  const decoded = rawSrc.replace(/%7C/gi, '|')
  const pipeMatch = decoded.match(/^(.+?)\s*\|\s*\d+$/)
  if (pipeMatch) return (pipeMatch[1] ?? '').trim()
  const urlMatch = rawSrc.match(/^(.+?)\?(?:.+&)?width=\d+(?:&.*)?$/)
  if (urlMatch) return urlMatch[1]!
  return rawSrc
}

export function clampImageWidth(
  width: number,
  min: number = DIARY_IMAGE_SIZE.minWidth,
  max: number = DIARY_IMAGE_SIZE.maxWidth
): number {
  return Math.max(min, Math.min(max, width))
}

export function adjustImageWidthInContent(
  text: string,
  image: ParsedDiaryImage,
  delta: number
): string {
  const current = image.width ?? DIARY_IMAGE_SIZE.maxWidth
  const next = clampImageWidth(current + delta)
  const replacement = buildImageMarkdown(image.alt, image.src, next)
  return text.slice(0, image.from) + replacement + text.slice(image.to)
}
