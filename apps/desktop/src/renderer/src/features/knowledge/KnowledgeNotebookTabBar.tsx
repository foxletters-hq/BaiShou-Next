import React from 'react'
import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@baishou/ui'
import type { KnowledgeNotebookTab } from './knowledge-notebook-tab.util'
import styles from './KnowledgePage.module.css'

interface KnowledgeNotebookTabBarProps {
  activeTab: KnowledgeNotebookTab
  onTabChange: (tab: KnowledgeNotebookTab) => void
}

export const KnowledgeNotebookTabBar: React.FC<KnowledgeNotebookTabBarProps> = ({
  activeTab,
  onTabChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.detailTabBar}>
      <SegmentedControl
        value={activeTab}
        aria-label={t('knowledge.notebook_tabs', '笔记本页面')}
        options={[
          { value: 'chat', label: t('knowledge.tab_chat', '聊天') },
          { value: 'graph', label: t('knowledge.tab_graph', '图数据') },
          { value: 'vectors', label: t('knowledge.tab_vectors', '向量知识库') }
        ]}
        onChange={onTabChange}
      />
    </div>
  )
}
