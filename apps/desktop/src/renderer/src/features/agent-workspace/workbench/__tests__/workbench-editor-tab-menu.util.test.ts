import { describe, expect, it, vi } from 'vitest'
import {
  buildEditorTabMenuItems,
  collectEditorTabCloseIds
} from '../workbench-editor-tab-menu.util'

const t = (_key: string, fallback: string) => fallback

const tabs = [
  { id: 'a', relativePath: 'README.md' },
  { id: 'b', relativePath: '设定/规范.md' },
  { id: 'c', relativePath: '目录结构.md' }
]

function labelsOf(tabId: string, source: Array<{ id: string; relativePath?: string }> = tabs) {
  return buildEditorTabMenuItems({
    tabs: source,
    tabId,
    t,
    onCloseTabs: vi.fn(),
    onCopyPath: vi.fn(),
    onCopyRelativePath: vi.fn(),
    onAddToChat: vi.fn(),
    onRevealInSidebar: vi.fn(),
    onRevealInExplorer: vi.fn()
  })
    .filter((item) => !item.divider)
    .map((item) => item.label)
}

describe('collectEditorTabCloseIds', () => {
  it('should close only the clicked tab when the action is one', () => {
    expect(collectEditorTabCloseIds(tabs, 'b', 'one')).toEqual(['b'])
  })

  it('should keep the clicked tab when closing others', () => {
    expect(collectEditorTabCloseIds(tabs, 'b', 'others')).toEqual(['a', 'c'])
  })

  it('should close tabs after the clicked tab when closing to the right', () => {
    expect(collectEditorTabCloseIds(tabs, 'b', 'right')).toEqual(['c'])
    expect(collectEditorTabCloseIds(tabs, 'c', 'right')).toEqual([])
  })

  it('should close every tab when the action is all', () => {
    expect(collectEditorTabCloseIds(tabs, 'a', 'all')).toEqual(['a', 'b', 'c'])
  })
})

describe('buildEditorTabMenuItems', () => {
  it('should list close actions before path actions when the tab has a file', () => {
    expect(labelsOf('b')).toEqual([
      '关闭',
      '关闭其他',
      '关闭右侧',
      '全部关闭',
      '复制路径',
      '复制相对路径',
      '加入对话',
      '在资源管理器中显示',
      '在侧边栏中显示'
    ])
  })

  it('should disable close-to-the-right when the tab is the last one', () => {
    const items = buildEditorTabMenuItems({
      tabs,
      tabId: 'c',
      t,
      onCloseTabs: vi.fn(),
      onCopyPath: vi.fn(),
      onCopyRelativePath: vi.fn(),
      onAddToChat: vi.fn(),
      onRevealInSidebar: vi.fn(),
      onRevealInExplorer: vi.fn()
    })
    expect(items.find((item) => item.label === '关闭右侧')?.disabled).toBe(true)
    expect(items.find((item) => item.label === '关闭其他')?.disabled).toBe(false)
  })

  it('should omit path actions when the tab has no file path', () => {
    expect(labelsOf('draft', [{ id: 'draft' }])).toEqual([
      '关闭',
      '关闭其他',
      '关闭右侧',
      '全部关闭'
    ])
  })

  it('should copy the relative path of the clicked tab', () => {
    const onCopyRelativePath = vi.fn()
    const items = buildEditorTabMenuItems({
      tabs,
      tabId: 'b',
      t,
      onCloseTabs: vi.fn(),
      onCopyPath: vi.fn(),
      onCopyRelativePath,
      onAddToChat: vi.fn(),
      onRevealInSidebar: vi.fn(),
      onRevealInExplorer: vi.fn()
    })
    items.find((item) => item.label === '复制相对路径')?.onClick?.()
    expect(onCopyRelativePath).toHaveBeenCalledWith('设定/规范.md')
  })

  it('should close the other tabs when close-others is chosen', () => {
    const onCloseTabs = vi.fn()
    const items = buildEditorTabMenuItems({
      tabs,
      tabId: 'b',
      t,
      onCloseTabs,
      onCopyPath: vi.fn(),
      onCopyRelativePath: vi.fn(),
      onAddToChat: vi.fn(),
      onRevealInSidebar: vi.fn(),
      onRevealInExplorer: vi.fn()
    })
    items.find((item) => item.label === '关闭其他')?.onClick?.()
    expect(onCloseTabs).toHaveBeenCalledWith(['a', 'c'])
  })
})
