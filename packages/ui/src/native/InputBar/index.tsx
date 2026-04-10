import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Image, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { MockChatAttachment } from '@baishou/shared';
import { useTranslation } from 'react-i18next';


interface InputBarProps {
  isLoading: boolean;
  onSend: (text: string, attachments?: MockChatAttachment[]) => void;
  onStop?: () => void;
  assistantName?: string;
  onAssistantTap?: () => void;
  onRecall?: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSend,
  isLoading,
  onStop,
  assistantName = 'Assistant'
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([]);

  const handlePickFiles = async () => {
  try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: '*/*', // Allow all, can be restricted later
      });
      
      if (!result.canceled && result.assets) {
        const newAtts = result.assets.map(asset => {
  const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(asset.name) || (asset.mimeType?.startsWith('image/') ?? false);
          const isPdf = /\.pdf$/i.test(asset.name) || asset.mimeType === 'application/pdf';
          return {
            id: Math.random().toString(36).substring(7),
            fileName: asset.name,
            filePath: asset.uri,
            isImage,
            isPdf
          };
        });
        setAttachments(prev => [...prev, ...newAtts]);
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const handleSend = () => {
  if ((text.trim() || attachments.length > 0) && !isLoading) {


      onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined);
      setText('');
      setAttachments([]);
    }
  };

  return (
    <View style={styles.container}>
       {attachments.length > 0 && (
         <ScrollView horizontal style={styles.attachmentList} showsHorizontalScrollIndicator={false}>
            {attachments.map(att => (
               <View key={att.id} style={styles.attachmentChip}>
                  {att.isImage ? (
                    <Image source={{ uri: att.filePath }} style={styles.attImage} />
                  ) : (
                    <View style={styles.attDoc}>
                      <Text style={styles.attDocIcon}>{att.isPdf ? '📄' : '📁'}</Text>
                      <Text style={styles.attDocName} numberOfLines={1}>{att.fileName}</Text>
                    </View>
                  )}
                  <TouchableOpacity 
                    style={styles.attRemoveBtn}
                    onPress={() => setAttachments(prev => prev.filter(p => p.id !== att.id))}
                  >
                    <Text style={styles.attRemoveLabel}>×</Text>
                  </TouchableOpacity>
               </View>
            ))}
         </ScrollView>
       )}
       
       <View style={styles.toolbarRow}>
          <TouchableOpacity style={styles.toolBtn} onPress={handlePickFiles}>
             <Text style={styles.toolIcon}>📎</Text>
          </TouchableOpacity>
       </View>

       <View style={styles.inputWrapper}>
          <TextInput
             style={styles.input}
             value={text}
             onChangeText={setText}
             placeholder={t('chat.send_to', '发给 {{name}}...', { name: assistantName })}
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
    backgroundColor: 'var(--bg-surface)',
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
    color: 'var(--text-primary)',
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
    backgroundColor: 'var(--text-primary)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 2,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  toolBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  toolIcon: {
    fontSize: 16,
  },
  attachmentList: {
    flexDirection: 'row',
    marginBottom: 10,
    maxHeight: 64,
  },
  attachmentChip: {
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#F9F9F9',
    width: 64,
    height: 64,
    overflow: 'hidden',
    position: 'relative'
  },
  attImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  attDoc: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attDocIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  attDocName: {
    fontSize: 9,
    textAlign: 'center',
    color: 'var(--text-secondary)',
  },
  attRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attRemoveLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
