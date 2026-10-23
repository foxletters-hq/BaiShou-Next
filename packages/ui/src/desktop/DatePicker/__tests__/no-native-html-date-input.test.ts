import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const desktopRoot = join(repoRoot, 'apps/desktop/src/renderer')

function listTsx(dir: string): string[] {
  const out: string[] = []
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (['__tests__', 'node_modules', 'dist', 'out'].includes(name)) continue
      out.push(...listTsx(full))
      continue
    }
    if (name.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('desktop DatePicker guard', () => {
  it('does not use native html date input in desktop renderer UI', () => {
    const hits = listTsx(desktopRoot).filter((file) => {
      const content = readFileSync(file, 'utf8')
      return /type=['"]date['"]/.test(content)
    })
    expect(hits).toEqual([])
  })
})
