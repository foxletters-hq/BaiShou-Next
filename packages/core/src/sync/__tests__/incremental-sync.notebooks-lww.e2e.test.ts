import { afterEach, describe, expect, it } from 'vitest'
import { SimulatedSyncDevice } from './helpers/simulated-sync-device'
import { SharedCloudStore } from './helpers/shared-cloud-store'

const NOTEBOOKS_JSONL = 'Personal/Notebooks/notebooks.jsonl'
const SOURCES_JSONL = 'Personal/Notebooks/nb-base/sources.jsonl'

type JsonlRecord = {
  id: string
  name?: string
  title?: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

function line(record: JsonlRecord): string {
  return `${JSON.stringify(record)}\n`
}

function readIds(content: string): string[] {
  return content
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => (JSON.parse(row) as JsonlRecord).id)
    .sort()
}

function findRecord<T extends JsonlRecord>(content: string, id: string): T | null {
  for (const row of content.split('\n')) {
    if (!row.trim()) continue
    const parsed = JSON.parse(row) as T
    if (parsed.id === id) return parsed
  }
  return null
}

describe('incremental sync notebooks structure LWW e2e', { timeout: 30_000 }, () => {
  let cloud: SharedCloudStore
  let devices: SimulatedSyncDevice[]

  afterEach(() => {
    for (const device of devices) device.destroy()
    devices = []
    cloud?.clear()
  })

  it('keeps notebook and source rows added concurrently on both devices', async () => {
    cloud = new SharedCloudStore()
    devices = []
    const now = Date.now()

    const deviceA = new SimulatedSyncDevice({ deviceId: 'device-a', cloudStore: cloud })
    const deviceB = new SimulatedSyncDevice({ deviceId: 'device-b', cloudStore: cloud })
    devices.push(deviceA, deviceB)

    await deviceA.writeFile(
      NOTEBOOKS_JSONL,
      line({ id: 'nb-base', name: 'Base', createdAt: now, updatedAt: now, deletedAt: null })
    )
    await deviceA.writeFile(
      SOURCES_JSONL,
      line({
        id: 'src-base',
        title: 'Base source',
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      })
    )
    await deviceA.sync()
    await deviceB.sync()

    await deviceA.writeFile(
      NOTEBOOKS_JSONL,
      `${await deviceA.readFile(NOTEBOOKS_JSONL)}${line({
        id: 'nb-a',
        name: 'From A',
        createdAt: now + 1,
        updatedAt: now + 1,
        deletedAt: null
      })}`
    )
    await deviceA.writeFile(
      SOURCES_JSONL,
      `${await deviceA.readFile(SOURCES_JSONL)}${line({
        id: 'src-a',
        title: 'Source A',
        createdAt: now + 1,
        updatedAt: now + 1,
        deletedAt: null
      })}`
    )

    await deviceB.writeFile(
      NOTEBOOKS_JSONL,
      `${await deviceB.readFile(NOTEBOOKS_JSONL)}${line({
        id: 'nb-b',
        name: 'From B',
        createdAt: now + 2,
        updatedAt: now + 2,
        deletedAt: null
      })}`
    )
    await deviceB.writeFile(
      SOURCES_JSONL,
      `${await deviceB.readFile(SOURCES_JSONL)}${line({
        id: 'src-b',
        title: 'Source B',
        createdAt: now + 2,
        updatedAt: now + 2,
        deletedAt: null
      })}`
    )

    await deviceA.sync()
    const resultB = await deviceB.sync()

    expect(resultB.conflicted).toEqual(expect.arrayContaining([NOTEBOOKS_JSONL, SOURCES_JSONL]))
    expect(resultB.uploaded).toEqual(expect.arrayContaining([NOTEBOOKS_JSONL, SOURCES_JSONL]))

    const notebooksB = await deviceB.readFile(NOTEBOOKS_JSONL)
    expect(readIds(notebooksB)).toEqual(['nb-a', 'nb-b', 'nb-base'])
    expect(readIds(await deviceB.readFile(SOURCES_JSONL))).toEqual(['src-a', 'src-b', 'src-base'])

    await deviceA.sync()
    expect(readIds(await deviceA.readFile(NOTEBOOKS_JSONL))).toEqual(['nb-a', 'nb-b', 'nb-base'])
    expect(readIds(await deviceA.readFile(SOURCES_JSONL))).toEqual(['src-a', 'src-b', 'src-base'])
  })

  it('keeps a tombstone while preserving the other side new notebook', async () => {
    cloud = new SharedCloudStore()
    devices = []
    const now = Date.now()

    const deviceA = new SimulatedSyncDevice({ deviceId: 'device-a', cloudStore: cloud })
    const deviceB = new SimulatedSyncDevice({ deviceId: 'device-b', cloudStore: cloud })
    devices.push(deviceA, deviceB)

    await deviceA.writeFile(
      NOTEBOOKS_JSONL,
      line({ id: 'nb-old', name: 'Old', createdAt: now, updatedAt: now, deletedAt: null })
    )
    await deviceA.sync()
    await deviceB.sync()

    await deviceA.writeFile(
      NOTEBOOKS_JSONL,
      `${await deviceA.readFile(NOTEBOOKS_JSONL)}${line({
        id: 'nb-old',
        name: 'Old',
        createdAt: now,
        updatedAt: now + 10,
        deletedAt: now + 10
      })}`
    )
    await deviceB.writeFile(
      NOTEBOOKS_JSONL,
      `${await deviceB.readFile(NOTEBOOKS_JSONL)}${line({
        id: 'nb-new',
        name: 'New',
        createdAt: now + 20,
        updatedAt: now + 20,
        deletedAt: null
      })}`
    )

    await deviceA.sync()
    await deviceB.sync()
    await deviceA.sync()

    const content = await deviceA.readFile(NOTEBOOKS_JSONL)
    expect(readIds(content)).toEqual(['nb-new', 'nb-old'])
    expect(findRecord(content, 'nb-old')?.deletedAt).toBe(now + 10)
    expect(findRecord(content, 'nb-new')?.deletedAt).toBeNull()
  })
})
