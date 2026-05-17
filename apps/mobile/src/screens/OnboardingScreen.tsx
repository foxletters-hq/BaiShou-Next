import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useNativeTheme } from '@baishou/ui/native';
import { CompressionChart } from '../components/CompressionChart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingPage {
  id: number;
  title: string;
  subtitle: string;
  content?: React.ReactNode;
}

export const OnboardingScreen = () => {
  const router = useRouter();
  const { colors, isDark } = useNativeTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const pages: OnboardingPage[] = [
    {
      id: 1,
      title: '欢迎来到',
      subtitle: 'BaiShou Next',
      content: (
        <View style={styles.heroContainer}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.logoText}>✨</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            强大的伙伴网络系统，为你提供智能且高效的移动端响应。
          </Text>
        </View>
      ),
    },
    {
      id: 2,
      title: '压缩算法',
      subtitle: '高效存储',
      content: (
        <View style={styles.chartContainer}>
          <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
            通过多级压缩算法，将日记数据从日级到年级逐层压缩，节省存储空间的同时保留关键信息。
          </Text>
          <CompressionChart delay={300} />
        </View>
      ),
    },
    {
      id: 3,
      title: 'AI 伙伴',
      subtitle: '智能对话',
      content: (
        <View style={styles.featureContainer}>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>🤖</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>多模型支持</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>支持 OpenAI、Claude、Gemini 等多种 AI 模型</Text>
          </View>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>流式对话</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>实时流式输出，打字机效果</Text>
          </View>
          <View style={[styles.featureItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.featureIcon}>🔧</Text>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>工具调用</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>支持搜索、记忆召回等工具</Text>
          </View>
        </View>
      ),
    },
    {
      id: 4,
      title: '数据安全',
      subtitle: '本地优先',
      content: (
        <View style={styles.securityContainer}>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>本地存储</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>所有数据存储在本地 SQLite 数据库</Text>
          </View>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>📡</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>局域网同步</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>支持局域网设备间同步</Text>
          </View>
          <View style={[styles.securityItem, { backgroundColor: colors.bgSurfaceHighest }]}>
            <Text style={styles.securityIcon}>☁️</Text>
            <Text style={[styles.securityTitle, { color: colors.textPrimary }]}>云备份</Text>
            <Text style={[styles.securityDesc, { color: colors.textSecondary }]}>支持 WebDAV/S3 云备份</Text>
          </View>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      scrollViewRef.current?.scrollTo({ x: nextPage * SCREEN_WIDTH, animated: true });
    } else {
      router.replace('/(tabs)/agent');
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)/agent');
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const page = Math.round(contentOffset.x / SCREEN_WIDTH);
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* 跳过按钮 */}
      {currentPage < pages.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>跳过</Text>
        </TouchableOpacity>
      )}

      {/* 页面指示器 */}
      <View style={styles.indicatorContainer}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor: index === currentPage ? colors.primary : colors.bgSurfaceHighest,
                width: index === currentPage ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* 内容区域 */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {pages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.pageContent}>
              <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{page.title}</Text>
              <Text style={[styles.pageSubtitle, { color: colors.primary }]}>{page.subtitle}</Text>
              {page.content}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentPage === pages.length - 1 ? '开始体验' : '下一步'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
    gap: 8,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  heroContainer: {
    alignItems: 'center',
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 50,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  featureContainer: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    flex: 1,
  },
  securityContainer: {
    gap: 16,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  securityIcon: {
    fontSize: 32,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  securityDesc: {
    fontSize: 14,
    flex: 1,
  },
  footer: {
    padding: 24,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});