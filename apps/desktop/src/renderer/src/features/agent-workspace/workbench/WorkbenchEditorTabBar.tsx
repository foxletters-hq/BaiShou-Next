import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { GitCompare, PanelLeft, PanelRight, X } from 'lucide-react'
import { AnchoredContextMenu, getFileTypeIcon } from '@baishou/ui'
import type { WorkbenchTab } from './useWorkbenchTabs'
import { buildEditorTabMenuItems } from './workbench-editor-tab-menu.util'
import { tabIconName } from './workbench-main-pane.util'
import styles from './WorkbenchMainPane.module.css'

export interface WorkbenchEditorTabBarProps {
  tabs: WorkbenchTab[]
  activeTabId: string | null
  enableReorder: boolean
  sidePaneVisible: boolean
  agentPanelVisible: boolean
  onToggleSidePane: () => void
  onToggleAgentPanel: () => void
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseTabs: (tabIds: string[]) => void
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onAddToChat: (relativePath: string) => void
  onRevealInSidebar: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onTabMouseDown: (event: React.MouseEvent, tabId: string, closable: boolean) => void
  onTabDragEnd: (result: DropResult) => void
}

function TabLabel({ tab }: { tab: WorkbenchTab }) {
  const isDiffTab = tab.kind === 'diff' || tab.kind === 'git-diff'
  return (
    <>
      <span className={styles.tabIcon} aria-hidden>
        {isDiffTab ? (
          <GitCompare size={16} strokeWidth={1.75} />
        ) : (
          getFileTypeIcon(tabIconName(tab), 16)
        )}
      </span>
      <span className={styles.tabLabel}>{tab.title}</span>
    </>
  )
}

export const WorkbenchEditorTabBar: React.FC<WorkbenchEditorTabBarProps> = ({
  tabs,
  activeTabId,
  enableReorder,
  sidePaneVisible,
  agentPanelVisible,
  onToggleSidePane,
  onToggleAgentPanel,
  onSelectTab,
  onCloseTab,
  onCloseTabs,
  onCopyPath,
  onCopyRelativePath,
  onAddToChat,
  onRevealInSidebar,
  onRevealInExplorer,
  onTabMouseDown,
  onTabDragEnd
}) => {
  const { t } = useTranslation()
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const closeTabMenu = useCallback(() => setTabMenu(null), [])
  const openTabMenu = useCallback(
    (event: React.MouseEvent, tabId: string) => {
      event.preventDefault()
      event.stopPropagation()
      setTabMenu({ x: event.clientX, y: event.clientY, tabId })
    },
    []
  )
  const tabMenuItems = useMemo(() => {
    if (!tabMenu) return []
    return buildEditorTabMenuItems({
      tabs,
      tabId: tabMenu.tabId,
      t,
      onCloseTabs,
      onCopyPath,
      onCopyRelativePath,
      onAddToChat,
      onRevealInSidebar,
      onRevealInExplorer
    })
  }, [
    onCloseTabs,
    onCopyPath,
    onCopyRelativePath,
    onAddToChat,
    onRevealInExplorer,
    onRevealInSidebar,
    t,
    tabMenu,
    tabs
  ])

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabBarLeading}>
        <button
          type="button"
          className={`${styles.layoutBtn} ${sidePaneVisible ? styles.layoutBtnActive : ''}`}
          onClick={onToggleSidePane}
          title={t('workbench.toggle_side_bar', '切换左侧边栏')}
          aria-pressed={sidePaneVisible}
        >
          <PanelLeft size={18} strokeWidth={1.75} />
        </button>
      </div>

      {enableReorder ? (
        <DragDropContext onDragEnd={onTabDragEnd}>
          <Droppable droppableId="workbench-tabs" direction="horizontal">
            {(droppableProvided) => (
              <div
                className={styles.tabScroll}
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
              >
                {tabs.map((tab, index) => (
                  <Draggable key={tab.id} draggableId={tab.id} index={index}>
                    {(draggableProvided, snapshot) => (
                      <div
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        {...draggableProvided.dragHandleProps}
                        style={{
                          ...draggableProvided.draggableProps.style,
                          cursor: 'default'
                        }}
                        className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''} ${snapshot.isDragging ? styles.tabDragging : ''}`}
                        onMouseDown={(event) => onTabMouseDown(event, tab.id, true)}
                        onClick={(event) => {
                          if (event.button !== 0) return
                          onSelectTab(tab.id)
                        }}
                        onContextMenu={(event) => openTabMenu(event, tab.id)}
                        title={tab.relativePath || tab.title}
                      >
                        <TabLabel tab={tab} />
                        <button
                          type="button"
                          className={styles.tabClose}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            onCloseTab(tab.id)
                          }}
                          aria-label={t('common.close', '关闭')}
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className={styles.tabScroll}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
              onMouseDown={(event) => onTabMouseDown(event, tab.id, true)}
              onClick={(event) => {
                if (event.button !== 0) return
                onSelectTab(tab.id)
              }}
              onContextMenu={(event) => openTabMenu(event, tab.id)}
              title={tab.relativePath || tab.title}
            >
              <TabLabel tab={tab} />
              <button
                type="button"
                className={styles.tabClose}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
                aria-label={t('common.close', '关闭')}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.tabBarTrailing}>
        <button
          type="button"
          className={`${styles.layoutBtn} ${agentPanelVisible ? styles.layoutBtnActive : ''}`}
          onClick={onToggleAgentPanel}
          title={t('workbench.toggle_agent_panel', '切换 Agent 面板')}
          aria-pressed={agentPanelVisible}
        >
          <PanelRight size={18} strokeWidth={1.75} />
        </button>
      </div>
      {tabMenu && tabMenuItems.length > 0 ? (
        <AnchoredContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          items={tabMenuItems}
          onClose={closeTabMenu}
          backdropZIndex={9999}
          menuZIndex={10000}
        />
      ) : null}
    </div>
  )
}
