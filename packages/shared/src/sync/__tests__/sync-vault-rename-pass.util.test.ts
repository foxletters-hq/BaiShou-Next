import { describe, expect, it, vi } from 'vitest'
import { SYNC_MANIFEST_VERSION } from '../../constants/incremental-sync.constants'
import type { SyncManifest } from '../../types/version-control.types'
import { threeWayMerge } from '../three-way-merge'
import {
  applyVaultRenamePassManifests,
  detectVaultRenameCandidates,
  executeVaultRenamePass,
  parseLastRemoteVaultsSnapshot,
  parseVaultIdToNameMap,
  serializeLastRemoteVaultsSnapshot,
  simulateVaultRenamePass
} from '../sync-vault-rename-pass.util'
import {
  assertBidirectionalDeletePropagationAllowed,
  SyncDeletePropagationBlockedError
} from '../sync-delete-guard'

const VAULT_ID = 'vlt_abcdef0123456789'

function entry(hash: string, size = 1): { hash: string; size: number; lastModified: number } {
  return { hash, size, lastModified: 1 }
}

function manifest(files: SyncManifest['files']): SyncManifest {
  return {
    version: SYNC_MANIFEST_VERSION,
    updatedAt: 1,
    deviceId: 'dev',
    files
  }
}

describe('sync-vault-rename-pass', () => {
  it('detects rename when local name changed and remote still has old prefix', () => {
    const remote = manifest({
      'Personal/a.md': entry('h1', 10),
      'Personal/b.md': entry('h2', 20),
      'Other/x.md': entry('ox', 1)
    })
    const candidates = detectVaultRenameCandidates(
      { [VAULT_ID]: '工作' },
      { [VAULT_ID]: 'Personal' },
      remote
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      vaultId: VAULT_ID,
      oldName: 'Personal',
      newName: '工作'
    })
    expect(candidates[0]!.remoteFilePaths.sort()).toEqual(['Personal/a.md', 'Personal/b.md'])
  })

  it('skips when remote already has new prefix', () => {
    const remote = manifest({
      '工作/a.md': entry('h1')
    })
    expect(
      detectVaultRenameCandidates({ [VAULT_ID]: '工作' }, { [VAULT_ID]: 'Personal' }, remote)
    ).toEqual([])
  })

  it('simulate pass aligns remote+ancestor so three-way merge is empty of transfers', () => {
    const files = {
      'Personal/a.md': entry('h1', 10),
      'Personal/b.md': entry('h2', 20)
    }
    const local = manifest({
      '工作/a.md': entry('h1', 10),
      '工作/b.md': entry('h2', 20)
    })
    const remote = manifest(files)
    const ancestor = manifest(files)

    const simulated = simulateVaultRenamePass({
      localVaults: { [VAULT_ID]: '工作' },
      lastRemoteVaults: { [VAULT_ID]: 'Personal' },
      remoteManifest: remote,
      ancestorSnapshot: ancestor
    })

    expect(simulated.applied).toBe(true)
    expect(simulated.renamedFileCount).toBe(2)

    const decisions = threeWayMerge(
      local,
      simulated.remoteManifest,
      simulated.ancestorSnapshot
    )
    const pending = decisions.filter((d) => d.type !== 'skip')
    expect(pending).toEqual([])
  })

  it('execute success migrates manifests and calls renameFile per path', async () => {
    const files = {
      'Personal/a.md': entry('h1'),
      'Personal/b.md': entry('h2')
    }
    const renameFile = vi.fn().mockResolvedValue(undefined)
    const result = await executeVaultRenamePass({
      localVaults: { [VAULT_ID]: '工作' },
      lastRemoteVaults: { [VAULT_ID]: 'Personal' },
      remoteManifest: manifest(files),
      ancestorSnapshot: manifest(files),
      cloudClient: { renameFile },
      preferDirectoryMove: false
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.renamedFileCount).toBe(2)
    expect(renameFile).toHaveBeenCalledWith('Personal/a.md', '工作/a.md')
    expect(renameFile).toHaveBeenCalledWith('Personal/b.md', '工作/b.md')
    expect(result.remoteManifest.files['工作/a.md']?.hash).toBe('h1')
    expect(result.ancestorSnapshot.files['Personal/a.md']).toBeUndefined()
  })

  it('execute falls back when renameFile missing', async () => {
    const files = { 'Personal/a.md': entry('h1') }
    const result = await executeVaultRenamePass({
      localVaults: { [VAULT_ID]: '工作' },
      lastRemoteVaults: { [VAULT_ID]: 'Personal' },
      remoteManifest: manifest(files),
      ancestorSnapshot: manifest(files),
      cloudClient: null
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('rename_unavailable')
  })

  it('execute abandons on failure without migrating manifests', async () => {
    const files = {
      'Personal/a.md': entry('h1'),
      'Personal/b.md': entry('h2')
    }
    const remote = manifest(files)
    const ancestor = manifest(files)
    const renameFile = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))

    const result = await executeVaultRenamePass({
      localVaults: { [VAULT_ID]: '工作' },
      lastRemoteVaults: { [VAULT_ID]: 'Personal' },
      remoteManifest: remote,
      ancestorSnapshot: ancestor,
      cloudClient: { renameFile },
      preferDirectoryMove: false
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('rename_failed')
    // 输入对象未被就地改写
    expect(remote.files['Personal/a.md']).toBeDefined()
    expect(ancestor.files['Personal/b.md']).toBeDefined()
  })

  it('WebDAV preferDirectoryMove uses single directory MOVE when it succeeds', async () => {
    const files = {
      'Personal/a.md': entry('h1'),
      'Personal/b.md': entry('h2')
    }
    const renameFile = vi.fn().mockResolvedValue(undefined)
    const result = await executeVaultRenamePass({
      localVaults: { [VAULT_ID]: '工作' },
      lastRemoteVaults: { [VAULT_ID]: 'Personal' },
      remoteManifest: manifest(files),
      ancestorSnapshot: manifest(files),
      cloudClient: { renameFile },
      preferDirectoryMove: true
    })
    expect(result.ok).toBe(true)
    expect(renameFile).toHaveBeenCalledTimes(1)
    expect(renameFile).toHaveBeenCalledWith('Personal', '工作')
  })

  it('applyVaultRenamePassManifests migrates both sides', () => {
    const files = { 'Old/a.md': entry('h') }
    const { remoteManifest, ancestorSnapshot, migratedKeyCount } = applyVaultRenamePassManifests(
      manifest(files),
      manifest(files),
      [{ oldName: 'Old', newName: 'New' }]
    )
    expect(migratedKeyCount).toBe(2)
    expect(remoteManifest.files['New/a.md']?.hash).toBe('h')
    expect(ancestorSnapshot.files['New/a.md']?.hash).toBe('h')
  })

  it('parseVaultIdToNameMap and last-remote-vaults roundtrip', () => {
    expect(
      parseVaultIdToNameMap([
        { id: VAULT_ID, name: 'Personal' },
        { id: 'bad', name: 'X' },
        { name: 'NoId' }
      ])
    ).toEqual({ [VAULT_ID]: 'Personal' })

    const snap = serializeLastRemoteVaultsSnapshot({ [VAULT_ID]: '工作' }, 42)
    expect(parseLastRemoteVaultsSnapshot(snap)).toEqual(snap)
  })

  it('delete guard ignores rename-protected delete-remote paths for mass_delete', () => {
    const remoteFiles = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`Personal/f${i}.md`, entry(`h${i}`)])
    )
    // 本地已全部在新前缀；对删除护栏而言 local 非空但没有旧路径
    const local = manifest(
      Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`工作/f${i}.md`, entry(`h${i}`)])
      )
    )
    const remote = manifest(remoteFiles)
    const ancestor = remote
    const decisions = threeWayMerge(local, remote, ancestor)
    const deleteRemotes = decisions.filter((d) => d.type === 'delete-remote')
    expect(deleteRemotes.length).toBe(20)

    // 不带保护时：localInitiated=true 会放行；构造「非 localInitiated」场景用空 local 的无关文件
    // 这里验证 ignore 集合后 mass_delete 计数为 0
    const protectedPaths = new Set(deleteRemotes.map((d) => d.filePath))
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor, undefined, {
        ignoreDeleteRemotePaths: protectedPaths
      })
    ).not.toThrow()

    // 若忽略集为空且把 local 置空，则应触发 mass_delete
    const emptyLocal = manifest({})
    const emptyDecisions = threeWayMerge(emptyLocal, remote, ancestor)
    expect(() =>
      assertBidirectionalDeletePropagationAllowed(emptyDecisions, emptyLocal, remote, ancestor)
    ).toThrow(SyncDeletePropagationBlockedError)

    expect(() =>
      assertBidirectionalDeletePropagationAllowed(
        emptyDecisions,
        emptyLocal,
        remote,
        ancestor,
        undefined,
        { ignoreDeleteRemotePaths: protectedPaths }
      )
    ).not.toThrow()
  })
})
