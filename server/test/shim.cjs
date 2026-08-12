// Canvas2D -> SVG shim + minimal DOM stubs, so canvas drawings can be eyeballed
// without a browser. Arcs/ellipses/quadratics are sampled into polylines and the
// transform matrix is tracked, so save/translate/rotate/scale behave.
const listeners = new Map();

function mul(m, n) {
  return [
    m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1],
    m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3],
    m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]
  ];
}

function makeCtx() {
  let out = [];
  let m = [1,0,0,1,0,0];
  const mStack = [], sStack = [];
  const st = { strokeStyle:'#222', fillStyle:'#222', lineWidth:2, globalAlpha:1,
               font:'13px sans-serif', textAlign:'left', lineJoin:'round', lineCap:'round' };
  let sub = [];
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const g = () => `matrix(${m.map(v => +v.toFixed(4)).join(',')})`;
  const cur = () => { if (!sub.length) sub.push({pts:[], closed:false}); return sub[sub.length-1]; };
  const pathD = () => sub.filter(s => s.pts.length)
    .map(sp => 'M' + sp.pts.map(p => p.map(v => +v.toFixed(2)).join(' ')).join(' L') + (sp.closed ? ' Z' : ''))
    .join(' ');
  const sample = (cb, n) => { const pts=[]; for (let i=0;i<=n;i++) pts.push(cb(i/n)); return pts; };

  const api = {
    save(){ mStack.push(m.slice()); sStack.push({...st}); },
    restore(){ if (mStack.length) m = mStack.pop(); if (sStack.length) Object.assign(st, sStack.pop()); },
    translate(x,y){ m = mul(m, [1,0,0,1,x,y]); },
    rotate(a){ m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    scale(x,y){ m = mul(m, [x,0,0,y,0,0]); },
    setTransform(a,b,c,d,e,f){ m = [a,b,c,d,e,f]; },
    beginPath(){ sub = []; },
    closePath(){ if (sub.length) sub[sub.length-1].closed = true; },
    moveTo(x,y){ sub.push({pts:[[x,y]], closed:false}); },
    lineTo(x,y){ cur().pts.push([x,y]); },
    quadraticCurveTo(cx,cy,x,y){
      const p = cur(); const [x0,y0] = p.pts[p.pts.length-1] || [cx,cy];
      for (let i=1;i<=10;i++){ const t=i/10, u=1-t;
        p.pts.push([u*u*x0 + 2*u*t*cx + t*t*x, u*u*y0 + 2*u*t*cy + t*t*y]); }
    },
    arc(x,y,r,a0,a1){
      const span = Math.min(Math.abs(a1-a0), Math.PI*2);
      sub.push({ pts: sample(t => [x + Math.cos(a0 + span*t)*r, y + Math.sin(a0 + span*t)*r], 40),
                 closed: span > 6.2 });
    },
    ellipse(x,y,rx,ry,rot,a0,a1){
      const span = Math.min(Math.abs(a1-a0), Math.PI*2);
      sub.push({ pts: sample(t => {
        const a = a0 + span*t, cx = Math.cos(a)*rx, cy = Math.sin(a)*ry;
        return [x + cx*Math.cos(rot) - cy*Math.sin(rot), y + cx*Math.sin(rot) + cy*Math.cos(rot)];
      }, 48), closed: span > 6.2 });
    },
    stroke(){ const d = pathD(); if (!d) return;
      out.push(`<g transform="${g()}"><path d="${d}" fill="none" stroke="${st.strokeStyle}" stroke-width="${st.lineWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${st.globalAlpha}"/></g>`); },
    fill(){ const d = pathD(); if (!d) return;
      out.push(`<g transform="${g()}"><path d="${d}" fill="${st.fillStyle}" opacity="${st.globalAlpha}"/></g>`); },
    strokeRect(x,y,w,h){ out.push(`<g transform="${g()}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${st.strokeStyle}" stroke-width="${st.lineWidth}" opacity="${st.globalAlpha}"/></g>`); },
    fillRect(x,y,w,h){ out.push(`<g transform="${g()}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${st.fillStyle}" opacity="${st.globalAlpha}"/></g>`); },
    clearRect(){},
    fillText(s,x,y){
      const bold = /bold/.test(st.font), size = (st.font.match(/(\d+)px/)||[0,13])[1];
      const anchor = st.textAlign === 'center' ? 'middle' : (st.textAlign === 'right' ? 'end' : 'start');
      out.push(`<g transform="${g()}"><text x="${x}" y="${y}" font-family="Helvetica, sans-serif" font-size="${size}" ${bold?'font-weight="bold"':''} fill="${st.fillStyle}" text-anchor="${anchor}" opacity="${st.globalAlpha}">${esc(s)}</text></g>`); },
    measureText(s){ return { width: String(s).length * 7 }; },
    _svg(w,h){ return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fbfbf7"/>${out.join('')}</svg>`; },
    _clear(){ out = []; m = [1,0,0,1,0,0]; mStack.length = 0; sStack.length = 0; }
  };
  return new Proxy(api, {
    get(t,k){ if (k in st) return st[k]; return t[k]; },
    set(t,k,v){ if (k in st) st[k] = v; else t[k] = v; return true; }
  });
}

function el(tag) {
  const e = {
    tagName: tag, nodeType: 1, className: '', textContent: '', style: {},
    childNodes: [], hidden: false, disabled: false, value: '',
    clientWidth: 960, width: 960, height: 540,
    classList: { s:new Set(), add(c){this.s.add(c);}, remove(c){this.s.delete(c);}, contains(c){return this.s.has(c);} },
    appendChild(n){ this.childNodes.push(n); return n; },
    setAttribute(k,v){ this['attr_'+k] = v; },
    getAttribute(k){ return this['attr_'+k] ?? null; },
    addEventListener(t,fn){ if (!listeners.has(this)) listeners.set(this,{}); (listeners.get(this)[t] ||= []).push(fn); },
    getBoundingClientRect(){ return { left:0, top:0, width:this.width, height:this.height }; },
    get innerHTML(){ return this._html || ''; },
    set innerHTML(v){ this._html = v; if (v === '') this.childNodes.length = 0; },
    querySelector(){ return el('i'); },
    querySelectorAll(){ return []; }
  };
  return e;
}

module.exports = { makeCtx, el, listeners, mul };
