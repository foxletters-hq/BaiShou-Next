package expo.modules.baishouserver

/** 与 packages/shared incremental-sync-scan.util 保持一致的扫描过滤规则 */
object IncrementalSyncScanRules {
    private val SYNC_SKIP_DIR_NAMES = setOf("node_modules", "snapshots", "temp", ".snapshots")
    private const val BAISHOU_SETTINGS_PREFIX = ".baishou/settings/"
    private const val VAULT_IDENTITY_META_FILENAME = "vault.json"
    private val CONFLICT_BACKUP_REGEX = Regex("""\.conflict-\d+""")

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

    /** 存储根下的 `.baishou/`：允许下降以扫描 `.baishou/settings/` */
    private fun isRootBaishouDirectory(rel: String, entryName: String): Boolean {
        return entryName == ".baishou" && (rel == ".baishou" || rel == "")
    }

    /** `<vault>/.baishou/vault.json` — 仓库稳定 ID 锚点，须纳入增量同步 */
    fun isVaultIdentityMetaRelPath(relativePath: String): Boolean {
        val rel = normalizeRel(relativePath)
        return rel.endsWith("/.baishou/$VAULT_IDENTITY_META_FILENAME")
    }

    fun isIncrementalSyncConflictBackupPath(relativePath: String): Boolean {
        return CONFLICT_BACKUP_REGEX.containsMatchIn(basenameFromRel(relativePath))
    }

    fun isIncrementalSyncChatBackgroundPath(relativePath: String): Boolean {
        val rel = normalizeRel(relativePath)
        return rel == "Attachments/backgrounds" ||
            rel.endsWith("/Attachments/backgrounds") ||
            rel.startsWith("Attachments/backgrounds/") ||
            rel.contains("/Attachments/backgrounds/")
    }

    fun shouldScanDirectory(entryName: String, relativePath: String): Boolean {
        if (SYNC_SKIP_DIR_NAMES.contains(entryName)) return false
        val rel = normalizeRel(relativePath)

        if (isIncrementalSyncChatBackgroundPath(rel)) return false

        if (isRootBaishouDirectory(rel, entryName)) return true
        if (isBaishouSettingsTree(rel)) return !SYNC_SKIP_DIR_NAMES.contains(entryName)
        if (entryName == ".baishou" && rel.endsWith("/.baishou")) return true
        if (rel.contains("/.baishou/") && !isBaishouSettingsTree(rel)) return false
        if (rel.startsWith(".baishou/") && !isBaishouSettingsTree(rel)) return false
        if (entryName.startsWith(".")) return false
        return true
    }

    private fun isJsonlShardsManifestSyncPath(relativePath: String): Boolean =
        basenameFromRel(relativePath) == "shards.manifest.json"

    fun shouldIncludeFile(entryName: String, relativePath: String): Boolean {
        val rel = normalizeRel(relativePath)
        if (isIncrementalSyncChatBackgroundPath(rel) || isIncrementalSyncChatBackgroundPath(entryName)) {
            return false
        }
        if (isSqliteRuntimeSyncPath(rel) || isSqliteRuntimeSyncPath(entryName)) return false
        if (isJsonlShardsManifestSyncPath(rel) || isJsonlShardsManifestSyncPath(entryName)) return false
        if (isIncrementalSyncConflictBackupPath(rel) || isIncrementalSyncConflictBackupPath(entryName)) {
            return false
        }
        if (isBaishouSettingsTree(rel)) {
            return if (rel.contains("/.baishou/settings/") || rel.startsWith(BAISHOU_SETTINGS_PREFIX)) {
                rel.endsWith(".json") && !entryName.endsWith(".tmp")
            } else {
                false
            }
        }
        if (isVaultIdentityMetaRelPath(rel)) return true
        if (rel.contains("/.baishou/") || rel.startsWith(".baishou/")) return false
        if (entryName.startsWith(".")) return false
        return true
    }
}
