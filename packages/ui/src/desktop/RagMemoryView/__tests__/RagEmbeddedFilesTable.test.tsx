import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RagEntry } from '../rag-memory.types'
import { RagEmbeddedFilesTable } from '../RagEmbeddedFilesTable'

const diaryEntry: RagEntry = {
  embeddingId: 'diary-1',
  text: '[2024-10-23日记:]\n#####21:37:48\n\n曾经热烈过的证明还在抽屉里。',
  modelId: 'Qwen/Qwen3-Embedding-4B',
  createdAt: Date.parse('2024-10-23T13:37:48'),
  sourceType: 'diary'
}

describe('RagEmbeddedFilesTable empty copy', () => {
  it('should explain embedding instead of AI reading when the list is empty', () => {
    render(
      <RagEmbeddedFilesTable
        entries={[]}
        searchQuery=""
        activeMenuId={null}
        setActiveMenuId={vi.fn()}
        formatDate={() => ''}
      />
    )

    expect(screen.getByText('暂无内容')).toBeInTheDocument()
    expect(
      screen.getByText(
        '写下日记、添加手动片段，或完成伙伴与节点的嵌入后，可检索的记忆会出现在这里。'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/当 AI 阅读日记/)).not.toBeInTheDocument()
  })

  it('should hint to change the query when search has no matches', () => {
    render(
      <RagEmbeddedFilesTable
        entries={[]}
        searchQuery="没有这条"
        activeMenuId={null}
        setActiveMenuId={vi.fn()}
        formatDate={() => ''}
      />
    )

    expect(screen.getByText('没有找到相关结果')).toBeInTheDocument()
    expect(screen.getByText('换个关键词试试，也可以切换语义搜索和文本搜索。')).toBeInTheDocument()
  })
})

describe('RagEmbeddedFilesTable fragment preview', () => {
  it('shows the matching diary body instead of only the date heading', () => {
    render(
      <RagEmbeddedFilesTable
        entries={[diaryEntry]}
        searchQuery="证明"
        activeMenuId={null}
        setActiveMenuId={vi.fn()}
        formatDate={() => '10/23'}
      />
    )

    expect(screen.getAllByText('证明').length).toBeGreaterThan(0)
    expect(screen.getByText('查看完整片段')).toBeInTheDocument()
  })

  it('opens the full fragment in a dialog', async () => {
    const user = userEvent.setup()
    render(
      <RagEmbeddedFilesTable
        entries={[diaryEntry]}
        searchQuery="证明"
        activeMenuId={null}
        setActiveMenuId={vi.fn()}
        formatDate={() => '10/23'}
      />
    )

    await user.click(screen.getByText('查看完整片段'))
    expect(screen.getByText('记忆片段')).toBeInTheDocument()
    expect(document.querySelector('.entryPreviewBody')?.textContent).toBe(diaryEntry.text)
    expect(screen.getByText('关闭')).toBeInTheDocument()
  })
})
