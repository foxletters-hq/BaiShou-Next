import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('native WorkspaceSettingsCard chrome', () => {
  it('manageLink button style should stretch full width and center (居中平放)', () => {
    const src = readFileSync(join(here, '../WorkspaceSettingsCard.tsx'), 'utf8')
    expect(src).toContain("alignSelf: 'stretch'")
    expect(src).toContain("justifyContent: 'center'")
  })

  it('uses CardLinkAction with variant card for workspace management', () => {
    const src = readFileSync(join(here, '../WorkspaceSettingsCard.tsx'), 'utf8')
    expect(src).toMatch(/<CardLinkAction[^>]*variant="card"/)
  })
})
