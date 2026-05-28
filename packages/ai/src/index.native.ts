/**
 * @baishou/ai — React Native / Expo 入口（与桌面共用实现，依赖 @baishou/database 的 native 入口）
 * Metro 通过 package.json `react-native` 字段解析到此文件。
 * 必须从 index.shared 再导出，不能 `export * from './index'`，否则 Metro 会把 `./index` 解析回本文件形成循环依赖。
 */
export * from './index.shared'
