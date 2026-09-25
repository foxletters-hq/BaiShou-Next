import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('mobile provider slot binding', () => {
  it('should resolve vision as a complete slot instead of the first enabled provider', () => {
    const vision = read('../register-mobile-vision-ocr.ts')
    expect(vision).toContain('resolveProviderModelSlot')
    expect(vision).not.toContain('providers.find((row) => row.isEnabled)')
    const configured = read('../mobile-knowledge-extract-config.ts')
    expect(configured).toContain('resolveProviderModelSlot')
    expect(configured).not.toContain('providers.find((row) => row.isEnabled)')
  })

  it('should keep chat on the selected provider', () => {
    const chat = read('../../providers/baishou-provider/start-agent-chat.ts')
    expect(chat).not.toContain('providers.find((p: any) => p.isEnabled)')
    expect(chat).toContain('No active provider configured')
    const recompress = read('../mobile-context-recompress.service.ts')
    expect(recompress).not.toContain('providers.find((p: any) => p.isEnabled)')
  })

  it('should merge memories with the dialogue model instead of the embedding model', () => {
    const mcp = read('../mobile-mcp-context.service.ts')
    expect(mcp).toContain('globalDialogueProviderId')
    expect(mcp).not.toMatch(
      /new MemoryDeduplicationServiceImpl\(\s*embAdapter,\s*dbAdapter,\s*embeddingProvider/
    )
  })
})
