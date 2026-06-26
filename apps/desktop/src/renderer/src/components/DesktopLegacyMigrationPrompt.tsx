import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDialog } from '@baishou/ui'

const LEGACY_MIGRATION_SETTINGS_PATH = '/settings/legacy-migration'

function isLegacyMigrationPromptExcludedPath(pathname: string): boolean {
  return (
    pathname === '/welcome' ||
    pathname.startsWith('/welcome/') ||
    pathname === LEGACY_MIGRATION_SETTINGS_PATH ||
    pathname.startsWith(`${LEGACY_MIGRATION_SETTINGS_PATH}/`)
  )
}

/**
 * 检测到旧版 Flutter 数据时，以非阻塞弹窗引导用户前往「版本迁移」。
 */
export function DesktopLegacyMigrationPrompt() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const navigate = useNavigate()
  const location = useLocation()
  const promptInFlightRef = useRef<Promise<void> | null>(null)
  const dialogShownRef = useRef(false)

  useEffect(() => {
    if (isLegacyMigrationPromptExcludedPath(location.pathname)) return
    if (dialogShownRef.current || promptInFlightRef.current) return

    promptInFlightRef.current = (async () => {
      try {
        const result = await window.api.onboarding.detectLegacyMigrationPending()
        const pending = result.pendingFlutterLegacyMigration
        if (!pending) return

        const migrate = await dialog.confirm(
          pending.inPlace
            ? t('settings.flutter_legacy_migration_prompt_message_in_place', {
                path: pending.sourceDisplayPath,
                defaultValue: `检测到旧版白守数据仍在当前目录：\n${pending.sourceDisplayPath}\n\n新版数据结构已变更，需要在此目录原位转换（合并 SQLite、注册表等），不会删除原文件。\n\n是否前往「版本迁移」按板块导入？`
              })
            : t('settings.flutter_legacy_migration_prompt_message', {
                source: pending.sourceDisplayPath,
                target: pending.targetDisplayPath,
                defaultValue: `检测到旧版白守的数据仍在：\n${pending.sourceDisplayPath}\n\n是否复制到新版目录？\n${pending.targetDisplayPath}\n\n迁移过程不会删除原目录。`
              }),
          {
            title: t('settings.flutter_legacy_migration_prompt_title', '发现旧版数据'),
            confirmText: t('settings.flutter_legacy_migration_settings_action', '从旧版白守迁移数据'),
            cancelText: t('legacy_migration.prompt_later', '稍后再说')
          }
        )

        dialogShownRef.current = true

        if (migrate) {
          navigate(LEGACY_MIGRATION_SETTINGS_PATH)
        } else {
          await window.api.onboarding.dismissLegacyMigrationPrompt()
        }
      } finally {
        promptInFlightRef.current = null
      }
    })()

    void promptInFlightRef.current
  }, [dialog, location.pathname, navigate, t])

  return null
}
