package expo.modules.baishouserver

import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okio.Buffer
import okio.BufferedSink
import okio.ForwardingSink
import okio.buffer
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/** 从磁盘路径流式 HTTP 上传，避免整文件进 JS 堆或沙盒中转 */
object HttpFileTransfer {
  private val client = OkHttpClient.Builder()
    .connectTimeout(60, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.MINUTES)
    .writeTimeout(15, TimeUnit.MINUTES)
    .build()

  private val activeCalls = ConcurrentHashMap<String, Call>()
  private val pathLocks = ConcurrentHashMap<String, Any>()

  private fun uploadKey(filePath: String): String =
    ExternalStorageFiles.uriToPath(filePath.removePrefix("file://"))
      .replace('\\', '/')
      .trimEnd('/')

  fun cancelUpload(filePath: String?) {
    if (filePath.isNullOrBlank()) {
      cancelAllUploads()
      return
    }
    activeCalls.remove(uploadKey(filePath))?.cancel()
  }

  fun cancelAllUploads() {
    activeCalls.values.forEach { it.cancel() }
    activeCalls.clear()
  }

  /** @deprecated 使用 cancelUpload(null) 取消全部 */
  fun cancelActiveUpload() {
    cancelAllUploads()
  }

  fun uploadFile(
    url: String,
    filePath: String,
    method: String,
    headers: Map<String, String>,
    onProgress: ((writtenBytes: Long, totalBytes: Long) -> Unit)? = null
  ): Int {
    val normalized = uploadKey(filePath)
    val file = File(normalized)
    if (!file.isFile) {
      throw FileNotFoundException(filePath)
    }
    val pathLock = pathLocks.computeIfAbsent(normalized) { Any() }
    synchronized(pathLock) {
      val rawBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
      val throttledProgress =
        if (onProgress != null) {
          ThrottledProgressReporter(250L, onProgress)
        } else {
          null
        }
      val body =
        if (throttledProgress != null) {
          ProgressRequestBody(rawBody) { written, total ->
            throttledProgress.report(written, total)
          }
        } else {
          rawBody
        }
      val builder = Request.Builder().url(url).method(method.uppercase(), body)
      headers.forEach { (key, value) -> builder.header(key, value) }
      val call = client.newCall(builder.build())
      activeCalls[normalized] = call
      try {
        call.execute().use { response ->
          if (!response.isSuccessful && call.isCanceled()) {
            throw IOException("HTTP upload canceled")
          }
          return response.code
        }
      } finally {
        activeCalls.remove(normalized, call)
        if (!activeCalls.containsKey(normalized)) {
          pathLocks.remove(normalized)
        }
      }
    }
  }

  private class ThrottledProgressReporter(
    private val minIntervalMs: Long,
    private val listener: (writtenBytes: Long, totalBytes: Long) -> Unit
  ) {
    @Volatile
    private var lastAt = 0L

    @Volatile
    private var lastWritten = -1L

    @Synchronized
    fun report(written: Long, total: Long) {
      val now = System.currentTimeMillis()
      val done = total > 0 && written >= total
      if (!done && written <= lastWritten) return
      if (!done && now - lastAt < minIntervalMs) return
      lastAt = now
      lastWritten = written
      listener(written, total)
    }
  }

  private class ProgressRequestBody(
    private val delegate: RequestBody,
    private val listener: (writtenBytes: Long, totalBytes: Long) -> Unit
  ) : RequestBody() {
    override fun contentType() = delegate.contentType()

    override fun contentLength() = delegate.contentLength()

    override fun writeTo(sink: BufferedSink) {
      val total = contentLength()
      val progressSink = object : ForwardingSink(sink) {
        var bytesWritten = 0L

        override fun write(source: Buffer, byteCount: Long) {
          super.write(source, byteCount)
          bytesWritten += byteCount
          listener(bytesWritten, total)
        }
      }.buffer()
      delegate.writeTo(progressSink)
      progressSink.flush()
    }
  }
}
