import { ipcMain } from 'electron'
import {
  appendDiagnosticLog,
  copyDiagnosticLogToClipboard,
  exportDiagnosticLogToDesktop
} from '../services/desktop-diagnostic-log.service'
import type { DiagnosticLogLevel } from '../services/desktop-diagnostic-log.util'

const ALLOWED_LEVELS = new Set<DiagnosticLogLevel>(['debug', 'info', 'warn', 'error'])

export function registerDiagnosticLogIPC(): void {
  ipcMain.handle('diagnosticLog:exportToDesktop', async () => {
    return exportDiagnosticLogToDesktop()
  })

  ipcMain.handle('diagnosticLog:copyToClipboard', async () => {
    return copyDiagnosticLogToClipboard()
  })

  ipcMain.handle(
    'diagnosticLog:append',
    async (_event, level: DiagnosticLogLevel, message: string) => {
      if (!ALLOWED_LEVELS.has(level) || typeof message !== 'string' || !message.trim()) {
        return { success: false }
      }
      appendDiagnosticLog(level, `[renderer] ${message}`)
      return { success: true }
    }
  )
}
