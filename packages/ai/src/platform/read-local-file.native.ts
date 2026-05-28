/**
 * React Native：不使用 Node fs / pdf-parse。
 * 附件正文应在移动端由 mobile-agent-attachment.util 预先填入 textContent / data。
 */
export function canReadLocalPath(_filePath: string): boolean {
  return false
}

export function readLocalFileAsBase64(_filePath: string): string {
  return ''
}

export async function readPdfTextFromPath(_filePath: string): Promise<string> {
  return ''
}
