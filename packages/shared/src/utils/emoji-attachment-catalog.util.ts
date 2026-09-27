import type { EmojiToolConfig } from '../types/settings.types'
import { normalizeEmojiToolConfig } from './emoji-config.util'

export interface EmojiAttachmentFileRecord {
  name: string
  path: string
  relativePath: string
  sizeMB: number
  birthtime: string
}

export interface EmojiAttachmentCatalogItem extends EmojiAttachmentFileRecord {
  groupNames: string[]
  isMissing: boolean
}

function emojiFileKey(relativePath: string): string {
  const normalized = relativePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^local:\/\/+\//i, '')
  const idx = normalized.toLowerCase().lastIndexOf('emojis/')
  if (idx >= 0) return normalized.slice(idx)
  const name = normalized.split('/').pop()
  return name ? `emojis/${name}` : normalized
}

/** 磁盘文件 + 组配置合并：未编入组的文件、以及组里已缺文件的条目都会列出 */
export function mergeEmojiAttachmentCatalog(
  files: readonly EmojiAttachmentFileRecord[],
  config?: EmojiToolConfig | null
): EmojiAttachmentCatalogItem[] {
  const groups = normalizeEmojiToolConfig(config).groups
  const groupNamesByKey = new Map<string, string[]>()

  for (const group of groups) {
    for (const emoji of group.emojis) {
      const key = emojiFileKey(emoji.relativePath)
      const names = groupNamesByKey.get(key) ?? []
      if (!names.includes(group.name)) names.push(group.name)
      groupNamesByKey.set(key, names)
    }
  }

  const seen = new Set<string>()
  const items: EmojiAttachmentCatalogItem[] = files.map((file) => {
    const key = emojiFileKey(file.relativePath)
    seen.add(key)
    return {
      ...file,
      relativePath: key,
      groupNames: groupNamesByKey.get(key) ?? [],
      isMissing: false
    }
  })

  for (const [key, groupNames] of groupNamesByKey) {
    if (seen.has(key)) continue
    const name = key.split('/').pop() || key
    items.push({
      name,
      path: '',
      relativePath: key,
      sizeMB: 0,
      birthtime: '',
      groupNames,
      isMissing: true
    })
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}
