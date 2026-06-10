import React from 'react'
import { isTtsProviderId } from '@baishou/shared'
import { AIModelServicesView } from '@baishou/ui'

export const AiModelServicesPane: React.FC<{ settings: any }> = ({ settings }) => {
  const providerRecord = React.useMemo(() => {
    const rec: Record<string, any> = {}
    if (Array.isArray(settings.providers)) {
      settings.providers.forEach((p: any) => {
        if (isTtsProviderId(p.id)) return
        rec[p.id] = {
          providerId: p.id,
          name: p.name,
          type: p.type,
          isSystem: p.isSystem,
          enabled: p.isEnabled,
          apiKey: p.apiKey,
          apiBaseUrl: p.baseUrl,
          models: p.models,
          enabledModels: p.enabledModels,
          defaultDialogueModel: p.defaultDialogueModel,
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
          onUpdateProvider={(id, updates) =>
            settings.patchProvider(id, {
              name: updates.name,
              type: updates.type,
              isSystem: updates.isSystem,
              sortOrder: updates.sortOrder,
              isEnabled: updates.enabled,
              apiKey: updates.apiKey,
              baseUrl: updates.apiBaseUrl,
              models: updates.models,
              enabledModels: updates.enabledModels,
              defaultDialogueModel: updates.defaultDialogueModel
            })
          }
          onDeleteProvider={(id) => {
            const filtered = (Array.isArray(settings.providers) ? settings.providers : []).filter(
              (p: any) => p.id !== id
            )
            settings.setProviders(filtered)
          }}
          onReorderProviders={async (orderedIds) => {
            try {
              await (window as any).api?.settings?.reorderProviders(orderedIds)
              const updated = await (window as any).api?.settings?.getProviders()
              if (updated) {
                settings.setProviders(updated)
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
