import React, { useEffect, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native'
import { useNativeTheme, scrollIndicatorStyle } from '@baishou/ui/native'
import { useTranslation } from 'react-i18next'
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
import { AssistantsSection, LanTransferSection, DataSyncSection } from './components/SimpleSections'
import { DeveloperSettingsSection } from './components/DeveloperSettingsSection'
import { UpdateSettingsSection } from './components/UpdateSettingsSection'

interface SettingsTab {
  id: string
  titleKey: string
  defaultTitle: string
  icon: string
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'general',
    titleKey: 'settings.general',
    defaultTitle: '常规设置',
    icon: '⚙️'
  },
  {
    id: 'ai-services',
    titleKey: 'settings.ai_services',
    defaultTitle: 'AI 供应商',
    icon: '☁️'
  },
  {
    id: 'ai-models',
    titleKey: 'settings.ai_global_models',
    defaultTitle: '全局模型',
    icon: '⭐'
  },
  {
    id: 'assistants',
    titleKey: 'settings.assistants',
    defaultTitle: '伙伴管理',
    icon: '🤖'
  },
  { id: 'rag', titleKey: 'settings.rag', defaultTitle: 'RAG 记忆', icon: '🧠' },
  {
    id: 'agent-behavior',
    titleKey: 'settings.agent_behavior',
    defaultTitle: 'Agent 行为',
    icon: '🧩'
  },
  {
    id: 'web-search',
    titleKey: 'settings.web_search',
    defaultTitle: '网络搜索',
    icon: '🔍'
  },
  {
    id: 'agent-tools',
    titleKey: 'settings.agent_tools',
    defaultTitle: '工具管理',
    icon: '🔧'
  },
  {
    id: 'mcp',
    titleKey: 'settings.mcp_title',
    defaultTitle: 'MCP',
    icon: '🔌'
  },
  {
    id: 'summary',
    titleKey: 'settings.summary',
    defaultTitle: '回忆生成',
    icon: '✨'
  },
  {
    id: 'lan-transfer',
    titleKey: 'settings.lan_transfer',
    defaultTitle: '局域网传输',
    icon: '📡'
  },
  {
    id: 'data-sync',
    titleKey: 'settings.data_sync',
    defaultTitle: '数据同步',
    icon: '🔄'
  },
  {
    id: 'attachments',
    titleKey: 'settings.attachments',
    defaultTitle: '附件管理',
    icon: '📎'
  },
  {
    id: 'tts',
    titleKey: 'settings.tts',
    defaultTitle: '语音合成',
    icon: '🔊'
  },
  {
    id: 'updates',
    titleKey: 'settings.updates',
    defaultTitle: '应用更新',
    icon: '⬆️'
  },
  {
    id: 'developer',
    titleKey: 'settings.developer',
    defaultTitle: '开发者',
    icon: '🛠️'
  }
]

const VALID_SETTINGS_TABS = new Set(SETTINGS_TABS.map((tab) => tab.id))

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    if (typeof tab === 'string' && VALID_SETTINGS_TABS.has(tab)) {
      setActiveTab(tab)
    }
  }, [tab])

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralSettingsSection onNavigateToAttachments={() => setActiveTab('attachments')} />
        )
      case 'ai-services':
        return <AIServicesSection />
      case 'ai-models':
        return <AIModelsSection setActiveTab={setActiveTab} />
      case 'assistants':
        return <AssistantsSection />
      case 'rag':
        return <RAGMemorySection />
      case 'agent-behavior':
        return <AgentBehaviorSection />
      case 'web-search':
        return <WebSearchSection />
      case 'agent-tools':
        return <AgentToolsSection />
      case 'mcp':
        return <McpSettingsSection />
      case 'summary':
        return <SummarySettingsSection />
      case 'lan-transfer':
        return <LanTransferSection />
      case 'data-sync':
        return <DataSyncSection />
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
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgApp}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.bgSurface,
                borderBottomColor: colors.borderSubtle
              }
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('settings.title', '系统设置')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>SYSTEM SETTINGS</Text>
          </View>

          <View style={styles.content}>
            <ScrollView
              style={[styles.tabBar, { backgroundColor: colors.bgSurface }]}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              {SETTINGS_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabItem,
                    activeTab === tab.id && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text
                    style={[
                      styles.tabTitle,
                      { color: colors.textSecondary },
                      activeTab === tab.id && { color: colors.textOnPrimary }
                    ]}
                  >
                    {t(tab.titleKey, tab.defaultTitle)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              style={styles.settingsContent}
              indicatorStyle={scrollIndicatorStyle(isDark)}
              keyboardShouldPersistTaps="handled"
            >
              {renderContent()}

              <View style={styles.footerMarker}>
                <Text style={[styles.footerMarkerText, { color: colors.textSecondary }]}>
                  [ VERSION: MOBILE-BETA-PHASE3 ]
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1.5
  },
  content: {
    flex: 1
  },
  tabBar: {
    flexGrow: 0,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 8
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  settingsContent: {
    flex: 1,
    padding: 16
  },
  footerMarker: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    opacity: 0.2
  },
  footerMarkerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2
  }
})
