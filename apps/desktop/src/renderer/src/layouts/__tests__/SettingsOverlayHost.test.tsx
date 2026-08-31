import { render, screen } from '@testing-library/react'
import { MemoryRouter, type Location } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SettingsOverlayHost } from '../SettingsOverlayHost'

vi.mock('../../features/settings/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">settings</div>
}))

const settingsLocation: Location = {
  pathname: '/settings/general',
  search: '',
  hash: '',
  key: 's1',
  state: null
}

function renderHost(visible: boolean) {
  return render(
    <MemoryRouter>
      <SettingsOverlayHost visible={visible} settingsLocation={settingsLocation} remountKey={0} />
    </MemoryRouter>
  )
}

describe('SettingsOverlayHost', () => {
  it('mounts SettingsPage while the overlay is open', () => {
    renderHost(true)
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('unmounts SettingsPage as soon as the overlay closes so leftover portals cannot block the page underneath', () => {
    const { rerender } = renderHost(true)
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <SettingsOverlayHost visible={false} settingsLocation={settingsLocation} remountKey={0} />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument()
  })
})
