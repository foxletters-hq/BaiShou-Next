import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Wrench, X } from 'lucide-react'
import type { AgentToolsViewProps } from './agent-tools.types'
import { useAgentToolsView } from './useAgentToolsView'
import { AgentToolsBuiltInList } from './AgentToolsBuiltInList'
import { EmojiSettingsGroupsView, EmojiGroupDetailView } from '../EmojiSettingsView'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import { HelpTooltip } from '../HelpTooltip'
import styles from './AgentToolsView.module.css'

export type { ToolManagementConfig, AgentToolsViewProps } from './agent-tools.types'

type EmojiSubview = 'none' | 'groups' | 'detail'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({
  config,
  onChange,
  scene = 'companion',
  presentation = 'page',
  onClose,
  onSubpageActiveChange
}) => {
  const { t } = useTranslation()
  const view = useAgentToolsView({ config, onChange, scene })
  const [emojiSubview, setEmojiSubview] = useState<EmojiSubview>('none')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const isDialog = presentation === 'dialog'
  const inEmojiSubpage = scene === 'companion' && emojiSubview !== 'none'

  const emojiConfig = normalizeEmojiToolConfig(
    'emojiConfig' in config ? config.emojiConfig : undefined
  )
  const containerClass = isDialog
    ? `${styles.container} ${styles.containerDialog}`
    : styles.container
  const headerClass = isDialog ? `${styles.header} ${styles.headerDialog}` : styles.header
  const scrollClass = isDialog
    ? `${styles.scrollArea} ${styles.scrollAreaDialog}`
    : styles.scrollArea

  useEffect(() => {
    onSubpageActiveChange?.(inEmojiSubpage)
    return () => onSubpageActiveChange?.(false)
  }, [inEmojiSubpage, onSubpageActiveChange])

  const handleEmojiConfigChange = (nextEmojiConfig: typeof emojiConfig) => {
    if (scene !== 'companion') return
    onChange({ ...config, emojiConfig: nextEmojiConfig })
  }

  if (inEmojiSubpage) {
    return (
      <div className={containerClass}>
        <div
          className={`${isDialog ? headerClass : styles.emojiPageHeader} ${styles.emojiSubHeader}`}
        >
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
          <span className={styles.emojiPageTitle}>
            {emojiSubview === 'detail'
              ? t('agent.tools.emoji_group_detail', '表情包组')
              : t('agent.tools.emoji_settings', '表情包设置')}
          </span>
        </div>
        <div className={`${scrollClass} ${!isDialog ? styles.emojiPageScroll : ''}`}>
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
      {isDialog ? (
        <div className={headerClass}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon}>
                <Wrench size={20} />
              </span>
              <div className={styles.titleBlock}>
                <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
                <HelpTooltip
                  size={14}
                  content={
                    scene === 'workspace'
                      ? t(
                          'settings.workspace_tools_desc',
                          '管理当前工作区可用的工具；与伙伴工具相互独立。'
                        )
                      : t(
                          'settings.agent_tools_desc',
                          '管理伙伴可使用的工具，开关或配置工具参数'
                        )
                  }
                />
              </div>
            </div>
          </div>
          {onClose ? (
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
      ) : null}

      <div className={scrollClass}>
        <AgentToolsBuiltInList
          config={config}
          categoryMeta={view.categoryMeta}
          categoryOrder={view.categoryOrder}
          groupedTools={view.groupedTools}
          onToggleTool={view.toggleTool}
          getToolParam={view.getToolParam}
          setToolParam={view.setToolParam}
          onConfigChange={onChange}
          onOpenEmojiSettings={() => setEmojiSubview('groups')}
          showEmojiTools={view.showEmojiTools}
        />
      </div>
    </div>
  )
}
