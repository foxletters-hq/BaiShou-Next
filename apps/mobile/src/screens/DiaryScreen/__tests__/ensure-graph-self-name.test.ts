import { describe, expect, it } from 'vitest'
import {
  DEFAULT_USER_PROFILE,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '@baishou/shared'
import { loadMobileGraphAwakenSelfName } from '../ensure-graph-self-name'

function memoryStore(init: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...init }
  return {
    get: async <T>(key: string) => (key in data ? (data[key] as T) : null),
    set: async <T>(key: string, value: T) => {
      data[key] = value
    },
    delete: async (key: string) => {
      delete data[key]
    }
  }
}

describe('loadMobileGraphAwakenSelfName', () => {
  it('should adopt a custom profile nickname without birthday when loading awaken state', async () => {
    const store = memoryStore({
      [USER_PROFILE_SETTINGS_KEY]: {
        ...DEFAULT_USER_PROFILE,
        nickname: '小明'
      }
    })
    const state = await loadMobileGraphAwakenSelfName(store)
    expect(state.ready).toBe(true)
    expect(state.selfName).toBe('小明')
    expect(await store.get(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)).toBe(true)
  })

  it('should stay unready when nickname is the default profile name', async () => {
    const store = memoryStore({
      [USER_PROFILE_SETTINGS_KEY]: DEFAULT_USER_PROFILE
    })
    const state = await loadMobileGraphAwakenSelfName(store)
    expect(state.ready).toBe(false)
    expect(state.selfName).toBe(null)
  })
})
