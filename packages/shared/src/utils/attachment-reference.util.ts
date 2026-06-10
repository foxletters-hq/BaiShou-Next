function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

/** 从日记 Markdown / HTML 内容中提取被引用的附件文件名（小写） */
export function extractReferencedFileNames(content: string): Set<string> {
  const fileNames = new Set<string>()

  const obsidianRegex = /!?\[\[([^\]]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = obsidianRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('|')[0]?.trim()
      if (cleanPath) {
        fileNames.add(basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  const mdRegex = /!?\[[^\]]*\]\(([^)]+)\)/g
  while ((match = mdRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
      if (cleanPath) {
        fileNames.add(basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  const htmlRegex = /(?:src|href)="([^"]+)"/g
  while ((match = htmlRegex.exec(content)) !== null) {
    if (match[1]) {
      const cleanPath = match[1].split('?')[0]?.split('#')[0]?.trim()
      if (cleanPath) {
        fileNames.add(basename(safeDecodeURIComponent(cleanPath)).toLowerCase())
      }
    }
  }

  return fileNames
}
