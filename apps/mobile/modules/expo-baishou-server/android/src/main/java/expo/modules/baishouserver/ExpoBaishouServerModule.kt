package expo.modules.baishouserver

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.util.HashMap
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

private const val MCP_INFO_JSON =
    "{\"name\":\"BaiShou MCP Server\",\"version\":\"1.0.0\",\"protocolVersion\":\"2024-11-05\",\"description\":\"BaiShou AI Companion Diary - MCP Interface\"}"

private data class PendingMcpRequest(
    val latch: CountDownLatch,
    val response: AtomicReference<String>
)

class BaishouHttpServer(
    port: Int,
    private val context: Context,
    private val emitEvent: (String, Map<String, Any>) -> Unit,
    private val dispatchMcpRequest: (String) -> String
) : NanoHTTPD(port) {

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

        if (session.method == Method.GET) {
            return corsResponse(Response.Status.OK, "application/json", MCP_INFO_JSON)
        }

        if (session.method == Method.POST) {
            return try {
                val body = readRequestBody(session)
                val responseBody = dispatchMcpRequest(body)
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

    override fun serve(session: IHTTPSession): Response {
        if (session.uri == "/mcp" || session.uri == "/mcp/") {
            return handleMcp(session)
        }

        if (session.method == Method.GET && session.uri == "/info") {
            return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}")
        }

        if (session.method == Method.POST && session.uri == "/upload") {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)

                var targetTempPath: String? = null

                val postDataPath = files["postData"]
                if (postDataPath != null) {
                    targetTempPath = postDataPath
                } else if (files.isNotEmpty()) {
                    targetTempPath = files[files.keys.first()]
                }

                if (targetTempPath != null) {
                    val tempFile = File(targetTempPath)
                    val outDir = context.cacheDir
                    val destFile = File(outDir, "lan_sync_payload_${System.currentTimeMillis()}.zip")

                    tempFile.copyTo(destFile, overwrite = true)

                    emitEvent("onFileReceived", mapOf("path" to destFile.absolutePath))
                    return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"success\":true}")
                }

                return newFixedLengthResponse(
                    Response.Status.BAD_REQUEST,
                    "application/json",
                    "{\"error\":\"No file content\"}"
                )
            } catch (e: Exception) {
                e.printStackTrace()
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.message ?: "Internal Error")
            }
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Endpoint Not Found")
    }
}

class ExpoBaishouServerModule : Module() {
    private var server: BaishouHttpServer? = null
    private val pendingMcpRequests = ConcurrentHashMap<String, PendingMcpRequest>()

    private fun dispatchMcpRequestToJs(body: String): String {
        val requestId = UUID.randomUUID().toString()
        val latch = CountDownLatch(1)
        val responseRef = AtomicReference("")
        pendingMcpRequests[requestId] = PendingMcpRequest(latch, responseRef)

        sendEvent(
            "onMcpHttpRequest",
            mapOf(
                "requestId" to requestId,
                "body" to body
            )
        )

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

        Function("startServer") { port: Int ->
            if (server != null) {
                server?.stop()
                server = null
            }
            try {
                val context = appContext.reactContext ?: throw Exception("React context is null")
                server = BaishouHttpServer(
                    port,
                    context,
                    { evt, payload -> this@ExpoBaishouServerModule.sendEvent(evt, payload) },
                    { body -> dispatchMcpRequestToJs(body) }
                )
                server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
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
    }
}
