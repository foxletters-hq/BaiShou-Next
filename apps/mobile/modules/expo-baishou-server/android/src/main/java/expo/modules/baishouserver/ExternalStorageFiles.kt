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

object ExternalStorageFiles {
    fun uriToPath(uri: String): String {
        if (uri.startsWith("file://")) {
            // 勿用 Uri.parse(uri).path：file:///storage/emulated/0/… 会把 storage 当成 host，path 变成 /emulated/0/…
            val remainder = uri.removePrefix("file://")
            if (remainder.startsWith("/")) {
                return remainder
            }
            val parsed = Uri.parse(uri)
            val path = parsed.path
            if (!path.isNullOrEmpty()) {
                val host = parsed.host
                if (!host.isNullOrEmpty() && host != "localhost" && !path.startsWith("/$host")) {
                    return "/$host$path"
                }
                return path
            }
            return remainder
        }
        // JS 层若传入已 strip 的路径，补全 /storage 前缀
        if (uri.startsWith("/emulated/0")) {
            return "/storage$uri"
        }
        return uri
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
}
