import React, { useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePathname, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import {
  LEGACY_MIGRATION_PROMPT_DISMISSED_KEY,
  ONBOARDING_STORAGE_KEY
} from '../constants/storage'
import {
  isLegacyMigrationPromptExcludedPath,
  LEGACY_MIGRATION_PROMPT_VERSION_MIGRATION_PATH
} from '../lib/legacy-migration-prompt.util'

/**
 * 检测到旧版 Flutter 数据时，以非阻塞弹窗引导用户前往「版本迁移」。
 * 不拦截主界面；用户选择「稍后再说」后不再自动弹出（仍可在设置中手动进入）。
 */
export function LegacyMigrationPrompt() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const router = useRouter()
  const pathname = usePathname()
  const { dbReady, pendingFlutterLegacyMigration } = useBaishou()
  const promptInFlightRef = useRef<Promise<void> | null>(null)
  const dialogShownRef = useRef(false)

  useEffect(() => {
    if (!dbReady || !pendingFlutterLegacyMigration) return
    if (isLegacyMigrationPromptExcludedPath(pathname)) return
    if (dialogShownRef.current || promptInFlightRef.current) return

    promptInFlightRef.current = (async () => {
      try {
        const hasOnboarded = (await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)) === '1'
        if (!hasOnboarded) return

        const dismissed =
          (await AsyncStorage.getItem(LEGACY_MIGRATION_PROMPT_DISMISSED_KEY)) === '1'
        if (dismissed) return

        dialogShownRef.current = true

        const migrate = await dialog.confirm(
          t('legacy_migration.prompt_message', {
            source: pendingFlutterLegacyMigration.sourceDisplayPath,
            defaultValue: `检测到旧版白守数据，仍在：\n${pendingFlutterLegacyMigration.sourceDisplayPath}\n\n导入过程仅复制文件，不会删除原目录。是否现在前往「版本迁移」按板块导入？`
          }),
          {
            title: t('legacy_migration.prompt_title', '导入旧版数据'),
            confirmText: t('legacy_migration.prompt_migrate', '去导入'),
            cancelText: t('legacy_migration.prompt_later', '稍后再说')
          }
        )

        if (migrate) {
          router.push(LEGACY_MIGRATION_PROMPT_VERSION_MIGRATION_PATH)
        } else {
          await AsyncStorage.setItem(LEGACY_MIGRATION_PROMPT_DISMISSED_KEY, '1')
        }
      } finally {
        promptInFlightRef.current = null
      }
    })()

    void promptInFlightRef.current
  }, [dbReady, dialog, pathname, pendingFlutterLegacyMigration, router, t])

  return null
}
