import { describe, expect, it } from 'vitest'
import {
  enterAgentMigrationArchiveImport,
  exitAgentMigrationArchiveImport,
  isAgentMigrationArchiveImport
} from '../../../database/src/migration-context'

describe('migration-context', () => {
  it('tracks nested archive import depth', () => {
    expect(isAgentMigrationArchiveImport()).toBe(false)
    enterAgentMigrationArchiveImport()
    expect(isAgentMigrationArchiveImport()).toBe(true)
    enterAgentMigrationArchiveImport()
    expect(isAgentMigrationArchiveImport()).toBe(true)
    exitAgentMigrationArchiveImport()
    expect(isAgentMigrationArchiveImport()).toBe(true)
    exitAgentMigrationArchiveImport()
    expect(isAgentMigrationArchiveImport()).toBe(false)
    exitAgentMigrationArchiveImport()
    expect(isAgentMigrationArchiveImport()).toBe(false)
  })
})
