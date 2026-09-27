export const GRAPH_FORCE_RUNTIME_DRAW = `
function drawArrowHead(g,x1,y1,x2,y2,size){
  const angle = Math.atan2(y2-y1, x2-x1);
  const t = 0.82;
  const ax = x1 + (x2-x1)*t;
  const ay = y1 + (y2-y1)*t;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(ax - size*Math.cos(angle-0.4), ay - size*Math.sin(angle-0.4));
  g.lineTo(ax - size*Math.cos(angle+0.4), ay - size*Math.sin(angle+0.4));
  g.closePath();
  g.fill();
}

function drawCanvas2d(g){
  if(!g) return;
  g.clearRect(0,0,W,H);
  g.fillStyle = theme.background;
  g.fillRect(0,0,W,H);
  g.save();
  g.translate(transform.x, transform.y);
  g.scale(transform.k, transform.k);

  const nodeScale = appearance.nodeSize == null ? 1 : appearance.nodeSize;
  const lineScale = appearance.lineThickness == null ? 1 : appearance.lineThickness;
  const textAlpha = appearance.textOpacity == null ? 1 : appearance.textOpacity;
  const focusing = !!(selectedId && focusIds.size > 0);
  const k = transform.k;

  g.lineWidth = (1 * lineScale) / k;
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    if(!a||!b) continue;
    const pending = l.reviewStatus==='pending';
    const edgeHi = highlightEdgeIds.has(l.id);
    const inFocusEdge = !focusing || edgeHi || (focusIds.has(a.id) && focusIds.has(b.id));
    if(focusing && !inFocusEdge) continue;
    g.globalAlpha = 1;
    g.strokeStyle = edgeHi ? (theme.edgeHighlight || '#5BA8F5') : (pending ? theme.edgePending : theme.edge);
    g.fillStyle = g.strokeStyle;
    g.lineWidth = ((edgeHi ? 2.6 : 1) * lineScale) / k;
    g.setLineDash(pending ? [4/k, 4/k] : []);
    g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
    if(appearance.showArrows && !pending){
      drawArrowHead(g,a.x,a.y,b.x,b.y, (6*lineScale)/k);
    }
  }
  g.setLineDash([]);
  g.lineWidth = (1 * lineScale) / k;
  g.globalAlpha = 1;

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

    g.globalAlpha = dim ? 0.1 : (pending && !highlighted) ? 0.45 : 1;
    g.beginPath();
    g.fillStyle=TYPE_COLORS[n.nodeType]||'#94a3b8';
    g.arc(n.x,n.y,r,0,Math.PI*2);
    g.fill();

    if(highlighted){
      g.setLineDash(pending ? [3/k,3/k] : []);
      g.strokeStyle=theme.highlight;
      g.lineWidth=(2.5*lineScale)/k;
      g.stroke();
      g.setLineDash([]);
    } else if(pending && inFocus){
      g.setLineDash([3/k,3/k]);
      g.strokeStyle=theme.highlight;
      g.lineWidth=(1.5*lineScale)/k;
      g.stroke();
      g.setLineDash([]);
    }

    const showLabel =
      textAlpha > 0.01 &&
      !dim &&
      (n.id===selectedId || highlightIds.has(n.id) || (focusing && inFocus) || isHub);
    if(showLabel){
      g.globalAlpha = (pending ? 0.45 : 1) * textAlpha;
      g.fillStyle=theme.label;
      g.font=(12/k)+'px system-ui';
      g.fillText(n.name.slice(0,16), n.x+r+3, n.y+4);
      if(n.discriminator){
        g.font=(10/k)+'px system-ui';
        g.fillText(String(n.discriminator).slice(0,16), n.x+r+3, n.y+4+12/k);
      }
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

function drawOverlay(){
  const g = labelCtx;
  if(!g) return;
  g.clearRect(0,0,W,H);
  g.save();
  g.translate(transform.x, transform.y);
  g.scale(transform.k, transform.k);
  const nodeScale = appearance.nodeSize == null ? 1 : appearance.nodeSize;
  const lineScale = appearance.lineThickness == null ? 1 : appearance.lineThickness;
  const textAlpha = appearance.textOpacity == null ? 1 : appearance.textOpacity;
  const focusing = !!(selectedId && focusIds.size > 0);
  const k = transform.k;

  if(appearance.showArrows){
    for(const l of links){
      const a=nodes[l.a], b=nodes[l.b];
      if(!a||!b) continue;
      if(l.reviewStatus==='pending') continue;
      const edgeHi = highlightEdgeIds.has(l.id);
      const inFocusEdge = !focusing || edgeHi || (focusIds.has(a.id) && focusIds.has(b.id));
      if(focusing && !inFocusEdge) continue;
      g.fillStyle = edgeHi ? (theme.edgeHighlight || '#5BA8F5') : theme.edge;
      drawArrowHead(g,a.x,a.y,b.x,b.y, (6*lineScale)/k);
    }
  }

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

    if(highlighted || (pending && inFocus)){
      g.beginPath();
      g.arc(n.x,n.y,r,0,Math.PI*2);
      g.strokeStyle=theme.highlight;
      g.lineWidth=((highlighted ? 2.5 : 1.5)*lineScale)/k;
      g.setLineDash(pending ? [3/k,3/k] : []);
      g.stroke();
      g.setLineDash([]);
    }

    const showLabel =
      textAlpha > 0.01 &&
      !dim &&
      (n.id===selectedId || highlightIds.has(n.id) || (focusing && inFocus) || isHub);
    if(showLabel){
      g.globalAlpha = (pending ? 0.45 : 1) * textAlpha;
      g.fillStyle=theme.label;
      g.font=(12/k)+'px system-ui';
      g.fillText(n.name.slice(0,16), n.x+r+3, n.y+4);
      if(n.discriminator){
        g.font=(10/k)+'px system-ui';
        g.fillText(String(n.discriminator).slice(0,16), n.x+r+3, n.y+4+12/k);
      }
      g.globalAlpha = 1;
    }
  }
  g.restore();
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
  if(useGl){
    glDraw();
    drawOverlay();
  } else {
    drawCanvas2d(ctx || labelCtx);
  }
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
