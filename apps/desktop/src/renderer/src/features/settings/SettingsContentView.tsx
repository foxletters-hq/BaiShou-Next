import React from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useSettingsStore } from '@baishou/store'
import { getSettingsRouteSegment } from './settings-route.util'
import { WebSearchPane } from './components/WebSearchPane'
import { AgentToolsPane } from './components/AgentToolsPane'
import { SummarySettingsPane } from './components/SummarySettingsPane'
import { LanTransferPane } from './components/LanTransferPane'
import { DataSyncPane } from './components/DataSyncPane'
import { AttachmentManagementPane } from './components/AttachmentManagementPane'
import { TTSSettingsPane } from './components/TTSSettingsPane'
import { GeneralSettingsPane } from './components/GeneralSettingsPane'
import { WorkspaceManagementPane } from './components/WorkspaceManagementPane'
import { IdentityCardManagementPane } from './components/IdentityCardManagementPane'
import { AiModelServicesPane } from './components/AiModelServicesPane'
import { AiGlobalModelsPane } from './components/AiGlobalModelsPane'
import { AssistantPane } from './components/AssistantPane'
import { RagSettingsPane } from './components/RagSettingsPane'
import { GitSettingsPane } from './components/GitSettingsPane'
import { McpSettingsPane } from './components/McpSettingsPane'
import { IncrementalSyncPane } from './components/IncrementalSyncPane'
import { DiaryTemplateSettingsPane } from './components/DiaryTemplateSettingsPane'
import { DiaryAiWritingSettingsPane } from './components/DiaryAiWritingSettingsPane'

const settingsViewTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: 'easeOut' as const }
}

const FULL_HEIGHT_SEGMENTS = new Set([
  'general',
  'mcp',
  'lan-transfer',
  'ai-services',
  'ai-models',
  'tts',
  'rag',
  'web-search',
  'git',
  'workspaces',
  'identity-cards',
  'incremental-sync',
  'diary-template',
  'diary-ai-writing'
])

interface SettingsContentViewProps {
  pathname: string
  settings?: ReturnType<typeof useSettingsStore>
  motionKey?: string
  className?: string
}

export const SettingsContentView: React.FC<SettingsContentViewProps> = ({
  pathname,
  settings: settingsProp,
  motionKey,
  className = ''
}) => {
  const { t } = useTranslation()
  const settingsFromStore = useSettingsStore()
  const settings = settingsProp ?? settingsFromStore
  const segment = getSettingsRouteSegment(pathname)
  const contentKey = motionKey ?? segment

  if (settings.isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 100,
          color: 'var(--color-on-surface-variant)'
        }}
      >
        {t('common.loading_settings', '读取配置表项状态中...')}
      </div>
    )
  }

  const isManagementSubPage = segment === 'workspaces' || segment === 'identity-cards'
  const isFullHeightPane = FULL_HEIGHT_SEGMENTS.has(segment)

  const renderBody = () => {
    if (segment === 'workspaces') return <WorkspaceManagementPane />
    if (segment === 'identity-cards') return <IdentityCardManagementPane />

    switch (segment) {
      case 'general':
        return <GeneralSettingsPane settings={settings} />
      case 'mcp':
        return <McpSettingsPane settings={settings} />
      case 'ai-services':
        return <AiModelServicesPane settings={settings} />
      case 'ai-models':
        return <AiGlobalModelsPane settings={settings} />
      case 'assistants':
        return <AssistantPane settings={settings} />
      case 'rag':
        return <RagSettingsPane settings={settings} />
      case 'web-search':
        return <WebSearchPane settings={settings} />
      case 'agent-tools':
        return <AgentToolsPane settings={settings} />
      case 'diary-template':
        return <DiaryTemplateSettingsPane />
      case 'diary-ai-writing':
        return <DiaryAiWritingSettingsPane />
      case 'summary':
        return <SummarySettingsPane settings={settings} />
      case 'tts':
        return <TTSSettingsPane />
      case 'lan-transfer':
        return <LanTransferPane />
      case 'data-sync':
        return <DataSyncPane settings={settings} />
      case 'incremental-sync':
        return <IncrementalSyncPane />
      case 'attachments':
        return <AttachmentManagementPane />
      case 'git':
        return <GitSettingsPane />
      default:
        return <GeneralSettingsPane settings={settings} />
    }
  }

  return (
    <motion.div
      key={contentKey}
      className={`settings-content-motion-host ${isFullHeightPane ? '' : 'settings-content-scroll'} ${className}`.trim()}
      style={{
        overflow: isManagementSubPage ? 'hidden' : undefined,
        height: '100%'
      }}
      {...settingsViewTransition}
    >
      {renderBody()}
    </motion.div>
  )
}
