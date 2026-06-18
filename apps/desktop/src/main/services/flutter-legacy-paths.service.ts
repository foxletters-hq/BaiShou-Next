import fs from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { app } from 'electron'
import {
  assembleDevicePreferencesFromFlutterSp,
  extractFlutterCustomStorageRoot,
  hasMeaningfulFlutterPreferences,
  parseFlutterSharedPreferencesJson
} from '@baishou/core/shared'
import { createNodeFileSystem, isLegacyAppRoot } from '@baishou/core-desktop'

export interface VersionMigrationFlutterPrefs {
  config: Record<string, unknown> | null
  sp: Record<string, unknown> | null
  supplementedFromMachine: boolean
}

function deriveConfigFromSp(sp: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!sp) return null
  const assembled = assembleDevicePreferencesFromFlutterSp(sp)
  return hasMeaningfulFlutterPreferences(assembled) ? assembled : null
}

function hasMeaningfulSpValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

function mergeFlutterSharedPreferences(
  machineSp: Record<string, unknown>,
  sourceSp: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...machineSp }
  for (const [key, value] of Object.entries(sourceSp)) {
    if (hasMeaningfulSpValue(value)) {
      merged[key] = value
    }
  }
  return merged
}

/**
 * 版本迁移扫描/导入：合并目录与本机 SP，并在仅有 SP 时推导 config（对齐移动端）。
 */
export async function resolveVersionMigrationFlutterPrefs(
  sourceDir: string
): Promise<VersionMigrationFlutterPrefs> {
  const prefs = await resolveLegacyPreferencesForMigration(sourceDir)
  let sp = prefs.sp
  let config = prefs.config ?? deriveConfigFromSp(sp)

  if (!config && !sp) {
    const machineSp = await readFlutterSharedPreferencesRaw()
    if (machineSp) {
      sp = machineSp
      config = deriveConfigFromSp(machineSp)
    }
  }

  return {
    sp,
    config,
    supplementedFromMachine:
      prefs.supplementedFromMachine || Boolean(prefs.sp == null && sp != null)
  }
}

export function resolveFlutterSharedPreferencesCandidates(): string[] {
  const candidates: string[] = []
  if (process.platform === 'linux') {
    candidates.push(join(homedir(), '.local/share/com.baishou/baishou/shared_preferences.json'))
    candidates.push(join(homedir(), '.local/share/baishou/shared_preferences.json'))
    candidates.push(join(homedir(), '.local/share/com.baishou.baishou/shared_preferences.json'))
  } else if (process.platform === 'darwin') {
    candidates.push(
      join(homedir(), 'Library/Application Support/com.baishou/baishou/shared_preferences.json')
    )
    candidates.push(join(homedir(), 'Library/Application Support/baishou/shared_preferences.json'))
    candidates.push(
      join(homedir(), 'Library/Application Support/com.baishou.baishou/shared_preferences.json')
    )
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    // 原版 Flutter 桌面白守（CompanyName=com.baishou, 应用名=baishou）
    candidates.push(join(appData, 'com.baishou', 'baishou', 'shared_preferences.json'))
    candidates.push(join(appData, 'com.baishou.baishou', 'shared_preferences.json'))
    candidates.push(join(appData, 'baishou', 'shared_preferences.json'))
  }
  return candidates
}

function scoreFlutterPrefsForMigration(sp: Record<string, unknown>): number {
  let score = 0
  if (sp['user_personas']) score += 10
  if (sp['user_identity_facts']) score += 5
  if (sp['custom_storage_root']) score += 3
  if (sp['user_nickname']) score += 1
  if (sp['ai_providers_list']) score += 1
  return score
}

export async function readFlutterSharedPreferencesRaw(): Promise<Record<string, unknown> | null> {
  let best: Record<string, unknown> | null = null
  let bestScore = -1

  for (const candidate of resolveFlutterSharedPreferencesCandidates()) {
    if (!existsSync(candidate)) continue
    try {
      const raw = await fs.readFile(candidate, 'utf8')
      const parsed = parseFlutterSharedPreferencesJson(raw)
      const score = scoreFlutterPrefsForMigration(parsed)
      if (score > bestScore) {
        best = parsed
        bestScore = score
      }
    } catch {
      // try next candidate
    }
  }

  return best
}

export async function readFlutterSharedPreferencesConfig(): Promise<Record<
  string,
  unknown
> | null> {
  const sp = await readFlutterSharedPreferencesRaw()
  if (!sp) return null
  const config = assembleDevicePreferencesFromFlutterSp(sp)
  return hasMeaningfulFlutterPreferences(config) ? config : null
}

export interface ResolvedLegacyPreferences {
  sp: Record<string, unknown> | null
  config: Record<string, unknown> | null
  source: 'device_preferences' | 'source_shared_preferences' | 'shared_preferences' | 'none'
}

export interface ResolvedLegacyMigrationPreferences extends ResolvedLegacyPreferences {
  /** 目录内无 SP/配置时，是否从本机 Flutter 安装目录补充了头像/身份/配置数据 */
  supplementedFromMachine: boolean
}

