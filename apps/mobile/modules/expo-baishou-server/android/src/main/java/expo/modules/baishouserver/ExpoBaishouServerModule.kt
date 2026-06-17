package expo.modules.baishouserver

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import expo.modules.kotlin.Promise
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.io.FileOutputStream
import java.util.HashMap
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

private const val MCP_INFO_JSON =
    "{\"name\":\"BaiShou MCP Server\",\"version\":\"1.0.0\",\"protocolVersion\":\"2024-11-05\",\"description\":\"BaiShou AI Companion Diary - MCP Interface\"}"

/** 局域网备份可能较大，默认 5s 读超时会导致传输中断 */
private const val LAN_SOCKET_READ_TIMEOUT_MS = 10 * 60 * 1000

private data class PendingMcpRequest(
    val latch: CountDownLatch,
    val response: AtomicReference<String>
)

class BaishouHttpServer(
    port: Int,
    private val context: Context,
    private val authToken: String?,
    private val emitEvent: (String, Map<String, Any>) -> Unit,
    private val dispatchMcpRequest: (String, String?) -> String
) : NanoHTTPD(port) {

    private fun isAuthorized(session: IHTTPSession): Boolean {
        val token = authToken?.trim().orEmpty()
        if (token.isEmpty()) return true
        val auth = session.headers["authorization"] ?: return false
        return auth == "Bearer $token"
    }

    private fun unauthorizedResponse(): Response {
        return corsResponse(
            Response.Status.UNAUTHORIZED,
            "application/json",
            "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32001,\"message\":\"Unauthorized: invalid or missing MCP auth token\"},\"id\":null}"
        )
    }

    private fun corsResponse(status: Response.Status, mimeType: String, body: String): Response {
        val response = newFixedLengthResponse(status, mimeType, body)
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        response.addHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, mcp-session-id"
        )
        return response
    }

    private fun readRequestBody(session: IHTTPSession): String {
        val files = HashMap<String, String>()
        session.parseBody(files)
        val postDataPath = files["postData"]
        if (postDataPath != null) {
            return File(postDataPath).readText()
        }
        val contentLength = session.headers["content-length"]?.toIntOrNull() ?: 0
        if (contentLength <= 0) return ""
        val buffer = ByteArray(contentLength.coerceAtMost(10 * 1024 * 1024))
        val read = session.inputStream.read(buffer)
        return if (read > 0) String(buffer, 0, read) else ""
    }

    private fun handleMcp(session: IHTTPSession): Response {
        if (session.method == Method.OPTIONS) {
            return corsResponse(Response.Status.OK, MIME_PLAINTEXT, "")
        }

        if (!isAuthorized(session)) {
            return unauthorizedResponse()
        }

        if (session.method == Method.GET) {
            return corsResponse(Response.Status.OK, "application/json", MCP_INFO_JSON)
        }

        if (session.method == Method.POST) {
            return try {
                val body = readRequestBody(session)
                val authorization = session.headers["authorization"]
                val responseBody = dispatchMcpRequest(body, authorization)
                corsResponse(Response.Status.OK, "application/json", responseBody)
            } catch (e: Exception) {
                e.printStackTrace()
                corsResponse(
                    Response.Status.INTERNAL_ERROR,
                    "application/json",
                    "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32603,\"message\":\"${e.message ?: "Internal Error"}\"}}"
                )
            }
        }

        return corsResponse(Response.Status.METHOD_NOT_ALLOWED, MIME_PLAINTEXT, "Method Not Allowed")
    }

    /**
     * 按 Content-Length 读取请求体。若读到 EOF 才停，在 keep-alive 连接上会一直阻塞，
     * 导致发送方已显示 100% 却永远等不到 HTTP 200。
     */
    private fun streamRequestBodyToFile(session: IHTTPSession, destFile: File): Long {
        val contentLength = session.headers["content-length"]?.toLongOrNull()
        var totalWritten = 0L
        session.inputStream.use { input ->
            FileOutputStream(destFile).use { output ->
                val buffer = ByteArray(64 * 1024)
                var remaining = contentLength
                while (remaining == null || remaining > 0L) {
                    val toRead = when {
                        remaining == null -> buffer.size
                        remaining > buffer.size -> buffer.size
                        else -> remaining.toInt()
                    }
                    val read = input.read(buffer, 0, toRead)
                    if (read <= 0) break
                    output.write(buffer, 0, read)
                    totalWritten += read
                    if (remaining != null) remaining -= read
                }
            }
        }
        return totalWritten
    }

    override fun serve(session: IHTTPSession): Response {
        if (session.uri == "/mcp" || session.uri == "/mcp/") {
            return handleMcp(session)
        }

        if (session.method == Method.GET && session.uri == "/info") {
            return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}")
        }

        if (session.method == Method.POST && session.uri == "/upload") {
            try {
                val destFile = File(
                    context.cacheDir,
                    "lan_sync_payload_${System.currentTimeMillis()}.zip"
                )
                val bytesWritten = streamRequestBodyToFile(session, destFile)

                if (bytesWritten <= 0L) {
                    return newFixedLengthResponse(
                        Response.Status.BAD_REQUEST,
                        "application/json",
                        "{\"error\":\"No file content\"}"
                    )
                }

                emitEvent("onFileReceived", mapOf("path" to destFile.absolutePath))
                return newFixedLengthResponse(
                    Response.Status.OK,
                    "application/json",
                    "{\"success\":true}"
                )
            } catch (e: Exception) {
                e.printStackTrace()
                return newFixedLengthResponse(
                    Response.Status.INTERNAL_ERROR,
                    MIME_PLAINTEXT,
                    e.message ?: "Internal Error"
                )
            }
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Endpoint Not Found")
    }
}

