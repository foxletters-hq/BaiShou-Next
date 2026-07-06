import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Wrench, X } from 'lucide-react'
import type { AgentToolsViewProps } from './agent-tools.types'
import { useAgentToolsView } from './useAgentToolsView'
import { AgentToolsBuiltInList } from './AgentToolsBuiltInList'
import { EmojiSettingsGroupsView, EmojiGroupDetailView } from '../EmojiSettingsView'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import styles from './AgentToolsView.module.css'

export type { ToolManagementConfig, AgentToolsViewProps } from './agent-tools.types'

type EmojiSubview = 'none' | 'groups' | 'detail'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  presentation = 'page',
  onClose
}) => {
  const { t } = useTranslation()
  const view = useAgentToolsView({ config, onChange })
  const [emojiSubview, setEmojiSubview] = useState<EmojiSubview>('none')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const isDialog = presentation === 'dialog'

  const emojiConfig = normalizeEmojiToolConfig(config.emojiConfig)
  const containerClass = isDialog
    ? `${styles.container} ${styles.containerDialog}`
    : styles.container
  const headerClass = isDialog ? `${styles.header} ${styles.headerDialog}` : styles.header
  const scrollClass = isDialog
    ? `${styles.scrollArea} ${styles.scrollAreaDialog}`
    : styles.scrollArea

  const handleEmojiConfigChange = (nextEmojiConfig: typeof emojiConfig) => {
    onChange({ ...config, emojiConfig: nextEmojiConfig })
  }

  if (emojiSubview !== 'none') {
    return (
      <div className={containerClass}>
        <div className={`${headerClass} ${styles.emojiSubHeader}`}>
          <button
            type="button"
            className={styles.emojiBackBtn}
            onClick={() => {
              if (emojiSubview === 'detail') {
                setEmojiSubview('groups')
                return
              }
              setEmojiSubview('none')
              setSelectedGroupId(null)
            }}
          >
            <ArrowLeft size={18} />
            {t('common.back', '返回')}
          </button>
        </div>
        <div className={scrollClass}>
          {emojiSubview === 'groups' ? (
            <EmojiSettingsGroupsView
              config={emojiConfig}
              onChange={handleEmojiConfigChange}
              onOpenGroup={(groupId) => {
                setSelectedGroupId(groupId)
                setEmojiSubview('detail')
              }}
            />
          ) : selectedGroupId ? (
            <EmojiGroupDetailView
              config={emojiConfig}
              groupId={selectedGroupId}
              onChange={handleEmojiConfigChange}
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <div className={styles.headerMain}>
          {isDialog ? (
            <div className={styles.titleRow}>
              <span className={styles.titleIcon}>
                <Wrench size={20} />
              </span>
              <div className={styles.titleBlock}>
                <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
                <p className={styles.headerSubtitle}>
                  {t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}
                </p>
              </div>
            </div>
          ) : (
            <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
          )}
        </div>
        {isDialog && onClose ? (
          <button
            type="button"
            className={styles.dialogCloseBtn}
            onClick={onClose}
            aria-label={t('common.close', '关闭')}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className={scrollClass}>
        {!isDialog ? (
          <p className={styles.subtitle}>
            {t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}
          </p>
        ) : null}

        <AgentToolsBuiltInList
          config={config}
          allTools={view.allTools}
          categoryMeta={view.categoryMeta}
          groupedTools={view.groupedTools}
          showCommunity={view.showCommunity}
          onShowCommunityChange={view.setShowCommunity}
          onToggleTool={view.toggleTool}
          getToolParam={view.getToolParam}
          setToolParam={view.setToolParam}
          onConfigChange={onChange}
          onOpenEmojiSettings={() => setEmojiSubview('groups')}
        />
      </div>
    </div>
  )
}
