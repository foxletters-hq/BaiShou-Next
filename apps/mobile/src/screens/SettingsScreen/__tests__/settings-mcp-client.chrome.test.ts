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
    expect(form).toContain('mcp_custom_add')
    expect(form).toContain('Input')
    expect(store).toContain('device_mcp_client_config.json')
    expect(chat).toContain('extraVercelToolsFactory')
    expect(chat).toContain('mobileExtraVercelToolsFactory')
  })
})
