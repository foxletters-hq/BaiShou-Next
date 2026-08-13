import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  getReasoningControlForModel,
  normalizeReasoningEffortSetting,
  formatReasoningEffortLabel,
  type ReasoningControl,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { Check, Cloud, Settings } from 'lucide-react'
import { withAppContentOverlay } from '../overlay'
import { getProviderIcon } from '../../utils/provider-icons'
import { useTheme } from '../../hooks'
import { ModelVisionBadge } from '../../shared/ModelVisionBadge'
import styles from './SessionModelMenu.module.css'

export interface SessionModelProvider {
  id: string
  name: string
  type: string
  models: string[]
  enabledModels: string[]
}

export type ModelReasoningPreview = {
  effort: ReasoningEffortSetting
}

export interface SessionModelMenuProps {
  providers: SessionModelProvider[]
  currentProviderId?: string
  currentModelId?: string
  onSelect: (providerId: string, modelId: string) => void
  onClose: () => void
  onManageProviders?: () => void
  reasoningEffort: ReasoningEffortSetting
  onReasoningEffortChange: (value: ReasoningEffortSetting) => void
  /** 当前模型思考控制；缺省时按 currentModel 推断 */
  reasoningControl?: ReasoningControl | null
  /** 各模型持久化预览（key = providerId::modelId） */
  modelReasoningPreviews?: Record<string, ModelReasoningPreview>
  anchorRect?: DOMRect | null
}

const MODEL_PANEL_WIDTH = 300
const EFFORT_PANEL_WIDTH = 180
const PANEL_GAP = 8
const VIEW_PAD = 12
const ANCHOR_GAP = 16
const CLOSE_MS = 140
const SHELL_WIDTH = MODEL_PANEL_WIDTH + PANEL_GAP + EFFORT_PANEL_WIDTH

function previewKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

function computeShellCoords(
  anchorRect: DOMRect | null | undefined,
  height: number
): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left: number
  let top: number

  if (anchorRect) {
    left = anchorRect.right - SHELL_WIDTH
    top = anchorRect.top - height - ANCHOR_GAP
    if (top < VIEW_PAD) {
      top = Math.min(anchorRect.bottom + ANCHOR_GAP, vh - height - VIEW_PAD)
    }
  } else {
    left = vw - SHELL_WIDTH - 24
    top = vh - height - 96
  }

  left = Math.max(VIEW_PAD, Math.min(left, vw - SHELL_WIDTH - VIEW_PAD))
  top = Math.max(VIEW_PAD, Math.min(top, vh - height - VIEW_PAD))
  return { left, top }
}

