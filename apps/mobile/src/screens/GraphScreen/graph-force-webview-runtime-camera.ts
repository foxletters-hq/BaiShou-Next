export const GRAPH_FORCE_RUNTIME_CAMERA = `
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
  stopCameraFollow();
  const ids = cameraFitIds();
  if(!ids.length) return;
  const withZoom = !!(opts && opts.zoom);
  const targetK = withZoom ? Math.max(transform.k, LOCATE_TARGET_K) : transform.k;
  easeCameraTowardSelected({ k: targetK, alpha: 1 });
  requestDraw();
}

function stopCameraFollow(){
  cameraAnim = false;
  followUntil = 0;
  pendingZoom = false;
  if(locateRaf != null){ cancelAnimationFrame(locateRaf); locateRaf = null; }
}

function fitAllNodes(){
  if(!nodes.length || W<=0 || H<=0) return;
  let minX=nodes[0].x, maxX=minX, minY=nodes[0].y, maxY=minY;
  for(let i=1;i<nodes.length;i++){
    const n=nodes[i];
    if(n.x<minX) minX=n.x; if(n.x>maxX) maxX=n.x;
    if(n.y<minY) minY=n.y; if(n.y>maxY) maxY=n.y;
  }
  const pad=CAMERA_FIT_PADDING;
  const bw=Math.max(maxX-minX, 8)+pad*2;
  const bh=Math.max(maxY-minY, 8)+pad*2;
  const k=Math.min(K_MAX, Math.max(K_MIN, Math.min(W/bw, H/bh)));
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  transform.x=W/2-cx*k;
  transform.y=H/2-cy*k;
  transform.k=k;
}
`
