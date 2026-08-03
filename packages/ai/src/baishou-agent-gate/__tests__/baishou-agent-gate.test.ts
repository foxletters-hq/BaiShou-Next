import { describe, it, expect, vi } from 'vitest'
import {
  AgentGateEffect,
  AgentGateKind,
  AgentGateProfileId,
  AgentGateReply,
  AgentGateDeniedError,
  AgentGateAlwaysNotAllowedError,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateRejectedError,
  applyCapabilityStateToConfig,
  cloneBaishouAgentGateConfig,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
} from '@baishou/shared'
import { BaishouAgentGatePolicyService } from '../baishou-agent-gate-policy.service'
import { BaishouAgentGateAllowlistStore } from '../baishou-agent-gate-allowlist.store'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'

const baseAssertInput = {
  sessionId: 'sess_1',
  vaultName: 'Personal',
  kind: AgentGateKind.Tool,
  action: 'diary_edit',
  title: '编辑日记'
}

describe('BaishouAgentGatePolicyService', () => {
  it('manual 模式默认 ask', () => {
    const config = {
      exclusionList: ['diary_delete'],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit' })).toBe(AgentGateEffect.Ask)
  })

  it('full_trust 放行非排除动作', () => {
    const config = {
      exclusionList: ['diary_delete'],
      allowlist: [],
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit' })).toBe(AgentGateEffect.Allow)
  })

  it('排除列表在 full_trust 下仍 ask', () => {
    const config = {
      exclusionList: ['diary_delete'],
      allowlist: [],
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_delete' })).toBe(AgentGateEffect.Ask)
  })

  it('forceExclusion 动作在 allowlist 命中时仍 ask', () => {
    const config = {
      exclusionList: [],
      allowlist: [{ id: 'bagal_ws', action: 'workspace_delete', createdAt: 1 }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'workspace_delete' })).toBe(AgentGateEffect.Ask)
  })

  it('allowlist 命中则 allow', () => {
    const config = {
      exclusionList: [],
      allowlist: [{ id: 'bagal_1', action: 'diary_write', createdAt: 1 }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_write' })).toBe(AgentGateEffect.Allow)
  })

  it('disabled 工具 deny', () => {
    const config = {
      exclusionList: [],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit', toolDisabled: true })).toBe(AgentGateEffect.Deny)
  })

  it('legacy actionRules 仍生效', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      actionRules: { diary_edit: AgentGateEffect.Allow }
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'diary_edit' })).toBe(AgentGateEffect.Allow)
  })

  it('permissionRules 支持路径 pattern', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      permissionRules: [
        {
          action: 'workspace_write',
          pattern: 'src/**',
          effect: AgentGateEffect.Allow
        }
      ]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_write',
        resources: [{ kind: 'workspace_path', value: 'src/foo.ts' }]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_write',
        resources: [{ kind: 'workspace_path', value: 'docs/readme.md' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('permissionRules deny 优先于 full_trust', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      permissionRules: [
        { action: '*', effect: AgentGateEffect.Allow },
        {
          action: 'workspace_write',
          pattern: 'secrets/**',
          effect: AgentGateEffect.Deny
        }
      ]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_write',
        resources: [{ kind: 'workspace_path', value: 'secrets/key.pem' }]
      })
    ).toBe(AgentGateEffect.Deny)
  })

  it('force exclusion 在 allowlist 与 allow 规则下仍 ask', () => {
    const config = {
      exclusionList: [],
      allowlist: [{ id: 'bagal_ws', action: 'workspace_delete', createdAt: 1 }],
      permissionRules: [
        { action: '*', effect: AgentGateEffect.Allow },
        {
          action: 'workspace_delete',
          pattern: '**/*',
          effect: AgentGateEffect.Allow
        }
      ]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_delete',
        resources: [{ kind: 'workspace_path', value: 'src/foo.ts' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('外路径默认走 external_directory 询问', () => {
    const config = {
      exclusionList: [],
      allowlist: [{ id: 'bagal_1', action: 'workspace_write', createdAt: 1 }],
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'C:/Outside/**' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('外路径可被 external_directory Allow 规则放行', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      permissionRules: [
        {
          action: 'external_directory',
          pattern: 'C:/Allowed/**',
          effect: AgentGateEffect.Allow
        }
      ]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'C:/Allowed/**' }]
      })
    ).toBe(AgentGateEffect.Allow)
  })

  it('external_directory 整项 Allow 时区外目录放行', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      permissionRules: [{ action: 'external_directory', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: '/tmp/**' }]
      })
    ).toBe(AgentGateEffect.Allow)
  })

  it('external_directory Deny 时区外目录拒绝', () => {
    const config = {
      exclusionList: [],
      allowlist: [],
      permissionRules: [{ action: 'external_directory', effect: AgentGateEffect.Deny }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'C:/Outside/**' }]
      })
    ).toBe(AgentGateEffect.Deny)
  })

  it('能力矩阵可信区外目录放行匹配路径，未匹配仍询问；编辑仍询问', () => {
    const compiled = applyCapabilityStateToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'workspace',
      {
        effects: {
          browse: AgentGateEffect.Allow,
          edit: AgentGateEffect.Ask,
          delete: AgentGateEffect.Ask,
          command: AgentGateEffect.Ask,
          external: AgentGateEffect.Allow,
          diary_write: AgentGateEffect.Ask,
          diary_delete: AgentGateEffect.Ask,
          memory_store: AgentGateEffect.Ask,
          memory_delete: AgentGateEffect.Ask
        },
        trustedExternalDirs: ['D:/Notes']
      }
    )
    const allowlist = new BaishouAgentGateAllowlistStore(() => compiled)
    const policy = new BaishouAgentGatePolicyService(() => compiled, allowlist)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'D:/Notes/**' }]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_write',
        resources: [{ kind: 'external_path', value: 'D:/Notes/a.md' }]
      })
    ).toBe(AgentGateEffect.Ask)

    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'C:/Outside/**' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('G4 对抗：*: allow 打头时删除 / 命令 / 区外仍为 Ask', () => {
    const config = {
      exclusionList: ['workspace_delete'],
      allowlist: [],
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_delete',
        resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
      })
    ).toBe(AgentGateEffect.Ask)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git status' }]
      })
    ).toBe(AgentGateEffect.Ask)

    // *: allow 的 action-only 规则会匹配 external_directory；
    // FullTrust 不会放行该 action，但此处 Manual + * Allow 会命中。
    // 区外安全靠拦截器两道门 + 钳制不够，需显式禁止裸 * 放行 external_directory。
    // 当前：action-only Allow on * matches external_directory → Allow。
    // 对抗要求仍为 Ask：在 clamp 中对 external_directory 的 action-only * 放行压回？
    // 更干净：agentGatePermissionRuleMatches 对 external_directory 禁止 action-only Allow（与 workspace_run 对称）。
    expect(
      policy.evaluate({
        action: 'external_directory',
        resources: [{ kind: 'external_path', value: 'C:/Outside/**' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('G4 分层：宽泛 Ask 后的具体 Allow 可放行 git status', () => {
    const config = {
      exclusionList: ['workspace_delete'],
      allowlist: [],
      permissionRules: [
        { action: 'workspace_run', effect: AgentGateEffect.Ask },
        {
          action: 'workspace_run',
          pattern: 'git status *',
          effect: AgentGateEffect.Allow
        }
      ]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git status -s' }]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'rm -rf /' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('exclusion 上的显式 Deny 不再被吞成 Ask', () => {
    const config = {
      exclusionList: ['workspace_delete'],
      allowlist: [],
      permissionRules: [{ action: 'workspace_delete', effect: AgentGateEffect.Deny }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(policy.evaluate({ action: 'workspace_delete' })).toBe(AgentGateEffect.Deny)
  })
})

describe('BaishouAgentGateService', () => {
  it('assert 在 ask 时挂起，reply once 后继续', async () => {
    const { gate, eventBus } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const asked = vi.fn()
    eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.asked') asked(event.request.id)
    })

    let settled = false
    const pending = gate.assert(baseAssertInput).then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(asked).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    const [request] = gate.listPending('sess_1')
    expect(request?.action).toBe('diary_edit')

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
    expect(settled).toBe(true)
  })

  it('reply always 写入 allowlist 后同动作自动放行', async () => {
    const persist = vi.fn()
    const { gate, getConfig } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const first = gate.assert(baseAssertInput)
    const [request] = gate.listPending()
    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    await first

    expect(getConfig().allowlist.some((e) => e.action === 'diary_edit')).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)

    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
  })

  it('排除动作不能 always', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: ['diary_delete'],
        allowlist: []
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'diary_delete',
      title: '删除日记'
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('forceExclusion 元数据动作不能 always，即使不在 exclusionList', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_delete',
      title: '删除工作区文件',
      metadata: { forceExclusion: true }
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('默认排除的 workspace_delete 不能 always', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_delete',
      title: '删除工作区文件'
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('截断预览即使命中 allowlist 也强制 Ask，且拒绝 Always', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [{ id: 'bagal_write', action: 'workspace_write', createdAt: 1 }]
      }
    })

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入工作区文件',
      preview: {
        type: 'file_change',
        path: 'a.txt',
        kind: 'modify',
        diff: '...',
        additions: 1,
        deletions: 0,
        truncated: true
      }
    })
    const [request] = gate.listPending()
    expect(request).toBeTruthy()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('危险命令预览拒绝 Always', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert({
      ...baseAssertInput,
      action: 'workspace_run',
      title: '运行命令',
      preview: {
        type: 'command',
        command: 'rm -rf /',
        workdir: '.',
        dangerous: true
      }
    })
    const [request] = gate.listPending()

    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toBeInstanceOf(AgentGateAlwaysNotAllowedError)

    await gate.reply({ requestId: request!.id, reply: AgentGateReply.Once })
    await pending
  })

  it('reject 附带 message 时抛出 CorrectedError', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert(baseAssertInput).catch((e) => e)
    const [request] = gate.listPending()

    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Reject,
      message: '请先说明要改哪一段'
    })

    const error = await pending
    expect(error).toBeInstanceOf(AgentGateCorrectedError)
    expect((error as AgentGateCorrectedError).feedback).toBe('请先说明要改哪一段')
    expect((error as AgentGateCorrectedError).message).toContain('[用户纠正]')
    expect((error as AgentGateCorrectedError).message).toContain('请先说明要改哪一段')
  })

  it('deny 时不挂起直接失败', async () => {
    const { gate, policy } = createBaishouAgentGate()
    const evaluateDetailed = vi.spyOn(policy, 'evaluateDetailed').mockReturnValue({
      effect: AgentGateEffect.Deny,
      decisionSource: { layer: 'default', action: 'diary_edit', effect: AgentGateEffect.Deny }
    })

    await expect(gate.assert(baseAssertInput)).rejects.toBeInstanceOf(AgentGateDeniedError)
    expect(gate.listPending()).toHaveLength(0)
    evaluateDetailed.mockRestore()
  })

  it('cancelSession 取消挂起', async () => {
    const { gate } = createBaishouAgentGate()

    const pending = gate.assert(baseAssertInput).catch((e) => e)
    gate.cancelSession('sess_1', 'vault switch')

    const error = await pending
    expect(error).toBeInstanceOf(AgentGateCancelledError)
    expect(gate.listPending()).toHaveLength(0)
  })

  it('assertWithResolution 在 allow 时直接返回空 requestId', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    const resolution = await gate.assertWithResolution(baseAssertInput)
    expect(resolution.requestId).toBe('')
    expect(resolution.reply).toBe(AgentGateReply.Once)
    expect(gate.listPending()).toHaveLength(0)
  })

  it('assertWithResolution 返回选项与自定义消息', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const pending = gate.assertWithResolution({
      ...baseAssertInput,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '选哪个？',
      options: [
        { id: '0', label: 'A' },
        { id: '1', label: 'B' }
      ],
      allowCustomInput: true
    })

    const [request] = gate.listPending('sess_1')
    await gate.reply({
      requestId: request!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['1'],
      message: '备注'
    })

    const resolution = await pending
    expect(resolution.selectedOptionIds).toEqual(['1'])
    expect(resolution.message).toBe('备注')
    expect(resolution.reply).toBe(AgentGateReply.Once)
  })

  it('reject 级联取消同 session 其他挂起请求', async () => {
    const { gate } = createBaishouAgentGate()

    const first = gate.assert(baseAssertInput).catch((e) => e)
    const second = gate
      .assert({ ...baseAssertInput, action: 'diary_write', title: '写日记' })
      .catch((e) => e)

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(2)

    await gate.reply({
      requestId: pending[0]!.id,
      reply: AgentGateReply.Reject
    })

    const firstError = await first
    const secondError = await second
    expect(firstError).toBeInstanceOf(AgentGateRejectedError)
    expect(secondError).toBeInstanceOf(AgentGateRejectedError)
    expect(gate.listPending('sess_1')).toHaveLength(0)
  })

  it('always 级联放行同 session 同 action 的挂起请求', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert(baseAssertInput)
    const second = gate.assert({ ...baseAssertInput, title: '编辑日记 2' })
    const other = gate.assert({
      ...baseAssertInput,
      action: 'diary_write',
      title: '写日记'
    })

    const pending = gate.listPending('sess_1')
    expect(pending).toHaveLength(3)

    const diaryEditIds = pending.filter((r) => r.action === 'diary_edit').map((r) => r.id)
    await gate.reply({ requestId: diaryEditIds[0]!, reply: AgentGateReply.Always })

    await first
    await second
    expect(gate.listPending('sess_1')).toHaveLength(1)
    expect(gate.listPending('sess_1')[0]?.action).toBe('diary_write')

    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await other
  })

  it('always 不级联放行同 action 的截断预览 pending', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const normal = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写完整',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'modify',
        additions: 1,
        deletions: 0,
        contentDigest: 'full'
      }
    })
    const truncated = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写截断',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'modify',
        additions: 1,
        deletions: 0,
        truncated: true,
        contentDigest: 'cut'
      }
    })

    const pending = gate.listPending('sess_1')
    const normalReq = pending.find((r) => r.title === '写完整')
    expect(normalReq).toBeTruthy()
    await gate.reply({ requestId: normalReq!.id, reply: AgentGateReply.Always })
    await normal

    const stillPending = gate.listPending('sess_1')
    expect(stillPending).toHaveLength(1)
    expect(stillPending[0]?.title).toBe('写截断')

    await gate.reply({ requestId: stillPending[0]!.id, reply: AgentGateReply.Once })
    await truncated
  })

  it('always 不级联放行同 action 的外路径 pending', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const internal = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写内部',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
    })
    const external = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写外部',
      resources: [{ kind: 'external_path', value: 'C:/Outside/x.txt' }]
    })

    const pending = gate.listPending('sess_1')
    const internalReq = pending.find((r) => r.title === '写内部')
    expect(internalReq).toBeTruthy()
    await gate.reply({ requestId: internalReq!.id, reply: AgentGateReply.Always })
    await internal

    const stillPending = gate.listPending('sess_1')
    expect(stillPending).toHaveLength(1)
    expect(stillPending[0]?.title).toBe('写外部')

    await gate.reply({ requestId: stillPending[0]!.id, reply: AgentGateReply.Once })
    await external
  })

  it('always persist 失败时 assert 仍能 settle', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('disk full'))
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      persistConfig: persist
    })

    const pendingAssert = gate.assert(baseAssertInput)
    const [request] = gate.listPending('sess_1')
    await expect(
      gate.reply({ requestId: request!.id, reply: AgentGateReply.Always })
    ).rejects.toThrow('disk full')
    await expect(pendingAssert).resolves.toBeUndefined()
  })

  it('同指纹连续第 3 次即使 full_trust 也强制 ask', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        repeatAssertAskThreshold: 3,
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()

    let settled = false
    const third = gate.assert(baseAssertInput).then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(gate.listPending('sess_1')).toHaveLength(1)

    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await third
    expect(settled).toBe(true)
  })

  it('repeatAssertAskThreshold=0 关闭连打强制 ask', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        repeatAssertAskThreshold: 0,
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
    await expect(gate.assert(baseAssertInput)).resolves.toBeUndefined()
    expect(gate.listPending()).toHaveLength(0)
  })

  it('reject 级联时同 session 其它请求也带 CorrectedError', async () => {
    const { gate } = createBaishouAgentGate()

    const first = gate.assert(baseAssertInput).catch((e) => e)
    const second = gate
      .assert({ ...baseAssertInput, action: 'diary_write', title: '写日记' })
      .catch((e) => e)

    const pending = gate.listPending('sess_1')
    await gate.reply({
      requestId: pending[0]!.id,
      reply: AgentGateReply.Reject,
      message: '先别改'
    })

    const firstError = await first
    const secondError = await second
    expect(firstError).toBeInstanceOf(AgentGateCorrectedError)
    expect(secondError).toBeInstanceOf(AgentGateCorrectedError)
    expect((secondError as AgentGateCorrectedError).feedback).toBe('先别改')
  })
})