private const val OPEN_DIRECTORY_TREE_CODE = 8842

class ExpoBaishouServerModule : Module() {
    private var server: BaishouHttpServer? = null
    private val pendingMcpRequests = ConcurrentHashMap<String, PendingMcpRequest>()
    private var pendingDirectoryPromise: Promise? = null

    private fun dispatchMcpRequestToJs(body: String, authorization: String?): String {
        val requestId = UUID.randomUUID().toString()
        val latch = CountDownLatch(1)
        val responseRef = AtomicReference("")
        pendingMcpRequests[requestId] = PendingMcpRequest(latch, responseRef)

        val payload = mutableMapOf(
            "requestId" to requestId,
            "body" to body
        )
        if (!authorization.isNullOrBlank()) {
            payload["authorization"] = authorization
        }

        sendEvent("onMcpHttpRequest", payload)

        val completed = latch.await(25, TimeUnit.SECONDS)
        pendingMcpRequests.remove(requestId)

        if (!completed) {
            return "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32603,\"message\":\"MCP request timed out after 25s\"}}"
        }

        return responseRef.get()
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoBaishouServer")

        Events("onFileReceived", "onMcpHttpRequest")

        Function("resolveMcpHttpResponse") { requestId: String, responseBody: String ->
            val pending = pendingMcpRequests[requestId] ?: return@Function false
            pending.response.set(responseBody)
            pending.latch.countDown()
            true
        }

        Function("startServer") { port: Int, authToken: String? ->
            if (server != null) {
                server?.stop()
                server = null
            }
            try {
                val context = appContext.reactContext ?: throw Exception("React context is null")
                server = BaishouHttpServer(
                    port,
                    context,
                    authToken,
                    { evt, payload -> this@ExpoBaishouServerModule.sendEvent(evt, payload) },
                    { body, authorization -> dispatchMcpRequestToJs(body, authorization) }
                )
                server?.start(LAN_SOCKET_READ_TIMEOUT_MS, false)
                return@Function server?.listeningPort ?: port
            } catch (e: Exception) {
                e.printStackTrace()
                return@Function -1
            }
        }

        Function("stopServer") {
            server?.stop()
            server = null
            pendingMcpRequests.values.forEach { pending ->
                pending.response.set("")
                pending.latch.countDown()
            }
            pendingMcpRequests.clear()
        }

        /** Android 11+ 全文件访问；较低版本检查 WRITE_EXTERNAL_STORAGE */
        Function("hasAllFilesAccess") {
            val context = appContext.reactContext ?: return@Function false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Environment.isExternalStorageManager()
            } else {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
            }
        }

        /** 打开系统「允许管理所有文件」或应用权限页（按厂商尝试多个 Intent） */
        Function("openAllFilesAccessSettings") {
            val context = appContext.currentActivity ?: appContext.reactContext ?: return@Function false
            AllFilesAccessSettingsOpener.open(context, context.packageName)
        }

        /** 设备厂商 key，供 JS 展示 ROM 专属引导文案（xiaomi / huawei / oppo / vivo / samsung / generic） */
        Function("getStoragePermissionOemKey") {
            AllFilesAccessSettingsOpener.getManufacturerKey()
        }

        /** 使用 java.io.File 探测外部 BaiShou_Root 可写（绕过 expo-file-system 的 Scoped Storage 限制） */
        Function("probeExternalStorageWritable") {
            val context = appContext.reactContext ?: return@Function false
            ExternalStorageFiles.probeWritable(context)
        }

        Function("externalGetInfo") { path: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.getInfo(context, path)
        }

        Function("externalMakeDirectory") { path: String, intermediates: Boolean ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.makeDirectory(context, path, intermediates)
        }

        Function("externalWriteString") { path: String, content: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.writeString(context, path, content)
        }

