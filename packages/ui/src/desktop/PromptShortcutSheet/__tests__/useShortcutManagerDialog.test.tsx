import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PromptShortcut } from '@baishou/shared'
import { useShortcutManagerDialog } from '../useShortcutManagerDialog'

function makeShortcuts(count: number): PromptShortcut[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `custom-${index}`,
    name: `custom-${index}`,
    command: `custom-${index}`,
    content: `content ${index}`
  }))
}

describe('useShortcutManagerDialog pagination', () => {
  it('falls back to the last available page after the current page is emptied', async () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: PromptShortcut[] }) => useShortcutManagerDialog(items, vi.fn(), vi.fn()),
      { initialProps: { items: makeShortcuts(6) } }
    )

    expect(result.current.totalPages).toBe(2)
    act(() => result.current.handlePageChange(2))
    expect(result.current.currentPage).toBe(2)

    // 删光第二页的自定义 Skill 后，总页数回落到 1
    rerender({ items: [] })

    await waitFor(() => expect(result.current.currentPage).toBe(1))
    expect(result.current.paginatedShortcuts.length).toBeGreaterThan(0)
  })

  it('propagates updated content and description when saving an edited skill', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const initial: PromptShortcut[] = [
      {
        id: 'writer-helper',
        command: 'writer-helper',
        name: '旧描述',
        description: '旧描述',
        tag: '旧描述',
        content: '旧正文'
      }
    ]
    const { result } = renderHook(() => useShortcutManagerDialog(initial, vi.fn(), onUpdate))

    act(() => {
      result.current.handleEdit(initial[0]!)
    })
    act(() => {
      result.current.setDraftName('新描述')
      result.current.setDraftContent('新正文')
    })
    await act(async () => {
      await result.current.handleSave()
    })

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'writer-helper',
        command: 'writer-helper',
        name: '新描述',
        description: '新描述',
        content: '新正文'
      })
    )
  })
})
