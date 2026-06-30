import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import { APP_VERSION_NUMBER } from '../app-version'
import { getAppCacheDirectory } from './mobile-app-paths'
import { stripFileScheme, toFileUri } from './android-external-fs'
import { getInfoAsync, readAsStringAsync, writeAsStringAsync } from './mobile-sandbox-fs'
import {
  DiagnosticLogBuffer,
  trimDiagnosticText,
  serializeDiagnosticArgs,
  type DiagnosticLogLevel
} from './mobile-diagnostic-log.util'

export type { DiagnosticLogEntry, DiagnosticLogLevel } from './mobile-diagnostic-log.util'
export {
  formatDiagnosticLogEntry,
  serializeDiagnosticArg,
  serializeDiagnosticArgs,
  trimDiagnosticEntries,
  trimDiagnosticText
} from './mobile-diagnostic-log.util'

const MAX_MEMORY_ENTRIES = 400
const MAX_PERSISTED_BYTES = 256 * 1024
const LOG_FILENAME = 'baishou_diagnostic.log'
const LOG_VERSION_MARKER = '# BaiShouDiagnosticLogVersion: '
const FLUSH_DEBOUNCE_MS = 250

const buffer = new DiagnosticLogBuffer(MAX_MEMORY_ENTRIES)
let persistedTail = ''
let flushTimer: ReturnType<typeof setTimeout> | undefined
let captureInstalled = false
let lastPersistError: string | undefined
let capturingConsole = false

function getLogFilePath(): string {
  const base = stripFileScheme(getAppCacheDirectory())
  const joined = base.endsWith('/') ? `${base}${LOG_FILENAME}` : `${base}/${LOG_FILENAME}`
  return toFileUri(joined)
}

function resolveDeviceBrand(): string {
  const androidBrand = Constants.platform?.android?.brand
  if (androidBrand) return String(androidBrand)

  const constants = Platform.constants as Record<string, unknown> | undefined
  const brand = constants?.Brand ?? constants?.brand
  if (typeof brand === 'string' && brand.trim()) return brand

  const model = resolveDeviceModel().toLowerCase()
  if (model.includes('meizu')) return 'Meizu'
  return 'unknown'
}

function resolveDeviceModel(): string {
  const androidModel = Constants.platform?.android?.model
  if (androidModel) return String(androidModel)
  if (Constants.deviceName) return String(Constants.deviceName)

  const constants = Platform.constants as Record<string, unknown> | undefined
  const model = constants?.Model ?? constants?.model
  if (typeof model === 'string' && model.trim()) return model
  return 'unknown'
}

function resolveAppVersionLabel(): string {
  const expoConfig = Constants.expoConfig
  return `${expoConfig?.version ?? APP_VERSION_NUMBER} (${expoConfig?.android?.versionCode ?? 'unknown'})`
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
    const filePath = getLogFilePath()
    let existing = persistedTail
    try {
      const info = await getInfoAsync(filePath)
      if (info.exists && !info.isDirectory) {
        const raw = await readAsStringAsync(filePath)
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
    await writeAsStringAsync(filePath, formatPersistedDiagnosticLog(merged))
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
    const info = await getInfoAsync(filePath)
    if (!info.exists || info.isDirectory) return persistedTail
    const raw = await readAsStringAsync(filePath)
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
  const expoConfig = Constants.expoConfig
  const lines = [
    '=== BaiShou Diagnostic Log ===',
    `appVersion: ${expoConfig?.version ?? APP_VERSION_NUMBER}`,
    `versionCode: ${expoConfig?.android?.versionCode ?? 'unknown'}`,
    `platform: ${Platform.OS} ${String(Platform.Version)}`,
    `brand: ${resolveDeviceBrand()}`,
    `model: ${resolveDeviceModel()}`,
    `memoryEntries: ${buffer.size()}`,
    `unflushedEntries: ${buffer.unflushedSize()}`,
    ...(lastPersistError ? [`persistError: ${lastPersistError}`] : []),
    `exportedAt: ${new Date().toISOString()}`,
    '=============================',
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

export async function copyDiagnosticLogToClipboard(): Promise<number> {
  const text = await buildDiagnosticLogExportText()
  await Clipboard.setStringAsync(text)
  return text.length
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

export function installMobileDiagnosticLogCapture(): void {
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
  // Dev LogBox uses console.error stack frames as the displayed source. Keeping
  // error unwrapped preserves the real component stack while debugging render loops.
  if (!__DEV__) {
    consoleRef.error = wrapConsoleMethod('error', originalError)
  }
  consoleRef.debug = wrapConsoleMethod('debug', originalDebug)

  appendDiagnosticBreadcrumb('diagnostic log capture installed')
}

/** @internal 仅供单元测试重置模块状态 */
export function resetMobileDiagnosticLogForTests(): void {
  buffer.clear()
  persistedTail = ''
  lastPersistError = undefined
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  captureInstalled = false
}
