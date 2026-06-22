import { afterEach, describe, expect, it } from 'vitest'
import {
  evaluateIncrementalSyncPlanDrift,
  resolveIncrementalSyncConfirmReplan
} from '@baishou/shared'
import { SimulatedSyncDevice } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'

const JOURNAL_A = 'Personal/Journals/2026/05/entry-a.md'

function journalPath(name: string): string {
  return `Personal/Journals/2026/05/${name}.md`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

describe('incremental sync removed & confirm automation', () => {
  let cloud: SharedCloudStore
  let devices: SimulatedSyncDevice[]

  afterEach(() => {
    for (const device of devices) {
      device.destroy()
    }
    devices = []
    cloud?.clear()
  })

  function createDevice(
    deviceId: string,
    options?: { ghostDownloadClient?: boolean }
  ): SimulatedSyncDevice {
    const device = new SimulatedSyncDevice({
      deviceId,
      cloudStore: cloud,
      ghostDownloadClient: options?.ghostDownloadClient
    })
    devices.push(device)
    return device
  }

  it('无祖先设备依据远端 removed 记录删除本地文件', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const content = '# removed via record\n'
    const relPath = journalPath('removed-via-record')

    const deviceA = createDevice('device-a')
    await deviceA.writeFile(relPath, content)
    await deviceA.sync()

    await deviceA.deleteFile(relPath)
    await deviceA.sync()

    const remoteAfterDelete = await deviceA.getRemoteManifest()
    expect(remoteAfterDelete.removed?.[relPath]?.hash).toBeDefined()
    expect(remoteAfterDelete.files[relPath]).toBeUndefined()

    const deviceB = createDevice('device-b')
    await deviceB.writeFile(relPath, content)

    const preview = await deviceB.planSync()
    expect(preview.planReuseBaseline).toBeDefined()
    expect(
      preview.items.some((item) => item.action === 'delete-local' && item.filePath === relPath)
    ).toBe(true)

    const result = await deviceB.sync()
    expect(result.deletedLocal).toContain(relPath)
    expect(result.uploaded).not.toContain(relPath)
    expect(deviceB.fileExists(relPath)).toBe(false)
  })

  it('planSync 提供 deletePropagationChoice 时预览与 sync 删除列表一致', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    for (let i = 1; i <= 20; i++) {
      await deviceA.writeFile(journalPath(`mass-${pad2(i)}`), `body-${i}`)
    }
    await deviceA.sync()
    await deviceB.sync()

    for (let i = 1; i <= 20; i++) {
      await deviceB.deleteFile(journalPath(`mass-${pad2(i)}`))
    }

    const blockedPreview = await deviceB.planSync()
    expect(blockedPreview.deletePropagationBlocked).toBe(true)
    expect(blockedPreview.requiresDeletePropagationChoice).toBe(true)

    const resolvedPreview = await deviceB.planSync({ deletePropagationChoice: 'push-local' })
    expect(resolvedPreview.deletePropagationBlocked).toBe(false)
    const plannedDeletes = resolvedPreview.items
      .filter((item) => item.action === 'delete-remote')
      .map((item) => item.filePath)
      .sort()

    const syncResult = await deviceB.sync({ deletePropagationChoice: 'push-local' })
    expect(syncResult.deletedRemote.sort()).toEqual(plannedDeletes)
  })

  it('确认前远端 removed 漂移会触发 replan 判定', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')
    const relPath = journalPath('drift-removed')

    await deviceA.writeFile(relPath, 'v1')
    await deviceA.writeFile(journalPath('anchor'), 'stay')
    await deviceA.sync()
    await deviceB.sync()

    const stalePreview = await deviceB.planSync()
    expect(stalePreview.planReuseBaseline).toBeDefined()

    await deviceA.deleteFile(relPath)
    await deviceA.sync()

    const localManifest = await deviceB.buildLocalManifest()
    const remoteManifest = await deviceB.getRemoteManifest()
    const drift = evaluateIncrementalSyncPlanDrift(
      stalePreview.planReuseBaseline!,
      localManifest,
      remoteManifest
    )
    expect(drift.remoteManifestDrifted).toBe(true)

    const replan = resolveIncrementalSyncConfirmReplan({
      stalePreview,
      planPreparedAtMs: stalePreview.planReuseBaseline!.preparedAtMs,
      planReuseBaseline: stalePreview.planReuseBaseline,
      vaultRegistryChanged: false,
      highDivergenceConfirmed: false,
      deletePropagationChoiceProvided: false,
      localManifest,
      remoteManifest
    })
    expect(replan.remoteManifestDrifted).toBe(true)
    expect(replan.needsReplan).toBe(true)
  })

  it('下载 404 时不计入 downloaded', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const deviceA = createDevice('device-a')
    await deviceA.writeFile(JOURNAL_A, '# content\n')
    await deviceA.sync()

    const deviceB = createDevice('device-b', { ghostDownloadClient: true })
    deviceB.markGhostDownload(JOURNAL_A)
    const result = await deviceB.sync()

    expect(result.downloaded).not.toContain(JOURNAL_A)
    expect(deviceB.fileExists(JOURNAL_A)).toBe(false)
  })

  it('双端同步后 removed 记录随删除写入远端 manifest', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const relPath = journalPath('persist-removed')
    const deviceA = createDevice('device-a')
    const deviceB = createDevice('device-b')

    await deviceA.writeFile(relPath, 'to-delete')
    await deviceA.sync()
    await deviceB.sync()

    await deviceA.deleteFile(relPath)
    await deviceA.sync({ deletePropagationChoice: 'push-local' })

    const remote = await deviceB.getRemoteManifest()
    expect(remote.removed?.[relPath]).toBeDefined()
    expect(remote.files[relPath]).toBeUndefined()
    expect(cloud.has(relPath)).toBe(false)
  })
})
