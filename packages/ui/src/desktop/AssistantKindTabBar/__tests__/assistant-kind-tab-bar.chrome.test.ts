import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('AssistantKindTabBar chrome', () => {
  it('should use SegmentedControl for the companion/work switch instead of a custom full-width tab bar', () => {
    const tsx = read('../AssistantKindTabBar.tsx')
    const css = read('../AssistantKindTabBar.module.css')
    expect(tsx).toContain('import { SegmentedControl }')
    expect(tsx).toContain('<SegmentedControl')
    expect(tsx).toContain('stretch')
    expect(tsx).not.toContain('size={18}')
    expect(css).not.toContain('.tabs {')
    expect(css).not.toContain('.tab {')
  })
})
