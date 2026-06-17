package expo.modules.baishouserver

import android.content.Context
import android.os.Environment
import java.io.File

/**
 * Dev 包（com.baishou.baishou.dev）读取已安装的正式包（com.baishou.baishou）遗留数据。
 * Flutter 默认把日记放在正式包沙盒内，Dev 包无法直接访问；此处尝试复制到外部 BaiShou_Root 供双方共用。
 */
object LegacyProductionBridge {
    const val PRODUCTION_PACKAGE = "com.baishou.baishou"

    fun isDevPackage(packageName: String): Boolean {
        return packageName != PRODUCTION_PACKAGE
    }

    fun isProductionAppInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getApplicationInfo(PRODUCTION_PACKAGE, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun openProductionContext(context: Context): Context? {
        if (context.packageName == PRODUCTION_PACKAGE) return context
        return try {
            context.createPackageContext(PRODUCTION_PACKAGE, Context.CONTEXT_IGNORE_SECURITY)
        } catch (_: Exception) {
            null
        }
    }

    private fun productionLegacyCandidates(dataDir: File): List<File> {
        return listOf(
            File(dataDir, "app_flutter/BaiShou_Root"),
            File(dataDir, "files/BaiShou_Root")
        )
    }

    fun collectLegacyStorageRoots(context: Context): List<String> {
        val roots = linkedSetOf<String>()

        fun addIfUseful(dir: File) {
            if (!dir.exists() || !dir.isDirectory) return
            if (hasLegacySqliteMarkers(dir) || countJournalMarkdownFiles(dir) > 0) {
                roots.add(dir.absolutePath)
            }
        }

        parseFlutterCustomStorageRoot(context)?.let { customPath ->
            addIfUseful(File(customPath))
        }

        val appFlutter = File(context.applicationInfo.dataDir, "app_flutter/BaiShou_Root")
        addIfUseful(appFlutter)
        addIfUseful(File(context.filesDir, "BaiShou_Root"))

        val external = File(Environment.getExternalStorageDirectory(), "BaiShou_Root")
        addIfUseful(external)

        if (isDevPackage(context.packageName) && isProductionAppInstalled(context)) {
            val prodCtx = openProductionContext(context)
            if (prodCtx != null) {
                for (candidate in productionLegacyCandidates(File(prodCtx.applicationInfo.dataDir))) {
                    addIfUseful(candidate)
                }
            } else {
                try {
                    val prodDataDir = File(
                        context.packageManager.getApplicationInfo(PRODUCTION_PACKAGE, 0).dataDir
                    )
                    for (candidate in productionLegacyCandidates(prodDataDir)) {
                        if (candidate.exists()) {
                            roots.add(candidate.absolutePath)
                        }
                    }
                } catch (_: Exception) {
                    // ignore
                }
            }
        }

        return roots.toList()
    }

    /** 原版 Flutter 自定义工作区路径（SharedPreferences custom_storage_root） */
    private fun parseFlutterCustomStorageRoot(context: Context): String? {
        val xml = readFlutterSharedPreferencesXml(context) ?: return null
        val pattern = Regex("""<string name="(?:flutter\\.)?custom_storage_root">([\s\S]*?)</string>""")
        val match = pattern.find(xml) ?: return null
        val decoded = match.groupValues[1]
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&#10;", "\n")
            .trim()
        return decoded.takeIf { it.isNotEmpty() }
    }

    fun readFlutterSharedPreferencesXml(context: Context): String? {
        fun readFrom(ctx: Context): String? {
            val prefsFile = File(ctx.applicationInfo.dataDir, "shared_prefs/FlutterSharedPreferences.xml")
            return if (prefsFile.exists()) prefsFile.readText() else null
        }

        readFrom(context)?.let { return it }

        if (!isDevPackage(context.packageName)) return null
        val prodCtx = openProductionContext(context) ?: return null
        return readFrom(prodCtx)
    }

    fun getLegacyAvatarsDirectory(context: Context): String? {
        fun avatarsIn(ctx: Context): String? {
            val avatars = File(File(ctx.applicationInfo.dataDir, "app_flutter"), "avatars")
            return if (avatars.exists() && avatars.isDirectory) avatars.absolutePath else null
        }

        avatarsIn(context)?.let { return it }
        if (!isDevPackage(context.packageName)) return null
        val prodCtx = openProductionContext(context) ?: return null
        return avatarsIn(prodCtx)
    }

    /**
     * 将正式包沙盒内的 BaiShou_Root 镜像到外部存储，供 Dev 与正式版共用。
     * 仅当外部尚无日记文件时执行。
     */
    fun mirrorProductionLegacyToExternal(context: Context): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>(
            "mirrored" to false,
            "productionInstalled" to isProductionAppInstalled(context),
            "journalFilesCopied" to 0
        )

        if (!isDevPackage(context.packageName)) {
            result["reason"] = "not_dev_package"
            return result
        }
        if (!ExternalStorageFiles.hasExternalAccess(context)) {
            result["reason"] = "no_external_access"
            return result
        }

        val externalRoot = File(Environment.getExternalStorageDirectory(), "BaiShou_Root")
        if (countJournalMarkdownFiles(externalRoot) > 0) {
            result["reason"] = "external_already_has_journals"
            return result
        }

        val prodCtx = openProductionContext(context)
        if (prodCtx == null) {
            result["reason"] = "production_context_unavailable"
            return result
        }

        var sourceRoot: File? = null
        for (candidate in productionLegacyCandidates(File(prodCtx.applicationInfo.dataDir))) {
            if (countJournalMarkdownFiles(candidate) > 0 || hasLegacySqliteMarkers(candidate)) {
                sourceRoot = candidate
                break
            }
        }

        if (sourceRoot == null) {
            result["reason"] = "no_production_legacy_data"
            return result
        }

        val copied = copyTreeMerge(sourceRoot, externalRoot)
        result["mirrored"] = copied > 0
        result["journalFilesCopied"] = copied
        result["reason"] = if (copied > 0) "mirrored" else "copy_failed"
        return result
    }

