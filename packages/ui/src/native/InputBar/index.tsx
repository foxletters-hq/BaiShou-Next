import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Image, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { MockChatAttachment } from '@baishou/shared';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../../native/theme';

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
  const { colors } = useNativeTheme();
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
    <View style={[styles.container, { backgroundColor: colors.bgSurface, borderTopColor: colors.borderMuted }]}>
       {attachments.length > 0 && (
         <ScrollView horizontal style={styles.attachmentList} showsHorizontalScrollIndicator={false}>
            {attachments.map(att => (
               <View key={att.id} style={[styles.attachmentChip, { borderColor: colors.borderMuted, backgroundColor: colors.bgSurfaceHigh }]}>
                  {att.isImage ? (
                    <Image source={{ uri: att.filePath }} style={styles.attImage} />
                  ) : (
                    <View style={styles.attDoc}>
                      <Text style={styles.attDocIcon}>{att.isPdf ? '📄' : '📁'}</Text>
                      <Text style={[styles.attDocName, { color: colors.textSecondary }]} numberOfLines={1}>{att.fileName}</Text>
                    </View>
                  )}
                  <TouchableOpacity 
                    style={[styles.attRemoveBtn, { backgroundColor: colors.bgOverlay }]}
                    onPress={() => setAttachments(prev => prev.filter(p => p.id !== att.id))}
                  >
                    <Text style={[styles.attRemoveLabel, { color: colors.textOnPrimary }]}>×</Text>
                  </TouchableOpacity>
               </View>
            ))}
         </ScrollView>
       )}
       
       <View style={styles.toolbarRow}>
          <TouchableOpacity style={[styles.toolBtn, { backgroundColor: colors.bgSurfaceHigh }]} onPress={handlePickFiles}>
             <Text style={styles.toolIcon}>📎</Text>
          </TouchableOpacity>
       </View>

       <View style={[styles.inputWrapper, { backgroundColor: colors.bgSurfaceHigh }]}>
          <TextInput
             style={[styles.input, { color: colors.textPrimary }]}
             value={text}
             onChangeText={setText}
             placeholder={t('chat.send_to', '发给 {{name}}...', { name: assistantName })}
             placeholderTextColor={colors.textTertiary}
             multiline
             maxLength={4000}
          />
          {isLoading ? (
             <TouchableOpacity style={[styles.stopBtn, { backgroundColor: colors.textPrimary }]} onPress={onStop}>
                <View style={[styles.stopIcon, { backgroundColor: colors.bgSurface }]} />
             </TouchableOpacity>
          ) : (
             <TouchableOpacity 
               style={[styles.sendBtn, { backgroundColor: colors.primary }, !text.trim() && { backgroundColor: colors.textTertiary }]} 
               onPress={handleSend}
               disabled={!text.trim()}
             >
                <Text style={[styles.sendIcon, { color: colors.textOnPrimary }]}>↑</Text>
             </TouchableOpacity>
          )}
       </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 24,
    maxHeight: 120,
    fontSize: 15,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  stopIcon: {
    width: 12,
    height: 12,
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
  },
  attRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attRemoveLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  }
});
