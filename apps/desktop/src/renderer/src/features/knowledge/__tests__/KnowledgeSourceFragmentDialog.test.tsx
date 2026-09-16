import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeSourceFragmentDialog } from '../KnowledgeSourceFragmentDialog'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string, options?: { index?: number }) => {
        const text = fallback ?? key
        return typeof options?.index === 'number'
          ? text.replace('{{index}}', String(options.index))
          : text
      }
    })
  }
})

vi.mock('@baishou/ui', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
  Modal: ({
    isOpen,
    title,
    children
  }: {
    isOpen: boolean
    title?: ReactNode
    children: ReactNode
  }) => (isOpen ? <div aria-label={String(title)}>{children}</div> : null)
}))

describe('KnowledgeSourceFragmentDialog', () => {
  it('should show window text and excerpt when fragments are ready', () => {
    render(
      <KnowledgeSourceFragmentDialog
        open
        loading={false}
        error={null}
        fragments={[
          {
            id: 'src1#0',
            sourceTitle: '一本书',
            kind: 'graph-window',
            index: 0,
            excerpts: ['甲认识乙'],
            text: '窗口正文'
          }
        ]}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('一本书')).toBeInTheDocument()
    expect(screen.getByText('抽取窗口 #0')).toBeInTheDocument()
    expect(screen.getByText('甲认识乙')).toBeInTheDocument()
    expect(screen.getByText('窗口正文')).toBeInTheDocument()
  })

  it('should show missing-text copy when a vector chunk has no body', () => {
    render(
      <KnowledgeSourceFragmentDialog
        open
        loading={false}
        error={null}
        fragments={[
          {
            id: 'src1_1',
            sourceTitle: '笔记',
            kind: 'vector-chunk',
            index: 1,
            excerpts: [],
            text: null
          }
        ]}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('片段 #1')).toBeInTheDocument()
    expect(screen.getByText('还没有提取正文')).toBeInTheDocument()
  })

  it('should show empty copy when there are no fragments', () => {
    render(
      <KnowledgeSourceFragmentDialog
        open
        loading={false}
        error={null}
        fragments={[]}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('没有可预览的原文片段')).toBeInTheDocument()
  })
})
