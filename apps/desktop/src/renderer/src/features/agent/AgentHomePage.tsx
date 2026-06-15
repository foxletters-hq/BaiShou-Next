import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { InputBar } from '@baishou/ui'
import { usePromptShortcutStore } from '@baishou/store'
import { MdAutoAwesome } from 'react-icons/md'
import styles from './AgentHome.module.css'

/**
 * /agent 路由的右侧空态落地页。
 * 1:1 还原 Flutter 版本的 AgentChatEmptyState：
 * - 上方居中的星芒图标（原版的 LinearGradient 渐变圆底）
 * - 中间"开始新的对话"标题
 * - 下方固定的 InputBar（与 AgentScreen 共享同款胶囊输入框）
 */
export const AgentHomePage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { shortcuts, loadShortcuts } = usePromptShortcutStore()

  useEffect(() => {
    void loadShortcuts()
  }, [loadShortcuts])

  const handleSend = (text: string) => {
    const newId = `new-${Date.now()}`
    navigate(`/chat/${newId}?init=${encodeURIComponent(text)}`)
  }

  return (
    <div className={styles.emptyPanel}>
      <div className={styles.emptyContent}>
        <div className={styles.iconCircle}>
          <MdAutoAwesome className={styles.awesomeIcon} />
        </div>
        <h2 className={styles.emptyTitle}>{t('agent.home.start_new_chat', '开始新的对话')}</h2>
        <p className={styles.emptySubtitle}>
          {t('agent.home.empty_subtitle', '在下方输入框随便说点什么，或者点击左侧发起新对话～')}
        </p>
      </div>

      <div className={styles.inputDock}>
        <InputBar
          isLoading={false}
          onSend={handleSend}
          shortcuts={shortcuts}
          onManageShortcuts={() => navigate('/chat/new-session?focus=manage-shortcuts')}
        />
      </div>
    </div>
  )
}
