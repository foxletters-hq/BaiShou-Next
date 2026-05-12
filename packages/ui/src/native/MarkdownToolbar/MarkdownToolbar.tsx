import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useNativeTheme } from '../../native/theme';

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
  const { colors } = useNativeTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface, borderTopColor: colors.borderSubtle, shadowColor: colors.textPrimary }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('**', '**')}>
            <Text style={[styles.btnText, { color: colors.textSecondary, fontWeight: 'bold' }]}>B</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('*', '*')}>
            <Text style={[styles.btnText, { color: colors.textSecondary, fontStyle: 'italic' }]}>I</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('## ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>H</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('- ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>≡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('- [ ] ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>☑</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('[', '](url)')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>🔗</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => onInsertText('![', '](image_url)')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>🖼️</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.actions, { borderLeftColor: colors.borderSubtle }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onTogglePreview}>
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }, isPreview && { color: colors.primary }]}>
            {isPreview ? '✎' : '👁️'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onHideKeyboard}>
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>⌨️↓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
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
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
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
  }
});
