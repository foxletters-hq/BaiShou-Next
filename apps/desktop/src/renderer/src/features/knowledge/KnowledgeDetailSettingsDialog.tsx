import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Cloud, X } from 'lucide-react'
import { Button, HelpTooltip, Input, Select } from '@baishou/ui'
import {
  clampOcrConcurrency,
  listOcrConcurrencyValues,
  normalizeKnowledgeDefaultExtractEngine,
  RECOMMENDED_OCR_CONCURRENCY
} from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import { KnowledgeExtractProbeSection } from './KnowledgeExtractProbeSection'
import { knowledgeExtractSettingsVisibility } from './knowledge-extract-settings-visibility.util'
import { OCR_LANGUAGE_PRESETS } from './knowledge-detail-labels.util'
import type { KnowledgeEngineCaps, KnowledgeSourceRow } from './knowledge-detail.types'
import styles from './KnowledgePage.module.css'

export function KnowledgeDetailSettingsDialog(props: {
  open: boolean
  busy: boolean
  notebookId: string
  sources: KnowledgeSourceRow[]
  engine: 'simple' | 'ocr' | 'vision'
  engineCaps: KnowledgeEngineCaps | null
  ocrLanguage: string
  ocrConcurrency: number
  ocrPresetValue: string
  visionDisplay: {
    isCustom: boolean
    modelId: string
    iconSrc?: string
  }
  visionProviderId: string | null
  visionModelId: string | null
  globalDialogueProviderId?: string | null
  globalDialogueModelId?: string | null
  visionModelTriggerRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onEngineChange: (engine: 'simple' | 'ocr' | 'vision') => void
  onOcrPresetChange: (value: string) => void
  onOcrLanguageChange: (value: string) => void
  onOcrConcurrencyChange: (value: number) => void
  onOpenVisionPicker: (rect: DOMRect | null) => void
  onClearVisionModel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const { showOcrSettings, showVisionSettings } = knowledgeExtractSettingsVisibility(props.engine)

  return (
    <KnowledgeDialog
      open={props.open}
      onClose={props.onClose}
      closeDisabled={props.busy}
      title={t('knowledge.settings', '知识库设置')}
      aria-label={t('knowledge.settings', '知识库设置')}
      className={styles.dialogSettings}
    >
      <div className={styles.settingsStack}>
        <div className={styles.settingsGroup}>
          <div className={styles.sectionLabelRow}>
            <h3 className={styles.sectionLabel}>
              {t('knowledge.settings_section_extract', '导入提取')}
            </h3>
            <HelpTooltip
              size={14}
              content={t(
                'knowledge.settings_section_extract_help',
                '导入时先抽已有文字。缺页或乱码时，扫描件用本地 OCR，复杂排版可用视觉模型。'
              )}
            />
          </div>
          <section className={styles.settingsCard}>
            <div className={styles.settingsRow}>
              <div className={styles.settingsRowText}>
                <div className={styles.settingsRowTitle}>
                  {t('knowledge.default_engine', '默认提取方式')}
                  <HelpTooltip
                    size={14}
                    content={t(
                      'knowledge.default_engine_hint',
                      '导入时先抽已有文字。缺页或乱码时，扫描件优先本地 OCR；复杂版式或图表可改用视觉模型。'
                    )}
                  />
                </div>
                {props.engineCaps?.[props.engine] && !props.engineCaps[props.engine].available ? (
                  <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWarn}`}>
                    {props.engineCaps[props.engine].reason ||
                      t('knowledge.cap_unavailable', '不可用')}
                  </p>
                ) : null}
              </div>
              <Select
                className={styles.settingsControl}
                size="small"
                value={props.engine}
                options={[
                  {
                    value: 'ocr',
                    label: t('knowledge.engine_ocr_short', '本地 OCR')
                  },
                  {
                    value: 'vision',
                    label: t('knowledge.engine_vision_short', '视觉模型')
                  }
                ]}
                onChange={(e) =>
                  props.onEngineChange(normalizeKnowledgeDefaultExtractEngine(e.target.value))
                }
                aria-label={t('knowledge.default_engine', '默认提取方式')}
              />
            </div>
            {showOcrSettings ? (
              <>
                <div className={styles.settingsDivider} />
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowText}>
                    <div className={styles.settingsRowTitle}>
                      {t('knowledge.ocr_language', 'OCR 语言')}
                      <HelpTooltip
                        size={14}
                        content={t(
                          'knowledge.ocr_language_hint',
                          '仅本地 OCR 使用。未安装对应语言包时，会自动降级为英文。'
                        )}
                      />
                    </div>
                  </div>
                  <Select
                    className={styles.settingsControl}
                    size="small"
                    value={props.ocrPresetValue}
                    options={[
                      ...OCR_LANGUAGE_PRESETS.map((p) => ({
                        value: p.value,
                        label: t(
                          p.labelKey,
                          p.value === 'chi_sim+eng'
                            ? '简体中文 + 英文'
                            : p.value === 'chi_tra+eng'
                              ? '繁体中文 + 英文'
                              : p.value === 'jpn+eng'
                                ? '日文 + 英文'
                                : '英文'
                        )
                      })),
                      { value: '__custom__', label: t('knowledge.ocr_lang_custom', '自定义…') }
                    ]}
                    onChange={(e) => props.onOcrPresetChange(e.target.value)}
                    aria-label={t('knowledge.ocr_language', 'OCR 语言')}
                  />
                </div>
                {props.ocrPresetValue === '__custom__' ? (
                  <>
                    <div className={styles.settingsDivider} />
                    <div className={styles.settingsRow}>
                      <Input
                        fieldSize="small"
                        value={props.ocrLanguage}
                        onChange={(e) => props.onOcrLanguageChange(e.target.value)}
                        placeholder="chi_sim+eng"
                        spellCheck={false}
                      />
                    </div>
                  </>
                ) : null}
                <div className={styles.settingsDivider} />
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowText}>
                    <div className={styles.settingsRowTitle}>
                      {t('knowledge.ocr_concurrency', 'OCR 并发')}
                      <HelpTooltip
                        size={14}
                        content={t(
                          'knowledge.ocr_concurrency_hint',
                          '同时处理的页数，范围 1–10。推荐 3；1 最稳，调高更快，但更占内存与 CPU。'
                        )}
                      />
                    </div>
                  </div>
                  <Select
                    className={styles.settingsControl}
                    size="small"
                    value={String(props.ocrConcurrency)}
                    options={listOcrConcurrencyValues().map((n) => ({
                      value: String(n),
                      label:
                        n === RECOMMENDED_OCR_CONCURRENCY
                          ? t(
                              'knowledge.ocr_concurrency_option_recommended',
                              '{{count}} 页（推荐）',
                              {
                                count: n
                              }
                            )
                          : t('knowledge.ocr_concurrency_option', '{{count}} 页', { count: n })
                    }))}
                    onChange={(e) => {
                      props.onOcrConcurrencyChange(clampOcrConcurrency(Number(e.target.value)))
                    }}
                    aria-label={t('knowledge.ocr_concurrency', 'OCR 并发')}
                  />
                </div>
              </>
            ) : null}
            {showVisionSettings ? (
              <>
                <div className={styles.settingsDivider} />
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowText}>
                    <div className={styles.settingsRowTitle}>
                      {t('knowledge.vision_model', '视觉模型')}
                      <HelpTooltip
                        size={14}
                        content={t(
                          'knowledge.vision_model_hint',
                          '选带看图能力的模型即可。扫描件抽字不必用最贵的，便宜的多模态模型通常够用。未指定时跟随全局对话模型。'
                        )}
                      />
                    </div>
                    <p className={`${styles.settingsRowHint} ${styles.settingsRowHintWrap}`}>
                      {t(
                        'knowledge.vision_model_recommend',
                        '推荐选带看图能力的便宜多模态模型，扫描件抽字不必用最贵的。'
                      )}
                    </p>
                  </div>
                  <div className={styles.modelSelectorWrap}>
                    <button
                      ref={props.visionModelTriggerRef}
                      type="button"
                      className={styles.modelSelectorBtn}
                      onClick={() => {
                        props.onOpenVisionPicker(
                          props.visionModelTriggerRef.current?.getBoundingClientRect() ?? null
                        )
                      }}
                      aria-label={t('knowledge.vision_model_pick', '选择')}
                    >
                      <span className={styles.modelSelectorIcon} aria-hidden>
                        {props.visionDisplay.iconSrc ? (
                          <img src={props.visionDisplay.iconSrc} alt="" />
                        ) : (
                          <Cloud size={16} />
                        )}
                      </span>
                      <span className={styles.modelSelectorName}>
                        {props.visionDisplay.isCustom
                          ? props.visionDisplay.modelId
                          : props.visionDisplay.modelId
                            ? t('knowledge.vision_model_follow_named', '跟随 · {{model}}', {
                                model: props.visionDisplay.modelId
                              })
                            : t('knowledge.vision_model_unset_short', '跟随全局对话模型')}
                      </span>
                      <ChevronDown size={14} className={styles.modelSelectorChevron} aria-hidden />
                    </button>
                    {props.visionDisplay.isCustom ? (
                      <button
                        type="button"
                        className={styles.modelSelectorClear}
                        onClick={props.onClearVisionModel}
                        aria-label={t('knowledge.vision_model_clear_short', '清除')}
                        title={t('knowledge.vision_model_clear_short', '清除')}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
        <KnowledgeExtractProbeSection
          notebookId={props.notebookId}
          sources={props.sources}
          engine={props.engine === 'vision' ? 'vision' : 'ocr'}
          engineAvailable={Boolean(
            props.engineCaps?.[props.engine === 'vision' ? 'vision' : 'ocr']?.available
          )}
          engineUnavailableReason={
            props.engineCaps?.[props.engine === 'vision' ? 'vision' : 'ocr']?.reason
          }
          disabled={props.busy}
          ocrLanguage={props.ocrLanguage}
          ocrConcurrency={props.ocrConcurrency}
          visionProviderId={props.visionProviderId || props.globalDialogueProviderId || null}
          visionModelId={props.visionModelId || props.globalDialogueModelId || null}
        />
      </div>

      <div className={styles.dialogActions}>
        <Button type="button" onClick={props.onClose} disabled={props.busy}>
          {t('common.cancel', '取消')}
        </Button>
        <Button type="button" onClick={props.onSave} disabled={props.busy}>
          {t('common.save', '保存')}
        </Button>
      </div>
    </KnowledgeDialog>
  )
}
