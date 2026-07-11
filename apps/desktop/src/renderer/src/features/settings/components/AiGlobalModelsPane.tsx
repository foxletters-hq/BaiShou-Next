import React, { useCallback } from 'react'
import { isTtsProviderId } from '@baishou/shared'
import { AIGlobalModelsView, AgentBehaviorSettingsCard, useToast } from '@baishou/ui'
import { useTranslation } from 'react-i18next'
import { showMigrationResultToast } from '../hooks/migration-result-toast'
import { useSettingsScopeNavigation } from '../hooks/useSettingsScopeNavigation'

export const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const settingsNav = useSettingsScopeNavigation()

  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {}
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        if (isTtsProviderId(p.id)) return
        rec[p.id] = {
          providerId: p.id,
          name: p.name,
          type: p.type,
          enabled: p.isEnabled,
          apiKey: p.apiKey,
          apiBaseUrl: p.baseUrl,
          models: p.models,
          enabledModels: p.enabledModels
        }
      })
    }
    return rec
  }, [settings.providers])

  const handleEmbeddingMigrationRequest = useCallback(
    async ({
      rollbackConfig
    }: {
      rollbackConfig: {
        globalEmbeddingProviderId: string
        globalEmbeddingModelId: string
        globalEmbeddingDimension: number
      }
    }) => {
      settingsNav.goRag()
      // Let RAG settings mount so it can subscribe to migration progress events.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      try {
        const result = await (window as any).api?.rag?.triggerMigration({ rollbackConfig })
        await settings.loadConfig?.()

        if (result?.aborted) {
          await settings.loadConfig?.()
        }
        showMigrationResultToast(result, t, toast)
        return result?.outcome === 'completed' || result?.completed === true
      } catch (e: any) {
        console.error('Embedding migration failed:', e)
        await settings.loadConfig?.()
        toast.showError(
          t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', {
            message: e?.message || String(e)
          })
        )
        return false
      }
    },
    [t, toast, settings, settingsNav]
  )

  return (
    <div className="settings-pane settings-pane-full">
      {settings.globalModels && (
        <div style={{ height: '100%', display: 'flex', width: '100%' }}>
          <AIGlobalModelsView
            config={settings.globalModels}
            availableProviders={providerRecord}
            onChange={(config) => settings.setGlobalModels(config)}
            onEmbeddingMigrationRequest={handleEmbeddingMigrationRequest}
            onManageProviders={() => settingsNav.goAiServices()}
          />
        </div>
      )}
      {settings.agentBehaviorConfig && (
        <div className="settings-card-section" style={{ margin: 16 }}>
          <AgentBehaviorSettingsCard
            config={settings.agentBehaviorConfig}
            onChange={(config) => settings.setAgentBehaviorConfig(config)}
          />
        </div>
      )}
    </div>
  )
}
