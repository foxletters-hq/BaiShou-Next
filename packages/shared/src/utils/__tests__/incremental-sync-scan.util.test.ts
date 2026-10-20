import { describe, expect, it } from 'vitest'
import {
  isIncrementalSyncChatBackgroundPath,
  isSqliteRuntimeSyncPath,
  isIncrementalSyncConflictBackupPath,
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '../incremental-sync-scan.util'

describe('incremental-sync-scan.util', () => {
  it('excludes sqlite runtime files from incremental sync', () => {
    expect(isSqliteRuntimeSyncPath('baishou_agent.db')).toBe(true)
    expect(isSqliteRuntimeSyncPath('baishou_agent.db-shm')).toBe(true)
    expect(isSqliteRuntimeSyncPath('baishou_agent.db-wal')).toBe(true)
    expect(isSqliteRuntimeSyncPath('Personal/shadow_index.db')).toBe(true)
    expect(isSqliteRuntimeSyncPath('Journals/a.md')).toBe(false)
    // 用户导入的 .db 资料不是运行时库
    expect(isSqliteRuntimeSyncPath('Personal/Notebooks/nb1/sources/data.db')).toBe(false)
    expect(isSqliteRuntimeSyncPath('Personal/Attachments/data.db')).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile('data.db', 'Personal/Notebooks/nb1/sources/data.db')
    ).toBe(true)
    expect(shouldIncludeIncrementalSyncFile('baishou_agent.db-shm', 'baishou_agent.db-shm')).toBe(
      false
    )
    expect(shouldIncludeIncrementalSyncFile('baishou_agent.db', 'baishou_agent.db')).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile(
        'shards.manifest.json',
        'Personal/Graph/nodes/shards.manifest.json'
      )
    ).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile(
        'shards.manifest.json',
        'Personal/Notebooks/nb1/graph/edges/shards.manifest.json'
      )
    ).toBe(false)
  })

  it('excludes chat background images from incremental sync', () => {
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/backgrounds')).toBe(true)
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/backgrounds/bg_1.jpg')).toBe(
      true
    )
    expect(isIncrementalSyncChatBackgroundPath('Personal/Attachments/avatars/a.png')).toBe(false)
    expect(
      shouldScanIncrementalSyncDirectory('backgrounds', 'Personal/Attachments/backgrounds')
    ).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile('bg_1.jpg', 'Personal/Attachments/backgrounds/bg_1.jpg')
    ).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile('photo.jpg', 'Personal/Attachments/diary/photo.jpg')
    ).toBe(true)
  })

  it('includes vault root files and settings domain json files', () => {
    expect(shouldIncludeIncrementalSyncFile('a.md', 'Journals/a.md')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile('ai_providers.json', '.baishou/settings/ai_providers.json')
    ).toBe(true)
    expect(shouldIncludeIncrementalSyncFile('settings.json', '.baishou/settings.json')).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('manifest.json', '.baishou/manifest.json')).toBe(false)
  })

  it('scans nested vault .baishou/settings', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', 'Personal/.baishou')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('settings', 'Personal/.baishou/settings')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile(
        'ai_providers.json',
        'Personal/.baishou/settings/ai_providers.json'
      )
    ).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', 'Personal/.baishou/sync-log')).toBe(false)
  })

  it('scans root .baishou/settings for global scope while excluding sync metadata', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', '.baishou')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('settings', '.baishou/settings')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile('ai_providers.json', '.baishou/settings/ai_providers.json')
    ).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', '.baishou/sync-log')).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('manifest.json', '.baishou/manifest.json')).toBe(false)
  })

  it('excludes device-local external_paths.json from incremental sync', () => {
    expect(
      shouldIncludeIncrementalSyncFile(
        'external_paths.json',
        'Personal/.baishou/external_paths.json'
      )
    ).toBe(false)
  })

  it('includes vault identity meta vault.json in incremental sync', () => {
    expect(shouldIncludeIncrementalSyncFile('vault.json', 'Personal/.baishou/vault.json')).toBe(
      true
    )
    expect(shouldIncludeIncrementalSyncFile('vault.json', '工作/.baishou/vault.json')).toBe(true)
    // 根 .baishou 下不应出现 vault.json；即便路径形似也不放行根级
    expect(shouldIncludeIncrementalSyncFile('vault.json', '.baishou/vault.json')).toBe(false)
  })

  it('excludes incremental sync conflict backup files from scan', () => {
    expect(
      isIncrementalSyncConflictBackupPath(
        'Personal/.baishou/settings/prompt_shortcuts.conflict-1782832223297.json'
      )
    ).toBe(true)
    expect(
      isIncrementalSyncConflictBackupPath(
        'prompt_shortcuts.conflict-1782832223297.conflict-1782853188027.json'
      )
    ).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile(
        'prompt_shortcuts.conflict-1782832223297.json',
        'Personal/.baishou/settings/prompt_shortcuts.conflict-1782832223297.json'
      )
    ).toBe(false)
    expect(
      shouldIncludeIncrementalSyncFile(
        'user_profile.json',
        'Personal/.baishou/settings/user_profile.json'
      )
    ).toBe(true)
  })

  it('scans root .agents/skills for cross-device user skills', () => {
    expect(shouldScanIncrementalSyncDirectory('.agents', '.agents')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('skills', '.agents/skills')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('demo', '.agents/skills/demo')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('.git', '.agents/skills/.git')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('other', '.agents/other')).toBe(false)
    expect(shouldIncludeIncrementalSyncFile('SKILL.md', '.agents/skills/demo/SKILL.md')).toBe(true)
    expect(
      shouldIncludeIncrementalSyncFile('asset.txt', '.agents/skills/demo/assets/asset.txt')
    ).toBe(true)
    // 仓内 .agents 不是全局技能目录
    expect(
      shouldIncludeIncrementalSyncFile('SKILL.md', 'Personal/.agents/skills/demo/SKILL.md')
    ).toBe(false)
  })

  it('excludes other root dot directories; root .baishou is scannable for settings', () => {
    expect(shouldScanIncrementalSyncDirectory('.baishou', '.baishou')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('sync-log', '.baishou/sync-log')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('.versions', '.versions')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('node_modules', 'node_modules')).toBe(false)
    expect(shouldScanIncrementalSyncDirectory('Sessions', 'Sessions')).toBe(true)
    expect(shouldScanIncrementalSyncDirectory('snapshots', 'snapshots')).toBe(false)
  })
})
