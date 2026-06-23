import { z } from 'zod'
import { AgentTool, type ToolContext } from '../tools/agent.tool'
import { buildFileChangePartData } from './file-change.part-builder'
import {
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath,
  WorkspacePathError
} from './workspace-path.sandbox'
import { createNodeWorkspaceFs, type WorkspaceFsAdapter } from './workspace-fs'
import type { FileChangePartData } from '@baishou/shared'

const WORKSPACE_TOOL_CATEGORY = 'workspace'

function requireWorkspace(context: ToolContext): {
  folderRoot: string
  fs: WorkspaceFsAdapter
  roundCheckpointId?: string
} {
  const folderRoot = context.workspace?.folderRoot
  if (!folderRoot) {
    throw new Error('Workspace is not configured for this session')
  }
  return {
    folderRoot,
    fs: context.workspace?.fs ?? createNodeWorkspaceFs(),
    roundCheckpointId: context.workspace?.roundCheckpointId
  }
}

function resolveRelativePath(context: ToolContext, path: string): {
  relativePath: string
  absolutePath: string
  folderRoot: string
  fs: WorkspaceFsAdapter
  roundCheckpointId?: string
} {
  const { folderRoot, fs, roundCheckpointId } = requireWorkspace(context)
  const relativePath = normalizeWorkspaceRelativePath(path)
  const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
  return { relativePath, absolutePath, folderRoot, fs, roundCheckpointId }
}

async function capturePathIfNeeded(
  context: ToolContext,
  folderRoot: string,
  relativePath: string
): Promise<void> {
  const checkpointId = context.workspace?.roundCheckpointId
  const service = context.workspace?.roundCheckpointService
  if (!checkpointId || !service) return
  await service.ensurePathCaptured(checkpointId, folderRoot, relativePath)
}

