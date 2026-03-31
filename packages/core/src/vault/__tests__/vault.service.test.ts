import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VaultService } from '../vault.service';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('VaultService Integration', () => {
  let tempDir: string;
  let service: VaultService;
  
  beforeEach(async () => {
    // 建立一个真实的沙盒目录模拟多系统的应用数据目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vault-test-'));

    // 提供给 VaultService 真实的临时目录
    const mockPathService = {
      getRootDirectory: vi.fn().mockResolvedValue(tempDir),
      getGlobalRegistryDirectory: vi.fn().mockResolvedValue(tempDir),
      getVaultDirectory: vi.fn().mockImplementation(async (name: string) => path.join(tempDir, name)),
      getVaultSystemDirectory: vi.fn().mockImplementation(async (name: string) => path.join(tempDir, name, '.baishou'))
    };

    const mockDbManager = {
      connect: vi.fn().mockResolvedValue(undefined)
    };

    service = new VaultService(mockPathService as any, mockDbManager as any);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  });

  it('should auto correct corrupted foreign absolute paths to local paths when initializing', async () => {
    // 主动注入一个带着异乎寻常的 Windows (C:\) 或者错乱绝对路径的 json，模拟 ZIP 迁移
    const registryPath = path.join(tempDir, 'vault_registry.json');
    const corruptedJson = [{
      name: 'Personal',
      path: 'C:\\Users\\ForeignUser\\AppData\\Roaming\\BaiShou\\Personal',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    }];
    await fs.writeFile(registryPath, JSON.stringify(corruptedJson));

    await service.initRegistry();

    const vaults = service.getAllVaults();
    expect(vaults.length).toBe(1);
    
    // 它应当已经被修正为基于当前系统 tempDir 下的路径 (自动根据 OS 判断路径拼接)
    const expected = path.join(tempDir, 'Personal');
    expect(vaults[0].path).toBe(expected);

    // 文件上也应该被静默修正了
    const fixedContent = await fs.readFile(registryPath, 'utf8');
    const parsed = JSON.parse(fixedContent);
    expect(parsed[0].path).toBe(expected);
  });
});
