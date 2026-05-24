import React, { useState, useEffect } from 'react'
import { ModelSwitcher as SharedModelSwitcher } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import type { MockAiProviderModel } from '@baishou/ui/native'

interface ModelSwitcherProps {
  isVisible: boolean
  onClose: () => void
  onSelect: (providerId: string, modelId: string) => void
  currentProviderId?: string
  currentModelId?: string
}

export const ModelSwitcher: React.FC<ModelSwitcherProps> = (props) => {
  const { services, dbReady } = useBaishou()
  const [providers, setProviders] = useState<MockAiProviderModel[]>([])

  useEffect(() => {
    if (!props.isVisible || !dbReady || !services) return
    services.settingsManager
      .get<MockAiProviderModel[]>('ai_providers')
      .then((p) => setProviders(p || []))
      .catch(() => setProviders([]))
  }, [props.isVisible, dbReady, services])

  return (
    <SharedModelSwitcher
      isOpen={props.isVisible}
      onClose={props.onClose}
      providers={providers}
      currentProviderId={props.currentProviderId || null}
      currentModelId={props.currentModelId || null}
      onSelect={props.onSelect}
    />
  )
}
