import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  AGENT_WORKSPACE_POLICY_STORE_FILE,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG,
  cloneBaishouAgentGateConfig,
  cloneWorkspaceToolManagementConfig,
  applyWorkspacePolicyPatch,
  resolveWorkspacePolicyFields,
  type AgentWorkspacePolicy,
  type BaishouAgentGateConfig,
  type WorkspaceToolManagementConfig
} from '@baishou/shared'
import {
  getGlobalWorkspaceGateConfig,
  setGlobalWorkspaceGateConfig
} from './workspace-agent-gate.store'

interface WorkspacePolicyFile {
  version: 1 | 2
  byWorkspaceId: Record<string, AgentWorkspacePolicy>
}

let cache: WorkspacePolicyFile | null = null

function storePath(): string {
  return path.join(app.getPath('userData'), AGENT_WORKSPACE_POLICY_STORE_FILE)
}

function emptyStore(): WorkspacePolicyFile {
  return { version: 2, byWorkspaceId: {} }
}

async function loadStore(): Promise<WorkspacePolicyFile> {
  if (cache) return cache
  try {
    const file = storePath()
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as WorkspacePolicyFile
    const byWorkspaceId =
      parsed?.byWorkspaceId && typeof parsed.byWorkspaceId === 'object' ? parsed.byWorkspaceId : {}
    // 旧 per-workspace gateConfig 直接丢弃，只保留 toolManagement
    const normalized: Record<string, AgentWorkspacePolicy> = {}
    for (const [id, policy] of Object.entries(byWorkspaceId)) {
      const fields = resolveWorkspacePolicyFields(policy)
      normalized[id] = {
        workspaceId: id,
        gateConfig: cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
        toolManagement: fields.toolManagement,
        personalMemoryReadEnabled: fields.personalMemoryReadEnabled,
        updatedAt: policy?.updatedAt ?? new Date().toISOString()
      }
    }
    cache = { version: 2, byWorkspaceId: normalized }
    return cache
  } catch {
    cache = emptyStore()
  }
  return cache
}

async function saveStore(): Promise<void> {
  if (!cache) return
  cache.version = 2
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(cache, null, 2), 'utf-8')
}

function buildDefaultPolicy(workspaceId: string): AgentWorkspacePolicy {
  const fields = resolveWorkspacePolicyFields({
    toolManagement: DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG
  })
  return {
    workspaceId,
    gateConfig: cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    toolManagement: fields.toolManagement,
    personalMemoryReadEnabled: fields.personalMemoryReadEnabled,
    updatedAt: new Date().toISOString()
  }
}

function normalizePolicy(
  workspaceId: string,
  raw?: AgentWorkspacePolicy | null
): AgentWorkspacePolicy {
  if (!raw) return buildDefaultPolicy(workspaceId)
  const fields = resolveWorkspacePolicyFields(raw)
  return {
    workspaceId,
    // gate 已全局化；磁盘上的 per-workspace gateConfig 忽略
    gateConfig: cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    toolManagement: fields.toolManagement,
    personalMemoryReadEnabled: fields.personalMemoryReadEnabled,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  }
}

/** 读取工作区策略；gate 返回占位默认（真实 gate 走 getWorkspaceGateConfig → 全局） */
export async function getWorkspacePolicy(workspaceId: string): Promise<AgentWorkspacePolicy> {
  const store = await loadStore()
  return normalizePolicy(workspaceId, store.byWorkspaceId[workspaceId])
}

/** 工作台门控：全局一份（workspaceId 仅保留 API 兼容） */
export async function getWorkspaceGateConfig(
  _workspaceId?: string
): Promise<BaishouAgentGateConfig> {
  return getGlobalWorkspaceGateConfig()
}

export async function getWorkspaceToolManagement(
  workspaceId: string
): Promise<WorkspaceToolManagementConfig> {
  return (await getWorkspacePolicy(workspaceId)).toolManagement
}

export async function getWorkspacePersonalMemoryRead(workspaceId: string): Promise<boolean> {
  return (await getWorkspacePolicy(workspaceId)).personalMemoryReadEnabled
}

export async function setWorkspacePolicy(
  workspaceId: string,
  patch: {
    gateConfig?: BaishouAgentGateConfig
    toolManagement?: WorkspaceToolManagementConfig
    personalMemoryReadEnabled?: boolean
  }
): Promise<AgentWorkspacePolicy> {
  if (patch.gateConfig) {
    await setGlobalWorkspaceGateConfig(patch.gateConfig)
  }
  const store = await loadStore()
  const current = normalizePolicy(workspaceId, store.byWorkspaceId[workspaceId])
  const fields = applyWorkspacePolicyPatch(current, {
    toolManagement: patch.toolManagement,
    personalMemoryReadEnabled: patch.personalMemoryReadEnabled
  })
  const next: AgentWorkspacePolicy = {
    workspaceId,
    gateConfig: cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    toolManagement: fields.toolManagement,
    personalMemoryReadEnabled: fields.personalMemoryReadEnabled,
    updatedAt: new Date().toISOString()
  }
  store.byWorkspaceId[workspaceId] = next
  await saveStore()
  // 对外仍返回当前全局 gate，避免调用方读到空占位
  if (patch.gateConfig) {
    next.gateConfig = await getGlobalWorkspaceGateConfig()
  }
  return next
}

export async function setWorkspaceGateConfig(
  _workspaceId: string | undefined,
  gateConfig: BaishouAgentGateConfig
): Promise<BaishouAgentGateConfig> {
  return setGlobalWorkspaceGateConfig(gateConfig)
}

export async function setWorkspaceToolManagement(
  workspaceId: string,
  toolManagement: WorkspaceToolManagementConfig
): Promise<WorkspaceToolManagementConfig> {
  return (await setWorkspacePolicy(workspaceId, { toolManagement })).toolManagement
}

export async function setWorkspacePersonalMemoryRead(
  workspaceId: string,
  enabled: boolean
): Promise<boolean> {
  return (await setWorkspacePolicy(workspaceId, { personalMemoryReadEnabled: enabled }))
    .personalMemoryReadEnabled
}

/** 测试 / Vault 重置时清空内存缓存（不删磁盘文件） */
export function resetWorkspacePolicyCache(): void {
  cache = null
}
