import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RagMemoryView } from '../RagMemoryView'
import type { RagConfig, RagEntry, RagState, RagStats } from '../rag-memory.types'

const config: RagConfig = {
  ragTopK: 8,
  ragSimilarityThreshold: 0.3,
  ragEnabled: true
}

const stats: RagStats = {
  totalCount: 3,
  currentDimension: 2560,
  totalSizeText: '1 KB'
}

const idleState: RagState = {
  isRunning: false,
  type: 'idle',
  progress: 0,
  total: 0,
  statusText: ''
}

const staleEntry: RagEntry = {
  embeddingId: 'entry-1',
  text: '上一分类的旧结果',
  modelId: 'Qwen/Qwen3-Embedding-4B',
  createdAt: Date.now(),
  sourceType: 'diary'
}

describe('RagMemoryView searching', () => {
  it('keeps existing entries visible and shows a searching overlay while the query is in flight', () => {
    render(
      <RagMemoryView
        config={config}
        stats={stats}
        ragState={idleState}
        hasMismatchModel={false}
        entries={[staleEntry]}
        totalCount={3}
        isSearching
        sourceKind="graph_node"
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('正在搜索')
    expect(screen.getByText('上一分类的旧结果')).toBeInTheDocument()
    expect(document.querySelector('.searchingOverlay')).not.toBeNull()
  })

  it('shows a full searching state when the list is still empty', () => {
    render(
      <RagMemoryView
        config={config}
        stats={{ ...stats, totalCount: 0 }}
        ragState={idleState}
        hasMismatchModel={false}
        entries={[]}
        totalCount={0}
        isSearching
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('正在搜索')
    expect(document.querySelector('.searchingState')).not.toBeNull()
    expect(document.querySelector('.searchingOverlay')).toBeNull()
  })

  it('shows entries again after the query finishes', () => {
    render(
      <RagMemoryView
        config={config}
        stats={stats}
        ragState={idleState}
        hasMismatchModel={false}
        entries={[staleEntry]}
        totalCount={3}
        isSearching={false}
        sourceKind="graph_node"
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('上一分类的旧结果')).toBeInTheDocument()
  })

  it('should stretch the empty list so the placeholder can center', () => {
    render(
      <RagMemoryView
        config={config}
        stats={{ ...stats, totalCount: 0 }}
        ragState={idleState}
        hasMismatchModel={false}
        entries={[]}
        totalCount={0}
        isSearching={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />
    )

    expect(document.querySelector('.entriesListContainerFill')).not.toBeNull()
    expect(document.querySelector('.emptyStateContainer')).not.toBeNull()
  })
})
