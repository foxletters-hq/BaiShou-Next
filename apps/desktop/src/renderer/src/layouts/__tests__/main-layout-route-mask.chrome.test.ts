import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MainLayout.tsx'),
  'utf8'
)

describe('MainLayout route mask chrome', () => {
  it('should gate the fade overlay with shouldShowRouteSwitchMask', () => {
    expect(src).toContain('shouldShowRouteSwitchMask')
    expect(src).toContain('ROUTE_SWITCH_MASK_SECONDS')
    expect(src).not.toContain('duration: 0.35')
  })
})
