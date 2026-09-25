import {
  normalizeNotebookCoverIcon,
  normalizeNotebookCoverImage,
  normalizeNotebookCoverTone,
  notebookCoverImageExt
} from '@baishou/shared'
import type { KnowledgeIngestDeps } from './knowledge-ingest.types'
import { newId, requireVaultId, toNotebookRawRecord } from './knowledge-ingest.helpers'
import { deleteSource } from './knowledge-ingest.source'

async function removeCoverImageFile(
  deps: KnowledgeIngestDeps,
  relativePath: string
): Promise<void> {
  try {
    const abs = await deps.notebookManager.absolutePath(relativePath)
    if (await deps.fs.exists(abs)) await deps.fs.unlink(abs)
  } catch {
    /* 旧封面不在盘上时忽略 */
  }
}

export async function createNotebook(
  deps: KnowledgeIngestDeps,
  input: {
    name: string
    description?: string
    id?: string
    coverTone?: string
    coverIcon?: string
  }
): Promise<{
  id: string
  name: string
  coverTone: string
  coverIcon: string
  sortOrder: number
}> {
  const vaultId = requireVaultId(deps.getVaultId)
  const id = input.id ?? newId('nb')
  const existing = await deps.repo.listNotebooks({ vaultId })
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder ?? 0), -1) + 1
  const coverTone = normalizeNotebookCoverTone(input.coverTone)
  const coverIcon = normalizeNotebookCoverIcon(input.coverIcon)
  const created = await deps.repo.createNotebook({
    id,
    name: input.name,
    description: input.description,
    vaultId,
    sortOrder,
    coverTone,
    coverIcon
  })
  await deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(created))
  return {
    id,
    name: created.name,
    coverTone: created.coverTone,
    coverIcon: created.coverIcon,
    sortOrder: created.sortOrder
  }
}

export async function listNotebooks(deps: KnowledgeIngestDeps) {
  const vaultId = requireVaultId(deps.getVaultId)
  return deps.repo.listNotebooks({ vaultId })
}

export async function updateNotebook(
  deps: KnowledgeIngestDeps,
  input: {
    notebookId: string
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }
) {
  const vaultId = requireVaultId(deps.getVaultId)
  const existing = await deps.repo.getNotebook(input.notebookId)
  if (!existing || existing.vaultId !== vaultId) {
    throw new Error('notebook not found')
  }
  const patch: {
    name?: string
    description?: string
    coverTone?: string
    coverIcon?: string
    coverImage?: string
  } = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('notebook name is required')
    patch.name = name
  }
  if (input.description !== undefined) patch.description = input.description
  if (input.coverTone !== undefined) {
    patch.coverTone = normalizeNotebookCoverTone(input.coverTone)
  }
  if (input.coverIcon !== undefined) {
    patch.coverIcon = normalizeNotebookCoverIcon(input.coverIcon)
  }
  if (input.coverImage !== undefined) {
    patch.coverImage = normalizeNotebookCoverImage(existing.id, input.coverImage)
    if (!patch.coverImage && existing.coverImage) {
      await removeCoverImageFile(deps, existing.coverImage)
    }
  }
  if (Object.keys(patch).length === 0) return existing
  await deps.repo.updateNotebook(existing.id, patch)
  const updated = await deps.repo.getNotebook(existing.id)
  if (!updated) throw new Error('notebook missing after update')
  await deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(updated))
  return updated
}

export async function setCoverImage(
  deps: KnowledgeIngestDeps,
  input: { notebookId: string; absolutePath: string }
) {
  const vaultId = requireVaultId(deps.getVaultId)
  const existing = await deps.repo.getNotebook(input.notebookId)
  if (!existing || existing.vaultId !== vaultId) {
    throw new Error('notebook not found')
  }
  const ext = notebookCoverImageExt(input.absolutePath)
  if (!ext) throw new Error('cover image must be png, jpg, jpeg, webp or gif')
  const relativePath = normalizeNotebookCoverImage(existing.id, `${existing.id}/cover.${ext}`)
  if (!relativePath) throw new Error('invalid cover image path')
  if (existing.coverImage && existing.coverImage !== relativePath) {
    await removeCoverImageFile(deps, existing.coverImage)
  }
  await deps.notebookManager.copySourceFile(relativePath, input.absolutePath)
  await deps.repo.updateNotebook(existing.id, { coverImage: relativePath })
  const updated = await deps.repo.getNotebook(existing.id)
  if (!updated) throw new Error('notebook missing after update')
  await deps.notebookManager.appendNotebookRecord(toNotebookRawRecord(updated))
  return updated
}

export async function reorderNotebooks(deps: KnowledgeIngestDeps, orderedIds: string[]) {
  const vaultId = requireVaultId(deps.getVaultId)
  const existing = await deps.repo.listNotebooks({ vaultId })
  const byId = new Map(existing.map((row) => [row.id, row]))
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const id of orderedIds) {
    if (!byId.has(id) || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  for (const row of existing) {
    if (!seen.has(row.id)) ordered.push(row.id)
  }
  const now = Date.now()
  for (let i = 0; i < ordered.length; i++) {
    const row = byId.get(ordered[i]!)
    if (!row) continue
    await deps.repo.updateNotebook(row.id, { sortOrder: i })
    await deps.notebookManager.appendNotebookRecord(
      toNotebookRawRecord({
        ...row,
        sortOrder: i,
        updatedAt: now
      })
    )
  }
  return deps.repo.listNotebooks({ vaultId })
}

export async function deleteNotebook(deps: KnowledgeIngestDeps, notebookId: string): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const existing = await deps.repo.getNotebook(id)
  if (!existing || existing.vaultId !== vaultId) {
    throw new Error('notebook not found')
  }
  const sources = await deps.repo.listSources(id)
  for (const source of sources) {
    try {
      await deleteSource(deps, source.id)
    } catch {
      /* 单份资料删失败不拦整本删除 */
    }
  }
  const now = Date.now()
  await deps.notebookManager.appendNotebookRecord({
    ...toNotebookRawRecord({ ...existing, updatedAt: now }),
    deletedAt: now
  })
  try {
    const abs = await deps.notebookManager.absolutePath(id)
    if (await deps.fs.exists(abs)) {
      await deps.fs.rm(abs, { recursive: true, force: true })
    }
  } catch {
    /* 目录缺失不拦删除 */
  }
  await deps.repo.deleteNotebook(id)
}
