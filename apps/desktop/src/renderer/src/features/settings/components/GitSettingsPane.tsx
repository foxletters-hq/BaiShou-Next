import React from 'react'
import { GitManagementPage } from '../GitManagementPage'

export const GitSettingsPane: React.FC = () => {
  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ position: 'absolute', inset: 0, padding: 0, overflow: 'hidden' }}
    >
      <GitManagementPage />
    </div>
  )
}
