import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('workspace chat memory source', () => {
  it('should pass the vault raw data source into the workspace stream', () => {
    const src = readFileSync(join(here, '../agent-workspace-chat.service.ts'), 'utf8')
    expect(src).toContain('getRawDataSourceManager')
    expect(src).toContain('rawDataSourceManager: getRawDataSourceManager()')
  })
})
