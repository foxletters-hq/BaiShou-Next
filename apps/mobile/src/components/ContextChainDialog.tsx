import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '@baishou/ui/src/native/theme';

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: Date;
}

export interface ContextChainDialogProps {
  visible: boolean;
  onClose: () => void;
  message: {
    id?: string;
    content?: string;
    inputTokens?: number;
    outputTokens?: number;
    costMicros?: number;
  };
  contextMessages: ContextMessage[];
  compressedContent?: string;
  originalContent?: string;
  systemPrompt?: string;
}

export const ContextChainDialog: React.FC<ContextChainDialogProps> = ({
  visible,
  onClose,
  message,
  contextMessages,
  compressedContent,
  originalContent,
  systemPrompt,
}) => {
  const { t } = useTranslation();
  const { colors } = useNativeTheme();
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'compressed' | 'original' | 'prompt'>('context');

  const totalInputTokens = message.inputTokens || 0;
  const totalOutputTokens = message.outputTokens || 0;
  const costText = message.costMicros ? `$${(message.costMicros / 1000000).toFixed(4)}` : null;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'system': return t('agent.chat.role_system', '系统');
      case 'user': return t('agent.chat.role_user', '用户');
      case 'assistant': return t('agent.chat.role_assistant', 'AI 助手');
      case 'tool': return t('agent.chat.role_tool', '工具');
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user': return '#3b82f6';
      case 'assistant': return '#22c55e';
      case 'system': return '#f59e0b';
      case 'tool': return '#6b7280';
      default: return colors.textTertiary;
    }
  };

  const tabs = [
    { key: 'context', label: t('agent.chat.tab_context', '上下文') },
    ...(compressedContent ? [{ key: 'compressed', label: t('agent.chat.tab_compressed', '压缩') }] : []),
    ...(originalContent ? [{ key: 'original', label: t('agent.chat.tab_original', '原文') }] : []),
    ...(systemPrompt ? [{ key: 'prompt', label: t('agent.chat.tab_prompt', '提示词') }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.bgSurface }]}>
          {/* 头部 */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.titleRow}>
              <Text style={styles.icon}>🌿</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('agent.chat.context_chain', '上下文调用链')}
              </Text>
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{contextMessages.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Token 统计 */}
          {(totalInputTokens > 0 || totalOutputTokens > 0) && (
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={[styles.statText, { color: colors.textSecondary }]}>↑ {t('agent.chat.round_input', '入')} {totalInputTokens}</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={[styles.statText, { color: colors.textSecondary }]}>↓ {t('agent.chat.round_output', '出')} {totalOutputTokens}</Text>
              </View>
              {costText && (
                <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceHighest }]}>
                  <Text style={[styles.statText, { color: colors.textSecondary }]}>$ {t('agent.chat.round_cost', '耗')} {costText}</Text>
                </View>
              )}
            </View>
          )}

          {/* 标签页 */}
          {tabs.length > 1 && (
            <View style={styles.tabsContainer}>
              {tabs.map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as any)}
                  style={[
                    styles.tabButton,
                    activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === tab.key ? colors.primary : colors.textTertiary },
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 内容区域 */}
          <ScrollView style={styles.contentArea}>
            {activeTab === 'context' && contextMessages.map((msg, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedMsgIndex(idx)}
                style={[styles.messageItem, { borderBottomColor: colors.borderSubtle }]}
              >
                <Text style={[styles.msgIndex, { color: colors.textTertiary }]}>{idx + 1}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(msg.role) + '20' }]}>
                  <Text style={[styles.roleText, { color: getRoleColor(msg.role) }]}>{getRoleLabel(msg.role)}</Text>
                </View>
                <Text style={[styles.msgPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                  {msg.content || t('agent.chat.empty_content', '[空文本]')}
                </Text>
                <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
              </TouchableOpacity>
            ))}

            {activeTab === 'compressed' && compressedContent && (
              <View style={[styles.contentBlock, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={[styles.contentText, { color: colors.textPrimary }]}>{compressedContent}</Text>
              </View>
            )}

            {activeTab === 'original' && originalContent && (
              <View style={[styles.contentBlock, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={[styles.contentText, { color: colors.textPrimary }]}>{originalContent}</Text>
              </View>
            )}

            {activeTab === 'prompt' && systemPrompt && (
              <View style={[styles.contentBlock, { backgroundColor: colors.bgSurfaceHighest }]}>
                <Text style={[styles.contentText, { color: colors.textPrimary }]}>{systemPrompt}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* 消息详情弹窗 */}
      {selectedMsgIndex !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedMsgIndex(null)}>
          <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={() => setSelectedMsgIndex(null)}>
            <View style={[styles.detailDialog, { backgroundColor: colors.bgSurface }]}>
              <View style={[styles.detailHeader, { borderBottomColor: colors.borderSubtle }]}>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(contextMessages[selectedMsgIndex].role) + '20' }]}>
                  <Text style={[styles.roleText, { color: getRoleColor(contextMessages[selectedMsgIndex].role) }]}>
                    {getRoleLabel(contextMessages[selectedMsgIndex].role)}
                  </Text>
                </View>
                <Text style={[styles.detailIndex, { color: colors.textTertiary }]}>#{selectedMsgIndex + 1}</Text>
                <TouchableOpacity onPress={() => setSelectedMsgIndex(null)} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.detailContent}>
                <Text style={[styles.detailText, { color: colors.textPrimary }]}>
                  {contextMessages[selectedMsgIndex].content || t('agent.chat.no_content', '[无内容]')}
                </Text>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: '92%',
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  msgIndex: {
    fontSize: 12,
    fontWeight: '600',
    width: 24,
    textAlign: 'center',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  msgPreview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '300',
  },
  contentBlock: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailDialog: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  detailIndex: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  detailContent: {
    padding: 16,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 24,
  },
});
