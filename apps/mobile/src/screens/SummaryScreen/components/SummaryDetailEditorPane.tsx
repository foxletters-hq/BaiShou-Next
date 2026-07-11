import React from 'react'
import { StatusBar } from 'react-native'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import { DiaryEditor, useNativeTheme } from '@baishou/ui/native'
import { useDiaryEditorWebViewSource } from '@/src/hooks/useDiaryEditorWebViewSource'
import { useMarkdownToolbarOrder } from '../../../hooks/useMarkdownToolbarOrder'
import { parseSummaryBoundaryDate } from '../utils/summary-detail.helpers'
import type { CachedSummaryDetail } from '../utils/summaryDetailCache'

type SummaryDetailEditorPaneProps = {
  summary: CachedSummaryDetail
  editContent: string
  isSaving: boolean
  onContentChange: (content: string) => void
  onSave: (content: string) => void
  onCancel: () => void
}

export const SummaryDetailEditorPane: React.FC<SummaryDetailEditorPaneProps> = ({
  summary,
  editContent,
  isSaving,
  onContentChange,
  onSave,
  onCancel
}) => {
  const { colors, isDark } = useNativeTheme()
  const editorWebViewSource = useDiaryEditorWebViewSource()
  const { toolOrder, saveToolOrder } = useMarkdownToolbarOrder()

  return (
    <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgSurface }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgSurface}
      />
      <DiaryEditor
        content={editContent}
        tags={[]}
        selectedDate={parseSummaryBoundaryDate(summary.startDate)}
        isSummaryMode
        editorWebViewSource={editorWebViewSource}
        webViewActive
        onContentChange={onContentChange}
        onTagsChange={() => {}}
        onDateChange={() => {}}
        markdownToolbarOrder={toolOrder}
        onMarkdownToolbarOrderChange={saveToolOrder}
        onSave={(content) => {
          if (isSaving) return
          onSave(content)
        }}
        onCancel={onCancel}
      />
    </ScreenSafeArea>
  )
}
