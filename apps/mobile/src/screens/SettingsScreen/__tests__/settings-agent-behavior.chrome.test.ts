import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

describe('mobile settings agent behavior chrome', () => {
  it('should mount AgentBehaviorSection and persist restoreLastSessionOnReturn', () => {
    const hub = readFileSync(join(dir, '..', 'settingsHubItems.ts'), 'utf8')
    const detail = readFileSync(join(dir, '..', 'SettingsDetailScreen.tsx'), 'utf8')
    const section = readFileSync(join(dir, '..', 'components', 'AgentBehaviorSection.tsx'), 'utf8')
    const persist = readFileSync(
      join(dir, '..', '..', '..', 'hooks', 'useAgentNavigationPersistence.ts'),
      'utf8'
    )
    expect(hub).toContain("id: 'agent-behavior'")
    expect(hub).toContain("section: 'agent-behavior'")
    expect(detail).toContain('AgentBehaviorSection')
    expect(detail).toContain("case 'agent-behavior'")
    expect(section).toContain('restoreLastSessionOnReturn')
    expect(section).toContain('Switch')
    expect(section).toContain("from '@baishou/ui/native'")
    expect(section).not.toContain("Switch } from 'react-native'")
    expect(persist).toContain('restoreLastSessionOnReturn')
  })
})
