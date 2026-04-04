import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';


interface ChatBubbleProps {
  message: { role: 'user' | 'assistant'; content: string };
  onEdit?: () => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onEdit }) => {
  const { t } = useTranslation();

  const isUser = message.role === 'user';
  
  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
       <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
            {message.content}
          </Text>
       </View>
       {isUser && onEdit && (
         <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
           <Text style={styles.actionText}>{t('common.edit', '编辑')}</Text>
         </TouchableOpacity>
       )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  containerAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  bubbleUser: {
    backgroundColor: '#5BA8F5',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAssistant: {
    color: '#1A1A1A',
  },
  actionBtn: {
    marginLeft: 8,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#888',
  }
});
