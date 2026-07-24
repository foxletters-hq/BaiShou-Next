import type { WorkspaceFsAdapter } from './workspace-fs'
import { assertWorkspaceFileFreshness, WorkspaceGateStaleError } from './workspace-gate-preview'

export interface WorkspaceGateFreshnessEntry {
  sessionId: string
  absolutePath: string
  expectedExisted: boolean
  expectedHash: string | null
  /** rename 目标路径：确认期间不得出现 */
  destinationAbsolutePath?: string
}

let tokenSeq = 0
const registry = new Map<string, WorkspaceGateFreshnessEntry>()

function nextToken(): string {
  tokenSeq += 1
  return `wgf_${tokenSeq}_${Date.now().toString(36)}`
}

/** prepare 阶段登记；返回 token，供拦截器绑定本次工具调用 */
export function rememberWorkspaceGateFreshness(entry: WorkspaceGateFreshnessEntry): string {
  const token = nextToken()
  registry.set(token, entry)
  return token
}

export function forgetWorkspaceGateFreshnessToken(token: string | undefined): void {
  if (!token) return
  registry.delete(token)
}

/** execute 前按 token 核对并清除 */
export async function assertRegisteredWorkspaceGateFreshness(input: {
  token: string | undefined
  fs: WorkspaceFsAdapter
  requireRegistration?: boolean
}): Promise<void> {
  const token = input.token
  if (!token) {
    if (input.requireRegistration) {
      throw new WorkspaceGateStaleError('缺少预执行新鲜度登记，已拒绝执行')
    }
    return
  }

  const entry = registry.get(token)
  registry.delete(token)

  if (!entry) {
    if (input.requireRegistration) {
      throw new WorkspaceGateStaleError('缺少预执行新鲜度登记，已拒绝执行')
    }
    return
  }

  await assertWorkspaceFileFreshness({
    fs: input.fs,
    absolutePath: entry.absolutePath,
    expectedExisted: entry.expectedExisted,
    expectedHash: entry.expectedHash
  })

  if (entry.destinationAbsolutePath) {
    const destExists = await input.fs.exists(entry.destinationAbsolutePath)
    if (destExists) {
      throw new WorkspaceGateStaleError()
    }
  }
}

export function clearWorkspaceGateFreshnessForTests(): void {
  registry.clear()
  tokenSeq = 0
}
