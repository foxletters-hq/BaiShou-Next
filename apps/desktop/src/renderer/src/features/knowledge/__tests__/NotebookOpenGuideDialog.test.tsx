import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotebookOpenGuideDialog } from '../NotebookOpenGuideDialog'

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
  Checkbox: ({
    checked,
    onChange
  }: {
    checked: boolean
    onChange: (event: { target: { checked: boolean } }) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange({ target: { checked: event.target.checked } })}
    />
  )
}))

vi.mock('../KnowledgeDialog', () => ({
  KnowledgeDialog: ({
    open,
    onClose,
    title,
    children
  }: {
    open: boolean
    onClose: () => void
    title?: string
    children?: ReactNode
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <button type="button" onClick={onClose}>
          overlay
        </button>
        {children}
      </div>
    ) : null
}))

describe('NotebookOpenGuideDialog', () => {
  it('goes back when the overlay or 返回 is used, and does not treat that as 知道了', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onContinue = vi.fn()
    const onOpenSettings = vi.fn()

    render(
      <NotebookOpenGuideDialog
        open
        notebookName="校对笔记"
        rows={[]}
        onBack={onBack}
        onContinue={onContinue}
        onOpenSettings={onOpenSettings}
      />
    )

    await user.click(screen.getByRole('button', { name: 'overlay' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onContinue).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '返回知识库' }))
    expect(onBack).toHaveBeenCalledTimes(2)
    expect(onContinue).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledTimes(3)
    expect(onContinue).not.toHaveBeenCalled()
  })
})
