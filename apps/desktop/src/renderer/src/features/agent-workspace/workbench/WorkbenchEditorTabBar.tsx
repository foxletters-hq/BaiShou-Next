import React from 'react'
import { useTranslation } from 'react-i18next'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { PanelLeft, PanelRight, X } from 'lucide-react'
import { getFileTypeIcon } from '@baishou/ui'
import type { WorkbenchTab } from './useWorkbenchTabs'
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
  onTabMouseDown: (event: React.MouseEvent, tabId: string, closable: boolean) => void
  onTabDragEnd: (result: DropResult) => void
}

function TabLabel({ tab }: { tab: WorkbenchTab }) {
  return (
    <>
      <span className={styles.tabIcon} aria-hidden>
        {getFileTypeIcon(tabIconName(tab), 16)}
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
  onTabMouseDown,
  onTabDragEnd
}) => {
  const { t } = useTranslation()

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
                        onClick={() => onSelectTab(tab.id)}
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
              onClick={() => onSelectTab(tab.id)}
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
    </div>
  )
}
