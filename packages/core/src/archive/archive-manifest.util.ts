import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { isLegacyAppRoot } from '../migration/legacy-migration.shared'

/** 判断是否为 BaiShou Next 标准备份 manifest（含 formatVersion >= 1） */
export function isValidNextArchiveManifest(manifest: unknown): boolean {
  return (
    manifest != null &&
    typeof manifest === 'object' &&
    typeof (manifest as { formatVersion?: unknown }).formatVersion === 'number' &&
    (manifest as { formatVersion: number }).formatVersion >= 1
  )
}

export function isValidNextArchiveManifestContent(raw: string): boolean {
  try {
    return isValidNextArchiveManifest(JSON.parse(raw))
  } catch {
    return false
  }
}

/**
 * 若 ZIP 解压后仅有一层包裹目录，且该目录才是真实备份根，则返回内层路径。
 * 常见于部分压缩工具或手动打包时多包了一层文件夹。
 */
export async function resolveArchivePayloadRoot(
  fileSystem: IFileSystem,
  extractDir: string
): Promise<string> {
  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(extractDir)
  } catch {
    return extractDir
  }

  const meaningful = entries.filter((name) => name && name !== '.' && name !== '..')
  if (meaningful.length !== 1) {
    return extractDir
  }

  const onlyName = meaningful[0]!
  const nestedDir = path.join(extractDir, onlyName)

  let isDirectory = false
  try {
    const stat = await fileSystem.stat(nestedDir)
    isDirectory = stat.isDirectory
  } catch {
    return extractDir
  }
  if (!isDirectory) {
    return extractDir
  }

  const manifestPath = path.join(nestedDir, 'manifest.json')
  if (await fileSystem.exists(manifestPath)) {
    try {
      const raw = await fileSystem.readFile(manifestPath, 'utf8')
      if (isValidNextArchiveManifestContent(raw)) {
        return nestedDir
      }
    } catch {
      // fall through to legacy detection
    }
  }

  if (await isLegacyAppRoot(fileSystem, nestedDir)) {
    return nestedDir
  }

  return extractDir
}
