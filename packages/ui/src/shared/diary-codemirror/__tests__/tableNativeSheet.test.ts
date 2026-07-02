import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  closeNativeTableSheets,
  requestNativeTableSheet,
  resolveNativeTableSheetResponse,
  resetNativeTableSheetsForTest
} from '../table/tableNativeSheet'
import { isTableSheetOpen } from '../table/tableSheetInteraction'

describe('tableNativeSheet', () => {
  afterEach(() => {
    delete (window as { ReactNativeWebView?: unknown }).ReactNativeWebView
    resetNativeTableSheetsForTest()
    document.querySelectorAll('.cm-table-sheet-layer').forEach((el) => el.remove())
  })

  it('routes sheet display through RN bridge and resolves picks', () => {
    const posted: string[] = []
    window.ReactNativeWebView = {
      postMessage: (message: string) => {
        posted.push(message)
      }
    }

    const onPick = vi.fn()
    const onClose = vi.fn()
    const ok = requestNativeTableSheet(
      '第 1 列',
      [{ items: [{ id: 'delete', label: '删除列', destructive: true }] }],
      onPick,
      onClose
    )

    expect(ok).toBe(true)
    expect(isTableSheetOpen()).toBe(true)
    const requestMessage = posted
      .map((raw) => JSON.parse(raw) as { type: string; payload: { requestId: string } })
      .find((msg) => msg.type === 'tableSheetRequest')
    expect(requestMessage?.payload.requestId).toBeTruthy()

    resolveNativeTableSheetResponse({
      requestId: requestMessage!.payload.requestId,
      action: 'pick',
      itemId: 'delete'
    })
    expect(onPick).toHaveBeenCalledWith('delete')
    expect(isTableSheetOpen()).toBe(false)

    requestNativeTableSheet('表格', [{ items: [{ id: 'noop', label: 'x' }] }], vi.fn(), onClose)
    closeNativeTableSheets()
    expect(onClose).toHaveBeenCalled()
  })
})
