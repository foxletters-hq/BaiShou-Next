import { ipcRenderer } from 'electron'
import type {
  DeepSeekArchiveScanResult,
  DeepSeekImportProgress,
  DeepSeekImportResult,
  DeepSeekTargetAssistantInput
} from '@baishou/shared'

export interface DeepSeekImportScanPayload {
  scanToken: string
  fileName: string
  scanResult: Omit<DeepSeekArchiveScanResult, 'payloadDir'>
}

export interface DeepSeekImportExecutePayload {
  scanToken: string
  selectedSessionIds: string[]
  target: DeepSeekTargetAssistantInput
}

export const deepSeekImportApi = {
  deepseekImport: {
    pickAndScan: (locale?: string): Promise<DeepSeekImportScanPayload | null> =>
      ipcRenderer.invoke('deepseekImport:pickAndScan', locale),
    execute: (input: DeepSeekImportExecutePayload): Promise<DeepSeekImportResult> =>
      ipcRenderer.invoke('deepseekImport:execute', input),
    cleanup: (scanToken?: string | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('deepseekImport:cleanup', scanToken),
    onProgress: (callback: (progress: DeepSeekImportProgress) => void) => {
      const handler = (_: unknown, progress: DeepSeekImportProgress) => callback(progress)
      ipcRenderer.on('deepseekImport:progress', handler)
      return () => ipcRenderer.off('deepseekImport:progress', handler)
    }
  }
}
