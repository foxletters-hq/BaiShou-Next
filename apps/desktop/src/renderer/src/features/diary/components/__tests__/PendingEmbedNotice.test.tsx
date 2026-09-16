import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingEmbedNotice } from '../PendingEmbedNotice'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallbackOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
        const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key
        const vars = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : options
        const count = vars && typeof vars.count === 'number' ? vars.count : undefined
        return typeof count === 'number' ? fallback.replace('{{count}}', String(count)) : fallback
      }
    })
  }
})

function Host() {
  const [open, setOpen] = useState(true)
  if (!open) return <div>notice-closed</div>
  return (
    <PendingEmbedNotice
      count={4}
      needModel={false}
      onAction={() => undefined}
      onDismiss={() => setOpen(false)}
    />
  )
}

describe('PendingEmbedNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('does not update the parent while rendering when the countdown closes the notice', () => {
    const errors: unknown[] = []
    const onError = (message: unknown) => {
      errors.push(message)
    }
    vi.spyOn(console, 'error').mockImplementation(onError)

    render(<Host />)
    expect(screen.getByRole('status')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(screen.getByRole('status')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('notice-closed')).toBeTruthy()
    expect(
      errors.some(
        (item) =>
          typeof item === 'string' &&
          item.includes('Cannot update a component') &&
          item.includes('PendingEmbedNotice')
      )
    ).toBe(false)
  })

  it('keeps the notice open while the pointer is hovering', () => {
    render(<Host />)
    const notice = screen.getByRole('status')

    act(() => {
      fireEvent.mouseEnter(notice)
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByRole('status')).toBeTruthy()

    act(() => {
      fireEvent.mouseLeave(notice)
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('notice-closed')).toBeTruthy()
  })

  it('closes immediately when the user clicks dismiss', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.getByText('notice-closed')).toBeTruthy()
  })
})
