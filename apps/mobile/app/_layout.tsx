import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, NativeModules } from 'react-native';
import i18n from 'i18next';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BaishouProvider, useBaishou } from '@/src/providers/BaishouProvider';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

const getSystemLanguage = () => {
  try {
    let locale = 'zh';
    if (Platform.OS === 'ios') {
      locale = NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || NativeModules.SettingsManager?.settings?.AppleLocale || 'zh';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'zh';
    }
    const cleanLang = locale.split(/[-_]/)[0];
    return ['zh', 'en', 'ja', 'zh-TW'].includes(cleanLang) ? cleanLang : 'zh';
  } catch (e) {
    return 'zh';
  }
};

function AppContent() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const { dbReady, services } = useBaishou();

  useEffect(() => {
    if (!dbReady || !services) return;
    const loadSavedLanguage = async () => {
      try {
        const settings = await services.settingsManager.get<any>('settings') || {};
        const savedLang = settings.language || 'system';
        const targetLang = savedLang === 'system' ? getSystemLanguage() : savedLang;
        if (i18n.language !== targetLang) {
          await i18n.changeLanguage(targetLang);
        }
      } catch (e) {
        console.error('Failed to load language in root layout', e);
      }
    };
    loadSavedLanguage();
  }, [dbReady, services]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="diary-editor" options={{
          presentation: 'modal',
          title: t('diary.editor_title', '编辑记忆'),
          headerShown: false
        }} />
        <Stack.Screen name="sessions" options={{
          title: t('agent.sessions.title', '会话管理')
        }} />
        <Stack.Screen name="assistants" options={{
          title: t('agent.assistants.title', '伙伴管理')
        }} />
        <Stack.Screen name="assistant-edit" options={{
          title: t('agent.assistant_edit.title', '编辑助手')
        }} />
        <Stack.Screen name="lan-transfer" options={{
          title: t('lan_transfer.title', '局域网传输')
        }} />
        <Stack.Screen name="data-sync" options={{
          title: t('data_sync.title', '数据同步')
        }} />
        <Stack.Screen name="summary-detail" options={{
          title: t('summary.detail_title', '总结详情'),
          headerShown: false
        }} />
        <Stack.Screen name="storage" options={{
          title: t('storage.title', '存储管理')
        }} />
        <Stack.Screen name="modal" options={{
          presentation: 'modal',
          title: 'Modal'
        }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <BaishouProvider>
      <AppContent />
    </BaishouProvider>
  );
}

