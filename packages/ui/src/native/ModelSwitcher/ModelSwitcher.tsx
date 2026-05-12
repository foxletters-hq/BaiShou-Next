import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';

export interface MockAiProviderModel {
  id: string;
  name: string;
  enabledModels?: string[];
  models?: string[];
}

interface NativeModelSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  providers: MockAiProviderModel[];
  currentProviderId?: string | null;
  currentModelId?: string | null;
  onSelect: (providerId: string, modelId: string) => void;
  onManageProviders?: () => void;
}

export const ModelSwitcher: React.FC<NativeModelSwitcherProps> = ({
  isOpen,
  onClose,
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onManageProviders
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const { filteredProviders, filteredModels } = useMemo(() => {
    const pList: MockAiProviderModel[] = [];
    const mDict: Record<string, string[]> = {};

    const query = searchQuery.toLowerCase();

    for (const provider of providers) {
      const enabled = provider.enabledModels || [];
      const all = provider.models || [];
      const modelList = enabled.length > 0 ? enabled : all;
      const matched = query ? modelList.filter(m => m && m.toLowerCase().includes(query)) : modelList;

      if (matched.length > 0) {
        pList.push(provider);
        mDict[provider.id] = matched;
      }
    }

    return { filteredProviders: pList, filteredModels: mDict };
  }, [providers, searchQuery]);

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
              <Text style={{ fontSize: 20 }}>⇄</Text>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                {t('agent.switchModel', '切换心智核心')}
              </Text>
            </View>
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
              placeholder={t('common.search', '搜索模型 ...')}
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
          <ScrollView style={{ maxHeight: 400 }}>
            {filteredProviders.length === 0 ? (
              <View style={{
                padding: tokens.spacing.lg,
                alignItems: 'center',
                gap: tokens.spacing.sm,
              }}>
                <Text style={{ fontSize: 32, opacity: 0.3 }}>✨</Text>
                <Text style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                }}>
                  {t('agent.noMatchModel', '未发现可搭载的模型')}
                </Text>
                {onManageProviders && (
                  <Pressable
                    onPress={() => { onManageProviders(); onClose(); }}
                    style={{
                      backgroundColor: colors.primaryContainer,
                      borderRadius: tokens.radius.full,
                      paddingHorizontal: tokens.spacing.md,
                      paddingVertical: tokens.spacing.sm,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: tokens.spacing.xs,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>⚙️</Text>
                    <Text style={{
                      fontSize: 14,
                      color: colors.onPrimaryContainer,
                      fontWeight: '600',
                    }}>
                      {t('models.goto_settings', '配置供应商')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              filteredProviders.map(provider => {
                const models = filteredModels[provider.id] || [];
                const isCurrentProvider = provider.id === currentProviderId;

                return (
                  <View key={provider.id} style={{ marginBottom: tokens.spacing.md }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: tokens.spacing.sm,
                      marginBottom: tokens.spacing.sm,
                    }}>
                      <Text style={{ fontSize: 14 }}>📦</Text>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: colors.textPrimary,
                      }}>
                        {provider.name}
                      </Text>
                      <View style={{
                        backgroundColor: colors.bgSurfaceNormal,
                        borderRadius: tokens.radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}>
                          {models.length}
                        </Text>
                      </View>
                    </View>

                    {models.map(modelId => {
                      const isSelected = isCurrentProvider && modelId === currentModelId;
                      
                      return (
                        <Pressable
                          key={modelId}
                          onPress={() => {
                            onSelect(provider.id, modelId);
                            onClose();
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: tokens.spacing.sm,
                            borderRadius: tokens.radius.md,
                            backgroundColor: isSelected ? colors.primaryContainer : 'transparent',
                            marginLeft: tokens.spacing.md,
                            gap: tokens.spacing.sm,
                          }}
                        >
                          <Text style={{ fontSize: 16 }}>💻</Text>
                          <Text style={{
                            flex: 1,
                            fontSize: 14,
                            color: isSelected ? colors.onPrimaryContainer : colors.textPrimary,
                            fontWeight: isSelected ? '600' : '400',
                          }}>
                            {modelId}
                          </Text>
                          {isSelected && (
                            <Text style={{ fontSize: 16, color: colors.primary }}>✓</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          {onManageProviders && filteredProviders.length > 0 && (
            <View style={{
              paddingTop: tokens.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              alignItems: 'center',
            }}>
              <Pressable
                onPress={() => { onManageProviders(); onClose(); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.xs,
                  paddingVertical: tokens.spacing.sm,
                }}
              >
                <Text style={{ fontSize: 14 }}>⚙️</Text>
                <Text style={{
                  fontSize: 14,
                  color: colors.primary,
                  fontWeight: '600',
                }}>
                  {t('agent.manageProviders', '管理模型与供应商')}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
