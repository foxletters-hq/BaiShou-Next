import {
  AgentGateRiskLevel,
  type AgentGateResourceRef,
  type AgentGateToolMetadata
} from '@baishou/shared'
import {
  classifyWorkspacePathForGate,
  collectExternalDirectoryGlobs
} from './agent-gate-workspace-path.util'
import { scanWorkspaceRunCommand } from '../agent-workspace/workspace-command-scan'
import {
  prepareContentGatePreview,
  prepareWorkspaceDeleteGate,
  prepareWorkspacePatchGate,
  prepareWorkspaceRenameGate,
  prepareWorkspaceRunGate,
  prepareWorkspaceWriteGate
} from '../agent-workspace/workspace-gate-preview'

type GateArgs = Record<string, unknown>

/** LLM tools sometimes pass entities/edges as JSON strings — parse before counting. */
function coerceJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function diaryDateTitle(prefix: string, args: unknown): string {
  const date = (args as GateArgs).date
  return typeof date === 'string' && date ? `${prefix} ${date}` : prefix
}

function workspaceFolderRoot(ctx: unknown): string | undefined {
  const folderRoot = (ctx as { workspace?: { folderRoot?: string } } | undefined)?.workspace
    ?.folderRoot
  return typeof folderRoot === 'string' && folderRoot ? folderRoot : undefined
}

function workspacePathResources(args: unknown, ctx: unknown): AgentGateResourceRef[] {
  const path = (args as GateArgs).path
  if (typeof path !== 'string' || !path) return []
  return [classifyWorkspacePathForGate(path, workspaceFolderRoot(ctx))]
}

function workspaceRenameResources(args: unknown, ctx: unknown): AgentGateResourceRef[] {
  const path = (args as GateArgs).path
  const newPath = (args as GateArgs).new_path
  const folderRoot = workspaceFolderRoot(ctx)
  const resources: AgentGateResourceRef[] = []
  if (typeof path === 'string' && path) {
    resources.push(classifyWorkspacePathForGate(path, folderRoot))
  }
  if (typeof newPath === 'string' && newPath) {
    resources.push(classifyWorkspacePathForGate(newPath, folderRoot))
  }
  return resources
}

