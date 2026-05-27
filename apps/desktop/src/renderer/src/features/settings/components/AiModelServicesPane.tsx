import React from 'react'
import { AIModelServicesView } from '@baishou/ui'

export const AiModelServicesPane: React.FC<{ settings: any }> = ({ settings }) => {
  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {}
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        rec[p.id] = {
          providerId: p.id,
          name: p.name,
          isSystem: p.isSystem,
          enabled: p.isEnabled,
          apiKey: p.apiKey,
          apiBaseUrl: p.baseUrl,
          models: p.models,
          enabledModels: p.enabledModels,
          sortOrder: p.sortOrder
        }
      })
    }
    return rec
  }, [settings.providers])

  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ height: '100%', display: 'flex', width: '100%' }}
    >
      <div style={{ height: '100%', display: 'flex', width: '100%' }}>
        <AIModelServicesView
          providers={providerRecord}
          onUpdateProvider={(id, updates) => {
            const existing = (Array.isArray(settings.providers) ? settings.providers : []).find(
              (p: any) => p.id === id
            ) || {
              id: id,
              name: updates.name || id,
              type: 'custom',
              isSystem: false,
              sortOrder: 999
            }

            const newConfig = { ...existing }
            if (updates.name !== undefined) newConfig.name = updates.name
            if (updates.isSystem !== undefined) newConfig.isSystem = updates.isSystem
            if (updates.enabled !== undefined) newConfig.isEnabled = updates.enabled
            if (updates.apiKey !== undefined) newConfig.apiKey = updates.apiKey
            if (updates.apiBaseUrl !== undefined) newConfig.baseUrl = updates.apiBaseUrl
            if (updates.models !== undefined) newConfig.models = updates.models
            if (updates.enabledModels !== undefined) newConfig.enabledModels = updates.enabledModels
            if (updates.sortOrder !== undefined) newConfig.sortOrder = updates.sortOrder

            settings.updateProvider(newConfig)
          }}
          onDeleteProvider={(id) => {
            const filtered = (Array.isArray(settings.providers) ? settings.providers : []).filter(
              (p: any) => p.id !== id
            )
            settings.setProviders(filtered)
          }}
          onReorderProviders={async (orderedIds) => {
            console.log(
              '[Drag Tracking IPC] Received Reorder request in SettingsPage with ids:',
              orderedIds
            )
            try {
              console.log(
                '[Drag Tracking IPC] Awaiting api.settings.reorderProviders IPC bridge...'
              )
              await (window as any).api?.settings?.reorderProviders(orderedIds)
              console.log('[Drag Tracking IPC] IPC bridge completed successfully.')

              console.log(
                '[Drag Tracking IPC] Awaiting api.settings.getProviders to pull refreshed state...'
              )
              const updated = await (window as any).api?.settings?.getProviders()
              console.log('[Drag Tracking IPC] Fetched updated providers from DB:', updated)

              if (updated) {
                settings.setProviders(updated)
                console.log(
                  '[Drag Tracking IPC] Pushed refreshed sorted list into Zustand settings store.'
                )
              } else {
                console.warn('[Drag Tracking IPC] getProviders returned null or undefined.')
              }
            } catch (err) {
              console.error('[Drag Tracking IPC] Failed to execute Reorder operation:', err)
            }
          }}
          onTestConnection={async (provId, tempKey, tempUrl, testModelId) => {
            await (window as any).api?.settings?.testProviderConnection(
              provId,
              tempKey,
              tempUrl,
              testModelId
            )
          }}
          onFetchModels={async (provId, tempKey, tempUrl) => {
            const models = await (window as any).api?.settings?.fetchProviderModels(
              provId,
              tempKey,
              tempUrl
            )
            return models || []
          }}
        />
      </div>
    </div>
  )
}
