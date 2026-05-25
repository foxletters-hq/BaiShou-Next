import React from 'react'
import { IdentitySettingsCard } from '@baishou/ui'
import { AssistantManagementScreen } from '../../agent/AssistantManagementScreen'

export const AssistantPane: React.FC<{ settings: any }> = ({ settings }) => {
  return (
    <div className="settings-pane settings-pane-full" style={{ padding: 0 }}>
      {settings.userProfileConfig && (
        <div className="glass-panel-card" style={{ margin: '16px 16px 0 16px' }}>
          <IdentitySettingsCard
            profile={settings.userProfileConfig}
            onChange={(profile) => settings.setUserProfileConfig(profile)}
          />
        </div>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <AssistantManagementScreen />
      </div>
    </div>
  )
}
