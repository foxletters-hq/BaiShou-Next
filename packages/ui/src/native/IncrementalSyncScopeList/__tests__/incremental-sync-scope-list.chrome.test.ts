import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../IncrementalSyncScopeList.tsx'), 'utf8')

describe('native IncrementalSyncScopeList layout and structure', () => {
  it('should use CollapsibleHeight for smooth expand/collapse transition', () => {
    expect(src).toContain('CollapsibleHeight')
    expect(src).toContain('defaultExpanded')
    expect(src).toContain('collapsible')
  })

  it('should group scope items into semantic categories rather than a cramped flat list', () => {
    // 工作区与写作内容
    expect(src).toContain('incremental_group_content')
    expect(src).toContain('incremental_sync_scope_all_vaults')
    expect(src).toContain('incremental_sync_scope_diary')
    expect(src).toContain('incremental_sync_scope_summary')
    expect(src).toContain('incremental_sync_scope_attachments')

    // 智能体与伙伴
    expect(src).toContain('incremental_group_agent')
    expect(src).toContain('incremental_sync_scope_sessions')
    expect(src).toContain('incremental_sync_scope_partners')

    // 配置与空间注册表
    expect(src).toContain('incremental_group_config')
    expect(src).toContain('incremental_sync_scope_settings')
    expect(src).toContain('incremental_sync_scope_registry')
  })

  it('should display mechanism intro and notice callouts', () => {
    expect(src).toContain('sync_mode_comparison_incremental_desc')
    expect(src).toContain('incremental_sync_notice_title')
    expect(src).toContain('incremental_sync_scope_notice')
  })

  it('should support hideTitle prop and fallback for extra unknown keys', () => {
    expect(src).toContain('hideTitle')
    expect(src).toContain('fallbackExtraKeys')
  })
})
