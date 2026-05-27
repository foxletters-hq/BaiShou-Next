import fs from 'node:fs/promises'
import path from 'node:path'
import type { AttachmentFileItem } from './attachment-manager.types'

export function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

export async function getDirectorySize(dirPath: string): Promise<{ size: number; count: number }> {
  let size = 0
  let count = 0
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name)
      if (file.isDirectory()) {
        const sub = await getDirectorySize(fullPath)
        size += sub.size
        count += sub.count
      } else {
        const stat = await fs.stat(fullPath)
        size += stat.size
        count += 1
      }
    }
  } catch {
    // Ignored
  }
  return { size, count }
}

export async function getDirectoryFiles(dirPath: string): Promise<AttachmentFileItem[]> {
  const fileItems: AttachmentFileItem[] = []
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name)
      if (file.isDirectory()) {
        const subFiles = await getDirectoryFiles(fullPath)
        fileItems.push(...subFiles)
      } else {
        const stat = await fs.stat(fullPath)
        fileItems.push({
          name: file.name,
          path: fullPath,
          sizeMB: stat.size / (1024 * 1024),
          birthtime: stat.birthtime.toISOString()
        })
      }
    }
  } catch {
    // 忽略读取错误
  }
  return fileItems
}

export function extractReferencedFileNames(content: string): Set<string> {
  const fileNames = new Set<string>()

  const obsidianRegex = /!?\[\[([^\]]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = obsidianRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('|')[0]?.trim()
      if (cleanPath) {
        fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  const mdRegex = /!?\[[^\]]*\]\(([^)]+)\)/g
  while ((match = mdRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
      if (cleanPath) {
        fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  const htmlRegex = /(?:src|href)="([^"]+)"/g
  while ((match = htmlRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
      if (cleanPath) {
        fileNames.add(path.basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  return fileNames
}
