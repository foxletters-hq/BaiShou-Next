import {
  agentGateSimpleHash,
  type AgentGateCommandPreview,
  type AgentGateContentPreview,
  type AgentGateFileChangePreview,
  type AgentGatePrepareResult
} from '@baishou/shared'
import { buildUnifiedDiffWithLimit, computeLineDiffStats } from './file-change.part-builder'
import {
  createNodeWorkspaceFs,
  hashWorkspaceContent,
  type WorkspaceFsAdapter
} from './workspace-fs'
import {
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath
} from './workspace-path.sandbox'
import { scanWorkspaceRunCommand } from './workspace-command-scan'
import { rememberWorkspaceGateFreshness } from './workspace-gate-freshness.registry'

export const WORKSPACE_GATE_STALE_MESSAGE = '文件在等待确认期间已变化，请重新发起'

const MAX_PREVIEW_DIFF_CHARS = 24_000

export class WorkspaceGatePrepareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceGatePrepareError'
  }
}

export class WorkspaceGateStaleError extends Error {
  constructor(message = WORKSPACE_GATE_STALE_MESSAGE) {
    super(message)
    this.name = 'WorkspaceGateStaleError'
  }
}

type GateArgs = Record<string, unknown>

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function contentDigest(content: string): string {
  return agentGateSimpleHash(content.slice(0, 4096))
}

function resolveFs(ctx: {
  workspace?: { folderRoot?: string; fs?: WorkspaceFsAdapter }
}): { folderRoot: string; fs: WorkspaceFsAdapter } {
  const folderRoot = ctx.workspace?.folderRoot
  if (!folderRoot) {
    throw new WorkspaceGatePrepareError('Workspace is not configured for this session')
  }
  return { folderRoot, fs: ctx.workspace?.fs ?? createNodeWorkspaceFs() }
}

function resolveSessionId(ctx: unknown): string {
  const sessionId = (ctx as { sessionId?: string } | undefined)?.sessionId
  if (typeof sessionId === 'string' && sessionId) return sessionId
  throw new WorkspaceGatePrepareError('sessionId is required for workspace gate prepare')
}

async function currentHash(
  fs: WorkspaceFsAdapter,
  absolutePath: string,
  existed: boolean
): Promise<string | null> {
  if (!existed) return null
  const content = await fs.readFile(absolutePath)
  if (content == null) return null
  return hashWorkspaceContent(content)
}

function buildFilePreview(input: {
  path: string
  kind: AgentGateFileChangePreview['kind']
  before: string
  after: string
  previousPath?: string
}): AgentGateFileChangePreview {
  const { diff, truncated, additions, deletions } = buildUnifiedDiffWithLimit(
    input.path,
    input.before,
    input.after,
    MAX_PREVIEW_DIFF_CHARS
  )
  const stats =
    input.kind === 'rename'
      ? { additions: 0, deletions: 0 }
      : input.kind === 'create'
        ? { additions: computeLineDiffStats('', input.after).additions, deletions: 0 }
        : input.kind === 'delete'
          ? { additions: 0, deletions: computeLineDiffStats(input.before, '').deletions }
          : { additions, deletions }

  return {
    type: 'file_change',
    path: input.path,
    kind: input.kind,
    additions: stats.additions,
    deletions: stats.deletions,
    diff: diff || undefined,
    previousPath: input.previousPath,
    truncated: truncated || undefined,
    contentDigest: contentDigest(`${input.before}\0${input.after}\0${input.previousPath ?? ''}`)
  }
}

export async function prepareWorkspaceWriteGate(
  args: unknown,
  ctx: unknown
): Promise<AgentGatePrepareResult | null> {
  const path = asString((args as GateArgs).path)
  const content = (args as GateArgs).content
  if (!path || typeof content !== 'string') {
    throw new WorkspaceGatePrepareError('workspace_write requires path and content')
  }

  const sessionId = resolveSessionId(ctx)
  const { folderRoot, fs } = resolveFs(ctx as { workspace?: { folderRoot?: string; fs?: WorkspaceFsAdapter } })
  const relativePath = normalizeWorkspaceRelativePath(path)
  const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
  const existed = await fs.exists(absolutePath)
  const beforeContent = existed ? ((await fs.readFile(absolutePath)) ?? '') : ''
  const sourceHash = await currentHash(fs, absolutePath, existed)
  const afterContent = content
  const kind = existed ? 'modify' : 'create'
  const preview = buildFilePreview({
    path: relativePath,
    kind,
    before: beforeContent,
    after: afterContent
  })

  const freshnessToken = rememberWorkspaceGateFreshness({
    sessionId,
    absolutePath,
    expectedExisted: existed,
    expectedHash: sourceHash
  })

  return {
    preview,
    description: existed
      ? `将修改 ${relativePath}（+${preview.additions} / -${preview.deletions}）`
      : `将创建 ${relativePath}（+${preview.additions}）`,
    freshnessToken,
    verifyBeforeExecute: async () => {
      const stillExists = await fs.exists(absolutePath)
      if (stillExists !== existed) {
        throw new WorkspaceGateStaleError()
      }
      const nowHash = await currentHash(fs, absolutePath, stillExists)
      if (nowHash !== sourceHash) {
        throw new WorkspaceGateStaleError()
      }
    }
  }
}

