import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { StoragePermissionPrompt, useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'

export interface FullFileAccessGateProps {
  /** undefined = 检测中 */
  granted: boolean | undefined
  onRequest: () => void | Promise<void>
  children: React.ReactNode
}

/** Android：未授予全文件访问时阻断子界面（日记/编辑器等） */
export const FullFileAccessGate: React.FC<FullFileAccessGateProps> = ({
  granted,
  onRequest,
  children
}) => {
  const { colors } = useNativeTheme()

  if (granted === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (granted === false) {
    return (
      <View style={styles.gate}>
        <StoragePermissionPrompt onRequest={onRequest} mode="required" />
      </View>
    )
  }

  return <>{children}</>
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sharedTokens.spacing.lg
  },
  gate: {
    flex: 1,
    justifyContent: 'center',
    padding: sharedTokens.spacing.mdPlus
  }
})
