import { describe, expect, it } from 'vitest'
import { nextMountedCacheKeys, shouldShowRouteSwitchMask } from '../route-switch-mask.util'

describe('shouldShowRouteSwitchMask', () => {
  it('should hide the mask when first entering diary from an empty cache', () => {
    expect(
      shouldShowRouteSwitchMask({
        previousKey: null,
        nextKey: '/diary',
        mountedKeys: new Set()
      })
    ).toBe(false)
  })

  it('should hide the mask when first entering workbench that is not mounted yet', () => {
    expect(
      shouldShowRouteSwitchMask({
        previousKey: '/diary',
        nextKey: '/agent-workspace',
        mountedKeys: new Set(['/diary'])
      })
    ).toBe(false)
  })

  it('should show the mask when switching between two already mounted pages', () => {
    expect(
      shouldShowRouteSwitchMask({
        previousKey: '/diary',
        nextKey: '/chat',
        mountedKeys: new Set(['/diary', '/chat'])
      })
    ).toBe(true)
  })
})

describe('nextMountedCacheKeys', () => {
  it('should keep persistent diary and drop workbench after leaving it', () => {
    const next = nextMountedCacheKeys(new Set(['/diary', '/agent-workspace']), '/diary')
    expect([...next]).toEqual(['/diary'])
  })
})
