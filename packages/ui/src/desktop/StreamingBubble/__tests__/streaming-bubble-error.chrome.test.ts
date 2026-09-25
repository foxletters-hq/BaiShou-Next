import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx'),
  'utf8'
)

describe('StreamingBubble error chrome', () => {
  it('should keep stream content visible when an error is shown', () => {
    expect(src).toContain('styles.errorBox')
    expect(src.indexOf('hasText &&')).toBeLessThan(src.lastIndexOf('{error ? ('))
    expect(src).not.toContain('{error ? (\n          <div className={styles.errorBox}>')
  })
})
