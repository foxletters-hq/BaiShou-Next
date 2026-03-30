import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';

interface InputBarProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  assistantName?: string;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSend,
  isLoading,
  onStop,
  assistantName = 'Assistant'
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
       <View style={styles.inputWrapper}>
          <TextInput
             style={styles.input}
             value={text}
             onChangeText={setText}
             placeholder={`发给 ${assistantName}...`}
             placeholderTextColor="#999"
             multiline
             maxLength={4000}
          />
          {isLoading ? (
             <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
                <View style={styles.stopIcon} />
             </TouchableOpacity>
          ) : (
             <TouchableOpacity 
               style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} 
               onPress={handleSend}
               disabled={!text.trim()}
             >
                <Text style={styles.sendIcon}>↑</Text>
             </TouchableOpacity>
          )}
       </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 24,
    maxHeight: 120,
    fontSize: 15,
    color: '#1A1A1A',
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5BA8F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#CCC',
  },
  sendIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#FFF',
    borderRadius: 2,
  }
});
