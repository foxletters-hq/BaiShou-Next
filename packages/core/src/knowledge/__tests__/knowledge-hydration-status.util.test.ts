import { describe, expect, it } from 'vitest'
import {
  resolveHydrationGraphDecision,
  resolveHydrationSourceDecision
} from '../knowledge-hydration-status.util'

describe('resolveHydrationSourceDecision', () => {
  it('半成品 chunk 不得标 ready', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'pending',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 3
    })
    expect(d.status).toBe('pending')
    expect(d.needsEmbed).toBe(true)
  })

  it('已 ready 且 hash 未变、有 chunk 时保持完成', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'ready',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 4
    })
    expect(d.status).toBe('ready')
    expect(d.needsEmbed).toBe(false)
  })

  it('ready 但块数少于应有块时要重嵌', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'ready',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 1,
      expectedChunkCount: 4
    })
    expect(d.status).toBe('pending')
    expect(d.needsEmbed).toBe(true)
  })

  it('partial 且块数齐全时保持完成', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'partial',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 3,
      expectedChunkCount: 3
    })
    expect(d.status).toBe('partial')
    expect(d.needsEmbed).toBe(false)
  })

  it('embedding 进行中不得覆盖', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'embedding',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 1
    })
    expect(d.status).toBe('embedding')
    expect(d.needsEmbed).toBe(false)
  })

  it('extracting 进行中不得覆盖', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'extracting',
      extractedHash: null,
      hashChanged: false,
      chunkCount: 0
    })
    expect(d.status).toBe('extracting')
    expect(d.needsEmbed).toBe(false)
  })

  it('failed 且仍有完整 chunk 时不重排', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'failed',
      extractedHash: 'abc',
      hashChanged: false,
      chunkCount: 2
    })
    expect(d.status).toBe('failed')
    expect(d.needsEmbed).toBe(false)
  })

  it('只保存原文且无正文时保持 stored', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'stored',
      extractedHash: null,
      hashChanged: false,
      chunkCount: 0
    })
    expect(d.status).toBe('stored')
    expect(d.needsEmbed).toBe(false)
  })

  it('hash 变了要重嵌', () => {
    const d = resolveHydrationSourceDecision({
      existingStatus: 'ready',
      extractedHash: 'new',
      hashChanged: true,
      chunkCount: 8
    })
    expect(d.status).toBe('pending')
    expect(d.needsEmbed).toBe(true)
  })
})

describe('resolveHydrationGraphDecision', () => {
  it('无正文不排 graph', () => {
    expect(
      resolveHydrationGraphDecision({
        extractedHash: null,
        extractState: null
      })
    ).toBe(false)
  })

  it('extract-state 缺失要排', () => {
    expect(
      resolveHydrationGraphDecision({
        extractedHash: 'abc',
        extractState: null
      })
    ).toBe(true)
  })

  it('hash 变了要重抽', () => {
    expect(
      resolveHydrationGraphDecision({
        extractedHash: 'new',
        extractState: { extractedTextHash: 'old', windowsDone: 2, windowsTotal: 2 }
      })
    ).toBe(true)
  })

  it('窗口未完成不标完成', () => {
    expect(
      resolveHydrationGraphDecision({
        extractedHash: 'abc',
        extractState: { extractedTextHash: 'abc', windowsDone: 1, windowsTotal: 3 }
      })
    ).toBe(true)
  })

  it('窗口齐全且 hash 未变不重排', () => {
    expect(
      resolveHydrationGraphDecision({
        extractedHash: 'abc',
        extractState: { extractedTextHash: 'abc', windowsDone: 2, windowsTotal: 2 }
      })
    ).toBe(false)
  })
})
