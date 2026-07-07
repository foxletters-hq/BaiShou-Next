import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Copy,
  ExternalLink,
  File,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2
} from 'lucide-react'
import type { ContextMenuItem } from '@baishou/ui'
import '@baishou/ui/desktop/ContextMenu/ContextMenu.css'
import type { FileTreeNode } from './useWorkbenchFileTree'

export type FileExplorerMenuTarget =
  | { kind: 'root' }
  | { kind: 'node'; node: FileTreeNode }

export interface FileExplorerContextMenuState {
  x: number
  y: number
  target: FileExplorerMenuTarget
}

export interface WorkbenchFileExplorerContextMenuProps {
  menu: FileExplorerContextMenuState | null
  onClose: () => void
  items: ContextMenuItem[]
}

export const WorkbenchFileExplorerContextMenu: React.FC<WorkbenchFileExplorerContextMenuProps> = ({
  menu,
  onClose,
  items
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    let x = menu.x
    let y = menu.y
    if (x + rect.width > window.innerWidth) {
      x = Math.max(10, window.innerWidth - rect.width - 10)
    }
    if (y + rect.height > window.innerHeight) {
      y = Math.max(10, window.innerHeight - rect.height - 10)
    }
    menuRef.current.style.left = `${x}px`
    menuRef.current.style.top = `${y}px`
  }, [menu, items])

  useEffect(() => {
    if (!menu) return
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menu, onClose])

  if (!menu) return null

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'transparent'
        }}
        onMouseDown={onClose}
      />
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          zIndex: 10000,
          left: menu.x,
          top: menu.y
        }}
        role="menu"
      >
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} className="context-menu-divider" />
          }
          return (
            <button
              key={`${item.label}-${index}`}
              type="button"
              className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick()
                  onClose()
                }
              }}
            >
              {item.icon ? <span className="context-menu-icon">{item.icon}</span> : null}
              <span className="context-menu-label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </>,
    document.body
  )
}

const ICON_SIZE = 14
const ICON_STROKE = 1.75

export interface BuildFileExplorerMenuItemsParams {
  target: FileExplorerMenuTarget
  t: (key: string, fallback: string) => string
  onOpenFile: (relativePath: string) => void
  onExpandFolder: (relativePath: string) => void
  onNewFile: (parentDir: string) => void
  onNewFolder: (parentDir: string) => void
  onRename: (node: FileTreeNode) => void
  onDelete: (node: FileTreeNode) => void
  onCopyPath: (node: FileTreeNode | null) => void
  onRevealInExplorer: (node: FileTreeNode | null) => void
  onRefresh: () => void
}

export function buildFileExplorerMenuItems({
  target,
  t,
  onOpenFile,
  onExpandFolder,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopyPath,
  onRevealInExplorer,
  onRefresh
}: BuildFileExplorerMenuItemsParams): ContextMenuItem[] {
  const icon = (node: React.ReactNode) => node

  if (target.kind === 'root') {
    return [
      {
        label: t('workbench.new_file', '新建文件'),
        icon: icon(<FilePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
        onClick: () => onNewFile('')
      },
      {
        label: t('workbench.new_folder', '新建文件夹'),
        icon: icon(<FolderPlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
        onClick: () => onNewFolder('')
      },
      { label: '', onClick: () => {}, divider: true },
      {
        label: t('common.refresh', '刷新'),
        icon: icon(<RefreshCw size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
        onClick: onRefresh
      }
    ]
  }

  const { node } = target
  const parentDir = node.isDirectory
    ? node.relativePath
    : node.relativePath.includes('/')
      ? node.relativePath.replace(/\/[^/]+$/, '')
      : ''

  const items: ContextMenuItem[] = []

  if (node.isDirectory) {
    items.push({
      label: t('workbench.expand_folder', '展开文件夹'),
      icon: icon(<FolderOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onExpandFolder(node.relativePath)
    })
  } else {
    items.push({
      label: t('workbench.open_file', '打开'),
      icon: icon(<File size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onOpenFile(node.relativePath)
    })
  }

  items.push({ label: '', onClick: () => {}, divider: true })
  items.push(
    {
      label: t('workbench.new_file', '新建文件'),
      icon: icon(<FilePlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onNewFile(parentDir)
    },
    {
      label: t('workbench.new_folder', '新建文件夹'),
      icon: icon(<FolderPlus size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onNewFolder(parentDir)
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: t('workbench.rename', '重命名'),
      icon: icon(<Pencil size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onRename(node)
    },
    {
      label: t('workbench.delete', '删除'),
      icon: icon(<Trash2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onDelete(node)
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: t('workbench.copy_path', '复制路径'),
      icon: icon(<Copy size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onCopyPath(node)
    },
    {
      label: t('workbench.reveal_in_explorer', '在资源管理器中显示'),
      icon: icon(<ExternalLink size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: () => onRevealInExplorer(node)
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: t('common.refresh', '刷新'),
      icon: icon(<RefreshCw size={ICON_SIZE} strokeWidth={ICON_STROKE} />),
      onClick: onRefresh
    }
  )

  return items
}

export function useCloseOnScroll(close: () => void, active: boolean): void {
  const handleScroll = useCallback(() => close(), [close])
  useEffect(() => {
    if (!active) return
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [active, handleScroll])
}
