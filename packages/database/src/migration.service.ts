import { Client } from '@libsql/client';
import { AppDatabase } from './types';
import * as fs from 'fs';
import * as path from 'path';
  import { migrationsTable } from './schema/migrations';

export interface MigrationJournal {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
}

export class MigrationService {
  private db: AppDatabase;
  private client: Client;
  private migrationDir: string;

  constructor(db: AppDatabase, client: Client, migrationDir: string) {
    this.db = db;
    this.client = client;
    this.migrationDir = migrationDir;
  }

  public async runMigrations(): Promise<void> {
    try {
      console.log('[MigrationService] Checking migrations from:', this.migrationDir);

      let hasMigrationsTable = await this.migrationsTableExists();

      if (!hasMigrationsTable) {
        console.log('[MigrationService] Migrations tracking table missing, assuming fresh DB state.');
        try {
          // Check for legacy schema
          const legacyCheck = await this.client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'`);
          if (legacyCheck.rows.length > 0) {
            console.log('[MigrationService] Legacy DB detected. Backfilling __drizzle_migrations table.');
            await this.client.executeMultiple(`
              CREATE TABLE IF NOT EXISTS __drizzle_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                tag TEXT NOT NULL,
                executed_at INTEGER NOT NULL
              );
            `);
            hasMigrationsTable = true;
            
            const journal = await this.readMigrationJournal();
            if (journal.entries.length > 0) {
              const firstMigration = journal.entries[0];
              await this.client.execute({
                sql: `INSERT INTO __drizzle_migrations (version, tag, executed_at) VALUES (?, ?, ?)`,
                args: [firstMigration.idx, firstMigration.tag, Date.now()]
              });
            }
          }
        } catch (e) {
          console.warn('[MigrationService] Failed to check for legacy DB:', e);
        }
      }

      const journal = await this.readMigrationJournal();
      if (!journal.entries.length) {
        console.log('[MigrationService] No migrations found in journal.');
        return;
      }

      const appliedMigrations = hasMigrationsTable ? await this.getAppliedMigrations() : [];
      const appliedVersions = new Set(appliedMigrations.map((m) => Number(m.version)));

      const pendingMigrations = journal.entries
        .filter((entry) => !appliedVersions.has(entry.idx))
        .sort((a, b) => a.idx - b.idx);

      if (pendingMigrations.length === 0) {
        console.log('[MigrationService] Database schema is fully up to date.');
        return;
      }

      console.log(`[MigrationService] Found ${pendingMigrations.length} pending migrations to execute...`);

      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('[MigrationService] Database migration sync completed successfully!');
    } catch (error) {
      console.error('[MigrationService] Core failure during migrations:', error);
      throw error;
    }
  }

  private async migrationsTableExists(): Promise<boolean> {
    try {
      const table = await this.client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`);
      return table.rows.length > 0;
    } catch (error) {
      console.warn('[MigrationService] Error checking migration table existence.', error);
      return false;
    }
  }

  private async readMigrationJournal(): Promise<MigrationJournal> {
    const journalPath = path.join(this.migrationDir, 'meta', '_journal.json');

    if (!fs.existsSync(journalPath)) {
      console.warn('[MigrationService] No _journal.json found at:', journalPath);
      return { version: '7', dialect: 'sqlite', entries: [] };
    }

    try {
      const journalContent = fs.readFileSync(journalPath, 'utf-8');
      return JSON.parse(journalContent) as MigrationJournal;
    } catch (error) {
      console.error('[MigrationService] FATAL ERROR reading journal JSON:', error);
      throw error;
    }
  }

  private async getAppliedMigrations(): Promise<{ version: number }[]> {
    try {
      return await this.db.select({ version: migrationsTable.version }).from(migrationsTable);
    } catch (error) {
      console.error('[MigrationService] Failed to read from existing __drizzle_migrations table!', error);
      throw error;
    }
  }

  private async executeMigration(migration: MigrationJournal['entries'][0]): Promise<void> {
    const sqlFilePath = path.join(this.migrationDir, `${migration.tag}.sql`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`[MigrationService] Missing required SQL file: ${sqlFilePath}`);
    }

    try {
      console.log(`[MigrationService] -> Applying migration: ${migration.tag}.sql (v${migration.version})`);
      const startTime = Date.now();

      const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
      
      const statements = sqlContent.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
      
      for (const statement of statements) {
        try {
          await this.client.executeMultiple(statement);
        } catch (err) {
          console.error(`[MigrationService] execution failed on statement:\n---\n${statement}\n---`);
          throw err;
        }
      }

      // Record telemetry into ___drizzle_migrations
      if (!(await this.migrationsTableExists())) {
         console.warn(`[MigrationService] Migrations table STILL missing after executeMultiple. Check if schema exported __drizzle_migrations! Creating manually.`);
         await this.client.executeMultiple(`
           CREATE TABLE IF NOT EXISTS __drizzle_migrations (
             version INTEGER PRIMARY KEY NOT NULL,
             tag TEXT NOT NULL,
             executed_at INTEGER NOT NULL
           );
         `);
      }

      await this.db.insert(migrationsTable).values({
        version: migration.idx,
        tag: migration.tag,
        executedAt: Date.now()
      });

      console.log(`[MigrationService] <- Migration ${migration.tag} succeeded in ${Date.now() - startTime}ms.`);
    } catch (error) {
      console.error(`[MigrationService] x- Migration FAILED at: ${migration.tag}`, error);
      throw error;
    }
  }
}
