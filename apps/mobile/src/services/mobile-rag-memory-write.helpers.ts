import i18n from 'i18next'
import {
  buildMemoryMetadataJson,
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  type MemoryRawRecord
} from '@baishou/shared'
import { shardMonthFromInstant } from '@baishou/core-mobile'
import {
  resolveEmbeddingAdapter,
  resolveVaultScope,
  type MobileRagServiceDeps
} from './mobile-rag-core.helpers'
import {
  getMobileMemoryRawManager,
  getMobileRawDataSourceManager
} from './mobile-raw-data-source.runtime'
import { clearGraphNodeEmbeddingIfNeeded } from './mobile-rag-vector-kind.helpers'
import { HYBRID_SEARCH_TABLE, newMemoryId, type RawSqlClient } from './mobile-rag-entry.helpers'

export async function tombstoneAllMemoryShards(): Promise<void> {
  const memoryMgr = getMobileMemoryRawManager()
  if (!memoryMgr) return
  const now = Date.now()
  for (const shard of await memoryMgr.listShards()) {
    const rows = await memoryMgr.readCollapsedShard(shard.shardMonth)
    if (rows.length === 0) continue
    const tombstones = rows.map((row) => ({
      ...row,
      updatedAt: row.deletedAt != null ? row.updatedAt : now,
      deletedAt: row.deletedAt ?? now
    }))
    const content = `${tombstones.map((row) => JSON.stringify(row)).join('\n')}\n`
    await memoryMgr.replaceShardContent(shard.shardMonth, content)
  }
}

