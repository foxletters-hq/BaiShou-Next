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
  let manager: AssistantManagerService

  beforeEach(() => {
    findById = vi.fn()
    findAll = vi.fn()
    create = vi.fn()
    update = vi.fn()
    manager = {
      findById,
      findAll,
      create,
      update
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

  it('creates system Latte without stealing an existing default', async () => {
    findById.mockResolvedValue(null)
    findAll.mockResolvedValue([
      {
        id: DEFAULT_LATTE_ASSISTANT_ID,
        name: 'My Latte',
        systemPrompt: 'custom persona',
        isDefault: true
      }
    ])

    await ensureSystemLatteAssistant(manager, 'zh')

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SYSTEM_LATTE_ASSISTANT_ID,
        isDefault: false
      })
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('is idempotent and never mutates existing partners', async () => {
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
})
