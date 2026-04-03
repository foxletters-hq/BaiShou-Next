import { SummaryScreen } from '@/src/screens/SummaryScreen/SummaryScreen';
import { View, StyleSheet } from 'react-native';

export default function SummaryTab() {
  return (
    <View style={styles.container}>
      <SummaryScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
