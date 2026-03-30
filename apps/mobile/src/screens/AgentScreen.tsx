import React, { useState } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { ChatBubble, InputBar, TokenBadge } from '@baishou/ui/native';

// Simplified Mock Data
const MOCK_MESSAGES = [
  { id: '1', role: 'assistant' as const, content: '你好！我是你的 BaiShou AI 助手，在手机端很高兴为你服务。' },
  { id: '2', role: 'user' as const, content: '今天的天气怎么样？' },
];

export const AgentScreen = () => {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    setIsStreaming(true);
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: '这是一个模拟的移动端回复。目前是晴天！' }
      ]);
      setIsStreaming(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
           <TokenBadge tokenCount={4500} costEstimate={0.01} />
        </View>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={{ role: item.role, content: item.content }} />
          )}
          inverted={false}
        />

        <InputBar
          onSend={handleSend}
          isLoading={isStreaming}
          onStop={() => setIsStreaming(false)}
          assistantName="BaiShou Assistant"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 16,
  }
});
