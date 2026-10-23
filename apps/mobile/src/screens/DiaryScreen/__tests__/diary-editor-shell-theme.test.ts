import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const shellTemplate = readFileSync(
  join(dir, '../../../../diary-editor-web/index.template.html'),
  'utf8'
)

describe('mobile diary editor shell theme', () => {
  it('should stay transparent until the native theme is applied', () => {
    expect(shellTemplate).toMatch(/background:\s*transparent/)
    expect(shellTemplate).not.toMatch(/background:\s*var\(--bg-editor,\s*#fff\)/)
  })
})
