package expo.modules.baishouserver

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import java.io.File
import java.net.URLDecoder

object DirectoryTreeUri {
    /**
     * 将 SAF 目录树 Uri 解析为 java.io.File 可用的绝对路径。
     * 在已授予 MANAGE_EXTERNAL_STORAGE 时，后续仍通过 File API 读写。
     */
    fun resolvePath(context: Context, treeUri: Uri): String? {
        val docId = try {
            DocumentsContract.getTreeDocumentId(treeUri)
        } catch (_: Exception) {
            return null
        }

        if (docId.isNullOrBlank()) return null

        if (docId.startsWith("raw:")) {
            return URLDecoder.decode(docId.removePrefix("raw:"), "UTF-8")
        }

        val colon = docId.indexOf(':')
        if (colon < 0) return null

        val volume = docId.substring(0, colon)
        val relative = docId.substring(colon + 1)

        if (volume.equals("primary", ignoreCase = true)) {
            val base = Environment.getExternalStorageDirectory().absolutePath
            return if (relative.isEmpty()) base else File(base, relative).absolutePath
        }

        // 外置 SD 卡等：/storage/{volumeId}/...
        val storageRoot = File("/storage/$volume")
        return if (relative.isEmpty()) {
            storageRoot.absolutePath
        } else {
            File(storageRoot, relative).absolutePath
        }
    }
}
