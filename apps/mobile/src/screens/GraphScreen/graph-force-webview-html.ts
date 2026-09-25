import {
  GRAPH_CANVAS_THEME,
  GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE,
  GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_FORCE_ISOLATED_CENTER_SCALE,
  GRAPH_FORCE_ISOLATED_CHARGE_SCALE,
  GRAPH_FORCE_ISOLATED_SEED,
  GRAPH_FORCE_MIXED_CHARGE_SCALE,
  GRAPH_FORCE_VELOCITY_DECAY,
  GRAPH_NODE_TYPE_COLORS,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { GRAPH_FORCE_RUNTIME_CAMERA } from './graph-force-webview-runtime-camera'
import { GRAPH_FORCE_RUNTIME_DRAW } from './graph-force-webview-runtime-draw'
import { GRAPH_FORCE_RUNTIME_INPUT } from './graph-force-webview-runtime-input'
import { GRAPH_FORCE_RUNTIME_SETUP } from './graph-force-webview-runtime-setup'
import type { GraphForceEdge, GraphForceNode } from './graph-force-webview.types'

export function buildGraphForceHtml(
  nodes: GraphForceNode[],
  edges: GraphForceEdge[],
  force: GraphForceSettings,
  appearance: GraphAppearanceSettings,
  scheme: 'light' | 'dark'
): string {
  const theme = GRAPH_CANVAS_THEME[scheme]
  // Escape `<` so a node name cannot break out of the surrounding <script> tag.
  const payload = JSON.stringify({ nodes, edges, force, appearance, theme }).replace(
    /</g,
    '\\u003c'
  )
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:${theme.background};overflow:hidden;font-family:system-ui,sans-serif;touch-action:none}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  #hint{position:absolute;left:10px;bottom:10px;color:${theme.hint};font-size:11px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hint">虚线=待确认 · 拖动/捏合缩放 · 点节点</div>
<script>
const DATA = ${payload};
const TYPE_COLORS = ${JSON.stringify(GRAPH_NODE_TYPE_COLORS)};
const FORCE_DEFAULTS = ${JSON.stringify(GRAPH_FORCE_DEFAULTS)};
const ISOLATED_CHARGE_SCALE = ${GRAPH_FORCE_ISOLATED_CHARGE_SCALE};
const MIXED_CHARGE_SCALE = ${GRAPH_FORCE_MIXED_CHARGE_SCALE};
const ISOLATED_CENTER_SCALE = ${GRAPH_FORCE_ISOLATED_CENTER_SCALE};
const VELOCITY_DECAY = ${GRAPH_FORCE_VELOCITY_DECAY};
const ISOLATED_SEED = ${JSON.stringify(GRAPH_FORCE_ISOLATED_SEED)};
const CHARGE_DISTANCE_MAX_MIN = ${GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN};
const CHARGE_DISTANCE_MAX_LINK_SCALE = ${GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE};
const DRAG_THRESHOLD_PX = 5;
const LOCATE_TARGET_K = 1.85;
const CAMERA_FOLLOW_LERP = 0.2;
const CAMERA_CENTER_MS = 480;
const CAMERA_LOCATE_MS = 620;
const K_MIN = 0.35;
const K_MAX = 4;
${GRAPH_FORCE_RUNTIME_SETUP}
${GRAPH_FORCE_RUNTIME_CAMERA}
${GRAPH_FORCE_RUNTIME_DRAW}
${GRAPH_FORCE_RUNTIME_INPUT}
</script>
</body>
</html>`
}
