import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  resolveLegacyPreferencesForMigration,
  resolveLegacyPreferencesForSource
} from '../flutter-legacy-paths.service'
import {
  writeBsV3Fixture,
  writeSourceDevicePreferences,
  writeSourceSharedPreferences
} from '../../../../../../packages/core/src/migration/legacy-migration.fixture'

const mockDocuments = path.join(os.tmpdir(), 'baishou-flutter-legacy-docs')

vi.mock('electron', () => ({
  app: { getPath: vi.fn((name: string) => (name === 'documents' ? mockDocuments : mockDocuments)) }
}))

describe('flutter-legacy-paths.service', () => {
  let tempDir: string
  let sourceDir: string
  let originalAppData: string | undefined

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flutter-legacy-paths-'))
    sourceDir = path.join(tempDir, 'source')
    originalAppData = process.env.APPDATA
    process.env.APPDATA = path.join(tempDir, 'AppData', 'Roaming')
    await writeBsV3Fixture(sourceDir)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
    if (originalAppData === undefined) delete process.env.APPDATA
    else process.env.APPDATA = originalAppData
    vi.restoreAllMocks()
  })

  it('does not read machine SP when explicit dir has no prefs and fallback disabled', async () => {
    await fs.mkdir(path.join(process.env.APPDATA!, 'baishou'), { recursive: true })
    await fs.writeFile(
      path.join(process.env.APPDATA!, 'baishou', 'shared_preferences.json'),
      JSON.stringify({ 'flutter.user_personas': JSON.stringify({ 本机: { name: 'X' } }) })
    )
    const result = await resolveLegacyPreferencesForSource(sourceDir, {
      allowMachineSpFallback: false
    })
    expect(result.source).toBe('none')
    expect(result.sp).toBeNull()
    expect(result.config).toBeNull()
  })

  it('reads source shared_preferences.json when present', async () => {
    await writeSourceSharedPreferences(sourceDir, {
      备份身份: { name: 'SourceUser' }
    })
    const result = await resolveLegacyPreferencesForSource(sourceDir, {
      allowMachineSpFallback: false
    })
    expect(result.source).toBe('source_shared_preferences')
    expect(result.sp?.['user_personas']).toBeTruthy()
  })

  it('prefers device_preferences with optional source SP', async () => {
    await writeSourceDevicePreferences(sourceDir, {
      nickname: 'Nick',
      identity_facts: { name: 'Active' }
    })
    await writeSourceSharedPreferences(sourceDir, {
      完整身份: { name: 'Full' }
    })
    const result = await resolveLegacyPreferencesForSource(sourceDir, {
      allowMachineSpFallback: false
    })
    expect(result.source).toBe('device_preferences')
    expect(result.config?.['nickname']).toBe('Nick')
    expect(result.sp?.['user_personas']).toBeTruthy()
  })

  it('falls back to machine SP only when allowed and source dir has no prefs', async () => {
    await fs.mkdir(path.join(process.env.APPDATA!, 'baishou'), { recursive: true })
    await fs.writeFile(
      path.join(process.env.APPDATA!, 'baishou', 'shared_preferences.json'),
      JSON.stringify({
        'flutter.user_personas': JSON.stringify({ 本机身份: { name: 'Machine' } })
      })
    )
    const result = await resolveLegacyPreferencesForSource(sourceDir, {
      allowMachineSpFallback: true
    })
    expect(result.source).toBe('shared_preferences')
    expect(result.sp?.['user_personas']).toBeTruthy()
  })

  it('auto-detect mode (no dir) uses machine SP', async () => {
    await fs.mkdir(path.join(process.env.APPDATA!, 'baishou'), { recursive: true })
    await fs.writeFile(
      path.join(process.env.APPDATA!, 'baishou', 'shared_preferences.json'),
      JSON.stringify({
        'flutter.nickname': 'auto-user',
        'flutter.ai_provider': 'openai'
      })
    )
    const result = await resolveLegacyPreferencesForSource(undefined)
    expect(result.source).toBe('shared_preferences')
    expect(result.sp?.['nickname']).toBe('auto-user')
  })

  it('migration resolver supplements machine SP when explicit dir has no prefs', async () => {
    await fs.mkdir(path.join(process.env.APPDATA!, 'baishou'), { recursive: true })
    await fs.writeFile(
      path.join(process.env.APPDATA!, 'baishou', 'shared_preferences.json'),
      JSON.stringify({
        'flutter.user_personas': JSON.stringify({ 本机身份: { name: 'Machine' } }),
        'flutter.user_nickname': 'Nick'
      })
    )
    const result = await resolveLegacyPreferencesForMigration(sourceDir)
    expect(result.supplementedFromMachine).toBe(true)
    expect(result.sp?.['user_personas']).toBeTruthy()
    expect(result.config?.['nickname']).toBe('Nick')
  })
})
