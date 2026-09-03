import { resolveGitCommitMessage } from '@baishou/shared'
import { interpretCommitResult } from './git-management.utils'

export type GitCommitScope = 'smart' | 'staged' | 'all'
export type GitCommitApi = 'staged' | 'all'

/** smart：有暂存则只提交暂存，否则提交全部；staged / all 固定走对应接口 */
export function resolveGitCommitApi(scope: GitCommitScope, stagedCount: number): GitCommitApi {
  if (scope === 'all') return 'all'
  if (scope === 'staged') return 'staged'
  return stagedCount > 0 ? 'staged' : 'all'
}

export function shouldPushAfterCommit(ok: boolean): boolean {
  return ok
}

export function isStagedOnlyCommit(scope: GitCommitScope, stagedCount: number): boolean {
  return resolveGitCommitApi(scope, stagedCount) === 'staged'
}

export interface CommitSuccessToast {
  key: string
  fallback: string
  interpolation?: { count: number }
}

export function resolveCommitSuccessToast(params: {
  fileCount: number
  mode: 'local' | 'push'
  scope: GitCommitScope
  stagedCount: number
}): CommitSuccessToast {
  const stagedOnly = isStagedOnlyCommit(params.scope, params.stagedCount)
  if (params.mode === 'push') {
    if (params.fileCount > 0) {
      return stagedOnly
        ? {
            key: 'version_control.commit_staged_success_count_pushing',
            fallback: '已提交 {{count}} 个暂存文件，正在推送...',
            interpolation: { count: params.fileCount }
          }
        : {
            key: 'version_control.commit_all_success_count_pushing',
            fallback: '已暂存并提交 {{count}} 个文件，正在推送...',
            interpolation: { count: params.fileCount }
          }
    }
    return {
      key: 'version_control.commit_success_pushing',
      fallback: '提交成功，正在推送...'
    }
  }

  if (params.fileCount > 0) {
    return stagedOnly
      ? {
          key: 'version_control.commit_staged_success_count',
          fallback: '已提交 {{count}} 个暂存文件',
          interpolation: { count: params.fileCount }
        }
      : {
          key: 'version_control.commit_all_success_count',
          fallback: '已暂存并提交 {{count}} 个文件',
          interpolation: { count: params.fileCount }
        }
  }

  return { key: 'version_control.commit_success', fallback: '提交成功' }
}

export async function executeGitCommit(params: {
  scope: GitCommitScope
  stagedCount: number
  message: string
  onCommit: (message: string) => Promise<{ hash?: string; files?: unknown[] } | null>
  onCommitAll: (message: string) => Promise<{ hash?: string; files?: unknown[] } | null>
}): Promise<{ ok: boolean; fileCount: number }> {
  const message = resolveGitCommitMessage(params.message)
  const api = resolveGitCommitApi(params.scope, params.stagedCount)
  const result =
    api === 'staged' ? await params.onCommit(message) : await params.onCommitAll(message)
  return interpretCommitResult(result)
}
