/** 从附件元数据解析本地文件路径（file://、filePath 或移动端裸路径） */
export function resolveAttachmentFilePath(att: { filePath?: string; url?: string }): string {
  const raw = (att.filePath || att.url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return ''
  if (raw.startsWith('file://')) {
    return decodeURIComponent(raw.replace(/^file:\/\//, ''))
  }
  return raw
}
