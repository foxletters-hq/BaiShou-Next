import { supportsNativePdf } from '@baishou/shared'
import { logger } from '@baishou/shared'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { extractPdfText } from '../utils/mobile-pdf.util'
import { importUriToPath } from './mobile-uri-import'

export type AttachmentInput = {
  type?: string
  filePath?: string
  fileName?: string
  name?: string
  url?: string
  data?: string
  mimeType?: string
  isText?: boolean
  isImage?: boolean
  isPdf?: boolean
  textContent?: string
}

/**
 * 将聊天附件复制到 vault 会话目录（对齐桌面 agent-attachment.ipc）。
 */
export async function processAgentAttachments(
  pathService: IStoragePathService,
  fileSystem: IFileSystem,
  sessionId: string,
  attachments: AttachmentInput[] | undefined,
  modelId: string,
  providerType: string
): Promise<AttachmentInput[] | undefined> {
  if (!attachments?.length) return attachments

  const base = await pathService.getAttachmentsBaseDirectory()
  const safeSessionId = sessionId.replace(/[\\/]/g, '')
  const sessionDir = `${base}/${safeSessionId}`
  await fileSystem.mkdir(sessionDir, { recursive: true })

  return Promise.all(
    attachments.map(async (att) => {
      const out = { ...att }
      const fileName = att.fileName || att.name
      const source = att.filePath || att.url?.replace(/^file:\/\//, '')

      if (source && fileName) {
        const ext = source.includes('.') ? `.${source.split('.').pop()}` : ''
        const baseName = fileName.replace(/\.[^.]+$/, '')
        const newFileName = `${baseName}_${Date.now()}${ext || ''}`
        const dest = `${sessionDir}/${newFileName}`
        try {
          await importUriToPath(
            source.startsWith('file://') ? source : `file://${source}`,
            dest,
            fileSystem
          )
          out.url = dest
          out.filePath = dest

          const isImage = /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(newFileName)
          const isPdf = /\.pdf$/i.test(newFileName)
          if (isImage) {
            out.isImage = true
            out.type = 'image'
            out.mimeType = newFileName.endsWith('.png')
              ? 'image/png'
              : newFileName.endsWith('.gif')
                ? 'image/gif'
                : newFileName.endsWith('.webp')
                  ? 'image/webp'
                  : 'image/jpeg'
          } else if (isPdf) {
            out.isPdf = true
          }

          if (/\.(txt|md)$/i.test(newFileName)) {
            try {
              const st = await fileSystem.stat(dest)
              const max = 512 * 1024
              if ((st.size ?? 0) > max) {
                const partial = await fileSystem.readFile(dest).then((t) => t.slice(0, max))
                out.textContent = partial + '\n\n[Content truncated due to size limit]'
              } else {
                out.textContent = await fileSystem.readFile(dest)
              }
              out.isText = true
            } catch {
              // ignore read errors
            }
          } else if (isPdf) {
            const nativePdf = supportsNativePdf(modelId, providerType)
            if (!nativePdf) {
              try {
                const text = await extractPdfText(dest, fileSystem)
                out.textContent = text
                out.isText = true
              } catch (e) {
                logger.warn('[AgentAttachment] PDF text extract failed:', e as Error)
              }
            }
          }
        } catch {
          if (att.filePath) out.url = att.filePath
        }
      } else if (att.data && !att.url) {
        const newFileName = `pasted_${Date.now()}.png`
        const dest = `${sessionDir}/${newFileName}`
        try {
          const b64 = att.data.replace(/^data:image\/\w+;base64,/, '')
          await fileSystem.writeFile(dest, b64, 'base64')
          out.url = dest
          out.filePath = dest
          out.isImage = true
        } catch {
          // ignore
        }
      }
      return out
    })
  )
}
