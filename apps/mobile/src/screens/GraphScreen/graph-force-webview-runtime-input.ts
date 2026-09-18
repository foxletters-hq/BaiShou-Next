export const GRAPH_FORCE_RUNTIME_INPUT = `
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
    n.discriminator = fresh.discriminator;
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
`
