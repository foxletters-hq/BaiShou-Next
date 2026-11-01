import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { VersionManager } from '../index'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback: string) => fallback
    })
  }
})

vi.mock('@baishou/store', () => ({
  UpdateStatus: {
    IDLE: 'idle',
    CHECKING: 'checking',
    AVAILABLE: 'available',
    NOT_AVAILABLE: 'not_available',
    ERROR: 'error'
  },
  useUpdaterStore: () => ({
    status: 'idle',
    currentVersion: '1.5.2',
    updateInfo: null,
    error: null,
    autoCheck: true,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    setAutoCheck: vi.fn(),
    loadAutoCheck: vi.fn(),
    initIpcListeners: vi.fn()
  })
}))

describe('VersionManager embedded layout', () => {
  it('renders title and check action in the same header row when embedded', () => {
    const { container } = render(<VersionManager embedded version="1.5.2" />)

    const row = container.querySelector('.version-manager-embedded-row')
    expect(row).toBeTruthy()

    const title = row?.querySelector('.version-manager-embedded-title')
    expect(title?.textContent).toBe('应用更新')

    const button = row?.querySelector('button')
    expect(button?.textContent).toBe('Check for updates')
  })
})
