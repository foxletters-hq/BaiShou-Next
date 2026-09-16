import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotebookDataManageDialog } from '../NotebookDataManageDialog'

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
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
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
  ),
  Input: ({
    value,
    onChange
  }: {
    value: string
    onChange: (event: { target: { value: string } }) => void
  }) => <input value={value} onChange={onChange} />,
  Modal: ({
    isOpen,
    title,
    children
  }: {
    isOpen: boolean
    title?: string
    children?: ReactNode
  }) => (isOpen ? <div>{title}{children}</div> : null),
  SegmentedControl: ({
    value,
    options,
    onChange
  }: {
    value: string
    options: Array<{ value: string; label: string }>
    onChange: (value: string) => void
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}))

describe('NotebookDataManageDialog', () => {
  it('should confirm reprocess for the selected targets without a phrase', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <NotebookDataManageDialog open busy={false} onClose={vi.fn()} onConfirm={onConfirm} />
    )

    await user.click(screen.getAllByRole('checkbox')[1])
    const submit = screen.getAllByRole('button', { name: '重整理数据' }).at(-1)
    await user.click(submit!)

    expect(onConfirm).toHaveBeenCalledWith({
      action: 'reprocess',
      vector: true,
      graph: false
    })
  })

  it('should require the confirm phrase when clearing', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <NotebookDataManageDialog open busy={false} onClose={vi.fn()} onConfirm={onConfirm} />
    )

    await user.click(screen.getByRole('button', { name: '清除数据' }))
    const clearSubmit = () => screen.getAllByRole('button', { name: '清除数据' }).at(-1)!
    await user.click(clearSubmit())
    expect(onConfirm).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox'), '确认清除')
    await user.click(clearSubmit())
    expect(onConfirm).toHaveBeenCalledWith({
      action: 'clear',
      vector: true,
      graph: true
    })
  })
})
