import { afterEach, describe, expect, it } from 'vitest'
import { reconcileAncestorWithRemoteTruth, threeWayMerge } from '@baishou/shared'
import { SimulatedSyncDevice } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'

function sessionPath(id: string): string {
  return `Personal/Sessions/${id}.json`
}

function sessionJson(id: string, rounds: number): string {
  const messages = Array.from({ length: rounds }, (_, i) => ({
    id: `${id}-m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `round-${i}-on-${id}`
  }))
  return JSON.stringify({ session: { id, title: id }, messages })
}

/**
 * 复现用户场景：桌面 a/b/c，移动 d/e；以及假祖先导致「完成且已一致但会话不全」。
 */
describe('incremental sync session files a/b/c ↔ d/e', () => {
  let cloud: SharedCloudStore
  let devices: SimulatedSyncDevice[]

  afterEach(() => {
    for (const device of devices) {
      device.destroy()
    }
    devices = []
    cloud?.clear()
  })

  function createDevice(deviceId: string) {
    const device = new SimulatedSyncDevice({ deviceId, cloudStore: cloud })
    devices.push(device)
    return device
  }

  it('桌面 a/b/c 与移动 d/e 双向同步后两端会话齐全', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const desktop = createDevice('desktop')
    const mobile = createDevice('mobile')

    await desktop.writeFile(sessionPath('a'), sessionJson('a', 20))
    await desktop.writeFile(sessionPath('b'), sessionJson('b', 30))
    await desktop.writeFile(sessionPath('c'), sessionJson('c', 40))
    await desktop.sync()

    expect(cloud.has(sessionPath('a'))).toBe(true)
    expect(cloud.has(sessionPath('b'))).toBe(true)
    expect(cloud.has(sessionPath('c'))).toBe(true)

    await mobile.writeFile(sessionPath('d'), sessionJson('d', 15))
    await mobile.writeFile(sessionPath('e'), sessionJson('e', 25))
    const mobileResult = await mobile.sync()

    expect(mobileResult.downloaded).toEqual(
      expect.arrayContaining([sessionPath('a'), sessionPath('b'), sessionPath('c')])
    )
    expect(mobileResult.uploaded).toEqual(
      expect.arrayContaining([sessionPath('d'), sessionPath('e')])
    )
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect(mobile.fileExists(sessionPath(id))).toBe(true)
    }

    const desktopResult = await desktop.sync()
    expect(desktopResult.downloaded).toEqual(
      expect.arrayContaining([sessionPath('d'), sessionPath('e')])
    )
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect(desktop.fileExists(sessionPath(id))).toBe(true)
      expect(await desktop.readFile(sessionPath(id))).toBe(await mobile.readFile(sessionPath(id)))
    }

    const again = await mobile.planSync()
    expect(again.changeCount).toBe(0)
  })

  it('假祖先含未上云的 e 时，剥离后应上传 e 而不是删本地', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const mobile = createDevice('mobile')
    await mobile.writeFile(sessionPath('a'), sessionJson('a', 8))
    await mobile.writeFile(sessionPath('e'), sessionJson('e', 50))

    // 只让 a 进入云端（模拟半截同步：e 从未真正 upload）
    const onlyA = createDevice('seed-a-only')
    await onlyA.writeFile(sessionPath('a'), await mobile.readFile(sessionPath('a')))
    await onlyA.sync()
    expect(cloud.has(sessionPath('a'))).toBe(true)
    expect(cloud.has(sessionPath('e'))).toBe(false)

    // 污染祖先：账本里假装 e 也已同步过
    const local = await mobile.buildLocalManifest()
    const entryA = local.files[sessionPath('a')]!
    const entryE = local.files[sessionPath('e')]!
    await mobile.plantAncestorSnapshot({
      [sessionPath('a')]: entryA,
      [sessionPath('e')]: entryE
    })

    // 对照：不剥离时三向合并会对 e 判 delete-local
    const remote = await mobile.getRemoteManifest()
    const pollutedAncestor = {
      version: 1 as const,
      updatedAt: Date.now(),
      deviceId: 'polluted',
      files: {
        [sessionPath('a')]: entryA,
        [sessionPath('e')]: entryE
      }
    }
    const beforeHeal = threeWayMerge(local, remote, pollutedAncestor)
    expect(
      beforeHeal.some((d) => d.filePath === sessionPath('e') && d.type === 'delete-local')
    ).toBe(true)

    const healedAncestor = reconcileAncestorWithRemoteTruth(pollutedAncestor, remote)
    const afterHeal = threeWayMerge(local, remote, healedAncestor)
    expect(afterHeal.some((d) => d.filePath === sessionPath('e') && d.type === 'upload')).toBe(true)

    // 真实 sync 路径（prepareSyncManifests 内会剥离）应上传 e，且本地保留
    const result = await mobile.sync()
    expect(result.uploaded).toContain(sessionPath('e'))
    expect(result.deletedLocal).not.toContain(sessionPath('e'))
    expect(mobile.fileExists(sessionPath('e'))).toBe(true)
    expect(cloud.has(sessionPath('e'))).toBe(true)

    const peer = createDevice('desktop-peer')
    await peer.sync()
    expect(peer.fileExists(sessionPath('e'))).toBe(true)
    expect(await peer.readFile(sessionPath('e'))).toBe(await mobile.readFile(sessionPath('e')))
  })

  it('假祖先愈合后再次规划应显示本地与云端已一致', async () => {
    cloud = new SharedCloudStore()
    devices = []

    const mobile = createDevice('mobile')
    await mobile.writeFile(sessionPath('a'), sessionJson('a', 5))
    await mobile.writeFile(sessionPath('e'), sessionJson('e', 12))

    const seed = createDevice('seed')
    await seed.writeFile(sessionPath('a'), await mobile.readFile(sessionPath('a')))
    await seed.sync()

    const local = await mobile.buildLocalManifest()
    await mobile.plantAncestorSnapshot({
      [sessionPath('a')]: local.files[sessionPath('a')]!,
      [sessionPath('e')]: local.files[sessionPath('e')]!
    })

    await mobile.sync()
    const preview = await mobile.planSync()
    expect(preview.changeCount).toBe(0)
    expect(cloud.has(sessionPath('e'))).toBe(true)
  })
})
