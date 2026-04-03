import { View, StyleSheet } from 'react-native';
import { SettingsScreen } from '@/src/screens/SettingsScreen/SettingsScreen';

export default function SettingsTab() {
  return (
    <View style={styles.container}>
      <SettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});