function emitFileChange(context: ToolContext, change: FileChangePartData): void {
  context.workspace?.onFileChange?.(change)
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

const workspaceListParams = z.object({
  path: z
    .string()
    .optional()
    .describe('Relative directory path inside the workspace. Defaults to the workspace root.')
})

export class WorkspaceListTool extends AgentTool<typeof workspaceListParams> {
  readonly name = 'workspace_list'
  readonly description =
    'List files and directories inside the workspace folder. ' +
    'Paths are relative to the workspace root.'
  readonly parameters = workspaceListParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'folder-tree'
  }

  async execute(args: z.infer<typeof workspaceListParams>, context: ToolContext): Promise<string> {
    try {
      const rel = args.path != null ? normalizeWorkspaceRelativePath(args.path) : ''
      const { absolutePath, fs } = resolveRelativePath(context, rel || '.')
      const exists = await fs.exists(absolutePath)
      if (!exists) {
        return `Error: Directory not found: ${rel || '.'}`
      }

      const entries = await fs.listDir(absolutePath)
      if (entries.length === 0) {
        return rel ? `Directory "${rel}" is empty.` : 'Workspace root is empty.'
      }

      const lines = entries
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map((entry) => `${entry.isDirectory ? '[dir]' : '[file]'} ${entry.name}`)

      return `Contents of ${rel || '.'}:\n${lines.join('\n')}`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

const workspaceReadParams = z.object({
  path: z.string().describe('Relative file path inside the workspace.'),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional 0-based line offset to start reading from.'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional maximum number of lines to return.')
})

export class WorkspaceReadTool extends AgentTool<typeof workspaceReadParams> {
  readonly name = 'workspace_read'
  readonly description =
    'Read a text file from the workspace. ' +
    'Use offset and limit for large files.'
  readonly parameters = workspaceReadParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'file-text'
  }

  async execute(args: z.infer<typeof workspaceReadParams>, context: ToolContext): Promise<string> {
    try {
      const { relativePath, absolutePath, fs } = resolveRelativePath(context, args.path)
      const exists = await fs.exists(absolutePath)
      if (!exists) {
        return `Error: File not found: ${relativePath}`
      }

      const content = await fs.readFile(absolutePath)
      if (content == null) {
        return `Error: Unable to read file: ${relativePath}`
      }

      const lines = content.split('\n')
      const offset = args.offset ?? 0
      const limit = args.limit ?? lines.length
      const slice = lines.slice(offset, offset + limit)
      const header =
        offset > 0 || slice.length < lines.length
          ? `--- ${relativePath} (lines ${offset + 1}-${offset + slice.length} of ${lines.length}) ---\n`
          : `--- ${relativePath} ---\n`

      return `${header}${slice.join('\n')}`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

const workspaceWriteParams = z.object({
  path: z.string().describe('Relative file path inside the workspace.'),
  content: z.string().describe('Full text content to write to the file.')
})

export class WorkspaceWriteTool extends AgentTool<typeof workspaceWriteParams> {
  readonly name = 'workspace_write'
  readonly description =
    'Create or overwrite a text file in the workspace. ' +
    'Parent directories are created automatically.'
  readonly parameters = workspaceWriteParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'file-pen'
  }

  async execute(args: z.infer<typeof workspaceWriteParams>, context: ToolContext): Promise<string> {
    try {
      const { relativePath, absolutePath, folderRoot, fs, roundCheckpointId } = resolveRelativePath(
        context,
        args.path
      )
      await capturePathIfNeeded(context, folderRoot, relativePath)

      const existed = await fs.exists(absolutePath)
      const beforeContent = existed ? await fs.readFile(absolutePath) : null
      await fs.writeFile(absolutePath, args.content)

      const change = buildFileChangePartData({
        path: relativePath,
        kind: existed ? 'modify' : 'create',
        beforeContent,
        afterContent: args.content,
        roundCheckpointId
      })
      emitFileChange(context, change)

      return existed
        ? `Successfully updated ${relativePath} (+${change.additions} -${change.deletions}).`
        : `Successfully created ${relativePath} (+${change.additions} lines).`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

const workspacePatchParams = z.object({
  path: z.string().describe('Relative file path inside the workspace.'),
  old_text: z.string().describe('Exact text to find in the file.'),
  new_text: z.string().describe('Replacement text.'),
  replace_all: z
    .boolean()
    .optional()
    .describe('Replace all occurrences instead of only the first match.')
})

export class WorkspacePatchTool extends AgentTool<typeof workspacePatchParams> {
  readonly name = 'workspace_patch'
  readonly description =
    'Apply a targeted text replacement inside a workspace file. ' +
    'The old_text must match exactly.'
  readonly parameters = workspacePatchParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'file-diff'
  }

  async execute(args: z.infer<typeof workspacePatchParams>, context: ToolContext): Promise<string> {
    try {
      const { relativePath, absolutePath, folderRoot, fs, roundCheckpointId } = resolveRelativePath(
        context,
        args.path
      )
      const exists = await fs.exists(absolutePath)
      if (!exists) {
        return `Error: File not found: ${relativePath}`
      }

      await capturePathIfNeeded(context, folderRoot, relativePath)

      const beforeContent = await fs.readFile(absolutePath)
      if (beforeContent == null) {
        return `Error: Unable to read file: ${relativePath}`
      }

      const occurrences = beforeContent.split(args.old_text).length - 1
      if (occurrences === 0) {
        return `Error: old_text not found in ${relativePath}`
      }
      if (!args.replace_all && occurrences > 1) {
        return `Error: old_text appears ${occurrences} times in ${relativePath}. Use replace_all=true or provide a more specific old_text.`
      }

      const afterContent = args.replace_all
        ? beforeContent.split(args.old_text).join(args.new_text)
        : beforeContent.replace(args.old_text, args.new_text)

      await fs.writeFile(absolutePath, afterContent)

      const change = buildFileChangePartData({
        path: relativePath,
        kind: 'modify',
        beforeContent,
        afterContent,
        roundCheckpointId
      })
      emitFileChange(context, change)

      return `Successfully patched ${relativePath} (+${change.additions} -${change.deletions}).`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

const workspaceDeleteParams = z.object({
  path: z.string().describe('Relative file path inside the workspace to delete.')
})

export class WorkspaceDeleteTool extends AgentTool<typeof workspaceDeleteParams> {
  readonly name = 'workspace_delete'
  readonly description =
    'Delete a file from the workspace. ' +
    'This is destructive and requires user confirmation via BaishouAgentGate.'
  readonly parameters = workspaceDeleteParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'file-x'
  }

  async execute(args: z.infer<typeof workspaceDeleteParams>, context: ToolContext): Promise<string> {
    try {
      const { relativePath, absolutePath, folderRoot, fs, roundCheckpointId } = resolveRelativePath(
        context,
        args.path
      )
      const exists = await fs.exists(absolutePath)
      if (!exists) {
        return `Error: File not found: ${relativePath}`
      }

      await capturePathIfNeeded(context, folderRoot, relativePath)

      const beforeContent = await fs.readFile(absolutePath)
      await fs.deleteFile(absolutePath)

      const change = buildFileChangePartData({
        path: relativePath,
        kind: 'delete',
        beforeContent,
        afterContent: null,
        roundCheckpointId
      })
      emitFileChange(context, change)

      return `Successfully deleted ${relativePath} (-${change.deletions} lines).`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

const workspaceRenameParams = z.object({
  path: z.string().describe('Current relative file path inside the workspace.'),
  new_path: z.string().describe('New relative file path inside the workspace.')
})

export class WorkspaceRenameTool extends AgentTool<typeof workspaceRenameParams> {
  readonly name = 'workspace_rename'
  readonly description =
    'Rename or move a file within the workspace. ' +
    'Both paths must stay inside the workspace root.'
  readonly parameters = workspaceRenameParams

  get category(): string {
    return WORKSPACE_TOOL_CATEGORY
  }

  get icon(): string {
    return 'file-symlink'
  }

  async execute(args: z.infer<typeof workspaceRenameParams>, context: ToolContext): Promise<string> {
    try {
      const from = resolveRelativePath(context, args.path)
      const toRel = normalizeWorkspaceRelativePath(args.new_path)
      const toAbs = resolveWorkspacePath(from.folderRoot, toRel)

      if (from.relativePath === toRel) {
        return `Error: Source and destination are the same: ${toRel}`
      }

      const sourceExists = await from.fs.exists(from.absolutePath)
      if (!sourceExists) {
        return `Error: File not found: ${from.relativePath}`
      }

      const destExists = await from.fs.exists(toAbs)
      if (destExists) {
        return `Error: Destination already exists: ${toRel}`
      }

      await capturePathIfNeeded(context, from.folderRoot, from.relativePath)
      await capturePathIfNeeded(context, from.folderRoot, toRel)

      const beforeContent = await from.fs.readFile(from.absolutePath)
      await from.fs.rename(from.absolutePath, toAbs)

      const change = buildFileChangePartData({
        path: toRel,
        kind: 'rename',
        beforeContent,
        afterContent: beforeContent,
        previousPath: from.relativePath,
        roundCheckpointId: from.roundCheckpointId
      })
      emitFileChange(context, change)

      return `Successfully renamed ${from.relativePath} → ${toRel}.`
    } catch (error) {
      return formatWorkspaceError(error)
    }
  }
}

export const WORKSPACE_TOOL_IDS = [
  'workspace_list',
  'workspace_read',
  'workspace_write',
  'workspace_patch',
  'workspace_delete',
  'workspace_rename'
] as const

export function createWorkspaceTools(): AgentTool[] {
  return [
    new WorkspaceListTool(),
    new WorkspaceReadTool(),
    new WorkspaceWriteTool(),
    new WorkspacePatchTool(),
    new WorkspaceDeleteTool(),
    new WorkspaceRenameTool()
  ]
}
