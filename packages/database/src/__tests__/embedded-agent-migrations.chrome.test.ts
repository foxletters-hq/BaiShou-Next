import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'embedded-agent-migrations.ts'),
  'utf8'
)

describe('embedded agent migrations', () => {
  it('should include assistant custom prompt and session mounted notebooks in CREATE TABLE', () => {
    expect(src).toContain('custom_system_prompt')
    expect(src).toContain('mounted_notebook_ids')
  })
})
