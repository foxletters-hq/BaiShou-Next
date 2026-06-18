import React, { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useSettingsStore } from '@baishou/store'
import { getSettingsRouteSegment } from './settings-route.util'

const GeneralSettingsPane = lazy(() =>
  import('./components/GeneralSettingsPane').then((m) => ({ default: m.GeneralSettingsPane }))
)
const McpSettingsPane = lazy(() =>
  import('./components/McpSettingsPane').then((m) => ({ default: m.McpSettingsPane }))
)
const AiModelServicesPane = lazy(() =>
  import('./components/AiModelServicesPane').then((m) => ({ default: m.AiModelServicesPane }))
)
const AiGlobalModelsPane = lazy(() =>
  import('./components/AiGlobalModelsPane').then((m) => ({ default: m.AiGlobalModelsPane }))
)
const AssistantPane = lazy(() =>
  import('./components/AssistantPane').then((m) => ({ default: m.AssistantPane }))
)
const RagSettingsPane = lazy(() =>
  import('./components/RagSettingsPane').then((m) => ({ default: m.RagSettingsPane }))
)
const WebSearchPane = lazy(() =>
  import('./components/WebSearchPane').then((m) => ({ default: m.WebSearchPane }))
)
const AgentToolsPane = lazy(() =>
  import('./components/AgentToolsPane').then((m) => ({ default: m.AgentToolsPane }))
)
const DiaryTemplateSettingsPane = lazy(() =>
  import('./components/DiaryTemplateSettingsPane').then((m) => ({
    default: m.DiaryTemplateSettingsPane
  }))
)
const DiaryAiWritingSettingsPane = lazy(() =>
  import('./components/DiaryAiWritingSettingsPane').then((m) => ({
    default: m.DiaryAiWritingSettingsPane
  }))
)
const SummarySettingsPane = lazy(() =>
  import('./components/SummarySettingsPane').then((m) => ({ default: m.SummarySettingsPane }))
)
const TTSSettingsPane = lazy(() =>
  import('./components/TTSSettingsPane').then((m) => ({ default: m.TTSSettingsPane }))
)
const LanTransferPane = lazy(() =>
  import('./components/LanTransferPane').then((m) => ({ default: m.LanTransferPane }))
)
const DataSyncPane = lazy(() =>
  import('./components/DataSyncPane').then((m) => ({ default: m.DataSyncPane }))
)
const IncrementalSyncPane = lazy(() =>
  import('./components/IncrementalSyncPane').then((m) => ({ default: m.IncrementalSyncPane }))
)
const AttachmentManagementPane = lazy(() =>
  import('./components/AttachmentManagementPane').then((m) => ({
    default: m.AttachmentManagementPane
  }))
)
const GitSettingsPane = lazy(() =>
  import('./components/GitSettingsPane').then((m) => ({ default: m.GitSettingsPane }))
)
const WorkspaceManagementPane = lazy(() =>
  import('./components/WorkspaceManagementPane').then((m) => ({
    default: m.WorkspaceManagementPane
  }))
)
const IdentityCardManagementPane = lazy(() =>
  import('./components/IdentityCardManagementPane').then((m) => ({
    default: m.IdentityCardManagementPane
  }))
)
const LegacyMigrationPane = lazy(() =>
  import('./components/LegacyMigrationPane').then((m) => ({ default: m.LegacyMigrationPane }))
)

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
  'diary-ai-writing',
  'legacy-migration'
])

interface SettingsContentViewProps {
  pathname: string
  settings?: ReturnType<typeof useSettingsStore>
  motionKey?: string
  className?: string
}

const PaneLoadingFallback: React.FC = () => {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 100,
        color: 'var(--color-on-surface-variant)'
      }}
    >
      {t('common.loading', '加载中...')}
    </div>
  )
}

export const SettingsContentView: React.FC<SettingsContentViewProps> = ({
  pathname,
  settings: settingsProp,
  motionKey,
  className = ''
}) => {
  const { t } = useTranslation()
  const isLoading = useSettingsStore((s) => s.isLoading)
  const configHydrated = useSettingsStore((s) => s.configHydrated)
  const settingsFromStore = useSettingsStore()
  const settings = settingsProp ?? settingsFromStore
  const segment = getSettingsRouteSegment(pathname)
  const contentKey = motionKey ?? segment

  if (isLoading && !configHydrated) {
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
      case 'legacy-migration':
        return <LegacyMigrationPane />
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
      <Suspense fallback={<PaneLoadingFallback />}>{renderBody()}</Suspense>
    </motion.div>
  )
}
