import {
  classifyPromptAttachmentKind,
  extensionOfFileName,
  extractPromptDocumentText,
  isConvertiblePromptDocument,
  logger,
  PROMPT_CONVERTIBLE_DOCUMENT_MAX_BYTES,
  supportsNativePdf
} from '@baishou/shared'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { extractPdfText } from '../utils/mobile-pdf.util'
import { importUriToPath } from './mobile-uri-import'

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '')
  if (!clean) return new Uint8Array(0)
  if (typeof atob === 'function') {
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const out: number[] = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (ch === '=') break
    const val = chars.indexOf(ch)
    if (val < 0) continue
    buffer = (buffer << 6) | val
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buffer >>> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

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

export { stripAttachmentBinaryForStorage } from '@baishou/shared'

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
        const ext = extensionOfFileName(fileName) || extensionOfFileName(source)
        const baseName = fileName.replace(/\.[^.]+$/, '') || 'attachment'
        const newFileName = `${baseName}_${Date.now()}${ext || ''}`
        const dest = `${sessionDir}/${newFileName}`
        try {
          await importUriToPath(
            source.startsWith('file://') || source.startsWith('content://')
              ? source
              : `file://${source}`,
            dest,
            fileSystem
          )
          out.url = dest
          out.filePath = dest
          out.fileName = out.fileName || newFileName
          out.name = out.name || out.fileName

          const classifyName = fileName || newFileName
          const flags = classifyPromptAttachmentKind(classifyName, out.mimeType)
          const isConvertible = isConvertiblePromptDocument(classifyName, out.mimeType)
          const isImage = flags.isImage
          const isPdf = flags.isPdf
          const isText = flags.isText

          out.isImage = isImage
          out.isPdf = isPdf
          out.isText = isText || isConvertible

          if (isImage) {
            out.type = 'image'
            const lowerExt = ext.toLowerCase()
            out.mimeType =
              lowerExt === '.png'
                ? 'image/png'
                : lowerExt === '.gif'
                  ? 'image/gif'
                  : lowerExt === '.webp'
                    ? 'image/webp'
                    : 'image/jpeg'
          } else if (isPdf) {
            out.type = 'file'
            out.mimeType = 'application/pdf'
          } else if (isConvertible) {
            out.type = 'file'
          } else if (isText) {
            out.type = 'text'
          }

          if (isConvertible) {
            try {
              const st = await fileSystem.stat(dest)
              if ((st.size ?? 0) <= PROMPT_CONVERTIBLE_DOCUMENT_MAX_BYTES) {
                const encoded = await fileSystem.readFile(dest, 'base64')
                out.textContent = extractPromptDocumentText(
                  classifyName,
                  base64ToUint8Array(encoded),
                  out.mimeType
                )
                out.isText = true
              }
            } catch (e) {
              logger.warn('[AgentAttachment] Convertible document extract failed:', e as Error)
            }
          } else if (isText) {
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
          out.fileName = newFileName
          out.name = newFileName
          out.isImage = true
          out.type = 'image'
          out.mimeType = 'image/png'
        } catch {
          // ignore
        }
      }

      delete out.data
      return out
    })
  )
}