export async function prepareWorkspacePatchGate(
  args: unknown,
  ctx: unknown
): Promise<AgentGatePrepareResult | null> {
  const path = asString((args as GateArgs).path)
  const oldText = asString((args as GateArgs).old_text)
  const newText = (args as GateArgs).new_text
  const replaceAll = Boolean((args as GateArgs).replace_all)
  if (!path || oldText == null || typeof newText !== 'string') {
    throw new WorkspaceGatePrepareError('workspace_patch requires path, old_text and new_text')
  }

  const sessionId = resolveSessionId(ctx)
  const { folderRoot, fs } = resolveFs(ctx as { workspace?: { folderRoot?: string; fs?: WorkspaceFsAdapter } })
  const relativePath = normalizeWorkspaceRelativePath(path)
  const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
  const existed = await fs.exists(absolutePath)
  if (!existed) {
    throw new WorkspaceGatePrepareError(`File not found: ${relativePath}`)
  }
  const beforeContent = await fs.readFile(absolutePath)
  if (beforeContent == null) {
    throw new WorkspaceGatePrepareError(`Unable to read file: ${relativePath}`)
  }

  const occurrences = beforeContent.split(oldText).length - 1
  if (occurrences === 0) {
    // No match → do not show permission card
    return null
  }
  if (!replaceAll && occurrences > 1) {
    throw new WorkspaceGatePrepareError(
      `old_text appears ${occurrences} times in ${relativePath}. Use replace_all=true or provide a more specific old_text.`
    )
  }

  const afterContent = replaceAll
    ? beforeContent.split(oldText).join(newText)
    : beforeContent.replace(oldText, newText)
  const sourceHash = hashWorkspaceContent(beforeContent)
  const preview = buildFilePreview({
    path: relativePath,
    kind: 'modify',
    before: beforeContent,
    after: afterContent
  })

  const freshnessToken = rememberWorkspaceGateFreshness({
    sessionId,
    absolutePath,
    expectedExisted: true,
    expectedHash: sourceHash
  })

  return {
    preview,
    description: `将修改 ${relativePath}（+${preview.additions} / -${preview.deletions}）`,
    freshnessToken,
    verifyBeforeExecute: async () => {
      const stillExists = await fs.exists(absolutePath)
      if (!stillExists) throw new WorkspaceGateStaleError()
      const current = await fs.readFile(absolutePath)
      if (current == null || hashWorkspaceContent(current) !== sourceHash) {
        throw new WorkspaceGateStaleError()
      }
      if (!current.includes(oldText)) {
        throw new WorkspaceGateStaleError()
      }
    }
  }
}

export async function prepareWorkspaceDeleteGate(
  args: unknown,
  ctx: unknown
): Promise<AgentGatePrepareResult | null> {
  const path = asString((args as GateArgs).path)
  if (!path) {
    throw new WorkspaceGatePrepareError('workspace_delete requires path')
  }

  const sessionId = resolveSessionId(ctx)
  const { folderRoot, fs } = resolveFs(ctx as { workspace?: { folderRoot?: string; fs?: WorkspaceFsAdapter } })
  const relativePath = normalizeWorkspaceRelativePath(path)
  const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
  const existed = await fs.exists(absolutePath)
  if (!existed) {
    throw new WorkspaceGatePrepareError(`File not found: ${relativePath}`)
  }
  const beforeContent = (await fs.readFile(absolutePath)) ?? ''
  const sourceHash = hashWorkspaceContent(beforeContent)
  const preview = buildFilePreview({
    path: relativePath,
    kind: 'delete',
    before: beforeContent,
    after: ''
  })

  const freshnessToken = rememberWorkspaceGateFreshness({
    sessionId,
    absolutePath,
    expectedExisted: true,
    expectedHash: sourceHash
  })

  return {
    preview,
    description: `将删除 ${relativePath}（-${preview.deletions}）`,
    freshnessToken,
    verifyBeforeExecute: async () => {
      const stillExists = await fs.exists(absolutePath)
      if (!stillExists) throw new WorkspaceGateStaleError()
      const current = await fs.readFile(absolutePath)
      if (current == null || hashWorkspaceContent(current) !== sourceHash) {
        throw new WorkspaceGateStaleError()
      }
    }
  }
}

