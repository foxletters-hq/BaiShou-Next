import type { DiaryCmTableSheetRequestPayload, DiaryCmTableSheetResponsePayload } from '../types'
import { dismissKeyboardForSheetInteraction } from './tableSheetInteraction'

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

export function isNativeTableSheetOpen(): boolean {
  return nativeSheetOpen
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
    return true
  }

  const requestId = `table-sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  pendingSheets.set(requestId, { onPick, onClose })
  nativeSheetOpen = true
  dismissKeyboardForSheetInteraction()

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
    return false
  }
}

export function resolveNativeTableSheetResponse(payload: DiaryCmTableSheetResponsePayload): void {
  const pending = pendingSheets.get(payload.requestId)
  if (!pending) return
  pendingSheets.delete(payload.requestId)
  if (pendingSheets.size === 0) {
    nativeSheetOpen = false
  }

  if (payload.action === 'dismiss') {
    dismissKeyboardForSheetInteraction()
    pending.onClose?.()
    return
  }

  if (payload.itemId) {
    pending.onPick(payload.itemId)
  }
}

export function resetNativeTableSheetsForTest(): void {
  pendingSheets.clear()
  nativeSheetOpen = false
}

export function closeNativeTableSheets(): void {
  for (const [requestId, pending] of pendingSheets.entries()) {
    pending.onClose?.()
    pendingSheets.delete(requestId)
  }
  nativeSheetOpen = false
}
