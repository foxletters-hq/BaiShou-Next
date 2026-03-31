import { StyleSheet, View, Text } from 'react-native';

export default function SummaryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Data Summary / Archive</Text>
      <Text style={styles.subtitle}>Feature is coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});
