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

const NOTEBOOK_CARD_ICONS = [
  '📚',
  '🔬',
  '🦀',
  '🤝',
  '🔭',
  '💡',
  '🎯',
  '📝',
  '🗂️',
  '✨',
  '🧩',
  '🌊',
  '📎',
  '🧠',
  '🔮',
  '🌿'
] as const

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getNotebookCardAppearance(id: string): {
  tone: NotebookCardTone
  icon: string
} {
  const hash = hashString(id || 'notebook')
  return {
    tone: NOTEBOOK_CARD_TONES[hash % NOTEBOOK_CARD_TONES.length],
    icon: NOTEBOOK_CARD_ICONS[(hash >>> 8) % NOTEBOOK_CARD_ICONS.length]
  }
}
