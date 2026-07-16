import * as fs from 'fs'
import * as path from 'path'
import { app, clipboard, shell } from 'electron'
import {
  DiagnosticLogBuffer,
  buildDiagnosticExportFileName,
  serializeDiagnosticArgs,
  trimDiagnosticText,
  type DiagnosticLogLevel
} from './desktop-diagnostic-log.util'

export { buildDiagnosticExportFileName }

const MAX_MEMORY_ENTRIES = 800
const MAX_PERSISTED_BYTES = 512 * 1024
const LOG_FILENAME = 'baishou_diagnostic.log'
const LOG_VERSION_MARKER = '# BaiShouDiagnosticLogVersion: '
const FLUSH_DEBOUNCE_MS = 250

const buffer = new DiagnosticLogBuffer(MAX_MEMORY_ENTRIES)
let persistedTail = ''
let flushTimer: ReturnType<typeof setTimeout> | undefined
let captureInstalled = false
let lastPersistError: string | undefined
let capturingConsole = false

function getLogsDirectory(): string {
  return path.join(app.getPath('userData'), 'baishou_logs')
}

function getLogFilePath(): string {
  return path.join(getLogsDirectory(), LOG_FILENAME)
}

function resolveAppVersionLabel(): string {
  return app.getVersion()
}

function formatPersistedDiagnosticLog(body: string): string {
  return `${LOG_VERSION_MARKER}${resolveAppVersionLabel()}\n${body}`
}

function parsePersistedDiagnosticLog(text: string): { version?: string; body: string } {
  if (!text.startsWith(LOG_VERSION_MARKER)) {
    return { body: text }
  }
  const firstNewline = text.indexOf('\n')
  if (firstNewline < 0) {
    return { version: text.slice(LOG_VERSION_MARKER.length).trim(), body: '' }
  }
  return {
    version: text.slice(LOG_VERSION_MARKER.length, firstNewline).trim(),
    body: text.slice(firstNewline + 1)
  }
}

function isCurrentPersistedDiagnosticLog(text: string): boolean {
  const parsed = parsePersistedDiagnosticLog(text)
  return parsed.version === resolveAppVersionLabel()
}

export function appendDiagnosticLog(
  level: DiagnosticLogLevel,
  message: string,
  extra?: unknown
): void {
  buffer.append(level, message, extra)
  schedulePersist()
}

export function appendDiagnosticBreadcrumb(message: string): void {
  buffer.breadcrumb(message)
  schedulePersist()
}

function schedulePersist(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void persistDiagnosticLog()
  }, FLUSH_DEBOUNCE_MS)
}

export async function flushDiagnosticLogNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  await persistDiagnosticLog()
}

async function persistDiagnosticLog(): Promise<void> {
  const lines = buffer.getUnflushedFormattedLines()
  if (lines.length === 0) return

  try {
    const dir = getLogsDirectory()
    await fs.promises.mkdir(dir, { recursive: true })
    const filePath = getLogFilePath()
    let existing = persistedTail
    try {
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, 'utf8')
        if (isCurrentPersistedDiagnosticLog(raw)) {
          existing = parsePersistedDiagnosticLog(raw).body
        } else {
          existing = ''
        }
      }
    } catch {
      existing = persistedTail
    }

    const merged = trimDiagnosticText(
      existing ? `${existing}\n${lines.join('\n')}` : lines.join('\n'),
      MAX_PERSISTED_BYTES
    )
    await fs.promises.writeFile(filePath, formatPersistedDiagnosticLog(merged), 'utf8')
    persistedTail = merged
    buffer.markFlushed()
    lastPersistError = undefined
  } catch (error) {
    lastPersistError = error instanceof Error ? error.message : String(error)
  }
}

async function readPersistedDiagnosticLog(): Promise<string> {
  try {
    const filePath = getLogFilePath()
    if (!fs.existsSync(filePath)) return persistedTail
    const raw = await fs.promises.readFile(filePath, 'utf8')
    if (!isCurrentPersistedDiagnosticLog(raw)) {
      persistedTail = ''
      return ''
    }
    const text = parsePersistedDiagnosticLog(raw).body
    persistedTail = text
    return text
  } catch {
    return persistedTail
  }
}

