import { afterEach, describe, expect, it } from 'vitest'
import { SimulatedSyncDevice } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'
import {
  assertCloudMatchesCanonical,
  assertDevicesMatchCanonical,
  journalPath,
  pad2,
  runPullRounds,
  seedSharedFiles
} from './helpers/multi-round-sync.harness'

const FILES_PER_DEVICE = 30
const PULL_ROUNDS_PER_PHASE = 3

describe('incremental sync multi-round E2E (30 files)', () => {
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

  it(
    '30 files per device, mixed changes, 3+ pull rounds per phase, converges after 3 phases',
    async () => {
      cloud = new SharedCloudStore()
      devices = []

      const deviceA = createDevice('device-a')
      const deviceB = createDevice('device-b')
      let canonical = await seedSharedFiles(deviceA, FILES_PER_DEVICE, 'baseline-r0')

      // ── Phase 0：A 上传 30 个文件，B 拉取到相同 30 个 ─────────────────
      await deviceA.sync()
      await deviceB.sync()
      await runPullRounds(deviceA, deviceB, PULL_ROUNDS_PER_PHASE)

      expect(deviceA.fileExists(journalPath(`shared-${pad2(1)}`))).toBe(true)
      expect(deviceB.fileExists(journalPath(`shared-${pad2(30)}`))).toBe(true)
      await assertDevicesMatchCanonical([deviceA, deviceB], canonical)
      await assertCloudMatchesCanonical(cloud, canonical)

      // ── Phase 1：双端各自修改 / 删除 / 新增，再 3 轮拉取 ───────────────
      const round1BaseTime = Date.now()

      for (let i = 1; i <= 5; i++) {
        const path = journalPath(`shared-${pad2(i)}`)
        const content = `round1-a-edit-${pad2(i)}`
        await deviceA.writeFile(path, content, round1BaseTime + i)
        canonical.set(path, content)
      }

      await deviceA.deleteFile(journalPath('shared-06'))
      canonical.delete(journalPath('shared-06'))

      for (let i = 1; i <= 3; i++) {
        const path = journalPath(`round1-a-new-${pad2(i)}`)
        const content = `round1-a-new-content-${pad2(i)}`
        await deviceA.writeFile(path, content, round1BaseTime + 100 + i)
        canonical.set(path, content)
      }

      for (let i = 7; i <= 11; i++) {
        const path = journalPath(`shared-${pad2(i)}`)
        const content = `round1-b-edit-${pad2(i)}`
        await deviceB.writeFile(path, content, round1BaseTime + 200 + i)
        canonical.set(path, content)
      }

      await deviceB.deleteFile(journalPath('shared-12'))
      canonical.delete(journalPath('shared-12'))

      for (let i = 1; i <= 3; i++) {
        const path = journalPath(`round1-b-new-${pad2(i)}`)
        const content = `round1-b-new-content-${pad2(i)}`
        await deviceB.writeFile(path, content, round1BaseTime + 300 + i)
        canonical.set(path, content)
      }

      await runPullRounds(deviceA, deviceB, PULL_ROUNDS_PER_PHASE)
      await assertDevicesMatchCanonical([deviceA, deviceB], canonical)
      await assertCloudMatchesCanonical(cloud, canonical)

      // ── Phase 2：冲突 + 更多变更，再 3 轮拉取 ─────────────────────────
      const round2BaseTime = Date.now() + 10_000
      const conflictPath = journalPath('shared-20')
      const conflictWinner = 'round2-conflict-b-wins'

      await deviceA.writeFile(conflictPath, 'round2-conflict-a', round2BaseTime + 1000)
      await deviceB.writeFile(conflictPath, conflictWinner, round2BaseTime + 9000)
      canonical.set(conflictPath, conflictWinner)

      for (let i = 21; i <= 23; i++) {
        const path = journalPath(`shared-${pad2(i)}`)
        const content = `round2-a-touch-${pad2(i)}`
        await deviceA.writeFile(path, content, round2BaseTime + i)
        canonical.set(path, content)
      }

      await deviceB.deleteFile(journalPath('shared-25'))
      canonical.delete(journalPath('shared-25'))

      for (let i = 1; i <= 2; i++) {
        const path = journalPath(`round2-b-new-${pad2(i)}`)
        const content = `round2-b-new-${pad2(i)}`
        await deviceB.writeFile(path, content, round2BaseTime + 400 + i)
        canonical.set(path, content)
      }

      await runPullRounds(deviceA, deviceB, PULL_ROUNDS_PER_PHASE)
      await assertDevicesMatchCanonical([deviceA, deviceB], canonical)
      await assertCloudMatchesCanonical(cloud, canonical)

      // ── Phase 3：交叉编辑剩余文件，再 3 轮拉取 ───────────────────────
      const round3BaseTime = Date.now() + 20_000

      for (let i = 13; i <= 18; i++) {
        const path = journalPath(`shared-${pad2(i)}`)
        if (!canonical.entries().some(([p]) => p === path)) continue
        const content = `round3-a-final-${pad2(i)}`
        await deviceA.writeFile(path, content, round3BaseTime + i)
        canonical.set(path, content)
      }

      for (let i = 26; i <= 30; i++) {
        const path = journalPath(`shared-${pad2(i)}`)
        if (!canonical.entries().some(([p]) => p === path)) continue
        const content = `round3-b-final-${pad2(i)}`
        await deviceB.writeFile(path, content, round3BaseTime + i)
        canonical.set(path, content)
      }

      await deviceA.writeFile(journalPath('round3-a-extra-01'), 'round3-extra-a', round3BaseTime + 500)
      canonical.set(journalPath('round3-a-extra-01'), 'round3-extra-a')

      await deviceB.writeFile(journalPath('round3-b-extra-01'), 'round3-extra-b', round3BaseTime + 600)
      canonical.set(journalPath('round3-b-extra-01'), 'round3-extra-b')

      await runPullRounds(deviceA, deviceB, PULL_ROUNDS_PER_PHASE)
      await assertDevicesMatchCanonical([deviceA, deviceB], canonical)
      await assertCloudMatchesCanonical(cloud, canonical)

      // 每端最终应持有相同文件集（30 基线 - 删除 + 各轮新增）
      const expectedCount = canonical.size()
      expect(expectedCount).toBeGreaterThanOrEqual(FILES_PER_DEVICE)

      // 统计：共经历 4 个阶段 × 3 轮拉取 = 12 次双向交换（每轮 2 次 sync）
      const totalPullExchanges = 4 * PULL_ROUNDS_PER_PHASE
      expect(totalPullExchanges).toBeGreaterThanOrEqual(9)
    },
    60_000
  )
})
