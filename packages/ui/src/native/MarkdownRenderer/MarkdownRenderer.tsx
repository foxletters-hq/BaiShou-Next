import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useNativeTheme } from '../theme';

export interface MarkdownRendererProps {
  content: string;
  style?: any;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, style }) => {
  const { colors, isDark } = useNativeTheme();

  const markdownStyles = StyleSheet.create({
    body: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    heading2: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 14,
      marginBottom: 6,
    },
    heading3: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 12,
      marginBottom: 4,
    },
    paragraph: {
      color: colors.textPrimary,
      marginBottom: 8,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'none',
    },
    blockquote: {
      backgroundColor: colors.bgSurfaceHighest,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
    },
    code_inline: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      padding: 12,
      borderRadius: 8,
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    fence: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      padding: 12,
      borderRadius: 8,
      fontFamily: 'monospace',
      marginBottom: 8,
    },
    list_item: {
      color: colors.textPrimary,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    hr: {
      backgroundColor: colors.borderSubtle,
      height: 1,
      marginVertical: 16,
    },
    table: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: 8,
    },
    thead: {
      backgroundColor: colors.bgSurfaceHighest,
    },
    tbody: {
      backgroundColor: colors.bgSurface,
    },
    th: {
      padding: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary,
      fontWeight: 'bold',
    },
    td: {
      padding: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.borderSubtle,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Markdown style={markdownStyles}>
        {content}
      </Markdown>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});