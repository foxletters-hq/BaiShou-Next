import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AssistantKindBadge } from '../AssistantKindBadge'
import { AssistantAvatar } from '../AssistantAvatar'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'

export function AssistantPickerSidebar({
  vm,
  currentAssistantId,
  onCreateNew
}: {
  vm: AssistantPickerSheetViewModel
  currentAssistantId?: string
  onCreateNew?: () => void
}) {
  const {
    t,
    filteredAssistants,
    activeAssistant,
    setSelectedId,
    pinnedIds,
    onTogglePin,
    assistants,
    setDeleteTargetId
  } = vm

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.headerTitle}>
          {t('agent.assistant.select_title', 'Select Companion')}
        </span>
      </div>

      <div className={styles.listArea}>
        {filteredAssistants.length === 0 ? (
          <div className={styles.emptyText}>
            {t('agent.assistant.no_assistant', 'No Companion')}
          </div>
        ) : (
          filteredAssistants.map((ast) => {
            const isSelected = String(activeAssistant?.id) === String(ast.id)
            const isCurrent = String(ast.id) === String(currentAssistantId)
            const isPinned = pinnedIds?.has(String(ast.id)) || false

            return (
              <div
                key={ast.id}
                onClick={() => setSelectedId(ast.id)}
                className={`${styles.listItem} ${isPinned ? styles.pinnedItem : ''} ${isSelected ? styles.selectedItem : ''}`}
              >
                <div className={styles.itemAvatar}>
                  <AssistantAvatar avatarPath={ast.avatarPath} size={32} borderRadius={8} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemNameRow}>
                    <span className={styles.itemName}>{ast.name}</span>
                    <AssistantKindBadge kind={ast.assistantKind} compact />
                  </div>
                  {isCurrent ? (
                    <span className={styles.currentBadgeInline}>
                      {t('agent.assistant.current', 'Current')}
                    </span>
                  ) : ast.description ? (
                    <span className={styles.itemDesc}>{ast.description}</span>
                  ) : null}
                </div>

                <div className={styles.actionsWrapper}>
                  <div
                    className={`${styles.actionBtn} ${isPinned ? styles.pinnedBtn : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onTogglePin) onTogglePin(ast.id, !isPinned)
                    }}
                    title={
                      isPinned
                        ? t('agent.assistant.unpin', '取消置顶')
                        : t('agent.assistant.pin_to_sidebar', '置顶并显示在侧边栏')
                    }
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={isPinned ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: 'rotate(45deg)' }}
                    >
                      <path d="M12 17v5" />
                      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                    </svg>
                  </div>

                  {assistants.length > 1 && (
                    <div
                      className={`${styles.actionBtn} ${styles.dangerBtn}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTargetId(ast.id)
                      }}
                    >
                      <Trash2 size={14} />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className={styles.bottomArea}>
        <button
          className={styles.createBtn}
          onClick={() => {
            if (onCreateNew) onCreateNew()
          }}
        >
          <Plus size={16} /> {t('agent.assistant.create_title', 'Create Companion')}
        </button>
      </div>
    </div>
  )
}
