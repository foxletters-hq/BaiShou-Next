/**
 * 供应商品牌图标（RN：SVG 经 Metro 编译为 React 组件，直接打进 JS 包，无需运行时读文件）
 */

import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import OpenaiIcon from '../assets/ai_provider_icon/openai.svg'
import GeminiColorIcon from '../assets/ai_provider_icon/gemini-color.svg'
import GeminiMonoIcon from '../assets/ai_provider_icon/gemini.svg'
import AnthropicIcon from '../assets/ai_provider_icon/anthropic.svg'
import DeepseekColorIcon from '../assets/ai_provider_icon/deepseek-color.svg'
import DeepseekMonoIcon from '../assets/ai_provider_icon/deepseek.svg'
import KimiColorIcon from '../assets/ai_provider_icon/kimi.svg'
import KimiMonoIcon from '../assets/ai_provider_icon/kimi.svg'
import OllamaIcon from '../assets/ai_provider_icon/ollama.svg'
import DashscopeColorIcon from '../assets/ai_provider_icon/dashscope-color.svg'
import DashscopeMonoIcon from '../assets/ai_provider_icon/dashscope.svg'
import SiliconflowColorIcon from '../assets/ai_provider_icon/siliconflow-color.svg'
import SiliconflowMonoIcon from '../assets/ai_provider_icon/siliconflow.svg'
import OpenrouterIcon from '../assets/ai_provider_icon/openrouter.svg'
import DoubaoColorIcon from '../assets/ai_provider_icon/doubao-color.svg'
import DoubaoMonoIcon from '../assets/ai_provider_icon/doubao.svg'
import GrokIcon from '../assets/ai_provider_icon/grok.svg'
import MistralColorIcon from '../assets/ai_provider_icon/mistral-color.svg'
import MistralMonoIcon from '../assets/ai_provider_icon/mistral.svg'
import LmstudioIcon from '../assets/ai_provider_icon/lmstudio.svg'
import XiaomimimoIcon from '../assets/ai_provider_icon/xiaomimimo.svg'
import ZhipuColorIcon from '../assets/ai_provider_icon/zhipu-color.svg'
import StepfunColorIcon from '../assets/ai_provider_icon/stepfun-color.svg'
import VolcengineColorIcon from '../assets/ai_provider_icon/volcengine-color.svg'
import HunyuanColorIcon from '../assets/ai_provider_icon/hunyuan-color.svg'
import VertexaiColorIcon from '../assets/ai_provider_icon/vertexai-color.svg'
import VercelIcon from '../assets/ai_provider_icon/vercel.svg'
import MinimaxColorIcon from '../assets/ai_provider_icon/minimax-color.svg'

export type ProviderIconComponent = ComponentType<SvgProps>

interface IconPair {
  light: ProviderIconComponent
  dark: ProviderIconComponent
}

const PROVIDER_ICONS: Record<string, IconPair> = {
  openai: { light: OpenaiIcon, dark: OpenaiIcon },
  gemini: { light: GeminiColorIcon, dark: GeminiMonoIcon },
  anthropic: { light: AnthropicIcon, dark: AnthropicIcon },
  deepseek: { light: DeepseekColorIcon, dark: DeepseekMonoIcon },
  kimi: { light: KimiColorIcon, dark: KimiMonoIcon },
  ollama: { light: OllamaIcon, dark: OllamaIcon },
  siliconflow: { light: SiliconflowColorIcon, dark: SiliconflowMonoIcon },
  openrouter: { light: OpenrouterIcon, dark: OpenrouterIcon },
  dashscope: { light: DashscopeColorIcon, dark: DashscopeMonoIcon },
  doubao: { light: DoubaoColorIcon, dark: DoubaoMonoIcon },
  grok: { light: GrokIcon, dark: GrokIcon },
  mistral: { light: MistralColorIcon, dark: MistralMonoIcon },
  lmstudio: { light: LmstudioIcon, dark: LmstudioIcon },
  xiaomimimo: { light: XiaomimimoIcon, dark: XiaomimimoIcon },
  zhipu: { light: ZhipuColorIcon, dark: ZhipuColorIcon },
  stepfun: { light: StepfunColorIcon, dark: StepfunColorIcon },
  volcengine: { light: VolcengineColorIcon, dark: VolcengineColorIcon },
  hunyuan: { light: HunyuanColorIcon, dark: HunyuanColorIcon },
  vertexai: { light: VertexaiColorIcon, dark: VertexaiColorIcon },
  vercel: { light: VercelIcon, dark: VercelIcon },
  minimax: { light: MinimaxColorIcon, dark: MinimaxColorIcon }
}

export function getProviderIconComponent(
  providerId: string,
  isDark: boolean
): ProviderIconComponent | undefined {
  const pair = PROVIDER_ICONS[providerId]
  if (!pair) return undefined
  return isDark ? pair.dark : pair.light
}

export function hasProviderIcon(providerId: string): boolean {
  return providerId in PROVIDER_ICONS
}

/** 兼容旧调用方，图标已随 JS 包编译，无需预加载 */
export function preloadAllProviderIcons(): void {}
