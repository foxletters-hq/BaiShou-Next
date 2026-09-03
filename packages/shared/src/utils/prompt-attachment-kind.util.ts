export const PROMPT_TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.json',
  '.jsonc',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.svg',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.bat',
  '.cmd',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.sql',
  '.graphql',
  '.vue',
  '.svelte',
  '.lock',
  '.gitignore',
  '.gitattributes',
  '.dockerignore',
  '.editorconfig',
  '.eslintrc',
  '.prettierrc',
  '.babelrc',
  '.npmrc',
  '.nvmrc'
])

export const PROMPT_TEXT_BASENAMES = new Set([
  'makefile',
  'dockerfile',
  'license',
  'licence',
  'copying',
  'readme',
  'changelog',
  'authors',
  'contributors',
  'gemfile',
  'rakefile',
  'procfile',
  'vagrantfile'
])

export const PROMPT_TEXT_ATTACHMENT_MAX_LINES = 2000
export const PROMPT_TEXT_ATTACHMENT_MAX_BYTES = 256 * 1024
/** 物化前最多读入的字节，避免超大文本整文件进内存 */
export const PROMPT_TEXT_ATTACHMENT_READ_MAX_BYTES = 1024 * 1024

export function isSafeWorkspaceRelativePath(relativePath: string): boolean {
  const rel = relativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!rel) return false
  return rel.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

export type PromptAttachmentKindFlags = {
  isImage: boolean
  isPdf: boolean
  isText: boolean
}

export type PromptFileSelection = {
  startLine: number
  endLine: number
}

export type PromptFileRefOrigin = 'explorer-drop' | 'mention' | 'selection' | 'comment'

export type PromptFileRef = {
  relativePath: string
  selection?: PromptFileSelection
  comment?: string
  origin?: PromptFileRefOrigin
}

function fileNameFrom(fileName: string): string {
  const trimmed = fileName.trim()
  if (!trimmed) return ''
  const parts = trimmed.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || trimmed
}

export function extensionOfFileName(fileName: string): string {
  const base = fileNameFrom(fileName)
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  if (dot === 0) return base.toLowerCase()
  return base.slice(dot).toLowerCase()
}

export function classifyPromptAttachmentKind(
  fileName: string,
  mimeType?: string
): PromptAttachmentKindFlags {
  const mime = (mimeType || '').toLowerCase()
  const base = fileNameFrom(fileName).toLowerCase()
  const ext = extensionOfFileName(fileName)
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(fileName)
  const isPdf = mime === 'application/pdf' || ext === '.pdf'
  const isText =
    !isImage &&
    !isPdf &&
    (mime === 'text/plain' ||
      mime === 'text/markdown' ||
      mime.startsWith('text/') ||
      PROMPT_TEXT_EXTENSIONS.has(ext) ||
      PROMPT_TEXT_BASENAMES.has(base) ||
      base.startsWith('.env'))
  return { isImage, isPdf, isText }
}

export function normalizePromptFileSelection(
  selection: PromptFileSelection | undefined,
  totalLines: number
): PromptFileSelection | undefined {
  if (!selection || totalLines <= 0) return undefined
  const rawStart = Number.isFinite(selection.startLine) ? selection.startLine : 1
  const rawEnd = Number.isFinite(selection.endLine) ? selection.endLine : rawStart
  const start = Math.min(rawStart, rawEnd)
  const end = Math.max(rawStart, rawEnd)
  const startLine = Math.min(Math.max(1, start), totalLines)
  const endLine = Math.min(Math.max(startLine, end), totalLines)
  return { startLine, endLine }
}

export function sliceTextBySelection(
  text: string,
  selection?: PromptFileSelection
): {
  text: string
  startLine: number
  endLine: number
  totalLines: number
} {
  const lines = text.split('\n')
  const totalLines = lines.length
  const range = normalizePromptFileSelection(selection, totalLines)
  if (!range) {
    return { text, startLine: 1, endLine: totalLines, totalLines }
  }
  return {
    text: lines.slice(range.startLine - 1, range.endLine).join('\n'),
    startLine: range.startLine,
    endLine: range.endLine,
    totalLines
  }
}

export function truncatePromptTextAttachment(text: string): {
  text: string
  truncated: boolean
  shownLines: number
  totalLines: number
} {
  const lines = text.split('\n')
  const totalLines = lines.length
  let next = text
  let truncated = false

  if (totalLines > PROMPT_TEXT_ATTACHMENT_MAX_LINES) {
    next = lines.slice(0, PROMPT_TEXT_ATTACHMENT_MAX_LINES).join('\n')
    truncated = true
  }

  if (byteLengthUtf8(next) > PROMPT_TEXT_ATTACHMENT_MAX_BYTES) {
    next = cutUtf8ToMaxBytes(next, PROMPT_TEXT_ATTACHMENT_MAX_BYTES)
    truncated = true
  }

  return {
    text: next,
    truncated,
    shownLines: next.split('\n').length,
    totalLines
  }
}

