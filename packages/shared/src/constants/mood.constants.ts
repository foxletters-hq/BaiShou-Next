/** Canonical mood values stored in frontmatter / shadow index */
export const MOOD_IDS = [
  'Happy',
  'Content',
  'Peaceful',
  'Excited',
  'Grateful',
  'Reflective',
  'Melancholy',
  'Anxious',
  'Glorious'
] as const

export type MoodId = (typeof MOOD_IDS)[number]

const MOOD_EMOJI: Record<MoodId, string> = {
  Happy: '🙂',
  Content: '😊',
  Peaceful: '😌',
  Excited: '😄',
  Grateful: '💛',
  Reflective: '😐',
  Melancholy: '😔',
  Anxious: '😟',
  Glorious: '✨'
}

/** i18n key suffix under diary.mood.* */
const I18N_KEY_BY_ID: Record<MoodId, string> = {
  Happy: 'happy',
  Content: 'satisfied',
  Peaceful: 'calm',
  Excited: 'excited',
  Grateful: 'grateful',
  Reflective: 'thoughtful',
  Melancholy: 'sad',
  Anxious: 'anxious',
  Glorious: 'radiant'
}

const MOOD_LABEL_FALLBACK: Record<MoodId, string> = {
  Happy: '开心',
  Content: '满足',
  Peaceful: '平静',
  Excited: '兴奋',
  Grateful: '感恩',
  Reflective: '沉思',
  Melancholy: '忧伤',
  Anxious: '焦虑',
  Glorious: '灿烂'
}

export function normalizeMoodId(value?: string | null): string {
  if (!value) return ''
  if ((MOOD_IDS as readonly string[]).includes(value)) return value
  return value
}

export function moodI18nKey(id: MoodId): string {
  return I18N_KEY_BY_ID[id]
}

export function getMoodEmoji(id: MoodId | string): string {
  if ((MOOD_IDS as readonly string[]).includes(id)) {
    return MOOD_EMOJI[id as MoodId]
  }
  return '😶'
}

export function getMoodLabelFallback(id: MoodId): string {
  return MOOD_LABEL_FALLBACK[id]
}