export const SessionModelMenu: React.FC<SessionModelMenuProps> = ({
  providers,
  currentProviderId,
  currentModelId,
  onSelect,
  onClose,
  onManageProviders,
  reasoningEffort,
  onReasoningEffortChange,
  reasoningControl: reasoningControlProp,
  modelReasoningPreviews,
  anchorRect
}) => {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const shellRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const closedRef = useRef(false)
  const [coords, setCoords] = useState(() => computeShellCoords(anchorRect, 300))
  const [placed, setPlaced] = useState(false)
  const [closing, setClosing] = useState(false)

  const currentProvider = providers.find((p) => p.id === currentProviderId)
  const control =
    reasoningControlProp ??
    getReasoningControlForModel(
      currentModelId || '',
      currentProvider?.type || currentProviderId || undefined
    )

  const effortValue = normalizeReasoningEffortSetting(reasoningEffort)
  const showEffort = control.mode === 'effort' && Boolean(control.efforts?.length)
  const showAutoOnly = !showEffort

  const effortLabel = (opt: ReasoningEffortSetting) => formatReasoningEffortLabel(opt)

  const formatPreview = (preview?: ModelReasoningPreview, providerType?: string, modelId?: string) => {
    const ctl = getReasoningControlForModel(modelId || '', providerType)
    const effort = normalizeReasoningEffortSetting(preview?.effort ?? 'auto')
    if (ctl.mode === 'effort' && ctl.efforts?.length) {
      return effort === 'auto' || effort === 'none'
        ? formatReasoningEffortLabel('auto')
        : formatReasoningEffortLabel(effort)
    }
    return formatReasoningEffortLabel('auto')
  }

  const currentPreviewSuffix = formatPreview(
    { effort: effortValue },
    currentProvider?.type || currentProviderId,
    currentModelId
  )

  // Default + 可用档位；不展示 none（关闭）
  const effortOptions: ReasoningEffortSetting[] = showAutoOnly
    ? ['auto']
    : ['auto', ...(control.efforts || []).filter((e) => e !== 'none')]

  const providerData = useMemo(() => {
    return (providers || [])
      .map((provider) => {
        const modelList =
          provider.enabledModels.length > 0 ? provider.enabledModels : provider.models
        return { ...provider, matchedModels: modelList }
      })
      .filter((p) => p.matchedModels.length > 0)
  }, [providers])

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
  }, [])

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }, [onClose])

  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const height = shell.offsetHeight || 300
    setCoords(computeShellCoords(anchorRect, height))
    setPlaced(true)
  }, [anchorRect, providerData.length, showEffort])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(finishClose, CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [closing, finishClose])

  useEffect(() => {
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (shellRef.current?.contains(target)) return
      requestClose()
    }
    // 延后绑定，避免打开菜单的同一次 click 立刻关掉
    const timer = window.setTimeout(() => {
      document.addEventListener('click', onDocClick, true)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onDocClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [closing, requestClose])

  const ProviderIcon = ({ id, type }: { id: string; type: string }) => {
    const iconSrc = getProviderIcon(id, isDark) || getProviderIcon(type, isDark)
    if (iconSrc) {
      return <img src={iconSrc} alt="" className={styles.providerIconImage} />
    }
    return <Cloud size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
  }

  return createPortal(
    <>
      <div
        className={withAppContentOverlay(
          `${styles.overlay}${closing ? ` ${styles.overlayClosing}` : ''}`
        )}
        onClick={closing ? undefined : requestClose}
      />
      <div
        ref={shellRef}
        className={[
          styles.shell,
          placed ? styles.shellReady : styles.shellPending,
          closing ? styles.shellClosing : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ left: coords.left, top: coords.top }}
        role="dialog"
        aria-label={t('models.switch_model', '切换模型')}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => {
          if (e.target !== shellRef.current) return
          if (closing) finishClose()
        }}
      >
        <div className={`${styles.panel} ${styles.modelPanel}`}>
          <div className={styles.list}>
            {providerData.length === 0 ? (
              <div className={styles.emptyState}>
                {t('models.no_available_models', '暂无可用模型')}
              </div>
            ) : (
              providerData.map((provider) => (
                <div key={provider.id} className={styles.providerGroup}>
                  <div className={styles.providerHeader}>
                    <ProviderIcon id={provider.id} type={provider.type} />
                    <span className={styles.providerName}>{provider.name}</span>
                  </div>
                  <div className={styles.modelsUnderProvider}>
                    {provider.matchedModels.map((modelId) => {
                      const isSelected =
                        provider.id === currentProviderId && modelId === currentModelId
                      const stored = modelReasoningPreviews?.[previewKey(provider.id, modelId)]
                      const suffix = isSelected
                        ? currentPreviewSuffix
                        : formatPreview(stored, provider.type, modelId)
                      return (
                        <button
                          key={modelId}
                          type="button"
                          className={`${styles.modelItem} ${isSelected ? styles.modelItemSelected : ''}`}
                          disabled={closing}
                          onClick={() => {
                            onSelect(provider.id, modelId)
                            requestClose()
                          }}
                        >
                          <span className={styles.modelIdText}>
                            <span className={styles.modelIdPrimary}>{modelId}</span>
                            <ModelVisionBadge modelId={modelId} providerKey={provider.id} />
                            {suffix ? (
                              <span className={styles.modelIdEffort}>{suffix}</span>
                            ) : null}
                          </span>
                          {isSelected ? (
                            <span className={styles.check} aria-hidden>
                              <Check size={14} />
                            </span>
                          ) : (
                            <span className={styles.checkSpacer} aria-hidden />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {onManageProviders ? (
            <div className={styles.manageFooter}>
              <button
                type="button"
                className={styles.manageBtn}
                disabled={closing}
                onClick={() => {
                  onManageProviders()
                  requestClose()
                }}
              >
                <Settings size={13} />
                <span>{t('models.add_models', '添加模型')}</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className={`${styles.panel} ${styles.effortPanel}`}>
          <div className={styles.sectionLabel}>
            {t('agent.reasoning.effort_section', '思考强度')}
          </div>
          {effortOptions.map((opt) => {
            const selected = opt === effortValue || (opt === 'auto' && !effortOptions.includes(effortValue))
            return (
              <button
                key={opt}
                type="button"
                className={`${styles.row} ${selected ? styles.rowActive : ''}`}
                disabled={closing}
                onClick={() => onReasoningEffortChange(opt)}
              >
                <span className={styles.rowLabel}>{effortLabel(opt)}</span>
                {selected ? (
                  <span className={styles.check} aria-hidden>
                    <Check size={14} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}
