import { afterEach, describe, expect, it } from 'vitest'
import {
  GRAPH_SIDE_COLLAPSED_KEY,
  GRAPH_SIDE_WIDTH_DEFAULT,
  GRAPH_SIDE_WIDTH_KEY,
  GRAPH_SIDE_WIDTH_MAX,
  GRAPH_SIDE_WIDTH_MIN,
  clampGraphSideWidth,
  loadGraphSideCollapsed,
  loadGraphSideWidth,
  saveGraphSideCollapsed,
  saveGraphSideWidth
} from '../graph-page-side.util'

describe('clampGraphSideWidth', () => {
  it('should clamp below the minimum when the value is too small', () => {
    expect(clampGraphSideWidth(GRAPH_SIDE_WIDTH_MIN - 40)).toBe(GRAPH_SIDE_WIDTH_MIN)
  })

  it('should clamp above the maximum when the value is too large', () => {
    expect(clampGraphSideWidth(GRAPH_SIDE_WIDTH_MAX + 80)).toBe(GRAPH_SIDE_WIDTH_MAX)
  })

  it('should keep an in-range width unchanged', () => {
    expect(clampGraphSideWidth(400)).toBe(400)
  })
})

describe('loadGraphSideWidth', () => {
  afterEach(() => {
    localStorage.removeItem(GRAPH_SIDE_WIDTH_KEY)
  })

  it('should return the default when storage is empty or not a number', () => {
    // 与改动前 GraphPage 一致：getItem() 为 null 时 Number(null)===0，再夹到最小值。
    expect(loadGraphSideWidth({ getItem: () => null })).toBe(GRAPH_SIDE_WIDTH_MIN)
    expect(loadGraphSideWidth({ getItem: () => 'abc' })).toBe(GRAPH_SIDE_WIDTH_DEFAULT)
  })

  it('should clamp a stored width into the allowed range', () => {
    expect(loadGraphSideWidth({ getItem: () => '10' })).toBe(GRAPH_SIDE_WIDTH_MIN)
    expect(loadGraphSideWidth({ getItem: () => '9999' })).toBe(GRAPH_SIDE_WIDTH_MAX)
  })

  it('should return the default when getItem throws', () => {
    expect(
      loadGraphSideWidth({
        getItem: () => {
          throw new Error('blocked')
        }
      })
    ).toBe(GRAPH_SIDE_WIDTH_DEFAULT)
  })
})

describe('loadGraphSideCollapsed / saveGraphSideCollapsed', () => {
  afterEach(() => {
    localStorage.removeItem(GRAPH_SIDE_COLLAPSED_KEY)
  })

  it('should treat only the literal 1 as collapsed', () => {
    expect(loadGraphSideCollapsed({ getItem: () => '1' })).toBe(true)
    expect(loadGraphSideCollapsed({ getItem: () => '0' })).toBe(false)
    expect(loadGraphSideCollapsed({ getItem: () => null })).toBe(false)
  })

  it('should persist collapsed as 1 and expanded as 0', () => {
    const store = new Map<string, string>()
    const storage = {
      setItem: (key: string, value: string) => {
        store.set(key, value)
      }
    }
    saveGraphSideCollapsed(true, storage)
    saveGraphSideCollapsed(false, storage)
    expect(store.get(GRAPH_SIDE_COLLAPSED_KEY)).toBe('0')
    saveGraphSideCollapsed(true, storage)
    expect(store.get(GRAPH_SIDE_COLLAPSED_KEY)).toBe('1')
  })

  it('should return false when getItem throws', () => {
    expect(
      loadGraphSideCollapsed({
        getItem: () => {
          throw new Error('blocked')
        }
      })
    ).toBe(false)
  })
})

describe('saveGraphSideWidth', () => {
  it('should write the clamped width as a string', () => {
    const store = new Map<string, string>()
    saveGraphSideWidth(12, {
      setItem: (key, value) => {
        store.set(key, value)
      }
    })
    expect(store.get(GRAPH_SIDE_WIDTH_KEY)).toBe(String(GRAPH_SIDE_WIDTH_MIN))
  })
})
