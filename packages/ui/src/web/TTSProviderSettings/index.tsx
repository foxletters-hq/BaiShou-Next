import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { useToast } from '../Toast/useToast'
import { HelpTooltip } from '../HelpTooltip'
import styles from './TTSProviderSettings.module.css'

interface TtsProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

interface TTSProviderSettingsProps {
  initialConfig?: Partial<TtsProviderConfig>
  providersList?: any[]
  onSaveConfig?: (config: TtsProviderConfig) => Promise<void>
  onTestTts?: (
    config: TtsProviderConfig,
    text: string
  ) => Promise<{ success: boolean; audioBase64?: string; format?: string }>
  onFetchModels?: (providerId: string, apiKey: string, baseUrl: string) => Promise<string[]>
}

interface ProviderLocalState {
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  availableModels: string[]
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

const getInitialConfigs = (): Record<string, ProviderLocalState> => {
  const defaults: Record<string, ProviderLocalState> = {
    'openai-tts': {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelId: 'tts-1',
      voice: 'alloy',
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'mimo-tts': {
      baseUrl: '',
      apiKey: '',
      modelId: 'mimo-v2.5-tts',
      voice: '冰糖',
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: []
    },
    'clone-tts': {
      baseUrl: 'http://127.0.0.1:8080',
      apiKey: '',
      modelId: 'default',
      voice: 'default',
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'gpt-sovits': {
      baseUrl: 'http://127.0.0.1:9880',
      apiKey: '',
      modelId: 'default',
      voice: 'default',
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: [],
      refAudioPath: '',
      promptText: '',
      promptLang: 'zh',
      textLang: 'zh'
    }
  }
  try {
    const saved = localStorage.getItem('baishou_tts_provider_configs')
    if (saved) {
      const parsed = JSON.parse(saved)
      // 融合 defaults 以确保结构完整
      return {
        'openai-tts': { ...defaults['openai-tts'], ...parsed['openai-tts'] },
        'mimo-tts': { ...defaults['mimo-tts'], ...parsed['mimo-tts'] },
        'clone-tts': { ...defaults['clone-tts'], ...parsed['clone-tts'] },
        'gpt-sovits': { ...defaults['gpt-sovits'], ...parsed['gpt-sovits'] }
      }
    }
  } catch (e) {}
  return defaults
}

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = ({
  initialConfig,
  providersList,
  onSaveConfig,
  onTestTts,
  onFetchModels
}) => {
  const { t } = useTranslation()
  const toast = useToast()

  const [providerType, setProviderType] = useState<string>('openai-tts')
  const [configs, setConfigs] = useState<Record<string, ProviderLocalState>>(getInitialConfigs)

  const [testText, setTestText] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showAllOptions, setShowAllOptions] = useState(false)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const updateCurrentConfig = useCallback(
    (updates: Partial<ProviderLocalState>) => {
      setConfigs((prev) => ({
        ...prev,
        [providerType]: {
          ...prev[providerType],
          ...updates
        }
      }))
    },
    [providerType]
  )

  // 将 configs 的更改自动持久化到 localStorage
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('baishou_tts_provider_configs', JSON.stringify(configs))
      } catch (e) {}
    }
  }, [configs, isInitialized])

  useEffect(() => {
    if (!isInitialized) {
      const newConfigs = { ...configs }

      // 1. 从 providersList 恢复各个 provider 的已保存配置 (主要包含 baseUrl, apiKey, models)
      if (Array.isArray(providersList)) {
        providersList.forEach((prov: any) => {
          if (
            prov.id === 'openai-tts' ||
            prov.id === 'mimo-tts' ||
            prov.id === 'clone-tts' ||
            prov.id === 'gpt-sovits'
          ) {
            const id = prov.id as 'openai-tts' | 'mimo-tts' | 'clone-tts' | 'gpt-sovits'
            newConfigs[id] = {
              ...newConfigs[id],
              baseUrl: prov.baseUrl !== undefined ? prov.baseUrl : newConfigs[id].baseUrl,
              apiKey: prov.apiKey || newConfigs[id].apiKey,
              modelId:
                prov.defaultDialogueModel ||
                (prov.models && prov.models[0]) ||
                newConfigs[id].modelId,
              availableModels:
                Array.isArray(prov.models) && prov.models.length > 0
                  ? prov.models
                  : newConfigs[id].availableModels
            }
          }
        })
      }

      // 2. 从 initialConfig（即当前已激活的配置）高优先级同步
      if (initialConfig && initialConfig.id) {
        const activeId = initialConfig.id
        setProviderType(activeId)
        if (
          activeId === 'openai-tts' ||
          activeId === 'mimo-tts' ||
          activeId === 'clone-tts' ||
          activeId === 'gpt-sovits'
        ) {
          const id = activeId as 'openai-tts' | 'mimo-tts' | 'clone-tts' | 'gpt-sovits'
          newConfigs[id] = {
            ...newConfigs[id],
            baseUrl:
              initialConfig.baseUrl !== undefined ? initialConfig.baseUrl : newConfigs[id].baseUrl,
            apiKey:
              initialConfig.apiKey !== undefined ? initialConfig.apiKey : newConfigs[id].apiKey,
            modelId:
              initialConfig.modelId !== undefined ? initialConfig.modelId : newConfigs[id].modelId,
            voice: initialConfig.voice !== undefined ? initialConfig.voice : newConfigs[id].voice,
            speed: initialConfig.speed !== undefined ? initialConfig.speed : newConfigs[id].speed,
            responseFormat:
              initialConfig.responseFormat !== undefined
                ? initialConfig.responseFormat
                : newConfigs[id].responseFormat,
            refAudioPath:
              (initialConfig as any).refAudioPath !== undefined
                ? (initialConfig as any).refAudioPath
                : newConfigs[id].refAudioPath,
            promptText:
              (initialConfig as any).promptText !== undefined
                ? (initialConfig as any).promptText
                : newConfigs[id].promptText,
            promptLang:
              (initialConfig as any).promptLang !== undefined
                ? (initialConfig as any).promptLang
                : newConfigs[id].promptLang,
            textLang:
              (initialConfig as any).textLang !== undefined
                ? (initialConfig as any).textLang
                : newConfigs[id].textLang
          }
        }
      }

      setConfigs(newConfigs)
      setIsInitialized(true)
    }
  }, [initialConfig, providersList, isInitialized, configs])

  const currentConfig = configs[providerType] || {
    baseUrl: '',
    apiKey: '',
    modelId: '',
    voice: '',
    speed: 1.0,
    responseFormat: 'mp3',
    availableModels: []
  }

  const handleFetchModels = useCallback(async () => {
    const { apiKey, baseUrl } = configs[providerType]
    const trimmedUrl = baseUrl.trim()
    if (
      !trimmedUrl &&
      (providerType === 'openai-tts' ||
        providerType === 'clone-tts' ||
        providerType === 'gpt-sovits')
    ) {
      toast.showError(t('tts.settings.base_url_required', '请填写 Base URL'))
      return
    }
    setIsLoadingModels(true)
    try {
      if (onFetchModels) {
        const models = await onFetchModels(providerType, apiKey.trim(), trimmedUrl)
        if (models && models.length > 0) {
          updateCurrentConfig({ availableModels: models })
          toast.showSuccess(t('tts.settings.fetch_models_success', '成功获取模型列表'))
        } else {
          toast.showWarning(t('tts.settings.fetch_models_empty', '未获取到可用模型'))
        }
      }
    } catch (error: any) {
      toast.showError(t('tts.settings.fetch_models_failed', '获取模型失败: ') + error.message)
    } finally {
      setIsLoadingModels(false)
    }
  }, [providerType, configs, onFetchModels, updateCurrentConfig, t, toast])

  const getProviderName = useCallback(
    (type: string) => {
      switch (type) {
        case 'openai-tts':
          return t('tts.settings.provider_openai', 'OpenAI 兼容 TTS')
        case 'mimo-tts':
          return t('tts.settings.provider_mimo', '小米 MiMo TTS')
        case 'clone-tts':
          return t('tts.settings.provider_clone', 'CloneTTS 本地服务')
        case 'gpt-sovits':
          return t('tts.settings.provider_gpt_sovits', 'GPT-SoVITS 本地服务')
        default:
          return type
      }
    },
    [t]
  )

  const providerOptions = React.useMemo(
    () => [
      { value: 'openai-tts', label: getProviderName('openai-tts') },
      { value: 'mimo-tts', label: getProviderName('mimo-tts') },
      { value: 'clone-tts', label: getProviderName('clone-tts') },
      { value: 'gpt-sovits', label: getProviderName('gpt-sovits') }
    ],
    [getProviderName]
  )

  const langOptions = React.useMemo(
    () => [
      { value: 'zh', label: t('tts.settings.lang_zh', '中文 (zh)') },
      { value: 'en', label: t('tts.settings.lang_en', '英文 (en)') },
      { value: 'ja', label: t('tts.settings.lang_ja', '日文 (ja)') },
      { value: 'ko', label: t('tts.settings.lang_ko', '韩文 (ko)') },
      { value: 'yue', label: t('tts.settings.lang_yue', '粤语 (yue)') }
    ],
    [t]
  )

  const defaultMimoVoice = t('tts.settings.default_voice_mimo', '冰糖')

  const formatOptions = [
    { value: 'mp3', label: 'MP3' },
    { value: 'wav', label: 'WAV' },
    { value: 'aac', label: 'AAC' }
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const getModelOptions = useCallback(() => {
    const { modelId, availableModels } = configs[providerType]
    const defaults =
      providerType === 'clone-tts' || providerType === 'gpt-sovits'
        ? ['default']
        : providerType === 'mimo-tts'
          ? ['mimo-v2.5-tts']
          : ['tts-1', 'tts-1-hd']
    const baseOptions = availableModels.length > 0 ? availableModels : defaults
    if (showAllOptions || !modelId.trim()) return baseOptions
    const filtered = baseOptions.filter((opt) =>
      opt.toLowerCase().includes(modelId.toLowerCase().trim())
    )
    return filtered.length > 0 ? filtered : baseOptions
  }, [providerType, configs, showAllOptions])

  const handleSelectModel = useCallback(
    (val: string) => {
      updateCurrentConfig(
        providerType === 'clone-tts' || providerType === 'gpt-sovits'
          ? { modelId: val, voice: val }
          : { modelId: val }
      )
      setIsDropdownOpen(false)
    },
    [updateCurrentConfig, providerType]
  )

  const handleSave = useCallback(async () => {
    const {
      apiKey,
      baseUrl,
      modelId,
      voice,
      speed,
      responseFormat,
      refAudioPath,
      promptText,
      promptLang,
      textLang
    } = configs[providerType]
    if (
      !baseUrl.trim() &&
      (providerType === 'openai-tts' ||
        providerType === 'clone-tts' ||
        providerType === 'gpt-sovits')
    ) {
      toast.showError(t('tts.settings.base_url_required', '请填写 Base URL'))
      return
    }

    setIsSaving(true)
    try {
      await onSaveConfig?.({
        id: providerType,
        name: getProviderName(providerType),
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiKey: apiKey.trim(),
        modelId,
        voice:
          voice.trim() ||
          (providerType === 'mimo-tts'
            ? defaultMimoVoice
            : providerType === 'clone-tts' || providerType === 'gpt-sovits'
              ? 'default'
              : 'alloy'),
        speed,
        responseFormat,
        refAudioPath,
        promptText,
        promptLang,
        textLang
      })
      toast.showSuccess(t('tts.settings.save_success', 'TTS 配置已保存'))
    } catch (error: any) {
      toast.showError(t('tts.settings.save_failed', '保存失败: ') + error.message)
    } finally {
      setIsSaving(false)
    }
  }, [providerType, configs, onSaveConfig, getProviderName, defaultMimoVoice, t, toast])

  const handleTest = useCallback(async () => {
    if (!testText.trim()) {
      toast.showError(t('tts.settings.test_text_required', '请输入测试文本'))
      return
    }

    const {
      apiKey,
      baseUrl,
      modelId,
      voice,
      speed,
      responseFormat,
      refAudioPath,
      promptText,
      promptLang,
      textLang
    } = configs[providerType]

    setIsTesting(true)
    try {
      const result = await onTestTts?.(
        {
          id: providerType,
          name: getProviderName(providerType),
          baseUrl: baseUrl.replace(/\/$/, ''),
          apiKey: apiKey.trim(),
          modelId,
          voice:
            voice.trim() ||
            (providerType === 'mimo-tts'
              ? defaultMimoVoice
              : providerType === 'clone-tts' || providerType === 'gpt-sovits'
                ? 'default'
                : 'alloy'),
          speed,
          responseFormat,
          refAudioPath,
          promptText,
          promptLang,
          textLang
        },
        testText.trim()
      )

      if (result?.success && result.audioBase64) {
        const audio = new Audio(`data:audio/${result.format || 'mp3'};base64,${result.audioBase64}`)
        await audio.play()
        toast.showSuccess(t('tts.settings.test_success', '测试成功，正在播放'))
      } else {
        const errMsg = (result as any)?.error ? ` (${(result as any).error})` : ''
        toast.showError(t('tts.settings.test_failed', '测试失败') + errMsg)
      }
    } catch (error: any) {
      toast.showError(t('tts.settings.test_error', '测试出错: ') + error.message)
    } finally {
      setIsTesting(false)
    }
  }, [providerType, configs, testText, onTestTts, getProviderName, defaultMimoVoice, t, toast])

  const showSpeedControl =
    providerType === 'openai-tts' || providerType === 'clone-tts' || providerType === 'gpt-sovits'

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.title}>{t('tts.settings.title', 'TTS 语音合成设置')}</h2>
          <HelpTooltip
          content={t(
            'tts.settings.page_tooltip',
            '配置全局语音合成供应商、模型与发音人。OpenAI 兼容网关可只填 Base URL，无需 API Key 时留空即可获取模型并试听。'
          )}
        />
        </div>
      </div>

      <div className={styles.scrollArea}>

      <div className={styles.form}>
        <div className={styles.section}>
          <label className={styles.label}>{t('tts.settings.provider_label', 'TTS 供应商')}</label>
          <Select
            options={providerOptions}
            value={providerType}
            onChange={(e) => {
              const newType = e.target.value
              setProviderType(newType)
            }}
          />
        </div>

        <div className={styles.section}>
          <Input
            label={t('tts.settings.base_url_label', 'API Base URL')}
            placeholder={
              providerType === 'clone-tts'
                ? 'http://127.0.0.1:8080'
                : providerType === 'gpt-sovits'
                  ? 'http://127.0.0.1:9880'
                  : providerType === 'mimo-tts'
                    ? t(
                        'tts.settings.mimo_base_url_placeholder',
                        '留空使用默认服务，或填入自定义服务 URL'
                      )
                    : 'https://api.openai.com/v1'
            }
            value={currentConfig.baseUrl}
            onChange={(e) => updateCurrentConfig({ baseUrl: e.target.value })}
          />
        </div>

        {providerType !== 'clone-tts' && providerType !== 'gpt-sovits' && (
          <div className={styles.section}>
            <div className={styles.labelRow}>
              <label className={styles.label}>
                {providerType === 'openai-tts' || providerType === 'mimo-tts'
                  ? t('tts.settings.api_key_optional_label', 'API Key（可选）')
                  : t('tts.settings.api_key_label', 'API Key')}
              </label>
              {(providerType === 'openai-tts' || providerType === 'mimo-tts') && (
                <HelpTooltip
                  content={t(
                    'tts.settings.api_key_tooltip',
                    '若你的兼容网关无需鉴权可留空；需要密钥时再填写，获取模型与试听会按需携带。'
                  )}
                />
              )}
            </div>
            <div className={styles.passwordInputWrapper}>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={t('tts.settings.api_key_placeholder', 'sk-...（可选）')}
                value={currentConfig.apiKey}
                onChange={(e) => updateCurrentConfig({ apiKey: e.target.value })}
                className={styles.passwordInput}
              />
              <div
                className={styles.passwordToggle}
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? t('common.hide', '隐藏') : t('common.show', '显示')}
              >
                {showApiKey ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={styles.comboboxContainer} ref={comboboxRef}>
          <label className={styles.comboboxLabel}>
            {t('tts.settings.model_id_label', '模型 ID')}
          </label>
          <div className={styles.modelInputRow}>
            <div className={styles.comboboxWrapper}>
              <input
                type="text"
                placeholder={
                  providerType === 'clone-tts' || providerType === 'gpt-sovits'
                    ? 'default'
                    : providerType === 'mimo-tts'
                      ? 'mimo-v2.5-tts'
                      : 'tts-1'
                }
                value={currentConfig.modelId}
                onChange={(e) => {
                  updateCurrentConfig({ modelId: e.target.value })
                  setIsDropdownOpen(true)
                  setShowAllOptions(false)
                }}
                onFocus={() => {
                  setIsDropdownOpen(true)
                  setShowAllOptions(false)
                }}
                className={styles.comboboxInput}
              />
              <div
                className={`${styles.comboboxArrow} ${isDropdownOpen ? styles.rotated : ''}`}
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen)
                  setShowAllOptions(true)
                }}
              >
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {isDropdownOpen && (
                <div className={styles.comboboxDropdown}>
                  <ul className={styles.comboboxOptionsList}>
                    {getModelOptions().map((opt) => {
                      const isSelected = opt === currentConfig.modelId
                      return (
                        <li
                          key={opt}
                          className={`${styles.comboboxOptionItem} ${isSelected ? styles.selected : ''}`}
                          onClick={() => handleSelectModel(opt)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <span className={styles.optionText}>{opt}</span>
                          {isSelected && (
                            <span className={styles.checkIcon}>
                              <svg
                                width="12"
                                height="9"
                                viewBox="0 0 12 9"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M1 4.5L4.33333 7.5L11 1.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
            {onFetchModels && (
              <Button
                variant="elevated"
                onClick={handleFetchModels}
                disabled={isLoadingModels}
                className={styles.fetchModelsBtn}
              >
                {isLoadingModels
                  ? t('tts.settings.fetching_models', '获取中...')
                  : t('tts.settings.fetch_models', '获取')}
              </Button>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <Input
            label={t('tts.settings.voice_label', '发音人 (Voice ID)')}
            placeholder={
              providerType === 'clone-tts' || providerType === 'gpt-sovits'
                ? 'default'
                : providerType === 'mimo-tts'
                  ? defaultMimoVoice
                  : 'alloy'
            }
            value={currentConfig.voice}
            onChange={(e) => updateCurrentConfig({ voice: e.target.value })}
          />
          <span className={styles.hint}>
            {t('tts.settings.voice_hint', '请输入当前模型支持的具体发音人/音色 ID')}
          </span>
        </div>

        {providerType === 'gpt-sovits' && (
          <>
            <div className={styles.section}>
              <Input
                label={t('tts.settings.ref_audio_path_label', '参考音频绝对路径 (refAudioPath)')}
                placeholder={t(
                  'tts.settings.ref_audio_path_placeholder',
                  '必填，例如：D:\\audio\\prompt.wav'
                )}
                value={currentConfig.refAudioPath || ''}
                onChange={(e) => updateCurrentConfig({ refAudioPath: e.target.value })}
              />
            </div>
            <div className={styles.section}>
              <Input
                label={t('tts.settings.prompt_text_label', '参考音频文本 (promptText)')}
                placeholder={t(
                  'tts.settings.prompt_text_placeholder',
                  '必填，参考音频内说话的文字内容'
                )}
                value={currentConfig.promptText || ''}
                onChange={(e) => updateCurrentConfig({ promptText: e.target.value })}
              />
            </div>
            <div className={styles.section}>
              <label className={styles.label}>
                {t('tts.settings.prompt_lang_label', '参考音频语言 (promptLang)')}
              </label>
              <Select
                options={langOptions}
                value={currentConfig.promptLang || 'zh'}
                onChange={(e) => updateCurrentConfig({ promptLang: e.target.value })}
              />
            </div>
            <div className={styles.section}>
              <label className={styles.label}>
                {t('tts.settings.text_lang_label', '合成文本语言 (textLang)')}
              </label>
              <Select
                options={langOptions}
                value={currentConfig.textLang || 'zh'}
                onChange={(e) => updateCurrentConfig({ textLang: e.target.value })}
              />
            </div>
          </>
        )}

        {showSpeedControl && (
          <div className={styles.section}>
            <div className={styles.sliderHeader}>
              <label className={styles.label}>
                {t('tts.settings.speed_label', '语速比例 (Speed)')}
              </label>
              <span className={styles.sliderValue}>{currentConfig.speed.toFixed(1)}x</span>
            </div>
            <div className={styles.sliderWrapper}>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={currentConfig.speed}
                onChange={(e) => updateCurrentConfig({ speed: parseFloat(e.target.value) })}
                className={styles.rangeInput}
              />
            </div>
          </div>
        )}

        <div className={styles.section}>
          <label className={styles.label}>{t('tts.settings.format_label', '音频格式')}</label>
          <Select
            options={formatOptions}
            value={currentConfig.responseFormat}
            onChange={(e) => updateCurrentConfig({ responseFormat: e.target.value })}
          />
        </div>

        <div className={`${styles.section} ${styles.fullWidthSection}`}>
          <label className={styles.label}>{t('tts.settings.test_label', '测试 TTS')}</label>
          <div className={styles.testRow}>
            <Input
              placeholder={t('tts.settings.test_placeholder', '输入一段文本测试语音合成效果')}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className={styles.testInput}
            />
            <Button
              variant="elevated"
              onClick={handleTest}
              disabled={isTesting}
              className={styles.testBtn}
            >
              {isTesting
                ? t('tts.settings.testing', '测试中...')
                : t('tts.settings.test_button', '测试')}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="elevated" onClick={handleSave} disabled={isSaving}>
          {t('common.save', '保存配置')}
        </Button>
      </div>
      </div>
    </div>
  )
}
