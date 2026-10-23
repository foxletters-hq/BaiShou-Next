import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const kotlinSrc = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../modules/expo-baishou-server/android/src/main/java/expo/modules/baishouserver/IncrementalSyncScanRules.kt'
  ),
  'utf8'
)

describe('IncrementalSyncScanRules.kt', () => {
  it('should scan root .baishou and include vault identity meta', () => {
    expect(kotlinSrc).toContain('isRootBaishouDirectory')
    expect(kotlinSrc).toContain('return true')
    expect(kotlinSrc).toContain('isVaultIdentityMetaRelPath')
    expect(kotlinSrc).toContain('vault.json')
    expect(kotlinSrc).toContain('isIncrementalSyncChatBackgroundPath')
    expect(kotlinSrc).toContain('isIncrementalSyncConflictBackupPath')
    expect(kotlinSrc).not.toContain('isRootSyncMetaDirectory')
  })

  it('should scan root .agents/skills and narrow sqlite runtime exclusion', () => {
    expect(kotlinSrc).toContain('ROOT_AGENTS_SKILLS_PREFIX')
    expect(kotlinSrc).toContain('isRootAgentsSkillsTree')
    expect(kotlinSrc).toContain('USER_CONTENT_SYNC_DIR_REGEX')
    expect(kotlinSrc).toContain('KNOWN_RUNTIME_SQLITE_DB_NAMES')
  })
})
