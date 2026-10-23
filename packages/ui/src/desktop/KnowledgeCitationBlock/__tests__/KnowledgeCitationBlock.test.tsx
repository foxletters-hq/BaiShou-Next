import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { KnowledgeCitationBlock, useKnowledgeCitationOpener } from '../KnowledgeCitationBlock'

function OpenButton({ href }: { href: string }) {
  const { openFromHref } = useKnowledgeCitationOpener()
  return (
    <button type="button" onClick={() => openFromHref(href)}>
      打开引用
    </button>
  )
}

describe('KnowledgeCitationBlock', () => {
  it('should not stack citation excerpts under the reply until a number is opened', () => {
    render(
      <KnowledgeCitationBlock
        citations={[{ notebookName: '手册', title: '深度关系', excerpt: '课题分离是骨架' }]}
        anchorKey="msg-1"
      >
        <p>回复正文</p>
      </KnowledgeCitationBlock>
    )
    expect(screen.getByText('回复正文')).toBeInTheDocument()
    expect(screen.queryByText('课题分离是骨架')).not.toBeInTheDocument()
    expect(screen.queryByText(/引用 1/)).not.toBeInTheDocument()
  })

  it('should show the excerpt in a dialog when the citation href is opened', () => {
    render(
      <KnowledgeCitationBlock
        citations={[{ notebookName: '手册', title: '深度关系', excerpt: '课题分离是骨架' }]}
        anchorKey="msg-1"
      >
        <OpenButton href="#kb-cite-msg-1-1" />
      </KnowledgeCitationBlock>
    )
    fireEvent.click(screen.getByText('打开引用'))
    expect(screen.getByText('课题分离是骨架')).toBeInTheDocument()
    expect(screen.getByText('「1」 手册 · 深度关系')).toBeInTheDocument()
  })
})
