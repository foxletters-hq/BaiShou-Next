import { DiaryScreen } from '@/src/screens/DiaryScreen/DiaryScreen';
import { View, StyleSheet } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <DiaryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
