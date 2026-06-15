import React from 'react'
import styles from './ContextChainDialog.module.css'
import { MockChatMessage } from '@baishou/shared'
import { useTranslation } from 'react-i18next'

export interface ContextChainDialogProps {
  isOpen: boolean
  onClose: () => void
  message: MockChatMessage
  contextMessages: MockChatMessage[]
  compressedContent?: string
  originalContent?: string
  systemPrompt?: string
}

export const ContextChainDialog: React.FC<ContextChainDialogProps> = ({
  isOpen,
  onClose,
  message,
  contextMessages,
  compressedContent,
  originalContent,
  systemPrompt
}) => {
  const { t } = useTranslation()
  const [selectedMsgIndex, setSelectedMsgIndex] = React.useState<number | null>(null)
  const [activeTab, setActiveTab] = React.useState<
    'context' | 'compressed' | 'original' | 'prompt'
  >('context')

  React.useEffect(() => {
    if (isOpen) {
      setSelectedMsgIndex(null)
      setActiveTab('context')
    }
  }, [isOpen, message.id])

  if (!isOpen) return null

  const totalInputTokens = message.inputTokens || 0
  const totalOutputTokens = message.outputTokens || 0
  const cacheRead = message.cacheReadInputTokens || 0
  const cacheWrite = message.cacheWriteInputTokens || 0
  const costText = message.costMicros ? `$${(message.costMicros / 1000000).toFixed(4)}` : null

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'system':
        return t('agent.chat.role_system', '系统')
      case 'user':
        return t('agent.chat.role_user', '用户')
      case 'assistant':
        return t('agent.chat.role_assistant', 'AI 助手')
      case 'tool':
        return t('agent.chat.role_tool', '工具')
      default:
        return role
    }
  }

  const getMessageLabel = (msg: MockChatMessage) => msg.label || getRoleLabel(msg.role)

  const systemPromptInChain = contextMessages.some(
    (m) => m.role === 'system' && m.label === '系统提示词'
  )

  const getRoleColorClass = (role: string) => {
    switch (role) {
      case 'user':
        return styles.roleUser
      case 'assistant':
        return styles.roleAssistant
      case 'system':
        return styles.roleSystem
      case 'tool':
        return styles.roleTool
      default:
        return styles.roleDefault
    }
  }

  const tabs = [
    { key: 'context', label: t('agent.chat.tab_call_chain', '调用链') },
    ...(compressedContent
      ? [
          {
            key: 'compressed',
            label: t('agent.chat.tab_compressed', '压缩摘要')
          }
        ]
      : []),
    ...(originalContent
      ? [{ key: 'original', label: t('agent.chat.tab_original', '界面原文') }]
      : []),
    ...(systemPrompt && !systemPromptInChain
      ? [{ key: 'prompt', label: t('agent.chat.tab_prompt', '系统提示词') }]
      : [])
  ]

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon}>🌿</span>
            <span className={styles.title}>{t('agent.chat.full_call_chain', '完整调用链')}</span>
            <span className={styles.badge}>{contextMessages.length}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        {(totalInputTokens > 0 || totalOutputTokens > 0 || cacheRead > 0 || cacheWrite > 0) && (
          <div className={styles.statsRow}>
            <div className={styles.statChip}>
              <span className={styles.statIcon}>↑</span>
              <span>
                {t('agent.chat.round_input', '入')} {totalInputTokens}
              </span>
            </div>
            <div className={styles.statChip}>
              <span className={styles.statIcon}>↓</span>
              <span>
                {t('agent.chat.round_output', '出')} {totalOutputTokens}
              </span>
            </div>
            {cacheRead > 0 ? (
              <div className={styles.statChip}>
                <span title={t('agent.chat.cache_read', '缓存读取')}>
                  {t('agent.chat.cache_label', '缓存：')}
                  {cacheRead}
                </span>
              </div>
            ) : null}
            {cacheWrite > 0 ? (
              <div className={styles.statChip}>
                <span title={t('agent.chat.cache_write', '缓存写入')}>
                  {t('agent.chat.cache_label', '缓存：')}
                  {cacheWrite}
                </span>
              </div>
            ) : null}
            {costText && (
              <div className={styles.statChip}>
                <span className={styles.statIcon}>$</span>
                <span>
                  {t('agent.chat.round_cost', '耗')} {costText}
                </span>
              </div>
            )}
          </div>
        )}

        {tabs.length > 1 && (
          <div className={styles.tabsContainer}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.divider} />

        {activeTab === 'context' && (
          <div className={styles.listContainer}>
            {contextMessages.length === 0 ? (
              <div className={styles.emptyHint}>
                {t('agent.chat.no_context_messages', '暂无发送给 AI 的上下文记录')}
              </div>
            ) : (
              contextMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={styles.messageItem}
                  onClick={() => setSelectedMsgIndex(idx)}
                >
                  <span className={styles.msgIndex}>{idx + 1}</span>
                  <span
                    className={`${styles.msgRole} ${getRoleColorClass(msg.role)}`}
                    title={msg.label ? getRoleLabel(msg.role) : undefined}
                  >
                    {getMessageLabel(msg)}
                  </span>
                  <div className={styles.msgPreview}>
                    {msg.content
                      ? msg.content.length > 200
                        ? `${msg.content.slice(0, 200)}…`
                        : msg.content
                      : msg.toolInvocations
                        ? '→ Toolbar interaction'
                        : t('agent.chat.empty_content', '[空文本]')}
                  </div>
                  <span className={styles.chevron}>›</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'compressed' && compressedContent && (
          <div className={styles.contentArea}>
            <pre className={styles.contentPre}>{compressedContent}</pre>
          </div>
        )}

        {activeTab === 'original' && originalContent && (
          <div className={styles.contentArea}>
            <pre className={styles.contentPre}>{originalContent}</pre>
          </div>
        )}

        {activeTab === 'prompt' && systemPrompt && (
          <div className={styles.contentArea}>
            <pre className={styles.contentPre}>{systemPrompt}</pre>
          </div>
        )}
      </div>

      {selectedMsgIndex !== null && (
        <div
          className={styles.detailOverlay}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedMsgIndex(null)
          }}
        >
          <div className={styles.detailDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <span
                  className={`${styles.msgRole} ${getRoleColorClass(contextMessages[selectedMsgIndex].role)}`}
                >
                  {getMessageLabel(contextMessages[selectedMsgIndex])}
                </span>
                <span className={styles.detailIndex}>#{selectedMsgIndex + 1}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedMsgIndex(null)}>
                ×
              </button>
            </div>
            <div
              className={styles.detailContent}
              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
            >
              {contextMessages[selectedMsgIndex].content || t('agent.chat.no_content', '[无内容]')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
