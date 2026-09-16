import {
  isDangerousShellCommand,
  resolveCommandPrefixPatternFromCommand,
  tokenizeCommand,
  type AgentGateResourceRef
} from '@baishou/shared'
import { classifyWorkspacePathForGate } from '../baishou-agent-gate/agent-gate-workspace-path.util'

function resolveScanPlatform(platform?: string): string {
  return platform ?? process.platform
}

/** Windows cmd 开关：/a、/all、/a:h、/?，没有第二段路径 */
function isWindowsSwitchToken(value: string): boolean {
  return /^\/[A-Za-z?][A-Za-z0-9]*([:+][A-Za-z0-9._-]*)?$/.test(value)
}

function looksAbsolutePath(value: string, platform: string): boolean {
  if (/^(?:[a-zA-Z]:[\\/]|\\\\)/.test(value)) return true
  if (!value.startsWith('/')) return false
  // 本机是 Windows 时，/a 是 dir 这类命令的开关，不是 Unix 根路径
  if (platform === 'win32' && isWindowsSwitchToken(value)) return false
  return true
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
  /** 命令在本机执行；测试可指定，避免把 Windows 开关当成 Unix 路径 */
  platform?: string
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
  const platform = resolveScanPlatform(input.platform)
  const resources: AgentGateResourceRef[] = []

  if (command.trim()) {
    pushUnique(resources, { kind: 'shell_command', value: command })
  }

  const workdir = typeof input.workdir === 'string' ? input.workdir.trim() : ''
  if (workdir) {
    pushUnique(resources, classifyWorkspacePathForGate(workdir, folderRoot))
  }

  for (const token of tokenizeCommand(command)) {
    if (!looksAbsolutePath(token, platform)) continue
    pushUnique(resources, classifyWorkspacePathForGate(token, folderRoot))
  }

  return {
    resources,
    dangerous: isDangerousShellCommand(command),
    prefixPattern: resolveCommandPrefixPatternFromCommand(command)
  }
}
