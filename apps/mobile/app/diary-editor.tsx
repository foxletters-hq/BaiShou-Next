import { Stack } from 'expo-router'
import { DiaryEditorScreen } from '@/src/screens/DiaryScreen/DiaryEditorScreen'
import { fadeStackAnimation } from '@/src/navigation/fadeStackAnimation'

export default function DiaryEditorRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: '编辑记忆',
          headerShown: false,
          ...fadeStackAnimation
        }}
      />
      <DiaryEditorScreen />
    </>
  )
}
