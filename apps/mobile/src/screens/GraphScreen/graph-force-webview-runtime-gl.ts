export const GRAPH_FORCE_RUNTIME_GL = `
function parseCssColor(s, alpha){
  if(!s) return [0.58,0.64,0.72, alpha==null?1:alpha];
  if(s.charAt(0)==='#'){
    const hex = s.length===4
      ? s.charAt(1)+s.charAt(1)+s.charAt(2)+s.charAt(2)+s.charAt(3)+s.charAt(3)
      : s.slice(1);
    const n = parseInt(hex, 16);
    return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255, alpha==null?1:alpha];
  }
  const m = String(s).match(/[\\d.]+/g);
  if(!m || m.length<3) return [0.58,0.64,0.72, alpha==null?1:alpha];
  const a = m[3]!=null ? Number(m[3]) : (alpha==null?1:alpha);
  return [Number(m[0])/255, Number(m[1])/255, Number(m[2])/255, a];
}

function compileGlShader(type, src){
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkGlProgram(vsSrc, fsSrc){
  const vs = compileGlShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileGlShader(gl.FRAGMENT_SHADER, fsSrc);
  if(!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

const GL_VS_LINE = 'attribute vec2 a_pos;attribute vec4 a_color;uniform vec2 u_translate;uniform float u_scale;uniform vec2 u_resolution;varying vec4 v_color;void main(){vec2 p=a_pos*u_scale+u_translate;vec2 clip=(p/u_resolution*2.0-1.0)*vec2(1.0,-1.0);gl_Position=vec4(clip,0.0,1.0);v_color=a_color;}';
const GL_FS_LINE = 'precision mediump float;varying vec4 v_color;void main(){gl_FragColor=v_color;}';
const GL_VS_POINT = 'attribute vec2 a_pos;attribute vec4 a_color;attribute float a_size;uniform vec2 u_translate;uniform float u_scale;uniform vec2 u_resolution;uniform float u_dpr;varying vec4 v_color;void main(){vec2 p=a_pos*u_scale+u_translate;vec2 clip=(p/u_resolution*2.0-1.0)*vec2(1.0,-1.0);gl_Position=vec4(clip,0.0,1.0);gl_PointSize=max(2.0,a_size*u_scale*u_dpr);v_color=a_color;}';
const GL_FS_POINT = 'precision mediump float;varying vec4 v_color;void main(){vec2 p=gl_PointCoord*2.0-1.0;if(dot(p,p)>1.0) discard;gl_FragColor=v_color;}';

let lineProg = null;
let pointProg = null;
let lineBuf = null;
let pointPosBuf = null;
let pointColorBuf = null;
let pointSizeBuf = null;
let maxPointSize = 256;

if(gl){
  lineProg = linkGlProgram(GL_VS_LINE, GL_FS_LINE);
  pointProg = linkGlProgram(GL_VS_POINT, GL_FS_POINT);
  if(lineProg && pointProg){
    useGl = true;
    lineBuf = gl.createBuffer();
    pointPosBuf = gl.createBuffer();
    pointColorBuf = gl.createBuffer();
    pointSizeBuf = gl.createBuffer();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    if(range && range[1]) maxPointSize = range[1];
  }
}

function glDraw(){
  if(!useGl || !gl || !lineProg || !pointProg) return;
  const bg = parseCssColor(theme.background, 1);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const k = transform.k || 1;
  const nodeScale = appearance.nodeSize == null ? 1 : appearance.nodeSize;
  const focusing = !!(selectedId && focusIds.size > 0);

  const lineData = [];
  for(const l of links){
    const a=nodes[l.a], b=nodes[l.b];
    if(!a||!b) continue;
    const pending = l.reviewStatus==='pending';
    const edgeHi = highlightEdgeIds.has(l.id);
    const inFocusEdge = !focusing || edgeHi || (focusIds.has(a.id) && focusIds.has(b.id));
    if(focusing && !inFocusEdge) continue;
    const col = parseCssColor(edgeHi ? (theme.edgeHighlight||'#5BA8F5') : (pending ? theme.edgePending : theme.edge));
    lineData.push(a.x, a.y, col[0], col[1], col[2], col[3], b.x, b.y, col[0], col[1], col[2], col[3]);
  }
  gl.useProgram(lineProg);
  gl.uniform2f(gl.getUniformLocation(lineProg,'u_translate'), transform.x, transform.y);
  gl.uniform1f(gl.getUniformLocation(lineProg,'u_scale'), k);
  gl.uniform2f(gl.getUniformLocation(lineProg,'u_resolution'), W, H);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineData), gl.DYNAMIC_DRAW);
  const linePos = gl.getAttribLocation(lineProg,'a_pos');
  const lineCol = gl.getAttribLocation(lineProg,'a_color');
  gl.enableVertexAttribArray(linePos);
  gl.vertexAttribPointer(linePos, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(lineCol);
  gl.vertexAttribPointer(lineCol, 4, gl.FLOAT, false, 24, 8);
  if(lineData.length) gl.drawArrays(gl.LINES, 0, lineData.length/6);

  const pos = [];
  const col = [];
  const size = [];
  for(const n of nodes){
    const r=(6+Math.min(10,(n.mentionCount||1)*1.2))*nodeScale;
    const pending = n.reviewStatus==='pending';
    const highlighted = highlightIds.has(n.id) || n.id===selectedId;
    const inFocus = !focusing || focusIds.has(n.id);
    const dim = focusing && !inFocus;
    let rgba = parseCssColor(TYPE_COLORS[n.nodeType]||'#94a3b8', dim ? 0.1 : (pending && !highlighted) ? 0.45 : 1);
    pos.push(n.x, n.y);
    col.push(rgba[0], rgba[1], rgba[2], rgba[3]);
    size.push(Math.min(maxPointSize / Math.max(dpr, 0.01) / Math.max(k, 0.01), r*2));
  }
  gl.useProgram(pointProg);
  gl.uniform2f(gl.getUniformLocation(pointProg,'u_translate'), transform.x, transform.y);
  gl.uniform1f(gl.getUniformLocation(pointProg,'u_scale'), k);
  gl.uniform2f(gl.getUniformLocation(pointProg,'u_resolution'), W, H);
  gl.uniform1f(gl.getUniformLocation(pointProg,'u_dpr'), dpr);
  const pPos = gl.getAttribLocation(pointProg,'a_pos');
  const pCol = gl.getAttribLocation(pointProg,'a_color');
  const pSize = gl.getAttribLocation(pointProg,'a_size');
  gl.bindBuffer(gl.ARRAY_BUFFER, pointPosBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(pPos);
  gl.vertexAttribPointer(pPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointColorBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(pCol);
  gl.vertexAttribPointer(pCol, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(size), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(pSize);
  gl.vertexAttribPointer(pSize, 1, gl.FLOAT, false, 0, 0);
  if(pos.length) gl.drawArrays(gl.POINTS, 0, pos.length/2);
}
`
