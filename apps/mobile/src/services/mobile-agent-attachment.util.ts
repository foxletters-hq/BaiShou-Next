import * as FileSystem from 'expo-file-system/legacy'
import { supportsNativePdf } from '@baishou/shared'
import { logger } from '@baishou/shared'
import type { MobileStoragePathService } from './path.service'
import { extractPdfText } from '../utils/mobile-pdf.util'

type AttachmentInput = {
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
  pathService: MobileStoragePathService,
  sessionId: string,
  attachments: AttachmentInput[] | undefined,
  modelId: string,
  providerType: string
): Promise<AttachmentInput[] | undefined> {
  if (!attachments?.length) return attachments

  const base = await pathService.getAttachmentsBaseDirectory()
  const safeSessionId = sessionId.replace(/[\\/]/g, '')
  const sessionDir = `${base}/${safeSessionId}`
  await FileSystem.makeDirectoryAsync(sessionDir, { intermediates: true })

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
          await FileSystem.copyAsync({
            from: source.startsWith('file://') ? source : `file://${source}`,
            to: dest
          })
          out.url = dest
          out.filePath = dest

          if (/\.(txt|md)$/i.test(newFileName)) {
            try {
              const info = await FileSystem.getInfoAsync(dest)
              const max = 512 * 1024
              if (info.exists && 'size' in info && (info.size ?? 0) > max) {
                const partial = await FileSystem.readAsStringAsync(dest, { length: max })
                out.textContent = partial + '\n\n[Content truncated due to size limit]'
              } else {
                out.textContent = await FileSystem.readAsStringAsync(dest)
              }
              out.isText = true
            } catch {
              // ignore read errors
            }
          } else if (/\.pdf$/i.test(newFileName)) {
            out.isPdf = true
            const nativePdf = supportsNativePdf(modelId, providerType)
            if (!nativePdf) {
              try {
                const text = await extractPdfText(dest)
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
          await FileSystem.writeAsStringAsync(dest, b64, {
            encoding: FileSystem.EncodingType.Base64
          })
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
