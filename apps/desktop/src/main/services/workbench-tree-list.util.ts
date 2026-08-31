/** 任意层级下隐藏这些名称（大小写不敏感时用小写键）。 */
const HIDDEN_ENTRY_NAMES_LOWER = new Set(['.git', '.svn', '.hg', '.ds_store', 'thumbs.db'])

/** Linux 上按字面大小写匹配。 */
const HIDDEN_ENTRY_NAMES_STRICT = new Set(['.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db'])

function shouldIgnoreEntryCase(ignoreCase?: boolean): boolean {
  if (typeof ignoreCase === 'boolean') return ignoreCase
  return process.platform !== 'linux'
}

/**
 * 工作台左侧文件树是否列出该名称。
 * 隐藏版本库目录与系统垃圾文件；其它点文件、点目录照常显示。
 * 不根据 .gitignore 隐藏条目。
 */
export function shouldListWorkbenchTreeEntry(
  name: string,
  options?: { ignoreCase?: boolean }
): boolean {
  if (!name || name === '.' || name === '..') return false
  if (shouldIgnoreEntryCase(options?.ignoreCase)) {
    return !HIDDEN_ENTRY_NAMES_LOWER.has(name.toLowerCase())
  }
  return !HIDDEN_ENTRY_NAMES_STRICT.has(name)
}
