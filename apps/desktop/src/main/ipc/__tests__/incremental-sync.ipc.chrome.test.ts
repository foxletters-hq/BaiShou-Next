import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const shellSrc = readFileSync(join(dir, '../incremental-sync.ipc.ts'), 'utf8')
const factorySrc = readFileSync(join(dir, '../incremental-sync-service.factory.ts'), 'utf8')
const planSrc = readFileSync(join(dir, '../incremental-sync-plan.ipc.ts'), 'utf8')

describe('incremental sync ipc split', () => {
  it('should keep the public register and reset exports on the shell when split', () => {
    expect(shellSrc).toContain('export function registerIncrementalSyncIPC')
    expect(shellSrc).toContain('export { resetSyncService }')
    expect(shellSrc).toContain('registerIncrementalSyncPlanIPC()')
  })

  it('should initialize the sync service in the factory when config is loaded', () => {
    expect(factorySrc).toContain('export async function createSyncService')
    expect(factorySrc).toContain('export function getDefaultSyncConfig')
    expect(factorySrc).toContain('export function resetSyncService')
    expect(planSrc).not.toContain('new ThreeWaySyncService')
  })

  it('should keep plan and post-sync evolution in the plan module when split', () => {
    expect(planSrc).toContain("'incrementalSync:planSync'")
    expect(planSrc).toContain("'incrementalSync:evaluatePlanDrift'")
    expect(planSrc).toContain('export async function afterIncrementalSync')
    expect(shellSrc).not.toContain("'incrementalSync:planSync'")
  })
})
