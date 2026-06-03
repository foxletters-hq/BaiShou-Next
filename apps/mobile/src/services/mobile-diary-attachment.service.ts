import * as ImagePicker from 'expo-image-picker'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { importUriToPath } from './mobile-uri-import'

export interface DiaryAttachmentUploadResult {
  success: boolean
  fileName?: string
  filePath?: string
  relativePath?: string
  error?: string
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function toJournalsRelative(journalsBase: string, absolutePath: string): string {
  const base = normalizePath(journalsBase).replace(/\/$/, '')
  const full = normalizePath(absolutePath)
  if (full.startsWith(`${base}/`)) return full.slice(base.length + 1)
  return full
}

function extFromMime(mimeType?: string): string {
  if (!mimeType) return '.jpg'
  if (mimeType.includes('png')) return '.png'
  if (mimeType.includes('gif')) return '.gif'
  if (mimeType.includes('webp')) return '.webp'
  return '.jpg'
}

/** 与桌面 attachment-uploader.utils 一致的 Markdown 插入格式 */
export function getDiaryInsertMarkdown(fileName: string): string {
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName)) {
    return `![${fileName}](attachment/${fileName})`
  }
  if (/\.(mp4|webm|ogg|mov)$/i.test(fileName)) {
    return `<video src="attachment/${fileName}" controls></video>`
  }
  if (/\.(mp3|wav|ogg|aac)$/i.test(fileName)) {
    return `<audio src="attachment/${fileName}" controls></audio>`
  }
  return `[📎 ${fileName}](attachment/${fileName})`
}

export async function pickDiaryImagesFromLibrary(): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.92
  })

  if (result.canceled || !result.assets.length) return null
  return result.assets
}

/**
 * 上传日记图片到 Journals/{year}/{month}/attachment/（对齐桌面 diary:upload-attachments）
 */
export async function uploadDiaryAttachments(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  date: Date,
  assets: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'fileName' | 'mimeType'>[]
): Promise<DiaryAttachmentUploadResult[]> {
  const attachDir = await pathService.getDiaryAttachmentDirectory(date)
  const journalsBase = await pathService.getJournalsBaseDirectory()

  return Promise.all(
    assets.map(async (asset) => {
      try {
        const uri = asset.uri
        const origName = asset.fileName || uri.split('/').pop() || 'image.jpg'
        const ext = origName.includes('.')
          ? origName.slice(origName.lastIndexOf('.'))
          : extFromMime(asset.mimeType)
        const baseName = origName.replace(/\.[^.]+$/, '') || 'image'
        const newFileName = `${baseName}_${Date.now()}${ext}`
        const dest = `${attachDir}/${newFileName}`

        await importUriToPath(uri, dest, fileSystem)

        return {
          success: true,
          fileName: newFileName,
          filePath: dest,
          relativePath: toJournalsRelative(journalsBase, dest)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { success: false, error: msg }
      }
    })
  )
}
