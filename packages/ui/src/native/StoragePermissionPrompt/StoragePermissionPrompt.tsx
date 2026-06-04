import React from 'react'
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface StoragePermissionPromptProps {
  onRequest: () => void | Promise<void>
  /** 紧凑样式（用于列表内嵌） */
  compact?: boolean
  /**
   * optional：沙盒可用，全文件权限仅用于与桌面共用 BaiShou_Root（日记页/引导）
   * required：存储设置页，用户主动配置外部目录
   */
  mode?: 'optional' | 'required'
}

/** Android 外部存储权限引导（与 StorageSettingsCard / 原版 BaiShou 日记空状态一致） */
export const StoragePermissionPrompt: React.FC<StoragePermissionPromptProps> = ({
  onRequest,
  compact = false,
  mode = 'optional'
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  if (Platform.OS !== 'android') return null

  const isOptional = mode === 'optional'

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compact : null,
        {
          backgroundColor: isOptional ? colors.bgSurfaceHighest : colors.primaryContainer,
          borderRadius: tokens.radius.md,
          marginHorizontal: compact ? 0 : tokens.spacing.lg,
          marginBottom: tokens.spacing.md
        }
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t(
          isOptional ? 'storage.all_files_access_title_optional' : 'storage.all_files_access_title'
        )}
      </Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t(isOptional ? 'storage.all_files_access_desc_optional' : 'storage.all_files_access_desc')}
      </Text>
      <Pressable
        onPress={onRequest}
        style={({ pressed }) => [
          styles.button,
          {
            opacity: pressed ? 0.85 : 1,
            backgroundColor: isOptional ? colors.bgSurface : colors.primary,
            borderWidth: isOptional ? 1 : 0,
            borderColor: isOptional ? colors.borderSubtle : undefined
          }
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            { color: isOptional ? colors.textPrimary : colors.textOnPrimary }
          ]}
        >
          {t(isOptional ? 'storage.enable_external_sync' : 'settings.check_storage_permission')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 10
  },
  compact: {
    marginHorizontal: 0
  },
  title: {
    fontSize: 14,
    fontWeight: '600'
  },
  desc: {
    fontSize: 13,
    lineHeight: 18
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600'
  }
})
