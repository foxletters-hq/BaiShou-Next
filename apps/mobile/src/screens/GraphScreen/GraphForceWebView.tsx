import React, { useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export interface GraphForceNode {
  id: string
  name: string
  nodeType: string
  mentionCount?: number
}

export interface GraphForceEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
}

function buildHtml(nodes: GraphForceNode[], edges: GraphForceEdge[]): string {
  const payload = JSON.stringify({ nodes, edges })
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:#0f172a;overflow:hidden;font-family:system-ui,sans-serif}
  canvas{display:block;width:100%;height:100%}
  #hint{position:absolute;left:10px;bottom:10px;color:#94a3b8;font-size:11px;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="hint">拖动画布 · 点节点查看</div>
<script>
const DATA = ${payload};
const TYPE_COLORS = {
  person:'#3b82f6', place:'#22c55e', organization:'#a855f7', event:'#f59e0b',
  emotion:'#ec4899', topic:'#64748b', work:'#0ea5e9', activity:'#14b8a6',
  product:'#8b5cf6', food:'#f97316', entry:'#94a3b8'
};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = window.devicePixelRatio || 1;
let W = 0, H = 0;
const nodes = DATA.nodes.map((n,i)=>({
  ...n,
  x: Math.cos(i)*120 + 200,
  y: Math.sin(i)*120 + 200,
  vx:0, vy:0
}));
const idIndex = new Map(nodes.map((n,i)=>[n.id,i]));
const links = DATA.edges
  .filter(e=>idIndex.has(e.fromId)&&idIndex.has(e.toId))
  .map(e=>({...e, a:idIndex.get(e.fromId), b:idIndex.get(e.toId)}));
let transform = {x:0,y:0,k:1};
let pan = null;
let dragNode = null;

function resize(){
  W = window.innerWidth; H = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

function step(){
  const n = nodes.length;
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const a=nodes[i], b=nodes[j];
      let dx=a.x-b.x, dy=a.y-b.y;
      let dist2=dx*dx+dy*dy||1;
      let f=800/dist2;
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
    let f=(dist-70)*0.02;
    dx/=dist; dy/=dist;
    a.vx+=dx*f; a.vy+=dy*f;
    b.vx-=dx*f; b.vy-=dy*f;
  }
  for(const n of nodes){
    if(dragNode && n.id===dragNode) continue;
    n.vx*=0.85; n.vy*=0.85;
    n.x+=n.vx; n.y+=n.vy;
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
  ctx.strokeStyle='rgba(148,163,184,0.35)';
  ctx.lineWidth=1/transform.k;
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for(const n of nodes){
    const r=8+Math.min(10,(n.mentionCount||1)*1.2);
    ctx.beginPath();
    ctx.fillStyle=TYPE_COLORS[n.nodeType]||'#94a3b8';
    ctx.arc(n.x,n.y,r,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#e2e8f0';
    ctx.font='11px system-ui';
    ctx.fillText(n.name.slice(0,16), n.x+r+3, n.y+4);
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
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    const r=10+Math.min(10,(n.mentionCount||1)*1.2);
    const dx=n.x-x, dy=n.y-y;
    if(dx*dx+dy*dy<=r*r) return n;
  }
  return null;
}

canvas.addEventListener('touchstart', (ev)=>{
  const t=ev.touches[0]; if(!t) return;
  const p=worldPoint(t.clientX,t.clientY);
  const n=hitNode(p.x,p.y);
  if(n){
    dragNode=n.id;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'select', id:n.id, name:n.name, nodeType:n.nodeType}));
  } else {
    pan={x:t.clientX-transform.x, y:t.clientY-transform.y};
  }
},{passive:true});
canvas.addEventListener('touchmove', (ev)=>{
  const t=ev.touches[0]; if(!t) return;
  if(dragNode){
    const p=worldPoint(t.clientX,t.clientY);
    const n=nodes.find(x=>x.id===dragNode);
    if(n){ n.x=p.x; n.y=p.y; n.vx=0; n.vy=0; }
  } else if(pan){
    transform.x=t.clientX-pan.x;
    transform.y=t.clientY-pan.y;
  }
},{passive:true});
canvas.addEventListener('touchend', ()=>{ dragNode=null; pan=null; });
</script>
</body>
</html>`
}

export const GraphForceWebView: React.FC<{
  nodes: GraphForceNode[]
  edges: GraphForceEdge[]
  onSelectNode?: (node: { id: string; name: string; nodeType: string }) => void
}> = ({ nodes, edges, onSelectNode }) => {
  const html = useMemo(() => buildHtml(nodes, edges), [nodes, edges])
  const webRef = useRef<WebView>(null)

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string
        id?: string
        name?: string
        nodeType?: string
      }
      if (data.type === 'select' && data.id && data.name && data.nodeType) {
        onSelectNode?.({ id: data.id, name: data.name, nodeType: data.nodeType })
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 280 },
  web: { flex: 1, backgroundColor: '#0f172a' }
})
