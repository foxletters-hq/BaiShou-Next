import React from 'react'
import { WebSearchSettingsView } from '@baishou/ui'

interface WebSearchPaneProps {
  settings: any
}

export const WebSearchPane: React.FC<WebSearchPaneProps> = ({ settings }) => {
  if (!settings.webSearchConfig) return <div />
  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <WebSearchSettingsView
        searchConfig={settings.webSearchConfig}
        onSearchChange={(config) => settings.setWebSearchConfig(config)}
      />
    </div>
  )
}
