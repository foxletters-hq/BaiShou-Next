import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePromptShortcutStore } from '../prompt-shortcut.store';
import { PromptShortcut } from '@baishou/shared';

describe('usePromptShortcutStore', () => {
  beforeEach(() => {
    (global as any).window = {
      api: {
        shortcuts: {
          getShortcuts: vi.fn(),
          saveShortcuts: vi.fn(),
        }
      }
    };
    
    usePromptShortcutStore.setState({
      shortcuts: [],
      isLoading: false
    });
  });

  it('should initialize empty state', () => {
    const state = usePromptShortcutStore.getState();
    expect(state.shortcuts).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should load shortcuts via IPC', async () => {
    const mockList: PromptShortcut[] = [
      { id: '1', icon: 'a', name: 'A', content: 'A' }
    ];
    (global as any).window.api.shortcuts.getShortcuts.mockResolvedValue(mockList);

    await usePromptShortcutStore.getState().loadShortcuts();
    
    expect(usePromptShortcutStore.getState().shortcuts[0].name).toBe('A');
  });

  it('should support add, update, and remove actions and sync to IPC', async () => {
    const mockItem: PromptShortcut = { id: 'x', icon: 'x', name: 'X', content: 'x' };
    
    await usePromptShortcutStore.getState().addShortcut(mockItem);
    expect(usePromptShortcutStore.getState().shortcuts.length).toBe(1);
    expect((global as any).window.api.shortcuts.saveShortcuts).toHaveBeenCalled();

    const updatedItem = { ...mockItem, name: 'X-Updated' };
    await usePromptShortcutStore.getState().updateShortcut(updatedItem);
    expect(usePromptShortcutStore.getState().shortcuts[0].name).toBe('X-Updated');

    await usePromptShortcutStore.getState().removeShortcut('x');
    expect(usePromptShortcutStore.getState().shortcuts.length).toBe(0);
  });

  it('should reorder shortcuts correctly', async () => {
    usePromptShortcutStore.setState({
      shortcuts: [
        { id: '1', icon: '1', name: '1', content: '1' },
        { id: '2', icon: '2', name: '2', content: '2' },
        { id: '3', icon: '3', name: '3', content: '3' },
      ]
    });

    // 移动 [0] (1) 到 [2] 的位置
    await usePromptShortcutStore.getState().reorderShortcuts(0, 3);
    const list = usePromptShortcutStore.getState().shortcuts;
    
    // newList.splice(oldIndex) 即拿走 1; newList.splice(newIndex-1) 放入 1 -> 输出应为 2, 3, 1
    expect(list[0].id).toBe('2');
    expect(list[1].id).toBe('3');
    expect(list[2].id).toBe('1');
    expect((global as any).window.api.shortcuts.saveShortcuts).toHaveBeenCalledWith(list);
  });
});
