import React from 'react'
import { IncrementalSyncPage } from '../IncrementalSyncPage'

export const IncrementalSyncPane: React.FC = () => {
  return (
    <div
      className="settings-pane settings-pane-full"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <IncrementalSyncPage embedded />
    </div>
  )
}
