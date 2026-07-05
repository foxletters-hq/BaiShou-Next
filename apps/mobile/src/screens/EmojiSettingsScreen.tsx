import React from 'react'
import { StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  EmojiSettingsGroupsView,
  KeyboardAwareScrollView,
  scrollIndicatorStyle,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { useEmojiToolSettings } from '../hooks/useEmojiToolSettings'

export const EmojiSettingsScreen: React.FC = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const { config, persist } = useEmojiToolSettings()

  return (
    <StackScreenLayout
      title={t('agent.tools.emoji_settings_title', '表情包设置')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        keyboardShouldPersistTaps="handled"
      >
        <EmojiSettingsGroupsView
          config={config}
          onChange={(next) => void persist(next)}
          onOpenGroup={(groupId) => router.push(`/settings/emoji/${encodeURIComponent(groupId)}`)}
          onPromptGroupName={(defaultName) =>
            dialog.prompt(
              t('agent.tools.emoji_group_name_prompt', '请输入表情包组名称'),
              defaultName,
              t('agent.tools.emoji_group_add', '新建组')
            )
          }
          onGroupNameConflict={(name) =>
            toast.showError(
              t('agent.tools.emoji_group_name_conflict', '已存在名为「{{name}}」的组', { name })
            )
          }
          onConfirmDeleteGroup={(name) =>
            dialog.confirm(
              t(
                'agent.tools.emoji_group_delete_confirm',
                '确定删除表情包组「{{name}}」吗？此操作不可撤销。',
                { name }
              ),
              {
                title: t('agent.tools.emoji_group_delete_title', '删除表情包组'),
                confirmText: t('common.delete', '删除'),
                destructive: true
              }
            )
          }
        />
      </KeyboardAwareScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  }
})
