import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('memory dedup language model', () => {
  it('should pass the session dialogue model into memory merge', () => {
    const tools = readFileSync(join(here, '../agent-session-tools.ts'), 'utf8')
    expect(tools).toContain(
      'new MemoryDeduplicationServiceImpl(embAdapter, dbAdapter, provider, modelId)'
    )
    expect(tools).not.toContain('MemoryDeduplicationServiceImpl(embAdapter, dbAdapter, systemModels.embeddingProvider')
    const resolver = readFileSync(join(here, '../session-system-prompt.resolver.ts'), 'utf8')
    expect(resolver).toContain('new MemoryDeduplicationServiceImpl(')
    expect(resolver).toContain('params.provider,\n      params.modelId')
  })
})
