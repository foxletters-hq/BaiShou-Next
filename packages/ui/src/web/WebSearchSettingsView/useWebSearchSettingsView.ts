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
  const [tavilyApiKeyVisible, setTavilyApiKeyVisible] = useState(false)
  const [exaApiKeyVisible, setExaApiKeyVisible] = useState(false)
  const [anysearchApiKeyVisible, setAnysearchApiKeyVisible] = useState(false)
  const [localTavilyApiKey, setLocalTavilyApiKey] = useState(searchConfig.tavilyApiKey || '')
  const [localExaApiKey, setLocalExaApiKey] = useState(searchConfig.exaApiKey || '')
  const [localAnysearchApiKey, setLocalAnysearchApiKey] = useState(
    searchConfig.anysearchApiKey || ''
  )

  const handleChange = (key: keyof WebSearchConfig, value: unknown) => {
    onSearchChange({ ...searchConfig, [key]: value })
  }

  const saveTavilyApiKey = () => {
    handleChange('tavilyApiKey', localTavilyApiKey)
    toast.showSuccess(t('common.success', '操作成功'))
  }

  const saveExaApiKey = () => {
    handleChange('exaApiKey', localExaApiKey)
    toast.showSuccess(t('common.success', '操作成功'))
  }

  const saveAnysearchApiKey = () => {
    handleChange('anysearchApiKey', localAnysearchApiKey)
    toast.showSuccess(t('common.success', '操作成功'))
  }

  return {
    tavilyApiKeyVisible,
    setTavilyApiKeyVisible,
    exaApiKeyVisible,
    setExaApiKeyVisible,
    anysearchApiKeyVisible,
    setAnysearchApiKeyVisible,
    localTavilyApiKey,
    setLocalTavilyApiKey,
    localExaApiKey,
    setLocalExaApiKey,
    localAnysearchApiKey,
    setLocalAnysearchApiKey,
    handleChange,
    saveTavilyApiKey,
    saveExaApiKey,
    saveAnysearchApiKey
  }
}
