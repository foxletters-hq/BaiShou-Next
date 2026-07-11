import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionDiskPersistenceService } from '../session-disk-persistence.service'

describe('SessionDiskPersistenceService', () => {
  let mockRepo: {
    getSessionAggregate: ReturnType<typeof vi.fn>
    updatePartsDataById: ReturnType<typeof vi.fn>
  }
  let mockFileService: {
    writeSession: ReturnType<typeof vi.fn>
  }
  let service: SessionDiskPersistenceService

  beforeEach(() => {
    vi.useFakeTimers()
    mockRepo = {
      getSessionAggregate: vi.fn(async () => ({ session: { id: 's1' }, messages: [] })),
      updatePartsDataById: vi.fn(async () => undefined)
    }
    mockFileService = {
      writeSession: vi.fn(async () => '/vault/Sessions/s1.json')
    }
    service = new SessionDiskPersistenceService(mockRepo as never, mockFileService as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushNow writes aggregate and clears dirty flag', async () => {
    service.markDirty('s1')
    await service.flushNow('s1')
    expect(mockFileService.writeSession).toHaveBeenCalledWith('s1', {
      session: { id: 's1' },
      messages: []
    })
    expect(service.isDirty('s1')).toBe(false)
  })

  it('coalesces concurrent flushNow for the same session', async () => {
    let resolveAggregate: (value: unknown) => void = () => {}
    mockRepo.getSessionAggregate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAggregate = resolve
        })
    )

    const first = service.flushNow('s1')
    const second = service.flushNow('s1')

    resolveAggregate({ session: { id: 's1' }, messages: [{ id: 'm1' }] })
    await Promise.all([first, second])

    expect(mockFileService.writeSession).toHaveBeenCalledTimes(1)
  })

  it('scheduleFlush debounces writes', async () => {
    service.scheduleFlush('s1', 300)
    expect(mockFileService.writeSession).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(299)
    expect(mockFileService.writeSession).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()

    expect(mockFileService.writeSession).toHaveBeenCalledTimes(1)
  })

  it('discard cancels pending flush and prevents in-flight write after delete', async () => {
    let resolveAggregate: (value: unknown) => void = () => {}
    mockRepo.getSessionAggregate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAggregate = resolve
        })
    )

    const flushPromise = service.flushNow('s1')
    service.discard('s1')
    resolveAggregate({ session: { id: 's1' }, messages: [] })
    await flushPromise

    expect(mockFileService.writeSession).not.toHaveBeenCalled()
    expect(service.isDirty('s1')).toBe(false)
  })

  it('flushPending only flushes dirty sessions', async () => {
    service.markDirty('s1')
    service.markDirty('s2')
    await service.flushPending()

    expect(mockFileService.writeSession).toHaveBeenCalledTimes(2)
    expect(service.getDirtySessionIds().size).toBe(0)
  })

  it('invokes onBeforeWrite hook before writing session file', async () => {
    const onBeforeWrite = vi.fn()
    const hooked = new SessionDiskPersistenceService(mockRepo as never, mockFileService as never, {
      onBeforeWrite
    })

    await hooked.flushNow('s1')
    expect(onBeforeWrite).toHaveBeenCalledWith('s1', 's1')
    expect(onBeforeWrite.mock.invocationCallOrder[0]).toBeLessThan(
      mockFileService.writeSession.mock.invocationCallOrder[0]!
    )
  })

  it('flushNow strips inline attachment base64 before writing JSON and SQLite', async () => {
    mockRepo.getSessionAggregate.mockResolvedValue({
      session: { id: 's1' },
      messages: [
        {
          id: 'm1',
          parts: [
            {
              id: 'p1',
              type: 'image',
              data: {
                fileName: 'shot.png',
                filePath: 'D:\\vault\\shot.png',
                data: 'data:image/png;base64,QUJD'
              }
            }
          ]
        }
      ]
    })

    await service.flushNow('s1')

    expect(mockRepo.updatePartsDataById).toHaveBeenCalledWith([
      {
        id: 'p1',
        data: { fileName: 'shot.png', filePath: 'D:\\vault\\shot.png' }
      }
    ])
    expect(mockFileService.writeSession).toHaveBeenCalledWith('s1', {
      session: { id: 's1' },
      messages: [
        {
          id: 'm1',
          parts: [
            {
              id: 'p1',
              type: 'image',
              data: { fileName: 'shot.png', filePath: 'D:\\vault\\shot.png' }
            }
          ]
        }
      ]
    })
  })
})
