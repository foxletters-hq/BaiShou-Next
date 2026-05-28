import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AIGlobalModelsView, AgentBehaviorSettingsCard, useToast } from '@baishou/ui'
import { useTranslation } from 'react-i18next'
import { showMigrationResultToast } from '../hooks/migration-result-toast'

export const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()

  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {}
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        rec[p.id] = {
          providerId: p.id,
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
      navigate('/settings/rag')
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
    [t, toast, settings, navigate]
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
          />
        </div>
      )}
      {settings.agentBehaviorConfig && (
        <div className="glass-panel-card">
          <AgentBehaviorSettingsCard
            config={settings.agentBehaviorConfig}
            onChange={(config) => settings.setAgentBehaviorConfig(config)}
          />
        </div>
      )}
    </div>
  )
}
