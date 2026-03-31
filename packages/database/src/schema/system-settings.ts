import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const systemSettingsTable = sqliteTable('system_settings', {
  key: text('key').primaryKey(), // 唯一键 (如: 'ai_providers', 'hotkeys')
  value: text('value').notNull(), // JSON 字符串
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow()
});
