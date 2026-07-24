import React from 'react'
import { useTranslation } from 'react-i18next'
import type { WebSearchSettingsViewProps } from './web-search-settings.types'
import { useWebSearchSettingsView } from './useWebSearchSettingsView'
import { SearchEngineSection } from './SearchEngineSection'
import { TavilyApiKeySection } from './TavilyApiKeySection'
import { ExaApiKeySection } from './ExaApiKeySection'
import { AnysearchApiKeySection } from './AnysearchApiKeySection'
import { GeneralSettingsSection } from './GeneralSettingsSection'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import stack from '../shared/SettingsStack.module.css'

export type { WebSearchConfig, WebSearchSettingsViewProps } from './web-search-settings.types'

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  searchConfig,
  onSearchChange
}) => {
  const { t } = useTranslation()
  const view = useWebSearchSettingsView({ searchConfig, onSearchChange })

  return (
    <SettingsPageChrome title={t('agent.tools.web_search', '网络搜索')}>
      <div className={stack.stack}>
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
            onToggleVisibility={() => view.setAnysearchApiKeyVisible(!view.anysearchApiKeyVisible)}
            onSave={view.saveAnysearchApiKey}
          />
        )}

        <GeneralSettingsSection searchConfig={searchConfig} onChange={view.handleChange} />
      </div>
    </SettingsPageChrome>
  )
}
