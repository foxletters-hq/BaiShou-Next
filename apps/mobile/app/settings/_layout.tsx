import { Stack } from 'expo-router'
import { useNativeTheme } from '@baishou/ui/native'
import { fadeStackAnimation } from '@/src/navigation/fadeStackAnimation'

export default function SettingsStackLayout() {
  const { colors } = useNativeTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...fadeStackAnimation,
        contentStyle: { flex: 1, backgroundColor: colors.bgApp }
      }}
    >
      <Stack.Screen name="[section]" />
      <Stack.Screen name="assistants" />
      <Stack.Screen name="assistant-edit" />
      <Stack.Screen name="lan-transfer" />
      <Stack.Screen name="data-sync" />
      <Stack.Screen name="tts/index" />
      <Stack.Screen name="tts/[provider]" />
      <Stack.Screen name="ai-provider/[id]" />
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="workspaces" />
      <Stack.Screen name="identity-cards" />
    </Stack>
  )
}
