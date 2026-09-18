export const GRAPH_FORCE_RUNTIME_SETUP = `
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let dpr = window.devicePixelRatio || 1;
let W = 0, H = 0;

let force = Object.assign({}, FORCE_DEFAULTS, DATA.force || {});

let appearance = Object.assign({
  showArrows: false,
  showIsolatedNodes: true,
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
`
