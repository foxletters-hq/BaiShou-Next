import { Platform } from 'react-native'
import type { IFileSystem } from '@baishou/core-mobile'
import { joinPath } from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { writeAsStringAsync } from './mobile-sandbox-fs'
import { stripFileScheme, toFileUri } from './android-external-fs'

const NOMEDIA_FILE = '.nomedia'

/** 在目录下写入 .nomedia，阻止 Android 相册/MediaStore 索引该目录及子目录 */
export async function ensureAndroidNoMediaMarker(
  dirPath: string,
  fileSystem: IFileSystem
): Promise<void> {
  if (Platform.OS !== 'android') return

  const normalizedDir = stripFileScheme(dirPath).replace(/\/+$/, '')
  const markerPath = joinPath(normalizedDir, NOMEDIA_FILE)

  try {
    if (await fileSystem.exists(markerPath)) return
    await fileSystem.writeFile(markerPath, '')
  } catch (e) {
    console.warn('[NoMedia] failed to create .nomedia in', normalizedDir, e)
  }
}

let appCacheNoMediaEnsured = false

/** 应用 cache 目录写入 .nomedia，避免裁剪/压缩临时图被 MIUI 等相册扫描 */
export async function ensureAppCacheNoMediaMarker(): Promise<void> {
  if (Platform.OS !== 'android' || appCacheNoMediaEnsured) return

  const cacheDir = stripFileScheme(getAppCacheDirectory()).replace(/\/+$/, '')
  const markerUri = toFileUri(joinPath(cacheDir, NOMEDIA_FILE))

  try {
    await writeAsStringAsync(markerUri, '')
    appCacheNoMediaEnsured = true
  } catch (e) {
    console.warn('[NoMedia] failed to create .nomedia in app cache', e)
  }
}
