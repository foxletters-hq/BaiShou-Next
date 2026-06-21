import { expect } from 'vitest'
import type { SimulatedSyncDevice } from './simulated-sync-device'

const JOURNAL_PREFIX = 'Personal/Journals/2026/05'

export function journalPath(name: string): string {
  return `${JOURNAL_PREFIX}/${name}.md`
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 跟踪「期望的最终一致状态」 */
export class CanonicalSyncState {
  private readonly files = new Map<string, string>()

  set(path: string, content: string): void {
    this.files.set(path, content)
  }

  delete(path: string): void {
    this.files.delete(path)
  }

  entries(): Array<[string, string]> {
    return [...this.files.entries()].sort(([a], [b]) => a.localeCompare(b))
  }

  size(): number {
    return this.files.size
  }
}

export async function seedSharedFiles(
  device: SimulatedSyncDevice,
  count: number,
  contentPrefix: string
): Promise<CanonicalSyncState> {
  const canonical = new CanonicalSyncState()
  for (let i = 1; i <= count; i++) {
    const path = journalPath(`shared-${pad2(i)}`)
    const content = `${contentPrefix}-${pad2(i)}`
    await device.writeFile(path, content)
    canonical.set(path, content)
  }
  return canonical
}

/** 一轮「双向拉取」：两端各同步一次，模拟交替联网 */
export async function runPullExchange(
  deviceA: SimulatedSyncDevice,
  deviceB: SimulatedSyncDevice,
  first: 'a' | 'b' = 'a'
): Promise<void> {
  if (first === 'a') {
    await deviceA.sync()
    await deviceB.sync()
    return
  }
  await deviceB.sync()
  await deviceA.sync()
}

/** 连续多轮拉取交换（每轮两端各 sync 一次） */
export async function runPullRounds(
  deviceA: SimulatedSyncDevice,
  deviceB: SimulatedSyncDevice,
  rounds: number
): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    await runPullExchange(deviceA, deviceB, round % 2 === 0 ? 'a' : 'b')
  }
}

export async function assertDevicesMatchCanonical(
  devices: SimulatedSyncDevice[],
  canonical: CanonicalSyncState
): Promise<void> {
  const expected = canonical.entries()
  expect(expected.length).toBeGreaterThan(0)

  const fingerprints: string[] = []

  for (const device of devices) {
    for (const [path, content] of expected) {
      expect(device.fileExists(path), `device missing ${path}`).toBe(true)
      expect(await device.readFile(path), `content mismatch on ${path}`).toBe(content)
    }

    const snapshot = (
      await Promise.all(expected.map(async ([path]) => [path, await device.readFile(path)] as const))
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, content]) => `${path}:${content}`)
      .join('|')

    fingerprints.push(snapshot)
  }

  const [first, ...rest] = fingerprints
  for (const fp of rest) {
    expect(fp).toBe(first)
  }
}

export async function assertCloudMatchesCanonical(
  cloud: { has(path: string): boolean; get(path: string): { content: Buffer } | undefined },
  canonical: CanonicalSyncState
): Promise<void> {
  for (const [path, content] of canonical.entries()) {
    expect(cloud.has(path), `cloud missing ${path}`).toBe(true)
    expect(cloud.get(path)?.content.toString('utf8')).toBe(content)
  }
}
