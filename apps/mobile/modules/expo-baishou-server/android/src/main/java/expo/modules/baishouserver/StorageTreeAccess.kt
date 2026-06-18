package expo.modules.baishouserver

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile

/**
 * 通过 SAF（ACTION_OPEN_DOCUMENT_TREE）持久化目录树访问。
 * 用于 realme / ColorOS 等 ROM 上「所有文件访问」开关灰色或无法开启时的备用方案。
 */
object StorageTreeAccess {
    private const val PREFS = "baishou_storage_tree"
    private const val KEY_TREE_URI = "tree_uri"

    fun saveTreeUri(context: Context, treeUri: Uri) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TREE_URI, treeUri.toString())
            .apply()
    }

    fun getTreeUri(context: Context): Uri? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_TREE_URI, null)
            ?: return null
        return try {
            Uri.parse(raw)
        } catch (_: Exception) {
            null
        }
    }

    fun clearTreeUri(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_TREE_URI)
            .apply()
    }

    fun hasPersistedTree(context: Context): Boolean = getTreeUri(context) != null

    fun resolveTreeRootPath(context: Context): String? {
        val treeUri = getTreeUri(context) ?: return null
        return DirectoryTreeUri.resolvePath(context, treeUri)
    }

    fun isPathUnderTree(context: Context, absolutePath: String): Boolean {
        val root = resolveTreeRootPath(context) ?: return false
        val normalized = ExternalStorageFiles.uriToPath(absolutePath).trimEnd('/')
        val rootNorm = root.trimEnd('/')
        return normalized == rootNorm || normalized.startsWith("$rootNorm/")
    }

    fun probeWritable(context: Context): Boolean {
        val treeUri = getTreeUri(context) ?: return false
        return try {
            val root = DocumentFile.fromTreeUri(context, treeUri) ?: return false
            if (!root.canWrite()) return false
            val testName = ".baishou_write_test"
            val existing = root.findFile(testName)
            existing?.delete()
            val created = root.createFile("text/plain", testName) ?: return false
            context.contentResolver.openOutputStream(created.uri)?.use { stream ->
                stream.write("ok".toByteArray())
            } ?: return false
            created.delete()
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun documentForPath(
        context: Context,
        absolutePath: String,
        createMissingDirs: Boolean = false
    ): DocumentFile? {
        val treeUri = getTreeUri(context) ?: return null
        val rootPath = DirectoryTreeUri.resolvePath(context, treeUri) ?: return null
        val normalized = ExternalStorageFiles.uriToPath(absolutePath).trimEnd('/')
        val rootNorm = rootPath.trimEnd('/')
        if (normalized != rootNorm && !normalized.startsWith("$rootNorm/")) return null

        var doc = DocumentFile.fromTreeUri(context, treeUri) ?: return null
        if (normalized == rootNorm) return doc

        val relative = normalized.removePrefix("$rootNorm/").trim('/')
        if (relative.isEmpty()) return doc

        for (segment in relative.split('/')) {
            if (segment.isEmpty()) continue
            val next = doc.findFile(segment)
                ?: if (createMissingDirs) doc.createDirectory(segment) else return null
            doc = next ?: return null
        }
        return doc
    }

    fun ensureDirectory(context: Context, absolutePath: String, intermediates: Boolean) {
        val treeUri = getTreeUri(context) ?: throw SecurityException("No SAF tree access")
        val rootPath = DirectoryTreeUri.resolvePath(context, treeUri)
            ?: throw IllegalArgumentException("Invalid tree URI")
        val normalized = ExternalStorageFiles.uriToPath(absolutePath).trimEnd('/')
        val rootNorm = rootPath.trimEnd('/')
        if (normalized == rootNorm) return

        if (!normalized.startsWith("$rootNorm/")) {
            throw IllegalArgumentException("Path outside SAF tree: $absolutePath")
        }

        val relative = normalized.removePrefix("$rootNorm/").trim('/')
        if (relative.isEmpty()) return

        var doc = DocumentFile.fromTreeUri(context, treeUri)
            ?: throw java.io.IOException("Tree root unavailable")
        val parts = relative.split('/').filter { it.isNotEmpty() }
        for (i in parts.indices) {
            val name = parts[i]
            val existing = doc.findFile(name)
            doc = if (existing != null) {
                existing
            } else if (i < parts.lastIndex || intermediates) {
                doc.createDirectory(name) ?: throw java.io.IOException("Failed to mkdir: $name")
            } else {
                doc.createDirectory(name) ?: throw java.io.IOException("Failed to mkdir: $name")
            }
        }
    }

    fun writeString(context: Context, absolutePath: String, content: String) {
        writeBytes(context, absolutePath, content.toByteArray(Charsets.UTF_8))
    }

    fun readString(context: Context, absolutePath: String): String {
        return readBytes(context, absolutePath).toString(Charsets.UTF_8)
    }

    fun getInfo(context: Context, absolutePath: String): Map<String, Any?> {
        val doc = documentForPath(context, absolutePath)
            ?: return mapOf(
                "exists" to false,
                "isDirectory" to false,
                "modificationTime" to 0L,
                "size" to 0L
            )
        return mapOf(
            "exists" to doc.exists(),
            "isDirectory" to doc.isDirectory,
            "modificationTime" to doc.lastModified(),
            "size" to if (doc.isFile) doc.length() else 0L
        )
    }

    fun readDirectory(context: Context, absolutePath: String): List<String> {
        val doc = documentForPath(context, absolutePath)?.takeIf { it.isDirectory }
            ?: throw java.io.FileNotFoundException(absolutePath)
        return doc.listFiles().mapNotNull { it.name }
    }

    fun writeBytes(context: Context, absolutePath: String, bytes: ByteArray) {
        val parentPath = ExternalStorageFiles.uriToPath(absolutePath).substringBeforeLast('/')
        if (parentPath.isNotEmpty()) {
            ensureDirectory(context, parentPath, true)
        }
        val name = ExternalStorageFiles.uriToPath(absolutePath).substringAfterLast('/')
        val parentDoc = documentForPath(context, parentPath, createMissingDirs = true)
            ?: throw java.io.FileNotFoundException(parentPath)
        val target = parentDoc.findFile(name)?.takeIf { it.isFile }
            ?: parentDoc.createFile("application/octet-stream", name)
            ?: throw java.io.IOException("Failed to create file: $absolutePath")
        context.contentResolver.openOutputStream(target.uri, "wt")?.use { stream ->
            stream.write(bytes)
        } ?: throw java.io.IOException("Failed to write: $absolutePath")
    }

    fun readBytes(context: Context, absolutePath: String): ByteArray {
        val doc = documentForPath(context, absolutePath)?.takeIf { it.isFile }
            ?: throw java.io.FileNotFoundException(absolutePath)
        return context.contentResolver.openInputStream(doc.uri)?.use { stream ->
            stream.readBytes()
        } ?: throw java.io.FileNotFoundException(absolutePath)
    }

    fun deletePath(context: Context, absolutePath: String, idempotent: Boolean) {
        val doc = documentForPath(context, absolutePath) ?: if (idempotent) return
        else throw java.io.FileNotFoundException(absolutePath)
        if (!doc.exists()) {
            if (idempotent) return
            throw java.io.FileNotFoundException(absolutePath)
        }
        if (!doc.delete()) {
            throw java.io.IOException("Failed to delete: $absolutePath")
        }
    }
}
