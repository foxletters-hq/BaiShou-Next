// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssistantFileService } from '../assistant-file.service'

describe('AssistantFileService', () => {
  const fileSystem = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn(),
    readdir: vi.fn()
  }
  const pathProvider = {
    getAssistantsBaseDirectory: vi.fn().mockResolvedValue('/vault/Assistants')
  }

  let service: AssistantFileService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AssistantFileService(pathProvider as any, fileSystem as any)
  })

  it('writeAssistant overwrites empty existing json instead of throwing', async () => {
    fileSystem.readFile.mockResolvedValue('')

    await service.writeAssistant('ast-1', { id: 'ast-1', name: 'Latte' })

    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1)
  })

  it('writeAssistant overwrites invalid existing json instead of throwing', async () => {
    fileSystem.readFile.mockResolvedValue('{invalid')

    await service.writeAssistant('ast-1', { id: 'ast-1', name: 'Latte' })

    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1)
  })

  it('readAssistant returns null for empty json file', async () => {
    fileSystem.readFile.mockResolvedValue('   ')

    await expect(service.readAssistant('ast-1')).resolves.toBeNull()
  })
})
