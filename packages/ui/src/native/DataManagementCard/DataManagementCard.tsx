import React, { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'

export interface NativeDataManagementCardProps {
  onExport: () => Promise<void>
  onImport: () => Promise<void>
  embedded?: boolean
  isLast?: boolean
}

export const DataManagementCard: React.FC<NativeDataManagementCardProps> = ({
  onExport,
  onImport,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExport()
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      await onImport()
    } finally {
      setIsImporting(false)
    }
  }

  const rows = [
    {
      key: 'export',
      title: t('settings.export_data', '导出数据至本地'),
      subtitle: t('settings.export_desc', '生成一份包含所有内容的 ZIP 备份文件'),
      onPress: handleExport,
      loading: isExporting
    },
    {
      key: 'import',
      title: t('settings.import_data', '从外部 ZIP 导入'),
      subtitle: t('settings.import_desc', '选择本地 ZIP 文件覆盖恢复数据'),
      onPress: handleImport,
      loading: isImporting
    }
  ]

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.data_management', '数据管理')}
      subtitle={t('settings.data_management_desc', '导出、导入数据或局域网快传')}
    >
      {rows.map((row, index) => (
        <Pressable
          key={row.key}
          disabled={row.loading || isExporting || isImporting}
          onPress={() => void row.onPress()}
          style={({ pressed }) => [
            styles.row,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderSubtle
            },
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>{row.title}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{row.subtitle}</Text>
          </View>
          {row.loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
          )}
        </Pressable>
      ))}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 8
  },
  sub: {
    fontSize: 13,
    lineHeight: 18
  },
  chevron: {
    fontSize: 18,
    marginTop: 2
  },
  loader: {
    marginTop: 2
  }
})
