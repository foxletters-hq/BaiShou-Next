import {
  isDangerousShellCommand,
  resolveCommandPrefixPatternFromCommand,
  tokenizeCommand,
  type AgentGateResourceRef
} from '@baishou/shared'
import { classifyWorkspacePathForGate } from '../baishou-agent-gate/agent-gate-workspace-path.util'

function looksAbsolutePath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(value)
}

function pushUnique(resources: AgentGateResourceRef[], resource: AgentGateResourceRef): void {
  const key = `${resource.kind}:${resource.value}`
  if (resources.some((r) => `${r.kind}:${r.value}` === key)) return
  resources.push(resource)
}

export interface ScanWorkspaceRunCommandInput {
  command: string
  workdir?: string
  folderRoot: string
}

export interface ScanWorkspaceRunCommandResult {
  resources: AgentGateResourceRef[]
  dangerous: boolean
  prefixPattern: string | null
}

/**
 * Classify workspace_run args for Agent Gate: shell command, workdir, and absolute path tokens.
 */
export function scanWorkspaceRunCommand(
  input: ScanWorkspaceRunCommandInput
): ScanWorkspaceRunCommandResult {
  const command = typeof input.command === 'string' ? input.command : ''
  const folderRoot = input.folderRoot
  const resources: AgentGateResourceRef[] = []

  if (command.trim()) {
    pushUnique(resources, { kind: 'shell_command', value: command })
  }

  const workdir = typeof input.workdir === 'string' ? input.workdir.trim() : ''
  if (workdir) {
    pushUnique(resources, classifyWorkspacePathForGate(workdir, folderRoot))
  }

  for (const token of tokenizeCommand(command)) {
    if (!looksAbsolutePath(token)) continue
    pushUnique(resources, classifyWorkspacePathForGate(token, folderRoot))
  }

  return {
    resources,
    dangerous: isDangerousShellCommand(command),
    prefixPattern: resolveCommandPrefixPatternFromCommand(command)
  }
}