function truncateCommandTitle(command: string, maxLen = 80): string {
  const oneLine = command.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen - 1)}…`
}

function workspaceRunResources(args: unknown, ctx: unknown): AgentGateResourceRef[] {
  const command = (args as GateArgs).command
  if (typeof command !== 'string' || !command.trim()) return []
  const folderRoot = workspaceFolderRoot(ctx)
  if (!folderRoot) {
    return [{ kind: 'shell_command', value: command }]
  }
  const workdir = (args as GateArgs).workdir
  return scanWorkspaceRunCommand({
    command,
    workdir: typeof workdir === 'string' ? workdir : undefined,
    folderRoot
  }).resources
}

/** Default gate metadata for mutating diary / memory tools */
export const AGENT_GATE_TOOL_METADATA: Readonly<Record<string, AgentGateToolMetadata>> = {
  diary_write: {
    action: 'diary_write',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => diaryDateTitle('创建日记', args),
    buildMetadata: (args) => ({ date: (args as GateArgs).date }),
    prepare: async (args) => {
      const date = (args as GateArgs).date
      return prepareContentGatePreview({
        subject: diaryDateTitle('创建日记', args),
        detailLines: typeof date === 'string' ? [`日期：${date}`] : undefined
      })
    }
  },
  diary_edit: {
    action: 'diary_edit',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => diaryDateTitle('编辑日记', args),
    buildMetadata: (args) => ({
      date: (args as GateArgs).date,
      mode: (args as GateArgs).mode
    }),
    prepare: async (args) => {
      const date = (args as GateArgs).date
      const mode = (args as GateArgs).mode
      return prepareContentGatePreview({
        subject: diaryDateTitle('编辑日记', args),
        detailLines: [
          typeof date === 'string' ? `日期：${date}` : null,
          typeof mode === 'string' ? `模式：${mode}` : null
        ].filter((line): line is string => Boolean(line))
      })
    }
  },
  diary_delete: {
    action: 'diary_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    forceExclusion: true,
    buildTitle: (args) => diaryDateTitle('删除日记', args),
    buildMetadata: (args) => ({ date: (args as GateArgs).date }),
    prepare: async (args) => {
      const date = (args as GateArgs).date
      return prepareContentGatePreview({
        subject: diaryDateTitle('删除日记', args),
        detailLines:
          typeof date === 'string' ? [`日期：${date}`, '将永久删除该日日记'] : ['将永久删除日记']
      })
    }
  },
  memory_store: {
    action: 'memory_store',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: () => '存储长期记忆',
    buildMetadata: (args) => ({
      preview:
        typeof (args as GateArgs).content === 'string'
          ? String((args as GateArgs).content).slice(0, 120)
          : undefined
    }),
    prepare: async (args) => {
      const content =
        typeof (args as GateArgs).content === 'string' ? String((args as GateArgs).content) : ''
      return prepareContentGatePreview({
        subject: '存储长期记忆',
        detailLines: content ? [content.slice(0, 400)] : undefined
      })
    }
  },
  skill_write: {
    action: 'skill_write',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const name = (args as GateArgs).name
      return typeof name === 'string' && name ? `保存 Skill ${name}` : '保存 Skill'
    },
    buildMetadata: (args) => ({
      name: (args as GateArgs).name,
      description: (args as GateArgs).description
    }),
    prepare: async (args) => {
      const name = (args as GateArgs).name
      const description = (args as GateArgs).description
      return prepareContentGatePreview({
        subject: typeof name === 'string' && name ? `保存 Skill ${name}` : '保存 Skill',
        detailLines: [
          typeof name === 'string' ? `名称：${name}` : null,
          typeof description === 'string' ? `说明：${description}` : null,
          typeof name === 'string' ? `路径：AI/skills/${name}/SKILL.md` : null
        ].filter((line): line is string => Boolean(line))
      })
    }
  },
  memory_delete: {
    action: 'memory_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    forceExclusion: true,
    buildTitle: () => '删除记忆',
    buildMetadata: (args) => ({
      query: (args as GateArgs).query,
      message_id: (args as GateArgs).message_id
    }),
    prepare: async (args) => {
      const query = (args as GateArgs).query
      const messageId = (args as GateArgs).message_id
      return prepareContentGatePreview({
        subject: '删除记忆',
        detailLines: [
          typeof query === 'string' ? `查询：${query}` : null,
          typeof messageId === 'string' ? `消息：${messageId}` : null
        ].filter((line): line is string => Boolean(line))
      })
    }
  },
  workspace_write: {
    action: 'workspace_write',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      return typeof path === 'string' && path ? `写入文件 ${path}` : '写入工作区文件'
    },
    buildMetadata: (args) => ({
      path: (args as GateArgs).path,
      workspacePath: (args as GateArgs).path
    }),
    buildResources: workspacePathResources,
    buildAlwaysPatterns: () => ['*'],
    prepare: prepareWorkspaceWriteGate
  },
  workspace_patch: {
    action: 'workspace_patch',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      return typeof path === 'string' && path ? `修改文件 ${path}` : '修改工作区文件'
    },
    buildMetadata: (args) => ({
      path: (args as GateArgs).path,
      workspacePath: (args as GateArgs).path
    }),
    buildResources: workspacePathResources,
    buildAlwaysPatterns: () => ['*'],
    prepare: prepareWorkspacePatchGate
  },
  workspace_delete: {
    action: 'workspace_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      return typeof path === 'string' && path ? `删除文件 ${path}` : '删除工作区文件'
    },
    buildMetadata: (args) => ({
      path: (args as GateArgs).path,
      workspacePath: (args as GateArgs).path
    }),
    buildResources: workspacePathResources,
    buildAlwaysPatterns: () => ['*'],
    prepare: prepareWorkspaceDeleteGate
  },
  workspace_rename: {
    action: 'workspace_rename',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      const newPath = (args as GateArgs).new_path
      if (typeof path === 'string' && typeof newPath === 'string' && path && newPath) {
        return `重命名 ${path} → ${newPath}`
      }
      return '重命名工作区文件'
    },
    buildMetadata: (args) => ({
      path: (args as GateArgs).path,
      new_path: (args as GateArgs).new_path,
      workspacePath: (args as GateArgs).path
    }),
    buildResources: workspaceRenameResources,
    buildAlwaysPatterns: () => ['*'],
    prepare: prepareWorkspaceRenameGate
  },
  workspace_run: {
    action: 'workspace_run',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const command = (args as GateArgs).command
      if (typeof command === 'string' && command.trim()) {
        return `运行命令 ${truncateCommandTitle(command)}`
      }
      return '运行工作区命令'
    },
    buildMetadata: (args, ctx) => {
      const command = (args as GateArgs).command
      const workdir = (args as GateArgs).workdir
      const folderRoot = workspaceFolderRoot(ctx)
      const scan =
        typeof command === 'string' && folderRoot
          ? scanWorkspaceRunCommand({
              command,
              workdir: typeof workdir === 'string' ? workdir : undefined,
              folderRoot
            })
          : null
      return {
        shellCommand: typeof command === 'string' ? command : undefined,
        workdir: typeof workdir === 'string' ? workdir : undefined,
        prefixPattern: scan?.prefixPattern ?? undefined,
        ...(scan?.dangerous ? { forceExclusion: true } : {})
      }
    },
    buildResources: workspaceRunResources,
    buildAlwaysPatterns: (args, ctx) => {
      const command = (args as GateArgs).command
      const workdir = (args as GateArgs).workdir
      const folderRoot = workspaceFolderRoot(ctx)
      if (typeof command !== 'string' || !folderRoot) return []
      const scan = scanWorkspaceRunCommand({
        command,
        workdir: typeof workdir === 'string' ? workdir : undefined,
        folderRoot
      })
      return scan.prefixPattern ? [scan.prefixPattern] : []
    },
    prepare: async (args, ctx) => prepareWorkspaceRunGate(args, ctx)
  },
  external_directory: {
    action: 'external_directory',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      return typeof path === 'string' && path ? `访问区外目录 ${path}` : '访问区外目录'
    },
    buildAlwaysPatterns: (args, ctx) => {
      const resources = workspacePathResources(args, ctx)
      return collectExternalDirectoryGlobs(resources)
    }
  },
  graph_upsert: {
    action: 'graph_upsert',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: () => '写入记忆图谱',
    buildMetadata: (args) => {
      const summary = (args as GateArgs).summary
      const sourceRef = (args as GateArgs).source_ref
      return {
        preview: typeof summary === 'string' ? summary.slice(0, 160) : undefined,
        summary: typeof summary === 'string' ? summary : undefined,
        source_ref: typeof sourceRef === 'string' ? sourceRef : undefined,
        entities: (args as GateArgs).entities,
        edges: (args as GateArgs).edges
      }
    },
    prepare: async (args) => {
      const summary = (args as GateArgs).summary
      const entities = coerceJsonArray((args as GateArgs).entities)
      const edges = coerceJsonArray((args as GateArgs).edges)
      const entityCount = entities.length
      const edgeCount = edges.length
      const entityNames = entities
        .slice(0, 6)
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const name = (item as GateArgs).name
          return typeof name === 'string' ? name.trim() : null
        })
        .filter((n): n is string => Boolean(n))
      const edgeTypes = edges
        .slice(0, 6)
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const t = (item as GateArgs).type ?? (item as GateArgs).edgeType
          return typeof t === 'string' ? t.trim() : null
        })
        .filter((t): t is string => Boolean(t))
      return prepareContentGatePreview({
        subject: '写入记忆图谱',
        counts: { entities: entityCount, edges: edgeCount },
        detailLines: [
          typeof summary === 'string' ? `摘要：${summary.slice(0, 200)}` : null,
          `实体 ${entityCount} · 关系 ${edgeCount}`,
          entityNames.length
            ? `实体：${entityNames.join('、')}${entityCount > entityNames.length ? '…' : ''}`
            : null,
          edgeTypes.length
            ? `关系：${edgeTypes.join('、')}${edgeCount > edgeTypes.length ? '…' : ''}`
            : null
        ].filter((line): line is string => Boolean(line))
      })
    }
  }
}

export function resolveAgentGateToolMetadata(toolName: string): AgentGateToolMetadata | undefined {
  return AGENT_GATE_TOOL_METADATA[toolName]
}
