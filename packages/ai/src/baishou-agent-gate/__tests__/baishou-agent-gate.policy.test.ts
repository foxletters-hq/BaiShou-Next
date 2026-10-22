import { describe, expect, it } from 'vitest'
import {
  AgentGateEffect,
  applyCapabilityStateToConfig,
  applyWorkspaceSecurityModeToConfig,
  cloneBaishouAgentGateConfig,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
} from '@baishou/shared'
import { BaishouAgentGatePolicyService } from '../baishou-agent-gate-policy.service'
import { BaishouAgentGateAllowlistStore } from '../baishou-agent-gate-allowlist.store'

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

  it('Safe 风险未匹配规则时默认 allow', () => {
    const config = {
      exclusionList: [],
      allowlist: []
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'diary_read',
        metadata: { riskLevel: 'safe' }
      })
    ).toBe(AgentGateEffect.Allow)
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

    expect(
      policy.evaluate({
        action: 'workspace_delete',
        metadata: { forceExclusion: true }
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('workspace_delete allowlist 命中后放行', () => {
    const config = {
      exclusionList: [],
      allowlist: [{ id: 'bagal_ws', action: 'workspace_delete', createdAt: 1 }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_delete',
        metadata: { riskLevel: 'destructive' }
      })
    ).toBe(AgentGateEffect.Allow)
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
        resources: [{ kind: 'workspace_path', value: 'src/foo.ts' }],
        metadata: { forceExclusion: true }
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
      exclusionList: [],
      allowlist: [],
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    }
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_delete',
        resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
        metadata: { riskLevel: 'destructive' }
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

  it('full_access 安全模式下普通命令直接 Allow，命中黑名单仍为 Ask', () => {
    const config = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'full_access'
    )
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git status' }]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [
          {
            kind: 'shell_command',
            value:
              '"=== python 一行脚本 ==="; python -c "import platform,sys; print(\'py ok\')"; "=== node 一行脚本 ==="; node -e "console.log(\'node ok\')"'
          }
        ]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git reset --hard HEAD~1' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })

  it('组合命令在每段都命中白名单时自动 Allow，只要有一段未命中则 Ask', () => {
    const config = applyWorkspaceSecurityModeToConfig(
      cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG),
      'allow_list'
    )
    config.allowlist = [
      {
        id: 'bagal_git_status',
        action: 'workspace_run',
        pattern: 'git status *',
        resourceKind: 'shell_command',
        createdAt: 1
      },
      {
        id: 'bagal_pnpm_test',
        action: 'workspace_run',
        pattern: 'pnpm test *',
        resourceKind: 'shell_command',
        createdAt: 2
      }
    ]
    const allowlist = new BaishouAgentGateAllowlistStore(() => config)
    const policy = new BaishouAgentGatePolicyService(() => config, allowlist)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [
          { kind: 'shell_command', value: 'cd packages/ai && git status -s && pnpm test' }
        ]
      })
    ).toBe(AgentGateEffect.Allow)

    expect(
      policy.evaluate({
        action: 'workspace_run',
        resources: [{ kind: 'shell_command', value: 'git status -s && pnpm publish' }]
      })
    ).toBe(AgentGateEffect.Ask)
  })
})
