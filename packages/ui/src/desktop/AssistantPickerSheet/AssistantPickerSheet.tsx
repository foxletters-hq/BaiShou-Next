import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ModelSwitcherPopup } from '../ModelSwitcherPopup'
import { withAppContentOverlay } from '../overlay'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantPickerSheetProps } from './assistant-picker-sheet.types'
import { useAssistantPickerSheet } from './useAssistantPickerSheet'
import { AssistantPickerSidebar } from './AssistantPickerSidebar'
import { AssistantPickerDetailPane } from './AssistantPickerDetailPane'
import { AssistantPickerDeleteModal } from './AssistantPickerDeleteModal'

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = (props) => {
  const { isOpen, currentAssistantId, onSelect, onClose, onCreateNew } = props
  const vm = useAssistantPickerSheet(props)

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  return createPortal(
    <div className={withAppContentOverlay(styles.overlay)} onPointerDown={handleOverlayPointerDown}>
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
