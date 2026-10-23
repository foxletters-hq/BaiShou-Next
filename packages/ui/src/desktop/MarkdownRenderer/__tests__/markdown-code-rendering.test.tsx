import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DialogProvider } from '../../Dialog'
import { MarkdownRenderer } from '../MarkdownRenderer'

function renderMarkdown(content: string, props: { showCodeCopy?: boolean } = {}) {
  return render(
    <DialogProvider>
      <MarkdownRenderer content={content} {...props} />
    </DialogProvider>
  )
}

describe('MarkdownRenderer code rendering', () => {
  it('renders single-backtick code inline without a code block or copy button', () => {
    const { container } = renderMarkdown(
      '正一边玩着边境检查游戏一边在兴头上撸到一半，突然看到 `巧可` （宫逸雪）在 QQ 群里艾特我'
    )

    expect(container.querySelector('pre')).toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('巧可')
    expect(screen.queryByText('复制')).toBeNull()
  })

  it('renders fenced code as a block with a copy button by default', () => {
    const { container } = renderMarkdown('```js\nconst answer = 42\n```')

    expect(container.querySelector('pre')).not.toBeNull()
    expect(screen.getByText('复制')).toBeInTheDocument()
  })

  it('hides the copy button when showCodeCopy is false', () => {
    const { container } = renderMarkdown('```js\nconst answer = 42\n```', {
      showCodeCopy: false
    })

    expect(container.querySelector('pre')).not.toBeNull()
    expect(screen.queryByText('复制')).toBeNull()
  })
})
