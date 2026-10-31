// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { McpToolsListPanel } from '../McpToolsListPanel'
import { McpSettingsCard } from '../index'

vi.mock('../../Toast/useToast', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key
  })
}))

describe('McpToolsListPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    ;(window as any).api = {
      settings: {
        getMcpTools: vi.fn().mockResolvedValue([
          {
            name: 'baishou_web_search',
            toolId: 'web_search',
            displayName: 'web_search',
            description: 'Search the web',
            category: 'search',
            enabled: true
          },
          {
            name: 'baishou_url_read',
            toolId: 'url_read',
            displayName: 'url_read',
            description: 'Read web page',
            category: 'search',
            enabled: true
          }
        ])
      }
    }
  })

  it('renders tools and allows toggling tool switch', async () => {
    const onChange = vi.fn()
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      disabledToolIds: []
    }

    render(<McpToolsListPanel config={config} onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText('baishou_web_search')).toBeTruthy()
      expect(screen.getByText('baishou_url_read')).toBeTruthy()
    })

    const switches = screen.getAllByRole('checkbox')
    expect(switches).toHaveLength(2)
    expect((switches[0] as HTMLInputElement).checked).toBe(true)

    // Toggle first tool (web_search) off
    fireEvent.click(switches[0]!)
    expect(onChange).toHaveBeenCalledWith({
      mcpEnabled: true,
      mcpPort: 31004,
      disabledToolIds: ['web_search']
    })
  })

  it('renders disabled switch when tool is in disabledToolIds', async () => {
    const config = {
      mcpEnabled: true,
      mcpPort: 31004,
      disabledToolIds: ['web_search']
    }

    render(<McpToolsListPanel config={config} onChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('baishou_web_search')).toBeTruthy()
    })

    const switches = screen.getAllByRole('checkbox')
    expect((switches[0] as HTMLInputElement).checked).toBe(false)
    expect((switches[1] as HTMLInputElement).checked).toBe(true)
  })

  it('uses raw toolId for i18n lookup even when displayName is localized', async () => {
    ;(window as any).api = {
      settings: {
        getMcpTools: vi.fn().mockResolvedValue([
          {
            name: 'baishou_recall_relations',
            toolId: 'recall_relations',
            displayName: '回忆人生关系图',
            description: 'English fallback description',
            category: 'memory',
            enabled: true
          }
        ])
      }
    }

    render(
      <McpToolsListPanel
        config={{ mcpEnabled: true, mcpPort: 31004, disabledToolIds: [] }}
        onChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('baishou_recall_relations')).toBeTruthy()
      expect(screen.getByText('(回忆人生关系图)')).toBeTruthy()
    })
  })

  it('should render all workspace URLs without Current badge and copy individual workspace URLs directly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText }
    })

    render(
      <McpSettingsCard
        standalone
        lanHost="192.168.31.10"
        workspaces={[
          { id: 'Personal', name: 'Personal' },
          { id: 'vlt_1288b1828c92e186', name: '演示空间_2' }
        ]}
        config={{ mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: false }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('http://192.168.31.10:31004/mcp?vault=Personal')).toBeTruthy()
    expect(
      screen.getByText('http://192.168.31.10:31004/mcp?vault=vlt_1288b1828c92e186')
    ).toBeTruthy()
    expect(screen.queryByText('当前')).toBeNull()

    const copyButtons = screen.getAllByTitle('复制 MCP 地址')
    expect(copyButtons).toHaveLength(2)

    fireEvent.click(copyButtons[1]!)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'http://192.168.31.10:31004/mcp?vault=vlt_1288b1828c92e186'
      )
    })
  })

  it('should paginate workspace URLs when workspace count exceeds page size', () => {
    render(
      <McpSettingsCard
        standalone
        lanHost="192.168.31.10"
        workspaces={[
          { id: 'v1', name: '小窝 1' },
          { id: 'v2', name: '小窝 2' },
          { id: 'v3', name: '小窝 3' },
          { id: 'v4', name: '小窝 4' }
        ]}
        config={{ mcpEnabled: true, mcpPort: 31004, mcpAuthEnabled: false }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('小窝 1')).toBeTruthy()
    expect(screen.getByText('小窝 3')).toBeTruthy()
    expect(screen.queryByText('小窝 4')).toBeNull()

    const page2Button = screen.getByRole('button', { name: '2' })
    fireEvent.click(page2Button)

    expect(screen.queryByText('小窝 1')).toBeNull()
    expect(screen.getByText('小窝 4')).toBeTruthy()
  })
})
