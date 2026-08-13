import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AnchoredContextMenu,
  InputBar,
  ShortcutManagerDialog,
  getContextMenuBoundsForAnchor,
  resolveDesktopAssistantAvatarSrc,
  type ContextMenuBounds,
  type ContextMenuItem,
  type InputBarRef,
  type PromptShortcut
} from '@baishou/ui'
import type { AgentWorkspaceSecurityMode } from '@baishou/shared'
import { usePromptShortcutStore, useUserProfileStore } from '@baishou/store'
import { Check, ChevronDown, Folder } from 'lucide-react'
import workbenchMascot from '../assets/workbench-mascot.png'
import { useWorkbenchInputPlaceholder } from '../../utils/workbench-input-placeholder'
import styles from './WorkbenchHomeComposer.module.css'

const COMPOSER_GREETING_KEYS = [
  'workbench.home_composer_greeting_1',
  'workbench.home_composer_greeting_2',
  'workbench.home_composer_greeting_3',
  'workbench.home_composer_greeting_4',
  'workbench.home_composer_greeting_5',
  'workbench.home_composer_greeting_6',
  'workbench.home_composer_greeting_7',
  'workbench.home_composer_greeting_8',
  'workbench.home_composer_greeting_9',
  'workbench.home_composer_greeting_10'
] as const

const COMPOSER_GREETING_FALLBACKS = [
  'Hi，{{name}}，今天我们一起做点什么？',
  '嗨，{{name}}，准备好开工了吗？',
  '{{name}}，今天想先攻哪一块？',
  '欢迎回来，{{name}}。一起把事情推进一点？',
  '{{name}}，有什么想法随时丢给我。',
  '嘿 {{name}}，我们今天搞点什么好玩的？',
  '{{name}}，需要我帮你拆任务还是写代码？',
  '{{name}}，今天的小目标是什么？',
  'Hi {{name}}，我在这儿呢，说一声就好。',
  '{{name}}，从哪一步开始都行，我跟着你。'
] as const


type MetaMenuState = {
  kind: 'workspace' | 'security'
  x: number
  y: number
  bounds: ContextMenuBounds
}

export interface WorkbenchHomeComposerAssistant {
  id?: string
  name: string
  avatarPath?: string | null
}

export interface WorkbenchHomeComposerProps {
  currentAssistant?: WorkbenchHomeComposerAssistant
  onAssistantClick: () => void
  workspaceOptions: Array<{ value: string; label: string }>
  workspaceId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onOpenFolder: () => void
  securityMode: AgentWorkspaceSecurityMode
  onSecurityModeChange: (mode: AgentWorkspaceSecurityMode) => void
  onOpenWorkspaceSettings: () => void
  onSend: (
    text: string,
    attachments?: unknown[],
    searchMode?: boolean,
    meta?: {
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
    }
  ) => boolean | Promise<boolean>
  shortcuts?: PromptShortcut[]
  searchMode?: boolean
  onToggleSearchMode?: () => void
  sending?: boolean
  /** 落在输入框下方 meta 行右侧（模型切换） */
  metaTrailing?: React.ReactNode
}

function securityModeLabel(
  mode: AgentWorkspaceSecurityMode,
  t: (key: string, fallback: string) => string
): string {
  switch (mode) {
    case 'full_access':
      return t('settings.agent_security_full_access', '完全访问')
    case 'allow_list':
      return t('settings.agent_security_allow_list', '白名单')
    case 'auto_review':
    default:
      return t('settings.agent_security_auto_review', '自动审核')
  }
}

