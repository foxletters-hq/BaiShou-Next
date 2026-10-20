import { describe, expect, it } from 'vitest'
import { AgentGateKind, AgentGateReply } from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate.service'
import { baseAssertInput } from './baishou-agent-gate.test-helpers'

describe('BaishouAgentGateService', () => {
  it('should allow patch after once on write in the same turn', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入文件',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'create',
        additions: 1,
        deletions: 0
      }
    })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await first

    await expect(
      gate.assert({
        ...baseAssertInput,
        action: 'workspace_patch',
        title: '补丁文件',
        resources: [{ kind: 'workspace_path', value: 'src/b.ts' }],
        preview: {
          type: 'file_change',
          path: 'src/b.ts',
          kind: 'modify',
          additions: 2,
          deletions: 1
        }
      })
    ).resolves.toBeUndefined()
    expect(gate.listPending('sess_1')).toHaveLength(0)
  })

  it('should allow a later truncated write after once in the same turn', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入文件',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }],
      preview: {
        type: 'file_change',
        path: 'src/a.ts',
        kind: 'create',
        additions: 1,
        deletions: 0
      }
    })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await first

    await expect(
      gate.assert({
        ...baseAssertInput,
        action: 'workspace_write',
        title: '写入大文件',
        resources: [{ kind: 'workspace_path', value: 'src/big.ts' }],
        preview: {
          type: 'file_change',
          path: 'src/big.ts',
          kind: 'modify',
          additions: 80,
          deletions: 12,
          truncated: true
        }
      })
    ).resolves.toBeUndefined()
    expect(gate.listPending('sess_1')).toHaveLength(0)
  })

  it('should still ask delete after once on write', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_write',
      title: '写入文件',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
    })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await first

    const remove = gate.assert({
      ...baseAssertInput,
      action: 'workspace_delete',
      title: '删除文件',
      resources: [{ kind: 'workspace_path', value: 'src/a.ts' }]
    })
    await Promise.resolve()
    expect(gate.listPending('sess_1')).toHaveLength(1)
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await remove
  })

  it('workspace_run 的 once 只放行同类命令前缀', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assert({
      ...baseAssertInput,
      action: 'workspace_run',
      title: '运行命令',
      resources: [{ kind: 'shell_command', value: 'npm test' }],
      preview: { type: 'command', command: 'npm test', prefixPattern: 'npm test *' },
      metadata: { alwaysPatterns: ['npm test *'] }
    })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await first

    await expect(
      gate.assert({
        ...baseAssertInput,
        action: 'workspace_run',
        title: '再跑测试',
        resources: [{ kind: 'shell_command', value: 'npm test --watch' }],
        preview: { type: 'command', command: 'npm test --watch', prefixPattern: 'npm test *' },
        metadata: { alwaysPatterns: ['npm test *'] }
      })
    ).resolves.toBeUndefined()

    const otherCommand = gate.assert({
      ...baseAssertInput,
      action: 'workspace_run',
      title: '其他命令',
      resources: [{ kind: 'shell_command', value: 'git status' }],
      preview: { type: 'command', command: 'git status', prefixPattern: 'git status *' },
      metadata: { alwaysPatterns: ['git status *'] }
    })
    await Promise.resolve()
    expect(gate.listPending('sess_1')).toHaveLength(1)
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await otherCommand
  })

  it('proactive once 不记住本轮工具放行', async () => {
    const { gate } = createBaishouAgentGate({
      config: {
        exclusionList: [],
        allowlist: []
      }
    })

    const first = gate.assertWithResolution({
      ...baseAssertInput,
      kind: AgentGateKind.Proactive,
      action: 'companion_ask',
      title: '选哪个？',
      options: [{ id: '0', label: 'A' }]
    })
    await Promise.resolve()
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: ['0']
    })
    await first

    const second = gate.assert({
      ...baseAssertInput,
      action: 'url_read',
      title: '读取网页'
    })
    await Promise.resolve()
    expect(gate.listPending('sess_1')).toHaveLength(1)
    await gate.reply({
      requestId: gate.listPending('sess_1')[0]!.id,
      reply: AgentGateReply.Once
    })
    await second
  })
})
