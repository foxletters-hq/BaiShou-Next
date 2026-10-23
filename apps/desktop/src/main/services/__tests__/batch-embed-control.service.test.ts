import { afterEach, describe, expect, it } from 'vitest'
import {
  assertBatchEmbedCanContinue,
  beginBatchEmbedControl,
  checkpointBatchEmbed,
  endBatchEmbedControl,
  isBatchEmbedAbortRequested,
  isBatchEmbedAbortedError,
  isBatchEmbedPaused,
  requestBatchEmbedCancel,
  requestBatchEmbedPause,
  requestBatchEmbedResume,
  throwIfBatchEmbedAborted
} from '../batch-embed-control.service'

afterEach(() => {
  endBatchEmbedControl()
})

describe('batch embed control', () => {
  it('treats checkpoint as ok when no session is active', async () => {
    await expect(checkpointBatchEmbed()).resolves.toBe('ok')
    expect(isBatchEmbedPaused()).toBe(false)
  })

  it('holds checkpoint until resume', async () => {
    beginBatchEmbedControl()
    requestBatchEmbedPause()
    expect(isBatchEmbedPaused()).toBe(true)

    let released = false
    const pending = checkpointBatchEmbed().then((status) => {
      released = true
      return status
    })
    await Promise.resolve()
    expect(released).toBe(false)

    requestBatchEmbedResume()
    await expect(pending).resolves.toBe('ok')
    expect(isBatchEmbedPaused()).toBe(false)
  })

  it('wakes a paused checkpoint as aborted when cancelled', async () => {
    beginBatchEmbedControl()
    requestBatchEmbedPause()
    const pending = checkpointBatchEmbed()
    requestBatchEmbedCancel()
    await expect(pending).resolves.toBe('aborted')
    expect(isBatchEmbedAbortRequested()).toBe(true)
    expect(() => throwIfBatchEmbedAborted()).toThrowError(/BATCH_EMBED_ABORTED/)
  })

  it('applies a pause requested before the session starts', async () => {
    requestBatchEmbedPause()
    expect(isBatchEmbedPaused()).toBe(true)
    beginBatchEmbedControl()
    expect(isBatchEmbedPaused()).toBe(true)
    const pending = checkpointBatchEmbed()
    requestBatchEmbedResume()
    await expect(pending).resolves.toBe('ok')
  })

  it('applies a cancel requested before the session starts', async () => {
    requestBatchEmbedCancel()
    beginBatchEmbedControl()
    await expect(assertBatchEmbedCanContinue()).rejects.toSatisfy(isBatchEmbedAbortedError)
  })
})
