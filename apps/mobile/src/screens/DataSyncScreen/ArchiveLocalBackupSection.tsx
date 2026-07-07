import React from 'react'
import { DataManagementCard } from '@baishou/ui/native'

type Props = {
  embedded?: boolean
  onExport: () => Promise<void>
  onImport: () => Promise<void>
}

export function ArchiveLocalBackupSection({ embedded, onExport, onImport }: Props) {
  return <DataManagementCard embedded={embedded} flat onExport={onExport} onImport={onImport} />
}
