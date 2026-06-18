import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { scrollIndicatorStyle, KeyboardAwareScrollView, useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { getHubItemTitleKey } from './settingsHubItems'
import { AIServicesSection } from './components/AIServicesSection'
import { AIModelsSection } from './components/AIModelsSection'
import { RAGMemorySection } from './components/RAGMemorySection'
import { WebSearchSection } from './components/WebSearchSection'
import { AgentToolsSection } from './components/AgentToolsSection'
import { SummarySettingsSection } from './components/SummarySettingsSection'
import { DiaryTemplateSettingsSection } from './components/DiaryTemplateSettingsSection'
import { DiaryAiWritingSettingsSection } from './components/DiaryAiWritingSettingsSection'
import { AttachmentManagementSection } from './components/AttachmentManagementSection'
import { DeveloperSettingsSection } from './components/DeveloperSettingsSection'
export interface SettingsDetailScreenProps {
  section: string
}

export const SettingsDetailScreen: React.FC<SettingsDetailScreenProps> = ({ section }) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)

  const titleKey = getHubItemTitleKey(section)
  const title = titleKey ? t(titleKey) : t('settings.title')

  const renderContent = () => {
    switch (section) {
      case 'ai-services':
        return <AIServicesSection />
      case 'ai-models':
        return <AIModelsSection />
      case 'rag':
        return <RAGMemorySection />
      case 'web-search':
        return <WebSearchSection />
      case 'agent-tools':
        return <AgentToolsSection />
      case 'diary-template':
        return <DiaryTemplateSettingsSection />
      case 'diary-ai-writing':
        return <DiaryAiWritingSettingsSection />
      case 'summary':
        return <SummarySettingsSection />
      case 'attachments':
        return <AttachmentManagementSection />
      case 'developer':
        return <DeveloperSettingsSection />
      default:
        return null
    }
  }

  const isSelfScrolling = section === 'ai-services'

  return (
    <StackScreenLayout title={title} {...chrome} contentStyle={styles.layoutContent}>
      {isSelfScrolling ? (
        <View style={[styles.scrollContent, styles.selfScrollHost]}>{renderContent()}</View>
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}
        </KeyboardAwareScrollView>
      )}
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  },
  selfScrollHost: {
    flex: 1,
    paddingBottom: 16,
    minHeight: 0
  }
})
