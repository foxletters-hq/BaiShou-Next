import { AppDatabase } from './types';

/**
 * 数据库生命周期钩子类型
 */
export type DatabaseLifecycleListener = (db: AppDatabase, path: string) => void | Promise<void>;

/**
 * 数据库连接管理器接口
 * 负责 SQLite 驱动的全生命周期管理，支持跨工作区（Vault）热切换
 */
export interface IDatabaseConnectionManager {
  /**
   * 初始化并连接到指定工作区的数据库
   * @param dbPath SQLite 物理文件路径
   * @returns 建立好的 AppDatabase 实例
   * @throws {DatabaseConnectionError} 连接失败时抛出
   */
  connect(dbPath: string): Promise<AppDatabase>;

  /**
   * 安全断开当前数据库连接，并释放资源
   */
  disconnect(): Promise<void>;

  /**
   * 获取当前的数据库实例
   * @throws {DatabaseNotConnectedError} 若未连接则抛出
   */
  getDb(): AppDatabase;
  
  /**
   * 检查当前是否已连接
   */
  isConnected(): boolean;

  /**
   * 获取当前连接的数据库路径
   */
  getCurrentPath(): string | null;

  /**
   * 监听数据库变更事件（通常在多实例或 Vault 切换时）
   * @param listener 生命周期回调
   * @returns 提供取消订阅的函数
   */
  onConnect(listener: DatabaseLifecycleListener): () => void;
  onDisconnect(listener: () => void | Promise<void>): () => void;
}

/**
 * 数据库连接异常
 */
export class DatabaseConnectionError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`Failed to connect to database at ${path}: ${message}`);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * 数据库未连接异常
 */
export class DatabaseNotConnectedError extends Error {
  constructor() {
    super('Database is not currently connected. Call connect(path) first.');
    this.name = 'DatabaseNotConnectedError';
  }
}
