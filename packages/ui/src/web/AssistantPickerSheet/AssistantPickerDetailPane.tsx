import React, { useCallback } from 'react'
import { X, Star, Edit2, CheckSquare } from 'lucide-react'
import {
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  normalizeAssistantAvatarPath
} from '@baishou/shared'
import { AssistantAvatarPicker } from '../AssistantAvatarPicker'
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

  const avatarPath =
    normalizeAssistantAvatarPath(activeAssistant?.avatarPath) ||
    DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH

  const handleSelectBuiltin = useCallback(
    (path: string) => {
      if (!activeAssistant) return
      void updateAssistantAPI(activeAssistant.id, { avatarPath: path, emoji: '' })
    },
    [activeAssistant, updateAssistantAPI]
  )

  const handleUploadImage = useCallback(
    (dataUrl: string) => {
      if (!activeAssistant) return
      void updateAssistantAPI(activeAssistant.id, { avatarPath: dataUrl, emoji: '' })
    },
    [activeAssistant, updateAssistantAPI]
  )

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
            <AssistantAvatarPicker
              avatarPath={avatarPath}
              previewSize={60}
              fullWidth={false}
              onSelectBuiltin={handleSelectBuiltin}
              onUploadImage={handleUploadImage}
            />
            <div className={styles.detailTitles}>
              <h2
                onClick={handleEditName}
                title={t('agent.assistant.click_to_rename', 'Click to rename')}
                className={styles.detailName}
              >
                {activeAssistant.name} <Edit2 size={16} color="var(--text-secondary)" />
              </h2>
            </div>
          </div>

          <div className={styles.tabsRow} style={{ justifyContent: 'center', gap: 48 }}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'prompt' ? styles.tabActive : ''}`}
              onClick={() => {
                vm.setShowModelSwitcher(false)
                setActiveTab('prompt')
              }}
            >
              {t('agent.assistant.partner_info_label', '伙伴信息')}
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'memory' ? styles.tabActive : ''}`}
              onClick={() => {
                vm.setShowModelSwitcher(false)
                setActiveTab('memory')
              }}
            >
              {t('agent.assistant.memory_label', '记忆')}
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'memory' ? (
              <AssistantPickerMemoryTab vm={vm} />
            ) : (
              <AssistantPickerPromptTab vm={vm} activeAssistant={activeAssistant} />
            )}
          </div>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={`${styles.applyBtn} ${String(activeAssistant.id) === String(currentAssistantId) ? styles.applyBtnCurrent : ''}`}
              onClick={() => {
                if (String(activeAssistant.id) !== String(currentAssistantId)) {
                  onSelect(activeAssistant)
                }
                onClose()
              }}
            >
              <CheckSquare size={18} />{' '}
              {String(activeAssistant.id) === String(currentAssistantId)
                ? t('agent.assistant.current_partner', 'Current Companion')
                : t('agent.chat.select_partner', 'Select Companion')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
