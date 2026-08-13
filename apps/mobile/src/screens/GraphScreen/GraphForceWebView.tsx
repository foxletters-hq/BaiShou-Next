import React, { useEffect, useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'

export interface GraphForceNode {
  id: string
  name: string
  nodeType: string
  mentionCount?: number
  reviewStatus?: string
}

export interface GraphForceEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
}

function topologyFingerprint(nodes: GraphForceNode[], edges: GraphForceEdge[]): string {
  const nids = nodes
    .map((n) => `${n.id}:${n.reviewStatus || ''}:${n.name}`)
    .slice()
    .sort()
    .join(',')
  const eids = edges
    .map((e) => `${e.id}:${e.reviewStatus || ''}:${e.edgeType || ''}`)
    .slice()
    .sort()
    .join(',')
  return `${nids}|${eids}`
}

function setToArray(ids?: Set<string> | null): string[] {
  if (!ids || ids.size === 0) return []
  return Array.from(ids)
}

function buildHtml(
  nodes: GraphForceNode[],
  edges: GraphForceEdge[],
  force: GraphForceSettings,
  appearance: GraphAppearanceSettings
): string {
  // Escape `<` so a node name cannot break out of the surrounding <script> tag.
  const payload = JSON.stringify({ nodes, edges, force, appearance }).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:#0f172a;overflow:hidden;font-family:system-ui,sans-serif;touch-action:none}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  #hint{position:absolute;left:10px;bottom:10px;color:#94a3b8;font-size:11px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hint">虚线=待确认 · 拖动/捏合缩放 · 点节点</div>
<script>
const DATA = ${payload};
const TYPE_COLORS = {
  person:'#3b82f6', place:'#22c55e', organization:'#a855f7', event:'#f59e0b',
  emotion:'#ec4899', topic:'#64748b', work:'#0ea5e9', activity:'#14b8a6',
  product:'#8b5cf6', food:'#f97316', entry:'#94a3b8'
};
const DRAG_THRESHOLD_PX = 5;
const LOCATE_TARGET_K = 1.85;
const CAMERA_FOLLOW_LERP = 0.2;
const CAMERA_CENTER_MS = 480;
const CAMERA_LOCATE_MS = 620;
const K_MIN = 0.35;
const K_MAX = 4;

function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = window.devicePixelRatio || 1;
let W = 0, H = 0;

let force = Object.assign({
  centerStrength: 0.08,
  linkStrength: 0.4,
  chargeStrength: -180,
  linkDistance: 70
}, DATA.force || {});

let appearance = Object.assign({
  showArrows: false,
  textOpacity: 1,
  nodeSize: 1,
  lineThickness: 1,
  hubLabelMinDegree: 3,
  hubLabelMinMentions: 5
}, DATA.appearance || {});

const rawNodes = (DATA.nodes||[]).filter(n=>n.reviewStatus!=='rejected');
const nodes = rawNodes.map((n)=>{
  const spread = Math.min(280, 80 + Math.sqrt(rawNodes.length) * 12)
  const angle = Math.random() * Math.PI * 2
  const rad = Math.sqrt(Math.random()) * spread
  return {
    ...n,
    // Random disk seed — avoids charge+center locking into concentric rings.
    x: Math.cos(angle) * rad + 200,
    y: Math.sin(angle) * rad + 200,
    vx: 0,
    vy: 0
  }
});
const idIndex = new Map(nodes.map((n,i)=>[n.id,i]));
const links = (DATA.edges||[])
  .filter(e=>e.reviewStatus!=='rejected' && idIndex.has(e.fromId)&&idIndex.has(e.toId))
  .map(e=>({...e, a:idIndex.get(e.fromId), b:idIndex.get(e.toId)}));

const degreeById = new Map();
for(const l of links){
  const a = nodes[l.a], b = nodes[l.b];
  if(!a||!b) continue;
  degreeById.set(a.id, (degreeById.get(a.id)||0)+1);
  degreeById.set(b.id, (degreeById.get(b.id)||0)+1);
}

let transform = {x:0,y:0,k:1};
let selectedId = null;
let focusIds = new Set();
let highlightIds = new Set();

let cameraAnim = false;
let followUntil = 0;
let pendingZoom = false;
let locateRaf = null;

let dragNode = null;
let pan = null;
let pinch = null;
let touchMoved = false;
let touchStartX = 0;
let touchStartY = 0;
let activeTouches = new Map();

function resize(){
  W = window.innerWidth; H = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

function cameraTargetForSelected(k){
  if(!selectedId) return null;
  const n = nodes.find(x=>x.id===selectedId);
  if(!n || n.x==null || n.y==null) return null;
  if(W<=0||H<=0) return null;
  return { x: W/2 - n.x*k, y: H/2 - n.y*k, k: k };
}

function easeCameraTowardSelected(opts){
  const k = (opts && opts.k != null) ? opts.k : transform.k;
  const target = cameraTargetForSelected(k);
  if(!target) return false;
  const alpha = (opts && opts.alpha != null) ? opts.alpha : 1;
  if(alpha >= 1){
    transform.x = target.x;
    transform.y = target.y;
    transform.k = target.k;
    return true;
  }
  transform.x += (target.x - transform.x) * alpha;
  transform.y += (target.y - transform.y) * alpha;
  transform.k += (target.k - transform.k) * alpha;
  return true;
}

function locateSelected(opts){
  const withZoom = !!(opts && opts.zoom);
  if(!selectedId){
    pendingZoom = false;
    followUntil = 0;
    cameraAnim = false;
    if(locateRaf != null){ cancelAnimationFrame(locateRaf); locateRaf = null; }
    return;
  }
  pendingZoom = withZoom;
  const from = { x: transform.x, y: transform.y, k: transform.k };
  const targetK = withZoom ? Math.max(from.k, LOCATE_TARGET_K) : from.k;
  const duration = withZoom ? CAMERA_LOCATE_MS : CAMERA_CENTER_MS;
  if(locateRaf != null){ cancelAnimationFrame(locateRaf); locateRaf = null; }
  if(withZoom){
    followUntil = Math.max(followUntil, performance.now() + 1400);
  }
  cameraAnim = true;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const ease = easeOutCubic(t);
    const k = from.k + (targetK - from.k) * ease;
    const desired = cameraTargetForSelected(k);
    if(!desired){
      locateRaf = requestAnimationFrame(step);
      return;
    }
    transform.x = from.x + (desired.x - from.x) * ease;
    transform.y = from.y + (desired.y - from.y) * ease;
    transform.k = k;
    if(t < 1){
      locateRaf = requestAnimationFrame(step);
      return;
    }
    locateRaf = null;
    cameraAnim = false;
    followUntil = Math.max(followUntil, performance.now() + 900);
  }
  locateRaf = requestAnimationFrame(step);
}

function step(){
  const n = nodes.length;
  const chargeMag = Math.abs(force.chargeStrength || 180);
  const linkK = (force.linkStrength == null ? 0.4 : force.linkStrength) * 0.05;
  const centerK = force.centerStrength == null ? 0.08 : force.centerStrength;
  const linkDist = force.linkDistance == null ? 70 : force.linkDistance;
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const a=nodes[i], b=nodes[j];
      let dx=a.x-b.x, dy=a.y-b.y;
      let dist2=dx*dx+dy*dy||1;
      let f=chargeMag*4.5/dist2;
      let dist=Math.sqrt(dist2);
      dx/=dist; dy/=dist;
      a.vx+=dx*f; a.vy+=dy*f;
      b.vx-=dx*f; b.vy-=dy*f;
    }
  }
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    let dx=b.x-a.x, dy=b.y-a.y;
    let dist=Math.sqrt(dx*dx+dy*dy)||1;
    let f=(dist-linkDist)*linkK;
    dx/=dist; dy/=dist;
    a.vx+=dx*f; a.vy+=dy*f;
    b.vx-=dx*f; b.vy-=dy*f;
  }
  const cx = W/2, cy = H/2;
  for(const nd of nodes){
    if(dragNode && nd.id===dragNode) continue;
    nd.vx += (cx - nd.x) * centerK * 0.15;
    nd.vy += (cy - nd.y) * centerK * 0.15;
    nd.vx*=0.85; nd.vy*=0.85;
    nd.x+=nd.vx; nd.y+=nd.vy;
  }
}

