import {
  runCreateDemoVaultWorkflow,
  type CreateDemoVaultResult,
  type CreateDemoVaultWorkflowDeps,
  type DemoDiaryWriter,
  type DemoSummaryWriter
} from '@baishou/shared'

export type { CreateDemoVaultResult, DemoDiaryEntry } from '@baishou/shared'
export {
  DEMO_DIARIES as INITIAL_DIARIES,
  DEMO_SUMMARIES as INITIAL_SUMMARIES
} from '@baishou/shared'

export async function createDemoVaultWithData(
  deps: CreateDemoVaultWorkflowDeps
): Promise<CreateDemoVaultResult> {
  return runCreateDemoVaultWorkflow(deps)
}

export type { DemoDiaryWriter, DemoSummaryWriter, CreateDemoVaultWorkflowDeps }
