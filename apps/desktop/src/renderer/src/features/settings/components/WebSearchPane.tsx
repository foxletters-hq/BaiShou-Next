import React from 'react'
import { WebSearchSettingsView } from '@baishou/ui'
import { getDefaultWebSearchConfig } from '@baishou/store'

interface WebSearchPaneProps {
  settings: any
}

export const WebSearchPane: React.FC<WebSearchPaneProps> = ({ settings }) => {
  const webSearchConfig = settings.webSearchConfig ?? getDefaultWebSearchConfig()
  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <WebSearchSettingsView
        searchConfig={webSearchConfig}
        onSearchChange={(config) => settings.setWebSearchConfig(config)}
      />
    </div>
  )
}
