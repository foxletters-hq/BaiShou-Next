import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionFileService } from '../session-file.service'

describe('SessionFileService', () => {
  let fileSystem: {
    writeFile: ReturnType<typeof vi.fn>
    mkdir: ReturnType<typeof vi.fn>
  }
  let service: SessionFileService

  beforeEach(() => {
    fileSystem = {
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
    service = new SessionFileService(
      {
        getSessionsBaseDirectory: vi.fn().mockResolvedValue('/tmp/sessions')
      } as any,
      fileSystem as any
    )
  })

  it('writes compact JSON without pretty formatting', async () => {
    const payload = { session: { id: 's1' }, messages: [{ id: 'm1', parts: [] }] }
    await service.writeSession('s1', payload)

    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1)
    const [, content] = fileSystem.writeFile.mock.calls[0]!
    expect(content).toBe(JSON.stringify(payload))
    expect(content).not.toContain('\n  ')
  })
})
