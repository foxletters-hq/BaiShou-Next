import { describe, expect, it } from 'vitest'
import {
  collectOtherSyncWarnings,
  formatVaultLabel,
  formatVaultStats
} from '../incremental-sync-confirm.util'

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'data_sync.plan_stat_upload') return `up:${options?.count}`
  if (key === 'data_sync.plan_stat_download') return `down:${options?.count}`
  if (key === 'data_sync.plan_vault_root') return '根目录文件'
  if (key === 'data_sync.plan_vault_unknown') return '未知工作区'
  return key
}

describe('formatVaultStats', () => {
  it('should join only non-zero stats when some counts are zero', () => {
    expect(
      formatVaultStats(
        {
          vaultId: 'v1',
          vaultName: 'home',
          upload: 2,
          download: 0,
          deleteLocal: 1,
          deleteRemote: 0,
          conflict: 0
        } as never,
        t
      )
    ).toBe('up:2 · data_sync.plan_stat_delete_local')
  })
})

describe('formatVaultLabel', () => {
  it('should use the root label when vault name is the root sentinel', () => {
    expect(formatVaultLabel('__root__', t)).toBe('根目录文件')
  })

  it('should keep the original name when it is a real vault', () => {
    expect(formatVaultLabel('工作区甲', t)).toBe('工作区甲')
  })
})

describe('collectOtherSyncWarnings', () => {
  it('should drop boundary and blocked keys when mixing warning keys', () => {
    expect(
      collectOtherSyncWarnings([
        'data_sync.plan_warning_unknown_vault_paths',
        'data_sync.plan_warning_delete_blocked',
        'data_sync.plan_warning_custom'
      ])
    ).toEqual(['data_sync.plan_warning_custom'])
  })
})
