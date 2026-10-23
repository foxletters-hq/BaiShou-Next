import React, { type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { sharedTokens } from '../../theme/tokens'
import { Button } from '../Button'
import { Modal, modalActionsStyle } from '../Modal/Modal'
import { SettingsCardDivider } from '../settings/SettingsCardDivider'
import { RagMemoryHeaderSection } from './RagMemoryHeaderSection'
import { RagMemoryRetrievalSection } from './RagMemoryRetrievalSection'
import type { RagConfig, RagStats } from './rag-memory.types'

interface RagMemorySettingsModalProps {
  visible: boolean
  config: RagConfig
  stats: RagStats
  settingsLead?: ReactNode
  onChange: (config: RagConfig) => void
  onClearAll?: () => Promise<void>
  onClose: () => void
}

export const RagMemorySettingsModal: React.FC<RagMemorySettingsModalProps> = ({
  visible,
  config,
  stats,
  settingsLead,
  onChange,
  onClearAll,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <Modal visible={visible} title={t('common.settings', '设置')} onClose={onClose}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingRight: sharedTokens.spacing.mdTight }}
      >
        {settingsLead}
        {settingsLead ? <SettingsCardDivider /> : null}
        <RagMemoryHeaderSection
          config={config}
          stats={stats}
          onChange={onChange}
          onClearAll={onClearAll}
          showEnableSwitch={false}
        />
        <SettingsCardDivider />
        <RagMemoryRetrievalSection config={config} onChange={onChange} />
        <View style={modalActionsStyle}>
          <Button variant="outlined" size="sm" onPress={onClose}>
            {t('common.close', '关闭')}
          </Button>
        </View>
      </ScrollView>
    </Modal>
  )
}
