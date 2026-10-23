import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

describe('mobile settings agent behavior chrome', () => {
  it('should keep AgentBehaviorSection off the settings hub and global models', () => {
    const hub = readFileSync(join(dir, '..', 'settingsHubItems.ts'), 'utf8')
    const models = readFileSync(join(dir, '..', 'components', 'AIModelsSection.tsx'), 'utf8')
    const section = readFileSync(join(dir, '..', 'components', 'AgentBehaviorSection.tsx'), 'utf8')
    expect(hub).not.toContain("id: 'agent-behavior'")
    expect(hub).not.toContain("section: 'agent-gate'")
    expect(hub).not.toContain("section: 'rag'")
    expect(models).not.toContain('AgentBehaviorSection')
    expect(section).not.toContain('restoreLastSessionOnReturn')
  })

  it('should open the embedding selector and toast when memory center asked for focus', () => {
    const models = readFileSync(join(dir, '..', 'components', 'AIModelsSection.tsx'), 'utf8')
    expect(models).toContain('consumeAiModelsEmbeddingFocus')
    expect(models).toContain('memory.readiness_need_embedding')
    expect(models).toContain("setActiveSelector('globalEmbedding')")
  })
})
