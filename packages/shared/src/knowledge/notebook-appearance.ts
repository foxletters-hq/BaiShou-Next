export const NOTEBOOK_CARD_TONES = [
  'lavender',
  'cream',
  'peach',
  'mint',
  'sky',
  'rose',
  'lilac',
  'sand'
] as const

export type NotebookCardTone = (typeof NOTEBOOK_CARD_TONES)[number]

export const NOTEBOOK_CARD_ICONS = [
  '📖',
  '🧪',
  '🤝',
  '🔭',
  '💡',
  '🎯',
  '📝',
  '📂',
  '✨',
  '🧩',
  '🌊',
  '📎',
  '🧠',
  '🪐',
  '🍃',
  '🧭'
] as const

export type NotebookCardIcon = (typeof NOTEBOOK_CARD_ICONS)[number]

/** 早期 Lucide id 映射到对应 emoji，读旧记录时不丢已选图标。 */
const LEGACY_NOTEBOOK_CARD_ICONS: Record<string, NotebookCardIcon> = {
  'book-open': '📖',
  'flask-conical': '🧪',
  handshake: '🤝',
  telescope: '🔭',
  lightbulb: '💡',
  target: '🎯',
  'notebook-pen': '📝',
  'folder-open': '📂',
  sparkles: '✨',
  puzzle: '🧩',
  waves: '🌊',
  paperclip: '📎',
  brain: '🧠',
  orbit: '🪐',
  leaf: '🍃',
  compass: '🧭'
}

export const NOTEBOOK_COVER_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

export function isNotebookCardTone(value: unknown): value is NotebookCardTone {
  return typeof value === 'string' && (NOTEBOOK_CARD_TONES as readonly string[]).includes(value)
}

export function isNotebookCardIcon(value: unknown): value is NotebookCardIcon {
  return typeof value === 'string' && (NOTEBOOK_CARD_ICONS as readonly string[]).includes(value)
}

/** 非法或不存在的封面色视为未设置，列表页回退到按 id 散列。 */
export function normalizeNotebookCoverTone(value: unknown): NotebookCardTone | '' {
  return isNotebookCardTone(value) ? value : ''
}

/** 非法或不存在的封面图标视为未设置，列表页回退到按 id 散列。 */
export function normalizeNotebookCoverIcon(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('..') || /[\\/]/.test(trimmed) || trimmed.length > 24) {
    return ''
  }
  if (isNotebookCardIcon(trimmed)) return trimmed
  if (trimmed in LEGACY_NOTEBOOK_CARD_ICONS) {
    return LEGACY_NOTEBOOK_CARD_ICONS[trimmed]!
  }
  /* 现有 Emoji 选择器里的符号：拒绝 lucide id，接受普通 emoji。 */
  if (/^[a-z0-9-]+$/.test(trimmed)) return ''
  return trimmed
}

export function notebookCoverImageExt(fileName: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim())
  if (!match) return null
  const ext = match[1]!.toLowerCase()
  return (NOTEBOOK_COVER_IMAGE_EXTS as readonly string[]).includes(ext) ? ext : null
}

/** 本笔记本目录下可能出现的封面相对路径。 */
export function notebookCoverImageCandidates(notebookId: string): string[] {
  const id = notebookId.trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return []
  return NOTEBOOK_COVER_IMAGE_EXTS.map((ext) => `${id}/cover.${ext}`)
}

/** 仅允许落在本笔记本目录下的 cover.* 图片。 */
export function normalizeNotebookCoverImage(
  notebookId: string,
  value: unknown
): string {
  if (typeof value !== 'string' || !notebookId.trim()) return ''
  const norm = value.replace(/\\/g, '/').replace(/^\/+/, '')
  if (norm.includes('..')) return ''
  const expectedPrefix = `${notebookId.trim()}/cover.`
  if (!norm.startsWith(expectedPrefix)) return ''
  const ext = notebookCoverImageExt(norm)
  if (!ext) return ''
  return `${notebookId.trim()}/cover.${ext}`
}
