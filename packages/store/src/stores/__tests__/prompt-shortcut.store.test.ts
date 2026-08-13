import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePromptShortcutStore } from '../prompt-shortcut.store'
import { PromptShortcut } from '@baishou/shared'

describe('usePromptShortcutStore', () => {
  beforeEach(() => {
    ;(globalThis as any).window = {
      api: {
        skills: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({
            name: 'x',
            description: 'X',
            content: 'x',
            location: '/AI/skills/x/SKILL.md'
          }),
          update: vi.fn().mockResolvedValue({
            name: 'x',
            description: 'X-Updated',
            content: 'x',
            location: '/AI/skills/x/SKILL.md'
          }),
          remove: vi.fn().mockResolvedValue(undefined)
        },
        shortcuts: {
          getShortcuts: vi.fn(),
          saveShortcuts: vi.fn()
        }
      }
    }

    usePromptShortcutStore.setState({
      shortcuts: [],
      skills: [],
      isLoading: false
    })
  })

  it('should initialize empty state', () => {
    const state = usePromptShortcutStore.getState()
    expect(state.shortcuts).toEqual([])
    expect(state.isLoading).toBe(false)
  })

  it('should load skills via IPC and map to shortcuts', async () => {
    ;(globalThis as any).window.api.skills.list.mockResolvedValue([
      {
        name: 'translate',
        description: '翻译',
        content: '请翻译',
        location: '/AI/skills/translate/SKILL.md'
      }
    ])

    await usePromptShortcutStore.getState().loadShortcuts()

    expect(usePromptShortcutStore.getState().shortcuts[0]!.id).toBe('translate')
    expect(usePromptShortcutStore.getState().shortcuts[0]!.command).toBe('translate')
    expect(usePromptShortcutStore.getState().skills[0]!.name).toBe('translate')
  })

  it('should support add, update, and remove via skills IPC', async () => {
    const mockItem: PromptShortcut = {
      id: 'x',
      icon: 'x',
      name: 'X',
      content: 'x',
      command: 'x'
    }

    ;(globalThis as any).window.api.skills.list
      .mockResolvedValueOnce([
        { name: 'x', description: 'X', content: 'x', location: '/AI/skills/x/SKILL.md' }
      ])
      .mockResolvedValueOnce([
        { name: 'x', description: 'X-Updated', content: 'x', location: '/AI/skills/x/SKILL.md' }
      ])
      .mockResolvedValueOnce([])

    await usePromptShortcutStore.getState().addShortcut(mockItem)
    expect((globalThis as any).window.api.skills.create).toHaveBeenCalled()
    expect(usePromptShortcutStore.getState().shortcuts.length).toBe(1)

    const updatedItem = { ...mockItem, name: 'X-Updated' }
    await usePromptShortcutStore.getState().updateShortcut(updatedItem)
    expect((globalThis as any).window.api.skills.update).toHaveBeenCalled()
    expect(usePromptShortcutStore.getState().shortcuts[0]!.name).toBe('X-Updated')

    await usePromptShortcutStore.getState().removeShortcut('x')
    expect((globalThis as any).window.api.skills.remove).toHaveBeenCalledWith('x')
    expect(usePromptShortcutStore.getState().shortcuts.length).toBe(0)
  })

  it('should reorder shortcuts locally without persisting', async () => {
    usePromptShortcutStore.setState({
      shortcuts: [
        { id: '1', icon: '1', name: '1', content: '1' },
        { id: '2', icon: '2', name: '2', content: '2' },
        { id: '3', icon: '3', name: '3', content: '3' }
      ]
    })

    await usePromptShortcutStore.getState().reorderShortcuts(0, 3)
    const list = usePromptShortcutStore.getState().shortcuts

    expect(list[0]!.id).toBe('2')
    expect(list[1]!.id).toBe('3')
    expect(list[2]!.id).toBe('1')
    expect((globalThis as any).window.api.shortcuts.saveShortcuts).not.toHaveBeenCalled()
  })
})
