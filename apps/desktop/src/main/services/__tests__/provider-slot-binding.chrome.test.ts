import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('provider slot binding', () => {
  it('should resolve vision as a complete slot instead of the first enabled provider', () => {
    const vision = read('../register-desktop-vision-ocr.ts')
    expect(vision).toContain('resolveProviderModelSlot')
    expect(vision).toContain('buildVisionLanguageSlots')
    expect(vision).not.toContain('providers.find((p) => p.isEnabled)')
    const configured = read('../../ipc/knowledge-ipc.context.ts')
    expect(configured).toContain('resolveProviderModelSlot')
    expect(configured).not.toContain('providers.find((p) => p.isEnabled)')
  })

  it('should refuse a missing provider instead of substituting another one', () => {
    const stream = read('../../ipc/agent-stream-config.ts')
    expect(stream).toContain('No active provider configured (provider:')
    expect(stream).not.toContain('providers.find((p: AIProviderConfig) => p.isEnabled)')
    expect(stream).toContain('resolveProviderModelSlot')
    expect(stream).not.toContain("'deepseek-chat'")
  })

  it('should merge memories with the dialogue model instead of the embedding model', () => {
    const mcp = read('../../ipc/agent-mcp-context.ts')
    expect(mcp).toContain('globalDialogueProviderId')
    expect(mcp).toContain('getActiveProvider(globalModels?.globalDialogueProviderId)')
    expect(mcp).not.toMatch(/new MemoryDeduplicationServiceImpl\(\s*embAdapter,\s*dbAdapter,\s*embeddingProvider/)
  })
})
