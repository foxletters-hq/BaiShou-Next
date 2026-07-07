import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { useDataSyncCloud } from './hooks/useDataSyncCloud'
import { DataSyncScreenView } from './components/DataSyncScreenView'

export const DataSyncScreen: React.FC = () => {
  const cloud = useDataSyncCloud()
  const theme = useNativeTheme()
  const insets = useSafeAreaInsets()
  return <DataSyncScreenView {...cloud} {...theme} insets={insets} />
}
