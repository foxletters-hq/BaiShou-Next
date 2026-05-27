import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './AttachmentManagementView.module.css'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import { ImagePreview } from '../DiaryEditor/ImagePreview'
import {
  CheckCircle,
  FolderMinus,
  Folder,
  Trash2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  File,
  FileImage,
  FileVideo,
  FolderSearch,
  FileText,
  FileAudio,
  FileCode,
  Tag,
  Calendar,
  Grid,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2
} from 'lucide-react'

export interface AttachmentFileItem {
  name: string
  path: string
  sizeMB: number
  birthtime: string
}

export interface SessionAttachmentGroup {
  sessionId: string
  sessionTitle?: string
  isOrphan: boolean
  totalSizeMB: number
  fileCount: number
  files: AttachmentFileItem[]
}

export interface DiaryAttachmentFileItem {
  name: string
  path: string         // 绝对物理路径 (用于打开位置/删除)
  relativePath: string   // 相对 Journals 目录的路径 (如: 2026/05/attachment/pasted_123.png)
  sizeMB: number
  birthtime: string
  yearMonth: string    // 格式: YYYY-MM
  isOrphan: boolean    // 是否是孤立附件 (在同年月的所有日记中都没有被引用)
}

export interface AttachmentManagementViewProps {
  attachments: SessionAttachmentGroup[]
  onDeleteSelected: (ids: string[]) => Promise<void>
  onDeleteFile?: (sessionId: string, fileName: string) => Promise<void>
  onOpenFileLocation?: (path: string) => Promise<void>

