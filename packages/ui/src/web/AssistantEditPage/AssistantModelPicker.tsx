import React from 'react'
import { isEmbeddingModel, isTtsModel } from '@baishou/shared'
import { ModelSwitcherPopup } from '../ModelSwitcherPopup'

interface AssistantModelPickerProps {
  isOpen: boolean
  pickerProviders: any[]
  providerId?: string
  modelId?: string
  onSelect: (providerId: string, modelId: string) => void
  onClose: () => void
}

export const AssistantModelPicker: React.FC<AssistantModelPickerProps> = ({
  isOpen,
  pickerProviders,
  providerId,
  modelId,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null

  return (
    <ModelSwitcherPopup
      providers={pickerProviders
        .map((p) => {
          const modelList =
            p.enabledModels && p.enabledModels.length > 0 ? p.enabledModels : p.models || []
          const filteredModels = modelList.filter((m) => !isEmbeddingModel(m) && !isTtsModel(m))
          return {
            id: p.id,
            name: p.name || p.id,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: filteredModels
          }
        })
        .filter((p) => p.enabledModels.length > 0)}
      currentProviderId={providerId || ''}
      currentModelId={modelId || ''}
      onSelect={onSelect}
      onClose={onClose}
    />
  )
}
