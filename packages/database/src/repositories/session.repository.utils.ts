export function generateSessionUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isBetterSqliteDb(db: unknown): boolean {
  return (db as any).session?.client?.prepare !== undefined
}

export { isBetterSqliteDb }
