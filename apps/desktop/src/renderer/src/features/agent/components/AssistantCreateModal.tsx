import React from 'react'
import { AssistantEditPage, Modal } from '@baishou/ui'

export function AssistantCreateModal({
  isOpen,
  assistantCount,
  onClose,
  onBackToPicker,
  onCreated
}: {
  isOpen: boolean
  assistantCount: number
  onClose: () => void
  onBackToPicker?: () => void
  onCreated: () => Promise<void>
}) {
  const dismiss = () => {
    onClose()
    onBackToPicker?.()
  }

  return (
    <Modal isOpen={isOpen} onClose={dismiss} style={{ padding: 0 }}>
      <div style={{ width: '86vw', maxWidth: '960px', height: '85vh', overflow: 'hidden' }}>
        <AssistantEditPage
          assistant={null}
          isLastAssistant={assistantCount <= 1}
          onSave={async (data) => {
            if (typeof window === 'undefined' || !window.electron) return
            await window.electron.ipcRenderer.invoke('agent:create-assistant', data)
            await onCreated()
            onClose()
          }}
          onBack={dismiss}
        />
      </div>
    </Modal>
  )
}
