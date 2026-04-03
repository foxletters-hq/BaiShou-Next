import { Stack } from 'expo-router';
import { DiaryEditorScreen } from '@/src/screens/DiaryScreen/DiaryEditorScreen';

export default function DiaryEditorRoute() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', title: '编辑记忆', headerShown: false }} />
      <DiaryEditorScreen />
    </>
  );
}
