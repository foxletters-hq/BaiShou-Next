import {
  AgentGateRiskLevel,
  type AgentGateResourceRef,
  type AgentGateToolMetadata
} from '@baishou/shared'
import { classifyWorkspacePathForGate } from './agent-gate-workspace-path.util'
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
        summary: typeof date === 'string' ? `日期 ${date}` : undefined,
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
        summary:
          typeof date === 'string'
            ? `日期 ${date}${typeof mode === 'string' ? ` · ${mode}` : ''}`
            : undefined,
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
        summary: typeof date === 'string' ? `将删除 ${date} 的日记` : '将删除日记',
        detailLines: typeof date === 'string' ? [`日期：${date}`] : undefined
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
        summary: content.slice(0, 160) || undefined,
        detailLines: content ? [content.slice(0, 400)] : undefined
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
        summary: typeof query === 'string' ? query.slice(0, 120) : undefined,
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
    prepare: prepareWorkspacePatchGate
  },
  workspace_delete: {
    action: 'workspace_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    forceExclusion: true,
    buildTitle: (args) => {
      const path = (args as GateArgs).path
      return typeof path === 'string' && path ? `删除文件 ${path}` : '删除工作区文件'
    },
    buildMetadata: (args) => ({
      path: (args as GateArgs).path,
      workspacePath: (args as GateArgs).path
    }),
    buildResources: workspacePathResources,
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
    prepare: async (args, ctx) => prepareWorkspaceRunGate(args, ctx)
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
      const entities = (args as GateArgs).entities
      const edges = (args as GateArgs).edges
      const entityCount = Array.isArray(entities) ? entities.length : 0
      const edgeCount = Array.isArray(edges) ? edges.length : 0
      return prepareContentGatePreview({
        subject: '写入记忆图谱',
        summary: typeof summary === 'string' ? summary.slice(0, 160) : undefined,
        counts: { entities: entityCount, edges: edgeCount },
        detailLines: [
          typeof summary === 'string' ? `摘要：${summary.slice(0, 200)}` : null,
          `实体 ${entityCount} · 关系 ${edgeCount}`
        ].filter((line): line is string => Boolean(line))
      })
    }
  }
}

export function resolveAgentGateToolMetadata(toolName: string): AgentGateToolMetadata | undefined {
  return AGENT_GATE_TOOL_METADATA[toolName]
}
