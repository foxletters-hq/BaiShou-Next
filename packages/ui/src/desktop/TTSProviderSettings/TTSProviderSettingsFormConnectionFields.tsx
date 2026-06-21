import React from 'react'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { HelpTooltip } from '../HelpTooltip'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'

export function TTSProviderSettingsFormConnectionFields({
  vm
}: {
  vm: TTSProviderSettingsViewModel
}) {
  const {
    t,
    providerType,
    setProviderType,
    currentConfig,
    updateCurrentConfig,
    providerOptions,
    showApiKey,
    setShowApiKey
  } = vm

  return (
    <>
      <div className={styles.section}>
        <label className={styles.label}>{t('tts.settings.provider_label', 'TTS 供应商')}</label>
        <Select
          options={providerOptions}
          value={providerType}
          onChange={(e) => {
            setProviderType(e.target.value)
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
                ? 'http://127.0.0.1:9872'
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
    </>
  )
}
