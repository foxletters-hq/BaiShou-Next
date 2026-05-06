import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { useNativeTheme } from '@baishou/ui/src/native/theme';
import { useBaishou } from '../../providers/BaishouProvider';
import { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared';
import { useTranslation } from 'react-i18next';

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

  const renderGeneralSettings = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('settings.profile', '用户资料')}</Text>
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.nickname', '昵称')}</Text>
        <TextInput
          style={[styles.settingInput, { 
            backgroundColor: colors.bgSurface,
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
          }]}
          value={profile.nickname}
          onChangeText={(text) => setProfile({ ...profile, nickname: text })}
          placeholder={t('settings.nickname_placeholder', '输入昵称')}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

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
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.version', '版本')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>v2.0.0-Next-Canary</Text>
      </View>
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
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.manage_assistants_hint', '助手管理功能待实现'))}
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
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.rag_dimension', '向量维度')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {ragConfig.dimension || t('settings.not_detected', '未检测')}
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.detect_dimension_hint', '检测维度功能待实现'))}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('settings.detect_dimension', '检测维度')}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.batch_embed_hint', '批量嵌入功能待实现'))}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('settings.batch_embed', '批量嵌入')}</Text>
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
      
      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.weekly_template', '周总结模板')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.weeklyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.monthly_template', '月总结模板')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]} numberOfLines={2}>
          {summaryConfig.monthlyTemplate?.substring(0, 50) || t('settings.default_template', '默认模板')}...
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
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.lan_transfer_hint', '局域网传输功能待实现'))}
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
        onPress={() => Alert.alert(t('common.hint', '提示'), t('settings.sync_hint', '数据同步功能待实现'))}
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
          {storageStats.attachmentCount || 0} {t('settings.count_unit', '个')}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.attachment_size', '附件大小')}</Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {storageStats.attachmentSize || '0 MB'}
        </Text>
      </View>
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
});