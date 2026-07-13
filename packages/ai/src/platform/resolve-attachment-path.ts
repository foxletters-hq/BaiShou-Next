import { resolveAttachmentAbsolutePath } from '@baishou/shared'
import { applyAttachmentPathRemapper } from './attachment-path-remapper.registry'

/** 从附件元数据解析本地文件路径（file://、filePath 或移动端裸路径） */
export function resolveAttachmentFilePath(att: { filePath?: string; url?: string }): string {
  const raw = (att.filePath || att.url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return ''
  const resolved = resolveAttachmentAbsolutePath(raw)
  return applyAttachmentPathRemapper(resolved)
}
