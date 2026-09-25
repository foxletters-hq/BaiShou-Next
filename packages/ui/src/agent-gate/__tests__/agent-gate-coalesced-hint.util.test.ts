import { describe, expect, it } from 'vitest'
import { formatCoalescedToolHint } from '../agent-gate-coalesced-hint.util'

const t = (key: string, fallback: string, options?: { count: number }) =>
  fallback.replace('{{count}}', String(options?.count ?? ''))

describe('formatCoalescedToolHint', () => {
  it('should omit the hint for a single write', () => {
    expect(formatCoalescedToolHint({ action: 'workspace_write', coalescedCount: 1 }, t)).toBeNull()
  })

  it('should name the batch size for coalesced writes', () => {
    expect(formatCoalescedToolHint({ action: 'workspace_write', coalescedCount: 4 }, t)).toBe(
      '将一并写入 4 个文件'
    )
  })

  it('should name the batch size for a mixed edit card', () => {
    expect(formatCoalescedToolHint({ action: 'workspace_patch', coalescedCount: 3 }, t)).toBe(
      '将一并写入 3 个文件'
    )
  })
})