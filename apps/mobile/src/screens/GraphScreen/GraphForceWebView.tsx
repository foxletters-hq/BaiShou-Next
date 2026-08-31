import React, { useEffect, useMemo, useRef } from 'react'
import { useColorScheme, View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_CANVAS_THEME,
  GRAPH_FORCE_DEFAULTS,
  GRAPH_NODE_TYPE_COLORS,
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
    .map((n) => n.id)
    .slice()
    .sort()
    .join(',')
  const eids = edges
    .map((e) => e.id)
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
  appearance: GraphAppearanceSettings,
  scheme: 'light' | 'dark'
): string {
  const theme = GRAPH_CANVAS_THEME[scheme]
  // Escape `<` so a node name cannot break out of the surrounding <script> tag.
  const payload = JSON.stringify({ nodes, edges, force, appearance, theme }).replace(/</g, '\\u003c')
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

let force = Object.assign({}, FORCE_DEFAULTS, DATA.force || {});

let appearance = Object.assign({
  showArrows: false,
  textOpacity: 1,
  nodeSize: 1,
  lineThickness: 1,
  hubLabelMinDegree: 3,
  hubLabelMinMentions: 5
}, DATA.appearance || {});

let theme = Object.assign({
  background: '#0f172a',
  label: '#e2e8f0',
  hint: '#94a3b8',
    edge: 'rgba(148,163,184,0.45)',
    edgePending: 'rgba(148,163,184,0.22)',
    edgeHighlight: '#5BA8F5',
    highlight: '#e2e8f0'
  }, DATA.theme || {});

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
let highlightEdgeIds = new Set();
let locateIds = [];

let cameraAnim = false;
let followUntil = 0;
let pendingZoom = false;
let locateRaf = null;
let interacting = false;

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

function cameraFitIds(){
  if(locateIds && locateIds.length) return locateIds;
  if(selectedId) return [selectedId];
  return [];
}

function cameraTargetForIds(ids, k){
  if(!ids || !ids.length) return null;
  const pts = [];
  for(const id of ids){
    const n = nodes.find(x=>x.id===id);
    if(n && n.x!=null && n.y!=null) pts.push({x:n.x,y:n.y});
  }
  if(!pts.length || W<=0 || H<=0) return null;
  if(pts.length===1){
    return { x: W/2 - pts[0].x*k, y: H/2 - pts[0].y*k, k: k };
  }
  let minX=pts[0].x, maxX=minX, minY=pts[0].y, maxY=minY;
  for(let i=1;i<pts.length;i++){
    const p=pts[i];
    if(p.x<minX) minX=p.x; if(p.x>maxX) maxX=p.x;
    if(p.y<minY) minY=p.y; if(p.y>maxY) maxY=p.y;
  }
  const pad=80;
  const bw=Math.max(maxX-minX,8)+pad*2;
  const bh=Math.max(maxY-minY,8)+pad*2;
  const fitK=Math.min(k, Math.max(0.45, Math.min(W/bw, H/bh)));
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  return { x: W/2 - cx*fitK, y: H/2 - cy*fitK, k: fitK };
}

function easeCameraTowardSelected(opts){
  const ids = cameraFitIds();
  const k = (opts && opts.k != null) ? opts.k : transform.k;
  const target = cameraTargetForIds(ids, k);
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
  if(interacting) return;
  const ids = cameraFitIds();
  const withZoom = !!(opts && opts.zoom);
  if(!ids.length){
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
    if(interacting){
      locateRaf = null;
      cameraAnim = false;
      return;
    }
    const t = Math.min(1, (now - start) / duration);
    const ease = easeOutCubic(t);
    const desired = cameraTargetForIds(ids, targetK);
    if(!desired){
      locateRaf = requestAnimationFrame(step);
      return;
    }
    transform.x = from.x + (desired.x - from.x) * ease;
    transform.y = from.y + (desired.y - from.y) * ease;
    transform.k = from.k + (desired.k - from.k) * ease;
    requestDraw();
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
  const k = transform.k || 1;
  const cx = (W/2 - transform.x) / k;
  const cy = (H/2 - transform.y) / k;
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

function stopCameraFollow(){
  cameraAnim = false;
  followUntil = 0;
  pendingZoom = false;
  if(locateRaf != null){ cancelAnimationFrame(locateRaf); locateRaf = null; }
}

function draw(){
  if(!interacting && !dragNode && !cameraAnim && followUntil > performance.now() && cameraFitIds().length){
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
    const edgeHi = highlightEdgeIds.has(l.id);
    const inFocusEdge = !focusing || edgeHi || (focusIds.has(a.id) && focusIds.has(b.id));
    if(focusing && !inFocusEdge) continue;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = edgeHi ? (theme.edgeHighlight || '#5BA8F5') : (pending ? theme.edgePending : theme.edge);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = ((edgeHi ? 2.6 : 1) * lineScale) / k;
    ctx.setLineDash(pending ? [4/k, 4/k] : []);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    if(appearance.showArrows && !pending){
      drawArrowHead(a.x,a.y,b.x,b.y, (6*lineScale)/k);
    }
  }
  ctx.setLineDash([]);
  ctx.lineWidth = (1 * lineScale) / k;
  ctx.globalAlpha = 1;

  for(const n of nodes){
    const r=(6+Math.min(10,(n.mentionCount||1)*1.2))*nodeScale;
    const pending = n.reviewStatus==='pending';
    const highlighted = highlightIds.has(n.id) || n.id===selectedId;
    const inFocus = !focusing || focusIds.has(n.id);
    const dim = focusing && !inFocus;
    const isHub =
      (degreeById.get(n.id)||0) >= (appearance.hubLabelMinDegree||3) ||
      (n.mentionCount||0) >= (appearance.hubLabelMinMentions||5);

    ctx.globalAlpha = dim ? 0.1 : (pending && !highlighted) ? 0.45 : 1;
    ctx.beginPath();
    ctx.fillStyle=TYPE_COLORS[n.nodeType]||'#94a3b8';
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fill();

    if(highlighted){
      ctx.setLineDash(pending ? [3/k,3/k] : []);
      ctx.strokeStyle=theme.highlight;
      ctx.lineWidth=(2.5*lineScale)/k;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if(pending && inFocus){
      ctx.setLineDash([3/k,3/k]);
      ctx.strokeStyle=theme.highlight;
      ctx.lineWidth=(1.5*lineScale)/k;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const showLabel =
      textAlpha > 0.01 &&
      !dim &&
      (n.id===selectedId || highlightIds.has(n.id) || (focusing && inFocus) || isHub);
    if(showLabel){
      ctx.globalAlpha = (pending ? 0.45 : 1) * textAlpha;
      ctx.fillStyle=theme.label;
      ctx.font=(12/k)+'px system-ui';
      ctx.fillText(n.name.slice(0,16), n.x+r+3, n.y+4);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

let simRunning = true;
let rafId = null;
function kinetic(){
  let e = 0;
  for(const n of nodes) e += (n.vx||0)*(n.vx||0) + (n.vy||0)*(n.vy||0);
  return e;
}
function loop(){
  rafId = requestAnimationFrame(loop);
  const following = cameraAnim || followUntil > performance.now();
  if(simRunning){
    step();
    if(!dragNode && kinetic() < 0.08) simRunning = false;
  }
  draw();
  if(!simRunning && !following){
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
function wakeSim(){
  simRunning = true;
  if(rafId == null) loop();
}
function requestDraw(){
  if(rafId == null) draw();
}
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
  interacting = true;
  stopCameraFollow();
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
    stopCameraFollow();
    const p=worldPoint(t.clientX,t.clientY);
    const n=nodes.find(x=>x.id===dragNode);
    if(n){ n.x=p.x; n.y=p.y; n.vx=0; n.vy=0; wakeSim(); }
  } else if(pan){
    if(dist < DRAG_THRESHOLD_PX) return;
    stopCameraFollow();
    transform.x=t.clientX-pan.x;
    transform.y=t.clientY-pan.y;
    requestDraw();
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
  const tappedNode = dragNode && !touchMoved;
  const littleMove = !touchMoved;
  interacting = false;
  if(tappedNode){
    const n=nodes.find(x=>x.id===dragNode);
    if(n){
      selectedId = n.id;
      post({type:'select', id:n.id, name:n.name, nodeType:n.nodeType, reviewStatus:n.reviewStatus||'approved'});
      locateSelected({zoom:false});
    }
  } else if(wasPan && littleMove){
    post({type:'clear'});
  }
  dragNode=null;
  pan=null;
  pinch=null;
},{passive:true});

canvas.addEventListener('touchcancel', ()=>{
  interacting=false;
  dragNode=null; pan=null; pinch=null; activeTouches.clear();
},{passive:true});

window.__setGraphForce = function(next){
  if(!next || typeof next !== 'object') return;
  force = Object.assign({}, force, next);
  wakeSim();
};

window.__setGraphAppearance = function(next){
  if(!next || typeof next !== 'object') return;
  appearance = Object.assign({}, appearance, next);
  requestDraw();
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
  if(Array.isArray(next.highlightEdgeIds)){
    highlightEdgeIds = new Set(next.highlightEdgeIds.map(String));
  }
  if(Array.isArray(next.locateIds)){
    locateIds = next.locateIds.map(String);
  }
  requestDraw();
};

window.__patchGraphMeta = function(payload){
  if(!payload || typeof payload !== 'object') return;
  const byId = new Map((payload.nodes||[]).map(function(n){ return [n.id, n]; }));
  for(const n of nodes){
    const fresh = byId.get(n.id);
    if(!fresh) continue;
    n.name = fresh.name;
    n.nodeType = fresh.nodeType;
    n.mentionCount = fresh.mentionCount;
    n.reviewStatus = fresh.reviewStatus;
  }
  const linkMeta = new Map((payload.edges||[]).map(function(e){ return [e.id, e]; }));
  for(const l of links){
    const fresh = linkMeta.get(l.id);
    if(!fresh) continue;
    l.reviewStatus = fresh.reviewStatus;
    l.edgeType = fresh.edgeType;
  }
  requestDraw();
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
  wakeSim();
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
  highlightEdgeIds?: Set<string> | null
  locateIds?: string[] | null
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
  highlightEdgeIds = null,
  locateIds = null,
  locateSeq = 0,
  animationTick = 0,
  onSelectNode,
  onClearSelection
}) => {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark'
  const canvasBg = GRAPH_CANVAS_THEME[colorScheme].background
  const fp = useMemo(() => topologyFingerprint(nodes, edges), [nodes, edges])
  const html = useMemo(
    () => buildHtml(nodes, edges, forceSettings, appearanceSettings, colorScheme),
    // Rebuild only when graph topology or appearance scheme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fp, colorScheme]
  )

  const webRef = useRef<WebView>(null)
  const forceRef = useRef(forceSettings)
  const appearanceRef = useRef(appearanceSettings)
  const selectedIdRef = useRef(selectedId)
  const focusIdsRef = useRef(focusIds)
  const highlightIdsRef = useRef(highlightIds)
  const highlightEdgeIdsRef = useRef(highlightEdgeIds)
  const locateIdsRef = useRef(locateIds)
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
  highlightEdgeIdsRef.current = highlightEdgeIds
  locateIdsRef.current = locateIds
  nodesRef.current = nodes
  onSelectRef.current = onSelectNode
  onClearRef.current = onClearSelection

  const selectionPayload = () => ({
    selectedId: selectedIdRef.current ?? null,
    focusIds: setToArray(focusIdsRef.current),
    highlightIds: setToArray(highlightIdsRef.current),
    highlightEdgeIds: setToArray(highlightEdgeIdsRef.current),
    locateIds: locateIdsRef.current ?? []
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
    if (opts?.locate && (selectedIdRef.current || (locateIdsRef.current?.length ?? 0) > 0)) {
      const zoom = opts.locateZoom !== false
      webRef.current?.injectJavaScript(
        `window.__locateSelected && window.__locateSelected(${JSON.stringify({ zoom })}); true;`
      )
    }
  }

  useEffect(() => {
    if (!loadedRef.current) return
    injectJson(webRef, 'window.__patchGraphMeta && window.__patchGraphMeta', { nodes, edges })
  }, [nodes, edges])

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
      highlightIds: setToArray(highlightIds),
      highlightEdgeIds: setToArray(highlightEdgeIds),
      locateIds: locateIds ?? []
    })
  }, [selectedId, focusIds, highlightIds, highlightEdgeIds, locateIds])

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
      if (selectedId || (locateIds && locateIds.length > 0)) {
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
  }, [selectedId, locateSeq, locateIds])

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
          const hasLocateTarget =
            Boolean(selectedIdRef.current) || (locateIdsRef.current?.length ?? 0) > 0
          const shouldLocate = hasLocateTarget && locateSeqRef.current > 0
          reinjectAll({
            locate: hasLocateTarget,
            locateZoom: shouldLocate
          })
          locateReadyRef.current = true
          animReadyRef.current = true
          prevSelectedIdRef.current = selectedIdRef.current
        }}
        style={[styles.web, { backgroundColor: canvasBg }]}
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
  web: { flex: 1 }
})
