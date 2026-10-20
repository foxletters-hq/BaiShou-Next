import { useState } from 'react'

type ExtractedPreview = {
  title: string
  text: string
  pages?: Array<{ page: number; text: string }>
}

/** 抽出正文预览的开关状态，资料卡片与向量片段共用同一个弹窗。 */
export function useKnowledgeDetailPreview() {
  const [extractedPreview, setExtractedPreview] = useState<ExtractedPreview | null>(null)

  return {
    fields: {
      extractedPreview,
      closeExtractedPreview: () => setExtractedPreview(null),
      openTextPreview: (title: string, text: string) => setExtractedPreview({ title, text })
    },
    setExtractedPreview
  }
}
