import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SegmentedControl } from '../SegmentedControl'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'SegmentedControl.module.css'),
  'utf8'
)

describe('SegmentedControl size', () => {
  it('should apply the compact class when size is small', () => {
    const { container } = render(
      <SegmentedControl
        value="vectors"
        options={[
          { value: 'vectors', label: '向量片段' },
          { value: 'graph', label: '关系图谱' }
        ]}
        onChange={vi.fn()}
        size="small"
      />
    )
    expect(container.firstChild).toHaveClass(/groupSmall/)
    expect(screen.getByRole('button', { name: '向量片段' })).toBeInTheDocument()
  })

  it('should keep the default class when size is omitted', () => {
    const { container } = render(
      <SegmentedControl
        value="vectors"
        options={[{ value: 'vectors', label: '向量片段' }]}
        onChange={vi.fn()}
      />
    )
    expect(container.firstChild).not.toHaveClass(/groupSmall/)
  })

  it('should keep the selected button on the surface color before the thumb is measured', () => {
    const active = css.slice(css.indexOf('.btnActive,'), css.indexOf('.btn:disabled'))
    expect(active).toContain('background: var(--bg-surface)')
    expect(active).not.toContain('background: transparent')
  })
})
