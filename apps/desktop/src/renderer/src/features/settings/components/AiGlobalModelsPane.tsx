import React from 'react'
import { AIGlobalModelsView, AgentBehaviorSettingsCard } from '@baishou/ui'

export const AiGlobalModelsPane: React.FC<{ settings: any }> = ({ settings }) => {
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

  return (
    <div className="settings-pane settings-pane-full">
      {settings.globalModels && (
        <div style={{ height: '100%', display: 'flex', width: '100%' }}>
          <AIGlobalModelsView
            config={settings.globalModels}
            availableProviders={providerRecord}
            onChange={(config) => settings.setGlobalModels(config)}
            onEmbeddingMigrationRequest={async () => true}
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
