import type { AgentDbRuntime } from './mobile-agent-db-runtime'
import { logger } from '@baishou/shared'

export async function resyncAgentDbCachesFromDisk(options: {
  runtime: AgentDbRuntime
  activeVaultName?: string
  maxSessionJsonReadBytes: number
}): Promise<void> {
  const { runtime, activeVaultName, maxSessionJsonReadBytes } = options
  const resyncOptions = { maxSessionJsonReadBytes, activeVaultName }
  const resyncErrors: string[] = []

  try {
    await runtime.assistantManager.fullResyncFromDisks(resyncOptions)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[AgentDbRecovery] assistant fullResyncFromDisks failed:', e as Error)
    resyncErrors.push(`assistant: ${message}`)
  }

  try {
    await runtime.sessionManager.fullResyncFromDisks(resyncOptions)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[AgentDbRecovery] session fullResyncFromDisks failed:', e as Error)
    resyncErrors.push(`session: ${message}`)
  }

  try {
    await runtime.summarySyncService.fullScanArchives({ activeVaultName })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[AgentDbRecovery] summary fullScanArchives failed:', e as Error)
    resyncErrors.push(`summary: ${message}`)
  }

  try {
    await runtime.settingsManager.fullResyncFromDisk()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[AgentDbRecovery] settings fullResyncFromDisk failed:', e as Error)
    resyncErrors.push(`settings: ${message}`)
  }

  if (resyncErrors.length > 0) {
    throw new Error(`磁盘重同步未完全成功 (${resyncErrors.join('; ')})`)
  }
}
