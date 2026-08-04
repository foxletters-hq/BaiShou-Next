import { describe, expect, it, vi } from 'vitest'
import { GRAPH_SELF_NAME_REQUIRED_ERROR } from '@baishou/shared'
import {
  buildExtractPrompt,
  GraphLlmExtractionService
} from '../graph-llm-extraction.service'

describe('buildExtractPrompt', () => {
  it('injects selfName and forbids placeholder author labels', () => {
    const prompt = buildExtractPrompt('今天我去了杭州', '2026-08-04', '小明')
    expect(prompt.user).toContain('小明')
    expect(prompt.user).toContain('禁止使用「日记的主人」')
    expect(prompt.user).toContain('今天我去了杭州')
  })
})

describe('GraphLlmExtractionService.extractDiaries selfName gate', () => {
  it('rejects empty selfName before touching pending list', async () => {
    const freshness = {
      listPendingReextract: vi.fn(async () => [{ filePath: 'Journal/2026/08/04.md', contentHash: 'x' }])
    }
    const service = new GraphLlmExtractionService(
      {} as never,
      freshness as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      vi.fn()
    )

    await expect(
      service.extractDiaries({
        vaultId: 'v1',
        vaultName: 'Personal',
        selfName: '  '
      })
    ).rejects.toThrow(GRAPH_SELF_NAME_REQUIRED_ERROR)

    expect(freshness.listPendingReextract).not.toHaveBeenCalled()
  })
})
