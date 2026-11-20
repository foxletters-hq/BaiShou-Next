import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { DeepSeekImportResult } from '@baishou/core-desktop'
import { logger, translateMain } from '@baishou/shared'
import {
  desktopDeepSeekImportService,
  type DesktopDeepSeekExecuteInput,
  type DesktopDeepSeekScanPayload
} from '../services/desktop-deepseek-import.service'

export function registerDeepSeekImportIPC(): void {
  ipcMain.handle(
    'deepseekImport:pickAndScan',
    async (event, locale?: string): Promise<DesktopDeepSeekScanPayload | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const picked = await dialog.showOpenDialog((win || undefined) as never, {
        title: translateMain(
          locale,
          'deepseek_import.pick_zip_button',
          'Choose DeepSeek Export ZIP'
        ),
        filters: [
          {
            name: translateMain(locale, 'settings.archive_zip_filter_name', 'ZIP Archives'),
            extensions: ['zip']
          }
        ],
        properties: ['openFile']
      })

      if (picked.canceled || !picked.filePaths[0]) {
        return null
      }

      const zipFilePath = picked.filePaths[0]
      logger.info('[DesktopDeepSeekImport] scanning selected zip', { fileName: zipFilePath })
      return desktopDeepSeekImportService.scanZip(zipFilePath)
    }
  )

  ipcMain.handle(
    'deepseekImport:execute',
    async (event, input: DesktopDeepSeekExecuteInput): Promise<DeepSeekImportResult> => {
      if (!input || typeof input.scanToken !== 'string' || !input.scanToken.trim()) {
        throw new Error(
          translateMain(
            undefined,
            'deepseek_import.error_service_unavailable',
            'Invalid scan token'
          )
        )
      }
      if (!Array.isArray(input.selectedSessionIds) || input.selectedSessionIds.length === 0) {
        throw new Error(
          translateMain(
            undefined,
            'deepseek_import.error_select_session',
            'Please select at least one chat.'
          )
        )
      }
      if (!input.target || (input.target.mode !== 'existing' && input.target.mode !== 'new')) {
        throw new Error(
          translateMain(
            undefined,
            'deepseek_import.error_select_assistant',
            'Invalid target companion.'
          )
        )
      }

      return desktopDeepSeekImportService.executeImport(input, (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('deepseekImport:progress', progress)
        }
      })
    }
  )

  ipcMain.handle('deepseekImport:cleanup', async (_, scanToken?: string | null) => {
    await desktopDeepSeekImportService.cleanup(scanToken)
    return { success: true }
  })
}
