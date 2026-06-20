import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as flutterLegacyPaths from '../flutter-legacy-paths.service'
import {
  resolveLegacyPreferencesForMigration,
  resolveLegacyPreferencesForSource,
  readFlutterSharedPreferencesRaw,
  resolveVersionMigrationFlutterPrefs
} from '../flutter-legacy-paths.service'
import {
  writeBsV3Fixture,
  writeSourceDevicePreferences,
  writeSourceSharedPreferences
} from '../../../../../../packages/core/src/migration/legacy-migration.fixture'

const mockDocuments = path.join(os.tmpdir(), 'baishou-flutter-legacy-docs')

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'temp') return path.join(os.tmpdir(), 'baishou-desktop-migration-temp')
      return mockDocuments
    })
  }
}))

describe('flutter-legacy-paths.service', () => {
  let tempDir: string
  let sourceDir: string
  let machineSpPath: string
  let machineSpBackup: Buffer | null
  let machineSpExisted: boolean
  let originalAppData: string | undefined

  async function writeMachineSharedPreferences(data: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(machineSpPath), { recursive: true })
    await fs.writeFile(machineSpPath, JSON.stringify(data))
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flutter-legacy-paths-'))
    sourceDir = path.join(tempDir, 'source')
    machineSpPath = flutterLegacyPaths.resolveFlutterSharedPreferencesCandidates()[0]!
    originalAppData = process.env.APPDATA
    process.env.APPDATA = path.join(tempDir, 'AppData', 'Roaming')
    try {
      machineSpBackup = await fs.readFile(machineSpPath)
      machineSpExisted = true
    } catch {
      machineSpBackup = null
      machineSpExisted = false
    }
    await writeBsV3Fixture(sourceDir)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
    if (machineSpExisted && machineSpBackup) {
      await fs.mkdir(path.dirname(machineSpPath), { recursive: true })
      await fs.writeFile(machineSpPath, machineSpBackup)
    } else {
      await fs.rm(machineSpPath, { force: true }).catch(() => null)
    }
    if (originalAppData === undefined) delete process.env.APPDATA
    else process.env.APPDATA = originalAppData
    vi.restoreAllMocks()
  })

  it('does not read machine SP when explicit dir has no prefs and fallback disabled', async () => {
    await writeMachineSharedPreferences({
      'flutter.user_personas': JSON.stringify({ 本机: { name: 'X' } })
    })
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
    await writeMachineSharedPreferences({
      'flutter.user_personas': JSON.stringify({ 本机身份: { name: 'Machine' } })
    })
    const result = await resolveLegacyPreferencesForSource(sourceDir, {
      allowMachineSpFallback: true
    })
    expect(result.source).toBe('shared_preferences')
    expect(result.sp?.['user_personas']).toBeTruthy()
  })

  it('auto-detect mode (no dir) uses machine SP', async () => {
    await writeMachineSharedPreferences({
      'flutter.nickname': 'auto-user',
      'flutter.ai_provider': 'openai'
    })
    const result = await resolveLegacyPreferencesForSource(undefined)
    expect(result.source).toBe('shared_preferences')
    expect(result.sp?.['nickname']).toBe('auto-user')
  })

  it('migration resolver supplements machine SP when explicit dir has no prefs', async () => {
    await writeMachineSharedPreferences({
      'flutter.user_personas': JSON.stringify({ 本机身份: { name: 'Machine' } }),
      'flutter.user_nickname': 'Nick'
    })
    const result = await resolveLegacyPreferencesForMigration(sourceDir)
    expect(result.supplementedFromMachine).toBe(true)
    expect(result.sp?.['user_personas']).toBeTruthy()
    expect(result.config?.['nickname']).toBe('Nick')
  })

  it('reads original Flutter Windows shared_preferences path (com.baishou/baishou)', async () => {
    await writeMachineSharedPreferences({
      'flutter.user_personas': JSON.stringify({
        默认身份: { 姓名: 'Anson', 职业: '全栈开发' }
      }),
      'flutter.custom_storage_root': sourceDir
    })
    const sp = await readFlutterSharedPreferencesRaw()
    expect(sp?.['user_personas']).toBeTruthy()
    const result = await resolveVersionMigrationFlutterPrefs(sourceDir)
    expect(result.supplementedFromMachine).toBe(true)
    const personas = JSON.parse(String(result.sp?.['user_personas']))
    expect(personas['默认身份']).toBeTruthy()
  })

  it('resolveVersionMigrationFlutterPrefs derives config when only machine SP exists', async () => {
    await writeMachineSharedPreferences({
      'flutter.user_nickname': 'Desktop',
      'flutter.global_dialogue_provider_id': 'openai'
    })
    const result = await resolveVersionMigrationFlutterPrefs(sourceDir)
    expect(result.sp?.['user_nickname']).toBe('Desktop')
    expect(result.config?.['nickname']).toBe('Desktop')
    expect(result.supplementedFromMachine).toBe(true)
  })

  it('migration resolver keeps machine personas when source SP has empty user_personas', async () => {
    await fs.writeFile(
      path.join(sourceDir, 'shared_preferences.json'),
      JSON.stringify({
        'flutter.user_personas': '',
        'flutter.user_nickname': 'SourceNick'
      })
    )
    await writeMachineSharedPreferences({
      'flutter.user_personas': JSON.stringify({ 机器身份: { name: 'Machine' } })
    })
    const result = await resolveLegacyPreferencesForMigration(sourceDir)
    const personas = JSON.parse(String(result.sp?.['user_personas']))
    expect(personas['机器身份']).toBeTruthy()
    expect(result.sp?.['user_nickname']).toBe('SourceNick')
  })
})
