import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import {
  Button,
  RestoreBlockingOverlay,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

/**
 * 旧版升级用户必须完成一次性迁移；阻塞主界面直至迁移成功。
 * 采用复制策略，不删除原目录；完成后写入持久化完成状态。
 *
 * 以全屏 overlay 覆盖导航栈，避免卸载 expo-router Stack 引发闪退。
 */
export function FlutterLegacyMigrationGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()
  const [starting, setStarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    dbReady,
    pendingFlutterLegacyMigration,
    flutterLegacyMigrationBusy,
    flutterLegacyMigrationProgress,
    runFlutterLegacyMigration,
    deleteMigratedLegacySource
  } = useBaishou()

  const handleStartMigration = useCallback(async () => {
    if (starting || flutterLegacyMigrationBusy) return
    setStarting(true)
    setErrorMessage(null)

    try {
      const result = await runFlutterLegacyMigration()
      if (!result?.migrated) {
        setErrorMessage(
          t(
            'storage.flutter_legacy_migration_permission_required',
            '需要存储权限才能完成迁移，请授予「管理所有文件」后点击「开始迁移」重试。'
          )
        )
        return
      }

      toast.showToast(
        t('storage.flutter_legacy_migration_complete', '旧版数据已复制到新版目录'),
        'success'
      )

      if (!result.sourceRoot) return

      const deleteNow = await dialog.confirm(
        t('storage.flutter_legacy_delete_prompt_message', {
          path: displayPath(result.sourceRoot),
          defaultValue: `迁移已完成。是否删除旧版目录以释放空间？\n\n${displayPath(result.sourceRoot)}\n\n删除前已确认新版目录数据完整，此操作不可恢复。`
        }),
        {
          title: t('storage.flutter_legacy_delete_prompt_title', '删除旧版目录？'),
          confirmText: t('storage.flutter_legacy_delete_confirm', '删除旧目录'),
          cancelText: t('storage.flutter_legacy_delete_later', '暂不删除'),
          destructive: true
        }
      )

      if (!deleteNow) return

      const deleted = await deleteMigratedLegacySource()
      if (deleted) {
        toast.showToast(t('storage.flutter_legacy_delete_success', '旧版目录已删除'), 'success')
      } else {
        toast.showError(
          t('storage.flutter_legacy_delete_failed', '无法删除旧版目录，请稍后在存储设置中重试')
        )
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setErrorMessage(
        t('storage.flutter_legacy_migration_failed', {
          error: message,
          defaultValue: `迁移失败：${message}`
        })
      )
    } finally {
      setStarting(false)
    }
  }, [
    deleteMigratedLegacySource,
    dialog,
    flutterLegacyMigrationBusy,
    runFlutterLegacyMigration,
    starting,
    t,
    toast
  ])

  const showBootLoading = !dbReady
  const showMigrationRequired = !!pendingFlutterLegacyMigration && !flutterLegacyMigrationBusy

  return (
    <>
      {children}

      {showBootLoading ? (
        <View style={[styles.overlay, styles.bootLoading]}>
          <ActivityIndicator size="large" color={colors.textTertiary} />
        </View>
      ) : null}

      {flutterLegacyMigrationBusy ? (
        <RestoreBlockingOverlay
          visible
          message={t('storage.flutter_legacy_migrating', '正在从旧版目录复制数据…')}
          hint={
            flutterLegacyMigrationProgress
              ? t('storage.migrating_item', {
                  name: flutterLegacyMigrationProgress,
                  defaultValue: `正在复制：${flutterLegacyMigrationProgress}`
                })
              : t('storage.flutter_legacy_migrating_hint', '请勿关闭应用，原目录数据不会被删除')
          }
        />
      ) : null}

      {showMigrationRequired && pendingFlutterLegacyMigration ? (
        <SafeAreaView
          style={[styles.overlay, styles.screen, { backgroundColor: colors.bgSurface }]}
        >
          <View style={styles.content}>
            <View style={[styles.iconWrap, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="folder-shared" size={40} color="#D4924A" />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('storage.flutter_legacy_migration_required_title', '需要迁移旧版数据')}
            </Text>

            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t('storage.flutter_legacy_migration_required_message', {
                source: pendingFlutterLegacyMigration.sourceDisplayPath,
                target: pendingFlutterLegacyMigration.targetDisplayPath,
                defaultValue: `检测到您从旧版白守升级，日记仍在：\n${pendingFlutterLegacyMigration.sourceDisplayPath}\n\n请先将全部数据复制到新版目录：\n${pendingFlutterLegacyMigration.targetDisplayPath}\n\n我们会复制您的数据，不会删除原目录里的任何文件。迁移完成前无法使用应用。`
              })}
            </Text>

            <View style={[styles.notice, { backgroundColor: colors.bgSurface }]}>
              <MaterialIcons name="info-outline" size={18} color="#D4924A" />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                {t(
                  'storage.flutter_legacy_migration_no_delete_notice',
                  '迁移过程仅复制文件，不会删除或移动您原来的数据。'
                )}
              </Text>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Button
              variant="primary"
              className="w-full"
              onPress={() => void handleStartMigration()}
              disabled={starting}
            >
              {starting
                ? t('storage.flutter_legacy_migrating', '正在从旧版目录复制数据…')
                : t('storage.flutter_legacy_migration_confirm', '开始迁移')}
            </Button>
          </View>
        </SafeAreaView>
      ) : null}
    </>
  )
}

const BOOT_BACKGROUND = '#FFFFFF'

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000
  },
  bootLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BOOT_BACKGROUND
  },
  screen: {
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  content: {
    gap: 16,
    alignItems: 'stretch'
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left'
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  },
  errorText: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  }
})
