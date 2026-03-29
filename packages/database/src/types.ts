import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * 提取全局通用数据库依赖接口
 * 剥离掉之前坏味道的 `any`，让外部显式注入 BetterSQLite 驱动或实现
 */
export type AppDatabase = BetterSQLite3Database<Record<string, unknown>>;
