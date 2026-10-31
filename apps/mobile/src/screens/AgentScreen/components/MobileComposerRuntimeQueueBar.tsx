import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CornerDownLeft, Pencil, Trash2, X } from 'lucide-react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export type MobileRuntimeQueueItem = {
  id: string
  text: string
  userMessageId?: string
}

/** 只隐藏仍在排队、且已有用户消息 id 的那一条。已提升开流的消息留在对话流里展示。 */
export function excludePendingQueuedUserMessages<T extends { id: string }>(
  messages: T[],
  pending: ReadonlyArray<{ userMessageId?: string | null }>
): T[] {
  const hideIds = new Set(
    pending.map((item) => item.userMessageId?.trim()).filter((id): id is string => Boolean(id))
  )
  if (hideIds.size === 0) return messages
  return messages.filter((message) => !hideIds.has(message.id))
}

export function formatPendingQueueCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  return `${n} 条排队中`
}

export function MobileComposerRuntimeQueueBar(props: {
  items: MobileRuntimeQueueItem[]
  editingInputId?: string | null
  hasChatBackground?: boolean
  t: (key: string, fallback?: string) => string
  onSendNow: (item: MobileRuntimeQueueItem) => void | Promise<void>
  onEdit: (item: MobileRuntimeQueueItem) => void
  onDelete: (item: MobileRuntimeQueueItem) => void | Promise<void>
}) {
  const { items, editingInputId, hasChatBackground = false, t, onSendNow, onEdit, onDelete } = props
  const { colors, isDark } = useNativeTheme()

  if (items.length === 0) return null

  const itemBg = hasChatBackground
    ? isDark
      ? 'rgba(28, 29, 32, 0.88)'
      : 'rgba(255, 255, 255, 0.92)'
    : colors.bgSurface
  const itemEditingBg = hasChatBackground
    ? isDark
      ? 'rgba(34, 35, 39, 0.94)'
      : 'rgba(255, 255, 255, 0.96)'
    : colors.bgSurface
  const itemBorder = hasChatBackground
    ? isDark
      ? 'rgba(255, 255, 255, 0.16)'
      : 'rgba(0, 0, 0, 0.10)'
    : colors.borderMuted

  return (
    <View style={styles.queueBar} accessibilityRole="summary">
      <View style={styles.queueHeader}>
        <Text
          style={[
            styles.queueCount,
            {
              color: hasChatBackground && isDark ? colors.textPrimary : colors.textSecondary
            }
          ]}
        >
          {formatPendingQueueCountLabel(items.length)}
        </Text>
      </View>
      <View style={styles.queueList}>
        {items.map((item) => {
          const editing = editingInputId === item.id
          return (
            <View
              key={item.id}
              style={[
                styles.queueItem,
                {
                  backgroundColor: editing ? itemEditingBg : itemBg,
                  borderColor: editing ? colors.borderControl : itemBorder
                }
              ]}
            >
              <Text
                style={[styles.queueText, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.text.trim() ? item.text : t('input.upload_attachment', '上传附件')}
              </Text>
              {editing ? (
                <Text style={[styles.editingLabel, { color: colors.textTertiary }]}>
                  {t('agent.queue_editing', '编辑中')}
                </Text>
              ) : null}
              <View style={styles.queueActions}>
                <TouchableOpacity
                  style={styles.queueAction}
                  activeOpacity={0.72}
                  onPress={() => void onSendNow(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t('agent.queue_send_now', '立即发送')}
                >
                  <CornerDownLeft size={13} color={colors.textSecondary} strokeWidth={1.75} />
                  <Text style={[styles.queueActionText, { color: colors.textSecondary }]}>
                    {t('agent.queue_send_now', '立即发送')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.queueIconBtn}
                  activeOpacity={0.72}
                  onPress={() => onEdit(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.edit', '编辑')}
                >
                  <Pencil size={14} color={colors.textTertiary} strokeWidth={1.75} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.queueIconBtn}
                  activeOpacity={0.72}
                  onPress={() => void onDelete(item)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete', '删除')}
                >
                  <Trash2 size={14} color={colors.textTertiary} strokeWidth={1.75} />
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export function MobileComposerQueueEditTag(props: {
  visible: boolean
  hasChatBackground?: boolean
  t: (key: string, fallback?: string) => string
  onDismiss: () => void
}) {
  const { visible, hasChatBackground = false, t, onDismiss } = props
  const { colors, isDark } = useNativeTheme()

  if (!visible) return null

  const tagBg = hasChatBackground
    ? isDark
      ? 'rgba(28, 29, 32, 0.88)'
      : 'rgba(255, 255, 255, 0.92)'
    : colors.bgSurface

  return (
    <View style={styles.editTagRow}>
      <View
        style={[
          styles.editTag,
          {
            backgroundColor: tagBg,
            borderColor: colors.borderControl
          }
        ]}
      >
        <Text style={[styles.editTagText, { color: colors.textSecondary }]}>
          {t('agent.queue_editing_tag', '编辑排队')}
        </Text>
        <TouchableOpacity
          style={styles.editTagClose}
          activeOpacity={0.72}
          onPress={onDismiss}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', '取消')}
        >
          <X size={13} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export function MobileComposerQueueTopSlot(props: {
  pendingQueueCtl?: {
    pendingQueue: MobileRuntimeQueueItem[]
    editingInputId: string | null
    beginEdit: (item: MobileRuntimeQueueItem) => void
    cancelEdit: () => void
    deleteItem: (item: MobileRuntimeQueueItem) => Promise<void>
    sendNow: (item: MobileRuntimeQueueItem) => Promise<void>
  }
  inputBarRef: React.RefObject<{
    restoreDraft?: (draft: { text: string }) => void
    focus?: () => void
  } | null>
  hasChatBackground?: boolean
  t: (key: string, fallback?: string) => string
}) {
  const { pendingQueueCtl, inputBarRef, hasChatBackground, t } = props
  if (!pendingQueueCtl) return null
  return (
    <>
      <MobileComposerRuntimeQueueBar
        items={pendingQueueCtl.pendingQueue}
        editingInputId={pendingQueueCtl.editingInputId}
        hasChatBackground={hasChatBackground}
        t={t}
        onSendNow={pendingQueueCtl.sendNow}
        onEdit={(item) => {
          pendingQueueCtl.beginEdit(item)
          inputBarRef.current?.restoreDraft?.({ text: item.text })
          inputBarRef.current?.focus?.()
        }}
        onDelete={pendingQueueCtl.deleteItem}
      />
      <MobileComposerQueueEditTag
        visible={Boolean(pendingQueueCtl.editingInputId)}
        hasChatBackground={hasChatBackground}
        t={t}
        onDismiss={() => {
          pendingQueueCtl.cancelEdit()
          inputBarRef.current?.restoreDraft?.({ text: '' })
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  queueBar: {
    flexDirection: 'column',
    gap: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sharedTokens.spacing.xxs
  },
  queueCount: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  queueList: {
    flexDirection: 'column',
    gap: sharedTokens.spacing.xs
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1
  },
  queueText: {
    flex: 1,
    minWidth: 0,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '400'
  },
  editingLabel: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  queueActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xxs
  },
  queueAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xxs,
    paddingVertical: sharedTokens.spacing.xxs,
    paddingHorizontal: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.xs
  },
  queueActionText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  queueIconBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sharedTokens.radius.xs
  },
  editTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.xsPlus
  },
  editTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xs,
    paddingVertical: sharedTokens.spacing.xxs,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.xs,
    borderWidth: 1
  },
  editTagText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '500'
  },
  editTagClose: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: sharedTokens.spacing.xxs
  }
})
