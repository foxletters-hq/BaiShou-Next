import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from '../DatePicker'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback || key
    })
  }
})

describe('DatePicker', () => {
  it('renders with placeholder when no value is provided', () => {
    render(<DatePicker placeholder="选择日期" />)
    expect(screen.getByText('选择日期')).toBeInTheDocument()
  })

  it('renders formatted date string when value is provided', () => {
    render(<DatePicker value="2026-09-28" />)
    expect(screen.getByText('2026-09-28')).toBeInTheDocument()
  })

  it('renders formatted date when Date object is provided', () => {
    render(<DatePicker value={new Date(2026, 8, 28)} />)
    expect(screen.getByText('2026-09-28')).toBeInTheDocument()
  })

  it('opens dropdown when trigger is clicked', () => {
    render(<DatePicker value="2026-09-28" />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('2026年')).toBeInTheDocument()
    expect(screen.getByText('9月')).toBeInTheDocument()
  })

  it('calls onChange with date and formatted string when a day is clicked', () => {
    const handleChange = vi.fn()
    render(<DatePicker value="2026-09-28" onChange={handleChange} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    // Click on day 15
    const day15Buttons = screen.getAllByRole('button').filter((b) => b.textContent === '15')
    expect(day15Buttons.length).toBeGreaterThan(0)
    fireEvent.click(day15Buttons[0]!)

    expect(handleChange).toHaveBeenCalledWith(expect.any(Date), '2026-09-15')
  })

  it('calls onChange(null, "") when clear button is clicked', () => {
    const handleChange = vi.fn()
    render(<DatePicker value="2026-09-28" onChange={handleChange} clearable />)

    const clearBtn = screen.getByTitle('清除')
    fireEvent.click(clearBtn)

    expect(handleChange).toHaveBeenCalledWith(null, '')
  })

  it('supports size="small"', () => {
    const { container } = render(<DatePicker size="small" />)
    expect(container.firstChild).toHaveClass(/sizeSmall/)
  })

  it('does not open when disabled', () => {
    render(<DatePicker disabled />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
