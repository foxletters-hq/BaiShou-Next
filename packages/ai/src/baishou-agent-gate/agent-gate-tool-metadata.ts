import {
  AgentGateRiskLevel,
  type AgentGateResourceRef,
  type AgentGateToolMetadata
} from '@baishou/shared'
import { classifyWorkspacePathForGate } from './agent-gate-workspace-path.util'

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

/** Default gate metadata for mutating diary / memory tools */
export const AGENT_GATE_TOOL_METADATA: Readonly<Record<string, AgentGateToolMetadata>> = {
  diary_write: {
    action: 'diary_write',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => diaryDateTitle('创建日记', args),
    buildMetadata: (args) => ({ date: (args as GateArgs).date })
  },
  diary_edit: {
    action: 'diary_edit',
    riskLevel: AgentGateRiskLevel.Mutating,
    buildTitle: (args) => diaryDateTitle('编辑日记', args),
    buildMetadata: (args) => ({
      date: (args as GateArgs).date,
      mode: (args as GateArgs).mode
    })
  },
  diary_delete: {
    action: 'diary_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    forceExclusion: true,
    buildTitle: (args) => diaryDateTitle('删除日记', args),
    buildMetadata: (args) => ({ date: (args as GateArgs).date })
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
    })
  },
  memory_delete: {
    action: 'memory_delete',
    riskLevel: AgentGateRiskLevel.Destructive,
    forceExclusion: true,
    buildTitle: () => '删除记忆',
    buildMetadata: (args) => ({
      query: (args as GateArgs).query,
      message_id: (args as GateArgs).message_id
    })
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
    buildResources: workspacePathResources
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
    buildResources: workspacePathResources
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
    buildResources: workspacePathResources
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
    buildResources: workspaceRenameResources
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
    }
  }
}

export function resolveAgentGateToolMetadata(toolName: string): AgentGateToolMetadata | undefined {
  return AGENT_GATE_TOOL_METADATA[toolName]
}
