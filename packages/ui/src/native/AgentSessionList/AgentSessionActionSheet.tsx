import React, { useCallback } from 'react'
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { useDialog } from '../Dialog'
import type { AgentSession } from './agent-session-list.types'

interface AgentSessionActionSheetProps {
  session: AgentSession | null
  onClose: () => void
  onPin?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
}

export const AgentSessionActionSheet: React.FC<AgentSessionActionSheetProps> = ({
  session,
  onClose,
  onPin,
  onDelete,
  onRename
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const dialog = useDialog()

  const handleDelete = useCallback(async () => {
    if (!session) return
    onClose()
    const confirmed = await dialog.confirm(
      t('agent.delete_session_confirm', '您确定要永久删除这篇对话吗？此操作不可逆转。'),
      {
        confirmText: t('common.delete', '删除'),
        destructive: true
      }
    )
    if (confirmed) onDelete?.(session.id)
  }, [dialog, onClose, onDelete, session, t])

  const handleRename = useCallback(async () => {
    if (!session) return
    onClose()
    const text = await dialog.prompt(
      t('agent.sessions.rename_hint', '输入新会话名称'),
      session.title,
      t('agent.sessions.rename', '重命名')
    )
    if (text?.trim()) onRename?.(session.id, text.trim())
  }, [dialog, onClose, onRename, session, t])

  const handlePin = useCallback(() => {
    if (!session) return
    onPin?.(session.id)
    onClose()
  }, [onClose, onPin, session])

  if (!session) return null

  const options: Array<{ key: string; label: string; onPress: () => void; destructive?: boolean }> =
    []
  if (onPin) {
    options.push({
      key: 'pin',
      label: session.isPinned
        ? t('agent.sessions.unpin', '取消置顶')
        : t('agent.sessions.pin', '置顶对话'),
      onPress: handlePin
    })
  }
  if (onRename) {
    options.push({
      key: 'rename',
      label: t('agent.sessions.rename', '重命名'),
      onPress: () => void handleRename()
    })
  }
  if (onDelete) {
    options.push({
      key: 'delete',
      label: t('common.delete', '删除'),
      onPress: () => void handleDelete(),
      destructive: true
    })
  }

  if (options.length === 0) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', '取消')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.md
            }
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {session.title || t('agent.sessions.default_title', '新对话')}
          </Text>

          <View style={styles.list}>
            {options.map((opt, index) => (
              <Pressable
                key={opt.key}
                onPress={opt.onPress}
                style={({ pressed }) => [
                  styles.item,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.borderSubtle
                  },
                  pressed && { backgroundColor: colors.bgSurfaceNormal }
                ]}
              >
                <Text
                  style={[
                    styles.itemLabel,
                    { color: opt.destructive ? colors.error : colors.textPrimary }
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                borderColor: colors.borderSubtle,
                opacity: pressed ? 0.7 : 1
              }
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              {t('common.cancel', '取消')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  sheet: {
    width: '100%',
    maxWidth: 360
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22
  },
  list: {
    width: '100%'
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
