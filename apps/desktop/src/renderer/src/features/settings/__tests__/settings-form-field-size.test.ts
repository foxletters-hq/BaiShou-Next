import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const settingsRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  return file.slice(settingsRoot.length + 1).replace(/\\/g, '/')
}

describe('settings form field size', () => {
  const files = listTsx(settingsRoot)

  it('uses Input fieldSize="small" on settings pages', () => {
    const missing = files.flatMap((file) =>
      extractOpenTags(readFileSync(file, 'utf8'), 'Input')
        .filter((hit) => !/fieldSize\s*=\s*["']small["']/.test(hit.attrs))
        .map((hit) => `${rel(file)}:${hit.line}`)
    )
    expect(missing).toEqual([])
  })

  it('uses Select size="small" on settings pages', () => {
    const missing = files.flatMap((file) =>
      extractOpenTags(readFileSync(file, 'utf8'), 'Select')
        .filter(
          (hit) =>
            !/size\s*=\s*["']small["']/.test(hit.attrs) &&
            !/variant\s*=\s*["']ghost["']/.test(hit.attrs)
        )
        .map((hit) => `${rel(file)}:${hit.line}`)
    )
    expect(missing).toEqual([])
  })
})
