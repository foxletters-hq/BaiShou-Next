import type { WorkspaceCommandRuntime } from './workspace-command-runtime'

export interface RunHostProcessParams {
  command: string
  cwd: string
  timeoutMs?: number
  abortSignal?: AbortSignal
  runtime?: WorkspaceCommandRuntime
}

export function detectProcessCommandRuntime(): WorkspaceCommandRuntime {
  return {
    executable: '/bin/sh',
    binary: 'sh',
    family: 'unix_shell',
    label: 'Unix shell (sh)'
  }
}

export function resetWorkspaceCommandRuntimeCache(): void {
  // native stub
}

export interface RunHostProcessResult {
  exitCode: number | null
  timedOut: boolean
  truncated: boolean
  output: string
}

/** Mobile stub — host process execution is desktop-only. */
export function runHostProcess(_params: RunHostProcessParams): Promise<RunHostProcessResult> {
  return Promise.resolve({
    exitCode: null,
    timedOut: false,
    truncated: false,
    output: 'Error: workspace_run is not available on this platform'
  })
}
