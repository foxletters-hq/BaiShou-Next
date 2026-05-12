import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';
import { Button } from '../Button/Button';

export interface MockAgentAssistant {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  systemPrompt?: string;
  providerId?: string;
  modelId?: string;
  contextWindow?: number;
  compressTokenThreshold?: number;
}

interface NativeAssistantPickerProps {
  isOpen: boolean;
  onClose: () => void;
  assistants: MockAgentAssistant[];
  currentAssistantId?: string | null;
  onSelect: (assistant: MockAgentAssistant) => void;
}

export const AssistantPicker: React.FC<NativeAssistantPickerProps> = ({
  isOpen,
  onClose,
  assistants,
  currentAssistantId,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(currentAssistantId || null);
  
  const filteredAssistants = useMemo(() => {
    return assistants.filter(a => 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assistants, searchQuery]);

  const activeAssistant = useMemo(() => {
    let item = filteredAssistants.find(a => a.id === selectedId);
    if (!item && filteredAssistants.length > 0) {
      item = filteredAssistants[0];
    }
    return item;
  }, [filteredAssistants, selectedId]);

  if (!isOpen) return null;

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
              <Text style={{ fontSize: 20 }}>✨</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                {t('agent.selectAssistant', '选择助手')}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bgSurfaceNormal,
            borderRadius: tokens.radius.md,
            paddingHorizontal: tokens.spacing.sm,
            marginBottom: tokens.spacing.md,
          }}>
            <Text style={{ fontSize: 16, marginRight: tokens.spacing.xs }}>🔍</Text>
            <TextInput
              placeholder={t('common.search', '搜索...')}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                paddingVertical: tokens.spacing.sm,
                color: colors.textPrimary,
                fontSize: 16,
              }}
            />
          </View>

          {/* Assistant List */}
          <ScrollView style={{ maxHeight: 300 }}>
            {filteredAssistants.length === 0 ? (
              <View style={{
                padding: tokens.spacing.lg,
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                }}>
                  {t('agent.noAssistant', '暂无助手')}
                </Text>
              </View>
            ) : (
              filteredAssistants.map(a => {
                const isSelected = activeAssistant?.id === a.id;
                const isCurrent = a.id === currentAssistantId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setSelectedId(a.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: tokens.spacing.sm,
                      borderRadius: tokens.radius.md,
                      backgroundColor: isSelected ? colors.primaryContainer : 'transparent',
                      gap: tokens.spacing.sm,
                      marginBottom: tokens.spacing.xs,
                    }}
                  >
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.bgSurfaceNormal,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 20 }}>{a.emoji || '✨'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: tokens.spacing.xs,
                      }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: isSelected ? colors.onPrimaryContainer : colors.textPrimary,
                        }}>
                          {a.name}
                        </Text>
                        {isCurrent && (
                          <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.primary,
                          }} />
                        )}
                      </View>
                      <Text style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                        numberOfLines: 1,
                      }}>
                        {a.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Create Button */}
          <View style={{
            paddingTop: tokens.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            alignItems: 'center',
          }}>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.spacing.xs,
                paddingVertical: tokens.spacing.sm,
              }}
            >
              <Text style={{ fontSize: 18, color: colors.primary }}>+</Text>
              <Text style={{
                fontSize: 14,
                color: colors.primary,
                fontWeight: '600',
              }}>
                {t('agent.createAssistant', '创建助手')}
              </Text>
            </Pressable>
          </View>

          {/* Detail & Select Button */}
          {activeAssistant && (
            <View style={{
              paddingTop: tokens.spacing.sm,
            }}>
              <Button
                variant={activeAssistant.id === currentAssistantId ? 'outlined' : 'elevated'}
                onPress={() => {
                  onSelect(activeAssistant);
                  onClose();
                }}
              >
                {activeAssistant.id === currentAssistantId ? (
                  <Text style={{
                    color: colors.primary,
                    fontWeight: '600',
                  }}>
                    ✅ {t('agent.currentAssistant', '当前助手')}
                  </Text>
                ) : (
                  <Text style={{
                    color: colors.onPrimary,
                    fontWeight: '600',
                  }}>
                    ⇄ {t('agent.selectThis', '选择此助手')}
                  </Text>
                )}
              </Button>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
