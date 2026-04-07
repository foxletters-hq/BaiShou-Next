import { ipcMain } from 'electron';
import {
  ShadowIndexRepository,
  shadowConnectionManager
} from '@baishou/database';
import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl
} from '@baishou/core';
import { parseDateStr } from '@baishou/shared';

import { pathService, vaultService } from './vault.ipc';
import { CreateDiaryInput, UpdateDiaryInput } from '@baishou/shared';

/**
 * 日记管理服务工厂
 *
 * 重要架构变更（双库分离）：
 * - 日记影子索引现在从 shadowConnectionManager.getDb() 获取（shadow_index.db）
 * - 不再使用主 Agent DB（connectionManager.getDb()）
 * - 每次 IPC 调用时都从 shadowConnectionManager 取最新连接，保证 Vault 切换后的自动跟随
 */
export function getDiaryManager() {
  const shadowDb = shadowConnectionManager.getDb();

  const shadowRepo = new ShadowIndexRepository(shadowDb);
  const fileSync = new FileSyncServiceImpl(pathService);
  const shadowSync = new ShadowIndexSyncService(shadowRepo, pathService, vaultService);
  const vaultIndex = new VaultIndexServiceImpl();

  return new DiaryService(shadowRepo, fileSync, shadowSync, vaultIndex);
}

/**
 * 统一的日期字符串解析工具
 *
 * IPC 层收到的 date 可能是：
 *   - YYYY-MM-DD（推荐，直接由前端 formatLocalDate 生成）
 *   - YYYY-MM-DDTHH:mm:ss.sssZ（历史兼容，取 T 前的日期部分再 parseDateStr）
 *   - 已是 Date 对象（无需转换）
 *
 * 统一用 parseDateStr 确保本地时区解析，杜绝 new Date('YYYY-MM-DD') 的 UTC 陷阱。
 */
function parseInputDate(raw: string | Date | undefined): Date | undefined {
  if (!raw) return undefined;
  if (raw instanceof Date) return raw;
  // 截取 YYYY-MM-DD 部分（兼容带时间戳的历史格式）
  const datePart = String(raw).split('T')[0]!;
  return parseDateStr(datePart);
}

export function registerDiaryIPC() {
  ipcMain.handle('diary:create', async (_, input: CreateDiaryInput) => {
    if (input.date) input.date = parseInputDate(input.date as any) as Date;
    return await getDiaryManager().create(input);
  });

  ipcMain.handle('diary:update', async (_, id: number, input: UpdateDiaryInput) => {
    if (input.date) input.date = parseInputDate(input.date as any);
    return await getDiaryManager().update(id, input);
  });

  ipcMain.handle('diary:delete', async (_, id: number) => {
    return await getDiaryManager().delete(id);
  });

  ipcMain.handle('diary:findById', async (_, id: number) => {
    return await getDiaryManager().findById(id);
  });

  ipcMain.handle('diary:findByDate', async (_, dateStr: string) => {
    // dateStr 应为 YYYY-MM-DD 格式
    return await getDiaryManager().findByDate(parseDateStr(dateStr.split('T')[0]!));
  });

  ipcMain.handle('diary:listAll', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options);
  });

  ipcMain.handle('diary:list', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options);
  });

  ipcMain.handle('diary:search', async (_, query: string, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().search(query, options);
  });

  ipcMain.handle('diary:count', async () => {
    return await getDiaryManager().count();
  });
}
