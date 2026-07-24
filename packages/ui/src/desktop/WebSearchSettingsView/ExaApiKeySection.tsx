import React from 'react'
import { useTranslation } from 'react-i18next'
import { HelpTooltip } from '../HelpTooltip'
import styles from './WebSearchSettingsView.module.css'
import stack from '../shared/SettingsStack.module.css'
import { Eye, EyeOff, Key, Save } from 'lucide-react'

interface ExaApiKeySectionProps {
  localApiKey: string
  apiKeyVisible: boolean
  onApiKeyChange: (value: string) => void
  onToggleVisibility: () => void
  onSave: () => void
}

export const ExaApiKeySection: React.FC<ExaApiKeySectionProps> = ({
  localApiKey,
  apiKeyVisible,
  onApiKeyChange,
  onToggleVisibility,
  onSave
}) => {
  const { t } = useTranslation()

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>{t('agent.tools.param_exa_api_key', 'Exa API Key')}</h3>
        <HelpTooltip
          size={14}
          content={t(
            'agent.tools.param_exa_api_key_desc',
            '请前往 Exa 控制台申请 API Key（https://dashboard.exa.ai/api-keys）'
          )}
        />
      </div>
      <div className={stack.cardSection}>
        <div className={styles.apiConfigBody}>
          <div className={styles.textFieldWrapper}>
            <Key size={20} className={styles.textFieldIcon} />
            <input
              type={apiKeyVisible ? 'text' : 'password'}
              placeholder="exa-xxxxxx"
              className={styles.textFieldInput}
              value={localApiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
            />
            <button className={styles.iconIconButton} onClick={onToggleVisibility}>
              {apiKeyVisible ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
            <button className={styles.iconIconButton} onClick={onSave}>
              <Save size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
