import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FULL_BACKUP_SCOPE_I18N_KEYS } from '@baishou/shared'
import { useNativeTheme } from '../theme'

export const BackupScopeList: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bgSurfaceNormal, borderColor: colors.borderSubtle }
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('data_sync.backup_scope_title')}
      </Text>
      {FULL_BACKUP_SCOPE_I18N_KEYS.map((key) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.item, { color: colors.textSecondary }]}>
            {t(`data_sync.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20
  },
  item: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
})
