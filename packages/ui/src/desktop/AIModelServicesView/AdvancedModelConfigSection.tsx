import React from 'react'
import { MdTune } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import { HelpTooltip } from '../HelpTooltip'
import type { AiProviderAdvancedConfig } from '@baishou/shared'

export interface AdvancedModelConfigSectionProps {
  value: AiProviderAdvancedConfig | undefined
  onChange: (config: AiProviderAdvancedConfig) => void
  t: (key: string, fallback: string) => string
}

export const AdvancedModelConfigSection: React.FC<AdvancedModelConfigSectionProps> = ({
  value = {},
  onChange,
  t
}) => {
  const handleNumberChange = (field: keyof AiProviderAdvancedConfig, rawValue: string) => {
    // 空字符串时删除该字段
    if (rawValue === '') {
      const newConfig = { ...value }
      delete newConfig[field]
      onChange(newConfig)
      return
    }

    const numValue = parseFloat(rawValue)
    if (!isNaN(numValue)) {
      onChange({
        ...value,
        [field]: numValue
      })
    }
  }

  return (
    <div className={styles.formCard} style={{ marginTop: 16 }}>
      <div className={styles.formHeaderRow}>
        <div className={styles.formHeaderTitle}>
          <div className={styles.apiIconBox}>
            <MdTune className={styles.apiIcon} />
          </div>
          <span>{t('settings.advanced_config', '高级参数')}</span>
          <HelpTooltip
            content={t(
              'ai_config.advanced_config_help',
              '调整模型的采样参数。留空表示使用模型默认值。不同提供商支持的参数有所不同。'
            )}
            size={16}
          />
        </div>
      </div>

      <div className={styles.advancedConfigGrid}>
        {/* Temperature */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.temperature', 'Temperature')}
            <HelpTooltip
              content={t(
                'ai_config.temperature_help',
                '控制输出随机性。范围 0-2，值越高输出越随机。'
              )}
              size={14}
            />
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={value.temperature ?? ''}
            onChange={(e) => handleNumberChange('temperature', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>

        {/* TopK */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.topK', 'Top K')}
            <HelpTooltip
              content={t('ai_config.topK_help', '从概率最高的 K 个词中采样。范围 1-100。')}
              size={14}
            />
          </label>
          <input
            type="number"
            step="1"
            min="1"
            max="100"
            value={value.topK ?? ''}
            onChange={(e) => handleNumberChange('topK', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>

        {/* TopP */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.topP', 'Top P')}
            <HelpTooltip
              content={t('ai_config.topP_help', '累计概率阈值采样。范围 0-1，值越小输出越确定。')}
              size={14}
            />
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={value.topP ?? ''}
            onChange={(e) => handleNumberChange('topP', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>

        {/* MaxTokens */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.maxTokens', 'Max Tokens')}
            <HelpTooltip
              content={t('ai_config.maxTokens_help', '最大输出 token 数。范围 1-32000。')}
              size={14}
            />
          </label>
          <input
            type="number"
            step="1"
            min="1"
            max="32000"
            value={value.maxTokens ?? ''}
            onChange={(e) => handleNumberChange('maxTokens', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>

        {/* Frequency Penalty */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.frequencyPenalty', 'Frequency Penalty')}
            <HelpTooltip
              content={t(
                'ai_config.frequencyPenalty_help',
                '降低重复词汇的概率。范围 -2.0 至 2.0。'
              )}
              size={14}
            />
          </label>
          <input
            type="number"
            step="0.1"
            min="-2"
            max="2"
            value={value.frequencyPenalty ?? ''}
            onChange={(e) => handleNumberChange('frequencyPenalty', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>

        {/* Presence Penalty */}
        <div className={styles.advancedConfigItem}>
          <label className={styles.advancedConfigLabel}>
            {t('ai_config.presencePenalty', 'Presence Penalty')}
            <HelpTooltip
              content={t(
                'ai_config.presencePenalty_help',
                '鼓励模型讨论新话题。范围 -2.0 至 2.0。'
              )}
              size={14}
            />
          </label>
          <input
            type="number"
            step="0.1"
            min="-2"
            max="2"
            value={value.presencePenalty ?? ''}
            onChange={(e) => handleNumberChange('presencePenalty', e.target.value)}
            placeholder={t('ai_config.default_value', '默认')}
            className={styles.advancedConfigInput}
          />
        </div>
      </div>
    </div>
  )
}
