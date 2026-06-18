import { describe, expect, it } from 'vitest'
import { isLegacyMigrationPromptExcludedPath } from '../legacy-migration-prompt.util'

describe('isLegacyMigrationPromptExcludedPath', () => {
  it('excludes version migration and onboarding routes', () => {
    expect(isLegacyMigrationPromptExcludedPath('/settings/version-migration')).toBe(true)
    expect(isLegacyMigrationPromptExcludedPath('settings/version-migration')).toBe(true)
    expect(isLegacyMigrationPromptExcludedPath('/onboarding')).toBe(true)
    expect(isLegacyMigrationPromptExcludedPath('/onboarding/step-2')).toBe(true)
  })

  it('does not exclude main app routes', () => {
    expect(isLegacyMigrationPromptExcludedPath('/(tabs)')).toBe(false)
    expect(isLegacyMigrationPromptExcludedPath('/settings')).toBe(false)
    expect(isLegacyMigrationPromptExcludedPath(null)).toBe(false)
  })
})
