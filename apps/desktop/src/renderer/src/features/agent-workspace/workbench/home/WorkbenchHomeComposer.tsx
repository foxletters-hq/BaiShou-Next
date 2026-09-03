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
import { createWorkspaceComposerDropResolver } from '../../utils/workspace-composer-drop.util'
import { searchWorkspaceFileNames } from '../../utils/workspace-file-mention-search.util'
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
  'Hi，{{name}}，今天先从哪一个小灵感开始？',
  '嗨，{{name}}，咖啡泡好了，我们把上次的想法继续推进吧。',
  '{{name}}，不管是整理思路还是动笔写写，随时告诉我。',
  '欢迎回来，{{name}}。准备好了，今天想一起攻克哪一个难题？',
  '{{name}}，把脑海里的草稿交给我，我们一步步把它变成现实。',
  '嘿 {{name}}，桌面整整齐齐，就等你的新想法了。',
  '{{name}}，把手头的事列出来，我来帮你逐项拆解。',
  '{{name}}，今天想写点什么、改点什么？我都陪着你。',
  'Hi {{name}}，灵感不分大小，写下一句就算开工。',
  '{{name}}，欢迎回来，随时在下方输入你想做的事。'
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
  folderRoot?: string | null
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
      fileRefs?: Array<{
        relativePath: string
        selection?: { startLine: number; endLine: number }
        comment?: string
        origin?: 'explorer-drop' | 'mention' | 'selection' | 'comment'
      }>
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
  folderRoot = null,
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
  const resolveDropAttachments = useMemo(
    () => createWorkspaceComposerDropResolver(folderRoot),
    [folderRoot]
  )
  const fileMention = useMemo(
    () =>
      folderRoot
        ? {
            enabled: true,
            recentPaths: [] as string[],
            searchFiles: (query: string) =>
              searchWorkspaceFileNames({
                folderRoot,
                query,
                listDir: (rootPath, relativePath) =>
                  window.api.agentWorkspace.listDir(rootPath, relativePath)
              })
          }
        : undefined,
    [folderRoot]
  )

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
        attachmentIntake="workspace"
        resolveDropAttachments={resolveDropAttachments}
        fileMention={fileMention}
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
