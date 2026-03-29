import React from 'react';
import { StyleSheet, Text, View, useColorScheme, FlatList } from 'react-native';
import { useAgentStore } from '@baishou/store/stores/agent.store';

export default function AgentScreen() {
  const colorScheme = useColorScheme();
  const themeStyles = colorScheme === 'dark' ? darkStyles : lightStyles;
  const messages = useAgentStore((state: any) => state.messages);

  return (
    <View style={[styles.container, themeStyles.container]}>
      <FlatList
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <Text style={themeStyles.text}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, themeStyles.textSecondary]}>
              有什么我可以帮你记录的吗？
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
  },
  messageBubble: {
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(91, 168, 245, 0.1)',
  },
});

const lightStyles = StyleSheet.create({
  container: { backgroundColor: '#F6F7F8' },
  text: { color: '#1A1A1A' },
  textSecondary: { color: '#475569' },
});

const darkStyles = StyleSheet.create({
  container: { backgroundColor: '#101922' },
  text: { color: '#FFFFFF' },
  textSecondary: { color: '#92ADC9' },
});
