export const NOTEBOOK_COVER_EMOJI_GROUPS: Array<{ keys: string; items: string[] }> = [
  {
    keys: '表情 face smile 笑',
    items: ['😀', '😃', '😄', '😁', '😊', '😉', '😍', '🤩', '😎', '🤓', '🧐', '🤔', '🫡', '😴']
  },
  {
    keys: '爱心 heart 星 star',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '⭐', '🌟', '✨', '⚡']
  },
  {
    keys: '手势 hand 赞',
    items: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '👊', '💪', '🙏']
  },
  {
    keys: '办公 office 笔记 book 学习',
    items: ['📚', '📖', '📝', '📒', '📎', '📌', '📁', '📂', '💼', '🖥️', '💻', '⌨️', '🖱️', '🧮']
  },
  {
    keys: '研究 science 实验',
    items: ['🧪', '🔬', '🔭', '🧬', '💊', '🧠', '💡', '🔮']
  },
  {
    keys: '自然 nature 植物',
    items: ['🌿', '🍃', '🍀', '🌸', '🌼', '🌻', '🌈', '🌊', '🔥', '❄️', '🌙', '☀️']
  },
  {
    keys: '动物 animal',
    items: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🐝']
  },
  {
    keys: '食物 food',
    items: ['🍎', '🍋', '🍇', '🍓', '🍑', '🥑', '🌽', '🍞', '🧀', '☕', '🍵', '🍩']
  },
  {
    keys: '活动 activity 旅行 travel',
    items: ['🎯', '🧩', '🎲', '🎮', '🎨', '🎬', '🎵', '🏆', '🚀', '✈️', '🏡', '🗺️', '🧭', '🪐']
  }
]

export function listNotebookCoverEmojis(query = ''): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of NOTEBOOK_COVER_EMOJI_GROUPS) {
    const groupHit = !q || group.keys.toLowerCase().includes(q)
    for (const emoji of group.items) {
      if (seen.has(emoji)) continue
      if (!groupHit && !emoji.includes(q)) continue
      seen.add(emoji)
      out.push(emoji)
    }
  }
  return out
}
