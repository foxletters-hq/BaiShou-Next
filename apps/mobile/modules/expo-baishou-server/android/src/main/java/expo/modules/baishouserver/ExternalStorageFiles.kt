package expo.modules.baishouserver

import android.Manifest
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.util.Base64
import java.io.File
import java.nio.charset.StandardCharsets
import net.lingala.zip4j.ZipFile

object ExternalStorageFiles {
    /** 将 file:// 或绝对路径中的 %E4%B8%AD 等段解码为真实文件名（供 java.io.File 使用） */
    private fun decodePathSegments(path: String): String {
        return path.split('/').joinToString("/") { segment ->
            if (segment.isEmpty()) {
                ""
            } else {
                try {
                    Uri.decode(segment)
                } catch (_: Exception) {
                    segment
                }
            }
        }
    }

    fun uriToPath(uri: String): String {
        val rawPath = when {
            uri.startsWith("file://") -> {
                // 勿用 Uri.parse(uri).path：file:///storage/emulated/0/… 会把 storage 当成 host，path 变成 /emulated/0/…
                val remainder = uri.removePrefix("file://")
                if (remainder.startsWith("/")) {
                    remainder
                } else {
                    val parsed = Uri.parse(uri)
                    val path = parsed.path
                    if (!path.isNullOrEmpty()) {
                        val host = parsed.host
                        if (!host.isNullOrEmpty() && host != "localhost" && !path.startsWith("/$host")) {
                            "/$host$path"
                        } else {
                            path
                        }
                    } else {
                        remainder
                    }
                }
            }
            uri.startsWith("/emulated/0") -> "/storage$uri"
            else -> uri
        }
        return decodePathSegments(rawPath)
    }

    fun hasExternalAccess(context: Context): Boolean {
        return StoragePermissionHelper.hasEffectiveExternalAccess(context)
    }

