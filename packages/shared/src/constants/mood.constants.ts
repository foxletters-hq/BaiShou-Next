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

/** Legacy / demo Chinese labels → canonical id */
const MOOD_LABEL_TO_ID: Record<string, MoodId> = Object.fromEntries(
  MOOD_IDS.map((id) => [MOOD_LABEL_FALLBACK[id], id])
) as Record<string, MoodId>

/** Fallback emoji → canonical id */
const MOOD_EMOJI_TO_ID: Record<string, MoodId> = Object.fromEntries(
  MOOD_IDS.map((id) => [MOOD_EMOJI[id], id])
) as Record<string, MoodId>

/** English aliases → canonical id */
const MOOD_ALIASES: Record<string, MoodId> = {
  happy: 'Happy',
  content: 'Content',
  peaceful: 'Peaceful',
  calm: 'Peaceful',
  excited: 'Excited',
  grateful: 'Grateful',
  reflective: 'Reflective',
  thoughtful: 'Reflective',
  melancholy: 'Melancholy',
  sad: 'Melancholy',
  anxious: 'Anxious',
  glorious: 'Glorious',
  radiant: 'Glorious'
}

function storedVariantsForMoodId(canonical: MoodId): string[] {
  const variants = new Set<string>([canonical, MOOD_EMOJI[canonical]])
  for (const [label, id] of Object.entries(MOOD_LABEL_TO_ID)) {
    if (id === canonical) variants.add(label)
  }
  for (const [alias, id] of Object.entries(MOOD_ALIASES)) {
    if (id === canonical) variants.add(alias)
  }
  return [...variants]
}

/** Normalize stored mood to canonical id (or passthrough unknown). */
export function normalizeMoodId(value?: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if ((MOOD_IDS as readonly string[]).includes(trimmed)) return trimmed
  const fromEmoji = MOOD_EMOJI_TO_ID[trimmed]
  if (fromEmoji) return fromEmoji
  const alias = MOOD_ALIASES[trimmed] ?? MOOD_ALIASES[trimmed.toLowerCase()]
  if (alias) return alias
  const fromLabel = MOOD_LABEL_TO_ID[trimmed]
  if (fromLabel) return fromLabel
  return trimmed
}

/** Resolve to canonical MoodId, or null when unknown. */
export function resolveMoodId(value?: string | null): MoodId | null {
  const id = normalizeMoodId(value)
  if (!id || !(MOOD_IDS as readonly string[]).includes(id)) return null
  return id as MoodId
}

export function normalizeMoodIdForFilter(value?: string | null): MoodId | null {
  return resolveMoodId(value)
}

/** All values that should match a filter chip (canonical + legacy labels/aliases). */
export function expandMoodFilterValues(filterIds: string[]): string[] {
  const expanded = new Set<string>()
  for (const id of filterIds) {
    const canonical = resolveMoodId(id)
    if (!canonical) continue
    for (const variant of storedVariantsForMoodId(canonical)) {
      expanded.add(variant)
    }
  }
  return [...expanded]
}

export function moodMatchesFilter(
  storedMood: string | undefined | null,
  filterIds: string[]
): boolean {
  if (filterIds.length === 0) return true
  if (!storedMood) return false
  const expanded = expandMoodFilterValues(filterIds)
  const normalized = resolveMoodId(storedMood)
  if (!normalized) return false
  return expanded.includes(storedMood) || expanded.includes(normalized)
}

export function moodI18nKey(id: MoodId): string {
  return I18N_KEY_BY_ID[id]
}

export function getMoodEmoji(id: MoodId | string): string {
  const resolved = resolveMoodId(id)
  if (resolved) return MOOD_EMOJI[resolved]
  return '😶'
}

export function getMoodLabelFallback(id: MoodId): string {
  return MOOD_LABEL_FALLBACK[id]
}
