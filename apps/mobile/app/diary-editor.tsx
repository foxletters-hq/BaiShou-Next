import i18n from 'i18next'
import { Stack } from 'expo-router'
import { DiaryEditorScreen } from '@/src/screens/DiaryScreen/DiaryEditorScreen'
import { fadeStackAnimation } from '@/src/navigation/fadeStackAnimation'

export default function DiaryEditorRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'fullScreenModal',
          title: i18n.t('auto.apps.mobile.app.diary.editor.L11', '编辑记忆'),
          headerShown: false,
          ...fadeStackAnimation
        }}
      />
      <DiaryEditorScreen />
    </>
  )
}
