import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ModelSwitcher as SharedModelSwitcher } from '@baishou/ui/native'
import {
  filterProvidersForModelSwitcher,
  type AIProviderConfig,
  type ModelSwitcherFilterMode
} from '@baishou/shared'
import type { MockAiProviderModel } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

interface ModelSwitcherProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (providerId: string, modelId: string) => void
  currentProviderId?: string
  currentModelId?: string
  /** 对话模型（默认）| embedding | tts */
  filterMode?: ModelSwitcherFilterMode
}

export const ModelSwitcher: React.FC<ModelSwitcherProps> = ({
  filterMode = 'dialogue',
  ...props
}) => {
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const [providers, setProviders] = useState<MockAiProviderModel[]>([])

  useEffect(() => {
    if (!props.isVisible || !dbReady || !services) return
    services.settingsManager
      .get<AIProviderConfig[]>('ai_providers')
      .then((list) => setProviders(filterProvidersForModelSwitcher(list || [], filterMode)))
      .catch(() => setProviders([]))
  }, [props.isVisible, dbReady, services, filterMode])

  return (
    <SharedModelSwitcher
      isOpen={props.isVisible}
      onClose={props.onClose}
      providers={providers}
      currentProviderId={props.currentProviderId || null}
      currentModelId={props.currentModelId || null}
      onSelect={props.onSelect}
      onManageProviders={() => router.push('/settings/ai-services')}
    />
  )
}
