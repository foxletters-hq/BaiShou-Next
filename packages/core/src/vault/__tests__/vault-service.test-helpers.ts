import { vi } from 'vitest'
import path from 'node:path'

export function createMockPathService(
  tempDir: string,
  getLocalActiveVaultId: () => Promise<string | null> = async () => null,
  setLocalActiveVaultId: (id: string) => Promise<void> = async () => {}
) {
  return {
    getRootDirectory: vi.fn().mockResolvedValue(tempDir),
    getGlobalRegistryDirectory: vi.fn().mockResolvedValue(tempDir),
    getVaultDirectory: vi.fn().mockImplementation(async (name: string) => path.join(tempDir, name)),
    getUserAvatarsDirectory: vi.fn().mockResolvedValue('/tmp/user-avatars'),
    getAvatarsDirectory: vi.fn().mockResolvedValue('/tmp/avatars'),
    getVaultSystemDirectory: vi
      .fn()
      .mockImplementation(async (name: string) => path.join(tempDir, name, '.baishou')),
    getLocalActiveVaultId: vi.fn().mockImplementation(getLocalActiveVaultId),
    setLocalActiveVaultId: vi.fn().mockImplementation(setLocalActiveVaultId)
  } as any
}
