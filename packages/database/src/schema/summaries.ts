import { sqliteTable, integer, text, unique } from "drizzle-orm/sqlite-core";

export const summariesTable = sqliteTable('summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['weekly', 'monthly', 'quarterly', 'yearly'] }).notNull(),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  content: text('content').notNull(),
  sourceIds: text('source_ids'),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull().defaultNow()
}, (t) => ({
  unq: unique().on(t.type, t.startDate, t.endDate)
}));
