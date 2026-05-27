import React from 'react'
import type { WebSearchSettingsViewProps } from './web-search-settings.types'
import { useWebSearchSettingsView } from './useWebSearchSettingsView'
import { SearchEngineSection } from './SearchEngineSection'
import { TavilyApiKeySection } from './TavilyApiKeySection'
import { GeneralSettingsSection } from './GeneralSettingsSection'
import styles from './WebSearchSettingsView.module.css'

export type { WebSearchConfig, WebSearchSettingsViewProps } from './web-search-settings.types'

export const WebSearchSettingsView: React.FC<WebSearchSettingsViewProps> = ({
  searchConfig,
  onSearchChange
}) => {
  const view = useWebSearchSettingsView({ searchConfig, onSearchChange })

  return (
    <div className={styles.container}>
      <SearchEngineSection
        searchConfig={searchConfig}
        onEngineChange={(engine) => view.handleChange('webSearchEngine', engine)}
      />

      {searchConfig.webSearchEngine === 'tavily' && (
        <TavilyApiKeySection
          localApiKey={view.localApiKey}
          apiKeyVisible={view.apiKeyVisible}
          onApiKeyChange={view.setLocalApiKey}
          onToggleVisibility={() => view.setApiKeyVisible(!view.apiKeyVisible)}
          onSave={view.saveApiKey}
        />
      )}

      <GeneralSettingsSection searchConfig={searchConfig} onChange={view.handleChange} />
    </div>
  )
}
