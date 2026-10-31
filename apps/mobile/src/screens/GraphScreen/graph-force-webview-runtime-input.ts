export const GRAPH_FORCE_RUNTIME_INPUT = `
function worldPoint(clientX, clientY){
  return {
    x:(clientX-transform.x)/transform.k,
    y:(clientY-transform.y)/transform.k
  };
}
function hitNode(x,y){
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    const r=Math.max(nodeRadius(n), HIT_MIN_PX/(transform.k||1));
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
  ev.preventDefault();
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
},{passive:false});

canvas.addEventListener('touchmove', (ev)=>{
  ev.preventDefault();
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
    requestDraw();
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
    if(n){ n.x=p.x; n.y=p.y; n.vx=0; n.vy=0; requestDraw(); }
  } else if(pan){
    if(dist < DRAG_THRESHOLD_PX) return;
    stopCameraFollow();
    transform.x=t.clientX-pan.x;
    transform.y=t.clientY-pan.y;
    requestDraw();
  }
},{passive:false});

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
},{passive:false});

canvas.addEventListener('touchcancel', ()=>{
  interacting=false;
  dragNode=null; pan=null; pinch=null; activeTouches.clear();
},{passive:false});

window.__setGraphForce = function(next){
  if(!next || typeof next !== 'object') return;
  const prev = [force.centerStrength, force.linkStrength, force.chargeStrength, force.linkDistance].join(',');
  force = Object.assign({}, force, next);
  const now = [force.centerStrength, force.linkStrength, force.chargeStrength, force.linkDistance].join(',');
  if(prev===now) return;
  settleLayout();
  requestDraw();
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
  const rawNextNodes = (payload.nodes||[]).filter(function(n){ return n && n.reviewStatus !== 'rejected'; });
  const byId = new Map(rawNextNodes.map(function(n){ return [n.id, n]; }));
  for(let i = nodes.length - 1; i >= 0; i--){
    const n = nodes[i];
    const fresh = byId.get(n.id);
    if(!fresh){
      nodes.splice(i, 1);
      continue;
    }
    n.name = fresh.name;
    n.discriminator = fresh.discriminator;
    n.nodeType = fresh.nodeType;
    n.mentionCount = fresh.mentionCount;
    n.reviewStatus = fresh.reviewStatus;
  }
  idIndex.clear();
  for(let i = 0; i < nodes.length; i++){
    idIndex.set(nodes[i].id, i);
  }
  const rawNextEdges = (payload.edges||[]).filter(function(e){
    return e && e.reviewStatus !== 'rejected' && idIndex.has(e.fromId) && idIndex.has(e.toId);
  });
  const linkMeta = new Map(rawNextEdges.map(function(e){ return [e.id, e]; }));
  for(let i = links.length - 1; i >= 0; i--){
    const l = links[i];
    const fresh = linkMeta.get(l.id);
    if(!fresh || !idIndex.has(fresh.fromId) || !idIndex.has(fresh.toId)){
      links.splice(i, 1);
      continue;
    }
    l.a = idIndex.get(fresh.fromId);
    l.b = idIndex.get(fresh.toId);
    l.reviewStatus = fresh.reviewStatus;
    l.edgeType = fresh.edgeType;
  }
  degreeById.clear();
  for(const l of links){
    const a = nodes[l.a], b = nodes[l.b];
    if(!a || !b) continue;
    degreeById.set(a.id, (degreeById.get(a.id)||0)+1);
    degreeById.set(b.id, (degreeById.get(b.id)||0)+1);
  }
  if(selectedId && !idIndex.has(selectedId)) selectedId = null;
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
    n.vx = 0;
    n.vy = 0;
  }
  settleLayout();
  requestDraw();
};
`
