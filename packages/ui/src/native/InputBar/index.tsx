import React, { forwardRef } from 'react'
import { View, TouchableOpacity, Text, Image, ScrollView } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { LayoutGrid, Maximize2, Menu, Minimize2, Send } from 'lucide-react-native'
import { Input } from '../Input/Input'
import { InlinePromptShortcutList } from './InlinePromptShortcutList'
import { resolveInputBarPrimaryAction } from '../../shared/input-bar-primary-action.util'
import { LucideIcon } from '../icons/LucideIcon'
import { INPUT_MIN_HEIGHT } from './input-bar-height.util'
import { nativeInputBarStyles as styles } from './native-input-bar.styles'
import { InputBarToolbar } from './InputBarToolbar'
import { ReasoningEffortControl } from './ReasoningEffortControl'
import { ModelReasoningControl } from './ModelReasoningControl'
import { useNativeInputBar } from './useNativeInputBar'
import type { InputBarProps, InputBarRef } from './input-bar.types'

export type { InputBarProps, InputBarRef, InputBarModelSelector } from './input-bar.types'
export { ModelReasoningControl } from './ModelReasoningControl'

export const InputBar = forwardRef<InputBarRef, InputBarProps>((props, ref) => {
  const bar = useNativeInputBar(props, ref)
  const { colors, t } = bar

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bar.toolbarProgress.value,
    maxHeight: bar.toolbarProgress.value * 48,
    marginBottom: 0,
    overflow: 'hidden' as const
  }))

  const inputFrameAnimatedStyle = useAnimatedStyle(() => ({
    height: bar.inputHeightSv.value,
    overflow: 'hidden' as const
  }))

  return (
    <View
      onLayout={(event) => {
        const next = Math.ceil(event.nativeEvent.layout.height)
        if (next > 0) bar.onHeightChange?.(next)
      }}
      style={styles.container}
    >
      <View
        style={[
          styles.composerBlock,
          bar.shortcutPanelHeight > 0 ? { paddingTop: bar.shortcutPanelHeight } : null
        ]}
      >
        <View style={styles.composerChromeAnchor}>
          <InlinePromptShortcutList
            visible={bar.shortcutHandlers.shortcutModeActive}
            shortcuts={bar.shortcutHandlers.filteredShortcuts}
            selectedIndex={bar.shortcutHandlers.selectedIndex}
            onSelect={bar.applyComposerShortcut}
            onHeightChange={bar.setShortcutPanelHeight}
          />

          <View
            style={[
              styles.composerChrome,
              {
                borderTopColor: colors.borderSubtle,
                backgroundColor: colors.bgSurface
              }
            ]}
          >
            {bar.skillRefs.length > 0 ? (
              <View style={styles.attachmentList}>
                {bar.skillRefs.map((skill) => (
                  <View
                    key={skill.command}
                    style={[
                      styles.attachmentChip,
                      {
                        borderColor: colors.borderMuted,
                        backgroundColor: colors.bgSurfaceHigh
                      }
                    ]}
                  >
                    <Text style={{ color: colors.primary }} numberOfLines={1}>
                      /{skill.command}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {bar.attachments.length > 0 && (
              <ScrollView
                horizontal
                style={styles.attachmentList}
                showsHorizontalScrollIndicator={false}
              >
                {bar.attachments.map((att) => (
                  <View
                    key={att.id}
                    style={[
                      styles.attachmentChip,
                      {
                        borderColor: colors.borderMuted,
                        backgroundColor: colors.bgSurfaceHigh
                      }
                    ]}
                  >
                    {att.isImage ? (
                      <Image source={{ uri: att.filePath }} style={styles.attImage} />
                    ) : (
                      <View style={styles.attDoc}>
                        <Text style={styles.attDocIcon}>
                          {att.isPdf || att.isText ? '📄' : '📁'}
                        </Text>
                        <Text
                          style={[styles.attDocName, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {att.fileName}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.attRemoveBtn, { backgroundColor: colors.bgOverlay }]}
                      onPress={() =>
                        bar.setAttachments((prev) => prev.filter((p) => p.id !== att.id))
                      }
                    >
                      <Text style={[styles.attRemoveLabel, { color: colors.textOnPrimary }]}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View
              style={[
                styles.composerShell,
                {
                  backgroundColor: bar.isDark ? colors.bgSurfaceHigh : colors.bgSurface,
                  borderColor: colors.borderStrong
                }
              ]}
            >
              <Animated.View
                style={[
                  toolbarAnimatedStyle,
                  bar.showToolbar
                    ? [styles.toolbarAttached, { borderBottomColor: colors.borderMuted }]
                    : null
                ]}
                pointerEvents={bar.showToolbar ? 'auto' : 'none'}
              >
                <InputBarToolbar
                  colors={colors}
                  onUploadAttachment={() => void bar.handleUploadAttachment()}
                  onShortcutPress={bar.handleShortcutPress}
                  onRecall={bar.onRecall}
                  onOpenNotebookMount={bar.onOpenNotebookMount}
                  searchMode={bar.searchMode}
                  onToggleSearchMode={bar.onToggleSearchMode}
                  ttsMode={bar.ttsMode}
                  onToggleTtsMode={bar.onToggleTtsMode}
                  onOpenTools={bar.onOpenTools}
                />
              </Animated.View>

              <View pointerEvents={bar.composerEnabled ? 'auto' : 'none'} style={styles.inputCard}>
                <View
                  style={[
                    styles.topRow,
                    bar.inputHeight <= INPUT_MIN_HEIGHT + 1 ? styles.topRowSingleLine : null
                  ]}
                >
                  <Animated.View style={[styles.inputWrapper, inputFrameAnimatedStyle]}>
                    <Input
                      ref={bar.inputRef}
                      bare
                      keyboardAware={false}
                      className="border-0 bg-transparent"
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          height: '100%'
                        }
                      ]}
                      value={bar.text}
                      onChangeText={bar.handleChangeText}
                      onKeyPress={bar.handleKeyPress}
                      onContentSizeChange={bar.handleContentSizeChange}
                      placeholder={t('agent.chat.input_hint', '输入消息...')}
                      multiline
                      scrollEnabled={bar.inputScrollEnabled}
                      nestedScrollEnabled
                      textAlignVertical={
                        !bar.isExpanded && bar.inputHeight <= INPUT_MIN_HEIGHT + 1
                          ? 'center'
                          : 'top'
                      }
                      editable={bar.composerEnabled}
                      onFocus={bar.composerEnabled ? bar.onInputFocus : undefined}
                    />
                  </Animated.View>
                  <TouchableOpacity
                    style={[
                      styles.expandToggle,
                      bar.inputHeight > INPUT_MIN_HEIGHT + 1 ? styles.expandToggleMultiline : null
                    ]}
                    onPress={bar.toggleExpand}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel={
                      bar.isExpanded
                        ? t('input.collapse', '折叠输入框')
                        : t('input.expand', '展开输入框')
                    }
                  >
                    <LucideIcon
                      icon={bar.isExpanded ? Minimize2 : Maximize2}
                      size={16}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomRow}>
                  <TouchableOpacity
                    style={styles.toolbarToggle}
                    onPress={bar.toggleToolbar}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <LucideIcon
                      icon={bar.showToolbar ? LayoutGrid : Menu}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

                  <View style={styles.bottomActions}>
                    {props.modelSelector ? (
                      <ModelReasoningControl
                        currentProviderId={props.modelSelector.currentProviderId}
                        currentModelId={props.modelSelector.currentModelId}
                        currentProviderType={props.modelSelector.currentProviderType}
                        displayModelName={props.modelSelector.displayModelName}
                        providers={props.modelSelector.providers}
                        onSelectModel={props.modelSelector.onSelectModel}
                        onManageProviders={props.modelSelector.onManageProviders}
                        reasoningEffort={
                          props.modelSelector.reasoningEffort || props.reasoningEffort
                        }
                      />
                    ) : props.reasoningEffort && props.reasoningEffort.options.length > 0 ? (
                      <ReasoningEffortControl
                        value={props.reasoningEffort.value}
                        options={props.reasoningEffort.options}
                        onChange={props.reasoningEffort.onChange}
                      />
                    ) : null}
                    {resolveInputBarPrimaryAction({
                      isLoading: bar.isLoading,
                      canSend: Boolean(bar.text.trim() || bar.attachments.length > 0),
                      hasStopHandler: Boolean(bar.onStop)
                    }) === 'stop' ? (
                      <TouchableOpacity
                        style={[styles.stopBtn, { backgroundColor: colors.textPrimary }]}
                        onPress={bar.onStop}
                        accessibilityLabel={t('common.stop', '停止')}
                      >
                        <View style={[styles.stopIcon, { backgroundColor: colors.bgSurface }]} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.sendBtn,
                          {
                            backgroundColor: colors.bgSurface,
                            borderWidth: 1,
                            borderColor:
                              !bar.text.trim() &&
                              bar.attachments.length === 0 &&
                              bar.skillRefs.length === 0
                                ? colors.borderSubtle
                                : colors.borderControl
                          },
                          bar.isSending && {
                            opacity: 0.72
                          }
                        ]}
                        onPress={() => void bar.handleSend()}
                        disabled={
                          bar.isSending ||
                          (!bar.text.trim() &&
                            bar.attachments.length === 0 &&
                            bar.skillRefs.length === 0)
                        }
                        accessibilityLabel={t('common.send', '发送')}
                      >
                        <LucideIcon
                          icon={Send}
                          size={18}
                          color={
                            !bar.text.trim() &&
                            bar.attachments.length === 0 &&
                            bar.skillRefs.length === 0
                              ? colors.textTertiary
                              : colors.textPrimary
                          }
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
})

InputBar.displayName = 'InputBar'
