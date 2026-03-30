import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AppearanceSettingsCard, SettingsItem } from '@baishou/ui';
import { useSettingsMock } from './hooks/useSettingsMock';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useSettingsMock();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title') || '设置'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 1:1 复刻的卡片式外观设置 - 纯响应 */}
        <AppearanceSettingsCard 
          themeMode={state.themeMode}
          seedColor={state.seedColor}
          language={state.language}
          onThemeModeChange={actions.setThemeMode}
          onSeedColorChange={actions.setSeedColor}
          onLanguageChange={actions.setLanguage}
        />

        <Text style={styles.sectionTitle}>{t('settings.general_title') || '通用设置'}</Text>
        <View style={styles.sectionCard}>
          <SettingsItem 
            title={t('settings.data_sync') || '数据同步'} 
            onClick={() => console.log('Data sync')}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F8' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  scrollContent: { paddingVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginLeft: 24, marginBottom: 8, marginTop: 8 },
  sectionCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)', overflow: 'hidden'
  }
});
