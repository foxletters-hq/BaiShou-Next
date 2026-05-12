import React, { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface ToolExecution {
  name: string;
  durationMs: number;
}

export interface NativeStreamingBubbleProps {
  text: string;
  reasoning?: string;
  isReasoning?: boolean;
  activeToolName?: string | null;
  completedTools?: ToolExecution[];
  aiProfile?: { name: string; avatarPath?: string | null; emoji?: string | null };
  error?: string | null;
  onRetry?: () => void;
  onStop?: () => void;
}

export const StreamingBubble: React.FC<NativeStreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  onStop
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const hasTools = completedTools.length > 0 || !!activeToolName;
  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI');
  const hasReasoning = reasoning.length > 0;
  const hasText = text.length > 0;

  const renderAvatar = () => (
    <View style={{
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: tokens.spacing.sm,
    }}>
      {aiProfile.avatarPath ? (
        <Text style={{ fontSize: 18 }}>{aiProfile.emoji || '✨'}</Text>
      ) : (
        <Text style={{ fontSize: 18 }}>{aiProfile.emoji || '✨'}</Text>
      )}
    </View>
  );

  const renderToolExecution = () => {
    if (!hasTools) return null;
    
    const totalTools = completedTools.length + (activeToolName ? 1 : 0);
    
    return (
      <View style={{
        backgroundColor: colors.bgSurfaceNormal,
        borderRadius: tokens.radius.md,
        padding: tokens.spacing.sm,
        marginBottom: tokens.spacing.sm,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: tokens.spacing.xs,
          gap: tokens.spacing.xs,
        }}>
          <Text style={{ fontSize: 14 }}>🎧</Text>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('agent.tools.tool_call', '工具调用')}
          </Text>
          <View style={{
            backgroundColor: colors.primaryContainer,
            borderRadius: tokens.radius.full,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}>
            <Text style={{
              fontSize: 12,
              color: colors.onPrimaryContainer,
            }}>
              {completedTools.length}/{totalTools}
            </Text>
          </View>
        </View>
        
        {completedTools.map((tool, idx) => {
          const durationText = tool.durationMs < 1000 
            ? `${tool.durationMs}ms` 
            : `${(tool.durationMs / 1000).toFixed(1)}s`;
          return (
            <View key={idx} style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 14 }}>✅</Text>
              <Text style={{
                fontSize: 14,
                color: colors.textPrimary,
                flex: 1,
              }}>
                {tool.name}
              </Text>
              <Text style={{
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {durationText}
              </Text>
            </View>
          );
        })}
        
        {activeToolName && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            paddingVertical: 4,
          }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{
              fontSize: 14,
              color: colors.primary,
            }}>
              {activeToolName} ...
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderBouncingDots = () => (
    <View style={{
      flexDirection: 'row',
      gap: 6,
      padding: tokens.spacing.md,
    }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textSecondary,
          opacity: 0.5,
        }} />
      ))}
    </View>
  );

  return (
    <View style={{
      flexDirection: 'row',
      padding: tokens.spacing.md,
      gap: tokens.spacing.sm,
    }}>
      {renderAvatar()}
      
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: tokens.spacing.xs,
        }}>
          {aiName}
        </Text>
        
        {error ? (
          <View style={{
            backgroundColor: colors.errorContainer,
            borderRadius: tokens.radius.md,
            padding: tokens.spacing.md,
            gap: tokens.spacing.sm,
          }}>
            <Text style={{
              fontSize: 14,
              color: colors.onErrorContainer,
            }}>
              ⚠ {error}
            </Text>
            {onRetry && (
              <Pressable 
                onPress={onRetry}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: colors.error,
                  borderRadius: tokens.radius.full,
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.xs,
                  alignSelf: 'flex-start',
                })}
              >
                <Text style={{
                  fontSize: 14,
                  color: colors.onError,
                  fontWeight: '600',
                }}>
                  {t('common.retry', '重试')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {hasText || hasReasoning || hasTools ? (
              <View style={{
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.lg,
                padding: tokens.spacing.md,
                elevation: 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
              }}>
                {/* Reasoning 块 */}
                {hasReasoning && (
                  <View style={{
                    backgroundColor: colors.bgSurfaceNormal,
                    borderRadius: tokens.radius.md,
                    padding: tokens.spacing.sm,
                    marginBottom: tokens.spacing.sm,
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.textSecondary,
                      marginBottom: tokens.spacing.xs,
                    }}>
                      {isReasoning ? '💭 思考中...' : '💭 思考过程'}
                    </Text>
                    <Text style={{
                      fontSize: 14,
                      color: colors.textPrimary,
                      lineHeight: 20,
                    }}>
                      {reasoning}
                    </Text>
                  </View>
                )}

                {/* 工具调用 */}
                {renderToolExecution()}

                {/* 正文内容 */}
                {hasText && (
                  <MarkdownRenderer content={text} />
                )}
              </View>
            ) : (
              renderBouncingDots()
            )}
            
            {onStop && (
              <View style={{
                marginTop: tokens.spacing.sm,
                alignItems: 'center',
              }}>
                <Pressable 
                  onPress={onStop}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: colors.errorContainer,
                    borderRadius: tokens.radius.full,
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.xs,
                  })}
                >
                  <Text style={{ fontSize: 16 }}>🛑</Text>
                  <Text style={{
                    fontSize: 14,
                    color: colors.onErrorContainer,
                    fontWeight: '600',
                  }}>
                    {t('common.stop_generate', '停止生成')}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};
