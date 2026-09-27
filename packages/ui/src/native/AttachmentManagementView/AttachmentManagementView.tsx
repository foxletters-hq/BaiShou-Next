import React from 'react'
import { View, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { useNativeTheme } from '../theme'
import { NativeImagePreviewModal } from '../DiaryEditor/NativeImagePreviewModal'
import { SegmentedControl } from '../SegmentedControl'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { useAttachmentManagementView } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { SessionAttachmentPane } from './SessionAttachmentPane'
import { DiaryAttachmentPane } from './DiaryAttachmentPane'
import { EmojiAttachmentPane } from './EmojiAttachmentPane'

export type {
  AttachmentFileItem,
  SessionAttachmentGroup,
  DiaryAttachmentFileItem,
  EmojiAttachmentListItem,
  AttachmentManagementViewProps
} from './attachment-management.types'

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = (props) => {
  const { colors } = useNativeTheme()
  const { isLoading = false, onRefresh, style, ...rest } = props
  const vm = useAttachmentManagementView(props)
  const [refreshing, setRefreshing] = React.useState(false)

  const handleRefresh = async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <View style={[styles.container, style]} {...rest}>
      <View style={styles.mainTabNav}>
        <SegmentedControl
          value={vm.activePane}
          options={[
            { value: 'diary', label: vm.t('settings.attachment_pane_diary', '日记附件') },
            { value: 'session', label: vm.t('settings.attachment_pane_session', 'AI 会话附件') },
            { value: 'emoji', label: vm.t('settings.attachment_pane_emoji', '表情包附件') }
          ]}
          onChange={vm.setActivePane}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
        >
          {vm.activePane === 'diary' ? (
            <DiaryAttachmentPane vm={vm} />
          ) : vm.activePane === 'session' ? (
            <SessionAttachmentPane vm={vm} />
          ) : (
            <EmojiAttachmentPane vm={vm} />
          )}
        </ScrollView>
      )}

      <NativeImagePreviewModal
        uri={vm.imagePreview?.src ?? null}
        onClose={() => vm.setImagePreview(null)}
      />
    </View>
  )
}
