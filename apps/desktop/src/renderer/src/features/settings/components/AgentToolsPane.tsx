import React from 'react'
import { AgentToolsView } from '@baishou/ui'
import { getDefaultToolManagementConfig } from '@baishou/store'

interface AgentToolsPaneProps {
  settings: any
}

export const AgentToolsPane: React.FC<AgentToolsPaneProps> = ({ settings }) => {
  const toolManagementConfig =
    settings.toolManagementConfig ?? getDefaultToolManagementConfig()
  return (
    <div className="settings-pane settings-pane-full">
      <AgentToolsView
        config={toolManagementConfig}
        onChange={(config) => settings.setToolManagementConfig(config)}
      />
    </div>
  )
}
