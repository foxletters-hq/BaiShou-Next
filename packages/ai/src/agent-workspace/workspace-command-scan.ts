// @ts-ignore - Node built-in, available at runtime
import { homedir } from 'node:os'
// @ts-ignore - Node built-in, available at runtime
import { resolve } from 'node:path'
import {
  isDangerousShellCommand,
  isDirectoryChangeSegment,
  resolveCommandPrefixPatternFromCommand,
  resolveCommandPrefixPatternsFromCommand,
  splitShellChainRawSegments,
  tokenizeCommand,
  unwrapWorkspaceCommandLine,
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

function looksRelativeParentTraversal(value: string): boolean {
  if (value === '..') return true
  if (value.startsWith('../') || value.startsWith('..\\')) return true
  if (value.includes('/../') || value.includes('\\..\\')) return true
  if (value.endsWith('/..') || value.endsWith('\\..')) return true
  return false
}

function expandHomePath(value: string): string | null {
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return resolve(homedir(), value.slice(2))
  }
  return null
}

function normalizeCandidateToken(rawToken: string): string {
  // Strip shell redirection prefixes like `>`, `>>`, `2>`, `<` and `--flag=` prefixes
  let token = rawToken.replace(/^(?:[0-9]*>>?|[0-9]*<&?[0-9]*|&>>?)/, '')
  const eqIndex = token.indexOf('=')
  if (token.startsWith('-') && eqIndex > 0) {
    token = token.slice(eqIndex + 1)
  }
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1)
  }
  return token
}

function extractDirectoryChangeTarget(tokens: string[]): string | null {
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!
    const lower = token.toLowerCase()
    if (lower === '/d' || lower === '-p' || lower === '-l' || lower === '-passthru') {
      continue
    }
    if (lower === '-path' || lower === '-literalpath') {
      const next = tokens[i + 1]
      return next && next !== '-' ? next : null
    }
    if (token.startsWith('-') && token !== '-') {
      continue
    }
    if (token === '-') return null
    return token
  }
  return null
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
  prefixPatterns: string[]
}

/**
 * Classify workspace_run args for Agent Gate: shell command, workdir, cd jumps, and path tokens.
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

  let currentDir = resolve(folderRoot)
  const workdir = typeof input.workdir === 'string' ? input.workdir.trim() : ''
  if (workdir) {
    const classifiedWorkdir = classifyWorkspacePathForGate(workdir, folderRoot)
    pushUnique(resources, classifiedWorkdir)
    currentDir = looksAbsolutePath(workdir, platform)
      ? resolve(workdir)
      : resolve(folderRoot, workdir)
  }

  const unwrapped = unwrapWorkspaceCommandLine(command)
  const segments = splitShellChainRawSegments(unwrapped)
  for (const segment of segments.length > 0 ? segments : [unwrapped]) {
    const segTokens = tokenizeCommand(segment)
    if (isDirectoryChangeSegment(segment)) {
      const target = extractDirectoryChangeTarget(segTokens)
      if (target) {
        const homeExpanded = expandHomePath(target)
        const resolvedTarget =
          homeExpanded ??
          (looksAbsolutePath(target, platform) ? target : resolve(currentDir, target))
        pushUnique(resources, classifyWorkspacePathForGate(resolvedTarget, folderRoot))
        currentDir = resolve(resolvedTarget)
      }
      continue
    }

    for (const rawToken of segTokens) {
      const token = normalizeCandidateToken(rawToken)
      if (!token) continue
      const homeExpanded = expandHomePath(token)
      if (homeExpanded) {
        pushUnique(resources, classifyWorkspacePathForGate(homeExpanded, folderRoot))
        continue
      }
      if (looksAbsolutePath(token, platform)) {
        pushUnique(resources, classifyWorkspacePathForGate(token, folderRoot))
        continue
      }
      if (looksRelativeParentTraversal(token)) {
        const resolvedToken = resolve(currentDir, token)
        pushUnique(resources, classifyWorkspacePathForGate(resolvedToken, folderRoot))
      }
    }
  }

  const prefixPatterns = resolveCommandPrefixPatternsFromCommand(command)

  return {
    resources,
    dangerous: isDangerousShellCommand(command),
    prefixPattern: prefixPatterns[0] ?? resolveCommandPrefixPatternFromCommand(command),
    prefixPatterns
  }
}