async function readSharedPreferencesFromSourceDir(
  sourceDir: string
): Promise<Record<string, unknown> | null> {
  const candidates = [
    join(sourceDir, 'config', 'shared_preferences.json'),
    join(sourceDir, 'shared_preferences.json')
  ]
  for (const prefsPath of candidates) {
    if (!existsSync(prefsPath)) continue
    try {
      const raw = await fs.readFile(prefsPath, 'utf8')
      return parseFlutterSharedPreferencesJson(raw)
    } catch {
      // try next candidate
    }
  }
  return null
}

/**
 * 优先从用户选定的旧版根目录读取配置；
 * 顺序：device_preferences.json → 目录内 shared_preferences.json →（可选）本机 Flutter SP。
 */
export async function resolveLegacyPreferencesForSource(
  sourceDir?: string,
  options?: { allowMachineSpFallback?: boolean }
): Promise<ResolvedLegacyPreferences> {
  const dir = sourceDir?.trim()
  const sourceSp = dir ? await readSharedPreferencesFromSourceDir(dir) : null

  if (dir) {
    const prefsPath = join(dir, 'config', 'device_preferences.json')
    if (existsSync(prefsPath)) {
      try {
        const raw = await fs.readFile(prefsPath, 'utf8')
        const config = JSON.parse(raw) as Record<string, unknown>
        if (hasMeaningfulFlutterPreferences(config)) {
          return { sp: sourceSp, config, source: 'device_preferences' }
        }
      } catch {
        // fall through
      }
    }
  }

  if (sourceSp) {
    const config = assembleDevicePreferencesFromFlutterSp(sourceSp)
    return {
      sp: sourceSp,
      config: hasMeaningfulFlutterPreferences(config) ? config : null,
      source: 'source_shared_preferences'
    }
  }

  const allowMachineFallback = options?.allowMachineSpFallback ?? !dir
  if (!allowMachineFallback) {
    return { sp: null, config: null, source: 'none' }
  }

  const sp = await readFlutterSharedPreferencesRaw()
  if (!sp) {
    return { sp: null, config: null, source: 'none' }
  }
  const config = assembleDevicePreferencesFromFlutterSp(sp)
  return {
    sp,
    config: hasMeaningfulFlutterPreferences(config) ? config : null,
    source: 'shared_preferences'
  }
}

/**
 * 版本迁移专用：优先读用户选定旧版目录内的配置，缺失时从本机 Flutter SP 补充。
 * 工作区文件仍以 sourceDir 为准，仅头像/身份卡/配置允许本机补充。
 */
export async function resolveLegacyPreferencesForMigration(
  sourceDir: string
): Promise<ResolvedLegacyMigrationPreferences> {
  const fromSource = await resolveLegacyPreferencesForSource(sourceDir, {
    allowMachineSpFallback: false
  })
  const fromMachine = await resolveLegacyPreferencesForSource(undefined, {
    allowMachineSpFallback: true
  })

  if (fromMachine.source === 'none') {
    return { ...fromSource, supplementedFromMachine: false }
  }

  let sp = fromSource.sp
  let config = fromSource.config
  let source = fromSource.source
  let supplementedFromMachine = false

  if (!sp && fromMachine.sp) {
    sp = fromMachine.sp
    supplementedFromMachine = true
    if (source === 'none') source = fromMachine.source
  } else if (sp && fromMachine.sp) {
    sp = mergeFlutterSharedPreferences(fromMachine.sp, sp)
    supplementedFromMachine = true
    if (!config) {
      config = deriveConfigFromSp(sp)
    }
  }

  if (!config && fromMachine.config) {
    config = fromMachine.config
    supplementedFromMachine = true
    if (source === 'none') source = fromMachine.source
  } else if (!config && fromMachine.sp) {
    config = deriveConfigFromSp(fromMachine.sp)
    if (config) supplementedFromMachine = true
  } else if (
    config &&
    fromMachine.config &&
    fromSource.source === 'device_preferences' &&
    !fromSource.sp
  ) {
    supplementedFromMachine = true
  }

  return { sp, config, source, supplementedFromMachine }
}

export function resolveFlutterDocumentsAvatarsDir(): string {
  return join(app.getPath('documents'), 'avatars')
}

/**
 * 探测旧版 Flutter 工作区根目录候选（自定义路径优先，其次默认 Documents）。
 */
export async function resolveLegacyRootCandidates(): Promise<string[]> {
  const candidates: string[] = []
  const sp = await readFlutterSharedPreferencesRaw()
  if (sp) {
    const customRoot = extractFlutterCustomStorageRoot(sp)
    if (customRoot) candidates.push(customRoot)
  }

  candidates.push(join(app.getPath('documents'), 'BaiShou_Root'))

  const fileSystem = createNodeFileSystem()
  const unique: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, '/').replace(/\/$/, '')
    if (seen.has(normalized)) continue
    seen.add(normalized)
    try {
      if (await isLegacyAppRoot(fileSystem, candidate)) {
        unique.push(candidate)
      }
    } catch {
      // ignore unreadable
    }
  }
  return unique
}
