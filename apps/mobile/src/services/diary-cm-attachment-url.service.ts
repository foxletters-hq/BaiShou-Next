import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { resolveDisplayFallbackUri } from '../utils/mobile-attachment-display-path.util'
import { resolveAttachmentImageDataUri } from '../utils/mobile-attachment-image-resolver'
import {
  resolveDiaryAttachmentAbsPath,
  resolveDiaryAttachmentImageDataUri
} from '../utils/mobile-diary-attachment-resolver'

export type DiaryCmAttachmentUrlLoader = (absPath: string) => Promise<string | null>

/**
 * WebView 附件 URI 解析（I-11）：优先 data: URI（editor 尺寸），大图降级 file://。
 */
export async function resolveDiaryAttachmentUrlForWebView(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  date: Date,
  attachmentSrc: string,
  loadCached?: DiaryCmAttachmentUrlLoader
): Promise<string | null> {
  if (!attachmentSrc.startsWith('attachment/')) return attachmentSrc

  const absPath = await resolveDiaryAttachmentAbsPath(pathService, fileSystem, date, attachmentSrc)
  if (!absPath) return null

  if (loadCached) {
    const cached = await loadCached(absPath)
    if (cached) return cached
  }

  const viaExternal = await resolveDiaryAttachmentImageDataUri(
    pathService,
    fileSystem,
    date,
    attachmentSrc
  )
  if (viaExternal) return viaExternal

  const viaEditor = await resolveAttachmentImageDataUri(fileSystem, absPath, 'editor')
  if (viaEditor) return viaEditor

  return resolveDisplayFallbackUri(absPath)
}
