/**
 * @baishou/ai 的移动端入口。
 * 与桌面 index.ts 共用 index.shared，但不加载工作区 Node 实现和 MCP Server。
 * 不能 export * from './index'，否则 Metro 会把 ./index 解析回本文件。
 */
export * from './index.shared'
