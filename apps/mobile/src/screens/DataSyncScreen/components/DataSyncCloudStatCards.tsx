import type { TFunction } from 'i18next'
import { View, Text } from 'react-native'
import { Database, History } from 'lucide-react-native'
import type { SyncConfig } from '@baishou/core-mobile'
import { dataSyncScreenStyles as styles } from '../data-sync-screen.styles'
import { getTargetColor, getTargetIcon } from '../data-sync-cloud.utils'

type Props = {
  colors: Record<string, string>
  t: TFunction
  syncConfig: SyncConfig
  totalSizeString: string
  cloudRecordCount: number
}

export function DataSyncCloudStatCards({
  colors,
  t,
  syncConfig,
  totalSizeString,
  cloudRecordCount
}: Props) {
  const TargetIcon = getTargetIcon(syncConfig.target)

  return (
    <View
      style={[
        styles.statCardsRow,
        { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
      ]}
    >
      <View style={styles.statCard}>
        <View
          style={[
            styles.statIconWrapper,
            { backgroundColor: getTargetColor(syncConfig.target) + '15' }
          ]}
        >
          <TargetIcon size={20} color={getTargetColor(syncConfig.target)} strokeWidth={2} />
        </View>
        <View style={styles.statInfo}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('data_sync.sync_target', '备份目标')}
          </Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {syncConfig.target.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
          <Database size={20} color="#10b981" strokeWidth={2} />
        </View>
        <View style={styles.statInfo}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('data_sync.total_backup_size', '总备份大小')}
          </Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalSizeString}</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
          <History size={20} color="#a855f7" strokeWidth={2} />
        </View>
        <View style={styles.statInfo}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('data_sync.backup_count', '备份数量')}
          </Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {cloudRecordCount}{' '}
            <Text style={{ fontSize: 13, fontWeight: 'normal' }}>
              {t('common.copies_unit', '份')}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
