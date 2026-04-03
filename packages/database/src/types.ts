import { LibSQLDatabase } from 'drizzle-orm/libsql';

/**
 * 提取全局通用数据库依赖接口
 */
export type AppDatabase = LibSQLDatabase<Record<string, unknown>>;
