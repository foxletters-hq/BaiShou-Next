import { Stack } from 'expo-router'
import { useNativeTheme } from '@baishou/ui/native'

export default function SettingsStackLayout() {
  const { colors } = useNativeTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { flex: 1, backgroundColor: colors.bgApp }
      }}
    >
      <Stack.Screen name="[section]" />
      <Stack.Screen name="ai-provider/[id]" />
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="workspaces" />
      <Stack.Screen name="identity-cards" />
    </Stack>
  )
}
