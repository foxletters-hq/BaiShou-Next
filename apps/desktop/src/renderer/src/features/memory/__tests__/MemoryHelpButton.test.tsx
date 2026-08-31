import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryHelpButton } from '../MemoryHelpButton'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key
    })
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

vi.mock('@baishou/ui', () => ({
  SettingsHelpIconButton: ({
    'aria-label': ariaLabel,
    onActivate
  }: {
    'aria-label': string
    onActivate: () => void
  }) => <button type="button" aria-label={ariaLabel} onClick={onActivate} />,
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

describe('MemoryHelpButton', () => {
  it('opens the memory help modal on click', async () => {
    const user = userEvent.setup()
    render(<MemoryHelpButton />)

    expect(screen.queryByText('记忆说明')).toBeNull()
    await user.click(screen.getByRole('button', { name: '关于全局 AI 记忆' }))
    expect(screen.getByText('记忆说明')).toBeTruthy()
    expect(
      screen.getByText(
        '日记和伙伴共用这一套记忆。片段保存原文，用于回忆细节；关系保存联系，用于理清脉络。笔记本资料的向量和关系图在各自笔记本里管理，不并入这里。'
      )
    ).toBeTruthy()
    expect(screen.getByText('打开知识库')).toBeTruthy()
  })
})