    private fun canUseFileApi(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) return true
            if (StoragePermissionHelper.hasAppOpsAllFilesAccess(context)) return true
        } else if (StoragePermissionHelper.hasStandardStoragePermission(context)) {
            return true
        }
        return StoragePermissionHelper.probeBaiShouRootWritable()
    }

    private fun useTreeAccess(context: Context, uri: String): Boolean {
        if (canUseFileApi(context)) return false
        if (!StorageTreeAccess.hasPersistedTree(context)) return false
        return StorageTreeAccess.isPathUnderTree(context, uriToPath(uri))
    }

    fun isExternalPath(path: String): Boolean {
        val normalized = uriToPath(path)
        return normalized.startsWith("/storage/") ||
            normalized.startsWith("/sdcard/") ||
            normalized.startsWith(Environment.getExternalStorageDirectory().absolutePath)
    }

    private fun resolveFile(context: Context, uri: String): File {
        if (!hasExternalAccess(context)) {
            throw SecurityException("External storage access not granted")
        }
        val path = uriToPath(uri)
        if (!isExternalPath(path)) {
            throw IllegalArgumentException("Path is not external storage: $path")
        }
        return File(path)
    }

    private fun resolveAnyFile(uri: String): File = File(uriToPath(uri))

    /** 任意本地路径（含应用沙盒 cache）的元信息，不校验外部存储权限 */
    fun getInfoAny(context: Context, uri: String): Map<String, Any?> {
        val file = resolveAnyFile(uri)
        return mapOf(
            "exists" to file.exists(),
            "isDirectory" to file.isDirectory,
            "modificationTime" to (if (file.exists()) file.lastModified() else 0L),
            "size" to (if (file.exists() && file.isFile) file.length() else 0L)
        )
    }

    /** 任意本地路径（含应用沙盒 cache）的目录列表，不校验外部存储权限 */
    fun readDirectoryAny(context: Context, uri: String): List<String> {
        val file = resolveAnyFile(uri)
        if (!file.exists() || !file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return file.list()?.toList() ?: emptyList()
    }

    fun probeWritable(context: Context): Boolean {
        if (StorageTreeAccess.hasPersistedTree(context)) {
            return StorageTreeAccess.probeWritable(context)
        }
        return StoragePermissionHelper.probeBaiShouRootWritable()
    }

    fun getInfo(context: Context, uri: String): Map<String, Any?> {
        if (useTreeAccess(context, uri)) {
            return StorageTreeAccess.getInfo(context, uriToPath(uri))
        }
        val file = resolveFile(context, uri)
        return mapOf(
            "exists" to file.exists(),
            "isDirectory" to file.isDirectory,
            "modificationTime" to (if (file.exists()) file.lastModified() else 0L),
            "size" to (if (file.exists() && file.isFile) file.length() else 0L)
        )
    }

    fun makeDirectory(context: Context, uri: String, intermediates: Boolean) {
        if (useTreeAccess(context, uri)) {
            StorageTreeAccess.ensureDirectory(context, uriToPath(uri), intermediates)
            return
        }
        val file = resolveFile(context, uri)
        if (file.exists()) return
        val ok = if (intermediates) file.mkdirs() else file.mkdir()
        if (!ok && !file.exists()) {
            throw java.io.IOException("Failed to create directory: ${file.absolutePath}")
        }
    }

    fun writeString(context: Context, uri: String, content: String) {
        if (useTreeAccess(context, uri)) {
            StorageTreeAccess.writeString(context, uriToPath(uri), content)
            return
        }
        val file = resolveFile(context, uri)
        file.parentFile?.mkdirs()
        file.writeText(content)
    }

    fun appendString(context: Context, uri: String, content: String) {
        if (useTreeAccess(context, uri)) {
            val path = uriToPath(uri)
            val existing = try {
                StorageTreeAccess.readString(context, path)
            } catch (_: Exception) {
                ""
            }
            StorageTreeAccess.writeString(context, path, existing + content)
            return
        }
        val file = resolveFile(context, uri)
        file.parentFile?.mkdirs()
        java.io.FileOutputStream(file, true).use { out ->
            out.write(content.toByteArray(Charsets.UTF_8))
        }
    }

    fun appendStringAny(context: Context, uri: String, content: String) {
        val file = resolveAnyFile(uri)
        file.parentFile?.mkdirs()
        java.io.FileOutputStream(file, true).use { out ->
            out.write(content.toByteArray(Charsets.UTF_8))
        }
    }

    fun writeBase64(context: Context, uri: String, base64: String) {
        if (useTreeAccess(context, uri)) {
            StorageTreeAccess.writeBytes(context, uriToPath(uri), Base64.decode(base64, Base64.DEFAULT))
            return
        }
        val file = resolveFile(context, uri)
        file.parentFile?.mkdirs()
        file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
    }

    fun readString(context: Context, uri: String): String {
        if (useTreeAccess(context, uri)) {
            return StorageTreeAccess.readString(context, uriToPath(uri))
        }
        val file = resolveFile(context, uri)
        if (!file.exists() || file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return file.readText()
    }

    fun readBase64(context: Context, uri: String): String {
        if (useTreeAccess(context, uri)) {
            val bytes = StorageTreeAccess.readBytes(context, uriToPath(uri))
            return Base64.encodeToString(bytes, Base64.NO_WRAP)
        }
        val file = resolveFile(context, uri)
        if (!file.exists() || file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
    }

    fun deletePath(context: Context, uri: String, idempotent: Boolean) {
        if (useTreeAccess(context, uri)) {
            StorageTreeAccess.deletePath(context, uriToPath(uri), idempotent)
            return
        }
        val file = resolveFile(context, uri)
        if (!file.exists()) {
            if (idempotent) return
            throw java.io.FileNotFoundException(uri)
        }
        if (file.isDirectory) {
            file.deleteRecursively()
        } else {
            file.delete()
        }
    }

    fun readDirectory(context: Context, uri: String): List<String> {
        if (useTreeAccess(context, uri)) {
            return StorageTreeAccess.readDirectory(context, uriToPath(uri))
        }
        val file = resolveFile(context, uri)
        if (!file.exists() || !file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return file.list()?.toList() ?: emptyList()
    }

    fun movePath(context: Context, fromUri: String, toUri: String) {
        val from = resolveFile(context, fromUri)
        val to = resolveFile(context, toUri)
        to.parentFile?.mkdirs()
        if (!from.renameTo(to)) {
            from.copyTo(to, overwrite = true)
            if (from.isDirectory) from.deleteRecursively() else from.delete()
        }
    }

    fun copyPath(context: Context, fromUri: String, toUri: String) {
        val from = resolveFile(context, fromUri)
        val to = resolveFile(context, toUri)
        if (!from.exists()) throw java.io.FileNotFoundException(fromUri)
        to.parentFile?.mkdirs()
        if (from.isDirectory) {
            from.copyRecursively(to, overwrite = true)
        } else {
            from.copyTo(to, overwrite = true)
        }
    }

    private val STORAGE_MIGRATION_SKIP_DIRS = setOf("snapshots", "temp")
    private const val STORAGE_MIGRATION_STAGING_DIR = ".baishou_migrate_staging"

    private fun normalizeStorageRootPath(path: String): String {
        return uriToPath(path).trimEnd('/')
    }

    private fun shouldSkipStorageMigrationEntry(name: String): Boolean {
        if (name in STORAGE_MIGRATION_SKIP_DIRS) return true
        if (name == STORAGE_MIGRATION_STAGING_DIR) return true
        return name.endsWith("-wal") ||
            name.endsWith("-shm") ||
            name.endsWith("-journal")
    }

    private fun ensureExternalAccessForPaths(context: Context, vararg paths: String) {
        for (path in paths) {
            if (isExternalPath(path) && !hasExternalAccess(context)) {
                throw SecurityException("External storage access not granted")
            }
        }
    }

    private fun copyFileStreaming(context: Context, from: File, to: File) {
        ensureExternalAccessForPaths(context, from.absolutePath, to.absolutePath)
        if (!from.exists() || from.isDirectory) {
            throw java.io.FileNotFoundException(from.absolutePath)
        }
        to.parentFile?.mkdirs()
        from.inputStream().buffered().use { input ->
            to.outputStream().buffered().use { output ->
                input.copyTo(output)
            }
        }
    }

    private fun mergeDirectoriesForMigration(
        context: Context,
        src: File,
        dest: File,
        onProgress: ((String) -> Unit)?
    ): List<String> {
        val failed = mutableListOf<String>()
        if (!src.exists() || !src.isDirectory) return failed
        dest.mkdirs()
        val children = src.listFiles() ?: return failed
        for (entry in children) {
            onProgress?.invoke(entry.name)
            val destPath = File(dest, entry.name)
            if (entry.isDirectory) {
                failed.addAll(mergeDirectoriesForMigration(context, entry, destPath, onProgress))
            } else {
                try {
                    copyFileStreaming(context, entry, destPath)
                } catch (_: Exception) {
                    failed.add(entry.absolutePath)
                }
            }
        }
        return failed
    }

    private fun removePathRecursive(target: File) {
        if (!target.exists()) return
        if (target.isDirectory) {
            target.listFiles()?.forEach { child ->
                removePathRecursive(child)
            }
        }
        target.delete()
    }

    /**
     * 与 TS copyStorageRootContents 对齐：staging 复制后提升到目标根，流式 I/O，不经 JS 堆。
     * skip 规则须与 @baishou/shared shouldSkipStorageMigrationEntry 保持一致。
     */
    fun copyStorageRootContents(
        context: Context,
        sourceUri: String,
        targetUri: String,
        onProgress: ((String) -> Unit)? = null
    ) {
        val source = resolveAnyFile(sourceUri)
        val targetRoot = resolveAnyFile(targetUri)
        val sourcePath = normalizeStorageRootPath(source.absolutePath)
        val targetPath = normalizeStorageRootPath(targetRoot.absolutePath)

        if (sourcePath == targetPath) {
            throw IllegalArgumentException("SAME_PATH")
        }
        if (targetPath == sourcePath || targetPath.startsWith("$sourcePath/")) {
            throw IllegalArgumentException("TARGET_INSIDE_SOURCE")
        }
        if (!source.exists()) {
            throw java.io.FileNotFoundException(sourceUri)
        }
        if (!source.isDirectory) {
            throw IllegalArgumentException("SOURCE_NOT_DIRECTORY")
        }
        ensureExternalAccessForPaths(context, targetPath)

        val staging = File(targetRoot, STORAGE_MIGRATION_STAGING_DIR)
        removePathRecursive(staging)
        staging.mkdirs()

        val promoted = mutableListOf<File>()
        val copyFailures = mutableListOf<String>()
        try {
            val sourceChildren = source.listFiles() ?: emptyArray()
            for (entry in sourceChildren) {
                val name = entry.name
                if (shouldSkipStorageMigrationEntry(name)) continue
                onProgress?.invoke(name)
                val stagingPath = File(staging, name)
                if (entry.isDirectory) {
                    copyFailures.addAll(
                        mergeDirectoriesForMigration(context, entry, stagingPath, onProgress)
                    )
                } else {
                    try {
                        copyFileStreaming(context, entry, stagingPath)
                    } catch (_: Exception) {
                        copyFailures.add(entry.absolutePath)
                    }
                }
            }
            if (copyFailures.isNotEmpty()) {
                throw java.io.IOException(
                    "Failed to copy ${copyFailures.size} file(s): ${copyFailures.take(3).joinToString()}"
                )
            }

            val stagedChildren = staging.listFiles() ?: emptyArray()
            for (entry in stagedChildren) {
                onProgress?.invoke(entry.name)
                val dest = File(targetRoot, entry.name)
                if (entry.isDirectory) {
                    copyFailures.addAll(
                        mergeDirectoriesForMigration(context, entry, dest, onProgress)
                    )
                } else {
                    try {
                        copyFileStreaming(context, entry, dest)
                    } catch (_: Exception) {
                        copyFailures.add(entry.absolutePath)
                    }
                }
                promoted.add(dest)
            }
            if (copyFailures.isNotEmpty()) {
                throw java.io.IOException(
                    "Failed to copy ${copyFailures.size} file(s): ${copyFailures.take(3).joinToString()}"
                )
            }
        } catch (error: Exception) {
            promoted.asReversed().forEach { path ->
                try {
                    removePathRecursive(path)
                } catch (_: Exception) {
                    // best-effort rollback
                }
            }
            throw error
        } finally {
            removePathRecursive(staging)
        }
    }

    /**
     * 任意 file:// 路径间复制（外部存储 ↔ 应用沙盒），用流式 I/O，避免整文件 base64 进 JS 堆。
     * 任一端为外部路径时需已授予全文件访问或 WRITE_EXTERNAL_STORAGE。
     */
    fun copyFileAny(context: Context, fromUri: String, toUri: String) {
        val toPath = uriToPath(toUri)
        val to = File(toPath)
        to.parentFile?.mkdirs()

        if (fromUri.startsWith("content://") || fromUri.startsWith("ph://")) {
            val input = context.contentResolver.openInputStream(Uri.parse(fromUri))
                ?: throw java.io.FileNotFoundException(fromUri)
            input.buffered().use { source ->
                to.outputStream().buffered().use { output ->
                    source.copyTo(output)
                }
            }
            return
        }

        val fromPath = uriToPath(fromUri)
        ensureExternalAccessForPaths(context, fromPath, toPath)
        val from = File(fromPath)
        if (!from.exists()) throw java.io.FileNotFoundException(fromUri)
        if (from.isDirectory) {
            from.copyRecursively(to, overwrite = true)
        } else {
            copyFileStreaming(context, from, to)
        }
    }

    private val ARCHIVE_SKIP_TOP_LEVEL =
        setOf("database", "config", "manifest.json", "user-data")

    private val ARCHIVE_SKIP_DIR_NAMES = setOf("snapshots", "temp", ".snapshots")

    private val ARCHIVE_EXCLUDED_ROOT_NAMES = setOf(
        ".baishou",
        ".baishou-s3.json",
        ".git",
        ".baishou-git.json"
    )

    private val STORE_EXTENSIONS = setOf(
        ".png", ".jpg", ".jpeg", ".gif", ".webp",
        ".mp3", ".mp4", ".mov", ".wav", ".avi", ".mkv",
        ".zip", ".gz", ".tar", ".rar", ".7z", ".pdf", ".epub"
    )

    private data class ArchiveZipStats(var entryCount: Int = 0, var uncompressedBytes: Long = 0L)

    private fun shouldStoreWithoutCompression(fileName: String): Boolean {
        val dot = fileName.lastIndexOf('.')
        if (dot < 0) return false
        return fileName.substring(dot).lowercase() in STORE_EXTENSIONS
    }

    private fun shouldSkipJournalFile(fileName: String): Boolean {
        return fileName.endsWith("-wal") ||
            fileName.endsWith("-shm") ||
            fileName.endsWith("-journal")
    }

    /**
     * 直接从 BaiShou_Root 流式打包 ZIP，避免先把整库复制进应用沙盒（大库会撑爆 cache 导致备份残缺）。
     * [supplementRootUri] 为沙盒内的小目录（manifest / config / database / user-data 等）。
     */
    fun zipArchiveExport(
        context: Context,
        storageRootUri: String,
        supplementRootUri: String?,
        outputZipUri: String
    ): Map<String, Any> {
        val storageRootPath = uriToPath(storageRootUri)
        if (isExternalPath(storageRootPath) && !hasExternalAccess(context)) {
            throw SecurityException("External storage access not granted")
        }

        val storageRoot = resolveAnyFile(storageRootUri)
        if (!storageRoot.exists() || !storageRoot.isDirectory) {
            throw java.io.FileNotFoundException(storageRootUri)
        }

        val outputZip = resolveAnyFile(outputZipUri)
        outputZip.parentFile?.mkdirs()
        if (outputZip.exists()) {
            outputZip.delete()
        }

        val stats = ArchiveZipStats()
        ZipFile(outputZip).use { zipFile ->
            zipFile.charset = StandardCharsets.UTF_8

            val children = storageRoot.listFiles() ?: emptyArray()
            for (entry in children) {
                val name = entry.name
                if (name == "." || name == "..") continue
                if (name in ARCHIVE_EXCLUDED_ROOT_NAMES) continue
                if (name in ARCHIVE_SKIP_DIR_NAMES) continue
                if (name == "snapshots" || name == "temp" || name == ".snapshots") continue
                addArchiveEntryToZip(zipFile, entry, name, stats)
            }

            if (!supplementRootUri.isNullOrBlank()) {
                val supplementRoot = resolveAnyFile(supplementRootUri)
                if (supplementRoot.exists() && supplementRoot.isDirectory) {
                    val supplementChildren = supplementRoot.listFiles() ?: emptyArray()
                    for (entry in supplementChildren) {
                        val name = entry.name
                        if (name == "." || name == "..") continue
                        addArchiveEntryToZip(zipFile, entry, name, stats)
                    }
                }
            }
        }

        return mapOf(
            "outputPath" to outputZip.absolutePath,
            "entryCount" to stats.entryCount,
            "uncompressedBytes" to stats.uncompressedBytes,
            "zipBytes" to outputZip.length()
        )
    }

    private fun addArchiveEntryToZip(
        zipFile: ZipFile,
        source: File,
        zipPath: String,
        stats: ArchiveZipStats
    ) {
        if (!source.exists()) return
        if (source.isDirectory) {
            if (source.name in ARCHIVE_SKIP_DIR_NAMES) return
            val children = source.listFiles() ?: return
            for (child in children) {
                addArchiveEntryToZip(zipFile, child, "$zipPath/${child.name}", stats)
            }
            return
        }

        val fileName = source.name
        if (shouldSkipJournalFile(fileName)) return

        val normalizedZipPath = zipPath.replace('\\', '/')
        val params = net.lingala.zip4j.model.ZipParameters().apply {
            fileNameInZip = normalizedZipPath
            compressionMethod = if (shouldStoreWithoutCompression(fileName)) {
                net.lingala.zip4j.model.enums.CompressionMethod.STORE
            } else {
                net.lingala.zip4j.model.enums.CompressionMethod.DEFLATE
            }
            if (compressionMethod == net.lingala.zip4j.model.enums.CompressionMethod.DEFLATE) {
                compressionLevel = net.lingala.zip4j.model.enums.CompressionLevel.FASTEST
            }
        }
        zipFile.addFile(source, params)
        stats.entryCount += 1
        stats.uncompressedBytes += source.length()
    }

    /** UTF-8 解压备份 ZIP 到目标目录（支持中文文件名） */
    fun unzipArchive(
        zipUri: String,
        destUri: String,
        onProgress: ((current: Int, total: Int, entryName: String) -> Unit)? = null
    ) {
        val zipFile = resolveAnyFile(zipUri)
        val destDir = resolveAnyFile(destUri)
        if (!zipFile.exists() || !zipFile.isFile) {
            throw java.io.FileNotFoundException(zipUri)
        }
        destDir.mkdirs()
        ZipFile(zipFile).use { zip ->
            zip.charset = StandardCharsets.UTF_8
            val headers = zip.fileHeaders.filter { header ->
                !header.isDirectory && header.fileName.isNotBlank()
            }
            val total = headers.size.coerceAtLeast(1)
            headers.forEachIndexed { index, header ->
                zip.extractFile(header, destDir.absolutePath)
                onProgress?.invoke(index + 1, total, header.fileName)
            }
        }
    }

    /** 将解压目录中的保险库文件复制到 BaiShou_Root（对齐 JS selectiveCopy 过滤规则） */
    fun copyArchiveExtractToRoot(context: Context, extractUri: String, rootUri: String) {
        val rootPath = uriToPath(rootUri)
        if (isExternalPath(rootPath) && !hasExternalAccess(context)) {
            throw SecurityException("External storage access not granted")
        }
        val extractDir = resolveAnyFile(extractUri)
        val rootDir = resolveAnyFile(rootUri)
        if (!extractDir.exists() || !extractDir.isDirectory) {
            throw java.io.FileNotFoundException(extractUri)
        }
        rootDir.mkdirs()
        val children = extractDir.listFiles() ?: return
        for (entry in children) {
            val name = entry.name
            if (name == "." || name == ".." || name in ARCHIVE_SKIP_TOP_LEVEL) continue
            copyArchiveEntrySelective(entry, File(rootDir, name))
        }
    }

    private fun copyArchiveEntrySelective(source: File, target: File) {
        if (!source.exists()) return
        if (source.isDirectory) {
            if (source.name in ARCHIVE_SKIP_DIR_NAMES) return
            target.mkdirs()
            val children = source.listFiles() ?: return
            for (child in children) {
                copyArchiveEntrySelective(child, File(target, child.name))
            }
            return
        }
        val fileName = source.name
        if (
            fileName.endsWith("-wal") ||
            fileName.endsWith("-shm") ||
            fileName.endsWith("-journal")
        ) {
            return
        }
        target.parentFile?.mkdirs()
        source.inputStream().buffered().use { input ->
            target.outputStream().buffered().use { output ->
                input.copyTo(output)
            }
        }
    }

  private fun md5HexFile(file: File): String {
    val md = java.security.MessageDigest.getInstance("MD5")
    val buffer = ByteArray(128 * 1024)
    file.inputStream().buffered().use { input ->
      var read: Int
      while (input.read(buffer).also { read = it } != -1) {
        md.update(buffer, 0, read)
      }
    }
    return md.digest().joinToString("") { b -> "%02x".format(b) }
  }

  /** 任意本地文件 MD5（hex），流式读取避免整文件进 JS */
  fun md5HexAny(context: Context, uri: String): String {
    val file = resolveAnyFile(uri)
    if (!file.exists() || !file.isFile) {
      throw java.io.FileNotFoundException(uri)
    }
    return md5HexFile(file)
  }

  /** 外部存储文件 MD5（hex）；SAF 树路径暂不支持，由 JS 回退 */
  fun md5HexExternal(context: Context, uri: String): String {
    if (useTreeAccess(context, uri)) {
      throw UnsupportedOperationException("MD5 via SAF tree is not supported")
    }
    val file = resolveFile(context, uri)
    if (!file.exists() || !file.isFile) {
      throw java.io.FileNotFoundException(uri)
    }
    return md5HexFile(file)
  }
}
