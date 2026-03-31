package expo.modules.baishouserver

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.util.HashMap
import android.content.Context

class BaishouHttpServer(
    port: Int,
    private val context: Context,
    private val emitEvent: (String, Map<String, Any>) -> Unit
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        if (session.method == Method.GET && session.uri == "/info") {
            return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}")
        }
        
        if (session.method == Method.POST && session.uri == "/upload") {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                
                var targetTempPath: String? = null
                
                // NanoHTTPD places uploaded files in files map. If the client sends via multipart form,
                // the key is the form field name. If sent via raw POST body, the key is "postData".
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
                
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"error\":\"No file content\"}")
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

    override fun definition() = ModuleDefinition {
        Name("ExpoBaishouServer")

        Events("onFileReceived")

        Function("startServer") { port: Int ->
            if (server != null) {
                server?.stop()
                server = null
            }
            try {
                val context = appContext.reactContext ?: throw Exception("React context is null")
                server = BaishouHttpServer(port, context) { evt, payload ->
                    this@ExpoBaishouServerModule.sendEvent(evt, payload)
                }
                // use start with timeout
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
        }
    }
}
