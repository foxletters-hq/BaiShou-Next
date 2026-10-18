import { eq, inArray, sql } from 'drizzle-orm'
import { deriveLegacyVaultId } from '@baishou/shared'
import { shadowJournalIndexTable } from './schema/shadow-index'
import type { AppDatabase } from './types'

export function collectShadowJournalVaultKeysToAlign(vault: {
  id: string
  name: string
}): string[] {
  const id = vault.id.trim()
  const name = vault.name.trim()
  if (!id) return []

  const keys = new Set<string>()
  if (name && name !== id) keys.add(name)
  if (name) {
    const legacy = deriveLegacyVaultId(name)
    if (legacy && legacy !== id) keys.add(legacy)
  }
  return [...keys]
}

async function deleteShadowJournalFtsRows(database: AppDatabase, ids: number[]): Promise<void> {
  for (const id of ids) {
    try {
      await database.run(sql`DELETE FROM journals_fts WHERE rowid = ${id}`)
    } catch {
      // FTS 可能未建或驱动不支持，主表删除仍有效
    }
  }
}

export async function rekeyShadowJournalVaultId(
  database: AppDatabase,
  fromVaultId: string,
  toVaultId: string
): Promise<number> {
  if (!fromVaultId || !toVaultId || fromVaultId === toVaultId) return 0

  const fromRows = await database
    .select({
      id: shadowJournalIndexTable.id,
      filePath: shadowJournalIndexTable.filePath
    })
    .from(shadowJournalIndexTable)
    .where(eq(shadowJournalIndexTable.vaultId, fromVaultId))
  if (fromRows.length === 0) return 0

  const destRows = await database
    .select({ filePath: shadowJournalIndexTable.filePath })
    .from(shadowJournalIndexTable)
    .where(eq(shadowJournalIndexTable.vaultId, toVaultId))
  const destPaths = new Set(destRows.map((row) => row.filePath))
  const conflictIds = fromRows.filter((row) => destPaths.has(row.filePath)).map((row) => row.id)

  if (conflictIds.length > 0) {
    await database
      .delete(shadowJournalIndexTable)
      .where(inArray(shadowJournalIndexTable.id, conflictIds))
    await deleteShadowJournalFtsRows(database, conflictIds)
  }

  await database
    .update(shadowJournalIndexTable)
    .set({ vaultId: toVaultId })
    .where(eq(shadowJournalIndexTable.vaultId, fromVaultId))

  return fromRows.length - conflictIds.length
}

/** 把仍按空间名或派生 id 写入的影子日记改到注册表空间 id */
export async function alignShadowJournalVaultId(
  database: AppDatabase,
  vault: { id: string; name: string }
): Promise<number> {
  const fromKeys = collectShadowJournalVaultKeysToAlign(vault)
  if (!vault.id.trim() || fromKeys.length === 0) return 0

  let moved = 0
  for (const fromVaultId of fromKeys) {
    moved += await rekeyShadowJournalVaultId(database, fromVaultId, vault.id)
  }
  return moved
}
