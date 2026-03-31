import { createStore } from '../create-store';
import type { PromptShortcut } from '@baishou/shared';

export interface PromptShortcutState {
  shortcuts: PromptShortcut[];
  isLoading: boolean;
}

export interface PromptShortcutActions {
  loadShortcuts: () => Promise<void>;
  addShortcut: (shortcut: PromptShortcut) => Promise<void>;
  updateShortcut: (shortcut: PromptShortcut) => Promise<void>;
  removeShortcut: (id: string) => Promise<void>;
  reorderShortcuts: (oldIndex: number, newIndex: number) => Promise<void>;
}

export const usePromptShortcutStore = createStore<PromptShortcutState & PromptShortcutActions>('PromptShortcutStore', (set, get: any) => ({
  shortcuts: [],
  isLoading: false,

  loadShortcuts: async () => {
    set({ isLoading: true });
    try {
      if (typeof window !== 'undefined' && (window as any).api?.shortcuts) {
        const list = await (window as any).api.shortcuts.getShortcuts();
        set({ shortcuts: list });
      }
    } catch (e) {
      console.error('[PromptShortcutStore] Failed to load shortcuts from IPC', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addShortcut: async (shortcut: PromptShortcut) => {
    const list = [...(get() as PromptShortcutState).shortcuts, shortcut];
    set({ shortcuts: list });
    if (typeof window !== 'undefined' && (window as any).api?.shortcuts) {
      await (window as any).api.shortcuts.saveShortcuts(list);
    }
  },

  updateShortcut: async (shortcut: PromptShortcut) => {
    const state = get() as PromptShortcutState;
    const list = state.shortcuts.map(e => e.id === shortcut.id ? shortcut : e);
    
    set({ shortcuts: list });
    if (typeof window !== 'undefined' && (window as any).api?.shortcuts) {
      await (window as any).api.shortcuts.saveShortcuts(list);
    }
  },

  removeShortcut: async (id: string) => {
    const state = get() as PromptShortcutState;
    const list = state.shortcuts.filter(e => e.id !== id);
    
    set({ shortcuts: list });
    if (typeof window !== 'undefined' && (window as any).api?.shortcuts) {
      await (window as any).api.shortcuts.saveShortcuts(list);
    }
  },

  reorderShortcuts: async (oldIndex: number, newIndex: number) => {
    const state = get() as PromptShortcutState;
    const newList = [...state.shortcuts];
    
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    const item = newList.splice(oldIndex, 1)[0];
    if (item) {
      newList.splice(newIndex, 0, item);
      set({ shortcuts: newList });
      
      if (typeof window !== 'undefined' && (window as any).api?.shortcuts) {
        await (window as any).api.shortcuts.saveShortcuts(newList);
      }
    }
  }
}));
