import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdSave, MdKey, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { HelpTooltip } from '../HelpTooltip'
import styles from './WebSearchSettingsView.module.css'

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
    <div className={styles.cardSection}>
      <div className={styles.apiConfigBody}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardTitle}>{t('agent.tools.param_exa_api_key', 'Exa API Key')}</h3>
          <HelpTooltip
            content={t(
              'agent.tools.param_exa_api_key_desc',
              '请前往 Exa 控制台申请 API Key（https://dashboard.exa.ai/api-keys）'
            )}
          />
        </div>

        <div className={styles.textFieldWrapper}>
          <MdKey size={20} className={styles.textFieldIcon} />
          <input
            type={apiKeyVisible ? 'text' : 'password'}
            placeholder="exa-xxxxxx"
            className={styles.textFieldInput}
            value={localApiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
          <button className={styles.iconIconButton} onClick={onToggleVisibility}>
            {apiKeyVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
          </button>
          <button className={styles.iconIconButton} onClick={onSave}>
            <MdSave size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
