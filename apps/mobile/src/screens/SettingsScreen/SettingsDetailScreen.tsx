import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { scrollIndicatorStyle, useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { getHubItemTitleKey } from './settingsHubItems'
import { GeneralSettingsSection } from './components/GeneralSettingsSection'
import { AIServicesSection } from './components/AIServicesSection'
import { AIModelsSection } from './components/AIModelsSection'
import { RAGMemorySection } from './components/RAGMemorySection'
import { WebSearchSection } from './components/WebSearchSection'
import { AgentToolsSection } from './components/AgentToolsSection'
import { SummarySettingsSection } from './components/SummarySettingsSection'
import { AttachmentManagementSection } from './components/AttachmentManagementSection'
import { TTSSettingsSection } from './components/TTSSettingsSection'
import { AgentBehaviorSection } from './components/AgentBehaviorSection'
import { McpSettingsSection } from './components/McpSettingsSection'
import { DeveloperSettingsSection } from './components/DeveloperSettingsSection'
import { UpdateSettingsSection } from './components/UpdateSettingsSection'

export interface SettingsDetailScreenProps {
  section: string
}

export const SettingsDetailScreen: React.FC<SettingsDetailScreenProps> = ({ section }) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const router = useRouter()

  const titleKey = getHubItemTitleKey(section)
  const title = titleKey ? t(titleKey) : t('settings.title')

  const renderContent = () => {
    switch (section) {
      case 'general':
        return (
          <GeneralSettingsSection
            onNavigateToAttachments={() => router.push('/settings/attachments')}
          />
        )
      case 'ai-services':
        return <AIServicesSection />
      case 'ai-models':
        return (
          <>
            <AIModelsSection />
            <AgentBehaviorSection />
          </>
        )
      case 'rag':
        return <RAGMemorySection />
      case 'web-search':
        return <WebSearchSection />
      case 'agent-tools':
        return <AgentToolsSection />
      case 'mcp':
        return <McpSettingsSection />
      case 'summary':
        return <SummarySettingsSection />
      case 'attachments':
        return <AttachmentManagementSection />
      case 'tts':
        return <TTSSettingsSection />
      case 'updates':
        return <UpdateSettingsSection />
      case 'developer':
        return <DeveloperSettingsSection />
      default:
        return null
    }
  }

  return (
    <StackScreenLayout title={title} {...chrome} contentStyle={styles.layoutContent}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        keyboardShouldPersistTaps="handled"
      >
        {renderContent()}
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  }
})
