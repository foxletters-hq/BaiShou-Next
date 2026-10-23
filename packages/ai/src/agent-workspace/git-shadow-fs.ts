import { access, copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * 影子仓库需要的文件系统能力，比 WorkspaceFsAdapter 更底层：
 * 建目录、读文件大小、递归删除、拷贝 index 种子。
 */
export interface GitShadowFs {
  ensureDir(absolutePath: string): Promise<void>
  exists(absolutePath: string): Promise<boolean>
  /** 返回 null 表示路径不存在或不可读 */
  fileSize(absolutePath: string): Promise<number | null>
  /** 递归删除，路径不存在时静默通过 */
  removePath(absolutePath: string): Promise<void>
  writeFile(absolutePath: string, content: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>
}

export function createNodeGitShadowFs(): GitShadowFs {
  return {
    async ensureDir(absolutePath: string): Promise<void> {
      await mkdir(absolutePath, { recursive: true })
    },

    async exists(absolutePath: string): Promise<boolean> {
      try {
        await access(absolutePath)
        return true
      } catch {
        return false
      }
    },

    async fileSize(absolutePath: string): Promise<number | null> {
      try {
        const stats = await stat(absolutePath)
        return stats.isFile() ? stats.size : null
      } catch {
        return null
      }
    },

    async removePath(absolutePath: string): Promise<void> {
      await rm(absolutePath, { recursive: true, force: true })
    },

    async writeFile(absolutePath: string, content: string): Promise<void> {
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, content, 'utf-8')
    },

    async copyFile(from: string, to: string): Promise<void> {
      await mkdir(dirname(to), { recursive: true })
      await copyFile(from, to)
    }
  }
}
