import { getHistoricalProcessExitReasons } from '../../modules/expo-baishou-server'
import {
  appendDiagnosticBreadcrumb,
  appendDiagnosticLog,
  bootstrapDiagnosticLogFromDisk,
  flushDiagnosticLogNow,
  flushDiagnosticLogSyncBestEffort,
  installMobileDiagnosticLogCapture
} from './mobile-diagnostic-log.service'

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void

type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalErrorHandler | undefined
  setGlobalHandler: (handler: GlobalErrorHandler) => void
}

let installed = false

function resolveErrorUtils(): ErrorUtilsLike | undefined {
  const fromGlobal = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  if (
    typeof fromGlobal?.getGlobalHandler === 'function' &&
    typeof fromGlobal?.setGlobalHandler === 'function'
  ) {
    return fromGlobal
  }

  try {
    // 惰性 require：RN 运行时可能尚未就绪，避免顶层 import 副作用
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { ErrorUtils?: ErrorUtilsLike }
    if (
      typeof rn.ErrorUtils?.getGlobalHandler === 'function' &&
      typeof rn.ErrorUtils?.setGlobalHandler === 'function'
    ) {
      return rn.ErrorUtils
    }
  } catch {
    // react-native may not be ready yet
  }

  return undefined
}

function installGlobalErrorHandler(): void {
  const errorUtils = resolveErrorUtils()
  if (!errorUtils) {
    appendDiagnosticLog('warn', 'ErrorUtils unavailable; skipped global error handler hook')
    return
  }

  const defaultHandler = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    appendDiagnosticLog(
      'error',
      `Uncaught ${isFatal ? 'fatal ' : ''}error: ${error?.message ?? String(error)}`,
      error
    )
    if (isFatal) {
      flushDiagnosticLogSyncBestEffort()
      void flushDiagnosticLogNow().catch(() => {})
    }
    defaultHandler?.(error, isFatal)
  })
}

function recordHistoricalProcessExitReasons(): void {
  try {
    const reasons = getHistoricalProcessExitReasons(5)
    if (reasons.length === 0) return
    const summary = reasons.map((item) => ({
      at: item.timestamp ? new Date(item.timestamp).toISOString() : '',
      reason: item.reasonName,
      code: item.reason,
      status: item.status,
      importance: item.importance,
      pssMb: Math.round((item.pssKb || 0) / 1024),
      rssMb: Math.round((item.rssKb || 0) / 1024),
      desc: item.description
    }))
    appendDiagnosticLog('info', `[ProcessExitReason] recent=${JSON.stringify(summary)}`)
  } catch {
    // 读取系统退出原因失败不影响正常启动
  }
}

export function installMobileDiagnosticLog(): void {
  if (installed) return
  installed = true

  appendDiagnosticBreadcrumb('installMobileDiagnosticLog begin')
  installMobileDiagnosticLogCapture()
  installGlobalErrorHandler()
  void bootstrapDiagnosticLogFromDisk().finally(() => {
    recordHistoricalProcessExitReasons()
  })
  appendDiagnosticBreadcrumb('installMobileDiagnosticLog done')
}
