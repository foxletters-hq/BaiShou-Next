package expo.modules.baishouserver

import android.app.AppOpsManager
import android.content.Context
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import androidx.core.content.ContextCompat
import java.io.File

/** ColorOS / realme 等 ROM 的存储权限状态（「存储空间」≠「允许管理所有文件」） */
object StoragePermissionHelper {
    private const val OP_MANAGE_EXTERNAL_STORAGE = "android:manage_external_storage"

    fun hasAppOpsAllFilesAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false
        return try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.unsafeCheckOpNoThrow(
                OP_MANAGE_EXTERNAL_STORAGE,
                android.os.Process.myUid(),
                context.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (_: Exception) {
            false
        }
    }

    fun hasStandardStoragePermission(context: Context): Boolean {
        val readGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
        val writeGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
        return readGranted || writeGranted
    }

    fun probeBaiShouRootWritable(): Boolean {
        return try {
            val root = File(Environment.getExternalStorageDirectory(), "BaiShou_Root")
            if (!root.exists()) {
                root.mkdirs()
            }
            val test = File(root, ".write_test")
            test.writeText("test")
            test.delete()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun hasEffectiveExternalAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) return true
            if (hasAppOpsAllFilesAccess(context)) return true
        } else if (hasStandardStoragePermission(context)) {
            return true
        }
        if (StorageTreeAccess.hasPersistedTree(context)) return true
        // realme RMX2201 等：界面「存储空间」已开但 isExternalStorageManager 仍为 false
        return probeBaiShouRootWritable()
    }

    fun getState(context: Context): Map<String, Any> {
        return mapOf(
            "allFilesManager" to (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                    Environment.isExternalStorageManager()
                ),
            "appOpsAllFiles" to hasAppOpsAllFilesAccess(context),
            "standardStorage" to hasStandardStoragePermission(context),
            "probeWritable" to probeBaiShouRootWritable(),
            "safTree" to StorageTreeAccess.hasPersistedTree(context),
            "effectiveAccess" to hasEffectiveExternalAccess(context)
        )
    }
}
