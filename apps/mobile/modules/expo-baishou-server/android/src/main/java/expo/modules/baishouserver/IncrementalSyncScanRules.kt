package expo.modules.baishouserver

/** 与 packages/shared incremental-sync-scan.util 保持一致的扫描过滤规则 */
object IncrementalSyncScanRules {
    private val SYNC_SKIP_DIR_NAMES = setOf("node_modules", "snapshots", "temp", ".snapshots")
    private const val BAISHOU_SETTINGS_PREFIX = ".baishou/settings/"

    private fun normalizeRel(relativePath: String): String =
        relativePath.replace('\\', '/').trimStart('/')

    private fun basenameFromRel(relativePath: String): String {
        val rel = normalizeRel(relativePath)
        return rel.substringAfterLast('/', rel)
    }

    private fun isSqliteRuntimeSyncPath(relativePath: String): Boolean {
        val base = basenameFromRel(relativePath).lowercase()
        return base.endsWith(".db") ||
            base.endsWith(".db-shm") ||
            base.endsWith(".db-wal") ||
            base.endsWith(".db-journal") ||
            base.endsWith(".probe")
    }

    private fun isBaishouSettingsTree(rel: String): Boolean {
        return rel == ".baishou/settings" ||
            rel.endsWith("/.baishou/settings") ||
            rel.contains("/.baishou/settings/") ||
            rel.startsWith(BAISHOU_SETTINGS_PREFIX)
    }

    private fun isRootSyncMetaDirectory(rel: String, entryName: String): Boolean {
        return entryName == ".baishou" && (rel == ".baishou" || rel == "")
    }

    fun shouldScanDirectory(entryName: String, relativePath: String): Boolean {
        if (SYNC_SKIP_DIR_NAMES.contains(entryName)) return false
        val rel = normalizeRel(relativePath)

        if (isRootSyncMetaDirectory(rel, entryName)) return false
        if (isBaishouSettingsTree(rel)) return !SYNC_SKIP_DIR_NAMES.contains(entryName)
        if (entryName == ".baishou" && rel.endsWith("/.baishou")) return true
        if (rel.contains("/.baishou/") && !isBaishouSettingsTree(rel)) return false
        if (rel.startsWith(".baishou/") && !isBaishouSettingsTree(rel)) return false
        if (entryName.startsWith(".")) return false
        return true
    }

    fun shouldIncludeFile(entryName: String, relativePath: String): Boolean {
        val rel = normalizeRel(relativePath)
        if (isSqliteRuntimeSyncPath(rel) || isSqliteRuntimeSyncPath(entryName)) return false
        if (isBaishouSettingsTree(rel)) {
            return if (rel.contains("/.baishou/settings/") || rel.startsWith(BAISHOU_SETTINGS_PREFIX)) {
                rel.endsWith(".json") && !entryName.endsWith(".tmp")
            } else {
                false
            }
        }
        if (rel.contains("/.baishou/") || rel.startsWith(".baishou/")) return false
        if (entryName.startsWith(".")) return false
        return true
    }
}
