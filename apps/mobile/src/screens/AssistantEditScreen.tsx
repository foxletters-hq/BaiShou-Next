import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, Switch } from 'react-native';
import { useNativeTheme } from '@baishou/ui/native';
import { useBaishou } from '../providers/BaishouProvider';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface Assistant {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  systemPrompt?: string;
  isDefault: boolean;
  isPinned: boolean;
  providerId?: string;
  modelId?: string;
  contextWindow?: number;
  compressTokenThreshold?: number;
  compressKeepTurns?: number;
}

export const AssistantEditScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const [contextWindow, setContextWindow] = useState(-1);
  const [compressTokenThreshold, setCompressTokenThreshold] = useState(60000);
  const [compressKeepTurns, setCompressKeepTurns] = useState(3);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !dbReady || !services) return;
    
    const loadAssistant = async () => {
      try {
        const assistants = await services.settingsManager.get<Assistant[]>('assistants') || [];
        const assistant = assistants.find(a => a.id === id);
        if (assistant) {
          setName(assistant.name);
          setEmoji(assistant.emoji);
          setDescription(assistant.description || '');
          setSystemPrompt(assistant.systemPrompt || '');
          setIsDefault(assistant.isDefault);
          setIsPinned(assistant.isPinned);
          setProviderId(assistant.providerId || '');
          setModelId(assistant.modelId || '');
          setContextWindow(assistant.contextWindow ?? -1);
          setCompressTokenThreshold(assistant.compressTokenThreshold ?? 60000);
          setCompressKeepTurns(assistant.compressKeepTurns ?? 3);
        } else {
          Alert.alert('错误', '助手未找到');
          router.back();
        }
      } catch (e) {
        console.error('Failed to load assistant', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadAssistant();
  }, [id, isNew, dbReady, services, router]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('错误', '助手名称不能为空');
      return;
    }

    if (!dbReady || !services) return;
    setSaving(true);

    try {
      const assistants = await services.settingsManager.get<Assistant[]>('assistants') || [];
      
      const assistantData: Assistant = {
        id: isNew ? Date.now().toString() : (id as string),
        name: name.trim(),
        emoji,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        isDefault,
        isPinned,
        providerId: providerId || undefined,
        modelId: modelId || undefined,
        contextWindow,
        compressTokenThreshold,
        compressKeepTurns,
      };

      let newAssistants: Assistant[];
      
      if (isNew) {
        newAssistants = [...assistants, assistantData];
      } else {
        newAssistants = assistants.map(a => 
          a.id === id ? { ...a, ...assistantData } : a
        );
      }

      await services.settingsManager.set('assistants', newAssistants);
      Alert.alert('成功', isNew ? '助手已创建' : '助手已更新');
      router.back();
    } catch (e) {
      console.error('Failed to save assistant', e);
      Alert.alert('错误', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || isDefault) return;

    Alert.alert(
      '确认删除',
      `确定要删除助手「${name}」吗？此操作不可逆转。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              const assistants = await services?.settingsManager.get<Assistant[]>('assistants') || [];
              const newAssistants = assistants.filter(a => a.id !== id);
              await services?.settingsManager.set('assistants', newAssistants);
              Alert.alert('成功', '助手已删除');
              router.back();
            } catch (e) {
              console.error('Failed to delete assistant', e);
              Alert.alert('错误', '删除失败');
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      
      {/* 头部 */}
      <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.primary }]}>← 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {isNew ? '新建助手' : '编辑助手'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveButton, { color: saving ? colors.textSecondary : colors.primary }]}>
            {saving ? '保存中...' : '保存'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} indicatorStyle="white">
        {/* 基本信息 */}
        <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>基本信息</Text>
          
          <View style={styles.emojiRow}>
            <TouchableOpacity style={[styles.emojiButton, { backgroundColor: colors.bgSurfaceHighest }]}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.nameInput, { 
                backgroundColor: colors.bgSurfaceHighest,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              }]}
              value={name}
              onChangeText={setName}
              placeholder="助手名称"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.bgSurfaceHighest,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={description}
            onChangeText={setDescription}
            placeholder="助手描述（可选）"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* 系统提示词 */}
        <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>系统提示词</Text>
          <TextInput
            style={[styles.promptInput, { 
              backgroundColor: colors.bgSurfaceHighest,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="输入系统提示词..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* 模型配置 */}
        <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>模型配置</Text>
          
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: colors.textPrimary }]}>Provider ID</Text>
            <TextInput
              style={[styles.configInput, { 
                backgroundColor: colors.bgSurfaceHighest,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              }]}
              value={providerId}
              onChangeText={setProviderId}
              placeholder="留空使用全局配置"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: colors.textPrimary }]}>Model ID</Text>
            <TextInput
              style={[styles.configInput, { 
                backgroundColor: colors.bgSurfaceHighest,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              }]}
              value={modelId}
              onChangeText={setModelId}
              placeholder="留空使用全局配置"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* 高级设置 */}
        <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>高级设置</Text>
          
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>设为默认助手</Text>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: colors.bgSurfaceHighest, true: colors.primary + '80' }}
              thumbColor={isDefault ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>置顶显示</Text>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: colors.bgSurfaceHighest, true: colors.primary + '80' }}
              thumbColor={isPinned ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>

        {/* 删除按钮 */}
        {!isNew && !isDefault && (
          <TouchableOpacity 
            style={[styles.deleteButton, { backgroundColor: '#EF4444' + '10' }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteText, { color: '#EF4444' }]}>删除助手</Text>
          </TouchableOpacity>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {isNew ? '创建后可在设置中修改' : '修改后点击右上角保存'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 60,
  },
  promptInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 150,
  },
  configRow: {
    marginBottom: 12,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  configInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});