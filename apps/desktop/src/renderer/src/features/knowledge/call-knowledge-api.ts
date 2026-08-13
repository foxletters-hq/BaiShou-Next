/**
 * 调用知识库 preload API；若 preload 尚未热更新到新方法，回退到 ipcRenderer.invoke。
 * Electron preload 变更通常需要完全重启应用才会挂到 window.api。
 */
export async function callKnowledgeApi<T>(
  method: string,
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const kn = window.api?.knowledge as Record<string, unknown> | undefined
  const fn = kn?.[method]
  if (typeof fn === 'function') {
    return (await (fn as (...a: unknown[]) => Promise<T>)(...args)) as T
  }
  const invoke = window.electron?.ipcRenderer?.invoke
  if (typeof invoke === 'function') {
    return (await invoke(channel, ...args)) as T
  }
  throw new Error('知识库接口未就绪，请完全退出并重新打开应用后再试')
}
