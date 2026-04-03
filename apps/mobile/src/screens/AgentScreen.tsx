import React, { useRef, useEffect } from 'react';
import { 
  View, StyleSheet, FlatList, KeyboardAvoidingView, 
  Platform, SafeAreaView, StatusBar, TouchableOpacity, Text
} from 'react-native';
import { ChatBubble, InputBar, TokenBadge } from '@baishou/ui/native';
import { useAgentStore } from '@baishou/store/src/stores/agent.store';

import { useBaishou } from '../providers/BaishouProvider';

export const AgentScreen = () => {
  const { messages, isLoading, setLoading, addMessage, updateMessage } = useAgentStore();
  const { startAgentChat } = useBaishou();
  const flatListRef = useRef<FlatList>(null);
  
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    
    const sessionId = 'mobile-session-01'; // Default session for mobile quick chat
    const astId = (Date.now() + 1).toString();
    addMessage({ id: astId, role: 'assistant', content: '', timestamp: new Date() });
    setLoading(true);

    try {
      let currentText = '';
      await startAgentChat?.(sessionId, text, {
        onTextDelta: (chunk) => {
          currentText += chunk;
          updateMessage(astId, { content: currentText });
        },
        onFinish: () => {
          setLoading(false);
        },
        onError: (err) => {
          setLoading(false);
          updateMessage(astId, { content: currentText + '\n\n[ERR] 传输链路破裂：' + err.message });
        }
      });
    } catch (e: any) {
      setLoading(false);
      updateMessage(astId, { content: '[系统灾难] ' + e.message });
    }
  };

  return (
    <>
      {/* 沉浸式深色状态栏适配 */}
      <StatusBar barStyle="light-content" backgroundColor="#0B0E14" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* 顶部 Token 与配置全息栏 */}
          <View style={styles.header}>
             <View style={styles.headerTitleWrap}>
                <View style={styles.agentAvatarPlaceholder}>
                   <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
                <View>
                   <Text style={styles.headerAgentName}>BaiShou Core</Text>
                   <Text style={styles.headerAgentStatus}>🟢 Neural Sync Active</Text>
                </View>
             </View>
             <View style={styles.tokenBadgeWrap}>
                <TokenBadge tokenCount={8924} costEstimate={0.03} />
             </View>
          </View>

          {/* 聊天气泡穿透流卷轴 */}
          <FlatList
            ref={flatListRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.bubbleWrapper}>
                 <ChatBubble message={{ role: item.role as any, content: item.content }} />
              </View>
            )}
            inverted={false}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
               <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🌌</Text>
                  <Text style={styles.emptyText}>神经节完全空白</Text>
                  <Text style={styles.emptySubText}>尝试敲入指令以焕发突触...</Text>
               </View>
            }
          />

          {/* 底部功能条控制塔 (挂载快捷指令、相机与附件选择入口占位) */}
          <View style={styles.quickActionBar}>
             <TouchableOpacity style={styles.quickActionBtn}>
                <Text style={styles.quickActionBtnText}>/</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.quickActionBtn}>
                <Text style={styles.quickActionBtnText}>📷</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.quickActionBtn}>
                <Text style={styles.quickActionBtnText}>📌</Text>
             </TouchableOpacity>
          </View>

          {/* 核心输入引擎 */}
          <View style={styles.inputContainer}>
            <InputBar
              onSend={handleSend}
              isLoading={isLoading}
              onStop={() => setLoading(false)}
              assistantName="BaiShou Assistant"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#0F131A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  agentAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center'
  },
  headerAgentName: {
    color: '#FFF', fontSize: 15, fontWeight: '800',
    letterSpacing: 0.5
  },
  headerAgentStatus: {
    color: '#10B981', fontSize: 11, fontWeight: '600'
  },
  tokenBadgeWrap: {
    transform: [{ scale: 0.9 }]
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexGrow: 1
  },
  bubbleWrapper: {
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '30%',
    opacity: 0.5
  },
  emptyIcon: {
    fontSize: 56, marginBottom: 16
  },
  emptyText: {
    color: '#94A3B8', fontSize: 18, fontWeight: '700', marginBottom: 8
  },
  emptySubText: {
    color: '#475569', fontSize: 14, fontWeight: '500'
  },
  quickActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#0F131A',
  },
  quickActionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center'
  },
  quickActionBtnText: {
    color: '#94A3B8', fontSize: 15, fontWeight: '800'
  },
  inputContainer: {
    backgroundColor: '#0F131A',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16 // iOS Bottom safe space manual override
  }
});
