export interface DatabaseDriver {
  execute(sql: string, params?: any[]): Promise<any>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ExpoSqliteDatabase {
  execAsync(sql: string, params?: any[]): Promise<any>;
  withTransactionAsync<T>(callback: () => Promise<T>): Promise<T>;
  closeAsync(): Promise<void>;
}

/**
 * Driver adapter for expo-sqlite to conform to the shared DatabaseDriver interface.
 * Used exclusively by apps/mobile during initialization.
 */
export class ExpoSqliteDriver implements DatabaseDriver {
  constructor(private readonly db: ExpoSqliteDatabase) {}

  async execute(sql: string, params: any[] = []): Promise<any> {
    return this.db.execAsync(sql, params);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.withTransactionAsync(fn);
  }

  async close(): Promise<void> {
    return this.db.closeAsync();
  }
}
