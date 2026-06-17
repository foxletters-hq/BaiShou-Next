import { Platform } from 'react-native'
import * as Sharing from 'expo-sharing'
import type { IFileSystem } from '@baishou/core-mobile'
import { basename } from '@baishou/core-mobile'
import { isExternalStoragePath, stripFileScheme, toFileUri } from '../services/android-external-fs'
import { getAppCacheDirectory } from '../services/mobile-app-paths'
import { deleteAsync } from '../services/mobile-sandbox-fs'

function guessMimeType(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    zip: 'application/zip'
  }
  return ext ? map[ext] : undefined
}

/**
 * 分享本地文件。Android 外部存储路径须先复制到应用 cache，expo-sharing 才允许读取。
 */
export async function shareLocalFile(
  fileSystem: IFileSystem,
  absolutePath: string,
  options?: { dialogTitle?: string; mimeType?: string; UTI?: string }
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('SHARE_UNAVAILABLE')
  }

  const sourcePath = stripFileScheme(absolutePath)
  if (!(await fileSystem.exists(sourcePath))) {
    throw new Error('FILE_NOT_FOUND')
  }

  const fileName = basename(sourcePath) || 'attachment'
  let shareUri = toFileUri(sourcePath)
  let tempCachePath: string | null = null

  if (Platform.OS === 'android' && isExternalStoragePath(sourcePath)) {
    tempCachePath = `${stripFileScheme(getAppCacheDirectory())}share_${Date.now()}_${fileName}`
    await fileSystem.copyFile(sourcePath, tempCachePath)
    shareUri = toFileUri(tempCachePath)
  }

  try {
    await Sharing.shareAsync(shareUri, {
      mimeType: options?.mimeType ?? guessMimeType(fileName),
      dialogTitle: options?.dialogTitle,
      UTI: options?.UTI
    })
  } finally {
    if (tempCachePath) {
      await deleteAsync(toFileUri(tempCachePath), { idempotent: true }).catch(() => {})
    }
  }
}
