import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const diariesTable = sqliteTable('diaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  content: text('content').notNull(),
  tags: text('tags'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
});
