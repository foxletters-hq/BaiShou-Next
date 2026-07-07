import { describe, it, expect, afterEach } from 'vitest'
import {
  confirmMessageForDestructiveItem,
  requestTableConfirm,
  resolveTableConfirmResponse
} from '../table/tableConfirm'

describe('tableConfirm', () => {
  afterEach(() => {
    delete (window as { ReactNativeWebView?: unknown }).ReactNativeWebView
  })

  it('builds messages for destructive table actions', () => {
    expect(
      confirmMessageForDestructiveItem({
        id: 'delete-table',
        label: '删除表格'
      })
    ).toContain('删除这张表格')
    expect(
      confirmMessageForDestructiveItem({
        id: 'delete',
        label: '删除列'
      })
    ).toContain('这一列')
    expect(
      confirmMessageForDestructiveItem({
        id: 'delete',
        label: '删除行'
      })
    ).toContain('这一行')
  })

  it('resolves native confirm through bridge response', async () => {
    const posted: string[] = []
    window.ReactNativeWebView = {
      postMessage: (message: string) => {
        posted.push(message)
        const parsed = JSON.parse(message) as {
          type: string
          payload: { requestId: string }
        }
        if (parsed.type === 'confirmRequest') {
          resolveTableConfirmResponse(parsed.payload.requestId, true)
        }
      }
    }

    const confirmed = await requestTableConfirm('确定删除？')
    expect(confirmed).toBe(true)
    expect(posted.some((m) => m.includes('confirmRequest'))).toBe(true)
  })
})
