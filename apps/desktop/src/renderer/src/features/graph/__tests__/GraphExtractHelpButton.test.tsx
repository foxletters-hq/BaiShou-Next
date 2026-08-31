import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GraphExtractHelpButton } from '../GraphExtractHelpButton'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key
    })
  }
})

vi.mock('@baishou/ui', () => ({
  SettingsHelpIconButton: ({
    'aria-label': ariaLabel,
    onActivate
  }: {
    'aria-label': string
    onActivate: () => void
  }) => (
    <button type="button" aria-label={ariaLabel} onClick={onActivate} />
  ),
  Modal: ({
    isOpen,
    title,
    children
  }: {
    isOpen: boolean
    title?: string
    children?: ReactNode
  }) =>
    isOpen ? (
      <div>
        <div>{title}</div>
        {children}
      </div>
    ) : null
}))

describe('GraphExtractHelpButton', () => {
  it('opens the extract help modal on click', async () => {
    const user = userEvent.setup()
    render(<GraphExtractHelpButton />)

    expect(screen.queryByText('抽取与抽取池')).toBeNull()
    await user.click(screen.getByRole('button', { name: '抽取与抽取池说明' }))
    expect(screen.getByText('抽取与抽取池')).toBeTruthy()
    expect(screen.getByText('抽取')).toBeTruthy()
    expect(screen.getByText('抽取池')).toBeTruthy()
  })
})