export async function editMobileRagEntry(
  deps: MobileRagServiceDeps,
  embeddingId: string,
  newText: string
): Promise<void> {
  if (!newText.trim()) return
  const adapter = await resolveEmbeddingAdapter(deps)
  if (!adapter) {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L296', '嵌入模型未配置')
    )
  }

  const client = deps.rawSqlClient as RawSqlClient
  if (!client?.execute) {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L301', '数据库不可用')
    )
  }

  const rowRes = await client.execute({
    sql: `SELECT source_type, source_id, group_id, vault_id, chunk_index, metadata_json, source_created_at FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
    args: [embeddingId]
  })
  const row = rowRes.rows?.[0] as Record<string, unknown> | undefined
  if (!row) {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L308', '记忆条目不存在')
    )
  }

  const sourceType = String(row.source_type)
  const sourceId = String(row.source_id)
  const trimmed = newText.trim()

  // 日记的向量由日记正文生成，正文是唯一事实来源。原先这里会删掉该日记的全部切片、
  // 再用被编辑的这一段重嵌，多切片日记的其余切片会一起消失；而下一次补齐又会按正文
  // 重新生成、覆盖掉这次手改。直接挡住，让用户去改日记本身。
  if (sourceType === 'diary') {
    throw new Error(
      i18n.t(
        'settings.rag_edit_diary_blocked',
        '日记的记忆片段由日记正文生成，请直接编辑对应日记，然后在记忆中心重新补齐嵌入。'
      )
    )
  }

  if (sourceType !== MEMORY_SOURCE_TYPE && sourceType !== 'manual') {
    const vaultScope = await resolveVaultScope(deps)
    const vaultId =
      String((row as { vault_id?: unknown }).vault_id ?? '').trim() ||
      (await vaultScope.resolveActiveVaultId())
    await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
    await adapter.embedText({
      text: trimmed,
      sourceType,
      sourceId,
      groupId: String(row.group_id || 'manual_edit'),
      vaultId
    })
    return
  }

  const vaultScope = await resolveVaultScope(deps)
  const vaultName = await vaultScope.resolveActiveVaultName()
  const vaultId = await vaultScope.resolveActiveVaultId()
  const rawManager = getMobileRawDataSourceManager()
  const memoryMgr = getMobileMemoryRawManager()
  const createdAtRaw = row.source_created_at
  const createdAtMs =
    typeof createdAtRaw === 'number'
      ? createdAtRaw > 1e12
        ? createdAtRaw
        : createdAtRaw * 1000
      : Date.now()
  const shardMonth = shardMonthFromInstant(createdAtMs)
  let existing: MemoryRawRecord | undefined
  if (memoryMgr) {
    const rows = await memoryMgr.readCollapsedShard(shardMonth)
    existing = rows.find((r) => r.id === sourceId && r.deletedAt == null)
    if (!existing) {
      for (const shard of await memoryMgr.listShards()) {
        const collapsed = await memoryMgr.readCollapsedShard(shard.shardMonth)
        existing = collapsed.find((r) => r.id === sourceId && r.deletedAt == null)
        if (existing) break
      }
    }
  }
  const now = Date.now()
  const createdAt = existing?.createdAt ?? createdAtMs
  const updated: MemoryRawRecord = {
    id: sourceId,
    schemaVersion: 1,
    vaultId: existing?.vaultId ?? vaultId,
    vaultName: existing?.vaultName ?? vaultName,
    content: trimmed,
    tags: existing?.tags ?? [],
    sourceSessionId: existing?.sourceSessionId ?? null,
    createdAt,
    updatedAt: now,
    deletedAt: null,
    ...(existing?.legacySourceId ? { legacySourceId: existing.legacySourceId } : {})
  }
  if (!rawManager) {
    throw new Error('RawDataSourceManager not ready')
  }
  const written = await rawManager.writeRecord('memory', updated)
  await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
  if (sourceType === 'manual') {
    await deps.hsRepo.deleteEmbeddingsBySource(MEMORY_SOURCE_TYPE, sourceId)
  }
  await adapter.embedText({
    text: trimmed,
    sourceType: MEMORY_SOURCE_TYPE,
    sourceId,
    groupId: MEMORY_EMBED_GROUP_ID,
    vaultId,
    metadataJson: buildMemoryMetadataJson(updated),
    sourceCreatedAt: createdAt
  })
  await memoryMgr?.commitIndexed(written.relativePath, written.contentHash)
}

export async function addMobileManualMemory(
  deps: MobileRagServiceDeps,
  text: string
): Promise<void> {
  const adapter = await resolveEmbeddingAdapter(deps)
  if (!adapter) {
    throw new Error(
      i18n.t('auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L321', '嵌入模型未配置')
    )
  }
  const rawManager = getMobileRawDataSourceManager()
  if (!rawManager) {
    throw new Error('RawDataSourceManager not ready')
  }
  const vaultScope = await resolveVaultScope(deps)
  const vaultName = await vaultScope.resolveActiveVaultName()
  const vaultId = await vaultScope.resolveActiveVaultId()
  const now = Date.now()
  const id = newMemoryId()
  const content = text.trim()
  const record: MemoryRawRecord = {
    id,
    schemaVersion: 1,
    vaultId,
    vaultName,
    content,
    tags: [],
    sourceSessionId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
  const written = await rawManager.writeRecord('memory', record)
  await adapter.embedText({
    text: content,
    sourceType: MEMORY_SOURCE_TYPE,
    sourceId: id,
    groupId: MEMORY_EMBED_GROUP_ID,
    vaultId,
    metadataJson: buildMemoryMetadataJson(record),
    sourceCreatedAt: now
  })
  const memoryMgr = getMobileMemoryRawManager()
  await memoryMgr?.commitIndexed(written.relativePath, written.contentHash)
}

export async function deleteMobileRagEntry(
  deps: MobileRagServiceDeps,
  embeddingId: string
): Promise<void> {
  const vaultScope = await resolveVaultScope(deps)
  const activeVaultId = await vaultScope.resolveActiveVaultId()
  if (await clearGraphNodeEmbeddingIfNeeded(embeddingId, activeVaultId)) return
  const client = deps.rawSqlClient as RawSqlClient
  if (!client?.execute) return
  const rowRes = await client.execute({
    sql: `SELECT source_type, source_id, source_created_at FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
    args: [embeddingId]
  })
  const row = rowRes.rows?.[0] as Record<string, unknown> | undefined
  if (!row) return

  const sourceType = String(row.source_type)
  const sourceId = String(row.source_id)
  if (sourceType === MEMORY_SOURCE_TYPE || sourceType === 'manual') {
    const createdAtRaw = row.source_created_at
    const createdAtMs =
      typeof createdAtRaw === 'number'
        ? createdAtRaw > 1e12
          ? createdAtRaw
          : createdAtRaw * 1000
        : undefined
    const shardMonth = createdAtMs != null ? shardMonthFromInstant(createdAtMs) : undefined
    const rawManager = getMobileRawDataSourceManager()
    try {
      await rawManager?.tombstone('memory', sourceId, { shardMonth })
    } catch {
      // legacy / already-absent
    }
    await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
    if (sourceType === 'manual') {
      await deps.hsRepo.deleteEmbeddingsBySource(MEMORY_SOURCE_TYPE, sourceId)
    }
    return
  }

  if (sourceType === 'diary') {
    const { parseDiaryEmbeddingSourceId } = await import('@baishou/shared')
    const { deleteDiaryEmbeddingAliases } = await import('./mobile-diary-embedding.util')
    const parsed = parseDiaryEmbeddingSourceId(sourceId)
    const vaultId = parsed?.vaultId?.trim() || (await vaultScope.resolveActiveVaultId())
    const diaryIdRaw = parsed?.diaryId ?? sourceId
    const diaryId = Number(diaryIdRaw)
    if (Number.isFinite(diaryId)) {
      await deleteDiaryEmbeddingAliases(deps.hsRepo, vaultId, diaryId)
    } else {
      await client.execute({
        sql: `DELETE FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ?`,
        args: [embeddingId]
      })
    }
    return
  }

  await client.execute({
    sql: `DELETE FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ?`,
    args: [embeddingId]
  })
}

export async function clearAllMobileRag(deps: MobileRagServiceDeps): Promise<void> {
  await tombstoneAllMemoryShards()
  await deps.hsRepo.clearEmbeddings()
  const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
  globalModels.globalEmbeddingDimension = 0
  await deps.settingsManager.set('global_models', globalModels)

  const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
  ragConfig.totalEmbeddings = 0
  await deps.settingsManager.set('rag_config', ragConfig)
}
