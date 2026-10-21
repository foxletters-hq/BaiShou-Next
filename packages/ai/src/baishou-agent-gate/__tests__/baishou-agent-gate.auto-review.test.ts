import { describe, expect, it, vi } from 'vitest'
import {
  AgentGateKind,
  AgentGateProfileId,
  AgentGateReply,
  applyWorkspaceSecurityModeToConfig,
  cloneBaishouAgentGateConfig,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
} from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'

describe('BaishouAgentGate workspace security modes (allow_list vs full_access, no LLM auto-review)', () => {
  it('allow_list asks for workspace_run and never invokes riskClassifier', async () => {
    const allowListConfig = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'allow_list'
    )
    const classifier = vi.fn(async () => ({ verdict: 'allow' as const }))
    const { gate } = createBaishouAgentGate({
      config: allowListConfig,
      riskClassifier: classifier
    })

    const pending = gate.assert({
      sessionId: 'sess_al_cmd',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_run',
      title: '运行命令',
      preview: { type: 'command', command: 'npm test' },
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    expect(classifier).not.toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(1)
    await gate.reply({ requestId: gate.listPending()[0]!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('allow_list still asks for workspace_write', async () => {
    const allowListConfig = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'allow_list'
    )
    const classifier = vi.fn(async () => ({ verdict: 'allow' as const }))
    const { gate } = createBaishouAgentGate({
      config: allowListConfig,
      riskClassifier: classifier
    })

    const pending = gate.assert({
      sessionId: 'sess_al',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_write',
      title: '写入文件',
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    expect(classifier).not.toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(1)
    await gate.reply({ requestId: gate.listPending()[0]!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('full_access allows non-blacklisted workspace_run without calling classifier', async () => {
    const fullAccessConfig = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'full_access'
    )
    const classifier = vi.fn(async () => ({ verdict: 'ask' as const }))
    const { gate } = createBaishouAgentGate({
      config: fullAccessConfig,
      riskClassifier: classifier
    })

    await gate.assert({
      sessionId: 'sess_fa',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_run',
      title: '运行命令',
      preview: { type: 'command', command: 'pnpm test' },
      resources: [{ kind: 'shell_command', value: 'pnpm test' }],
      profileId: AgentGateProfileId.Workspace
    })
    expect(classifier).not.toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(0)
  })

  it('full_access still asks when workspace_run matches commandBlacklist', async () => {
    const fullAccessConfig = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'full_access'
    )
    const classifier = vi.fn(async () => ({ verdict: 'allow' as const }))
    const { gate } = createBaishouAgentGate({
      config: fullAccessConfig,
      riskClassifier: classifier
    })

    const pending = gate.assert({
      sessionId: 'sess_fa_bl',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_run',
      title: '运行命令',
      preview: { type: 'command', command: 'git push --force origin main' },
      resources: [{ kind: 'shell_command', value: 'git push --force origin main' }],
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    expect(classifier).not.toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(1)
    await gate.reply({ requestId: gate.listPending()[0]!.id, reply: AgentGateReply.Once })
    await pending
  })
})
