import type { DiaryCmTableSheetRequestPayload, DiaryCmTableSheetResponsePayload } from '../types'
import {
  dismissKeyboardForSheetInteraction,
  markTableSheetClosed,
  markTableSheetOpen
} from './tableSheetInteraction'

type NativeSheetSection = {
  items: {
    id: string
    label: string
    disabled?: boolean
    destructive?: boolean
  }[]
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

type PendingNativeSheet = {
  onPick: (id: string) => void
  onClose?: () => void
}

const pendingSheets = new Map<string, PendingNativeSheet>()
let nativeSheetOpen = false
let nativeSheetOpenedAt = 0

export function isNativeTableSheetOpen(): boolean {
  return nativeSheetOpen
}

/** RN 侧菜单未正常关闭时，允许把手再次尝试拉起 */
export function isNativeTableSheetStale(maxAgeMs = 1200): boolean {
  return nativeSheetOpen && Date.now() - nativeSheetOpenedAt > maxAgeMs
}

export function shouldUseNativeTableSheet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView)
}

export function requestNativeTableSheet(
  title: string,
  sections: NativeSheetSection[],
  onPick: (id: string) => void,
  onClose?: () => void
): boolean {
  const rn = window.ReactNativeWebView
  if (!rn) return false

  if (nativeSheetOpen) {
    // RN 侧已关闭但 WebView 未收到 dismiss 时，避免静默吞掉新菜单请求
    for (const [staleId, stale] of pendingSheets.entries()) {
      stale.onClose?.()
      pendingSheets.delete(staleId)
    }
    nativeSheetOpen = false
    markTableSheetClosed()
  }

  const requestId = `table-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  pendingSheets.set(requestId, { onPick, onClose })
  nativeSheetOpen = true
  nativeSheetOpenedAt = Date.now()
  markTableSheetOpen()

  const payload: DiaryCmTableSheetRequestPayload = {
    requestId,
    title,
    sections: sections.map((section) => ({
      items: section.items.map((item) => ({
        id: item.id,
        label: item.label,
        disabled: item.disabled,
        destructive: item.destructive
      }))
    }))
  }

  try {
    rn.postMessage(JSON.stringify({ type: 'tableSheetRequest', payload }))
    return true
  } catch {
    pendingSheets.delete(requestId)
    nativeSheetOpen = false
    markTableSheetClosed()
    return false
  }
}

function finishNativeTableSheetSession(): void {
  if (pendingSheets.size === 0) {
    nativeSheetOpen = false
    nativeSheetOpenedAt = 0
    markTableSheetClosed()
  }
}

export function resolveNativeTableSheetResponse(payload: DiaryCmTableSheetResponsePayload): void {
  const pending = pendingSheets.get(payload.requestId)
  if (!pending) return
  pendingSheets.delete(payload.requestId)

  if (payload.action === 'dismiss') {
    pending.onClose?.()
    finishNativeTableSheetSession()
    return
  }

  if (payload.itemId) {
    pending.onPick(payload.itemId)
    finishNativeTableSheetSession()
  }
}

export function resetNativeTableSheetsForTest(): void {
  pendingSheets.clear()
  nativeSheetOpen = false
  nativeSheetOpenedAt = 0
  markTableSheetClosed()
}

export function closeNativeTableSheets(): void {
  if (pendingSheets.size === 0) return
  for (const [requestId, pending] of pendingSheets.entries()) {
    pending.onClose?.()
    pendingSheets.delete(requestId)
  }
  nativeSheetOpen = false
  nativeSheetOpenedAt = 0
  markTableSheetClosed()
}
