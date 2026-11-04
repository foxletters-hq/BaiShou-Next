import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ipcRenderer } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { systemApi } from '../../../../../preload/system.api'
import { TitleBar } from '../index'

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return { ipcRenderer: Object.assign(new EventEmitter(), { send: vi.fn() }), webFrame: {} }
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback })
}))
vi.mock('@baishou/shared', () => ({ isIncrementalSyncReady: () => false }))
vi.mock('@baishou/store', () => ({
  useSettingsStore: (selector: (state: { showTopBarVaultSwitcher: boolean }) => unknown) =>
    selector({ showTopBarVaultSwitcher: false })
}))
vi.mock('@baishou/ui', () => ({
  IncrementalSyncPanel: () => null,
  WorkspaceScopeHelpTooltip: () => null
}))
vi.mock('../../../hooks/useOrchestratedSync', () => ({
  useOrchestratedSync: () => ({ isSyncing: false, isPlanning: false })
}))
vi.mock('../../../lib/vault-runtime.util', () => ({
  switchActiveVault: vi.fn(),
  persistActiveVaultName: vi.fn()
}))
vi.mock('../../../features/agent/AgentGatePendingDrawer', () => ({
  AgentGatePendingBadgeButton: () => null,
  AgentGatePendingDrawer: () => null
}))

describe('TitleBar window controls', () => {
  let nativeMaximized = false

  beforeEach(() => {
    ipcRenderer.removeAllListeners()
    nativeMaximized = false
    vi.mocked(ipcRenderer.send)
      .mockReset()
      .mockImplementation((channel) => {
        if (channel === 'window:getMaximized') {
          ipcRenderer.emit('window:maximized-changed', {}, nativeMaximized)
        }
      })
    ;(window as any).api = {
      window: systemApi.window,
      vault: {
        list: vi.fn().mockResolvedValue([{ name: 'Personal' }]),
        getActive: vi.fn().mockResolvedValue({ name: 'Personal' })
      },
      incrementalSync: { getConfig: vi.fn().mockResolvedValue(null) }
    }
  })

  afterEach(() => {
    cleanup()
    delete (window as any).api
  })

  async function renderTitleBar(strict = false) {
    const content = (
      <MemoryRouter initialEntries={['/welcome']}>
        <TitleBar />
      </MemoryRouter>
    )
    const view = render(strict ? <StrictMode>{content}</StrictMode> : content)
    await act(async () => {})
    return view
  }

  it.each([
    [false, '最大化', '.lucide-square'],
    [true, '还原', '.lucide-copy']
  ] as const)(
    'should show the native window icon when mounted with maximized=%s',
    async (maximized, title, icon) => {
      nativeMaximized = maximized
      await renderTitleBar()
      expect(screen.getByTitle(title).querySelector(icon)).not.toBeNull()
    }
  )

  it('should switch icons when native maximize and restore events arrive', async () => {
    await renderTitleBar()
    act(() => {
      ipcRenderer.emit('window:maximized-changed', {}, true)
    })
    expect(screen.getByTitle('还原').querySelector('.lucide-copy')).not.toBeNull()
    act(() => {
      ipcRenderer.emit('window:maximized-changed', {}, false)
    })
    expect(screen.getByTitle('最大化').querySelector('.lucide-square')).not.toBeNull()
  })

  it('should send the native toggle command when either window control is clicked', async () => {
    await renderTitleBar()
    fireEvent.click(screen.getByTitle('最大化'))
    expect(ipcRenderer.send).toHaveBeenLastCalledWith('window:toggleMaximize')
    act(() => {
      ipcRenderer.emit('window:maximized-changed', {}, true)
    })
    vi.mocked(ipcRenderer.send).mockClear()
    fireEvent.click(screen.getByTitle('还原'))
    expect(ipcRenderer.send).toHaveBeenCalledExactlyOnceWith('window:toggleMaximize')
  })

  it('should clean up subscriptions when remounted in StrictMode and unmounted', async () => {
    const { unmount } = await renderTitleBar(true)
    expect(ipcRenderer.listenerCount('window:maximized-changed')).toBe(1)
    unmount()
    expect(ipcRenderer.listenerCount('window:maximized-changed')).toBe(0)
  })
})
