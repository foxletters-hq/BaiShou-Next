import { describe, expect, it, vi } from 'vitest'
import { analyzePageTexts } from '../knowledge-extract'
import { probeKnowledgeExtractSample } from '../knowledge-extract-probe'
import type { ExtractEngineContext } from '../extract-engines'

const pdfSource = {
  id: 'src_1',
  title: '扫描合同',
  sourceKind: 'file',
  relativePath: 'nb/sources/src_1_scan.pdf',
  pageCount: 10
}

describe('probeKnowledgeExtractSample', () => {
  it('should return first, middle and last page texts without asking to persist cache', async () => {
    const extract = vi.fn(async (ctx: ExtractEngineContext) => {
      expect(ctx.persistCache).toBe(false)
      expect(ctx.pageNumbers).toEqual([1, 5, 10])
      expect(ctx.existingPageTexts).toHaveLength(10)
      expect(ctx.visionModelId).toBe('vision-cheap')
      return analyzePageTexts(['首页', '', '', '', '中间页', '', '', '', '', '末页'])
    })

    const result = await probeKnowledgeExtractSample(
      {
        source: pdfSource,
        absolutePath: '/tmp/scan.pdf',
        engine: 'vision',
        visionModelId: 'vision-cheap'
      },
      {
        extract,
        resolvePageCount: async () => 10
      }
    )

    expect(result).toEqual({
      sourceId: 'src_1',
      title: '扫描合同',
      engine: 'vision',
      pageCount: 10,
      sampledPages: [1, 5, 10],
      pages: [
        { page: 1, text: '首页' },
        { page: 5, text: '中间页' },
        { page: 10, text: '末页' }
      ]
    })
  })

  it('should reject a non-pdf source before calling extract', async () => {
    const extract = vi.fn()
    await expect(
      probeKnowledgeExtractSample(
        {
          source: {
            id: 'src_2',
            title: '笔记',
            sourceKind: 'note',
            relativePath: 'nb/sources/src_2.md'
          },
          absolutePath: '/tmp/note.md',
          engine: 'ocr'
        },
        { extract }
      )
    ).rejects.toThrow('试抽取只支持 PDF')
    expect(extract).not.toHaveBeenCalled()
  })

  it('should reject the text-layer engine', async () => {
    await expect(
      probeKnowledgeExtractSample({
        source: pdfSource,
        absolutePath: '/tmp/scan.pdf',
        engine: 'simple'
      })
    ).rejects.toThrow('试抽取只支持本地 OCR 或视觉模型')
  })

  it('should reject when the page count cannot be resolved', async () => {
    await expect(
      probeKnowledgeExtractSample(
        {
          source: { ...pdfSource, pageCount: null },
          absolutePath: '/tmp/scan.pdf',
          engine: 'ocr'
        },
        { resolvePageCount: async () => null }
      )
    ).rejects.toThrow('无法确定 PDF 页数')
  })
})
