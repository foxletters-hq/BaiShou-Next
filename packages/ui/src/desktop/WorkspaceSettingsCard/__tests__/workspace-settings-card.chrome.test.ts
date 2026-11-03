import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const workspaceCss = readFileSync(join(here, '..', 'WorkspaceSettingsCard.module.css'), 'utf8')
const settingsListTileCss = readFileSync(
  join(here, '..', '..', 'shared', 'SettingsListTile.css'),
  'utf8'
)

describe('WorkspaceSettingsCard typography', () => {
  it('should use var(--font-family-mono) for workspace path text to preserve Noto Sans SC fallback', () => {
    expect(workspaceCss).toContain('font-family: var(--font-family-mono);')
    expect(workspaceCss).not.toContain("'Fira Code', 'Consolas', monospace")
  })

  it('should use var(--font-family-mono) in settings-monospace shared class', () => {
    expect(settingsListTileCss).toContain('font-family: var(--font-family-mono);')
    expect(settingsListTileCss).not.toContain("'Fira Code', 'Consolas', monospace")
  })
})
