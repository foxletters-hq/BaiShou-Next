package expo.modules.baishouserver

/** 与 JS mobile-file-read-limits 一致：UTF-8 整文件读入上限，超出易在 256MB 堆设备 OOM */
object MobileExternalReadLimits {
    const val MAX_UTF8_READ_BYTES: Long = 16L * 1024L * 1024L

    fun assertReadableTextBytes(size: Long, pathForError: String) {
        if (size > MAX_UTF8_READ_BYTES) {
            throw java.io.IOException(
                "File too large to read into memory ($size bytes, limit $MAX_UTF8_READ_BYTES): $pathForError"
            )
        }
    }
}