export async function prepareWorkspaceRenameGate(
  args: unknown,
  ctx: unknown
): Promise<AgentGatePrepareResult | null> {
  const path = asString((args as GateArgs).path)
  const newPath = asString((args as GateArgs).new_path)
  if (!path || !newPath) {
    throw new WorkspaceGatePrepareError('workspace_rename requires path and new_path')
  }

  const sessionId = resolveSessionId(ctx)
  const { folderRoot, fs } = resolveFs(ctx as { workspace?: { folderRoot?: string; fs?: WorkspaceFsAdapter } })
  const fromRel = normalizeWorkspaceRelativePath(path)
  const toRel = normalizeWorkspaceRelativePath(newPath)
  const fromAbs = resolveWorkspacePath(folderRoot, fromRel)
  const toAbs = resolveWorkspacePath(folderRoot, toRel)

  if (fromRel === toRel) {
    throw new WorkspaceGatePrepareError(`Source and destination are the same: ${toRel}`)
  }
  if (!(await fs.exists(fromAbs))) {
    throw new WorkspaceGatePrepareError(`File not found: ${fromRel}`)
  }
  if (await fs.exists(toAbs)) {
    throw new WorkspaceGatePrepareError(`Destination already exists: ${toRel}`)
  }

  const beforeContent = (await fs.readFile(fromAbs)) ?? ''
  const sourceHash = hashWorkspaceContent(beforeContent)
  const preview = buildFilePreview({
    path: toRel,
    kind: 'rename',
    before: beforeContent,
    after: beforeContent,
    previousPath: fromRel
  })

  const freshnessToken = rememberWorkspaceGateFreshness({
    sessionId,
    absolutePath: fromAbs,
    expectedExisted: true,
    expectedHash: sourceHash,
    destinationAbsolutePath: toAbs
  })

  return {
    preview,
    description: `将重命名 ${fromRel} → ${toRel}`,
    freshnessToken,
    verifyBeforeExecute: async () => {
      if (!(await fs.exists(fromAbs))) throw new WorkspaceGateStaleError()
      if (await fs.exists(toAbs)) throw new WorkspaceGateStaleError()
      const current = await fs.readFile(fromAbs)
      if (current == null || hashWorkspaceContent(current) !== sourceHash) {
        throw new WorkspaceGateStaleError()
      }
    }
  }
}

export function prepareWorkspaceRunGate(args: unknown, ctx: unknown): AgentGatePrepareResult {
  const command = asString((args as GateArgs).command)
  if (!command) {
    throw new WorkspaceGatePrepareError('workspace_run requires command')
  }
  const workdir = asString((args as GateArgs).workdir)
  const folderRoot = (ctx as { workspace?: { folderRoot?: string } }).workspace?.folderRoot
  const scan =
    folderRoot != null
      ? scanWorkspaceRunCommand({
          command,
          workdir,
          folderRoot
        })
      : null

  const externalPaths = scan?.resources
    .filter((r) => r.kind === 'external_path')
    .map((r) => r.value)

  const preview: AgentGateCommandPreview = {
    type: 'command',
    command,
    workdir,
    externalPaths: externalPaths && externalPaths.length > 0 ? externalPaths : undefined,
    dangerous: scan?.dangerous || undefined,
    dangerReason: scan?.dangerous ? '检测到高风险 shell 命令模式' : undefined,
    prefixPattern: scan?.prefixPattern ?? undefined
  }

  return {
    preview,
    description: scan?.dangerous
      ? `危险命令需要确认：${command}`
      : `将运行命令：${command}`
  }
}

export function prepareContentGatePreview(input: {
  subject: string
  summary?: string
  detailLines?: string[]
  counts?: Record<string, number>
}): AgentGatePrepareResult {
  const preview: AgentGateContentPreview = {
    type: 'content',
    subject: input.subject,
    summary: input.summary,
    detailLines: input.detailLines,
    counts: input.counts
  }
  return {
    preview,
    description: input.summary ? `${input.subject}：${input.summary}` : input.subject
  }
}

/** 工具执行前二次校验（与 prepare 闭包互补） */
export async function assertWorkspaceFileFreshness(input: {
  fs: WorkspaceFsAdapter
  absolutePath: string
  expectedExisted: boolean
  expectedHash: string | null
}): Promise<void> {
  const exists = await input.fs.exists(input.absolutePath)
  if (exists !== input.expectedExisted) {
    throw new WorkspaceGateStaleError()
  }
  if (!exists) return
  const content = await input.fs.readFile(input.absolutePath)
  const hash = content == null ? null : hashWorkspaceContent(content)
  if (hash !== input.expectedHash) {
    throw new WorkspaceGateStaleError()
  }
}
