import { z } from 'zod'
// @ts-ignore - Node built-in, available at runtime
import { resolve } from 'node:path'
import { AgentTool, type ToolContext } from '../tools/agent.tool'
import {
  isPathInsideWorkspaceRoot,
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath,
  WorkspacePathError
} from './workspace-path.sandbox'
import { runHostProcess } from './workspace-host-process'

const WORKSPACE_TOOL_CATEGORY = 'workspace'
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 600_000
const DEFAULT_TIMEOUT_MS = 120_000

function requireWorkspace(context: ToolContext): { folderRoot: string } {
  const folderRoot = context.workspace?.folderRoot
  if (!folderRoot) {
    throw new Error('Workspace is not configured for this session')
  }
  return { folderRoot }
}

function formatWorkspaceError(error: unknown): string {
  if (error instanceof WorkspacePathError) {
    return `Error: ${error.message}`
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`
  }
  return `Error: ${String(error)}`
}

function clampTimeoutMs(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(value)))
}

function resolveRunCwd(folderRoot: string, workdir: string | undefined): string {
  if (workdir == null || workdir.trim() === '') {
    return resolve(folderRoot)
  }

  const trimmed = workdir.trim()
  if (/^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed)) {
    const abs = resolve(trimmed)
    if (!isPathInsideWorkspaceRoot(folderRoot, abs)) {
      throw new WorkspacePathError('workdir must be inside the workspace root')
    }
    return abs
  }

  return resolveWorkspacePath(folderRoot, normalizeWorkspaceRelativePath(trimmed))
}

const workspaceRunParams = z.object({
  command: z.string().describe('Shell command to execute in the workspace host process.'),
  workdir: z
    .string()
    .optional()
    .describe(
      'Optional working directory relative to the workspace root (preferred over `cd &&` in command).'
    ),
  timeout_ms: z
    .number()
    .optional()
    .describe('Optional timeout in milliseconds (clamped to 1000..600000). Defaults to 120000.')
})

export class WorkspaceRunTool extends AgentTool<typeof workspaceRunParams> {
  readonly name = 'workspace_run'
  readonly description =
    'Run a command in the workspace folder on the host process. ' +
    'There is no OS sandbox — the command runs with the app host privileges. ' +
    'Prefer the workdir parameter instead of `cd &&` in the command. ' +
    'Only available in workspace sessions.'

  readonly parameters = workspaceRunParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'terminal'
  }

  async execute(args: z.infer<typeof workspaceRunParams>, context: ToolContext): Promise<string> {
    try {
      if (context.workspace?.sessionKind !== 'workspace') {
        return 'Error: workspace_run is only available in workspace sessions'
      }

      const { folderRoot } = requireWorkspace(context)
      const command = args.command?.trim()
      if (!command) {
        return 'Error: command is required'
      }

      const cwd = resolveRunCwd(folderRoot, args.workdir)
      const timeoutMs = clampTimeoutMs(args.timeout_ms)
      const result = await runHostProcess({
        command,
        cwd,
        timeoutMs
      })

      return [
        `exitCode: ${result.exitCode == null ? 'null' : result.exitCode}`,
        `timedOut: ${result.timedOut}`,
        `truncated: ${result.truncated}`,
        '',
        result.output || '(no output)'
      ].join('\n')
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}
