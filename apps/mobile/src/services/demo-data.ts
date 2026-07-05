import {
  runCreateDemoVaultWorkflow,
  type CreateDemoVaultResult,
  type CreateDemoVaultWorkflowDeps
} from '@baishou/shared'

export type { CreateDemoVaultResult } from '@baishou/shared'

export async function createDemoVault(
  deps: CreateDemoVaultWorkflowDeps
): Promise<CreateDemoVaultResult> {
  return runCreateDemoVaultWorkflow(deps)
}
