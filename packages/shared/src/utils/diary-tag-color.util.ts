/** 与日记卡片预览一致的标签配色槽位数 */
export const DIARY_TAG_COLOR_COUNT = 4

export type DiaryTagColorRegistry = Record<string, number>

/**
 * 根据标签名确定性选取配色索引（无持久化记录时的回退）。
 */
export function getDiaryTagColorIndex(tag: string): number {
  let sum = 0
  for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i)
  return sum % DIARY_TAG_COLOR_COUNT
}

export function normalizeDiaryTagColorRegistry(raw: unknown): DiaryTagColorRegistry {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return normalizeDiaryTagColorRegistry(JSON.parse(raw))
    } catch {
      return {}
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return {}

  const out: DiaryTagColorRegistry = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const tag = key.trim()
    const index = typeof value === 'number' ? value : Number(value)
    if (!tag || !Number.isInteger(index) || index < 0 || index >= DIARY_TAG_COLOR_COUNT) continue
    out[tag] = index
  }
  return out
}

export function mergeDiaryTagColorRegistries(
  ...registries: Array<DiaryTagColorRegistry | null | undefined>
): DiaryTagColorRegistry {
  return registries.reduce<DiaryTagColorRegistry>((merged, registry) => {
    if (!registry) return merged
    return { ...merged, ...registry }
  }, {})
}

export function pickDiaryTagColorIndex(exclude?: number): number {
  if (exclude === undefined) {
    return Math.floor(Math.random() * DIARY_TAG_COLOR_COUNT)
  }
  const pool = Array.from({ length: DIARY_TAG_COLOR_COUNT }, (_, i) => i).filter((i) => i !== exclude)
  return pool[Math.floor(Math.random() * pool.length)] ?? exclude
}

export function resolveDiaryTagColorIndex(
  tag: string,
  registry?: DiaryTagColorRegistry | null
): number {
  const stored = registry?.[tag]
  if (stored !== undefined && stored >= 0 && stored < DIARY_TAG_COLOR_COUNT) {
    return stored
  }
  return getDiaryTagColorIndex(tag)
}

/** 标签行变动时同步全局配色表（新标签 / 删掉再输会换色） */
export function syncDiaryTagColorRegistry(
  currentTags: string[],
  previousTags: string[],
  registry: DiaryTagColorRegistry
): DiaryTagColorRegistry {
  const next = { ...registry }
  const previous = new Set(previousTags)

  for (const tag of currentTags) {
    if (previous.has(tag)) continue
    if (tag in next) {
      next[tag] = pickDiaryTagColorIndex(next[tag])
    } else {
      next[tag] = pickDiaryTagColorIndex()
    }
  }

  return next
}

export function pickEntryTagColors(
  tags: string[],
  registry: DiaryTagColorRegistry
): DiaryTagColorRegistry {
  const out: DiaryTagColorRegistry = {}
  for (const tag of tags) {
    if (tag in registry) {
      out[tag] = registry[tag]!
    }
  }
  return out
}
