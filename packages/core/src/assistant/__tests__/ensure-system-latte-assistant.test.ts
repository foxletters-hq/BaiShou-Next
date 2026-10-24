import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_LATTE_ASSISTANT_ID,
  SYSTEM_LATTE_ASSISTANT_ID,
  getSystemLatteAssistantSeed
} from '@baishou/shared'
import { ensureSystemLatteAssistant } from '../ensure-system-latte-assistant'
import { ensureDefaultLatteAssistant } from '../ensure-default-latte-assistant'
import type { AssistantManagerService } from '../assistant-manager.service'

describe('ensureSystemLatteAssistant', () => {
  let findById: ReturnType<typeof vi.fn>
  let findAll: ReturnType<typeof vi.fn>
  let create: ReturnType<typeof vi.fn>
  let update: ReturnType<typeof vi.fn>
  let deleteMock: ReturnType<typeof vi.fn>
  let rebindMock: ReturnType<typeof vi.fn>
  let manager: AssistantManagerService

  beforeEach(() => {
    findById = vi.fn()
    findAll = vi.fn()
    create = vi.fn()
    update = vi.fn()
    deleteMock = vi.fn()
    rebindMock = vi.fn()
    manager = {
      findById,
      findAll,
      create,
      update,
      delete: deleteMock,
      syncToDisk: vi.fn(),
      rebindSessionsAssistantId: rebindMock
    } as unknown as AssistantManagerService
  })

  it('creates system Latte when missing and sets default on empty vault', async () => {
    findById.mockResolvedValue(null)
    findAll.mockResolvedValue([])

    const result = await ensureSystemLatteAssistant(manager, 'zh')

    expect(result).toEqual({ created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SYSTEM_LATTE_ASSISTANT_ID,
        ...getSystemLatteAssistantSeed('zh'),
        isDefault: true
      })
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('smoothly upgrades legacy default assistant to official system Latte', async () => {
    const legacy = {
      id: DEFAULT_LATTE_ASSISTANT_ID,
      name: 'My Latte',
      systemPrompt: 'custom persona',
      customSystemPrompt: 'my custom',
      isDefault: true
    }
    findById.mockImplementation(async (id: string) => {
      if (id === SYSTEM_LATTE_ASSISTANT_ID) return null
      if (id === DEFAULT_LATTE_ASSISTANT_ID) return legacy
      return null
    })

    const res = await ensureSystemLatteAssistant(manager, 'zh')

    expect(res).toEqual({ created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SYSTEM_LATTE_ASSISTANT_ID,
        name: 'My Latte',
        systemPrompt: 'custom persona',
        customSystemPrompt: 'my custom',
        isDefault: true
      })
    )
    expect(manager.delete).toHaveBeenCalledWith(DEFAULT_LATTE_ASSISTANT_ID, undefined)
    expect((manager as any).rebindSessionsAssistantId).toHaveBeenCalledWith(
      DEFAULT_LATTE_ASSISTANT_ID,
      SYSTEM_LATTE_ASSISTANT_ID,
      undefined
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('replaces a legacy factory prompt with the current default during merge', async () => {
    const legacy = {
      id: DEFAULT_LATTE_ASSISTANT_ID,
      name: 'My Latte',
      systemPrompt: getSystemLatteAssistantSeed('en').systemPrompt,
      customSystemPrompt: 'my custom',
      isDefault: true
    }
    findById.mockImplementation(async (id: string) => {
      if (id === SYSTEM_LATTE_ASSISTANT_ID) return null
      if (id === DEFAULT_LATTE_ASSISTANT_ID) return legacy
      return null
    })

    await ensureSystemLatteAssistant(manager, 'zh')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SYSTEM_LATTE_ASSISTANT_ID,
        systemPrompt: getSystemLatteAssistantSeed('zh').systemPrompt,
        customSystemPrompt: 'my custom'
      })
    )
  })

  it('upgrades a factory default persona but preserves custom prompts', async () => {
    const existing = {
      id: SYSTEM_LATTE_ASSISTANT_ID,
      name: 'Latte',
      systemPrompt: getSystemLatteAssistantSeed('en').systemPrompt,
      customSystemPrompt: 'keep me',
      isDefault: false
    }
    findById.mockResolvedValue(existing)

    const result = await ensureSystemLatteAssistant(manager, 'zh')

    expect(result.created).toBe(false)
    expect(update).toHaveBeenCalledWith(SYSTEM_LATTE_ASSISTANT_ID, {
      systemPrompt: getSystemLatteAssistantSeed('zh').systemPrompt
    })
  })

  it('is idempotent and never mutates a custom existing partner', async () => {
    const existing = {
      id: SYSTEM_LATTE_ASSISTANT_ID,
      name: 'Latte',
      systemPrompt: 'already here',
      customSystemPrompt: 'keep me',
      isDefault: false
    }
    findById.mockResolvedValue(existing)
    findAll.mockResolvedValue([
      existing,
      { id: DEFAULT_LATTE_ASSISTANT_ID, name: 'Old', isDefault: true, systemPrompt: 'untouched' }
    ])

    const first = await ensureSystemLatteAssistant(manager)
    const second = await ensureDefaultLatteAssistant(manager)

    expect(first.created).toBe(false)
    expect(second).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(findAll).not.toHaveBeenCalled()
  })

  it('heals orphaned legacy default sessions even when system Latte already exists', async () => {
    const existing = {
      id: SYSTEM_LATTE_ASSISTANT_ID,
      name: 'Latte',
      systemPrompt: 'already here',
      isDefault: true
    }
    findById.mockImplementation(async (id: string) =>
      id === SYSTEM_LATTE_ASSISTANT_ID ? existing : null
    )
    rebindMock.mockResolvedValue(['sess-1', 'sess-2'])

    const result = await ensureSystemLatteAssistant(manager, 'zh')

    expect(result).toEqual({ created: false, assistantId: SYSTEM_LATTE_ASSISTANT_ID })
    expect(create).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
    expect(rebindMock).toHaveBeenCalledWith(
      DEFAULT_LATTE_ASSISTANT_ID,
      SYSTEM_LATTE_ASSISTANT_ID,
      undefined
    )
  })
})
