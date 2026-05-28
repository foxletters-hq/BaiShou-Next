import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  MdTimeline,
  MdAutoStories,
  MdSettings,
  MdDragIndicator,
  MdWifiFind,
  MdHistory,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdTune,
  MdCheck,
  MdExpandMore
} from 'react-icons/md'
import styles from './Sidebar.module.css'
import { useTranslation } from 'react-i18next'
import { RefreshCw, FolderArchive } from 'lucide-react'
import { useUserProfileStore } from '@baishou/store'
import { useToast } from '@baishou/ui'
import appIcon from '@baishou/shared/assets/images/icon.png'
import {
  DEFAULT_NAV_IDS,
  isSidebarVisibilityConfigured,
  loadHiddenNavItems,
  markSidebarVisibilityConfigured,
  persistHiddenNavItems
} from './sidebar-preferences'

export const Sidebar: React.FC = () => {
  const { t } = useTranslation()
  const { profile, loadProfile } = useUserProfileStore()
  const toast = useToast()

  // Default nav items
  const navigate = useNavigate()
  const location = useLocation()

  const [navOrder, setNavOrder] = useState(() => {
    const saved = localStorage.getItem('desktop_sidebar_nav_order')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[]
        // 版本号迁移：版本为 0-2 时，按最新默认排序强刷置顶一次
        const mv = parseInt(localStorage.getItem('desktop_sidebar_mv') || '0', 10)
        const defaults = [...DEFAULT_NAV_IDS]
        if (mv < 3) {
          for (const item of [...defaults].reverse()) {
            const idx = parsed.indexOf(item)
            if (idx !== -1) parsed.splice(idx, 1)
            parsed.unshift(item)
          }
          localStorage.setItem('desktop_sidebar_mv', '3')
          localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(parsed))
        } else {
          // 常规补全（置顶）
          let changed = false
          for (const item of defaults) {
            if (!parsed.includes(item)) {
              parsed.unshift(item)
              changed = true
            }
          }
          if (changed) {
            localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(parsed))
          }
        }
        return parsed
      } catch (e) {}
    }
    return [...DEFAULT_NAV_IDS]
  })

  const allItems = {
    diary: { icon: <MdTimeline />, label: t('diary.title', 'Diary'), path: '/diary' },
    summary: {
      icon: <MdAutoStories />,
      label: t('summary.dashboard_title', 'Memories'),
      path: '/summary'
    },
    lan: {
      icon: <MdWifiFind />,
      label: t('settings.lan_transfer', 'LAN Transfer'),
      path: '/lan-transfer'
    },
    sync: {
      icon: <FolderArchive size={20} />,
      label: t('common.data_sync', 'Data Sync'),
      path: '/data-sync'
    },
    'incr-sync': {
      icon: <RefreshCw size={20} />,
      label: t('data_sync.incremental_sync', 'File Sync'),
      path: '/incremental-sync'
    },
    git: { icon: <MdHistory />, label: t('version_control.title', 'Version Control'), path: '/git' }
  }

  const [hiddenItems, setHiddenItems] = useState<string[]>(loadHiddenNavItems)

  const [isManaging, setIsManaging] = useState(false)
  const [showHiddenSection, setShowHiddenSection] = useState(false)

  const persistHiddenItems = useCallback((items: string[]) => {
    persistHiddenNavItems(items)
  }, [])

  // 保存隐藏状态（仅同步存储；默认未配置时不读取历史隐藏项）
  useEffect(() => {
    if (!isSidebarVisibilityConfigured() && hiddenItems.length === 0) return
    persistHiddenItems(hiddenItems)
  }, [hiddenItems, persistHiddenItems])

  const visibleNavOrder = useMemo(
    () => navOrder.filter((id) => !hiddenItems.includes(id)),
    [navOrder, hiddenItems]
  )

  const toggleItemVisibility = (id: string) => {
    if (!hiddenItems.includes(id)) {
      if (hiddenItems.length >= navOrder.length - 1) {
        toast.showWarning(t('sidebar.at_least_one_visible', '必须至少保留一个可见的侧边栏'))
        return
      }
      setShowHiddenSection(true)
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

  const finishManaging = () => {
    setShowHiddenSection(false)
    setIsManaging(false)
  }

  const startManaging = () => {
    setShowHiddenSection(false)
    setIsManaging(true)
  }

  useEffect(() => {
    localStorage.setItem('desktop_sidebar_nav_order', JSON.stringify(navOrder))
  }, [navOrder])

  useEffect(() => {
    loadProfile()
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

  if (isAgentMode) return null

  return (
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
          <div className={styles.brandName}>{t('common.app_title', 'BaiShou AI')}</div>
          <div className={styles.brandSlogan}>
            {t('settings.tagline_short', '下一代本地优先 AI 记忆终端')}
          </div>
        </div>
      </div>

      <div className={styles.menuContainer}>
        {isManaging ? (
          <div className={styles.navList}>
            {visibleNavOrder.map((id) => {
              const item = allItems[id as keyof typeof allItems]
              if (!item) return null

              return (
                <div key={id} className={styles.navItemWrapper}>
                  <div className={styles.navItem} onClick={() => toggleItemVisibility(id)}>
                    <span className={styles.checkboxIcon}>
                      <MdCheckBox className={styles.checked} />
                    </span>
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </div>
                </div>
              )
            })}
            {hiddenItems.length > 0 && (
              <>
                <button
                  type="button"
                  className={`${styles.hiddenSectionToggle} ${showHiddenSection ? styles.hiddenSectionToggleOpen : ''}`}
                  onClick={() => setShowHiddenSection((open) => !open)}
                  aria-expanded={showHiddenSection}
                  title={
                    showHiddenSection
                      ? t('sidebar.collapse_hidden', '收起已隐藏项')
                      : t('sidebar.expand_hidden', '展开已隐藏项')
                  }
                >
                  <span className={styles.hiddenSectionToggleLabel}>
                    {t('sidebar.hidden_items', '{{count}} 项已隐藏', {
                      count: hiddenItems.length
                    })}
                  </span>
                  <span className={styles.hiddenSectionExpandBtn} aria-hidden="true">
                    <MdExpandMore />
                  </span>
                </button>
                <div
                  className={`${styles.hiddenSectionCollapsible} ${showHiddenSection ? styles.hiddenSectionCollapsibleOpen : ''}`}
                  aria-hidden={!showHiddenSection}
                >
                  <div className={styles.hiddenSectionInner}>
                    {hiddenItems.map((id) => {
                      const item = allItems[id as keyof typeof allItems]
                      if (!item) return null
                      return (
                        <div key={id} className={styles.navItemWrapper}>
                          <div
                            className={`${styles.navItem} ${styles.navItemHidden}`}
                            onClick={() => toggleItemVisibility(id)}
                          >
                            <span className={styles.checkboxIcon}>
                              <MdCheckBoxOutlineBlank />
                            </span>
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="main-nav">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={styles.navList}
                >
                  {visibleNavOrder.map((id, index) => {
                    const item = allItems[id as keyof typeof allItems]
                    if (!item) return null
                    const isSelected = location.pathname.startsWith(item.path)

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
                                if (!location.pathname.startsWith(item.path)) {
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
        )}

        <div className={styles.dividerWrapper}>
          <div className={styles.divider}></div>
        </div>

        <div className={styles.fixedNav}>
          <div
            className={`${styles.navItem} ${isManaging ? styles.managingActive : ''}`}
            onClick={() => (isManaging ? finishManaging() : startManaging())}
            title={isManaging ? t('common.done', '完成') : t('sidebar.manage', '管理侧边栏')}
          >
            <span className={styles.navIcon}>{isManaging ? <MdCheck /> : <MdTune />}</span>
            <span className={styles.navLabel}>
              {isManaging ? t('common.done', '完成') : t('sidebar.manage', '侧边栏管理')}
            </span>
          </div>
          <div
            className={`${styles.navItem} ${location.pathname.startsWith('/settings') ? styles.selected : ''}`}
            onClick={() => {
              if (isManaging) finishManaging()
              navigate('/settings')
            }}
          >
            <span className={styles.navIcon}>
              <MdSettings />
            </span>
            <span className={styles.navLabel}>{t('settings.title', '设置')}</span>
          </div>
        </div>
      </div>

      <div className={styles.userCard}>
        <div className={styles.avatar}>
          {profile?.avatarPath && profile.avatarPath !== 'default' ? (
            <img
              src={
                profile.avatarPath.startsWith('http') ||
                profile.avatarPath.startsWith('data:') ||
                profile.avatarPath.startsWith('local://')
                  ? profile.avatarPath
                  : `local://${profile.avatarPath}`
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
          ) : (
            (profile?.nickname || 'U').charAt(0).toUpperCase()
          )}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>
            {profile?.nickname || t('profile.default_nickname', '白守用户')}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
