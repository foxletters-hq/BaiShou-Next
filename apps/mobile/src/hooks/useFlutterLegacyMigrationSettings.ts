import { useBaishou } from '../providers/BaishouProvider'

/** 设置页：是否展示「从旧版迁移」入口 */
export function useFlutterLegacyMigrationSettings() {
  const { pendingFlutterLegacyMigration } = useBaishou()

  return {
    showMigrateFromFlutterLegacy: !!pendingFlutterLegacyMigration
  }
}
