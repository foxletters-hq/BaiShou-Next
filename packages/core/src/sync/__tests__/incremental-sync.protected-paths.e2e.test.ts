import * as crypto from 'crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { SYNC_MANIFEST_VERSION } from '@baishou/shared'
import { SimulatedSyncDevice } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'

const VAULT_JSON = 'Personal/.baishou/vault.json'
const REGISTRY_JSON = 'vault_registry.json'
const GLOBAL_SETTINGS = '.baishou/settings/app_preferences.json'
const USER_SKILL = '.agents/skills/demo/SKILL.md'
const LEGACY_SETTINGS = 'Personal/.baishou/settings/user_profile.json'
const REMOTE_JOURNAL = 'Personal/Journals/2026/01/remote.md'

function md5(content: string | Buffer): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

function manifestEntry(content: string | Buffer, lastModified: number) {
  return { hash: md5(content), size: Buffer.byteLength(content), lastModified }
}

describe('incremental sync protected paths e2e', { timeout: 30_000 }, () => {
  let cloud: SharedCloudStore
  let devices: SimulatedSyncDevice[]

  afterEach(() => {
    for (const device of devices) device.destroy()
    devices = []
    cloud?.clear()
  })

  it('recovers protected remote objects missing from an old manifest and prefers remote on first sync', async () => {
    cloud = new SharedCloudStore()
    devices = []
    const now = Date.now()
    const remoteVault = JSON.stringify({
      id: 'vlt_aaaaaaaaaaaaaaaa',
      displayName: 'Personal',
      createdAt: new Date(now - 10_000).toISOString()
    })
    const remoteRegistry = JSON.stringify([
      {
        id: 'vlt_aaaaaaaaaaaaaaaa',
        name: 'Personal',
        path: '/remote/Personal',
        createdAt: new Date(now - 10_000).toISOString(),
        lastAccessedAt: new Date(now - 10_000).toISOString()
      }
    ])
    const remoteSettings = JSON.stringify({ language: 'zh', remote: true })
    const remoteSkill = '# Demo skill\n\nremote\n'
    const journal = '# remote journal'

    cloud.put(VAULT_JSON, Buffer.from(remoteVault), new Date(now))
    cloud.put(REGISTRY_JSON, Buffer.from(remoteRegistry), new Date(now))
    cloud.put(GLOBAL_SETTINGS, Buffer.from(remoteSettings), new Date(now))
    cloud.put(USER_SKILL, Buffer.from(remoteSkill), new Date(now))
    cloud.put(REMOTE_JOURNAL, Buffer.from(journal), new Date(now))
    // 模拟旧端：manifest 里只有普通日记，没有 global settings / vault.json / registry / skills
    cloud.put(
      '.baishou/manifest.json',
      Buffer.from(
        JSON.stringify({
          version: SYNC_MANIFEST_VERSION,
          updatedAt: now,
          deviceId: 'legacy',
          files: {
            [REMOTE_JOURNAL]: manifestEntry(journal, now)
          }
        })
      ),
      new Date(now)
    )

    const deviceB = new SimulatedSyncDevice({ deviceId: 'device-b', cloudStore: cloud })
    devices.push(deviceB)

    const localVault = JSON.stringify({
      id: 'vlt_bbbbbbbbbbbbbbbb',
      displayName: 'Personal',
      createdAt: new Date(now).toISOString()
    })
    await deviceB.writeFile(VAULT_JSON, localVault)
    await deviceB.writeFile(REGISTRY_JSON, JSON.stringify([{ name: 'Personal', path: '/local' }]))
    await deviceB.writeFile(GLOBAL_SETTINGS, JSON.stringify({ language: 'en', local: true }))
    await deviceB.writeFile(USER_SKILL, '# Demo skill\n\nlocal\n')

    const result = await deviceB.sync()

    expect(result.downloaded).toEqual(
      expect.arrayContaining([VAULT_JSON, REGISTRY_JSON, GLOBAL_SETTINGS, USER_SKILL])
    )
    expect(result.uploaded).not.toEqual(
      expect.arrayContaining([VAULT_JSON, REGISTRY_JSON, GLOBAL_SETTINGS, USER_SKILL])
    )
    expect(await deviceB.readFile(VAULT_JSON)).toBe(remoteVault)
    expect(await deviceB.readFile(REGISTRY_JSON)).toBe(remoteRegistry)
    expect(await deviceB.readFile(GLOBAL_SETTINGS)).toBe(remoteSettings)
    expect(await deviceB.readFile(USER_SKILL)).toBe(remoteSkill)
  })

  it('keeps legacy vault settings in remote manifest instead of deleting them', async () => {
    cloud = new SharedCloudStore()
    devices = []
    const now = Date.now()
    const legacy = JSON.stringify({ nickname: 'Old user' })
    const entry = manifestEntry(legacy, now)
    cloud.put(LEGACY_SETTINGS, Buffer.from(legacy), new Date(now))
    cloud.put(
      '.baishou/manifest.json',
      Buffer.from(
        JSON.stringify({
          version: SYNC_MANIFEST_VERSION,
          updatedAt: now,
          deviceId: 'legacy',
          files: { [LEGACY_SETTINGS]: entry }
        })
      ),
      new Date(now)
    )

    const device = new SimulatedSyncDevice({ deviceId: 'device-a', cloudStore: cloud })
    devices.push(device)
    await device.plantAncestorSnapshot({ [LEGACY_SETTINGS]: entry })

    const result = await device.sync()

    expect(result.deletedRemote).not.toContain(LEGACY_SETTINGS)
    expect(cloud.has(LEGACY_SETTINGS)).toBe(true)
    const remoteManifest = await device.getRemoteManifest()
    expect(remoteManifest.files[LEGACY_SETTINGS]).toMatchObject({ hash: entry.hash })
  })
})
