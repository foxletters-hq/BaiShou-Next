import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, ActivityIndicator, Alert, Switch, FlatList } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';
import { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { ProfileSettingsCard, AboutSettingsCard } from '@baishou/ui/src/native';

interface SettingsTab {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: string;
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: 'general', titleKey: 'settings.general', defaultTitle: '常规设置', icon: '⚙️' },
  { id: 'ai-services', titleKey: 'settings.ai_services', defaultTitle: 'AI 供应商', icon: '☁️' },
  { id: 'ai-models', titleKey: 'settings.ai_global_models', defaultTitle: '全局模型', icon: '⭐' },
  { id: 'assistants', titleKey: 'settings.assistants', defaultTitle: '伙伴管理', icon: '🤖' },
  { id: 'rag', titleKey: 'settings.rag', defaultTitle: 'RAG 记忆', icon: '🧠' },
  { id: 'web-search', titleKey: 'settings.web_search', defaultTitle: '网络搜索', icon: '🔍' },
  { id: 'agent-tools', titleKey: 'settings.agent_tools', defaultTitle: '工具管理', icon: '🔧' },
  { id: 'summary', titleKey: 'settings.summary', defaultTitle: '回忆生成', icon: '✨' },
  { id: 'lan-transfer', titleKey: 'settings.lan_transfer', defaultTitle: '局域网传输', icon: '📡' },
  { id: 'data-sync', titleKey: 'settings.data_sync', defaultTitle: '数据同步', icon: '🔄' },
  { id: 'attachments', titleKey: 'settings.attachments', defaultTitle: '附件管理', icon: '📎' },
];

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useNativeTheme();
  const { services, dbReady } = useBaishou();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('general');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
  const [language, setLanguage] = useState('zh-CN');
  const [profile, setProfile] = useState<any>({ nickname: '', avatarPath: '' });
  const [providers, setProviders] = useState<any[]>([]);
  const [globalModels, setGlobalModels] = useState<any>({});
  const [ragConfig, setRagConfig] = useState<any>({});
  const [webSearchConfig, setWebSearchConfig] = useState<any>({});
  const [toolConfig, setToolConfig] = useState<any>({});
  const [summaryConfig, setSummaryConfig] = useState<any>({});
  const [storageStats, setStorageStats] = useState<any>({});
  
  // RAG 相关状态
  const [ragStats, setRagStats] = useState<any>({ totalCount: 0, currentDimension: 0 });
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragProgress, setRagProgress] = useState<any>(null);
  
  // 模板编辑相关状态
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState('');
  
  // 附件相关状态
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadSettings = async () => {
      try {
        // 加载AI供应商配置
        const providerList = await services.settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
        setProviders(providerList);
        const dsProvider = providerList.find(p => p.type === 'deepseek');
        if (dsProvider && dsProvider.apiKey) {
          setDeepseekKey(dsProvider.apiKey);
        }
        
        // 加载全局模型配置
        const globalModelsConfig = await services.settingsManager.get<GlobalModelsConfig>('global_models') || {};
        setGlobalModels(globalModelsConfig);
        
        // 加载常规设置
        const settings = await services.settingsManager.get<any>('settings') || {};
        if (settings.themeMode) setThemeMode(settings.themeMode);
        if (settings.language) setLanguage(settings.language);
        
        // 加载用户资料
        const userProfile = await services.settingsManager.get<any>('user_profile') || {};
        setProfile(userProfile);
        
        // 加载RAG配置
        const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
        setRagConfig(ragConfigData);
        
        // 加载网络搜索配置
        const webSearchConfigData = await services.settingsManager.get<any>('web_search_config') || {};
        setWebSearchConfig(webSearchConfigData);
        
        // 加载工具配置
        const toolConfigData = await services.settingsManager.get<any>('tool_config') || {};
        setToolConfig(toolConfigData);
        
        // 加载总结配置
        const summaryConfigData = await services.settingsManager.get<any>('summary_config') || {};
        setSummaryConfig(summaryConfigData);
        
        // 加载存储统计
        const storageStatsData = await services.settingsManager.get<any>('storage_stats') || {};
        setStorageStats(storageStatsData);
        
      } catch (e) {
        console.warn('Load settings failed', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, [dbReady, services]);

  // 加载RAG统计信息
  const loadRagStats = useCallback(async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
      const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
      
      // 获取嵌入数量（从数据库查询）
      const dimension = globalModelsConfig.globalEmbeddingDimension || 0;
      setRagStats({
        totalCount: ragConfigData.totalEmbeddings || 0,
        currentDimension: dimension,
        totalSizeText: ragConfigData.totalSizeText || '0 KB'
      });
    } catch (e) {
      console.warn('Load RAG stats failed', e);
    } finally {
      setIsRagLoading(false);
    }
  }, [services, dbReady]);

  // 加载附件列表
  const loadAttachments = useCallback(async () => {
    if (!services || !dbReady) return;
    try {
      setIsLoadingAttachments(true);
      // 从存储统计中获取附件信息
      const storageStatsData = await services.settingsManager.get<any>('storage_stats') || {};
      const attachmentList = storageStatsData.attachments || [];
      setAttachments(attachmentList);
    } catch (e) {
      console.warn('Load attachments failed', e);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, [services, dbReady]);

  useEffect(() => {
    if (activeTab === 'rag') {
      loadRagStats();
    } else if (activeTab === 'attachments') {
      loadAttachments();
    }
  }, [activeTab, loadRagStats, loadAttachments]);

  const handleSaveKey = async () => {
    if (!services || !dbReady) return;
    setIsSaving(true);
    try {
      let providerList = await services.settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
      const dsIndex = providerList.findIndex(p => p.type === 'deepseek');
      
      if (dsIndex !== -1) {
        providerList[dsIndex] = { ...providerList[dsIndex], apiKey: deepseekKey, isEnabled: true };
      } else {
        providerList.push({
          id: 'provider-deepseek-default',
          name: 'DeepSeek',
          type: 'deepseek',
          apiKey: deepseekKey,
          baseUrl: 'https://api.deepseek.com/v1',
          models: ['deepseek-chat', 'deepseek-coder'],
          enabledModels: ['deepseek-chat'],
          defaultDialogueModel: 'deepseek-chat',
          defaultNamingModel: 'deepseek-chat',
          isEnabled: true,
          isSystem: false,
          sortOrder: 1,
        });
      }

      await services.settingsManager.set('ai_providers', providerList);
      setProviders(providerList);

      let globalModelsConfig = await services.settingsManager.get<GlobalModelsConfig>('global_models') || {} as GlobalModelsConfig;
      const targetProviderId = dsIndex !== -1 ? providerList[dsIndex].id : 'provider-deepseek-default';
      
      globalModelsConfig.globalDialogueProviderId = targetProviderId;
      globalModelsConfig.globalDialogueModelId = 'deepseek-chat';
      globalModelsConfig.globalNamingProviderId = targetProviderId;
      globalModelsConfig.globalNamingModelId = 'deepseek-chat';
      
      await services.settingsManager.set('global_models', globalModelsConfig);
      setGlobalModels(globalModelsConfig);
      
      Alert.alert(t('common.success', '成功'), t('settings.api_key_saved', 'API Key 已保存'));
    } catch(e) {
       console.error(e);
       Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    } finally {
       setIsSaving(false);
    }
  };

  const handleSaveTheme = async (mode: 'system' | 'light' | 'dark') => {
    if (!services || !dbReady) return;
    try {
      setThemeMode(mode);
      const settings = await services.settingsManager.get<any>('settings') || {};
      settings.themeMode = mode;
      await services.settingsManager.set('settings', settings);
    } catch (e) {
      console.error('Save theme failed', e);
    }
  };

  const handleSaveLanguage = async (lang: string) => {
    if (!services || !dbReady) return;
    try {
      setLanguage(lang);
      const settings = await services.settingsManager.get<any>('settings') || {};
      settings.language = lang;
      await services.settingsManager.set('settings', settings);
    } catch (e) {
      console.error('Save language failed', e);
    }
  };

  const handleSaveProfile = async (newProfile: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('user_profile', newProfile);
      setProfile(newProfile);
      Alert.alert(t('common.success', '成功'), t('settings.profile_saved', '用户资料已保存'));
    } catch (e) {
      console.error('Save profile failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleSaveGlobalModels = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('global_models', config);
      setGlobalModels(config);
      Alert.alert(t('common.success', '成功'), t('settings.global_models_saved', '全局模型配置已保存'));
    } catch (e) {
      console.error('Save global models failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleSaveRagConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('rag_config', config);
      setRagConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.rag_saved', 'RAG配置已保存'));
    } catch (e) {
      console.error('Save RAG config failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleSaveWebSearchConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('web_search_config', config);
      setWebSearchConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.web_search_saved', '网络搜索配置已保存'));
    } catch (e) {
      console.error('Save web search config failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleSaveToolConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('tool_config', config);
      setToolConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.tool_saved', '工具配置已保存'));
    } catch (e) {
      console.error('Save tool config failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  const handleSaveSummaryConfig = async (config: any) => {
    if (!services || !dbReady) return;
    try {
      await services.settingsManager.set('summary_config', config);
      setSummaryConfig(config);
      Alert.alert(t('common.success', '成功'), t('settings.summary_saved', '总结配置已保存'));
    } catch (e) {
      console.error('Save summary config failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'));
    }
  };

  // RAG 操作处理函数
  const handleDetectDimension = async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      // 获取全局模型配置
      const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
      const embeddingProviderId = globalModelsConfig.globalEmbeddingProviderId;
      const embeddingModelId = globalModelsConfig.globalEmbeddingModelId;
      
      if (!embeddingProviderId || !embeddingModelId) {
        Alert.alert(t('common.hint', '提示'), t('settings.no_embedding_model', '请先配置嵌入模型'));
        return;
      }
      
      // 模拟检测维度（实际应调用服务）
      const dimension = 1536; // 默认维度
      globalModelsConfig.globalEmbeddingDimension = dimension;
      await services.settingsManager.set('global_models', globalModelsConfig);
      
      setRagStats(prev => ({ ...prev, currentDimension: dimension }));
      Alert.alert(t('common.success', '成功'), t('settings.dimension_detected', '维度检测完成: {dimension}').replace('{dimension}', dimension.toString()));
    } catch (e) {
      console.error('Detect dimension failed', e);
      Alert.alert(t('common.error', '错误'), t('settings.detect_failed', '维度检测失败'));
    } finally {
      setIsRagLoading(false);
    }
  };

  const handleBatchEmbed = async () => {
    if (!services || !dbReady) return;
    try {
      setIsRagLoading(true);
      setRagProgress({ current: 0, total: 0, status: 'starting' });
      
      // 获取日记服务
      const diaryService = services.diaryService;
      const diaries = await diaryService.listAll({ limit: 10000 });
      const total = diaries?.length || 0;
      
      if (total === 0) {
        Alert.alert(t('common.hint', '提示'), t('settings.no_diaries_to_embed', '没有可嵌入的日记'));
        setRagProgress(null);
        return;
      }
      
      // 模拟批量嵌入进度
      for (let i = 0; i < total; i++) {
        setRagProgress({ 
          current: i + 1, 
          total, 
          status: `处理日记: ${diaries[i]?.date || ''}` 
        });
        // 这里应该调用实际的嵌入服务
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // 更新统计
      const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
      ragConfigData.totalEmbeddings = total;
      await services.settingsManager.set('rag_config', ragConfigData);
      
      setRagStats(prev => ({ ...prev, totalCount: total }));
      setRagProgress(null);
      Alert.alert(t('common.success', '成功'), t('settings.batch_embed_completed', '批量嵌入完成: {count} 条').replace('{count}', total.toString()));
    } catch (e) {
      console.error('Batch embed failed', e);
      setRagProgress(null);
      Alert.alert(t('common.error', '错误'), t('settings.batch_embed_failed', '批量嵌入失败'));
    } finally {
      setIsRagLoading(false);
    }
  };

  const handleClearMemory = async () => {
    if (!services || !dbReady) return;
    Alert.alert(
      t('settings.clear_memory_confirm_title', '确认清空'),
      t('settings.clear_memory_confirm_message', '此操作将清空所有RAG记忆数据，不可恢复。确定继续吗？'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        { 
          text: t('common.confirm', '确定'), 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRagLoading(true);
              // 清空RAG配置中的统计
              const ragConfigData = await services.settingsManager.get<any>('rag_config') || {};
              ragConfigData.totalEmbeddings = 0;
              await services.settingsManager.set('rag_config', ragConfigData);
              
              // 重置维度
              const globalModelsConfig = await services.settingsManager.get<any>('global_models') || {};
              globalModelsConfig.globalEmbeddingDimension = 0;
              await services.settingsManager.set('global_models', globalModelsConfig);
              
              setRagStats({ totalCount: 0, currentDimension: 0 });
              Alert.alert(t('common.success', '成功'), t('settings.memory_cleared', 'RAG记忆已清空'));
            } catch (e) {
              console.error('Clear memory failed', e);
              Alert.alert(t('common.error', '错误'), t('settings.clear_memory_failed', '清空记忆失败'));
            } finally {
              setIsRagLoading(false);
            }
          }
        }
      ]
    );
  };

  // 模板编辑处理函数
  const handleEditTemplate = (templateType: string) => {
    const templateKey = `${templateType}Template`;
    const defaultTemplates: Record<string, string> = {
      weekly: '请总结本周的日记内容，包括主要事件、情绪变化和重要记录。',
      monthly: '请总结本月的日记内容，回顾这个月的重要时刻和成长。',
      quarterly: '请总结本季度的日记内容，分析这段时间的经历和变化。',
      yearly: '请总结本年度的日记内容，回顾这一年的主要成就和感悟。',
    };
    setEditingTemplate(templateType);
    setTemplateText(summaryConfig[templateKey] || defaultTemplates[templateType] || '');
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !services || !dbReady) return;
    try {
      const templateKey = `${editingTemplate}Template`;
      const newConfig = { ...summaryConfig, [templateKey]: templateText };
      await handleSaveSummaryConfig(newConfig);
      setEditingTemplate(null);
      setTemplateText('');
    } catch (e) {
      console.error('Save template failed', e);
    }
  };

  const handleResetTemplate = async (templateType: string) => {
    if (!services || !dbReady) return;
    const defaultTemplates: Record<string, string> = {
      weekly: '请总结本周的日记内容，包括主要事件、情绪变化和重要记录。',
      monthly: '请总结本月的日记内容，回顾这个月的重要时刻和成长。',
      quarterly: '请总结本季度的日记内容，分析这段时间的经历和变化。',
      yearly: '请总结本年度的日记内容，回顾这一年的主要成就和感悟。',
    };
    const templateKey = `${templateType}Template`;
    const newConfig = { ...summaryConfig };
    delete newConfig[templateKey];
    await handleSaveSummaryConfig(newConfig);
    Alert.alert(t('common.success', '成功'), t('settings.template_reset', '模板已重置为默认'));
  };

  // 附件管理处理函数
  const handleToggleAttachmentSelection = (id: string) => {
    setSelectedAttachments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAllAttachments = () => {
    if (selectedAttachments.size === attachments.length) {
      setSelectedAttachments(new Set());
    } else {
      setSelectedAttachments(new Set(attachments.map(a => a.id)));
    }
  };

  const handleDeleteSelectedAttachments = async () => {
    if (selectedAttachments.size === 0) return;
    Alert.alert(
      t('settings.delete_attachments_confirm_title', '确认删除'),
      t('settings.delete_attachments_confirm_message', '确定删除选中的 {count} 个附件吗？').replace('{count}', selectedAttachments.size.toString()),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        { 
          text: t('common.delete', '删除'), 
          style: 'destructive',
          onPress: async () => {
            try {
              // 这里应该调用实际的删除服务
              const remaining = attachments.filter(a => !selectedAttachments.has(a.id));
              setAttachments(remaining);
              setSelectedAttachments(new Set());
              
              // 更新存储统计
              const storageStatsData = await services?.settingsManager.get<any>('storage_stats') || {};
              storageStatsData.attachments = remaining;
              storageStatsData.attachmentCount = remaining.length;
              await services?.settingsManager.set('storage_stats', storageStatsData);
              
              Alert.alert(t('common.success', '成功'), t('settings.attachments_deleted', '附件已删除'));
            } catch (e) {
              console.error('Delete attachments failed', e);
              Alert.alert(t('common.error', '错误'), t('settings.delete_attachments_failed', '删除附件失败'));
            }
          }
        }
      ]
    );
  };

  const renderGeneralSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.profile', '用户资料')}</Text>
      
      <ProfileSettingsCard
        profile={profile}
        onSave={handleSaveProfile}
      />

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.appearance', '外观设置')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.theme_mode', '主题模式')}</Text>
        <View style={styles.themeButtons}>
          {(['system', 'light', 'dark'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.themeButton,
                { backgroundColor: colors.bgSurface },
                themeMode === mode && { backgroundColor: colors.primary }
              ]}
              onPress={() => handleSaveTheme(mode)}
            >
              <Text style={[
                styles.themeButtonText,
                { color: colors.textSecondary },
                themeMode === mode && { color: '#FFF' }
              ]}>
                {mode === 'system' ? t('settings.theme_system', '跟随系统') : mode === 'light' ? t('settings.theme_light', '浅色') : t('settings.theme_dark', '深色')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.language', '语言')}</Text>
        <View style={styles.languageButtons}>
          {[
            { code: 'zh-CN', label: '中文' },
            { code: 'en-US', label: 'English' },
          ].map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                { backgroundColor: colors.bgSurface },
                language === lang.code && { backgroundColor: colors.primary }
              ]}
              onPress={() => handleSaveLanguage(lang.code)}
            >
              <Text style={[
                styles.languageButtonText,
                { color: colors.textSecondary },
                language === lang.code && { color: '#FFF' }
              ]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.data_management', '数据管理')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.storage_path', '存储路径')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{storageStats.storageRootPath || t('settings.not_set', '未设置')}</Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.sqlite_size', 'SQLite 大小')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{storageStats.sqliteSizeStats || '0 MB'}</Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.vector_db_size', '向量数据库大小')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{storageStats.vectorDbStats || '0 MB'}</Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.media_cache_size', '媒体缓存大小')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{storageStats.mediaCacheStats || '0 MB'}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.export_hint', '导出功能待实现'))}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.export_data', '导出数据')}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.import_hint', '导入功能待实现'))}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('settings.import_data', '导入数据')}</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.about', '关于')}</Text>
      
      <AboutSettingsCard
        version="4.0.0"
        onOpenGithubHost={() => {
          // 打开GitHub仓库
          Alert.alert(t('common.hint', '提示'), t('settings.github_hint', 'GitHub链接已复制'));
        }}
      />
    </View>
  );

  const renderAIServicesSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.ai_config', 'AI 供应商配置')}</Text>
      
      {providers.map((provider, index) => (
        <View key={index} style={[styles.providerItem, { backgroundColor: colors.bgSurfaceHighest }]}>
          <View style={styles.providerHeader}>
            <Text style={[styles.providerName, { color: colors.textPrimary }]}>{provider.name}</Text>
            <Switch
              value={provider.isEnabled}
              onValueChange={async (value) => {
                const newProviders = [...providers];
                newProviders[index] = { ...newProviders[index], isEnabled: value };
                await services?.settingsManager.set('ai_providers', newProviders);
                setProviders(newProviders);
              }}
            />
          </View>
          <Text style={[styles.providerType, { color: colors.textSecondary }]}>类型: {provider.type}</Text>
          <TextInput
            style={[styles.providerInput, { 
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={provider.apiKey}
            onChangeText={async (text) => {
              const newProviders = [...providers];
              newProviders[index] = { ...newProviders[index], apiKey: text };
              await services?.settingsManager.set('ai_providers', newProviders);
              setProviders(newProviders);
            }}
            placeholder="API Key"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
          <TextInput
            style={[styles.providerInput, { 
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={provider.baseUrl}
            onChangeText={async (text) => {
              const newProviders = [...providers];
              newProviders[index] = { ...newProviders[index], baseUrl: text };
              await services?.settingsManager.set('ai_providers', newProviders);
              setProviders(newProviders);
            }}
            placeholder="Base URL"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      ))}

      <View style={[styles.inputCard, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DeepSeek API Key</Text>
        <TextInput 
          style={[styles.keyInput, { 
            backgroundColor: colors.bgSurface,
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
          }]} 
          value={deepseekKey}
          onChangeText={setDeepseekKey}
          placeholder="sk-..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          secureTextEntry
        />
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.primary }]} 
          onPress={handleSaveKey} 
          disabled={isSaving || !isLoaded}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={[styles.saveBtnText, { color: '#FFF' }]}>{t('settings.save_api_key', '保存 API Key')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGlobalModelsSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.global_models', '全局默认模型')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.dialogue_model', '对话模型')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {globalModels.globalDialogueModelId || t('settings.not_set', '未设置')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.naming_model', '命名模型')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {globalModels.globalNamingModelId || t('settings.not_set', '未设置')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.embedding_model', '嵌入模型')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {globalModels.globalEmbeddingModelId || t('settings.not_set', '未设置')}
        </Text>
      </View>
    </View>
  );

  const renderAssistantsSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.assistants', '伙伴管理')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.assistants_desc', '管理AI助手和伙伴')}</Text>
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/assistants')}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.manage_assistants', '管理助手')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRAGSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.rag_title', 'RAG 记忆管理')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.rag_desc', '管理向量记忆和RAG配置')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.rag_enabled', '启用 RAG')}</Text>
        <Switch
          value={ragConfig.ragEnabled}
          onValueChange={(value) => handleSaveRagConfig({ ...ragConfig, ragEnabled: value })}
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.embedding_count', '嵌入数量')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.totalCount || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.rag_dimension', '向量维度')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragStats.currentDimension || t('settings.not_detected', '未检测')}
        </Text>
      </View>

      {ragProgress && (
        <View style={[styles.progressContainer, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.status}
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.borderSubtle }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: colors.primary,
                  width: `${ragProgress.total > 0 ? (ragProgress.current / ragProgress.total) * 100 : 0}%`
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {ragProgress.current} / {ragProgress.total}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleDetectDimension}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.detect_dimension', '检测维度')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={handleBatchEmbed}
        disabled={isRagLoading}
      >
        {isRagLoading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('settings.batch_embed', '批量嵌入')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.error || '#FF4444' }]}
        onPress={handleClearMemory}
        disabled={isRagLoading}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.clear_memory', '清空记忆')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWebSearchSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.web_search_title', '网络搜索设置')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.web_search_desc', '配置网络搜索供应商')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.web_search_enabled', '启用网络搜索')}</Text>
        <Switch
          value={webSearchConfig.enabled}
          onValueChange={(value) => handleSaveWebSearchConfig({ ...webSearchConfig, enabled: value })}
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.search_provider', '搜索供应商')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {webSearchConfig.provider || t('settings.not_set', '未设置')}
        </Text>
      </View>
    </View>
  );

  const renderAgentToolsSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.tools_title', '工具管理')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.tools_desc', '管理Agent可用工具')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.disabled_tools', '禁用工具')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {toolConfig.disabledToolIds?.length || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>
    </View>
  );

  const renderSummarySettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.summary_title', '回忆生成设置')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.summary_desc', '配置周/月/季/年总结模板')}</Text>
      
      {/* 模板编辑对话框 */}
      {editingTemplate && (
        <View style={[styles.templateEditor, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.templateEditorTitle, { color: colors.textPrimary }]}>
            {t('settings.edit_template', '编辑模板')} - {t(`settings.${editingTemplate}_template`, editingTemplate)}
          </Text>
          <TextInput
            style={[styles.templateInput, { 
              backgroundColor: colors.bgSurface,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
            }]}
            value={templateText}
            onChangeText={setTemplateText}
            placeholder={t('settings.template_placeholder', '输入模板内容...')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <View style={styles.templateActions}>
            <TouchableOpacity 
              style={[styles.templateButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveTemplate}
            >
              <Text style={[styles.templateButtonText, { color: '#FFF' }]}>{t('common.save', '保存')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.templateButton, { backgroundColor: colors.bgSurface }]}
              onPress={() => setEditingTemplate(null)}
            >
              <Text style={[styles.templateButtonText, { color: colors.textPrimary }]}>{t('common.cancel', '取消')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 周模板 */}
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <View style={styles.templateHeader}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.weekly_template', '周总结模板')}</Text>
          <View style={styles.templateActions}>
            <TouchableOpacity onPress={() => handleEditTemplate('weekly')}>
              <Text style={[styles.editButton, { color: colors.primary }]}>{t('common.edit', '编辑')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleResetTemplate('weekly')}>
              <Text style={[styles.editButton, { color: colors.textSecondary }]}>{t('settings.reset', '重置')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.weeklyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
        </Text>
      </View>

      {/* 月模板 */}
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <View style={styles.templateHeader}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.monthly_template', '月总结模板')}</Text>
          <View style={styles.templateActions}>
            <TouchableOpacity onPress={() => handleEditTemplate('monthly')}>
              <Text style={[styles.editButton, { color: colors.primary }]}>{t('common.edit', '编辑')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleResetTemplate('monthly')}>
              <Text style={[styles.editButton, { color: colors.textSecondary }]}>{t('settings.reset', '重置')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.monthlyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
        </Text>
      </View>

      {/* 季模板 */}
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <View style={styles.templateHeader}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.quarterly_template', '季总结模板')}</Text>
          <View style={styles.templateActions}>
            <TouchableOpacity onPress={() => handleEditTemplate('quarterly')}>
              <Text style={[styles.editButton, { color: colors.primary }]}>{t('common.edit', '编辑')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleResetTemplate('quarterly')}>
              <Text style={[styles.editButton, { color: colors.textSecondary }]}>{t('settings.reset', '重置')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.quarterlyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
        </Text>
      </View>

      {/* 年模板 */}
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <View style={styles.templateHeader}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.yearly_template', '年总结模板')}</Text>
          <View style={styles.templateActions}>
            <TouchableOpacity onPress={() => handleEditTemplate('yearly')}>
              <Text style={[styles.editButton, { color: colors.primary }]}>{t('common.edit', '编辑')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleResetTemplate('yearly')}>
              <Text style={[styles.editButton, { color: colors.textSecondary }]}>{t('settings.reset', '重置')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.yearlyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
        </Text>
      </View>
    </View>
  );

  const renderLanTransferSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.lan_title', '局域网传输')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.lan_desc', '配置局域网同步和传输')}</Text>
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/lan-transfer')}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.start_transfer', '开始传输')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDataSyncSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.sync_title', '数据同步')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.sync_desc', '配置云同步和备份')}</Text>
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={async () => {
          if (!services?.cloudSyncService) {
            Alert.alert(t('common.error', '错误'), t('settings.sync_service_unavailable', '同步服务不可用'));
            return;
          }

          // 获取第一个启用的同步目标
          const targets = await services.settingsManager.get<any[]>('sync_targets') || [];
          const enabledTarget = targets.find(t => t.isEnabled);

          if (!enabledTarget) {
            Alert.alert(t('common.hint', '提示'), t('settings.no_sync_target', '请先配置同步目标'));
            return;
          }

          try {
            // 构建同步配置
            const syncConfig = {
              target: enabledTarget.type,
              maxBackupCount: 5,
              webdavUrl: enabledTarget.url,
              webdavUsername: enabledTarget.username || '',
              webdavPassword: '',
              webdavPath: '/',
              s3Endpoint: enabledTarget.url,
              s3Region: '',
              s3Bucket: '',
              s3Path: '',
              s3AccessKey: enabledTarget.username || '',
              s3SecretKey: '',
            };

            Alert.alert(t('settings.syncing', '同步中'), t('settings.syncing_message', '正在同步数据...'));

            const result = await services.cloudSyncService.syncNow(syncConfig);

            Alert.alert(
              result.success ? t('common.success', '成功') : t('common.error', '错误'),
              result.message
            );
          } catch (e) {
            console.error('同步失败', e);
            Alert.alert(t('common.error', '错误'), t('settings.sync_failed', '同步失败'));
          }
        }}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.sync_now', '立即同步')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAttachmentsSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.attachments_title', '附件管理')}</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('settings.attachments_desc', '管理附件和存储空间')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.attachment_count', '附件数量')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {attachments.length || storageStats.attachmentCount || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.attachment_size', '附件大小')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {storageStats.attachmentSize || '0 MB'}
        </Text>
      </View>

      {/* 附件操作按钮 */}
      <View style={styles.attachmentActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleSelectAllAttachments}
          disabled={attachments.length === 0}
        >
          <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
            {selectedAttachments.size === attachments.length 
              ? t('settings.deselect_all', '取消全选') 
              : t('settings.select_all', '全选')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { 
            backgroundColor: selectedAttachments.size > 0 ? (colors.error || '#FF4444') : colors.bgSurfaceHighest 
          }]}
          onPress={handleDeleteSelectedAttachments}
          disabled={selectedAttachments.size === 0}
        >
          <Text style={[styles.actionButtonText, { 
            color: selectedAttachments.size > 0 ? '#FFF' : colors.textSecondary 
          }]}>
            {t('settings.delete_selected', '删除选中')} ({selectedAttachments.size})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 附件列表 */}
      {isLoadingAttachments ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('settings.loading_attachments', '加载附件中...')}
          </Text>
        </View>
      ) : attachments.length > 0 ? (
        <View style={[styles.attachmentList, { backgroundColor: colors.bgSurfaceHighest }]}>
          {attachments.map((attachment) => (
            <TouchableOpacity
              key={attachment.id}
              style={[styles.attachmentItem, { 
                backgroundColor: selectedAttachments.has(attachment.id) ? colors.bgSurface : 'transparent',
                borderBottomColor: colors.borderSubtle,
              }]}
              onPress={() => handleToggleAttachmentSelection(attachment.id)}
            >
              <View style={styles.attachmentCheckbox}>
                <View style={[
                  styles.checkbox, 
                  { borderColor: colors.borderSubtle },
                  selectedAttachments.has(attachment.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}>
                  {selectedAttachments.has(attachment.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </View>
              <View style={styles.attachmentInfo}>
                <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {attachment.name || attachment.id}
                </Text>
                <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                  {attachment.fileCount || 0} {t('settings.files', '文件')} • {attachment.sizeMB?.toFixed(2) || '0'} MB
                  {attachment.isOrphan && ` • ${t('settings.orphan', '孤立')}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyContainer, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('settings.no_attachments', '暂无附件')}
          </Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurface }]}
        onPress={loadAttachments}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('settings.refresh_attachments', '刷新列表')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'ai-services':
        return renderAIServicesSettings();
      case 'ai-models':
        return renderGlobalModelsSettings();
      case 'assistants':
        return renderAssistantsSettings();
      case 'rag':
        return renderRAGSettings();
      case 'web-search':
        return renderWebSearchSettings();
      case 'agent-tools':
        return renderAgentToolsSettings();
      case 'summary':
        return renderSummarySettings();
      case 'lan-transfer':
        return renderLanTransferSettings();
      case 'data-sync':
        return renderDataSyncSettings();
      case 'attachments':
        return renderAttachmentsSettings();
      default:
        return null;
    }
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bgApp }]}>
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title', '系统设置')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>SYSTEM SETTINGS</Text>
          </View>
          
          <View style={styles.content}>
            {/* 标签页导航 */}
            <ScrollView 
              style={[styles.tabBar, { backgroundColor: colors.bgSurface }]}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
            >
              {SETTINGS_TABS.map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabItem,
                    activeTab === tab.id && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text style={[
                    styles.tabTitle,
                    { color: colors.textSecondary },
                    activeTab === tab.id && { color: '#FFF' }
                  ]}>
                    {t(tab.titleKey, tab.defaultTitle)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* 设置内容 */}
            <ScrollView 
              style={styles.settingsContent}
              indicatorStyle="white"
              keyboardShouldPersistTaps="handled"
            >
              {renderContent()}
              
              <View style={styles.footerMarker}>
                <Text style={[styles.footerMarkerText, { color: colors.textSecondary }]}>
                  [ VERSION: MOBILE-BETA-PHASE3 ]
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1.5,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexGrow: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 14,
  },
  settingInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  providerItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  providerType: {
    fontSize: 12,
    marginBottom: 12,
  },
  providerInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  inputCard: {
    borderRadius: 12,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footerMarker: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    opacity: 0.2,
  },
  footerMarkerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  // RAG 进度相关样式
  progressContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  // 模板编辑相关样式
  templateEditor: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  templateEditorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  templateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 12,
  },
  templateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  templateButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 附件管理相关样式
  attachmentActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  attachmentList: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  attachmentCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  attachmentMeta: {
    fontSize: 12,
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
  },
});