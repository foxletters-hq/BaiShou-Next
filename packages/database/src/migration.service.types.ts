export interface MigrationJournal {
  version: string
  dialect: string
  entries: Array<{
    idx: number
    version: string
    when: number
    tag: string
    breakpoints: boolean
  }>
}

export interface EmbeddedMigrations {
  journal: MigrationJournal
  sqlByTag: Record<string, string>
}

export type MigrationSqlExecutor = (statement: string, args?: any[]) => Promise<any>