        Function("externalWriteBase64") { path: String, base64: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.writeBase64(context, path, base64)
        }

        Function("externalReadString") { path: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.readString(context, path)
        }

        Function("externalReadBase64") { path: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.readBase64(context, path)
        }

        Function("externalDelete") { path: String, idempotent: Boolean ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.deletePath(context, path, idempotent)
        }

        Function("externalReadDirectory") { path: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.readDirectory(context, path)
        }

        Function("externalMove") { fromPath: String, toPath: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.movePath(context, fromPath, toPath)
        }

        Function("externalCopy") { fromPath: String, toPath: String ->
            val context = appContext.reactContext ?: throw Exception("React context is null")
            ExternalStorageFiles.copyPath(context, fromPath, toPath)
        }

        /** 在后台线程复制，避免大目录迁移阻塞 RN 主线程导致闪退 */
        AsyncFunction("externalCopyAsync") { fromPath: String, toPath: String, promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("E_NO_CONTEXT", "React context is null", null)
                return@AsyncFunction
            }
            Thread {
                try {
                    ExternalStorageFiles.copyPath(context, fromPath, toPath)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("E_EXTERNAL_COPY", e.message ?: "external copy failed", e)
                }
            }.start()
        }

        /** 外部存储 ↔ 沙盒等任意路径间流式复制（后台线程） */
        AsyncFunction("externalCopyFileAsync") { fromPath: String, toPath: String, promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("E_NO_CONTEXT", "React context is null", null)
                return@AsyncFunction
            }
            Thread {
                try {
                    ExternalStorageFiles.copyFileAny(context, fromPath, toPath)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("E_EXTERNAL_COPY_FILE", e.message ?: "external copy file failed", e)
                }
            }.start()
        }

        Function("getLegacyFlutterStorageRoots") {
            val context = appContext.reactContext ?: return@Function emptyList<String>()
            LegacyProductionBridge.collectLegacyStorageRoots(context)
        }

        Function("readLegacyFlutterSharedPreferencesXml") {
            val context = appContext.reactContext ?: return@Function null
            LegacyProductionBridge.readFlutterSharedPreferencesXml(context)
        }

        Function("getLegacyFlutterAvatarsDirectory") {
            val context = appContext.reactContext ?: return@Function null
            LegacyProductionBridge.getLegacyAvatarsDirectory(context)
        }

        Function("mirrorProductionLegacyToExternal") {
            val context = appContext.reactContext ?: return@Function mapOf(
                "mirrored" to false,
                "reason" to "no_context"
            )
            LegacyProductionBridge.mirrorProductionLegacyToExternal(context)
        }

        /** 调起系统目录选择器（ACTION_OPEN_DOCUMENT_TREE） */
        AsyncFunction("pickDirectoryAsync") { promise: Promise ->
            if (pendingDirectoryPromise != null) {
                promise.reject("E_DIRECTORY_PICKER_IN_PROGRESS", "Directory picker is already open", null)
                return@AsyncFunction
            }
            pendingDirectoryPromise = promise
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
            }
            appContext.throwingActivity.startActivityForResult(intent, OPEN_DIRECTORY_TREE_CODE)
        }

        OnActivityDestroys {
            pendingDirectoryPromise?.let { promise ->
                pendingDirectoryPromise = null
                promise.resolve(mapOf("canceled" to true))
            }
        }

        OnActivityResult { _, (requestCode, resultCode, intent) ->
            if (requestCode != OPEN_DIRECTORY_TREE_CODE || pendingDirectoryPromise == null) {
                return@OnActivityResult
            }

            val promise = pendingDirectoryPromise!!
            pendingDirectoryPromise = null

            if (resultCode != Activity.RESULT_OK || intent?.data == null) {
                promise.resolve(mapOf("canceled" to true))
                return@OnActivityResult
            }

            val context = appContext.reactContext
            if (context == null) {
                promise.reject("E_NO_CONTEXT", "React context is null", null)
                return@OnActivityResult
            }

            val treeUri = intent.data!!
            val flags = intent.flags and (
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
            try {
                context.contentResolver.takePersistableUriPermission(treeUri, flags)
            } catch (_: Exception) {
                // 部分 ROM 可能不支持持久化，仍可尝试解析路径
            }

            val path = DirectoryTreeUri.resolvePath(context, treeUri)
            if (path.isNullOrBlank()) {
                promise.reject(
                    "E_DIRECTORY_PATH",
                    "Unable to resolve filesystem path from selected directory",
                    null
                )
                return@OnActivityResult
            }

            promise.resolve(
                mapOf(
                    "canceled" to false,
                    "path" to path,
                    "uri" to treeUri.toString()
                )
            )
        }
    }
}
