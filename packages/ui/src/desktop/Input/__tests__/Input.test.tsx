import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '../Input'

describe('Input leading', () => {
  it('renders leading after the field so the icon is not covered by the input background', () => {
    render(<Input leading={<span data-testid="leading-icon">icon</span>} />)

    const input = screen.getByRole('textbox')
    const leading = screen.getByTestId('leading-icon')

    expect(input.className).toContain('baishou-form-field--pad-leading')
    expect(input.compareDocumentPosition(leading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
