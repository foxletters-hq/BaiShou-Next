import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import extract from 'extract-zip'
import {
  createNodeFileSystem,
  importDeepSeekSessions,
  scanDeepSeekExtractedArchive,
  type DeepSeekArchiveScanResult,
  type DeepSeekImportProgress,
  type DeepSeekImportResult,
  type DeepSeekTargetAssistantInput,
  type IFileSystem
} from '@baishou/core-desktop'
import { deriveLegacyVaultId, logger, translateMain } from '@baishou/shared'

export interface DesktopDeepSeekScanPayload {
  scanToken: string
  fileName: string
  scanResult: Omit<DeepSeekArchiveScanResult, 'payloadDir'>
}

export interface DesktopDeepSeekExecuteInput {
  scanToken: string
  selectedSessionIds: string[]
  target: DeepSeekTargetAssistantInput
}

interface ActiveScanEntry {
  extractDir: string
  scanResult: DeepSeekArchiveScanResult
}

export interface DesktopDeepSeekImportDeps {
  fileSystem: IFileSystem
  getTempBaseDir: () => string
  extractZip: (zipPath: string, targetDir: string) => Promise<void>
  getRuntimeContext: () => Promise<{
    vaultId: string
    vaultName: string
    attachmentsBaseDir: string | null
    sessionRepo: Parameters<typeof importDeepSeekSessions>[0]['sessionRepo']
    sessionManager: Parameters<typeof importDeepSeekSessions>[0]['sessionManager']
    assistantManager: Parameters<typeof importDeepSeekSessions>[0]['assistantManager']
  }>
  broadcastDataChanged: () => void
}

async function defaultRuntimeContext(): Promise<
  Awaited<ReturnType<DesktopDeepSeekImportDeps['getRuntimeContext']>>
> {
  const [{ getAgentManagers }, { pathService, resolveActiveVaultId, vaultService }] =
    await Promise.all([import('../ipc/agent-managers'), import('../ipc/vault.ipc')])

  const managers = getAgentManagers()
  const activeVault = vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id || resolveActiveVaultId() || deriveLegacyVaultId(vaultName)

  let attachmentsBaseDir: string | null = null
  try {
    attachmentsBaseDir = await pathService.getAttachmentsBaseDirectory()
  } catch (error) {
    logger.warn('[DesktopDeepSeekImport] resolve attachments directory failed', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return {
    vaultId,
    vaultName,
    attachmentsBaseDir,
    sessionRepo: managers.realSessionRepo,
    sessionManager: managers.sessionManager,
    assistantManager: managers.assistantManager
  }
}

function defaultBroadcastDataChanged(): void {
  void import('electron')
    .then(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('diary:sync-event', { type: 'vault-resync-complete' })
        }
      }
    })
    .catch(() => {
      // 非 Electron 运行时（如单元测试）静默跳过广播
    })
}

function defaultTempBaseDir(): string {
  return os.tmpdir()
}

export class DesktopDeepSeekImportService {
  private readonly scans = new Map<string, ActiveScanEntry>()
  private readonly deps: DesktopDeepSeekImportDeps

  constructor(overrides?: Partial<DesktopDeepSeekImportDeps>) {
    this.deps = {
      fileSystem: overrides?.fileSystem ?? createNodeFileSystem(),
      getTempBaseDir: overrides?.getTempBaseDir ?? defaultTempBaseDir,
      extractZip:
        overrides?.extractZip ??
        (async (zipPath, targetDir) => {
          await extract(zipPath, { dir: targetDir })
        }),
      getRuntimeContext: overrides?.getRuntimeContext ?? defaultRuntimeContext,
      broadcastDataChanged: overrides?.broadcastDataChanged ?? defaultBroadcastDataChanged
    }
  }

  public async scanZip(zipFilePath: string): Promise<DesktopDeepSeekScanPayload> {
    // 单页一次只保留当前扫描会话，先回收旧临时目录防止磁盘残留
    await this.cleanupAll()

    const extractDir = path.join(
      this.deps.getTempBaseDir(),
      `baishou_deepseek_import_${Date.now()}_${randomUUID().slice(0, 8)}`
    )
    await fsp.mkdir(extractDir, { recursive: true })

    try {
      await this.deps.extractZip(zipFilePath, extractDir)
      const scanResult = await scanDeepSeekExtractedArchive(this.deps.fileSystem, extractDir)
      const scanToken = randomUUID()
      this.scans.set(scanToken, { extractDir, scanResult })

      const { payloadDir: _hiddenPayloadDir, ...publicScanResult } = scanResult
      return {
        scanToken,
        fileName: path.basename(zipFilePath) || 'deepseek_data.zip',
        scanResult: publicScanResult
      }
    } catch (error) {
      await fsp.rm(extractDir, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  }

  public async executeImport(
    input: DesktopDeepSeekExecuteInput,
    onProgress?: (progress: DeepSeekImportProgress) => void
  ): Promise<DeepSeekImportResult> {
    const entry = this.scans.get(input.scanToken)
    if (!entry) {
      throw new Error(
        translateMain(
          undefined,
          'deepseek_import.error_service_unavailable',
          'Scan session expired. Please choose the DeepSeek export ZIP again.'
        )
      )
    }

    const runtime = await this.deps.getRuntimeContext()
    const result = await importDeepSeekSessions(
      {
        fileSystem: this.deps.fileSystem,
        sessionRepo: runtime.sessionRepo,
        sessionManager: runtime.sessionManager,
        assistantManager: runtime.assistantManager
      },
      {
        scanResult: entry.scanResult,
        selectedSessionIds: input.selectedSessionIds,
        target: input.target,
        vaultId: runtime.vaultId,
        vaultName: runtime.vaultName,
        attachmentsBaseDir: runtime.attachmentsBaseDir,
        onProgress
      }
    )

    if (result.importedSessions > 0 || result.createdNewAssistant) {
      this.deps.broadcastDataChanged()
    }

    await this.cleanup(input.scanToken)
    return result
  }

  public async cleanup(scanToken?: string | null): Promise<void> {
    if (!scanToken) {
      await this.cleanupAll()
      return
    }
    const entry = this.scans.get(scanToken)
    if (!entry) return
    this.scans.delete(scanToken)
    await fsp.rm(entry.extractDir, { recursive: true, force: true }).catch(() => {})
  }

  public async cleanupAll(): Promise<void> {
    const entries = [...this.scans.values()]
    this.scans.clear()
    await Promise.all(
      entries.map((entry) =>
        fsp.rm(entry.extractDir, { recursive: true, force: true }).catch(() => {})
      )
    )
  }
}

export const desktopDeepSeekImportService = new DesktopDeepSeekImportService()
