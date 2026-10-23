import fs from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { stripStoragePathScheme } from '@baishou/shared'
import type { FileEncoding, FileStat, IFileSystem } from './file-system.types'

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

  async readFile(filePath: string, encoding: FileEncoding = 'utf8'): Promise<string> {
    try {
      if (encoding === 'base64') {
        const buf = await fs.readFile(filePath)
        return buf.toString('base64')
      }
      return await fs.readFile(filePath, 'utf8')
    } catch (e: any) {
      if (e?.code === 'ENOENT') throw enoentError(filePath, 'open')
      throw e
    }
  }

  async writeFile(filePath: string, data: string, encoding: FileEncoding = 'utf8'): Promise<void> {
    if (encoding === 'base64') {
      await fs.writeFile(filePath, Buffer.from(data, 'base64'))
      return
    }
    await fs.writeFile(filePath, data, 'utf8')
  }

  async appendFile(filePath: string, data: string, encoding: FileEncoding = 'utf8'): Promise<void> {
    if (encoding === 'base64') {
      await fs.appendFile(filePath, Buffer.from(data, 'base64'))
      return
    }
    await fs.appendFile(filePath, data, 'utf8')
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fs.cp(stripStoragePathScheme(src), stripStoragePathScheme(dest), { recursive: true })
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
      return {
        isFile: s.isFile(),
        isDirectory: s.isDirectory(),
        size: s.size,
        mtimeMs: s.mtimeMs
      }
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

  async md5Hex(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5')
      const stream = createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
}
