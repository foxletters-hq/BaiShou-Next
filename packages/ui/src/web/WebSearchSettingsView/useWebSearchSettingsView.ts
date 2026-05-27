import { useState } from 'react'
import { useToast } from '../Toast/useToast'
import { useTranslation } from 'react-i18next'
import type { WebSearchConfig } from './web-search-settings.types'

interface UseWebSearchSettingsViewOptions {
  searchConfig: WebSearchConfig
  onSearchChange: (config: WebSearchConfig) => void
}

export function useWebSearchSettingsView({
  searchConfig,
  onSearchChange
}: UseWebSearchSettingsViewOptions) {
  const { t } = useTranslation()
  const toast = useToast()
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [localApiKey, setLocalApiKey] = useState(searchConfig.tavilyApiKey || '')

  const handleChange = (key: keyof WebSearchConfig, value: unknown) => {
    onSearchChange({ ...searchConfig, [key]: value })
  }

  const saveApiKey = () => {
    handleChange('tavilyApiKey', localApiKey)
    toast.showSuccess(t('common.success', '操作成功'))
  }

  return {
    apiKeyVisible,
    setApiKeyVisible,
    localApiKey,
    setLocalApiKey,
    handleChange,
    saveApiKey
  }
}
