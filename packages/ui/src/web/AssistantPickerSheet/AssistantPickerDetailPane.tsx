import React from 'react'
import { X, Star, Edit2, CheckSquare } from 'lucide-react'
import { AvatarEditor } from '../AvatarEditor'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantInfo } from './assistant-picker-sheet.types'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'
import { AssistantPickerPromptTab } from './AssistantPickerPromptTab'
import { AssistantPickerMemoryTab } from './AssistantPickerMemoryTab'

export function AssistantPickerDetailPane({
  vm,
  activeAssistant,
  currentAssistantId,
  onClose,
  onSelect
}: {
  vm: AssistantPickerSheetViewModel
  activeAssistant: AssistantInfo | undefined
  currentAssistantId?: string
  onClose: () => void
  onSelect: (assistant: AssistantInfo) => void
}) {
  const { t, activeTab, setActiveTab, updateAssistantAPI, handleEditName } = vm

  return (
    <div className={styles.detailPane}>
      <button className={styles.closeBtn} onClick={onClose}>
        <X size={16} strokeWidth={3} />
      </button>

      {!activeAssistant ? (
        <div className={styles.emptyDetail}>
          <Star size={48} opacity={0.3} />
          <span>
            {t('agent.assistant.picker_no_selection', 'Select a companion to view details')}
          </span>
        </div>
      ) : (
        <div className={styles.detailContent}>
          <div className={styles.detailHeader}>
            <AvatarEditor
              emoji={activeAssistant.emoji}
              avatarPath={activeAssistant.avatarPath}
              onChange={(type, value) => {
                if (type === 'emoji') {
                  updateAssistantAPI(activeAssistant.id, { emoji: value, avatarPath: '' })
                } else {
                  updateAssistantAPI(activeAssistant.id, { avatarPath: value })
                }
              }}
            >
              <div className={styles.detailAvatar} title={t('common.edit_avatar', '点击修改头像')}>
                {activeAssistant.avatarPath ? (
                  <img
                    src={activeAssistant.avatarPath}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 'inherit',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  activeAssistant.emoji
                )}
              </div>
            </AvatarEditor>
            <div className={styles.detailTitles}>
              <h2
                onClick={handleEditName}
                title={t('agent.assistant.click_to_rename', 'Click to rename')}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {activeAssistant.name} <Edit2 size={16} color="var(--text-secondary)" />
              </h2>
            </div>
          </div>

          <div className={styles.tabsRow} style={{ justifyContent: 'center', gap: 48 }}>
            <div
              className={`${styles.tab} ${activeTab === 'prompt' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('prompt')}
            >
              {t('agent.assistant.prompt_label', '提示词')}
            </div>
            <div
              className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              {t('agent.assistant.memory_label', 'Memory')}
            </div>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'prompt' ? (
              <AssistantPickerPromptTab vm={vm} activeAssistant={activeAssistant} />
            ) : (
              <AssistantPickerMemoryTab vm={vm} />
            )}
          </div>

          <div className={styles.actionRow}>
            <button
              className={`${styles.applyBtn} ${activeAssistant.id === currentAssistantId ? styles.applyBtnCurrent : ''}`}
              disabled={activeAssistant.id === currentAssistantId}
              onClick={() => {
                onSelect(activeAssistant)
                onClose()
              }}
            >
              <CheckSquare size={18} />{' '}
              {activeAssistant.id === currentAssistantId
                ? t('agent.assistant.current_partner', 'Current Companion')
                : t('agent.chat.select_partner', 'Select Companion')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
