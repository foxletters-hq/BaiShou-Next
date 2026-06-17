import { Platform } from 'react-native'

import { getAppDocumentDirectory } from './mobile-app-paths'
import { EXTERNAL_STORAGE_ROOT } from './storage-permission.service'

function normalizeNativePath(pathValue: string): string {
  if (pathValue.startsWith('file://')) {
    return pathValue
  }
  return `file://${pathValue}`
}

/** 旧版 Flutter 数据应迁入的新版默认根目录 */
export function resolveFlutterLegacyMigrationTargetRoot(): string {
  if (Platform.OS === 'android') {
    return normalizeNativePath(EXTERNAL_STORAGE_ROOT)
  }
  return normalizeNativePath(`${getAppDocumentDirectory()}BaiShou_Root`)
}

export async function resolveMobileMigrationTargetRoot(
  getRootDirectory: () => Promise<string>
): Promise<string | null> {
  if (Platform.OS === 'android') {
    return resolveFlutterLegacyMigrationTargetRoot()
  }

  try {
    return await getRootDirectory()
  } catch {
    return `${getAppDocumentDirectory()}BaiShou_Root`
  }
}

export function resolveIosFlutterPreferencesPlistPath(): string {
  const doc = getAppDocumentDirectory()
  return doc.replace(/Documents\/?$/, 'Library/Preferences/com.baishou.baishou.plist')
}
