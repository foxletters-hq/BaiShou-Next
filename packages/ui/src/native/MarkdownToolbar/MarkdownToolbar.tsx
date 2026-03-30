import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';

interface MarkdownToolbarProps {
  isPreview: boolean;
  onTogglePreview: () => void;
  onHideKeyboard: () => void;
  onInsertText: (prefix: string, suffix?: string) => void;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  isPreview,
  onTogglePreview,
  onHideKeyboard,
  onInsertText
}) => {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('**', '**')}>
            <Text style={[styles.btnText, { fontWeight: 'bold' }]}>B</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('*', '*')}>
            <Text style={[styles.btnText, { fontStyle: 'italic' }]}>I</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('## ')}>
            <Text style={styles.btnText}>H</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('- ')}>
            <Text style={styles.btnText}>≡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('- [ ] ')}>
            <Text style={styles.btnText}>☑</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('[', '](url)')}>
            <Text style={styles.btnText}>🔗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('![', '](image_url)')}>
            <Text style={styles.btnText}>🖼️</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onTogglePreview}>
          <Text style={[styles.actionBtnText, isPreview && styles.actionBtnTextActive]}>
            {isPreview ? '✎' : '👁️'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onHideKeyboard}>
          <Text style={styles.actionBtnText}>⌨️↓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  scroll: {
    flex: 1,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    color: '#475569',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    marginHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(148, 163, 184, 0.2)',
    paddingLeft: 8,
    gap: 4,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 18,
    color: '#475569',
  },
  actionBtnTextActive: {
    color: '#5BA8F5',
  }
});
