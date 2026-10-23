import { describe, it, expect, vi, beforeEach } from 'vitest'

const openDatabaseAsync = vi.fn()
const deleteDatabaseAsync = vi.fn()

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => openDatabaseAsync(...args),
  deleteDatabaseAsync: (...args: unknown[]) => deleteDatabaseAsync(...args)
}))

describe('withMobileMigrationSqlite', () => {
  beforeEach(() => {
    vi.resetModules()
    openDatabaseAsync.mockReset()
    deleteDatabaseAsync.mockReset()
  })

  it('should open a new sqlite connection instead of reusing the agent database', async () => {
    const closeAsync = vi.fn(async () => undefined)
    openDatabaseAsync.mockResolvedValue({ closeAsync })
    deleteDatabaseAsync.mockResolvedValue(undefined)

    const { withMobileMigrationSqlite } = await import('../mobile-legacy-version-migration.sqlite')
    const seen = await withMobileMigrationSqlite(async (client) => client)

    expect(openDatabaseAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^baishou_migration_\d+\.db$/),
      { useNewConnection: true }
    )
    expect(seen).toEqual({ closeAsync })
    expect(closeAsync).toHaveBeenCalledTimes(1)
    expect(deleteDatabaseAsync).toHaveBeenCalledTimes(1)
  })
})
