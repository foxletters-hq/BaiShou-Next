// @ts-ignore - Node built-in, available at runtime
import { createHash } from 'node:crypto'
// @ts-ignore - Node built-in, available at runtime
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile
} from 'node:fs/promises'
// @ts-ignore - Node built-in, available at runtime
import { dirname } from 'node:path'

export interface WorkspaceFsAdapter {
  exists(absolutePath: string): Promise<boolean>
  readFile(absolutePath: string): Promise<string | null>
  writeFile(absolutePath: string, content: string): Promise<void>
  deleteFile(absolutePath: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  listDir(absolutePath: string): Promise<Array<{ name: string; isDirectory: boolean }>>
}

export function hashWorkspaceContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function createNodeWorkspaceFs(): WorkspaceFsAdapter {
  return {
    async exists(absolutePath: string): Promise<boolean> {
      try {
        await access(absolutePath)
        return true
      } catch {
        return false
      }
    },

    async readFile(absolutePath: string): Promise<string | null> {
      try {
        return await readFile(absolutePath, 'utf-8')
      } catch {
        return null
      }
    },

    async writeFile(absolutePath: string, content: string): Promise<void> {
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, content, 'utf-8')
    },

    async deleteFile(absolutePath: string): Promise<void> {
      await unlink(absolutePath)
    },

    async rename(from: string, to: string): Promise<void> {
      await mkdir(dirname(to), { recursive: true })
      await rename(from, to)
    },

    async listDir(absolutePath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
      const entries = await readdir(absolutePath, { withFileTypes: true })
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }))
    }
  }
}
