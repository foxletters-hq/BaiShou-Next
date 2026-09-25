import React from 'react'
import { IdentitySettingsCard } from '@baishou/ui'
import { AssistantManagementScreen } from '../../agent/AssistantManagementScreen'
import { useSettingsScopeNavigation } from '../hooks/useSettingsScopeNavigation'

export const AssistantPane: React.FC<{ settings: any }> = ({ settings }) => {
  const settingsNav = useSettingsScopeNavigation()
  return (
    <div className="settings-pane settings-pane-full" style={{ padding: 0 }}>
      {settings.userProfileConfig && (
        <div className="settings-card-section" style={{ margin: '16px 16px 0' }}>
          <IdentitySettingsCard
            profile={settings.userProfileConfig}
            onChange={(profile) => settings.setUserProfileConfig(profile)}
            onManageIdentity={() => settingsNav.goIdentityCards()}
          />
        </div>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <AssistantManagementScreen />
      </div>
    </div>
  )
}
