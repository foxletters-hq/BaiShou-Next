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
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
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
        if (!hasExternalAccess(context)) return false
        return try {
            val root = File(Environment.getExternalStorageDirectory(), "BaiShou_Root")
            root.mkdirs()
            val test = File(root, ".write_test")
            test.writeText("test")
            test.delete()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun getInfo(context: Context, uri: String): Map<String, Any?> {
        val file = resolveFile(context, uri)
        return mapOf(
            "exists" to file.exists(),
            "isDirectory" to file.isDirectory,
            "modificationTime" to (if (file.exists()) file.lastModified() else 0L),
            "size" to (if (file.exists() && file.isFile) file.length() else 0L)
        )
    }

    fun makeDirectory(context: Context, uri: String, intermediates: Boolean) {
        val file = resolveFile(context, uri)
        if (file.exists()) return
        val ok = if (intermediates) file.mkdirs() else file.mkdir()
        if (!ok && !file.exists()) {
            throw java.io.IOException("Failed to create directory: ${file.absolutePath}")
        }
    }

    fun writeString(context: Context, uri: String, content: String) {
        val file = resolveFile(context, uri)
        file.parentFile?.mkdirs()
        file.writeText(content)
    }

    fun writeBase64(context: Context, uri: String, base64: String) {
        val file = resolveFile(context, uri)
        file.parentFile?.mkdirs()
        file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
    }

    fun readString(context: Context, uri: String): String {
        val file = resolveFile(context, uri)
        if (!file.exists() || file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return file.readText()
    }

    fun readBase64(context: Context, uri: String): String {
        val file = resolveFile(context, uri)
        if (!file.exists() || file.isDirectory) {
            throw java.io.FileNotFoundException(uri)
        }
        return Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
    }

    fun deletePath(context: Context, uri: String, idempotent: Boolean) {
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

    /**
     * 任意 file:// 路径间复制（外部存储 ↔ 应用沙盒），用流式 I/O，避免整文件 base64 进 JS 堆。
     * 任一端为外部路径时需已授予全文件访问或 WRITE_EXTERNAL_STORAGE。
     */
    fun copyFileAny(context: Context, fromUri: String, toUri: String) {
        val fromPath = uriToPath(fromUri)
        val toPath = uriToPath(toUri)
        if (isExternalPath(fromPath) || isExternalPath(toPath)) {
            if (!hasExternalAccess(context)) {
                throw SecurityException("External storage access not granted")
            }
        }
        val from = File(fromPath)
        val to = File(toPath)
        if (!from.exists()) throw java.io.FileNotFoundException(fromUri)
        to.parentFile?.mkdirs()
        if (from.isDirectory) {
            from.copyRecursively(to, overwrite = true)
        } else {
            from.inputStream().buffered().use { input ->
                to.outputStream().buffered().use { output ->
                    input.copyTo(output)
                }
            }
        }
    }

    private val ARCHIVE_SKIP_TOP_LEVEL =
        setOf("database", "config", "manifest.json", "user-data")

    private val ARCHIVE_SKIP_DIR_NAMES = setOf("snapshots", "temp", ".snapshots")

    /** UTF-8 解压备份 ZIP 到目标目录（支持中文文件名） */
    fun unzipArchive(zipUri: String, destUri: String) {
        val zipFile = resolveAnyFile(zipUri)
        val destDir = resolveAnyFile(destUri)
        if (!zipFile.exists() || !zipFile.isFile) {
            throw java.io.FileNotFoundException(zipUri)
        }
        destDir.mkdirs()
        ZipFile(zipFile).use { zip ->
            zip.charset = StandardCharsets.UTF_8
            zip.extractAll(destDir.absolutePath)
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
}
