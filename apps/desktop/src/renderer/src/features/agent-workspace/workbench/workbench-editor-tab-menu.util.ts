import type { ContextMenuItem } from '@baishou/ui'

export type EditorTabCloseAction = 'one' | 'others' | 'right' | 'all'

export interface EditorTabMenuTab {
  id: string
  relativePath?: string
  change?: { path?: string }
}

export function editorTabFilePath(tab: EditorTabMenuTab): string {
  return (tab.relativePath || tab.change?.path || '').trim()
}

export function collectEditorTabCloseIds(
  tabs: Array<{ id: string }>,
  tabId: string,
  action: EditorTabCloseAction
): string[] {
  const index = tabs.findIndex((tab) => tab.id === tabId)
  if (index < 0) return []
  if (action === 'one') return [tabId]
  if (action === 'others') return tabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id)
  if (action === 'right') return tabs.slice(index + 1).map((tab) => tab.id)
  return tabs.map((tab) => tab.id)
}

export interface BuildEditorTabMenuItemsParams {
  tabs: EditorTabMenuTab[]
  tabId: string
  t: (key: string, fallback: string) => string
  onCloseTabs: (tabIds: string[]) => void
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onAddToChat: (relativePath: string) => void
  onRevealInSidebar: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
}

export function buildEditorTabMenuItems({
  tabs,
  tabId,
  t,
  onCloseTabs,
  onCopyPath,
  onCopyRelativePath,
  onAddToChat,
  onRevealInSidebar,
  onRevealInExplorer
}: BuildEditorTabMenuItemsParams): ContextMenuItem[] {
  const tab = tabs.find((item) => item.id === tabId)
  if (!tab) return []

  const others = collectEditorTabCloseIds(tabs, tabId, 'others')
  const right = collectEditorTabCloseIds(tabs, tabId, 'right')
  const items: ContextMenuItem[] = [
    {
      label: t('common.close', '关闭'),
      onClick: () => onCloseTabs(collectEditorTabCloseIds(tabs, tabId, 'one'))
    },
    {
      label: t('workbench.close_other_tabs', '关闭其他'),
      disabled: others.length === 0,
      onClick: () => onCloseTabs(others)
    },
    {
      label: t('workbench.close_tabs_to_the_right', '关闭右侧'),
      disabled: right.length === 0,
      onClick: () => onCloseTabs(right)
    },
    {
      label: t('workbench.close_all_tabs', '全部关闭'),
      onClick: () => onCloseTabs(collectEditorTabCloseIds(tabs, tabId, 'all'))
    }
  ]

  const filePath = editorTabFilePath(tab)
  if (!filePath) return items

  items.push(
    { label: '', divider: true },
    {
      label: t('workbench.copy_path', '复制路径'),
      onClick: () => onCopyPath(filePath)
    },
    {
      label: t('workbench.copy_relative_path', '复制相对路径'),
      onClick: () => onCopyRelativePath(filePath)
    },
    { label: '', divider: true },
    {
      label: t('workbench.add_to_chat', '加入对话'),
      onClick: () => onAddToChat(filePath)
    },
    { label: '', divider: true },
    {
      label: t('workbench.reveal_in_explorer', '在资源管理器中显示'),
      onClick: () => onRevealInExplorer(filePath)
    },
    {
      label: t('workbench.reveal_in_sidebar', '在侧边栏中显示'),
      onClick: () => onRevealInSidebar(filePath)
    }
  )
  return items
}
