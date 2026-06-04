/**
 * 供应商品牌图标（与 packages/ui/src/utils/provider-icons.ts 同源 SVG）
 * Metro 将 .svg 作为静态资源；由 ProviderBrandIcon 经 expo-asset + SvgUri 渲染。
 */

import openaiIcon from '../../../../packages/ui/src/assets/ai_provider_icon/openai.svg'
import geminiColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/gemini-color.svg'
import geminiMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/gemini.svg'
import anthropicIcon from '../../../../packages/ui/src/assets/ai_provider_icon/anthropic.svg'
import deepseekColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/deepseek-color.svg'
import deepseekMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/deepseek.svg'
import kimiColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/kimi.svg'
import kimiMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/kimi.svg'
import ollamaIcon from '../../../../packages/ui/src/assets/ai_provider_icon/ollama.svg'
import dashscopeColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/dashscope-color.svg'
import dashscopeMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/dashscope.svg'
import siliconflowColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/siliconflow-color.svg'
import siliconflowMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/siliconflow.svg'
import openrouterIcon from '../../../../packages/ui/src/assets/ai_provider_icon/openrouter.svg'
import doubaoColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/doubao-color.svg'
import doubaoMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/doubao.svg'
import grokIcon from '../../../../packages/ui/src/assets/ai_provider_icon/grok.svg'
import mistralColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/mistral-color.svg'
import mistralMonoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/mistral.svg'
import lmstudioIcon from '../../../../packages/ui/src/assets/ai_provider_icon/lmstudio.svg'
import xiaomimimoIcon from '../../../../packages/ui/src/assets/ai_provider_icon/xiaomimimo.svg'
import zhipuColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/zhipu-color.svg'
import stepfunColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/stepfun-color.svg'
import volcengineColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/volcengine-color.svg'
import hunyuanColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/hunyuan-color.svg'
import vertexaiColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/vertexai-color.svg'
import vercelIcon from '../../../../packages/ui/src/assets/ai_provider_icon/vercel.svg'
import minimaxColorIcon from '../../../../packages/ui/src/assets/ai_provider_icon/minimax-color.svg'

export type ProviderIconModule = number

interface IconPair {
  light: ProviderIconModule
  dark: ProviderIconModule
}

const PROVIDER_ICONS: Record<string, IconPair> = {
  openai: { light: openaiIcon, dark: openaiIcon },
  gemini: { light: geminiColorIcon, dark: geminiMonoIcon },
  anthropic: { light: anthropicIcon, dark: anthropicIcon },
  deepseek: { light: deepseekColorIcon, dark: deepseekMonoIcon },
  kimi: { light: kimiColorIcon, dark: kimiMonoIcon },
  ollama: { light: ollamaIcon, dark: ollamaIcon },
  siliconflow: { light: siliconflowColorIcon, dark: siliconflowMonoIcon },
  openrouter: { light: openrouterIcon, dark: openrouterIcon },
  dashscope: { light: dashscopeColorIcon, dark: dashscopeMonoIcon },
  doubao: { light: doubaoColorIcon, dark: doubaoMonoIcon },
  grok: { light: grokIcon, dark: grokIcon },
  mistral: { light: mistralColorIcon, dark: mistralMonoIcon },
  lmstudio: { light: lmstudioIcon, dark: lmstudioIcon },
  xiaomimimo: { light: xiaomimimoIcon, dark: xiaomimimoIcon },
  zhipu: { light: zhipuColorIcon, dark: zhipuColorIcon },
  stepfun: { light: stepfunColorIcon, dark: stepfunColorIcon },
  volcengine: { light: volcengineColorIcon, dark: volcengineColorIcon },
  hunyuan: { light: hunyuanColorIcon, dark: hunyuanColorIcon },
  vertexai: { light: vertexaiColorIcon, dark: vertexaiColorIcon },
  vercel: { light: vercelIcon, dark: vercelIcon },
  minimax: { light: minimaxColorIcon, dark: minimaxColorIcon }
}

export function getProviderIconModule(
  providerId: string,
  isDark: boolean
): ProviderIconModule | undefined {
  const pair = PROVIDER_ICONS[providerId]
  if (!pair) return undefined
  return isDark ? pair.dark : pair.light
}

export function getProviderIconIds(): string[] {
  return Object.keys(PROVIDER_ICONS)
}

export function hasProviderIcon(providerId: string): boolean {
  return providerId in PROVIDER_ICONS
}
