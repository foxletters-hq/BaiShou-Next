import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button size', () => {
  it('uses the small size class by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button').className).toMatch(/small/)
  })

  it('can opt out of the small size', () => {
    render(<Button size="default">Save</Button>)
    expect(screen.getByRole('button').className).not.toMatch(/small/)
  })
})
