import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { ATTACHMENT_PREVIEW_MAX_BYTES } from './mobile-attachment-image-cache'
import { resolveAttachmentImageDataUri } from './mobile-attachment-image-resolver'
import {
  externalGetInfoSafe,
  externalReadB64Safe,
  isExternalStoragePath,
  normalizeExternalStoragePath
} from '../services/android-external-fs'

/** fileName → 绝对路径，避免重复全库扫描 */
const diaryAttachmentAbsPathCache = new Map<string, string>()

export function clearDiaryAttachmentAbsPathCache(): void {
  diaryAttachmentAbsPathCache.clear()
}

function rememberAbsPath(fileName: string, absPath: string): string {
  diaryAttachmentAbsPathCache.set(fileName, absPath)
  return absPath
}

function guessImageMimeType(fileName: string): string {
  if (/\.png$/i.test(fileName)) return 'image/png'
  if (/\.gif$/i.test(fileName)) return 'image/gif'
  if (/\.webp$/i.test(fileName)) return 'image/webp'
  if (/\.bmp$/i.test(fileName)) return 'image/bmp'
  return 'image/jpeg'
}

export async function resolveDiaryAttachmentAbsPath(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  date: Date,
  attachmentSrc: string
): Promise<string | null> {
  const fileName = attachmentSrc.replace(/^attachment\//, '')
  if (!fileName) return null

  const cachedPath = diaryAttachmentAbsPathCache.get(fileName)
  if (cachedPath && (await fileSystem.exists(cachedPath))) {
    return cachedPath
  }

  const primaryDir = await pathService.getDiaryAttachmentDirectory(date)
  const primaryPath = normalizeExternalStoragePath(`${primaryDir}/${fileName}`)
  if (await fileSystem.exists(primaryPath)) {
    return rememberAbsPath(fileName, primaryPath)
  }

  const journalsBase = await pathService.getJournalsBaseDirectory()
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  for (const delta of [-1, 1, -2, 2]) {
    const d = new Date(year, month - 1 + delta, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const dir = await pathService.getDiaryAttachmentDirectoryByYearMonth(ym)
    const candidate = normalizeExternalStoragePath(`${dir}/${fileName}`)
    if (await fileSystem.exists(candidate)) return rememberAbsPath(fileName, candidate)
  }

  try {
    const years = await fileSystem.readdir(journalsBase)
    for (const y of years) {
      if (!/^\d{4}$/.test(y)) continue
      const months = await fileSystem.readdir(`${journalsBase}/${y}`)
      for (const m of months) {
        if (!/^\d{1,2}$/.test(m)) continue
        const candidate = normalizeExternalStoragePath(
          `${journalsBase}/${y}/${m}/attachment/${fileName}`
        )
        if (await fileSystem.exists(candidate)) return rememberAbsPath(fileName, candidate)
      }
    }
  } catch {
    // ignore scan errors
  }

  return null
}

async function readExternalImageDataUri(absPath: string): Promise<string | null> {
  if (!isExternalStoragePath(absPath)) return null
  try {
    const info = externalGetInfoSafe(absPath)
    if (!info.exists || info.isDirectory) return null
    if (info.size > ATTACHMENT_PREVIEW_MAX_BYTES) return null
    const fileName = absPath.split('/').pop() || 'image.jpg'
    const b64 = externalReadB64Safe(absPath)
    if (!b64) return null
    return `data:${guessImageMimeType(fileName)};base64,${b64}`
  } catch {
    return null
  }
}

export async function resolveDiaryAttachmentImageDataUri(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  date: Date,
  attachmentSrc: string,
  loadCached?: (absPath: string) => Promise<string | null>
): Promise<string | null> {
  const absPath = await resolveDiaryAttachmentAbsPath(pathService, fileSystem, date, attachmentSrc)
  if (!absPath) return null

  if (loadCached) {
    const cached = await loadCached(absPath)
    if (cached) return cached
  }

  const viaResolver = await resolveAttachmentImageDataUri(fileSystem, absPath, 'preview')
  if (viaResolver) return viaResolver

  return readExternalImageDataUri(absPath)
}
