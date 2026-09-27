import { GRAPH_FORCE_ISOLATED_GRID_CELL, GRAPH_FORCE_ISOLATED_PAIRWISE_MAX } from '@baishou/shared'

export const GRAPH_FORCE_RUNTIME_PHYSICS = `
function applyChargePair(a,b,scale,chargeMag,chargeMax2,useMax){
  let dx=a.x-b.x, dy=a.y-b.y;
  let dist2=dx*dx+dy*dy||1;
  if(useMax && dist2>chargeMax2) return;
  if(!scale) return;
  let f=chargeMag*4.5*scale/dist2;
  let dist=Math.sqrt(dist2);
  dx/=dist; dy/=dist;
  a.vx+=dx*f; a.vy+=dy*f;
  b.vx-=dx*f; b.vy-=dy*f;
}

function fillChargeGrid(indexes, cell){
  const grid=new Map();
  const size=cell>0?cell:1;
  for(let i=0;i<indexes.length;i++){
    const idx=indexes[i];
    const n=nodes[idx];
    const key=Math.floor(n.x/size)+':'+Math.floor(n.y/size);
    let bucket=grid.get(key);
    if(!bucket){ bucket=[]; grid.set(key,bucket); }
    bucket.push(idx);
  }
  return grid;
}

function forEachChargeGridNeighbor(grid, x, y, cell, visit){
  const size=cell>0?cell:1;
  const cx=Math.floor(x/size), cy=Math.floor(y/size);
  for(let dx=-1;dx<=1;dx++){
    for(let dy=-1;dy<=1;dy++){
      const bucket=grid.get((cx+dx)+':'+(cy+dy));
      if(!bucket) continue;
      for(let k=0;k<bucket.length;k++) visit(bucket[k]);
    }
  }
}

function step(){
  const n = nodes.length;
  const chargeMag = Math.abs(force.chargeStrength || 180);
  const linkK = (force.linkStrength == null ? 0.4 : force.linkStrength) * 0.05;
  const centerK = force.centerStrength == null ? 0.08 : force.centerStrength;
  const linkDist = force.linkDistance == null ? 70 : force.linkDistance;
  const chargeMax = Math.max(CHARGE_DISTANCE_MAX_MIN, linkDist * CHARGE_DISTANCE_MAX_LINK_SCALE);
  const chargeMax2 = chargeMax * chargeMax;
  const connected = [];
  const isolated = [];
  for(let i=0;i<n;i++){
    if((degreeById.get(nodes[i].id)||0)<=0) isolated.push(i);
    else connected.push(i);
  }
  const cell = Math.max(24, chargeMax);
  const grid = fillChargeGrid(connected, cell);
  for(let c=0;c<connected.length;c++){
    const i = connected[c];
    const a = nodes[i];
    forEachChargeGridNeighbor(grid, a.x, a.y, cell, function(j){
      if(j<=i) return;
      applyChargePair(a, nodes[j], 1, chargeMag, chargeMax2, true);
    });
  }
  // Isolated–connected mixed charge is ~0.02; skip it.
  if(isolated.length<=${GRAPH_FORCE_ISOLATED_PAIRWISE_MAX}){
    for(let i=0;i<isolated.length;i++){
      for(let j=i+1;j<isolated.length;j++){
        applyChargePair(nodes[isolated[i]], nodes[isolated[j]], ISOLATED_CHARGE_SCALE, chargeMag, 0, false);
      }
    }
  } else {
    const icell = ${GRAPH_FORCE_ISOLATED_GRID_CELL};
    const igrid = fillChargeGrid(isolated, icell);
    for(let c=0;c<isolated.length;c++){
      const i = isolated[c];
      const a = nodes[i];
      forEachChargeGridNeighbor(igrid, a.x, a.y, icell, function(j){
        if(j<=i) return;
        applyChargePair(a, nodes[j], ISOLATED_CHARGE_SCALE, chargeMag, 0, false);
      });
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
    const deg = degreeById.get(nd.id)||0;
    const ck = deg <= 0 ? centerK * ISOLATED_CENTER_SCALE : centerK;
    nd.vx += (cx - nd.x) * ck * 0.15;
    nd.vy += (cy - nd.y) * ck * 0.15;
    const damp = deg <= 0 ? (1 - VELOCITY_DECAY) : 0.85;
    nd.vx*=damp; nd.vy*=damp;
    nd.x+=nd.vx; nd.y+=nd.vy;
  }
}
`
