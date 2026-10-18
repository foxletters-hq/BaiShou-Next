import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

describe('mobile companion chat settings chrome', () => {
  it('should expose restoreLastSessionOnReturn in companion chat tools, not agent behavior', () => {
    const hub = readFileSync(join(dir, '..', 'settingsHubItems.ts'), 'utf8')
    const tools = readFileSync(join(dir, '..', 'components', 'AgentToolsSection.tsx'), 'utf8')
    const behavior = readFileSync(join(dir, '..', 'components', 'AgentBehaviorSection.tsx'), 'utf8')
    const persist = readFileSync(
      join(dir, '..', '..', '..', 'hooks', 'useAgentNavigationPersistence.ts'),
      'utf8'
    )
    const session = readFileSync(
      join(dir, '..', '..', 'AgentScreen', 'hooks', 'useAgentScreenSession.ts'),
      'utf8'
    )

    expect(hub).toContain("id: 'agent-tools'")
    expect(hub).toContain("pathname: '/settings/agent-tools'")
    expect(hub).toContain('settings.companion_chat_tools_title')
    expect(tools).toContain('restoreLastSessionOnReturn')
    expect(tools).toContain('settings.restore_last_session_on_return')
    expect(tools).toContain('settings.companion_chat_general_section')
    expect(tools).toContain('Switch')
    expect(tools).toContain("from '@baishou/ui/native'")
    expect(tools).not.toContain("Switch } from 'react-native'")
    expect(tools).toContain("set('agent_behavior'")
    expect(behavior).not.toContain('restoreLastSessionOnReturn')
    expect(persist).toContain('restoreLastSessionOnReturn')
    expect(session).toContain('useFocusEffect')
    expect(session).toContain('restoreLastSessionOnReturn')
  })
})
