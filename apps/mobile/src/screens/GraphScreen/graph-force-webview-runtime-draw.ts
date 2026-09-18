export const GRAPH_FORCE_RUNTIME_DRAW = `
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
    const degree = degreeById.get(n.id)||0;
    const isHub =
      degree <= 0
        ? appearance.showIsolatedNodes !== false
        : degree >= (appearance.hubLabelMinDegree||3) ||
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
      if(n.discriminator){
        ctx.font=(10/k)+'px system-ui';
        ctx.fillText(String(n.discriminator).slice(0,16), n.x+r+3, n.y+4+12/k);
      }
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
`
