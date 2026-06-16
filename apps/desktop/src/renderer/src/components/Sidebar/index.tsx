import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { MdSettings, MdDragIndicator, MdTune } from 'react-icons/md'
import styles from './Sidebar.module.css'
import { useTranslation } from 'react-i18next'
import { useUserProfileStore } from '@baishou/store'
import { useToast } from '@baishou/ui'
import appIcon from '@baishou/shared/assets/images/icon.png'
import { isCustomUserAvatar } from '@baishou/shared'
import {
  isSidebarVisibilityConfigured,
  loadHiddenNavItems,
  loadSidebarNavOrder,
  markSidebarVisibilityConfigured,
  persistHiddenNavItems
} from './sidebar-preferences'
import {
  ALL_SIDEBAR_NAV_IDS,
  buildSidebarNavItems,
  isSidebarNavSelected,
  type SidebarNavId
} from './sidebar-nav-catalog'
import { SidebarManageModal } from './SidebarManageModal'
import { rememberSettingsReturnPath } from '../../features/settings/settings-navigation.util'
import { isSettingsOverlayPath } from '../../features/settings/settings-route.util'

export const Sidebar: React.FC = () => {
  const { t } = useTranslation()
  const { profile, loadProfile } = useUserProfileStore()
  const toast = useToast()

  const navigate = useNavigate()
  const location = useLocation()

  const [navOrder, setNavOrder] = useState(loadSidebarNavOrder)
  const allItems = useMemo(() => buildSidebarNavItems(t), [t])

  const [hiddenItems, setHiddenItems] = useState<string[]>(loadHiddenNavItems)
  const [manageModalOpen, setManageModalOpen] = useState(false)

  const persistHiddenItems = useCallback((items: string[]) => {
    persistHiddenNavItems(items)
  }, [])

  useEffect(() => {
    if (!isSidebarVisibilityConfigured() && hiddenItems.length === 0) return
    persistHiddenItems(hiddenItems)
  }, [hiddenItems, persistHiddenItems])

  const visibleNavOrder = useMemo(
    () => navOrder.filter((id) => !hiddenItems.includes(id)),
    [navOrder, hiddenItems]
  )

  const toggleItemVisibility = (id: SidebarNavId) => {
    if (!hiddenItems.includes(id)) {
      const visibleCount = ALL_SIDEBAR_NAV_IDS.length - hiddenItems.length
      if (visibleCount <= 1) {
        toast.showWarning(t('sidebar.at_least_one_visible', '必须至少保留一个可见的侧边栏'))
        return
      }
    }
    markSidebarVisibilityConfigured()
    setHiddenItems((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id)
        persistHiddenItems(next)
        return next
      }
      const next = [...prev, id]
      persistHiddenItems(next)
      return next
    })
  }

  useEffect(() => {
    localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(navOrder))
  }, [navOrder])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // 增量同步 / vault resync 完成后刷新用户头像
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return undefined

    const onVaultResyncComplete = (event: { type?: string }) => {
      if (event?.type !== 'vault-resync-complete') return
      void loadProfile()
    }

    const removeListener = window.electron.ipcRenderer.on(
      'diary:sync-event',
      onVaultResyncComplete
    )
    return () => removeListener()
  }, [loadProfile])

  useEffect(() => {
    if (profile?.avatarFileMissing && !localStorage.getItem('avatar_missing_warned')) {
      localStorage.setItem('avatar_missing_warned', '1')
      toast.showWarning(t('profile.avatar_file_missing', '检测到头像文件不存在，已恢复为默认头像'))
    }
  }, [profile, toast, t])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const sourceIndex = result.source.index
    const destIndex = result.destination.index
    if (sourceIndex === destIndex) return

    const reorderedVisible = Array.from(visibleNavOrder)
    const [moved] = reorderedVisible.splice(sourceIndex, 1)
    reorderedVisible.splice(destIndex, 0, moved as string)

    const hiddenSet = new Set(hiddenItems)
    let visibleIdx = 0
    const newOrder = navOrder.map((id) => {
      if (hiddenSet.has(id)) return id
      return reorderedVisible[visibleIdx++] as string
    })
    setNavOrder(newOrder)
  }

  const isAgentMode =
    location.pathname.startsWith('/chat') || location.pathname.startsWith('/agent')

  const isInSettings = isSettingsOverlayPath(location.pathname)

  if (isAgentMode) return null

  return (
    <>
      <motion.div
        className={styles.sidebar}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className={styles.brandRow}>
          <div className={styles.logoBox}>
            <img src={appIcon} alt="Logo" className={styles.brandLogo} />
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>{t('common.app_title', 'BaiShou')}</div>
            <div className={styles.brandSlogan}>
              {t('settings.tagline_short', '下一代本地优先 AI 记忆终端')}
            </div>
          </div>
        </div>

        <div className={styles.menuContainer}>
          <div className={styles.navScrollArea}>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="main-nav">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={styles.navList}
                  >
                    {visibleNavOrder.map((id, index) => {
                      const item = allItems[id as SidebarNavId]
                      if (!item) return null
                      const isSelected = isSidebarNavSelected(location.pathname, item.path)

                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${styles.navItemWrapper} ${snapshot.isDragging ? styles.dragging : ''}`}
                            >
                              <div
                                className={`${styles.navItem} ${isSelected ? styles.selected : ''}`}
                                onClick={() => {
                                  if (!isSidebarNavSelected(location.pathname, item.path)) {
                                    sessionStorage.setItem('desktop_last_nav', location.pathname)
                                  }
                                  navigate(item.path)
                                }}
                              >
                                <div {...provided.dragHandleProps} className={styles.dragHandle}>
                                  <MdDragIndicator />
                                </div>
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navLabel}>{item.label}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          <div className={styles.dividerWrapper}>
            <div className={styles.divider}></div>
          </div>

          <div className={styles.fixedNav}>
            <div
              className={styles.navItem}
              onClick={() => setManageModalOpen(true)}
              title={t('sidebar.manage', '侧边栏管理')}
            >
              <span className={styles.navIcon}>
                <MdTune />
              </span>
              <span className={styles.navLabel}>{t('sidebar.manage', '侧边栏管理')}</span>
            </div>
            <div
              className={`${styles.navItem} ${isInSettings ? styles.selected : ''}`}
              onClick={() => {
                setManageModalOpen(false)
                rememberSettingsReturnPath(location.pathname)
                navigate('/settings/general')
              }}
            >
              <span className={styles.navIcon}>
                <MdSettings />
              </span>
              <span className={styles.navLabel}>{t('settings.title', '系统设置')}</span>
            </div>
          </div>
        </div>

        <div className={styles.userCard}>
          <div className={styles.avatar}>
            <img
              src={
                isCustomUserAvatar(profile?.avatarPath)
                  ? profile!.avatarPath!.startsWith('http') ||
                    profile.avatarPath.startsWith('data:') ||
                    profile.avatarPath.startsWith('local://')
                    ? profile.avatarPath
                    : `local://${profile.avatarPath}`
                  : appIcon
              }
              alt="avatar"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                backgroundColor: 'transparent'
              }}
            />
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>
              {profile?.nickname || t('profile.default_nickname', '白守用户')}
            </div>
          </div>
        </div>
      </motion.div>

      <SidebarManageModal
        isOpen={manageModalOpen}
        hiddenItems={hiddenItems}
        onClose={() => setManageModalOpen(false)}
        onToggle={toggleItemVisibility}
      />
    </>
  )
}
