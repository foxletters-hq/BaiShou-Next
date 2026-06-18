import { describe, it, expect, vi } from 'vitest'
import {
  formatMigrationMegabytes,
  normalizeImportedSectionIds,
  normalizeLegacyPartType,
  parseLegacyPersonasFromSp,
  resolveLegacyIdentityPersonas,
  resolveLegacyVaultTargetName,
  resolveUniqueNameWithTwoDigitSuffix
} from '../legacy-version-migration.util'

describe('legacy-version-migration.util', () => {
  it('formatMigrationMegabytes formats bytes to MB', () => {
    expect(formatMigrationMegabytes(0)).toBe('0 MB')
    expect(formatMigrationMegabytes(512 * 1024)).toMatch(/MB$/)
    expect(formatMigrationMegabytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })

  it('resolveUniqueNameWithTwoDigitSuffix appends two digits on conflict', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const existing = new Set(['旅行者'])
    const resolved = resolveUniqueNameWithTwoDigitSuffix('旅行者', existing)
    expect(resolved).toMatch(/^旅行者\d{2}$/)
    expect(resolved).not.toBe('旅行者')
    vi.restoreAllMocks()
  })

  it('parseLegacyPersonasFromSp reads user_personas JSON', () => {
    const sp = {
      user_personas: JSON.stringify({
        工作: { 职业: '工程师' },
        生活: { 城市: '上海' }
      })
    }
    const personas = parseLegacyPersonasFromSp(sp)
    expect(personas).toHaveLength(2)
    expect(personas[0]?.facts).toEqual({ 职业: '工程师' })
  })

  it('resolveLegacyIdentityPersonas reads user_personas from config when SP lacks personas', () => {
    const sp = { user_nickname: 'Nick', global_dialogue_provider_id: 'openai' }
    const config = {
      user_personas: JSON.stringify({ 工作: { 职业: '工程师' } })
    }
    const personas = resolveLegacyIdentityPersonas(sp, config)
    expect(personas).toHaveLength(1)
    expect(personas[0]?.id).toBe('工作')
  })

  it('resolveLegacyIdentityPersonas falls back to identity_facts in device_preferences', () => {
    const personas = resolveLegacyIdentityPersonas(null, {
      identity_facts: { name: 'Anson', role: 'dev' }
    })
    expect(personas).toHaveLength(1)
    expect(personas[0]?.facts.name).toBe('Anson')
  })

  it('resolveLegacyIdentityPersonas reads array identity_facts', () => {
    const personas = resolveLegacyIdentityPersonas(null, {
      identity_facts: ['喜欢写日记', '住在上海']
    })
    expect(personas).toHaveLength(1)
    expect(personas[0]?.facts).toEqual({
      '1': '喜欢写日记',
      '2': '住在上海'
    })
  })

  it('normalizeLegacyPartType maps legacy camelCase types', () => {
    expect(normalizeLegacyPartType('contextSnapshot')).toBe('context_snapshot')
    expect(normalizeLegacyPartType('text')).toBe('text')
  })

  it('resolveLegacyVaultTargetName appends suffix when vault name already exists', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const existing = new Set(['Personal'])
    expect(resolveLegacyVaultTargetName('Personal', existing, {})).toMatch(/^Personal\d{2}$/)
    expect(resolveLegacyVaultTargetName('Personal', existing, { Personal: 'Personal42' })).toBe(
      'Personal42'
    )
    expect(resolveLegacyVaultTargetName('工作', existing, {})).toBe('工作')
    vi.restoreAllMocks()
  })

  it('resolveLegacyVaultTargetName ignores stale same-name stored map when vault exists', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const existing = new Set(['Personal'])
    expect(resolveLegacyVaultTargetName('Personal', existing, { Personal: 'Personal' })).toMatch(
      /^Personal\d{2}$/
    )
    vi.restoreAllMocks()
  })

  it('normalizeImportedSectionIds maps legacy flat workspace section ids', () => {
    const normalized = normalizeImportedSectionIds(
      ['avatar', 'diaries', 'assistants', 'workspace:Personal'],
      ['Personal', 'Work']
    )
    expect(normalized).toContain('avatar')
    expect(normalized).toContain('workspace:Personal')
    expect(normalized).toContain('workspace:Work')
    expect(normalized).not.toContain('diaries' as never)
  })
})

describe('vault-scoped assistant id map', () => {
  it('scopes and filters assistant id map per legacy vault', async () => {
    const { filterAssistantIdMapForVault, scopeAssistantIdMapForVault } = await import(
      '../legacy-version-migration.util'
    )
    const global = {
      'Personal::old-a': 'new-a',
      '工作::old-b': 'new-b',
      legacy: 'mapped'
    }
    expect(filterAssistantIdMapForVault(global, 'Personal')).toEqual({
      'old-a': 'new-a',
      legacy: 'mapped'
    })
    expect(scopeAssistantIdMapForVault({ 'old-c': 'new-c' }, 'Personal')).toEqual({
      'Personal::old-c': 'new-c'
    })
  })
})
