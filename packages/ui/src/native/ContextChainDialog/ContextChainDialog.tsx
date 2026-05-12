import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';

export interface MockChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  toolInvocations?: any[];
}

export interface NativeContextChainDialogProps {
  isOpen: boolean;
  onClose: () => void;
  message: MockChatMessage;
  contextMessages: MockChatMessage[];
  compressedContent?: string;
  originalContent?: string;
  systemPrompt?: string;
}

export const ContextChainDialog: React.FC<NativeContextChainDialogProps> = ({ 
  isOpen, 
  onClose, 
  message, 
  contextMessages,
  compressedContent,
  originalContent,
  systemPrompt
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'context' | 'compressed' | 'original' | 'prompt'>('context');

  if (!isOpen) return null;

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
      case 'user': return colors.primary;
      case 'assistant': return colors.secondary;
      case 'system': return colors.tertiary;
      case 'tool': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const tabs = [
    { key: 'context', label: t('agent.chat.tab_context', '上下文') },
    ...(compressedContent ? [{ key: 'compressed', label: t('agent.chat.tab_compressed', '压缩内容') }] : []),
    ...(originalContent ? [{ key: 'original', label: t('agent.chat.tab_original', '原文') }] : []),
    ...(systemPrompt ? [{ key: 'prompt', label: t('agent.chat.tab_prompt', '提示词') }] : []),
  ];

  const renderStats = () => {
    if (totalInputTokens <= 0 && totalOutputTokens <= 0) return null;
    
    return (
      <View style={{
        flexDirection: 'row',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.sm,
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.md,
        marginBottom: tokens.spacing.sm,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}>
          <Text style={{ fontSize: 12 }}>↑</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {t('agent.chat.round_input', '入')} {totalInputTokens}
          </Text>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}>
          <Text style={{ fontSize: 12 }}>↓</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {t('agent.chat.round_output', '出')} {totalOutputTokens}
          </Text>
        </View>
        {costText && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Text style={{ fontSize: 12 }}>$</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {t('agent.chat.round_cost', '耗')} {costText}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTabs = () => {
    if (tabs.length <= 1) return null;
    
    return (
      <View style={{
        flexDirection: 'row',
        marginBottom: tokens.spacing.sm,
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.full,
        padding: 4,
      }}>
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={{
              flex: 1,
              paddingVertical: tokens.spacing.xs,
              borderRadius: tokens.radius.full,
              backgroundColor: activeTab === tab.key ? colors.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 14,
              color: activeTab === tab.key ? colors.onPrimary : colors.textSecondary,
              fontWeight: activeTab === tab.key ? '600' : '400',
            }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderContextList = () => (
    <ScrollView style={{ maxHeight: 400 }}>
      {contextMessages.map((msg, idx) => (
        <Pressable
          key={idx}
          onPress={() => setSelectedMsgIndex(idx)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: tokens.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            gap: tokens.spacing.sm,
          }}
        >
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textSecondary,
            width: 30,
          }}>
            {idx + 1}
          </Text>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: tokens.radius.full,
            backgroundColor: getRoleColor(msg.role) + '20',
          }}>
            <Text style={{
              fontSize: 12,
              color: getRoleColor(msg.role),
              fontWeight: '600',
            }}>
              {getRoleLabel(msg.role)}
            </Text>
          </View>
          <Text style={{
            flex: 1,
            fontSize: 14,
            color: colors.textPrimary,
            numberOfLines: 1,
          }}>
            {msg.content || (msg.toolInvocations ? '→ 工具交互' : t('agent.chat.empty_content', '[空文本]'))}
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary }}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderContent = () => {
    if (activeTab === 'context') return renderContextList();
    
    const content = activeTab === 'compressed' ? compressedContent 
      : activeTab === 'original' ? originalContent 
      : systemPrompt;
    
    if (!content) return null;
    
    return (
      <ScrollView style={{ maxHeight: 400 }}>
        <Text style={{
          fontSize: 14,
          color: colors.textPrimary,
          lineHeight: 22,
          padding: tokens.spacing.sm,
          fontFamily: 'monospace',
        }}>
          {content}
        </Text>
      </ScrollView>
    );
  };

  const renderDetail = () => {
    if (selectedMsgIndex === null) return null;
    const msg = contextMessages[selectedMsgIndex];
    
    return (
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={{
          width: '90%',
          maxHeight: '80%',
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.xl,
          padding: tokens.spacing.lg,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing.md,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.sm,
            }}>
              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: tokens.radius.full,
                backgroundColor: getRoleColor(msg.role) + '20',
              }}>
                <Text style={{
                  fontSize: 14,
                  color: getRoleColor(msg.role),
                  fontWeight: '600',
                }}>
                  {getRoleLabel(msg.role)}
                </Text>
              </View>
              <Text style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}>
                #{selectedMsgIndex + 1}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedMsgIndex(null)}>
              <Text style={{ fontSize: 20, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>
          
          <ScrollView>
            <Text style={{
              fontSize: 16,
              color: colors.textPrimary,
              lineHeight: 24,
            }}>
              {msg.content || t('agent.chat.no_content', '[无内容]')}
            </Text>
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onClose}
      >
        <Pressable 
          style={{
            width: '90%',
            maxHeight: '80%',
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.xl,
            padding: tokens.spacing.lg,
          }}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing.md,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.sm,
            }}>
              <Text style={{ fontSize: 20 }}>🌿</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                {t('agent.chat.context_chain', '上下文调用链')}
              </Text>
              <View style={{
                backgroundColor: colors.primaryContainer,
                borderRadius: tokens.radius.full,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}>
                <Text style={{
                  fontSize: 12,
                  color: colors.onPrimaryContainer,
                }}>
                  {contextMessages.length}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>

          {renderStats()}
          {renderTabs()}
          
          <View style={{
            height: 1,
            backgroundColor: colors.borderSubtle,
            marginBottom: tokens.spacing.sm,
          }} />

          {renderContent()}
        </Pressable>
        
        {renderDetail()}
      </Pressable>
    </Modal>
  );
};
