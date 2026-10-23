import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MainLayout.tsx'),
  'utf8'
)
const agentLayoutSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'features', 'agent', 'AgentLayout.tsx'),
  'utf8'
)

describe('MainLayout route mask chrome', () => {
  it('should gate the fade overlay with shouldShowRouteSwitchMask', () => {
    expect(src).toContain('shouldShowRouteSwitchMask')
    expect(src).toContain('ROUTE_SWITCH_MASK_SECONDS')
    expect(src).not.toContain('duration: 0.35')
  })

  it('should keep the fade overlay mounted until its animation completes', () => {
    expect(src).toContain('useLayoutEffect')
    expect(src).toContain('routeMask')
    expect(src).toContain('onAnimationComplete')
  })

  it('should fade the companion page in on first mount so the chat background does not pop', () => {
    expect(agentLayoutSrc).toContain("import { motion } from 'framer-motion'")
    expect(agentLayoutSrc).toContain('initial={{ opacity: 0 }}')
    expect(agentLayoutSrc).toContain('animate={{ opacity: 1 }}')
  })
})
