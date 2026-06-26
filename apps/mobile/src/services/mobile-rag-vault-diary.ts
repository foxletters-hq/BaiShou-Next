import { ShadowIndexRepository } from '@baishou/database'
import type { AppDatabase } from '@baishou/database'
import {
  formatDiaryPreviewText,
  parseDateStr,
  type DiaryMeta
} from '@baishou/shared'

type ShadowListRow = Awaited<ReturnType<ShadowIndexRepository['listAllWithFTS']>>[number]
type ShadowDetailRow = Awaited<ReturnType<ShadowIndexRepository['findByIds']>>[number]

function mapShadowRowToMeta(s: ShadowListRow): DiaryMeta {
  const parsedTags = s.tagsStr
    .split(',')
    .map((t: string) => t.trim())
    .filter(Boolean)
  const rawContent = s.rawContent ?? ''

  return {
    id: s.id,
    date: parseDateStr(String(s.date).split('T')[0]!),
    preview: formatDiaryPreviewText(rawContent ? rawContent.substring(0, 500) : ''),
    tags: parsedTags,
    updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
    weather: s.weather ?? undefined,
    mood: s.mood ?? undefined,
    location: s.location ?? undefined,
    isFavorite: s.isFavorite,
    hasMedia: s.hasMedia
  }
}

export type VaultDiaryEmbedRow = {
  id: number
  content: string
  date: Date
  updatedAt?: Date
}

export async function listVaultDiaryMetas(
  shadowDb: AppDatabase,
  vaultName: string,
  limit = 10000
): Promise<DiaryMeta[]> {
  const repo = new ShadowIndexRepository(shadowDb, vaultName)
  const rows = await repo.listAllWithFTS({ limit })
  return rows.map(mapShadowRowToMeta)
}

export async function loadVaultDiariesForEmbedding(
  shadowDb: AppDatabase,
  vaultName: string,
  ids: number[]
): Promise<Map<number, VaultDiaryEmbedRow>> {
  const result = new Map<number, VaultDiaryEmbedRow>()
  if (ids.length === 0) return result

  const repo = new ShadowIndexRepository(shadowDb, vaultName)
  const rows = await repo.findByIds(ids)
  for (const shadow of rows as ShadowDetailRow[]) {
    const content = shadow.rawContent?.trim()
    if (!content) continue
    const dateStr = String(shadow.date).split('T')[0]!
    result.set(shadow.id, {
      id: shadow.id,
      content,
      date: parseDateStr(dateStr),
      updatedAt: shadow.updatedAt ? new Date(shadow.updatedAt) : undefined
    })
  }
  return result
}
