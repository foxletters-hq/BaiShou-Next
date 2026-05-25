import React from 'react'
import { WebSearchSettingsView } from '@baishou/ui'

interface WebSearchPaneProps {
  settings: any
}

export const WebSearchPane: React.FC<WebSearchPaneProps> = ({ settings }) => {
  if (!settings.webSearchConfig) return <div />
  return (
    <div className="settings-pane settings-pane-full">
      <WebSearchSettingsView
        searchConfig={settings.webSearchConfig}
        onSearchChange={(config) => settings.setWebSearchConfig(config)}
      />
    </div>
  )
}
