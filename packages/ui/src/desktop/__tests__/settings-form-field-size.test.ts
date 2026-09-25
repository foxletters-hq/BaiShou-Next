import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const SETTINGS_DIRS = [
  'AIModelServicesView',
  'TTSProviderSettings',
  'IdentitySettingsCard',
  'RagMemoryView',
  'McpSettingsCard',
  'CloudSyncPanel',
  'GitManagementPage',
  'WebSearchSettingsView',
  'EmojiSettingsView',
  'SummarySettingsView',
  'AssistantManagementPage',
  'AssistantEditPage',
  'AgentToolsView',
  'AttachmentManagementView',
  'PromptShortcutSheet',
  'Dialog'
]

/** 紧凑行：输入框紧挨小号按钮，或是定宽的数字框 */
const COMPACT_ROW_FILES = new Set([
  'CloudSyncPanel/CloudSyncCountModal.tsx',
  'GitManagementPage/GitVersionCommitBar.tsx',
  'TTSProviderSettings/TTSProviderSettingsFormTestSection.tsx'
])

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue
      out.push(...listTsx(full))
      continue
    }
    if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

function extractOpenTags(src: string, tag: string): { attrs: string; line: number }[] {
  const hits: { attrs: string; line: number }[] = []
  const startRe = new RegExp(`<${tag}\\b`, 'g')
  let match: RegExpExecArray | null
  while ((match = startRe.exec(src))) {
    let i = match.index + match[0].length
    let depth = 0
    let inQuote: string | null = null
    while (i < src.length) {
      const ch = src[i]
      if (inQuote) {
        if (ch === inQuote && src[i - 1] !== '\\') inQuote = null
      } else if (ch === '"' || ch === "'") {
        inQuote = ch
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
      } else if (ch === '>' && depth === 0) {
        hits.push({
          attrs: src.slice(match.index, i + 1),
          line: src.slice(0, match.index).split(/\n/).length
        })
        break
      }
      i++
    }
  }
  return hits
}

function rel(file: string): string {
  return file.slice(desktopRoot.length + 1).replace(/\\/g, '/')
}

/** 搜索框、嵌入式输入框、数字步进框属于紧凑控件，允许小号 */
function isCompactInput(attrs: string): boolean {
  return /embed/.test(attrs) || /type=["'](search|number)["']/.test(attrs)
}

describe('settings form field size', () => {
  const files = SETTINGS_DIRS.flatMap((dir) => listTsx(join(desktopRoot, dir))).filter(
    (file) => !COMPACT_ROW_FILES.has(rel(file))
  )

  it('uses default Input size for form fields in settings views', () => {
    const small = files.flatMap((file) =>
      extractOpenTags(readFileSync(file, 'utf8'), 'Input')
        .filter((hit) => /fieldSize\s*=\s*["']small["']/.test(hit.attrs))
        .filter((hit) => !isCompactInput(hit.attrs))
        .map((hit) => `${rel(file)}:${hit.line}`)
    )
    expect(small).toEqual([])
  })

  it('uses default Select size in settings views', () => {
    const small = files.flatMap((file) =>
      extractOpenTags(readFileSync(file, 'utf8'), 'Select')
        .filter((hit) => /(?<![\w-])size\s*=\s*["']small["']/.test(hit.attrs))
        .map((hit) => `${rel(file)}:${hit.line}`)
    )
    expect(small).toEqual([])
  })
})
