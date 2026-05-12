import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';

export interface RecallItem {
  id: string;
  type: 'diary' | 'memory';
  title: string;
  snippet: string;
  date: string;
}

export interface NativeRecallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: RecallItem[];
  isSearching?: boolean;
  onSearch: (query: string, tab: 'diary' | 'memory') => void;
  onInject: (selectedItems: RecallItem[]) => void;
}

export const RecallDialog: React.FC<NativeRecallDialogProps> = ({
  isOpen,
  onClose,
  items,
  isSearching,
  onInject,
  onSearch
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'diary' | 'memory'>('diary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery, activeTab);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab, isOpen]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInject = () => {
    const selected = items.filter(i => selectedIds.has(i.id));
    onInject(selected);
    setSelectedIds(new Set());
    onClose();
  };

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
              <Text style={{ fontSize: 20 }}>📚</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                {t('recall.title', '上下文补充与唤醒')}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={{
            flexDirection: 'row',
            marginBottom: tokens.spacing.sm,
            backgroundColor: colors.bgSurfaceNormal,
            borderRadius: tokens.radius.full,
            padding: 4,
          }}>
            <Pressable
              onPress={() => { setActiveTab('diary'); setSelectedIds(new Set()); }}
              style={{
                flex: 1,
                paddingVertical: tokens.spacing.xs,
                borderRadius: tokens.radius.full,
                backgroundColor: activeTab === 'diary' ? colors.primary : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 14,
                color: activeTab === 'diary' ? colors.onPrimary : colors.textSecondary,
                fontWeight: activeTab === 'diary' ? '600' : '400',
              }}>
                {t('recall.tab_diary', '日记档案')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveTab('memory'); setSelectedIds(new Set()); }}
              style={{
                flex: 1,
                paddingVertical: tokens.spacing.xs,
                borderRadius: tokens.radius.full,
                backgroundColor: activeTab === 'memory' ? colors.primary : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 14,
                color: activeTab === 'memory' ? colors.onPrimary : colors.textSecondary,
                fontWeight: activeTab === 'memory' ? '600' : '400',
              }}>
                {t('recall.tab_memory', '向量知识')}
              </Text>
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
              placeholder={t('recall.search_hint', '检索关键字或记忆片段...')}
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

          {/* List */}
          <ScrollView style={{ maxHeight: 300 }}>
            {isSearching ? (
              <View style={{
                padding: tokens.spacing.lg,
                alignItems: 'center',
              }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{
                  marginTop: tokens.spacing.sm,
                  color: colors.textSecondary,
                }}>
                  {t('common.loading', '加载中...')}
                </Text>
              </View>
            ) : items.length === 0 ? (
              <View style={{
                padding: tokens.spacing.lg,
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                }}>
                  {t('recall.no_results', '未在库中匹配到任何历史记忆碎片。')}
                </Text>
              </View>
            ) : (
              items.map(item => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleSelect(item.id)}
                    style={{
                      flexDirection: 'row',
                      padding: tokens.spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderSubtle,
                      backgroundColor: isSelected ? colors.primaryContainer + '40' : 'transparent',
                      gap: tokens.spacing.sm,
                    }}
                  >
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && <Text style={{ color: colors.onPrimary, fontSize: 12 }}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: tokens.spacing.xs,
                        }}>
                          <Text style={{ fontSize: 14 }}>
                            {item.type === 'diary' ? '📖' : '🧠'}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: colors.textPrimary,
                          }}>
                            {item.title}
                          </Text>
                        </View>
                        <Text style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}>
                          {item.date}
                        </Text>
                      </View>
                      <Text style={{
                        fontSize: 14,
                        color: colors.textSecondary,
                        numberOfLines: 2,
                      }}>
                        {item.snippet}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: tokens.spacing.md,
            paddingTop: tokens.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}>
            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              {t('recall.selected', '已选择')}{' '}
              <Text style={{
                fontWeight: '600',
                color: colors.primary,
              }}>
                {selectedIds.size}
              </Text>
            </Text>
            <Pressable
              onPress={handleInject}
              disabled={selectedIds.size === 0}
              style={({ pressed }) => ({
                backgroundColor: selectedIds.size > 0 ? colors.primary : colors.bgSurfaceNormal,
                borderRadius: tokens.radius.full,
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>↑</Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary,
              }}>
                {t('recall.inject', '提取至当前上下文对话')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
