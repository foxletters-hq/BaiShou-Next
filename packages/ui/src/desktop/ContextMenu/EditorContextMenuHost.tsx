import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  executeCommand,
  MenuId,
  registerBuiltinEditorCommands,
  resolveMenuItems,
  type EditorContextMenuOpenPayload
} from '../../shared/editor-menus'
import type { ContextMenuItem } from './ContextMenu'
import { AnchoredContextMenu } from './AnchoredContextMenu'
import { resolveEditorContextMenuIcon } from './editor-context-menu-icons'

export interface EditorContextMenuHostProps {
  menu: EditorContextMenuOpenPayload | null
  onClose: () => void
  /** 统一走 Obsidian 风格的 context-menu；cm-context-menu 仅兼容旧调用 */
  variant?: 'context-menu' | 'cm-context-menu'
}

/**
 * 解析 MenuId.EditorContext 并弹出 AnchoredContextMenu。
 * 新菜单项应通过 registerCommand + appendMenuItem 贡献，勿在此硬编码。
 */
export function EditorContextMenuHost({
  menu,
  onClose,
  variant = 'context-menu'
}: EditorContextMenuHostProps) {
  const { t } = useTranslation()

  useEffect(() => {
    registerBuiltinEditorCommands()
  }, [])

  const items = useMemo((): ContextMenuItem[] => {
    if (!menu) return []

    const resolved = resolveMenuItems(MenuId.EditorContext, menu.context)
    return resolved.map((item) => {
      if (item.type === 'separator') {
        return { label: '', onClick: () => undefined, divider: true }
      }

      return {
        label: t(item.labelKey, item.defaultLabel),
        icon: resolveEditorContextMenuIcon(item.iconId, item.commandId),
        disabled: item.disabled,
        onClick: () => {
          void executeCommand(item.commandId, menu.context)
        }
      }
    })
  }, [menu, t])

  if (!menu || items.length === 0) return null

  const useCm = variant === 'cm-context-menu'

  return (
    <AnchoredContextMenu
      x={menu.x}
      y={menu.y}
      items={items}
      onClose={onClose}
      menuClassName={useCm ? 'cm-context-menu' : 'context-menu'}
      itemClassName={useCm ? 'cm-context-menu-item' : 'context-menu-item'}
      dividerClassName={useCm ? 'cm-context-menu-divider' : 'context-menu-divider'}
    />
  )
}
