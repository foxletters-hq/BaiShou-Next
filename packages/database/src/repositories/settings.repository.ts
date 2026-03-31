import { eq } from 'drizzle-orm';
import { systemSettingsTable } from '../schema/system-settings';

export class SettingsRepository {
  constructor(private readonly db: any) {}

  /**
   * 获取指定键的配置，并反序列化为模型 T。若不存在则返回 null。
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    try {
      return JSON.parse(result[0].value) as T;
    } catch (e) {
      console.error(`[SettingsRepository] Failed to parse JSON for key: ${key}`, e);
      return null;
    }
  }

  /**
   * 将任意数据模型序列化为 JSON 字符串，并保存至数据库。支持插入和更新 (Upsert)。
   */
  async set<T>(key: string, value: T): Promise<void> {
    const jsonStr = JSON.stringify(value);
    
    await this.db.insert(systemSettingsTable)
      .values({
        key,
        value: jsonStr,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: jsonStr,
          updatedAt: new Date()
        }
      });
  }

  /**
   * 删除指定的配置键。
   */
  async delete(key: string): Promise<void> {
    await this.db.delete(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key));
  }
}
