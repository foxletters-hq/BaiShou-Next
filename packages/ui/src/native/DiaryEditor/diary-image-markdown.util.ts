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

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/g

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
