import React from 'react'
import { useTranslation } from 'react-i18next'
import type { WebSearchSettingsViewProps } from './web-search-settings.types'
import { useWebSearchSettingsView } from './useWebSearchSettingsView'
import { SearchEngineSection } from './SearchEngineSection'
import { TavilyApiKeySection } from './TavilyApiKeySection'
import { ExaApiKeySection } from './ExaApiKeySection'
import { AnysearchApiKeySection } from './AnysearchApiKeySection'
import { GeneralSettingsSection } from './GeneralSettingsSection'
import styles from './WebSearchSettingsView.module.css'

export type { WebSearchConfig, WebSearchSettingsViewProps } from './web-search-settings.types'

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  searchConfig,
  onSearchChange
}) => {
  const { t } = useTranslation()
  const view = useWebSearchSettingsView({ searchConfig, onSearchChange })

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{t('agent.tools.web_search', '网络搜索')}</h2>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.pageCard}>
          <SearchEngineSection
            searchConfig={searchConfig}
            onEngineChange={(engine) => view.handleChange('webSearchEngine', engine)}
          />

          {searchConfig.webSearchEngine === 'tavily' && (
            <TavilyApiKeySection
              localApiKey={view.localTavilyApiKey}
              apiKeyVisible={view.tavilyApiKeyVisible}
              onApiKeyChange={view.setLocalTavilyApiKey}
              onToggleVisibility={() => view.setTavilyApiKeyVisible(!view.tavilyApiKeyVisible)}
              onSave={view.saveTavilyApiKey}
            />
          )}

          {searchConfig.webSearchEngine === 'exa' && (
            <ExaApiKeySection
              localApiKey={view.localExaApiKey}
              apiKeyVisible={view.exaApiKeyVisible}
              onApiKeyChange={view.setLocalExaApiKey}
              onToggleVisibility={() => view.setExaApiKeyVisible(!view.exaApiKeyVisible)}
              onSave={view.saveExaApiKey}
            />
          )}

          {searchConfig.webSearchEngine === 'anysearch' && (
            <AnysearchApiKeySection
              localApiKey={view.localAnysearchApiKey}
              apiKeyVisible={view.anysearchApiKeyVisible}
              onApiKeyChange={view.setLocalAnysearchApiKey}
              onToggleVisibility={() =>
                view.setAnysearchApiKeyVisible(!view.anysearchApiKeyVisible)
              }
              onSave={view.saveAnysearchApiKey}
            />
          )}

          <GeneralSettingsSection searchConfig={searchConfig} onChange={view.handleChange} />
        </div>
      </div>
    </div>
  )
}