export function buildDiagnosticLogHeader(): string {
  const lines = [
    '=== BaiShou Desktop Diagnostic Log ===',
    `appVersion: ${resolveAppVersionLabel()}`,
    `platform: ${process.platform} ${process.arch}`,
    `electron: ${process.versions.electron}`,
    `chrome: ${process.versions.chrome}`,
    `node: ${process.versions.node}`,
    `userData: ${app.getPath('userData')}`,
    `memoryEntries: ${buffer.size()}`,
    `unflushedEntries: ${buffer.unflushedSize()}`,
    ...(lastPersistError ? [`persistError: ${lastPersistError}`] : []),
    `exportedAt: ${new Date().toISOString()}`,
    '======================================',
    ''
  ]
  return lines.join('\n')
}

export async function buildDiagnosticLogExportText(): Promise<string> {
  await flushDiagnosticLogNow()
  const persisted = await readPersistedDiagnosticLog()
  const pending = buffer.getUnflushedFormattedLines().join('\n')
  const memory = buffer.peekAllFormattedLines().join('\n')

  let body = ''
  if (persisted && memory) {
    body = persisted.includes(memory.split('\n')[0] ?? '')
      ? [persisted, pending].filter(Boolean).join('\n')
      : [persisted, memory].filter(Boolean).join('\n')
  } else {
    body = [persisted, pending || memory].filter(Boolean).join('\n')
  }

  return `${buildDiagnosticLogHeader()}${body || '(empty)'}`
}

export async function exportDiagnosticLogToDesktop(): Promise<{
  filePath: string
  fileName: string
  charCount: number
}> {
  const text = await buildDiagnosticLogExportText()
  const fileName = buildDiagnosticExportFileName()
  const filePath = path.join(app.getPath('desktop'), fileName)
  await fs.promises.writeFile(filePath, text, 'utf8')
  try {
    shell.showItemInFolder(filePath)
  } catch {
    // ignore reveal failures
  }
  return { filePath, fileName, charCount: text.length }
}

export async function copyDiagnosticLogToClipboard(): Promise<{ charCount: number }> {
  const text = await buildDiagnosticLogExportText()
  clipboard.writeText(text)
  return { charCount: text.length }
}

export async function bootstrapDiagnosticLogFromDisk(): Promise<void> {
  persistedTail = await readPersistedDiagnosticLog()
  appendDiagnosticBreadcrumb('app bootstrap')
}

function wrapConsoleMethod(
  level: DiagnosticLogLevel,
  original: (...args: unknown[]) => void
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    original(...args)
    if (capturingConsole) return
    capturingConsole = true
    try {
      buffer.append(level, serializeDiagnosticArgs(args))
      schedulePersist()
    } finally {
      capturingConsole = false
    }
  }
}

/** 拦截主进程 console，采集同步/崩溃等诊断信息 */
export function installDesktopDiagnosticLogCapture(): void {
  if (captureInstalled) return
  captureInstalled = true

  appendDiagnosticBreadcrumb('diagnostic log capture installing')

  const consoleRef = console as Console & {
    log: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }

  const originalLog = consoleRef.log.bind(consoleRef)
  const originalInfo = consoleRef.info?.bind(consoleRef) ?? originalLog
  const originalWarn = consoleRef.warn.bind(consoleRef)
  const originalError = consoleRef.error.bind(consoleRef)
  const originalDebug = consoleRef.debug?.bind(consoleRef) ?? originalLog

  consoleRef.log = wrapConsoleMethod('info', originalLog)
  consoleRef.info = wrapConsoleMethod('info', originalInfo)
  consoleRef.warn = wrapConsoleMethod('warn', originalWarn)
  consoleRef.error = wrapConsoleMethod('error', originalError)
  consoleRef.debug = wrapConsoleMethod('debug', originalDebug)

  appendDiagnosticBreadcrumb('diagnostic log capture installed')
}

/** @internal 仅供单元测试重置模块状态 */
export function resetDesktopDiagnosticLogForTests(): void {
  buffer.clear()
  persistedTail = ''
  lastPersistError = undefined
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  captureInstalled = false
}
