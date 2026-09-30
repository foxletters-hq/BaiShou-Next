import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../app/(tabs)/_layout.tsx'),
  'utf8'
)

describe('companion tab gate badge chrome', () => {
  it('should hide the companion badge on the agent tab and style it with theme tokens', () => {
    expect(src).toContain('!agentTabActive && pendingGateCount > 0')
    expect(src).toContain('colors.warning')
    expect(src).toContain('uiTypography.sm')
    expect(src).not.toMatch(/tabBarBadge:\s*pendingGateCount/)
  })
})
