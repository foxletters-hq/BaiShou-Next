import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

describe('mobile settings mcp custom client chrome', () => {
  it('should wire outbound/custom tabs, device config, and chat extra tools', () => {
    const section = readFileSync(join(dir, '..', 'components', 'McpSettingsSection.tsx'), 'utf8')
    const custom = readFileSync(
      join(dir, '..', 'components', 'McpClientServersSection.tsx'),
      'utf8'
    )
    const card = readFileSync(join(dir, '..', 'components', 'McpClientServerCard.tsx'), 'utf8')
    const form = readFileSync(join(dir, '..', 'components', 'McpClientAddServerForm.tsx'), 'utf8')
    const store = readFileSync(
      join(dir, '..', '..', '..', 'services', 'mobile-mcp-client-config.store.ts'),
      'utf8'
    )
    const chat = readFileSync(
      join(dir, '..', '..', '..', 'providers', 'baishou-provider', 'start-agent-chat.ts'),
      'utf8'
    )
    expect(section).toContain('SegmentedControl')
    expect(section).toContain("value: 'custom'")
    expect(section).toContain('McpClientServersSection')
    expect(section).toContain("from '@baishou/ui/native'")
    expect(custom).toContain('useMobileMcpClientServers')
    expect(custom).toContain('mcp_custom_empty')
    expect(card).toContain('Switch')
    expect(card).toContain("from '@baishou/ui/native'")
    expect(card).not.toContain("Switch } from 'react-native'")
    expect(form).toContain('Modal')
    expect(form).toContain('mcp_custom_add')
    expect(form).toContain('Input')
    expect(custom).toContain('Plus')
    expect(custom).toContain('hasServers')
    expect(store).toContain('device_mcp_client_config.json')
    expect(chat).toContain('extraVercelToolsFactory')
    expect(chat).toContain('mobileExtraVercelToolsFactory')
  })

  it('should present centered square button when empty, first-row add button when servers exist, and detail modal', () => {
    const custom = readFileSync(
      join(dir, '..', 'components', 'McpClientServersSection.tsx'),
      'utf8'
    )
    const form = readFileSync(join(dir, '..', 'components', 'McpClientAddServerForm.tsx'), 'utf8')
    const detailModal = readFileSync(
      join(dir, '..', 'components', 'McpClientServerDetailModal.tsx'),
      'utf8'
    )
    const card = readFileSync(join(dir, '..', 'components', 'McpClientServerCard.tsx'), 'utf8')

    // 空状态居中方形按钮
    expect(custom).toContain('!hasServers')
    expect(custom).toContain("borderStyle: 'dashed'")
    expect(custom).toContain("alignItems: 'center'")
    expect(custom).toContain("justifyContent: 'center'")

    // 已有服务时长条卡片与第一行添加按钮
    expect(custom).toContain('McpClientServerCard')
    expect(custom).toContain('McpClientServerDetailModal')
    expect(card).toContain('onToggleEnabled')
    expect(card).toContain('Switch')

    // 新建与详情弹窗
    expect(form).toContain('<Modal')
    expect(form).toContain('avoidKeyboard')
    expect(form).toContain("title={t('settings.mcp_custom_new_title', '添加自定义 MCP 服务')}")
    expect(form).not.toContain('mcp_custom_new_desc')
    expect(form).toContain("label={t('settings.mcp_custom_url', 'mcp 地址')}")
    expect(detailModal).toContain("label={t('settings.mcp_custom_url', 'mcp 地址')}")
    expect(detailModal).toContain('McpClientServerDetailModal')
    expect(detailModal).toContain('mcp_custom_test')
    expect(detailModal).toContain('HelpTooltip')
  })

  it('should use HelpTooltip for mobile MCP tool descriptions and enable web_search in MCP context', () => {
    const toolsListContent = readFileSync(
      join(
        dir,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        'packages',
        'ui',
        'src',
        'native',
        'McpSettingsCard',
        'McpToolsListContent.tsx'
      ),
      'utf8'
    )
    const mcpSettingsCard = readFileSync(
      join(
        dir,
        '..',
        '..',
        '..',
        '..',
        '..',
        '..',
        'packages',
        'ui',
        'src',
        'native',
        'McpSettingsCard',
        'McpSettingsCard.tsx'
      ),
      'utf8'
    )
    const mcpContextService = readFileSync(
      join(dir, '..', '..', '..', 'services', 'mobile-mcp-context.service.ts'),
      'utf8'
    )

    expect(toolsListContent).toContain('<HelpTooltip content={helpContent} />')
    expect(toolsListContent).toContain('settings.agent_tools_category_')
    expect(toolsListContent).toContain(
      "const rawId = tool.toolId || tool.name.replace(/^baishou_/, '')"
    )
    expect(mcpSettingsCard).toContain("t('settings.mcp_auth_enable_desc'")
    expect(mcpSettingsCard).toContain("t('settings.mcp_workspaces_title'")
    expect(mcpSettingsCard).toContain('onCopyEndpoint(itemMcpUrl)')
    expect(mcpSettingsCard).toContain('Pagination')
    expect(mcpSettingsCard).not.toContain('mcp_workspace_current')
    expect(mcpContextService).toContain('buildMobileStreamUserConfig(deps.settingsManager, true)')
    expect(mcpContextService).toContain('graphReader')
    expect(mcpContextService).toContain('graphNodeLookup')
  })
})
