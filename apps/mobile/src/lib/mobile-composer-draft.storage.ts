import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ComposerDraftStorage } from '@baishou/ui/src/shared/composer-draft'

export const mobileComposerDraftStorage: ComposerDraftStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key)
}
