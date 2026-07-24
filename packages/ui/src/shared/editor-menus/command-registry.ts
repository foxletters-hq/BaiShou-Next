export type CommandHandler<TContext = unknown> = (ctx: TContext) => void | Promise<void>

export interface CommandDescriptor<TContext = unknown> {
  id: string
  /** i18n key */
  labelKey: string
  defaultLabel: string
  /** 供 UI 映射图标（如 cut / copy），注册层不依赖 React */
  iconId?: string
  run: CommandHandler<TContext>
  /** 可见但仍禁用时返回 false */
  isEnabled?: (ctx: TContext) => boolean
}

const commands = new Map<string, CommandDescriptor>()

export function registerCommand<TContext = unknown>(
  descriptor: CommandDescriptor<TContext>
): void {
  commands.set(descriptor.id, descriptor as CommandDescriptor)
}

export function getCommand(id: string): CommandDescriptor | undefined {
  return commands.get(id)
}

export async function executeCommand<TContext = unknown>(
  id: string,
  ctx: TContext
): Promise<void> {
  const command = commands.get(id)
  if (!command) {
    throw new Error(`Unknown editor command: ${id}`)
  }
  if (command.isEnabled && !command.isEnabled(ctx)) {
    return
  }
  await command.run(ctx)
}

/** 仅供单测重置全局注册表 */
export function resetCommandRegistryForTests(): void {
  commands.clear()
}
