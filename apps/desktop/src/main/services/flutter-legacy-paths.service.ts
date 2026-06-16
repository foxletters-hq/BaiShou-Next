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

export function resolveFlutterSharedPreferencesCandidates(): string[] {
  const candidates: string[] = []
  if (process.platform === 'linux') {
    candidates.push(join(homedir(), '.local/share/baishou/shared_preferences.json'))
    candidates.push(join(homedir(), '.local/share/com.baishou.baishou/shared_preferences.json'))
  } else if (process.platform === 'darwin') {
    candidates.push(
      join(homedir(), 'Library/Application Support/baishou/shared_preferences.json')
    )
    candidates.push(
      join(
        homedir(),
        'Library/Application Support/com.baishou.baishou/shared_preferences.json'
      )
    )
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
    candidates.push(join(appData, 'baishou', 'shared_preferences.json'))
    candidates.push(join(appData, 'com.baishou.baishou', 'shared_preferences.json'))
  }
  return candidates
}

export async function readFlutterSharedPreferencesRaw(): Promise<Record<string, unknown> | null> {
  for (const candidate of resolveFlutterSharedPreferencesCandidates()) {
    if (!existsSync(candidate)) continue
    try {
      const raw = await fs.readFile(candidate, 'utf8')
      return parseFlutterSharedPreferencesJson(raw)
    } catch {
      // try next candidate
    }
  }
  return null
}

export async function readFlutterSharedPreferencesConfig(): Promise<Record<string, unknown> | null> {
  const sp = await readFlutterSharedPreferencesRaw()
  if (!sp) return null
  const config = assembleDevicePreferencesFromFlutterSp(sp)
  return hasMeaningfulFlutterPreferences(config) ? config : null
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
