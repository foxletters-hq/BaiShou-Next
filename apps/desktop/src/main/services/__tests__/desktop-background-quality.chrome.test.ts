import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'desktop-attachment-manager.service.ts'), 'utf8')

describe('desktop attachment background import quality', () => {
  it('does not run avatar compression on chat backgrounds', () => {
    expect(src).not.toMatch(/override\s+async\s+importBackground/)
    expect(src).toContain('prepareAvatarSourceForImport(absoluteSourcePath)')
  })
})
