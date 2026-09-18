import React from 'react'
import { ScrollView, Text, TouchableOpacity } from 'react-native'
import type { LucideProps } from 'lucide-react-native'
import { BookOpen, Globe, LayoutGrid, Paperclip, Volume2, Zap } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { INPUT_BAR_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { LucideIcon } from '../icons/LucideIcon'
import { nativeInputBarStyles as styles } from './native-input-bar.styles'

type Colors = {
  primary: string
  bgSurface: string
  colorOutlineVariant: string
  textOnPrimary: string
  textSecondary: string
}

export function InputBarToolbar(props: {
  colors: Colors
  onUploadAttachment: () => void
  onShortcutPress: () => void
  onRecall?: () => void
  onOpenNotebookMount?: () => void
  searchMode: boolean
  onToggleSearchMode?: () => void
  ttsMode: 'always' | 'manual'
  onToggleTtsMode?: () => void
  onOpenTools?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = props

  const renderChip = (
    label: string,
    onPress?: () => void,
    options?: { active?: boolean; icon?: React.ComponentType<LucideProps> }
  ) => {
    if (!onPress) return null
    const active = options?.active ?? false
    return (
      <TouchableOpacity
        key={label}
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.primary : colors.bgSurface,
            borderColor: active ? colors.primary : colors.colorOutlineVariant
          }
        ]}
        onPress={onPress}
      >
        {options?.icon ? (
          <LucideIcon
            icon={options.icon}
            size={INPUT_BAR_ICON_SIZE}
            color={active ? colors.textOnPrimary : colors.textSecondary}
          />
        ) : null}
        <Text
          style={[
            styles.chipLabel,
            { color: active ? colors.textOnPrimary : colors.textSecondary }
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.toolbarContent}
    >
      {renderChip(t('input.upload_attachment', '上传附件'), props.onUploadAttachment, {
        icon: Paperclip
      })}
      {renderChip(t('input.shortcut_command', '快捷指令'), props.onShortcutPress, {
        icon: Zap
      })}
      {renderChip(t('settings.recall_memories', '唤醒回忆'), props.onRecall, {
        icon: BookOpen
      })}
      {props.onOpenNotebookMount
        ? renderChip(t('workbench.notebook_mount', '知识库笔记本'), props.onOpenNotebookMount, {
            icon: BookOpen
          })
        : null}
      {renderChip(
        props.searchMode
          ? t('settings.web_search_mode_tool', '外部工具搜索')
          : t('settings.web_search_mode_off', '关闭搜索'),
        props.onToggleSearchMode,
        { active: props.searchMode, icon: Globe }
      )}
      {renderChip(
        props.ttsMode === 'always'
          ? t('agent.chat.tts_always', '始终朗读')
          : t('agent.chat.tts_manual', '手动朗读'),
        props.onToggleTtsMode,
        { active: props.ttsMode === 'always', icon: Volume2 }
      )}
      {renderChip(t('settings.agent_tools_title', '工具管理'), props.onOpenTools, {
        icon: LayoutGrid
      })}
    </ScrollView>
  )
}
