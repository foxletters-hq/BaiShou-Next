import * as crypto from 'crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { SyncDivergenceConfirmationRequiredError, SYNC_MANIFEST_VERSION } from '@baishou/shared'
import { SimulatedSyncDevice, type SimulatedSyncDeviceOptions } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'

function md5(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

const JOURNAL_A = 'Personal/Journals/2026/05/entry-a.md'
const JOURNAL_B = 'Personal/Journals/2026/05/entry-b.md'
const JOURNAL_SHARED = 'Personal/Journals/2026/05/shared.md'
const BG_IMAGE = 'Personal/Attachments/backgrounds/bg_test.jpg'

function journalPath(name: string): string {
  return `Personal/Journals/2026/05/${name}.md`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

describe('incremental sync E2E simulation', () => {
  let cloud: SharedCloudStore
  let devices: SimulatedSyncDevice[]

  afterEach(() => {
    for (const device of devices) {
      device.destroy()
    }
    devices = []
    cloud?.clear()
  })

  function createDevice(deviceId: string, config?: SimulatedSyncDeviceOptions['config']) {
    const device = new SimulatedSyncDevice({ deviceId, cloudStore: cloud, config })
    devices.push(device)
    return device
  }

  it('device A first sync uploads local journals to shared cloud', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    await deviceA.writeFile(JOURNAL_A, '# Entry A\n')
    await deviceA.writeFile(JOURNAL_B, '# Entry B\n')

    const result = await deviceA.sync()

    expect(result.uploaded).toEqual(expect.arrayContaining([JOURNAL_A, JOURNAL_B]))
    expect(result.downloaded).toHaveLength(0)
    expect(cloud.has(JOURNAL_A)).toBe(true)
    expect(cloud.has(JOURNAL_B)).toBe(true)
    expect(cloud.has('.baishou/manifest.json')).toBe(true)
  })

  it('device B bootstraps from cloud after device A initial upload', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    await deviceA.writeFile(JOURNAL_A, '# Entry A\n')
    await deviceA.sync()

    const deviceB = createDevice('device-b')
    const result = await deviceB.sync()

    expect(result.downloaded).toContain(JOURNAL_A)
    expect(await deviceB.readFile(JOURNAL_A)).toBe('# Entry A\n')
    expect(deviceB.fileExists(JOURNAL_A)).toBe(true)
  })

  it('two-device round trip: A uploads, B downloads, B edits, A receives edit', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    await deviceA.writeFile(JOURNAL_SHARED, 'version-1')
    await deviceA.sync()

    await deviceB.sync()
    expect(await deviceB.readFile(JOURNAL_SHARED)).toBe('version-1')

    await deviceB.writeFile(JOURNAL_SHARED, 'version-2-from-B', Date.now() + 5000)
    await deviceB.sync()

    const resultA = await deviceA.sync()
    expect(resultA.downloaded).toContain(JOURNAL_SHARED)
    expect(await deviceA.readFile(JOURNAL_SHARED)).toBe('version-2-from-B')
  })

  it('local delete propagates to remote and peer device', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    await deviceA.writeFile(JOURNAL_A, 'keep-me')
    await deviceA.writeFile(JOURNAL_B, 'delete-me')
    await deviceA.sync()
    await deviceB.sync()

    await deviceA.deleteFile(JOURNAL_B)
    const deleteResult = await deviceA.sync()
    expect(deleteResult.deletedRemote).toContain(JOURNAL_B)
    expect(cloud.has(JOURNAL_B)).toBe(false)

    const peerResult = await deviceB.sync()
    expect(peerResult.deletedLocal).toContain(JOURNAL_B)
    expect(deviceB.fileExists(JOURNAL_B)).toBe(false)
    expect(deviceB.fileExists(JOURNAL_A)).toBe(true)
  })

  it('resolves edit conflict by newer mtime when both devices diverge', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')
    const baseTime = Date.now()

    await deviceA.writeFile(JOURNAL_SHARED, 'base', baseTime)
    await deviceA.sync()
    await deviceB.sync()

    await deviceA.writeFile(JOURNAL_SHARED, 'from-A', baseTime + 1000)
    await deviceB.writeFile(JOURNAL_SHARED, 'from-B-wins', baseTime + 9000)

    await deviceA.sync()
    const resultB = await deviceB.sync()

    expect(resultB.conflicted).toContain(JOURNAL_SHARED)
    expect(resultB.uploaded).toContain(JOURNAL_SHARED)
    expect(await deviceB.readFile(JOURNAL_SHARED)).toBe('from-B-wins')

    const resultA = await deviceA.sync()
    expect(resultA.downloaded).toContain(JOURNAL_SHARED)
    expect(await deviceA.readFile(JOURNAL_SHARED)).toBe('from-B-wins')
  })

  it('excludes chat background images from sync', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    await deviceA.writeFile(JOURNAL_A, '# diary')
    await deviceA.writeFile(BG_IMAGE, 'fake-image-bytes')

    const result = await deviceA.sync()

    expect(result.uploaded).toContain(JOURNAL_A)
    expect(result.uploaded).not.toContain(BG_IMAGE)
    expect(cloud.has(BG_IMAGE)).toBe(false)
    expect(cloud.has(JOURNAL_A)).toBe(true)
  })

  it('cleans up remote background files instead of downloading them', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    // 模拟旧版本误上传到云端的背景图（含合法 manifest）
    const remoteJournalContent = '# ok'
    const remoteBgContent = 'stale-bg'
    const now = Date.now()
    cloud.put(JOURNAL_A, Buffer.from(remoteJournalContent), new Date(now))
    cloud.put(BG_IMAGE, Buffer.from(remoteBgContent), new Date(now))
    cloud.put(
      '.baishou/manifest.json',
      Buffer.from(
        JSON.stringify({
          version: SYNC_MANIFEST_VERSION,
          updatedAt: now,
          deviceId: 'legacy',
          files: {
            [JOURNAL_A]: {
              hash: md5(remoteJournalContent),
              size: remoteJournalContent.length,
              lastModified: now
            },
            [BG_IMAGE]: {
              hash: md5(remoteBgContent),
              size: remoteBgContent.length,
              lastModified: now
            }
          }
        })
      ),
      new Date(now)
    )

    await deviceB.writeFile(JOURNAL_A, '# local only')
    const result = await deviceB.sync()

    expect(result.deletedRemote).toContain(BG_IMAGE)
    expect(cloud.has(BG_IMAGE)).toBe(false)
    expect(deviceB.fileExists(BG_IMAGE)).toBe(false)
  })

  it('planSync preview matches actual sync operations', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    await deviceA.writeFile(JOURNAL_A, 'a')
    await deviceA.sync()

    await deviceB.writeFile(JOURNAL_B, 'b-new-local')
    const preview = await deviceB.planSync()
    const result = await deviceB.sync()

    expect(preview.changeCount).toBeGreaterThan(0)
    expect(preview.items.some((s) => s.action === 'upload')).toBe(true)
    expect(preview.items.some((s) => s.action === 'download')).toBe(true)
    expect(result.uploaded).toContain(JOURNAL_B)
    expect(result.downloaded).toContain(JOURNAL_A)
  })

  it('propagates local mass-delete to remote when user intentionally removed files', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    for (let i = 1; i <= 10; i++) {
      await deviceA.writeFile(journalPath(`seed-${i}`), `content-${i}`)
    }
    await deviceA.sync()
    await deviceB.sync()

    await deviceB.deleteFile(journalPath('seed-1'))
    await deviceB.deleteFile(journalPath('seed-2'))
    await deviceB.deleteFile(journalPath('seed-3'))
    await deviceB.writeFile(journalPath('new-after-delete'), 'fresh')

    const result = await deviceB.sync()
    expect(result.deletedRemote).toEqual(
      expect.arrayContaining([
        journalPath('seed-1'),
        journalPath('seed-2'),
        journalPath('seed-3')
      ])
    )
    expect(result.uploaded).toContain(journalPath('new-after-delete'))
    expect(cloud.has(journalPath('seed-1'))).toBe(false)
    expect(cloud.has(journalPath('new-after-delete'))).toBe(true)
  })

  it('desktop mass-delete propagates delete-local on mobile after peer sync', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const desktop = createDevice('desktop')
    const mobile = createDevice('mobile')
    const baseTime = Date.now()

    for (let i = 1; i <= 30; i++) {
      await desktop.writeFile(
        journalPath(`photo-${pad2(i)}`),
        `image-${pad2(i)}`,
        baseTime + i
      )
    }
    await desktop.sync()
    await mobile.sync()

    for (let i = 1; i <= 25; i++) {
      await desktop.deleteFile(journalPath(`photo-${pad2(i)}`))
    }
    const desktopResult = await desktop.sync()
    expect(desktopResult.deletedRemote.length).toBe(25)

    const mobileResult = await mobile.sync()
    expect(mobileResult.deletedLocal.length).toBe(25)
    expect(mobileResult.uploaded).toHaveLength(0)

    for (let i = 1; i <= 25; i++) {
      expect(mobile.fileExists(journalPath(`photo-${pad2(i)}`))).toBe(false)
      expect(cloud.has(journalPath(`photo-${pad2(i)}`))).toBe(false)
    }
    for (let i = 26; i <= 30; i++) {
      expect(mobile.fileExists(journalPath(`photo-${pad2(i)}`))).toBe(true)
      expect(await mobile.readFile(journalPath(`photo-${pad2(i)}`))).toBe(`image-${pad2(i)}`)
    }
  })

  it('requires high-divergence confirmation on first connect to mismatched remote', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a', { maxDivergencePercent: 30 })
    const deviceB = createDevice('device-b', { maxDivergencePercent: 30 })

    for (let i = 1; i <= 10; i++) {
      await deviceA.writeFile(journalPath(`remote-${i}`), `remote-${i}`)
    }
    await deviceA.sync()

    for (let i = 1; i <= 10; i++) {
      await deviceB.writeFile(journalPath(`local-${i}`), `local-${i}`)
    }

    await expect(deviceB.sync()).rejects.toBeInstanceOf(SyncDivergenceConfirmationRequiredError)

    const preview = await deviceB.planSync()
    expect(preview.requiresHighDivergenceConfirm).toBe(true)

    const confirmed = await deviceB.sync({ highDivergenceConfirmed: true })
    expect(confirmed.uploaded.length).toBeGreaterThan(0)
    expect(confirmed.downloaded.length).toBeGreaterThan(0)
  })

  it('three-device convergence: all end with identical journal set', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')
    const deviceC = createDevice('device-c')

    await deviceA.writeFile(journalPath('from-a'), 'A')
    await deviceA.sync()

    await deviceB.writeFile(journalPath('from-b'), 'B')
    await deviceB.sync()

    await deviceC.sync()
    await deviceA.sync()
    await deviceB.sync()
    await deviceC.sync()

    for (const device of [deviceA, deviceB, deviceC]) {
      expect(device.fileExists(journalPath('from-a'))).toBe(true)
      expect(device.fileExists(journalPath('from-b'))).toBe(true)
      expect(await device.readFile(journalPath('from-a'))).toBe('A')
      expect(await device.readFile(journalPath('from-b'))).toBe('B')
    }
  })
})
