import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dockSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGateDock.tsx'),
  'utf8'
)

describe('AgentGateDock reject', () => {
  it('should reject companion questions immediately instead of opening custom input', () => {
    expect(dockSource).toContain('shouldCollectRejectFeedback')
    expect(dockSource).not.toMatch(
      /const handleReject = \(\) => \{\s*if \(allowCustomInput\) \{\s*setShowFeedback\(true\)/
    )
  })
})
