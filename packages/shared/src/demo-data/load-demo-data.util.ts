import { SummaryType } from '../types/summary.types'
import type { DemoDiaryEntry, DemoSummaryEntry } from './demo-data.types'
import { DEMO_DIARIES } from './demo-diaries.generated'
import { DEMO_SUMMARIES } from './demo-summaries.generated'

export type { DemoDiaryEntry, DemoSummaryEntry, DemoDataBundle } from './demo-data.types'
export { DEMO_DIARIES, DEMO_SUMMARIES }

export interface DemoDiaryWriter {
  findByDate(
    date: Date
  ): Promise<{ id: number; content: string; tags?: string | string[]; mood?: string | null } | null>
  create(input: {
    date: Date
    content: string
    tags?: string
    mood?: string
    weather?: string
    location?: string
  }): Promise<unknown>
  update(
    id: number,
    input: {
      content?: string
      tags?: string
      mood?: string
      weather?: string
      location?: string
    }
  ): Promise<unknown>
}

export interface DemoSummaryWriter {
  save(input: {
    type: SummaryType
    startDate: Date
    endDate: Date
    content: string
  }): Promise<unknown>
}

export function resolveDemoDiaryDate(demo: DemoDiaryEntry, referenceDate: Date = new Date()): Date {
  if (demo.dateFixed) {
    return new Date(demo.dateFixed)
  }
  const entryDate = new Date(referenceDate.getTime())
  if (demo.dateDaysOffset != null) {
    entryDate.setDate(entryDate.getDate() + demo.dateDaysOffset)
  }
  if (demo.dateMinutesOffset != null) {
    entryDate.setMinutes(entryDate.getMinutes() + demo.dateMinutesOffset)
  }
  return entryDate
}

export function resolveDemoSummaryDates(demo: DemoSummaryEntry): {
  startDate: Date
  endDate: Date
} {
  const startDate = parseDemoDate(demo.startDateFixed)
  const endDate = parseDemoDate(demo.endDateFixed)
  endDate.setHours(23, 59, 59, 999)
  return { startDate, endDate }
}

function parseDemoDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y!, m! - 1, d!)
  }
  return new Date(value)
}

/** 注入演示日记，返回成功写入/更新的条数 */
export async function loadDemoDiaries(
  diaryWriter: DemoDiaryWriter,
  entries: DemoDiaryEntry[] = DEMO_DIARIES,
  referenceDate: Date = new Date()
): Promise<number> {
  let count = 0
  for (const demo of entries) {
    const entryDate = resolveDemoDiaryDate(demo, referenceDate)
    const existing = await diaryWriter.findByDate(entryDate)

    if (existing) {
      await diaryWriter.update(existing.id, {
        content: `${existing.content}\n\n---\n\n${demo.content}`,
        tags: mergeDemoTags(existing.tags, demo.tags),
        mood: demo.mood || existing.mood || undefined,
        weather: demo.weather,
        location: demo.location
      })
    } else {
      await diaryWriter.create({
        date: entryDate,
        content: demo.content,
        tags: (demo.tags || []).join(','),
        mood: demo.mood,
        weather: demo.weather,
        location: demo.location
      })
    }
    count++
  }
  return count
}

/** 注入演示总结，返回成功写入条数 */
export async function loadDemoSummaries(
  summaryWriter: DemoSummaryWriter,
  entries: DemoSummaryEntry[] = DEMO_SUMMARIES
): Promise<number> {
  let count = 0
  for (const demo of entries) {
    const { startDate, endDate } = resolveDemoSummaryDates(demo)
    await summaryWriter.save({
      type: demo.type as SummaryType,
      startDate,
      endDate,
      content: demo.content
    })
    count++
  }
  return count
}

function mergeDemoTags(
  existing: string | string[] | undefined,
  added: string[] | undefined
): string {
  const base = Array.isArray(existing)
    ? existing
    : (existing || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
  return Array.from(new Set([...base, ...(added || [])])).join(',')
}

/** 演示工作空间默认名称（重名时自动追加 _2、_3…） */
export const DEMO_VAULT_NAME_BASE = '演示空间'

export interface CreateDemoVaultResult {
  vaultName: string
  diaryCount: number
  summaryCount: number
}

export function buildDemoVaultName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames)
  if (!taken.has(DEMO_VAULT_NAME_BASE)) {
    return DEMO_VAULT_NAME_BASE
  }
  let index = 2
  while (taken.has(`${DEMO_VAULT_NAME_BASE}_${index}`)) {
    index++
  }
  return `${DEMO_VAULT_NAME_BASE}_${index}`
}

export interface CreateDemoVaultWorkflowDeps {
  listVaultNames: () => readonly string[]
  createVault: (name: string) => Promise<void>
  activateVault: (name: string) => Promise<void>
  resolveWriters: () => Promise<{ diaryWriter: DemoDiaryWriter; summaryWriter: DemoSummaryWriter }>
}

/** 创建新工作空间、切换至该空间并写入演示日记与总结 */
export async function runCreateDemoVaultWorkflow(
  deps: CreateDemoVaultWorkflowDeps
): Promise<CreateDemoVaultResult> {
  const vaultName = buildDemoVaultName(deps.listVaultNames())
  await deps.createVault(vaultName)
  await deps.activateVault(vaultName)
  const { diaryWriter, summaryWriter } = await deps.resolveWriters()
  const diaryCount = await loadDemoDiaries(diaryWriter)
  const summaryCount = await loadDemoSummaries(summaryWriter)
  return { vaultName, diaryCount, summaryCount }
}
