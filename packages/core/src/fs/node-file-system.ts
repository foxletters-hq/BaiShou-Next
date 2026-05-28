import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { FileStat, IFileSystem } from './file-system.types'

function enoentError(filePath: string, syscall: string): NodeJS.ErrnoException {
  const err = new Error(
    `${syscall}: no such file or directory, '${filePath}'`
  ) as NodeJS.ErrnoException
  err.code = 'ENOENT'
  return err
}

export class NodeFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    return existsSync(filePath)
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(dirPath, { recursive: options?.recursive ?? false })
  }

  async readFile(filePath: string, encoding: 'utf8'): Promise<string> {
    try {
      return await fs.readFile(filePath, encoding)
    } catch (e: any) {
      if (e?.code === 'ENOENT') throw enoentError(filePath, 'open')
      throw e
    }
  }

  async writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void> {
    await fs.writeFile(filePath, data, encoding)
  }

  async unlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e
    }
  }

  async readdir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch (e: any) {
      if (e?.code === 'ENOENT') throw enoentError(dirPath, 'scandir')
      throw e
    }
  }

  async stat(filePath: string): Promise<FileStat> {
    try {
      const s = await fs.stat(filePath)
      return { isFile: s.isFile(), isDirectory: s.isDirectory() }
    } catch (e: any) {
      if (e?.code === 'ENOENT') throw enoentError(filePath, 'stat')
      throw e
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath)
  }

  async rm(targetPath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await fs.rm(targetPath, {
      recursive: options?.recursive,
      force: options?.force
    })
  }
}
