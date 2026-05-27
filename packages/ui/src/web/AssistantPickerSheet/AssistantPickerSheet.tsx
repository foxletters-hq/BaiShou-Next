import React from 'react'
import { createPortal } from 'react-dom'
import { ModelSwitcherPopup } from '../ModelSwitcherPopup'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantPickerSheetProps } from './assistant-picker-sheet.types'
import { useAssistantPickerSheet } from './useAssistantPickerSheet'
import { AssistantPickerSidebar } from './AssistantPickerSidebar'
import { AssistantPickerDetailPane } from './AssistantPickerDetailPane'
import { AssistantPickerDeleteModal } from './AssistantPickerDeleteModal'

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = (props) => {
  const { isOpen, currentAssistantId, onSelect, onClose, onCreateNew } = props
  const vm = useAssistantPickerSheet(props)

  if (!isOpen) return null

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <AssistantPickerSidebar
          vm={vm}
          currentAssistantId={currentAssistantId}
          onCreateNew={onCreateNew}
        />
        <AssistantPickerDetailPane
          vm={vm}
          activeAssistant={vm.activeAssistant}
          currentAssistantId={currentAssistantId}
          onClose={onClose}
          onSelect={onSelect}
        />
      </div>

      {vm.showModelSwitcher && vm.activeAssistant && (
        <ModelSwitcherPopup
          onClose={() => vm.setShowModelSwitcher(false)}
          providers={vm.providers.map((p) => ({
            id: p.id || p.providerId,
            name: p.name || p.providerId || p.id,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: p.enabledModels || []
          }))}
          currentProviderId={vm.activeAssistant.providerId}
          currentModelId={vm.activeAssistant.modelId}
          onSelect={(pid, mid) => {
            vm.updateAssistantAPI(vm.activeAssistant!.id, {
              providerId: pid,
              modelId: mid
            })
            vm.setShowModelSwitcher(false)
          }}
        />
      )}

      <AssistantPickerDeleteModal vm={vm} />
    </div>,
    document.body
  )
}
