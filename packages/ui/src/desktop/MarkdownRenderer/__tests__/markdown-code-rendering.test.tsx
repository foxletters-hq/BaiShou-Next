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
      '正在调试桌面端编辑器渲染逻辑时，突然看到 `inlineCode` 标记在消息列表里正常显示'
    )

    expect(container.querySelector('pre')).toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('inlineCode')
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
