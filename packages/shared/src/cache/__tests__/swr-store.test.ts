import { describe, it, expect } from 'vitest'
import { createStaleWhileRevalidateStore } from '../swr-store'

describe('createStaleWhileRevalidateStore', () => {
  it('returns null peek when scopeKey mismatches', () => {
    const store = createStaleWhileRevalidateStore<{ value: number }>()
    store.commit('a', { value: 1 })
    expect(store.peek('b')).toBeNull()
  })

  it('marks snapshot stale after invalidate without clearing value', () => {
    const store = createStaleWhileRevalidateStore<{ value: number }>()
    store.commit('vault', { value: 42 })
    expect(store.peek('vault')?.stale).toBe(false)

    store.invalidate()
    const peek = store.peek('vault')
    expect(peek?.value).toEqual({ value: 42 })
    expect(peek?.stale).toBe(true)
  })

  it('clears snapshot on clear()', () => {
    const store = createStaleWhileRevalidateStore<{ value: number }>()
    store.commit('vault', { value: 1 })
    store.clear()
    expect(store.peek('vault')).toBeNull()
  })

  it('notifies subscribers on commit and invalidate', () => {
    const store = createStaleWhileRevalidateStore<number>()
    let version = store.getVersion()
    const unsub = store.subscribe(() => {
      version = store.getVersion()
    })

    store.commit('k', 1)
    expect(version).toBe(0)

    store.invalidate()
    expect(version).toBe(1)
    unsub()
  })
})
