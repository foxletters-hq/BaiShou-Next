import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MarkdownRenderer.tsx'),
  'utf8'
)

describe('Native MarkdownRenderer preview chrome', () => {
  it('should render all variants including diary card preview with the legacy renderer', () => {
    expect(src).toContain('<LegacyMarkdownRenderer')
    expect(src).not.toContain('useStableStreamdownMarkdown')
    expect(src).not.toContain('createWorkletRuntime')
    expect(src).not.toContain('StaticStreamdownText')
  })
})
