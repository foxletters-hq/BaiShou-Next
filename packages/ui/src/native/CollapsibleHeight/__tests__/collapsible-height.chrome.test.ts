import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../CollapsibleHeight.tsx'), 'utf8')

describe('native CollapsibleHeight chrome', () => {
  it('should ignore pointer events on the clip while collapsed', () => {
    expect(src).toContain("pointerEvents={expanded ? 'auto' : 'none'}")
    expect(src).toContain('styles.clip')
  })

  it('should support settled mode with natural flow to prevent nested animation desync', () => {
    expect(src).toContain('clipSettled')
    expect(src).toContain('contentSettled')
    expect(src).toContain('isSettled')
    expect(src).toContain("position: 'relative'")
    expect(src).toContain("height: 'auto'")
    expect(src).toContain('expandGenRef')
  })

  it('should bypass collapse/expand animations on initial mount so views display directly', () => {
    expect(src).toContain('isInitialMountRef')
    expect(src).toContain('prevExpandedRef')
    expect(src).toContain('if (!wasExpanded)')
  })

  it('should not re-trigger effect on isSettled state change and cancel collapse animation', () => {
    expect(src).toContain('isSettledRef')
    expect(src).toContain('clearSettled')
    expect(src).not.toMatch(/if\s*\(!wasExpanded\)\s*\{\s*cancelAnimation/)
  })
})
