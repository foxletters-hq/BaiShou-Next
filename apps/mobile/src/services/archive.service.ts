import i18n from 'i18next'
import {
  IArchiveService,
  ImportResult,
  VaultService,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { shareLocalFile } from '../utils/share-local-file.util'
import {
  assertSafeSnapshotFilename,
  type ArchiveImportProgressCallback
} from './archive-guards.util'
import type { MobileArchiveDbBridge } from './mobile-archive-db.bridge'
import { runArchiveExportToTempFile, type ArchiveExportContext } from './archive-export.helpers'
import { runArchiveImportFromZip, type ArchiveImportContext } from './archive-import.helpers'
import {
  deleteArchiveSnapshot,
  finalizeArchiveSnapshotFromExport,
  listArchiveSnapshots
} from './archive-snapshot.helpers'

export class MobileArchiveService implements IArchiveService {
  private readonly exportCtx: ArchiveExportContext
  private readonly importCtx: ArchiveImportContext

  constructor(
    pathService: IStoragePathService,
    vaultService: VaultService,
    private readonly fileSystem: IFileSystem,
    private readonly dbBridge?: MobileArchiveDbBridge
  ) {
    this.exportCtx = { pathService, fileSystem, dbBridge }
    this.importCtx = { pathService, vaultService, fileSystem, dbBridge }
  }

  public async exportToTempFile(): Promise<string | null> {
    const runQuiesced =
      this.dbBridge?.runArchiveExportQuiesced ?? ((fn: () => Promise<string | null>) => fn())

    return runQuiesced(async () => {
      if (this.dbBridge) {
        await this.dbBridge.flushBeforeExport()
      }
      return runArchiveExportToTempFile(this.exportCtx, async () => {})
    })
  }

  public async exportToUserDevice(): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) {
      throw new Error(
        i18n.t('auto.apps.mobile.src.services.archive.service.L51', '生成备份 ZIP 失败')
      )
    }

    try {
      await shareLocalFile(this.fileSystem, zipPath, {
        mimeType: 'application/zip',
        dialogTitle: i18n.t(
          'auto.apps.mobile.src.services.archive.service.L57',
          '保存 BaiShou 物理系统备份'
        ),
        UTI: 'public.zip-archive'
      })
    } finally {
      await this.fileSystem.unlink(zipPath).catch(() => {})
    }
    return null
  }

  public async importFromZip(
    zipFilePath: string,
    createSnapshotBefore: boolean = true,
    onProgress?: ArchiveImportProgressCallback
  ): Promise<ImportResult> {
    const runQuiesced =
      this.dbBridge?.runArchiveImportQuiesced ?? ((fn: () => Promise<ImportResult>) => fn())
    return runQuiesced(() =>
      runArchiveImportFromZip(
        this.importCtx,
        zipFilePath,
        createSnapshotBefore,
        (options) => this.createSnapshot(options),
        onProgress
      )
    )
  }

  public async createSnapshot(options?: { preservePaths?: string[] }): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) return null

    const maxCount = this.dbBridge ? await this.dbBridge.getMaxSnapshotCount() : 5
    return finalizeArchiveSnapshotFromExport(this.importCtx, zipPath, maxCount, [
      ...(options?.preservePaths ?? [])
    ])
  }

  public async listSnapshots(): Promise<import('@baishou/core-mobile').SnapshotMeta[]> {
    return listArchiveSnapshots(this.importCtx)
  }

  public async restoreFromSnapshot(filename: string): Promise<ImportResult> {
    assertSafeSnapshotFilename(filename)
    const snapshotDir = await this.importCtx.pathService.getSnapshotsDirectory()
    const fullPath = `${snapshotDir}/${filename}`
    if (!(await this.fileSystem.exists(fullPath))) {
      throw new Error('Snapshot not found')
    }
    return this.importFromZip(fullPath, true)
  }

  public async deleteSnapshot(filename: string): Promise<void> {
    await deleteArchiveSnapshot(this.importCtx, filename)
  }
}
