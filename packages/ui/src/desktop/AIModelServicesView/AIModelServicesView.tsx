import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './AIModelServicesView.module.css'
import type { AIModelServicesViewProps } from './ai-model-services.types'
import { useAIModelServicesView } from './useAIModelServicesView'
import { AIModelServicesProviderPane } from './AIModelServicesProviderPane'
import { AIModelServicesConfigPane } from './AIModelServicesConfigPane'
import { AIModelServicesModals } from './AIModelServicesModals'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'

export const AIModelServicesView: React.FC<AIModelServicesViewProps> = (props) => {
  const { t } = useTranslation()
  const vm = useAIModelServicesView(props)
  if (!vm.activeProviderMeta) return null

  return (
    <SettingsPageChrome title={t('settings.ai_services', '供应商管理')} layout="stack">
      <div className={styles.container}>
        <AIModelServicesProviderPane vm={vm} />
        <AIModelServicesConfigPane vm={vm} />
        <AIModelServicesModals vm={vm} />
      </div>
    </SettingsPageChrome>
  )
}
