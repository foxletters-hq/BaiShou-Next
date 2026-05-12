import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';
import { useNativeToast } from '../Toast';
import { Button } from '../Button/Button';

export interface UserProfileConfig {
  nickname: string;
  avatarPath?: string;
  activePersonaId: string;
  personas: Record<string, { id: string; facts: Record<string, string> }>;
}

export interface NativeIdentitySettingsCardProps {
  profile: UserProfileConfig;
  onChange: (profile: UserProfileConfig) => void;
}

export const IdentitySettingsCard: React.FC<NativeIdentitySettingsCardProps> = ({ profile, onChange }) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const toast = useNativeToast();
  const [collapsed, setCollapsed] = useState(true);
  const [isFactModalOpen, setIsFactModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyInput, setEditKeyInput] = useState('');
  const [editValInput, setEditValInput] = useState('');

  const activeId = profile.activePersonaId || 'Default';
  const allPersonas = profile.personas || { 'Default': { id: 'Default', facts: {} } };
  
  if (!allPersonas[activeId]) {
    allPersonas[activeId] = { id: activeId, facts: {} };
  }
  
  const currentFacts = allPersonas[activeId].facts || {};

  const handleSwitch = (pid: string) => {
    if (pid !== activeId) {
      onChange({ ...profile, activePersonaId: pid });
    } else {
      Alert.prompt(
        t('settings.rename_identity_card', '重命名身份卡'),
        undefined,
        (newName) => {
          if (newName && newName !== pid && !allPersonas[newName]) {
            const nextPersonas = { ...allPersonas };
            nextPersonas[newName] = { ...nextPersonas[pid], id: newName };
            delete nextPersonas[pid];
            onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
          }
        },
        'plain-text',
        pid
      );
    }
  };

  const handleAddPersona = () => {
    Alert.prompt(
      t('settings.new_identity_card', '新建身份卡'),
      undefined,
      (newName) => {
        if (newName && !allPersonas[newName]) {
          const nextPersonas = { ...allPersonas, [newName]: { id: newName, facts: {} } };
          onChange({ ...profile, personas: nextPersonas, activePersonaId: newName });
        }
      },
      'plain-text'
    );
  };

  const handleDeletePersona = (pid: string) => {
    if (Object.keys(allPersonas).length <= 1) {
      toast.showToast(t('settings.identity_min_one', '至少保留一张身份卡！'), 'error');
      return;
    }
    Alert.alert(
      t('common.confirm', '确认'),
      t('settings.delete_identity_card', '确定删除身份卡: $personaId').replace('$personaId', pid),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          style: 'destructive',
          onPress: () => {
            const nextPersonas = { ...allPersonas };
            delete nextPersonas[pid];
            const remainingIds = Object.keys(nextPersonas);
            onChange({ ...profile, personas: nextPersonas, activePersonaId: remainingIds[0] });
          }
        }
      ]
    );
  };

  const startEdit = (k: string, v: string) => {
    setEditingKey(k);
    setEditKeyInput(k);
    setEditValInput(v);
    setIsFactModalOpen(true);
  };

  const handleAddFact = () => {
    setEditingKey(null);
    setEditKeyInput('');
    setEditValInput('');
    setIsFactModalOpen(true);
  };

  const saveEdit = () => {
    const k = editKeyInput.trim();
    const v = editValInput.trim();
    if (!k || !v) {
      toast.showToast(t('settings.empty_fact_error', '键名和键值不能为空'), 'error');
      return;
    }
    
    if (k !== editingKey && currentFacts[k]) {
      toast.showToast(t('settings.duplicate_fact_error', '该特征键名已存在'), 'error');
      return;
    }

    const nextFacts = { ...currentFacts };
    if (editingKey && editingKey !== k) {
      delete nextFacts[editingKey];
    }
    nextFacts[k] = v;
    onChange({
      ...profile,
      personas: { ...allPersonas, [activeId]: { ...allPersonas[activeId], facts: nextFacts } }
    });
    setIsFactModalOpen(false);
  };

  const handleDeleteFact = (k: string) => {
    Alert.alert(
      t('common.confirm', '确认'),
      t('settings.delete_identity_confirm', '确认删除「$key」？').replace('$key', k),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.confirm', '确定'),
          style: 'destructive',
          onPress: () => {
            const nextFacts = { ...currentFacts };
            delete nextFacts[k];
            onChange({
              ...profile,
              personas: { ...allPersonas, [activeId]: { ...allPersonas[activeId], facts: nextFacts } }
            });
          }
        }
      ]
    );
  };

  return (
    <View style={{
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.lg,
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <Pressable
        onPress={() => setCollapsed(!collapsed)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: tokens.spacing.lg,
          gap: tokens.spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 20 }}>🪪</Text>
        <Text style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          color: colors.textPrimary,
        }}>
          {t('settings.identity_card', '身份卡')}
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
            {Object.keys(currentFacts).length} {t('settings.items', '条')}
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>
          {collapsed ? '▼' : '▲'}
        </Text>
      </Pressable>

      {/* 可折叠内容 */}
      {!collapsed && (
        <View style={{
          paddingHorizontal: tokens.spacing.lg,
          paddingBottom: tokens.spacing.lg,
        }}>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: tokens.spacing.md,
          }}>
            {t('settings.identity_card_desc', '助手将自动结合这些核心词条构筑角色认知与您对话。')}
          </Text>

          {/* 身份卡 Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: tokens.spacing.md }}
          >
            <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
              {Object.keys(allPersonas).map(pid => {
                const isActive = pid === activeId;
                return (
                  <Pressable
                    key={pid}
                    onPress={() => handleSwitch(pid)}
                    onLongPress={() => handleDeletePersona(pid)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: tokens.spacing.md,
                      paddingVertical: tokens.spacing.sm,
                      borderRadius: tokens.radius.full,
                      backgroundColor: isActive ? colors.primary : colors.bgSurfaceNormal,
                      opacity: pressed ? 0.7 : 1,
                      gap: tokens.spacing.xs,
                    })}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: isActive ? colors.onPrimary : colors.textPrimary,
                      fontWeight: isActive ? '600' : '400',
                    }}>
                      {pid}
                    </Text>
                    {isActive && Object.keys(allPersonas).length > 1 && (
                      <Pressable onPress={() => handleDeletePersona(pid)}>
                        <Text style={{
                          fontSize: 14,
                          color: isActive ? colors.onPrimary : colors.textSecondary,
                        }}>×</Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={handleAddPersona}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.sm,
                  borderRadius: tokens.radius.full,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderStyle: 'dashed',
                  opacity: pressed ? 0.7 : 1,
                  gap: tokens.spacing.xs,
                })}
              >
                <Text style={{ fontSize: 14, color: colors.primary }}>+</Text>
                <Text style={{ fontSize: 14, color: colors.primary }}>
                  {t('settings.new_identity', '新身份')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* 属性列表 */}
          <View style={{
            backgroundColor: colors.bgSurfaceNormal,
            borderRadius: tokens.radius.md,
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: tokens.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.textPrimary,
              }}>
                {t('settings.identity_facts_title', '属性设置')}
              </Text>
              <Pressable
                onPress={handleAddFact}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 14, color: colors.primary }}>+</Text>
                <Text style={{ fontSize: 14, color: colors.primary }}>
                  {t('settings.add_identity_entry_btn', '添加属性')}
                </Text>
              </Pressable>
            </View>

            {Object.keys(currentFacts).length === 0 ? (
              <View style={{
                padding: tokens.spacing.lg,
                alignItems: 'center',
                gap: tokens.spacing.sm,
              }}>
                <Text style={{ fontSize: 32, opacity: 0.3 }}>👤</Text>
                <Text style={{
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}>
                  {t('settings.identity_card_empty_hint', '当前身份为空白，不妨添加一些基本特征描述吧。')}
                </Text>
              </View>
            ) : (
              Object.entries(currentFacts).map(([k, v]) => (
                <View
                  key={k}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: tokens.spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                    gap: tokens.spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>🏷️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.textPrimary,
                    }}>
                      {k}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      color: colors.textSecondary,
                    }}>
                      {v}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => startEdit(k, v)}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary }}>✎</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteFact(k)}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 14, color: colors.error }}>🗑️</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* 编辑弹窗 */}
      <Modal
        visible={isFactModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFactModalOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setIsFactModalOpen(false)}
        >
          <Pressable
            style={{
              width: '85%',
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg,
            }}
            onPress={e => e.stopPropagation()}
          >
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: colors.textPrimary,
              marginBottom: tokens.spacing.md,
            }}>
              {editingKey ? t('settings.edit_fact', '编辑特征') : t('settings.new_fact', '新增特征')}
            </Text>

            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: tokens.spacing.xs,
            }}>
              {t('settings.fact_key', '特征名')}
            </Text>
            <TextInput
              value={editKeyInput}
              onChangeText={setEditKeyInput}
              placeholder={t('settings.fact_key_placeholder', '如：年龄、性格、身份')}
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: tokens.radius.md,
                padding: tokens.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurfaceNormal,
                marginBottom: tokens.spacing.md,
              }}
            />

            <Text style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: tokens.spacing.xs,
            }}>
              {t('settings.fact_value', '特征值')}
            </Text>
            <TextInput
              value={editValInput}
              onChangeText={setEditValInput}
              placeholder={t('settings.fact_value_placeholder', '如：25岁、傲娇、魔法使')}
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1,
                borderColor: colors.outlineVariant,
                borderRadius: tokens.radius.md,
                padding: tokens.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                backgroundColor: colors.bgSurfaceNormal,
                marginBottom: tokens.spacing.lg,
              }}
            />

            <View style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: tokens.spacing.sm,
            }}>
              <Button variant="text" onPress={() => setIsFactModalOpen(false)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button variant="elevated" onPress={saveEdit}>
                {t('common.save', '保存')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
