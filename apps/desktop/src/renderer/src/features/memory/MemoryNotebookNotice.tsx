import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styles from './MemoryHelpButton.module.css'

export const MemoryNotebookNotice: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <p className={styles.notice}>
      {t('memory.notebook_notice', '笔记本资料的向量和关系图在各自笔记本里管理，不并入这里。')}{' '}
      <button
        type="button"
        className={styles.noticeLink}
        onClick={() => {
          onOpen?.()
          navigate('/agent-workspace/knowledge')
        }}
      >
        {t('memory.open_notebooks', '打开知识库')}
      </button>
    </p>
  )
}
