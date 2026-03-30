import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { ChatBubble, InputBar, TokenBadge } from '@baishou/ui/native';
import { useAgentStore } from '@baishou/store/src/stores/agent.store';

export const AgentScreen = () => {
  const { messages, isLoading, setLoading, addMessage } = useAgentStore();
  
  const flatListRef = useRef<FlatList>(null);
  
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = (text: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    setLoading(true);
    
    // Mock response for now, until actual backend integration
    setTimeout(() => {
      addMessage({ id: Date.now().toString(), role: 'assistant', content: '这是一个模拟的移动端回复。目前是晴天！', timestamp: new Date() });
      setLoading(false);
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
          ref={flatListRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={{ role: item.role as any, content: item.content }} />
          )}
          inverted={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <InputBar
          onSend={handleSend}
          isLoading={isLoading}
          onStop={() => setLoading(false)}
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
