import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { MdAutoAwesome } from 'react-icons/md'
import { getProviderIcon } from '../../utils/provider-icons'
import { useTheme } from '../../hooks'
import styles from './AssistantEditPage.module.css'

interface AssistantEditModelBindingProps {
  providerId?: string
  modelId?: string
  onOpenPicker: () => void
  onClearBinding: () => void
}

export const AssistantEditModelBinding: React.FC<AssistantEditModelBindingProps> = ({
  providerId,
  modelId,
  onOpenPicker,
  onClearBinding
}) => {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const providerIconSrc = providerId ? getProviderIcon(providerId, isDark) : undefined

  return (
    <>
      <div className={styles.row}>
        <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
          {t('agent.assistant.bind_model_label', '绑定模型')}
        </label>
      </div>
      <div className={styles.spacer8} />
      <div className={styles.modelCard} onClick={onOpenPicker}>
        <div className={styles.modelIcon}>
          {providerIconSrc ? (
            <img
              src={providerIconSrc}
              alt={providerId}
              style={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          ) : (
            <MdAutoAwesome size={24} color="var(--color-primary)" />
          )}
        </div>
        <div className={styles.modelInfo}>
          {providerId ? (
            <>
              <span className={styles.modelSup}>{providerId}</span>
              <span className={styles.modelSub}>{modelId}</span>
            </>
          ) : (
            <span className={styles.modelSub}>
              {t('agent.assistant.use_global_model', '使用全局模型')}
            </span>
          )}
        </div>
        <ChevronRight size={20} color="var(--text-secondary, #64748B)" />
      </div>
      {providerId ? (
        <button type="button" className={styles.restoreDefaultBtn} onClick={onClearBinding}>
          {t('common.restore_default', '恢复默认')}
        </button>
      ) : null}
      <div className={styles.descText} style={{ marginTop: 8 }}>
        {t('agent.assistant.bind_model_desc', '绑定后，和伙伴创建对话时，会默认优先使用选择的模型')}
      </div>
    </>
  )
}
