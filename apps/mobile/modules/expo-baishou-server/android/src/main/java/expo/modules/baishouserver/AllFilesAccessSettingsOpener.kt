package expo.modules.baishouserver

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * 按厂商尝试打开「所有文件访问」或应用权限页。
 * Android 11+ 无系统运行时弹窗，各 ROM（小米/华为/OPPO/realme 等）设置页入口不同。
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
            manufacturer.contains("oppo") ||
                manufacturer.contains("realme") ||
                manufacturer.contains("oneplus") ->
                "oppo"
            manufacturer.contains("vivo") -> "vivo"
            manufacturer.contains("samsung") -> "samsung"
            else -> "generic"
        }
    }

    private fun isColorOsFamily(manufacturer: String): Boolean {
        return manufacturer.contains("oppo") ||
            manufacturer.contains("realme") ||
            manufacturer.contains("oneplus")
    }

    private fun buildIntentChain(context: Context, packageName: String): List<Intent> {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val intents = mutableListOf<Intent>()

        // realme / ColorOS：优先跳转应用权限页（「存储 → 允许管理所有文件」），
        // 全局「所有文件访问」列表在部分机型上开关会呈灰色。
        if (isColorOsFamily(manufacturer)) {
            addColorOsPermissionIntents(intents, packageName)
        }

        // 标准 Android 11+（须从 Activity 启动；realme 上 Application Context 可能无效）
        intents.add(
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                addCategory(Intent.CATEGORY_DEFAULT)
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        intents.add(
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                addCategory(Intent.CATEGORY_DEFAULT)
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

    /**
     * ColorOS / realme UI / OxygenOS 权限页。
     * PermissionSinglePageActivity 在多数 realme 机型上比 PermissionAppAllPermissionActivity 更可靠。
     */
    private fun addColorOsPermissionIntents(intents: MutableList<Intent>, packageName: String) {
        val components = listOf(
            "com.coloros.safecenter" to
                "com.coloros.safecenter.permission.singlepage.PermissionSinglePageActivity",
            "com.oplus.safecenter" to
                "com.oplus.safecenter.permission.singlepage.PermissionSinglePageActivity",
            "com.heytap.safecenter" to
                "com.heytap.safecenter.permission.singlepage.PermissionSinglePageActivity",
            "com.color.safecenter" to
                "com.color.safecenter.permission.PermissionManagerActivity",
            "com.coloros.safecenter" to
                "com.coloros.safecenter.permission.PermissionManagerActivity",
            "com.oplus.safecenter" to
                "com.oplus.safecenter.permission.PermissionManagerActivity",
            "com.coloros.safecenter" to
                "com.coloros.safecenter.permission.PermissionAppAllPermissionActivity",
            "com.oplus.safecenter" to
                "com.oplus.safecenter.permission.PermissionAppAllPermissionActivity"
        )

        for ((pkg, cls) in components) {
            intents.add(
                Intent().apply {
                    component = ComponentName(pkg, cls)
                    putExtra("extra_pkgname", packageName)
                    putExtra("packageName", packageName)
                    putExtra("pkg_name", packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        }

        // realme / ColorOS「设置单项权限」→ 管理所有文件（RMX2201 等机型）
        val singlePageTargets = listOf(
            "com.coloros.safecenter" to
                "com.coloros.safecenter.permission.singlepage.PermissionSinglePageActivity",
            "com.oplus.safecenter" to
                "com.oplus.safecenter.permission.singlepage.PermissionSinglePageActivity"
        )
        for ((pkg, cls) in singlePageTargets) {
            intents.add(
                Intent().apply {
                    component = ComponentName(pkg, cls)
                    putExtra("extra_pkgname", packageName)
                    putExtra("packageName", packageName)
                    putExtra("permissionType", "android.permission.MANAGE_EXTERNAL_STORAGE")
                    putExtra(
                        "permission_types",
                        arrayOf("android.permission.MANAGE_EXTERNAL_STORAGE")
                    )
                    putExtra("request_type", "special_permission")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        }

        intents.add(
            Intent().apply {
                component = ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.privacypermissionsentry.PermissionTopActivity"
                )
                putExtra("packageName", packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }

    /**
     * 部分国产 ROM（含 realme）对 resolveActivity 返回 null，但 startActivity 仍可成功。
     * 因此优先直接 startActivity，失败再尝试下一个 Intent。
     */
    private fun tryStart(context: Context, intent: Intent): Boolean {
        if (intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK == 0) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }
}
