import { describe, expect, it } from 'vitest'
import { page, readKnowledgeSrc } from './knowledge-detail-chrome.test-helpers'

describe('mobile knowledge detail chrome - settings and vectors', () => {
  it('should use ModelSwitcher for vision models and keep extract hint actions short', () => {
    const hint = readKnowledgeSrc('KnowledgeExtractHintDialog.tsx')
    expect(hint).not.toContain('extract_hint_keep')
    expect(hint).not.toContain("t('knowledge.engine_ocr'")
    expect(hint).not.toContain("t('knowledge.engine_vision'")
    expect(hint).not.toContain('extract_hint_ocr')
    expect(hint).not.toContain('OCR')
    expect(hint).toContain('extract_hint_vision')
    expect(hint).toContain('extract_hint_open_settings')
    expect(hint).toMatch(/onChoose\('vision'\)[\s\S]*:[\s\S]*extract_hint_open_settings/)
    expect(hint).not.toMatch(/onChoose\('vision'\)[\s\S]*: null[\s\S]*extract_hint_open_settings/)
    expect(hint).toContain('extractHintActions')
    expect(page).toContain('extractHintPrompt?.visionConfigured')
    expect(page).toContain('ModelSwitcher')
    expect(page).toContain('saveVisionModel')
    expect(page).toContain('modelSwitcherSlot')
    expect(page).toContain("modelSwitcherSlot === 'embedding'")
    expect(page).toContain("modelSwitcherSlot === 'vision'")
    expect(page).toContain('applyModelSwitcher')
    expect(page).toContain('applySlotModel')
  })

  it('should show a spinner until the initial notebook detail load completes', () => {
    const hook = readKnowledgeSrc('useKnowledgeDetail.ts')
    expect(hook).toContain('const [detailLoaded, setDetailLoaded] = useState(false)')
    expect(hook).toContain('if (!cancelled) setDetailLoaded(true)')
    expect(hook).toContain('    detailLoaded,\n')
    expect(page).toContain('!detail.detailLoaded')
    expect(page).toContain('disabled: detail.busy || !detail.detailLoaded')
  })

  it('should show import extract and probe in settings, and compact data manage without tooltip', () => {
    const extractSection = readKnowledgeSrc('KnowledgeDetailExtractSection.tsx')
    const manageSection = readKnowledgeSrc('KnowledgeDetailManageSection.tsx')
    expect(extractSection).not.toContain("t('knowledge.settings_section_extract'")
    expect(extractSection).toContain('HelpTooltip')
    expect(extractSection).toContain('knowledge.settings_section_extract_help_mobile')
    expect(extractSection).toContain('能直接读的文字就按文件抽取。PDF 一律交给视觉模型识图。')
    expect(extractSection).toContain('knowledge.vision_model_recommend')
    expect(extractSection).toContain("t('knowledge.default_engine'")
    expect(extractSection).toContain("t('knowledge.engine_vision_short'")
    expect(extractSection).toContain("t('knowledge.ocr_concurrency'")
    expect(extractSection).toContain('listOcrConcurrencyValues')
    expect(extractSection).toContain('onOcrConcurrencyChange')
    expect(page).toContain('ocrConcurrency={detail.ocrConcurrency}')
    expect(extractSection).toContain("t('knowledge.extract_probe_test'")
    expect(extractSection).toContain("t('knowledge.extract_probe_running', '正在试抽…'")
    expect(extractSection).toContain('isLoading={props.probing}')
    expect(page).toContain('probing={detail.probing}')
    expect(extractSection).toContain('knowledge.extract_probe_help')
    expect(extractSection).toContain('第 1 页、中间页和最后一页')
    expect(extractSection).not.toContain('第 1、2 页')
    expect(extractSection).toContain('mobileTypography.secondary')
    expect(extractSection).not.toContain('mobileTypography.primary')
    expect(extractSection).not.toContain('mobileTypography.caption')
    expect(extractSection).not.toContain('extract_probe_pages')
    expect(extractSection).not.toContain('probe_need_pdf')
    expect(extractSection).toContain('variant="settings"')
    expect(manageSection).toContain("justifyContent: 'space-between'")
    expect(manageSection).toMatch(/向量片段[\s\S]*<Checkbox/)
    expect(manageSection).toMatch(/本笔记本图谱[\s\S]*<Checkbox/)
    expect(extractSection).toContain("t('knowledge.no_sources', '暂无资料'")
    expect(extractSection).not.toContain("t('knowledge.extract_probe', '试抽')")
    expect(extractSection).not.toContain('recover_stale')
    expect(extractSection).not.toContain("t('knowledge.vision_model_pick'")
    expect(extractSection).not.toContain('onPickEmbedding')
    expect(extractSection).not.toContain('onPickGraph')
    expect(extractSection).not.toContain('onPickVision')
    expect(extractSection).not.toContain('styles.statusItem')
    expect(extractSection).not.toContain('pairStatusRows')
    expect(manageSection).not.toContain('HelpTooltip')
    expect(manageSection).toContain("t('knowledge.graph_ops_hint'")
    expect(manageSection).not.toContain('graph.start_organize')
    expect(manageSection).not.toContain("t('knowledge.rebuild_graph'")
    expect(manageSection).not.toContain('onRebuildGraph')
    expect(manageSection).not.toContain('SegmentedControl')
    expect(manageSection).toContain('clearModalOpen')
    expect(manageSection).toContain('<Modal')
    expect(manageSection).toContain('clearPhrase')
    expect(manageSection).toMatch(
      /\[styles\.submitActionsRow, modalActionsStyle\][\s\S]*data_manage_reprocess[\s\S]*data_manage_clear[\s\S]*<Modal/
    )
    const detailScreen = readKnowledgeSrc('KnowledgeDetailScreen.tsx')
    expect(detailScreen).not.toContain("title={t('knowledge.notebook_manage'")
  })

  it('should close the settings and data modal after extract settings save succeeds', () => {
    const screen = readKnowledgeSrc('KnowledgeDetailScreen.tsx')
    const notebook = readKnowledgeSrc('useKnowledgeDetailNotebook.ts')
    const saveFn = notebook.slice(
      notebook.indexOf('const saveExtractConfig'),
      notebook.indexOf('const saveVisionModel')
    )
    expect(saveFn).toContain("t('common.saved', '已保存')")
    expect(saveFn).toContain('return true')
    expect(screen).not.toContain('onSave={detail.saveExtractConfig}')
    expect(screen).toMatch(/saveExtractConfig\(\)[\s\S]*setManageOpen\(false\)/)
  })

  it('should space scroll indicator from content in extracted and source preview modals like skill cite preview', () => {
    const detailScreen = readKnowledgeSrc('KnowledgeDetailScreen.tsx')
    const sourceModal = readKnowledgeSrc('KnowledgeSourcePreviewModal.tsx')
    const jobBanner = readKnowledgeSrc('KnowledgeDetailJobBanner.tsx')
    expect(detailScreen).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingRight:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
    expect(sourceModal).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingRight:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
    expect(jobBanner).toMatch(
      /<ScrollView[\s\S]*contentContainerStyle=\{\{\s*paddingHorizontal:\s*tokens\.spacing\.mdTight\s*\}\}/
    )
  })

  it('should align vector search loading state with RagMemoryView progressbar', () => {
    const vectorsSection = readKnowledgeSrc('KnowledgeDetailVectorsSection.tsx')
    expect(vectorsSection).toContain('accessibilityRole="progressbar"')
    expect(vectorsSection).toContain('<ActivityIndicator size="small" color={colors.primary} />')
    expect(vectorsSection).toContain("t('settings.rag_searching', '正在搜索…')")
  })
})
