import React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button, ModelSwitcherPopup, RestoreBlockingOverlay, SettingsPageChrome } from '@baishou/ui'
import { useDesktopDeepSeekImport } from '../hooks/useDesktopDeepSeekImport'
import { DeepSeekMonoIcon } from './DeepSeekMonoIcon'
import { DeepSeekImportTargetSection } from './DeepSeekImportTargetSection'
import { DeepSeekImportSessionListSection } from './DeepSeekImportSessionListSection'
import { DeepSeekImportResultSection } from './DeepSeekImportResultSection'
import pane from './GeneralSettingsPane.module.css'
import styles from './DeepSeekImportPane.module.css'

function formatDateOnly(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DeepSeekImportPane: React.FC = () => {
  const { t } = useTranslation()
  const {
    apiAvailable,
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
    newAssistantAvatarPath,
    setNewAssistantAvatarPath,
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
  } = useDesktopDeepSeekImport()

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

  if (!apiAvailable) {
    return (
      <div className={`${styles.pane} settings-pane settings-pane-full`}>
        <SettingsPageChrome title={t('deepseek_import.screen_title')}>
          <p className={styles.errorText}>{t('deepseek_import.error_service_unavailable')}</p>
        </SettingsPageChrome>
      </div>
    )
  }

  return (
    <div className={`${styles.pane} settings-pane settings-pane-full`}>
      <RestoreBlockingOverlay
        visible={importing}
        message={overlayMessage}
        hint={
          importProgress?.sessionTitle
            ? `${importProgress.sessionTitle} · ${t('deepseek_import.importing_hint')}`
            : t('deepseek_import.importing_hint')
        }
      />

      <SettingsPageChrome title={t('deepseek_import.screen_title')} scrollClassName={styles.scroll}>
        <div className={pane.stack}>
          <div className={pane.stackGroup}>
            <section className={pane.cardSection}>
              <div className={styles.cardBody}>
                <div className={styles.heroRow}>
                  <DeepSeekMonoIcon size={24} className={styles.brandIcon} />
                  <div className={styles.heroTextCol}>
                    <h4 className={styles.heroTitle}>{t('deepseek_import.intro_title')}</h4>
                    <p className={styles.heroDesc}>{t('deepseek_import.intro_desc')}</p>
                  </div>
                </div>

                <div className={styles.guideBox}>
                  <p className={styles.guideTitle}>{t('deepseek_import.guide_title')}</p>
                  <p className={styles.guideStep}>{t('deepseek_import.guide_step_1')}</p>
                  <p className={styles.guideStep}>{t('deepseek_import.guide_step_2')}</p>
                  <p className={styles.guideStep}>{t('deepseek_import.guide_step_3')}</p>
                </div>

                <div className={styles.pickRow}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    onClick={() => void handlePickZip()}
                    disabled={scanning || importing}
                    isLoading={scanning}
                  >
                    {scanResult
                      ? t('deepseek_import.repick_zip_button')
                      : t('deepseek_import.pick_zip_button')}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {scanning ? (
            <div className={styles.scanningRow} role="status">
              <Loader2 size={16} className={styles.spinner} aria-hidden />
              <span>{t('deepseek_import.scanning_zip')}</span>
            </div>
          ) : null}

          {result ? (
            <DeepSeekImportResultSection
              result={result}
              onOpenAssistant={handleOpenImportedAssistant}
              onImportAnother={handleReset}
            />
          ) : null}

          {scanResult ? (
            <>
              <div className={pane.stackGroup}>
                <div className={pane.sectionLabelRow}>
                  <h3 className={pane.sectionLabel}>{t('deepseek_import.scan_summary_title')}</h3>
                </div>
                <section className={pane.cardSection}>
                  <div className={styles.cardBody}>
                    {selectedFileName ? (
                      <p className={styles.metaLine}>
                        {t('deepseek_import.scan_summary_file', { name: selectedFileName })}
                      </p>
                    ) : null}
                    <p className={styles.metaHighlight}>
                      {t('deepseek_import.scan_summary_meta', {
                        sessions: scanResult.sessions.length,
                        messages: scanResult.totalMessages
                      })}
                    </p>
                    {scanResult.earliestAt && scanResult.latestAt ? (
                      <p className={styles.metaLine}>
                        {t('deepseek_import.scan_summary_range', {
                          start: formatDateOnly(scanResult.earliestAt),
                          end: formatDateOnly(scanResult.latestAt)
                        })}
                      </p>
                    ) : null}
                    <p className={styles.hintLine}>{t('deepseek_import.dedup_hint')}</p>
                  </div>
                </section>
              </div>

              <DeepSeekImportTargetSection
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
                newAssistantAvatarPath={newAssistantAvatarPath}
                onChangeNewAssistantAvatarPath={setNewAssistantAvatarPath}
                newAssistantProviderId={newAssistantProviderId}
                newAssistantModelId={newAssistantModelId}
                onOpenModelSwitcher={() => void openModelSwitcher()}
                onClearModelBinding={clearModelBinding}
                disabled={importing}
              />

              <DeepSeekImportSessionListSection
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
        </div>
      </SettingsPageChrome>

      {showModelSwitcher ? (
        <ModelSwitcherPopup
          providers={chatProviders}
          currentProviderId={newAssistantProviderId || ''}
          currentModelId={newAssistantModelId || ''}
          onSelect={handleSelectModel}
          onClose={() => setShowModelSwitcher(false)}
          onManageProviders={handleManageProviders}
        />
      ) : null}
    </div>
  )
}
