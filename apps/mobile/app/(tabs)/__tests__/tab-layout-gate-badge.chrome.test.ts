import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../_layout.tsx'), 'utf8')

describe('mobile tab bar gate badge chrome', () => {
  it('should hide the companion tab badge while already on that tab', () => {
    expect(src).toContain('usePathname')
    expect(src).toContain('agentTabActive')
    expect(src).toContain('!agentTabActive')
    expect(src).toContain('tabBarBadgeStyle')
  })
})
