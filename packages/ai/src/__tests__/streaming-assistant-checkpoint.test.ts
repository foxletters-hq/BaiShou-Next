import { describe, expect, it, vi } from 'vitest'
import { StreamAccumulator } from '../agent/stream-accumulator'
import { StreamingAssistantCheckpoint } from '../agent/streaming-assistant-checkpoint'

describe('StreamingAssistantCheckpoint', () => {
  it('should insert the first checkpoint then replace the same row', async () => {
    const sessionRepo = {
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 3 }]),
      getMessageById: vi.fn(),
      insertMessageWithParts: vi.fn().mockResolvedValue(undefined),
      replaceMessageParts: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined)
    }
    const accumulator = new StreamAccumulator()
    accumulator.add({ type: 'text-delta', text: '第一段' })

    const checkpoint = new StreamingAssistantCheckpoint({
      sessionId: 's1',
      sessionRepo: sessionRepo as any,
      providerId: 'mock',
      modelId: 'm1',
      getSnapshot: () => ({ accumulator })
    })

    checkpoint.schedule('token', 1000)
    const firstId = await checkpoint.drain()
    expect(firstId).toBeTruthy()
    expect(sessionRepo.insertMessageWithParts).toHaveBeenCalledTimes(1)
    const firstParts = sessionRepo.insertMessageWithParts.mock.calls[0]![1] as Array<{
      data?: { streamStatus?: string }
    }>
    expect(firstParts.some((part) => part.data?.streamStatus === 'in_progress')).toBe(true)

    accumulator.add({ type: 'text-delta', text: '第二段' })
    checkpoint.schedule('token', 3000)
    await checkpoint.drain()
    expect(sessionRepo.replaceMessageParts).toHaveBeenCalledWith(firstId, 's1', expect.any(Array))
  })
})