export const WorkbenchHomeComposer: React.FC<WorkbenchHomeComposerProps> = ({
  currentAssistant,
  onAssistantClick,
  workspaceOptions,
  workspaceId,
  onWorkspaceChange,
  onOpenFolder,
  securityMode,
  onSecurityModeChange,
  onOpenWorkspaceSettings,
  onSend,
  shortcuts,
  searchMode,
  onToggleSearchMode,
  sending,
  metaTrailing
}) => {
  const { t } = useTranslation()
  const nickname = useUserProfileStore((s) => s.profile?.nickname)
  const {
    shortcuts: storeShortcuts,
    addShortcut,
    updateShortcut,
    removeShortcut
  } = usePromptShortcutStore()
  const resolvedShortcuts = shortcuts ?? storeShortcuts
  const inputBarRef = useRef<InputBarRef>(null)
  const [showShortcutManager, setShowShortcutManager] = useState(false)
  const [greetingIndex] = useState(
    () => Math.floor(Math.random() * COMPOSER_GREETING_KEYS.length)
  )
  const [metaMenu, setMetaMenu] = useState<MetaMenuState | null>(null)
  const inputPlaceholder = useWorkbenchInputPlaceholder()

  const assistantName = currentAssistant?.name || t('agent.partner_label', '伙伴')
  const assistantAvatar = resolveDesktopAssistantAvatarSrc(currentAssistant?.avatarPath)

  const greetingText = useMemo(() => {
    const name =
      (typeof nickname === 'string' && nickname.trim()) ||
      t('workbench.home_composer_greeting_guest', '朋友')
    const key = COMPOSER_GREETING_KEYS[greetingIndex]!
    const fallback = COMPOSER_GREETING_FALLBACKS[greetingIndex]!
    return t(key, fallback, { name })
  }, [greetingIndex, nickname, t])

  const workspaceLabel = useMemo(() => {
    if (!workspaceId) return t('workbench.home_workspace_or_scratch', '稿纸（默认）')
    return (
      workspaceOptions.find((opt) => opt.value === workspaceId)?.label ??
      t('workbench.home_workspace_or_scratch', '稿纸（默认）')
    )
  }, [t, workspaceId, workspaceOptions])

  const modeLabel = useMemo(() => securityModeLabel(securityMode, t), [securityMode, t])

  const closeMetaMenu = useCallback(() => setMetaMenu(null), [])

  const openMetaMenu = useCallback(
    (kind: MetaMenuState['kind'], e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      const anchor = e.currentTarget
      const rect = anchor.getBoundingClientRect()
      const bounds = getContextMenuBoundsForAnchor(anchor)
      setMetaMenu((prev) => {
        if (prev?.kind === kind) return null
        return {
          kind,
          x: rect.left,
          y: rect.bottom + 8,
          bounds
        }
      })
    },
    []
  )

  const workspaceMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = workspaceOptions.map((opt) => ({
      icon: opt.value === workspaceId ? <Check size={15} /> : <Folder size={15} />,
      label: opt.label,
      onClick: () => onWorkspaceChange(opt.value)
    }))
    if (items.length > 0) {
      items.push({ label: '', onClick: () => undefined, divider: true })
    }
    items.push({
      icon: <Folder size={15} />,
      label: t('workbench.home_open_folder_option', '打开文件夹…'),
      onClick: onOpenFolder
    })
    return items
  }, [onOpenFolder, onWorkspaceChange, t, workspaceId, workspaceOptions])

  const securityMenuItems = useMemo((): ContextMenuItem[] => {
    const modes: AgentWorkspaceSecurityMode[] = ['full_access', 'auto_review', 'allow_list']
    const items: ContextMenuItem[] = modes.map((mode) => ({
      label: securityModeLabel(mode, t),
      onClick: () => onSecurityModeChange(mode)
    }))
    items.push({ label: '', onClick: () => undefined, divider: true })
    items.push({
      label: t('workbench.home_open_gate_settings', '打开设置'),
      onClick: onOpenWorkspaceSettings
    })
    return items
  }, [onOpenWorkspaceSettings, onSecurityModeChange, t])

  const footer = (
    <div className={styles.metaRow}>
      <div className={styles.metaLeading}>
        <button
          type="button"
          className={styles.metaChip}
          onClick={onAssistantClick}
          aria-haspopup="dialog"
          aria-label={t('agent.select_assistant', '选择伙伴')}
          title={t('agent.select_assistant', '选择伙伴')}
        >
          <span className={styles.assistantAvatar} aria-hidden>
            <img
              key={currentAssistant?.avatarPath ?? currentAssistant?.id ?? 'default'}
              src={assistantAvatar}
              alt=""
            />
          </span>
          <span className={styles.metaChipLabel}>{assistantName}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.metaChip}${metaMenu?.kind === 'workspace' ? ` ${styles.metaChipActive}` : ''}`}
          onClick={(e) => openMetaMenu('workspace', e)}
          aria-haspopup="menu"
          aria-expanded={metaMenu?.kind === 'workspace'}
          aria-label={t('workbench.home_select_workspace', '选择工作空间')}
        >
          <Folder size={15} strokeWidth={1.75} aria-hidden />
          <span className={styles.metaChipLabel}>{workspaceLabel}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={`${styles.metaChip}${metaMenu?.kind === 'security' ? ` ${styles.metaChipActive}` : ''}`}
          onClick={(e) => openMetaMenu('security', e)}
          aria-haspopup="menu"
          aria-expanded={metaMenu?.kind === 'security'}
          aria-label={t('settings.agent_security_mode', 'Agent 安全模式')}
        >
          <span className={styles.metaChipLabel}>{modeLabel}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {metaTrailing ? <div className={styles.metaTrailing}>{metaTrailing}</div> : null}
    </div>
  )

  return (
    <section className={styles.composer} aria-label={t('workbench.home_composer', '开始对话')}>
      <div className={styles.hero}>
        <div className={styles.mascot} aria-hidden>
          <img src={workbenchMascot} alt="" className={styles.mascotImg} draggable={false} />
        </div>
        <p className={styles.greeting}>{greetingText}</p>
      </div>
      <InputBar
        ref={inputBarRef}
        isLoading={Boolean(sending)}
        onSend={onSend}
        shortcuts={resolvedShortcuts}
        onManageShortcuts={() => setShowShortcutManager(true)}
        searchMode={searchMode}
        onToggleSearchMode={onToggleSearchMode}
        placeholder={inputPlaceholder}
        footer={footer}
      />
      <ShortcutManagerDialog
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={resolvedShortcuts as PromptShortcut[]}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
          setShowShortcutManager(false)
          inputBarRef.current?.applySkillRef(shortcut)
        }}
      />
      {metaMenu ? (
        <AnchoredContextMenu
          x={metaMenu.x}
          y={metaMenu.y}
          bounds={metaMenu.bounds}
          items={metaMenu.kind === 'workspace' ? workspaceMenuItems : securityMenuItems}
          onClose={closeMetaMenu}
        />
      ) : null}
    </section>
  )
}
