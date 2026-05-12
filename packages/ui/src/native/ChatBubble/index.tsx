import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../../native/theme';

export interface ChatBubbleMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning?: string;
  isReasoning?: boolean;
  timestamp?: Date;
  toolInvocations?: any[];
  attachments?: any[];
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  contextMessages?: ChatBubbleMessage[];
}

export interface ChatBubbleProps {
  message: ChatBubbleMessage;
  userProfile?: { nickname: string; avatarPath?: string | null };
  aiProfile?: { name: string; avatarPath?: string | null; emoji?: string | null };
  onEdit?: () => void;
  onRegenerate?: () => void;
  onResend?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onBranch?: () => void;
  onSaveEdit?: (newContent: string) => void;
  onResendEdit?: (newContent: string) => void;
  onShowContext?: (msg: ChatBubbleMessage) => void;
  onReadAloud?: (content: string) => void;
  isTtsPlaying?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  aiProfile,
  onEdit,
  onRegenerate,
  onResend,
  onDelete,
  onBranch,
  onSaveEdit,
  onResendEdit,
  onShowContext,
  onReadAloud,
  isTtsPlaying,
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const editInputRef = useRef<TextInput>(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasContext = message.contextMessages && message.contextMessages.length > 0;

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onSaveEdit?.(editContent.trim());
      setIsEditing(false);
    }
  };

  const handleResendEdit = () => {
    if (editContent.trim()) {
      onResendEdit?.(editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      {/* AI 头像 */}
      {isAssistant && aiProfile && (
        <View style={[styles.avatar, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={styles.avatarText}>{aiProfile.emoji || '🤖'}</Text>
        </View>
      )}

      <View style={styles.bubbleWrapper}>
        {/* 气泡内容 */}
        <TouchableOpacity
          onLongPress={() => setShowActions(true)}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <View style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.bgSurface, borderBottomLeftRadius: 4 },
          ]}>
            {/* 推理块 */}
            {isAssistant && message.isReasoning && message.reasoning && (
              <View style={[styles.reasoningBlock, { borderColor: colors.borderSubtle }]}>
                <Text style={[styles.reasoningLabel, { color: colors.textTertiary }]}>
                  {t('agent.chat.reasoning', '思考中...')}
                </Text>
                <Text style={[styles.reasoningText, { color: colors.textSecondary }]}>
                  {message.reasoning}
                </Text>
              </View>
            )}

            {isEditing ? (
              <TextInput
                ref={editInputRef}
                style={[styles.editInput, { color: isUser ? colors.textOnPrimary : colors.textPrimary }]}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            ) : (
              <Text style={[styles.text, { color: isUser ? colors.textOnPrimary : colors.textPrimary }]}>
                {message.content}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* 编辑模式按钮 */}
        {isEditing && (
          <View style={styles.editActions}>
            <TouchableOpacity onPress={handleCancelEdit} style={[styles.editBtn, { borderColor: colors.borderSubtle }]}>
              <Text style={[styles.editBtnText, { color: colors.textSecondary }]}>
                {t('common.cancel', '取消')}
              </Text>
            </TouchableOpacity>
            {isUser && onResendEdit && (
              <TouchableOpacity onPress={handleResendEdit} style={[styles.editBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.editBtnText, { color: colors.textOnPrimary }]}>
                  {t('agent.chat.resend', '重新发送')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && onSaveEdit && (
              <TouchableOpacity onPress={handleSaveEdit} style={[styles.editBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.editBtnText, { color: colors.textOnPrimary }]}>
                  {t('common.save', '保存')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 底部操作按钮行 */}
        {!isEditing && (
          <View style={styles.actionsRow}>
            {/* 用户消息操作 */}
            {isUser && onResend && (
              <TouchableOpacity onPress={onResend} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>🔄 {t('agent.chat.resend', '重发')}</Text>
              </TouchableOpacity>
            )}
            {isUser && onEdit && (
              <TouchableOpacity onPress={handleStartEdit} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>✏️ {t('common.edit', '编辑')}</Text>
              </TouchableOpacity>
            )}

            {/* AI 消息操作 */}
            {isAssistant && onReadAloud && (
              <TouchableOpacity onPress={() => onReadAloud(message.content)} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: isTtsPlaying ? colors.primary : colors.textTertiary }]}>
                  {isTtsPlaying ? '🔊' : '🔈'} {t('agent.chat.read_aloud', '朗读')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && hasContext && onShowContext && (
              <TouchableOpacity onPress={() => onShowContext(message)} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>🌿 {t('agent.chat.context_chain', '上下文')}</Text>
              </TouchableOpacity>
            )}
            {isAssistant && onRegenerate && (
              <TouchableOpacity onPress={onRegenerate} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>🔄 {t('agent.chat.regenerate', '重新生成')}</Text>
              </TouchableOpacity>
            )}
            {isAssistant && onBranch && (
              <TouchableOpacity onPress={onBranch} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>🔀 {t('agent.chat.branch', '分支')}</Text>
              </TouchableOpacity>
            )}
            {isAssistant && onSaveEdit && (
              <TouchableOpacity onPress={handleStartEdit} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>✏️ {t('common.edit', '编辑')}</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={styles.actionChip}>
                <Text style={[styles.actionChipText, { color: colors.error || '#ef4444' }]}>🗑️ {t('common.delete', '删除')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Token 统计 */}
        {isAssistant && (message.inputTokens || message.outputTokens) ? (
          <View style={styles.tokenRow}>
            {message.inputTokens ? (
              <Text style={[styles.tokenText, { color: colors.textTertiary }]}>↑{message.inputTokens}</Text>
            ) : null}
            {message.outputTokens ? (
              <Text style={[styles.tokenText, { color: colors.textTertiary }]}>↓{message.outputTokens}</Text>
            ) : null}
            {message.costMicros ? (
              <Text style={[styles.tokenText, { color: colors.textTertiary }]}>${(message.costMicros / 1000000).toFixed(4)}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 长按操作菜单 */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>
              {t('agent.chat.message_actions', '消息操作')}
            </Text>
            <ScrollView>
              {isUser && onResend && (
                <TouchableOpacity onPress={() => { onResend(); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>🔄 {t('agent.chat.resend', '重新发送')}</Text>
                </TouchableOpacity>
              )}
              {(isUser || isAssistant) && (
                <TouchableOpacity onPress={handleStartEdit} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>✏️ {t('common.edit', '编辑')}</Text>
                </TouchableOpacity>
              )}
              {isAssistant && onReadAloud && (
                <TouchableOpacity onPress={() => { onReadAloud(message.content); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>🔈 {t('agent.chat.read_aloud', '朗读')}</Text>
                </TouchableOpacity>
              )}
              {isAssistant && hasContext && onShowContext && (
                <TouchableOpacity onPress={() => { onShowContext(message); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>🌿 {t('agent.chat.context_chain', '上下文链')}</Text>
                </TouchableOpacity>
              )}
              {isAssistant && onRegenerate && (
                <TouchableOpacity onPress={() => { onRegenerate(); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>🔄 {t('agent.chat.regenerate', '重新生成')}</Text>
                </TouchableOpacity>
              )}
              {isAssistant && onBranch && (
                <TouchableOpacity onPress={() => { onBranch(); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>🔀 {t('agent.chat.branch', '创建分支')}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={() => { onDelete(); setShowActions(false); }} style={styles.actionItem}>
                  <Text style={[styles.actionItemText, { color: colors.error || '#ef4444' }]}>🗑️ {t('common.delete', '删除')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowActions(false)} style={[styles.actionCancel, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.actionCancelText, { color: colors.textSecondary }]}>{t('common.cancel', '取消')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  containerAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatarText: {
    fontSize: 16,
  },
  bubbleWrapper: {
    flex: 1,
    maxWidth: '85%',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  reasoningBlock: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  reasoningLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  editInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 44,
    padding: 0,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  actionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tokenText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  actionItem: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  actionItemText: {
    fontSize: 16,
  },
  actionCancel: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  actionCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
