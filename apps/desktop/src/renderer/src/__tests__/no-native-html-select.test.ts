import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rendererRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

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

describe('desktop renderer selects', () => {
  it('does not use native html select', () => {
    const hits = listTsx(rendererRoot).filter((file) =>
      readFileSync(file, 'utf8').includes('<select')
    )
    expect(hits).toEqual([])
  })
})
