import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'components', 'AssistantCreateModal.tsx'),
  'utf8'
)

describe('AssistantCreateModal chrome', () => {
  it('should inherit overlay dismiss instead of locking the backdrop', () => {
    expect(source).toContain('<Modal')
    expect(source).not.toContain('closeOnOverlayClick={false}')
  })
})
