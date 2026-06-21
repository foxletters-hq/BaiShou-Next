import React from 'react'
import { useTranslation } from 'react-i18next'
import { HelpTooltip } from '../HelpTooltip'
import type { WebSearchConfig } from './web-search-settings.types'
import { SEARCH_ENGINE_OPTIONS } from './web-search-settings.types'
import styles from './WebSearchSettingsView.module.css'

interface SearchEngineSectionProps {
  searchConfig: WebSearchConfig
  onEngineChange: (engine: string) => void
}

export const SearchEngineSection: React.FC<SearchEngineSectionProps> = ({
  searchConfig,
  onEngineChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.cardSection}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardTitle}>{t('agent.tools.param_search_engine', '搜索引擎')}</h3>
          <HelpTooltip
            content={t(
              'settings.web_search_engines_tooltip',
              'Choose how the partner searches the public web. Local browser engines need no API key; Tavily requires a key but is optimized for AI workflows.'
            )}
          />
        </div>
      </div>
      <div className={styles.engineGrid}>
        {SEARCH_ENGINE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`${styles.radioListTile} ${searchConfig.webSearchEngine === option.value ? styles.radioSelected : ''}`}
          >
            <input
              type="radio"
              name="engine"
              value={option.value}
              className={styles.radioInput}
              checked={searchConfig.webSearchEngine === option.value}
              onChange={(e) => onEngineChange(e.target.value)}
            />
            <div className={styles.radioCustomContainer}>
              <div className={styles.radioCustomRing}>
                {searchConfig.webSearchEngine === option.value && (
                  <div className={styles.radioCustomDot} />
                )}
              </div>
            </div>
            <div className={styles.radioContent}>
              <div className={styles.radioTitleRow}>
                <span className={styles.radioTitle}>
                  {t(option.titleKey, option.titleFallback)}
                </span>
                <HelpTooltip content={t(option.descKey, option.descFallback)} />
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
