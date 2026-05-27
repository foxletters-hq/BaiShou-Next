import React, { useCallback } from 'react'
import { AIGlobalModelsView, AgentBehaviorSettingsCard, useToast } from '@baishou/ui'
import { useTranslation } from 'react-i18next'

export const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const { t } = useTranslation()
  const toast = useToast()

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
      try {
        const result = await (window as any).api?.rag?.triggerMigration({ rollbackConfig })
        if (result?.aborted) {
          toast.showWarning(
            t(
              'settings.rag_migration_aborted_restored',
              '迁移已中止，已恢复迁移前的向量数据与嵌入模型配置。'
            )
          )
          await settings.loadConfig?.()
          return false
        }
        toast.showSuccess(
          t('settings.rag_migration_complete', '向量库迁移已完成，日记记忆已用新模型重新嵌入。')
        )
        return true
      } catch (e: any) {
        console.error('Embedding migration failed:', e)
        toast.showError(
          t('settings.rag_migration_failed', '向量库迁移失败：{{message}}', {
            message: e?.message || String(e)
          })
        )
        return false
      }
    },
    [t, toast, settings]
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
