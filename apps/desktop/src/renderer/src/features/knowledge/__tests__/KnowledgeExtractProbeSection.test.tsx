// @vitest-environment jsdom
import type { ButtonHTMLAttributes, ChangeEvent } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KnowledgeExtractProbeSection } from '../KnowledgeExtractProbeSection'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string, options?: { pages?: string; page?: number }) => {
        const text = fallback ?? key
        return text
          .replace('{{pages}}', options?.pages ?? '')
          .replace('{{page}}', options?.page != null ? String(options.page) : '')
      }
    })
  }
})

vi.mock('@baishou/ui', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Select: ({
    value,
    options,
    onChange,
    'aria-label': ariaLabel
  }: {
    value?: string
    options: Array<{ value: string; label: string }>
    onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
    'aria-label'?: string
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={onChange}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  HelpTooltip: () => null
}))

const probeExtractSample = vi.fn()

vi.mock('../call-knowledge-api', () => ({
  callKnowledgeApi: (...args: unknown[]) => probeExtractSample(...args)
}))

describe('KnowledgeExtractProbeSection', () => {
  it('should show an empty hint when the notebook has no pdf', () => {
    render(
      <KnowledgeExtractProbeSection
        notebookId="nb1"
        sources={[{ id: 'n1', title: '笔记', sourceKind: 'note' }]}
        engine="vision"
        engineAvailable
        ocrLanguage="chi_sim+eng"
        ocrConcurrency={3}
        visionProviderId={null}
        visionModelId="vision-1"
      />
    )
    expect(screen.getByText('这个笔记本还没有可试抽的 PDF，先导入一份。')).toBeInTheDocument()
  })

  it('should show sampled page texts after a successful probe', async () => {
    const user = userEvent.setup()
    probeExtractSample.mockResolvedValue({
      pages: [
        { page: 1, text: '封面' },
        { page: 5, text: '' },
        { page: 10, text: '附录' }
      ]
    })
    render(
      <KnowledgeExtractProbeSection
        notebookId="nb1"
        sources={[
          {
            id: 'pdf1',
            title: '合同.pdf',
            sourceKind: 'file',
            relativePath: 'nb1/sources/a.pdf',
            pageCount: 10
          }
        ]}
        engine="vision"
        engineAvailable
        ocrLanguage="chi_sim+eng"
        ocrConcurrency={3}
        visionProviderId="prov"
        visionModelId="vision-1"
      />
    )

    await user.selectOptions(screen.getByLabelText('试抽文件'), 'pdf1')
    expect(screen.getByText('将抽取第 1、5、10 页')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始试抽' }))
    expect(await screen.findByText('封面')).toBeInTheDocument()
    expect(screen.getByText('这一页几乎没有识别出文字')).toBeInTheDocument()
    expect(screen.getByText('附录')).toBeInTheDocument()
    expect(probeExtractSample).toHaveBeenCalledWith(
      'probeExtractSample',
      'knowledge:probe-extract-sample',
      expect.objectContaining({
        notebookId: 'nb1',
        sourceId: 'pdf1',
        engine: 'vision',
        visionModelId: 'vision-1'
      })
    )
  })
})
