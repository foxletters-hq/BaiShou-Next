import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { NativeImagePreviewModal } from '../DiaryEditor/NativeImagePreviewModal'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { useAttachmentManagementView } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { SessionAttachmentPane } from './SessionAttachmentPane'
import { DiaryAttachmentPane } from './DiaryAttachmentPane'

export type {
  AttachmentFileItem,
  SessionAttachmentGroup,
  DiaryAttachmentFileItem,
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
      <View style={[styles.mainTabNav, { backgroundColor: colors.bgSurface, borderRadius: 10 }]}>
        <View style={styles.mainTabs}>
          <TouchableOpacity
            style={[
              styles.mainTabItem,
              vm.activePane === 'diary' && { backgroundColor: colors.primary }
            ]}
            onPress={() => vm.setActivePane('diary')}
          >
            <MaterialIcons
              name="event-note"
              size={16}
              color={vm.activePane === 'diary' ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mainTabText,
                {
                  color: vm.activePane === 'diary' ? colors.textOnPrimary : colors.textPrimary
                }
              ]}
            >
              {vm.t('settings.attachment_pane_diary', '日记附件')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.mainTabItem,
              vm.activePane === 'session' && { backgroundColor: colors.primary }
            ]}
            onPress={() => vm.setActivePane('session')}
          >
            <MaterialIcons
              name="folder"
              size={16}
              color={vm.activePane === 'session' ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.mainTabText,
                {
                  color: vm.activePane === 'session' ? colors.textOnPrimary : colors.textPrimary
                }
              ]}
            >
              {vm.t('settings.attachment_pane_session', 'AI 会话附件')}
            </Text>
          </TouchableOpacity>
        </View>
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
          ) : (
            <SessionAttachmentPane vm={vm} />
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
