import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native'
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
  const activeTabStyle = {
    backgroundColor: colors.primary,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 } as const,
    elevation: 2
  }
  const activeTabTextStyle = { color: colors.textOnPrimary, fontWeight: '600' as const }
  const idleTabTextStyle = { color: colors.textSecondary, fontWeight: '400' as const }

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
        <View style={[styles.mainTabs, { backgroundColor: colors.bgApp }]}>
          <TouchableOpacity
            style={[styles.mainTabItem, vm.activePane === 'diary' && activeTabStyle]}
            onPress={() => vm.setActivePane('diary')}
          >
            <Text
              style={[
                styles.mainTabText,
                vm.activePane === 'diary' ? activeTabTextStyle : idleTabTextStyle
              ]}
            >
              {vm.t('settings.attachment_pane_diary', '日记附件')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTabItem, vm.activePane === 'session' && activeTabStyle]}
            onPress={() => vm.setActivePane('session')}
          >
            <Text
              style={[
                styles.mainTabText,
                vm.activePane === 'session' ? activeTabTextStyle : idleTabTextStyle
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
