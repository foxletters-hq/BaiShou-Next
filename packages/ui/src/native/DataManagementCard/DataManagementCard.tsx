import React from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface DataManagementCardProps {
  onExport: () => Promise<void>
  onImport: () => Promise<void>
  onClearAll: () => Promise<void>
  isExporting?: boolean
  isImporting?: boolean
}

export const DataManagementCard: React.FC<DataManagementCardProps> = ({
  onExport,
  onImport,
  onClearAll,
  isExporting = false,
  isImporting = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const handleClearAll = () => {
    Alert.alert(
      t('dataManagement.clearAllTitle', '清除所有数据'),
      t('dataManagement.clearAllMessage', '确定要清除所有数据吗？此操作不可撤销，所有日记、会话和数据将被永久删除。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('dataManagement.clearAll', '全部清除'),
          style: 'destructive',
          onPress: () => onClearAll()
        }
      ]
    )
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('dataManagement.title', '数据管理')}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {t('dataManagement.description', '导出、导入或清除您的数据')}
      </Text>

      <View style={styles.buttons}>
        {/* Export Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: pressed || isExporting ? 0.7 : 1
            }
          ]}
          onPress={onExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonIcon}>📤</Text>
          )}
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
            {t('dataManagement.export', '导出数据')}
          </Text>
        </Pressable>

        {/* Import Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.bgSurfaceNormal,
              opacity: pressed || isImporting ? 0.7 : 1
            }
          ]}
          onPress={onImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.buttonIcon}>📥</Text>
          )}
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
            {t('dataManagement.import', '导入数据')}
          </Text>
        </Pressable>

        {/* Clear All Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.clearButton,
            {
              backgroundColor: colors.errorContainer,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={handleClearAll}
        >
          <Text style={styles.buttonIcon}>🗑️</Text>
          <Text style={[styles.buttonText, { color: colors.onErrorContainer }]}>
            {t('dataManagement.clearAll', '清除所有数据')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6
  },
  description: {
    fontSize: 14,
    marginBottom: 18
  },
  buttons: {
    gap: 10
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8
  },
  clearButton: {},
  buttonIcon: {
    fontSize: 18
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
