import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Custom Migration tracking table for internal MigrationService
 * Keeps track of applied migrations securely across updates
 */
export const migrationsTable = sqliteTable('__drizzle_migrations', {
  version: integer('version').primaryKey().notNull(),
  tag: text('tag').notNull(),
  executedAt: integer('executed_at').notNull(),
});

export type MigrationRecord = typeof migrationsTable.$inferSelect;
export type NewMigrationRecord = typeof migrationsTable.$inferInsert;
