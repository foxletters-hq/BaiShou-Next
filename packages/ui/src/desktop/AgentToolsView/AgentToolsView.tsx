import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import type { AgentToolsViewProps } from './agent-tools.types'
import { useAgentToolsView } from './useAgentToolsView'
import { AgentToolsBuiltInList } from './AgentToolsBuiltInList'
import { EmojiSettingsGroupsView, EmojiGroupDetailView } from '../EmojiSettingsView'
import { normalizeEmojiToolConfig } from '@baishou/shared'
import styles from './AgentToolsView.module.css'

export type { ToolManagementConfig, AgentToolsViewProps } from './agent-tools.types'

type EmojiSubview = 'none' | 'groups' | 'detail'

export const AgentToolsView: React.FC<AgentToolsViewProps> = ({ config, onChange }) => {
  const { t } = useTranslation()
  const view = useAgentToolsView({ config, onChange })
  const [emojiSubview, setEmojiSubview] = useState<EmojiSubview>('none')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const emojiConfig = normalizeEmojiToolConfig(config.emojiConfig)

  const handleEmojiConfigChange = (nextEmojiConfig: typeof emojiConfig) => {
    onChange({ ...config, emojiConfig: nextEmojiConfig })
  }

  if (emojiSubview !== 'none') {
    const title =
      emojiSubview === 'detail'
        ? emojiConfig.groups.find((group) => group.id === selectedGroupId)?.name ||
          t('agent.tools.emoji_group_detail', '表情包组')
        : t('agent.tools.emoji_settings_title', '表情包设置')

    return (
      <div className={styles.container}>
        <div className={styles.header}>
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
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.scrollArea}>
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('settings.agent_tools_title', '工具管理')}</h3>
      </div>

      <div className={styles.scrollArea}>
        <p className={styles.subtitle}>
          {t('settings.agent_tools_desc', '管理伙伴可使用的工具，开关或配置工具参数')}
        </p>

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