    fun countJournalMarkdownFiles(root: File): Int {
        if (!root.exists() || !root.isDirectory) return 0
        var count = 0
        root.listFiles()?.forEach { entry ->
            if (!entry.isDirectory) return@forEach
            val journals = File(entry, "Journals")
            if (!journals.isDirectory) return@forEach
            count += countJournalMarkdownFilesRecursive(journals)
        }
        return count
    }

    private fun countJournalMarkdownFilesRecursive(dir: File): Int {
        if (!dir.exists() || !dir.isDirectory) return 0
        var count = 0
        dir.listFiles()?.forEach { entry ->
            when {
                entry.isFile && entry.name.endsWith(".md", ignoreCase = true) &&
                    entry.name.matches(Regex("""\d{4}-\d{2}-\d{2}\.md""", RegexOption.IGNORE_CASE)) -> {
                    count++
                }
                entry.isDirectory -> count += countJournalMarkdownFilesRecursive(entry)
            }
        }
        return count
    }

    private fun hasLegacySqliteMarkers(root: File): Boolean {
        val globalAgent = File(root, ".baishou/agent.sqlite")
        if (globalAgent.exists()) return true
        root.listFiles()?.forEach { entry ->
            if (!entry.isDirectory) return@forEach
            val vaultAgent = File(entry, ".baishou/agent.sqlite")
            val vaultBaishou = File(entry, ".baishou/baishou.sqlite")
            if (vaultAgent.exists() || vaultBaishou.exists()) return true
        }
        return false
    }

    private fun copyTreeMerge(source: File, target: File): Int {
        if (!source.exists() || !source.isDirectory) return 0
        target.mkdirs()
        var journalCopied = 0
        source.listFiles()?.forEach { entry ->
            val dest = File(target, entry.name)
            if (entry.isDirectory) {
                journalCopied += copyTreeMerge(entry, dest)
            } else {
                try {
                    val overwrite = entry.parentFile?.name == "Journals"
                    entry.copyTo(dest, overwrite = overwrite)
                    if (entry.parentFile?.name == "Journals" && entry.name.endsWith(".md", ignoreCase = true)) {
                        journalCopied++
                    }
                } catch (_: Exception) {
                    // skip single file failures
                }
            }
        }
        return journalCopied
    }
}
