import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { MockChatMessage } from './context-chain-dialog.types'
import { getRoleColor, getRoleLabel } from './context-chain-dialog.utils'

interface ContextChainMessageDetailProps {
  message: MockChatMessage & { label?: string }
  index?: number
  onClose: () => void
  extraContent?: React.ReactNode
}

export const ContextChainMessageDetail: React.FC<ContextChainMessageDetailProps> = ({
  message,
  index,
  onClose,
  extraContent
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const { height: windowHeight } = useWindowDimensions()
  const modalMaxHeight = Math.floor(windowHeight * 0.8)
  const roleColor = getRoleColor(message.role, colors)
  const roleLabel = message.label || getRoleLabel(message.role, t)

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              maxWidth: maxModalWidth,
              height: modalMaxHeight,
              maxHeight: modalMaxHeight,
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }
          ]}
        >
          <View style={[styles.header, { marginBottom: tokens.spacing.md }]}>
            <View style={styles.headerSide} />
            <Pressable onPress={onClose} hitSlop={8} style={styles.headerSideRight}>
              <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
            </Pressable>

            <View style={styles.headerCenter} pointerEvents="none">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm,
                  maxWidth: '100%'
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: tokens.radius.full,
                    backgroundColor: roleColor + '20'
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: roleColor,
                      fontWeight: '600'
                    }}
                    numberOfLines={1}
                  >
                    {roleLabel}
                  </Text>
                </View>
                {index != null ? (
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>#{index + 1}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: tokens.spacing.sm }}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={false}
            overScrollMode="never"
          >
            <Text style={{ fontSize: 16, color: colors.textPrimary, lineHeight: 24 }}>
              {message.content || t('agent.chat.no_content', '[无内容]')}
            </Text>
            {extraContent}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    width: '90%',
    overflow: 'hidden'
  },
  header: {
    height: 44
  },
  headerSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: '50%',
    zIndex: 1
  },
  headerSideRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    right: 0,
    zIndex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  headerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48
  },
  scroll: {
    flex: 1,
    minHeight: 0
  }
})
