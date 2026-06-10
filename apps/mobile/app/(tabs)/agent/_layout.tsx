import { Stack } from 'expo-router'
import { fadeStackAnimation } from '@/src/navigation/fadeStackAnimation'

export default function AgentTabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="tools" options={fadeStackAnimation} />
    </Stack>
  )
}
