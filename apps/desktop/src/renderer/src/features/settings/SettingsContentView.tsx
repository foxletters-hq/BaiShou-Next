import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useSettingsStore, getConfigKeysForSegment, useSettingsPaneApi } from '@baishou/store'
import { getSettingsRouteSegment } from './settings-route.util'
import { useSettingsRouteActive } from './hooks/useSettingsRouteActive'
import { GeneralSettingsPane } from './components/GeneralSettingsPane'
import { McpSettingsPane } from './components/McpSettingsPane'
import { AiModelServicesPane } from './components/AiModelServicesPane'
import { AiGlobalModelsPane } from './components/AiGlobalModelsPane'
import { AssistantPane } from './components/AssistantPane'
import { RagSettingsPane } from './components/RagSettingsPane'
import { WebSearchPane } from './components/WebSearchPane'
import { AgentToolsPane } from './components/AgentToolsPane'
import { DiaryTemplateSettingsPane } from './components/DiaryTemplateSettingsPane'
import { SummarySettingsPane } from './components/SummarySettingsPane'
import { TTSSettingsPane } from './components/TTSSettingsPane'
import { LanTransferPane } from './components/LanTransferPane'
import { DataSyncPane } from './components/DataSyncPane'
import { IncrementalSyncPane } from './components/IncrementalSyncPane'
import { AttachmentManagementPane } from './components/AttachmentManagementPane'
import { GitSettingsPane } from './components/GitSettingsPane'
import { WorkspaceManagementPane } from './components/WorkspaceManagementPane'
import { IdentityCardManagementPane } from './components/IdentityCardManagementPane'
import { LegacyMigrationPane } from './components/LegacyMigrationPane'

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
  motionKey?: string
  className?: string
}

const SETTINGS_LOAD_FADE_MS = 200

const SettingsPaneLoadingOverlay: React.FC<{ srLabel: string; leaving?: boolean }> = ({
  srLabel,
  leaving = false
}) => (
  <div
    className={`settings-config-loading-overlay${leaving ? ' settings-config-loading-overlay--leaving' : ''}`}
    role="status"
    aria-live="polite"
  >
    <Loader2 className="settings-config-loading-spinner" size={36} strokeWidth={2} aria-hidden />
    <span className="settings-config-loading-sr-only">{srLabel}</span>
  </div>
)

function useLoadCrossfade(isLoading: boolean) {
  const [showOverlay, setShowOverlay] = useState(isLoading)
  const [overlayLeaving, setOverlayLeaving] = useState(false)
  const [contentVisible, setContentVisible] = useState(!isLoading)

  useEffect(() => {
    if (isLoading) {
      setShowOverlay(true)
      setOverlayLeaving(false)
      setContentVisible(false)
      return
    }

    setOverlayLeaving(true)
    setContentVisible(true)

    const timer = window.setTimeout(() => {
      setShowOverlay(false)
      setOverlayLeaving(false)
    }, SETTINGS_LOAD_FADE_MS)

    return () => window.clearTimeout(timer)
  }, [isLoading])

  return { showOverlay, overlayLeaving, contentVisible }
}

const SegmentConfigFailedOverlay: React.FC<{
  onRetry: () => void
}> = ({ onRetry }) => {
  const { t } = useTranslation()

  return (
    <div className="settings-config-failed-overlay" role="alert">
      <p className="settings-config-failed-text">
        {t('settings.config_load_failed', '部分配置加载失败')}
      </p>
      <button type="button" className="settings-retry-btn" onClick={onRetry}>
        {t('common.retry', '重试')}
      </button>
    </div>
  )
}

export const SettingsContentView: React.FC<SettingsContentViewProps> = ({
  pathname,
  motionKey,
  className = ''
}) => {
  const { t } = useTranslation()
  const ensureConfigForSegment = useSettingsStore((s) => s.ensureConfigForSegment)
  const retryConfigForSegment = useSettingsStore((s) => s.retryConfigForSegment)
  const scheduleDeferredConfigWarmup = useSettingsStore((s) => s.scheduleDeferredConfigWarmup)
  const cancelDeferredConfigWarmup = useSettingsStore((s) => s.cancelDeferredConfigWarmup)
  const loadingConfigKeys = useSettingsStore((s) => s.loadingConfigKeys)
  const failedConfigKeys = useSettingsStore((s) => s.failedConfigKeys)
  const settings = useSettingsPaneApi()
  const settingsRouteActive = useSettingsRouteActive()
  const deferredWarmupScheduledRef = useRef(false)
  const [segmentSyncing, setSegmentSyncing] = useState(false)
  const segment = getSettingsRouteSegment(pathname)
  const contentKey = motionKey ?? segment
  const requiredKeys = getConfigKeysForSegment(segment)
  const isStoreLoading =
    requiredKeys.length > 0 && requiredKeys.some((key) => loadingConfigKeys.includes(key))
  const isSegmentLoading = segmentSyncing || isStoreLoading
  const isSegmentFailed =
    requiredKeys.length > 0 &&
    !isSegmentLoading &&
    requiredKeys.some((key) => failedConfigKeys.includes(key))

  const { showOverlay, overlayLeaving, contentVisible } = useLoadCrossfade(isSegmentLoading)

  useEffect(() => {
    if (!settingsRouteActive) {
      cancelDeferredConfigWarmup()
      return
    }

    if (!deferredWarmupScheduledRef.current) {
      deferredWarmupScheduledRef.current = true
      scheduleDeferredConfigWarmup()
    }
  }, [settingsRouteActive, scheduleDeferredConfigWarmup, cancelDeferredConfigWarmup])

  useEffect(() => {
    if (!settingsRouteActive) {
      setSegmentSyncing(false)
      return
    }

    const keys = getConfigKeysForSegment(segment)
    if (keys.length === 0) return

    const { loadedConfigKeys, failedConfigKeys } = useSettingsStore.getState()
    const needsFetch = keys.some(
      (key) => !loadedConfigKeys.includes(key) || failedConfigKeys.includes(key)
    )
    if (!needsFetch) return

    let cancelled = false
    setSegmentSyncing(true)

    void ensureConfigForSegment(segment).finally(() => {
      if (cancelled) return
      setSegmentSyncing(false)
    })

    return () => {
      cancelled = true
    }
  }, [ensureConfigForSegment, segment, settingsRouteActive])

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
      case 'diary-ai-writing':
        return <DiaryTemplateSettingsPane />
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
    <div
      key={contentKey}
      className={`settings-content-motion-host settings-content-enter ${isFullHeightPane ? '' : 'settings-content-scroll'} ${className}`.trim()}
      style={{
        overflow: isManagementSubPage ? 'hidden' : undefined,
        height: '100%',
        position: 'relative'
      }}
    >
      {showOverlay ? (
        <SettingsPaneLoadingOverlay
          leaving={overlayLeaving}
          srLabel={t('settings.config_syncing', '正在同步配置…')}
        />
      ) : null}
      {isSegmentFailed && !isSegmentLoading ? (
        <SegmentConfigFailedOverlay onRetry={() => void retryConfigForSegment(segment)} />
      ) : null}
      <div className={`settings-pane-body${contentVisible ? ' settings-pane-body--visible' : ''}`}>
        {renderBody()}
      </div>
    </div>
  )
}
