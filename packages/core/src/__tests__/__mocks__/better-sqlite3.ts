/**
 * better-sqlite3 的 vitest mock 替身。
 * 在 core 包单元测试中，大部分测试使用纯内存 mock 仓库而非真实 SQLite 连接。
 * 此 mock 防止 native binding 加载失败阻断整个测试套件。
 */
class MockDatabase {
  pragma(_: string) { return undefined; }
  prepare(_: string) {
    return {
      run: (..._args: any[]) => ({ changes: 0 }),
      get: (..._args: any[]) => undefined,
      all: (..._args: any[]) => [],
    };
  }
  exec(_: string) { return this; }
  close() {}
  transaction(fn: any) { return fn; }
}

export default MockDatabase;
export { MockDatabase as Database };
