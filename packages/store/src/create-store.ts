import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Zustand factory setup for shared hooks.
 * Cross-platform structure ensures React Native and Electron sync perfectly.
 */
export function createStore<T>(name: string, storeCreator: (set: any, get: any) => T) {
  return create<T>()(
    devtools(
      storeCreator,
      { name }
    )
  );
}
