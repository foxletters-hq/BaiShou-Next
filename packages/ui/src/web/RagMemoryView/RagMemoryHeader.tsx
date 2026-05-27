import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdDeleteSweep } from 'react-icons/md'
import { Switch } from '../Switch/Switch'
import { HelpTooltip } from '../HelpTooltip'
import type { RagConfig, RagStats } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryHeaderProps {
  config: RagConfig
  stats: RagStats
  onChange: (config: RagConfig) => void
  onClearAll?: () => Promise<void>
}

export const RagMemoryHeader: React.FC<RagMemoryHeaderProps> = ({
  config,
  stats,
  onChange,
  onClearAll
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.headerRow}>
      <div className={styles.titleInfo}>
        <h2 className={styles.title}>{t('agent.rag.title', 'RAG 记忆管理')}</h2>
        <HelpTooltip
          content={t(
            'settings.tooltip_rag_management',
            '这是用以支持 AI 检索过去日记等上下文的本地 RAG（检索增强生成）知识库。它可以根据您的输入或日记变更自动更新，以实现长短期记忆的近似语义召回。'
          )}
          className={styles.titleTooltip}
          size={16}
        />
        <Switch
          checked={config.ragEnabled}
          onChange={(e) => onChange({ ...config, ragEnabled: e.target.checked })}
        />
      </div>

      {stats.totalCount > 0 && (
        <button className={styles.headerClearAllBtn} onClick={onClearAll}>
          <MdDeleteSweep size={18} />
          <span>{t('settings.rag_clear_all', '清空现有记忆')}</span>
        </button>
      )}
    </div>
  )
}
