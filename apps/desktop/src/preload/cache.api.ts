import { ipcRenderer } from 'electron'
import type { DomainMutationEvent } from '@baishou/shared/cache'
import { CACHE_DOMAIN_MUTATION_CHANNEL } from '@baishou/shared/cache'

export const cacheApi = {
  cache: {
    onDomainMutation: (callback: (event: DomainMutationEvent) => void) => {
      const handler = (_: unknown, event: DomainMutationEvent) => callback(event)
      ipcRenderer.on(CACHE_DOMAIN_MUTATION_CHANNEL, handler)
      return () => ipcRenderer.off(CACHE_DOMAIN_MUTATION_CHANNEL, handler)
    }
  }
}
