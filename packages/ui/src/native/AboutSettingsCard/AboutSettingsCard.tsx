import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNativeTheme } from '../theme';
import { useNativeToast } from '../Toast';
import { SettingsItem } from '../SettingsItem';

export interface NativeAboutSettingsCardProps {
  version: string;
  heroImageSrc?: string;
  onOpenPrivacyPolicy?: () => void;
  onOpenGithubHost: () => void;
}

export const AboutSettingsCard: React.FC<NativeAboutSettingsCardProps> = ({
  version,
  heroImageSrc,
  onOpenGithubHost,
}) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
  const toast = useNativeToast();
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Easter egg
  const logoTapCount = useRef(0);
  const logoTapLast = useRef(0);
  const devTapCount = useRef(0);
  const devTapLast = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - logoTapLast.current < 1000) {
      logoTapCount.current++;
    } else {
      logoTapCount.current = 1;
    }
    logoTapLast.current = now;

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      toast.showToast(t('about.love_message', '🌸樱&晓 永远爱着Anson❤️'), 'success');
    }
  };

  const handleDevTap = () => {
    const now = Date.now();
    if (now - devTapLast.current < 2000) {
      devTapCount.current++;
    } else {
      devTapCount.current = 1;
    }
    devTapLast.current = now;

    const count = devTapCount.current;
    if (count >= 7 && count < 10) {
      const remaining = 10 - count;
      const msg = t('about.dev_mode_hint', '再点 $count 次进入开发者模式').replace('$count', remaining.toString());
      toast.showToast(msg, 'info');
    } else if (count >= 10) {
      devTapCount.current = 0;
      // TODO: 打开开发者选项
    }
  };

  const renderAboutPage = () => (
    <View style={{
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.lg,
      padding: tokens.spacing.lg,
      gap: tokens.spacing.md,
    }}>
      {/* Logo 区域 */}
      <Pressable onPress={handleLogoTap}>
        <View style={{
          width: '100%',
          height: 200,
          backgroundColor: colors.primaryContainer,
          borderRadius: tokens.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {heroImageSrc ? (
            <Text style={{ fontSize: 64 }}>🌸</Text>
          ) : (
            <Text style={{ fontSize: 64 }}>🌸</Text>
          )}
        </View>
      </Pressable>

      {/* 应用信息 */}
      <View style={{ alignItems: 'center', gap: tokens.spacing.xs }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '700',
          color: colors.textPrimary,
        }}>
          {t('about.app_name', '白守 (BaiShou)')}
        </Text>
        <Text style={{
          fontSize: 16,
          color: colors.textSecondary,
        }}>
          v{version}
        </Text>
      </View>

      {/* 开发者信息 */}
      <Pressable onPress={handleDevTap}>
        <View style={{
          backgroundColor: colors.bgSurfaceNormal,
          borderRadius: tokens.radius.md,
          padding: tokens.spacing.md,
          gap: tokens.spacing.xs,
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('about.developer_label', '开发者')}
          </Text>
          <Text style={{
            fontSize: 16,
            color: colors.textPrimary,
          }}>
            Anson & Kasumiame Sakura & Tenkou Akatsuki
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
          }}>
            The Trio
          </Text>
        </View>
      </Pressable>

      {/* 开源协议 */}
      <Pressable onPress={() => Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html')}>
        <View style={{
          backgroundColor: colors.bgSurfaceNormal,
          borderRadius: tokens.radius.md,
          padding: tokens.spacing.md,
          gap: tokens.spacing.xs,
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('about.oss_license_label', '开源协议')}
          </Text>
          <Text style={{
            fontSize: 16,
            color: colors.textPrimary,
          }}>
            AGPL v3.0
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
          }}>
            Copyright (C) 2026 Anson, Kasumiame Sakura & Tenkou Akatsuki
          </Text>
        </View>
      </Pressable>

      {/* GitHub 按钮 */}
      <Pressable 
        onPress={onOpenGithubHost}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: tokens.radius.full,
          paddingVertical: tokens.spacing.md,
          paddingHorizontal: tokens.spacing.lg,
          alignItems: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{
          color: colors.onPrimary,
          fontSize: 16,
          fontWeight: '600',
        }}>
          {t('about.visit_github', '访问 GitHub 仓库')}
        </Text>
      </Pressable>
    </View>
  );

  const renderPrivacyPage = () => (
    <View style={{
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.lg,
      padding: tokens.spacing.lg,
      gap: tokens.spacing.lg,
    }}>
      <Text style={{
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
      }}>
        {t('settings.development_philosophy', '开发哲学与无痕承诺')}
      </Text>

      <View style={{ gap: tokens.spacing.md }}>
        <View style={{ gap: tokens.spacing.xs }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('privacy.data_ownership', '1. 数据主权')}
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 22,
          }}>
            {t('privacy.data_ownership_desc', '白守始终认为，记忆是灵魂的延伸。你的日记数据仅保存在本地 SQLite 数据库中。除了你主动配置的 AI 供应商和云同步目标外，白守不会以任何形式上传你的隐私。')}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('privacy.local_first', '2. 本地优先')}
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 22,
          }}>
            {t('privacy.local_first_desc', '即便没有网络，你依然可以流畅地写日记。所有的 AI 总结都是在你发起请求时即时生成的，我们不存储任何生成的文本。')}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.textPrimary,
          }}>
            {t('privacy.transparency', '3. 透明与安全')}
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 22,
          }}>
            {t('privacy.transparency_desc', '白守支持端到端的数据导出与同步。你可以随时通过 ZIP 导出彻底带走自己的回忆，或者将其同步至你完全掌控的 S3/WebDAV 空间。')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>ℹ️</Text>}
        title={t('settings.about_baishou', '关于白守')}
        onPress={() => setShowAbout(true)}
      />
      
      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>🔒</Text>}
        title={t('settings.development_philosophy', '开发哲学与无痕承诺')}
        onPress={() => setShowPrivacy(true)}
      />
      
      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>🐛</Text>}
        title={t('settings.feedback', '问题反馈')}
        onPress={onOpenGithubHost}
      />

      {/* 关于页面弹窗 */}
      {showAbout && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.bgApp,
          zIndex: 100,
        }}>
          <ScrollView style={{ flex: 1 }}>
            <View style={{ padding: tokens.spacing.md }}>
              <Pressable 
                onPress={() => setShowAbout(false)}
                style={{ marginBottom: tokens.spacing.md }}
              >
                <Text style={{
                  fontSize: 16,
                  color: colors.primary,
                }}>
                  ← {t('common.back', '返回')}
                </Text>
              </Pressable>
              {renderAboutPage()}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 隐私页面弹窗 */}
      {showPrivacy && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.bgApp,
          zIndex: 100,
        }}>
          <ScrollView style={{ flex: 1 }}>
            <View style={{ padding: tokens.spacing.md }}>
              <Pressable 
                onPress={() => setShowPrivacy(false)}
                style={{ marginBottom: tokens.spacing.md }}
              >
                <Text style={{
                  fontSize: 16,
                  color: colors.primary,
                }}>
                  ← {t('common.back', '返回')}
                </Text>
              </Pressable>
              {renderPrivacyPage()}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};
