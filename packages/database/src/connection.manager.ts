import { createClient, Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { AppDatabase } from './types';
import {
  IDatabaseConnectionManager,
  DatabaseLifecycleListener,
  DatabaseConnectionError,
  DatabaseNotConnectedError
} from './connection.manager.types';

export class DatabaseConnectionManager implements IDatabaseConnectionManager {
  private _sqliteDb: Client | null = null;
  private _drizzleDb: AppDatabase | null = null;
  private _currentPath: string | null = null;
  
  private _onConnectListeners: Set<DatabaseLifecycleListener> = new Set();
  private _onDisconnectListeners: Set<() => void | Promise<void>> = new Set();

  public async connect(dbPath: string): Promise<AppDatabase> {
    // If connecting to the same path, just return the current instance.
    if (this._currentPath === dbPath && this._drizzleDb) {
      return this._drizzleDb;
    }

    // If connected to a different path, disconnect first.
    if (this.isConnected()) {
      await this.disconnect();
    }

    try {
      this._sqliteDb = createClient({ url: `file:${dbPath}` });
      
      this._drizzleDb = drizzle(this._sqliteDb);
      this._currentPath = dbPath;

      // Notify connect listeners
      for (const listener of this._onConnectListeners) {
        await listener(this._drizzleDb, dbPath);
      }

      return this._drizzleDb;
    } catch (error: any) {
      this._sqliteDb = null;
      this._drizzleDb = null;
      this._currentPath = null;
      throw new DatabaseConnectionError(dbPath, error.message || String(error));
    }
  }

  public async disconnect(): Promise<void> {
    if (!this._sqliteDb) {
      return;
    }

    try {
      // Notify disconnect listeners first before closing the DB
      for (const listener of this._onDisconnectListeners) {
        await listener();
      }
      
      this._sqliteDb.close();
    } finally {
      this._sqliteDb = null;
      this._drizzleDb = null;
      this._currentPath = null;
    }
  }

  public getDb(): AppDatabase {
    if (!this._drizzleDb) {
      throw new DatabaseNotConnectedError();
    }
    return this._drizzleDb;
  }

  public isConnected(): boolean {
    return this._drizzleDb !== null;
  }

  public getCurrentPath(): string | null {
    return this._currentPath;
  }

  public onConnect(listener: DatabaseLifecycleListener): () => void {
    this._onConnectListeners.add(listener);
    return () => {
      this._onConnectListeners.delete(listener);
    };
  }

  public onDisconnect(listener: () => void | Promise<void>): () => void {
    this._onDisconnectListeners.add(listener);
    return () => {
      this._onDisconnectListeners.delete(listener);
    };
  }
}

// Export a global singleton instance for easy DI / module usage
export const connectionManager = new DatabaseConnectionManager();
