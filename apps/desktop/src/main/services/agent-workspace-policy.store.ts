import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  AGENT_WORKSPACE_POLICY_STORE_FILE,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG,
  cloneBaishouAgentGateConfig,
  cloneWorkspaceToolManagementConfig,
  inferWorkspacePresets,
  sortPermissionRulesForLastMatch,
  type AgentWorkspacePolicy,
  type BaishouAgentGateConfig,
  type WorkspaceToolManagementConfig
} from '@baishou/shared'

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

function migrateGateConfigV1ToV2(config: BaishouAgentGateConfig): BaishouAgentGateConfig {
  const cloned = cloneBaishouAgentGateConfig(config, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
  if (cloned.permissionRules?.length) {
    cloned.permissionRules = sortPermissionRulesForLastMatch(cloned.permissionRules)
  }
  // 旧 FullTrust 已由 clone 迁成 `*: allow`；反推审批预设
  if (!cloned.scopePreset || !cloned.approvalPreset) {
    const inferred = inferWorkspacePresets(cloned)
    cloned.scopePreset = inferred.scopePreset
    cloned.approvalPreset = inferred.approvalPreset
  }
  return cloned
}

async function loadStore(): Promise<WorkspacePolicyFile> {
  if (cache) return cache
  try {
    const file = storePath()
    const raw = await fs.readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as WorkspacePolicyFile
    const byWorkspaceId =
      parsed?.byWorkspaceId && typeof parsed.byWorkspaceId === 'object'
        ? parsed.byWorkspaceId
        : {}

    if (parsed?.version === 2) {
      cache = { version: 2, byWorkspaceId }
      return cache
    }

    // v1 → v2：排序规则 + 反推预设，并写 .bak
    try {
      await fs.copyFile(file, `${file}.bak`)
    } catch {
      // ignore backup failure
    }

    const migrated: Record<string, AgentWorkspacePolicy> = {}
    for (const [id, policy] of Object.entries(byWorkspaceId)) {
      migrated[id] = {
        ...policy,
        workspaceId: id,
        gateConfig: migrateGateConfigV1ToV2(policy.gateConfig),
        toolManagement: cloneWorkspaceToolManagementConfig(policy.toolManagement),
        updatedAt: policy.updatedAt ?? new Date().toISOString()
      }
    }
    cache = { version: 2, byWorkspaceId: migrated }
    await saveStore()
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
  return {
    workspaceId,
    gateConfig: cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    toolManagement: cloneWorkspaceToolManagementConfig(DEFAULT_WORKSPACE_TOOL_MANAGEMENT_CONFIG),
    updatedAt: new Date().toISOString()
  }
}

function normalizePolicy(
  workspaceId: string,
  raw?: AgentWorkspacePolicy | null
): AgentWorkspacePolicy {
  if (!raw) return buildDefaultPolicy(workspaceId)
  return {
    workspaceId,
    gateConfig: cloneBaishouAgentGateConfig(raw.gateConfig, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    toolManagement: cloneWorkspaceToolManagementConfig(raw.toolManagement),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  }
}

/** 读取工作区策略；不存在时返回安全默认值（不自动落盘） */
export async function getWorkspacePolicy(workspaceId: string): Promise<AgentWorkspacePolicy> {
  const store = await loadStore()
  return normalizePolicy(workspaceId, store.byWorkspaceId[workspaceId])
}

export async function getWorkspaceGateConfig(workspaceId: string): Promise<BaishouAgentGateConfig> {
  return (await getWorkspacePolicy(workspaceId)).gateConfig
}

export async function getWorkspaceToolManagement(
  workspaceId: string
): Promise<WorkspaceToolManagementConfig> {
  return (await getWorkspacePolicy(workspaceId)).toolManagement
}

export async function setWorkspacePolicy(
  workspaceId: string,
  patch: {
    gateConfig?: BaishouAgentGateConfig
    toolManagement?: WorkspaceToolManagementConfig
  }
): Promise<AgentWorkspacePolicy> {
  const store = await loadStore()
  const current = normalizePolicy(workspaceId, store.byWorkspaceId[workspaceId])
  const next: AgentWorkspacePolicy = {
    workspaceId,
    gateConfig: patch.gateConfig
      ? cloneBaishouAgentGateConfig(patch.gateConfig, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)
      : current.gateConfig,
    toolManagement: patch.toolManagement
      ? cloneWorkspaceToolManagementConfig(patch.toolManagement)
      : current.toolManagement,
    updatedAt: new Date().toISOString()
  }
  store.byWorkspaceId[workspaceId] = next
  await saveStore()
  return next
}

export async function setWorkspaceGateConfig(
  workspaceId: string,
  gateConfig: BaishouAgentGateConfig
): Promise<BaishouAgentGateConfig> {
  return (await setWorkspacePolicy(workspaceId, { gateConfig })).gateConfig
}

export async function setWorkspaceToolManagement(
  workspaceId: string,
  toolManagement: WorkspaceToolManagementConfig
): Promise<WorkspaceToolManagementConfig> {
  return (await setWorkspacePolicy(workspaceId, { toolManagement })).toolManagement
}

/** 测试 / Vault 重置时清空内存缓存（不删磁盘文件） */
export function resetWorkspacePolicyCache(): void {
  cache = null
}
