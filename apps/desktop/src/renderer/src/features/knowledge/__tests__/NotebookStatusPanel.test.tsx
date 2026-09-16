import type { ButtonHTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotebookStatusPanel } from '../NotebookStatusPanel'
import type { NotebookOpenGuideRow } from '../notebook-open-guide.util'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key
    })
  }
})

vi.mock('@baishou/ui', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button type="button" {...props}>
      {children}
    </button>
  )
}))

const rows: NotebookOpenGuideRow[] = [
  { key: 'embedding', label: '嵌入模型', value: '未配置', warn: true },
  { key: 'graphExtract', label: '图抽取模型', value: 'deepseek-flash', iconSrc: 'icon://graph' },
  { key: 'sources', label: '来源', value: '0 个' }
]

describe('NotebookStatusPanel', () => {
  it('should render model cards and stacked manage buttons without a start-chat action', () => {
    render(
      <NotebookStatusPanel rows={rows} onOpenSettings={vi.fn()} onOpenDataManage={vi.fn()} />
    )

    expect(screen.getByLabelText('当前模型与抽取状态')).toBeInTheDocument()
    expect(screen.getByText('嵌入模型')).toBeInTheDocument()
    expect(screen.getByText('图抽取模型')).toBeInTheDocument()
    expect(screen.getByText('deepseek-flash')).toBeInTheDocument()
    expect(document.querySelector('img[src="icon://graph"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: '笔记本管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '数据管理' })).toBeInTheDocument()
    expect(screen.queryByText('对话模型')).not.toBeInTheDocument()
    expect(screen.queryByText('用这本笔记本开始对话')).not.toBeInTheDocument()
  })

  it('should pick a configured graph extract model from the card', async () => {
    const user = userEvent.setup()
    const onPickRow = vi.fn()

    render(
      <NotebookStatusPanel
        rows={rows}
        onOpenSettings={vi.fn()}
        onOpenDataManage={vi.fn()}
        onPickRow={onPickRow}
      />
    )

    await user.click(screen.getByRole('button', { name: '图抽取模型 deepseek-flash' }))
    expect(onPickRow).toHaveBeenCalledTimes(1)
    expect(onPickRow.mock.calls[0]?.[0]).toBe('graphExtract')
  })

  it('should pick a missing embedding card', async () => {
    const user = userEvent.setup()
    const onPickRow = vi.fn()

    render(
      <NotebookStatusPanel
        rows={rows}
        onOpenSettings={vi.fn()}
        onOpenDataManage={vi.fn()}
        onPickRow={onPickRow}
      />
    )

    await user.click(screen.getByRole('button', { name: '嵌入模型 未配置' }))
    expect(onPickRow.mock.calls[0]?.[0]).toBe('embedding')
  })

  it('should open data manage from the stacked action', async () => {
    const user = userEvent.setup()
    const onOpenDataManage = vi.fn()

    render(
      <NotebookStatusPanel
        rows={rows}
        onOpenSettings={vi.fn()}
        onOpenDataManage={onOpenDataManage}
      />
    )

    await user.click(screen.getByRole('button', { name: '数据管理' }))
    expect(onOpenDataManage).toHaveBeenCalledTimes(1)
  })
})
