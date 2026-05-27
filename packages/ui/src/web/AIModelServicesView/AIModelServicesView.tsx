import React from 'react'
import styles from './AIModelServicesView.module.css'
import type { AIModelServicesViewProps } from './ai-model-services.types'
import { useAIModelServicesView } from './useAIModelServicesView'
import { AIModelServicesProviderPane } from './AIModelServicesProviderPane'
import { AIModelServicesConfigPane } from './AIModelServicesConfigPane'
import { AIModelServicesModals } from './AIModelServicesModals'

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = (props) => {
  const vm = useAIModelServicesView(props)
  if (!vm.activeProviderMeta) return null

  return (
    <div className={styles.container}>
      <AIModelServicesProviderPane vm={vm} />
      <AIModelServicesConfigPane vm={vm} />
      <AIModelServicesModals vm={vm} />
    </div>
  )
}
