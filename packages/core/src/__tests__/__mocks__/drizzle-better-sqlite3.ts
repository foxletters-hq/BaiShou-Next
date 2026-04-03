/**
 * drizzle-orm/better-sqlite3 的 vitest mock 替身。
 */
export function drizzle(_db: any, _options?: any) {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'select') return () => ({ from: () => ({ where: () => ({ all: () => [] }) }) });
      if (prop === 'insert') return () => ({ values: () => ({ returning: () => [] }) });
      if (prop === 'update') return () => ({ set: () => ({ where: () => ({}) }) });
      if (prop === 'delete') return () => ({ where: () => ({}) });
      return () => ({});
    }
  });
}
