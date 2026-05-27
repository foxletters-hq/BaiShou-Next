import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ChevronRight } from 'lucide-react'
import { MdCloud } from 'react-icons/md'
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

  return (
    <>
      <div className={styles.row}>
        <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>
          {t('agent.assistant.bind_model_label', '绑定模型')}
        </label>
        <div style={{ flex: 1 }} />
        {providerId && (
          <button className={styles.textBtn} onClick={onClearBinding}>
            {t('agent.assistant.use_global_model', '使用全局模型')}
          </button>
        )}
      </div>
      <div className={styles.spacer8} />
      {!providerId ? (
        <button className={styles.outlinedBtn} onClick={onOpenPicker}>
          <Plus size={18} style={{ marginRight: 8 }} />
          {t('agent.assistant.select_model_label', '选择模型')}
        </button>
      ) : (
        <div className={styles.modelCard} onClick={onOpenPicker}>
          <div className={styles.modelIcon}>
            {(() => {
              const iconSrc = providerId ? getProviderIcon(providerId, isDark) : undefined
              if (iconSrc) {
                return (
                  <img
                    src={iconSrc}
                    alt={providerId}
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                )
              }
              return <MdCloud size={24} color="var(--text-tertiary, #999)" />
            })()}
          </div>
          <div className={styles.modelInfo}>
            <span className={styles.modelSup}>{providerId}</span>
            <span className={styles.modelSub}>{modelId}</span>
          </div>
          <ChevronRight size={20} color="var(--text-secondary, #64748B)" />
        </div>
      )}
      <div className={styles.descText} style={{ marginTop: 4 }}>
        {t('agent.assistant.bind_model_desc', '绑定后，和伙伴创建对话时，会默认优先使用选择的模型')}
      </div>
    </>
  )
}
