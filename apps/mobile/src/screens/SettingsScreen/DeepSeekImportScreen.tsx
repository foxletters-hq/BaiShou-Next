import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Button,
  KeyboardAwareScrollView,
  ModelSwitcher,
  ProviderBrandIcon,
  RestoreBlockingOverlay,
  scrollIndicatorStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useDeepSeekImport } from '../../hooks/useDeepSeekImport'
import { DeepSeekImportTargetCard } from './components/DeepSeekImportTargetCard'
import { DeepSeekImportSessionListCard } from './components/DeepSeekImportSessionListCard'
import { DeepSeekImportResultCard } from './components/DeepSeekImportResultCard'

function formatDateOnly(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DeepSeekImportScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)

  const {
    dbReady,
    assistants,
    loadingAssistants,
    chatProviders,
    showModelSwitcher,
    setShowModelSwitcher,
    scanning,
    importing,
    importProgress,
    selectedFileName,
    scanResult,
    selectedSessionIds,
    targetMode,
    setTargetMode,
    selectedAssistantId,
    setSelectedAssistantId,
    newAssistantKind,
    setNewAssistantKind,
    newAssistantName,
    setNewAssistantName,
    newAssistantDescription,
    setNewAssistantDescription,
    newAssistantSystemPrompt,
    setNewAssistantSystemPrompt,
    newAssistantProviderId,
    newAssistantModelId,
    newAssistantStoredAvatarPath,
    newAssistantPreviewAvatarUri,
    handleSelectBuiltinAvatar,
    handlePickAvatarImage,
    clearModelBinding,
    openModelSwitcher,
    handleSelectModel,
    handleManageProviders,
    result,
    canStartImport,
    handlePickZip,
    handleToggleSession,
    handleToggleSelectAll,
    handleStartImport,
    handleOpenImportedAssistant,
    handleReset
  } = useDeepSeekImport()

  const progressPercent =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.current / importProgress.total) * 100)
      : undefined

  const overlayMessage = (() => {
    if (!importProgress) return t('deepseek_import.importing_title')
    if (importProgress.phase === 'creating_assistant') {
      return t('deepseek_import.importing_creating_assistant')
    }
    if (importProgress.phase === 'importing') {
      return t('deepseek_import.importing_progress', {
        current: importProgress.current,
        total: importProgress.total
      })
    }
    if (importProgress.phase === 'finishing') {
      return t('deepseek_import.importing_finishing')
    }
    return t('deepseek_import.importing_preparing')
  })()

  return (
    <>
      <RestoreBlockingOverlay
        visible={importing}
        message={overlayMessage}
        hint={t('deepseek_import.importing_hint')}
        detail={importProgress?.sessionTitle}
        progress={progressPercent}
      />

      <StackScreenLayout
        title={t('deepseek_import.screen_title')}
        {...chrome}
        contentStyle={styles.layoutContent}
      >
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          indicatorStyle={scrollIndicatorStyle(isDark)}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                borderRadius: tokens.radius.lg
              }
            ]}
          >
            <View style={styles.heroRow}>
              <ProviderBrandIcon
                providerId="deepseek"
                size={26}
                monochrome
                color={colors.textPrimary}
              />
              <View style={styles.heroTextCol}>
                <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                  {t('deepseek_import.intro_title')}
                </Text>
                <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
                  {t('deepseek_import.intro_desc')}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.guideBox,
                { backgroundColor: colors.bgSurfaceNormal, borderRadius: tokens.radius.md }
              ]}
            >
              <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
                {t('deepseek_import.guide_title')}
              </Text>
              <Text style={[styles.guideStep, { color: colors.textSecondary }]}>
                {t('deepseek_import.guide_step_1')}
              </Text>
              <Text style={[styles.guideStep, { color: colors.textSecondary }]}>
                {t('deepseek_import.guide_step_2')}
              </Text>
              <Text style={[styles.guideStep, { color: colors.textSecondary }]}>
                {t('deepseek_import.guide_step_3')}
              </Text>
            </View>

            <View style={styles.pickRow}>
              <Button
                variant={scanResult ? 'outlined' : 'primary'}
                onPress={() => void handlePickZip()}
                disabled={!dbReady || scanning || importing}
                isLoading={scanning}
              >
                {scanResult
                  ? t('deepseek_import.repick_zip_button')
                  : t('deepseek_import.pick_zip_button')}
              </Button>
            </View>
          </View>

          {scanning ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.scanningText, { color: colors.textSecondary }]}>
                {t('deepseek_import.scanning_zip')}
              </Text>
            </View>
          ) : null}

          {result ? (
            <DeepSeekImportResultCard
              result={result}
              onOpenAssistant={() => void handleOpenImportedAssistant()}
              onImportAnother={handleReset}
            />
          ) : null}

          {scanResult ? (
            <>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderRadius: tokens.radius.lg
                  }
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t('deepseek_import.scan_summary_title')}
                </Text>
                {selectedFileName ? (
                  <Text
                    style={[styles.metaLine, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {t('deepseek_import.scan_summary_file', { name: selectedFileName })}
                  </Text>
                ) : null}
                <Text style={[styles.metaHighlight, { color: colors.textPrimary }]}>
                  {t('deepseek_import.scan_summary_meta', {
                    sessions: scanResult.sessions.length,
                    messages: scanResult.totalMessages
                  })}
                </Text>
                {scanResult.earliestAt && scanResult.latestAt ? (
                  <Text style={[styles.metaLine, { color: colors.textSecondary }]}>
                    {t('deepseek_import.scan_summary_range', {
                      start: formatDateOnly(scanResult.earliestAt),
                      end: formatDateOnly(scanResult.latestAt)
                    })}
                  </Text>
                ) : null}
                <Text style={[styles.hintLine, { color: colors.textTertiary }]}>
                  {t('deepseek_import.dedup_hint')}
                </Text>
              </View>

              <DeepSeekImportTargetCard
                targetMode={targetMode}
                onChangeTargetMode={setTargetMode}
                assistants={assistants}
                loadingAssistants={loadingAssistants}
                selectedAssistantId={selectedAssistantId}
                onSelectAssistant={setSelectedAssistantId}
                newAssistantKind={newAssistantKind}
                onChangeNewAssistantKind={setNewAssistantKind}
                newAssistantName={newAssistantName}
                onChangeNewAssistantName={setNewAssistantName}
                newAssistantDescription={newAssistantDescription}
                onChangeNewAssistantDescription={setNewAssistantDescription}
                newAssistantSystemPrompt={newAssistantSystemPrompt}
                onChangeNewAssistantSystemPrompt={setNewAssistantSystemPrompt}
                newAssistantStoredAvatarPath={newAssistantStoredAvatarPath}
                newAssistantPreviewAvatarUri={newAssistantPreviewAvatarUri}
                onSelectBuiltinAvatar={handleSelectBuiltinAvatar}
                onPickAvatarImage={() => void handlePickAvatarImage()}
                newAssistantProviderId={newAssistantProviderId}
                newAssistantModelId={newAssistantModelId}
                onOpenModelSwitcher={() => void openModelSwitcher()}
                onClearModelBinding={clearModelBinding}
                disabled={importing}
              />

              <DeepSeekImportSessionListCard
                sessions={scanResult.sessions}
                selectedSessionIds={selectedSessionIds}
                onToggleSession={handleToggleSession}
                onToggleSelectAll={handleToggleSelectAll}
                onStartImport={() => void handleStartImport()}
                canStartImport={canStartImport}
                importing={importing}
                disabled={importing}
              />
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </StackScreenLayout>

      <ModelSwitcher
        isOpen={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        providers={chatProviders}
        currentProviderId={newAssistantProviderId}
        currentModelId={newAssistantModelId}
        onSelect={handleSelectModel}
        onManageProviders={handleManageProviders}
      />
    </>
  )
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.xl
  },
  card: {
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug,
    gap: sharedTokens.spacing.smPlus
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sharedTokens.spacing.mdTight
  },
  heroTextCol: {
    flex: 1,
    gap: sharedTokens.spacing.xs
  },
  heroTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  heroDesc: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  guideBox: {
    padding: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.xs
  },
  guideTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    marginBottom: sharedTokens.spacing.xxs
  },
  guideStep: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 19
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: sharedTokens.spacing.xs
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.md
  },
  scanningText: {
    fontSize: mobileTypography.secondary.fontSize
  },
  sectionTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  metaHighlight: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '500'
  },
  metaLine: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  hintLine: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  }
})
