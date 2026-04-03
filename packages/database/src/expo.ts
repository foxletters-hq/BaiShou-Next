import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema/summaries'; // and combine
// WE MUST explicitly export to avoid connection.manager triggering better-sqlite3
export * from './schema/summaries';
export * from './schema/agent-sessions';
export * from './schema/agent-messages';
export * from './schema/agent-parts';
export * from './schema/agent-assistants';
export * from './schema/compression-snapshots';
export * from './schema/vectors';
export * from './schema/system-settings';
export * from './schema/shadow-index';

export * from './repositories/diary.repository';
export * from './repositories/agent.repository';
export * from './repositories/session.repository';
export * from './repositories/assistant.repository';
export * from './repositories/message.repository';
export * from './repositories/settings.repository';
export * from './repositories/hybrid-search.repository';
export * from './repositories/snapshot.repository';
export * from './repositories/settings.defaults';
export * from './repositories/user-profile.repository';
export * from './repositories/prompt-shortcut.repository';
export * from './repositories/shadow-index.repository';
export * from './repositories/summary.repository.impl';

export * from './drivers/vec-capability';

import { AppDatabase } from './types';
import { ExpoSqliteDriver, ExpoSqliteDatabase } from './drivers/expo-sqlite.driver';

// 特别为 Expo 环境提供的原生依赖解耦
export function initExpoDatabase(expoDb: ExpoSqliteDatabase): { drizzleDb: AppDatabase; driver: ExpoSqliteDriver } {
  // 注入 drizzle 适配器
  // For Expo, we don't pass the schema object because Drizzle handles queries generically,
  // but if needed we can combain schemas.
  const drizzleDb = drizzle(expoDb) as unknown as AppDatabase;
  const driver = new ExpoSqliteDriver(expoDb);

  return { drizzleDb, driver };
}
