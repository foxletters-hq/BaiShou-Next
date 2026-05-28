import type { IFileSystem } from '@baishou/core-mobile'
import { EncodingType, copyAsync, readAsStringAsync } from './mobile-sandbox-fs'
import { toFileUri } from './android-external-fs'

/**
 * 从相册 / DocumentPicker / content:// URI 导入到 vault 绝对路径。
 */
export async function importUriToPath(
  fromUri: string,
  destPath: string,
  fileSystem: IFileSystem
): Promise<void> {
  const dest = toFileUri(destPath)
  if (fromUri.startsWith('content://') || fromUri.startsWith('ph://')) {
    const b64 = await readAsStringAsync(fromUri, { encoding: EncodingType.Base64 })
    await fileSystem.writeFile(destPath, b64, 'base64')
    return
  }
  const from = fromUri.startsWith('file://') ? fromUri : `file://${fromUri}`
  try {
    await fileSystem.copyFile(from.replace(/^file:\/\//, ''), destPath)
  } catch {
    await copyAsync({ from, to: dest })
  }
}
