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
      onCopyRelativePath: vi.fn(),
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

  it('should place rename and delete after copy path when the target is a file', () => {
    const { items } = buildItems({
      kind: 'node',
      node: { relativePath: 'a.md', name: 'a.md', isDirectory: false }
    })
    expect(items.filter((item) => !item.divider).map((item) => item.label)).toEqual([
      '打开',
      '在资源管理器中显示',
      '刷新',
      '加入对话',
      '复制路径',
      '复制相对路径',
      '重命名',
      '删除'
    ])
  })

  it('should keep rename and delete last when the target is a folder', () => {
    const { items } = buildItems({
      kind: 'node',
      node: { relativePath: 'docs', name: 'docs', isDirectory: true }
    })
    expect(items.filter((item) => !item.divider).map((item) => item.label)).toEqual([
      '新建文件',
      '新建文件夹',
      '展开文件夹',
      '在资源管理器中显示',
      '刷新',
      '加入对话',
      '复制路径',
      '复制相对路径',
      '重命名',
      '删除'
    ])
  })
})
