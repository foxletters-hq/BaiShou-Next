import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { Switch } from '../Switch'

describe('Switch', () => {
  it('should fire onClick from the label when clicked', () => {
    const onClick = vi.fn()
    const { container } = render(<Switch onClick={onClick} />)
    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    fireEvent.click(label!)
    // label 关联 input：点击会再冒泡一次，这里只确认 handler 有接到
    expect(onClick).toHaveBeenCalled()
  })
})
