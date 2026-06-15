import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FULL_BACKUP_SCOPE_I18N_KEYS } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { SyncModeComparisonHelp } from '../SyncModeComparisonNotice'

export const BackupScopeList: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.lg
        }
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('data_sync.backup_scope_title')}
        </Text>
        <SyncModeComparisonHelp context="fullBackup" size={16} />
      </View>
      <View style={styles.grid}>
        {FULL_BACKUP_SCOPE_I18N_KEYS.map((key) => (
          <View key={key} style={styles.row}>
            <Text style={[styles.bullet, { color: colors.textPrimary }]}>•</Text>
            <Text style={[styles.item, { color: colors.textPrimary }]}>
              {t(`data_sync.${key}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8
  },
  title: {
    fontSize: 13,
    fontWeight: '600'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 2
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    width: '100%'
  },
  bullet: {
    fontSize: 11,
    lineHeight: 17
  },
  item: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
})