describe('Agent Gate profile + probeEffect', () => {
  it('companion profile denies workspace actions', () => {
    const { policy } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    expect(
      policy.evaluate({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Deny)
  })

  it('workspace profile denies diary and graph_upsert', () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })

    expect(
      gate.probeEffect({
        action: 'diary_edit',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Deny)
    expect(
      gate.probeEffect({
        action: 'graph_upsert',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Deny)
    expect(
      gate.probeEffect({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Allow)
  })

  it('companion profile does not force Ask for recall_relations (G1.d / G-D4)', () => {
    // recall_relations 无 Gate metadata → 拦截器直接放行；此处断言 companion 规则也未对其设 Ask
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      }
    })
    expect(
      gate.probeEffect({
        action: 'recall_relations',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Allow)
  })
})

describe('scoped gate config isolation', () => {
  it('companion FullTrust allowlist does not affect a separate workspace gate instance', async () => {
    const companion = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: [{ id: 'c1', action: 'diary_write', createdAt: 1 }],
        permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
      },
      configScope: { kind: 'companion' }
    })
    const workspace = createBaishouAgentGate({
      config: {
        exclusionList: ['workspace_delete'],
        allowlist: []
      },
      configScope: { kind: 'workspace', workspaceId: 'ws-a' }
    })

    expect(
      companion.policy.evaluate({
        action: 'diary_write',
        profileId: AgentGateProfileId.Companion
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      workspace.policy.evaluate({
        action: 'workspace_write',
        profileId: AgentGateProfileId.Workspace
      })
    ).toBe(AgentGateEffect.Ask)

    expect(workspace.getConfig().allowlist).toEqual([])
    expect(companion.getConfig().allowlist).toHaveLength(1)
  })

  it('publishes allowlist_changed with configScope', async () => {
    const events: Array<{ type: string; scope?: unknown }> = []
    const { gate, eventBus } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      },
      configScope: { kind: 'workspace', workspaceId: 'ws-b' }
    })
    eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.allowlist_changed') {
        events.push(event)
      }
    })

    const assertPromise = gate.assert({
      sessionId: 's1',
      vaultName: 'Personal',
      kind: AgentGateKind.Tool,
      action: 'workspace_write',
      title: 'write',
      profileId: AgentGateProfileId.Workspace
    })
    await Promise.resolve()
    const pending = gate.listPending('s1')[0]
    expect(pending).toBeTruthy()
    await gate.reply({ requestId: pending!.id, reply: AgentGateReply.Always })
    await assertPromise

    expect(
      events.some((e) => (e as { scope?: { kind: string } }).scope?.kind === 'workspace')
    ).toBe(true)
  })
})

describe('BaishouAgentGateAllowlistStore', () => {
  it('add 重复动作不重复写入，remove 后可 persist', async () => {
    const persist = vi.fn()
    const config = {
      exclusionList: [],
      allowlist: [] as { id: string; action: string; createdAt: number }[]
    }
    const store = new BaishouAgentGateAllowlistStore(() => config, persist)

    const first = store.add({ action: 'diary_edit' })
    const second = store.add({ action: 'diary_edit' })
    expect(first.id).toBe(second.id)
    expect(config.allowlist).toHaveLength(1)

    await store.persist()
    expect(persist).toHaveBeenCalledTimes(1)

    expect(store.remove(first.id)).toBe(true)
    expect(config.allowlist).toHaveLength(0)
    await store.persist()
    expect(persist).toHaveBeenCalledTimes(2)
  })
})
