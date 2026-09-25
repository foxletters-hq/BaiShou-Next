import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as WebBrowser from 'expo-web-browser'
import { ensureSystemLatteAssistant } from '@baishou/core-mobile'
import {
  SYSTEM_LATTE_ASSISTANT_ID,
  getDefaultLatteAssistantSystemPrompt,
  getHelpDocsLatteUrl
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Input,
  SettingsGroupCard,
  settingsCardStyles,
  useDialog,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LATTE_CHIBI = require('@baishou/shared/assets/images/latte-chibi.png')

export const LatteSettingsSection: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [dirty, setDirty] = useState(false)

  const loadLatte = useCallback(async () => {
    if (!dbReady || !services) return
    setLoading(true)
    setLoadError(false)
    try {
      await ensureSystemLatteAssistant(services.assistantManager, i18n.language)
      const latte = await services.assistantManager.findById(SYSTEM_LATTE_ASSISTANT_ID)
      if (!latte) {
        throw new Error('system latte missing')
      }
      setPersonaPrompt(latte.systemPrompt ?? '')
      setCustomPrompt(latte.customSystemPrompt ?? '')
      setDirty(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [dbReady, i18n.language, services])

  useEffect(() => {
    void loadLatte()
  }, [loadLatte])

  const handleSave = async () => {
    if (!services) return
    setSaving(true)
    try {
      await services.assistantManager.update(SYSTEM_LATTE_ASSISTANT_ID, {
        systemPrompt: personaPrompt,
        customSystemPrompt: customPrompt
      })
      setDirty(false)
      toast.showSuccess(t('settings.saved', '已保存'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleFetchLatest = async () => {
    const confirmed = await dialog.confirm(
      t(
        'settings.latte_fetch_latest_confirm',
        '将用人设官方文案覆盖当前人设提示词，自定义提示词不会改动。覆盖后仍需点击保存才会生效。'
      ),
      { title: t('settings.latte_fetch_latest_confirm_title', '获取最新人设？') }
    )
    if (!confirmed) return
    setPersonaPrompt(getDefaultLatteAssistantSystemPrompt(i18n.language))
    setDirty(true)
    toast.showSuccess(t('settings.latte_fetch_latest_done', '已写入最新人设提示词，请保存'))
  }

  return (
    <View style={styles.section}>
      <SettingsGroupCard>
        <View style={[styles.hero, { gap: tokens.spacing.md }]}>
          <Image
            source={LATTE_CHIBI}
            style={[
              styles.portrait,
              {
                borderRadius: tokens.radius.md,
                borderColor: colors.borderMuted
              }
            ]}
            accessibilityLabel={t('settings.latte_portrait_alt', 'Latte')}
          />
          <View style={styles.heroMeta}>
            <Text
              style={[
                styles.name,
                {
                  color: colors.textPrimary,
                  fontSize: settingsTypography.pageTitle.fontSize,
                  fontWeight: settingsTypography.pageTitle.fontWeight
                }
              ]}
            >
              {t('settings.latte_display_name', 'Latte')}
            </Text>
            <Text
              style={[
                settingsCardStyles.cardDesc,
                styles.subtitle,
                { color: colors.textSecondary, marginBottom: 0 }
              ]}
            >
              {t('settings.latte_display_subtitle', '拉提 · 白守看板娘')}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.quote,
            {
              color: colors.textPrimary,
              fontSize: settingsTypography.row.fontSize,
              fontWeight: settingsTypography.row.fontWeight
            }
          ]}
        >
          {t('settings.latte_origin_quote', '时光流逝，记忆消散。而我，已在此守候了很久很久。')}
        </Text>
        <Text
          style={[
            settingsCardStyles.cardDesc,
            styles.originBody,
            { color: colors.textSecondary, marginBottom: 0 }
          ]}
        >
          {t(
            'settings.latte_origin_body',
            'Latte（拉提）是古老的吸血鬼贵族后裔，永恒记忆的守护者，也是白守的看板娘。\n\n她要做的事情，是帮用户把生活里值得留下的点滴记下来、想清楚、说清楚——日记、回忆、对话与总结，都是她的领域。用户累了、乱了、想不起自己走过什么路的时候，她在。\n\n名字大概是因为「品鉴起来有种拿铁的感觉」。'
          )}
        </Text>
        <View style={styles.docsAction}>
          <Button
            variant="outlined"
            onPress={() => void WebBrowser.openBrowserAsync(getHelpDocsLatteUrl(i18n.language))}
          >
            {t('settings.latte_docs_link', '查看完整角色设定')}
          </Button>
        </View>
      </SettingsGroupCard>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 0 }]}>
            {t('settings.latte_ensure_loading', '正在准备系统伙伴 Latte…')}
          </Text>
        </View>
      ) : null}

      {loadError ? (
        <SettingsGroupCard>
          <Text style={[settingsCardStyles.cardDesc, { color: colors.textSecondary }]}>
            {t('settings.latte_ensure_failed', '无法创建或读取系统伙伴 Latte')}
          </Text>
          <Button variant="outlined" onPress={() => void loadLatte()}>
            {t('common.retry', '重试')}
          </Button>
        </SettingsGroupCard>
      ) : null}

      {!loading && !loadError ? (
        <>
          <Text
            style={[
              styles.sectionLabel,
              {
                color: colors.textPrimary,
                fontSize: settingsTypography.meta.fontSize,
                fontWeight: settingsTypography.meta.fontWeight
              }
            ]}
          >
            {t('settings.latte_character_settings_title', '角色设置')}
          </Text>

          <SettingsGroupCard>
            <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.latte_persona_prompt_title', '人设提示词')}
            </Text>
            <Text style={[settingsCardStyles.cardDesc, { color: colors.textSecondary }]}>
              {t(
                'settings.latte_persona_prompt_desc',
                '系统伙伴 Latte 的官方人设。可手动编辑，或获取最新官方文案（不会改动下方自定义段）。'
              )}
            </Text>
            <Input
              value={personaPrompt}
              onChangeText={(text) => {
                setPersonaPrompt(text)
                setDirty(true)
              }}
              multiline
              textarea
              numberOfLines={8}
              placeholder={t('settings.latte_persona_prompt_hint', 'Latte 的人设…')}
              style={styles.fieldInput}
              editable={!saving}
            />
            <View style={styles.actions}>
              <Button
                variant="outlined"
                onPress={() => void handleFetchLatest()}
                isDisabled={saving}
              >
                {t('settings.latte_fetch_latest', '获取最新')}
              </Button>
              <Button
                variant="outlined"
                onPress={() => void handleSave()}
                isDisabled={saving || !dirty}
              >
                {t('common.save', '保存')}
              </Button>
            </View>
          </SettingsGroupCard>

          <SettingsGroupCard>
            <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
              {t('settings.latte_custom_prompt_title', '自定义提示词')}
            </Text>
            <Text style={[settingsCardStyles.cardDesc, { color: colors.textSecondary }]}>
              {t(
                'settings.latte_custom_prompt_desc',
                '会接在人设提示词之后一并注入对话。留空则仅使用人设。'
              )}
            </Text>
            <Input
              value={customPrompt}
              onChangeText={(text) => {
                setCustomPrompt(text)
                setDirty(true)
              }}
              multiline
              textarea
              numberOfLines={8}
              placeholder={t('settings.latte_custom_prompt_hint', '额外补充说明、偏好或规则…')}
              style={styles.fieldInput}
              editable={!saving}
            />
          </SettingsGroupCard>

          <View style={styles.actions}>
            <Button variant="outlined" onPress={() => void handleSave()} isDisabled={saving || !dirty}>
              {t('common.save', '保存')}
            </Button>
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: 4
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  portrait: {
    width: 96,
    height: 96,
    borderWidth: 1
  },
  heroMeta: {
    flex: 1,
    gap: 4
  },
  name: {
    lineHeight: 24
  },
  subtitle: {
    lineHeight: 20
  },
  quote: {
    lineHeight: 22,
    marginBottom: 10
  },
  originBody: {
    lineHeight: 21
  },
  docsAction: {
    marginTop: 12,
    alignItems: 'flex-start'
  },
  sectionLabel: {
    paddingHorizontal: 4,
    marginBottom: 8
  },
  fieldInput: {
    minHeight: 160,
    lineHeight: 20
  },
  loadingRow: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12
  }
})
