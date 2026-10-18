import ExpoModulesCore
import PDFKit
import UIKit

private let minDpi = 72
private let maxDpi = 200
private let maxSide: CGFloat = 1600

public class ExpoPdfPageRenderModule: Module {
  private let renderLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("ExpoPdfPageRender")

    Function("isAvailable") { () -> Bool in
      true
    }

    AsyncFunction("getPageCount") { (filePath: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let count = try self.withDocument(filePath: filePath) { $0.pageCount }
          promise.resolve(count)
        } catch {
          promise.reject("PDF_RENDER_ERROR", error.localizedDescription)
        }
      }
    }

    AsyncFunction("renderPages") { (filePath: String, pageNumbers: [Double], dpi: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let pages = try self.renderPages(filePath: filePath, pageNumbers: pageNumbers, dpi: Int(dpi))
          promise.resolve(pages)
        } catch {
          promise.reject("PDF_RENDER_ERROR", error.localizedDescription)
        }
      }
    }
  }

  private func renderPages(
    filePath: String,
    pageNumbers: [Double],
    dpi: Int
  ) throws -> [[String: Any]] {
    try withDocument(filePath: filePath) { document in
      let total = document.pageCount
      let targets: [Int]
      if requested.isEmpty {
        targets = total > 0 ? Array(1...total) : []
      } else {
        targets = requested.filter { $0 >= 1 && $0 <= total }
      }
      let clampedDpi = min(maxDpi, max(minDpi, dpi))
      return targets.compactMap { pageNum in
        encodePage(document: document, pageNum: pageNum, dpi: clampedDpi)
      }
    }
  }

  private func encodePage(document: PDFDocument, pageNum: Int, dpi: Int) -> [String: Any]? {
    guard let page = document.page(at: pageNum - 1) else { return nil }
    let bounds = page.bounds(for: .mediaBox)
    let scale = CGFloat(dpi) / 72.0
    var width = max(1, bounds.width * scale)
    var height = max(1, bounds.height * scale)
    let longest = max(width, height)
    if longest > maxSide {
      let shrink = maxSide / longest
      width = max(1, width * shrink)
      height = max(1, height * shrink)
    }
    let size = CGSize(width: width, height: height)
    let renderer = UIGraphicsImageRenderer(size: size)
    let image = renderer.image { ctx in
      UIColor.white.setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
      ctx.cgContext.saveGState()
      ctx.cgContext.translateBy(x: 0, y: height)
      ctx.cgContext.scaleBy(x: width / max(bounds.width, 1), y: -(height / max(bounds.height, 1)))
      page.draw(with: .mediaBox, to: ctx.cgContext)
      ctx.cgContext.restoreGState()
    }
    guard let data = image.pngData() else { return nil }
    return [
      "page": pageNum,
      "pngBase64": data.base64EncodedString(),
      "width": Int(width.rounded()),
      "height": Int(height.rounded())
    ]
  }

  private func withDocument<T>(filePath: String, block: (PDFDocument) throws -> T) throws -> T {
    renderLock.lock()
    defer { renderLock.unlock() }
    let url = try fileURL(from: filePath)
    guard let document = PDFDocument(url: url) else {
      throw NSError(
        domain: "ExpoPdfPageRender",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "无法打开 PDF：\(filePath)"]
      )
    }
    return try block(document)
  }

  private func fileURL(from filePath: String) throws -> URL {
    if filePath.hasPrefix("file://") {
      guard let url = URL(string: filePath) else {
        throw NSError(
          domain: "ExpoPdfPageRender",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "PDF 路径无效"]
        )
      }
      return url
    }
    return URL(fileURLWithPath: filePath)
  }
}
