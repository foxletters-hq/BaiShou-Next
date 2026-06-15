import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DataManagementCard, useNativeTheme } from '@baishou/ui/native'

interface ArchiveLocalBackupSectionProps {
  onExport: () => Promise<void>
  onImport: () => Promise<void>
  /** 作为标签页内容时隐藏标题，避免与页头重复 */
  embedded?: boolean
}

export const ArchiveLocalBackupSection: React.FC<ArchiveLocalBackupSectionProps> = ({
  onExport,
  onImport,
  embedded = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={
        embedded
          ? styles.embedded
          : [
              styles.card,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg
              }
            ]
      }
    >
      {!embedded ? (
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('settings.local_archive_backup', '本地全量备份')}
        </Text>
      ) : null}
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t(
          'settings.local_archive_backup_desc',
          '导出或导入包含全部数据的 ZIP 文件，适合换机或离线备份'
        )}
      </Text>
      <DataManagementCard flat onExport={onExport} onImport={onImport} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 4,
    borderWidth: StyleSheet.hairlineWidth
  },
  embedded: {
    paddingTop: 4,
    paddingBottom: 4
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4
  }
})
