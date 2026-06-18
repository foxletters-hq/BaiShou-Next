import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  type IVaultService,
  type VaultInfo
} from '@baishou/core-desktop'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database-desktop'
import { fileSystem, pathService, vaultService } from '../ipc/vault.ipc'
import { embeddingCallback } from '../ipc/diary-embedding.callback'
import { VaultScopedStoragePathService } from './vault-scoped-path.service'
import { DesktopStoragePathService } from './path.service'

class FixedVaultServiceStub implements IVaultService {
  constructor(
    private readonly vaultName: string,
    private readonly vaultPath: string
  ) {}

  async initRegistry(): Promise<void> {
    await vaultService.initRegistry()
  }

  getActiveVault(): VaultInfo | null {
    return {
      name: this.vaultName,
      path: this.vaultPath,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    }
  }

  getAllVaults(): VaultInfo[] {
    return vaultService.getAllVaults()
  }

  vaultExists(vaultName: string): boolean {
    return vaultService.vaultExists(vaultName)
  }

  createVault(vaultName: string): Promise<void> {
    return vaultService.createVault(vaultName)
  }

  switchVault(vaultName: string): Promise<void> {
    return vaultService.switchVault(vaultName)
  }

  deleteVault(vaultName: string): Promise<void> {
    return vaultService.deleteVault(vaultName)
  }
}

export async function getDiaryManagerForVault(vaultName: string): Promise<DiaryService> {
  const basePath = pathService as DesktopStoragePathService
  const scopedPath = new VaultScopedStoragePathService(basePath, vaultName)
  const vaultPath = await scopedPath.getActiveVaultPath()
  if (!vaultPath) {
    throw new Error(`无法解析 Vault 路径: ${vaultName}`)
  }

  if (!shadowConnectionManager.isConnected()) {
    throw new Error('Shadow DB 未连接，无法导入日记')
  }

  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultName)
  const fileSync = new FileSyncServiceImpl(scopedPath, fileSystem)
  const shadowSync = new ShadowIndexSyncService(
    shadowRepo,
    scopedPath,
    new FixedVaultServiceStub(vaultName, vaultPath),
    fileSystem,
    embeddingCallback
  )
  const vaultIndex = new VaultIndexServiceImpl()

  return new DiaryService(shadowRepo, fileSync, shadowSync, vaultIndex)
}
