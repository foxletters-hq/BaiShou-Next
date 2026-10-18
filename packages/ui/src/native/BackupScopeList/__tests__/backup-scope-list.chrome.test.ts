import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../BackupScopeList.tsx'), 'utf8')

describe('native BackupScopeList layout and structure', () => {
  it('should use CollapsibleHeight for smooth expand/collapse transition', () => {
    expect(src).toContain('CollapsibleHeight')
    expect(src).toContain('defaultExpanded')
    expect(src).toContain('collapsible')
  })

  it('should separate scope into structured semantic sections rather than a cramped flat list', () => {
    // 包含内容区块与专属图标卡片
    expect(src).toContain('backup_scope_included_heading')
    expect(src).toContain('backup_scope_root')
    expect(src).toContain('backup_scope_database')
    expect(src).toContain('backup_scope_database_detail')
    expect(src).toContain('backup_scope_device_prefs')

    // 不包含区块
    expect(src).toContain('backup_scope_excludes_heading')
    expect(src).toContain('backup_scope_excludes_shadow')
    expect(src).toContain('backup_scope_excludes_sync_meta')

    // 机制与注意事项
    expect(src).toContain('backup_scope_notes_heading')
    expect(src).toContain('backup_scope_not_incremental')
    expect(src).toContain('backup_scope_import_note')
  })

  it('should pair database detail as subtitle under database title', () => {
    expect(src).toContain('backup_scope_database')
    expect(src).toContain('backup_scope_database_detail')
    expect(src).toContain('itemSecondaryText')
  })

  it('should support fallback for future unknown keys', () => {
    expect(src).toContain('fallbackExtraKeys')
  })
})
