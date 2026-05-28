/** 从附件元数据解析本地文件路径（桌面 file:// 或 filePath） */
export function resolveAttachmentFilePath(att: { filePath?: string; url?: string }): string {
  let filePath = att.filePath || ''
  if (!filePath && att.url?.startsWith('file:///')) {
    filePath = decodeURIComponent(att.url.replace('file:///', ''))
  }
  return filePath
}
