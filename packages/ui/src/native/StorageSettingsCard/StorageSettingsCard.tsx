import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { StoragePermissionPrompt } from '../StoragePermissionPrompt/StoragePermissionPrompt'

export interface NativeStorageSettingsCardProps {
  storageRootPath?: string
  sqliteSizeStats: string
  vectorDbStats: string
  mediaCacheStats: string
  totalLimit?: string
  onChangeRoot?: () => Promise<void>
  /** 覆盖默认「更换根目录」文案（移动端为启用固定外部路径，非选择目录） */
  changeRootLabel?: string
  onNavigateToAttachments?: () => void
  onClearCache?: () => void
  onVacuumDb?: () => void
  /** Android：是否已具备全文件访问（undefined 表示未检测） */
  allFilesAccessGranted?: boolean
  onRequestAllFilesAccess?: () => void | Promise<void>
}

export const StorageSettingsCard: React.FC<NativeStorageSettingsCardProps> = ({
  storageRootPath = '...',
  sqliteSizeStats,
  vectorDbStats,
  mediaCacheStats,
  onChangeRoot,
  changeRootLabel,
  onNavigateToAttachments,
  onClearCache,
  onVacuumDb,
  allFilesAccessGranted,
  onRequestAllFilesAccess
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const renderStatItem = (label: string, value: string, icon: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: tokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        gap: tokens.spacing.sm
      }}
    >
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  )

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden'
      }}
    >
      {/* 头部 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: tokens.spacing.lg,
          gap: tokens.spacing.sm
        }}
      >
        <Text style={{ fontSize: 20 }}>💾</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.textPrimary
            }}
          >
            {t('settings.storage_manager')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary
            }}
          >
            {t('settings.storage_root_desc')}
          </Text>
        </View>
      </View>

      {onRequestAllFilesAccess && allFilesAccessGranted === false && (
        <StoragePermissionPrompt onRequest={onRequestAllFilesAccess} mode="required" />
      )}

      {/* 数据根目录 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          gap: tokens.spacing.sm
        }}
      >
        <Text style={{ fontSize: 18 }}>📁</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary
            }}
          >
            {t('settings.storage_root')}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textPrimary,
              fontFamily: 'monospace'
            }}
          >
            {storageRootPath}
          </Text>
        </View>
        {onChangeRoot && (
          <Pressable
            onPress={onChangeRoot}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: tokens.spacing.xs,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.primaryContainer
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.onPrimaryContainer,
                fontWeight: '600'
              }}
            >
              {changeRootLabel ?? t('settings.change_storage_root')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 存储统计 */}
      {renderStatItem(t('settings.sqlite_size'), sqliteSizeStats || '0 MB', '🗄️')}
      {renderStatItem(t('settings.vector_db_size'), vectorDbStats || '0 MB', '🔍')}
      {renderStatItem(t('settings.media_cache_size'), mediaCacheStats || '0 MB', '🖼️')}

      {/* 操作按钮 */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: tokens.spacing.sm,
          padding: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle
        }}
      >
        {onNavigateToAttachments && (
          <Pressable
            onPress={onNavigateToAttachments}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.bgSurfaceNormal
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.textPrimary
              }}
            >
              📎 {t('settings.manage_attachments')}
            </Text>
          </Pressable>
        )}

        {onClearCache && (
          <Pressable
            onPress={onClearCache}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.bgSurfaceNormal
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.textPrimary
              }}
            >
              🧹 {t('settings.clear_cache')}
            </Text>
          </Pressable>
        )}

        {onVacuumDb && (
          <Pressable
            onPress={onVacuumDb}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.bgSurfaceNormal
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.textPrimary
              }}
            >
              ⚡ {t('settings.vacuum_db')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
