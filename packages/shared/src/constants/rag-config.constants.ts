/** RAG 检索召回数量上限（Top-K） */
export const RAG_TOP_K_MAX = 50

/**
 * 移动端相似度阈值滑条使用 0–100 整数步进（与 Top-K 等 SettingsSliderRow 一致），
 * 落库时除以该刻度得到 0.00–1.00。
 */
export const RAG_SIMILARITY_SLIDER_SCALE = 100
