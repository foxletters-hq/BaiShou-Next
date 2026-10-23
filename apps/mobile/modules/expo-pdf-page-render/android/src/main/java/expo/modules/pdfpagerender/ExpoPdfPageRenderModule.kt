package expo.modules.pdfpagerender

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max

private const val MIN_DPI = 72
private const val MAX_DPI = 200
private const val MAX_SIDE = 1600

/**
 * 用系统 PdfRenderer 把 PDF 页画成 PNG。
 * PdfRenderer 不是线程安全的，所有打开/渲染都走同一把锁。
 */
class ExpoPdfPageRenderModule : Module() {
  private val renderLock = Any()

  override fun definition() = ModuleDefinition {
    Name("ExpoPdfPageRender")

    Function("isAvailable") {
      true
    }

    AsyncFunction("getPageCount") { filePath: String, promise: Promise ->
      try {
        promise.resolve(withRenderer(filePath) { it.pageCount })
      } catch (e: Exception) {
        promise.reject("PDF_RENDER_ERROR", e.message, e)
      }
    }

    AsyncFunction("renderPages") { filePath: String, pageNumbers: List<Double>, dpi: Double, promise: Promise ->
      try {
        promise.resolve(renderPages(filePath, pageNumbers, dpi.toInt()))
      } catch (e: Exception) {
        promise.reject("PDF_RENDER_ERROR", e.message, e)
      }
    }
  }

  private fun renderPages(
    filePath: String,
    pageNumbers: List<Double>,
    dpi: Int
  ): List<Map<String, Any>> {
    return withRenderer(filePath) { renderer ->
      val total = renderer.pageCount
      val requested = pageNumbers.map { it.toInt() }.filter { it >= 1 }
      val targets =
        if (requested.isEmpty()) {
          (1..total).toList()
        } else {
          requested.filter { it in 1..total }
        }
      val clampedDpi = dpi.coerceIn(MIN_DPI, MAX_DPI)
      targets.map { pageNum ->
        renderer.openPage(pageNum - 1).use { page ->
          encodePage(page, pageNum, clampedDpi)
        }
      }
    }
  }

  private fun encodePage(page: PdfRenderer.Page, pageNum: Int, dpi: Int): Map<String, Any> {
    val (width, height) = bitmapSize(page.width, page.height, dpi)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    try {
      bitmap.eraseColor(Color.WHITE)
      val canvas = Canvas(bitmap)
      canvas.drawColor(Color.WHITE)
      page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      return mapOf(
        "page" to pageNum,
        "pngBase64" to Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP),
        "width" to width,
        "height" to height
      )
    } finally {
      bitmap.recycle()
    }
  }

  private fun bitmapSize(pageWidthPt: Int, pageHeightPt: Int, dpi: Int): Pair<Int, Int> {
    val scale = dpi / 72f
    var width = (pageWidthPt * scale).toInt().coerceAtLeast(1)
    var height = (pageHeightPt * scale).toInt().coerceAtLeast(1)
    val longest = max(width, height)
    if (longest > MAX_SIDE) {
      val shrink = MAX_SIDE.toFloat() / longest
      width = (width * shrink).toInt().coerceAtLeast(1)
      height = (height * shrink).toInt().coerceAtLeast(1)
    }
    return width to height
  }

  private fun <T> withRenderer(filePath: String, block: (PdfRenderer) -> T): T {
    synchronized(renderLock) {
      openFileDescriptor(filePath).use { fd ->
        PdfRenderer(fd).use { renderer ->
          return block(renderer)
        }
      }
    }
  }

  private fun openFileDescriptor(filePath: String): ParcelFileDescriptor {
    val context = requireNotNull(appContext.reactContext) { "React context is null" }
    return when {
      filePath.startsWith("content://") -> {
        context.contentResolver.openFileDescriptor(Uri.parse(filePath), "r")
          ?: throw IllegalArgumentException("无法打开 PDF：$filePath")
      }
      filePath.startsWith("file://") -> {
        ParcelFileDescriptor.open(
          File(filePath.removePrefix("file://")),
          ParcelFileDescriptor.MODE_READ_ONLY
        )
      }
      else -> {
        ParcelFileDescriptor.open(File(filePath), ParcelFileDescriptor.MODE_READ_ONLY)
      }
    }
  }
}
