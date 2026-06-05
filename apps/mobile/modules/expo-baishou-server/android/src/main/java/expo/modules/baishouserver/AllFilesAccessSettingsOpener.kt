package expo.modules.baishouserver

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * 按厂商尝试打开「所有文件访问」或应用权限页。
 * Android 11+ 无系统运行时弹窗，各 ROM（小米/华为/OPPO 等）设置页入口不同。
 */
object AllFilesAccessSettingsOpener {
    fun open(context: Context, packageName: String): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            for (intent in buildIntentChain(context, packageName)) {
                if (tryStart(context, intent)) return true
            }
            return false
        }

        return tryStart(
            context,
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    fun getManufacturerKey(): String {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> "xiaomi"
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> "huawei"
            manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus") ->
                "oppo"
            manufacturer.contains("vivo") -> "vivo"
            manufacturer.contains("samsung") -> "samsung"
            else -> "generic"
        }
    }

    private fun buildIntentChain(context: Context, packageName: String): List<Intent> {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val intents = mutableListOf<Intent>()

        // 标准 Android 11+（多数 ROM 含 MIUI 会打开带开关的专用页）
        intents.add(
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )

        when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> {
                intents.add(
                    Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                        setClassName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.permissions.PermissionsEditorActivity"
                        )
                        putExtra("extra_pkgname", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
                intents.add(
                    Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                        setClassName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.permissions.AppPermissionsEditorActivity"
                        )
                        putExtra("extra_pkgname", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> {
                intents.add(
                    Intent().apply {
                        setClassName(
                            "com.huawei.systemmanager",
                            "com.huawei.permissionmanager.ui.MainActivity"
                        )
                        putExtra("packageName", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus") -> {
                intents.add(
                    Intent().apply {
                        setClassName(
                            "com.coloros.safecenter",
                            "com.coloros.safecenter.permission.PermissionAppAllPermissionActivity"
                        )
                        putExtra("packageName", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
                intents.add(
                    Intent().apply {
                        setClassName(
                            "com.oplus.safecenter",
                            "com.oplus.safecenter.permission.PermissionAppAllPermissionActivity"
                        )
                        putExtra("packageName", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            manufacturer.contains("vivo") -> {
                intents.add(
                    Intent().apply {
                        setClassName(
                            "com.vivo.permissionmanager",
                            "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"
                        )
                        putExtra("packagename", packageName)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
        }

        intents.add(
            Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        intents.add(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )

        return intents
    }

    private fun tryStart(context: Context, intent: Intent): Boolean {
        return try {
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }
}
