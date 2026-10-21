import { beforeEach, describe, expect, it } from 'vitest'
import {
  getContextEpochStore,
  resetContextEpochStoreForTests,
  resetSharedContextEpochForTests
} from '../session-runtime/context-epoch'
import { prepareSystemPromptWithEpoch } from '../session-runtime/context-epoch/prepare-from-prompt'

function buildPrompt(knowledgeMountBlock: string): string {
  return `<persona>
You are Latte, a companion.
</persona>

<output_protocol>
Reply naturally.
</output_protocol>

<runtime_context>
[Current Vault / Workspace]: Personal
</runtime_context>

<knowledge_mount>
${knowledgeMountBlock}
</knowledge_mount>

<skills_catalog>
- diary_search: search diaries
</skills_catalog>`
}

describe('ContextEpoch knowledge mount', () => {
  beforeEach(() => {
    resetContextEpochStoreForTests()
    resetSharedContextEpochForTests()
  })

  it('keeps knowledge_mount out of the stable baseline', () => {
    const prepared = prepareSystemPromptWithEpoch({
      sessionId: 's-mount-1',
      fullSystemPrompt: buildPrompt(
        'No knowledge notebook is mounted. Do not call knowledge_search or knowledge_graph_search.'
      )
    })

    expect(prepared.baseline).not.toContain('<knowledge_mount>')
    expect(prepared.baseline).toContain('You are Latte')
    expect(prepared.systemPrompt).toContain('No knowledge notebook is mounted')
  })

  it('replaces the stale mount block when notebooks are mounted later', () => {
    prepareSystemPromptWithEpoch({
      sessionId: 's-mount-2',
      fullSystemPrompt: buildPrompt(
        'No knowledge notebook is mounted. Do not call knowledge_search or knowledge_graph_search.'
      )
    })

    const afterMount = prepareSystemPromptWithEpoch({
      sessionId: 's-mount-2',
      fullSystemPrompt: buildPrompt(
        'Mounted knowledge notebooks (2/3): 日记归档, 阅读笔记.\nWhen the user asks about these notebooks, call knowledge_search / knowledge_graph_search first.'
      )
    })

    expect(afterMount.systemPrompt).toContain('Mounted knowledge notebooks (2/3): 日记归档, 阅读笔记.')
    expect(afterMount.systemPrompt).not.toContain('No knowledge notebook is mounted')
    expect(afterMount.updates.some((update) => update.sourceId === 'knowledge/mount')).toBe(true)
  })

  it('also clears legacy baselines that wrongly embedded knowledge_mount', () => {
    const first = prepareSystemPromptWithEpoch({
      sessionId: 's-mount-3',
      fullSystemPrompt: buildPrompt('No knowledge notebook is mounted.')
    })

    // 模拟旧版本写入的 baseline：knowledge_mount 被固化在 stable 段里
    const legacyBaseline = `${first.baseline}

<knowledge_mount>
No knowledge notebook is mounted.
</knowledge_mount>`

    const store = getContextEpochStore()
    const previous = store.load('s-mount-3')
    expect(previous).toBeTruthy()
    store.save({
      ...previous!,
      baseline: legacyBaseline,
      composedSystemPrompt: legacyBaseline
    })

    const afterMount = prepareSystemPromptWithEpoch({
      sessionId: 's-mount-3',
      fullSystemPrompt: buildPrompt('Mounted knowledge notebooks (1/3): 日记归档.')
    })

    expect(afterMount.baseline).not.toContain('<knowledge_mount>')
    expect(afterMount.systemPrompt).toContain('Mounted knowledge notebooks (1/3): 日记归档.')
    expect(afterMount.systemPrompt).not.toContain('No knowledge notebook is mounted')
  })
})
