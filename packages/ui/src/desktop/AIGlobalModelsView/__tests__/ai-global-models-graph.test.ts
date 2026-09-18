import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx'),
  'utf8'
)

describe('AIGlobalModelsView graph slot', () => {
  it('should let the graph extract model be chosen independently of dialogue', () => {
    expect(src).toContain("activeSelector === 'graph'")
    expect(src).toContain('newConfig.globalGraphProviderId = providerId')
    expect(src).toContain('config.globalGraphProviderId')
    expect(src).toContain('config.globalGraphModelId')
    expect(src).not.toContain('图关系抽取始终跟随对话模型')
    expect(src).not.toContain("{ readOnly: true }")
  })

  it('should persist reasoning effort by model use on non-embedding pickers', () => {
    expect(src).toContain('SessionModelMenu')
    expect(src).toContain('reasoningEffortBySlot')
    expect(src).toContain('setReasoningEffortForSlot')
    expect(src).toContain('showReasoningPanel')
  })
})
