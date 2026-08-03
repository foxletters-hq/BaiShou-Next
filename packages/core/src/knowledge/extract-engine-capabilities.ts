import type { ExtractEngineId } from './extract-engines/types'
import {
  getPdfPageBitmapRenderer,
  getVisionPageRecognizer,
  probeTesseractJs
} from './extract-engines/adapters'

export interface EngineCapabilitySlot {
  available: boolean
  reason?: string
  detail?: string
}

export interface ExtractEngineCapabilities {
  simple: EngineCapabilitySlot
  ocr: EngineCapabilitySlot
  vision: EngineCapabilitySlot
  /** 当前推荐引擎 */
  recommended: ExtractEngineId
}

export interface ResolveEngineResult {
  engine: ExtractEngineId
  degraded: boolean
  message?: string
}

export interface ProbeCapabilitiesOptions {
  /** 是否已配置可用的多模态对话模型 */
  visionModelConfigured?: boolean
  visionModelId?: string | null
  /** 用户偏好的 OCR 语言（仅作提示） */
  ocrLanguage?: string
}

/**
 * 运行时能力探测：不可用时调用方应降级并明确告知。
 */
export async function probeExtractEngineCapabilities(
  opts: ProbeCapabilitiesOptions = {}
): Promise<ExtractEngineCapabilities> {
  const simple: EngineCapabilitySlot = {
    available: true,
    detail: 'pdf-parse / 平台文本层抽取'
  }

  const tesseract = await probeTesseractJs()
  const hasRenderer = !!getPdfPageBitmapRenderer()
  let ocr: EngineCapabilitySlot
  if (!tesseract.ok) {
    ocr = { available: false, reason: tesseract.reason || 'tesseract.js 未安装' }
  } else if (!hasRenderer) {
    ocr = {
      available: false,
      reason: 'PDF 位图渲染器未就绪（需桌面 pdfjs-dist）'
    }
  } else {
    ocr = {
      available: true,
      detail: opts.ocrLanguage
        ? `语言偏好：${opts.ocrLanguage}（无语言包时自动降级 eng）`
        : '语言包缺失时将尝试 eng'
    }
  }

  const hasVisionFn = !!getVisionPageRecognizer()
  let vision: EngineCapabilitySlot
  if (!opts.visionModelConfigured) {
    vision = {
      available: false,
      reason: '未配置多模态（视觉）对话模型'
    }
  } else if (!hasRenderer) {
    vision = {
      available: false,
      reason: 'PDF 位图渲染器未就绪'
    }
  } else if (!hasVisionFn) {
    vision = {
      available: false,
      reason: '视觉识别器未注册'
    }
  } else {
    vision = {
      available: true,
      detail: opts.visionModelId ? `模型：${opts.visionModelId}` : undefined
    }
  }

  const recommended: ExtractEngineId = vision.available
    ? 'vision'
    : ocr.available
      ? 'ocr'
      : 'simple'

  return { simple, ocr, vision, recommended }
}

/**
 * 按用户请求解析实际引擎；不可用则降级到 simple 并返回说明。
 */
export function resolveExtractEngine(
  requested: ExtractEngineId,
  caps: ExtractEngineCapabilities
): ResolveEngineResult {
  if (requested === 'simple') {
    return { engine: 'simple', degraded: false }
  }
  if (requested === 'ocr') {
    if (caps.ocr.available) return { engine: 'ocr', degraded: false }
    return {
      engine: 'simple',
      degraded: true,
      message: `OCR 引擎不可用，已降级为 simple。原因：${caps.ocr.reason || '未知'}`
    }
  }
  if (requested === 'vision') {
    if (caps.vision.available) return { engine: 'vision', degraded: false }
    if (caps.ocr.available) {
      return {
        engine: 'ocr',
        degraded: true,
        message: `视觉引擎不可用，已降级为 ocr。原因：${caps.vision.reason || '未知'}`
      }
    }
    return {
      engine: 'simple',
      degraded: true,
      message: `视觉引擎不可用，已降级为 simple。原因：${caps.vision.reason || '未知'}`
    }
  }
  return { engine: 'simple', degraded: false }
}
