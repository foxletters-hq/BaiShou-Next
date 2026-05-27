import React from 'react'
import { View, Text, FlatList } from 'react-native'
import { useNativeTheme } from '../theme'
import type { CloudSyncRecord } from './cloud-sync-panel.types'
import { formatCloudSyncSize } from './cloud-sync-panel.utils'
import { cloudSyncPanelStyles as styles } from './cloud-sync-panel.styles'

interface CloudSyncRecordListProps {
  records: CloudSyncRecord[]
}

export const CloudSyncRecordList: React.FC<CloudSyncRecordListProps> = ({ records }) => {
  const { colors } = useNativeTheme()

  if (records.length === 0) return null

  const renderRecord = ({ item }: { item: CloudSyncRecord }) => (
    <View style={[styles.recordItem, { borderColor: colors.borderSubtle }]}>
      <View style={styles.recordInfo}>
        <Text style={[styles.recordName, { color: colors.textPrimary }]}>{item.filename}</Text>
        <Text style={[styles.recordMeta, { color: colors.textTertiary }]}>
          {item.lastModified} · {formatCloudSyncSize(item.sizeInBytes)}
        </Text>
      </View>
    </View>
  )

  return (
    <View style={styles.recordsSection}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        云端记录 ({records.length})
      </Text>
      <FlatList
        data={records}
        keyExtractor={(item) => item.filename}
        renderItem={renderRecord}
        scrollEnabled={false}
      />
    </View>
  )
}
