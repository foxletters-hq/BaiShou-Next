import { ipcMain } from 'electron'
import type { GraphNodeRawRecord } from '@baishou/core-desktop'
import { SettingsRepository, UserProfileRepository } from '@baishou/database-desktop'
import {
  buildGraphSelfPersonAliases,
  findGraphSelfPersonHit,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  graphDiaryInstant,
  normalizeGraphAwakenNickname
} from '@baishou/shared'
import { getAppDb } from '../db'
import { profileService } from '../services/profile.service'
import { getGraphRawManager, syncGraphPendingIndex } from '../services/raw-data-source.runtime'
import {
  parseProps,
  requireGraphRepo,
  requireVaultId,
  requireVaultName,
  writeVaultId
} from './graph-ipc.context'
import { settingsManager } from './settings.ipc'
import { resolveVaultNameById } from './vault.ipc'

export async function syncDesktopSelfPersonNodeOnRename(
  oldNickname: string | null | undefined,
  newNickname: string | null | undefined
): Promise<boolean> {
  const prev = normalizeGraphAwakenNickname(oldNickname)
  const next = normalizeGraphAwakenNickname(newNickname)
  if (!prev || !next || prev === next) return false
  try {
    const repo = requireGraphRepo()
    const vaultId = requireVaultId()
    const vaultName = requireVaultName()
    const hits = await repo.findNodesByNameOrAlias(vaultId, prev, 'person')
    const match = findGraphSelfPersonHit(hits, prev)
    if (!match) return false
    const existing = await repo.getNodeById(match.id, vaultId)
    if (!existing) return false
    const sameNameHits = await repo.findNodesByNameOrAlias(vaultId, next, 'person')
    const hasConflict = sameNameHits.some(
      (row) =>
        row.id !== existing.id && (row.discriminator ?? '') === (existing.discriminator ?? '')
    )
    if (hasConflict) return false
    const now = Date.now()
    const resolvedVaultId = writeVaultId(existing.vaultId)
    const record: GraphNodeRawRecord = {
      id: existing.id,
      schemaVersion: 1,
      vaultId: resolvedVaultId,
      vaultName: resolveVaultNameById(resolvedVaultId) || vaultName,
      nodeType: existing.nodeType || 'person',
      name: next,
      discriminator: existing.discriminator ?? '',
      aliases: buildGraphSelfPersonAliases(existing.aliases, prev, next),
      summary: existing.summary ?? '',
      props: parseProps(existing.propsJson),
      mentionCount: existing.mentionCount ?? 0,
      firstSeenAt: existing.firstSeenAt ?? now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: existing.shardMonth || graphDiaryInstant(null, now).shardMonth,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'approved'
    }
    await getGraphRawManager().writeRecord(record, { collection: 'nodes' })
    await syncGraphPendingIndex()
    return true
  } catch (e) {
    console.warn('[ProfileIPC] syncDesktopSelfPersonNodeOnRename failed', e)
    return false
  }
}

async function applyProfileSaveAndSync(diff: any) {
  const db = getAppDb()
  const repo = new UserProfileRepository(db)
  const current = await repo.getProfile()
  const oldNickname = current?.nickname
  const updated = { ...current, ...diff }
  await profileService.processProfileInput(updated)
  await repo.saveProfile(updated)
  if (normalizeGraphAwakenNickname(updated?.nickname)) {
    const settingsRepo = new SettingsRepository(db)
    await settingsRepo.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
  }
  await settingsManager.flushToDisk()
  await syncDesktopSelfPersonNodeOnRename(oldNickname, updated?.nickname)
  return await profileService.mapProfileOutput(updated)
}

export function registerProfileIPC() {
  ipcMain.handle('profile:get-all', async () => {
    const repo = new UserProfileRepository(getAppDb())
    const raw = await repo.getProfile()
    return await profileService.mapProfileOutput(raw)
  })

  ipcMain.handle('profile:save', async (_, diff: any) => {
    return await applyProfileSaveAndSync(diff)
  })

  ipcMain.handle('profile:update', async (_, diff: any) => {
    return await applyProfileSaveAndSync(diff)
  })

  ipcMain.handle('profile:pick-avatar', async () => {
    return await profileService.pickAndSaveAvatar()
  })

  ipcMain.handle('profile:pick-background', async () => {
    return await profileService.pickAndSaveBackground()
  })
}
