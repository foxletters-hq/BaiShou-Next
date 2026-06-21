import React from 'react'
import { useTranslation } from 'react-i18next'
import { WEB_SEARCH_MAX_RESULTS_LIMIT } from '@baishou/shared'
import {
  MdFormatListNumbered,
  MdAutoAwesome,
  MdCompress,
  MdLibraryBooks,
  MdShortText
} from 'react-icons/md'
import { Switch } from '../Switch/Switch'
import type { WebSearchConfig } from './web-search-settings.types'
import styles from './WebSearchSettingsView.module.css'

interface GeneralSettingsSectionProps {
  searchConfig: WebSearchConfig
  onChange: (key: keyof WebSearchConfig, value: unknown) => void
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  searchConfig,
  onChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.cardSection}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{t('settings.general', '通用规则设置')}</h3>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.sliderRow}>
          <div className={styles.sliderRowHeader}>
            <MdFormatListNumbered className={styles.sliderIcon} />
            <div className={styles.sliderTextGroup}>
              <span className={styles.sliderTitle}>
                {t('agent.tools.param_max_results', '搜索结果上限')}
              </span>
              <span className={styles.sliderDesc}>
                {t('agent.tools.param_max_results_desc', '最多返回的条目数')}
              </span>
            </div>
          </div>
          <div className={styles.sliderControlRow}>
            <input
              type="range"
              min="1"
              max={WEB_SEARCH_MAX_RESULTS_LIMIT}
              value={searchConfig.webSearchMaxResults}
              onChange={(e) => onChange('webSearchMaxResults', parseInt(e.target.value))}
              className={styles.sliderInput}
            />
            <span className={styles.sliderValue}>{searchConfig.webSearchMaxResults}</span>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.switchTile}>
          <MdAutoAwesome className={styles.switchIcon} />
          <div className={styles.switchTextGroup}>
            <span className={styles.sliderTitle}>
              {t('agent.tools.param_rag_enabled', '网页智能抽取 (Web-RAG)')}
            </span>
            <span className={styles.sliderDesc}>
              {t('agent.tools.param_rag_enabled_desc', '开启深入阅读理解')}
            </span>
          </div>
          <Switch
            checked={searchConfig.webSearchRagEnabled}
            onChange={(e) => onChange('webSearchRagEnabled', e.target.checked)}
          />
        </div>

        {searchConfig.webSearchRagEnabled ? (
          <>
            <div className={styles.divider} />
            <div className={styles.sliderRow}>
              <div className={styles.sliderRowHeader}>
                <MdCompress className={styles.sliderIcon} />
                <div className={styles.sliderTextGroup}>
                  <span className={styles.sliderTitle}>
                    {t('agent.tools.param_rag_max_chunks', '总片段上限')}
                  </span>
                  <span className={styles.sliderDesc}>
                    {t('agent.tools.param_rag_max_chunks_desc', '最多提取的片段数')}
                  </span>
                </div>
              </div>
              <div className={styles.sliderControlRow}>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={searchConfig.webSearchRagMaxChunks}
                  onChange={(e) => onChange('webSearchRagMaxChunks', parseInt(e.target.value))}
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValue}>{searchConfig.webSearchRagMaxChunks}</span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.sliderRow}>
              <div className={styles.sliderRowHeader}>
                <MdLibraryBooks className={styles.sliderIcon} />
                <div className={styles.sliderTextGroup}>
                  <span className={styles.sliderTitle}>
                    {t('agent.tools.param_rag_chunks_per_source', '单站抽取块数')}
                  </span>
                  <span className={styles.sliderDesc}>
                    {t('agent.tools.param_rag_chunks_per_source_desc', '单个网页提取最大数')}
                  </span>
                </div>
              </div>
              <div className={styles.sliderControlRow}>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={searchConfig.webSearchRagChunksPerSource}
                  onChange={(e) =>
                    onChange('webSearchRagChunksPerSource', parseInt(e.target.value))
                  }
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValue}>
                  {searchConfig.webSearchRagChunksPerSource}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.divider} />
            <div className={styles.sliderRow}>
              <div className={styles.sliderRowHeader}>
                <MdShortText className={styles.sliderIcon} />
                <div className={styles.sliderTextGroup}>
                  <span className={styles.sliderTitle}>
                    {t('agent.tools.param_plain_snippet_length', '简单摘要截取长度')}
                  </span>
                  <span className={styles.sliderDesc}>
                    {t(
                      'agent.tools.param_plain_snippet_length_desc',
                      '当不启用 RAG 时提取正文的字符数'
                    )}
                  </span>
                </div>
              </div>
              <div className={styles.sliderControlRow}>
                <input
                  type="range"
                  min="500"
                  max="30000"
                  step="100"
                  value={searchConfig.webSearchPlainSnippetLength}
                  onChange={(e) =>
                    onChange('webSearchPlainSnippetLength', parseInt(e.target.value))
                  }
                  className={styles.sliderInput}
                />
                <span className={styles.sliderValue}>
                  {searchConfig.webSearchPlainSnippetLength}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
