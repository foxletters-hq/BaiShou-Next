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

/** 旧版 TextInput overlay 方案预留的占位空行数（仅 stripLegacyInlineImageSlots 使用） */
const LEGACY_INLINE_IMAGE_SLOT_LINES = 9

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

function isImageMarkdownLine(line: string): boolean {
  return IMAGE_LINE_REGEX.test(line)
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

/** 迁移：去掉旧版内联图片预览占位的多余空行（9 行占位 → 单空行） */
export function stripLegacyInlineImageSlots(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    result.push(line)

    if (isImageMarkdownLine(line)) {
      i += 1
      let blankCount = 0
      while (i < lines.length && lines[i] === '') {
        blankCount += 1
        i += 1
      }
      if (blankCount >= LEGACY_INLINE_IMAGE_SLOT_LINES) {
        result.push('')
      } else {
        for (let j = 0; j < blankCount; j++) result.push('')
      }
      continue
    }

    i += 1
  }

  return result.join('\n')
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
