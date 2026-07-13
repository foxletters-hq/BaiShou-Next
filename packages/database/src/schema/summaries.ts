import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core'

export const summariesTable = sqliteTable(
  'summaries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', {
      enum: ['weekly', 'monthly', 'quarterly', 'yearly']
    }).notNull(),
    startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
    content: text('content').notNull(),
    sourceIds: text('source_ids'),
    generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull().defaultNow(),
    /** 用户手动保存后写入；仅 AI 生成时为空，用于区分「生成于 / 保存于」 */
    updatedAt: integer('updated_at', { mode: 'timestamp' })
  },
  (t) => ({
    unq: unique().on(t.type, t.startDate, t.endDate)
  })
)