function byteLengthUtf8(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length
  }
  return unescape(encodeURIComponent(value)).length
}

function cutUtf8ToMaxBytes(value: string, maxBytes: number): string {
  if (byteLengthUtf8(value) <= maxBytes) return value
  let low = 0
  let high = value.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (byteLengthUtf8(value.slice(0, mid)) <= maxBytes) low = mid
    else high = mid - 1
  }
  return value.slice(0, low)
}

export function looksLikeBinaryText(text: string): boolean {
  return text.includes('\0')
}

export function formatPromptFileAttachmentLabel(params: {
  displayPath: string
  selection?: PromptFileSelection
  sliced?: boolean
}): string {
  if (params.selection && params.sliced) {
    if (params.selection.startLine === params.selection.endLine) {
      return `${params.displayPath} (line ${params.selection.startLine})`
    }
    return `${params.displayPath} (lines ${params.selection.startLine}-${params.selection.endLine})`
  }
  return params.displayPath
}

export function formatPromptFileCommentPreface(params: {
  displayPath: string
  selection?: PromptFileSelection
  comment: string
}): string {
  const comment = params.comment.trim()
  if (!comment) return ''
  if (params.selection) {
    if (params.selection.startLine === params.selection.endLine) {
      return `用户针对 ${params.displayPath} 第 ${params.selection.startLine} 行的评论：${comment}`
    }
    return `用户针对 ${params.displayPath} 第 ${params.selection.startLine} 至 ${params.selection.endLine} 行的评论：${comment}`
  }
  return `用户针对 ${params.displayPath} 的评论：${comment}`
}

export function formatPromptFileAttachmentBlock(params: {
  displayPath: string
  text: string
  selection?: PromptFileSelection
  comment?: string
  truncated?: boolean
  shownLines?: number
  totalLines?: number
}): string {
  const sliced = Boolean(params.selection)
  const label = formatPromptFileAttachmentLabel({
    displayPath: params.displayPath,
    selection: params.selection,
    sliced
  })
  const preface = params.comment?.trim()
    ? `${formatPromptFileCommentPreface({
        displayPath: params.displayPath,
        selection: params.selection,
        comment: params.comment
      })}\n\n`
    : '\n\n'
  const truncationNote =
    params.truncated && params.shownLines && params.totalLines
      ? `\n[Content truncated: showing first ${params.shownLines} of ${params.totalLines} lines]`
      : params.truncated
        ? '\n[Content truncated due to size limit]'
        : ''
  return `${preface}[User Uploaded File Attachment: ${label}]\n\`\`\`\n${params.text}\n\`\`\`${truncationNote}\n`
}

export function formatPromptUnsupportedAttachmentHint(displayPath: string): string {
  return `\n\n[User Uploaded File Attachment: ${displayPath}]\n（该文件不是文本、图片或 PDF，无法直接放入对话。请改用工作区工具读取，或改选文本文件。）\n`
}

export function parseFileMentionToken(raw: string): {
  relativePath: string
  selection?: PromptFileSelection
} {
  const token = raw.trim().replace(/^@/, '')
  const match = token.match(/^(.*?)(?:#L(\d+)(?:-(\d+))?)?$/i)
  if (!match) return { relativePath: token }
  const relativePath = (match[1] || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const start = match[2] ? Number(match[2]) : undefined
  const end = match[3] ? Number(match[3]) : start
  if (!relativePath) return { relativePath: token }
  if (!start || !end) return { relativePath }
  return {
    relativePath,
    selection: { startLine: Math.min(start, end), endLine: Math.max(start, end) }
  }
}

export function fileMentionBaseName(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] || relativePath
}

function formatFileMentionRangeSuffix(selection?: PromptFileSelection): string {
  if (!selection) return ''
  if (selection.startLine === selection.endLine) return `#L${selection.startLine}`
  return `#L${selection.startLine}-${selection.endLine}`
}

/** 输入框 / 气泡展示：`@文件名#L12-20` */
export function formatFileMentionLabel(params: {
  relativePath: string
  selection?: PromptFileSelection
}): string {
  return `@${fileMentionBaseName(params.relativePath)}${formatFileMentionRangeSuffix(params.selection)}`
}

/** 兼容旧消息里的 `@相对路径#L12-20` */
export function formatFileMentionPathLabel(params: {
  relativePath: string
  selection?: PromptFileSelection
}): string {
  const path = params.relativePath.replace(/\\/g, '/')
  return `@${path}${formatFileMentionRangeSuffix(params.selection)}`
}

export function fileMentionDisplayLabels(params: {
  relativePath: string
  selection?: PromptFileSelection
}): string[] {
  return [...new Set([formatFileMentionLabel(params), formatFileMentionPathLabel(params)])]
}

export function fileContextItemKey(ref: PromptFileRef): string {
  const start = ref.selection?.startLine ?? ''
  const end = ref.selection?.endLine ?? ''
  const comment = ref.comment?.trim() ? `:c=${ref.comment.trim()}` : ''
  return `file:${ref.relativePath}:${start}:${end}${comment}`
}
