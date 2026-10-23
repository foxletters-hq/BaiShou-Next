import { getCommand } from './command-registry'
import type { MenuIdValue } from './menu-id'

export interface MenuItemContribution<TContext = unknown> {
  menuId: MenuIdValue | string
  commandId: string
  /** 同组内按 order 排序；不同 group 之间插入分隔线 */
  group: string
  order: number
  /** 返回 false 则不显示该项 */
  when?: (ctx: TContext) => boolean
}

export type ResolvedMenuItem =
  | {
      type: 'command'
      commandId: string
      labelKey: string
      defaultLabel: string
      iconId?: string
      disabled: boolean
    }
  | { type: 'separator' }

const menuItems: MenuItemContribution[] = []

export function appendMenuItem<TContext = unknown>(item: MenuItemContribution<TContext>): void {
  menuItems.push(item as MenuItemContribution)
}

export function resolveMenuItems<TContext = unknown>(
  menuId: MenuIdValue | string,
  ctx: TContext
): ResolvedMenuItem[] {
  const visible = menuItems
    .filter((item) => item.menuId === menuId)
    .filter((item) => (item.when ? item.when(ctx) : true))
    .slice()
    .sort((a, b) => {
      if (a.group !== b.group) return a.group < b.group ? -1 : 1
      return a.order - b.order
    })

  const resolved: ResolvedMenuItem[] = []
  let lastGroup: string | undefined

  for (const item of visible) {
    const command = getCommand(item.commandId)
    if (!command) continue

    if (lastGroup !== undefined && lastGroup !== item.group) {
      resolved.push({ type: 'separator' })
    }
    lastGroup = item.group

    const disabled = command.isEnabled ? !command.isEnabled(ctx) : false
    resolved.push({
      type: 'command',
      commandId: command.id,
      labelKey: command.labelKey,
      defaultLabel: command.defaultLabel,
      iconId: command.iconId,
      disabled
    })
  }

  return resolved
}

/** 仅供单测重置全局注册表 */
export function resetMenuRegistryForTests(): void {
  menuItems.length = 0
}
