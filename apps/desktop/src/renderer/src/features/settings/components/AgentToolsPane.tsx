import React from 'react'
import { AgentToolsView } from '@baishou/ui'

interface AgentToolsPaneProps {
  settings: any
}

export const AgentToolsPane: React.FC<AgentToolsPaneProps> = ({ settings }) => {
  if (!settings.toolManagementConfig) return <div />
  return (
    <div className="settings-pane settings-pane-full">
      <AgentToolsView
        config={settings.toolManagementConfig}
        onChange={(config) => settings.setToolManagementConfig(config)}
      />
    </div>
  )
}
