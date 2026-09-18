import type { IFileSystem } from '@baishou/core-mobile'
import type {
  SyncManifest,
  S3SyncConfig,
  ManifestEntry,
  IncrementalSyncStorageHistory,
  LastRemoteVaultsSnapshot
} from '@baishou/shared'
import {
  createEmptySyncManifest,
  getIncrementalSyncStorageId,
  normalizeSyncManifest,
  reconcileSyncManifestRemovedWithRemoteFiles,
  resolveIncrementalSyncStorageHistory,
  upsertManifestPathEntries,
  parseLastRemoteVaultsSnapshot,
  serializeLastRemoteVaultsSnapshot,
  parseVaultIdToNameMap,
  createEmptyLastRemoteVaultsSnapshot,
  SYNC_MANIFEST_FILENAME
} from '@baishou/shared'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { md5HexForSyncFile } from './mobile-sync-file-md5.util'
import { joinIncrementalPath } from './mobile-incremental-engine-path.util'

export type IncrementalEngineIoHost = {
  fileSystem: IFileSystem
  deviceId: string
}

export function emptyIncrementalManifest(deviceId: string): SyncManifest {
  return createEmptySyncManifest(deviceId)
}

export function mergeIncrementalManifestFileCaches(
  deviceId: string,
  ...sources: Array<SyncManifest | null | undefined>
): SyncManifest {
  const merged = emptyIncrementalManifest(deviceId)
  for (const source of sources) {
    if (!source?.files) continue
    Object.assign(merged.files, source.files)
  }
  return merged
}

export async function saveIncrementalLocalManifest(
  host: IncrementalEngineIoHost,
  metaDir: string,
  manifestPath: string,
  manifest: SyncManifest
): Promise<void> {
  if (!(await host.fileSystem.exists(metaDir))) {
    await host.fileSystem.mkdir(metaDir, { recursive: true })
  }
  await host.fileSystem.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}

export async function readIncrementalLocalManifestFile(
  host: IncrementalEngineIoHost,
  manifestPath: string
): Promise<SyncManifest> {
  if (!(await host.fileSystem.exists(manifestPath))) {
    return emptyIncrementalManifest(host.deviceId)
  }
  const raw = await host.fileSystem.readFile(manifestPath)
  return JSON.parse(raw) as SyncManifest
}

export async function fetchRemoteManifestLight(
  host: IncrementalEngineIoHost,
  config: S3SyncConfig,
  syncRoot: string
): Promise<SyncManifest> {
  const client = new MobileIncrementalCloudClient(config, host.fileSystem)
  client.setVaultPath(syncRoot)
  const rel = `.baishou/${SYNC_MANIFEST_FILENAME}`
  const temp = `${getAppCacheDirectory()}temp-remote-scopes-${Date.now()}.json`
  try {
    await client.downloadFile(rel, temp)
    const raw = await host.fileSystem.readFile(temp)
    return normalizeSyncManifest(JSON.parse(raw) as SyncManifest)
  } catch {
    return emptyIncrementalManifest(host.deviceId)
  } finally {
    await host.fileSystem.unlink(temp).catch(() => {})
  }
}

export async function getIncrementalSyncStorageHistoryState(
  host: IncrementalEngineIoHost,
  config: S3SyncConfig,
  storageIdPath: string
): Promise<IncrementalSyncStorageHistory> {
  if (!(await host.fileSystem.exists(storageIdPath))) {
    return 'none'
  }
  try {
    const savedId = (await host.fileSystem.readFile(storageIdPath)).trim()
    return resolveIncrementalSyncStorageHistory(savedId, config)
  } catch {
    return 'mismatch'
  }
}

export async function loadIncrementalRemoteSnapshot(
  host: IncrementalEngineIoHost,
  config: S3SyncConfig,
  snapshotPath: string,
  storageIdPath: string
): Promise<SyncManifest> {
  if (!(await host.fileSystem.exists(snapshotPath))) {
    return emptyIncrementalManifest(host.deviceId)
  }

  const currentStorageId = getIncrementalSyncStorageId(config)
  if (await host.fileSystem.exists(storageIdPath)) {
    try {
      const savedId = (await host.fileSystem.readFile(storageIdPath)).trim()
      if (savedId !== currentStorageId) {
        return emptyIncrementalManifest(host.deviceId)
      }
    } catch {
      return emptyIncrementalManifest(host.deviceId)
    }
  } else {
    return emptyIncrementalManifest(host.deviceId)
  }

  try {
    return JSON.parse(await host.fileSystem.readFile(snapshotPath)) as SyncManifest
  } catch {
    return emptyIncrementalManifest(host.deviceId)
  }
}

export async function saveIncrementalRemoteSnapshot(
  host: IncrementalEngineIoHost,
  manifest: SyncManifest,
  config: S3SyncConfig,
  metaDir: string,
  snapshotPath: string,
  storageIdPath: string
): Promise<void> {
  if (!(await host.fileSystem.exists(metaDir))) {
    await host.fileSystem.mkdir(metaDir, { recursive: true })
  }
  await host.fileSystem.writeFile(snapshotPath, JSON.stringify(manifest, null, 2))
  await host.fileSystem.writeFile(storageIdPath, getIncrementalSyncStorageId(config))
}

