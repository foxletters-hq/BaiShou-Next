import {
  NOTEBOOK_CARD_ICONS,
  NOTEBOOK_CARD_TONES,
  isNotebookCardTone,
  normalizeNotebookCoverIcon,
  type NotebookCardIcon,
  type NotebookCardTone
} from '@baishou/shared'

export {
  NOTEBOOK_CARD_ICONS,
  NOTEBOOK_CARD_TONES,
  isNotebookCardTone,
  type NotebookCardIcon,
  type NotebookCardTone
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getNotebookCardAppearance(
  id: string,
  cover?: { coverTone?: string | null; coverIcon?: string | null }
): {
  tone: NotebookCardTone
  icon: string
} {
  const hash = hashString(id || 'notebook')
  return {
    tone: isNotebookCardTone(cover?.coverTone)
      ? cover.coverTone
      : NOTEBOOK_CARD_TONES[hash % NOTEBOOK_CARD_TONES.length],
    icon:
      normalizeNotebookCoverIcon(cover?.coverIcon) ||
      NOTEBOOK_CARD_ICONS[(hash >>> 8) % NOTEBOOK_CARD_ICONS.length]
  }
}
