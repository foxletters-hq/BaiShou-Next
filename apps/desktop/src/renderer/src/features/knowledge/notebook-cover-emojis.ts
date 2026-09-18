import { i18n } from '@baishou/shared'

export const NOTEBOOK_COVER_EMOJI_GROUPS: Array<{ keysKey: string; items: string[] }> = [
  {
    keysKey: 'knowledge.cover_emoji_keys_face',
    items: ['😀', '😃', '😄', '😁', '😊', '😉', '😍', '🤩', '😎', '🤓', '🧐', '🤔', '🫡', '😴']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_heart',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '⭐', '🌟', '✨', '⚡']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_hand',
    items: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '👊', '💪', '🙏']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_office',
    items: ['📚', '📖', '📝', '📒', '📎', '📌', '📁', '📂', '💼', '🖥️', '💻', '⌨️', '🖱️', '🧮']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_science',
    items: ['🧪', '🔬', '🔭', '🧬', '💊', '🧠', '💡', '🔮']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_nature',
    items: ['🌿', '🍃', '🍀', '🌸', '🌼', '🌻', '🌈', '🌊', '🔥', '❄️', '🌙', '☀️']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_animal',
    items: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🐝']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_food',
    items: ['🍎', '🍋', '🍇', '🍓', '🍑', '🥑', '🌽', '🍞', '🧀', '☕', '🍵', '🍩']
  },
  {
    keysKey: 'knowledge.cover_emoji_keys_activity',
    items: ['🎯', '🧩', '🎲', '🎮', '🎨', '🎬', '🎵', '🏆', '🚀', '✈️', '🏡', '🗺️', '🧭', '🪐']
  }
]

export function listNotebookCoverEmojis(query = ''): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of NOTEBOOK_COVER_EMOJI_GROUPS) {
    const keys = i18n.t(group.keysKey)
    const groupHit = !q || keys.toLowerCase().includes(q)
    for (const emoji of group.items) {
      if (seen.has(emoji)) continue
      if (!groupHit && !emoji.includes(q)) continue
      seen.add(emoji)
      out.push(emoji)
    }
  }
  return out
}
