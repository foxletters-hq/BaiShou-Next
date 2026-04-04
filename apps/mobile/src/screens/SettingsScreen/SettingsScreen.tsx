import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import { useBaishou } from '../../providers/BaishouProvider';
import { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared';


export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { services, dbReady } = useBaishou();

  const [deepseekKey, setDeepseekKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadSettings = async () => {
      try {
        const providers = await services.settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
        const dsProvider = providers.find(p => p.type === 'deepseek');
        if (dsProvider && dsProvider.apiKey) {
          setDeepseekKey(dsProvider.apiKey);
        }
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
      let providers = await services.settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
      const dsIndex = providers.findIndex(p => p.type === 'deepseek');
      
      if (dsIndex !== -1) {
        providers[dsIndex] = { ...providers[dsIndex], apiKey: deepseekKey, isEnabled: true };
      } else {
        providers.push({
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

      await services.settingsManager.set('ai_providers', providers);

      // Force it to be the global active model for testing
      let globalModels = await services.settingsManager.get<GlobalModelsConfig>('global_models') || {} as GlobalModelsConfig;
      const targetProviderId = dsIndex !== -1 ? providers[dsIndex].id : 'provider-deepseek-default';
      
      globalModels.globalDialogueProviderId = targetProviderId;
      globalModels.globalDialogueModelId = 'deepseek-chat';
      globalModels.globalNamingProviderId = targetProviderId;
      globalModels.globalNamingModelId = 'deepseek-chat';
      
      await services.settingsManager.set('global_models', globalModels);
      
      console.log('Saved DeepSeek key to Shadow DB & File system successfully');
    } catch(e) {
       console.error(e);
    } finally {
       setIsSaving(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>主控矩阵</Text>
            <Text style={styles.headerSubtitle}>CORE PARAMETERS (B8.3)</Text>
          </View>
          
          <ScrollView style={styles.contentContainer} indicatorStyle="white" keyboardShouldPersistTaps="handled">
            <View style={styles.warningBox}>
               <Text style={styles.warningIcon}>🛡️</Text>
               <Text style={styles.warningText}>
                  核心协议连接已加密。SSOT 配置管线已对接本地数据库。
               </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>大语言模型 API 注入 (测试区)</Text>
              
              <View style={styles.inputCard}>
                 <Text style={styles.inputLabel}>DeepSeek API Key</Text>
                 <TextInput 
                   style={styles.keyInput} 
                   value={deepseekKey}
                   onChangeText={setDeepseekKey}
                   placeholder="sk-..."
                   placeholderTextColor="#475569"
                   autoCapitalize="none"
                   secureTextEntry
                 />
                 <TouchableOpacity style={styles.saveButton} onPress={handleSaveKey} disabled={isSaving || !isLoaded}>
                    {isSaving ? <ActivityIndicator size="small" color="#10B981" /> : <Text style={styles.saveBtnText}>写 入 核 心</Text>}
                 </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>危险区 (Danger Zone)</Text>
              <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} activeOpacity={0.7} onPress={() => { /* 预留清空逻辑 */ }}>
                 <Text style={styles.dangerText}>☢️ 切断并遗忘所有凭证</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.footerMarker}>
               <Text style={styles.footerMarkerText}>[ VERSION: MOBILE-BETA-PHASE2 ]</Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0E14' },
  container: { flex: 1, backgroundColor: '#0B0E14' },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    backgroundColor: '#0F131A', 
    borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 10, fontWeight: '700', color: '#5BA8F5', marginTop: 4, letterSpacing: 1.5 },
  
  contentContainer: { flex: 1, padding: 20 },
  
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 32
  },
  warningIcon: { fontSize: 20 },
  warningText: { flex: 1, fontSize: 13, color: '#10B981', lineHeight: 20, fontWeight: '600' },
  
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  
  settingItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16, borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  settingItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.06)', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16 },
  settingText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  arrowText: { fontSize: 16, color: '#64748B', fontWeight: '900' },
  
  dangerItem: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  dangerText: { color: '#EF4444', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  footerMarker: { alignItems: 'center', marginTop: 24, marginBottom: 40, opacity: 0.2 },
  footerMarkerText: { color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  
  inputCard: {
     backgroundColor: 'rgba(255, 255, 255, 0.03)',
     padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputLabel: {
     fontSize: 14, color: '#94A3B8', fontWeight: '800', marginBottom: 12,
  },
  keyInput: {
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
     borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
     color: '#FFF', fontSize: 16, fontFamily: 'monospace',
     marginBottom: 16
  },
  saveButton: {
     backgroundColor: 'rgba(16, 185, 129, 0.15)',
     paddingVertical: 14, borderRadius: 10, alignItems: 'center',
     borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  saveBtnText: {
     color: '#10B981', fontSize: 15, fontWeight: '900', letterSpacing: 2
  }
});