export async function loadLocalVaultIdToNameMap(
  host: IncrementalEngineIoHost,
  syncRoot: string
): Promise<Record<string, string>> {
  const registryPath = joinIncrementalPath(syncRoot, 'vault_registry.json')
  try {
    if (!(await host.fileSystem.exists(registryPath))) return {}
    const raw = await host.fileSystem.readFile(registryPath)
    return parseVaultIdToNameMap(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function loadLastRemoteVaultsSnapshot(
  host: IncrementalEngineIoHost,
  config: S3SyncConfig,
  vaultsPath: string,
  storageIdPath: string
): Promise<LastRemoteVaultsSnapshot> {
  const empty = createEmptyLastRemoteVaultsSnapshot(0)
  if (!(await host.fileSystem.exists(vaultsPath))) return empty

  if (await host.fileSystem.exists(storageIdPath)) {
    try {
      const savedId = (await host.fileSystem.readFile(storageIdPath)).trim()
      if (savedId !== getIncrementalSyncStorageId(config)) return empty
    } catch {
      return empty
    }
  } else {
    return empty
  }

  try {
    return parseLastRemoteVaultsSnapshot(JSON.parse(await host.fileSystem.readFile(vaultsPath)))
  } catch {
    return empty
  }
}

export async function saveLastRemoteVaultsSnapshot(
  host: IncrementalEngineIoHost,
  config: S3SyncConfig,
  metaDir: string,
  vaultsPath: string,
  storageIdPath: string,
  vaults?: Record<string, string>,
  resolveLocalMap?: () => Promise<Record<string, string>>
): Promise<void> {
  if (!(await host.fileSystem.exists(metaDir))) {
    await host.fileSystem.mkdir(metaDir, { recursive: true })
  }
  const map = vaults ?? (resolveLocalMap ? await resolveLocalMap() : {})
  const snapshot = serializeLastRemoteVaultsSnapshot(map)
  await host.fileSystem.writeFile(vaultsPath, JSON.stringify(snapshot, null, 2))
  if (!(await host.fileSystem.exists(storageIdPath))) {
    await host.fileSystem.writeFile(storageIdPath, getIncrementalSyncStorageId(config))
  }
}

export async function getIncrementalRemoteManifest(
  host: IncrementalEngineIoHost,
  client: MobileIncrementalCloudClient,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<SyncManifest> {
  onProgress?.(0, 0, '')
  const files = await client.listFiles()
  const actualFilesSet = new Set(files.map((f) => f.filename.replace(/\\/g, '/')))
  const hit = files.find(
    (f) =>
      f.filename === SYNC_MANIFEST_FILENAME ||
      f.filename.endsWith(`/${SYNC_MANIFEST_FILENAME}`) ||
      f.filename.endsWith(`.baishou/${SYNC_MANIFEST_FILENAME}`)
  )
  if (!hit) {
    return emptyIncrementalManifest(host.deviceId)
  }
  const temp = `${getAppCacheDirectory()}temp-remote-${Date.now()}.json`
  await client.downloadFile(hit.filename, temp)
  const raw = await host.fileSystem.readFile(temp)
  await host.fileSystem.unlink(temp)
  const manifest = normalizeSyncManifest(JSON.parse(raw) as SyncManifest)

  if (manifest.files) {
    const cleanFiles: Record<string, ManifestEntry> = {}
    for (const [relPath, entry] of Object.entries(manifest.files)) {
      const normalizedPath = relPath.replace(/\\/g, '/')
      if (actualFilesSet.has(normalizedPath)) {
        cleanFiles[normalizedPath] = entry
      }
    }
    manifest.files = cleanFiles
    return reconcileSyncManifestRemovedWithRemoteFiles(manifest, actualFilesSet)
  }

  return manifest
}

export async function refreshIncrementalCheckpointForPaths(options: {
  host: IncrementalEngineIoHost
  config: S3SyncConfig
  relPaths: string[]
  syncRoot: string
  resolveSyncFullPath: (syncRoot: string, relPath: string) => Promise<string>
  readLocalManifest: () => Promise<SyncManifest>
  loadRemoteSnapshot: () => Promise<SyncManifest>
  saveLocalManifest: (manifest: SyncManifest) => Promise<void>
  saveRemoteSnapshot: (manifest: SyncManifest) => Promise<void>
  flushRemoteManifest: () => Promise<void>
}): Promise<void> {
  const unique = [...new Set(options.relPaths.map((p) => p.replace(/\\/g, '/')).filter(Boolean))]
  if (unique.length === 0) return

  const updates: Record<string, ManifestEntry | null> = {}
  for (const relPath of unique) {
    const fullPath = await options.resolveSyncFullPath(options.syncRoot, relPath)
    const exists = await options.host.fileSystem.exists(fullPath)
    if (!exists) {
      updates[relPath] = null
      continue
    }
    const stat = await options.host.fileSystem.stat(fullPath).catch(() => null)
    if (!stat?.isFile) {
      updates[relPath] = null
      continue
    }
    const hash = await md5HexForSyncFile(options.host.fileSystem, fullPath)
    updates[relPath] = {
      hash,
      size: stat.size ?? 0,
      lastModified: stat.mtimeMs ?? Date.now()
    }
  }

  const local = await options.readLocalManifest()
  const ancestor = await options.loadRemoteSnapshot()
  await options.saveLocalManifest(upsertManifestPathEntries(local, updates))
  await options.saveRemoteSnapshot(upsertManifestPathEntries(ancestor, updates))
  await options.flushRemoteManifest()
  console.warn('[IncrementalSync][Checkpoint] refreshCheckpointForPaths', {
    pathCount: unique.length,
    paths: unique.slice(0, 8)
  })
}
