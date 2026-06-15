import React from 'react'
import { IncrementalSyncPage } from '../IncrementalSyncPage'

export const IncrementalSyncPane: React.FC = () => {
  return (
    <div className="settings-pane settings-pane-full">
      <IncrementalSyncPage embedded />
    </div>
  )
}
