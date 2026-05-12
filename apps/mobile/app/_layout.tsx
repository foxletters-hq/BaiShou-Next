import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BaishouProvider } from '@/src/providers/BaishouProvider';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <BaishouProvider>
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
          <Stack.Screen name="modal" options={{
            presentation: 'modal',
            title: 'Modal'
          }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </BaishouProvider>
  );
}
