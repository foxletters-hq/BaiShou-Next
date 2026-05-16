import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNativeTheme } from '@baishou/ui/native';

interface StreamingBubbleProps {
  text: string;
  activeToolName?: string;
  completedTools?: Array<{ name: string; durationMs: number }>;
  aiProfile?: { name: string; emoji?: string };
}

export const StreamingBubble: React.FC<StreamingBubbleProps> = ({
  text,
  activeToolName,
  completedTools = [],
  aiProfile,
}) => {
  const { colors } = useNativeTheme();
  const hasTools = completedTools.length > 0 || activeToolName != null;

  return (
    <View style={styles.container}>
      {/* AI 头像 */}
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <Text style={styles.avatarText}>{aiProfile?.emoji || '🤖'}</Text>
      </View>
      
      <View style={styles.content}>
        {/* 角色标签 */}
        <Text style={[styles.roleName, { color: colors.textSecondary }]}>
          {aiProfile?.name || 'AI'}
        </Text>

        {/* 工具执行状态 */}
        {hasTools && (
          <ToolExecutionGroup
            completedTools={completedTools}
            activeToolName={activeToolName}
          />
        )}

        {/* 流式文本 */}
        {text.length > 0 ? (
          <View style={[styles.textBubble, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={[styles.text, { color: colors.textPrimary }]}>
              {text}
            </Text>
            <BlinkingCursor />
          </View>
        ) : !hasTools ? (
          <View style={styles.dotsContainer}>
            <BouncingDotsIndicator />
          </View>
        ) : null}
      </View>
    </View>
  );
};

// 工具执行状态分组
const ToolExecutionGroup: React.FC<{
  completedTools: Array<{ name: string; durationMs: number }>;
  activeToolName?: string;
}> = ({ completedTools, activeToolName }) => {
  const { colors } = useNativeTheme();
  const totalTools = completedTools.length + (activeToolName ? 1 : 0);

  return (
    <View style={[styles.toolGroup, { backgroundColor: colors.bgSurface }]}>
      {/* 标题行 */}
      <View style={styles.toolHeader}>
        <View style={[styles.toolIcon, { backgroundColor: colors.primary + '20' }]}>
          <Text style={styles.toolIconText}>🔧</Text>
        </View>
        <Text style={[styles.toolTitle, { color: colors.textPrimary }]}>工具调用</Text>
        <View style={[styles.toolBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.toolBadgeText, { color: colors.primary }]}>
            {completedTools.length}/{totalTools}
          </Text>
        </View>
      </View>

      {/* 已完成的工具列表 */}
      {completedTools.map((tool, index) => (
        <CompletedToolItem key={index} tool={tool} />
      ))}

      {/* 正在执行的工具 */}
      {activeToolName && <ActiveToolItem name={activeToolName} />}
    </View>
  );
};

// 已完成工具项
const CompletedToolItem: React.FC<{ tool: { name: string; durationMs: number } }> = ({ tool }) => {
  const { colors } = useNativeTheme();
  const durationText = tool.durationMs < 1000
    ? `${tool.durationMs}ms`
    : `${(tool.durationMs / 1000).toFixed(1)}s`;

  return (
    <View style={styles.toolItem}>
      <Text style={[styles.toolCheck, { color: colors.accentGreen }]}>✓</Text>
      <Text style={[styles.toolName, { color: colors.textPrimary }]}>{tool.name}</Text>
      <Text style={[styles.toolDuration, { color: colors.textSecondary }]}>{durationText}</Text>
    </View>
  );
};

// 正在执行工具项（脉冲动画）
const ActiveToolItem: React.FC<{ name: string }> = ({ name }) => {
  const { colors } = useNativeTheme();
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1.0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View style={[styles.toolItem, { opacity: opacityAnim }]}>
      <Text style={[styles.toolSpinner, { color: colors.primary }]}>⏳</Text>
      <Text style={[styles.toolName, { color: colors.primary }]}>{name} ...</Text>
    </Animated.View>
  );
};

// 闪烁光标
const BlinkingCursor: React.FC = () => {
  const { colors } = useNativeTheme();
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View style={[styles.cursor, { opacity: opacityAnim, backgroundColor: colors.primary }]} />
  );
};

// 三点跳动加载指示器
const BouncingDotsIndicator: React.FC = () => {
  const { colors } = useNativeTheme();
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = [
      createAnimation(anim1, 0),
      createAnimation(anim2, 150),
      createAnimation(anim3, 300),
    ];

    animations.forEach(anim => anim.start());
    return () => animations.forEach(anim => anim.stop());
  }, [anim1, anim2, anim3]);

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, { transform: [{ translateY: anim1 }], backgroundColor: colors.primary + '80' }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: anim2 }], backgroundColor: colors.primary + '80' }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: anim3 }], backgroundColor: colors.primary + '80' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  roleName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  textBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    maxWidth: 600,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  cursor: {
    width: 2,
    height: 16,
    marginLeft: 2,
    marginTop: 2,
  },
  dotsContainer: {
    padding: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  toolGroup: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  toolIconText: {
    fontSize: 14,
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  toolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  toolCheck: {
    fontSize: 14,
    marginRight: 8,
  },
  toolSpinner: {
    fontSize: 14,
    marginRight: 8,
  },
  toolName: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  toolDuration: {
    fontSize: 10,
  },
});