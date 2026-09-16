import { ShadowIndexRepository } from '@baishou/database'
import type { AppDatabase } from '@baishou/database'
import {
  parseDateStr,
  resolveDiaryTagsFromSources,
  toDiaryEmbedDetectionRow,
  type DiaryEmbedDetectionRow
} from '@baishou/shared'

type ShadowDetailRow = Awaited<ReturnType<ShadowIndexRepository['findByIds']>>[number]

export type VaultDiaryEmbedRow = {
  id: number
  content: string
  date: Date
  updatedAt?: Date
  tags?: string[]
}

export async function listVaultDiaryMetas(
  shadowDb: AppDatabase,
  vaultId: string
): Promise<DiaryEmbedDetectionRow[]> {
  const repo = new ShadowIndexRepository(shadowDb, vaultId)
  const rows = await repo.listForEmbedDetection()
  return rows.map((row) => toDiaryEmbedDetectionRow(row))
}

export async function loadVaultDiariesForEmbedding(
  shadowDb: AppDatabase,
  vaultId: string,
  ids: number[]
): Promise<Map<number, VaultDiaryEmbedRow>> {
  const result = new Map<number, VaultDiaryEmbedRow>()
  if (ids.length === 0) return result

  const repo = new ShadowIndexRepository(shadowDb, vaultId)
  const rows = await repo.findByIds(ids)
  for (const shadow of rows as ShadowDetailRow[]) {
    const content = shadow.rawContent?.trim()
    if (!content) continue
    const dateStr = String(shadow.date).split('T')[0]!
    const tags = resolveDiaryTagsFromSources(shadow.tags ?? '', content)
    result.set(shadow.id, {
      id: shadow.id,
      content,
      date: parseDateStr(dateStr),
      updatedAt: shadow.updatedAt ? new Date(shadow.updatedAt) : undefined,
      tags
    })
  }
  return result
}
