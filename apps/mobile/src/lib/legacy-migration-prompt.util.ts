export const LEGACY_MIGRATION_PROMPT_VERSION_MIGRATION_PATH = '/settings/version-migration'
export const LEGACY_MIGRATION_PROMPT_ONBOARDING_PATH = '/onboarding'

function normalizePathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** 当前路由下不应弹出旧版迁移引导（用户已在迁移页或引导页）。 */
export function isLegacyMigrationPromptExcludedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = normalizePathname(pathname)
  return (
    normalized === LEGACY_MIGRATION_PROMPT_VERSION_MIGRATION_PATH ||
    normalized.startsWith(`${LEGACY_MIGRATION_PROMPT_VERSION_MIGRATION_PATH}/`) ||
    normalized === LEGACY_MIGRATION_PROMPT_ONBOARDING_PATH ||
    normalized.startsWith(`${LEGACY_MIGRATION_PROMPT_ONBOARDING_PATH}/`)
  )
}
