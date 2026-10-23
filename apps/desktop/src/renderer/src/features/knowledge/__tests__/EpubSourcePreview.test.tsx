import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EpubSourcePreview } from '../EpubSourcePreview'

let markdownRenders = 0

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string, options?: Record<string, number>) => {
        let text = fallback ?? key
        if (options) {
          for (const [name, value] of Object.entries(options)) {
            text = text.replace(`{{${name}}}`, String(value))
          }
        }
        return text
      }
    })
  }
})

vi.mock('@baishou/ui', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => {
    markdownRenders += 1
    return <div>{content}</div>
  },
  Button: ({
    children,
    ...rest
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
    <button {...rest}>{children}</button>
  ),
  Input: ({
    value,
    onChange,
    onBlur,
    onKeyDown,
    'aria-label': ariaLabel
  }: InputHTMLAttributes<HTMLInputElement>) => (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  )
}))

function pageField() {
  return screen.getByRole('textbox', { name: '跳转到页' })
}

function mockPreviewMetrics(viewportWidth: number, flowScrollWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.dataset.testid === 'epub-viewport' ? viewportWidth : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.dataset.testid === 'epub-viewport' ? 480 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.dataset.testid === 'epub-flow' ? flowScrollWidth : 0
  })
}

describe('EpubSourcePreview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should open on the first text when the opening document is blank', async () => {
    mockPreviewMetrics(400, 800)
    render(<EpubSourcePreview pages={['', '   ', '第一章 视听语言', '第二章 场面调度']} />)

    expect(await screen.findByRole('textbox', { name: '跳转到页' })).toHaveValue('1')
    expect(screen.getByText('/ 2')).toBeInTheDocument()
    expect(screen.getByText(/第一章 视听语言/)).toBeInTheDocument()
    expect(screen.getByText(/第二章 场面调度/)).toBeInTheDocument()
    expect(screen.queryByText('暂无提取正文')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
  })

  it('should show the empty state when every document has no text', () => {
    render(<EpubSourcePreview pages={['', '  \n']} />)
    expect(screen.getByText('暂无提取正文')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument()
  })

  it('should turn one screen when the reader goes to the next page', async () => {
    mockPreviewMetrics(400, 800)
    const user = userEvent.setup()
    render(<EpubSourcePreview pages={['第一章很长', '第二章也很长']} />)

    expect(await screen.findByRole('textbox', { name: '跳转到页' })).toHaveValue('1')
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(pageField()).toHaveValue('2')
    expect(screen.getByText('/ 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(pageField()).toHaveValue('1')
  })

  it('should ignore arrow keys when an input is focused', async () => {
    mockPreviewMetrics(400, 800)
    render(
      <>
        <input aria-label="页码" />
        <EpubSourcePreview pages={['第一章很长']} />
      </>
    )
    expect(await screen.findByRole('textbox', { name: '跳转到页' })).toHaveValue('1')
    fireEvent.keyDown(screen.getByRole('textbox', { name: '页码' }), { key: 'ArrowRight' })
    expect(pageField()).toHaveValue('1')
  })

  it('should turn one screen when the reader scrolls the preview', async () => {
    mockPreviewMetrics(400, 1200)
    render(<EpubSourcePreview pages={['第一章很长']} />)
    expect(await screen.findByRole('textbox', { name: '跳转到页' })).toHaveValue('1')
    fireEvent.wheel(screen.getByTestId('epub-viewport'), { deltaY: 120 })
    expect(pageField()).toHaveValue('2')
    fireEvent.wheel(screen.getByTestId('epub-viewport'), { deltaY: 120 })
    expect(pageField()).toHaveValue('2')
  })

  it('should leave the book body in place when the reader turns a page', async () => {
    mockPreviewMetrics(400, 800)
    markdownRenders = 0
    const user = userEvent.setup()
    render(<EpubSourcePreview pages={['第一章很长', '第二章也很长']} />)

    expect(await screen.findByRole('textbox', { name: '跳转到页' })).toHaveValue('1')
    const rendered = markdownRenders
    await user.click(screen.getByRole('button', { name: '下一页' }))

    expect(pageField()).toHaveValue('2')
    expect(markdownRenders).toBe(rendered)
  })

  it('should jump to the entered page when the reader confirms the page field', async () => {
    mockPreviewMetrics(400, 1200)
    const user = userEvent.setup()
    render(<EpubSourcePreview pages={['第一章很长']} />)

    const jump = await screen.findByRole('textbox', { name: '跳转到页' })
    await user.clear(jump)
    await user.type(jump, '3{Enter}')

    expect(jump).toHaveValue('3')
    expect(screen.getByTestId('epub-shift')).toHaveStyle({
      transform: 'translate3d(-800px, 0, 0)'
    })
  })

  it('should stop on the last page when the entered page is past the end', async () => {
    mockPreviewMetrics(400, 1200)
    const user = userEvent.setup()
    render(<EpubSourcePreview pages={['第一章很长']} />)

    const jump = await screen.findByRole('textbox', { name: '跳转到页' })
    await user.clear(jump)
    await user.type(jump, '99{Enter}')

    expect(jump).toHaveValue('3')
    expect(screen.getByTestId('epub-shift')).toHaveStyle({
      transform: 'translate3d(-800px, 0, 0)'
    })
  })

  it('should keep the current page when the jump text is not a page number', async () => {
    mockPreviewMetrics(400, 1200)
    const user = userEvent.setup()
    render(<EpubSourcePreview pages={['第一章很长']} />)

    const jump = await screen.findByRole('textbox', { name: '跳转到页' })
    await user.clear(jump)
    await user.type(jump, 'abc')
    fireEvent.blur(jump)

    expect(jump).toHaveValue('1')
    expect(screen.getByTestId('epub-shift')).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' })
  })
})