  // ======= 日记附件相关的扩展属性 =======
  diaryAttachments?: DiaryAttachmentFileItem[]
  onDeleteDiaryAttachment?: (filePath: string) => Promise<void>
}

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = ({
  attachments,
  onDeleteSelected,
  onDeleteFile,
  onOpenFileLocation,
  diaryAttachments = [],
  onDeleteDiaryAttachment
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const confirmKeyword = t('settings.attachment_confirm_keyword', '确定')
  
  // 大板块 Tab: 'session' 代表 AI 会话附件，'diary' 代表日记附件
  const [activePane, setActivePane] = useState<'session' | 'diary'>('diary')

  // 缩略图缓存
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map())
  const thumbnailLoadingRef = React.useRef<Set<string>>(new Set())

  // 图片预览
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null)
  const [imagePreviewLoading, setImagePreviewLoading] = useState(false)
  const fullImageCacheRef = React.useRef<Map<string, string>>(new Map())

  // ======= 年份选择器弹窗状态与 activeYearRef 自动定位滚动 =======
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const activeYearRef = React.useRef<HTMLButtonElement>(null)

  // 局部的自定义 Month 和 Orphan 下拉框的显示状态与 Click Outside 引用
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [isOrphanPickerOpen, setIsOrphanPickerOpen] = useState(false)
  const monthRef = React.useRef<HTMLDivElement>(null)
  const orphanRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 弹窗打开时滚动到当前选中的年份
  React.useEffect(() => {
    if (isYearPickerOpen) {
      setTimeout(() => {
        activeYearRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }, 80)
    }
  }, [isYearPickerOpen])

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false)
      }
      if (orphanRef.current && !orphanRef.current.contains(e.target as Node)) {
        setIsOrphanPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // ======= AI会话附件状态与逻辑 =======
  const [activeTab, setActiveTab] = useState<'all' | 'orphans'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentSessionPage, setCurrentSessionPage] = useState<number>(1)
  const [sessionPageSize, setSessionPageSize] = useState<number>(10)

  const orphans = attachments.filter((a) => a.isOrphan)
  const totalSizeMB = attachments.reduce(
    (sum, item) => sum + (item.totalSizeMB ?? (item as any).sizeMB ?? 0),
    0
  )
  const totalFiles = attachments.reduce((sum, item) => sum + (item.fileCount ?? 0), 0)
  const orphanSizeMB = orphans.reduce(
    (sum, item) => sum + (item.totalSizeMB ?? (item as any).sizeMB ?? 0),
    0
  )

  const displayList = activeTab === 'all' ? attachments : orphans

  const totalSessionPages = Math.max(1, Math.ceil(displayList.length / sessionPageSize))
  const pagedSessionList = React.useMemo(() => {
    const start = (currentSessionPage - 1) * sessionPageSize
    return displayList.slice(start, start + sessionPageSize)
  }, [displayList, currentSessionPage, sessionPageSize])

  React.useEffect(() => {
    setCurrentSessionPage(1)
  }, [activeTab, activePane, sessionPageSize])

  const handleSelectAll = () => {
    if (selectedIds.size === pagedSessionList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedSessionList.map((a) => a.sessionId)))
    }
  }

  const toggleSelect = (id: string, isChecked: boolean) => {
    const clone = new Set(selectedIds)
    if (isChecked) clone.add(id)
    else clone.delete(id)
    setSelectedIds(clone)
  }

  const toggleExpand = (id: string) => {
    const clone = new Set(expandedIds)
    if (clone.has(id)) clone.delete(id)
    else clone.add(id)
    setExpandedIds(clone)
  }

  // ======= 日记附件状态与逻辑 =======
  const [diaryYear, setDiaryYear] = useState<string>('all')
  const [diaryMonth, setDiaryMonth] = useState<string>('all')
  const [diaryOrphanOnly, setDiaryOrphanOnly] = useState<boolean>(false)
  const [selectedDiaryPaths, setSelectedDiaryPaths] = useState<Set<string>>(new Set())
  const [currentDiaryPage, setCurrentDiaryPage] = useState<number>(1)
  const [diaryPageSize, setDiaryPageSize] = useState<number>(10)

  // 动态生成有附件的年份选项
  const availableYears = React.useMemo(() => {
    const years = new Set<string>()
    diaryAttachments.forEach((item) => {
      const y = item.yearMonth.split('-')[0]
      if (y) years.add(y)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [diaryAttachments])

  // 执行日记附件的多级过滤
  const filteredDiaryAttachments = React.useMemo(() => {
    return diaryAttachments.filter((item) => {
      const [y, m] = item.yearMonth.split('-')
      if (diaryYear !== 'all' && y !== diaryYear) return false
      if (diaryMonth !== 'all' && m !== diaryMonth) return false
      if (diaryOrphanOnly && !item.isOrphan) return false
      return true
    })
  }, [diaryAttachments, diaryYear, diaryMonth, diaryOrphanOnly])

  // 重置分页在筛选变动时
  React.useEffect(() => {
    setCurrentDiaryPage(1)
    setSelectedDiaryPaths(new Set())
  }, [diaryYear, diaryMonth, diaryOrphanOnly, activePane, diaryPageSize])

  // 日记分页数据切片
  const totalDiaryPages = Math.max(1, Math.ceil(filteredDiaryAttachments.length / diaryPageSize))
  const pagedDiaryAttachments = React.useMemo(() => {
    const start = (currentDiaryPage - 1) * diaryPageSize
    return filteredDiaryAttachments.slice(start, start + diaryPageSize)
  }, [filteredDiaryAttachments, currentDiaryPage, diaryPageSize])

  // 日记附件总占用大小和孤立占用大小
  const diaryTotalSizeMB = diaryAttachments.reduce((sum, item) => sum + item.sizeMB, 0)
  const diaryOrphanSizeMB = diaryAttachments.filter((d) => d.isOrphan).reduce((sum, item) => sum + item.sizeMB, 0)

  // 格式化文件大小
  const formatSize = (mb: number | undefined | null) => {
    if (mb === undefined || mb === null || isNaN(mb)) return '0 B'
    if (mb <= 0) return '0 B'
    if (mb < 1) return (mb * 1024).toFixed(2) + ' KB'
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
    return mb.toFixed(2) + ' MB'
  }

  // 根据后缀名取得对应的卡片预览图标
  const getFileIcon = (name: string, size = 18) => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext)) {
      return <FileImage size={size} className={`${styles.fileIcon} ${styles.iconImage}`} />
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
      return <FileVideo size={size} className={`${styles.fileIcon} ${styles.iconVideo}`} />
    }
    if (ext === 'pdf') {
      return <FileText size={size} className={`${styles.fileIcon} ${styles.iconPdf}`} />
    }
    if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
      return <FileCode size={size} className={`${styles.fileIcon} ${styles.iconText}`} />
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <File size={size} className={`${styles.fileIcon} ${styles.iconArchive}`} />
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
      return <FileAudio size={size} className={`${styles.fileIcon} ${styles.iconAudio}`} />
    }
    return <File size={size} className={styles.fileIcon} />
  }

  // 判定是否是图片文件
  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
  }

  // 获取缩略图
  const getThumbnail = async (filePath: string) => {
    if (thumbnailCache.has(filePath)) {
      return thumbnailCache.get(filePath)!
    }

    // 防止重复加载
    if (thumbnailLoadingRef.current.has(filePath)) {
      return null
    }
    thumbnailLoadingRef.current.add(filePath)

    try {
      if (typeof window !== 'undefined' && (window as any).electron) {
        const thumbnail = await (window as any).electron.ipcRenderer.invoke(
          'attachment:getThumbnail',
          filePath,
          200
        )
        if (thumbnail) {
          setThumbnailCache((prev) => new Map(prev).set(filePath, thumbnail))
          return thumbnail
        }
      }
    } catch (e) {
      console.error('Failed to load thumbnail:', e)
    } finally {
      thumbnailLoadingRef.current.delete(filePath)
    }
    return null
  }

  // 获取原图（用于预览）
  const getFullImage = async (filePath: string) => {
    if (fullImageCacheRef.current.has(filePath)) {
      return fullImageCacheRef.current.get(filePath)!
    }

    try {
      if (typeof window !== 'undefined') {
        const w = window as any
        const imageData = w.api?.attachment?.getFullImage
          ? await w.api.attachment.getFullImage(filePath)
          : w.electron
            ? await w.electron.ipcRenderer.invoke('attachment:getFullImage', filePath)
            : null
        if (imageData) {
          fullImageCacheRef.current.set(filePath, imageData)
          return imageData
        }
      }
    } catch (e) {
      console.error('Failed to load full image:', e)
    }
    return null
  }

  const handleOpenImagePreview = async (filePath: string, fileName: string) => {
    if (imagePreviewLoading) return

    const cachedFull = fullImageCacheRef.current.get(filePath)
    const thumb = thumbnailCache.get(filePath)
    if (cachedFull) {
      setImagePreview({ src: cachedFull, name: fileName })
      return
    }
    if (thumb) {
      setImagePreview({ src: thumb, name: fileName })
    }

    setImagePreviewLoading(true)
    try {
      const src = await getFullImage(filePath)
      if (src) {
        setImagePreview({ src, name: fileName })
      } else if (!thumb && !cachedFull) {
        setImagePreview(null)
        toast.showError(t('settings.attachment_preview_failed', '无法加载图片预览'))
      }
    } finally {
      setImagePreviewLoading(false)
    }
  }

  // 加载当前页面的缩略图
  React.useEffect(() => {
    const loadThumbnails = async () => {
      const items = activePane === 'diary' ? pagedDiaryAttachments : []
      for (const item of items) {
        if (isImageFile(item.name) && !thumbnailCache.has(item.path)) {
          await getThumbnail(item.path)
        }
      }
    }
    loadThumbnails()
  }, [activePane, pagedDiaryAttachments])

  // 批量删除 AI 绘画面板选中的附件
  const handleDeleteGroups = async () => {
    if (selectedIds.size === 0) return

    let confirmMsg = t(
      'settings.attachment_delete_selected_confirm',
      '确定要删除选中的 $count 个会话的附件文件夹吗？此操作不可撤销。'
    )
    if (confirmMsg.includes('$count')) {
      confirmMsg = confirmMsg.replace('$count', selectedIds.size.toString())
    }

    const confirmed = await dialog.confirm(confirmMsg)
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected(Array.from(selectedIds))
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      setSelectedIds(new Set())
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleGroup = async (sessionId: string) => {
    const confirmed = await dialog.confirm(
      t(
        'settings.attachment_delete_group_confirm',
        '确定要删除该会话的所有附件吗？此操作不可撤销。'
      )
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected([sessionId])
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      const clone = new Set(selectedIds)
      clone.delete(sessionId)
      setSelectedIds(clone)
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleFile = async (sessionId: string, name: string) => {
    if (!onDeleteFile) return
    const confirmed = await dialog.confirm(
      t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。')
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteFile(sessionId, name)
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // ======= 日记附件事件处理 =======
  const handleDeleteDiarySingle = async (filePath: string) => {
    if (!onDeleteDiaryAttachment) return

    // 找出该附件是否为已引用附件
    const targetItem = diaryAttachments.find((item) => item.path === filePath)
    const isOrphan = targetItem ? targetItem.isOrphan : true

    if (!isOrphan) {
      // 这是一个已引用的附件，需要用户手动输入“确定”来进行二次确认
      const userInput = await dialog.prompt(
        t('settings.attachment_delete_referenced_prompt', '该附件已被日记引用，删除可能导致日记内容中链接失效。\n请输入“确定”以确认删除：'),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      // 孤立残留附件直接 confirm
      const confirmed = await dialog.confirm(
        t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。')
      )
      if (!confirmed) return
    }

    setIsDeleting(true)
    try {
      await onDeleteDiaryAttachment(filePath)
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
      const clone = new Set(selectedDiaryPaths)
      clone.delete(filePath)
      setSelectedDiaryPaths(clone)
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteDiarySelected = async () => {
    if (!onDeleteDiaryAttachment || selectedDiaryPaths.size === 0) return

    // 检测所选的文件中是否含有“已被引用的附件”
    const hasReferenced = Array.from(selectedDiaryPaths).some((p) => {
      const item = diaryAttachments.find((item) => item.path === p)
      return item ? !item.isOrphan : false
    })

    if (hasReferenced) {
      // 包含了已引用的附件，必须输入“确定”确认
      const userInput = await dialog.prompt(
        t('settings.attachment_delete_referenced_batch_prompt', '选中的附件中包含已被日记引用的文件，删除可能导致链接失效。\n请输入“确定”以确认批量删除选中的 $count 个文件：').replace('$count', selectedDiaryPaths.size.toString()),
        '',
        t('settings.attachment_delete_referenced_title', '警告：正在删除已引用的附件')
      )
      if (userInput !== confirmKeyword) {
        toast.showError(t('settings.attachment_delete_mismatch', '输入内容不符，已取消删除'))
        return
      }
    } else {
      // 全是孤立附件，直接 confirm
      const confirmed = await dialog.confirm(
        t(
          'settings.attachment_delete_selected_confirm',
          '确定要删除选中的 $count 个文件吗？此操作不可撤销。'
        ).replace('$count', selectedDiaryPaths.size.toString())
      )
      if (!confirmed) return
    }

    setIsDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedDiaryPaths).map((p) => onDeleteDiaryAttachment(p))
      )
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      setSelectedDiaryPaths(new Set())
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectDiary = (pathStr: string, isChecked: boolean) => {
    const clone = new Set(selectedDiaryPaths)
    if (isChecked) clone.add(pathStr)
    else clone.delete(pathStr)
    setSelectedDiaryPaths(clone)
  }

  const toggleSelectAllDiary = () => {
    if (selectedDiaryPaths.size === pagedDiaryAttachments.length) {
      setSelectedDiaryPaths(new Set())
    } else {
      setSelectedDiaryPaths(new Set(pagedDiaryAttachments.map((f) => f.path)))
    }
  }

  return (
    <div className={styles.container}>
      {/* 顶部主导航 Tab：日记附件 / AI 会话附件 (对标版本控制) */}
      <div className={styles.mainTabNav}>
        <div className={styles.mainTabs}>
          <button
            className={`${styles.mainTabItem} ${activePane === 'diary' ? styles.mainTabItemActive : ''}`}
            onClick={() => setActivePane('diary')}
          >
            <Calendar size={16} />
            <span>{t('settings.attachment_pane_diary', '日记附件')}</span>
          </button>
          <button
            className={`${styles.mainTabItem} ${activePane === 'session' ? styles.mainTabItemActive : ''}`}
            onClick={() => setActivePane('session')}
          >
            <Folder size={16} />
            <span>{t('settings.attachment_pane_session', 'AI 会话附件')}</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activePane === 'diary' ? (
          // ==========================================
          // 版块一：日记附件管理 (默认展示板块)
          // ==========================================
          <motion.div
            key="diary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={styles.paneContent}
          >
            <div className={styles.overviewCardWrapper}>
              <div className={styles.overviewCard}>
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.diary_attachment_total_size', '日记附件空间')}
                  </span>
                  <span className={`${styles.statValue} ${styles.colorPrimary}`}>
                    {formatSize(diaryTotalSizeMB)}
                  </span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.diary_attachment_total_count', '日记文件总数')}
                  </span>
                  <span className={`${styles.statValue} ${styles.colorOnSurface}`}>
                    {diaryAttachments.length}
                  </span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.diary_attachment_orphans_size', '孤立残余体积')}
                  </span>
                  <span
                    className={`${styles.statValue} ${diaryOrphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}
                  >
                    {formatSize(diaryOrphanSizeMB)}
                  </span>
                </div>
              </div>
            </div>

            {/* 联合筛选工具栏 */}
            <div className={styles.toolbarWrapper}>
              <div className={styles.filtersGroup}>
                {/* 年份选择 (对标回忆画廊 Portal Modal) */}
                {availableYears.length > 0 ? (
                  <div className={styles.filterFieldYear}>
                    <button
                      className={`${styles.yearSelectTrigger} ${isYearPickerOpen ? styles.open : ''}`}
                      onClick={() => setIsYearPickerOpen(true)}
                    >
                      <Calendar size={14} className={styles.filterIcon} />
                      <span>
                        {diaryYear === 'all'
                          ? t('gallery.filter_all_years', '全部年份')
                          : `${diaryYear}${t('common.year_suffix', '年')}`}
                      </span>
                      <ChevronDown size={14} className={styles.yearSelectChevron} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.filterField}>
                    <Calendar size={14} className={styles.filterIcon} />
                    <span className={styles.filterSelectEmpty}>
                      {t('gallery.filter_all_years', '全部年份')}
                    </span>
                  </div>
                )}

                {/* 月份选择 (自定义 Portal/Dropdown picker 美化，去除 Windows 系统原生下拉框) */}
                <div className={styles.filterFieldDropdown} ref={monthRef}>
                  <button
                    className={`${styles.dropdownTrigger} ${isMonthPickerOpen ? styles.open : ''}`}
                    onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                  >
                    <Folder size={14} className={styles.filterIcon} />
                    <span>
                      {diaryMonth === 'all'
                        ? t('settings.all_months', '全部月份')
                        : `${diaryMonth}${t('common.month_suffix', '月')}`}
                    </span>
                    <ChevronDown size={14} className={styles.dropdownChevron} />
                  </button>
                  <AnimatePresence>
                    {isMonthPickerOpen && (
                      <motion.div
                        className={styles.dropdownMenu}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className={styles.dropdownList}>
                          <button
                            className={`${styles.dropdownItem} ${diaryMonth === 'all' ? styles.active : ''}`}
                            onClick={() => {
                              setDiaryMonth('all')
                              setIsMonthPickerOpen(false)
                            }}
                          >
                            {t('settings.all_months', '全部月份')}
                          </button>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                            <button
                              key={m}
                              className={`${styles.dropdownItem} ${diaryMonth === m ? styles.active : ''}`}
                              onClick={() => {
                                setDiaryMonth(m)
                                setIsMonthPickerOpen(false)
                              }}
                            >
                              {m}
                              {t('common.month_suffix', '月')}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 筛选过滤（全部筛选 / 孤立附件） */}
                <div className={styles.filterFieldDropdown} ref={orphanRef}>
                  <button
                    className={`${styles.dropdownTrigger} ${isOrphanPickerOpen ? styles.open : ''}`}
                    onClick={() => setIsOrphanPickerOpen(!isOrphanPickerOpen)}
                  >
                    <Tag size={14} className={styles.filterIcon} />
                    <span>
                      {diaryOrphanOnly
                        ? t('settings.tag_orphan', '孤立附件')
                        : t('settings.all_filters', '全部筛选')}
                    </span>
                    <ChevronDown size={14} className={styles.dropdownChevron} />
                  </button>
                  <AnimatePresence>
                    {isOrphanPickerOpen && (
                      <motion.div
                        className={styles.dropdownMenu}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className={styles.dropdownList}>
                          <button
                            className={`${styles.dropdownItem} ${!diaryOrphanOnly ? styles.active : ''}`}
                            onClick={() => {
                              setDiaryOrphanOnly(false)
                              setIsOrphanPickerOpen(false)
                            }}
                          >
                            {t('settings.all_filters', '全部筛选')}
                          </button>
                          <button
                            className={`${styles.dropdownItem} ${diaryOrphanOnly ? styles.active : ''}`}
                            onClick={() => {
                              setDiaryOrphanOnly(true)
                              setIsOrphanPickerOpen(false)
                            }}
                          >
                            {t('settings.tag_orphan', '孤立附件')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className={styles.tabsRow}>
                {pagedDiaryAttachments.length > 0 && selectedDiaryPaths.size > 0 && (
                  <button
                    className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
                    onClick={handleDeleteDiarySelected}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                      '$count',
                      selectedDiaryPaths.size.toString()
                    )}
                  </button>
                )}

                {pagedDiaryAttachments.length > 0 && (
                  <button
                    className={`${styles.actionBtn} ${styles.btnOutlined}`}
                    onClick={toggleSelectAllDiary}
                  >
                    <CheckSquare size={16} />
                    {selectedDiaryPaths.size === pagedDiaryAttachments.length
                      ? t('settings.attachment_deselect_all', '取消全选')
                      : t('settings.attachment_select_all', '全选本页')}
                  </button>
                )}
              </div>
            </div>

            {/* 网格化文件列表 */}
            <div className={styles.diaryContentArea}>
              {filteredDiaryAttachments.length === 0 ? (
                <div className={styles.emptyState}>
                  <FolderMinus className={styles.emptyIcon} />
                  <span className={styles.emptyText}>
                    {t('settings.diary_no_attachments_found', '没有匹配到符合筛选条件的日记附件')}
                  </span>
                </div>
              ) : (
                <>
                  {filteredDiaryAttachments.length > 10 && (
                    <div className={styles.paginationRow} style={{ marginBottom: '16px' }}>
                      <PageSizeSelector
                        value={diaryPageSize}
                        options={[10, 20, 30, 50, 80, 100]}
                        onChange={setDiaryPageSize}
                      />
                      <Pagination
                        current={currentDiaryPage}
                        total={totalDiaryPages}
                        onChange={setCurrentDiaryPage}
                        showFirstLast={true}
                        showJumper={true}
                        jumperPlaceholder={t('version_control.jump_page', '跳页')}
                      />
                    </div>
                  )}
                  <div className={styles.diaryGrid}>
                    {pagedDiaryAttachments.map((item) => {
                      const isChecked = selectedDiaryPaths.has(item.path)
                      const isImage = isImageFile(item.name)
                      const thumbnailSrc = thumbnailCache.get(item.path)
                      return (
                        <div
                          key={item.path}
                          className={`${styles.diaryCard} ${isChecked ? styles.diaryCardSelected : ''}`}
                          onClick={() => toggleSelectDiary(item.path, !isChecked)}
                        >
                          {/* 图像或格式大预览区 */}
                          <div className={styles.diaryCardPreview}>
                            {isImage ? (
                              thumbnailSrc ? (
                                <img
                                  src={thumbnailSrc}
                                  alt={item.name}
                                  className={styles.diaryPreviewImg}
                                  loading="lazy"
                                />
                              ) : (
                                <div className={styles.diaryPreviewFallback}>
                                  {getFileIcon(item.name, 36)}
                                </div>
                              )
                            ) : (
                              <div className={styles.diaryPreviewFallback}>
                                {getFileIcon(item.name, 36)}
                              </div>
                            )}

                            {/* 多选复选框 */}
                            <div
                              className={styles.diaryCardCheckbox}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className={styles.customCheck}
                                checked={isChecked}
                                onChange={(e) => toggleSelectDiary(item.path, e.target.checked)}
                              />
                            </div>

                            {/* 孤立附件标签 */}
                            {item.isOrphan && (
                              <span className={styles.diaryBadgeOrphan}>
                                {t('settings.attachment_orphan_label', '孤立')}
                              </span>
                            )}

                            {/* 悬浮覆盖动作按钮 */}
                            <div
                              className={styles.diaryCardHoverActions}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isImage && (
                                <button
                                  className={styles.diaryHoverActionBtn}
                                  onClick={() => handleOpenImagePreview(item.path, item.name)}
                                  title={t('settings.attachment_preview_image', '查看原图')}
                                  disabled={imagePreviewLoading}
                                >
                                  <Maximize2 size={12} />
                                </button>
                              )}
                              {onOpenFileLocation && (
                                <button
                                  className={styles.diaryHoverActionBtn}
                                  onClick={() => onOpenFileLocation(item.path)}
                                  title={t('settings.open_file_location', '在文件夹中显示')}
                                >
                                  <FolderSearch size={14} />
                                </button>
                              )}
                              {onDeleteDiaryAttachment && (
                                <button
                                  className={`${styles.diaryHoverActionBtn} ${styles.diaryHoverActionBtnDanger}`}
                                  onClick={() => handleDeleteDiarySingle(item.path)}
                                  title={t('common.delete', '删除')}
                                  disabled={isDeleting}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 下层文字信息 */}
                          <div className={styles.diaryCardInfo}>
                            <span className={styles.diaryCardTitle} title={item.name}>
                              {item.name}
                            </span>
                            <span className={styles.diaryCardMeta}>
                              {item.yearMonth} • {formatSize(item.sizeMB)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 分页控制栏 */}
                  {filteredDiaryAttachments.length > 10 && (
                    <div className={styles.paginationRow}>
                      <PageSizeSelector
                        value={diaryPageSize}
                        options={[10, 20, 30, 50, 80, 100]}
                        onChange={setDiaryPageSize}
                      />
                      <Pagination
                        current={currentDiaryPage}
                        total={totalDiaryPages}
                        onChange={setCurrentDiaryPage}
                        showFirstLast={true}
                        showJumper={true}
                        jumperPlaceholder={t('version_control.jump_page', '跳页')}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : (
          // ==========================================
          // 版块二：AI 会话附件管理
          // ==========================================
          <motion.div
            key="session"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={styles.paneContent}
          >
            <div className={styles.overviewCardWrapper}>
              <div className={styles.overviewCard}>
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.attachment_total_size', '总占用空间')}
                  </span>
                  <span className={`${styles.statValue} ${styles.colorPrimary}`}>
                    {formatSize(totalSizeMB)}
                  </span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.attachment_total_count', '附件总数')}
                  </span>
                  <span className={`${styles.statValue} ${styles.colorOnSurface}`}>{totalFiles}</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statColumn}>
                  <span className={styles.statLabel}>
                    {t('settings.attachment_orphans_size', '孤立附件体积')}
                  </span>
                  <span
                    className={`${styles.statValue} ${orphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}
                  >
                    {formatSize(orphanSizeMB)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.toolbarWrapper}>
              <div className={styles.tabsRow}>
                <button
                  className={`${styles.actionBtn} ${activeTab === 'all' ? styles.btnFilled : styles.btnOutlined}`}
                  onClick={() => {
                    setActiveTab('all')
                    setSelectedIds(new Set())
                  }}
                >
                  {t('settings.attachment_tab_all', '会话附件')} {attachments.length}
                </button>
                <button
                  className={`${styles.actionBtn} ${activeTab === 'orphans' ? styles.btnFilled : styles.btnOutlined}`}
                  onClick={() => {
                    setActiveTab('orphans')
                    setSelectedIds(new Set())
                  }}
                >
                  {t('settings.attachment_tab_orphans', '孤立残留')} {orphans.length}
                </button>
              </div>

              <div className={styles.tabsRow}>
                {displayList.length > 0 && selectedIds.size > 0 && (
                  <button
                    className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
                    onClick={handleDeleteGroups}
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                      '$count',
                      selectedIds.size.toString()
                    )}
                  </button>
                )}

                {displayList.length > 0 && (
                  <button
                    className={`${styles.actionBtn} ${styles.btnOutlined}`}
                    onClick={handleSelectAll}
                  >
                    <CheckSquare size={16} />
                    {selectedIds.size === pagedSessionList.length
                      ? t('settings.attachment_deselect_all', '取消全选')
                      : t('settings.attachment_select_all', '全选本页')}
                  </button>
                )}
              </div>
            </div>

            {displayList.length > 10 && (
              <div className={styles.paginationRow} style={{ marginBottom: '16px' }}>
                <PageSizeSelector
                  value={sessionPageSize}
                  options={[10, 20, 30, 50, 80, 100]}
                  onChange={setSessionPageSize}
                />
                <Pagination
                  current={currentSessionPage}
                  total={totalSessionPages}
                  onChange={setCurrentSessionPage}
                  showFirstLast={true}
                  showJumper={true}
                  jumperPlaceholder={t('version_control.jump_page', '跳页')}
                />
              </div>
            )}

            <div className={styles.listArea}>
              {displayList.length === 0 ? (
                <div className={styles.emptyState}>
                  {activeTab === 'orphans' ? (
                    <CheckCircle className={styles.emptyIcon} />
                  ) : (
                    <FolderMinus className={styles.emptyIcon} />
                  )}
                  <span className={styles.emptyText}>
                    {activeTab === 'orphans'
                      ? t('settings.attachment_no_orphans', '没有发现已删除会话的残留附件')
                      : t('settings.attachment_no_attachments', '当前没有任何会话关联的附件')}
                  </span>
                </div>
              ) : (
                pagedSessionList.map((group) => {
                  const isChecked = selectedIds.has(group.sessionId)
                  const isExpanded = expandedIds.has(group.sessionId)
                  return (
                    <div key={group.sessionId}>
                      <div
                        className={`${styles.folderItem} ${isChecked ? styles.itemSelected : ''}`}
                        onClick={() => toggleExpand(group.sessionId)}
                      >
                        <div className={styles.checkboxWrapper} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.customCheck}
                            checked={isChecked}
                            onChange={(e) => toggleSelect(group.sessionId, e.target.checked)}
                          />
                        </div>

                        <div
                          className={`${styles.folderIconBox} ${group.isOrphan ? styles.folderIconBoxOrphan : ''}`}
                        >
                          {group.isOrphan ? <FolderMinus size={20} /> : <Folder size={20} />}
                        </div>

                        <div className={styles.folderInfo}>
                          <div className={styles.folderTitleRow}>
                            <span
                              className={styles.folderTitle}
                              title={group.sessionTitle || group.sessionId}
                            >
                              {group.sessionTitle ||
                                t('settings.attachment_orphan_session', '已删除的会话残留')}
                            </span>
                            {group.isOrphan && (
                              <span className={styles.orphanLabel}>
                                {t('settings.attachment_orphan_label', '孤立')}
                              </span>
                            )}
                          </div>
                          <span className={styles.folderFilesSubtitle}>
                            {group.fileCount} {t('settings.files_count', '个文件')} •{' '}
                            {group.isOrphan
                              ? `UUID: ${group.sessionId}`
                              : t('settings.active_session', '活动对话')}
                          </span>
                        </div>

                        <div className={styles.folderSizeWrapper}>
                          <span className={styles.folderSizeValue}>
                            {formatSize(group.totalSizeMB ?? (group as any).sizeMB ?? 0)}
                          </span>
                        </div>

                        <div className={styles.cardHeaderActions} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={`${styles.cardHeaderActionBtn} ${styles.cardHeaderActionBtnDanger}`}
                            onClick={() => handleDeleteSingleGroup(group.sessionId)}
                            title={t('settings.delete_all_files', '清理该会话所有附件')}
                            disabled={isDeleting}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            className={styles.cardHeaderActionBtn}
                            onClick={() => toggleExpand(group.sessionId)}
                          >
                            {isExpanded ? (
                              <ChevronUp size={18} className={styles.expandIcon} />
                            ) : (
                              <ChevronDown size={18} className={styles.expandIcon} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className={`${styles.fileListContainer} ${isExpanded ? styles.expanded : ''}`}>
                        <div className={styles.fileListContent}>
                          {Array.isArray(group.files) && group.files.map((file) => (
                            <div key={file.path} className={styles.fileItem}>
                              <div className={styles.fileIcon}>{getFileIcon(file.name)}</div>
                              <span className={styles.fileName} title={file.path}>
                                {file.name}
                              </span>

                              <div className={styles.fileMeta}>
                                <span className={styles.fileSize}>{formatSize(file.sizeMB)}</span>

                                <div className={styles.fileActions}>
                                  {onOpenFileLocation && (
                                    <button
                                      className={styles.fileActionBtn}
                                      onClick={() => onOpenFileLocation(file.path)}
                                      title={t('settings.open_file_location', '在文件夹中显示')}
                                    >
                                      <FolderSearch size={14} />
                                    </button>
                                  )}
                                  {onDeleteFile && (
                                    <button
                                      className={`${styles.fileActionBtn} ${styles.fileActionBtnDanger}`}
                                      onClick={() => handleDeleteSingleFile(group.sessionId, file.name)}
                                      title={t('common.delete', '删除')}
                                      disabled={isDeleting}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* 会话附件分页控制栏 */}
            {displayList.length > 10 && (
              <div className={styles.paginationRow}>
                <PageSizeSelector
                  value={sessionPageSize}
                  options={[10, 20, 30, 50, 80, 100]}
                  onChange={setSessionPageSize}
                />
                <Pagination
                  current={currentSessionPage}
                  total={totalSessionPages}
                  onChange={setCurrentSessionPage}
                  showFirstLast={true}
                  showJumper={true}
                  jumperPlaceholder={t('version_control.jump_page', '跳页')}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 传送门渲染年份选择弹窗 (对齐回忆画廊) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isYearPickerOpen && (
              <motion.div
                className={styles.yearModalOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsYearPickerOpen(false)}
              >
                <motion.div
                  className={styles.yearModalContent}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: 0.15 }
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.yearModalHeader}>
                    <h3>{t('gallery.select_year', '选择年份')}</h3>
                    <button
                      className={styles.yearModalClose}
                      onClick={() => setIsYearPickerOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className={styles.yearModalBody}>
                    {/* 全部年份 粘性置顶容器 */}
                    <div className={styles.yearModalStickyHeader}>
                      <button
                        ref={diaryYear === 'all' ? activeYearRef : null}
                        className={`${styles.yearModalAllBtn} ${
                          diaryYear === 'all' ? styles.active : ''
                        }`}
                        onClick={() => {
                          setDiaryYear('all')
                          setIsYearPickerOpen(false)
                        }}
                      >
                        {t('gallery.filter_all_years', '全部年份')}
                      </button>
                    </div>

                    {/* 年份网格 */}
                    <div className={styles.yearModalGrid}>
                      {availableYears.map((year) => {
                        const isSelected = diaryYear === year
                        return (
                          <button
                            key={year}
                            ref={isSelected ? activeYearRef : null}
                            className={`${styles.yearModalGridItem} ${
                              isSelected ? styles.active : ''
                            }`}
                            onClick={() => {
                              setDiaryYear(year)
                              setIsYearPickerOpen(false)
                            }}
                          >
                            {year}
                            {t('common.year_suffix', '年')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* 图片原图预览 */}
      {mounted &&
        imagePreview &&
        createPortal(
          <ImagePreview
            src={imagePreview.src}
            alt={imagePreview.name}
            isOpen={!!imagePreview}
            onClose={() => setImagePreview(null)}
          />,
          document.body
        )}
    </div>
  )
}
