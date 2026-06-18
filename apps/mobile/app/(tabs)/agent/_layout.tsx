import { Stack } from 'expo-router'
import { useNativeTheme } from '@baishou/ui/native'
import { buildThemedFadeStackOptions } from '@/src/navigation/themedNavigation'

export default function AgentTabLayout() {
  const { colors } = useNativeTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...buildThemedFadeStackOptions(colors.bgApp)
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="tools" />
    </Stack>
  )
}
