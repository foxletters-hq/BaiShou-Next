import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'WorkbenchGeneralSettingsPane.tsx'),
  'utf8'
)

describe('WorkbenchGeneralSettingsPane chrome', () => {
  it('should not host notebook import settings', () => {
    expect(src).not.toContain('knowledge_import_section')
    expect(src).not.toContain('knowledge_import_process')
    expect(src).not.toContain('importProcessMode')
  })

  it('should use the official small outlined restore button', () => {
    expect(src).toContain('from \'@baishou/ui\'')
    expect(src).toContain('Button')
    expect(src).toContain('size="small"')
    expect(src).toContain('variant="outlined"')
    expect(src).toContain('settings.reset_default')
    expect(src).not.toContain('settings-card-link-action')
    expect(src).not.toContain('generalAction')
  })
})
