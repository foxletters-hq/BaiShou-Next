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

describe('BaishouAgentGate auto_review risk classifier', () => {
  const workspaceAllowEditConfig = applyWorkspaceSecurityModeToConfig(
    cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
    'auto_review'
  )

  it('asks when classifier returns ask for command', async () => {
    const classifier = vi.fn(async () => ({
      verdict: 'ask' as const,
      reason: '可能执行破坏性命令'
    }))
    const { gate } = createBaishouAgentGate({
      config: workspaceAllowEditConfig,
      riskClassifier: classifier
    })

    const pending = gate.assert({
      sessionId: 'sess_ar',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_run',
      title: '运行命令',
      preview: { type: 'command', command: 'npm test' },
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    const [request] = gate.listPending()
    expect(classifier).toHaveBeenCalled()
    expect(request?.description).toContain('可能执行破坏性命令')
    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('allows when classifier returns allow for command', async () => {
    const classifier = vi.fn(async () => ({ verdict: 'allow' as const }))
    const { gate } = createBaishouAgentGate({
      config: workspaceAllowEditConfig,
      riskClassifier: classifier
    })

    await gate.assert({
      sessionId: 'sess_ar2',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_run',
      title: '运行命令',
      preview: { type: 'command', command: 'npm test' },
      profileId: AgentGateProfileId.Workspace
    })
    expect(classifier).toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(0)
  })

  it('skips classifier for routine workspace_write', async () => {
    const classifier = vi.fn(async () => ({ verdict: 'ask' as const }))
    const { gate } = createBaishouAgentGate({
      config: workspaceAllowEditConfig,
      riskClassifier: classifier
    })

    await gate.assert({
      sessionId: 'sess_ar_edit',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_write',
      title: '写入文件',
      profileId: AgentGateProfileId.Workspace
    })
    expect(classifier).not.toHaveBeenCalled()
    expect(gate.listPending()).toHaveLength(0)
  })

  it('skips classifier for workspace_read', async () => {
    const classifier = vi.fn(async () => ({ verdict: 'ask' as const }))
    const { gate } = createBaishouAgentGate({
      config: workspaceAllowEditConfig,
      riskClassifier: classifier
    })

    await gate.assert({
      sessionId: 'sess_ar3',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_read',
      title: '读取文件',
      profileId: AgentGateProfileId.Workspace
    })
    expect(classifier).not.toHaveBeenCalled()
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
})
