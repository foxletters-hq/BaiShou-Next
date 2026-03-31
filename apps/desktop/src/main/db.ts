import { app } from 'electron';
import { join } from 'path';
import { initNodeDatabase } from '@baishou/database';

// 全局单例数据库实例
const dbPath = join(app.getPath('userData'), 'baishou_next_agent.db');
export const appDb = initNodeDatabase(dbPath);
