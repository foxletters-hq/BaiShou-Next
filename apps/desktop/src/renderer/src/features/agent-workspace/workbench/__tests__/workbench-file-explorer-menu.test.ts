import { describe, expect, it, vi } from 'vitest'
import { buildFileExplorerMenuItems } from '../WorkbenchFileExplorerContextMenu'

const t = (_key: string, fallback: string) => fallback

function buildItems(
  target: Parameters<typeof buildFileExplorerMenuItems>[0]['target'],
  onAddToChat = vi.fn()
) {
  return {
    onAddToChat,
    items: buildFileExplorerMenuItems({
      target,
      t,
      onOpenFile: vi.fn(),
      onAddToChat,
      onExpandFolder: vi.fn(),
      onNewFile: vi.fn(),
      onNewFolder: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onCopyPath: vi.fn(),
      onRevealInExplorer: vi.fn(),
      onRefresh: vi.fn()
    })
  }
}

describe('buildFileExplorerMenuItems', () => {
  it('should include add-to-chat for a file node', () => {
    const { items, onAddToChat } = buildItems({
      kind: 'node',
      node: { relativePath: 'a.md', name: 'a.md', isDirectory: false }
    })
    const add = items.find((item) => item.label === '加入对话')
    expect(add).toBeTruthy()
    add?.onClick()
    expect(onAddToChat).toHaveBeenCalledWith({
      relativePath: 'a.md',
      name: 'a.md',
      isDirectory: false
    })
  })

  it('should include add-to-chat for a folder node', () => {
    const { items } = buildItems({
      kind: 'node',
      node: { relativePath: 'docs', name: 'docs', isDirectory: true }
    })
    expect(items.some((item) => item.label === '加入对话')).toBe(true)
  })

  it('should omit add-to-chat on the empty tree root', () => {
    const { items } = buildItems({ kind: 'root' })
    expect(items.some((item) => item.label === '加入对话')).toBe(false)
  })
})