function drawArrowHead(x1,y1,x2,y2,size){
  const angle = Math.atan2(y2-y1, x2-x1);
  const t = 0.82;
  const ax = x1 + (x2-x1)*t;
  const ay = y1 + (y2-y1)*t;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - size*Math.cos(angle-0.4), ay - size*Math.sin(angle-0.4));
  ctx.lineTo(ax - size*Math.cos(angle+0.4), ay - size*Math.sin(angle+0.4));
  ctx.closePath();
  ctx.fill();
}

function draw(){
  if(!cameraAnim && followUntil > performance.now() && selectedId){
    easeCameraTowardSelected({
      k: pendingZoom ? Math.max(transform.k, LOCATE_TARGET_K) : undefined,
      alpha: CAMERA_FOLLOW_LERP
    });
  } else if(pendingZoom && followUntil <= performance.now()){
    pendingZoom = false;
  }

  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  const nodeScale = appearance.nodeSize == null ? 1 : appearance.nodeSize;
  const lineScale = appearance.lineThickness == null ? 1 : appearance.lineThickness;
  const textAlpha = appearance.textOpacity == null ? 1 : appearance.textOpacity;
  const focusing = !!(selectedId && focusIds.size > 0);
  const k = transform.k;

  ctx.lineWidth = (1 * lineScale) / k;
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    if(!a||!b) continue;
    const pending = l.reviewStatus==='pending';
    const inFocusEdge = !focusing || (focusIds.has(a.id) && focusIds.has(b.id));
    const dimEdge = focusing && !inFocusEdge;
    ctx.globalAlpha = dimEdge ? 0.1 : 1;
    ctx.strokeStyle = pending ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.45)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.setLineDash(pending ? [4/k, 4/k] : []);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    if(appearance.showArrows && !pending && !dimEdge){
      drawArrowHead(a.x,a.y,b.x,b.y, (6*lineScale)/k);
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for(const n of nodes){
    const r=(6+Math.min(10,(n.mentionCount||1)*1.2))*nodeScale;
    const pending = n.reviewStatus==='pending';
    const highlighted = highlightIds.has(n.id) || n.id===selectedId;
    const inFocus = !focusing || focusIds.has(n.id);
    const dim = focusing && !inFocus;
    const isHub =
      (degreeById.get(n.id)||0) > (appearance.hubLabelMinDegree||3) ||
      (n.mentionCount||0) >= (appearance.hubLabelMinMentions||5);

    ctx.globalAlpha = dim ? 0.1 : pending ? 0.45 : 1;
    ctx.beginPath();
    ctx.fillStyle=TYPE_COLORS[n.nodeType]||'#94a3b8';
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fill();

    if(pending && inFocus){
      ctx.setLineDash([3/k,3/k]);
      ctx.strokeStyle='rgba(226,232,240,0.6)';
      ctx.lineWidth=(1.5*lineScale)/k;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if(highlighted){
      ctx.strokeStyle='#e2e8f0';
      ctx.lineWidth=(2.5*lineScale)/k;
      ctx.stroke();
    }

    const showLabel =
      textAlpha > 0.01 &&
      !dim &&
      (n.id===selectedId || highlightIds.has(n.id) || (focusing && inFocus) || isHub);
    if(showLabel){
      ctx.globalAlpha = (pending ? 0.45 : 1) * textAlpha;
      ctx.fillStyle='#e2e8f0';
      ctx.font=(12/k)+'px system-ui';
      ctx.fillText(n.name.slice(0,16), n.x+r+3, n.y+4);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function loop(){ step(); draw(); requestAnimationFrame(loop); }
loop();

function worldPoint(clientX, clientY){
  return {
    x:(clientX-transform.x)/transform.k,
    y:(clientY-transform.y)/transform.k
  };
}
function hitNode(x,y){
  const nodeScale = appearance.nodeSize == null ? 1 : appearance.nodeSize;
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    const r=(8+Math.min(10,(n.mentionCount||1)*1.2))*nodeScale;
    const dx=n.x-x, dy=n.y-y;
    if(dx*dx+dy*dy<=r*r) return n;
  }
  return null;
}

function post(msg){
  if(window.ReactNativeWebView){
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
}

function syncActiveTouches(ev){
  activeTouches.clear();
  for(let i=0;i<ev.touches.length;i++){
    const t=ev.touches[i];
    activeTouches.set(t.identifier, {x:t.clientX, y:t.clientY});
  }
}

function pinchStateFromTouches(){
  if(activeTouches.size < 2) return null;
  const pts = Array.from(activeTouches.values());
  const a=pts[0], b=pts[1];
  const midX=(a.x+b.x)/2, midY=(a.y+b.y)/2;
  const dist=Math.hypot(a.x-b.x, a.y-b.y)||1;
  return { midX, midY, dist };
}

canvas.addEventListener('touchstart', (ev)=>{
  syncActiveTouches(ev);
  if(ev.touches.length >= 2){
    dragNode=null;
    pan=null;
    const ps = pinchStateFromTouches();
    if(ps){
      pinch = { dist: ps.dist, k: transform.k, midX: ps.midX, midY: ps.midY, tx: transform.x, ty: transform.y };
    }
    touchMoved = true;
    return;
  }
  pinch = null;
  const t=ev.touches[0]; if(!t) return;
  touchMoved = false;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  const p=worldPoint(t.clientX,t.clientY);
  const n=hitNode(p.x,p.y);
  if(n){
    dragNode=n.id;
    selectedId = n.id;
    post({type:'select', id:n.id, name:n.name, nodeType:n.nodeType, reviewStatus:n.reviewStatus||'approved'});
  } else {
    dragNode=null;
    pan={ x:t.clientX-transform.x, y:t.clientY-transform.y, startX:t.clientX, startY:t.clientY };
  }
},{passive:true});

canvas.addEventListener('touchmove', (ev)=>{
  syncActiveTouches(ev);
  if(ev.touches.length >= 2){
    dragNode=null;
    pan=null;
    const ps = pinchStateFromTouches();
    if(!ps) return;
    if(!pinch){
      pinch = { dist: ps.dist, k: transform.k, midX: ps.midX, midY: ps.midY, tx: transform.x, ty: transform.y };
      return;
    }
    touchMoved = true;
    const factor = ps.dist / (pinch.dist || 1);
    let k1 = pinch.k * factor;
    k1 = Math.min(K_MAX, Math.max(K_MIN, k1));
    const mx = ps.midX, my = ps.midY;
    // Zoom around current pinch midpoint
    const k0 = transform.k;
    if(k1 !== k0){
      transform.x = mx - ((mx - transform.x) * k1) / k0;
      transform.y = my - ((my - transform.y) * k1) / k0;
      transform.k = k1;
    } else {
      // Also allow two-finger pan via midpoint drift
      transform.x += mx - pinch.midX;
      transform.y += my - pinch.midY;
    }
    pinch.midX = mx;
    pinch.midY = my;
    pinch.dist = ps.dist;
    pinch.k = transform.k;
    return;
  }

  const t=ev.touches[0]; if(!t) return;
  const dist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
  if(dist >= DRAG_THRESHOLD_PX) touchMoved = true;

  if(dragNode){
    if(dist < DRAG_THRESHOLD_PX) return;
    const p=worldPoint(t.clientX,t.clientY);
    const n=nodes.find(x=>x.id===dragNode);
    if(n){ n.x=p.x; n.y=p.y; n.vx=0; n.vy=0; }
  } else if(pan){
    if(dist < DRAG_THRESHOLD_PX) return;
    transform.x=t.clientX-pan.x;
    transform.y=t.clientY-pan.y;
  }
},{passive:true});

canvas.addEventListener('touchend', (ev)=>{
  syncActiveTouches(ev);
  if(ev.touches.length >= 2){
    const ps = pinchStateFromTouches();
    if(ps){
      pinch = { dist: ps.dist, k: transform.k, midX: ps.midX, midY: ps.midY, tx: transform.x, ty: transform.y };
    }
    return;
  }
  if(ev.touches.length === 1){
    pinch = null;
    const t=ev.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    pan={ x:t.clientX-transform.x, y:t.clientY-transform.y, startX:t.clientX, startY:t.clientY };
    dragNode=null;
    return;
  }
  // All fingers up
  const wasPan = !!pan && !dragNode;
  const littleMove = !touchMoved;
  if(wasPan && littleMove){
    post({type:'clear'});
  }
  dragNode=null;
  pan=null;
  pinch=null;
},{passive:true});

canvas.addEventListener('touchcancel', ()=>{
  dragNode=null; pan=null; pinch=null; activeTouches.clear();
},{passive:true});

window.__setGraphForce = function(next){
  if(!next || typeof next !== 'object') return;
  force = Object.assign({}, force, next);
};

window.__setGraphAppearance = function(next){
  if(!next || typeof next !== 'object') return;
  appearance = Object.assign({}, appearance, next);
};

window.__setGraphSelection = function(next){
  if(!next || typeof next !== 'object') return;
  if('selectedId' in next){
    selectedId = next.selectedId == null ? null : String(next.selectedId);
  }
  if(Array.isArray(next.focusIds)){
    focusIds = new Set(next.focusIds.map(String));
  }
  if(Array.isArray(next.highlightIds)){
    highlightIds = new Set(next.highlightIds.map(String));
  }
};

window.__locateSelected = function(opts){
  locateSelected(opts || {});
};

window.__relayout = function(){
  const jitter = 48;
  for(const n of nodes){
    n.x += (Math.random()-0.5)*jitter*2;
    n.y += (Math.random()-0.5)*jitter*2;
    n.vx = (Math.random()-0.5)*12;
    n.vy = (Math.random()-0.5)*12;
  }
};
</script>
</body>
</html>`
}

function injectJson(webRef: React.RefObject<WebView | null>, expr: string, value: unknown) {
  const payload = JSON.stringify(value).replace(/</g, '\\u003c')
  webRef.current?.injectJavaScript(`${expr}(${payload}); true;`)
}

export const GraphForceWebView: React.FC<{
  nodes: GraphForceNode[]
  edges: GraphForceEdge[]
  forceSettings?: GraphForceSettings
  appearanceSettings?: GraphAppearanceSettings
  selectedId?: string | null
  focusIds?: Set<string> | null
  highlightIds?: Set<string> | null
  locateSeq?: number
  animationTick?: number
  onSelectNode?: (node: {
    id: string
    name: string
    nodeType: string
    reviewStatus?: string
  }) => void
  onClearSelection?: () => void
}> = ({
  nodes,
  edges,
  forceSettings = GRAPH_FORCE_DEFAULTS,
  appearanceSettings = GRAPH_APPEARANCE_DEFAULTS,
  selectedId = null,
  focusIds = null,
  highlightIds = null,
  locateSeq = 0,
  animationTick = 0,
  onSelectNode,
  onClearSelection
}) => {
  const fp = useMemo(() => topologyFingerprint(nodes, edges), [nodes, edges])
  const html = useMemo(
    () => buildHtml(nodes, edges, forceSettings, appearanceSettings),
    // Rebuild only when graph topology changes; live updates via inject below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fp]
  )

  const webRef = useRef<WebView>(null)
  const forceRef = useRef(forceSettings)
  const appearanceRef = useRef(appearanceSettings)
  const selectedIdRef = useRef(selectedId)
  const focusIdsRef = useRef(focusIds)
  const highlightIdsRef = useRef(highlightIds)
  const locateSeqRef = useRef(locateSeq)
  const animationTickRef = useRef(animationTick)
  const nodesRef = useRef(nodes)
  const onSelectRef = useRef(onSelectNode)
  const onClearRef = useRef(onClearSelection)
  const loadedRef = useRef(false)
  /** Skip first locateSeq/animationTick effect so initial load doesn't false-trigger. */
  const locateReadyRef = useRef(false)
  const animReadyRef = useRef(false)
  const prevSelectedIdRef = useRef(selectedId)

  forceRef.current = forceSettings
  appearanceRef.current = appearanceSettings
  selectedIdRef.current = selectedId
  focusIdsRef.current = focusIds
  highlightIdsRef.current = highlightIds
  nodesRef.current = nodes
  onSelectRef.current = onSelectNode
  onClearRef.current = onClearSelection

  const selectionPayload = () => ({
    selectedId: selectedIdRef.current ?? null,
    focusIds: setToArray(focusIdsRef.current),
    highlightIds: setToArray(highlightIdsRef.current)
  })

  const reinjectAll = (opts?: { locate?: boolean; locateZoom?: boolean }) => {
    injectJson(webRef, 'window.__setGraphForce && window.__setGraphForce', forceRef.current)
    injectJson(
      webRef,
      'window.__setGraphAppearance && window.__setGraphAppearance',
      appearanceRef.current
    )
    injectJson(
      webRef,
      'window.__setGraphSelection && window.__setGraphSelection',
      selectionPayload()
    )
    if (opts?.locate && selectedIdRef.current) {
      const zoom = opts.locateZoom !== false
      webRef.current?.injectJavaScript(
        `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom })}); true;`
      )
    }
  }

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__setGraphForce && window.__setGraphForce', forceSettings)
  }, [forceSettings])

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(
      webRef,
      'window.__setGraphAppearance && window.__setGraphAppearance',
      appearanceSettings
    )
  }, [appearanceSettings])

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__setGraphSelection && window.__setGraphSelection', {
      selectedId: selectedId ?? null,
      focusIds: setToArray(focusIds),
      highlightIds: setToArray(highlightIds)
    })
  }, [selectedId, focusIds, highlightIds])

  useEffect(() => {
    if (!loadedRef.current) {
      locateSeqRef.current = locateSeq
      prevSelectedIdRef.current = selectedId
      return
    }
    const locateBumped = locateSeq !== locateSeqRef.current
    locateSeqRef.current = locateSeq

    if (!locateReadyRef.current) {
      locateReadyRef.current = true
      prevSelectedIdRef.current = selectedId
      return
    }

    if (locateBumped) {
      if (selectedId) {
        webRef.current?.injectJavaScript(
          `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom: true })}); true;`
        )
      }
      prevSelectedIdRef.current = selectedId
      return
    }

    if (selectedId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedId
      if (selectedId) {
        webRef.current?.injectJavaScript(
          `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom: false })}); true;`
        )
      }
    }
  }, [selectedId, locateSeq])

  useEffect(() => {
    if (!loadedRef.current) {
      animationTickRef.current = animationTick
      return
    }
    if (!animReadyRef.current) {
      animReadyRef.current = true
      animationTickRef.current = animationTick
      return
    }
    if (animationTick === animationTickRef.current) return
    animationTickRef.current = animationTick
    if (animationTick <= 0) return
    webRef.current?.injectJavaScript(`window.__relayout && window.__relayout(); true;`)
  }, [animationTick])

  // Topology rebuild resets WebView — reinject after load.
  useEffect(() => {
    loadedRef.current = false
    locateReadyRef.current = false
    animReadyRef.current = false
  }, [fp])

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string
        id?: string
        name?: string
        nodeType?: string
        reviewStatus?: string
      }
      if (data.type === 'clear') {
        onClearRef.current?.()
        return
      }
      if (
        data.type === 'select' &&
        typeof data.id === 'string' &&
        typeof data.name === 'string' &&
        typeof data.nodeType === 'string' &&
        data.id.length > 0 &&
        data.id.length < 128 &&
        nodesRef.current.some((n) => n.id === data.id)
      ) {
        onSelectRef.current?.({
          id: data.id,
          name: data.name.slice(0, 200),
          nodeType: data.nodeType.slice(0, 64),
          reviewStatus: data.reviewStatus
        })
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['about:blank']}
        source={{ html }}
        onMessage={onMessage}
        onLoadEnd={() => {
          loadedRef.current = true
          const shouldLocate = Boolean(selectedIdRef.current) && locateSeqRef.current > 0
          reinjectAll({
            locate: shouldLocate || Boolean(selectedIdRef.current),
            locateZoom: shouldLocate
          })
          locateReadyRef.current = true
          animReadyRef.current = true
          prevSelectedIdRef.current = selectedIdRef.current
        }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 280 },
  web: { flex: 1, backgroundColor: '#0f172a' }
})
