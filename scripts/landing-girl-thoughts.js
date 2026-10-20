/* landing-girl-thoughts.js — the thought cloud of the landing animation: line-art props (books, cups, laptops ...), the swirl and the thoughts director.
   Loaded lazily by landing-girl-animation.js right after the first frame (she walks in and stands for several seconds before the first thought appears), so the page's first
   animation frame never waits for these ~730 KB of source. Needs the core (GA.util, GA.style, GA.props registry). */
(function () {
"use strict";
var GA = (window.__landingGirl = window.__landingGirl || {});
/* ===== props_a.js ===== */
/* props_a.js -- PROPS SET A ("reading / work" thoughts).  Classic script, attaches to window.__landingGirl.props.

   Registered (SPEC 4.3): bookOpen, bookClosed, bookStack, chaiCup, chaiGlass, kulhad, laptop, ipad, pencil, scaleRuler,
                          setSquare, lightbulb, stickyNotes
   Extras:                coffeeMug, plant, headphones, camera

   API:  GA.props.draw(name, ctx, p)  /  GA.props.list[name].draw(ctx, p)   with p = { s, t, seed, rot:[rx,ry,rz], alpha, lw }
     - Drawn around the ctx origin in WORLD units (ctx transform is never touched, p.s is the nominal size = the largest
       side of `box`).  Every prop is saved/restored, so the caller's ctx state is left alone.
     - rot is a real 3D tumble: view matrix M = Rz(rz) Ry(ry) Rx(rx) * Rbase (same Euler order as GA.util.rot3), weak
       perspective, exact hidden-line removal (back-face culling + depth sorted white faces for boxy things, analytic
       silhouettes for round things such as cups, glasses, the bulb).  rot = [0,0,0] is the designed hero pose (seen from
       above, 3/4 turn).  Because the tumble is applied after the base pose and a soft "no edge-on" limiter keeps the
       main axis of every prop away from the screen plane, no state ever collapses to a line (|rx|,|ry| up to ~1.5 rad and
       any rz stay readable; the limiter only bites when a prop would otherwise be seen exactly edge-on).
     - p.t (seconds) animates: steam wisps (chai/coffee), the sketch drawing itself on the laptop / iPad screen, the
       fluttering page of the open book, the pulsing rays of the light bulb.  Pure function of (t, seed, rot).
     - p.seed picks variants: bookClosed (white label / black / grey band), bookStack, bookOpen page layout, stickyNotes
       doodles, plant, sketch on screens.
     - p.alpha < 1 renders the prop as one group through an offscreen canvas (overlapping lines never show through each other).
     - p.lw multiplies every line weight (outlines scale gently with p.s: ~2.0 at s=100, 2.5 at s=150, 3.0 from s=240).
     - box:[w,h] (multiples of s) is the measured bounding box of the rot=[0,0,0] pose over time/seeds, centred on the origin
       (accuracy ~1 %).  GA.propsA.size[name] gives a recommended nominal s for a "thought" of that kind.
   Deterministic: no Math.random / Date.now (GA.util.rng for builds, a sine hash for animation phases).
   Style: thin confident black outlines, white PAPER fills, hair-line hatching for text / keys / page edges, GRAY2-4 light
   shading, the occasional solid INK accent -- matched to the line-art of the sample video. */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  if (!GA.props || !GA.util || !GA.style) throw new Error('props_a.js needs util.js and style.js first');
  var U = GA.util, ST = GA.style;
  var INK = ST.INK, INK2 = ST.INK2, G1 = ST.GRAY1, G2 = ST.GRAY2, G3 = ST.GRAY3, G4 = ST.GRAY4, PAPER = ST.PAPER;
  var TAU = Math.PI * 2, PI = Math.PI;
  var sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, abs = Math.abs, atan2 = Math.atan2, acos = Math.acos, floor = Math.floor;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function frac(x) { return x - floor(x); }
  function h01(a, b) { var x = sin(a * 127.1 + b * 311.7) * 43758.5453; return x - floor(x); }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  /* ======================================================================================================
     1. 3x3 matrices, view state, projection
     ====================================================================================================== */
  function mul3(a, b) {
    var o = new Array(9), i, j;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) o[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
    return o;
  }
  function rotX3(a) { var c = cos(a), s = sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function rotY3(a) { var c = cos(a), s = sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rotZ3(a) { var c = cos(a), s = sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  /** same convention as GA.util.rot3: X first, then Y, then Z */
  function eul3(rx, ry, rz) { return mul3(rotZ3(rz), mul3(rotY3(ry), rotX3(rx))); }
  var ID3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  /** orthonormal frame whose local +Y axis is the unit vector (dx,dy,dz) (columns = local x, y, z in parent coords) */
  function basisY(dx, dy, dz) {
    var l = sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
    var ax = abs(dx) < 0.8 ? 1 : 0, ay = ax ? 0 : 1; // helper not parallel to d
    // ex = normalize(a - (a.d) d)
    var dot = ax * dx + ay * dy, ex = ax - dot * dx, ey = ay - dot * dy, ez = -dot * dz, el = sqrt(ex * ex + ey * ey + ez * ez);
    ex /= el; ey /= el; ez /= el;
    var zx = dy * ez - dz * ey, zy = dz * ex - dx * ez, zz = dx * ey - dy * ex; // z = d x ex ... (right handed)
    return [ex, dx, zx, ey, dy, zy, ez, dz, zz];
  }

  var g = null;                 // current ctx
  var S = 1, LW = 2.5, HW = 0.9;  // world scale of model units, outline width, minimum hair width
  var CAM = 6.5;                // camera distance (model units) for the weak perspective
  var m0 = 1, m1 = 0, m2 = 0, m3 = 0, m4 = 1, m5 = 0, m6 = 0, m7 = 0, m8 = 1, X0 = 0, Y0 = 0, Z0 = 0;
  var PX = 0, PY = 0, PZ = 0;
  var LAYS = 100, TT = 0, SEED = 0;
  var frameStack = [];

  function P(x, y, z) {
    var X = m0 * x + m1 * y + m2 * z + X0, Y = m3 * x + m4 * y + m5 * z + Y0, Z = m6 * x + m7 * y + m8 * z + Z0;
    var f = CAM / (CAM - Z);
    PX = X * f * S; PY = Y * f * S; PZ = Z;
  }
  function zOf(x, y, z) { return m6 * x + m7 * y + m8 * z + Z0; }

  /** descend into a child frame: child coords -> parent coords is  F * c + o  (F row-major 3x3) */
  function pushFrame(F, ox, oy, oz) {
    frameStack.push(m0, m1, m2, m3, m4, m5, m6, m7, m8, X0, Y0, Z0);
    var nX = m0 * ox + m1 * oy + m2 * oz + X0, nY = m3 * ox + m4 * oy + m5 * oz + Y0, nZ = m6 * ox + m7 * oy + m8 * oz + Z0;
    var a0 = m0 * F[0] + m1 * F[3] + m2 * F[6], a1 = m0 * F[1] + m1 * F[4] + m2 * F[7], a2 = m0 * F[2] + m1 * F[5] + m2 * F[8];
    var a3 = m3 * F[0] + m4 * F[3] + m5 * F[6], a4 = m3 * F[1] + m4 * F[4] + m5 * F[7], a5 = m3 * F[2] + m4 * F[5] + m5 * F[8];
    var a6 = m6 * F[0] + m7 * F[3] + m8 * F[6], a7 = m6 * F[1] + m7 * F[4] + m8 * F[7], a8 = m6 * F[2] + m7 * F[5] + m8 * F[8];
    m0 = a0; m1 = a1; m2 = a2; m3 = a3; m4 = a4; m5 = a5; m6 = a6; m7 = a7; m8 = a8; X0 = nX; Y0 = nY; Z0 = nZ;
  }
  function popFrame() {
    Z0 = frameStack.pop(); Y0 = frameStack.pop(); X0 = frameStack.pop();
    m8 = frameStack.pop(); m7 = frameStack.pop(); m6 = frameStack.pop(); m5 = frameStack.pop(); m4 = frameStack.pop(); m3 = frameStack.pop();
    m2 = frameStack.pop(); m1 = frameStack.pop(); m0 = frameStack.pop();
  }

  /* ======================================================================================================
     2. Build-time mesh helpers  (faces are static; projected every draw)
     ====================================================================================================== */
  var XF = null; // build-time transform {m, t} applied to every point/normal created by mk()/lines()
  function withXf(m, t, fn) { var prev = XF; XF = { m: m, t: t }; try { fn(); } finally { XF = prev; } }
  function xfP(p) {
    if (!XF) return p;
    var m = XF.m, t = XF.t, x = p[0], y = p[1], z = p[2];
    return [m[0] * x + m[1] * y + m[2] * z + t[0], m[3] * x + m[4] * y + m[5] * z + t[1], m[6] * x + m[7] * y + m[8] * z + t[2]];
  }
  function xfN(n) {
    if (!XF || !n) return n;
    var m = XF.m, x = n[0], y = n[1], z = n[2];
    return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
  }
  /** face from 3D points (array of [x,y,z]) + outward normal n (null = never culled). o:{fill,edge,ec,lay,zb,tone} */
  function mk(pts, n, o) {
    o = o || {};
    var k = pts.length, a = new Float64Array(k * 3), cx = 0, cy = 0, cz = 0, i, p;
    for (i = 0; i < k; i++) { p = xfP(pts[i]); a[3 * i] = p[0]; a[3 * i + 1] = p[1]; a[3 * i + 2] = p[2]; cx += p[0]; cy += p[1]; cz += p[2]; }
    return {
      pts: a, n: xfN(n), cx: cx / k, cy: cy / k, cz: cz / k,
      fill: o.fill === undefined ? PAPER : o.fill, edge: o.edge === undefined ? 1 : o.edge, ec: o.ec || INK,
      lay: o.lay || 0, zb: o.zb || 0, tone: o.tone || 0, seam: o.seam || 0, groups: [], holes: null, after: null, sil: null,
    };
  }
  function f32(poly) {
    var a = new Float64Array(poly.length * 3), i, p;
    for (i = 0; i < poly.length; i++) { p = xfP(poly[i]); a[3 * i] = p[0]; a[3 * i + 1] = p[1]; a[3 * i + 2] = p[2]; }
    return a;
  }
  /** attach a batch of polylines (arrays of [x,y,z]) to a face. w = width factor of the outline weight. */
  function lines(face, color, w, polys, o) {
    o = o || {};
    var arr = [], i;
    for (i = 0; i < polys.length; i++) arr.push(f32(polys[i]));
    var grp = { c: color, w: w, p: arr, closed: !!o.closed, fill: o.fill || null, dash: o.dash || null };
    (o.front ? face.groups.unshift(grp) : face.groups.push(grp));
    return grp;
  }
  /** 2D polygon -> 3D points through a mapper */
  function map2(poly, fn) { var o = [], i; for (i = 0; i < poly.length; i++) o.push(fn(poly[i][0], poly[i][1])); return o; }
  /** rounded rectangle (counter-clockwise) as [[x,y]...] */
  function rr(x0, y0, x1, y1, r, seg) {
    seg = seg || 4;
    var o = [], k, a, cx, cy, cs = [[x1 - r, y0 + r, -PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, PI / 2], [x0 + r, y0 + r, PI]], c;
    for (c = 0; c < 4; c++) {
      cx = cs[c][0]; cy = cs[c][1];
      for (k = 0; k <= seg; k++) { a = cs[c][2] + (PI / 2) * k / seg; o.push([cx + r * cos(a), cy + r * sin(a)]); }
    }
    return o;
  }
  function circ2(cx, cy, r, n) { var o = [], k; n = n || 20; for (k = 0; k < n; k++) o.push([cx + r * cos(TAU * k / n), cy + r * sin(TAU * k / n)]); return o; }
  function area2(poly) { var a = 0, i, p, q; for (i = 0; i < poly.length; i++) { p = poly[i]; q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

  /** extrude a 2D loop between w0..w1 on a plane ('xz': w=y, 'xy': w=z, 'yz': w=x).  Returns {cap0, cap1, sides:[]}
      cap0 (at w0) faces -w, cap1 faces +w.  holes: array of loops (walls face the hole centre). */
  function prism(poly, plane, w0, w1, o) {
    o = o || {};
    var F = plane === 'xz' ? function (u, v, w) { return [u, w, v]; } : plane === 'xy' ? function (u, v, w) { return [u, v, w]; } : function (u, v, w) { return [w, u, v]; };
    var NF = plane === 'xz' ? function (a, b) { return [a, 0, b]; } : plane === 'xy' ? function (a, b) { return [a, b, 0]; } : function (a, b) { return [0, a, b]; };
    var ew = plane === 'xz' ? [0, 1, 0] : plane === 'xy' ? [0, 0, 1] : [1, 0, 0];
    var r = { cap0: null, cap1: null, sides: [] };
    var i, loops = [{ poly: poly, sign: 1 }];
    if (o.holes) for (i = 0; i < o.holes.length; i++) loops.push({ poly: o.holes[i], sign: -1 });
    function capOpt(k) { var s = o[k] || o.cap || {}; return { fill: s.fill, edge: s.edge, ec: s.ec, lay: o.lay, zb: s.zb !== undefined ? s.zb : o.zb, tone: s.tone }; }
    function capFace(w, nw, fo) {
      var f = mk(map2(poly, function (u, v) { return F(u, v, w); }), [ew[0] * nw, ew[1] * nw, ew[2] * nw], fo);
      if (o.holes) f.holes = o.holes.map(function (h) { return f32(map2(h, function (u, v) { return F(u, v, w); })); });
      return f;
    }
    r.cap0 = capFace(w0, -1, capOpt('cap0'));
    r.cap1 = capFace(w1, 1, capOpt('cap1'));
    var sideO = { tone: o.tone === undefined ? 1 : o.tone, lay: o.lay, zb: o.zb, edge: o.sideEdge === undefined ? 0.85 : o.sideEdge, fill: o.sideFill };
    loops.forEach(function (lp) {
      var pl = lp.poly, n = pl.length, A = area2(pl) >= 0 ? 1 : -1, k, p, q, dx, dy, l, nn, dirs = [];
      for (k = 0; k < n; k++) { p = pl[k]; q = pl[(k + 1) % n]; dx = q[0] - p[0]; dy = q[1] - p[1]; l = sqrt(dx * dx + dy * dy) || 1; dirs.push([dx / l, dy / l]); }
      var made = [];
      for (k = 0; k < n; k++) {
        p = pl[k]; q = pl[(k + 1) % n];
        var d0 = dirs[(k + n - 1) % n], d1 = dirs[k], d2 = dirs[(k + 1) % n];
        var sharpA = d0[0] * d1[0] + d0[1] * d1[1] < 0.8, sharpB = d1[0] * d2[0] + d1[1] * d2[1] < 0.8;
        nn = NF(d1[1] * A * lp.sign, -d1[0] * A * lp.sign);
        var sf = mk([F(p[0], p[1], w0), F(q[0], q[1], w0), F(q[0], q[1], w1), F(p[0], p[1], w1)], nn, { tone: sideO.tone, lay: sideO.lay, zb: sideO.zb, fill: sideO.fill, edge: 0, seam: 1 });
        var segs = [[F(p[0], p[1], w0), F(q[0], q[1], w0)], [F(p[0], p[1], w1), F(q[0], q[1], w1)]];
        if (sharpA) segs.push([F(p[0], p[1], w0), F(p[0], p[1], w1)]);
        if (sharpB) segs.push([F(q[0], q[1], w0), F(q[0], q[1], w1)]);
        lines(sf, INK, sideO.edge, segs);
        sf._sA = sharpA ? null : f32([F(p[0], p[1], w0), F(p[0], p[1], w1)]); sf._sB = sharpB ? null : f32([F(q[0], q[1], w0), F(q[0], q[1], w1)]);
        made.push(sf); r.sides.push(sf);
      }
      // smooth joints become silhouette lines when the neighbouring facet turns away from the viewer
      for (k = 0; k < n; k++) { made[k].sil = []; if (made[k]._sA) made[k].sil.push({ nb: made[(k + n - 1) % n], seg: made[k]._sA }); if (made[k]._sB) made[k].sil.push({ nb: made[(k + 1) % n], seg: made[k]._sB }); sideO.edge; }
    });
    return r;
  }
  /** axis aligned box.  returns array of faces with keys: ny (top, -y), py, nx, px, nz, pz */
  function box(x0, y0, z0, x1, y1, z1, o) {
    o = o || {};
    var fo = function (k) { var b = {}, kk; for (kk in o) b[kk] = o[kk]; if (o.fills && o.fills[k] !== undefined) b.fill = o.fills[k]; return b; };
    var r = [];
    r.ny = mk([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], fo('ny'));
    r.py = mk([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], fo('py'));
    r.nx = mk([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], fo('nx'));
    r.px = mk([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], fo('px'));
    r.nz = mk([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], fo('nz'));
    r.pz = mk([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], fo('pz'));
    r.push(r.ny, r.py, r.nx, r.px, r.nz, r.pz);
    return r;
  }
  function pushAll(dst, src) { for (var i = 0; i < src.length; i++) dst.push(src[i]); }

  /* ======================================================================================================
     3. Painter queue + face rendering
     ====================================================================================================== */
  var QI = [], QK = [], QN = 0;
  var LX = -0.42, LY = -0.62, LZ = 0.66; // light (view space; from top-left, in front)
  function qFace(f) {
    var nz = 1;
    if (f.n) { nz = m6 * f.n[0] + m7 * f.n[1] + m8 * f.n[2]; if (nz <= 1e-4) return; }
    QI[QN] = f; QK[QN] = f.lay * LAYS + (m6 * f.cx + m7 * f.cy + m8 * f.cz + Z0) + f.zb; QN++;
  }
  function qAll(arr) { for (var i = 0; i < arr.length; i++) qFace(arr[i]); }
  /** queue a custom draw callback (depth key = view z of model point + lay) */
  function qFn(x, y, z, lay, fn) { QI[QN] = fn; QK[QN] = (lay || 0) * LAYS + zOf(x, y, z); QN++; }
  function flush() {
    var i, j, it, k, n = QN;
    for (i = 1; i < n; i++) {
      it = QI[i]; k = QK[i]; j = i - 1;
      while (j >= 0 && QK[j] > k) { QI[j + 1] = QI[j]; QK[j + 1] = QK[j]; j--; }
      QI[j + 1] = it; QK[j + 1] = k;
    }
    for (i = 0; i < n; i++) { it = QI[i]; if (typeof it === 'function') it(); else drawFace(it); QI[i] = null; }
    QN = 0;
  }
  function toneFill(n, bias) {
    var nx = m0 * n[0] + m1 * n[1] + m2 * n[2], ny = m3 * n[0] + m4 * n[1] + m5 * n[2], nz = m6 * n[0] + m7 * n[1] + m8 * n[2];
    var d = nx * LX + ny * LY + nz * LZ + (bias - 1) * 0.3;
    return d > 0.02 ? PAPER : d > -0.34 ? G4 : G3;
  }
  function drawFace(f) {
    var pts = f.pts, n = pts.length / 3, i, h, hs = f.holes, hp, hn;
    g.beginPath();
    for (i = 0; i < n; i++) { P(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]); if (i) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    g.closePath();
    if (hs) {
      for (h = 0; h < hs.length; h++) {
        hp = hs[h]; hn = hp.length / 3;
        for (i = 0; i < hn; i++) { P(hp[3 * i], hp[3 * i + 1], hp[3 * i + 2]); if (i) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
        g.closePath();
      }
    }
    var fill = f.fill;
    if (f.tone && f.n && fill === PAPER) fill = toneFill(f.n, f.tone);
    if (fill) { g.fillStyle = fill; if (hs) g.fill('evenodd'); else g.fill(); if (f.seam) { g.lineWidth = 0.9; g.strokeStyle = fill; g.stroke(); } }
    if (f.edge) { g.lineWidth = LW * f.edge; g.strokeStyle = f.ec; g.stroke(); }
    var gr = f.groups;
    for (i = 0; i < gr.length; i++) drawGroup(gr[i]);
    if (f.sil && f.sil.length) {
      var sl = f.sil, any = false, qq, sg, nbn;
      g.beginPath();
      for (i = 0; i < sl.length; i++) {
        qq = sl[i]; nbn = qq.nb.n;
        if (m6 * nbn[0] + m7 * nbn[1] + m8 * nbn[2] > 1e-4) continue;
        sg = qq.seg; P(sg[0], sg[1], sg[2]); g.moveTo(PX, PY); P(sg[3], sg[4], sg[5]); g.lineTo(PX, PY); any = true;
      }
      if (any) { g.lineWidth = LW * 0.85; g.strokeStyle = INK; g.stroke(); }
    }
    if (f.after) f.after(f);
  }
  function drawGroup(gr) {
    var polys = gr.p, k, i, pp, n2;
    g.beginPath();
    for (k = 0; k < polys.length; k++) {
      pp = polys[k]; n2 = pp.length / 3;
      for (i = 0; i < n2; i++) { P(pp[3 * i], pp[3 * i + 1], pp[3 * i + 2]); if (i) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
      if (gr.closed) g.closePath();
    }
    if (gr.fill) { g.fillStyle = gr.fill; g.fill(); }
    if (gr.w) {
      g.lineWidth = Math.max(LW * gr.w, HW); g.strokeStyle = gr.c;
      if (gr.dash) { g.setLineDash([gr.dash[0] * S, gr.dash[1] * S]); g.stroke(); g.setLineDash([]); } else g.stroke();
    }
  }

  /* ======================================================================================================
     4. Surfaces of revolution (cups, glasses, bulb ...): analytic silhouettes, no faceting
        local axis = +Y (down).  profile control points [r, y(, corner)] from top to bottom
     ====================================================================================================== */
  var RT = 96, CT = new Float64Array(RT + 1), SNT = new Float64Array(RT + 1);
  (function () { for (var q = 0; q <= RT; q++) { CT[q] = cos(q * TAU / RT); SNT[q] = sin(q * TAU / RT); } })();
  /** number of segments of a full circle of radius r (model units): keeps the polygon error below ~0.4 world units */
  function ringN(r) { var d = r * S; return d < 45 ? 24 : d < 90 ? 32 : d < 180 ? 48 : 96; }

  function lathe(ctrl, seg) {
    seg = seg || 4;
    var runs = [], run = [ctrl[0]], i, c, ri, k;
    for (i = 1; i < ctrl.length; i++) { c = ctrl[i]; run.push(c); if (c[2] && i < ctrl.length - 1) { runs.push(run); run = [c]; } }
    runs.push(run);
    var R = [], Y = [], NR = [], NY = [];
    for (ri = 0; ri < runs.length; ri++) {
      run = runs[ri];
      var pts = run.map(function (q) { return { x: q[0], y: q[1] }; });
      var dense = pts.length > 2 ? U.catmull(pts, seg) : pts, n0 = dense.length, sn = [];
      for (k = 0; k < n0 - 1; k++) {
        var dr = dense[k + 1].x - dense[k].x, dy = dense[k + 1].y - dense[k].y, l = sqrt(dr * dr + dy * dy) || 1;
        sn.push([dy / l, -dr / l]);
      }
      for (k = 0; k < n0; k++) {
        var a = k > 0 ? sn[k - 1] : sn[0], b = k < n0 - 1 ? sn[k] : sn[n0 - 2];
        var nx = a[0] + b[0], ny = a[1] + b[1], l2 = sqrt(nx * nx + ny * ny) || 1;
        R.push(dense[k].x); Y.push(dense[k].y); NR.push(nx / l2); NY.push(ny / l2);
      }
    }
    var L = { n: R.length, r: R, y: Y, nr: NR, ny: NY };
    L.idx = function (y) { var j = 0; while (j < L.n - 2 && L.y[j + 1] < y) j++; return j; };
    L.rAt = function (y) {
      var j = L.idx(y), y0 = L.y[j], y1 = L.y[j + 1], t = y1 === y0 ? 0 : clamp((y - y0) / (y1 - y0), 0, 1);
      return L.r[j] + (L.r[j + 1] - L.r[j]) * t;
    };
    L.nAt = function (y) { var j = L.idx(y); return [L.nr[j], L.ny[j]]; };
    return L;
  }

  var CA = new Float64Array(512), CB = new Float64Array(512), NCA = 0, NCB = 0;
  var VPH = 0, VDL = 0;
  /** visible range of a ring whose surface normal is (nr, ny):  returns 0 none / 1 all / 2 arc (VPH centre, VDL half width) */
  function visArc(nr, ny) {
    var A = m6 * nr, B = m8 * nr, D = m7 * ny, R = sqrt(A * A + B * B);
    if (R < 1e-6) return D > 0 ? 1 : 0;
    var c = -D / R;
    if (c >= 1) return 0;
    if (c <= -1) return 1;
    VPH = atan2(B, A); VDL = acos(c);
    return 2;
  }
  /** silhouette of ring (r,y) with surface normal (nr,ny): the two tangent points -> EA (left of the axis) / EB (right) */
  var EA0 = 0, EA1 = 0, EB0 = 0, EB1 = 0, IR = 0, IY = 0, INR = 0, INY = 0;
  function evalRing(r, y, nr, ny, force) {
    var A = m6 * nr, B = m8 * nr, D = m7 * ny, R = sqrt(A * A + B * B), c, ph, d;
    if (R < 1e-6) return false;
    c = -D / R;
    if (c >= 1 || c <= -1) { if (!force) return false; c = c > 0 ? 1 : -1; }
    ph = atan2(B, A); d = acos(c);
    var a1 = ph - d, a2 = ph + d;
    P(0, y, 0); var cx = PX, cy = PY;
    P(r * cos(a1), y, r * sin(a1)); var x1 = PX, y1 = PY;
    P(r * cos(a2), y, r * sin(a2)); var x2 = PX, y2 = PY;
    if ((x1 - cx) * m4 - (y1 - cy) * m1 < 0) { EA0 = x1; EA1 = y1; EB0 = x2; EB1 = y2; } else { EA0 = x2; EA1 = y2; EB0 = x1; EB1 = y1; }
    return true;
  }
  /** profile point at fraction f of segment j..j+1 (normal interpolated) evaluated with evalRing */
  function evalAt(L, j, f, force) {
    var nr = L.nr[j] + (L.nr[j + 1 > L.n - 1 ? j : j + 1] - L.nr[j]) * f, ny = L.ny[j] + (L.ny[j + 1 > L.n - 1 ? j : j + 1] - L.ny[j]) * f, l = sqrt(nr * nr + ny * ny) || 1;
    var jn = j + 1 > L.n - 1 ? j : j + 1;
    return evalRing(L.r[j] + (L.r[jn] - L.r[j]) * f, L.y[j] + (L.y[jn] - L.y[j]) * f, nr / l, ny / l, force);
  }
  var CRUN = new Int32Array(64), NRUN = 0, cgap = false;
  /** appends the current tangent pair; a validity gap or a crease starts a new run (so nothing is joined across them) */
  function pushPt() {
    if (cgap) { if (NCA > 0 && NRUN < 63) CRUN[NRUN++] = NCA; cgap = false; }
    CA[2 * NCA] = EA0; CA[2 * NCA + 1] = EA1; NCA++; CB[2 * NCB] = EB0; CB[2 * NCB + 1] = EB1; NCB++;
  }
  /** silhouette chains (smooth tangent curve) of the lathe in the current frame -> CA / CB, refined near validity changes */
  function buildChains(L, j0, j1) {
    NCA = 0; NCB = 0; NRUN = 0; cgap = false; CRUN[NRUN++] = 0;
    if (sqrt(m1 * m1 + m4 * m4) < 0.1) return false;
    j0 = j0 || 0; if (j1 === undefined) j1 = L.n - 1;
    var thr = Math.min(0.03 * S, 6), j, va, vb, ax, ay, bx, by, gap, m, q, lo, hi, it, mid, K = 7, u, tt;
    va = evalAt(L, j0, 0);
    for (j = j0; j < j1; j++) {
      if (va) pushPt(); else cgap = true;
      ax = EA0; ay = EA1; bx = EB0; by = EB1;
      if (L.r[j + 1] === L.r[j] && L.y[j + 1] === L.y[j]) { cgap = true; va = evalAt(L, j + 1, 0); continue; }
      vb = evalAt(L, j, 1);
      if (va && vb) {
        gap = Math.max(Math.hypot(EA0 - ax, EA1 - ay), Math.hypot(EB0 - bx, EB1 - by));
        if (gap > thr) { m = Math.min(10, Math.ceil(gap / thr)); for (q = 1; q < m; q++) if (evalAt(L, j, q / m)) pushPt(); }
      } else if (va !== vb) {
        lo = va ? 0 : 1; hi = va ? 1 : 0;
        for (it = 0; it < 9; it++) { mid = (lo + hi) / 2; if (evalAt(L, j, mid)) lo = mid; else hi = mid; }
        if (va) { for (u = 1; u <= K; u++) { tt = lo * (1 - Math.pow(1 - u / K, 3)); if (evalAt(L, j, tt)) pushPt(); } if (evalAt(L, j, hi, true)) pushPt(); }
        else { if (evalAt(L, j, hi, true)) pushPt(); for (u = K; u >= 1; u--) { tt = 1 - (1 - lo) * (1 - Math.pow(1 - u / K, 3)); if (evalAt(L, j, tt)) pushPt(); } }
      }
      va = evalAt(L, j + 1, 0);
    }
    if (va) pushPt();
    CRUN[NRUN] = NCA;
    return NCA > 1;
  }
  /** run r spans points CRUN[r] .. CRUN[r+1]-1 (CRUN[NRUN] is the end sentinel) */
  function runPoly(r) {
    var i, a = CRUN[r], b = r + 1 < NRUN ? CRUN[r + 1] : NCA;
    g.moveTo(CA[2 * a], CA[2 * a + 1]);
    for (i = a + 1; i < b; i++) g.lineTo(CA[2 * i], CA[2 * i + 1]);
    for (i = b - 1; i >= a; i--) g.lineTo(CB[2 * i], CB[2 * i + 1]);
    g.closePath();
  }
  function runStrokes(r) {
    var i, a = CRUN[r], b = r + 1 < NRUN ? CRUN[r + 1] : NCA;
    if (b - a < 2) return;
    g.moveTo(CA[2 * a], CA[2 * a + 1]);
    for (i = a + 1; i < b; i++) g.lineTo(CA[2 * i], CA[2 * i + 1]);
    g.moveTo(CB[2 * a], CB[2 * a + 1]);
    for (i = a + 1; i < b; i++) g.lineTo(CB[2 * i], CB[2 * i + 1]);
  }
  /** full ring as a closed sub-path in the current frame */
  function ringPath(r, y) {
    var N = ringN(r), st = RT / N, k, ix;
    for (k = 0; k < N; k++) { ix = k * st; P(r * CT[ix], y, r * SNT[ix]); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    g.closePath();
  }
  function ringDraw(r, y, fill, lwf, col) {
    g.beginPath(); ringPath(r, y);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lwf) { g.lineWidth = Math.max(LW * lwf, HW); g.strokeStyle = col || INK; g.stroke(); }
  }
  /** visible arc of a ring on a wall of normal (nr,ny), appended to the current path */
  function ringArc(r, y, nr, ny, wob) {
    var mode = visArc(nr, ny), a0, a1, closed = false;
    if (!mode) return;
    if (mode === 1) { a0 = 0; a1 = TAU; closed = true; } else { a0 = VPH - VDL; a1 = VPH + VDL; }
    var NN = ringN(r), steps = closed ? NN : Math.max(10, Math.ceil((a1 - a0) / TAU * NN)), k, th, rr_;
    for (k = 0; k <= steps; k++) {
      th = a0 + (a1 - a0) * k / steps; rr_ = wob ? r * wob(th) : r;
      P(rr_ * cos(th), y, rr_ * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY);
    }
    if (closed) g.closePath();
  }
  function wallRing(L, y, color, wf, wob, dash) {
    var j = L.idx(y), r = L.rAt(y);
    g.beginPath(); ringArc(r, y, L.nr[j], L.ny[j], wob);
    g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color;
    if (dash) { g.setLineDash([dash[0] * S, dash[1] * S]); g.stroke(); g.setLineDash([]); } else g.stroke();
  }
  var SHA = new Float64Array(160), SHB = new Float64Array(160), SHV = new Float64Array(160), SHR = new Float64Array(160), SHY = new Float64Array(160);
  /** contour hatching parallel to the left (-1) / right (+1) silhouette: kap = angular offsets (rad) inward from the silhouette */
  function shade(L, side, kap, j0, j1, color, wf) {
    var ki, j, started, axx = m1, axy = m4, nk = kap.length;
    if (sqrt(axx * axx + axy * axy) < 0.1) return;
    // per ring: the silhouette angle on the requested side (once), then every offset reuses it
    for (j = j0; j <= j1; j++) {
      if (visArc(L.nr[j], L.ny[j]) !== 2) { SHV[j] = 0; continue; }
      var r = L.r[j], y = L.y[j], a1 = VPH - VDL, a2 = VPH + VDL;
      P(0, y, 0); var cx = PX, cy = PY;
      P(r * cos(a1), y, r * sin(a1));
      var leftIs1 = (PX - cx) * axy - (PY - cy) * axx < 0;
      SHV[j] = VDL; SHA[j] = (side < 0) === leftIs1 ? a1 : a2; SHB[j] = (side < 0) === leftIs1 ? 1 : -1;
    }
    g.beginPath();
    for (ki = 0; ki < nk; ki++) {
      started = false;
      for (j = j0; j <= j1; j++) {
        if (SHV[j] < kap[ki] + 0.12) { started = false; continue; }
        var th = SHA[j] + SHB[j] * kap[ki];
        P(L.r[j] * cos(th), L.y[j], L.r[j] * sin(th));
        if (started) g.lineTo(PX, PY); else { g.moveTo(PX, PY); started = true; }
      }
    }
    g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color; g.stroke();
  }
  /** meridian lines at angles ths over ring range, only where facing the viewer */
  function meridians(L, ths, j0, j1, color, wf) {
    var ti, j, started;
    g.beginPath();
    for (ti = 0; ti < ths.length; ti++) {
      started = false;
      for (j = j0; j <= j1; j++) {
        var th = ths[ti], nz = m6 * L.nr[j] * cos(th) + m7 * L.ny[j] + m8 * L.nr[j] * sin(th);
        if (nz < 0.05) { started = false; continue; }
        P(L.r[j] * cos(th), L.y[j], L.r[j] * sin(th));
        if (started) g.lineTo(PX, PY); else { g.moveTo(PX, PY); started = true; }
      }
    }
    g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color; g.stroke();
  }
  function nzAt(nr, ny, th) { return m6 * nr * cos(th) + m7 * ny + m8 * nr * sin(th); }
  var ROOTS = [0, 0, 0, 0];
  /** outline arcs of a crease ring between two faces with (r,y)-normals n1 / n2: the part of the ring where one face
      looks at the viewer and the other one away (appended to the current path) */
  function creaseArcs(r, y, nr1, ny1, nr2, ny2) {
    var nrt = 0, i, k, A, B, D, R, ph, d, rt = ROOTS, tmp, nr, ny;
    for (k = 0; k < 2; k++) {
      nr = k ? nr2 : nr1; ny = k ? ny2 : ny1;
      A = m6 * nr; B = m8 * nr; D = m7 * ny; R = sqrt(A * A + B * B);
      if (R > 1e-6 && abs(D) < R) { ph = atan2(B, A); d = acos(-D / R); rt[nrt++] = U.mod(ph - d, TAU); rt[nrt++] = U.mod(ph + d, TAU); }
    }
    if (nrt === 0) {
      if ((nzAt(nr1, ny1, 0) > 0) !== (nzAt(nr2, ny2, 0) > 0)) { var N2 = ringN(r), st2 = RT / N2; for (k = 0; k < N2; k++) { P(r * CT[k * st2], y, r * SNT[k * st2]); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); } g.closePath(); }
      return;
    }
    for (i = 1; i < nrt; i++) { tmp = rt[i]; k = i - 1; while (k >= 0 && rt[k] > tmp) { rt[k + 1] = rt[k]; k--; } rt[k + 1] = tmp; }
    for (i = 0; i < nrt; i++) {
      var a0 = rt[i], a1 = i + 1 < nrt ? rt[i + 1] : rt[0] + TAU, am = (a0 + a1) / 2;
      if ((nzAt(nr1, ny1, am) > 0) === (nzAt(nr2, ny2, am) > 0)) continue;
      var steps = Math.max(3, Math.ceil((a1 - a0) / TAU * ringN(r))), q, th;
      for (q = 0; q <= steps; q++) { th = a0 + (a1 - a0) * q / steps; P(r * cos(th), y, r * sin(th)); if (q) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    }
  }
  function capDraw(c, fill) { ringDraw(c.r, c.y, c.fill === undefined ? fill : c.fill, c.w === undefined ? 1 : c.w, c.c); if (c.after) c.after(); }
  /** draw a surface of revolution (white body, exact outline).  o: {fill, w, c, top:{r,y,fill,w,after}, bot:{...}, decor:fn, j0, j1}
      top / bot describe the flat end faces (rim / base).  A cap that faces the viewer is drawn as a full ellipse after
      the body (and `after()` is called for its interior); a cap that faces away only contributes its silhouette arc. */
  function drawLathe(L, o) {
    o = o || {};
    var top = o.top, bot = o.bot, topFacing = -m7 > 0, botFacing = m7 > 0, fill = o.fill === undefined ? PAPER : o.fill;
    var n = L.n, j, i, ok = buildChains(L, o.j0, o.j1);
    if (fill) {
      g.fillStyle = fill;
      if (ok) { for (i = 0; i < NRUN; i++) { var rb = i + 1 < NRUN ? CRUN[i + 1] : NCA; if (rb - CRUN[i] < 2) continue; g.beginPath(); runPoly(i); g.fill(); } }
      var stride = Math.max(3, Math.round(n / 6)), nf = 0;
      for (j = 0; j < n; j++) {
        if (L.r[j] < 1e-4 || (j === 0 && o.noFillTop) || (j === n - 1 && o.noFillBot)) continue;
        var crease = j < n - 1 && L.r[j] === L.r[j + 1] && L.y[j] === L.y[j + 1];
        if (j === 0 || j === n - 1 || crease || (j % stride === 0 && nf < 5 && (!ok || visArc(L.nr[j], L.ny[j]) !== 2))) { if (j % stride === 0) nf++; g.beginPath(); ringPath(L.r[j], L.y[j]); g.fill(); }
      }
    }
    g.lineWidth = LW * (o.w || 1); g.strokeStyle = o.c || INK;
    g.beginPath();
    if (ok) for (j = 0; j < NRUN; j++) runStrokes(j);
    for (j = 0; j < n - 1; j++) if (L.r[j] === L.r[j + 1] && L.y[j] === L.y[j + 1] && L.r[j] > 1e-4) creaseArcs(L.r[j], L.y[j], L.nr[j], L.ny[j], L.nr[j + 1], L.ny[j + 1]);
    if (top && !topFacing) creaseArcs(top.r, top.y, L.nr[0], L.ny[0], 0, -1);
    if (bot && !botFacing) creaseArcs(bot.r, bot.y, L.nr[n - 1], L.ny[n - 1], 0, 1);
    g.stroke();
    if (o.decor) o.decor();
    if (top && topFacing) capDraw(top, fill);
    if (bot && botFacing) capDraw(bot, fill);
  }

  /** variable width handle / tube along a 3D centre line (array of [x,y,z]); fill + two edge strokes */
  var TLX = new Float64Array(64), TLY = new Float64Array(64), TRX = new Float64Array(64), TRY = new Float64Array(64), TX = new Float64Array(64), TY = new Float64Array(64);
  function tube(path, wfn, fill, wf) {
    var n = path.length, i, Lx = TLX, Ly = TLY, Rx = TRX, Ry = TRY, X = TX, Y = TY;
    for (i = 0; i < n; i++) { P(path[i][0], path[i][1], path[i][2]); X[i] = PX; Y[i] = PY; }
    for (i = 0; i < n; i++) {
      var a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1, dx = X[b] - X[a], dy = Y[b] - Y[a], d = sqrt(dx * dx + dy * dy) || 1;
      var w = wfn(i / (n - 1)) * S * 0.5;
      Lx[i] = X[i] - dy / d * w; Ly[i] = Y[i] + dx / d * w; Rx[i] = X[i] + dy / d * w; Ry[i] = Y[i] - dx / d * w;
    }
    g.beginPath(); g.moveTo(Lx[0], Ly[0]);
    for (i = 1; i < n; i++) g.lineTo(Lx[i], Ly[i]);
    for (i = n - 1; i >= 0; i--) g.lineTo(Rx[i], Ry[i]);
    g.closePath(); g.fillStyle = fill || PAPER; g.fill();
    g.beginPath(); g.moveTo(Lx[0], Ly[0]); for (i = 1; i < n; i++) g.lineTo(Lx[i], Ly[i]);
    g.moveTo(Rx[0], Ry[0]); for (i = 1; i < n; i++) g.lineTo(Rx[i], Ry[i]);
    g.lineWidth = LW * (wf || 1); g.strokeStyle = INK; g.stroke();
  }
  function bez3(p0, p1, p2, p3, n) {
    var o = [], i, t, u;
    for (i = 0; i <= n; i++) {
      t = i / n; u = 1 - t;
      o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1], u * u * u * p0[2] + 3 * u * u * t * p1[2] + 3 * u * t * t * p2[2] + t * t * t * p3[2]]);
    }
    return o;
  }

  /* ======================================================================================================
     5. Steam: tapered wisps that rise from a point, curl and dissolve (3D, follows the prop's rotation)
     ====================================================================================================== */
  var SPX = new Float64Array(40), SPY = new Float64Array(40), SPW = new Float64Array(40), SLX = new Float64Array(40), SLY = new Float64Array(40), SRX = new Float64Array(40), SRY = new Float64Array(40);
  /** Wisps rising from the model point (x0,y0,z0): n curls `spread` apart, H high, peak width wmax (in outline weights).
      Each wisp is born thin at the mouth of the vessel, swells while it rises along a lazy S-curve, then thins out and
      dissolves at the top.  The wisps are built in screen space and always rise up the screen (leaning only a little with
      the vessel), so steam never "falls" when the prop tumbles. */
  function steam(x0, y0, z0, H, n, spread, t, seed, wmax) {
    P(x0, y0, z0);
    var bx0 = PX, by0 = PY, sc = S * CAM / (CAM - PZ), ux = -m1, uy = -m4, ul = sqrt(ux * ux + uy * uy), k, i, N = 28;
    if (ul > 1e-3) { ux /= ul; uy /= ul; } else { ux = 0; uy = -1; }
    var dx = 0.35 * ux * Math.min(1, ul * 1.6), dy = 0.35 * uy * Math.min(1, ul * 1.6) - 1, dl = sqrt(dx * dx + dy * dy);
    dx /= dl; dy /= dl;
    var lx = -dy, ly = dx;
    for (k = 0; k < n; k++) {
      var T = 5.0 + 1.2 * h01(seed, k), c = frac(t / T + k / n + 0.15 * h01(seed, k + 10));
      var b = sstep(0, 0.42, c), a = sstep(0.52, 1.0, c) * 0.85, len = b - a;
      if (len < 0.05) continue;
      var peak = LW * wmax * sstep(0, 0.16, c) * (1 - sstep(0.8, 1.0, c)) * Math.pow(Math.min(1, len / 0.5), 1.4);
      var ph = h01(seed, k + 20) * TAU, dir = k % 2 ? -1 : 1, off = (k - (n - 1) / 2) * spread * 1.5;
      for (i = 0; i < N; i++) {
        var u = i / (N - 1), v = a + (b - a) * u, env = 0.14 + 0.86 * Math.pow(v, 0.9), ang = TAU * (1.1 * v - 0.16 * t * dir) + ph;
        var along = v * H * sc, side = (off + spread * env * sin(ang) + spread * 0.5 * v * dir) * sc;
        SPX[i] = bx0 + dx * along + lx * side; SPY[i] = by0 + dy * along + ly * side;
        SPW[i] = peak * Math.pow(sin(PI * (0.02 + 0.96 * u)), 0.8);
      }
      var Lx = SLX, Ly = SLY, Rx = SRX, Ry = SRY;
      for (i = 0; i < N; i++) {
        var p0 = i > 0 ? i - 1 : 0, p1 = i < N - 1 ? i + 1 : N - 1, ex = SPX[p1] - SPX[p0], ey = SPY[p1] - SPY[p0], d = sqrt(ex * ex + ey * ey) || 1, w = SPW[i] * 0.5;
        Lx[i] = SPX[i] - ey / d * w; Ly[i] = SPY[i] + ex / d * w; Rx[i] = SPX[i] + ey / d * w; Ry[i] = SPY[i] - ex / d * w;
      }
      g.beginPath(); g.moveTo(Lx[0], Ly[0]);
      for (i = 1; i < N; i++) g.lineTo(Lx[i], Ly[i]);
      for (i = N - 1; i >= 0; i--) g.lineTo(Rx[i], Ry[i]);
      g.closePath(); g.fillStyle = INK; g.fill();
    }
  }

  /* ======================================================================================================
     6. Hand-drawn sketches that "draw themselves" on the laptop / iPad screens
     ====================================================================================================== */
  function axBox(x, y, w, h, d, hatch) {
    var dx = d * 0.62, dy = d * 0.36, o = [];
    o.push([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);
    o.push([[x, y + h], [x + dx, y + h + dy], [x + w + dx, y + h + dy], [x + w, y + h]]);
    o.push([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy]]);
    if (hatch) for (var i = 1; i <= hatch; i++) { var f = i / (hatch + 1); o.push([[x + w + dx * f, y + dy * f + h * 0.02], [x + w + dx * f, y + dy * f + h * 0.98]]); }
    return o;
  }
  function mkSketch(polys) {
    var L = [], tot = 0, i, k;
    for (i = 0; i < polys.length; i++) {
      var len = 0; for (k = 1; k < polys[i].length; k++) len += Math.hypot(polys[i][k][0] - polys[i][k - 1][0], polys[i][k][1] - polys[i][k - 1][1]);
      L.push(len); tot += len;
    }
    return { p: polys, L: L, tot: tot };
  }
  // abstract screen sketches (no icons, no buildings, no overlapping circles): a family of flowing contour lines under a rule, and nested open arcs beside
  // graduated lines.  Open curves only (nothing closes into a ring), so no Venn / logo reading at any size.
  function wave(y0, amp, k, ph, x0, x1, n) { var o = [], i, x; for (i = 0; i <= n; i++) { x = x0 + (x1 - x0) * i / n; o.push([x, y0 + amp * Math.sin(k * x + ph) * (0.55 + 0.45 * Math.cos(1.3 * x + ph * 0.6))]); } return o; }
  function arcP(cx, cy, r, a0, a1, n) { var o = [], i, a; for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; o.push([cx + r * cos(a), cy + r * sin(a)]); } return o; }
  var SKETCHES = [
    mkSketch((function () {
      var o = [[[-0.96, -0.62], [0.96, -0.62]]];
      o.push(wave(-0.3, 0.2, 2.6, 0.2, -0.92, 0.92, 30));
      o.push(wave(-0.05, 0.22, 2.6, 0.75, -0.92, 0.92, 30));
      o.push(wave(0.2, 0.2, 2.6, 1.3, -0.92, 0.92, 30));
      o.push(wave(0.45, 0.15, 2.6, 1.85, -0.92, 0.92, 30));
      return o;
    })()),
    mkSketch((function () {
      var o = [[[-0.96, 0.62], [0.96, 0.62]]];
      o.push(arcP(-0.5, 0.42, 0.2, Math.PI * 1.02, Math.PI * 1.98, 12));
      o.push(arcP(-0.5, 0.42, 0.4, Math.PI * 1.04, Math.PI * 1.96, 16));
      o.push(arcP(-0.5, 0.42, 0.6, Math.PI * 1.08, Math.PI * 1.92, 20));
      o.push([[0.0, -0.6], [0.9, -0.6]]);
      o.push([[0.0, -0.3], [0.7, -0.3]]);
      o.push([[0.0, 0.0], [0.5, 0.0]]);
      o.push([[0.0, 0.3], [0.3, 0.3]]);
      return o;
    })()),
  ];
  /** draw the part [a,b] (0..1 of the total length) of a sketch in the current frame; (u,v) -> P(ox+u*sx, oy+v*sy, z). pen: tip dot at b */
  function drawSketch(sk, a, b, ox, oy, sx, sy, z, color, wf, pen) {
    var A = a * sk.tot, B = b * sk.tot, acc = 0, i, k, any = false, penx = 0, peny = 0;
    if (B - A <= 1e-6) return;
    g.beginPath();
    for (i = 0; i < sk.p.length; i++) {
      var pl = sk.p[i], pos = acc, started = false;
      for (k = 1; k < pl.length; k++) {
        var x0 = pl[k - 1][0], y0 = pl[k - 1][1], x1 = pl[k][0], y1 = pl[k][1], seg = Math.hypot(x1 - x0, y1 - y0), s0 = pos, s1 = pos + seg;
        pos = s1;
        if (s1 <= A || s0 >= B || seg === 0) continue;
        var t0 = s0 >= A ? 0 : (A - s0) / seg, t1 = s1 <= B ? 1 : (B - s0) / seg;
        if (!started) { P(ox + (x0 + (x1 - x0) * t0) * sx, oy + (y0 + (y1 - y0) * t0) * sy, z); g.moveTo(PX, PY); started = true; }
        P(ox + (x0 + (x1 - x0) * t1) * sx, oy + (y0 + (y1 - y0) * t1) * sy, z); g.lineTo(PX, PY); penx = PX; peny = PY; any = true;
        if (t1 < 1) break;
      }
      acc += sk.L[i];
      if (acc >= B) break;
    }
    if (any) { g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color; g.stroke(); }
    if (any && pen && b < 0.999) { g.fillStyle = INK; g.beginPath(); g.arc(penx, peny, Math.max(LW * 0.5, 1.1), 0, TAU); g.fill(); }
  }
  /** loop: draws itself (0.02..0.62 of a 9 s cycle), holds, erases from the start (0.9..1) */
  function sketchProg(t, seed) {
    var ph = frac(t / 9 + seed * 0.173);
    return { a: sstep(0.9, 1.0, ph), b: sstep(0.02, 0.62, ph) };
  }

  /* ======================================================================================================
     7. Registration wrapper (view setup, model cache, group alpha)
     ====================================================================================================== */
  /** Soft limit of how edge-on an object may get: u = M * axis is the object's main axis in view space, e = its elevation out of
      the screen plane.  e is smoothly kept inside [min, max] (|e| when sym) by tilting the whole object about the screen
      axis perpendicular to u's on-screen direction (so nothing ever collapses to a line, and the on-screen direction of the axis is unchanged). */
  function softPlus(x) { return x > 4 ? x : 0.14 * Math.log(1 + Math.exp(x / 0.14)); }
  function limitTilt(M, lim) {
    var a = lim.axis, ux = M[0] * a[0] + M[1] * a[1] + M[2] * a[2], uy = M[3] * a[0] + M[4] * a[1] + M[5] * a[2], uz = M[6] * a[0] + M[7] * a[1] + M[8] * a[2];
    var cxy = sqrt(ux * ux + uy * uy);
    if (cxy < 1e-3) return M;
    var e = Math.asin(clamp(uz, -1, 1)), sg = 1, e2;
    if (lim.sym && e < 0) { sg = -1; e = -e; }
    e2 = e;
    if (lim.min !== undefined) e2 = lim.min + softPlus(e2 - lim.min);
    if (lim.max !== undefined) e2 = lim.max - softPlus(lim.max - e2);
    var D = (e - e2) * sg;
    if (abs(D) < 1e-5) return M;
    var dx = ux / cxy, dy = uy / cxy, ax = -dy, ay = dx, c = cos(D), s = sin(D), k = 1 - c;
    // Rodrigues about (ax, ay, 0)
    var R = [c + k * ax * ax, k * ax * ay, s * ay, k * ax * ay, c + k * ay * ay, -s * ax, -s * ay, s * ax, c];
    return mul3(R, M);
  }

  var NAMES = [], OPTS = {};
  var OFF = null;
  function drawGrouped(opt, c, p, alpha) {
    var tr = c.getTransform ? c.getTransform() : null, k = tr ? sqrt(abs(tr.a * tr.d - tr.b * tr.c)) : 1;
    if (!(k > 0)) k = 1;
    var ext = p.s * 2.4, W = Math.ceil(ext * k), Hh = W;
    if (W > 2400) { k *= 2400 / W; W = Hh = 2400; }
    if (!OFF) OFF = document.createElement('canvas');
    if (OFF.width !== W || OFF.height !== Hh) { OFF.width = W; OFF.height = Hh; }
    var o = OFF.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, Hh); o.setTransform(k, 0, 0, k, W / 2, Hh / 2);
    render(opt, o, p);
    c.save(); c.globalAlpha *= alpha; c.drawImage(OFF, 0, 0, W, Hh, -W / (2 * k), -Hh / (2 * k), W / k, Hh / k); c.restore();
  }
  function render(opt, c, p) {
    var rot = p.rot || [0, 0, 0], b = opt.base || [0, 0, 0], key = opt.vkey ? opt.vkey(p.seed || 0) : 0;
    if (!opt._cache) opt._cache = {};
    var model = opt._cache[key];
    if (!model) model = opt._cache[key] = opt.build(key, p.seed || 0);
    var M = mul3(eul3(rot[0] || 0, rot[1] || 0, rot[2] || 0), mul3(rotZ3(b[2]), mul3(rotX3(b[0]), rotY3(b[1])))), cen = opt.cen || [0, 0];
    if (opt.lim) M = limitTilt(M, opt.lim);
    g = c; S = p.s * (opt.k || 1);
    var lwm = p.lw === undefined ? 1 : p.lw;
    LW = clamp(1.2 + p.s * 0.0072, 1.9, 3.0) * lwm; HW = 0.85 * lwm;
    m0 = M[0]; m1 = M[1]; m2 = M[2]; m3 = M[3]; m4 = M[4]; m5 = M[5]; m6 = M[6]; m7 = M[7]; m8 = M[8]; X0 = cen[0]; Y0 = cen[1]; Z0 = 0;
    frameStack.length = 0; QN = 0; LAYS = -m7 >= 0 ? 100 : -100; TT = p.t || 0; SEED = p.seed || 0;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.setLineDash([]);
    opt.draw(model, p.t || 0, p.seed || 0, p);
    flush();
    c.restore();
  }
  function reg(name, opt) {
    NAMES.push(name); OPTS[name] = opt;
    GA.props.register(name, {
      draw: function (c, p) {
        var a = p.alpha === undefined ? 1 : p.alpha;
        if (a <= 0.004) return;
        if (a < 0.996) drawGrouped(opt, c, p, a); else render(opt, c, p);
      },
      box: opt.box, tags: opt.tags,
    });
  }

  /* ------------------------------------------------------------------------------------------------------
     (props follow)
     ------------------------------------------------------------------------------------------------------ */
  /* ======================================================================================================
     chaiCup : porcelain cup + saucer + steam
     ====================================================================================================== */
  function buildCup() {
    return {
      saucer: lathe([[0.5, 0], [0.503, 0.011], [0.478, 0.031], [0.4, 0.05], [0.28, 0.063], [0.19, 0.07], [0.16, 0.075, 1]]),
      cup: lathe([[0.3, -0.23], [0.299, -0.205], [0.288, -0.15], [0.262, -0.088], [0.215, -0.034], [0.158, 0.008], [0.124, 0.034], [0.118, 0.044, 1]]),
      handle: bez3([0.285, -0.197, 0], [0.43, -0.23, 0], [0.446, -0.042, 0], [0.236, -0.072, 0], 18),
    };
  }
  function cupSaucer(m) {
    drawLathe(m.saucer, {
      top: { r: 0.5, y: 0, after: function () { ringDraw(0.455, 0.002, null, 0.4, G2); ringDraw(0.215, 0.022, G4, 0.55); } },
      bot: { r: 0.16, y: 0.075 },
    });
  }
  function cupSpices() {
    if (-m7 <= 0) return;
    var y = 0.004, k, ph = -0.5;
    // star anise
    g.beginPath();
    for (k = 0; k < 16; k++) { var rr_ = k % 2 ? 0.02 : 0.05, a = ph + k * PI / 8; P(-0.3 + rr_ * cos(a), y, 0.22 + rr_ * sin(a)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    g.closePath(); g.fillStyle = PAPER; g.fill(); g.lineWidth = Math.max(LW * 0.5, HW); g.strokeStyle = INK; g.stroke();
    g.beginPath();
    for (k = 0; k < 8; k++) { var a2 = ph + (2 * k + 1) * PI / 8; P(-0.3, y, 0.22); g.moveTo(PX, PY); P(-0.3 + 0.03 * cos(a2), y, 0.22 + 0.03 * sin(a2)); g.lineTo(PX, PY); }
    g.lineWidth = Math.max(LW * 0.28, HW); g.strokeStyle = G1; g.stroke();
    // two cardamom pods
    var pods = [[0.27, 0.3, 0.6], [0.34, 0.25, 1.2]], i, j;
    for (i = 0; i < 2; i++) {
      g.beginPath();
      for (j = 0; j < 14; j++) { var t = TAU * j / 14, px = 0.034 * cos(t), pz = 0.02 * sin(t), c = cos(pods[i][2]), s_ = sin(pods[i][2]); P(pods[i][0] + px * c - pz * s_, y, pods[i][1] + px * s_ + pz * c); if (j) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
      g.closePath(); g.fillStyle = G4; g.fill(); g.lineWidth = Math.max(LW * 0.45, HW); g.strokeStyle = INK; g.stroke();
      g.beginPath();
      for (j = -1; j <= 1; j++) { var c2 = cos(pods[i][2]), s2 = sin(pods[i][2]); P(pods[i][0] - 0.03 * c2 + j * 0.008 * -s2, y, pods[i][1] - 0.03 * s2 + j * 0.008 * c2); g.moveTo(PX, PY); P(pods[i][0] + 0.03 * c2 + j * 0.008 * -s2, y, pods[i][1] + 0.03 * s2 + j * 0.008 * c2); g.lineTo(PX, PY); }
      g.lineWidth = Math.max(LW * 0.25, HW); g.strokeStyle = G1; g.stroke();
    }
  }
  function cupInterior() {
    ringDraw(0.287, -0.23, G4, 0.5);
    g.save(); g.beginPath(); ringPath(0.287, -0.23); g.clip();
    ringDraw(0.272, -0.206, INK, 0);
    g.beginPath();
    for (var k = 0; k <= 10; k++) { var th = 3.55 + 0.95 * k / 10; P(0.205 * cos(th), -0.206, 0.205 * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    g.lineWidth = Math.max(LW * 0.4, HW); g.strokeStyle = PAPER; g.stroke();
    g.restore();
  }
  function cupBody(m) {
    var L = m.cup;
    pushFrame(ID3, 0, -0.022, 0);
    var hf = m6 > 0, hw = function (u) { return 0.034 * (0.72 + 0.55 * sin(PI * u)); };
    if (!hf) tube(m.handle, hw, PAPER, 1);
    drawLathe(L, {
      top: { r: 0.3, y: -0.23, after: cupInterior }, bot: { r: 0.118, y: 0.044 },
      decor: function () {
        wallRing(L, -0.172, INK, 0.45); wallRing(L, -0.15, INK, 0.7, null, [0.001, 0.0205]); wallRing(L, -0.128, INK, 0.45);
        shade(L, 1, [0.22, 0.42], L.idx(-0.2), L.n - 1, G3, 0.45);
      },
    });
    if (hf) tube(m.handle, hw, PAPER, 1);
    popFrame();
  }
  reg('chaiCup', {
    base: [-0.5, -0.45, 0], lim: { axis: [0, -1, 0], min: 0.34 }, k: 0.990, box: [0.99, 0.95], cen: [0.003, -0.038], tags: ['chai', 'cup', 'drink', 'work'],
    build: buildCup,
    draw: function (m, t, seed) {
      pushFrame(ID3, 0, 0.25, 0);
      if (-m7 > 0) { cupSaucer(m); cupSpices(); cupBody(m); } else { cupBody(m); cupSaucer(m); }
      steam(0, -0.272, 0, 0.42, 3, 0.055, t, seed, 0.9);
      popFrame();
    },
  });

  /* ======================================================================================================
     chaiGlass : Indian "cutting chai" glass
     ====================================================================================================== */
  function buildGlass() {
    var gl = lathe([[0.172, -0.31], [0.171, -0.285], [0.162, -0.17], [0.146, -0.02], [0.132, 0.13], [0.124, 0.25], [0.12, 0.305, 1]]);
    var yl = -0.225, yf = 0.252, d = 0.011;
    var liq = lathe([[gl.rAt(yl) - d, yl], [gl.rAt(-0.1) - d, -0.1], [gl.rAt(0.06) - d, 0.06], [gl.rAt(0.17) - d, 0.17], [gl.rAt(yf) - d, yf, 1]]);
    var rng = U.rng(7), foam = [], k, r0 = liq.r[0];
    for (k = 0; k < 9; k++) { var a = TAU * k / 9 + rng.range(-0.2, 0.2), rg = r0 * rng.range(0.9, 0.94); foam.push([rg * cos(a), rg * sin(a), rng.range(0.008, 0.012)]); }
    return { gl: gl, liq: liq, yl: yl, yf: yf, foam: foam };
  }
  reg('chaiGlass', {
    base: [-0.5, -0.4, -0.05], lim: { axis: [0, -1, 0], min: 0.34 }, k: 1.020, box: [0.38, 0.99], cen: [0.010, 0.056], tags: ['chai', 'glass', 'drink'],
    build: buildGlass,
    draw: function (m, t, seed) {
      var gl = m.gl, liq = m.liq, yl = m.yl;
      pushFrame(ID3, 0, 0.13, 0);
      drawLathe(gl, { top: { r: 0.172, y: -0.31, after: function () { ringDraw(0.162, -0.31, null, 0.45); } }, bot: { r: 0.12, y: 0.305 } });
      drawLathe(liq, {
        fill: G3, w: 0.45, c: G1,
        top: {
          r: liq.r[0], y: yl, fill: G2, w: 0.45, c: G1, after: function () {
            ringDraw(liq.r[0] * 0.8, yl, G1, 0.3, INK);
            var i, k, f;
            for (i = 0; i < m.foam.length; i++) {
              f = m.foam[i]; g.beginPath();
              for (k = 0; k < 12; k++) { P(f[0] + f[2] * cos(TAU * k / 12), yl - 0.002, f[1] + f[2] * sin(TAU * k / 12)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
              g.closePath(); g.fillStyle = PAPER; g.fill(); g.lineWidth = Math.max(LW * 0.28, HW); g.strokeStyle = G1; g.stroke();
            }
          },
        },
        bot: { r: liq.r[liq.n - 1], y: m.yf, w: 0.4, c: G1 },
        decor: function () {
          shade(liq, 1, [0.2, 0.4, 0.62, 0.9, 1.25, 1.6, 2.0], 0, liq.n - 1, G1, 0.42);
          shade(liq, -1, [0.18, 0.4], 0, liq.n - 1, G2, 0.3);
        },
      });
      meridians(gl, [0.2, 0.75, 1.3, 1.85, 2.4, 2.95, 3.5, 4.05, 4.6, 5.15, 5.7], gl.idx(0.07), gl.idx(0.25), G2, 0.3);
      wallRing(gl, -0.285, G1, 0.35);
      shade(gl, -1, [0.7], gl.idx(-0.2), gl.idx(0.1), PAPER, 1.1);
      steam(0, -0.332, 0, 0.36, 3, 0.05, t, seed, 0.9);
      popFrame();
    },
  });

  /* ======================================================================================================
     kulhad : unglazed clay cup
     ====================================================================================================== */
  function buildKulhad() {
    var L = lathe([[0.222, -0.235], [0.221, -0.212], [0.208, -0.15], [0.186, -0.06], [0.168, 0.03], [0.152, 0.12], [0.146, 0.185], [0.156, 0.226], [0.16, 0.236, 1]]);
    var rng = U.rng(11), dots = [], k;
    for (k = 0; k < 230; k++) dots.push([-0.2 + 0.43 * Math.pow(rng.next(), 0.8), rng.range(0, TAU), rng.next(), rng.range(0.6, 1.5)]);
    return { L: L, dots: dots };
  }
  reg('kulhad', {
    base: [-0.5, -0.3, 0.04], lim: { axis: [0, -1, 0], min: 0.34 }, k: 1.163, box: [0.54, 0.99], cen: [-0.002, 0.019], tags: ['chai', 'clay', 'cup', 'drink'],
    build: buildKulhad,
    draw: function (m, t, seed) {
      var L = m.L;
      pushFrame(ID3, 0, 0.145, 0);
      drawLathe(L, {
        fill: G4,
        top: {
          r: 0.222, y: -0.235, after: function () {
            ringDraw(0.205, -0.235, G3, 0.5);
            g.save(); g.beginPath(); ringPath(0.205, -0.235); g.clip(); ringDraw(0.19, -0.202, INK, 0);
            g.beginPath();
            for (var k = 0; k <= 10; k++) { var th = 3.5 + 1.0 * k / 10; P(0.15 * cos(th), -0.202, 0.15 * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
            g.lineWidth = Math.max(LW * 0.4, HW); g.strokeStyle = PAPER; g.stroke(); g.restore();
          },
        },
        bot: { r: 0.16, y: 0.236 },
        decor: function () {
          var ys = [-0.19, -0.128, -0.082, -0.012, 0.07, 0.15], ws = [0.62, 0.34, 0.5, 0.3, 0.46, 0.34], q;
          for (q = 0; q < ys.length; q++) {
            var ph = q * 1.9 + 0.7;
            wallRing(L, ys[q], q === 0 ? INK : G1, ws[q], function (th) { return 1 + 0.007 * sin(2 * th + ph) + 0.004 * sin(5 * th + ph * 2); });
          }
          shade(L, 1, [0.2, 0.36, 0.56, 0.8], L.idx(-0.2), L.n - 1, G2, 0.3);
          // clay stipple, denser on the shaded side / near the foot
          var i, d, y, th2, r, j, nz, ux, rad, c0;
          P(0, 0, 0); c0 = PX;
          g.fillStyle = G1; g.beginPath();
          for (i = 0; i < m.dots.length; i++) {
            d = m.dots[i]; y = d[0]; th2 = d[1]; j = L.idx(y); r = L.rAt(y);
            nz = m6 * L.nr[j] * cos(th2) + m7 * L.ny[j] + m8 * L.nr[j] * sin(th2);
            if (nz < 0.12) continue;
            P(r * cos(th2), y, r * sin(th2)); ux = (PX - c0) / (0.2 * S);
            rad = LW * 0.4 * d[3] * sstep(0.12, 0.4, nz) * sstep(d[2] * 1.7 - 1.0, d[2] * 1.7 - 0.4, ux);
            if (rad < 0.15) continue;
            g.moveTo(PX + rad, PY); g.arc(PX, PY, rad, 0, TAU);
          }
          g.fill();
        },
      });
      steam(0, -0.262, 0, 0.34, 3, 0.05, t, seed, 0.9);
      popFrame();
    },
  });

  /* ======================================================================================================
     laptop : open laptop with keys and a sketch that draws itself on the screen
     ====================================================================================================== */
  function buildLaptop() {
    var W = 0.5, D = 0.34, T = 0.038, al = 0.3, LH = 0.66, TL = 0.03, faces = [];
    var ca = cos(al), sa = sin(al), lidM = [1, 0, 0, 0, -ca, sa, 0, -sa, -ca], lidT = [0, 0, -D + 0.022];
    var base = prism(rr(-W, -D, W, D, 0.03, 3), 'xz', 0, T, { tone: 1 });
    var deck = base.cap0, Y = function (x, z) { return [x, 0, z]; };
    lines(deck, INK, 0.5, [map2(rr(-0.425, -0.285, 0.425, 0.04, 0.012, 2), Y)], { closed: true, fill: G4 });
    var rowsDef = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.4, 1, 1, 1, 1, 1, 1, 1, 1.8], [1.3, 1.3, 1.3, 5, 1.3, 1.3]];
    var keys = [], r, c, x, tot, unit, zA, zB, x0, x1;
    for (r = 0; r < 4; r++) {
      tot = 0; for (c = 0; c < rowsDef[r].length; c++) tot += rowsDef[r][c];
      unit = 0.84 / tot; x = -0.42; zA = -0.278 + r * 0.078; zB = zA + 0.056;
      for (c = 0; c < rowsDef[r].length; c++) {
        x0 = x + 0.004; x1 = x + rowsDef[r][c] * unit - 0.004; x += rowsDef[r][c] * unit;
        keys.push(map2([[x0, zA], [x1, zA], [x1, zB], [x0, zB]], Y));
      }
    }
    lines(deck, INK, 0.3, keys, { closed: true, fill: PAPER });
    lines(deck, INK, 0.55, [map2(rr(-0.15, 0.105, 0.15, 0.265, 0.02, 3), Y)], { closed: true, fill: PAPER });
    lines(deck, INK, 0, [map2([[-0.4, -D + 0.004], [0.4, -D + 0.004], [0.4, -D + 0.03], [-0.4, -D + 0.03]], Y)], { closed: true, fill: INK });
    faces.push(base.cap0, base.cap1); pushAll(faces, base.sides);
    var lidFront = null;
    withXf(lidM, lidT, function () {
      var lid = prism(rr(-W, 0, W, LH, 0.028, 3), 'xy', 0, TL, { tone: 1 });
      var fr = lid.cap0, bk = lid.cap1, Z0_ = function (x, y) { return [x, y, 0]; }, Z1_ = function (x, y) { return [x, y, TL]; };
      lines(fr, INK, 0.55, [map2(rr(-0.455, 0.07, 0.455, 0.615, 0.012, 2), Z0_)], { closed: true, fill: PAPER });
      lines(fr, G2, 0.28, [map2(rr(-0.443, 0.082, 0.443, 0.603, 0.008, 2), Z0_)], { closed: true });
      lines(fr, INK, 0.3, [map2(circ2(0, 0.64, 0.0065, 8), Z0_)], { closed: true, fill: INK });
      lines(bk, INK, 0.5, [map2(circ2(0, 0.33, 0.055, 24), Z1_)], { closed: true });
      lines(bk, INK, 0.5, [map2(circ2(0, 0.33, 0.012, 10), Z1_)], { closed: true, fill: INK });
      lidFront = fr;
      faces.push(lid.cap0, lid.cap1); pushAll(faces, lid.sides);
    });
    lidFront.after = function () {
      var pr = sketchProg(TT, SEED), sk = SKETCHES[SEED % 2];
      pushFrame(lidM, lidT[0], lidT[1], lidT[2]);
      drawSketch(sk, pr.a, pr.b, 0, 0.345, 0.4, 0.3, 0, INK, 0.42, pr.a < 0.01);
      popFrame();
    };
    return { faces: faces };
  }
  reg('laptop', {
    base: [-0.5, 0.5, 0], lim: { axis: [0, -1, 0], min: 0.3 }, k: 0.766, box: [1.00, 0.93], cen: [0.010, -0.036], tags: ['laptop', 'work', 'design', 'screen'],
    build: buildLaptop,
    draw: function (m) { pushFrame(ID3, 0, 0.296, 0.1); qAll(m.faces); flush(); popFrame(); },
  });

  /* ======================================================================================================
     books
     ====================================================================================================== */
  var BA = 0.46, BD = 0.66, BT = 0.075, BM = 0.035, BC = 0.022; // page half width, page depth, block thickness, cover margin, cover thickness
  function pageTop(u) { return BT * (0.10 + 0.90 * (1 - Math.pow(1 - u, 2.1))); }
  function pgPt(sx, u, w) { return [sx * u * BA, -pageTop(u), (w - 0.5) * BD]; }
  function pgLine(sx, ua, ub, w, n) { var o = [], i; for (i = 0; i <= n; i++) o.push(pgPt(sx, ua + (ub - ua) * i / n, w)); return o; }
  function pgRect(sx, ua, ub, wa, wb) { return pgLine(sx, ua, ub, wa, 6).concat(pgLine(sx, ub, ua, wb, 6)); }

  function buildBookOpen(key) {
    var faces = [], rng = U.rng(100 + key * 31), sx, i, k, N = 12, hw = BD / 2;
    var cover = box(-BA - BM, 0, -hw - BM, BA + BM, BC, hw + BM, { lay: 0, tone: 1 });
    lines(cover.ny, G2, 0.3, [[[-BA - BM + 0.012, 0, -hw - BM + 0.012], [BA + BM - 0.012, 0, -hw - BM + 0.012], [BA + BM - 0.012, 0, hw + BM - 0.012], [-BA - BM + 0.012, 0, hw + BM - 0.012]]], { closed: true });
    pushAll(faces, cover);
    pushAll(faces, box(-0.034, 0.002, hw + BM - 0.004, 0.034, BC * 0.92, hw + BM + 0.02, { lay: 0, fill: G3, tone: 0 }));
    var gap = BT / 10.5;
    for (sx = -1; sx <= 1; sx += 2) {
      var far = [], near = [];
      for (i = 0; i <= N; i++) { far.push(pgPt(sx, i / N, 0)); near.push(pgPt(sx, i / N, 1)); }
      var top = mk(far.concat(near.slice().reverse()), [-sx * 0.35, -1, 0], { lay: 1 });
      // ---- text
      var rows = [], heads = [], q, w, ub, par = 0;
      if (sx < 0) {
        lines(top, INK, 0.5, [pgRect(sx, 0.16, 0.5, 0.1, 0.34)], { closed: true });
        lines(top, INK, 0.34, [pgLine(sx, 0.2, 0.46, 0.17, 4), pgLine(sx, 0.2, 0.38, 0.24, 4), pgLine(sx, 0.24, 0.42, 0.3, 3)]);
        for (q = 0; q < 3; q++) rows.push(pgLine(sx, 0.6, 0.6 + (q === 2 ? 0.16 : 0.3), 0.13 + q * 0.068, 4));
        for (q = 0; q < 6; q++) { w = 0.43 + q * 0.086; par++; ub = (par % 3 === 0) ? 0.5 + rng.range(0, 0.15) : 0.9 - rng.range(0, 0.04); rows.push(pgLine(sx, 0.14, ub, w, 6)); }
      } else {
        heads.push(pgLine(sx, 0.15, 0.62, 0.11, 5));
        for (q = 0; q < 8; q++) { w = 0.22 + q * 0.09; ub = (q === 2 || q === 5 || q === 7) ? 0.45 + rng.range(0, 0.25) : 0.9 - rng.range(0, 0.04); rows.push(pgLine(sx, 0.14, ub, w, 6)); }
      }
      lines(top, INK, 0.4, rows);
      if (heads.length) lines(top, INK, 0.85, heads);
      faces.push(top);
      // ---- sides with page edges
      var nearP = [], farP = [];
      for (i = 0; i <= N; i++) { nearP.push([sx * (i / N) * BA, -pageTop(i / N), hw]); farP.push([sx * (i / N) * BA, -pageTop(i / N), -hw]); }
      var fN = mk(nearP.concat([[sx * BA, 0, hw], [0, 0, hw]]), [0, 0, 1], { lay: 1, tone: 0 });
      var fF = mk(farP.concat([[sx * BA, 0, -hw], [0, 0, -hw]]), [0, 0, -1], { lay: 1, tone: 0 });
      var fE = mk([[sx * BA, -BT, -hw], [sx * BA, -BT, hw], [sx * BA, 0, hw], [sx * BA, 0, -hw]], [sx, 0, 0], { lay: 1, tone: 0 });
      var ln = [], lf = [], le = [];
      for (k = 1; k <= 9; k += 2) {
        var pn = [], pf = [];
        for (i = 0; i <= N; i++) { var yy = pageTop(i / N) - k * gap; if (yy > 0.001) { pn.push([sx * (i / N) * BA, -yy, hw]); pf.push([sx * (i / N) * BA, -yy, -hw]); } }
        if (pn.length > 1) { ln.push(pn); lf.push(pf); }
        le.push([[sx * BA, -BT + k * gap, -hw], [sx * BA, -BT + k * gap, hw]]);
      }
      lines(fN, G1, 0.3, ln); lines(fF, G1, 0.3, lf); lines(fE, G1, 0.3, le);
      faces.push(fN, fF, fE);
    }
    return { faces: faces };
  }
  function leafFaces(t) { return leafFacesP(0.13 + 0.05 * sin(t * 1.25), 0.78 + 0.1 * sin(t * 1.25 + 1.1)); }
  /** one page leaf standing on the spine at base angle al0 (0 = flat on the right page, PI = flat on the left page), curled by cc along its length */
  function leafFacesP(al0, cc) {
    var Dl = BD * 0.97, M = 10, i, x = 0, y = -pageTop(0), X = [0], Y = [y], a, step = BA * 0.99 / M;
    var far = [[0, y, -Dl / 2]], near = [[0, y, Dl / 2]];
    for (i = 1; i <= M; i++) { a = al0 + cc * Math.pow((i - 0.5) / M, 1.4); x += step * cos(a); y -= step * sin(a); X.push(x); Y.push(y); far.push([x, y, -Dl / 2]); near.push([x, y, Dl / 2]); }
    var poly = far.concat(near.slice().reverse()), am = al0 + cc * 0.5;
    var fr = mk(poly, [-sin(am), -cos(am), 0], { lay: 2 }), bk = mk(poly, [sin(am), cos(am), 0], { lay: 2 });
    function lp(u, w) { var f = u * M, j = Math.min(M - 1, floor(f)), r = f - j; return [X[j] + (X[j + 1] - X[j]) * r, Y[j] + (Y[j + 1] - Y[j]) * r, (w - 0.5) * Dl]; }
    var rows = [], q, j2;
    for (q = 0; q < 5; q++) { var w = 0.13 + q * 0.17, ub = q === 4 ? 0.5 : 0.9, ln = []; for (j2 = 0; j2 <= 6; j2++) ln.push(lp(0.12 + (ub - 0.12) * j2 / 6, w)); rows.push(ln); }
    lines(fr, INK, 0.4, rows); lines(bk, G1, 0.34, rows);
    return [fr, bk];
  }
  reg('bookOpen', {
    base: [-0.72, 0.3, -0.1], lim: { axis: [0, -1, 0], min: 0.36 }, k: 0.833, box: [1.00, 0.74], cen: [-0.012, 0.033], tags: ['book', 'reading', 'work'],
    vkey: function (seed) { return seed % 3; }, build: buildBookOpen,
    draw: function (m, t) { qAll(m.faces); qAll(leafFaces(t)); flush(); },
  });

  /** closed hardcover lying flat; centre (x,y,z), rotation ry about the vertical, variant v: 0 white+label, 1 black, 2 grey band */
  function closedBook(faces, o) {
    var w = o.w, d = o.d, t = o.t, bt = Math.min(0.026, t * 0.17), ov = 0.016, v = o.v || 0, lay = o.lay || 0, c = cos(o.ry || 0), s = sin(o.ry || 0);
    withXf([c, 0, s, 0, 1, 0, -s, 0, c], [o.x || 0, o.y || 0, o.z || 0], function () {
      var x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, ytop = -t / 2, ybot = t / 2, cf = v === 1 ? INK : v === 2 ? G4 : PAPER, i, k;
      var topB = box(x0, ytop, z0, x1, ytop + bt, z1, { lay: lay, tone: 1, fill: cf });
      var botB = box(x0, ybot - bt, z0, x1, ybot, z1, { lay: lay, tone: 1, fill: cf });
      var pg = box(x0 + 0.02, ytop + bt, z0 + ov, x1 - ov, ybot - bt, z1 - ov, { lay: lay, tone: 0, edge: 0.6 });
      var sp = box(x0 - 0.012, ytop, z0, x0 + 0.03, ybot, z1, { lay: lay, tone: 1, fill: cf });
      var pgT = ytop + bt, pgB = ybot - bt, gp = (pgB - pgT) / 8, ln1 = [], ln2 = [], ln3 = [];
      for (k = 1; k < 8; k++) {
        ln1.push([[x1 - ov, pgT + k * gp, z0 + ov], [x1 - ov, pgT + k * gp, z1 - ov]]);
        ln2.push([[x0 + 0.02, pgT + k * gp, z1 - ov], [x1 - ov, pgT + k * gp, z1 - ov]]);
        ln3.push([[x0 + 0.02, pgT + k * gp, z0 + ov], [x1 - ov, pgT + k * gp, z0 + ov]]);
      }
      lines(pg.px, G1, 0.3, ln1); lines(pg.pz, G1, 0.3, ln2); lines(pg.nz, G1, 0.3, ln3);
      var Y = function (x, z) { return [x, ytop, z]; }, top = topB.ny;
      lines(top, v === 1 ? G1 : G2, 0.3, [map2([[x0 + 0.075, z0], [x0 + 0.075, z1]], Y)]);
      lines(top, v === 1 ? G1 : G2, 0.3, [map2([[x0 + 0.12, z0 + 0.04], [x1 - 0.04, z0 + 0.04], [x1 - 0.04, z1 - 0.04], [x0 + 0.12, z1 - 0.04]], Y)], { closed: true });
      var cx_ = (x0 + 0.075 + x1) / 2;
      if (v === 0) {
        lines(top, INK, 0.6, [map2(rr(cx_ - 0.17, z0 + 0.11, cx_ + 0.17, z0 + 0.3, 0.012, 2), Y)], { closed: true, fill: PAPER });
        lines(top, INK, 0.5, [map2([[cx_ - 0.1, z0 + 0.17], [cx_ + 0.1, z0 + 0.17]], Y), map2([[cx_ - 0.07, z0 + 0.235], [cx_ + 0.07, z0 + 0.235]], Y)]);
        lines(top, INK, 0.5, [map2(circ2(cx_, z1 - 0.2, 0.075, 22), Y), map2(circ2(cx_, z1 - 0.2, 0.04, 16), Y)], { closed: true });
      } else if (v === 1) {
        lines(top, PAPER, 0.5, [map2(rr(cx_ - 0.13, z0 + 0.12, cx_ + 0.13, z0 + 0.22, 0.01, 2), Y)], { closed: true });
        lines(top, G2, 0.4, [map2([[cx_ - 0.08, z0 + 0.17], [cx_ + 0.08, z0 + 0.17]], Y)]);
      } else {
        lines(top, INK, 0, [map2([[x0 + 0.12, z1 - 0.3], [x1 - 0.04, z1 - 0.3], [x1 - 0.04, z1 - 0.22], [x0 + 0.12, z1 - 0.22]], Y)], { closed: true, fill: INK });
        lines(top, INK, 0.5, [map2(circ2(cx_, z0 + 0.22, 0.07, 20), Y)], { closed: true });
        lines(top, INK, 0.4, [map2([[cx_ - 0.14, z0 + 0.09], [cx_ + 0.14, z0 + 0.09]], Y)]);
      }
      var sl = [], zz = [0.16, 0.2, d - 0.2, d - 0.16];
      for (i = 0; i < zz.length; i++) sl.push([[x0 - 0.012, ytop + 0.01, z0 + zz[i]], [x0 - 0.012, ybot - 0.01, z0 + zz[i]]]);
      lines(sp.nx, v === 1 ? G2 : INK, 0.4, sl);
      pushAll(faces, botB); pushAll(faces, pg); pushAll(faces, sp); pushAll(faces, topB);
      if (o.ribbon !== false) {
        var ym = (ytop + ybot) / 2, rx = x0 + w * 0.55;
        var rb = [[rx, ym, z1 - ov - 0.01], [rx + 0.026, ym, z1 - ov - 0.01], [rx + 0.034, ym + 0.01, z1 + 0.11], [rx + 0.004, ym + 0.012, z1 + 0.115]];
        faces.push(mk(rb, [0, -1, 0], { lay: lay, fill: v === 1 ? PAPER : INK, edge: 0.5 }), mk(rb, [0, 1, 0], { lay: lay, fill: v === 1 ? PAPER : INK, edge: 0.5 }));
      }
    });
  }
  reg('bookClosed', {
    base: [-0.7, 0.55, -0.12], lim: { axis: [0, -1, 0], min: 0.4 }, k: 0.922, box: [1.00, 0.81], cen: [0.000, -0.024], tags: ['book', 'reading', 'work'],
    vkey: function (seed) { return seed % 6; },
    build: function (key) { var f = [], sl = key >= 3; closedBook(f, { w: sl ? 0.5 : 0.64, d: sl ? 0.86 : 0.9, t: sl ? 0.11 : 0.17, v: key % 3 }); return { faces: f }; },
    draw: function (m) { qAll(m.faces); flush(); },
  });
  reg('bookStack', {
    base: [-0.62, 0.5, -0.08], lim: { axis: [0, -1, 0], min: 0.38 }, k: 0.816, box: [1.00, 0.99], cen: [0.003, 0.000], tags: ['book', 'reading', 'stack'],
    vkey: function (seed) { return seed % 2; },
    build: function (key) {
      var f = [], dims = [[0.76, 0.98, 0.2, key ? 1 : 2], [0.68, 0.9, 0.15, key ? 2 : 0], [0.72, 0.92, 0.17, key ? 0 : 1], [0.58, 0.78, 0.11, key ? 2 : 0]];
      var rys = [0.03, -0.09, 0.07, -0.13], xs = [0, 0.02, -0.025, 0.012], zs = [0, -0.015, 0.02, 0], y = 0.24, i;
      for (i = 0; i < 4; i++) { var d = dims[i]; y -= d[2] / 2; closedBook(f, { w: d[0], d: d[1], t: d[2], v: d[3], ry: rys[i], x: xs[i], z: zs[i], y: y, lay: i, ribbon: i === 1 }); y -= d[2] / 2; }
      return { faces: f };
    },
    draw: function (m) { qAll(m.faces); flush(); },
  });

  /** an open book whose pages keep flipping: two leaves swing over the spine and back (the tips lag), phase shifted, no pops */
  reg('bookFlip', {
    base: [-0.72, 0.3, -0.1], lim: { axis: [0, -1, 0], min: 0.36 }, k: 0.80, box: [1.0, 0.95], cen: [-0.012, -0.02], tags: ['book', 'reading', 'work', 'pages'],
    vkey: function (seed) { return seed % 3; }, build: buildBookOpen,
    draw: function (m, t) {
      var T = 3.6, i, u, e, ph = [0, 0.37], pk = [0.93, 0.6], fa;
      qAll(m.faces);
      for (i = 0; i < 2; i++) {
        u = frac(t / T + ph[i]); e = 0.5 - 0.5 * cos(TAU * u);
        fa = leafFacesP(0.13 + (PI - 0.26) * pk[i] * e, -0.95 * sin(TAU * u) * (0.35 + 0.65 * sin(PI * e)) + 0.12);
        qAll(fa);
      }
      flush();
    },
  });

  /** a short row of book spines standing on a line, the last one leaning on its neighbour */
  var SPI = [[0.13, 0.74, 0], [0.095, 0.62, 1], [0.16, 0.8, 2], [0.11, 0.58, 3], [0.14, 0.7, 1], [0.12, 0.6, 0]];
  function spineFace(f, x0, x1, y0, y1, z1, v) {
    var m = 0.014, hl = function (y, c, w) { lines(f, c, w, [[[x0 + m, y, z1], [x1 - m, y, z1]]]); };
    if (v === 0) {                                     // ink cover, paper bands, a small paper label
      hl(y0 + 0.06, PAPER, 0.5); hl(y0 + 0.088, PAPER, 0.5); hl(y1 - 0.088, PAPER, 0.5); hl(y1 - 0.06, PAPER, 0.5);
      lines(f, INK, 0.4, [[[x0 + m * 1.6, y0 + 0.2, z1], [x1 - m * 1.6, y0 + 0.2, z1], [x1 - m * 1.6, y0 + 0.31, z1], [x0 + m * 1.6, y0 + 0.31, z1]]], { closed: true, fill: PAPER });
    } else if (v === 1) {                              // paper cover: a heavy ink band and two thin ones
      hl(y0 + 0.07, INK, 0.5); hl(y0 + 0.095, INK, 0.5); hl(y1 - 0.09, INK, 0.5);
      lines(f, INK, 0.3, [[[x0 + m, y0 + 0.2, z1], [x1 - m, y0 + 0.2, z1], [x1 - m, y0 + 0.235, z1], [x0 + m, y0 + 0.235, z1]]], { closed: true, fill: INK });
      hl(y0 + 0.3, G1, 0.3);
    } else if (v === 2) {                              // grey cover: a dot and bands
      hl(y0 + 0.07, INK, 0.5); hl(y1 - 0.07, INK, 0.5); hl(y1 - 0.095, INK, 0.5);
      lines(f, INK, 0.5, [circ2((x0 + x1) / 2, y0 + 0.2, Math.min(0.03, (x1 - x0) * 0.3), 12).map(function (p) { return [p[0], p[1], z1]; })], { closed: true });
    } else {                                           // paper with a wide ink band in the middle and ticks
      var ym = (y0 + y1) / 2;
      lines(f, INK, 0.3, [[[x0 + m, ym - 0.05, z1], [x1 - m, ym - 0.05, z1], [x1 - m, ym + 0.05, z1], [x0 + m, ym + 0.05, z1]]], { closed: true, fill: INK });
      hl(y0 + 0.08, G1, 0.4); hl(y1 - 0.08, G1, 0.4); hl(y0 + 0.11, G1, 0.3);
    }
  }
  function buildSpines(key) {
    var faces = [], x = -0.54, base = 0.4, d = 0.46, gap = 0.004, i, sp, b, fl, X = x, cf;
    var fills = [INK, PAPER, G3, PAPER];
    for (i = 0; i < SPI.length - 1; i++) {
      sp = SPI[(i + key) % (SPI.length - 1)]; fl = fills[sp[2]];
      b = box(x, base - sp[1], -d / 2, x + sp[0], base, d / 2, { tone: 1, fill: fl });
      spineFace(b.pz, x, x + sp[0], base - sp[1], base, d / 2, sp[2]);
      pushAll(faces, b); x += sp[0] + gap;
    }
    // the leaning book: bottom-right corner pivot at (px, base), leaning left by 0.22 rad onto the neighbour
    sp = SPI[SPI.length - 1]; var ang = -0.22, c = cos(ang), s_ = sin(ang), px = x + 0.02 + sp[0] * c + 0.218 * sp[1] + 0.04, rm = [c, -s_, 0, s_, c, 0, 0, 0, 1];
    withXf(rm, [px - (c * px - s_ * base), base - (s_ * px + c * base), 0], function () {
      var x0 = px - sp[0];
      b = box(x0, base - sp[1], -d / 2, px, base, d / 2, { tone: 1, fill: fills[(key + 2) % 4] });
      spineFace(b.pz, x0, px, base - sp[1], base, d / 2, (key + 2) % 4);
      pushAll(faces, b);
    });
    return { faces: faces };
  }
  reg('bookSpines', {
    base: [-0.4, 0.26, 0], lim: { axis: [0, -1, 0], min: 0.3 }, k: 0.95, box: [1.0, 0.8], cen: [0, 0], tags: ['book', 'reading', 'shelf'],
    vkey: function (seed) { return seed % 2; }, build: buildSpines,
    draw: function (m) {
      g.beginPath(); P(-0.58, 0.4, 0.3); g.moveTo(PX, PY); P(0.62, 0.4, 0.3); g.lineTo(PX, PY);
      g.lineWidth = Math.max(LW * 0.35, HW); g.strokeStyle = G2; g.stroke();
      qAll(m.faces); flush();
    },
  });

  /* ======================================================================================================
     ipad : tablet + stylus with a sketch that draws itself
     ====================================================================================================== */
  var STY_BODY = lathe([[0.0145, -0.3], [0.0145, 0.245, 1], [0.0145, 0.245], [0.0085, 0.28], [0.0034, 0.3]], 4);
  var STY_NIB = lathe([[0.0042, 0.288], [0.0, 0.3]], 2);
  function drawStylus(cx, cy, cz, dx, dy, dz) {
    pushFrame(basisY(dx, dy, dz), cx, cy, cz);
    drawLathe(STY_BODY, { top: { r: 0.0145, y: -0.3 }, decor: function () { shade(STY_BODY, 1, [0.3, 0.7], 0, 1, G3, 0.5); } });
    drawLathe(STY_NIB, { fill: INK });
    popFrame();
  }
  function buildIpad() {
    var W = 0.5, D = 0.37, faces = [], base = prism(rr(-W, -D, W, D, 0.055, 4), 'xz', 0, 0.03, { tone: 1 });
    var top = base.cap0, Y = function (x, z) { return [x, 0, z]; };
    lines(top, INK, 0.55, [map2(rr(-0.455, -0.325, 0.455, 0.325, 0.025, 3), Y)], { closed: true, fill: PAPER });
    lines(top, G2, 0.28, [map2(rr(-0.445, -0.315, 0.445, 0.315, 0.02, 3), Y)], { closed: true });
    lines(top, INK, 0.3, [map2(circ2(-0.478, 0, 0.0065, 8), Y)], { closed: true, fill: INK });
    var bot = base.cap1, Yb = function (x, z) { return [x, 0.03, z]; };
    lines(bot, INK, 0.5, [map2(circ2(-0.33, -0.23, 0.05, 18), Yb), map2(circ2(-0.33, -0.23, 0.028, 14), Yb)], { closed: true });
    lines(bot, INK, 0.5, [map2(circ2(0, 0, 0.045, 20), Yb)], { closed: true });
    top.after = function () {
      var pr = sketchProg(TT + 3.1, SEED + 1), sk = SKETCHES[(SEED + 1) % 2];
      pushFrame([1, 0, 0, 0, 0, -1, 0, -1, 0], 0, -0.0006, 0);
      drawSketch(sk, pr.a, pr.b, 0, 0.0, 0.40, 0.27, 0, INK, 0.45, false);
      popFrame();
    };
    faces.push(base.cap0, base.cap1); pushAll(faces, base.sides);
    return { faces: faces };
  }
  reg('ipad', {
    base: [-0.62, 0.42, -0.1], lim: { axis: [0, -1, 0], min: 0.34 }, k: 0.830, box: [1.00, 0.59], cen: [-0.006, -0.030], tags: ['tablet', 'ipad', 'sketch', 'work', 'design'],
    build: buildIpad,
    draw: function (m) {
      var up = -m7 > 0;
      if (!up) drawStylus(0.31, -0.0175, 0.02, -0.16, 0, -1);
      qAll(m.faces); flush();
      if (up) drawStylus(0.31, -0.0175, 0.02, -0.16, 0, -1);
    },
  });

  /* ======================================================================================================
     pencil : hexagonal pencil with ferrule, eraser and a sharpened graphite tip
     ====================================================================================================== */
  function hexPrism(faces, x0, x1, r, n, ph, o) {
    var k, a0, a1, y0, z0, y1, z1, am, out = [], f;
    for (k = 0; k < n; k++) {
      a0 = ph + k * TAU / n; a1 = ph + (k + 1) * TAU / n; am = (a0 + a1) / 2;
      y0 = r * cos(a0); z0 = r * sin(a0); y1 = r * cos(a1); z1 = r * sin(a1);
      f = mk([[x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1]], [0, cos(am), sin(am)], o);
      f.y0 = y0; f.z0 = z0; f.y1 = y1; f.z1 = z1;
      faces.push(f); out.push(f);
    }
    return out;
  }
  function buildPencil() {
    var faces = [], n = 6, ph = 0.4, r = 0.046, k, a0, a1, am, f;
    var xE = -0.5, xF = -0.424, xB = -0.334, xC = 0.2, xT = 0.5;
    hexPrism(faces, xE, xF, 0.042, 12, ph, { fill: G3, tone: 0, edge: 0.6 });
    var capE = []; for (k = 0; k < 12; k++) capE.push([xE, 0.042 * cos(ph + k * TAU / 12), 0.042 * sin(ph + k * TAU / 12)]);
    faces.push(mk(capE, [-1, 0, 0], { fill: G3, edge: 0.7 }));
    var fer = hexPrism(faces, xF, xB, 0.0485, n, ph, { tone: 1, edge: 0.8 });
    for (k = 0; k < n; k++) { f = fer[k]; lines(f, INK, 0.4, [[[xF + 0.026, f.y0, f.z0], [xF + 0.026, f.y1, f.z1]], [[xF + 0.05, f.y0, f.z0], [xF + 0.05, f.y1, f.z1]]]); }
    var body = hexPrism(faces, xB, xC, r, n, ph, { tone: 1, edge: 1 });
    for (k = 0; k < n; k++) {
      f = body[k]; var ym = (f.y0 + f.y1) / 2, zm = (f.z0 + f.z1) / 2;
      lines(f, G2, 0.28, [[[xB + 0.02, ym, zm], [xC - 0.02, ym, zm]]]);
      if (k === 1) lines(f, INK, 0.55, [[[xB + 0.07, ym, zm], [xB + 0.16, ym, zm]], [[xB + 0.19, ym, zm], [xB + 0.22, ym, zm]], [[xB + 0.25, ym, zm], [xB + 0.35, ym, zm]]]);
    }
    for (k = 0; k < n; k++) {
      a0 = ph + k * TAU / n; a1 = ph + (k + 1) * TAU / n; am = (a0 + a1) / 2;
      var P0 = [xC, r * cos(a0), r * sin(a0)], P1 = [xC, r * cos(a1), r * sin(a1)], AP = [xT, 0, 0];
      var tri = mk([P0, P1, AP], [0.2, 0.98 * cos(am), 0.98 * sin(am)], { tone: 1, edge: 0.9 }), tt = 0.36;
      lines(tri, INK, 0.4, [[[AP[0] + (P0[0] - AP[0]) * tt, P0[1] * tt, P0[2] * tt], [AP[0] + (P1[0] - AP[0]) * tt, P1[1] * tt, P1[2] * tt], AP]], { closed: true, fill: INK });
      var mx = (P0[1] + P1[1]) / 2, mz = (P0[2] + P1[2]) / 2;
      lines(tri, G2, 0.26, [[[xC + 0.035, mx * 0.8, mz * 0.8], [xC + 0.1, mx * 0.42, mz * 0.42]]]);
      faces.push(tri);
    }
    return { faces: faces };
  }
  reg('pencil', {
    base: [-0.34, 0.1, -0.5], lim: { axis: [1, 0, 0], max: 0.95, sym: true }, k: 1.117, box: [0.99, 0.62], cen: [0.016, -0.018], tags: ['pencil', 'draw', 'design', 'tool'],
    build: buildPencil,
    draw: function (m) { qAll(m.faces); flush(); },
  });

  /* ======================================================================================================
     scaleRuler : architect's triangular scale
     ====================================================================================================== */
  function buildScale() {
    var faces = [], L = 1.0, rad = 0.092, ph = -0.12, k, i;
    var vy = [], vz = [];
    for (k = 0; k < 3; k++) { vy.push(rad * cos(ph + k * TAU / 3)); vz.push(rad * sin(ph + k * TAU / 3)); }
    function ep(s, tau, k0) { var k1 = (k0 + 1) % 3; return [-L / 2 + s * L, vy[k0] + (vy[k1] - vy[k0]) * tau, vz[k0] + (vz[k1] - vz[k0]) * tau]; }
    for (k = 0; k < 3; k++) {
      var k1 = (k + 1) % 3, am = ph + (k + 0.5) * TAU / 3;
      var f = mk([[-L / 2, vy[k], vz[k]], [L / 2, vy[k], vz[k]], [L / 2, vy[k1], vz[k1]], [-L / 2, vy[k1], vz[k1]]], [0, cos(am), sin(am)], { tone: 1, edge: 1 });
      var minor = [], major = [], N = 50, N2 = 40;
      for (i = 0; i <= N; i++) {
        var s = 0.025 + 0.95 * i / N, len = i % 10 === 0 ? 0.3 : i % 5 === 0 ? 0.21 : 0.13;
        if (s > 0.17 && s < 0.28 && false) continue;
        (i % 5 === 0 ? major : minor).push([ep(s, 0.05, k), ep(s, 0.05 + len, k)]);
      }
      for (i = 0; i <= N2; i++) {
        var s2 = 0.025 + 0.95 * i / N2, len2 = i % 10 === 0 ? 0.3 : i % 5 === 0 ? 0.21 : 0.13;
        (i % 5 === 0 ? major : minor).push([ep(s2, 0.95, k), ep(s2, 0.95 - len2, k)]);
      }
      lines(f, INK, 0.28, minor); lines(f, INK, 0.4, major);
      lines(f, G2, 0.3, [[ep(0.02, 0.5, k), ep(0.98, 0.5, k)]]);
      // name plate (solid accent) with two light ticks
      lines(f, INK, 0, [[ep(0.05, 0.4, k), ep(0.17, 0.4, k), ep(0.17, 0.6, k), ep(0.05, 0.6, k)]], { closed: true, fill: INK });
      lines(f, PAPER, 0.3, [[ep(0.07, 0.5, k), ep(0.15, 0.5, k)]]);
      faces.push(f);
    }
    var capA = [], capB = [];
    for (k = 0; k < 3; k++) { capA.push([-L / 2, vy[k], vz[k]]); capB.push([L / 2, vy[k], vz[k]]); }
    faces.push(mk(capA, [-1, 0, 0], { fill: G4, edge: 0.9 }), mk(capB, [1, 0, 0], { fill: G4, edge: 0.9 }));
    return { faces: faces };
  }
  reg('scaleRuler', {
    base: [-0.3, 0.12, -0.42], lim: { axis: [1, 0, 0], max: 0.95, sym: true }, k: 1.026, box: [1.00, 0.60], cen: [0.007, -0.007], tags: ['ruler', 'scale', 'architect', 'tool', 'measure'],
    build: buildScale,
    draw: function (m) { qAll(m.faces); flush(); },
  });

  /* ======================================================================================================
     setSquare : 30-60-90 drafting triangle with window
     ====================================================================================================== */
  function roundPoly(pts, r, seg) {
    var n = pts.length, out = [], i, k;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var ax = p0[0] - p1[0], ay = p0[1] - p1[1], bx = p2[0] - p1[0], by = p2[1] - p1[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      ax /= la; ay /= la; bx /= lb; by /= lb;
      var A = acos(clamp(ax * bx + ay * by, -1, 1)), tl = r / Math.tan(A / 2);
      var s1 = [p1[0] + ax * tl, p1[1] + ay * tl], s2 = [p1[0] + bx * tl, p1[1] + by * tl];
      var bsx = ax + bx, bsy = ay + by, bl = Math.hypot(bsx, bsy); bsx /= bl; bsy /= bl;
      var dc = r / Math.sin(A / 2), cx = p1[0] + bsx * dc, cy = p1[1] + bsy * dc;
      var a0 = atan2(s1[1] - cy, s1[0] - cx), a1 = atan2(s2[1] - cy, s2[0] - cx), da = a1 - a0;
      while (da > PI) da -= TAU; while (da < -PI) da += TAU;
      for (k = 0; k <= seg; k++) out.push([cx + r * cos(a0 + da * k / seg), cy + r * sin(a0 + da * k / seg)]);
    }
    return out;
  }
  function scalePoly(pts, c, k) { return pts.map(function (p) { return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]; }); }
  function buildSquare() {
    var A = [-0.475, 0.27], B = [0.475, 0.27], C = [-0.475, -0.279];
    var a = Math.hypot(C[0] - B[0], C[1] - B[1]), b = Math.hypot(A[0] - C[0], A[1] - C[1]), c = Math.hypot(B[0] - A[0], B[1] - A[1]), sum = a + b + c;
    var I = [(a * A[0] + b * B[0] + c * C[0]) / sum, (a * A[1] + b * B[1] + c * C[1]) / sum];
    var outer = roundPoly([A, B, C], 0.03, 5), hole = roundPoly(scalePoly([A, B, C], I, 0.5), 0.022, 4);
    var bevel = roundPoly(scalePoly([A, B, C], I, 0.93), 0.022, 5);
    var pr = prism(outer, 'xz', 0, 0.022, { tone: 1, holes: [hole] }), top = pr.cap0, Y = function (x, z) { return [x, 0, z]; }, i;
    lines(top, G1, 0.3, [map2(bevel, Y)], { closed: true });
    var minor = [], major = [];
    for (i = 1; i <= 41; i++) {
      var s = i / 47, len = i % 10 === 0 ? 0.034 : i % 5 === 0 ? 0.024 : 0.014, arr = i % 5 === 0 ? major : minor;
      arr.push(map2([[-0.475 + 0.95 * s, 0.27 - 0.012], [-0.475 + 0.95 * s, 0.27 - 0.012 - len]], Y));
    }
    for (i = 1; i <= 23; i++) {
      var s3 = i / 28, len3 = i % 10 === 0 ? 0.034 : i % 5 === 0 ? 0.024 : 0.014, arr3 = i % 5 === 0 ? major : minor;
      arr3.push(map2([[-0.475 + 0.012, 0.27 - 0.549 * s3], [-0.475 + 0.012 + len3, 0.27 - 0.549 * s3]], Y));
    }
    lines(top, INK, 0.28, minor); lines(top, INK, 0.4, major);
    lines(top, INK, 0.5, [map2(circ2(-0.4, 0.195, 0.022, 14), Y)], { closed: true });
    var faces = [pr.cap0, pr.cap1]; pushAll(faces, pr.sides);
    return { faces: faces };
  }
  reg('setSquare', {
    base: [-0.62, 0.3, -0.28], lim: { axis: [0, -1, 0], min: 0.4 }, k: 1.010, box: [1.00, 0.44], cen: [0.027, -0.144], tags: ['triangle', 'set square', 'drafting', 'tool', 'architect'],
    build: buildSquare,
    draw: function (m) { qAll(m.faces); flush(); },
  });

  /* ======================================================================================================
     lightbulb : glass bulb, screw base, filament and animated idea-rays
     ====================================================================================================== */
  function helix(r, y0, y1, turns, th0, color, wf) {
    var N = 60, k, th, y, nz, started = false;
    g.beginPath();
    for (k = 0; k <= N; k++) {
      th = th0 + TAU * turns * k / N; y = y0 + (y1 - y0) * k / N;
      nz = m6 * cos(th) + m8 * sin(th);
      if (nz < 0.04) { started = false; continue; }
      P(r * cos(th), y, r * sin(th));
      if (started) g.lineTo(PX, PY); else { g.moveTo(PX, PY); started = true; }
    }
    g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color; g.stroke();
  }
  function buildBulb() {
    return {
      glass: lathe([[0, -0.42], [0.11, -0.405], [0.21, -0.355], [0.28, -0.27], [0.3, -0.16], [0.275, -0.045], [0.215, 0.045], [0.152, 0.105], [0.13, 0.14, 1]], 4),
      base: lathe([[0.13, 0.14], [0.13, 0.3], [0.117, 0.322], [0.088, 0.338, 1]], 3),
      tip: lathe([[0.088, 0.338], [0.065, 0.352], [0.035, 0.364], [0.0, 0.37]], 3),
    };
  }
  function bulbBase(m) {
    drawLathe(m.base, {
      bot: { r: 0.088, y: 0.338 }, noFillTop: true,
      decor: function () {
        helix(0.13, 0.17, 0.3, 3.1, 0.4, INK, 0.6);
        shade(m.base, 1, [0.25, 0.5], 0, m.base.n - 1, G3, 0.5);
      },
    });
    drawLathe(m.tip, { fill: INK, w: 0.9, noFillTop: true });
  }
  function bulbGlass(m) {
    var G = m.glass;
    drawLathe(G, {
      bot: { r: 0.13, y: 0.14 },
      decor: function () {
        shade(G, 1, [0.22, 0.4, 0.62], G.idx(-0.3), G.n - 1, G3, 0.45);
        shade(G, -1, [0.42], G.idx(-0.33), G.idx(0.02), G2, 0.8);
        // filament: two posts + a smooth coil
        var i, n = 44;
        g.beginPath();
        P(-0.022, 0.13, 0); g.moveTo(PX, PY); P(-0.05, -0.095, 0); g.lineTo(PX, PY);
        P(0.022, 0.13, 0); g.moveTo(PX, PY); P(0.05, -0.095, 0); g.lineTo(PX, PY);
        g.lineWidth = Math.max(LW * 0.42, HW); g.strokeStyle = INK; g.stroke();
        g.beginPath();
        for (i = 0; i <= n; i++) { P(-0.05 + 0.1 * i / n, -0.098 - 0.022 * sin(i * 0.5), 0); if (i) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
        g.lineWidth = Math.max(LW * 0.5, HW); g.stroke();
      },
    });
  }
  function bulbRays(t) {
    P(0, -0.14, 0);
    var cx = PX, cy = PY, f = CAM / (CAM - PZ), rho = 0.3 * S * f, a0 = atan2(-m4, -m1), k, ang, r0, r1, pulse;
    g.beginPath();
    for (k = 0; k < 9; k++) {
      ang = a0 + (k - 4) * 0.37;
      pulse = 1 + 0.16 * sin(2.3 * t + k * 1.7);
      r0 = rho * (1.2 + 0.03 * (k % 2)); r1 = r0 + rho * (k % 2 ? 0.2 : 0.34) * pulse;
      g.moveTo(cx + cos(ang) * r0, cy + sin(ang) * r0); g.lineTo(cx + cos(ang) * r1, cy + sin(ang) * r1);
    }
    g.lineWidth = Math.max(LW * 0.8, HW); g.strokeStyle = INK; g.stroke();
    g.beginPath();
    for (k = 0; k < 8; k++) {
      ang = a0 + (k - 3.5) * 0.37; r0 = rho * (1.2 + 0.52 + 0.06 * sin(1.7 * t + k));
      g.moveTo(cx + cos(ang) * r0 + LW * 0.45, cy + sin(ang) * r0); g.arc(cx + cos(ang) * r0, cy + sin(ang) * r0, LW * 0.45, 0, TAU);
    }
    g.fillStyle = INK; g.fill();
  }
  reg('lightbulb', {
    base: [-0.3, 0.0, -0.2], lim: { axis: [0, -1, 0], min: 0.15 }, k: 0.971, box: [1.00, 0.98], cen: [0.059, 0.173], tags: ['idea', 'lightbulb', 'design', 'thought'],
    build: buildBulb,
    draw: function (m, t) {
      pushFrame(ID3, 0, -0.02, 0);
      if (-m7 > 0) { bulbBase(m); bulbGlass(m); } else { bulbGlass(m); bulbBase(m); }
      popFrame();
      bulbRays(t);
    },
  });

  /* ======================================================================================================
     stickyNotes : a pad of sticky notes with a loose note, a curled corner and hand-drawn scribbles
     ====================================================================================================== */
  function hand(x0, x1, z, y, wob, seed, n) {
    var o = [], i, t; n = n || 12;
    for (i = 0; i <= n; i++) { t = i / n; o.push([x0 + (x1 - x0) * t, y, z + wob * U.noise1(t * 3.1 + seed * 7.3, seed + 1)]); }
    return o;
  }
  function buildNotes(key) {
    var faces = [], i, k;
    function place(ry, x, z, fn) { var c = cos(ry), s = sin(ry); withXf([c, 0, s, 0, 1, 0, -s, 0, c], [x, 0, z], fn); }
    // --- loose note below (grey tint) with a spiral + arrow
    place(-0.24, -0.2, 0.07, function () {
      var b = box(-0.27, -0.012, -0.27, 0.27, 0, 0.27, { lay: 0, tone: 1, fills: { ny: G4 } }), sp = [], a;
      for (i = 0; i <= 40; i++) { a = TAU * 2.4 * i / 40; sp.push([-0.05 + (0.03 + 0.14 * i / 40) * cos(a), -0.012, 0.02 + (0.03 + 0.14 * i / 40) * sin(a)]); }
      lines(b.ny, INK, 0.5, [sp, [[0.1, -0.012, -0.2], [0.2, -0.012, -0.2]], [[0.0, -0.012, 0.21], [0.22, -0.012, 0.2]]]);
      lines(b.ny, INK, 0.5, [[[0.17, -0.012, 0.0], [0.23, -0.012, -0.05], [0.25, -0.012, 0.03]]], { closed: true, fill: INK });
      pushAll(faces, b);
    });
    // --- the pad (stack of sheets) with the adhesive strip, title and a tick list
    place(0.05, 0.06, -0.02, function () {
      var T = 0.07, y0 = -0.012 - T, b = box(-0.3, y0, -0.3, 0.3, -0.012, 0.3, { lay: 1, tone: 1 }), top = b.ny, s1 = [], s2 = [], s3 = [], s4 = [];
      for (k = 1; k < 8; k++) {
        var yy = y0 + k * T / 8;
        s1.push([[-0.3, yy, 0.3], [0.3, yy, 0.3]]); s2.push([[-0.3, yy, -0.3], [0.3, yy, -0.3]]); s3.push([[0.3, yy, -0.3], [0.3, yy, 0.3]]); s4.push([[-0.3, yy, -0.3], [-0.3, yy, 0.3]]);
      }
      lines(b.pz, G1, 0.28, s1); lines(b.nz, G1, 0.28, s2); lines(b.px, G1, 0.28, s3); lines(b.nx, G1, 0.28, s4);
      lines(top, G2, 0.3, [[[-0.3, y0, -0.255], [0.3, y0, -0.255]]]);
      lines(top, INK, 0, [[[-0.3, y0, -0.3], [0.3, y0, -0.3], [0.3, y0, -0.262], [-0.3, y0, -0.262]]], { closed: true, fill: G4 });
      lines(top, INK, 0.8, [hand(-0.22, 0.12, -0.17, y0, 0.012, key + 1, 14)]);
      for (i = 0; i < 3; i++) {
        var z = -0.065 + i * 0.12;
        lines(top, INK, 0, [map2(circ2(-0.225, z, 0.012, 8), function (x, zz) { return [x, y0, zz]; })], { closed: true, fill: INK });
        lines(top, INK, 0.4, [hand(-0.17, 0.2 - 0.07 * i, z, y0, 0.008, key + 2 + i, 12)]);
      }
      lines(top, INK, 1.0, [[[0.12, y0, 0.2], [0.165, y0, 0.25], [0.255, y0, 0.12]]]);
      pushAll(faces, b);
    });
    // --- loose note on top with a curled corner and a bulb doodle
    place(0.34, 0.2, 0.2, function () {
      var s = 0.235, cut = 0.15, y0 = -0.094;
      var outline = [[-s, -s], [s, -s], [s, s - cut], [s - cut, s], [-s, s]];
      var pr = prism(outline, 'xz', y0, y0 + 0.012, { lay: 2, tone: 1 }), t = pr.cap0;
      lines(t, INK, 0.5, [map2(circ2(0, -0.06, 0.09, 20), function (x, z) { return [x, y0, z]; })], { closed: true });
      lines(t, INK, 0.5, [[[-0.04, y0, 0.04], [0.04, y0, 0.04]], [[-0.03, y0, 0.07], [0.03, y0, 0.07]]]);
      var rays = [], a;
      for (i = 0; i < 5; i++) { a = -PI / 2 + (i - 2) * 0.62; rays.push([[cos(a) * 0.13, y0, -0.06 + sin(a) * 0.13], [cos(a) * 0.19, y0, -0.06 + sin(a) * 0.19]]); }
      lines(t, INK, 0.5, rays);
      lines(t, INK, 0.4, [hand(-0.18, 0.12, 0.17, y0, 0.008, key + 5, 10)]);
      pushAll(faces, [pr.cap0, pr.cap1]); pushAll(faces, pr.sides);
      // the curled corner: a lifted triangle showing the back of the sheet
      var A = [s, y0, s - cut], B = [s - cut, y0, s], Cc = [s - cut * 0.82, y0 - 0.045, s - cut * 0.82];
      faces.push(mk([A, B, Cc], [0.25, -1, 0.25], { lay: 2, fill: G4, edge: 0.9, zb: 0.01 }), mk([A, B, Cc], [-0.25, 1, -0.25], { lay: 2, fill: G4, edge: 0.9, zb: 0.01 }));
    });
    return { faces: faces };
  }
  reg('stickyNotes', {
    base: [-0.66, 0.35, -0.1], lim: { axis: [0, -1, 0], min: 0.4 }, k: 1.026, box: [1.00, 0.70], cen: [-0.015, 0.010], tags: ['notes', 'sticky', 'work', 'ideas'],
    vkey: function (seed) { return seed % 4; }, build: buildNotes,
    draw: function (m) { qAll(m.faces); flush(); },
  });

  /* ======================================================================================================
     EXTRAS : coffeeMug, plant, headphones, camera
     ====================================================================================================== */
  /** filled strip of the wall between heights y0..y1 (visible part only) */
  function bandFill(L, y0, y1, color) {
    var j = L.idx((y0 + y1) / 2), mode = visArc(L.nr[j], L.ny[j]), a0, a1, k, th, N = 28, r0 = L.rAt(y0), r1 = L.rAt(y1);
    if (!mode) return;
    if (mode === 1) { a0 = 0; a1 = TAU; } else { a0 = VPH - VDL; a1 = VPH + VDL; }
    g.beginPath();
    for (k = 0; k <= N; k++) { th = a0 + (a1 - a0) * k / N; P(r0 * cos(th), y0, r0 * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
    for (k = N; k >= 0; k--) { th = a0 + (a1 - a0) * k / N; P(r1 * cos(th), y1, r1 * sin(th)); g.lineTo(PX, PY); }
    g.closePath(); g.fillStyle = color; g.fill();
  }
  /** zig-zag garland around a vertical wall (visible runs only) */
  function zigzag(L, y0, y1, n, color, wf) {
    var j = L.idx((y0 + y1) / 2), r = L.rAt((y0 + y1) / 2), k, th, started = false, nz;
    g.beginPath();
    for (k = 0; k <= n * 2; k++) {
      th = TAU * k / (n * 2) + 0.2; nz = m6 * cos(th) + m8 * sin(th);
      if (nz < 0.05) { started = false; continue; }
      P(r * cos(th), k % 2 ? y1 : y0, r * sin(th));
      if (started) g.lineTo(PX, PY); else { g.moveTo(PX, PY); started = true; }
    }
    g.lineWidth = Math.max(LW * wf, HW); g.strokeStyle = color; g.stroke();
  }

  function buildMug() {
    return {
      L: lathe([[0.245, -0.25], [0.248, -0.22], [0.25, 0.1], [0.24, 0.215], [0.225, 0.245, 1]], 4),
      handle: bez3([0.24, -0.17, 0], [0.43, -0.2, 0], [0.45, 0.1, 0], [0.238, 0.12, 0], 18),
    };
  }
  reg('coffeeMug', {
    base: [-0.5, -0.4, 0], lim: { axis: [0, -1, 0], min: 0.34 }, k: 1.020, box: [0.67, 0.99], cen: [-0.069, 0.054], tags: ['coffee', 'mug', 'drink', 'work'],
    build: buildMug,
    draw: function (m, t, seed) {
      var L = m.L, hw = function (u) { return 0.042 * (0.75 + 0.5 * sin(PI * u)); };
      pushFrame(ID3, 0, 0.12, 0);
      var hf = m6 > 0;
      if (!hf) tube(m.handle, hw, PAPER, 1);
      drawLathe(L, {
        top: {
          r: 0.245, y: -0.25, after: function () {
            ringDraw(0.232, -0.25, G4, 0.5);
            g.save(); g.beginPath(); ringPath(0.232, -0.25); g.clip(); ringDraw(0.222, -0.205, INK, 0);
            g.beginPath();
            for (var k = 0; k <= 10; k++) { var th = 3.5 + 0.95 * k / 10; P(0.16 * cos(th), -0.205, 0.16 * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
            g.lineWidth = Math.max(LW * 0.4, HW); g.strokeStyle = PAPER; g.stroke(); g.restore();
          },
        },
        bot: { r: 0.225, y: 0.245 },
        decor: function () {
          bandFill(L, -0.03, 0.075, INK);
          zigzag(L, -0.015, 0.06, 12, PAPER, 0.5);
          wallRing(L, -0.19, G2, 0.35);
          shade(L, 1, [0.22, 0.42], L.idx(-0.2), L.n - 1, G3, 0.45);
        },
      });
      if (hf) tube(m.handle, hw, PAPER, 1);
      steam(0, -0.275, 0, 0.4, 3, 0.055, t, seed, 0.9);
      popFrame();
    },
  });

  /* ---------------------------------------- plant ---------------------------------------- */
  function stemPt(t) { return [0.035 * sin(2.3 * t), -0.04 - 0.3 * t, 0.025 * cos(2.6 * t)]; }
  function buildPlant(key) {
    var rng = U.rng(500 + key * 17), faces = [], i, k, M = 16, pot = lathe([[0.215, 0], [0.215, 0.04], [0.2, 0.048, 1], [0.195, 0.056], [0.15, 0.23], [0.13, 0.255, 1]], 3);
    var ts = [0.35, 0.5, 0.66, 0.82, 1.0], sz = [0.44, 0.47, 0.42, 0.38, 0.34], stem = [];
    for (i = 0; i <= 14; i++) stem.push(stemPt(i / 14));
    for (i = 0; i < ts.length; i++) {
      var base = stemPt(ts[i]), phi = i * 2.4 + 0.5 + rng.range(-0.25, 0.25), len = sz[i] * rng.range(0.92, 1.08), wid = len * 0.5;
      var al0 = i === ts.length - 1 ? 0.3 : rng.range(0.7, 1.05), kap = rng.range(0.35, 0.75), dx = cos(phi), dz = sin(phi), nx = -dz, nz = dx;
      var C = [[base[0], base[1], base[2]]], rho = 0, h = 0, a, step = len / M;
      for (k = 1; k <= M; k++) { a = al0 + kap * Math.pow(k / M, 1.3); rho += step * sin(a); h += step * cos(a); C.push([base[0] + dx * rho, base[1] - h, base[2] + dz * rho]); }
      var left = [], right = [], w, u;
      for (k = 0; k <= M; k++) {
        u = k / M; w = wid * 0.5 * Math.pow(sin(PI * Math.pow(u, 0.7)), 0.9) + 0.004;
        left.push([C[k][0] + nx * w, C[k][1], C[k][2] + nz * w]); right.push([C[k][0] - nx * w, C[k][1], C[k][2] - nz * w]);
      }
      var poly = left.concat(right.slice().reverse());
      var T = [C[11][0] - C[5][0], C[11][1] - C[5][1], C[11][2] - C[5][2]], N = [T[1] * nz, T[2] * nx - T[0] * nz, -T[1] * nx];
      var nl = Math.hypot(N[0], N[1], N[2]) || 1; N = [N[0] / nl, N[1] / nl, N[2] / nl];
      if (N[1] > 0) N = [-N[0], -N[1], -N[2]];
      var fr = mk(poly, N, { lay: 1, fill: PAPER, edge: 0.85 }), bk = mk(poly, [-N[0], -N[1], -N[2]], { lay: 1, fill: G4, edge: 0.85 });
      var rib = [], veins = [], half = [];
      for (k = 0; k <= M - 1; k++) rib.push(C[k]);
      for (k = 3; k < M - 2; k += 3) { veins.push([C[k], left[k + 2]]); veins.push([C[k], right[k + 2]]); }
      for (k = 0; k <= M; k++) half.push(left[k]);
      for (k = M; k >= 0; k--) half.push(C[k]);
      lines(fr, G4, 0, [half], { closed: true, fill: G4, front: true });
      lines(fr, INK, 0.4, [rib]); lines(fr, G1, 0.28, veins);
      lines(bk, G1, 0.3, [rib]);
      faces.push(fr, bk);
    }
    return { faces: faces, pot: pot, stem: stem };
  }
  reg('plant', {
    base: [-0.45, 0.2, 0], lim: { axis: [0, -1, 0], min: 0.3 }, k: 1.075, box: [0.93, 0.99], cen: [-0.016, 0.067], tags: ['plant', 'nature', 'green', 'design'],
    vkey: function (seed) { return seed % 3; }, build: buildPlant,
    draw: function (m) {
      pushFrame(ID3, 0, 0.12, 0);
      var P0 = m.pot, up = -m7 > 0;
      function drawPot() {
        drawLathe(P0, {
          fill: G4,
          top: { r: 0.215, y: 0, after: function () { ringDraw(0.2, 0.01, G1, 0.4); } },
          bot: { r: 0.13, y: 0.255 },
          decor: function () { wallRing(P0, 0.036, INK, 0.45); wallRing(P0, 0.1, G1, 0.3); wallRing(P0, 0.125, G1, 0.3); shade(P0, 1, [0.25, 0.5, 0.8], 0, P0.n - 1, G2, 0.3); },
        });
      }
      if (up) drawPot();
      tube(m.stem, function (u) { return 0.024 * (1 - 0.5 * u); }, PAPER, 0.9);
      qAll(m.faces); flush();
      if (!up) drawPot();
      popFrame();
    },
  });

  /* ---------------------------------------- headphones ---------------------------------------- */
  var HP_CUP = lathe([[0.1, -0.08], [0.15, -0.075], [0.172, -0.05], [0.178, 0.0], [0.172, 0.05], [0.15, 0.075], [0.12, 0.085, 1]], 3);
  function hpCup(sx) {
    pushFrame(basisY(sx, 0, 0), sx * 0.4, 0.04, 0);
    drawLathe(HP_CUP, {
      fill: PAPER, w: 1,
      top: { r: 0.1, y: -0.08, fill: G3, after: function () { ringDraw(0.07, -0.08, G1, 0.4); } },
      bot: { r: 0.12, y: 0.085, after: function () { ringDraw(0.08, 0.086, null, 0.45, INK); ringDraw(0.022, 0.086, INK, 0.3); } },
      decor: function () { shade(HP_CUP, 1, [0.3, 0.6], 0, HP_CUP.n - 1, G3, 0.45); wallRing(HP_CUP, 0.05, G2, 0.4); },
    });
    popFrame();
  }
  function hpBand() {
    var path = [], i, th, n = 22;
    for (i = 0; i <= n; i++) { th = PI - PI * i / n; path.push([0.4 * cos(th), -0.5 * sin(th) + 0.04, 0]); }
    tube(path, function () { return 0.05; }, PAPER, 1);
    var pad = [];
    for (i = 6; i <= 16; i++) { th = PI - PI * i / n; pad.push([0.355 * cos(th), -0.455 * sin(th) + 0.04, 0]); }
    tube(pad, function (u) { return 0.045 * (0.6 + 0.4 * sin(PI * u)); }, G4, 0.8);
  }
  reg('headphones', {
    base: [-0.35, 0.45, -0.1], lim: { axis: [0, -1, 0], min: 0.2 }, k: 1.015, box: [1.00, 0.81], cen: [-0.012, -0.094], tags: ['headphones', 'music', 'work'],
    build: function () { return {}; },
    draw: function () {
      pushFrame(ID3, 0, 0.18, 0);
      qFn(0, 0, 0, 0, hpBand);
      qFn(-0.4, 0.04, 0, 0, function () { hpCup(-1); });
      qFn(0.4, 0.04, 0, 0, function () { hpCup(1); });
      flush();
      popFrame();
    },
  });

  /* ---------------------------------------- camera ---------------------------------------- */
  var CAM_LENS = lathe([[0.17, 0], [0.17, 0.05], [0.182, 0.066], [0.182, 0.098], [0.16, 0.118], [0.15, 0.14], [0.13, 0.148, 1]], 5);
  function buildCamera() {
    var faces = [], body = prism(rr(-0.46, -0.27, 0.46, 0.27, 0.05, 3), 'xy', -0.13, 0.13, { tone: 1 }), fr = body.cap1, Z = function (x, y) { return [x, y, 0.13]; };
    lines(fr, INK, 0.5, [map2(rr(-0.4, -0.215, -0.24, -0.15, 0.015, 2), Z)], { closed: true, fill: G4 });
    lines(fr, INK, 0.5, [map2(rr(0.26, -0.215, 0.4, -0.15, 0.015, 2), Z)], { closed: true });
    lines(fr, INK, 0.4, [map2(circ2(0.33, -0.18, 0.012, 8), Z)], { closed: true, fill: INK });
    lines(fr, INK, 0.35, [map2(rr(-0.4, 0.19, -0.2, 0.22, 0.01, 2), Z)], { closed: true, fill: INK });
    var gr = [], i;
    for (i = 0; i < 7; i++) gr.push(map2([[0.3 + i * 0.016, -0.05], [0.3 + i * 0.016, 0.2]], Z));
    lines(fr, G2, 0.3, gr);
    lines(fr, G2, 0.4, [map2([[-0.46, -0.1], [0.46, -0.1]], Z)]);
    faces.push(body.cap0, body.cap1); pushAll(faces, body.sides);
    var hump = box(-0.14, -0.36, -0.1, 0.14, -0.27, 0.1, { tone: 1, edge: 0.9 });
    lines(hump.pz, G2, 0.3, [[[-0.1, -0.34, 0.1], [0.1, -0.34, 0.1]]]);
    pushAll(faces, hump);
    pushAll(faces, box(0.24, -0.325, -0.04, 0.32, -0.27, 0.04, { fill: INK, edge: 0.7, tone: 0 }));
    return { faces: faces };
  }
  reg('camera', {
    base: [-0.4, -0.55, 0], lim: { axis: [0, -1, 0], min: 0.2 }, k: 1.058, box: [1.00, 0.85], cen: [-0.005, -0.035], tags: ['camera', 'photo', 'design'],
    build: buildCamera,
    draw: function (m) {
      pushFrame(ID3, 0, 0.04, 0);
      var front = m8 > 0;
      function lens() {
        pushFrame(basisY(0, 0, 1), 0, 0, 0.13);
        drawLathe(CAM_LENS, {
          noFillTop: true,
          bot: {
            r: 0.13, y: 0.148, fill: INK, after: function () {
              ringDraw(0.095, 0.149, null, 0.5, PAPER); ringDraw(0.058, 0.149, G1, 0.3, G2);
              g.beginPath(); for (var k = 0; k <= 8; k++) { var th = 3.6 + 0.9 * k / 8; P(0.105 * cos(th), 0.149, 0.105 * sin(th)); if (k) g.lineTo(PX, PY); else g.moveTo(PX, PY); }
              g.lineWidth = Math.max(LW * 0.6, HW); g.strokeStyle = PAPER; g.stroke();
            },
          },
          decor: function () { wallRing(CAM_LENS, 0.082, G1, 0.4); wallRing(CAM_LENS, 0.052, G2, 0.3); },
        });
        popFrame();
      }
      if (!front) lens();
      qAll(m.faces); flush();
      if (front) lens();
      popFrame();
    },
  });

  /*__PROPS__*/

  GA.propsA = {
    names: NAMES, opts: OPTS,
    /** recommended nominal sizes (world units) so that all props feel like objects of a similar real-world scale */
    size: { bookOpen: 240, bookClosed: 130, bookStack: 170, chaiCup: 150, chaiGlass: 160, kulhad: 140, laptop: 260, ipad: 210, pencil: 170, scaleRuler: 220, setSquare: 170, lightbulb: 150, stickyNotes: 170, coffeeMug: 130, plant: 190, headphones: 150, camera: 140 },
  };
})();


/* ===== props_b.js ===== */
/* props_b.js -- line-art "thought" props, set B (design / sport).  Classic script; needs util.js + style.js (GA.util, GA.style, GA.props).
   Registered with GA.props.register(name, {draw, box, tags}).  draw(ctx, p) paints at the ctx origin in WORLD units (sizes are multiples of p.s):
     p = { s, t, seed, rot:[rx,ry,rz], alpha, lw }     p.alpha multiplies the context's current globalAlpha; p.lw multiplies every line weight.
   Deterministic (GA.util.rng only; small geometry caches keyed by seed), no globals besides GA.props / GA.propsB.  ctx state is saved/restored.

   Mandatory set:  sketchPlan, sketchPersp, sketchSection, iterations, processDiagram, massingA, massingB, massingC, cubeLine,
                   tennisRacket, tennisBall, gridPlane, tracingRoll, scribble, shapeTri, shapeCircle, shapeChevron, shapeDiamond, dotCluster
   Extras:         northArrow (+ alias compassRose), treePlan, humanScale, sectionCut, staircase, siteModel (contour layers + tiny black building),
                   modelKnife, compassTool (drafting compass)

   How it works: each prop is modelled in a local 3D frame (unit = p.s, x right, y DOWN, z toward the viewer) and projected with the same Euler
   convention as GA.util.rot3 (rx, then ry, then rz) plus weak perspective, so p.rot tumbles it for real.  Sheet-like props carry a built-in
   "rest pose" (small base rotation) so they never read as flat UI cards; their tumble is soft-limited (tanh) and additionally scaled back whenever
   it would turn the sheet edge-on (|cos| of the normal < minN), so flat props never collapse.  Boxy props (massing, cube, stairs, site model) use real
   3D boxes drawn back-to-front with separating-plane ordering, exact hidden faces and light-driven shading (lit = white, mid = hair hatch, shaded =
   grey + denser hatch).  Sheets seen from behind show their drawing through the paper.  Every prop is centred on its origin at rot = 0
   (CENTER table) and p.s ~ its largest dimension (box is accurate to ~1 percent at rest; GA.propsB.bounds(name, p) measures any tumble exactly).
   Line weights: GA.style.lw (outline = mid, details = thin, hatch = hair) x p.lw x a mild size factor (1.0 at s = 180).
   Variants chosen by p.seed: cubeLine (3), gridPlane (3), shapeCircle (3), shapeTri (2), shapeDiamond (2), scribble (3 + 2 tempos), northArrow (2),
   dotCluster / treePlan / siteModel (any seed = new composition).
   Animated by p.t (seconds): scribble wiggle, processDiagram arrow flow, iterations flutter, dotCluster drift, tennisBall spin, tracingRoll sway.
   Performance: JS cost 0.01-0.15 ms per prop; paints are batched per style (about 5-45 fill/stroke calls per prop) and there is no clip() anywhere
   (hatching and string chords are clipped analytically), so rasterisation stays cheap too.
   Extra export: GA.propsB = { names, center, bounds(name, p), kit } (kit exposes internal helpers for demos / audits). */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util, ST = GA.style, LW = ST.lw;
  var INK = ST.INK, INK2 = ST.INK2, G1 = ST.GRAY1, G2 = ST.GRAY2, G3 = ST.GRAY3, G4 = ST.GRAY4, PAPER = ST.PAPER;
  var TAU = Math.PI * 2, PI = Math.PI;
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, atan2 = Math.atan2, min = Math.min, max = Math.max, floor = Math.floor;
  var NAMES = [];

  /* ------------------------------------------------------------------ render state */
  var ctx = null;
  var SC = 100;          // drawn size = p.s * o.scale
  var NOM = 100;         // p.s
  var K = 1;             // line-weight multiplier (p.lw * size factor)
  var PERSP = 4;         // camera distance in local units (0 = orthographic)
  var A0 = 1;            // effective alpha of the prop (p.alpha * incoming globalAlpha)
  var CA = 1;            // content alpha multiplier (sheets seen from behind show their drawing through the paper)
  var BACK = false;      // local +z axis points away from the viewer
  var M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  var MR = [1, 0, 0, 0, 1, 0, 0, 0, 1], MB = [1, 0, 0, 0, 1, 0, 0, 0, 1], MT = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  var X = 0, Y = 0, Z = 0, F = 1; // last projected point (world units, depth in local units, perspective factor)
  var OFX = 0, OFY = 0;           // rest-pose centring offset (world units)
  var EMPTY = [];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }

  function eul(rx, ry, rz, o) {
    var cx = cos(rx), sx = sin(rx), cy = cos(ry), sy = sin(ry), cz = cos(rz), sz = sin(rz);
    var a0 = cy, a1 = sy * sx, a2 = sy * cx, b1 = cx, b2 = -sx, c0 = -sy, c1 = cy * sx, c2 = cy * cx;
    o[0] = cz * a0; o[1] = cz * a1 - sz * b1; o[2] = cz * a2 - sz * b2;
    o[3] = sz * a0; o[4] = sz * a1 + cz * b1; o[5] = sz * a2 + cz * b2;
    o[6] = c0; o[7] = c1; o[8] = c2;
  }
  function mul(a, b, o) {
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) MT[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    for (var i = 0; i < 9; i++) o[i] = MT[i];
  }
  function buildM(rx, ry, rz, base) {
    eul(rx, ry, rz, MR);
    if (base) { eul(base[0], base[1], base[2], MB); mul(MR, MB, M); } else for (var i = 0; i < 9; i++) M[i] = MR[i];
  }
  /** soft = smooth limit (rad) of the tumble's rx / ry; minN = smallest allowed |cos| between a sheet's normal and the view axis
      (the tumble is scaled back smoothly when it would go edge-on, so flat props never collapse to a line) */
  function setMatrix(rot, base, soft, minN) {
    var rx = (rot && rot[0]) || 0, ry = (rot && rot[1]) || 0, rz = (rot && rot[2]) || 0;
    if (soft) { rx = soft * Math.tanh(rx / soft); ry = soft * Math.tanh(ry / soft); }
    buildM(rx, ry, rz, base);
    if (minN && M[8] < minN) {
      var lo = 0, hi = 1, k, it;
      for (it = 0; it < 8; it++) { k = (lo + hi) / 2; buildM(rx * k, ry * k, rz, base); if (M[8] >= minN) lo = k; else hi = k; }
      buildM(rx * lo, ry * lo, rz, base);
    }
  }

  /** project local (x,y,z) (units of p.s, y down) -> X,Y world offsets from the prop origin, Z depth, F perspective factor */
  function P(x, y, z) {
    z = z || 0;
    var qx = M[0] * x + M[1] * y + M[2] * z, qy = M[3] * x + M[4] * y + M[5] * z, qz = M[6] * x + M[7] * y + M[8] * z;
    var f = PERSP ? PERSP / (PERSP - qz) : 1;
    F = f; X = qx * f * SC + OFX; Y = qy * f * SC + OFY; Z = qz;
  }

  /** begin a prop. o: { base:[rx,ry,rz] rest pose, soft: soft limit (rad) of p.rot rx/ry, persp } */
  function begin(c, p, o) {
    o = o || {};
    ctx = c; ctx.save();
    A0 = (p.alpha === undefined ? 1 : p.alpha) * (c.globalAlpha === undefined ? 1 : c.globalAlpha);
    CA = 1; ctx.globalAlpha = A0;
    NOM = p.s || 100; SC = NOM * (o.scale || 1);
    K = (p.lw === undefined ? 1 : p.lw) * clamp(0.72 + 0.28 * (SC / 180), 0.8, 1.12);
    PERSP = o.persp === undefined ? 4 : o.persp;
    var off = o.off || PENDOFF; PENDOFF = null; OFX = off ? off[0] * NOM : 0; OFY = off ? off[1] * NOM : 0;
    setMatrix(p.rot, o.base, o.soft, o.minN);
    BACK = M[8] < 0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(EMPTY);
  }
  function end() { ctx.setLineDash(EMPTY); ctx.restore(); }

  /* ------------------------------------------------------------------ painting helpers */
  function strokeC(w, col, a) { ctx.globalAlpha = A0 * CA * (a === undefined ? 1 : a); ctx.lineWidth = w * K; ctx.strokeStyle = col; ctx.stroke(); }
  function fillC(col, a, ev) { ctx.globalAlpha = A0 * CA * (a === undefined ? 1 : a); ctx.fillStyle = col; if (ev) ctx.fill('evenodd'); else ctx.fill(); }
  function fillRaw(col, a) { ctx.globalAlpha = A0 * (a === undefined ? 1 : a); ctx.fillStyle = col; ctx.fill(); }
  function dash(a, b) { ctx.setLineDash([a * K, b * K]); }
  function nodash() { ctx.setLineDash(EMPTY); }
  function bp() { ctx.beginPath(); }

  function mv(x, y, z) { P(x, y, z); ctx.moveTo(X, Y); }
  function ln(x, y, z) { P(x, y, z); ctx.lineTo(X, Y); }
  function seg(x0, y0, x1, y1, z) { P(x0, y0, z); ctx.moveTo(X, Y); P(x1, y1, z); ctx.lineTo(X, Y); }
  /** polyline through flat [x,y,x,y..] on plane z */
  function pl2(a, z, closed, noMove) {
    for (var i = 0; i < a.length; i += 2) {
      P(a[i], a[i + 1], z);
      if (i === 0 && !noMove) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    if (closed) ctx.closePath();
  }
  /** polyline through flat [x,y,z,...] */
  function pl3(a, closed, noMove) {
    for (var i = 0; i < a.length; i += 3) {
      P(a[i], a[i + 1], a[i + 2]);
      if (i === 0 && !noMove) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    if (closed) ctx.closePath();
  }
  var TX = [], TY = [];
  /** smooth curve through flat 2D points (quadratic through midpoints) */
  function smooth2(a, z, closed, noMove) {
    var n = a.length >> 1, i;
    for (i = 0; i < n; i++) { P(a[2 * i], a[2 * i + 1], z); TX[i] = X; TY[i] = Y; }
    if (n < 2) return;
    if (closed) {
      var j, k;
      if (!noMove) ctx.moveTo((TX[n - 1] + TX[0]) / 2, (TY[n - 1] + TY[0]) / 2); else ctx.lineTo((TX[n - 1] + TX[0]) / 2, (TY[n - 1] + TY[0]) / 2);
      for (j = 0; j < n; j++) { k = (j + 1) % n; ctx.quadraticCurveTo(TX[j], TY[j], (TX[j] + TX[k]) / 2, (TY[j] + TY[k]) / 2); }
      ctx.closePath();
    } else {
      if (!noMove) ctx.moveTo(TX[0], TY[0]); else ctx.lineTo(TX[0], TY[0]);
      for (i = 1; i < n - 1; i++) ctx.quadraticCurveTo(TX[i], TY[i], (TX[i] + TX[i + 1]) / 2, (TY[i] + TY[i + 1]) / 2);
      ctx.lineTo(TX[n - 1], TY[n - 1]);
    }
  }
  /** smooth open curve through flat [x,y,z,...] (quadratic through midpoints) */
  function smooth3(a) {
    var n = a.length / 3, i;
    for (i = 0; i < n; i++) { P(a[3 * i], a[3 * i + 1], a[3 * i + 2]); TX[i] = X; TY[i] = Y; }
    if (n < 2) return;
    ctx.moveTo(TX[0], TY[0]);
    for (i = 1; i < n - 1; i++) ctx.quadraticCurveTo(TX[i], TY[i], (TX[i] + TX[i + 1]) / 2, (TY[i] + TY[i + 1]) / 2);
    ctx.lineTo(TX[n - 1], TY[n - 1]);
  }
  /** elliptical arc of a planar circle in 3D: c + u cos t + v sin t, t in [a0,a1] (exact under the affine part of the projection) */
  function arc3(cx, cy, cz, ux, uy, uz, vx, vy, vz, a0, a1, move) {
    P(cx, cy, cz); var Cx = X, Cy = Y;
    P(cx + ux, cy + uy, cz + uz); var p1x = X, p1y = Y; P(cx - ux, cy - uy, cz - uz);
    var Ux = (p1x - X) / 2, Uy = (p1y - Y) / 2;
    P(cx + vx, cy + vy, cz + vz); p1x = X; p1y = Y; P(cx - vx, cy - vy, cz - vz);
    var Vx = (p1x - X) / 2, Vy = (p1y - Y) / 2;
    var n = max(1, Math.ceil(abs(a1 - a0) / (PI / 2) - 1e-6)), d = (a1 - a0) / n, k = (4 / 3) * Math.tan(d / 4);
    var t = a0, cs = cos(t), sn = sin(t);
    var qx = Cx + Ux * cs + Vx * sn, qy = Cy + Uy * cs + Vy * sn;
    if (move) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
    for (var i = 0; i < n; i++) {
      var t1 = t + d, c1 = cos(t1), s1 = sin(t1);
      var ex = Cx + Ux * c1 + Vx * s1, ey = Cy + Uy * c1 + Vy * s1;
      ctx.bezierCurveTo(qx + k * (-Ux * sn + Vx * cs), qy + k * (-Uy * sn + Vy * cs), ex - k * (-Ux * s1 + Vx * c1), ey - k * (-Uy * s1 + Vy * c1), ex, ey);
      t = t1; cs = c1; sn = s1; qx = ex; qy = ey;
    }
  }
  /** circle / arc in the local XY plane at depth z */
  function circ(cx, cy, r, z, a0, a1, move) {
    arc3(cx, cy, z || 0, r, 0, 0, 0, r, 0, a0 === undefined ? 0 : a0, a1 === undefined ? TAU : a1, move !== false);
  }
  /** axis-aligned ellipse in the XY plane, rotated by rot */
  function ell(cx, cy, rx, ry, rot, z, a0, a1, move) {
    var c = cos(rot || 0), s = sin(rot || 0);
    arc3(cx, cy, z || 0, rx * c, rx * s, 0, -ry * s, ry * c, 0, a0 === undefined ? 0 : a0, a1 === undefined ? TAU : a1, move !== false);
  }
  /** variable-width filled ribbon along flat 2D points (local), projected; widths in WORLD units (x K) given by fn(u) */
  function ribbon2(a, z, wfn, col, alpha) {
    var n = a.length >> 1, pts = new Array(n), i;
    for (i = 0; i < n; i++) { P(a[2 * i], a[2 * i + 1], z); pts[i] = { x: X, y: Y }; }
    if (n < 64) pts = U.catmull(pts, 3); // densify short polylines so large renders stay perfectly smooth
    ctx.globalAlpha = A0 * CA * (alpha === undefined ? 1 : alpha); ctx.fillStyle = col;
    U.ribbon(ctx, pts, function (u, i2) { return wfn(u, i2) * K; });
  }
  function dot3(x, y, z, r, col, a) { // filled sphere-ish disc with perspective radius (r in local units)
    P(x, y, z); ctx.beginPath(); ctx.arc(X, Y, max(0.4, r * SC * F), 0, TAU); fillC(col, a);
  }
  /** point on plane polygon centroid depth (for painter sorting) */
  function depthOf(x, y, z) { return M[6] * x + M[7] * y + M[8] * (z || 0); }

  /* ------------------------------------------------------------------ hatching & boxes */
  var LDIR = (function () { var x = -0.42, y = -0.58, z = 0.70, l = sqrt(x * x + y * y + z * z); return [x / l, y / l, z / l]; })();
  function lumOf(nx, ny, nz) { // rotated-normal . light
    var rx = M[0] * nx + M[1] * ny + M[2] * nz, ry = M[3] * nx + M[4] * ny + M[5] * nz, rz = M[6] * nx + M[7] * ny + M[8] * nz;
    return rx * LDIR[0] + ry * LDIR[1] + rz * LDIR[2];
  }
  /** adds 45-degree hatch lines inside the rectangle o + eu*[0,Lu] + ev*[0,Lv] (3D local) to the current path. dir = +1 / -1 */
  function hatchRect(ox, oy, oz, ux, uy, uz, vx, vy, vz, spacing, dir, phase) {
    var Lu = sqrt(ux * ux + uy * uy + uz * uz), Lv = sqrt(vx * vx + vy * vy + vz * vz);
    if (Lu < 1e-5 || Lv < 1e-5) return;
    var eux = ux / Lu, euy = uy / Lu, euz = uz / Lu, evx = vx / Lv, evy = vy / Lv, evz = vz / Lv;
    var step = spacing * 1.4142, c = step * (phase === undefined ? 0.5 : phase), tot = Lu + Lv, x0, y0, x1, y1;
    for (; c < tot; c += step) {
      if (dir > 0) { // x + y = c
        if (c <= Lv) { x0 = 0; y0 = c; } else { x0 = c - Lv; y0 = Lv; }
        if (c <= Lu) { x1 = c; y1 = 0; } else { x1 = Lu; y1 = c - Lu; }
      } else { // (Lu - x) + y = c
        if (c <= Lv) { x0 = Lu; y0 = c; } else { x0 = Lu - (c - Lv); y0 = Lv; }
        if (c <= Lu) { x1 = Lu - c; y1 = 0; } else { x1 = 0; y1 = c - Lu; }
      }
      P(ox + eux * x0 + evx * y0, oy + euy * x0 + evy * y0, oz + euz * x0 + evz * y0); ctx.moveTo(X, Y);
      P(ox + eux * x1 + evx * y1, oy + euy * x1 + evy * y1, oz + euz * x1 + evz * y1); ctx.lineTo(X, Y);
    }
  }

  // box vertex index = ix + 2*iy(up) + 4*iz(front). faces: [corner idx x4], normal (y down)
  var FACES = [[2, 3, 7, 6], [0, 1, 5, 4], [4, 5, 7, 6], [0, 1, 3, 2], [1, 3, 7, 5], [0, 2, 6, 4]]; // top, bottom, front, back, right, left
  var FNORM = [[0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
  var EDGES = [[0, 1, 1, 3], [1, 5, 1, 4], [5, 4, 1, 2], [4, 0, 1, 5], [2, 3, 0, 3], [3, 7, 0, 4], [7, 6, 0, 2], [6, 2, 0, 5], [0, 2, 5, 3], [1, 3, 4, 3], [5, 7, 4, 2], [4, 6, 5, 2]];
  /** box in "up" coordinates: centre (cx,cz), bottom yb (up-axis), size w x h x d, optional yaw about the vertical axis */
  function mkBox(cx, yb, cz, w, h, d, yaw, tag) {
    var b = { v: [], n: [], c: [cx, -(yb + h / 2), cz], tag: tag, mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
    var cy = cos(yaw || 0), sy = sin(yaw || 0), i, hx = w / 2, hz = d / 2;
    for (i = 0; i < 8; i++) {
      var sx = (i & 1) ? hx : -hx, sz = (i & 4) ? hz : -hz, up = (i & 2) ? yb + h : yb;
      var x = cx + sx * cy + sz * sy, z = cz - sx * sy + sz * cy, y = -up;
      b.v.push([x, y, z]);
      if (x < b.mn[0]) b.mn[0] = x; if (x > b.mx[0]) b.mx[0] = x;
      if (y < b.mn[1]) b.mn[1] = y; if (y > b.mx[1]) b.mx[1] = y;
      if (z < b.mn[2]) b.mn[2] = z; if (z > b.mx[2]) b.mx[2] = z;
    }
    for (i = 0; i < 6; i++) { var n = FNORM[i]; b.n.push([n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy]); }
    return b;
  }
  /** painter order (back to front) for disjoint boxes using separating planes; falls back to centre depth */
  function orderBoxes(list) {
    var n = list.length, i, j, k, dx = M[6], dy = M[7], dz = M[8], dv = [dx, dy, dz];
    var behind = []; // behind[i][j] = i is behind j
    for (i = 0; i < n; i++) { behind.push([]); for (j = 0; j < n; j++) behind[i].push(false); }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var A = list[i], B = list[j], done = false;
      var order = [1, 0, 2];
      for (var oi = 0; oi < 3 && !done; oi++) {
        k = order[oi];
        if (A.mx[k] <= B.mn[k] + 1e-4) { if (dv[k] > 0) behind[i][j] = true; else behind[j][i] = true; done = true; }
        else if (B.mx[k] <= A.mn[k] + 1e-4) { if (dv[k] > 0) behind[j][i] = true; else behind[i][j] = true; done = true; }
      }
    }
    var out = [], used = [], depth = [];
    for (i = 0; i < n; i++) { used.push(false); var c = list[i].c; depth.push(M[6] * c[0] + M[7] * c[1] + M[8] * c[2]); }
    for (var step = 0; step < n; step++) {
      var best = -1, bestD = 1e9, any = -1, anyD = 1e9;
      for (i = 0; i < n; i++) {
        if (used[i]) continue;
        if (depth[i] < anyD) { anyD = depth[i]; any = i; }
        var free = true;
        for (j = 0; j < n; j++) if (!used[j] && j !== i && behind[j][i]) { free = false; break; }
        if (free && depth[i] < bestD) { bestD = depth[i]; best = i; }
      }
      if (best < 0) best = any;
      used[best] = true; out.push(list[best]);
    }
    return out;
  }
  function faceCorners(b, f) { var ix = FACES[f], o = []; for (var i = 0; i < 4; i++) { var v = b.v[ix[i]]; o.push(v[0], v[1], v[2]); } return o; }
  function faceVisible(b, f) { var n = b.n[f]; return M[6] * n[0] + M[7] * n[1] + M[8] * n[2] > 0.001; }
  function faceLum(b, f) { var n = b.n[f]; return lumOf(n[0], n[1], n[2]); }

  function sq(v) { return v * v; }
  function seg3(x0, y0, z0, x1, y1, z1) { P(x0, y0, z0); ctx.moveTo(X, Y); P(x1, y1, z1); ctx.lineTo(X, Y); }
  /** one massing box: lit faces white (storey lines), mid faces light hatch, shaded faces toned + hatch; few ops per box */
  function massBox(b) {
    var f, i, vis = [], cs = [], lum = [], n, any0 = false, any2 = false;
    for (f = 0; f < 6; f++) if (faceVisible(b, f)) { vis.push(f); cs.push(faceCorners(b, f)); lum.push(faceLum(b, f)); }
    n = vis.length;
    var tag = b.tag;
    if (tag === 'plate' || tag === 'slab') {
      bp(); for (i = 0; i < n; i++) if (vis[i] < 2) pl3(cs[i], true); fillC(PAPER);
      bp(); for (i = 0; i < n; i++) if (vis[i] >= 2) pl3(cs[i], true); fillC(INK);
      bp(); for (i = 0; i < n; i++) pl3(cs[i], true); strokeC(LW.thin * 1.05, INK);
      return;
    }
    if (tag === 'black') {
      bp(); for (i = 0; i < n; i++) if (vis[i] === 0) pl3(cs[i], true); fillC(INK);
      bp(); for (i = 0; i < n; i++) if (vis[i] !== 0 && lum[i] > 0.45) pl3(cs[i], true); fillC(INK2);
      bp(); for (i = 0; i < n; i++) if (vis[i] !== 0 && lum[i] <= 0.45) pl3(cs[i], true); fillC('#141416');
      bp(); for (i = 0; i < n; i++) pl3(cs[i], true); strokeC(LW.thin, INK);
      return;
    }
    var tone = [];
    for (i = 0; i < n; i++) { tone.push(lum[i] > 0.52 ? 0 : lum[i] > 0.2 ? 1 : 2); if (tone[i] === 2) any2 = true; else any0 = true; }
    if (any0) { bp(); for (i = 0; i < n; i++) if (tone[i] < 2) pl3(cs[i], true); fillC(PAPER); }
    if (any2) { bp(); for (i = 0; i < n; i++) if (tone[i] === 2) pl3(cs[i], true); fillC(G4); }
    bp();
    for (i = 0; i < n; i++) {
      var c = cs[i], f2 = vis[i];
      if (tone[i] === 0) {
        if (f2 < 2) continue; // lit top stays clean
        var vert = (f2 === 2 || f2 === 3), L = vert ? sqrt(sq(c[9] - c[0]) + sq(c[10] - c[1]) + sq(c[11] - c[2])) : sqrt(sq(c[3] - c[0]) + sq(c[4] - c[1]) + sq(c[5] - c[2]));
        var ns = Math.round(L / 0.062), k, fr;
        for (k = 1; k < ns; k++) {
          fr = k / ns;
          if (vert) seg3(c[0] + (c[9] - c[0]) * fr, c[1] + (c[10] - c[1]) * fr, c[2] + (c[11] - c[2]) * fr, c[3] + (c[9] - c[0]) * fr, c[4] + (c[10] - c[1]) * fr, c[5] + (c[11] - c[2]) * fr);
          else seg3(c[0] + (c[3] - c[0]) * fr, c[1] + (c[4] - c[1]) * fr, c[2] + (c[5] - c[2]) * fr, c[9] + (c[3] - c[0]) * fr, c[10] + (c[4] - c[1]) * fr, c[11] + (c[5] - c[2]) * fr);
        }
      } else {
        hatchRect(c[0], c[1], c[2], c[3] - c[0], c[4] - c[1], c[5] - c[2], c[9] - c[0], c[10] - c[1], c[11] - c[2], tone[i] === 1 ? 0.05 : 0.032, 1, 0.3);
      }
    }
    strokeC(LW.hair, G2, 0.85);
    bp(); for (i = 0; i < n; i++) pl3(cs[i], true); strokeC(LW.mid * 0.88, INK);
  }
  function drawBoxes(list, styler) {
    var firsts = [], rest = [], i, f;
    for (i = 0; i < list.length; i++) (list[i].first ? firsts : rest).push(list[i]);
    var ord = firsts.concat(orderBoxes(rest));
    for (i = 0; i < ord.length; i++) {
      var b = ord[i];
      if (styler) { for (f = 0; f < 6; f++) { if (faceVisible(b, f)) styler(b, f, faceCorners(b, f)); } }
      else massBox(b);
    }
  }

  /** paper sheet in the z = 0 plane (w x h centred) with a thin stack edge; afterwards content alpha reflects front / back facing */
  function paperSheet(w, h, o) {
    o = o || {};
    var t = o.thick === undefined ? 0.011 : o.thick, fill = o.fill || PAPER, edge = o.edge || INK, lwid = o.lw || LW.mid * 0.8;
    var za = BACK ? 0 : -t, zb = BACK ? -t : 0, hw = w / 2, hh = h / 2;
    var cut = o.cut || 0; // optional cut corner (top right)
    function path(z) {
      mv(-hw, -hh, z); ln(hw - cut, -hh, z);
      if (cut) ln(hw, -hh + cut, z);
      ln(hw, hh, z); ln(-hw, hh, z); ctx.closePath();
    }
    if (t > 0) {
      bp(); path(za); fillC(fill, undefined); strokeC(lwid * 0.85, edge, 0.9);
      bp(); mv(-hw, hh, za); ln(-hw, hh, zb); mv(hw, hh, za); ln(hw, hh, zb); mv(hw, -hh + cut, za); ln(hw, -hh + cut, zb); mv(-hw, -hh, za); ln(-hw, -hh, zb);
      strokeC(lwid * 0.7, edge, 0.9);
    }
    bp(); path(zb);
    ctx.globalAlpha = A0 * (o.fillAlpha === undefined ? 1 : o.fillAlpha); ctx.fillStyle = fill; ctx.fill();
    strokeC(lwid, edge);
    if (cut) { bp(); mv(hw - cut, -hh, zb); ln(hw - cut, -hh + cut, zb); ln(hw, -hh + cut, zb); strokeC(LW.thin * 0.8, G2); }
    CA = BACK ? 0.34 : 1;
  }

  var cacheN = 0, cacheStore = {};
  function cached(key, make) {
    var v = cacheStore[key];
    if (v === undefined) { if (cacheN > 160) { cacheStore = {}; cacheN = 0; } v = cacheStore[key] = make(); cacheN++; }
    return v;
  }
  var CENTER = {}; // per-prop rest-pose centring offsets (units of s), filled in at the end of the file
  var PENDOFF = null;
  function reg(name, def) {
    var d0 = def.draw;
    def.draw = function (c, p) { PENDOFF = CENTER[name] || null; d0(c, p); };
    NAMES.push(name); GA.props.register(name, def);
  }

  /* ================================================================== cubeLine */
  var CUBE_BASE = [-0.6, 0.74, 0.06];
  function cubeBoxAt(h, yaw) { return mkBox(0, -h, 0, 2 * h, 2 * h, 2 * h, yaw || 0); }
  function wireCube(b, hiddenCol, hiddenA, visW) {
    var i, e, vis = [], hid = [];
    for (i = 0; i < 12; i++) {
      e = EDGES[i];
      (faceVisible(b, e[2]) || faceVisible(b, e[3]) ? vis : hid).push(e);
    }
    if (hid.length && hiddenCol) {
      bp(); dash(5, 4);
      for (i = 0; i < hid.length; i++) { e = hid[i]; var a = b.v[e[0]], c = b.v[e[1]]; mv(a[0], a[1], a[2]); ln(c[0], c[1], c[2]); }
      strokeC(LW.hair * 1.1, hiddenCol, hiddenA); nodash();
    }
    bp();
    for (i = 0; i < vis.length; i++) { e = vis[i]; var a2 = b.v[e[0]], c2 = b.v[e[1]]; mv(a2[0], a2[1], a2[2]); ln(c2[0], c2[1], c2[2]); }
    strokeC(visW, INK);
  }
  function drawCube(c, p) {
    begin(c, p, { base: CUBE_BASE, persp: 5 });
    var v = (p.seed | 0) % 3; if (v < 0) v += 3;
    var h = 0.3, b = cubeBoxAt(h, 0), f;
    if (v === 0) { // tone cube: black top, white / grey sides (as in the sample)
      var order = [];
      for (f = 0; f < 6; f++) if (faceVisible(b, f)) order.push(f);
      for (var i = 0; i < order.length; i++) {
        f = order[i]; var cc = faceCorners(b, f), lum = faceLum(b, f);
        bp(); pl3(cc, true);
        fillC(f === 0 ? INK : lum > 0.42 ? PAPER : G3);
        strokeC(LW.mid, INK);
      }
    } else if (v === 1) { // see-through wire cube
      var sil = [];
      for (f = 0; f < 6; f++) if (faceVisible(b, f)) sil.push(f);
      bp(); for (f = 0; f < 6; f++) if (faceVisible(b, f)) { pl3(faceCorners(b, f), true); }
      fillC(PAPER, 0.82);
      wireCube(b, G2, 0.9, LW.mid);
      // a hair diagonal for the "constructed" feel
      bp(); var d0 = b.v[0], d1 = b.v[7]; mv(d0[0], d0[1], d0[2]); ln(d1[0], d1[1], d1[2]); dash(2, 5); strokeC(LW.hair, G3); nodash();
    } else { // nested volumes: big wire cube, small solid cube inside, corner links
      var s2 = cubeBoxAt(h * 0.46, 0);
      bp(); for (f = 0; f < 6; f++) if (faceVisible(b, f)) pl3(faceCorners(b, f), true);
      fillC(PAPER, 0.9);
      bp(); dash(3, 4);
      for (var k = 0; k < 8; k++) { var a = b.v[k], q = s2.v[k]; mv(a[0], a[1], a[2]); ln(q[0], q[1], q[2]); }
      strokeC(LW.hair, G2, 0.9); nodash();
      wireCube(b, G2, 0.85, LW.mid);
      for (f = 0; f < 6; f++) if (faceVisible(s2, f)) { var c3 = faceCorners(s2, f); bp(); pl3(c3, true); fillC(f === 0 ? INK : faceLum(s2, f) > 0.4 ? PAPER : G3); strokeC(LW.thin, INK); }
    }
    end();
  }
  reg('cubeLine', { draw: drawCube, box: [1.0, 0.88], tags: ['design', 'shape', 'cube'] });

  /* ================================================================== tennisBall */
  var BALLB = 0.4;
  function seamPt(th, o) { var b = BALLB; o[0] = (1 - b) * sin(th) + b * sin(3 * th); o[1] = (1 - b) * cos(th) - b * cos(3 * th); o[2] = 2 * sqrt(b * (1 - b)) * cos(2 * th); }
  var SPIN = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  function spinMat(ang, ax, ay, az) {
    var l = sqrt(ax * ax + ay * ay + az * az); ax /= l; ay /= l; az /= l;
    var c = cos(ang), s = sin(ang), t = 1 - c;
    SPIN[0] = t * ax * ax + c; SPIN[1] = t * ax * ay - s * az; SPIN[2] = t * ax * az + s * ay;
    SPIN[3] = t * ax * ay + s * az; SPIN[4] = t * ay * ay + c; SPIN[5] = t * ay * az - s * ax;
    SPIN[6] = t * ax * az - s * ay; SPIN[7] = t * ay * az + s * ax; SPIN[8] = t * az * az + c;
  }
  var SEAMS = (function () { // [bandIndex][side] -> flat xyz of the offset seam curves; ticks across the band
    var N = 108, out = [], bands = [0.062, 0.05], bi, k, i, th, o = { b: [], t: [] }, A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    for (bi = 0; bi < 2; bi++) {
      var bw = bands[bi], sides = [[], []];
      for (k = 0; k < 2; k++) {
        var side = k ? 1 : -1;
        for (i = 0; i <= N; i++) {
          th = (i / N) * TAU; seamPt(th, A); seamPt(th + 0.01, B); seamPt(th - 0.01, C);
          var tx = B[0] - C[0], ty = B[1] - C[1], tz = B[2] - C[2];
          var nx = A[1] * tz - A[2] * ty, ny = A[2] * tx - A[0] * tz, nz = A[0] * ty - A[1] * tx, nl = sqrt(nx * nx + ny * ny + nz * nz) || 1;
          var qx = A[0] + nx / nl * bw * side, qy = A[1] + ny / nl * bw * side, qz = A[2] + nz / nl * bw * side, ql = sqrt(qx * qx + qy * qy + qz * qz);
          sides[k].push(qx / ql, qy / ql, qz / ql);
        }
      }
      out.push(sides);
    }
    var ticks = [];
    for (i = 0; i < 30; i++) {
      th = (i / 30) * TAU + 0.05; seamPt(th, A); seamPt(th + 0.01, B); seamPt(th - 0.01, C);
      var ux = B[0] - C[0], uy = B[1] - C[1], uz = B[2] - C[2];
      var mx = A[1] * uz - A[2] * uy, my = A[2] * ux - A[0] * uz, mz = A[0] * uy - A[1] * ux, ml = sqrt(mx * mx + my * my + mz * mz) || 1, w = 0.062 * 0.8;
      var p0x = A[0] + mx / ml * w, p0y = A[1] + my / ml * w, p0z = A[2] + mz / ml * w, p1x = A[0] - mx / ml * w, p1y = A[1] - my / ml * w, p1z = A[2] - mz / ml * w;
      ticks.push(p0x, p0y, p0z, p1x, p1y, p1z);
    }
    return { N: N, bands: out, ticks: ticks };
  })();
  /** tennis ball (line art): drawn at local (cx,cy,cz) radius r; spin: [angle, ax,ay,az] */
  function drawBallAt(cx, cy, cz, r, spin, withShade, weight) {
    var w = weight || 1, i, side, run, sx, sy, sz;
    P(cx, cy, cz); var ox = X, oy = Y, rr = r * SC * F, big = rr > 26;
    bp(); ctx.arc(ox, oy, rr, 0, TAU); fillC(PAPER); strokeC(LW.thin * 1.35 * w, INK);
    spinMat(spin[0], spin[1], spin[2], spin[3]);
    var band = SEAMS.bands[big ? 0 : 1], N = SEAMS.N;
    bp();
    for (side = 0; side < 2; side++) {
      var a = band[side], qx = 0, qy = 0; run = false;
      for (i = 0; i <= N; i++) {
        sx = SPIN[0] * a[3 * i] + SPIN[1] * a[3 * i + 1] + SPIN[2] * a[3 * i + 2];
        sy = SPIN[3] * a[3 * i] + SPIN[4] * a[3 * i + 1] + SPIN[5] * a[3 * i + 2];
        sz = SPIN[6] * a[3 * i] + SPIN[7] * a[3 * i + 1] + SPIN[8] * a[3 * i + 2];
        P(cx + sx * r, cy + sy * r, cz + sz * r);
        if (Z - cz > 0.004) {
          if (!run) { ctx.moveTo(X, Y); run = true; } else ctx.quadraticCurveTo(qx, qy, (qx + X) / 2, (qy + Y) / 2);
          qx = X; qy = Y;
        } else if (run) { ctx.lineTo(qx, qy); run = false; }
      }
      if (run) ctx.lineTo(qx, qy);
    }
    strokeC(LW.thin * 1.05 * w, INK);
    if (big) { // stitch ticks across the seam band
      var tk = SEAMS.ticks, j, ax, ay, az, bx, by, bz;
      bp();
      for (j = 0; j < tk.length; j += 6) {
        ax = SPIN[0] * tk[j] + SPIN[1] * tk[j + 1] + SPIN[2] * tk[j + 2]; ay = SPIN[3] * tk[j] + SPIN[4] * tk[j + 1] + SPIN[5] * tk[j + 2]; az = SPIN[6] * tk[j] + SPIN[7] * tk[j + 1] + SPIN[8] * tk[j + 2];
        bx = SPIN[0] * tk[j + 3] + SPIN[1] * tk[j + 4] + SPIN[2] * tk[j + 5]; by = SPIN[3] * tk[j + 3] + SPIN[4] * tk[j + 4] + SPIN[5] * tk[j + 5]; bz = SPIN[6] * tk[j + 3] + SPIN[7] * tk[j + 4] + SPIN[8] * tk[j + 5];
        P(cx + ax * r, cy + ay * r, cz + az * r); var px0 = X, py0 = Y, pz0 = Z;
        P(cx + bx * r, cy + by * r, cz + bz * r);
        if (pz0 - cz > 0.22 && Z - cz > 0.22) { ctx.moveTo(px0, py0); ctx.lineTo(X, Y); }
      }
      strokeC(LW.hair * 0.8 * w, G1, 0.7);
    }
    if (withShade) { // two hair arcs hugging the shadow limb
      bp(); ctx.arc(ox, oy, rr * 0.88, 0.12 * PI, 0.62 * PI); ctx.moveTo(ox + rr * 0.76 * cos(0.22 * PI), oy + rr * 0.76 * sin(0.22 * PI)); ctx.arc(ox, oy, rr * 0.76, 0.22 * PI, 0.52 * PI); strokeC(LW.hair, G3);
    }
  }
  function drawBall(c, p) {
    begin(c, p, { persp: 5 });
    drawBallAt(0, 0, 0, 0.5, [0.5 + (p.t || 0) * 0.55 + ((p.seed | 0) % 7) * 0.9, 0.35, 1, 0.2], true, 1);
    end();
  }
  reg('tennisBall', { draw: drawBall, box: [1, 1], tags: ['sport', 'ball', 'tennis'] });

  /* ================================================================== tennisRacket */
  var RK = (function () {
    var N = 84, cx = 0, cy = -0.205, rx = 0.188, ry = 0.272, e = 0.075, i;
    function cl(a, o) { o[0] = cx + rx * sin(a) * (1 + e * cos(a)); o[1] = cy - ry * cos(a); }
    function tw(a) { return 0.034 - 0.006 * (1 - cos(a)) * 0.5 * 0.9 + 0.003 * cos(a); }
    var outer = [], inner = [], mid = [], a, p0 = [0, 0], p1 = [0, 0], p2 = [0, 0];
    for (i = 0; i < N; i++) {
      a = (i / N) * TAU; cl(a, p0); cl(a + 0.002, p1); cl(a - 0.002, p2);
      var tx = p1[0] - p2[0], ty = p1[1] - p2[1], tl = sqrt(tx * tx + ty * ty), nx = ty / tl, ny = -tx / tl, h = tw(a) / 2;
      outer.push(p0[0] + nx * h, p0[1] + ny * h); inner.push(p0[0] - nx * h, p0[1] - ny * h); mid.push(p0[0], p0[1]);
    }
    // string chords: where each string meets the inner edge of the frame (no clipping needed at draw time)
    var nM = 11, nC = 15, mains = [], crosses = [], ni = inner.length / 2;
    function chordV(xs) { var lo = 1e9, hi = -1e9, k; for (k = 0; k < ni; k++) { var j = (k + 1) % ni, x0 = inner[2 * k], x1 = inner[2 * j]; if ((x0 - xs) * (x1 - xs) < 0) { var y = inner[2 * k + 1] + (inner[2 * j + 1] - inner[2 * k + 1]) * (xs - x0) / (x1 - x0); lo = min(lo, y); hi = max(hi, y); } } return [xs, lo, hi]; }
    function chordH(ys) { var lo = 1e9, hi = -1e9, k; for (k = 0; k < ni; k++) { var j = (k + 1) % ni, y0 = inner[2 * k + 1], y1 = inner[2 * j + 1]; if ((y0 - ys) * (y1 - ys) < 0) { var x = inner[2 * k] + (inner[2 * j] - inner[2 * k]) * (ys - y0) / (y1 - y0); lo = min(lo, x); hi = max(hi, x); } } return [ys, lo, hi]; }
    var ch;
    for (i = 0; i < nM; i++) { ch = chordV((i - (nM - 1) / 2) * 0.0325); if (ch[2] > ch[1]) mains.push(ch); }
    for (i = 0; i < nC; i++) { ch = chordH(cy + (i - (nC - 1) / 2) * 0.034); if (ch[2] > ch[1]) crosses.push(ch); }
    return { outer: outer, inner: inner, mid: mid, cx: cx, cy: cy, rx: rx, ry: ry, e: e, cl: cl, mains: mains, crosses: crosses, cMain: chordV(0), cCross: chordH(cy) };
  })();
  function drawRacket(c, p) {
    begin(c, p, { persp: 5, soft: 1.15, minN: 0.45, base: [0, 0, 0] });
    var zs = BACK ? -1 : 1, i, zf = 0.011 * zs, zb = -0.011 * zs;
    // back frame copy (gives the frame some depth when it tumbles)
    bp(); smooth2(RK.outer, zb, true); smooth2(RK.inner, zb, true); fillC(INK, 1, true);
    // string bed
    bp(); smooth2(RK.inner, 0, true); fillRaw(PAPER);
    bp();
    for (i = 0; i < RK.mains.length; i++) { var cm = RK.mains[i]; seg(cm[0], cm[1], cm[0], cm[2], 0); }
    for (i = 0; i < RK.crosses.length; i++) { var cc = RK.crosses[i]; seg(cc[1], cc[0], cc[2], cc[0], 0); }
    strokeC(LW.hair * 0.95, G2);
    bp(); seg(RK.cMain[0], RK.cMain[1], RK.cMain[0], RK.cMain[2], 0); seg(RK.cCross[1], RK.cCross[0], RK.cCross[2], RK.cCross[0], 0); strokeC(LW.hair * 1.15, G1, 0.85);
    // throat arms
    var Lp = [0, 0], Rp = [0, 0];
    RK.cl(PI + 0.62, Lp); RK.cl(PI - 0.62, Rp);
    function arm(sx) {
      var p0 = sx < 0 ? Lp : Rp;
      var pts = [p0[0] * 0.94, p0[1] - 0.012, p0[0] * 0.80, p0[1] + 0.045, p0[0] * 0.38, p0[1] + 0.088, 0.0, 0.178];
      return pts;
    }
    function armRibbon(sx) {
      var pa = arm(sx), samp = [], n = 14, t, mt;
      for (i = 0; i <= n; i++) { t = i / n; mt = 1 - t; samp.push(mt * mt * mt * pa[0] + 3 * mt * mt * t * pa[2] + 3 * mt * t * t * pa[4] + t * t * t * pa[6], mt * mt * mt * pa[1] + 3 * mt * mt * t * pa[3] + 3 * mt * t * t * pa[5] + t * t * t * pa[7]); }
      return samp;
    }
    var la = armRibbon(-1), ra = armRibbon(1);
    ctx.fillStyle = INK; ctx.globalAlpha = A0;
    var wfn = function (u) { return (0.027 - 0.008 * u) * SC / K; };
    ribbon2(la, zf, wfn, INK); ribbon2(ra, zf, wfn, INK);
    // shaft + handle
    bp();
    mv(-0.0165, 0.17, zf); ln(0.0165, 0.17, zf);
    // flare into the handle, rounded butt end
    P(0.0185, 0.2, zf); var f1x = X, f1y = Y; P(0.031, 0.222, zf); ctx.quadraticCurveTo(f1x, f1y, X, Y);
    ln(0.0335, 0.472, zf);
    P(0.0335, 0.5, zf); var bx = X, by = Y; P(0.0, 0.5, zf); ctx.quadraticCurveTo(bx, by, X, Y);
    P(-0.0335, 0.5, zf); var bx2 = X, by2 = Y; P(-0.0335, 0.472, zf); ctx.quadraticCurveTo(bx2, by2, X, Y);
    ln(-0.031, 0.222, zf);
    P(-0.0185, 0.2, zf); var f2x = X, f2y = Y; P(-0.0165, 0.17, zf); ctx.quadraticCurveTo(f2x, f2y, X, Y);
    ctx.closePath(); fillC(INK);
    // grip wrap ticks + collar + butt
    bp();
    for (i = 0; i < 12; i++) { var yy = 0.262 + i * 0.0185; seg(-0.031, yy + 0.014, 0.031, yy - 0.004, zf); }
    strokeC(LW.hair, G2, 0.8);
    bp(); seg(-0.0245, 0.215, 0.0245, 0.215, zf); strokeC(LW.thin * 1.2, PAPER, 0.95);
    bp(); seg(-0.0335, 0.472, 0.0335, 0.472, zf); strokeC(LW.hair, G1, 0.9);
    // front frame copy
    bp(); smooth2(RK.outer, zf, true); smooth2(RK.inner, zf, true); fillC(INK, 1, true);
    // frame highlight (a fine light line inside the black frame = vector sheen)
    bp(); smooth2(RK.mid, zf, true);
    ctx.save(); ctx.lineWidth = 0.8 * K; ctx.strokeStyle = G1; ctx.globalAlpha = A0 * 0.8; ctx.stroke(); ctx.restore();
    end();
  }
  reg('tennisRacket', { draw: drawRacket, box: [0.41, 1.0], tags: ['sport', 'tennis', 'racket'] });

  /* ------------------------------------------------------------------ slabs standing on a plane (z = 0 plane, rising toward +z) */
  function slab(x0, y0, x1, y1, h, topCol, sideCol, o) {
    o = o || {};
    var faces = [], i;
    // sides: [normal, quad]
    var S = [
      [[0, 1, 0], [x0, y1, 0, x1, y1, 0, x1, y1, h, x0, y1, h]],
      [[0, -1, 0], [x1, y0, 0, x0, y0, 0, x0, y0, h, x1, y0, h]],
      [[1, 0, 0], [x1, y1, 0, x1, y0, 0, x1, y0, h, x1, y1, h]],
      [[-1, 0, 0], [x0, y0, 0, x0, y1, 0, x0, y1, h, x0, y0, h]]];
    for (i = 0; i < 4; i++) {
      var n = S[i][0], vis = M[6] * n[0] + M[7] * n[1] > 0.001;
      if (vis) faces.push({ q: S[i][1], lum: lumOf(n[0], n[1], 0), side: true });
    }
    for (i = 0; i < faces.length; i++) {
      var f = faces[i];
      bp(); pl3(f.q, true); fillC(sideCol || PAPER); strokeC(LW.thin, INK);
      if (o.pageLines && i === 0) { // book page lines on the first visible side
        bp(); var q = f.q;
        for (var k = 1; k < 3; k++) { var tt = k / 3; seg(q[0] + (q[9] - q[0]) * tt + (q[3] - q[0]) * 0.04, q[1] + (q[10] - q[1]) * tt + (q[4] - q[1]) * 0.04, q[3] + (q[6] - q[3]) * tt - (q[3] - q[0]) * 0.04, q[4] + (q[7] - q[4]) * tt - (q[4] - q[1]) * 0.04, q[2] + (q[11] - q[2]) * tt); }
        strokeC(LW.hair, G2);
      }
    }
    if (M[8] > 0.001) { bp(); pl3([x0, y0, h, x1, y0, h, x1, y1, h, x0, y1, h], true); fillC(topCol || INK); strokeC(LW.thin, INK); }
  }

  /* ================================================================== gridPlane */
  var GRID_BASE = [0.72, 0.28, -0.14];
  function gridData(seed) {
    return cached('grid' + seed, function () {
      var R = U.rng(seed * 31 + 7), g = { v: [], h: [] }, i;
      for (i = 0; i < 9; i++) g.v.push([R.range(0.0, 0.05), R.range(0.0, 0.05), R.next() < 0.18 ? R.range(0.02, 0.07) : 0, R.next() < 0.25]);
      for (i = 0; i < 7; i++) g.h.push([R.range(0.0, 0.05), R.range(0.0, 0.05), R.next() < 0.18 ? R.range(0.02, 0.07) : 0, R.next() < 0.25]);
      return g;
    });
  }
  function drawGridPlane(c, p) {
    begin(c, p, { base: GRID_BASE, soft: 0.55, minN: 0.3, persp: 3.0, scale: 0.86 });
    var seed = p.seed | 0, v = ((seed % 3) + 3) % 3, g = gridData(seed), i, w = 1.0, h = 0.8, sx = w / 8, sy = h / 6;
    // paper-white underlay hides lines behind the grid
    bp(); pl2([-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2], 0, true); fillRaw(PAPER, 0.88);
    CA = BACK ? 0.5 : 1;
    // grid lines (two weights of grey, hand-drawn overshoot)
    for (var pass = 0; pass < 2; pass++) {
      bp();
      for (i = 0; i < 9; i++) { var gv = g.v[i]; if (gv[3] !== (pass === 1)) continue; var x = -w / 2 + i * sx; seg(x, -h / 2 + gv[2] - gv[0], x, h / 2 + gv[1], 0); }
      for (i = 0; i < 7; i++) { var gh = g.h[i]; if (gh[3] !== (pass === 1)) continue; var y = -h / 2 + i * sy; seg(-w / 2 + gh[2] - gh[0], y, w / 2 + gh[1], y, 0); }
      strokeC(pass === 0 ? LW.thin * 0.95 : LW.thin * 0.8, pass === 0 ? G2 : G3);
    }
    // the sketch lying on the grid
    var zS = 0.002;
    if (v === 0) { // "N" line sketch + closed black book
      bp(); seg(-0.30, -0.21, 0.12, 0.10, zS); seg(0.12, 0.10, 0.12, -0.14, zS); strokeC(LW.bold * 1.1, INK);
      bp(); seg(-0.07, -0.03, -0.07, 0.30, zS); strokeC(LW.bold * 1.1, INK);
      slab(0.10, 0.12, 0.40, 0.30, 0.045, INK, PAPER, { pageLines: true });
    } else if (v === 1) { // swooping trajectory with a dot, dashed return
      var pts = [-0.34, 0.20, -0.2, -0.08, 0.02, -0.26, 0.26, -0.12, 0.38, 0.12];
      var cv = U.catmull((function () { var o = []; for (var k = 0; k < pts.length; k += 2) o.push({ x: pts[k], y: pts[k + 1] }); return o; })(), 8, false), flat = [];
      for (var k2 = 0; k2 < cv.length; k2++) flat.push(cv[k2].x, cv[k2].y);
      ribbon2(flat, zS, function (u) { return 1.2 + 4.8 * Math.pow(sin(PI * clamp(u * 1.05, 0, 1)), 0.8); }, INK);
      dot3(0.38, 0.12, zS, 0.026, INK);
      bp(); dash(5, 5); seg(-0.34, 0.24, 0.30, 0.26, zS); strokeC(LW.thin, G1); nodash();
    } else { // little solid cube + angular line
      bp(); seg(-0.34, 0.10, -0.12, -0.10, zS); seg(-0.12, -0.10, 0.06, 0.02, zS); seg(0.06, 0.02, 0.2, -0.22, zS); strokeC(LW.bold, INK);
      slab(-0.02, 0.12, 0.2, 0.32, 0.2, INK, PAPER);
      bp(); dash(4, 5); seg(0.20, 0.34, 0.42, 0.34, zS); strokeC(LW.thin, G1); nodash();
    }
    end();
  }
  reg('gridPlane', { draw: drawGridPlane, box: [1.05, 0.64], tags: ['design', 'grid', 'sketch'] });

  /* ================================================================== scribble */
  function drawScribble(c, p) {
    begin(c, p, { base: [0.18, -0.12, 0], soft: 1.1, minN: 0.45, persp: 5 });
    var t = p.t || 0, seed = p.seed | 0, tone = ((seed % 3) + 3) % 3, col = tone === 1 ? INK : G2, k = 4.1 + (seed % 2) * 0.5;
    var N = 150, pts = [], i, u, th, env, wv, amp = 0.2, kk = 0.9, norm = Math.asin(kk);
    for (i = 0; i <= N; i++) {
      u = i / N; th = u * k * TAU - t * 1.5;
      env = U.smoothstep(0.0, 0.22, u) * Math.pow(1 - U.smoothstep(0.38, 1.0, u), 0.9) * (1 + 0.18 * sin(t * 1.3 + u * 4));
      wv = Math.asin(kk * sin(th)) / norm;                     // rounded triangle wave = sharp scribble peaks
      wv += 0.16 * sin(2 * th + 0.6);
      pts.push(-0.5 + u * 0.8, -amp * env * wv + 0.05 * (1 - u));
    }
    var wmain = function (u) { return (0.9 + 1.7 * Math.pow(sin(PI * clamp(u, 0, 1)), 0.7)) * (tone === 1 ? 1.2 : 1); };
    ribbon2(pts, 0, wmain, col);
    // broken tail: dash + dot, as if the pen lifted
    var tx0 = 0.34, tail = [];
    for (i = 0; i <= 14; i++) { u = i / 14; tail.push(tx0 + 0.06 + u * 0.1, 0.03 + 0.01 * sin(u * 5 - t * 1.2) + 0.02 * u); }
    ribbon2(tail, 0, function (uu) { return 0.8 + 1.1 * sin(PI * uu); }, col, 0.9);
    P(0.49, 0.07, 0); ctx.beginPath(); ctx.arc(X, Y, 1.2 * K, 0, TAU); fillC(col);
    end();
  }
  reg('scribble', { draw: drawScribble, box: [1.0, 0.47], tags: ['design', 'line', 'sketch'] });

  /* ------------------------------------------------------------------ folded shapes (two facets hinged on x = 0) */
  function fold(x, y, h) { return [x * cos(h), y, -abs(x) * sin(h)]; }
  function facet3(pts, h) { var o = [], i; for (i = 0; i < pts.length; i += 2) { var f = fold(pts[i], pts[i + 1], h); o.push(f[0], f[1], f[2]); } return o; }
  /** draws two facets [polygon pts 2D, crease edge index] with painter ordering; fills[0/1]; outline weight */
  function foldedShape(fa, fb, h, fillA, fillB, w) {
    var A = facet3(fa[0], h), B = facet3(fb[0], h), order = [[A, fa[1], fillA], [B, fb[1], fillB]], i;
    function cz(q) { var s = 0, n = q.length / 3; for (var k = 0; k < q.length; k += 3) s += depthOf(q[k], q[k + 1], q[k + 2]); return s / n; }
    if (cz(A) > cz(B)) order.reverse();
    for (i = 0; i < 2; i++) { bp(); pl3(order[i][0], true); fillC(order[i][2]); }
    for (i = 0; i < 2; i++) {
      var q = order[i][0], n = q.length / 3, c = order[i][1];
      bp();
      for (var k = 0; k < n; k++) { // every edge except the crease (c -> c+1)
        var idx = (c + 1 + k) % n; P(q[idx * 3], q[idx * 3 + 1], q[idx * 3 + 2]);
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      strokeC(w, INK);
    }
    // crease
    var q0 = order[0][0], c0 = order[0][1], n0 = q0.length / 3, i0 = c0 % n0, i1 = (c0 + 1) % n0;
    bp(); mv(q0[i0 * 3], q0[i0 * 3 + 1], q0[i0 * 3 + 2]); ln(q0[i1 * 3], q0[i1 * 3 + 1], q0[i1 * 3 + 2]); strokeC(w * 0.55, INK);
  }

  /* ================================================================== shapeTri */
  function drawTri(c, p) {
    begin(c, p, { base: [-0.25, 0.14, 0.2], soft: 1.15, minN: 0.66, persp: 4 });
    var v = (p.seed | 0) % 2;
    if (v === 0) {
      foldedShape([[0, -0.46, -0.5, 0.4, 0, 0.4], 2], [[0, -0.46, 0, 0.4, 0.5, 0.4], 1], 0.17, PAPER, G4, LW.mid * 1.05);
    } else { // open outline triangle with an inner offset triangle
      bp(); pl2([0, -0.46, 0.5, 0.4, -0.5, 0.4], 0, true); fillC(PAPER); strokeC(LW.mid * 1.05, INK);
      bp(); pl2([0, -0.17, 0.25, 0.26, -0.25, 0.26], 0, true); strokeC(LW.thin, G1);
      dot3(0, 0.1, 0, 0.03, INK);
    }
    end();
  }
  reg('shapeTri', { draw: drawTri, box: [0.92, 0.87], tags: ['shape', 'abstract'] });

  /* ================================================================== shapeChevron */
  function drawChevron(c, p) {
    begin(c, p, { base: [-0.25, 0.2, -0.15], soft: 1.15, minN: 0.66, persp: 4 });
    // outer apex O, inner apex I, left blunt end, right tapered tip (folded along the bisector x = 0)
    foldedShape([[0, 0.16, -0.5, -0.06, -0.41, -0.2, 0, 0.0], 3], [[0, 0.16, 0, 0.0, 0.5, -0.42], 0], 0.2, PAPER, G4, LW.mid * 1.05);
    end();
  }
  reg('shapeChevron', { draw: drawChevron, box: [0.91, 0.64], tags: ['shape', 'abstract', 'arrow'] });

  /* ================================================================== shapeDiamond */
  function drawDiamond(c, p) {
    begin(c, p, { base: [-0.25, 0.2, 0.25], soft: 1.15, minN: 0.66, persp: 4 });
    var v = (p.seed | 0) % 2;
    if (v === 0) {
      foldedShape([[0, -0.5, -0.32, 0.06, 0, 0.5], 2], [[0, -0.5, 0, 0.5, 0.26, -0.1], 1], 0.22, PAPER, G4, LW.mid * 1.05);
    } else {
      bp(); pl2([0, -0.5, 0.3, 0, 0, 0.5, -0.3, 0], 0, true); fillC(PAPER); strokeC(LW.mid * 1.05, INK);
      bp(); pl2([0, -0.26, 0.15, 0, 0, 0.26, -0.15, 0], 0, true); fillC(G4); strokeC(LW.thin, G1);
      bp(); seg(0, -0.5, 0, 0.5, 0); strokeC(LW.hair, G2);
    }
    end();
  }
  reg('shapeDiamond', { draw: drawDiamond, box: [0.58, 0.93], tags: ['shape', 'abstract'] });

  /* ================================================================== shapeCircle */
  function sphereCircle(ux, uy, uz, vx, vy, vz, r, front, back) {
    // visible part of a great circle spanned by u,v (unit vectors scaled by r)
    var zu = M[6] * ux + M[7] * uy + M[8] * uz, zv = M[6] * vx + M[7] * vy + M[8] * vz;
    var phi = atan2(zv, zu);
    if (back) { bp(); dash(4, 4); arc3(0, 0, 0, ux * r, uy * r, uz * r, vx * r, vy * r, vz * r, phi + PI / 2, phi + 3 * PI / 2, true); strokeC(LW.hair * 1.1, G2, 0.85); nodash(); }
    if (front) { bp(); arc3(0, 0, 0, ux * r, uy * r, uz * r, vx * r, vy * r, vz * r, phi - PI / 2, phi + PI / 2, true); strokeC(LW.thin * 1.1, INK); }
  }
  function drawCircle(c, p) {
    var v = ((p.seed | 0) % 3 + 3) % 3;
    begin(c, p, { base: v === 0 ? [-0.5, 0.1, 0] : [-0.3, 0.2, 0], soft: 1.15, minN: v === 0 ? 0 : 0.6, persp: 5 });
    if (v === 0) { // wire globe
      P(0, 0, 0); var ox = X, oy = Y, rr = 0.5 * SC * F;
      bp(); ctx.arc(ox, oy, rr, 0, TAU); fillC(PAPER); strokeC(LW.mid, INK);
      sphereCircle(1, 0, 0, 0, 0, 1, 0.5, true, true);   // equator
      sphereCircle(0, 1, 0, 0, 0, 1, 0.5, true, true);   // meridian
      sphereCircle(1, 0, 0, 0, 1, 0, 0.5, false, false);
    } else if (v === 1) { // ring with a dot, double hairline
      bp(); circ(0, 0, 0.5, 0); fillC(PAPER); strokeC(LW.mid, INK);
      bp(); circ(0, 0, 0.34, 0); strokeC(LW.hair * 1.1, G3);
      dot3(0, 0, 0.0, 0.085, INK);
    } else { // tangent rings: an ink circle with a smaller hairline circle touching it from inside and a solid dot at the touch point (crisp, no fill, no polygon)
      bp(); circ(0, 0, 0.5, 0); fillC(PAPER); strokeC(LW.mid * 1.1, INK);
      bp(); circ(0.22, 0.0, 0.28, 0); strokeC(LW.thin, INK);
      bp(); circ(0.22, 0.0, 0.14, 0); strokeC(LW.hair * 1.1, G1);
      dot3(0.5, 0.0, 0.0, 0.05, INK);
    }
    end();
  }
  reg('shapeCircle', { draw: drawCircle, box: [1, 1], tags: ['shape', 'abstract', 'circle'] });

  /* ================================================================== dotCluster */
  function dotData(seed) {
    return cached('dots' + seed, function () {
      var R = U.rng(seed * 13 + 5), d = [], i, mx = R.sign(), my = R.sign(), rot = R.range(-0.35, 0.35);
      // composition: one big dot, a trailing arc of shrinking dots, ring dots and a few specks
      var base = [[-0.2, 0.03, 0.095, 0], [0.08, -0.1, 0.056, 0], [0.2, -0.17, 0.042, 0], [0.31, -0.2, 0.031, 0], [0.42, -0.2, 0.022, 0],
        [0.1, 0.22, 0.06, 1], [-0.42, -0.2, 0.04, 1], [0.3, 0.12, 0.03, 0], [-0.06, -0.27, 0.024, 0], [0.22, 0.29, 0.018, 0], [-0.45, 0.17, 0.02, 0], [0.45, 0.03, 0.015, 0], [-0.3, 0.27, 0.014, 0]];
      for (i = 0; i < base.length; i++) {
        var b = base[i], x = b[0] * mx, y = b[1] * my, c = cos(rot), s = sin(rot);
        d.push({ x: x * c - y * s, y: x * s + y * c, z: R.range(-0.12, 0.12), r: b[2] * R.range(0.92, 1.1), ring: !!b[3], w: R.range(0.5, 1.1), ph: R.range(0, TAU), am: R.range(0.01, 0.022) });
      }
      return d;
    });
  }
  function drawDots(c, p) {
    begin(c, p, { base: [-0.25, 0.1, 0.0], persp: 3.6 });
    var d = dotData(p.seed | 0), t = p.t || 0, i, pts = [];
    for (i = 0; i < d.length; i++) {
      var q = d[i];
      pts.push({ x: q.x + q.am * sin(q.w * t + q.ph), y: q.y + q.am * cos(q.w * t * 0.8 + q.ph * 1.3), z: q.z + q.am * sin(q.w * t * 0.6 + q.ph), r: q.r, ring: q.ring });
    }
    // faint dashed links
    bp(); dash(3, 5); mv(pts[0].x, pts[0].y, pts[0].z); ln(pts[5].x, pts[5].y, pts[5].z); strokeC(LW.hair, G2, 0.85);
    bp(); mv(pts[1].x, pts[1].y, pts[1].z); ln(pts[7].x, pts[7].y, pts[7].z); strokeC(LW.hair, G3, 0.9); nodash();
    pts.sort(function (a, b) { return depthOf(a.x, a.y, a.z) - depthOf(b.x, b.y, b.z); });
    for (i = 0; i < pts.length; i++) {
      var o = pts[i];
      if (o.ring) { P(o.x, o.y, o.z); bp(); ctx.arc(X, Y, o.r * SC * F * 1.2, 0, TAU); fillC(PAPER); strokeC(LW.thin * 1.1, INK); }
      else dot3(o.x, o.y, o.z, o.r, INK);
    }
    end();
  }
  reg('dotCluster', { draw: drawDots, box: [0.96, 0.66], tags: ['dots', 'abstract'] });

  /* ------------------------------------------------------------------ drawing-sheet helpers */
  function rectPath(x0, y0, x1, y1, z) { mv(x0, y0, z); ln(x1, y0, z); ln(x1, y1, z); ln(x0, y1, z); ctx.closePath(); }
  function frameLine(w, h, inset) { bp(); rectPath(-w / 2 + inset, -h / 2 + inset, w / 2 - inset, h / 2 - inset, 0); strokeC(LW.hair * 1.1, G2, 0.9); }
  /** dimension line with 45-degree architectural ticks. horizontal: y fixed, from xa to xb; ticks at xs[] */
  function dimLineH(y, xa, xb, xs, tk) {
    seg(xa - 0.012, y, xb + 0.012, y, 0);
    for (var i = 0; i < xs.length; i++) seg(xs[i] - tk, y + tk, xs[i] + tk, y - tk, 0);
  }
  function dimLineV(x, ya, yb, ys, tk) {
    seg(x, ya - 0.012, x, yb + 0.012, 0);
    for (var i = 0; i < ys.length; i++) seg(x - tk, ys[i] + tk, x + tk, ys[i] - tk, 0);
  }
  function doorSwing(hx, hy, ex, ey, sx, sy) {
    var r = sqrt((ex - hx) * (ex - hx) + (ey - hy) * (ey - hy)), a0 = atan2(sy - hy, sx - hx), a1 = atan2(ey - hy, ex - hx);
    var d = ((a1 - a0 + 3 * PI) % TAU) - PI;
    arc3(hx, hy, 0, r, 0, 0, 0, r, 0, a0, a0 + d, true);
  }
  function tinyN(x, y, s) { bp(); mv(x - s, y + s, 0); ln(x - s, y - s, 0); ln(x + s, y + s, 0); ln(x + s, y - s, 0); strokeC(LW.thin * 0.9, INK); }
  function hatchBand(x0, y0, x1, y1, sp, dir, col, w, a) { // 45-degree hatch in an axis-aligned rect on the sheet plane
    bp(); hatchRect(x0, y0, 0, x1 - x0, 0, 0, 0, y1 - y0, 0, sp, dir, 0.3); strokeC(w, col, a);
  }

  /** scalloped tree crown outline (flat points), used by sketches and the treePlan prop */
  function crownPts(cx, cy, r, n, seed) {
    var R = U.rng(seed), o = [], i, a, rr, ph = R.range(0, TAU), N = 96, wob = R.range(0.9, 1.1);
    for (i = 0; i < N; i++) {
      a = i / N * TAU;
      rr = r * (0.8 + 0.2 * Math.pow(abs(sin(n * a / 2 + ph)), 0.7)) * (1 + 0.05 * sin(a * 2 + seed) * wob);
      o.push(cx + cos(a) * rr, cy + sin(a) * rr * 0.94);
    }
    return o;
  }
  function crown(cx, cy, r, seed) {
    var pts = crownPts(cx, cy, r, 7, seed);
    bp(); pl2(pts, 0, true); fillC(PAPER); strokeC(LW.thin, INK);
    bp(); // a few leaf-cluster arcs inside
    circ(cx - r * 0.2, cy - r * 0.15, r * 0.34, 0, 3.4, 5.6, true); circ(cx + r * 0.28, cy + r * 0.12, r * 0.3, 0, 0.2, 2.4, true); circ(cx - r * 0.05, cy + r * 0.35, r * 0.22, 0, 0.6, 2.6, true);
    strokeC(LW.hair * 1.1, G1, 0.9);
  }
  /** small scale-figure silhouette, feet at (x, yb), height h (sheet units) */
  var PERSON = [-0.10, -0.80, 0.10, -0.80, 0.125, -0.47, 0.095, -0.45, 0.09, 0.0, 0.016, 0.0, 0.012, -0.40, -0.012, -0.40, -0.016, 0.0, -0.09, 0.0, -0.095, -0.45, -0.125, -0.47];
  function person(x, yb, h, col, z) {
    var pts = [], i;
    for (i = 0; i < PERSON.length; i += 2) pts.push(x + PERSON[i] * h, yb + PERSON[i + 1] * h);
    bp(); pl2(pts, z || 0, true); rectPath(x - 0.028 * h, yb - 0.87 * h, x + 0.028 * h, yb - 0.77 * h, z || 0); fillC(col || INK);
    bp(); circ(x, yb - 0.915 * h, 0.07 * h, z || 0); fillC(col || INK);
  }
  function tinyA(x, y, s) { bp(); mv(x - s, y + s, 0); ln(x, y - s, 0); ln(x + s, y + s, 0); mv(x - s * 0.55, y + s * 0.35, 0); ln(x + s * 0.55, y + s * 0.35, 0); strokeC(LW.thin * 0.9, INK); }

  /* ================================================================== sketchPlan */
  var PLAN = (function () {
    var T = 0.026, h = T / 2, walls = [];
    function H(y, a, b) { walls.push([a - h, y - h, b + h, y + h]); }
    function V(x, a, b) { walls.push([x - h, a - h, x + h, b + h]); }
    H(-0.20, -0.36, -0.22); H(-0.20, -0.10, 0.06); V(0.06, -0.20, -0.10); H(-0.10, 0.06, 0.32);
    V(0.32, -0.10, 0.02); V(0.32, 0.14, 0.24);
    H(0.24, -0.36, -0.30); H(0.24, -0.18, 0.0); H(0.24, 0.12, 0.32);
    V(-0.36, -0.20, -0.14); V(-0.36, -0.02, 0.24);
    V(-0.04, -0.20, -0.10); V(-0.04, -0.02, 0.04);
    H(0.04, -0.36, -0.20); H(0.04, -0.10, 0.12);
    V(0.12, 0.04, 0.10); V(0.12, 0.20, 0.24);
    var wins = [[-0.22, -0.20 - h, -0.10, -0.20 + h, 0], [0.32 - h, 0.02, 0.32 + h, 0.14, 1], [-0.30, 0.24 - h, -0.18, 0.24 + h, 0], [-0.36 - h, -0.14, -0.36 + h, -0.02, 1]];
    var doors = [[0.12, 0.24, 0.12, 0.12, 0.0, 0.24], [-0.20, 0.04, -0.20, -0.06, -0.10, 0.04], [-0.04, -0.10, 0.04, -0.10, -0.04, -0.02], [0.12, 0.20, 0.22, 0.20, 0.12, 0.10]];
    return { walls: walls, wins: wins, doors: doors };
  })();
  function drawPlan(c, p) {
    begin(c, p, { base: [-0.27, 0.17, -0.03], soft: 1.1, minN: 0.5, persp: 4 });
    var SW = 1.0, SH = 0.74, i;
    paperSheet(SW, SH);
    frameLine(SW, SH, 0.03);
    // pencil construction lines, overshooting the walls
    bp();
    seg(-0.42, -0.20, 0.12, -0.20, 0); seg(-0.42, 0.24, 0.40, 0.24, 0); seg(0.0, -0.10, 0.40, -0.10, 0); seg(-0.42, 0.04, 0.17, 0.04, 0);
    seg(-0.36, -0.26, -0.36, 0.30, 0); seg(0.32, -0.17, 0.32, 0.30, 0); seg(0.06, -0.26, 0.06, -0.05, 0); seg(-0.04, -0.26, -0.04, 0.10, 0);
    strokeC(LW.hair * 0.9, G3, 0.9);
    // floor pattern in the small room
    hatchBand(0.137, 0.057, 0.307, 0.227, 0.026, -1, G3, LW.hair * 0.9, 0.9);
    // wall poche
    bp(); for (i = 0; i < PLAN.walls.length; i++) { var w = PLAN.walls[i]; rectPath(w[0], w[1], w[2], w[3], 0); }
    fillC(INK);
    // windows: glass line + frame
    bp(); for (i = 0; i < PLAN.wins.length; i++) { var q = PLAN.wins[i]; rectPath(q[0], q[1], q[2], q[3], 0); } fillC(PAPER); strokeC(LW.thin, INK);
    bp(); for (i = 0; i < PLAN.wins.length; i++) { var q2 = PLAN.wins[i]; if (q2[4]) seg((q2[0] + q2[2]) / 2, q2[1], (q2[0] + q2[2]) / 2, q2[3], 0); else seg(q2[0], (q2[1] + q2[3]) / 2, q2[2], (q2[1] + q2[3]) / 2, 0); }
    strokeC(LW.hair * 1.1, INK);
    // door leaves + swing arcs
    bp(); for (i = 0; i < PLAN.doors.length; i++) { var d = PLAN.doors[i]; seg(d[0], d[1], d[2], d[3], 0); }
    strokeC(LW.thin * 1.25, INK);
    bp(); for (i = 0; i < PLAN.doors.length; i++) { var d2 = PLAN.doors[i]; doorSwing(d2[0], d2[1], d2[2], d2[3], d2[4], d2[5]); }
    strokeC(LW.hair * 1.15, G1);
    // furniture
    bp();
    rectPath(-0.32, -0.175, -0.15, -0.005, 0); seg(-0.265, -0.175, -0.265, -0.005, 0); seg(-0.15, -0.075, -0.21, -0.075, 0); // bed
    circ(-0.17, 0.15, 0.036, 0, 0, TAU, true);                                                                               // table
    circ(-0.17 + 0.06, 0.15, 0.014, 0, 0, TAU, true); circ(-0.17 - 0.06, 0.15, 0.014, 0, 0, TAU, true); circ(-0.17, 0.15 + 0.06, 0.014, 0, 0, TAU, true); circ(-0.17, 0.15 - 0.06, 0.014, 0, 0, TAU, true);
    rectPath(0.12, -0.075, 0.30, -0.028, 0); seg(0.12, -0.062, 0.30, -0.062, 0);                                              // sofa
    rectPath(0.285, 0.065, 0.305, 0.22, 0); circ(0.295, 0.105, 0.0095, 0, 0, TAU, true); circ(0.295, 0.158, 0.007, 0, 0, TAU, true); circ(0.295, 0.188, 0.007, 0, 0, TAU, true); // counter
    strokeC(LW.hair * 1.15, G1);
    // dimension strings
    bp(); dimLineH(-0.292, -0.36, 0.32, [-0.36, 0.06, 0.32], 0.014); dimLineV(-0.445, -0.20, 0.24, [-0.20, 0.04, 0.24], 0.014);
    seg(-0.36, -0.225, -0.36, -0.30, 0); seg(0.06, -0.225, 0.06, -0.30, 0); seg(0.32, -0.12, 0.32, -0.30, 0); seg(-0.385, -0.20, -0.457, -0.20, 0); seg(-0.385, 0.24, -0.457, 0.24, 0); seg(-0.385, 0.04, -0.457, 0.04, 0);
    strokeC(LW.hair * 1.2, INK, 0.9);
    bp(); seg(-0.2, -0.305, -0.13, -0.305, 0); seg(0.14, -0.305, 0.2, -0.305, 0); seg(-0.43, -0.09, -0.43, -0.03, 0); seg(-0.43, 0.1, -0.43, 0.16, 0); strokeC(LW.thin * 1.3, G2, 0.9); // "figures"
    // north arrow + title block
    bp(); circ(0.405, -0.225, 0.036, 0, 0, TAU, true); strokeC(LW.hair * 1.2, G1);
    bp(); pl2([0.405, -0.268, 0.392, -0.19, 0.405, -0.208, 0.418, -0.19], 0, true); fillC(INK);
    tinyN(0.405, -0.295, 0.0085);
    bp(); rectPath(0.17, 0.272, 0.465, 0.335, 0); seg(0.17, 0.305, 0.465, 0.305, 0); seg(0.33, 0.272, 0.33, 0.335, 0); strokeC(LW.hair * 1.1, G2);
    bp(); rectPath(0.178, 0.28, 0.21, 0.297, 0); fillC(INK);
    end();
  }
  reg('sketchPlan', { draw: drawPlan, box: [1.01, 0.75], tags: ['design', 'sketch', 'plan', 'architecture'] });

  /* ================================================================== sketchPersp */
  var VLX = -1.45, VRX = 1.55, HY = -0.31;
  function lerpY(x0, y0, vx, x) { return y0 + (HY - y0) * (x - x0) / (vx - x0); }
  function pbox(xc, yt, yb, xl, xr) {
    var b = { xc: xc, yt: yt, yb: yb, xl: xl, xr: xr };
    b.lt = lerpY(xc, yt, VLX, xl); b.lb = lerpY(xc, yb, VLX, xl); b.rt = lerpY(xc, yt, VRX, xr); b.rb = lerpY(xc, yb, VRX, xr);
    var a1 = (HY - b.lt) / (VRX - xl), a2 = (HY - b.rt) / (VLX - xr);
    b.tx = (b.rt - b.lt + a1 * xl - a2 * xr) / (a1 - a2); b.ty = b.lt + a1 * (b.tx - xl);
    return b;
  }
  function pboxOn(par, ka, kb, h, kl, kr) { // a block standing on the top face of `par`
    var Fx = par.xc, Fy = par.yt, Lx = par.xl, Ly = par.lt, Rx = par.xr, Ry = par.rt;
    var bx = Fx + ka * (Lx - Fx) + kb * (Rx - Fx), by = Fy + ka * (Ly - Fy) + kb * (Ry - Fy);
    var xl = bx + kl * (Lx - Fx), xr = bx + kr * (Rx - Fx);
    return pbox(bx, by - h, by, xl, xr);
  }
  function pWindows(b, side, nb, rows, solid) { // side: 'R' | 'L'
    var xc = b.xc, xe = side === 'R' ? b.xr : b.xl, vx = side === 'R' ? VRX : VLX, r = 0.86, tot = 0, k, j, xs = [0];
    for (k = 0; k < nb; k++) { tot += Math.pow(r, k); xs.push(tot); }
    bp();
    for (k = 0; k < nb; k++) {
      var xa = xc + (xe - xc) * (xs[k] + (xs[k + 1] - xs[k]) * 0.2) / tot, xb = xc + (xe - xc) * (xs[k] + (xs[k + 1] - xs[k]) * 0.8) / tot;
      for (j = 0; j < rows; j++) {
        var fa = (j + 0.22) / rows, fb = (j + 0.74) / rows;
        var ta = lerpY(xc, b.yt, vx, xa), ba = lerpY(xc, b.yb, vx, xa), tb = lerpY(xc, b.yt, vx, xb), bb = lerpY(xc, b.yb, vx, xb);
        pl2([xa, ta + (ba - ta) * fa, xb, tb + (bb - tb) * fa, xb, tb + (bb - tb) * fb, xa, ta + (ba - ta) * fb], 0, true);
      }
    }
    if (solid) fillC(INK); else { fillC(PAPER); strokeC(LW.thin * 0.9, INK); }
  }
  function pHatchLeft(b, sp, minF) { // vertical shading strokes on the shaded face
    var n = Math.max(3, Math.round(abs(b.xc - b.xl) / sp)), k;
    bp();
    for (k = 1; k < n; k++) {
      var f = k / n, x = b.xc + (b.xl - b.xc) * f, ya = lerpY(b.xc, b.yt, VLX, x), yb = lerpY(b.xc, b.yb, VLX, x);
      var len = 1 - (1 - minF) * (0.5 + 0.5 * sin(k * 2.17)) * 0.9 * f; // ragged, hand-drawn
      seg(x, yb, x, yb + (ya - yb) * len, 0);
    }
    strokeC(LW.hair * 0.95, G1, 0.8);
  }
  function drawBlock(b, o) {
    bp(); pl2([b.xc, b.yt, b.xl, b.lt, b.xl, b.lb, b.xc, b.yb], 0, true); pl2([b.xc, b.yt, b.xr, b.rt, b.xr, b.rb, b.xc, b.yb], 0, true); pl2([b.xc, b.yt, b.xl, b.lt, b.tx, b.ty, b.xr, b.rt], 0, true);
    fillC(PAPER); strokeC(LW.thin * 1.15, INK);
    pHatchLeft(b, 0.0125, 0.55);
    if (o && o.winR) pWindows(b, 'R', o.winR[0], o.winR[1], true);
    if (o && o.winL) pWindows(b, 'L', o.winL[0], o.winL[1], false);
    // quick-sketch overshoot on the vertical edges
    bp(); seg(b.xc, b.yt - 0.014, b.xc, b.yb + 0.012, 0); seg(b.xl, b.lt - 0.01, b.xl, b.lb + 0.01, 0); seg(b.xr, b.rt - 0.01, b.xr, b.rb + 0.012, 0);
    strokeC(LW.thin * 1.1, INK);
  }
  function drawPersp(c, p) {
    begin(c, p, { base: [-0.24, -0.16, 0.03], soft: 1.1, minN: 0.5, persp: 4 });
    var SW = 1.0, SH = 0.74, i;
    paperSheet(SW, SH);
    frameLine(SW, SH, 0.03);
    var pod = pbox(0.13, 0.14, 0.235, -0.40, 0.41);
    var main = pboxOn(pod, 0.30, 0.20, 0.25, 0.55, 0.50);
    var tower = pboxOn(pod, 0.62, 0.56, 0.27, 0.34, 0.22);
    // horizon + perspective construction lines
    bp(); dash(7, 6); seg(-0.47, HY, 0.47, HY, 0); strokeC(LW.hair, G3); nodash();
    bp();
    var pts = [[main.xc, main.yt], [main.xc, main.yb], [tower.xc, tower.yt], [main.xl, main.lt], [main.xr, main.rt]];
    for (i = 0; i < pts.length; i++) { seg(pts[i][0], pts[i][1], -0.47, lerpY(pts[i][0], pts[i][1], VLX, -0.47), 0); seg(pts[i][0], pts[i][1], 0.47, lerpY(pts[i][0], pts[i][1], VRX, 0.47), 0); }
    strokeC(LW.hair * 0.85, G3, 0.9);
    // ground shadow strokes
    bp(); pl2([pod.xc, pod.yb, pod.xr, pod.rb, pod.xr + 0.05, pod.rb + 0.045, pod.xc + 0.05, pod.yb + 0.045], 0, true); fillC(G4);
    drawBlock(tower, { winR: [3, 5], winL: [2, 5] });
    drawBlock(pod, { winR: [6, 1], winL: [5, 1] });
    drawBlock(main, { winR: [4, 3], winL: [3, 3] });
    // tree (cloud crown on a trunk) at the lower left, scale figure at the lower right
    bp(); seg(-0.34, 0.31, -0.34, 0.2, 0); strokeC(LW.thin * 1.2, INK);
    crown(-0.34, 0.15, 0.06, 5);
    person(0.37, 0.31, 0.12, INK);
    end();
  }
  reg('sketchPersp', { draw: drawPersp, box: [1.01, 0.75], tags: ['design', 'sketch', 'perspective', 'architecture'] });

  /* ================================================================== sketchSection */
  function drawSection(c, p) {
    begin(c, p, { base: [-0.25, -0.17, -0.03], soft: 1.1, minN: 0.5, persp: 4 });
    var SW = 1.0, SH = 0.74, i;
    paperSheet(SW, SH);
    frameLine(SW, SH, 0.03);
    var G0 = 0.17, L0 = 0.15, L1 = -0.01, RF = -0.17, xl = -0.26, xr = 0.2, ST = 0.022, wt = 0.02;
    // ground: poche strip + hatching below
    hatchBand(-0.47, G0 + 0.03, 0.47, 0.32, 0.03, 1, G2, LW.hair, 0.9);
    bp(); seg(-0.47, G0, 0.47, G0, 0); strokeC(LW.mid * 0.95, INK);
    bp(); rectPath(xl - 0.05, G0, xr + 0.05, G0 + 0.03, 0); fillC(INK);
    // beyond the cut: back wall, window, furniture (grey)
    bp(); rectPath(xl + wt / 2, RF + ST, xr - wt / 2, L0, 0); fillC(G4, 0.7);
    bp(); rectPath(0.06, -0.14, 0.17, -0.06, 0); seg(0.115, -0.14, 0.115, -0.06, 0); seg(0.06, -0.10, 0.17, -0.10, 0); strokeC(LW.hair * 1.15, G2);
    bp(); rectPath(-0.1, 0.07, 0.04, 0.085, 0); seg(-0.09, 0.085, -0.09, L0, 0); seg(0.03, 0.085, 0.03, L0, 0); rectPath(0.09, 0.1, 0.17, L0, 0); strokeC(LW.hair * 1.15, G2);
    bp(); seg(-0.12, RF + ST, -0.12, -0.115, 0); circ(-0.12, -0.095, 0.02, 0, 0, PI, true); strokeC(LW.hair * 1.15, G2); // pendant lamp
    // slabs (poche)
    bp(); rectPath(xl - 0.02, L0 - 0.001, xr + 0.02, L0 + ST, 0); rectPath(xl - 0.02, L1 - 0.001, xr + 0.02, L1 + ST, 0);
    rectPath(xl - 0.07, RF - 0.002, xr + 0.07, RF + ST, 0); fillC(INK);
    // walls with openings
    bp(); rectPath(xl - wt / 2, RF, xl + wt / 2, 0.035, 0); rectPath(xl - wt / 2, 0.115, xl + wt / 2, L0, 0);
    rectPath(xr - wt / 2, RF, xr + wt / 2, -0.12, 0); rectPath(xr - wt / 2, -0.05, xr + wt / 2, L0 - 0.001, 0); fillC(INK);
    // parapet
    bp(); rectPath(xl - 0.07, RF - 0.03, xl - 0.05, RF, 0); rectPath(xr + 0.05, RF - 0.03, xr + 0.07, RF, 0); fillC(INK);
    // stair (profile) between ground and first floor
    var sx = -0.2, n = 8, rise = (L0 - L1) / n, run = 0.02, sp = [];
    sp.push(sx, L0);
    for (i = 0; i < n; i++) { sp.push(sx + i * run, L0 - (i + 1) * rise, sx + (i + 1) * run, L0 - (i + 1) * rise); }
    sp.push(sx + n * run, L1 + ST, sx + 0.035, L0);
    bp(); pl2(sp, 0, true); fillC(G3); strokeC(LW.thin * 1.15, INK);
    bp(); var hr0 = L0 - 0.075, hr1 = L1 - 0.075; seg(sx + 0.004, hr0 - rise, sx + n * run + 0.01, hr1, 0); for (i = 1; i < n; i += 2) seg(sx + i * run + 0.008, L0 - (i + 1) * rise, sx + i * run + 0.008, L0 - (i + 1) * rise - 0.07, 0); strokeC(LW.hair * 1.1, INK); // handrail
    // human scale figure on the upper floor
    person(0.075, L1 - 0.001, 0.1, INK);
    // level datums + markers
    bp(); dash(6, 3); seg(xr + 0.03, L0, 0.34, L0, 0); seg(xr + 0.03, L1, 0.34, L1, 0); seg(xr + 0.09, RF, 0.34, RF, 0); strokeC(LW.hair * 1.1, G2); nodash();
    bp(); var lv = [L0, L1, RF]; for (i = 0; i < 3; i++) { pl2([0.345, lv[i] - 0.015, 0.37, lv[i] - 0.015, 0.3575, lv[i] + 0.01], 0, true); }
    strokeC(LW.thin, INK);
    bp(); pl2([0.345, L0 - 0.015, 0.37, L0 - 0.015, 0.3575, L0 + 0.01], 0, true); pl2([0.345, RF - 0.015, 0.37, RF - 0.015, 0.3575, RF + 0.01], 0, true); fillC(INK);
    // grid axis with bubble
    bp(); dash(10, 3); seg(xl, RF - 0.05, xl, G0 + 0.0, 0); strokeC(LW.hair * 1.1, G1); nodash();
    bp(); circ(xl, RF - 0.085, 0.03, 0, 0, TAU, true); fillC(PAPER); strokeC(LW.thin, INK);
    tinyA(xl, RF - 0.085, 0.0105);
    // dimension chain (left)
    bp(); dimLineV(-0.4, RF, L0, [RF, L1, L0], 0.014); seg(-0.415, RF, xl - 0.08, RF, 0); seg(-0.415, L1, xl - 0.04, L1, 0); seg(-0.415, L0, xl - 0.04, L0, 0); strokeC(LW.hair * 1.2, INK, 0.9);
    bp(); seg(-0.43, -0.09, -0.43, -0.03, 0); seg(-0.43, 0.06, -0.43, 0.11, 0); strokeC(LW.thin * 1.3, G2, 0.9);
    // tree at the right
    bp(); seg(0.425, G0, 0.425, 0.085, 0); strokeC(LW.thin * 1.2, INK);
    crown(0.425, 0.045, 0.048, 9);
    end();
  }
  reg('sketchSection', { draw: drawSection, box: [1.04, 0.75], tags: ['design', 'sketch', 'section', 'architecture'] });

  /* ================================================================== iterations */
  // evolving form v1 -> v5, drawn with small oblique blocks
  var FORMS = [
    [[-0.18, 0.015, 0.34, 0.15, 0.1]],
    [[-0.2, 0.0, 0.26, 0.165, 0.1], [0.06, 0.055, 0.16, 0.11, 0.08]],
    [[-0.2, 0.0, 0.26, 0.165, 0.1], [0.06, 0.055, 0.16, 0.11, 0.08], [-0.16, -0.1, 0.15, 0.1, 0.07]],
    [[-0.2, -0.03, 0.24, 0.195, 0.1], [0.05, 0.055, 0.17, 0.11, 0.08], [-0.17, -0.14, 0.17, 0.11, 0.07], [0.0, -0.09, 0.12, 0.05, 0.05]],
    [[-0.21, -0.045, 0.22, 0.21, 0.1], [0.03, 0.055, 0.2, 0.11, 0.08], [-0.2, -0.16, 0.13, 0.115, 0.07], [-0.04, -0.11, 0.2, 0.05, 0.06], [0.16, 0.0, 0.07, 0.055, 0.05]]
  ];
  var ITER_EDGE = [G3, G3, G2, G1, INK];
  function drawIterations(c, p) {
    begin(c, p, { base: [-0.25, 0.18, 0.08], soft: 1.1, minN: 0.5, persp: 4 });
    var t = p.t || 0, N = 5, sw = 0.66, sh = 0.5, px = -0.24, py = 0.3, i, oi, order = [], rzs = [];
    for (i = 0; i < N; i++) { rzs.push((i - 2) * 0.125 + 0.012 * sin(t * 1.1 + i * 1.3)); order.push(i); }
    if (BACK) order.reverse();
    var a2 = 0, z2 = 0;
    function q(x, y) { P(px + (x - px) * cos(a2) - (y - py) * sin(a2), py + (x - px) * sin(a2) + (y - py) * cos(a2), z2); }
    function qm(x, y) { q(x, y); ctx.moveTo(X, Y); }
    function ql(x, y) { q(x, y); ctx.lineTo(X, Y); }
    function poly(a) { for (var k = 0; k < a.length; k += 2) { if (k === 0) qm(a[k], a[k + 1]); else ql(a[k], a[k + 1]); } ctx.closePath(); }
    for (oi = 0; oi < N; oi++) {
      i = order[oi]; a2 = rzs[i]; z2 = (i - 2) * 0.05;
      var ec = ITER_EDGE[i], wgt = 0.55 + 0.12 * i, last = i === N - 1, detail = i >= N - 2, form = FORMS[i], fi, b, x, y, w, h, d, dx, dy;
      bp(); poly([-sw / 2, -sh / 2, sw / 2, -sh / 2, sw / 2, sh / 2, -sw / 2, sh / 2]);
      ctx.globalAlpha = A0 * 0.62; ctx.fillStyle = PAPER; ctx.fill();
      strokeC(LW.mid * wgt * 0.9, ec);
      if (!detail) { // older versions: ghosted outlines only
        bp(); qm(-0.28, 0.165); ql(0.28, 0.165);
        for (fi = 0; fi < form.length; fi++) {
          b = form[fi]; x = b[0]; y = b[1]; w = b[2]; h = b[3]; d = b[4]; dx = d * 0.6; dy = -d * 0.45;
          poly([x, y, x + dx, y + dy, x + w + dx, y + dy, x + w, y]); poly([x + w, y, x + w + dx, y + dy, x + w + dx, y + h + dy, x + w, y + h]); poly([x, y, x + w, y, x + w, y + h, x, y + h]);
        }
        var cxo = 0.22 - i * 0.012; if (i >= 1) { q(cxo, -0.18); var rr0 = (0.02 + 0.004 * i) * SC * F; ctx.moveTo(X + rr0, Y); ctx.arc(X, Y, rr0, 0, TAU); }
        for (var k0 = 0; k0 <= i; k0++) { qm(-0.29 + k0 * 0.026, 0.215); ql(-0.29 + k0 * 0.026, 0.235); }
        strokeC(LW.thin * wgt, ec, 0.8);
        continue;
      }
      bp(); qm(-0.28, 0.165); ql(0.28, 0.165); strokeC(LW.thin * wgt, ec, 0.9);
      var fa = last ? 1 : 0.55;
      for (fi = 0; fi < form.length; fi++) {
        b = form[fi]; x = b[0]; y = b[1]; w = b[2]; h = b[3]; d = b[4]; dx = d * 0.6; dy = -d * 0.45;
        bp(); poly([x, y, x + dx, y + dy, x + w + dx, y + dy, x + w, y]); poly([x, y, x + w, y, x + w, y + h, x, y + h]); ctx.globalAlpha = A0 * fa; ctx.fillStyle = PAPER; ctx.fill();
        bp(); poly([x + w, y, x + w + dx, y + dy, x + w + dx, y + h + dy, x + w, y + h]); ctx.globalAlpha = A0 * fa; ctx.fillStyle = last ? G3 : G4; ctx.fill();
        bp(); poly([x, y, x + dx, y + dy, x + w + dx, y + dy, x + w, y]); poly([x + w, y, x + w + dx, y + dy, x + w + dx, y + h + dy, x + w, y + h]); poly([x, y, x + w, y, x + w, y + h, x, y + h]);
        strokeC(LW.thin * wgt, ec);
        if (last && fi === 0) { bp(); poly([x + w * 0.62, y + h, x + w * 0.62, y + h * 0.5, x + w * 0.78, y + h * 0.5, x + w * 0.78, y + h]); fillC(INK); }
      }
      bp(); var cx1 = 0.22 - i * 0.012; q(cx1, -0.18); var rr1 = (0.02 + 0.004 * i) * SC * F; ctx.moveTo(X + rr1, Y); ctx.arc(X, Y, rr1, 0, TAU);
      for (var k1 = 0; k1 <= i; k1++) { qm(-0.29 + k1 * 0.026, 0.215); ql(-0.29 + k1 * 0.026, 0.235); }
      strokeC(LW.thin * wgt, ec, 0.95);
      if (last) { bp(); poly([-0.2, -0.265, -0.1, -0.27, -0.095, -0.225, -0.205, -0.22]); fillC(G3, 0.85); strokeC(LW.hair, G2, 0.7); }
    }
    end();
  }
  reg('iterations', { draw: drawIterations, box: [0.91, 0.79], tags: ['design', 'process', 'sketch', 'iteration'] });

  /* ================================================================== processDiagram */
  var PD_R = [0.07, 0.058, 0.082, 0.06, 0.068, 0.056];
  function drawProcess(c, p) {
    begin(c, p, { base: [-0.16, 0.1, 0], soft: 1.15, minN: 0.5, persp: 5 });
    var t = p.t || 0, n = 6, rx = 0.4, ry = 0.355, i, k, nodes = [];
    for (i = 0; i < n; i++) { var a = -PI / 2 + i * TAU / n + 0.12 * sin(i * 1.7); nodes.push({ a: a, x: rx * cos(a), y: ry * sin(a), r: PD_R[i] }); }
    // outer dotted guide ring + inner feedback arrow
    bp(); dash(1.5, 7); ell(0, 0, rx + 0.07, ry + 0.07, 0, 0); strokeC(LW.thin * 1.1, G3); nodash();
    // arrows around the loop
    for (i = 0; i < n; i++) {
      var A = nodes[i], B = nodes[(i + 1) % n], a0 = A.a, a1 = B.a; if (a1 < a0) a1 += TAU;
      var g0 = (A.r + 0.026) / rx, g1 = (B.r + 0.042) / rx, m = 18, pts = [];
      for (k = 0; k <= m; k++) { var aa = a0 + g0 + (a1 - a0 - g0 - g1) * (k / m); pts.push(rx * cos(aa), ry * sin(aa)); }
      var ph = ((t * 0.45 + i / n) % 1);
      ribbon2(pts, 0, function (u) { var pulse = Math.exp(-Math.pow((u - ph) * 5, 2)); return 0.9 + 2.5 * u + 2.0 * pulse; }, INK);
      // arrow head
      var ex = pts[2 * m], ey = pts[2 * m + 1], tx = ex - pts[2 * m - 2], ty = ey - pts[2 * m - 1], tl = sqrt(tx * tx + ty * ty), nx = -ty / tl, ny = tx / tl, hs = 0.03;
      bp(); pl2([ex + tx / tl * 0.03, ey + ty / tl * 0.03, ex - tx / tl * 0.004 + nx * hs * 0.55, ey - ty / tl * 0.004 + ny * hs * 0.55, ex - tx / tl * 0.004 - nx * hs * 0.55, ey - ty / tl * 0.004 - ny * hs * 0.55], 0, true); fillC(INK);
      // flowing dot
      var fu = (t * 0.32 + i * 0.37) % 1;
      if (fu > 0.08 && fu < 0.92) { var fk = fu * m, fk0 = floor(fk), fr = fk - fk0, fx = mix(pts[2 * fk0], pts[2 * min(m, fk0 + 1)], fr), fy = mix(pts[2 * fk0 + 1], pts[2 * min(m, fk0 + 1) + 1], fr); P(fx, fy, 0.02); bp(); ctx.arc(X, Y, 0.011 * SC, 0, TAU); fillC(PAPER); strokeC(LW.hair * 1.3, INK); }
    }
    // feedback arrow across the middle (dashed)
    var f0x = nodes[3].x * 0.6, f0y = nodes[3].y * 0.6, fcx = -0.2, fcy = 0.02, f1x = nodes[0].x * 0.5, f1y = nodes[0].y * 0.5 + 0.03;
    bp(); dash(5, 4); mv(f0x, f0y, 0); P(fcx, fcy, 0); var qx = X, qy = Y; P(f1x, f1y, 0); ctx.quadraticCurveTo(qx, qy, X, Y); strokeC(LW.thin, G2); nodash();
    var fdx = f1x - fcx, fdy = f1y - fcy, fdl = sqrt(fdx * fdx + fdy * fdy); fdx /= fdl; fdy /= fdl;
    bp(); pl2([f1x + fdx * 0.026, f1y + fdy * 0.026, f1x - fdy * 0.016, f1y + fdx * 0.016, f1x + fdy * 0.016, f1y - fdx * 0.016], 0, true); fillC(G2);
    // nodes
    for (i = 0; i < n; i++) {
      var nd = nodes[i], r = nd.r;
      bp(); circ(nd.x, nd.y, r, 0.01); fillC(i === 0 ? INK : PAPER); strokeC(LW.mid, INK);
      if (i === 0) { bp(); circ(nd.x, nd.y, r * 0.52, 0.012); strokeC(LW.thin, PAPER, 0.95); }
      else if (i === 1) { dot3(nd.x, nd.y, 0.012, r * 0.36, INK); }
      else if (i === 2) { bp(); circ(nd.x, nd.y, r * 0.58, 0.012); fillC(G4); strokeC(LW.thin, INK); }
      else if (i === 3) { bp(); seg(nd.x - r * 0.5, nd.y, nd.x + r * 0.5, nd.y, 0.012); seg(nd.x, nd.y - r * 0.5, nd.x, nd.y + r * 0.5, 0.012); strokeC(LW.thin * 1.2, INK); }
      else if (i === 4) { bp(); pl2([nd.x, nd.y - r * 0.55, nd.x + r * 0.55, nd.y, nd.x, nd.y + r * 0.55, nd.x - r * 0.55, nd.y], 0.012, true); strokeC(LW.thin * 1.1, INK); }
      else { bp(); pl2([nd.x - r * 0.5, nd.y + r * 0.02, nd.x - r * 0.12, nd.y + r * 0.42, nd.x + r * 0.55, nd.y - r * 0.4], 0.012, false); strokeC(LW.thin * 1.4, INK); }
    }
    // little satellite nodes
    P(-0.02, -0.01, 0); bp(); ctx.arc(X, Y, 0.016 * SC, 0, TAU); fillC(INK);
    P(0.5, -0.36, 0); bp(); ctx.arc(X, Y, 0.012 * SC, 0, TAU); fillC(G2);
    end();
  }
  reg('processDiagram', { draw: drawProcess, box: [0.98, 0.84], tags: ['design', 'process', 'diagram'] });

  /* ================================================================== massing models (A, B, C) */
  var MASS_BASE = [-0.56, 0.74, 0.0];
  function massDraw(c, p, list, base) {
    begin(c, p, { base: base || MASS_BASE, persp: 9, scale: 0.86 });
    drawBoxes(list());
    end();
  }
  var MASS_A = function () {
    return [mkBox(0, -0.27, 0, 0.98, 0.035, 0.72, 0, 'plate'),
      mkBox(-0.07, -0.235, -0.05, 0.74, 0.14, 0.48, 0),
      mkBox(-0.07, -0.095, -0.05, 0.79, 0.018, 0.53, 0, 'slab'),
      mkBox(-0.15, -0.077, -0.03, 0.5, 0.14, 0.34, 0),
      mkBox(-0.15, 0.063, -0.03, 0.55, 0.018, 0.39, 0, 'slab'),
      mkBox(-0.2, 0.081, -0.01, 0.26, 0.14, 0.2, 0),
      mkBox(-0.2, 0.221, -0.01, 0.31, 0.018, 0.25, 0, 'slab'),
      mkBox(0.33, -0.235, 0.24, 0.2, 0.09, 0.2, 0),
      mkBox(0.33, -0.145, 0.24, 0.25, 0.016, 0.25, 0, 'slab')];
  };
  var MASS_B = function () {
    var core = mkBox(0.27, -0.235, -0.1, 0.18, 0.49, 0.18, 0, 'black'), i;
    core.first = true;
    var l = [mkBox(0, -0.27, 0, 0.98, 0.035, 0.72, 0, 'plate'), core, mkBox(-0.2, -0.235, 0.12, 0.5, 0.12, 0.34, 0), mkBox(-0.2, -0.115, 0.12, 0.55, 0.014, 0.39, 0, 'slab'), mkBox(-0.32, -0.101, 0.12, 0.26, 0.08, 0.22, 0)];
    for (i = 0; i < 7; i++) l.push(mkBox(0.27, -0.235 + i * 0.07 + 0.02, -0.1, 0.28, 0.05, 0.28, i * 0.075 - 0.2));
    return l;
  };
  var MASS_C = function () {
    var l = [mkBox(0, -0.27, 0, 1.0, 0.035, 0.76, 0, 'plate')], H = [[0.1, 0.26, 0.15], [0.2, 0.07, 0.34], [0.12, 0.19, 0.06]], W = [[0.2, 0.26, 0.22], [0.24, 0.18, 0.2], [0.22, 0.24, 0.2]], D = [[0.2, 0.17, 0.2], [0.2, 0.18, 0.2], [0.17, 0.2, 0.16]], i, j;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      if (i === 2 && j === 0) continue;
      l.push(mkBox((i - 1) * 0.31, -0.235, (j - 1) * 0.23, W[j][i], H[j][i], D[j][i], 0, (i === 2 && j === 1) ? 'black' : undefined));
    }
    return l;
  };
  reg('massingA', { draw: function (c, p) { massDraw(c, p, MASS_A); }, box: [0.99, 0.62], tags: ['design', 'massing', 'model', 'architecture'] });
  reg('massingB', { draw: function (c, p) { massDraw(c, p, MASS_B, [-0.56, 0.62, 0.0]); }, box: [0.99, 0.68], tags: ['design', 'massing', 'model', 'architecture'] });
  reg('massingC', { draw: function (c, p) { massDraw(c, p, MASS_C, [-0.58, 0.55, 0.0]); }, box: [1.01, 0.55], tags: ['design', 'massing', 'model', 'architecture'] });

  /* ================================================================== tracingRoll */
  function drawRoll(c, p) {
    begin(c, p, { base: [-0.5, -0.52, 0.0], persp: 6 });
    var t = p.t || 0, R = 0.2, xa = -0.36, xb = 0.36, i, k;
    // surface point on the end circle at angle th (local y down / z)
    var phi = atan2(M[8], M[7]), t1 = phi - PI / 2, t2 = phi + PI / 2;
    var nearRight = M[6] > 0, xn = nearRight ? xb : xa, xf = nearRight ? xa : xb;
    function endPt(x, th) { P(x, R * cos(th), R * sin(th)); }
    // tongue (unrolled paper): surface y(u), z(u)
    var curl = 0.2 + 0.02 * sin(t * 1.3), lenZ = 0.5, sway = 0.014 * sin(t * 0.9);
    function tUp(u) { return -curl * Math.pow(u, 2.4); }
    function tZ(u) { return lenZ * u; }
    var nU = 14, tongueFirst = depthOf(0, R, 0.25) < 0;
    function drawTongue() {
      var pts = [], j, u;
      for (j = 0; j <= nU; j++) { u = j / nU; pts.push([xa + sway * u * u, R + tUp(u), tZ(u)]); }
      for (j = nU; j >= 0; j--) { u = j / nU; pts.push([xb + sway * u * u, R + tUp(u), tZ(u)]); }
      bp(); for (j = 0; j < pts.length; j++) { P(pts[j][0], pts[j][1], pts[j][2]); if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.closePath();
      fillC(PAPER, 0.93); strokeC(LW.mid * 0.85, INK);
      // plan lines drawn on the sheet: wall rectangle, a diagonal, a dimension tick row
      function sp(x, uu) { P(mix(xa, xb, x) + sway * uu * uu, R + tUp(uu), tZ(uu)); }
      var segs = [[0.12, 0.2, 0.62, 0.2], [0.62, 0.2, 0.62, 0.55], [0.62, 0.55, 0.12, 0.55], [0.12, 0.55, 0.12, 0.2], [0.12, 0.55, 0.38, 0.38], [0.22, 0.2, 0.22, 0.33], [0.72, 0.15, 0.88, 0.15], [0.72, 0.62, 0.88, 0.62], [0.8, 0.15, 0.8, 0.62]];
      bp();
      for (j = 0; j < segs.length; j++) { var s = segs[j], m = 8; for (k = 0; k <= m; k++) { sp(mix(s[0], s[2], k / m), mix(s[1], s[3], k / m)); if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } }
      strokeC(LW.hair * 1.15, G1, 0.95);
      // curled free end shading + edge
      bp(); for (j = 0; j <= 6; j++) { u = 0.94 + j * 0.0001; sp(0.1 + j * 0.13, 1.0); if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } strokeC(LW.hair, G2, 0.0);
      // soft pale fold line near the roll
      bp(); sp(0.0, 0.14); ctx.moveTo(X, Y); sp(1.0, 0.14); ctx.lineTo(X, Y); strokeC(LW.hair, G3, 0.9);
    }
    if (tongueFirst) drawTongue();
    // cylinder body
    endPt(xa, t1); var a1x = X, a1y = Y; endPt(xb, t1); var b1x = X, b1y = Y; endPt(xb, t2); var b2x = X, b2y = Y; endPt(xa, t2); var a2x = X, a2y = Y;
    bp(); ctx.moveTo(a1x, a1y); ctx.lineTo(b1x, b1y); ctx.lineTo(b2x, b2y); ctx.lineTo(a2x, a2y); ctx.closePath(); fillC(PAPER);
    // shading strokes along the shaded side
    bp(); var ns = 16;
    for (i = 1; i < ns; i++) {
      var th = t1 + (i / ns) * PI, lum = lumOf(0, cos(th), sin(th));
      if (lum < 0.45) { var len = 0.95 - 0.5 * (0.45 - lum); endPt(xf, th); var sx0 = X, sy0 = Y; endPt(mix(xf, xn, len), th); ctx.moveTo(sx0, sy0); ctx.lineTo(X, Y); }
    }
    strokeC(LW.hair, G2, 0.95);
    // paper-layer rings near the near end + rubber band
    bp(); for (k = 1; k <= 2; k++) { arc3(xn + (xf - xn) * 0.022 * k, 0, 0, 0, R, 0, 0, 0, R, t1, t2, true); } strokeC(LW.hair, G2, 0.9);
    bp(); arc3(mix(xa, xb, 0.34), 0, 0, 0, R * 1.005, 0, 0, 0, R * 1.005, t1, t2, true); strokeC(LW.mid * 1.15, G1, 0.9);
    bp(); arc3(mix(xa, xb, 0.37), 0, 0, 0, R * 1.005, 0, 0, 0, R * 1.005, t1, t2, true); strokeC(LW.thin, G1, 0.8);
    // outline: silhouette lines + far-end front arc
    bp(); ctx.moveTo(a1x, a1y); ctx.lineTo(b1x, b1y); ctx.moveTo(a2x, a2y); ctx.lineTo(b2x, b2y); arc3(xf, 0, 0, 0, R, 0, 0, 0, R, t1, t2, true); strokeC(LW.mid, INK);
    // near end cap: disc, spiral of paper layers, cardboard core
    bp(); arc3(xn, 0, 0, 0, R, 0, 0, 0, R, 0, TAU, true); fillC(PAPER); strokeC(LW.mid, INK);
    var sg = nearRight ? 1 : -1;
    bp(); var spiral = []; for (i = 0; i <= 72; i++) { var th2 = i / 72 * TAU * 2.6, r2 = R * (0.3 + 0.7 * (i / 72)); spiral.push(xn, r2 * cos(th2) * 0.97, r2 * sin(th2) * 0.97); }
    smooth3(spiral); strokeC(LW.hair * 1.1, G1, 0.9);
    bp(); arc3(xn + sg * 0.012, 0, 0, 0, R * 0.26, 0, 0, 0, R * 0.26, 0, TAU, true); fillC(G3); strokeC(LW.thin, INK);
    bp(); arc3(xn + sg * 0.016, 0, 0, 0, R * 0.14, 0, 0, 0, R * 0.14, 0, TAU, true); fillC(INK);
    if (!tongueFirst) drawTongue();
    end();
  }
  reg('tracingRoll', { draw: drawRoll, box: [0.95, 0.49], tags: ['design', 'paper', 'sketch', 'roll'] });

  /* ================================================================== extras ================================================================== */

  /* ---- northArrow: drafting north arrow (variant: compass rose) */
  function drawNorthArrow(c, p) {
    begin(c, p, { base: [-0.28, 0.2, 0.0], soft: 1.15, minN: 0.6, persp: 5 });
    var v = ((p.seed | 0) % 2 + 2) % 2, cy = 0.1, R = 0.37, k, a;
    bp(); circ(0, cy, R, 0); fillC(PAPER); strokeC(LW.mid, INK);
    bp(); circ(0, cy, R * 0.84, 0); strokeC(LW.hair * 1.1, G2);
    bp(); for (k = 0; k < 4; k++) { a = k * PI / 2; seg(cos(a) * R * 0.84, cy + sin(a) * R * 0.84, cos(a) * R, cy + sin(a) * R, 0); } strokeC(LW.thin, INK);
    if (v === 0) {
      var tip = [0, cy - R * 0.76], notch = [0, cy + R * 0.3], lb = [-R * 0.27, cy + R * 0.58], rb = [R * 0.27, cy + R * 0.58];
      bp(); pl2([tip[0], tip[1], notch[0], notch[1], lb[0], lb[1]], 0, true); fillC(INK);
      bp(); pl2([tip[0], tip[1], rb[0], rb[1], notch[0], notch[1]], 0, true); fillC(PAPER); strokeC(LW.thin * 1.1, INK);
      bp(); seg(0, cy - R * 0.76, 0, cy + R * 0.3, 0); strokeC(LW.thin * 0.8, INK);
    } else { // eight-point compass rose
      var blk = [], wht = [], out = [];
      for (k = 0; k < 8; k++) {
        a = -PI / 2 + k * PI / 4; var L = (k % 2 === 0) ? R * 0.8 : R * 0.5, bw = (k % 2 === 0) ? 0.2 : 0.14;
        var tx = cos(a) * L, ty = cy + sin(a) * L, b1x = cos(a - 0.5) * R * bw * 1.6, b1y = cy + sin(a - 0.5) * R * bw * 1.6, b2x = cos(a + 0.5) * R * bw * 1.6, b2y = cy + sin(a + 0.5) * R * bw * 1.6;
        blk.push(0, cy, tx, ty, b1x, b1y); wht.push(0, cy, b2x, b2y, tx, ty); out.push(0, cy, b1x, b1y, tx, ty, b2x, b2y);
      }
      bp(); for (k = 0; k < 8; k++) pl2(blk.slice(k * 6, k * 6 + 6), 0, true); fillC(INK);
      bp(); for (k = 0; k < 8; k++) pl2(wht.slice(k * 6, k * 6 + 6), 0, true); fillC(PAPER);
      bp(); for (k = 0; k < 8; k++) pl2(out.slice(k * 8, k * 8 + 8), 0, true); strokeC(LW.thin * 0.9, INK);
    }
    tinyN(0, -0.435, 0.04);
    end();
  }
  reg('northArrow', { draw: drawNorthArrow, box: [0.73, 0.92], tags: ['design', 'symbol', 'architecture'] });
  reg('compassRose', { draw: function (c, p) { var q = {}, k; for (k in p) q[k] = p[k]; q.seed = 1; drawNorthArrow(c, q); }, box: [0.73, 0.92], tags: ['design', 'symbol', 'architecture', 'compass'] });

  /* ---- treePlan: tree symbol as drawn in site plans */
  function drawTreePlan(c, p) {
    begin(c, p, { base: [-0.38, 0.12, 0.0], soft: 1.15, minN: 0.5, persp: 5 });
    var seed = (p.seed | 0) + 3, crownP = crownPts(0, 0, 0.46, 9, seed), sh = [], i;
    for (i = 0; i < crownP.length; i += 2) sh.push(crownP[i] + 0.09, crownP[i + 1] + 0.07);
    bp(); pl2(sh, -0.02, true); fillC(G4, 0.9);
    bp(); pl2(crownP, 0, true); fillC(PAPER); strokeC(LW.mid, INK);
    bp(); // leaf clusters + branches
    circ(-0.16, -0.12, 0.18, 0, 3.5, 5.9, true); circ(0.18, -0.06, 0.17, 0, 4.6, 7.2, true); circ(-0.05, 0.18, 0.18, 0, 0.5, 3.0, true); circ(0.2, 0.2, 0.11, 0, 1.0, 3.6, true); circ(-0.27, 0.14, 0.09, 0, 5.0, 8.0, true);
    strokeC(LW.thin * 0.9, G1);
    bp(); var br = [[0, 0, -0.3, -0.22], [0, 0, 0.28, -0.2], [0, 0, 0.05, 0.3], [0, 0, -0.27, 0.16], [0, 0, 0.3, 0.12]];
    for (i = 0; i < br.length; i++) seg(br[i][0], br[i][1], br[i][2], br[i][3], 0.003);
    strokeC(LW.hair, G2, 0.9);
    dot3(0, 0, 0.004, 0.032, INK);
    end();
  }
  reg('treePlan', { draw: drawTreePlan, box: [0.99, 0.84], tags: ['design', 'symbol', 'architecture', 'landscape'] });

  /* ---- humanScale: scale figures with a height dimension */
  function drawHumanScale(c, p) {
    begin(c, p, { base: [-0.18, 0.28, 0.0], soft: 1.15, minN: 0.55, persp: 5 });
    bp(); ell(0.03, 0.5, 0.34, 0.035, 0, 0); fillC(G4);
    bp(); seg(-0.34, 0.5, 0.4, 0.5, 0); strokeC(LW.hair * 1.1, G2);
    person(-0.07, 0.5, 1.0, INK, 0.002);
    person(0.2, 0.5, 0.6, INK, 0.002);
    bp(); seg(-0.31, -0.5, -0.31, 0.5, 0); seg(-0.34, -0.5 + 0.03, -0.28, -0.5 - 0.03, 0); seg(-0.34, 0.5 + 0.03, -0.28, 0.5 - 0.03, 0); seg(-0.28, -0.5, -0.2, -0.5, 0); strokeC(LW.hair * 1.2, INK);
    bp(); seg(-0.39, -0.12, -0.39, 0.08, 0); strokeC(LW.thin * 1.3, G2);
    end();
  }
  reg('humanScale', { draw: drawHumanScale, box: [0.73, 1.06], tags: ['design', 'symbol', 'architecture', 'scale'] });

  /* ---- sectionCut: section line symbol (dash-dot line, heavy ends, view arrows, grid bubbles) */
  function drawSectionCut(c, p) {
    begin(c, p, { base: [-0.3, 0.15, -0.08], soft: 1.15, minN: 0.55, persp: 5, scale: 0.92 });
    var s, x;
    bp(); ctx.setLineDash([16 * K, 6 * K, 3 * K, 6 * K]); seg(-0.5, 0, 0.5, 0, 0); strokeC(LW.thin * 1.1, G1); nodash();
    for (s = -1; s <= 1; s += 2) {
      x = s * 0.5;
      bp(); rectPath(x - 0.012, -0.1, x + 0.012, 0.1, 0); fillC(INK);
      bp(); pl2([x - 0.05, 0.1, x + 0.05, 0.1, x, 0.19], 0, true); fillC(INK);
      bp(); circ(x, -0.19, 0.065, 0); fillC(PAPER); strokeC(LW.thin * 1.1, INK);
      tinyA(x, -0.19, 0.022);
    }
    end();
  }
  reg('sectionCut', { draw: drawSectionCut, box: [1.04, 0.46], tags: ['design', 'symbol', 'architecture', 'section'] });

  /* ---- staircase: stepped stair-flight study (massing style) */
  function drawStairs(c, p) {
    begin(c, p, { base: [-0.52, 0.62, 0.0], persp: 9 });
    var n = 8, run = 0.1, rise = 0.065, i, l = [];
    for (i = 0; i < n; i++) l.push(mkBox(0, -0.28, -0.4 + run * (i + 0.5), 0.36, rise * (i + 1), run, 0));
    l.push(mkBox(0, -0.28 + rise * n, -0.4 + run * n + 0.1, 0.36, 0.022, 0.2, 0, 'slab'));
    drawBoxes(l);
    end();
  }
  reg('staircase', { draw: drawStairs, box: [0.97, 0.52], tags: ['design', 'architecture', 'model', 'stairs'] });

  /* ---- siteModel: contour-layer site model (stacked laser-cut layers + a tiny black building) */
  function siteLayers(seed) {
    return cached('site' + seed, function () {
      var R = U.rng(seed * 17 + 11), layers = [], k, i, a1 = R.range(0, TAU), a2 = R.range(0, TAU), a3 = R.range(0, TAU);
      for (k = 0; k < 6; k++) {
        var base = 0.44 * Math.pow(0.8, k), pts = [], cx = 0.035 * k * cos(a1), cz = 0.03 * k * sin(a1);
        for (i = 0; i < 32; i++) { var th = i / 32 * TAU; var r = base * (1 + 0.15 * sin(2 * th + a1 + k * 0.4) + 0.09 * sin(3 * th + a2) + 0.05 * sin(5 * th + a3 + k)); pts.push(cx + r * cos(th) * 1.15, cz + r * sin(th)); }
        layers.push(pts);
      }
      return layers;
    });
  }
  function drawSiteModel(c, p) {
    begin(c, p, { base: [-0.55, 0.6, 0.0], persp: 8, scale: 0.85 });
    var layers = siteLayers(p.seed | 0), th = 0.034, y0 = -0.2, k, i, n = 32, plate = mkBox(0, y0 - 0.04, 0, 1.0, 0.04, 0.78, 0, 'plate');
    massBox(plate);
    var topVis = -M[7] > 0, order = [];
    for (k = 0; k < layers.length; k++) order.push(k);
    if (!topVis) order.reverse();
    for (var oi = 0; oi < order.length; oi++) {
      k = order[oi];
      var pts = layers[k], yt = -(y0 + (k + 1) * th), yb = -(y0 + k * th), T = [], B = [], vis = [], lum = [];
      for (i = 0; i < n; i++) { P(pts[2 * i], yt, pts[2 * i + 1]); T.push(X, Y); P(pts[2 * i], yb, pts[2 * i + 1]); B.push(X, Y); }
      for (i = 0; i < n; i++) { // outward normal of edge i -> i+1 (polygon runs with increasing angle, z axis is "down" in angle space)
        var j = (i + 1) % n, ex = pts[2 * j] - pts[2 * i], ez = pts[2 * j + 1] - pts[2 * i + 1], nl = sqrt(ex * ex + ez * ez) || 1, nx = ez / nl, nz = -ex / nl;
        vis.push(M[6] * nx + M[8] * nz > 0); lum.push(lumOf(nx, 0, nz));
      }
      // side walls: lit / shaded
      bp(); for (i = 0; i < n; i++) if (vis[i] && lum[i] >= 0.25) { j = (i + 1) % n; ctx.moveTo(T[2 * i], T[2 * i + 1]); ctx.lineTo(T[2 * j], T[2 * j + 1]); ctx.lineTo(B[2 * j], B[2 * j + 1]); ctx.lineTo(B[2 * i], B[2 * i + 1]); ctx.closePath(); }
      fillC(PAPER);
      bp(); for (i = 0; i < n; i++) if (vis[i] && lum[i] < 0.25) { j = (i + 1) % n; ctx.moveTo(T[2 * i], T[2 * i + 1]); ctx.lineTo(T[2 * j], T[2 * j + 1]); ctx.lineTo(B[2 * j], B[2 * j + 1]); ctx.lineTo(B[2 * i], B[2 * i + 1]); ctx.closePath(); }
      fillC(G4);
      bp(); // bottom edge of visible walls + silhouette verticals
      for (i = 0; i < n; i++) {
        j = (i + 1) % n; var pv = (i + n - 1) % n;
        if (vis[i]) { ctx.moveTo(B[2 * i], B[2 * i + 1]); ctx.lineTo(B[2 * j], B[2 * j + 1]); }
        if (vis[i] !== vis[pv]) { ctx.moveTo(T[2 * i], T[2 * i + 1]); ctx.lineTo(B[2 * i], B[2 * i + 1]); }
      }
      strokeC(LW.thin, INK);
      bp(); for (i = 0; i < n; i++) { if (i === 0) ctx.moveTo(T[0], T[1]); else ctx.lineTo(T[2 * i], T[2 * i + 1]); } ctx.closePath();
      if (topVis) { fillC(PAPER); } strokeC(LW.thin * 1.1, INK);
    }
    // the little black building on the summit
    var top = layers[5], sx = 0, sz = 0; for (i = 0; i < top.length; i += 2) { sx += top[i]; sz += top[i + 1]; } sx /= n; sz /= n;
    massBox(mkBox(sx, y0 + 6 * th, sz, 0.1, 0.07, 0.07, 0.4, 'black'));
    end();
  }
  reg('siteModel', { draw: drawSiteModel, box: [1.02, 0.46], tags: ['design', 'architecture', 'model', 'site', 'topography'] });

  /* ---- modelKnife: hobby / scalpel knife */
  function drawKnife(c, p) {
    begin(c, p, { base: [0.15, -0.15, -0.5], soft: 1.15, minN: 0.55, persp: 5, scale: 1.12 });
    var i, z = 0;
    // blade
    bp(); pl2([0.1, -0.032, 0.4, -0.032, 0.5, 0.034, 0.1, 0.034], 0, true); fillC(PAPER); strokeC(LW.mid * 0.9, INK);
    bp(); seg(0.21, -0.032, 0.23, 0.034, 0); seg(0.31, -0.032, 0.33, 0.034, 0); strokeC(LW.hair * 1.1, G1);
    bp(); seg(0.12, 0.012, 0.44, 0.012, 0); strokeC(LW.hair, G3);
    // collar
    bp(); rectPath(0.05, -0.046, 0.1, 0.046, 0); fillC(G3); strokeC(LW.thin, INK);
    // handle (solid black accent) with rounded butt
    bp(); mv(-0.46, -0.04, 0); ln(0.05, -0.036, 0); ln(0.05, 0.036, 0); ln(-0.46, 0.04, 0); P(-0.5, 0.0, 0); var qx = X, qy = Y; P(-0.46, -0.04, 0); ctx.quadraticCurveTo(qx, qy, X, Y);
    fillC(INK);
    bp(); for (i = 0; i < 14; i++) { var gx = -0.4 + i * 0.026; seg(gx, -0.028, gx, 0.028, 0); } strokeC(LW.hair, G1, 0.9);
    // slide button
    bp(); rectPath(-0.2, -0.056, -0.1, -0.036, 0); fillC(PAPER); strokeC(LW.thin, INK);
    bp(); seg(-0.18, -0.046, -0.12, -0.046, 0); strokeC(LW.hair, G2);
    end();
  }
  reg('modelKnife', { draw: drawKnife, box: [0.97, 0.53], tags: ['design', 'tool', 'model-making'] });

  /* ---- compassTool: drafting compass with a drawn arc */
  function drawCompass(c, p) {
    begin(c, p, { base: [-0.15, 0.12, 0.0], soft: 1.15, minN: 0.6, persp: 5 });
    var hx = 0, hy = -0.4, nx0 = -0.17, nx1 = 0.2, ty = 0.46, i, t;
    function leg(x1, y1, kx, ky) { // two segments with a knee
      var o = [], u2;
      for (i = 0; i <= 18; i++) { t = i / 18; if (t < 0.5) { u2 = t * 2; o.push(hx + (kx - hx) * u2, hy + (ky - hy) * u2); } else { u2 = (t - 0.5) * 2; o.push(kx + (x1 - kx) * u2, ky + (y1 - ky) * u2); } }
      return o;
    }
    // drawn arc on the paper (behind the legs)
    bp(); arc3(nx0, ty, 0, nx1 - nx0, 0, 0, 0, nx1 - nx0, 0, -1.15, 0.02, true); strokeC(LW.thin * 1.1, G1);
    bp(); dash(3, 5); arc3(nx0, ty, 0, nx1 - nx0, 0, 0, 0, nx1 - nx0, 0, -1.9, -1.15, true); strokeC(LW.hair, G3); nodash();
    // needle leg (left) and pencil leg (right)
    ribbon2(leg(nx0 + 0.012, ty - 0.08, -0.115, 0.03), 0, function (u) { return (0.026 - 0.012 * u) * SC / K; }, INK);
    bp(); seg(nx0 + 0.012, ty - 0.08, nx0, ty, 0); strokeC(LW.thin * 0.9, INK);
    ribbon2(leg(nx1 - 0.012, ty - 0.08, 0.13, 0.03), 0, function (u) { return (0.026 - 0.012 * u) * SC / K; }, INK);
    bp(); pl2([nx1 - 0.024, ty - 0.1, nx1 + 0.002, ty - 0.1, nx1, ty], 0, true); fillC(INK); // pencil lead holder / graphite point
    bp(); pl2([nx1 - 0.0, ty - 0.03, nx1 + 0.006, ty - 0.03, nx1 + 0.001, ty + 0.002], 0.002, true); fillC(PAPER);
    // hinge + knob
    bp(); seg(hx, hy - 0.02, hx, hy - 0.075, 0); strokeC(LW.mid * 1.2, INK);
    dot3(hx, hy - 0.085, 0.002, 0.028, INK);
    bp(); circ(hx, hy, 0.034, 0.003); fillC(PAPER); strokeC(LW.mid, INK);
    dot3(hx, hy, 0.004, 0.009, INK);
    end();
  }
  reg('compassTool', { draw: drawCompass, box: [0.48, 0.97], tags: ['design', 'tool', 'drafting'] });

  /*__NEXT__*/

  // rest-pose centring (units of p.s) measured with the demo's auditJSON(): puts the visual centre of each prop on the origin
  (function () {
    var c = {
      cubeLine: [-0.011, 0.009], tennisRacket: [0.0, -0.002], gridPlane: [-0.035, -0.034], scribble: [-0.005, -0.060], shapeTri: [0.101, 0.011],
      shapeChevron: [0.051, 0.167], shapeDiamond: [0.032, 0.014], dotCluster: [0.010, -0.014], sketchPlan: [0.005, 0.002], sketchPersp: [-0.007, 0.001],
      sketchSection: [0.001, 0.017], iterations: [-0.013, -0.029], processDiagram: [-0.024, 0.002], massingA: [0.074, -0.069], massingB: [0.068, -0.040],
      massingC: [0.060, -0.114], tracingRoll: [0.071, -0.037], northArrow: [0.008, 0.011], compassRose: [0.008, 0.011], treePlan: [-0.036, -0.011], humanScale: [0.020, 0.009],
      sectionCut: [0.014, 0.028], staircase: [-0.068, -0.197], siteModel: [0.054, -0.148], modelKnife: [-0.025, -0.017], compassTool: [0.048, 0.031]
    };
    for (var k in c) CENTER[k] = c[k];
  })();

  /** bounding box (world units, relative to the prop origin) of a prop for the given params, measured by replaying its draw on a recording context.
      Use it when the static def.box is not accurate enough (e.g. at a strong tumble). */
  function bounds(name, p) {
    var d = GA.props.list[name]; if (!d) return null;
    var r = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, globalAlpha: 1 };
    function pt(x, y) { if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y; }
    r.moveTo = pt; r.lineTo = pt;
    r.quadraticCurveTo = function (a, b, x, y) { pt(x, y); };
    r.bezierCurveTo = function (a, b, c, e, x, y) { pt(x, y); };
    r.arc = function (x, y, rad) { pt(x - rad, y - rad); pt(x + rad, y + rad); };
    ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke', 'clip', 'setLineDash'].forEach(function (n) { r[n] = function () {}; });
    d.draw(r, p);
    return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 };
  }

  GA.propsB = { names: NAMES, center: CENTER, bounds: bounds, kit: { P: P, begin: begin, end: end, M: M, mkBox: mkBox, drawBoxes: drawBoxes } };
})();


/* ===== props_d.js ===== */
/* props_d.js -- ABSTRACT hero "design thinking" props (set D).  Classic script; needs util.js + style.js (GA.util, GA.style, GA.props).
   No plans, sections, elevations, windows, doors, stairs, furniture, trees, people, labels: the thinking of a designer expressed as pure geometry
   (line, plane, volume, light, rhythm, void, threshold), drawn like a Sol LeWitt / Albers / Bauhaus line study: thin ink lines, a few solid-black accents,
   pale grey tones, plenty of air.
   Registered with GA.props.register(name, {draw, box, tags:['design','abstract',..], hero:true, period}).
   draw(ctx, p) paints at the ctx origin in WORLD units (sizes are multiples of p.s):  p = { s, t, seed, rot:[rx,ry,rz], alpha, lw }
   p.alpha multiplies the context's current globalAlpha; p.lw multiplies every line weight.  Drawn BIG (p.s ~ 250-330, still reads at ~160) and
   ANIMATED by p.t (seconds, any real value): every animation is time-periodic (6-9 s) with a smooth wrap (value at t and t + period is identical).

   Registered (period):
     formIterations  one closed form (circle / rounded triangle / lens / squircle / blob) that keeps morphing; onion-skin ghosts of the earlier
                     iterations drift away, a row of 5 dots lights up per iteration                                                           9 s
     foldedPlanes    five thin planes hinged in a chain fold and unfold in 3D (accordion, curl, zig-zag), hatch shading, dotted footprint       9 s
     volumeShift     3-6 plain cuboids (solid black / outlined / pale grey) slide, stack and extrude between 4 arrangements, dotted ghost       8 s
     wireVolume      wireframe polyhedron (cube > prism > octahedron > antiprism > cube) morphing while it turns, hidden edges dashed            8 s
     arcVault        families of concentric arcs and sweeping ribs draw on into a dome / ogive / catenary vault and relax                        9 s
     dotSurface      a regular grid of dots lifted by a travelling wave into an undulating surface, pale grid beneath                            8 s
     gridFold        pale perspective grid sheet that bends, creases and twists; one bold line across it, a black dot travelling along it       9 s
     nestedFrames    nested rounded frames receding to a vanishing point (threshold sequence), a pale hatched light wedge slides through         8 s
     helixLines      three long strands of varying weight twisting around an axis, tiny ticks, pale ribbon                                      8 s
     sliceCut        a cube cut by a sliding, tilting translucent plane; bold section outline; the removed part is a dotted ghost                8 s
     lightWedge      a plain slab, dashed rays from a small sun that travels along a dotted arc, a hatched shadow band that sweeps               8 s
     layeredTrace    tracing-paper sheets with loose gestural strokes that draw on one sheet after another                                      9 s
     apertureLight   a solid black plane with circle / slit / square apertures and pale beams, dotted rays, shifting light                       8 s
     rhythmBars      a field of thin bars / strips that re-tune between four rhythms (even, accelerating, grouped, diagonal)                      8 s
     spiralOrbit     a spiral that draws itself towards a solid black form at its centre, nodes, flowing dots                                   9 s
     kitOfParts      cube, wedge, cylinder, arch segment and plate explode and re-assemble in a rhythm, one part solid black                    8 s
   All 3D things are real projections (Euler convention of GA.util.rot3 + weak perspective): p.rot tumbles them; flat sheets carry a mild rest pose and
   a soft-limited tumble so they never collapse.  Opaque fills read GA.style.PAPER (and every colour) at DRAW time.  Geometry is cached per seed.
   Smooth curves everywhere: every curve is a cubic Bezier (Catmull-Rom through projected samples, true arcs for rounded rectangles), ribbons are variable-width brush strokes; motion uses
   spring-like easing (soft start, ~3 % overshoot, long settle) and smooth periodic functions only.  Declared boxes = union of all frames; GA.propsD.center holds the centring offsets.
   Round-4 additions (how she iterates until it is solved, and how she thinks in space): iterationChain, revisedCurve, tryAgainFold, solvedMark | rotatingVolume, stackShift, depthLayers, scaleSteps.
   Round-5 additions (a mind that is visual, chaotic and busy all the time): abstract fireworks fwPeony, fwWillow, fwRing, fwSpiral, fwCrackle, fwChrysanthemum, fwSparkle (flat; a new pattern every cycle),
   idea bulbs bulbClassic, bulbSpiral, bulbSwitch, bulbCluster (30-60 units) and small mind fragments stringModel, foldStrip, maquetteCluster, slabRhythm, doodleLoop, solveSquiggle, dotWarp, dotPinch,
   bendLattice, curvedWall, sheetStack, tetraWire, rollingSphere, breathingArcs, dotCompass, shadowSweep, mobileBalance.  Below s = 200 the line weight is boosted (K) and dots keep a minimum radius (DM).
   Pieces that only work large (use at s >= 300): nestedFrames, depthLayers, iterationChain, revisedCurve, apertureLight, dotSurface.
   Exports: GA.propsD = { names, period, center, bounds(name, p), kit } */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util, ST = GA.style;
  var LW = { hair: 1.5, thin: 2.4, mid: 3.7, bold: 5.6, heavy: 9 };   // hero line weights (world units): the hero outlines must hold their own against the 2-3 px swirl arms
  var INK, INK2, G1, G2, G3, G4, PAPER, INKT, INKS, PAL_B = [], PAL_P = [];   // theme colours, refreshed at the start of every draw (sync)
  var TAU = Math.PI * 2, PI = Math.PI;
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, atan2 = Math.atan2, min = Math.min, max = Math.max, floor = Math.floor, pow = Math.pow, tanh = Math.tanh;
  var NAMES = [], PERIOD = {}, EMPTY = [];
  var CENTER = {/*CENTER-BEGIN*/ formIterations: [0.013, -0.032], foldedPlanes: [0.03, -0.019], volumeShift: [0.01, 0], wireVolume: [0, -0.128], arcVault: [0.004, 0.05], dotSurface: [-0.016, -0.156], nestedFrames: [0.007, -0.05], sliceCut: [0.02, 0.004], layeredTrace: [-0.01, -0.007], apertureLight: [0.008, -0.012], spiralOrbit: [0.017, -0.017], kitOfParts: [0.049, -0.055], onionContours: [0.004, 0.001], offsetDiscs: [0, 0.017], voidRing: [0.017, 0.013], dotDisc: [0, -0.026], interlockArcs: [0, 0.007], suspendedPlane: [-0.008, -0.006], iterationChain: [-0.001, 0.012], revisedCurve: [0.001, -0.005], tryAgainFold: [0, 0.006], solvedMark: [0.019, 0.01], rotatingVolume: [0, -0.007], stackShift: [-0.026, -0.093], depthLayers: [0, -0.027], scaleSteps: [-0.231, -0.23], fwPeony: [0.044, -0.028], fwWillow: [0.008, -0.334], fwRing: [0.002, 0.014], fwSpiral: [0.076, -0.02], fwCrackle: [-0.012, -0.094], fwChrysanthemum: [-0.002, -0.038], fwSparkle: [-0.066, 0.194], bulbClassic: [0, 0], bulbSpiral: [0, 0], bulbSwitch: [0, 0], bulbCluster: [0, 0], stringModel: [0, 0.086], foldStrip: [0.015, -0.048], maquetteCluster: [0.002, -0.126], slabRhythm: [0.011, -0.097], doodleLoop: [0.002, -0.009], solveSquiggle: [-0.01, -0.037], dotWarp: [0.002, 0.009], dotPinch: [0.001, 0], bendLattice: [0.007, -0.079], curvedWall: [-0.132, -0.125], sheetStack: [0.031, -0.022], tetraWire: [0, -0.085], rollingSphere: [0, -0.233], breathingArcs: [-0.124, 0.095], dotCompass: [-0.006, 0.045], shadowSweep: [-0.007, -0.179], mobileBalance: [-0.104, 0.109] /*CENTER-END*/};            // per-prop centring offsets (units of s) so that the union of all frames is centred on the origin (filled from the bounds audit)
  var CEN = [0, 0];
  var lastInk = '', lastPaper = '';

  function sync() {
    INK = ST.INK; INK2 = ST.INK2; G1 = ST.GRAY1; G2 = ST.GRAY2; G3 = ST.GRAY3; G4 = ST.GRAY4; PAPER = ST.PAPER;
    if (INK !== lastInk || PAPER !== lastPaper) {   // lifted blacks for the faces of solid-black volumes
      lastInk = INK; lastPaper = PAPER;
      INKT = ST.mix ? ST.mix(ST.inkRGB, ST.paperRGB, 0.2) : INK2; INKS = ST.mix ? ST.mix(ST.inkRGB, ST.paperRGB, 0.07) : INK;
      for (var i = 0; i < 16; i++) {   // 16-step shading ramps: black volumes (INK .. lifted ink) and pale volumes (grey .. paper)
        PAL_B[i] = ST.mix ? ST.mix(ST.inkRGB, ST.paperRGB, 0.1 * i / 15) : INK;
        PAL_P[i] = ST.mix ? ST.mix(ST.inkRGB, ST.paperRGB, 0.945 + 0.055 * i / 15) : G4;
      }
    }
  }

  /* ------------------------------------------------------------------ render state */
  var DM = 1;   // dot-radius multiplier for small sizes (dots keep a visible minimum radius)
  var ctx = null, SC = 100, NOM = 100, K = 1, PERSP = 4.5, A0 = 1, CA = 1, T = 0, OFX = 0, OFY = 0;
  var M = [1, 0, 0, 0, 1, 0, 0, 0, 1], MR = [1, 0, 0, 0, 1, 0, 0, 0, 1], MB = [1, 0, 0, 0, 1, 0, 0, 0, 1], MA = [1, 0, 0, 0, 1, 0, 0, 0, 1], MC = [1, 0, 0, 0, 1, 0, 0, 0, 1], MD = [1, 0, 0, 0, 1, 0, 0, 0, 1], MT = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  var RX = 0, RY = 0, RZ = 0, X = 0, Y = 0, Z = 0, F = 1;   // last rotated point (view space) and last projected point (world units, depth, persp factor)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function frac(x) { return x - floor(x); }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function eio(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2; }
  function eout(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - (1 - x) * (1 - x) * (1 - x); }
  /** spring-like ease: soft start, a gentle ~3 % overshoot, then a long settle (zero velocity at both ends) */
  function spr(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; var b = sin(PI * pow(x, 1.35)); return x * x * x * (x * (x * 6 - 15) + 10) + 0.16 * b * b; }
  function ein(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * x; }
  function hash(n, s) { var h = (n * 374761393 + (s | 0) * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  /** sin(PI x) ^ e with a guard against tiny negative values from rounding (x a hair above 1) */
  function spw(x, e) { var v = sin(PI * x); return v > 0 ? pow(v, e) : 0; }
  function lerpAng(a, b, t) { var d = ((b - a + PI) % TAU + TAU) % TAU - PI; return a + d * t; }

  function eul(rx, ry, rz, o) {
    var cx = cos(rx), sx = sin(rx), cy = cos(ry), sy = sin(ry), cz = cos(rz), sz = sin(rz);
    var a0 = cy, a1 = sy * sx, a2 = sy * cx, b1 = cx, b2 = -sx, c0 = -sy, c1 = cy * sx, c2 = cy * cx;
    o[0] = cz * a0; o[1] = cz * a1 - sz * b1; o[2] = cz * a2 - sz * b2;
    o[3] = sz * a0; o[4] = sz * a1 + cz * b1; o[5] = sz * a2 + cz * b2;
    o[6] = c0; o[7] = c1; o[8] = c2;
  }
  function rotMat(ax, a, o) {
    var c = cos(a), s = sin(a);
    if (ax === 0) { o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = c; o[5] = -s; o[6] = 0; o[7] = s; o[8] = c; }
    else if (ax === 1) { o[0] = c; o[1] = 0; o[2] = s; o[3] = 0; o[4] = 1; o[5] = 0; o[6] = -s; o[7] = 0; o[8] = c; }
    else { o[0] = c; o[1] = -s; o[2] = 0; o[3] = s; o[4] = c; o[5] = 0; o[6] = 0; o[7] = 0; o[8] = 1; }
  }
  function mul(a, b, o) {
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) MT[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    for (var i = 0; i < 9; i++) o[i] = MT[i];
  }
  function buildM(rx, ry, rz) { eul(rx, ry, rz, MR); mul(MR, MB, M); }
  /** attitude = Rz(roll) Rx(tilt) Ry(spin) (spin about the object's own vertical axis, then the camera tilt), then the caller's tumble p.rot (soft-limited) */
  function setMatrix(rot, o) {
    var rx = (rot && rot[0]) || 0, ry = (rot && rot[1]) || 0, rz = (rot && rot[2]) || 0, soft = o.soft;
    if (soft) { rx = soft * tanh(rx / soft); ry = soft * tanh(ry / soft); }
    rotMat(1, o.spin || 0, MA); rotMat(0, o.tilt || 0, MC); mul(MC, MA, MD); rotMat(2, o.roll || 0, MA); mul(MA, MD, MB);
    buildM(rx, ry, rz);
    if (o.minN && M[8] < o.minN) {
      var lo = 0, hi = 1, k, it;
      for (it = 0; it < 8; it++) { k = (lo + hi) / 2; buildM(rx * k, ry * k, rz); if (M[8] >= o.minN) lo = k; else hi = k; }
      buildM(rx * lo, ry * lo, rz);
    }
  }
  /** local (x, y, z) (units of p.s, y DOWN, z toward the viewer) -> view-space R* (rotated, units of s) and screen X, Y (world units), Z depth, F perspective factor */
  function R(x, y, z) { RX = M[0] * x + M[1] * y + M[2] * z; RY = M[3] * x + M[4] * y + M[5] * z; RZ = M[6] * x + M[7] * y + M[8] * z; }
  function Pj() { var f = PERSP ? PERSP / (PERSP - (RZ < PERSP * 0.7 ? RZ : PERSP * 0.7)) : 1; F = f; X = RX * f * SC + OFX; Y = RY * f * SC + OFY; Z = RZ; }
  function P(x, y, z) { R(x, y, z); Pj(); }
  /** begin a prop. o: { tilt, spin, roll (attitude, rad), soft, minN, persp, scale, off:[x,y] (units of s) } */
  function begin(c, p, o) {
    o = o || {}; sync();
    ctx = c; ctx.save();
    A0 = (p.alpha === undefined ? 1 : p.alpha) * (c.globalAlpha === undefined ? 1 : c.globalAlpha);
    CA = 1; ctx.globalAlpha = A0;
    NOM = p.s || 100; SC = NOM * (o.scale || 1);
    K = (p.lw === undefined ? 1 : p.lw) * clamp(0.86 + 0.14 * (SC / 300), 0.92, 1.1);
    K *= 1 + 0.32 * clamp((200 - SC) / 150, 0, 1);      // thicker minimum line weight at small scale
    DM = clamp(3.2 / (0.0165 * SC), 1, 1.8); // pure function of the size (the old self-referential form made dot sizes depend on the previously drawn piece = flicker between atlas refreshes)
    PERSP = o.persp === undefined ? 4.5 : o.persp;
    OFX = (o.off ? o.off[0] : 0) * NOM + CEN[0] * NOM; OFY = (o.off ? o.off[1] : 0) * NOM + CEN[1] * NOM;
    T = +p.t || 0;
    setMatrix(p.rot, o);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(EMPTY);
  }
  function end() { ctx.setLineDash(EMPTY); ctx.restore(); }

  /* ------------------------------------------------------------------ painting helpers */
  function bp() { ctx.beginPath(); }
  function strokeC(w, col, a) { ctx.globalAlpha = A0 * CA * (a === undefined ? 1 : a); ctx.lineWidth = w * K; ctx.strokeStyle = col; ctx.stroke(); }
  function fillC(col, a) { ctx.globalAlpha = A0 * CA * (a === undefined ? 1 : a); ctx.fillStyle = col; ctx.fill(); }
  function fillPaper(a) { fillC(PAPER, a); }
  function dash(a, b) { ctx.setLineDash([a * K, b * K]); }
  function dots(gap) { ctx.setLineDash([0.001, gap * K]); }     // round-capped zero-length dashes = dotted line
  function nodash() { ctx.setLineDash(EMPTY); }
  function mv(x, y, z) { P(x, y, z || 0); ctx.moveTo(X, Y); }
  function ln(x, y, z) { P(x, y, z || 0); ctx.lineTo(X, Y); }
  function seg(x0, y0, z0, x1, y1, z1) { P(x0, y0, z0); ctx.moveTo(X, Y); P(x1, y1, z1); ctx.lineTo(X, Y); }
  function dot(x, y, z, r, col, a) { P(x, y, z || 0); ctx.beginPath(); ctx.arc(X, Y, max(0.35, r * SC * F), 0, TAU); fillC(col, a); }
  function ring(x, y, z, r, col, w, a, fillCol) { P(x, y, z || 0); ctx.beginPath(); ctx.arc(X, Y, max(0.35, r * SC * F), 0, TAU); if (fillCol) fillC(fillCol, a); strokeC(w, col, a); }
  /* smooth curves: points are collected in CX / CY (already projected) and turned into cubic Beziers (Catmull-Rom), so nothing is ever faceted */
  var CX = new Float64Array(400), CY = new Float64Array(400), CN = 0;
  function cp(x, y, z) { P(x, y, z); CX[CN] = X; CY[CN] = Y; CN++; }
  function curveArr(xs, ys, n, closed, move) {
    var i, i0, i2, i3, last = closed ? n : n - 1;
    if (n < 2) return;
    if (move !== false) ctx.moveTo(xs[0], ys[0]); else ctx.lineTo(xs[0], ys[0]);
    for (i = 0; i < last; i++) {
      i0 = closed ? (i + n - 1) % n : (i > 0 ? i - 1 : 0); i2 = closed ? (i + 1) % n : i + 1; i3 = closed ? (i + 2) % n : (i + 2 < n ? i + 2 : n - 1);
      ctx.bezierCurveTo(xs[i] + (xs[i2] - xs[i0]) / 6, ys[i] + (ys[i2] - ys[i0]) / 6, xs[i2] - (xs[i3] - xs[i]) / 6, ys[i2] - (ys[i3] - ys[i]) / 6, xs[i2], ys[i2]);
    }
    if (closed) ctx.closePath();
  }
  function curveOut(closed, move) { curveArr(CX, CY, CN, closed, move); CN = 0; }
  /** variable-width brush stroke along CX / CY (n points, already projected) with full widths WD[i] (world units): smooth edges, round caps; path only (caller fills) */
  var WD = new Float64Array(400), RLX = new Float64Array(400), RLY = new Float64Array(400), RRX = new Float64Array(400), RRY = new Float64Array(400);
  function ribbonOut(n) {
    var i, dx, dy, d, w, a, b, p0, phiE, phi0;
    if (n < 2) { CN = 0; return; }
    for (i = 0; i < n; i++) {
      a = i > 0 ? i - 1 : 0; b = i < n - 1 ? i + 1 : n - 1;
      dx = CX[b] - CX[a]; dy = CY[b] - CY[a]; d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d; w = WD[i] * 0.5; if (!(w > 0)) w = 0;
      RLX[i] = CX[i] - dy * w; RLY[i] = CY[i] + dx * w; RRX[n - 1 - i] = CX[i] + dy * w; RRY[n - 1 - i] = CY[i] - dx * w;
    }
    curveArr(RLX, RLY, n, false, true);
    phiE = atan2(CY[n - 1] - CY[n - 2], CX[n - 1] - CX[n - 2]); w = WD[n - 1] * 0.5;
    ctx.arc(CX[n - 1], CY[n - 1], w > 0 ? w : 0, phiE + PI / 2, phiE - PI / 2, true);
    curveArr(RRX, RRY, n, false, false);
    phi0 = atan2(CY[1] - CY[0], CX[1] - CX[0]); w = WD[0] * 0.5;
    ctx.arc(CX[0], CY[0], w > 0 ? w : 0, phi0 - PI / 2, phi0 - 3 * PI / 2, true);
    ctx.closePath(); CN = 0;
  }
  /** convex hull (indices, monotone chain) of n points (xs, ys); returns the count written to out */
  var HS = new Int16Array(400);
  function hull2(xs, ys, n, out) {
    var idx = [], i, k = 0, t, lo;
    for (i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return xs[a] - xs[b] || ys[a] - ys[b]; });
    function cr(o, a, b) { return (xs[a] - xs[o]) * (ys[b] - ys[o]) - (ys[a] - ys[o]) * (xs[b] - xs[o]); }
    for (i = 0; i < n; i++) { while (k >= 2 && cr(HS[k - 2], HS[k - 1], idx[i]) <= 0) k--; HS[k++] = idx[i]; }
    for (i = n - 2, t = k + 1; i >= 0; i--) { while (k >= t && cr(HS[k - 2], HS[k - 1], idx[i]) <= 0) k--; HS[k++] = idx[i]; }
    for (i = 0; i < k - 1; i++) out[i] = HS[i];
    return k - 1;
  }
  function fillEO(col, a) { ctx.globalAlpha = A0 * CA * (a === undefined ? 1 : a); ctx.fillStyle = col; ctx.fill('evenodd'); }
  function palC(pal, v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return pal[(v * 15 + 0.5) | 0]; }
  /** circle / arc of radius r in the plane spanned by (ux,uy,uz) and (vx,vy,vz) through c: smooth curve through n samples (exact under any projection) */
  function circ3(cx, cy, cz, r, ux, uy, uz, vx, vy, vz, a0, a1, n, move) {
    var i, a, cs, sn, full = a1 - a0 >= TAU - 1e-6, m = full ? n : n + 1;
    CN = 0;
    for (i = 0; i < m; i++) {
      a = a0 + (a1 - a0) * i / n; cs = cos(a) * r; sn = sin(a) * r;
      cp(cx + ux * cs + vx * sn, cy + uy * cs + vy * sn, cz + uz * cs + vz * sn);
    }
    curveOut(full, move);
  }
  function rectPath(x0, y0, x1, y1, z) { mv(x0, y0, z); ln(x1, y0, z); ln(x1, y1, z); ln(x0, y1, z); ctx.closePath(); }
  /** rounded rectangle in the z plane with true corner arcs (cubic Beziers, kappa 0.5523) */
  function rrectPath(x0, y0, x1, y1, r, z, roll, rcx, rcy) {
    var cs = [[x1 - r, y0 + r, -PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, PI / 2], [x0 + r, y0 + r, PI]], c, a, b, k = 0.5523 * r, ca, sa, cb, sb, first = true;
    var rc = roll ? cos(roll) : 1, rs = roll ? sin(roll) : 0, mx = rcx === undefined ? (x0 + x1) / 2 : rcx, my = rcy === undefined ? (y0 + y1) / 2 : rcy, x1_, y1_, x2_, y2_;
    z = z || 0;
    function PR(x, y) { var dx = x - mx, dy = y - my; P(mx + dx * rc - dy * rs, my + dx * rs + dy * rc, z); }
    for (c = 0; c < 4; c++) {
      a = cs[c][2]; b = a + PI / 2; ca = cos(a); sa = sin(a); cb = cos(b); sb = sin(b);
      PR(cs[c][0] + ca * r, cs[c][1] + sa * r); if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
      PR(cs[c][0] + ca * r - sa * k, cs[c][1] + sa * r + ca * k); x1_ = X; y1_ = Y;
      PR(cs[c][0] + cb * r + sb * k, cs[c][1] + sb * r - cb * k); x2_ = X; y2_ = Y;
      PR(cs[c][0] + cb * r, cs[c][1] + sb * r); ctx.bezierCurveTo(x1_, y1_, x2_, y2_, X, Y);
    }
    ctx.closePath();
  }

  var cacheN = 0, cacheStore = {};
  function cached(key, make) {
    var v = cacheStore[key];
    if (v === undefined) { if (cacheN > 160) { cacheStore = {}; cacheN = 0; } v = cacheStore[key] = make(); cacheN++; }
    return v;
  }
  function reg(name, def, period) {
    NAMES.push(name); PERIOD[name] = period;
    def.hero = true; def.abstract = true; def.period = period;
    if (def.tags.indexOf('design') < 0) def.tags.unshift('design');
    if (def.tags.indexOf('abstract') < 0) def.tags.push('abstract');
    var d0 = def.draw, cen = CENTER, nc = !!def.noCenter;
    def.draw = function (c, p) { CEN = nc ? ZERO2 : (cen[name] || ZERO2); d0(c, p); };
    GA.props.register(name, def);
  }
  var ZERO2 = [0, 0];
  /** parallelogram / box face painters use the view direction in LOCAL coordinates: v = (M6, M7, M8) points toward the viewer */

  /* ================================================================== 1. formIterations */
  var FI = null, FI_N = 72, FI_RES = new Float32Array(72);
  var FI_PH = [0.0, -0.4, 0.3, 0.75, -0.2];     // resting orientation of each iteration (rad)
  function pnormPoly(n, p, rot, th) {             // rounded regular n-gon, apothem 1: r = 1 / (sum max(0, cos(th - a_i))^p)^(1/p)
    var s = 0, i, a;
    for (i = 0; i < n; i++) { a = cos(th - rot - i * TAU / n); if (a > 0) s += pow(a, p); }
    return pow(s, -1 / p);
  }
  function buildFI() {
    var N = FI_N, sh = [], k, j, th, r, a, sc, cs = new Float32Array(N), sn = new Float32Array(N);
    for (j = 0; j < N; j++) { th = j / N * TAU; cs[j] = cos(th); sn[j] = sin(th); }
    for (k = 0; k < 5; k++) {
      r = new Float32Array(N);
      for (j = 0; j < N; j++) {
        th = j / N * TAU;
        if (k === 0) r[j] = pow(pow(abs(cos(th)) / 1.18, 1.8) + pow(abs(sin(th)) / 0.78, 1.8), -1 / 1.8);
        else if (k === 1) r[j] = pnormPoly(3, 4.6, -PI / 2, th);
        else if (k === 2) r[j] = pow(pow(abs(cos(th)) / 1.28, 1.45) + pow(abs(sin(th)) / 0.70, 1.45), -1 / 1.45);
        else if (k === 3) r[j] = pnormPoly(4, 3.4, PI / 4, th);
        else r[j] = 1 + 0.15 * cos(2 * th + 0.8) + 0.12 * cos(3 * th - 0.5) + 0.06 * cos(5 * th + 2.0);
      }
      for (j = 0; j < N; j++) { th = j / N * TAU; r[j] *= 1 + 0.11 * cos(th - 0.7 + k) + 0.07 * cos(2 * th + k * 1.3) + 0.04 * cos(3 * th + 2.0 * k); }   // keep every iteration lop-sided: never a symmetric shield / pick
      a = 0; for (j = 0; j < N; j++) a += r[j] * r[j]; a /= N;
      sc = 0.285 / sqrt(a); for (j = 0; j < N; j++) r[j] *= sc;
      sh.push(r);
    }
    return { sh: sh, cs: cs, sn: sn };
  }
  function fiPath(rad, phi, ox, oy, sc, tb) {
    var N = FI_N, cph = cos(phi), sph = sin(phi), j, c, s, r;
    CN = 0;
    for (j = 0; j < N; j++) {
      r = rad[j] * sc; c = tb.cs[j]; s = tb.sn[j];
      cp(ox + r * (c * cph - s * sph), oy + r * (s * cph + c * sph), 0);
    }
    curveOut(true);
  }
  function drawFormIterations(c, p) {
    begin(c, p, { tilt: -0.1, spin: 0.12, soft: 0.9, minN: 0.6, persp: 5 });
    if (!FI) FI = buildFI();
    var tb = FI, u = frac(T / 9), s = u * 5, k = floor(s), f = s - k, kn = (k + 1) % 5, j, i;
    var mp = eio((f - 0.36) / 0.64), a, age, idx, N = FI_N;
    for (j = 0; j < N; j++) FI_RES[j] = mix(tb.sh[k][j], tb.sh[kn][j], mp);
    var phi = lerpAng(FI_PH[k], FI_PH[kn], mp);
    var DX = -0.80, DY = 0.60, LX = 0.065, LY = -0.045;       // ghosts drift this way; the live form sits a little the other way
    // ghosts: oldest first
    for (i = 2; i >= 0; i--) {
      age = f - 0.36 + i; if (age < 0) continue;
      idx = ((k - i) % 5 + 5) % 5;
      a = pow(max(0, 1 - age / 3.3), 1.35) * sstep(0, 0.12, age);
      if (a < 0.01) continue;
      bp(); fiPath(tb.sh[idx], FI_PH[idx] + 0.07 * age, LX + DX * 0.082 * age, LY + DY * 0.082 * age, 1 + 0.05 * age, tb);
      if (i >= 1) dash(7, 4);
      strokeC(LW.thin, G1, a); nodash();
    }
    // live form: pale tint + ink outline + inner contour
    bp(); fiPath(FI_RES, phi, LX, LY, 1, tb); fillPaper(1); fillC(G4, 0.6); strokeC(LW.mid * 1.1, INK, 1);
    bp(); fiPath(FI_RES, phi + 0.35, LX + 0.05, LY - 0.035, 0.7, tb); strokeC(LW.thin, G1, 1);          // an offset (not concentric) inner copy
    // the pen: a solid black dot that rides on the outline, and the centroid mark
    var th = TAU * u + 1.0, jj = ((th % TAU) / TAU * N), j0 = floor(jj) % N, j1 = (j0 + 1) % N, jf = jj - floor(jj);
    var rr = mix(FI_RES[j0], FI_RES[j1], jf), cp = cos(phi), sp = sin(phi), ca = cos(th), sa = sin(th);
    dot(LX + rr * (ca * cp - sa * sp), LY + rr * (sa * cp + ca * sp), 0, 0.019, INK, 1);
    end();
  }
  reg('formIterations', { draw: drawFormIterations, box: [1.1, 1.06], tags: ['form', 'iteration', 'morph'] }, 9);

  /* ================================================================== 2. foldedPlanes: a curved ribbon surface that folds over itself */
  var FR_N = 72;
  var FR_PX = new Float64Array((FR_N + 1) * 2), FR_PY = new Float64Array((FR_N + 1) * 2), FR_PZ = new Float64Array((FR_N + 1) * 2), FR_CZ = new Float64Array(FR_N), FR_FRONT = new Uint8Array(FR_N), FR_ORD = [];
  (function () { for (var i = 0; i < FR_N; i++) FR_ORD.push(i); })();
  function frCmp(a, b) { return FR_CZ[a] - FR_CZ[b]; }
  function drawFoldedPlanes(c, p) {
    var u = frac((+p.t || 0) / 9);
    begin(c, p, { tilt: -0.5, spin: 0.3 * sin(TAU * u + 0.5) - 0.1, soft: 0.5, persp: 5.5, off: [0, 0.0] });
    var N = FR_N, i, q, lobe = floor(u * 2), lq = u * 2 - lobe, a = sstep(0.08, 0.92, sin(PI * lq) * sin(PI * lq)) * (lobe === 0 ? 1 : -1), phi = TAU * u;
    var L = 0.98, Ay = 0.13, Az = 0.17, hw = 0.155, uu, tx, ty, tz, tl, nx, ny, nz, nl, bx, by, bz, th, ct, st, wx, wy, wz, cx, cy, cz, ex0, ey0, ez0, ex1, ey1, ez1;
    for (i = 0; i <= N; i++) {
      uu = i / N;
      cx = L * (uu - 0.5); cy = Ay * sin(TAU * 0.9 * uu + phi); cz = Az * sin(TAU * 0.6 * uu + phi + 1.0);
      tx = L; ty = Ay * TAU * 0.9 * cos(TAU * 0.9 * uu + phi); tz = Az * TAU * 0.6 * cos(TAU * 0.6 * uu + phi + 1.0);
      tl = sqrt(tx * tx + ty * ty + tz * tz); tx /= tl; ty /= tl; tz /= tl;
      nx = -tz; ny = 0; nz = tx; nl = sqrt(nx * nx + nz * nz); nx /= nl; nz /= nl;                      // horizontal normal of the ribbon (flat state)
      bx = ty * nz - tz * ny; by = tz * nx - tx * nz; bz = tx * ny - ty * nx;                           // binormal
      th = a * PI * sstep(0.12, 0.88, uu) + 0.32 * sin(TAU * 1.2 * uu + phi) * (1 - 0.5 * abs(a));       // twist angle along the ribbon
      ct = cos(th); st = sin(th);
      wx = ct * nx + st * bx; wy = ct * ny + st * by; wz = ct * nz + st * bz;
      P(cx - hw * wx, cy - hw * wy, cz - hw * wz); FR_PX[2 * i] = X; FR_PY[2 * i] = Y; FR_PZ[2 * i] = Z;
      P(cx + hw * wx, cy + hw * wy, cz + hw * wz); FR_PX[2 * i + 1] = X; FR_PY[2 * i + 1] = Y; FR_PZ[2 * i + 1] = Z;
    }
    for (i = 0; i < N; i++) {
      FR_CZ[i] = FR_PZ[2 * i] + FR_PZ[2 * i + 1] + FR_PZ[2 * i + 2] + FR_PZ[2 * i + 3];
      // facing: signed area of the projected quad
      q = (FR_PX[2 * i + 1] - FR_PX[2 * i]) * (FR_PY[2 * i + 2] - FR_PY[2 * i]) - (FR_PY[2 * i + 1] - FR_PY[2 * i]) * (FR_PX[2 * i + 2] - FR_PX[2 * i]);
      FR_FRONT[i] = q < 0 ? 1 : 0;
    }
    FR_ORD.sort(frCmp);
    var k, e0, e1, depth, wgt;
    for (k = 0; k < N; k++) {
      i = FR_ORD[k]; e0 = 2 * i; e1 = 2 * i + 2;
      // strip fill, grown by a hair along the ribbon so that neighbouring strips overlap (no antialiasing seams); one opaque tint for the reverse side
      var d0x = FR_PX[e1] - FR_PX[e0], d0y = FR_PY[e1] - FR_PY[e0], l0 = Math.sqrt(d0x * d0x + d0y * d0y) || 1, d1x = FR_PX[e1 + 1] - FR_PX[e0 + 1], d1y = FR_PY[e1 + 1] - FR_PY[e0 + 1], l1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1, ge = 0.0;
      bp(); ctx.moveTo(FR_PX[e0] - d0x / l0 * ge, FR_PY[e0] - d0y / l0 * ge); ctx.lineTo(FR_PX[e0 + 1] - d1x / l1 * ge, FR_PY[e0 + 1] - d1y / l1 * ge); ctx.lineTo(FR_PX[e1 + 1] + d1x / l1 * ge, FR_PY[e1 + 1] + d1y / l1 * ge); ctx.lineTo(FR_PX[e1] + d0x / l0 * ge, FR_PY[e1] + d0y / l0 * ge); ctx.closePath();
      fillC(FR_FRONT[i] ? PAPER : G4, 1); ctx.lineWidth = 0.9; ctx.strokeStyle = FR_FRONT[i] ? PAPER : G4; ctx.stroke();   // same-colour hairline: closes the antialiasing seams between strips
      if (i % 9 === 0) { bp(); ctx.moveTo(FR_PX[e0], FR_PY[e0]); ctx.lineTo(FR_PX[e0 + 1], FR_PY[e0 + 1]); strokeC(LW.hair * 1.1, G1, 0.75); }          // fold contours across the ribbon
      depth = clamp(0.5 + 0.5 * (FR_PZ[e0] + FR_PZ[e0 + 1]) / 0.5, 0, 1); wgt = LW.mid * (0.5 + 0.75 * depth);
      var ep0 = i > 0 ? e0 - 2 : e0, ep1 = i < N - 1 ? e1 + 2 : e1;      // edge strokes run half a strip beyond both ends so that the joints never show
      bp(); ctx.moveTo((FR_PX[ep0] + FR_PX[e0]) / 2, (FR_PY[ep0] + FR_PY[e0]) / 2); ctx.lineTo(FR_PX[e0], FR_PY[e0]); ctx.lineTo(FR_PX[e1], FR_PY[e1]); ctx.lineTo((FR_PX[e1] + FR_PX[ep1]) / 2, (FR_PY[e1] + FR_PY[ep1]) / 2);
      ctx.moveTo((FR_PX[ep0 + 1] + FR_PX[e0 + 1]) / 2, (FR_PY[ep0 + 1] + FR_PY[e0 + 1]) / 2); ctx.lineTo(FR_PX[e0 + 1], FR_PY[e0 + 1]); ctx.lineTo(FR_PX[e1 + 1], FR_PY[e1 + 1]); ctx.lineTo((FR_PX[e1 + 1] + FR_PX[ep1 + 1]) / 2, (FR_PY[e1 + 1] + FR_PY[ep1 + 1]) / 2); strokeC(wgt, INK, 1);
    }
    // closing end lines
    bp(); ctx.moveTo(FR_PX[0], FR_PY[0]); ctx.lineTo(FR_PX[1], FR_PY[1]); ctx.moveTo(FR_PX[2 * N], FR_PY[2 * N]); ctx.lineTo(FR_PX[2 * N + 1], FR_PY[2 * N + 1]); strokeC(LW.mid * 0.8, INK, 1);
    // the one small black accent travels along the lower edge
    var s = 0.5 - 0.44 * cos(TAU * u), fi = s * N, i0 = min(N - 1, floor(fi)), ff = fi - i0;
    bp(); ctx.arc(mix(FR_PX[2 * i0 + 1], FR_PX[2 * i0 + 3], ff), mix(FR_PY[2 * i0 + 1], FR_PY[2 * i0 + 3], ff), 0.016 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('foldedPlanes', { draw: drawFoldedPlanes, box: [1.0, 0.7], tags: ['plane', 'fold', 'ribbon', 'surface'] }, 9);

  /* ================================================================== 3. volumeShift: unequal blocks floating in space that slide, swap sizes and re-balance */
  var VS = [   // 4 arrangements x 5 slots [x, y (up), z, w, h, d]  (units of s; no ground: the blocks hover)
    [[0.0, -0.08, 0.0, 0.52, 0.08, 0.30], [-0.2, 0.1, 0.0, 0.18, 0.18, 0.18], [0.17, 0.06, 0.04, 0.30, 0.07, 0.10], [0.2, -0.22, -0.05, 0.12, 0.12, 0.2], [-0.27, -0.2, 0.05, 0.07, 0.07, 0.07]],
    [[0.0, 0.0, 0.0, 0.34, 0.07, 0.44], [-0.24, 0.2, 0.05, 0.12, 0.12, 0.12], [0.04, -0.16, 0.0, 0.46, 0.06, 0.09], [0.27, 0.12, -0.04, 0.16, 0.1, 0.16], [-0.3, -0.12, 0.1, 0.07, 0.07, 0.07]],
    [[-0.02, 0.1, 0.0, 0.5, 0.07, 0.22], [0.0, -0.1, 0.02, 0.2, 0.2, 0.2], [-0.27, -0.14, -0.06, 0.14, 0.08, 0.3], [0.29, -0.02, 0.08, 0.1, 0.18, 0.1], [0.22, 0.23, -0.05, 0.07, 0.07, 0.07]],
    [[0.06, -0.14, 0.0, 0.42, 0.06, 0.34], [-0.2, 0.04, 0.04, 0.2, 0.14, 0.14], [0.1, 0.12, -0.04, 0.34, 0.08, 0.12], [0.31, -0.02, 0.08, 0.1, 0.1, 0.1], [-0.28, -0.2, -0.05, 0.07, 0.07, 0.07]],
  ];
  var VS_NS = 5, VS_CUR = new Float32Array(VS_NS * 6), VS_ORD = [0, 1, 2, 3, 4], VS_BEH = [[], [], [], [], []];
  var BV = [0, 0, 0];   // view direction in local coordinates (toward the viewer)
  function lerpArr(a, b, k, out, stag) {
    var i, j, e;
    for (i = 0; i < VS_NS; i++) {
      e = spr((k - i * stag) / (1 - (VS_NS - 1) * stag));
      for (j = 0; j < 6; j++) out[i * 6 + j] = mix(a[i][j], b[i][j], e);
    }
  }
  /** painter order for axis-aligned boxes B = [x, yUp, z, w, h, d] x n: pairs are ordered by a separating axis (fallback: centre depth) */
  function orderBoxes(B, n, ord) {
    var i, j, k, lo, hi, rem = [], beh = VS_BEH;
    for (i = 0; i < n; i++) { beh[i].length = 0; rem[i] = true; }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var Ai = i * 6, Aj = j * 6;
      for (k = 0; k < 3; k++) {
        var ci, cj, hi_, hj_;
        if (k === 0) { ci = B[Ai]; cj = B[Aj]; hi_ = B[Ai + 3] / 2; hj_ = B[Aj + 3] / 2; }
        else if (k === 1) { ci = -B[Ai + 1]; cj = -B[Aj + 1]; hi_ = B[Ai + 4] / 2; hj_ = B[Aj + 4] / 2; }
        else { ci = B[Ai + 2]; cj = B[Aj + 2]; hi_ = B[Ai + 5] / 2; hj_ = B[Aj + 5] / 2; }
        if (ci + hi_ <= cj - hj_ + 1e-4) { lo = i; hi = j; } else if (cj + hj_ <= ci - hi_ + 1e-4) { lo = j; hi = i; } else continue;
        if (BV[k] > 0) beh[hi].push(lo); else beh[lo].push(hi);   // beh[x] = boxes that must be drawn BEFORE x
        break;
      }
    }
    for (k = 0; k < n; k++) {
      var pick = -1, bestD = 1e9;
      for (i = 0; i < n; i++) {
        if (!rem[i]) continue;
        var ok = true; for (j = 0; j < beh[i].length; j++) if (rem[beh[i][j]]) { ok = false; break; }
        if (ok) { var dd = -B[i * 6 + 1] * BV[1] + B[i * 6] * BV[0] + B[i * 6 + 2] * BV[2]; if (dd < bestD) { bestD = dd; pick = i; } }
      }
      if (pick < 0) { for (i = 0; i < n; i++) if (rem[i]) { pick = i; break; } }
      rem[pick] = false; ord[k] = pick;
    }
  }
  /** draw an axis-aligned box [x0,x1] x [y0,y1] x [z0,z1] (local, y down): fills[3] = faces whose normal is along x / y / z, edge colour, weight, alpha */
  function boxVisible(x0, y0, z0, x1, y1, z1, fx, fy, fz, edge, ew, ea, ga) {
    var xx = BV[0] > 0 ? x1 : x0, yy = BV[1] > 0 ? y1 : y0, zz = BV[2] > 0 ? z1 : z0, ff = [fx, fy, fz];
    var f;
    for (f = 0; f < 3; f++) {
      if (!ff[f]) continue;
      bp();
      if (f === 0) { mv(xx, y0, z0); ln(xx, y1, z0); ln(xx, y1, z1); ln(xx, y0, z1); }
      else if (f === 1) { mv(x0, yy, z0); ln(x1, yy, z0); ln(x1, yy, z1); ln(x0, yy, z1); }
      else { mv(x0, y0, zz); ln(x1, y0, zz); ln(x1, y1, zz); ln(x0, y1, zz); }
      ctx.closePath(); fillC(ff[f], ga);
    }
    bp();
    mv(xx, y0, z0); ln(xx, y1, z0); ln(xx, y1, z1); ln(xx, y0, z1); ctx.closePath();
    mv(x0, yy, z0); ln(x1, yy, z0); ln(x1, yy, z1); ln(x0, yy, z1); ctx.closePath();
    mv(x0, y0, zz); ln(x1, y0, zz); ln(x1, y1, zz); ln(x0, y1, zz); ctx.closePath();
    strokeC(ew, edge, ea * ga);
  }
  function drawVolumeShift(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.5, spin: 0.62 + 0.22 * sin(TAU * u), soft: 0.5, persp: 7, off: [0, 0.0] });
    BV[0] = M[6]; BV[1] = M[7]; BV[2] = M[8];
    var s = u * 4, k = floor(s), f = s - k, kn = (k + 1) % 4, kp = (k + 3) % 4, mk = clamp((f - 0.4) / 0.6, 0, 1), i, j;
    lerpArr(VS[k], VS[kn], mk, VS_CUR, 0.07);
    var gk, ga;     // dotted ghost = the arrangement the group has just left (appears as the next shift starts; fades through the following hold)
    if (f > 0.38) { gk = k; ga = sstep(0.38, 0.55, f); } else { gk = kp; ga = 1 - sstep(0.0, 0.5, f); }
    if (ga > 0.01) {
      var Gm = VS[gk];
      bp();
      for (i = 0; i < VS_NS; i++) {
        var g = Gm[i], x0 = g[0] - g[3] / 2, x1 = g[0] + g[3] / 2, z0 = g[2] - g[5] / 2, z1 = g[2] + g[5] / 2, y0 = -g[1] - g[4] / 2, y1 = -g[1] + g[4] / 2;
        mv(x0, y0, z0); ln(x1, y0, z0); ln(x1, y0, z1); ln(x0, y0, z1); ctx.closePath();
        mv(x0, y1, z0); ln(x1, y1, z0); ln(x1, y1, z1); ln(x0, y1, z1); ctx.closePath();
        seg(x0, y0, z0, x0, y1, z0); seg(x1, y0, z0, x1, y1, z0); seg(x1, y0, z1, x1, y1, z1); seg(x0, y0, z1, x0, y1, z1);
      }
      dots(5.2); strokeC(LW.thin * 1.0, G1, ga * 0.8); nodash();
    }
    orderBoxes(VS_CUR, VS_NS, VS_ORD);
    for (j = 0; j < VS_NS; j++) {
      i = VS_ORD[j]; var b = i * 6;
      var bx0 = VS_CUR[b] - VS_CUR[b + 3] / 2, bx1 = VS_CUR[b] + VS_CUR[b + 3] / 2, bz0 = VS_CUR[b + 2] - VS_CUR[b + 5] / 2, bz1 = VS_CUR[b + 2] + VS_CUR[b + 5] / 2, by0 = -VS_CUR[b + 1] - VS_CUR[b + 4] / 2, by1 = -VS_CUR[b + 1] + VS_CUR[b + 4] / 2;
      if (i === 0) boxVisible(bx0, by0, bz0, bx1, by1, bz1, G4, G4, G4, INK, LW.mid * 0.85, 1, 1);               // the one tinted block
      else if (i === 4) boxVisible(bx0, by0, bz0, bx1, by1, bz1, INK, INK, INK, INK, LW.thin, 1, 1);              // the one small solid accent
      else boxVisible(bx0, by0, bz0, bx1, by1, bz1, PAPER, PAPER, PAPER, INK, LW.mid * 0.85, 1, 1);
    }
    end();
  }
  reg('volumeShift', { draw: drawVolumeShift, box: [1.0, 0.8], tags: ['volume', 'massing', 'cuboid', 'floating'] }, 8);

  /* ================================================================== 4. wireVolume: a twisted tower of rotated hexagonal rings (the twist per level breathes) */
  var WT_M = 6, WT_L = 4, WT_N = WT_M * WT_L;
  var WT_V = new Float32Array(WT_N * 3), WT_S = new Float32Array(WT_N * 3), WT_HX = new Float64Array(WT_N), WT_HY = new Float64Array(WT_N), WT_HO = new Int16Array(WT_N);
  function drawWireVolume(c, p) {
    var u = frac((+p.t || 0) / 8);
    // the tower is 6-fold symmetric, so a spin of 1/6 turn per period loops seamlessly
    begin(c, p, { tilt: -0.6 + 0.04 * sin(TAU * u), spin: TAU / WT_M * u + 0.35, soft: 0.3, persp: 4.6, off: [0, 0.0] });
    var m = WT_M, L = WT_L, tw = 0.3 + 0.24 * sin(TAU * u), l, i, a, r, y, idx, f;
    for (l = 0; l < L; l++) {
      y = (l / (L - 1) - 0.5) * 0.54; r = 0.25 * (1 + 0.2 * sin(TAU * u + l * 1.1 - 0.6)) * (1 - 0.1 * l / (L - 1));
      for (i = 0; i < m; i++) {
        a = TAU * i / m + l * tw; idx = (l * m + i) * 3; R(r * cos(a), y, r * sin(a));
        WT_V[idx] = RX; WT_V[idx + 1] = RY; WT_V[idx + 2] = RZ;
        f = PERSP ? PERSP / (PERSP - RZ) : 1; WT_S[idx] = RX * f * SC + OFX; WT_S[idx + 1] = RY * f * SC + OFY; WT_S[idx + 2] = f;
      }
    }
    // a quiet dotted ring under the tower
    bp(); circ3(0, 0.4, 0, 0.5, 1, 0, 0, 0, 0, 1, 0, TAU, 40); ctx.setLineDash([0.001, 5.6 * K]); ctx.lineDashOffset = -(T * 2.0) * K; strokeC(LW.thin * 0.95, G1, 0.7); nodash(); ctx.lineDashOffset = 0;
    // opaque paper silhouette (convex hull of the vertices), then one flat light tint: the top cap
    (function () { var xs = WT_HX, ys = WT_HY, n = 0, q, hn2; for (q = 0; q < WT_N; q++) { xs[n] = WT_S[q * 3]; ys[n] = WT_S[q * 3 + 1]; n++; } hn2 = hull2(xs, ys, n, WT_HO); bp(); for (q = 0; q < hn2; q++) { if (q === 0) ctx.moveTo(xs[WT_HO[q]], ys[WT_HO[q]]); else ctx.lineTo(xs[WT_HO[q]], ys[WT_HO[q]]); } ctx.closePath(); fillPaper(1); })();
    bp(); for (i = 0; i < m; i++) { idx = i * 3; if (i === 0) ctx.moveTo(WT_S[idx], WT_S[idx + 1]); else ctx.lineTo(WT_S[idx], WT_S[idx + 1]); } ctx.closePath(); fillC(G4, 1);
    // edges: near ones solid ink, far ones dashed grey, blended by depth
    function edge(a0, b0, w) {
      var ia = a0 * 3, ib = b0 * 3, zm = (WT_V[ia + 2] + WT_V[ib + 2]) / 2, vis = sstep(-0.05, 0.05, zm);
      if (vis < 0.99) { bp(); ctx.moveTo(WT_S[ia], WT_S[ia + 1]); ctx.lineTo(WT_S[ib], WT_S[ib + 1]); dash(4.6, 4.6); strokeC(LW.hair * 1.2, G1, (1 - vis) * 0.9); nodash(); }
      if (vis > 0.01) { bp(); ctx.moveTo(WT_S[ia], WT_S[ia + 1]); ctx.lineTo(WT_S[ib], WT_S[ib + 1]); strokeC(w, INK, vis); }
    }
    for (l = 0; l < L; l++) for (i = 0; i < m; i++) {
      edge(l * m + i, l * m + (i + 1) % m, l === 0 || l === L - 1 ? LW.mid * 0.9 : LW.thin * 1.1);          // rings
      if (l < L - 1) edge(l * m + i, (l + 1) * m + i, LW.thin * 1.1);                                       // twisted risers
    }
    // small rings at the vertices of the top and bottom ring
    for (l = 0; l < L; l += L - 1) for (i = 0; i < m; i++) {
      idx = (l * m + i) * 3; var front = WT_V[idx + 2] > 0;
      bp(); ctx.arc(WT_S[idx], WT_S[idx + 1], (0.0095 + 0.003 * WT_S[idx + 2]) * SC * (front ? 1 : 0.7), 0, TAU); fillPaper(1); strokeC(LW.hair * 1.2, front ? INK : G1, front ? 1 : 0.8);
    }
    // the single black accent travels along the top ring
    var pos = u * m, s0 = floor(pos) % m, sf = pos - floor(pos), s1 = (s0 + 1) % m;
    bp(); ctx.arc(mix(WT_S[s0 * 3], WT_S[s1 * 3], sf), mix(WT_S[s0 * 3 + 1], WT_S[s1 * 3 + 1], sf), 0.0155 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('wireVolume', { draw: drawWireVolume, box: [0.95, 0.95], tags: ['wireframe', 'twist', 'tower', 'volume'] }, 8);

  /* ================================================================== 5. arcVault */
  var AV_YB = 0.27, AVX = 0, AVY = 0, AV_N = [9, 8, 11];
  var AV_EX = [[[0.62, 0.0, 0.5], [0.5, 0.12, 0.5]], [[0.68, 0.14, 0.34], [0.52, -0.16, 0.5]], []];   // extra sweeping curves per vault: [height, lean, half-span]
  var AV_W = [0.55, 0.55, 0.95, 0.55, 0.55, 1.3, 0.55, 0.8, 0.55, 1.7, 0.55, 0.95];     // brush weights (x LW.thin) cycling over the curves of a vault
  function s5(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * x * (x * (x * 6 - 15) + 10); }
  function avCurve(v, k, n, tt) {      // sets AVX, AVY: point tt (0..1, left to right) of curve k of vault v
    var g = n > 1 ? k / (n - 1) : 0, a, r, aa, h, sk, half, xx, ex;
    if (k >= n) { ex = AV_EX[v][k - n]; AVX = ex[2] * (2 * tt - 1) + ex[1] * sin(PI * tt); AVY = AV_YB - ex[0] * spw(tt, 1.25); return; }
    if (v === 0) { r = 0.10 + 0.34 * pow(g, 1.25); a = PI + PI * tt; AVX = r * cos(a); AVY = AV_YB + r * sin(a); }                   // dome: concentric semicircles
    else if (v === 1) {                                                                                                            // ogive: nested equilateral pointed arches
      aa = 0.07 + 0.35 * pow(g, 1.15); half = tt < 0.5 ? tt * 2 : (1 - tt) * 2; a = PI - (PI / 3) * half;
      xx = aa + 2 * aa * cos(a); AVX = tt < 0.5 ? xx : -xx; AVY = AV_YB - 2 * aa * sin(a);
    } else { h = 0.12 + 0.5 * pow(g, 0.9); sk = -0.16 + 0.32 * g; aa = 0.46; AVX = aa * (2 * tt - 1) + sk * sin(PI * tt); AVY = AV_YB - h * spw(tt, 1.25); }   // skewed catenary-like sweeps
  }
  function drawArcVault(c, p) {
    begin(c, p, { tilt: -0.06, spin: 0.1, soft: 0.8, minN: 0.6, persp: 6, off: [0, 0.02] });
    var u = frac(T / 9), v, k, n, i, m, lam, a0, b0, c0, d0, f0, f1, tt, col, wk, tipV = [];
    // a faint dotted base line that never leaves: the vaults come and go above it
    bp(); mv(-0.5, AV_YB + 0.045, 0); ln(0.5, AV_YB + 0.045, 0); dots(6); strokeC(LW.thin * 0.95, G1, 0.8); nodash();
    for (v = 0; v < 3; v++) {
      lam = frac(u - v / 3); if (lam > 0.56) continue;
      n = AV_N[v];
      var vk = lam < 0.5 ? 1 : 1 - s5((lam - 0.5) / 0.06);
      for (k = 0; k < n + AV_EX[v].length; k++) {
        a0 = 0.012 * k; b0 = a0 + 0.17; c0 = 0.30 + 0.009 * k; d0 = c0 + 0.17;
        f1 = s5((lam - a0) / (b0 - a0)); f0 = s5((lam - c0) / (d0 - c0));
        if (f1 - f0 < 0.004) continue;
        m = max(6, Math.ceil(26 * (f1 - f0)));
        CN = 0;
        wk = LW.thin * 1.6 * (k >= n ? 0.5 : AV_W[k % 12]);
        for (i = 0; i <= m; i++) {
          tt = f0 + (f1 - f0) * i / m; avCurve(v, k, n, tt); cp(AVX, AVY, 0);
          WD[i] = wk * K * (0.2 + 0.8 * spw(tt, 0.5) * (0.4 + 0.6 * abs(cos(PI * tt))));          // swells on the flanks, thins towards the apex so the arches never clot
        }
        col = k >= n ? G1 : k % 4 === 0 ? INK : k % 4 === 1 ? G1 : k % 4 === 2 ? INK : G1;
        ribbonOut(m + 1); fillC(col, 0.95 * vk);
        if (f1 < 0.985 && f1 > 0.01 && f0 < 0.01) { avCurve(v, k, n, f1); P(AVX, AVY, 0); bp(); ctx.arc(X, Y, 0.0095 * SC * DM * F, 0, TAU); fillC(k % 4 === 0 ? INK : G1, sstep(0.01, 0.08, f1)); }
      }
    }
    end();
  }
  reg('arcVault', { draw: drawArcVault, box: [0.99, 0.78], tags: ['arc', 'vault', 'line'] }, 9);

  /* ================================================================== 6. dotSurface */
  var DS_NX = 18, DS_NZ = 11, DS_N = DS_NX * DS_NZ, DS_NB = 6;
  var DS_SX = new Float32Array(DS_N), DS_SY = new Float32Array(DS_N), DS_SR = new Float32Array(DS_N), DS_SB = new Uint8Array(DS_N), DS_BX = new Float32Array(DS_N), DS_BY = new Float32Array(DS_N), DS_BR = new Float32Array(DS_N);
  function dsHeight(x, z, u) {
    var q = sqrt((x / 0.52) * (x / 0.52) + (z / 0.36) * (z / 0.36)), env = 1 - sstep(0.45, 1.1, q);
    return 0.12 * env * (0.64 * sin(5.0 * x + 3.0 * z - TAU * u) + 0.36 * sin(-3.2 * x + 6.0 * z - 2 * TAU * u + 1.1));
  }
  function drawDotSurface(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.8, spin: 0.2 + 0.08 * sin(TAU * u), soft: 0.8, persp: 5.2, off: [0, 0.03] });
    var ix, iz, x, z, h, t01, yb = 0.15, idx, b, rr;
    for (iz = 0; iz < DS_NZ; iz++) {
      z = -0.36 + 0.72 * iz / (DS_NZ - 1);
      for (ix = 0; ix < DS_NX; ix++) {
        x = -0.52 + 1.04 * ix / (DS_NX - 1); idx = iz * DS_NX + ix;
        h = dsHeight(x, z, u); t01 = clamp(0.5 + h / 0.18, 0, 1);
        P(x, yb, z); DS_BX[idx] = X; DS_BY[idx] = Y; DS_BR[idx] = 0.0042 * SC * F;
        P(x, yb - h, z); DS_SX[idx] = X; DS_SY[idx] = Y; DS_SR[idx] = (0.0072 + 0.0075 * t01) * SC * F; DS_SB[idx] = min(DS_NB - 1, floor(t01 * (DS_NB - 0.001)));
      }
    }
    // pale dots of the datum plane beneath
    bp(); for (idx = 0; idx < DS_N; idx++) { ctx.moveTo(DS_BX[idx] + DS_BR[idx], DS_BY[idx]); ctx.arc(DS_BX[idx], DS_BY[idx], DS_BR[idx], 0, TAU); } fillC(G1, 0.5);
    // the profile row: a thin curve through its dots, dropped to the datum plane by hairlines
    var prow = 4;
    bp(); for (ix = 0; ix < DS_NX; ix += 2) { idx = prow * DS_NX + ix; ctx.moveTo(DS_SX[idx], DS_SY[idx]); ctx.lineTo(DS_BX[idx], DS_BY[idx]); } strokeC(LW.hair * 1.1, G1, 0.7);
    CN = 0; for (ix = 0; ix < DS_NX; ix++) { idx = prow * DS_NX + ix; CX[CN] = DS_SX[idx]; CY[CN] = DS_SY[idx]; CN++; }
    bp(); curveOut(false, true); strokeC(LW.mid * 0.95, INK, 1);
    // the lifted dots: one ink colour, tone carried by opacity (pale low, black high)
    for (b = 0; b < DS_NB; b++) {
      bp(); for (idx = 0; idx < DS_N; idx++) { if (DS_SB[idx] !== b) continue; rr = DS_SR[idx]; ctx.moveTo(DS_SX[idx] + rr, DS_SY[idx]); ctx.arc(DS_SX[idx], DS_SY[idx], rr, 0, TAU); }
      fillC(INK, 0.36 + 0.64 * b / (DS_NB - 1));
    }
    end();
  }
  reg('dotSurface', { draw: drawDotSurface, box: [1.19, 0.72], tags: ['dots', 'surface', 'wave', 'parametric'] }, 8);

  /* ================================================================== 8. nestedFrames: a walk through receding thresholds */
  var NF_N = 7;
  function drawNestedFrames(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.04, spin: 0.0, soft: 0.3, persp: 3.2, off: [0, 0.0] });
    // the frames travel towards us; the pace breathes a little
    var phase = 7 * (u - 0.05 * sin(TAU * u)), n0 = floor(phase), f = phase - n0, dz = 0.62, z0 = 0.5;
    var vpx = 0.2 * sin(TAU * u + 0.8), vpy = -0.06 * cos(TAU * u), om = 0.03 * sin(TAU * u + 2.0), HX = 0.31, HY = 0.23;
    var k, z, cxx, cyy, dep, a, abs0, fl = HY, wc = 0.15 * sin(TAU * u + 0.3), zf = z0 - NF_N * dz, wl, roll;
    function off(zz) { return (z0 - zz) * 0.26; }
    function wdf(zz) { return 0.15 - 0.022 * (z0 - zz); }
    // an opaque paper backing under the nearest frame (nothing from behind shows through)
    for (k = 0; k <= NF_N; k++) {
      z = z0 - (k - f) * dz; a = (1 - sstep(z0 - 0.1, z0 + 0.5, z)) * sstep(zf, zf + 2.2, z); if (a < 0.02) continue;
      dep = z0 - z; cxx = vpx * dep * 0.26; cyy = vpy * dep * 0.26; roll = om * dep;
      bp(); rrectPath(cxx - HX, cyy - HY, cxx + HX, cyy + HY, 0.06, z, roll, cxx, cyy); fillPaper(a); break;
    }
    // frames, far to near; exactly one of them is a thick black band at any time (the single accent)
    for (k = NF_N; k >= 0; k--) {
      z = z0 - (k - f) * dz;
      a = (1 - sstep(z0 - 0.1, z0 + 0.5, z)) * sstep(zf, zf + 2.2, z); if (a < 0.01) continue;
      dep = z0 - z; cxx = vpx * dep * 0.26; cyy = vpy * dep * 0.26; roll = om * dep;
      abs0 = n0 + k; wl = LW.mid * (0.5 + 0.55 * sstep(zf, z0, z));
      if (((abs0 % 7) + 7) % 7 === 3) {
        bp(); rrectPath(cxx - HX, cyy - HY, cxx + HX, cyy + HY, 0.06, z, roll, cxx, cyy); rrectPath(cxx - HX + 0.014, cyy - HY + 0.014, cxx + HX - 0.014, cyy + HY - 0.014, 0.046, z, roll, cxx, cyy);
        fillEO(INK, a);
      } else {
        bp(); rrectPath(cxx - HX, cyy - HY, cxx + HX, cyy + HY, 0.06, z, roll, cxx, cyy); strokeC(wl, INK, a * (0.4 + 0.6 * sstep(zf, z0 - 0.6, z)));
      }
    }
    end();
  }
  reg('nestedFrames', { draw: drawNestedFrames, box: [0.93, 0.67], tags: ['frame', 'threshold', 'perspective'] }, 8);

  /* ================================================================== 10. sliceCut */
  var SCX = [], SCE = [], SCF = [[1, 3, 7, 5], [0, 4, 6, 2], [2, 6, 7, 3], [0, 1, 5, 4], [4, 5, 7, 6], [0, 2, 3, 1]], SCN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  (function () { var i, j; for (i = 0; i < 8; i++) SCX.push([(i & 1 ? 1 : -1), (i & 2 ? 1 : -1), (i & 4 ? 1 : -1)]); for (i = 0; i < 8; i++) for (j = 0; j < 3; j++) if (!(i & (1 << j))) SCE.push([i, i | (1 << j)]); })();
  var SC_A = new Float64Array(64), SC_B = new Float64Array(64), SC_SEC = new Float64Array(24), SC_SA = new Float64Array(8);
  function clipPoly(src, n, nx, ny, nz, d, out) {   // keep n.x - d <= 0 (Sutherland-Hodgman); src/out flat [x,y,z,...]; returns the vertex count
    var m = 0, i, j, fa, fb, t, ax, ay, az, bx, by, bz;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n; ax = src[3 * i]; ay = src[3 * i + 1]; az = src[3 * i + 2]; bx = src[3 * j]; by = src[3 * j + 1]; bz = src[3 * j + 2];
      fa = nx * ax + ny * ay + nz * az - d; fb = nx * bx + ny * by + nz * bz - d;
      if (fa <= 0) { out[3 * m] = ax; out[3 * m + 1] = ay; out[3 * m + 2] = az; m++; }
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { t = fa / (fa - fb); out[3 * m] = ax + (bx - ax) * t; out[3 * m + 1] = ay + (by - ay) * t; out[3 * m + 2] = az + (bz - az) * t; m++; }
    }
    return m;
  }
  function drawSliceCut(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.55, spin: 0.7 + 0.18 * sin(TAU * u + 1), soft: 0.6, persp: 6, off: [0, 0.0] });
    BV[0] = M[6]; BV[1] = M[7]; BV[2] = M[8];
    var h = 0.215, i, j, f, nx = 0.28 * cos(TAU * u + 0.5), ny = -1, nz = 0.34 * sin(TAU * u + 0.2), nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    nx /= nl; ny /= nl; nz /= nl;
    var dmax = h * (abs(nx) + abs(ny) + abs(nz)), d = (dmax + 0.03) * sin(TAU * u - PI / 2);
    // kept part: the faces that look at us, clipped by the plane
    var fi, m, q, nsec = 0;
    for (fi = 0; fi < 6; fi++) {
      if (SCN[fi][0] * BV[0] + SCN[fi][1] * BV[1] + SCN[fi][2] * BV[2] <= 0) continue;
      for (q = 0; q < 4; q++) { var vv = SCX[SCF[fi][q]]; SC_A[3 * q] = vv[0] * h; SC_A[3 * q + 1] = vv[1] * h; SC_A[3 * q + 2] = vv[2] * h; }
      m = clipPoly(SC_A, 4, nx, ny, nz, d, SC_B);
      if (m < 3) continue;
      bp(); for (q = 0; q < m; q++) { P(SC_B[3 * q], SC_B[3 * q + 1], SC_B[3 * q + 2]); if (q === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.closePath();
      fillPaper(1); strokeC(LW.mid * 0.85, INK, 1);
    }
    // section polygon: plane / cube edge intersections ordered around their centre
    var e1x, e1y, e1z, e2x, e2y, e2z, cxs = 0, cys = 0, czs = 0, fa, fb, t, ex, ey, ez;
    if (abs(ny) < 0.9) { e1x = -nz; e1y = 0; e1z = nx; } else { e1x = 0; e1y = nz; e1z = -ny; }
    var el = Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z); e1x /= el; e1y /= el; e1z /= el;
    e2x = ny * e1z - nz * e1y; e2y = nz * e1x - nx * e1z; e2z = nx * e1y - ny * e1x;
    for (i = 0; i < 12; i++) {
      var A = SCX[SCE[i][0]], B = SCX[SCE[i][1]];
      fa = nx * A[0] * h + ny * A[1] * h + nz * A[2] * h - d; fb = nx * B[0] * h + ny * B[1] * h + nz * B[2] * h - d;
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
        t = fa / (fa - fb); ex = (A[0] + (B[0] - A[0]) * t) * h; ey = (A[1] + (B[1] - A[1]) * t) * h; ez = (A[2] + (B[2] - A[2]) * t) * h;
        SC_SEC[3 * nsec] = ex; SC_SEC[3 * nsec + 1] = ey; SC_SEC[3 * nsec + 2] = ez; cxs += ex; cys += ey; czs += ez; nsec++;
      }
    }
    // translucent cutting plane
    var pc = 0.36, cx0 = nx * d, cy0 = ny * d, cz0 = nz * d, pa = sstep(0, 0.02, abs(d) < dmax + 0.06 ? 1 : 0);
    bp();
    P(cx0 - pc * e1x - pc * e2x, cy0 - pc * e1y - pc * e2y, cz0 - pc * e1z - pc * e2z); ctx.moveTo(X, Y);
    P(cx0 + pc * e1x - pc * e2x, cy0 + pc * e1y - pc * e2y, cz0 + pc * e1z - pc * e2z); ctx.lineTo(X, Y);
    P(cx0 + pc * e1x + pc * e2x, cy0 + pc * e1y + pc * e2y, cz0 + pc * e1z + pc * e2z); ctx.lineTo(X, Y);
    P(cx0 - pc * e1x + pc * e2x, cy0 - pc * e1y + pc * e2y, cz0 - pc * e1z + pc * e2z); ctx.lineTo(X, Y); ctx.closePath();
    fillC(G4, 0.4); dash(6, 4); strokeC(LW.thin * 0.9, G1, 0.9); nodash();
    if (nsec >= 3) {
      cxs /= nsec; cys /= nsec; czs /= nsec;
      for (i = 0; i < nsec; i++) SC_SA[i] = atan2((SC_SEC[3 * i] - cxs) * e2x + (SC_SEC[3 * i + 1] - cys) * e2y + (SC_SEC[3 * i + 2] - czs) * e2z, (SC_SEC[3 * i] - cxs) * e1x + (SC_SEC[3 * i + 1] - cys) * e1y + (SC_SEC[3 * i + 2] - czs) * e1z);
      var ord = [], tmp;
      for (i = 0; i < nsec; i++) ord.push(i);
      ord.sort(function (a, b) { return SC_SA[a] - SC_SA[b]; });
      bp(); for (i = 0; i < nsec; i++) { j = ord[i]; P(SC_SEC[3 * j], SC_SEC[3 * j + 1], SC_SEC[3 * j + 2]); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.closePath();
      fillC(G3, 0.9); strokeC(LW.bold, INK, 1);
      bp(); for (i = 0; i < nsec; i++) { P(SC_SEC[3 * i], SC_SEC[3 * i + 1], SC_SEC[3 * i + 2]); ctx.moveTo(X + 2.2 * K, Y); ctx.arc(X, Y, 2.2 * K, 0, TAU); } fillPaper(1);
    }
    // the removed part: dotted ghost edges (the portion of every edge above the plane)
    bp();
    for (i = 0; i < 12; i++) {
      var A2 = SCX[SCE[i][0]], B2 = SCX[SCE[i][1]], ax = A2[0] * h, ay = A2[1] * h, az = A2[2] * h, bx = B2[0] * h, by = B2[1] * h, bz = B2[2] * h;
      fa = nx * ax + ny * ay + nz * az - d; fb = nx * bx + ny * by + nz * bz - d;
      if (fa <= 0 && fb <= 0) continue;
      if (fa > 0 && fb > 0) { seg(ax, ay, az, bx, by, bz); continue; }
      t = fa / (fa - fb); ex = ax + (bx - ax) * t; ey = ay + (by - ay) * t; ez = az + (bz - az) * t;
      if (fa > 0) seg(ax, ay, az, ex, ey, ez); else seg(bx, by, bz, ex, ey, ez);
    }
    dots(4.4); strokeC(LW.thin * 1.05, G1, 1); nodash();
    end();
  }
  reg('sliceCut', { draw: drawSliceCut, box: [1.08, 1.1], tags: ['volume', 'section', 'cut', 'plane'] }, 8);

  /* ================================================================== 12. layeredTrace */
  var LT_SHEETS = [
    { cx: -0.21, cy: -0.16, rot: -0.08, w: 0.59, h: 0.45, z: 0.0 }, { cx: 0.2, cy: -0.12, rot: 0.06, w: 0.59, h: 0.45, z: 0.045 },
    { cx: -0.17, cy: 0.17, rot: 0.05, w: 0.59, h: 0.45, z: 0.09 }, { cx: 0.22, cy: 0.16, rot: -0.07, w: 0.59, h: 0.45, z: 0.135 },
  ];
  function ltWobble(a, n, amp, r) {   // smooth hand tremor added to a point list
    var i, p1 = r.range(0, TAU), p2 = r.range(0, TAU), f1 = r.range(0.18, 0.3), f2 = r.range(0.4, 0.6);
    for (i = 0; i < n; i++) { a[2 * i] += amp * sin(i * f1 + p1); a[2 * i + 1] += amp * sin(i * f2 + p2); }
    return a;
  }
  function ltArc(cx, cy, rx, ry, a0, a1, drift, n, r, amp) {
    var a = new Float32Array(2 * n), i, q, ang, rr;
    for (i = 0; i < n; i++) { q = i / (n - 1); ang = a0 + (a1 - a0) * q; rr = 1 + drift * q; a[2 * i] = cx + cos(ang) * rx * rr; a[2 * i + 1] = cy + sin(ang) * ry * rr; }
    return ltWobble(a, n, amp, r);
  }
  function ltLine(x0, y0, x1, y1, bow, n, r, amp) {
    var a = new Float32Array(2 * n), i, q, dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1, bx = -dy / l * bow, by = dx / l * bow, b;
    for (i = 0; i < n; i++) { q = i / (n - 1); b = sin(PI * q); a[2 * i] = x0 + dx * q + bx * b; a[2 * i + 1] = y0 + dy * q + by * b; }
    return ltWobble(a, n, amp, r);
  }
  function ltSpiral(cx, cy, r0, r1, turns, a0, n, r, amp) {
    var a = new Float32Array(2 * n), i, q, ang, rr;
    for (i = 0; i < n; i++) { q = i / (n - 1); ang = a0 + TAU * turns * q; rr = r0 + (r1 - r0) * q; a[2 * i] = cx + cos(ang) * rr; a[2 * i + 1] = cy + sin(ang) * rr * 0.9; }
    return ltWobble(a, n, amp, r);
  }
  function ltBuild(seed) {
    var out = [], k, r, S, j;
    function st(a, kind, wd, col, t0, dur) { return { p: a, n: a.length >> 1, kind: kind, wd: wd, col: col, t0: t0, dur: dur, r: 0.01 }; }
    function dotS(x, y, rad, col, t0) { var a = new Float32Array(2); a[0] = x; a[1] = y; var s = st(a, 1, 1, col, t0, 0.04); s.r = rad; return s; }
    for (k = 0; k < 4; k++) {
      r = U.rng((seed | 0) * 7919 + k * 131 + 5); S = [];
      var t0 = 0.04 + 0.19 * k, amp = 0.0035, sg = r.sign();
      if (k === 0) {
        S.push(st(ltArc(-0.09 + r.range(-0.03, 0.03), r.range(-0.02, 0.02), 0.135, 0.135, -2.2 + r.range(-0.4, 0.4), -2.2 + TAU * 1.1, 0.05, 44, r, amp), 0, 0.9, 1, t0, 0.11));
        S.push(st(ltArc(0.12, -0.05, 0.055, 0.055, 0.6, 0.6 + TAU * 1.08, 0, 30, r, amp * 0.5), 0, 1.0, 0, t0 + 0.05, 0.06));
        S.push(st(ltLine(-0.26, 0.13, 0.26, -0.09, 0.02 * sg, 30, r, amp), 0, 0.6, 1, t0 + 0.09, 0.08));
        S.push(dotS(0.12, -0.05, 0.009, 0, t0 + 0.13));
      } else if (k === 1) {
        for (j = 0; j < 5; j++) S.push(st(ltLine(-0.24, 0.15, 0.25, -0.16 + 0.075 * j, (0.014 - 0.006 * j) * sg, 30, r, amp), 0, j % 2 ? 0.9 : 0.6, j % 2 ? 0 : 1, t0 + 0.035 * j, 0.06));
        S.push(dotS(0.25, -0.085, 0.011, 0, t0 + 0.2)); S.push(dotS(-0.24, 0.15, 0.009, 0, t0 + 0.22));
      } else if (k === 2) {
        S.push(st(ltSpiral(0.04, -0.01, 0.012, 0.15, 1.6, r.range(0, TAU), 52, r, amp * 0.6), 0, 1.0, 0, t0, 0.12));
        S.push(st(ltArc(-0.05, 0.2, 0.2, 0.2, PI + 0.2, PI * 2 - 0.15, 0, 34, r, amp), 0, 1.4, 2, t0 + 0.08, 0.08));
        S.push(st(ltLine(0.17, -0.15, 0.26, -0.14, 0, 8, r, 0.001), 0, 0.6, 1, t0 + 0.13, 0.03)); S.push(st(ltLine(0.17, -0.11, 0.26, -0.1, 0, 8, r, 0.001), 0, 0.6, 1, t0 + 0.15, 0.03));
      } else {
        S.push(st(ltArc(-0.04, 0.06, 0.19, 0.19, PI * 0.78, PI * 1.78, 0, 40, r, amp * 0.6), 0, 2.0, 0, t0, 0.1));
        S.push(st(ltArc(0.13, -0.09, 0.055, 0.055, 0.2, 0.2 + TAU * 1.05, 0, 30, r, amp * 0.5), 0, 0.9, 0, t0 + 0.06, 0.06));
        S.push(st(ltLine(-0.23, -0.14, 0.24, 0.14, 0.015 * sg, 30, r, amp), 0, 0.55, 2, t0 + 0.1, 0.08));
        S.push(dotS(-0.14, 0.0, 0.01, 0, t0 + 0.15)); S.push(dotS(0.2, 0.1, 0.008, 1, t0 + 0.17));
      }
      out.push(S);
    }
    return out;
  }
  function drawLayeredTrace(c, p) {
    var u = frac((+p.t || 0) / 9);
    begin(c, p, { tilt: -0.12, spin: 0.22, soft: 0.9, minN: 0.55, persp: 6, off: [0, 0] });
    var sheets = cached('lt' + ((p.seed | 0) % 6), function () { return ltBuild((p.seed | 0) % 6); });
    var k, j, i, sh, S, ea = 1 - s5((u - 0.86) / 0.1), cs, sn, rot, cx0, cy0, w2, h2, z, g, m, q, wk, col;
    function W(x, y) { P(cx0 + 0.85 * (x * cs - y * sn), cy0 + 0.85 * (x * sn + y * cs), z); }
    for (k = 0; k < 4; k++) {
      sh = LT_SHEETS[k]; rot = sh.rot + 0.02 * sin(TAU * u + k * 1.3); cs = cos(rot); sn = sin(rot);
      cx0 = sh.cx + 0.014 * sin(TAU * u + 1.7 * k); cy0 = sh.cy + 0.01 * cos(TAU * u + 1.1 * k); z = sh.z; w2 = sh.w / 2; h2 = sh.h / 2;
      // an opaque sheet of paper with a thin edge
      bp(); W(-w2, -h2); ctx.moveTo(X, Y); W(w2, -h2); ctx.lineTo(X, Y); W(w2, h2); ctx.lineTo(X, Y); W(-w2, h2); ctx.lineTo(X, Y); ctx.closePath(); fillPaper(1); strokeC(LW.thin * 1.05, G1, 1);
      S = sheets[k];
      for (j = 0; j < S.length; j++) {
        var s = S[j]; g = s5((u - s.t0) / s.dur); if (g < 0.002) continue;
        col = s.col === 0 ? INK : G1;                       // (ink strokes; no solid fills but the dots)
        if (s.kind === 1) {                                  // a dot that pops in with a little spring
          W(s.p[0], s.p[1]); bp(); ctx.arc(X, Y, s.r * 1.35 * SC * F * spr((u - s.t0) / s.dur), 0, TAU); fillC(col === INK ? G1 : col, ea); continue;
        }
        m = max(2, Math.ceil(g * (s.n - 1))); CN = 0;
        for (i = 0; i <= m; i++) {
          q = min(i, g * (s.n - 1)); var i0 = min(s.n - 2, floor(q)), f = q - i0;
          W(s.p[2 * i0] + (s.p[2 * i0 + 2] - s.p[2 * i0]) * f, s.p[2 * i0 + 1] + (s.p[2 * i0 + 3] - s.p[2 * i0 + 1]) * f); CX[CN] = X; CY[CN] = Y; CN++;
          WD[i] = LW.thin * 1.75 * s.wd * K * (0.3 + 0.7 * spw((clamp(q / (s.n - 1), 0, 1)), 0.5));
        }
        var tipx = CX[CN - 1], tipy = CY[CN - 1];
        bp(); ribbonOut(m + 1); fillC(col, ea * 0.95);
        if (g < 0.995) { bp(); ctx.arc(tipx, tipy, 0.0085 * SC * F, 0, TAU); fillC(G1, ea * sstep(0.0, 0.08, g)); }
      }
    }
    end();
  }
  reg('layeredTrace', { draw: drawLayeredTrace, box: [0.95, 0.75], tags: ['tracing', 'gesture', 'layers', 'sketch'] }, 9);

  /* ================================================================== 13. apertureLight: a grey plane cut by a wedge and a sliver; the light lands on a pale wall beside it as displaced shapes that slide */
  var AL_HX = new Float64Array(40), AL_HY = new Float64Array(40), AL_OUT = new Int16Array(40), AL_Q = new Float64Array(16), AL_NC = 2, ALX = 0, ALY = 0;
  function alCorner(k, i, ox, oy) { ALX = AL_Q[k * 8 + i * 2] + ox; ALY = AL_Q[k * 8 + i * 2 + 1] + oy; }
  function alPath(k, ox, oy, z) { var i; for (i = 0; i < 4; i++) { alCorner(k, i, ox, oy); if (i === 0) mv(ALX, ALY, z); else ln(ALX, ALY, z); } ctx.closePath(); }
  function drawApertureLight(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u;
    begin(c, p, { tilt: -0.08, spin: 0.46, soft: 0.6, minN: 0.5, persp: 6, scale: 0.8, off: [0, 0] });
    var ZB = -0.16, i, k, n, hn, a = 0.04 * sin(ph), b = 0.06 * sin(ph + 1.3), q = AL_Q;
    var dx = 0.5 + 0.08 * cos(ph + 0.4), dy = 0.07 * sin(ph + 1.0);
    // cut 0: a tall wedge that narrows towards its foot; cut 1: a low skewed sliver across the other way
    q[0] = -0.26 + a; q[1] = -0.36; q[2] = -0.04 + a; q[3] = -0.36; q[4] = 0.0 + b; q[5] = 0.32; q[6] = -0.05 + b; q[7] = 0.32;
    q[8] = -0.5; q[9] = 0.0 + 0.03 * sin(ph + 2.0); q[10] = -0.31; q[11] = -0.07 + 0.03 * sin(ph + 0.5); q[12] = -0.31; q[13] = 0.02 + 0.03 * sin(ph + 0.5); q[14] = -0.5; q[15] = 0.09 + 0.03 * sin(ph + 2.0);
    // the wall (one flat tint, opaque) beside the plane, and the shapes of light it receives (paper)
    bp(); rectPath(0.0, -0.44, 0.66, 0.44, ZB); fillC(G4, 1); strokeC(LW.thin, G1, 1);
    bp(); for (k = 0; k < AL_NC; k++) alPath(k, dx, dy, ZB); fillPaper(1); strokeC(LW.mid * 0.8, INK, 1);
    // shafts of light between every cut and its patch (dotted edges)
    for (k = 0; k < AL_NC; k++) {
      n = 0;
      for (i = 0; i < 4; i++) { alCorner(k, i, 0, 0); P(ALX, ALY, 0); AL_HX[n] = X; AL_HY[n] = Y; n++; }
      for (i = 0; i < 4; i++) { alCorner(k, i, dx, dy); P(ALX, ALY, ZB); AL_HX[n] = X; AL_HY[n] = Y; n++; }
      hn = hull2(AL_HX, AL_HY, n, AL_OUT);
      bp(); for (i = 0; i < hn; i++) { if (i === 0) ctx.moveTo(AL_HX[AL_OUT[i]], AL_HY[AL_OUT[i]]); else ctx.lineTo(AL_HX[AL_OUT[i]], AL_HY[AL_OUT[i]]); } ctx.closePath();
      dots(5); strokeC(LW.thin, G1, 1); nodash();
    }
    // the plane: flat grey with the cuts (even-odd) and a firm ink outline
    bp(); rectPath(-0.54, -0.44, 0.04, 0.44, 0); for (k = 0; k < AL_NC; k++) alPath(k, 0, 0, 0);
    fillEO(G3, 1); strokeC(LW.mid * 1.05, INK, 1);
    // the single accent: a small solid mark on the broad end of the wedge's patch
    P(mix(q[0], q[2], 0.5) + dx, -0.3 + dy, ZB); bp(); ctx.arc(X, Y, 0.017 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('apertureLight', { draw: drawApertureLight, box: [0.82, 0.92], tags: ['light', 'wedge', 'plane', 'shadow'] }, 8);

  /* ================================================================== extruded parts (cube, plate, wedge, cylinder, arch segment) */
  var PN = 40, P_AX = new Float64Array(PN), P_AY = new Float64Array(PN), P_BX = new Float64Array(PN), P_BY = new Float64Array(PN), P_AV = new Float64Array(PN * 3), P_BV = new Float64Array(PN * 3);
  var P_FV = new Uint8Array(PN), P_EV = new Uint8Array(PN), P_FD = new Float64Array(PN), P_FT = new Float64Array(PN), P_ORD = [];
  var LVX = -0.4534, LVY = -0.6549, LVZ = 0.6045;     // light direction in view space
  function makePart(pts, ex, ey, ez, sharp) {
    var n = pts.length / 3, i, j, cx = 0, cy = 0, cz = 0, el = Math.sqrt(ex * ex + ey * ey + ez * ez);
    var pt = { n: n, p: new Float64Array(pts), e: [ex, ey, ez], sharp: sharp, sn: new Float64Array(3 * n), na: [-ex / el, -ey / el, -ez / el], nb: [ex / el, ey / el, ez / el], nsharp: 0 };
    for (i = 0; i < n; i++) { cx += pts[3 * i]; cy += pts[3 * i + 1]; cz += pts[3 * i + 2]; if (sharp[i]) pt.nsharp++; }
    cx = cx / n + ex / 2; cy = cy / n + ey / 2; cz = cz / n + ez / 2;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      var dx = pts[3 * j] - pts[3 * i], dy = pts[3 * j + 1] - pts[3 * i + 1], dz = pts[3 * j + 2] - pts[3 * i + 2];
      var nx = dy * ez - dz * ey, ny = dz * ex - dx * ez, nz = dx * ey - dy * ex, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      var mx = (pts[3 * i] + pts[3 * j]) / 2 + ex / 2 - cx, my = (pts[3 * i + 1] + pts[3 * j + 1]) / 2 + ey / 2 - cy, mz = (pts[3 * i + 2] + pts[3 * j + 2]) / 2 + ez / 2 - cz;
      if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      pt.sn[3 * i] = nx; pt.sn[3 * i + 1] = ny; pt.sn[3 * i + 2] = nz;
    }
    return pt;
  }
  function pathProfile(xs, ys, n, sharp) {
    var s0 = -1, i, k, first = true;
    for (i = 0; i < n; i++) if (sharp[i]) { s0 = i; break; }
    if (s0 < 0) { curveArr(xs, ys, n, true, true); return; }
    i = s0;
    do {
      CN = 0; CX[CN] = xs[i]; CY[CN] = ys[i]; CN++; k = (i + 1) % n;
      while (true) { CX[CN] = xs[k]; CY[CN] = ys[k]; CN++; if (sharp[k]) break; k = (k + 1) % n; }
      curveArr(CX, CY, CN, false, first); first = false; i = k;
    } while (i !== s0);
    ctx.closePath(); CN = 0;
  }
  function ordCmp(a, b) { return P_FD[a] - P_FD[b]; }
  function toneOf(nx, ny, nz) { var t = 0.5 + 0.5 * (nx * LVX + ny * LVY + nz * LVZ); return t < 0 ? 0 : t > 1 ? 1 : t; }
  /** draw an extruded part at offset (ox,oy,oz) with yaw about its vertical axis and scale scl; pal = shading ramp, edge colour / weight / alpha, ga = overall alpha */
  function drawPart(pt, ox, oy, oz, yaw, scl, pal, edge, ew, ea, ga) {
    var n = pt.n, i, j, k, cy = cos(yaw), sy = sin(yaw), x, y, z, xr, zr, ex = pt.e[0] * scl, ey = pt.e[1] * scl, ez = pt.e[2] * scl;
    var cam = PERSP > 0, cxv, cyv, czv, nx, ny, nz, nvx, nvy, nvz, tx, ty, tz, vis;
    for (i = 0; i < n; i++) {
      x = pt.p[3 * i] * scl; y = pt.p[3 * i + 1] * scl; z = pt.p[3 * i + 2] * scl;
      xr = x * cy + z * sy; zr = -x * sy + z * cy; R(xr + ox, y + oy, zr + oz); P_AV[3 * i] = RX; P_AV[3 * i + 1] = RY; P_AV[3 * i + 2] = RZ; Pj(); P_AX[i] = X; P_AY[i] = Y;
      x += ex; y += ey; z += ez; xr = x * cy + z * sy; zr = -x * sy + z * cy; R(xr + ox, y + oy, zr + oz); P_BV[3 * i] = RX; P_BV[3 * i + 1] = RY; P_BV[3 * i + 2] = RZ; Pj(); P_BX[i] = X; P_BY[i] = Y;
    }
    // facets: visibility, tone, depth
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      cxv = (P_AV[3 * i] + P_AV[3 * j] + P_BV[3 * i] + P_BV[3 * j]) / 4; cyv = (P_AV[3 * i + 1] + P_AV[3 * j + 1] + P_BV[3 * i + 1] + P_BV[3 * j + 1]) / 4; czv = (P_AV[3 * i + 2] + P_AV[3 * j + 2] + P_BV[3 * i + 2] + P_BV[3 * j + 2]) / 4;
      nx = pt.sn[3 * i] * cy + pt.sn[3 * i + 2] * sy; ny = pt.sn[3 * i + 1]; nz = -pt.sn[3 * i] * sy + pt.sn[3 * i + 2] * cy;
      R(nx, ny, nz); nvx = RX; nvy = RY; nvz = RZ;
      tx = cam ? -cxv : 0; ty = cam ? -cyv : 0; tz = cam ? PERSP - czv : 1;
      P_FV[i] = nvx * tx + nvy * ty + nvz * tz > 0 ? 1 : 0; P_FT[i] = toneOf(nvx, nvy, nvz); P_FD[i] = czv;
    }
    // caps
    var capV = [0, 0], capT = [0, 0], q, arr, nn;
    for (q = 0; q < 2; q++) {
      arr = q === 0 ? P_AV : P_BV; cxv = 0; cyv = 0; czv = 0;
      for (i = 0; i < n; i++) { cxv += arr[3 * i]; cyv += arr[3 * i + 1]; czv += arr[3 * i + 2]; } cxv /= n; cyv /= n; czv /= n;
      nn = q === 0 ? pt.na : pt.nb; nx = nn[0] * cy + nn[2] * sy; ny = nn[1]; nz = -nn[0] * sy + nn[2] * cy; R(nx, ny, nz);
      tx = cam ? -cxv : 0; ty = cam ? -cyv : 0; tz = cam ? PERSP - czv : 1;
      capV[q] = RX * tx + RY * ty + RZ * tz > 0 ? 1 : 0; capT[q] = toneOf(RX, RY, RZ);
    }
    if (capV[0]) { bp(); pathProfile(P_AX, P_AY, n, pt.sharp); fillC(palC(pal, capT[0]), ga); }
    // visible facets, far to near
    var m = 0; P_ORD.length = 0;
    for (i = 0; i < n; i++) if (P_FV[i]) P_ORD.push(i);
    P_ORD.sort(ordCmp);
    for (k = 0; k < P_ORD.length; k++) {
      i = P_ORD[k]; j = (i + 1) % n;
      // smooth shading across curved facets: the facet is filled with a gradient between the tones of its two corner vertices (normals averaged over smooth vertices)
      var t0 = pt.sharp[i] ? P_FT[i] : (P_FT[i] + P_FT[(i + n - 1) % n]) / 2, t1 = pt.sharp[j] ? P_FT[i] : (P_FT[i] + P_FT[j]) / 2, col;
      if (t0 - t1 < 0.004 && t1 - t0 < 0.004) col = palC(pal, P_FT[i]);
      else if (!ctx.createLinearGradient) col = palC(pal, P_FT[i]);
      else { col = ctx.createLinearGradient(P_AX[i], P_AY[i], P_AX[j], P_AY[j]); col.addColorStop(0, palC(pal, t0)); col.addColorStop(1, palC(pal, t1)); }
      bp(); ctx.moveTo(P_AX[i], P_AY[i]); ctx.lineTo(P_AX[j], P_AY[j]); ctx.lineTo(P_BX[j], P_BY[j]); ctx.lineTo(P_BX[i], P_BY[i]); ctx.closePath();
      ctx.globalAlpha = A0 * CA * ga; ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = col; ctx.stroke();
    }
    if (capV[1]) { bp(); pathProfile(P_BX, P_BY, n, pt.sharp); fillC(palC(pal, capT[1]), ga); }
    // edges: cap outlines (smooth runs, broken at sharp corners) and the extrusion edges at corners / silhouettes
    bp();
    for (q = 0; q < 2; q++) {
      var xs = q === 0 ? P_AX : P_BX, ys = q === 0 ? P_AY : P_BY, allv = true, s0 = -1;
      for (i = 0; i < n; i++) { P_EV[i] = capV[q] || P_FV[i] ? 1 : 0; if (!P_EV[i]) allv = false; }
      if (allv && pt.nsharp === 0) { curveArr(xs, ys, n, true, true); continue; }
      for (i = 0; i < n; i++) if (!P_EV[(i + n - 1) % n] || pt.sharp[i]) { s0 = i; break; }
      if (s0 < 0) continue;
      i = s0; var cnt = 0;
      while (cnt < n) {
        if (!P_EV[i]) { i = (i + 1) % n; cnt++; continue; }
        CN = 0; CX[CN] = xs[i]; CY[CN] = ys[i]; CN++;
        while (P_EV[i] && cnt < n) { i = (i + 1) % n; cnt++; CX[CN] = xs[i]; CY[CN] = ys[i]; CN++; if (pt.sharp[i]) break; }
        curveArr(CX, CY, CN, false, true); CN = 0;
      }
    }
    for (i = 0; i < n; i++) {
      var fl = P_FV[(i + n - 1) % n], fr = P_FV[i];
      if ((pt.sharp[i] && (fl || fr)) || (fl !== fr)) { ctx.moveTo(P_AX[i], P_AY[i]); ctx.lineTo(P_BX[i], P_BY[i]); }
    }
    strokeC(ew, edge, ea * ga);
    // depth of the part (view space centre), for the caller's ordering
    return (P_AV[2] + P_BV[2]) / 2;
  }
  var KP = null;
  function buildKit() {
    var kit = {}, i, a, pts = [], sh = [], R0 = 0.075;
    function box(w, h, d) { return makePart([-w / 2, h / 2, -d / 2, w / 2, h / 2, -d / 2, w / 2, h / 2, d / 2, -w / 2, h / 2, d / 2], 0, -h, 0, [1, 1, 1, 1]); }
    kit.box = box(1, 1, 1); kit.plate = box(0.64, 0.04, 0.34); kit.cube = box(0.15, 0.15, 0.15); kit.slab = box(0.045, 0.3, 0.26); kit.bar = box(0.5, 0.035, 0.05);
    kit.wedge = makePart([-0.1, 0.05, -0.075, 0.1, 0.05, -0.075, -0.1, -0.05, -0.075], 0, 0, 0.15, [1, 1, 1]);
    for (i = 0; i < 28; i++) { a = i / 28 * TAU; pts.push(cos(a) * R0, 0.07, sin(a) * R0); sh.push(0); }
    kit.cyl = makePart(pts, 0, -0.14, 0, sh);
    pts = []; sh = []; var Ro = 0.15, Ri = 0.085, k;
    for (k = 0; k <= 8; k++) { a = PI / 2 * k / 8; pts.push(cos(a) * Ro - Ro / 2, -(sin(a) * Ro - Ro / 2), -0.05); sh.push(k === 0 || k === 8 ? 1 : 0); }
    for (k = 8; k >= 0; k--) { a = PI / 2 * k / 8; pts.push(cos(a) * Ri - Ro / 2, -(sin(a) * Ri - Ro / 2), -0.05); sh.push(k === 0 || k === 8 ? 1 : 0); }
    kit.arch = makePart(pts, 0, 0, 0.1, sh);
    return kit;
  }

  /* ================================================================== 15. spiralOrbit: one calligraphic spiral stroke that winds and relaxes */
  var SO_X = 0, SO_Y = 0;
  function soPoint(g, rot, turns, Ro, Ri) { var th = rot + TAU * turns * g, r = Ri * pow(Ro / Ri, g); SO_X = cos(th) * r; SO_Y = sin(th) * r * 0.92; }
  /** one tapered spiral stroke from g = ga to gb (0 = centre, 1 = outer end) */
  function soStroke(ga, gb, ph, rs, rot, turns, wmin, wmax, col, alpha) {
    var m = 84, i, g, q;
    CN = 0;
    for (i = 0; i <= m; i++) {
      g = ga + (gb - ga) * i / m; q = pow(i / m, 0.85);
      soPoint(g, rot + ph, turns, 0.6, 0.04); cp(SO_X * rs, SO_Y * rs, 0);
      WD[i] = K * (wmin + (wmax - wmin) * spw(q, 0.9));
    }
    bp(); ribbonOut(m + 1); fillC(col, alpha);
  }
  function drawSpiralOrbit(c, p) {
    var u = frac((+p.t || 0) / 9);
    begin(c, p, { tilt: -0.22, spin: 0.16 * sin(TAU * u + 1.0), soft: 0.6, minN: 0.5, persp: 6, off: [0, 0.0] });
    var turns = 2.3 + 0.25 * sin(TAU * u), rot = -TAU * u + 0.5;
    var g0 = 0.03 + 0.05 * (0.5 + 0.5 * sin(TAU * u + 1.0)), g1 = 0.935 + 0.065 * sin(TAU * u + 2.3);
    soStroke(g0 + 0.12, g1 - 0.04, 0.32, 1.0, rot, turns, 0, 0.07 * SC, G4, 1);                               // broad pale brush stroke (flat, hard edged)
    soStroke(g0, g1, PI, 0.9, rot, turns, 0.4, LW.thin * 1.25, G1, 0.95);                                  // thin echo, half a turn behind
    soStroke(g0, g1, 0.0, 1.0, rot, turns, 0.5, LW.bold * 1.9, INK, 1);                                    // the main stroke: thin - swelling - thin
    // the single small accent: the pen tip
    soPoint(g1, rot, turns, 0.6, 0.04); P(SO_X, SO_Y, 0); bp(); ctx.arc(X, Y, 0.0125 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('spiralOrbit', { draw: drawSpiralOrbit, box: [0.95, 0.9], tags: ['spiral', 'stroke', 'calligraphy', 'line'] }, 9);

  /* ================================================================== 16. kitOfParts: slab, bar, cube, plate and a black wedge exploded and re-assembled */
  var KIT_DEF = [   // assembled centre [x, y up, z], exploded offset, yaw at rest, yaw added when exploded, black?
    { k: 'plate', a: [0, 0.02, 0], d: [0, -0.06, 0], y0: 0, dy: 0, blk: 0 },
    { k: 'slab', a: [-0.24, 0.19, -0.02], d: [-0.12, 0.3, 0.1], y0: 0, dy: 0.6, blk: 0 },
    { k: 'bar', a: [0.05, 0.0595, 0.09], d: [0.1, 0.44, 0.1], y0: 0, dy: 0.9, blk: 0 },
    { k: 'cube', a: [0.17, 0.115, -0.03], d: [0.05, 0.24, -0.16], y0: 0.12, dy: 0.5, blk: 0 },
    { k: 'wedge', a: [-0.06, 0.09, -0.06], d: [0.0, 0.52, 0.05], y0: 0, dy: -0.65, blk: 1 },
  ];
  var KIT_ORD = [0, 1, 2, 3, 4], KIT_Z = new Float64Array(5), KIT_E = new Float64Array(5);
  function drawKitOfParts(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.5, spin: 0.55 + 0.25 * sin(TAU * u), soft: 0.6, persp: 6, off: [0, 0.0] });
    if (!KP) KP = buildKit();
    var i, j, d, e, ys = 0.28, ax, ay, az, bx, by, bz, part;
    for (i = 0; i < 5; i++) {
      d = KIT_DEF[i]; var uu = frac(u - 0.055 * i), sn = sin(PI * uu); e = sstep(0.1, 0.9, sn * sn); KIT_E[i] = e;
      ax = d.a[0]; ay = -d.a[1] + ys; az = d.a[2]; bx = ax + d.d[0] * e; by = -(d.a[1] + d.d[1] * e) + ys; bz = az + d.d[2] * e;
      R(bx, by, bz); KIT_Z[i] = RZ;
    }
    // dashed guides between the assembled and the exploded positions
    bp();
    for (i = 1; i < 5; i++) {
      d = KIT_DEF[i]; e = KIT_E[i]; if (e < 0.03) continue;
      P(d.a[0], -d.a[1] + ys, d.a[2]); ctx.moveTo(X, Y); P(d.a[0] + d.d[0] * e, -(d.a[1] + d.d[1] * e) + ys, d.a[2] + d.d[2] * e); ctx.lineTo(X, Y);
    }
    dash(4, 4); strokeC(LW.thin * 0.9, G1, 0.9); nodash();
    for (i = 1; i < 5; i++) { var v = KIT_ORD[i], zz = KIT_Z[v]; j = i - 1; while (j >= 0 && KIT_Z[KIT_ORD[j]] > zz) { KIT_ORD[j + 1] = KIT_ORD[j]; j--; } KIT_ORD[j + 1] = v; }
    for (i = 0; i < 5; i++) {
      j = KIT_ORD[i]; d = KIT_DEF[j]; e = KIT_E[j];
      part = d.k === 'plate' ? KP.plate : d.k === 'slab' ? KP.slab : d.k === 'bar' ? KP.bar : d.k === 'cube' ? KP.cube : KP.wedge;
      if (d.blk) drawPart(part, d.a[0] + d.d[0] * e, -(d.a[1] + d.d[1] * e) + ys, d.a[2] + d.d[2] * e, d.y0 + d.dy * e, 0.72, PAL_B, PAPER, LW.hair * 1.1, 0.4, 1);
      else drawPart(part, d.a[0] + d.d[0] * e, -(d.a[1] + d.d[1] * e) + ys, d.a[2] + d.d[2] * e, d.y0 + d.dy * e, 1, PAL_P, INK, LW.mid * 0.85, 1, 1);
    }
    end();
  }
  reg('kitOfParts', { draw: drawKitOfParts, box: [0.86, 0.73], tags: ['kit', 'parts', 'planes', 'explode'] }, 8);

  /* ================================================================== 17. onionContours: a whirl of rounded rectangles, each one smaller and turned a little further (the rotation step and the corner radius breathe) */
  var OC_N = 5, OC_P = new Float64Array(OC_N * 6), OC_PX = new Float64Array(OC_N), OC_PY = new Float64Array(OC_N), OC_HA = 0.4, OC_HB = 0.3;
  function ocShape(k) { var b = k * 6, sc = OC_P[b], ox = OC_P[b + 1], oy = OC_P[b + 2]; rrectPath(ox - OC_HA * sc, oy - OC_HB * sc, ox + OC_HA * sc, oy + OC_HB * sc, OC_P[b + 3], 0, OC_P[b + 4], ox, oy); }
  function drawOnionContours(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u;
    begin(c, p, { tilt: -0.08, spin: 0.12, soft: 0.8, minN: 0.6, persp: 6, off: [0, 0] });
    var N = OC_N, k, sc, rad = 0.07 + 0.09 * (0.5 + 0.5 * sin(ph));       // corner radius breathes
    var dth = 0.3 + 0.1 * sin(ph + 1.0), ratio = 0.8 - 0.02 * sin(ph + 2.0);   // rotation step and scale step
    for (k = 0; k < N; k++) {
      sc = pow(ratio, k); OC_P[k * 6] = sc; OC_P[k * 6 + 1] = 0.012 * k * cos(0.7); OC_P[k * 6 + 2] = 0.012 * k * sin(0.7); OC_P[k * 6 + 3] = rad * sc; OC_P[k * 6 + 4] = k * dth - 0.2 * sin(ph) - 0.15;
      P(OC_P[k * 6 + 1] + OC_HA * sc * cos(OC_P[k * 6 + 4]), OC_P[k * 6 + 2] + OC_HA * sc * sin(OC_P[k * 6 + 4]), 0); OC_PX[k] = X; OC_PY[k] = Y;    // a point on each outline (the accent rides the outer one)
    }
    // the outermost shape is an opaque paper plate (nothing from behind shows through)
    bp(); ocShape(0); fillPaper(1);
    // the travelling highlight: one flat tint between two neighbouring outlines
    var hpos = -1.8 + u * (N + 2.0), al;
    for (k = 0; k < N - 1; k++) {
      al = 1 - abs(k + 0.5 - hpos) / 1.6; if (al <= 0.01) continue;
      al = al * al * (3 - 2 * al);
      bp(); ocShape(k); ocShape(k + 1); fillEO(G3, 0.8 * al);
    }
    // outlines: one bold primary contour, the rest alternate between ink and grey (crisp, constant weight)
    for (k = N - 1; k >= 0; k--) {
      bp(); ocShape(k);
      if (k === 0) strokeC(LW.bold * 1.1, INK, 1); else if (k % 2 === 0) strokeC(LW.mid * 0.9, INK, 1); else strokeC(LW.thin * 1.05, G1, 1);
    }
    // the single accent: a small solid dot at the right-hand edge of the outer outline
    bp(); ctx.arc(OC_PX[0], OC_PY[0], 0.02 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('onionContours', { draw: drawOnionContours, box: [1.0, 0.9], tags: ['offset', 'rotation', 'nested', 'study', 'line'] }, 9);

  /* ================================================================== 18. offsetDiscs: translucent discs sliding over each other */
  var OD_N = 4;
  function drawOffsetDiscs(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.62, spin: 0.2 * sin(TAU * u + 0.5), soft: 0.5, persp: 5, off: [0, 0] });
    var k, ord = [0, 1, 2, 3], dz = [0, 0, 0, 0], x, y, z, rad, i;
    var DX = [], DY = [], DZ = [], DR = [];
    for (k = 0; k < OD_N; k++) {
      DX[k] = 0.16 * cos(TAU * u + k * 1.7 + 0.4) * (0.55 + 0.15 * k); DY[k] = 0.1 * sin(TAU * u * 2 + k * 2.3);
      DZ[k] = (k - 1.5) * 0.14; DR[k] = 0.26 + 0.035 * ((k * 5) % 4);
    }
    // each disc lies in a horizontal plane (xz), stacked along y, then viewed from above at a slant
    for (k = 0; k < OD_N; k++) { x = DX[k]; z = DY[k]; y = -(k - 1.5) * 0.15; R(x, y, z); dz[k] = RZ; }
    ord.sort(function (a, b) { return dz[a] - dz[b]; });
    for (i = 0; i < OD_N; i++) {
      k = ord[i]; x = DX[k]; z = DY[k]; y = -(k - 1.5) * 0.15; rad = DR[k];
      bp(); circ3(x, y, z, rad, 1, 0, 0, 0, 0, 1, 0, TAU, 40);
      fillC(k === 1 ? G4 : PAPER, 1); strokeC(k === 3 ? LW.bold * 0.95 : LW.mid * 0.85, INK, 1);
    }
    // the single accent: a black dot circling the rim of the top disc
    k = 3; x = DX[k]; z = DY[k]; y = -(k - 1.5) * 0.15; var a = TAU * (u + 0.06 * sin(TAU * u)) + 0.5;
    P(x + cos(a) * DR[k], y, z + sin(a) * DR[k]); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('offsetDiscs', { draw: drawOffsetDiscs, box: [0.95, 0.75], tags: ['disc', 'layers', 'plates', 'offset'] }, 8);

  /* ================================================================== 19. voidRing: a ring with a swelling line weight and one travelling dot */
  var VR_M = 72;
  function drawVoidRing(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.28 + 0.1 * sin(TAU * u), spin: 0.8 * sin(TAU * u + 0.3), soft: 0.5, persp: 4.2, off: [0, 0] });
    var m = VR_M, j, th, R0 = 0.37, x, y, z, i, ph = TAU * u;
    // faint outer arcs (two broken orbits)
    for (i = 0; i < 2; i++) {
      bp(); circ3(0, 0, 0, 0.5 + 0.04 * i, 1, 0, 0, 0, 1, 0, 0.7 + i * 2.6 + ph * (i ? -1 : 1) * 0.5, 2.2 + i * 2.6 + ph * (i ? -1 : 1) * 0.5, 14);
      strokeC(LW.thin * 0.9, G1, 0.8);
    }
    // opaque paper inside the ring, then the void: a pale annulus just inside it
    bp(); circ3(0, 0, 0, R0, 1, 0, 0, 0, 1, 0, 0, TAU, 40); fillPaper(1);
    bp(); circ3(0, 0, 0, R0, 1, 0, 0, 0, 1, 0, 0, TAU, 40); circ3(0, 0, 0, R0 * 0.78, 1, 0, 0, 0, 1, 0, 0, TAU, 40); fillEO(G4, 0.85);
    // the ring: closed calligraphic ribbon (near side swells)
    CN = 0;
    for (j = -2; j <= m + 2; j++) {
      th = TAU * j / m; R(R0 * cos(th), R0 * sin(th), 0); Pj(); CX[CN] = X; CY[CN] = Y;
      WD[CN] = K * LW.bold * (0.5 + 1.25 * (0.5 + 0.5 * cos(th - ph * 2 - 0.7))) * (0.82 + 0.4 * clamp(RZ / R0, -1, 1) * 0.5); CN++;
    }
    bp(); ribbonOut(m + 5); fillC(INK, 1);
    // a pale inner ring and a thin dotted one: the void
    bp(); circ3(0, 0, 0, R0 * 0.8, 1, 0, 0, 0, 1, 0, 0, TAU, 40); dots(5.4); strokeC(LW.thin * 0.9, G1, 0.9); nodash();
    // the travelling light dot with a short fading trail
    var a, tr;
    for (tr = 6; tr >= 0; tr--) {
      a = TAU * (u + 0.07 * sin(TAU * u)) * 1 - tr * 0.085 + 0.4;
      P(R0 * cos(a) * 0.8, R0 * sin(a) * 0.8, 0); bp(); ctx.arc(X, Y, (0.0165 - tr * 0.0017) * SC * F, 0, TAU);
      if (tr === 0) { fillPaper(1); strokeC(LW.mid, INK, 1); bp(); ctx.arc(X, Y, 0.009 * SC * DM * F, 0, TAU); fillC(INK, 1); }
      else fillC(G1, 0.55 * (1 - tr / 7));
    }
    end();
  }
  reg('voidRing', { draw: drawVoidRing, box: [1.05, 1.0], tags: ['ring', 'void', 'orbit', 'light'] }, 8);

  /* ================================================================== 20. dotDisc: a disc of dots whose size flows like a gradient */
  var DD_R = 8, DD_N = 0, DD_X, DD_Y, DD_T, DD_RHO;
  function buildDD() {
    var k, n, i, rho, cnt = 0, xs = [], ys = [], ts = [], rh = [];
    for (k = 1; k <= DD_R; k++) {
      rho = 0.06 + (k - 1) * 0.0615; n = Math.max(6, Math.round(TAU * rho / 0.064));
      for (i = 0; i < n; i++) { ts.push(TAU * i / n + k * 0.37); rh.push(rho); }
    }
    DD_N = ts.length; DD_T = Float32Array.from(ts); DD_RHO = Float32Array.from(rh); DD_X = new Float32Array(DD_N); DD_Y = new Float32Array(DD_N);
  }
  var DD_B = [], DD_BN = 5;
  function drawDotDisc(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.5, spin: 0.35 * sin(TAU * u + 1.0), soft: 0.5, persp: 5, off: [0, 0] });
    if (!DD_N) buildDD();
    var i, b, th, rho, g, rr, px, py, ph = TAU * u, sx, sy;
    for (b = 0; b < DD_BN; b++) { if (!DD_B[b]) DD_B[b] = []; DD_B[b].length = 0; }
    for (i = 0; i < DD_N; i++) {
      th = DD_T[i]; rho = DD_RHO[i];
      g = 0.5 + 0.5 * cos(th - ph) * (0.45 + 0.9 * rho) * 0.9 + 0.24 * sin(TAU * (rho * 2.0 - u));
      g = clamp(g, 0, 1);
      P(rho * cos(th), 0, rho * sin(th)); sx = X; sy = Y; rr = (0.0055 + 0.0135 * g * g) * SC * F;
      b = min(DD_BN - 1, floor(g * DD_BN));
      DD_B[b].push(sx, sy, rr);
    }
    for (b = 0; b < DD_BN; b++) {
      var arr = DD_B[b], n = arr.length; if (!n) continue;
      bp(); for (i = 0; i < n; i += 3) { ctx.moveTo(arr[i] + arr[i + 2], arr[i + 1]); ctx.arc(arr[i], arr[i + 1], arr[i + 2], 0, TAU); }
      fillC(INK, 0.38 + 0.62 * b / (DD_BN - 1));
    }
    // the single accent: a solid centre dot ringed by a thin circle
    P(0, 0, 0); bp(); ctx.arc(X, Y, 0.02 * SC * DM * F, 0, TAU); fillC(INK, 1);
    bp(); circ3(0, 0, 0, 0.55, 1, 0, 0, 0, 0, 1, 0, TAU, 40); dots(5.6); strokeC(LW.thin * 0.9, G1, 0.85); nodash();
    end();
  }
  reg('dotDisc', { draw: drawDotDisc, box: [1.1, 0.85], tags: ['dots', 'disc', 'gradient', 'halftone'] }, 8);

  /* ================================================================== 21. interlockArcs: a sheaf of calligraphic bands that fan out of a point, flow along an S-curve and converge again (never cross) */
  var IA_K = 7, IA_M = 64;
  function drawInterlockArcs(c, p) {
    var u = frac((+p.t || 0) / 9);
    begin(c, p, { tilt: -0.12, spin: 0.12 * sin(TAU * u + 0.4), soft: 0.6, persp: 6, off: [0, 0] });
    var K_ = IA_K, M = IA_M, k, i, s, a, sx, sy, dsy, tl, nx, ny, g, off, wd, lead, q, ph = TAU * u, cx_, cy_;
    var breath = 1 + 0.22 * sin(ph + 0.6);
    // pale broad band underneath (flat, hard-edged), then the calligraphic bands
    for (k = -1; k < K_; k++) {
      CN = 0;
      for (i = 0; i <= M; i++) {
        s = i / M; sx = (s - 0.5);
        a = TAU * 0.72 * s + 0.7 + 0.8 * sin(ph); sy = 0.15 * sin(a); dsy = 0.15 * TAU * 0.72 * cos(a);
        tl = sqrt(1 + dsy * dsy); nx = -dsy / tl; ny = 1 / tl;
        g = (0.012 + 0.105 * spw(s, 0.8)) * breath;                                    // the sheaf: closed at both ends, open in the middle
        off = k < 0 ? 0 : (k - (K_ - 1) / 2) / ((K_ - 1) / 2) * g * (1 + 0.16 * sin(TAU * (1.3 * s - u) + k * 1.1));
        P(sx + nx * off, sy + ny * off, 0); CX[CN] = X; CY[CN] = Y; CN++;
        q = spw(s, 0.75);
        if (k < 0) WD[i] = SC * 2 * g * 0.84;
        else WD[i] = K * (k === 3 ? LW.bold * 1.5 : k % 2 ? LW.thin * 1.15 : LW.mid * 0.9) * (0.1 + 0.9 * q) * (0.75 + 0.25 * sin(TAU * (2 * s + u) + k * 1.9));
      }
      bp(); ribbonOut(M + 1);
      fillC(k < 0 ? G4 : k === 3 ? INK : k % 2 ? G1 : INK, k < 0 ? 1 : 1);
    }
    // the single small accent rides the lead band
    s = 0.5 - 0.4 * cos(ph); sx = s - 0.5; a = TAU * 0.72 * s + 0.7 + 0.8 * sin(ph); sy = 0.15 * sin(a); dsy = 0.15 * TAU * 0.72 * cos(a); tl = sqrt(1 + dsy * dsy); nx = -dsy / tl; ny = 1 / tl;
    g = (0.012 + 0.105 * spw(s, 0.8)) * breath; off = -g * (1 + 0.16 * sin(TAU * (1.3 * s - u)));
    P(sx + nx * off, sy + ny * off, 0); bp(); ctx.arc(X, Y, 0.0155 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('interlockArcs', { draw: drawInterlockArcs, box: [1.0, 0.62], tags: ['bands', 'sheaf', 'ribbon', 'flow'] }, 9);

  /* ================================================================== 22. suspendedPlane: a plane hovering above its own soft shadow */
  function drawSuspendedPlane(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.5, spin: 0.35 + 0.2 * sin(TAU * u), soft: 0.5, persp: 5.5, off: [0, 0] });
    var hgt = 0.22 + 0.05 * sin(TAU * u), ax = 0.1 * sin(TAU * u + 1.0), az = 0.08 * cos(TAU * u), W2 = 0.39, D2 = 0.255, gy = 0.34, i, j, k;
    var sx = 0.02 * sin(TAU * u), sz = 0.02 * cos(TAU * u);
    function PL(x, z, inset) {      // point on the (tilted) plane, centre at height hgt
      var yy = -hgt - (x * sin(az) + z * sin(ax)) * 1.0; P(x * inset + sx, yy, z * inset + sz);
    }
    // the shadow on the floor: one flat, hard-edged tint ellipse (a little larger the higher the plane floats) and a thin contact line
    var sc = 1 + 0.8 * (hgt - 0.22);
    bp(); circ3(sx * 0.4, gy, sz * 0.4, 0.4 * sc, 1, 0, 0, 0, 0, 1, 0, TAU, 28); fillC(G4, 1); strokeC(LW.hair * 1.2, G1, 0.8);
    // the suspension line and its dot (the one accent)
    bp(); P(sx, -hgt, sz); ctx.moveTo(X, Y); P(sx, -0.52, sz); ctx.lineTo(X, Y); dots(4.6); strokeC(LW.thin * 0.95, G1, 0.9); nodash();
    // the plane itself (rounded rectangle through smooth curve points), an inset line
    for (j = 0; j < 2; j++) {
      var ins = j ? 0.84 : 1, n = 56, w = W2, d = D2, rr = 0.07;
      CN = 0;
      for (i = 0; i < n; i++) {
        var th = TAU * i / n, cc = cos(th), ss = sin(th), ex = 6, X0 = sign(cc) * pow(abs(cc), 2 / 4.5) * w, Z0 = sign(ss) * pow(abs(ss), 2 / 4.5) * d;     // superellipse = softly rounded rectangle
        PL(X0, Z0, ins); CX[CN] = X; CY[CN] = Y; CN++;
      }
      bp(); curveOut(true);
      if (j === 0) { fillPaper(1); strokeC(LW.mid, INK, 1); } else strokeC(LW.hair * 1.2, G1, 0.85);
    }
    P(sx, -0.52, sz); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  function sign(v) { return v < 0 ? -1 : 1; }
  reg('suspendedPlane', { draw: drawSuspendedPlane, box: [0.85, 0.95], tags: ['plane', 'shadow', 'suspended', 'void'] }, 8);

  /* ================================================================== NEW SET: how she iterates until it is solved, and how she thinks in space ================================================================== */
  var RP_X = new Float64Array(16), RP_Y = new Float64Array(16), RP_R = new Float64Array(16);
  function setRP(i, x, y, z) { P(x, y, z || 0); RP_X[i] = X; RP_Y[i] = Y; }
  /** closed polygon (RP_X / RP_Y, n points) with true circular corner arcs of radius RP_R[i] (screen units) */
  function roundPolyPath(n) {
    var i, j;
    ctx.moveTo((RP_X[n - 1] + RP_X[0]) / 2, (RP_Y[n - 1] + RP_Y[0]) / 2);
    for (i = 0; i < n; i++) { j = (i + 1) % n; ctx.arcTo(RP_X[i], RP_Y[i], (RP_X[i] + RP_X[j]) / 2, (RP_Y[i] + RP_Y[j]) / 2, RP_R[i] > 0.05 ? RP_R[i] : 0.05); }
    ctx.closePath();
  }

  /* ---- iterationChain: five revisions of one form; each earlier version is lighter, some are struck through, the last is bold and resolved */
  var IC_V = [
    [4, [-0.5, -0.28, 0.36, -0.5, 0.5, 0.3, -0.46, 0.5], [0, 0, 0, 0]],
    [4, [-0.5, -0.36, 0.42, -0.46, 0.5, 0.26, -0.5, 0.46], [0.012, 0.012, 0.02, 0.012]],
    [5, [-0.5, -0.3, 0.16, -0.46, 0.5, -0.12, 0.5, 0.32, -0.5, 0.46], [0.01, 0.02, 0.02, 0.015, 0.01]],
    [5, [-0.5, -0.34, 0.12, -0.44, 0.5, -0.2, 0.5, 0.34, -0.5, 0.44], [0.02, 0.04, 0.03, 0.02, 0.015]],
    [5, [-0.5, -0.36, 0.1, -0.42, 0.5, -0.22, 0.5, 0.38, -0.5, 0.42], [0.045, 0.065, 0.045, 0.02, 0.03]],
  ];
  function icCard(v, cx, cy, sc) {
    var n = v[0], q = v[1], r = v[2], i;
    for (i = 0; i < n; i++) { setRP(i, cx + q[2 * i] * 0.3 * sc, cy + q[2 * i + 1] * 0.26 * sc, 0); RP_R[i] = r[i] * SC * F * sc; }
    roundPolyPath(n);
  }
  function drawIterationChain(c, p) {
    var u = frac((+p.t || 0) / 10), fo = 1 - sstep(0.92, 1.0, u);
    begin(c, p, { tilt: -0.04, spin: 0.05, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    var k, a, ap, g, bold, cx, cy, sc, wgt, q, i, gc, m;
    for (k = 0; k < 5; k++) {
      a = 0.03 + 0.14 * k; ap = spr((u - a) / 0.1); if (ap <= 0.004) continue; if (ap > 1) ap = 1;
      cx = -0.36 + 0.18 * k; cy = 0.135 - 0.07 * k; sc = 0.88 + 0.12 * ap;
      g = k < 4 ? sstep(a + 0.14, a + 0.22, u) : 0; bold = k === 4 ? sstep(a + 0.08, a + 0.22, u) : 0;
      CA = ap * fo;
      bp(); icCard(IC_V[k], cx, cy, sc); fillPaper(1);
      if (bold > 0.01) fillC(G4, 0.9 * bold);
      wgt = k === 4 ? mix(LW.mid, LW.bold * 1.05, bold) : mix(LW.mid * 1.05, LW.thin * 0.9, g);
      if (g < 0.99) strokeC(wgt, INK, 1 - g);
      if (g > 0.01) strokeC(wgt, G1, g);
      if (k === 0 || k === 2) {                                           // struck through with one quick confident stroke
        gc = s5((u - (a + 0.2)) / 0.05);
        if (gc > 0.01) {
          CN = 0; m = 14;
          for (i = 0; i <= m; i++) { q = i / m * gc; P(cx + (-0.46 + 0.5 * q) * 0.3 * sc, cy + (0.42 - 0.8 * q + 0.07 * sin(PI * q)) * 0.26 * sc, 0); CX[CN] = X; CY[CN] = Y; WD[i] = K * LW.mid * 1.1 * (0.2 + 0.8 * spw(q, 0.8)); CN++; }
          bp(); ribbonOut(m + 1); fillC(INK, 0.9);
        }
      }
      if (k === 4 && bold > 0.01) {                                       // the resolved version: an offset inner line and one quiet dot
        bp(); icCard(IC_V[4], cx, cy, sc * 0.8); strokeC(LW.thin * 0.85, G1, bold);
        setRP(0, cx + 0.1 * 0.3 * sc, cy - 0.42 * 0.26 * sc, 0); bp(); ctx.arc(RP_X[0], RP_Y[0], 0.0165 * SC * DM * F, 0, TAU); fillC(INK, bold);
      }
    }
    end();
  }
  reg('iterationChain', { draw: drawIterationChain, box: [1.02, 0.54], tags: ['iteration', 'revision', 'versions', 'solved'] }, 10);

  /* ---- revisedCurve: one line drawn five times, every pass corrected a little, converging on the final bold stroke */
  var RC_N = 56, RC_SX = [], RC_SY = [];
  (function () { for (var k = 0; k < 5; k++) { RC_SX.push(new Float64Array(RC_N + 1)); RC_SY.push(new Float64Array(RC_N + 1)); } })();
  var RC_A = [0.15, 0.1, 0.06, 0.03, 0], RC_CF = [0.9, 1.4, 1.1, 1.8, 1], RC_PH = [0.3, 2.0, 4.1, 1.2, 0], RC_XC = [-0.3, 0.06, 0.3, -0.12];
  function rcLoad(k, m, frac1) {      // copy the first m points (+ an interpolated tip at fraction frac1 of the last segment) to CX / CY
    var i;
    CN = 0;
    for (i = 0; i < m; i++) { CX[CN] = RC_SX[k][i]; CY[CN] = RC_SY[k][i]; CN++; }
    CX[CN] = RC_SX[k][m - 1] + (RC_SX[k][m] - RC_SX[k][m - 1]) * frac1; CY[CN] = RC_SY[k][m - 1] + (RC_SY[k][m] - RC_SY[k][m - 1]) * frac1; CN++;
  }
  function drawRevisedCurve(c, p) {
    var u = frac((+p.t || 0) / 9), fo = 1 - sstep(0.92, 1.0, u);
    begin(c, p, { tilt: -0.04, spin: 0.04, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    var N = RC_N, k, i, x, y, t0, prog, g, m, fr, s, ic, ya, yb, pr1, tx, ty;
    for (k = 0; k < 5; k++) {
      for (i = 0; i <= N; i++) {
        x = -0.5 + i / N;
        y = 0.16 * sin(TAU * 0.78 * (x + 0.5) + 0.6) + 0.02 * x + RC_A[k] * sin(TAU * RC_CF[k] * (x + 0.5) + RC_PH[k]) * (0.4 + 0.6 * spw(x + 0.5, 0.6));
        P(x, y, 0); RC_SX[k][i] = X; RC_SY[k][i] = Y;
      }
    }
    CA = fo;
    // an opaque paper band under the final line (nothing from behind shows through)
    CN = 0; for (i = 0; i <= N; i++) { CX[CN] = RC_SX[4][i]; CY[CN] = RC_SY[4][i]; WD[i] = 0.46 * SC * (0.35 + 0.65 * spw(i / N, 0.5)); CN++; }
    bp(); ribbonOut(N + 1); fillPaper(1);
    for (k = 0; k < 5; k++) {
      t0 = 0.03 + 0.16 * k; prog = s5((u - t0) / 0.15); if (prog <= 0.002) continue;
      g = k < 4 ? sstep(t0 + 0.16, t0 + 0.27, u) : 0;
      s = prog * N; m = min(N, floor(s)); if (m < 1) m = 1; fr = m >= N ? 1 : s - m + 1; if (fr > 1) fr = 1;
      rcLoad(k, m, fr); tx = CX[CN - 1]; ty = CY[CN - 1];
      if (k < 4) { bp(); curveOut(false, true); strokeC(LW.thin * (1 - 0.35 * g), G1, 1 - 0.55 * g); }
      else {
        for (i = 0; i < CN; i++) WD[i] = K * LW.bold * 1.3 * (0.25 + 0.75 * spw(min(1, i / N), 0.7));
        bp(); ribbonOut(CN); fillC(INK, 1);
      }
      if (prog < 0.995) { bp(); ctx.arc(tx, ty, 0.0115 * SC * DM, 0, TAU); fillC(INK, 1); }
    }
    // the corrections: a short dotted connector wherever the next pass moved the line
    for (k = 0; k < 4; k++) {
      ic = Math.round((RC_XC[k] + 0.5) * N); pr1 = s5((u - (0.03 + 0.16 * (k + 1))) / 0.15);
      s = s5((pr1 - (RC_XC[k] + 0.5)) / 0.06); if (s < 0.01) continue;
      ya = RC_SY[k][ic]; yb = RC_SY[k + 1][ic]; if (abs(ya - yb) < 2) continue;
      bp(); ctx.moveTo(RC_SX[k][ic], ya); ctx.lineTo(RC_SX[k + 1][ic], yb); dots(4.2); strokeC(LW.thin * 0.95, INK, s * (1 - 0.5 * sstep(0.8, 0.9, u))); nodash();
    }
    end();
  }
  reg('revisedCurve', { draw: drawRevisedCurve, box: [1.16, 0.7], tags: ['curve', 'revision', 'passes', 'line'] }, 9);

  /* ---- tryAgainFold: a sheet folded three times in sequence (real 3D), with the earlier states left behind as dotted ghosts; it folds, then unfolds */
  var TF = null, TF_PX = new Float64Array(16 * 20), TF_PY = new Float64Array(16 * 20), TF_PN = new Int16Array(16), TF_PD = new Float64Array(16), TF_PF = new Uint8Array(16), TF_ORD = [];
  function tfClip(pts, ax, az, nx, nz, sign) {
    var out = [], n = pts.length / 2, i, j, px, pz, qx, qz, da, db, t;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n; px = pts[2 * i]; pz = pts[2 * i + 1]; qx = pts[2 * j]; qz = pts[2 * j + 1];
      da = sign * ((px - ax) * nx + (pz - az) * nz); db = sign * ((qx - ax) * nx + (qz - az) * nz);
      if (da >= 0) out.push(px, pz);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { t = da / (da - db); out.push(px + (qx - px) * t, pz + (qz - pz) * t); }
    }
    return out;
  }
  function tfBuild() {
    var layers = [{ p: [-0.36, -0.25, 0.36, -0.25, 0.36, 0.25, -0.36, 0.25], z: 0, flip: false }];
    var o = { states: [layers], stat: [], mov: [], nrm: [] }, f, F, dl, dx, dz, nx, nz, sref, i, j, L, neg, pos, stat, mov, zTop, next, pts, s;
    var FOLDS = [[0.1, -0.25, 0.45, 1.0, 0.36, -0.25], [-0.12, -0.25, -0.1, 1.0, -0.36, 0.0], [-0.36, 0.08, 1.0, 0.06, 0.0, 0.25]];
    for (f = 0; f < 3; f++) {
      F = FOLDS[f]; dl = Math.sqrt(F[2] * F[2] + F[3] * F[3]); dx = F[2] / dl; dz = F[3] / dl; nx = -dz; nz = dx;
      sref = (F[4] - F[0]) * nx + (F[5] - F[1]) * nz; if (sref < 0) { nx = -nx; nz = -nz; }
      stat = []; mov = []; zTop = 0;
      for (i = 0; i < layers.length; i++) {
        L = layers[i]; neg = tfClip(L.p, F[0], F[1], nx, nz, -1); pos = tfClip(L.p, F[0], F[1], nx, nz, 1);
        if (neg.length >= 6) { stat.push({ p: neg, z: L.z, flip: L.flip }); if (L.z > zTop) zTop = L.z; }
        if (pos.length >= 6) { mov.push({ p: pos, z: L.z, flip: L.flip, zn: 0 }); if (L.z > zTop) zTop = L.z; }
      }
      mov.sort(function (a, b) { return b.z - a.z; });
      next = stat.slice();
      for (i = 0; i < mov.length; i++) {
        mov[i].zn = zTop + 0.016 * (i + 1); pts = [];
        for (j = 0; j < mov[i].p.length; j += 2) { s = (mov[i].p[j] - F[0]) * nx + (mov[i].p[j + 1] - F[1]) * nz; pts.push(mov[i].p[j] - 2 * s * nx, mov[i].p[j + 1] - 2 * s * nz); }
        next.push({ p: pts, z: mov[i].zn, flip: !mov[i].flip });
      }
      o.stat.push(stat); o.mov.push(mov); o.nrm.push([F[0], F[1], dx, dz, nx, nz]); o.states.push(next); layers = next;
    }
    return o;
  }
  function tfCmp(a, b) { return TF_PD[a] - TF_PD[b]; }
  function drawTryAgainFold(c, p) {
    var u = frac((+p.t || 0) / 10), v = 0.5 - 0.5 * cos(TAU * u), tau = 3 * sstep(0.1, 0.9, v), n = floor(tau), f = tau - n;
    var i, j, k, L, th = 0, cs, sn, np = 0, st, mvs, nr, ax, az, dx, dz, nx, nz, s, t, h, px, pz, base, cnt, sx, sy, any;
    if (n >= 3) { n = 3; f = 0; }
    begin(c, p, { tilt: -0.78, spin: 0.5 + 0.12 * sin(TAU * u), soft: 0.5, persp: 6, off: [0, 0] });
    if (!TF) TF = tfBuild();
    function add(pts, z, flip, rot) {      // project one piece; rot = fold line info or null
      var q, m = pts.length / 2, o = np * 20, zd = 0;
      for (q = 0; q < m; q++) {
        if (rot) {
          s = (pts[2 * q] - ax) * nx + (pts[2 * q + 1] - az) * nz; t = (pts[2 * q] - ax) * dx + (pts[2 * q + 1] - az) * dz;
          px = ax + dx * t + nx * s * cs; pz = az + dz * t + nz * s * cs; h = z + (rot.zn - z) * (th / PI) + s * sn;
        } else { px = pts[2 * q]; pz = pts[2 * q + 1]; h = z; }
        P(px, -h, pz); TF_PX[o + q] = X; TF_PY[o + q] = Y; zd += Z;
      }
      TF_PN[np] = m; TF_PD[np] = zd / m; TF_PF[np] = flip ? 1 : 0; np++;
    }
    // ghost history: the earlier states stay behind as dotted outlines
    bp();
    for (k = 0; k <= (n > 0 ? n - 1 : 0); k++) {
      if (k === 0 && n === 0 && f < 0.02) break;
      if (k !== 0 && k !== n - 1) continue;
      for (i = 0; i < TF.states[k].length; i++) {
        L = TF.states[k][i];
        for (j = 0; j < L.p.length; j += 2) { P(L.p[j], -0.002, L.p[j + 1]); if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
        ctx.closePath();
      }
    }
    dots(4.6); strokeC(LW.thin * 0.95, G1, 1); nodash();
    if (f < 1e-4) {
      for (i = 0; i < TF.states[n].length; i++) { L = TF.states[n][i]; add(L.p, L.z, L.flip, null); }
    } else {
      st = TF.stat[n]; mvs = TF.mov[n]; nr = TF.nrm[n]; ax = nr[0]; az = nr[1]; dx = nr[2]; dz = nr[3]; nx = nr[4]; nz = nr[5];
      th = PI * eio(f); cs = cos(th); sn = sin(th);
      for (i = 0; i < st.length; i++) add(st[i].p, st[i].z, st[i].flip, null);
      for (i = 0; i < mvs.length; i++) add(mvs[i].p, mvs[i].z, mvs[i].flip !== (th > PI / 2), mvs[i]);
    }
    TF_ORD.length = 0; for (i = 0; i < np; i++) TF_ORD.push(i);
    TF_ORD.sort(tfCmp);
    for (k = 0; k < np; k++) {
      i = TF_ORD[k]; base = i * 20; cnt = TF_PN[i];
      bp(); for (j = 0; j < cnt; j++) { if (j === 0) ctx.moveTo(TF_PX[base], TF_PY[base]); else ctx.lineTo(TF_PX[base + j], TF_PY[base + j]); } ctx.closePath();
      fillC(TF_PF[i] ? G4 : PAPER, 1); strokeC(LW.mid * 0.85, INK, 1);
    }
    // the single accent rides the top-most layer
    if (np) {
      i = TF_ORD[np - 1]; base = i * 20; cnt = TF_PN[i]; sx = 0; sy = 0;
      for (j = 0; j < cnt; j++) { sx += TF_PX[base + j]; sy += TF_PY[base + j]; }
      bp(); ctx.arc(sx / cnt, sy / cnt, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    }
    end();
  }
  reg('tryAgainFold', { draw: drawTryAgainFold, box: [0.9, 0.64], tags: ['fold', 'sheet', 'history', 'iteration'] }, 10);

  /* ---- solvedMark: scattered earlier attempts (a quarter disc and a standing slab) settle into one resolved composition (a quiet guide arc, one tiny dot) and relax again */
  var SM_G = [[0.3, 0.0, -0.05, -0.05, -0.25, 0.28, 0.38, 0.14, 0.25], [0.5, PI, 0.1, 0.15, 0.35, 0.25, 0.34, 0.08, -0.2], [0.36, -PI / 2 + 0.5, -0.1, 0.1, 0.1, 0.3, 0.56, 0.1, 0.1]];   // R, rot, cx, cy, slab x, slab bottom, slab h, slab w, lean
  var SM_F = [0.42, -PI / 2, -0.22, 0.2, 0.29, 0.2, 0.5, 0.09, 0.0], SM_T = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  function smQuarter(R, rot, cx, cy) {
    var k = 0.5523, a0 = rot, a1 = rot + PI / 2, c0 = cos(a0), s0 = sin(a0), c1 = cos(a1), s1 = sin(a1), ax, ay, bx, by;
    P(cx, cy, 0); ctx.moveTo(X, Y);
    P(cx + R * c0, cy + R * s0, 0); ctx.lineTo(X, Y);
    P(cx + R * c0 - k * R * s0, cy + R * s0 + k * R * c0, 0); ax = X; ay = Y;
    P(cx + R * c1 + k * R * s1, cy + R * s1 - k * R * c1, 0); bx = X; by = Y;
    P(cx + R * c1, cy + R * s1, 0); ctx.bezierCurveTo(ax, ay, bx, by, X, Y);
    ctx.closePath();
  }
  function smSlab(x, bot, h, w, lean) {
    var i, qx = [-w / 2, w / 2, w / 2, -w / 2], qy = [0, 0, -h, -h], cl = cos(lean), sl = sin(lean);
    for (i = 0; i < 4; i++) { P(x + qx[i] * cl - qy[i] * sl, bot + qx[i] * sl + qy[i] * cl, 0); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    ctx.closePath();
  }
  function drawSolvedMark(c, p) {
    var u = frac((+p.t || 0) / 8);
    begin(c, p, { tilt: -0.05, spin: 0.06, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    var settle = clamp(spr((u - 0.08) / 0.4), 0, 1) * (1 - clamp(spr((u - 0.8) / 0.2), 0, 1)), k, G, T9 = SM_T, F9 = SM_F, i, breath = 1 + 0.01 * sin(TAU * u * 2), ang;
    // earlier attempts converge into the final composition
    for (k = 0; k < 3; k++) {
      G = SM_G[k];
      for (i = 0; i < 9; i++) T9[i] = i === 1 ? lerpAng(G[1], F9[1], settle) : mix(G[i], F9[i], settle);
      CA = 1 - 0.8 * settle * settle;
      bp(); smSlab(T9[4], T9[5], T9[6], T9[7], T9[8]); fillPaper(1); strokeC(LW.thin, G1, 1);
      bp(); smQuarter(T9[0], T9[1], T9[2], T9[3]); fillPaper(1); strokeC(LW.thin, G1, 1);
    }
    CA = 1;
    // the final composition: a flat tint offset behind the quarter disc, the slab, the disc (outline growing from a draft weight to a firm one)
    bp(); smQuarter(F9[0] * breath, F9[1], F9[2] + 0.03, F9[3] + 0.03); fillC(G4, settle);
    bp(); smSlab(F9[4], F9[5], F9[6] * breath, F9[7], F9[8]); fillC(G4, 1); strokeC(mix(LW.thin, LW.mid, settle), INK, 1);
    bp(); smQuarter(F9[0] * breath, F9[1], F9[2], F9[3]); fillPaper(1); strokeC(mix(LW.mid, LW.bold * 1.05, settle), INK, 1);
    // a quiet guide arc just outside, dotted
    bp(); circ3(F9[2], F9[3], 0, F9[0] + 0.055, 1, 0, 0, 0, 1, 0, F9[1], F9[1] + PI / 2, 20); dots(5); strokeC(LW.thin * 0.9, G1, settle); nodash();
    // one tiny quiet dot on the arc
    ang = F9[1] + PI / 4; P(F9[2] + F9[0] * cos(ang), F9[3] + F9[0] * sin(ang), 0); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F * settle, 0, TAU); fillC(INK, settle);
    end();
  }
  reg('solvedMark', { draw: drawSolvedMark, box: [0.82, 0.7], tags: ['resolved', 'composition', 'settle', 'iteration'] }, 8);

  /* ---- rotatingVolume: a wire cube turning one way with a flat slab turning the other way inside it, hidden lines ghosted */
  var RV_E = [], RV_VV = new Float64Array(24), RV_SS = new Float64Array(16), RV_FV = new Float64Array(6);
  (function () {
    var a, i, j, fa, fb;
    for (a = 0; a < 3; a++) for (i = 0; i < 8; i++) {
      if (i & (1 << a)) continue; j = i | (1 << a);
      if (a === 0) { fa = (i & 2) ? 2 : 3; fb = (i & 4) ? 4 : 5; } else if (a === 1) { fa = (i & 1) ? 0 : 1; fb = (i & 4) ? 4 : 5; } else { fa = (i & 1) ? 0 : 1; fb = (i & 2) ? 2 : 3; }
      RV_E.push([i, j, fa, fb]);
    }
  })();
  function rvPrep(hx, hy, hz, ang, oy) {
    var ca = cos(ang), sa = sin(ang), i, x, y, z, xr, zr, f, nn, nx, nz, cx, cy, cz, tl;
    for (i = 0; i < 8; i++) {
      x = (i & 1) ? hx : -hx; y = ((i & 2) ? hy : -hy) + oy; z = (i & 4) ? hz : -hz; xr = x * ca + z * sa; zr = -x * sa + z * ca;
      R(xr, y, zr); RV_VV[3 * i] = RX; RV_VV[3 * i + 1] = RY; RV_VV[3 * i + 2] = RZ;
      f = PERSP / (PERSP - RZ); RV_SS[2 * i] = RX * f * SC + OFX; RV_SS[2 * i + 1] = RY * f * SC + OFY;
    }
    for (f = 0; f < 6; f++) {
      nn = SCN[f]; nx = nn[0] * ca + nn[2] * sa; nz = -nn[0] * sa + nn[2] * ca; R(nx, nn[1], nz); var vx = RX, vy = RY, vz = RZ;
      x = nn[0] * hx; y = nn[1] * hy + oy; z = nn[2] * hz; xr = x * ca + z * sa; zr = -x * sa + z * ca; R(xr, y, zr); cx = RX; cy = RY; cz = RZ;
      tl = Math.sqrt(cx * cx + cy * cy + (PERSP - cz) * (PERSP - cz));
      RV_FV[f] = (vx * -cx + vy * -cy + vz * (PERSP - cz)) / tl;
    }
  }
  function rvEdges(visible, wgt, col, a) {
    var e, w, i0, i1, wv;
    for (e = 0; e < 12; e++) {
      i0 = RV_E[e][0]; i1 = RV_E[e][1];
      wv = max(sstep(-0.03, 0.03, RV_FV[RV_E[e][2]]), sstep(-0.03, 0.03, RV_FV[RV_E[e][3]]));
      w = visible ? wv : 1 - wv; if (w < 0.01) continue;
      bp(); ctx.moveTo(RV_SS[2 * i0], RV_SS[2 * i0 + 1]); ctx.lineTo(RV_SS[2 * i1], RV_SS[2 * i1 + 1]);
      if (!visible) dash(4.6, 4.6);
      strokeC(wgt, col, a * w); if (!visible) nodash();
    }
  }
  function drawRotatingVolume(c, p) {
    var u = frac((+p.t || 0) / 12);
    begin(c, p, { tilt: -0.55, spin: 0.3, soft: 0.5, persp: 8, off: [0, 0] });
    var f, q, i, k;
    // outer cube: its hidden edges first (ghosts)
    rvPrep(0.22, 0.22, 0.22, PI / 2 * u, 0); rvEdges(false, LW.hair * 1.2, G1, 0.8);
    // the inner slab (opaque faces hide the ghosts behind it)
    rvPrep(0.16, 0.05, 0.1, -PI * u + 0.5, 0.0);
    for (f = 0; f < 6; f++) {
      if (RV_FV[f] < 0.01) continue; q = SCF[f];
      bp(); for (i = 0; i < 4; i++) { if (i === 0) ctx.moveTo(RV_SS[2 * q[i]], RV_SS[2 * q[i] + 1]); else ctx.lineTo(RV_SS[2 * q[i]], RV_SS[2 * q[i] + 1]); } ctx.closePath();
      fillC(f === 3 ? G4 : PAPER, 1);
    }
    rvEdges(false, LW.hair * 1.2, G1, 0.9); rvEdges(true, LW.mid * 0.95, INK, 1);
    // the outer cube's visible edges, on top
    rvPrep(0.22, 0.22, 0.22, PI / 2 * u, 0); rvEdges(true, LW.thin * 1.05, INK, 0.9);
    // the single accent: a dot at the centre of the slab's top face
    rvPrep(0.16, 0.05, 0.1, -PI * u + 0.5, 0.0);
    bp(); ctx.arc((RV_SS[0] + RV_SS[2] + RV_SS[8] + RV_SS[10]) / 4, (RV_SS[1] + RV_SS[3] + RV_SS[9] + RV_SS[11]) / 4, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('rotatingVolume', { draw: drawRotatingVolume, box: [0.64, 0.72], tags: ['wire', 'cube', 'rotation', 'volume'] }, 12);

  /* ---- stackShift: four slabs stacked with a gap; they slide against each other in turn, leaving dotted ghosts of earlier positions */
  var SS_W = [0.5, 0.36, 0.44, 0.2], SS_D = [0.24, 0.24, 0.2, 0.16], SS_H = [0.07, 0.07, 0.07, 0.035], SS_B = [-0.27, -0.1, 0.07, 0.23], SS_A = [0.05, 0.2, -0.22, 0.16], SS_Z = [0.0, -0.04, 0.04, -0.03];
  function ssWave(v) { return Math.tanh(2.2 * sin(TAU * v)) / 0.9757; }
  function drawStackShift(c, p) {
    var u = frac((+p.t || 0) / 9), i, g, lag, x, z, a, x0, x1, z0, z1, y0, y1, dxg;
    begin(c, p, { tilt: -0.3, spin: 0.7, soft: 0.5, persp: 8, off: [0, 0] });
    BV[0] = M[6]; BV[1] = M[7]; BV[2] = M[8];
    // the floor line the stack hovers over: a short dotted base
    bp(); mv(-0.46, 0.34, -0.2); ln(0.46, 0.34, -0.2); ln(0.46, 0.34, 0.3); ln(-0.46, 0.34, 0.3); ctx.closePath(); dots(5.4); strokeC(LW.thin * 0.9, G1, 0.8); nodash();
    for (i = 0; i < 4; i++) {
      x = SS_A[i] * ssWave(u - 0.11 * i); z = SS_Z[i] * ssWave(u - 0.11 * i + 0.25);
      y0 = -(SS_B[i] + SS_H[i]); y1 = -SS_B[i];
      for (g = 2; g >= 1; g--) {      // ghosts of the earlier positions: dotted top outline, fading
        lag = 0.05 * g; dxg = SS_A[i] * ssWave(u - lag - 0.11 * i);
        a = sstep(0.012, 0.06, abs(dxg - x)); if (a < 0.02) continue;
        x0 = dxg - SS_W[i] / 2; x1 = dxg + SS_W[i] / 2; z0 = SS_Z[i] * ssWave(u - lag - 0.11 * i + 0.25) - SS_D[i] / 2; z1 = z0 + SS_D[i];
        bp(); mv(x0, y0, z0); ln(x1, y0, z0); ln(x1, y0, z1); ln(x0, y0, z1); ctx.closePath(); dots(4.6); strokeC(LW.thin * 0.95, G1, a * (g === 1 ? 0.95 : 0.55)); nodash();
      }
      x0 = x - SS_W[i] / 2; x1 = x + SS_W[i] / 2; z0 = z - SS_D[i] / 2; z1 = z + SS_D[i] / 2;
      if (i === 3) boxVisible(x0, y0, z0, x1, y1, z1, INK, INK, INK, INK, LW.thin, 1, 1);
      else boxVisible(x0, y0, z0, x1, y1, z1, i === 1 ? G4 : PAPER, i === 1 ? G4 : PAPER, i === 1 ? G4 : PAPER, INK, LW.mid * 0.85, 1, 1);
    }
    end();
  }
  reg('stackShift', { draw: drawStackShift, box: [1.03, 0.84], tags: ['stack', 'slide', 'slabs', 'offset'] }, 9);

  /* ---- depthLayers: six opaque planes receding in strong perspective, each cut by a turned aperture; a dotted path threads through them */
  var DL_N = 5, DL_HX = [0.23, 0.23, 0.23, 0.23, 0.23], DLX = 0, DLY = 0;
  function dlPath(kf, ph) { DLX = 0.22 * sin(0.75 * kf + ph - 0.4); DLY = 0.07 * sin(0.7 * kf + 1.3 + ph); }
  var DLA = 1;
  function dlSegment(ka, kb, ph, z0, dz, withDot, kd) {
    var i, m = 12, kf;
    bp(); CN = 0;
    for (i = 0; i <= m; i++) { kf = ka + (kb - ka) * i / m; dlPath(kf, ph); P(DLX, DLY, z0 + dz * kf); CX[CN] = X; CY[CN] = Y; CN++; }
    curveOut(false, true); dots(5.4); strokeC(LW.thin * 1.1, INK, 0.9); nodash();
    if (withDot && kd >= ka && kd <= kb) { dlPath(kd, ph); P(DLX, DLY, z0 + dz * kd); bp(); ctx.arc(X, Y, 0.017 * SC * DM * F, 0, TAU); fillC(INK, DLA); }
  }
  function drawDepthLayers(c, p) {
    var u = frac((+p.t || 0) / 10), ph = TAU * u, z0 = -0.62, dz = 0.3, k, i, al, hx, hy, cxp, cyp, ca, sa, gam, cg, sg, x, y, xo, yo, wgt, kd = -0.6 + (DL_N + 1.2) * u;
    begin(c, p, { tilt: -0.04, spin: 0.0, soft: 0.4, persp: 3.2, scale: 1.0, off: [0, 0] });
    DLA = sstep(0.0, 0.06, u) * (1 - sstep(0.94, 1.0, u));
    for (k = 0; k < DL_N; k++) {
      if (k === 0) dlSegment(-0.6, 0, ph, z0, dz, true, kd); else dlSegment(k - 1, k, ph, z0, dz, true, kd);
      hx = DL_HX[k]; hy = hx * 0.74; al = 0.12 * sin(ph + k * 0.9); ca = cos(al); sa = sin(al);
      dlPath(k, ph); cxp = 0.0; cyp = 0.0;                // plane centre offset from the path point
      gam = 0.2 * sin(k * 1.3 + ph); cg = cos(gam); sg = sin(gam);
      // outer outline (yawed rounded rectangle)
      for (i = 0; i < 4; i++) { x = (i === 0 || i === 3 ? -hx : hx); y = (i < 2 ? -hy : hy); setRP(i, DLX + cxp + x * ca, DLY + cyp + y, z0 + dz * k - x * sa); RP_R[i] = 0.04 * SC * F; }
      bp(); roundPolyPath(4);
      // the aperture: a smaller turned rounded rectangle centred on the path
      for (i = 0; i < 4; i++) {
        x = (i === 0 || i === 3 ? -0.14 : 0.14); y = (i < 2 ? -0.1 : 0.1); xo = x * cg - y * sg - cxp; yo = x * sg + y * cg - cyp;
        setRP(i, DLX + cxp + xo * ca, DLY + cyp + yo, z0 + dz * k - xo * sa); RP_R[i] = 0.03 * SC * F;
      }
      roundPolyPath(4);
      fillEO(k < 1 ? G4 : PAPER, 1);
      wgt = LW.thin * 0.9 + (LW.bold - LW.thin * 0.9) * pow(k / (DL_N - 1), 1.4);
      strokeC(wgt, k >= 3 ? INK : G1, 0.55 + 0.45 * k / (DL_N - 1));
    }
    dlSegment(DL_N - 1, DL_N + 0.6, ph, z0, dz, true, kd);
    end();
  }
  reg('depthLayers', { draw: drawDepthLayers, box: [1.1, 0.6], tags: ['planes', 'depth', 'perspective', 'path'] }, 10);

  /* ---- scaleSteps: one square turned and scaled about a shared corner, nine times: a logarithmic sweep; the highlight travels down the sequence */
  var SC_QX = [0, 1, 1, 0], SC_QY = [0, 0, 1, 1];
  function drawScaleSteps(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u, N = 9, ratio = 0.83 - 0.015 * sin(ph), th = 0.22 + 0.06 * sin(ph + 1.0), k, sc, rot, cr, sr, hp = u * N, d, al, i, x, y;
    begin(c, p, { tilt: -0.06, spin: 0.06, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    for (k = 0; k < N; k++) {
      sc = 0.6 * pow(ratio, k); rot = k * th - 0.2; cr = cos(rot); sr = sin(rot);
      for (i = 0; i < 4; i++) { x = SC_QX[i] * sc; y = SC_QY[i] * sc; setRP(i, x * cr - y * sr, x * sr + y * cr, 0); RP_R[i] = i === 0 ? 0 : 0.045 * sc * SC * F; }
      bp(); roundPolyPath(4); fillPaper(1);
      d = abs(k - hp); if (d > N / 2) d = N - d; al = clamp(1 - d, 0, 1); if (al > 0.01) fillC(G3, 0.85 * al * al * (3 - 2 * al));
      strokeC(k === 0 ? LW.bold : LW.mid * (1.0 - 0.35 * k / (N - 1)), INK, 1);
    }
    // the shared corner: one tiny solid dot
    setRP(0, 0, 0, 0); bp(); ctx.arc(RP_X[0], RP_Y[0], 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('scaleSteps', { draw: drawScaleSteps, box: [0.83, 0.59], tags: ['scale', 'steps', 'rotation', 'sweep'] }, 9);

  /*SMALL-BEGIN*/
  /* ================================================================== SMALL PIECES (round 5): abstract fireworks, idea bulbs and 'mind fragments' ================================================================== */
  /** flat (screen-space) pieces ignore p.rot and use no perspective */
  function beginFlat(c, p) { begin(c, { s: p.s, t: p.t, seed: p.seed, alpha: p.alpha, lw: p.lw, rot: null }, { persp: 0 }); }
  function fdr(r) { var v = r * SC; return v < 2.1 ? 2.1 : v; }          // dot radius in world units with a floor (small pieces keep visible dots)
  function fx(x) { return x * SC + OFX; }
  function fy(y) { return y * SC + OFY; }
  /** a thin tapered spike: base at (x0, y0) with full width wb (units of SC, floored), tip at (x1, y1) */
  function fwTri(x0, y0, x1, y1, wb) {
    var dx = x1 - x0, dy = y1 - y0, l = sqrt(dx * dx + dy * dy) || 1, w = max(wb, 2.6 * K / SC) * 0.5, nx = -dy / l * w, ny = dx / l * w;
    ctx.moveTo(fx(x0 + nx), fy(y0 + ny)); ctx.lineTo(fx(x1), fy(y1)); ctx.lineTo(fx(x0 - nx), fy(y0 - ny)); ctx.closePath();
  }
  function fdot(x, y, r) { var rr = fdr(r), px = fx(x), py = fy(y); ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, TAU); }

  /* ---- fireworks: ink bursts; each cycle (floor(t / period)) gets a new pattern from p.seed; growth ~0.45 s (ease-out), hold, droop + fade, a short idle */
  var FWU = 0, FWN = 0, FWG = 0, FWF = 1, FWD = 0, FWS = 0;
  function fwTime(p, period) {
    var tt = (+p.t || 0) / period, n = floor(tt), u = tt - n, q = u / (0.45 / period);
    q = q < 0 ? 0 : q > 1 ? 1 : q;
    FWU = u; FWN = n; FWG = 1 - (1 - q) * (1 - q) * (1 - q); FWF = 1 - sstep(0.5, 0.84, u); FWD = sstep(0.14, 0.86, u);
    FWS = (n * 7919 + ((p.seed | 0) * 104729)) | 0;
  }
  function fr(i) { return hash(i, FWS); }
  function fwFlash(cx, cy) { var r = 0.034 * (1 - sstep(0, 0.28, FWU)) * sstep(0, 0.025, FWU); if (r > 0.004) { bp(); fdot(cx, cy, r); fillC(INK, 1); } }

  function drawFwPeony(c, p) {
    beginFlat(c, p); fwTime(p, 2.4);
    if (FWF > 0.01) {
      var K0 = 15 + floor(fr(5) * 5), cx = (fr(1) - 0.5) * 0.08, cy = (fr(2) - 0.5) * 0.08, rot = fr(3) * TAU, sc = 0.84 + 0.16 * fr(4), k, a, long_, rl, x0, y0, x1, y1, dd, tw;
      bp(); for (k = 0; k < K0; k++) { if (k % 3 === 1) continue; a = rot + TAU * k / K0; long_ = k % 2 === 0; rl = 0.46 * sc * FWG * (long_ ? 1 : 0.64); dd = FWD * 0.13 * pow(rl / 0.46, 1.5); fwTri(cx + cos(a) * 0.05 * FWG, cy + sin(a) * 0.05 * FWG, cx + cos(a) * rl, cy + sin(a) * rl + dd, 0.02); } fillC(INK, FWF);
      bp(); for (k = 1; k < K0; k += 3) { a = rot + TAU * k / K0; rl = 0.46 * sc * FWG * 0.8; dd = FWD * 0.13 * pow(rl / 0.46, 1.5); fwTri(cx + cos(a) * 0.05 * FWG, cy + sin(a) * 0.05 * FWG, cx + cos(a) * rl, cy + sin(a) * rl + dd, 0.016); } fillC(G1, FWF);
      bp(); for (k = 0; k < K0; k++) { a = rot + TAU * k / K0; long_ = k % 2 === 0; rl = 0.46 * sc * FWG * (long_ ? 1 : 0.64); if (k % 3 === 1) rl = 0.46 * sc * FWG * 0.8; dd = FWD * 0.13 * pow(rl / 0.46, 1.5); tw = 0.85 + 0.3 * sin(FWU * TAU * 7 + k * 2.1) * sstep(0.3, 0.5, FWU); fdot(cx + cos(a) * rl * 1.04, cy + sin(a) * rl * 1.04 + dd, (long_ ? 0.017 : 0.012) * tw); } fillC(INK, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwPeony', { draw: drawFwPeony, box: [0.78, 0.92], noCenter: true, tags: ['firework', 'burst', 'spark', 'joy'] }, 2.4);

  function drawFwWillow(c, p) {
    beginFlat(c, p); fwTime(p, 3.0);
    if (FWF > 0.01) {
      var K0 = 11 + floor(fr(5) * 4), cx = (fr(1) - 0.5) * 0.06, cy = -0.12 + (fr(2) - 0.5) * 0.06, sc = 0.86 + 0.14 * fr(4), k, a, L, s, m, head = FWG, tail = 0.92 * sstep(0.42, 0.86, FWU), px, py, grav = 0.5 * sc * (0.5 + 0.5 * FWD), j, s0;
      for (j = 0; j < 2; j++) {
        bp();
        for (k = 0; k < K0; k++) {
          if ((k % 3 === 2) !== (j === 1)) continue;
          a = -PI / 2 + ((k + 0.5) / K0 - 0.5) * PI * 1.9 + (fr(20 + k) - 0.5) * 0.12; L = 0.5 * sc * (0.74 + 0.26 * fr(40 + k)); s0 = tail * head;
          for (m = 0; m <= 10; m++) { s = s0 + (head - s0) * m / 10; px = cx + cos(a) * L * s; py = cy + sin(a) * L * s + grav * s * s; if (m === 0) ctx.moveTo(fx(px), fy(py)); else ctx.lineTo(fx(px), fy(py)); }
        }
        strokeC(j === 0 ? LW.thin * 0.85 : LW.thin * 0.7, j === 0 ? INK : G1, sqrt(FWF));
      }
      bp(); for (k = 0; k < K0; k++) { a = -PI / 2 + ((k + 0.5) / K0 - 0.5) * PI * 1.9 + (fr(20 + k) - 0.5) * 0.12; L = 0.5 * sc * (0.74 + 0.26 * fr(40 + k)); fdot(cx + cos(a) * L * head, cy + sin(a) * L * head + grav * head * head, 0.011); } fillC(INK, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwWillow', { draw: drawFwWillow, box: [0.82, 0.99], noCenter: true, tags: ['firework', 'willow', 'droop', 'joy'] }, 3.0);

  function drawFwRing(c, p) {
    beginFlat(c, p); fwTime(p, 2.0);
    if (FWF > 0.01) {
      var cx = (fr(1) - 0.5) * 0.06, cy = (fr(2) - 0.5) * 0.06 + FWD * 0.05, rot = fr(3) * TAU, sc = 0.86 + 0.14 * fr(4), N1 = 18 + floor(fr(5) * 4), N2 = 11 + floor(fr(6) * 3), k, a, r1 = 0.46 * sc * FWG, g2, r2, tw;
      g2 = clamp((FWU - 0.06) / (0.45 / 2.0), 0, 1); g2 = 1 - (1 - g2) * (1 - g2) * (1 - g2); r2 = 0.28 * sc * g2;
      bp(); for (k = 0; k < N1; k++) { a = rot + TAU * k / N1; ctx.moveTo(fx(cx + cos(a) * r1 * 0.86), fy(cy + sin(a) * r1 * 0.86)); ctx.lineTo(fx(cx + cos(a) * r1), fy(cy + sin(a) * r1)); } strokeC(LW.thin * 0.8, G1, FWF * 0.9);
      bp(); for (k = 0; k < N1; k++) { a = rot + TAU * k / N1; tw = 1 + 0.2 * sin(FWU * TAU * 6 + k); fdot(cx + cos(a) * r1, cy + sin(a) * r1, 0.02 * tw * (1 - 0.35 * FWU)); } fillC(INK, FWF);
      bp(); for (k = 0; k < N2; k++) { a = -rot * 0.7 + TAU * (k + 0.5) / N2; fdot(cx + cos(a) * r2, cy + sin(a) * r2, 0.014 * (1 - 0.3 * FWU)); } fillC(G1, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwRing', { draw: drawFwRing, box: [0.84, 0.88], noCenter: true, tags: ['firework', 'ring', 'dots', 'joy'] }, 2.0);

  function drawFwSpiral(c, p) {
    beginFlat(c, p); fwTime(p, 2.6);
    if (FWF > 0.01) {
      var A = 3 + floor(fr(5) * 3), cx = (fr(1) - 0.5) * 0.06, cy = (fr(2) - 0.5) * 0.06, rot = fr(3) * TAU, sc = 0.86 + 0.14 * fr(4), dir = fr(6) < 0.5 ? -1 : 1, arm, i, D = 10, q, r, a, px, py, dd;
      bp();
      for (arm = 0; arm < A; arm++) for (i = 0; i <= D; i++) { q = i / D; r = 0.46 * sc * FWG * q; a = rot + TAU * arm / A + dir * (2.6 * q + 0.7 * FWU); px = cx + cos(a) * r; py = cy + sin(a) * r + FWD * 0.12 * q * q; if (i === 0) ctx.moveTo(fx(px), fy(py)); else ctx.lineTo(fx(px), fy(py)); }
      strokeC(LW.thin * 0.7, G1, FWF * 0.8);
      bp();
      for (arm = 0; arm < A; arm++) for (i = 2; i <= D; i += 2) { q = i / D; r = 0.46 * sc * FWG * q; a = rot + TAU * arm / A + dir * (2.6 * q + 0.7 * FWU); fdot(cx + cos(a) * r, cy + sin(a) * r + FWD * 0.12 * q * q, 0.008 + 0.014 * q); }
      fillC(INK, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwSpiral', { draw: drawFwSpiral, box: [0.76, 0.91], noCenter: true, tags: ['firework', 'spiral', 'arms', 'joy'] }, 2.6);

  function drawFwCrackle(c, p) {
    beginFlat(c, p); fwTime(p, 1.8);
    if (FWF > 0.01) {
      var N = 34, cx = (fr(1) - 0.5) * 0.06, cy = (fr(2) - 0.5) * 0.06, sc = 0.86 + 0.14 * fr(4), i, a, r, px, py, on, ph;
      bp(); for (i = 0; i < N; i++) { a = fr(40 + i) * TAU; r = (0.16 + 0.84 * sqrt(fr(80 + i))) * 0.46 * sc * FWG; px = cx + cos(a) * r; py = cy + sin(a) * r + FWD * 0.2 * fr(120 + i); on = sin(FWU * TAU * (4 + 5 * floor(fr(160 + i) * 3)) + fr(200 + i) * TAU); if (on > 0.15) fdot(px, py, 0.012 + 0.008 * fr(240 + i)); } fillC(INK, FWF);
      bp(); for (i = 0; i < N; i++) { a = fr(40 + i) * TAU; r = (0.16 + 0.84 * sqrt(fr(80 + i))) * 0.46 * sc * FWG; px = cx + cos(a) * r; py = cy + sin(a) * r + FWD * 0.2 * fr(120 + i); on = sin(FWU * TAU * (4 + 5 * floor(fr(160 + i) * 3)) + fr(200 + i) * TAU); if (on <= 0.15) { ctx.moveTo(fx(px - cos(a) * 0.03), fy(py - sin(a) * 0.03)); ctx.lineTo(fx(px + cos(a) * 0.03), fy(py + sin(a) * 0.03)); } } strokeC(LW.thin * 0.8, G1, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwCrackle', { draw: drawFwCrackle, box: [0.75, 0.94], noCenter: true, tags: ['firework', 'crackle', 'flicker', 'joy'] }, 1.8);

  function drawFwChrysanthemum(c, p) {
    beginFlat(c, p); fwTime(p, 2.8);
    if (FWF > 0.01) {
      var K0 = 9 + floor(fr(5) * 3), cx = (fr(1) - 0.5) * 0.06, cy = (fr(2) - 0.5) * 0.06, rot = fr(3) * TAU, sc = 0.86 + 0.14 * fr(4), k, a, rl, dd, fg = sstep(0.45, 1.0, FWG), fx0, fy0, b, ba, bl;
      bp(); for (k = 0; k < K0; k++) { a = rot + TAU * k / K0; rl = 0.36 * sc * FWG * (0.72 + 0.28 * fr(60 + k)); dd = FWD * 0.09 * pow(rl / 0.36, 1.5); fwTri(cx + cos(a) * 0.05 * FWG, cy + sin(a) * 0.05 * FWG, cx + cos(a) * rl, cy + sin(a) * rl + dd, 0.022); } fillC(INK, FWF);
      bp(); for (k = 0; k < K0; k++) { a = rot + TAU * k / K0; rl = 0.36 * sc * FWG * (0.72 + 0.28 * fr(60 + k)); dd = FWD * 0.09 * pow(rl / 0.36, 1.5); fx0 = cx + cos(a) * rl; fy0 = cy + sin(a) * rl + dd; bl = 0.12 * sc * fg * (0.7 + 0.5 * fr(90 + k)); for (b = -1; b <= 1; b += 2) { ba = a + b * (0.4 + 0.3 * fr(70 + k)); ctx.moveTo(fx(fx0), fy(fy0)); ctx.lineTo(fx(fx0 + cos(ba) * bl), fy(fy0 + sin(ba) * bl + dd * 0.4)); } } strokeC(LW.thin * 0.85, INK, FWF);
      bp(); for (k = 0; k < K0; k++) { a = rot + TAU * k / K0; rl = 0.36 * sc * FWG * (0.72 + 0.28 * fr(60 + k)); dd = FWD * 0.09 * pow(rl / 0.36, 1.5); fx0 = cx + cos(a) * rl; fy0 = cy + sin(a) * rl + dd; bl = 0.12 * sc * fg * (0.7 + 0.5 * fr(90 + k)); for (b = -1; b <= 1; b += 2) { ba = a + b * (0.4 + 0.3 * fr(70 + k)); if (fg > 0.2) fdot(fx0 + cos(ba) * bl, fy0 + sin(ba) * bl + dd * 0.4, 0.012 * (0.8 + 0.3 * sin(FWU * TAU * 6 + k + b))); } } fillC(INK, FWF);
      fwFlash(cx, cy);
    }
    end();
  }
  reg('fwChrysanthemum', { draw: drawFwChrysanthemum, box: [0.75, 0.81], noCenter: true, tags: ['firework', 'fork', 'rays', 'joy'] }, 2.8);

  function drawFwSparkle(c, p) {
    beginFlat(c, p); fwTime(p, 1.6);
    if (FWF > 0.01) {
      var cx = (fr(1) - 0.5) * 0.08, cy = (fr(2) - 0.5) * 0.08, rot = fr(3) * TAU * 0.25, sc = 0.9 + 0.1 * fr(4), k, a, rl, pul = 0.85 + 0.15 * sin(FWU * TAU * 4 + fr(7) * TAU), g = FWG * pul;
      bp(); for (k = 0; k < 6; k++) { a = rot + FWU * 0.5 + k * PI / 3; rl = (k % 2 === 0 ? 0.44 : 0.26) * sc * g; fwTri(cx, cy, cx + cos(a) * rl, cy + sin(a) * rl, 0.034); } fillC(INK, FWF);
      bp(); for (k = 0; k < 4; k++) { a = -rot * 1.3 + 0.4 + k * PI / 2; rl = 0.17 * sc * g; fwTri(cx + 0.31, cy - 0.28, cx + 0.31 + cos(a) * rl, cy - 0.28 + sin(a) * rl, 0.022); } fillC(G1, FWF);
      bp(); fdot(cx, cy, 0.022); fdot(cx - 0.3, cy + 0.26, 0.012 * (0.6 + 0.4 * sin(FWU * TAU * 5))); fdot(cx + 0.34, cy + 0.3, 0.01 * (0.6 + 0.4 * sin(FWU * TAU * 6 + 1))); fillC(INK, FWF);
    }
    end();
  }
  reg('fwSparkle', { draw: drawFwSparkle, box: [0.85, 0.74], noCenter: true, tags: ['firework', 'sparkle', 'twinkle', 'joy'] }, 1.6);

  /* ---- idea bulbs: outline + filament + screw base + glow ticks that flicker on (unit coordinates: 1 = the bulb's nominal size) */
  function bulbFlick(u, k) { var v = sin(TAU * (u * 2 + k)) + 0.55 * sin(TAU * (u * 5 + k * 1.7)); return sstep(-0.25, 0.25, v); }
  function bulbAt(cx, cy, bk, rot, on, tk, mode, rip) {
    var sc = SC * bk, K0 = K, i, a, l, r, th, wo = LW.thin * 1.15;
    ctx.save(); ctx.translate(fx(cx), fy(cy)); ctx.rotate(rot); ctx.scale(sc, sc); K = K0 / sc;
    // glass: opaque paper, a flat tint that comes up with the light
    bp(); ctx.moveTo(-0.229, 0.053); ctx.arc(0, -0.14, 0.3, PI - 0.7, TAU + 0.7, false); ctx.bezierCurveTo(0.2, 0.11, 0.12, 0.17, 0.085, 0.215); ctx.lineTo(-0.085, 0.215); ctx.bezierCurveTo(-0.12, 0.17, -0.2, 0.11, -0.229, 0.053); ctx.closePath();
    fillPaper(1); if (on > 0.01) fillC(G4, 0.95 * on); strokeC(wo, INK, 1);
    // screw base: flat tint, two ridges, a small contact cap
    bp(); ctx.moveTo(-0.092, 0.215); ctx.lineTo(0.092, 0.215); ctx.lineTo(0.092, 0.33); ctx.lineTo(-0.092, 0.33); ctx.closePath(); fillC(G4, 1); strokeC(wo, INK, 1);
    bp(); ctx.moveTo(-0.092, 0.258); ctx.lineTo(0.092, 0.258); ctx.moveTo(-0.092, 0.294); ctx.lineTo(0.092, 0.294); strokeC(wo * 0.7, INK, 0.9);
    bp(); ctx.moveTo(-0.05, 0.33); ctx.arc(0, 0.33, 0.05, PI, 0, true); ctx.closePath(); fillC(INK, 1);
    // filament: two posts and a zigzag (or a tiny spiral)
    bp(); ctx.moveTo(-0.042, 0.215); ctx.lineTo(-0.05, -0.05); ctx.moveTo(0.042, 0.215); ctx.lineTo(0.05, -0.05); strokeC(wo * 0.65, G1, 1);
    bp();
    if (mode === 1) { for (i = 0; i <= 30; i++) { th = i / 30 * TAU * 2.1 - 0.3; r = 0.016 + 0.06 * i / 30; if (i === 0) ctx.moveTo(r * cos(th), -0.13 + r * sin(th) * 0.92); else ctx.lineTo(r * cos(th), -0.13 + r * sin(th) * 0.92); } ctx.moveTo(-0.05, -0.05); ctx.lineTo(-0.02, -0.11); ctx.moveTo(0.05, -0.05); ctx.lineTo(0.065, -0.12); }
    else { ctx.moveTo(-0.05, -0.05); ctx.lineTo(-0.032, -0.13); ctx.lineTo(-0.012, -0.07); ctx.lineTo(0.008, -0.13); ctx.lineTo(0.028, -0.07); ctx.lineTo(0.044, -0.12); ctx.lineTo(0.05, -0.05); }
    strokeC(wo * 0.8, on > 0.5 ? INK : G2, 1);
    if (on > 0.5) { strokeC(wo * 0.8, INK, 1); }
    // glow ticks
    if (tk > 0.02) {
      bp(); for (i = 0; i < 7; i++) { a = PI + 0.3 + i / 6 * (PI - 0.6); l = (i % 2 === 0 ? 0.12 : 0.075) * tk; r = 0.375; ctx.moveTo(cos(a) * r, -0.14 + sin(a) * r); ctx.lineTo(cos(a) * (r + l), -0.14 + sin(a) * (r + l)); }
      strokeC(wo * 0.85, INK, min(1, tk));
    }
    if (rip > 0 && rip < 1) { bp(); ctx.arc(0, -0.14, 0.34 + 0.34 * eout(rip), 0, TAU); strokeC(wo * 0.7, G1, (1 - rip) * (1 - rip)); }
    ctx.restore(); K = K0;
  }
  function drawBulbClassic(c, p) {
    beginFlat(c, p); var u = frac((+p.t || 0) / 3.2), on = bulbFlick(u, 0.3), tk = on * (0.78 + 0.22 * sin(TAU * u * 6));
    bulbAt(0, 0.108, 1, 0, on, tk, 0, 0); end();
  }
  reg('bulbClassic', { draw: drawBulbClassic, box: [0.95, 0.98], noCenter: true, tags: ['idea', 'bulb', 'flicker', 'spark'] }, 3.2);
  function drawBulbSpiral(c, p) {
    beginFlat(c, p); var u = frac((+p.t || 0) / 3.0), on = bulbFlick(u, 0.1), tk = on * (0.8 + 0.2 * sin(TAU * u * 4 + 1));
    bulbAt(0, 0.108, 1, 0, on, tk, 1, 0); end();
  }
  reg('bulbSpiral', { draw: drawBulbSpiral, box: [0.95, 0.98], noCenter: true, tags: ['idea', 'bulb', 'spiral', 'flicker'] }, 3.0);
  function drawBulbSwitch(c, p) {
    beginFlat(c, p); var u = frac((+p.t || 0) / 3.6), on = s5((u - 0.2) / 0.1) * (1 - s5((u - 0.86) / 0.08)), tk = spr((u - 0.22) / 0.2) * (1 - s5((u - 0.86) / 0.06)) * (0.85 + 0.15 * sin(TAU * u * 5)), rip = (u - 0.22) / 0.4;
    bulbAt(0, 0.11, 0.78, 0, on, tk, 0, rip); end();
  }
  reg('bulbSwitch', { draw: drawBulbSwitch, box: [1.03, 1.03], noCenter: true, tags: ['idea', 'bulb', 'switch', 'ripple'] }, 3.6);
  function drawBulbCluster(c, p) {
    beginFlat(c, p); var u = frac((+p.t || 0) / 4.0), i, B = [[-0.2, 0.134, 0.78, -0.18], [0.24, -0.106, 0.56, 0.13], [0.43, 0.304, 0.4, -0.1]], on;
    for (i = 0; i < 3; i++) { on = bulbFlick(u, i * 0.33 + 0.05); bulbAt(B[i][0], B[i][1], B[i][2], B[i][3], on, on * (0.8 + 0.2 * sin(TAU * u * 5 + i * 2)), i === 1 ? 1 : 0, 0); }
    end();
  }
  reg('bulbCluster', { draw: drawBulbCluster, box: [1.22, 0.91], noCenter: true, tags: ['idea', 'bulb', 'cluster', 'blink'] }, 4.0);

  /* ---- mind fragments, set 1 ---- */

  /* stringModel: taut threads between two skew bars (a ruled surface) that slowly twist */
  var SM2_N = 17;
  function drawStringModel(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u;
    begin(c, p, { tilt: -0.5, spin: 0.35 + 0.15 * sin(ph), soft: 0.5, persp: 6, off: [0, 0] });
    var a1 = 0.35, a2 = a1 + 1.0 + 0.7 * sin(ph + 0.6), L = 0.46, Y0 = 0.3, i, s, c1 = cos(a1), s1 = sin(a1), c2 = cos(a2), s2 = sin(a2), d, k;
    bp(); for (i = 0; i < SM2_N; i++) { if (i % 4 === 0) continue; s = -1 + 2 * i / (SM2_N - 1); P(s * L * c1, Y0, s * L * s1); ctx.moveTo(X, Y); P(s * L * c2, -Y0, s * L * s2); ctx.lineTo(X, Y); } strokeC(LW.thin * 0.75, G1, 1);
    bp(); for (i = 0; i < SM2_N; i += 4) { s = -1 + 2 * i / (SM2_N - 1); P(s * L * c1, Y0, s * L * s1); ctx.moveTo(X, Y); P(s * L * c2, -Y0, s * L * s2); ctx.lineTo(X, Y); } strokeC(LW.thin * 0.9, INK, 1);
    bp(); seg(-L * c1, Y0, -L * s1, L * c1, Y0, L * s1); seg(-L * c2, -Y0, -L * s2, L * c2, -Y0, L * s2); strokeC(LW.mid * 0.9, INK, 1);
    bp(); for (k = -1; k <= 1; k += 2) { P(k * L * c1, Y0, k * L * s1); ctx.moveTo(X + DM * 3, Y); ctx.arc(X, Y, DM * 3, 0, TAU); P(k * L * c2, -Y0, k * L * s2); ctx.moveTo(X + DM * 3, Y); ctx.arc(X, Y, DM * 3, 0, TAU); } fillPaper(1); strokeC(LW.thin * 0.9, INK, 1);
    d = 0.5 - 0.46 * cos(ph); s = -0.375; P(s * L * mix(c1, c2, d), mix(Y0, -Y0, d), s * L * mix(s1, s2, d)); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('stringModel', { draw: drawStringModel, box: [0.91, 0.76], tags: ['string', 'ruled', 'surface', 'twist'] }, 9);

  /* foldStrip: a strip of panels hinged in a zigzag that opens and closes (real 3D, alternate faces tinted) */
  var FS_N = 6, FS_X = new Float64Array(FS_N + 1), FS_Z = new Float64Array(FS_N + 1), FS_QX = new Float64Array(FS_N * 4), FS_QY = new Float64Array(FS_N * 4), FS_D = new Float64Array(FS_N), FS_ORD = [0, 1, 2, 3, 4, 5];
  function fsCmp(a, b) { return FS_D[a] - FS_D[b]; }
  function drawFoldStrip(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u, amt = 1.25 * s5(0.5 - 0.5 * cos(ph)) + 0.08, i, th, w = 0.15, hh = 0.17, mx = 0, mz = 0, o, q, xa, xb, za, zb;
    begin(c, p, { tilt: -0.62, spin: 0.55 + 0.1 * sin(ph), soft: 0.5, persp: 6, off: [0, 0] });
    FS_X[0] = 0; FS_Z[0] = 0;
    for (i = 0; i < FS_N; i++) { th = i % 2 === 0 ? amt : -amt; FS_X[i + 1] = FS_X[i] + cos(th) * w; FS_Z[i + 1] = FS_Z[i] + sin(th) * w; }
    for (i = 0; i <= FS_N; i++) { mx += FS_X[i]; mz += FS_Z[i]; } mx /= FS_N + 1; mz /= FS_N + 1;
    bp(); for (i = 0; i <= FS_N; i++) { P(FS_X[i] - mx, hh + 0.12, FS_Z[i] - mz); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } dots(4.6); strokeC(LW.thin * 0.9, G1, 0.9); nodash();
    for (i = 0; i < FS_N; i++) {
      xa = FS_X[i] - mx; xb = FS_X[i + 1] - mx; za = FS_Z[i] - mz; zb = FS_Z[i + 1] - mz; o = i * 4;
      P(xa, -hh, za); FS_QX[o] = X; FS_QY[o] = Y; P(xb, -hh, zb); FS_QX[o + 1] = X; FS_QY[o + 1] = Y; q = Z;
      P(xb, hh, zb); FS_QX[o + 2] = X; FS_QY[o + 2] = Y; P(xa, hh, za); FS_QX[o + 3] = X; FS_QY[o + 3] = Y; FS_D[i] = q + Z;
    }
    FS_ORD.sort(fsCmp);
    for (q = 0; q < FS_N; q++) {
      i = FS_ORD[q]; o = i * 4; bp(); ctx.moveTo(FS_QX[o], FS_QY[o]); ctx.lineTo(FS_QX[o + 1], FS_QY[o + 1]); ctx.lineTo(FS_QX[o + 2], FS_QY[o + 2]); ctx.lineTo(FS_QX[o + 3], FS_QY[o + 3]); ctx.closePath();
      th = (FS_QX[o + 1] - FS_QX[o]) * (FS_QY[o + 3] - FS_QY[o]) - (FS_QY[o + 1] - FS_QY[o]) * (FS_QX[o + 3] - FS_QX[o]);
      fillC(th > 0 ? PAPER : G4, 1); strokeC(LW.mid * 0.85, INK, 1);
    }
    P(FS_X[3] - mx, -hh, FS_Z[3] - mz); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('foldStrip', { draw: drawFoldStrip, box: [0.81, 0.68], tags: ['fold', 'strip', 'accordion', 'paper'] }, 8);

  /* maquetteCluster: four unequal blocks on a thin plate; their heights breathe and the cast shadows sweep as the light moves */
  var MQ = [[-0.2, 0.0, 0.24, 0.2, 0.3], [0.06, -0.1, 0.18, 0.16, 0.19], [0.27, 0.07, 0.2, 0.22, 0.1], [-0.02, 0.13, 0.1, 0.1, 0.07]], MQ_O = [0, 1, 2, 3], MQ_Z = new Float64Array(4), MQ_HX = new Float64Array(8), MQ_HY = new Float64Array(8), MQ_HO = new Int16Array(8), MQ_H = new Float64Array(4);
  function mqCmp(a, b) { return MQ_Z[a] - MQ_Z[b]; }
  function drawMaquetteCluster(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u, i, b, x0, x1, z0, z1, hgt, gy = 0.2, la = ph + 0.5, sx = 0.5 * cos(la), sz = 0.3 * sin(la) + 0.25, n, hn, j;
    begin(c, p, { tilt: -0.5, spin: 0.62, soft: 0.5, persp: 7, off: [0, 0] });
    BV[0] = M[6]; BV[1] = M[7]; BV[2] = M[8];
    bp(); mv(-0.46, gy, -0.3); ln(0.46, gy, -0.3); ln(0.46, gy, 0.3); ln(-0.46, gy, 0.3); ctx.closePath(); fillPaper(1); strokeC(LW.thin, G1, 1);
    for (i = 0; i < 4; i++) { b = MQ[i]; MQ_H[i] = b[4] * (1 + 0.32 * sin(ph + i * 2.1)); }
    for (i = 0; i < 4; i++) {      // shadows: hull of the footprint and the roof shifted along the light, one hard-edged flat tint
      b = MQ[i]; hgt = MQ_H[i]; x0 = b[0] - b[2] / 2; x1 = b[0] + b[2] / 2; z0 = b[1] - b[3] / 2; z1 = b[1] + b[3] / 2; n = 0;
      for (j = 0; j < 4; j++) { P(j & 1 ? x1 : x0, gy, j & 2 ? z1 : z0); MQ_HX[n] = X; MQ_HY[n] = Y; n++; P((j & 1 ? x1 : x0) + sx * hgt * 1.2, gy, (j & 2 ? z1 : z0) + sz * hgt * 0.5); MQ_HX[n] = X; MQ_HY[n] = Y; n++; }
      hn = hull2(MQ_HX, MQ_HY, n, MQ_HO); bp(); for (j = 0; j < hn; j++) { if (j === 0) ctx.moveTo(MQ_HX[MQ_HO[j]], MQ_HY[MQ_HO[j]]); else ctx.lineTo(MQ_HX[MQ_HO[j]], MQ_HY[MQ_HO[j]]); } ctx.closePath(); fillC(G4, 1);
    }
    for (i = 0; i < 4; i++) { b = MQ[i]; R(b[0], gy - MQ_H[i] / 2, b[1]); MQ_Z[i] = RZ; }
    MQ_O.sort(mqCmp);
    for (j = 0; j < 4; j++) {
      i = MQ_O[j]; b = MQ[i]; x0 = b[0] - b[2] / 2; x1 = b[0] + b[2] / 2; z0 = b[1] - b[3] / 2; z1 = b[1] + b[3] / 2;
      if (i === 3) boxVisible(x0, gy - MQ_H[i], z0, x1, gy, z1, INK, INK, INK, INK, LW.thin, 1, 1);
      else boxVisible(x0, gy - MQ_H[i], z0, x1, gy, z1, PAPER, PAPER, PAPER, INK, LW.mid * 0.85, 1, 1);
    }
    end();
  }
  reg('maquetteCluster', { draw: drawMaquetteCluster, box: [1.08, 0.63], tags: ['maquette', 'blocks', 'light', 'shadow'] }, 9);

  /* slabRhythm: seven thin standing cards that turn in a travelling wave */
  var SR_N = 7, SR_QX = new Float64Array(SR_N * 4), SR_QY = new Float64Array(SR_N * 4), SR_D = new Float64Array(SR_N), SR_ORD = [0, 1, 2, 3, 4, 5, 6];
  function srCmp(a, b) { return SR_D[a] - SR_D[b]; }
  function drawSlabRhythm(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u, i, q, o, x, a, hw = 0.1, hh, ca, sa, z0, z1;
    begin(c, p, { tilt: -0.38, spin: 0.35, soft: 0.5, persp: 6, off: [0, 0] });
    bp(); mv(-0.46, 0.3, -0.14); ln(0.46, 0.3, -0.14); ln(0.46, 0.3, 0.14); ln(-0.46, 0.3, 0.14); ctx.closePath(); dots(5); strokeC(LW.thin * 0.9, G1, 0.8); nodash();
    for (i = 0; i < SR_N; i++) {
      x = (i - 3) * 0.145; a = 1.05 * sin(ph - i * 0.62); hh = 0.17 + 0.05 * sin(ph * 2 - i * 0.9); ca = cos(a); sa = sin(a); o = i * 4;
      P(x - hw * ca, 0.3 - 2 * hh, -hw * sa); SR_QX[o] = X; SR_QY[o] = Y; z0 = Z; P(x + hw * ca, 0.3 - 2 * hh, hw * sa); SR_QX[o + 1] = X; SR_QY[o + 1] = Y; z1 = Z;
      P(x + hw * ca, 0.3, hw * sa); SR_QX[o + 2] = X; SR_QY[o + 2] = Y; P(x - hw * ca, 0.3, -hw * sa); SR_QX[o + 3] = X; SR_QY[o + 3] = Y; SR_D[i] = x * M[6] * 0 + (z0 + z1) / 2;
    }
    SR_ORD.sort(srCmp);
    for (q = 0; q < SR_N; q++) {
      i = SR_ORD[q]; o = i * 4; bp(); ctx.moveTo(SR_QX[o], SR_QY[o]); ctx.lineTo(SR_QX[o + 1], SR_QY[o + 1]); ctx.lineTo(SR_QX[o + 2], SR_QY[o + 2]); ctx.lineTo(SR_QX[o + 3], SR_QY[o + 3]); ctx.closePath();
      a = (SR_QX[o + 1] - SR_QX[o]) * (SR_QY[o + 3] - SR_QY[o]) - (SR_QY[o + 1] - SR_QY[o]) * (SR_QX[o + 3] - SR_QX[o]);
      fillC(a > 0 ? PAPER : G4, 1); strokeC(LW.mid * 0.8, INK, 1);
    }
    o = 3 * 4; bp(); ctx.arc((SR_QX[o] + SR_QX[o + 1]) / 2, (SR_QY[o] + SR_QY[o + 1]) / 2 - 0.03 * SC, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('slabRhythm', { draw: drawSlabRhythm, box: [1.03, 0.6], tags: ['rhythm', 'cards', 'wave', 'slabs'] }, 8);

  /* doodleLoop: a pencil draws a looping line, then the tail rubs it out */
  function dlX(t) { return -0.45 + 0.9 * t - 0.14 * sin(TAU * 3 * t); }
  function dlY(t) { return -0.14 * cos(TAU * 3 * t) + 0.04 * sin(TAU * t * 1.3); }
  function drawDoodleLoop(c, p) {
    var u = frac((+p.t || 0) / 7), head = eio((u - 0.04) / 0.5), tail = eio((u - 0.52) / 0.44), m, i, t, w, len;
    begin(c, p, { tilt: -0.04, spin: 0.04, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    if (head - tail > 0.01) {
      m = max(8, Math.ceil(110 * (head - tail))); CN = 0;
      for (i = 0; i <= m; i++) { t = tail + (head - tail) * i / m; cp(dlX(t), dlY(t), 0); w = 0.12 + 0.88 * spw(i / m, 0.55); WD[i] = K * LW.mid * 1.25 * w * (0.7 + 0.3 * sin(TAU * 5 * t)); }
      bp(); ribbonOut(m + 1); fillC(INK, 1);
      bp(); ctx.arc(CX[m], CY[m], 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    }
    end();
  }
  reg('doodleLoop', { draw: drawDoodleLoop, box: [1.08, 0.36], tags: ['doodle', 'loop', 'line', 'pencil'] }, 7);

  /* solveSquiggle: a scribble relaxes into one straight line (solving), with its earlier tangle ghosted */
  function ssPt(s, lam) { SSX = -0.45 + 0.9 * s + 0.075 * lam * sin(TAU * 3.5 * s); SSY = 0.17 * lam * cos(TAU * 3.5 * s); }
  var SSX = 0, SSY = 0;
  function drawSolveSquiggle(c, p) {
    var u = frac((+p.t || 0) / 8), lam = s5(0.5 + 0.5 * cos(TAU * u)), lamg = s5(0.5 + 0.5 * cos(TAU * (u - 0.1))), i, m = 90, s, hd = 0.5 - 0.5 * cos(TAU * u);
    begin(c, p, { tilt: -0.04, spin: 0.04, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    bp(); mv(-0.45, 0.26, 0); ln(0.45, 0.26, 0); dots(5); strokeC(LW.thin * 0.9, G1, 0.8); nodash();
    if (abs(lamg - lam) > 0.02) { CN = 0; for (i = 0; i <= m; i++) { s = i / m; ssPt(s, lamg); cp(SSX, SSY, 0); } bp(); curveOut(false, true); strokeC(LW.thin * 0.85, G1, 0.9 * min(1, abs(lamg - lam) * 5)); }
    CN = 0; for (i = 0; i <= m; i++) { s = i / m; ssPt(s, lam); cp(SSX, SSY, 0); WD[i] = K * LW.mid * 1.2 * (0.2 + 0.8 * spw(s, 0.6)); }
    bp(); ribbonOut(m + 1); fillC(INK, 1);
    ssPt(1.0, lam); P(SSX, SSY, 0); bp(); ctx.arc(X, Y, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('solveSquiggle', { draw: drawSolveSquiggle, box: [0.92, 0.45], tags: ['scribble', 'solve', 'line', 'straighten'] }, 8);

  /* dotWarp: a square dot grid warped by a swirl and a wave; dot size follows the local stretch */
  var DW_N = 9, DW_X = new Float64Array(DW_N * DW_N), DW_Y = new Float64Array(DW_N * DW_N), DW_B = new Uint8Array(DW_N * DW_N);
  function drawDotWarp(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u, i, j, x, y, r2, ang, cs, sn, nx, ny, b, w, idx, rr, k;
    begin(c, p, { tilt: -0.12, spin: 0.1, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    for (j = 0; j < DW_N; j++) for (i = 0; i < DW_N; i++) {
      x = -0.4 + 0.8 * i / (DW_N - 1); y = -0.4 + 0.8 * j / (DW_N - 1); r2 = x * x + y * y; ang = 0.75 * sin(ph) * Math.exp(-r2 / 0.14); cs = cos(ang); sn = sin(ang);
      nx = x * cs - y * sn + 0.035 * sin(5 * y + ph); ny = x * sn + y * cs + 0.035 * sin(5 * x - ph); idx = j * DW_N + i;
      P(nx, ny, 0); DW_X[idx] = X; DW_Y[idx] = Y; w = 0.5 + 0.5 * sin(4 * nx + 3 * ny - ph * 2); DW_B[idx] = min(3, floor(w * 3.999));
    }
    for (b = 0; b < 4; b++) {
      rr = (0.011 + 0.0085 * b) * SC * DM; bp();
      for (k = 0; k < DW_N * DW_N; k++) if (DW_B[k] === b) { ctx.moveTo(DW_X[k] + rr, DW_Y[k]); ctx.arc(DW_X[k], DW_Y[k], rr, 0, TAU); }
      fillC(INK, 0.4 + 0.2 * b);
    }
    end();
  }
  reg('dotWarp', { draw: drawDotWarp, box: [0.98, 0.97], tags: ['dots', 'grid', 'warp', 'swirl'] }, 8);

  /* dotPinch: dots stream through a narrowing and spread out again (no outline), faster at the pinch */
  function drawDotPinch(c, p) {
    var u = frac((+p.t || 0) / 8), j, m, y0, w, x, h, a, M = 7, NJ = 13, b, rr;
    begin(c, p, { tilt: -0.04, spin: 0.04, soft: 0.5, minN: 0.6, persp: 6, off: [0, 0] });
    for (b = 0; b < 3; b++) {
      bp();
      for (j = 0; j < NJ; j++) {
        y0 = -1 + 2 * j / (NJ - 1);
        for (m = 0; m < M; m++) {
          w = frac(m / M + u + j * 0.61803); x = 0.46 * sin(PI * (w - 0.5)); h = 0.035 + 0.24 * pow(abs(x) / 0.46, 1.8);
          a = abs(x) / 0.46; if (min(2, floor(a * 3)) !== b) continue;
          rr = (0.011 + 0.008 * a) * SC * DM; P(x, y0 * h, 0); ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, TAU);
        }
      }
      fillC(INK, 1 - 0.28 * b);
    }
    end();
  }
  reg('dotPinch', { draw: drawDotPinch, box: [0.96, 0.59], tags: ['dots', 'flow', 'pinch', 'stream'] }, 8);

  /* bendLattice: a square lattice that bends about a vertical axis and relaxes */
  function blPt(x, z, k) { var bx, by; if (abs(k) < 0.02) { bx = x; by = 0; } else { bx = sin(k * x) / k; by = -(1 - cos(k * x)) / k; } P(bx, by + 0.1, z); }
  function drawBendLattice(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u, k = 2.1 * sin(ph), N = 7, i, j, x, z, st = 0.8 / (N - 1);
    begin(c, p, { tilt: -0.62, spin: 0.45, soft: 0.5, persp: 6, off: [0, 0] });
    bp(); for (j = 0; j < N; j++) { z = -0.4 + j * st * 0.9; for (i = 0; i <= 12; i++) { x = -0.4 + 0.8 * i / 12; blPt(x, z, k); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } } strokeC(LW.thin * 0.85, G1, 1);
    bp(); for (i = 0; i < N; i++) { x = -0.4 + i * st; for (j = 0; j <= 8; j++) { z = -0.4 + 0.72 * j / 8; blPt(x, z, k); if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } } strokeC(LW.thin * 0.85, G1, 1);
    bp(); for (j = 0; j < N; j += N - 1) { z = -0.4 + j * st * 0.9; for (i = 0; i <= 12; i++) { x = -0.4 + 0.8 * i / 12; blPt(x, z, k); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } } strokeC(LW.mid * 0.85, INK, 1);
    bp(); for (j = 0; j < N; j++) for (i = 0; i < N; i++) { blPt(-0.4 + i * st, -0.4 + j * st * 0.9, k); ctx.moveTo(X + 0.011 * SC * DM, Y); ctx.arc(X, Y, 0.011 * SC * DM, 0, TAU); } fillC(INK, 0.8);
    blPt(0, 0, k); bp(); ctx.arc(X, Y, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('bendLattice', { draw: drawBendLattice, box: [1.04, 0.83], tags: ['lattice', 'bend', 'grid', 'surface'] }, 9);

  /* ---- mind fragments, set 2 ---- */
  function fcp(x, y) { CX[CN] = fx(x); CY[CN] = fy(y); CN++; }
  /** smooth closed ellipse (flat piece coordinates, units of SC), rotated by rot; leaves the path open for fill / stroke */
  function flatEll(cx, cy, rx, ry, rot) {
    var j, a, x, y, cr = cos(rot), sr = sin(rot), N = 22; CN = 0; ctx.beginPath();
    for (j = 0; j < N; j++) { a = TAU * j / N; x = rx * cos(a); y = ry * sin(a); fcp(cx + x * cr - y * sr, cy + x * sr + y * cr); }
    curveOut(true);
  }

  /* curvedWall: a curved wall with a scooped notch that slides along it; the light that gets through lands on the floor in front */
  var CW_N = 24, CW_TX = new Float64Array(CW_N + 1), CW_TY = new Float64Array(CW_N + 1), CW_BX = new Float64Array(CW_N + 1), CW_BY = new Float64Array(CW_N + 1);
  function drawCurvedWall(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u, Rw = 0.44, h = 0.3, fl = 0.2, zc = 0.34, aa = 0.62 * sin(ph), i, a, d, hh, x, z, a0 = aa - 0.2, a1 = aa + 0.2, dx = 0.12 + 0.08 * sin(ph + 1);
    begin(c, p, { tilt: -0.5, spin: 0.35, soft: 0.5, persp: 6.5, off: [0, 0] });
    bp(); P(Rw * sin(a0), fl, zc - Rw * cos(a0)); ctx.moveTo(X, Y); P(Rw * sin(a1), fl, zc - Rw * cos(a1)); ctx.lineTo(X, Y); P(Rw * sin(a1) + dx, fl, zc - Rw * cos(a1) + 0.32); ctx.lineTo(X, Y); P(Rw * sin(a0) + dx, fl, zc - Rw * cos(a0) + 0.32); ctx.lineTo(X, Y); ctx.closePath(); fillC(G3, 1); strokeC(LW.thin * 0.8, INK, 0.8);
    for (i = 0; i <= CW_N; i++) {
      a = -1.0 + 2.0 * i / CW_N; d = (a - aa) / 0.2; hh = h * (1 - 0.64 * Math.exp(-d * d)); x = Rw * sin(a); z = zc - Rw * cos(a);
      P(x, fl - hh, z); CW_TX[i] = X; CW_TY[i] = Y; P(x, fl, z); CW_BX[i] = X; CW_BY[i] = Y;
    }
    bp(); ctx.moveTo(CW_TX[0], CW_TY[0]); for (i = 1; i <= CW_N; i++) ctx.lineTo(CW_TX[i], CW_TY[i]); for (i = CW_N; i >= 0; i--) ctx.lineTo(CW_BX[i], CW_BY[i]); ctx.closePath(); fillPaper(1); strokeC(LW.mid * 0.9, INK, 1);
    bp(); for (i = 3; i < CW_N; i += 3) { ctx.moveTo(CW_TX[i], CW_TY[i]); ctx.lineTo(CW_BX[i], CW_BY[i]); } strokeC(LW.thin * 0.7, G1, 0.8);
    i = Math.round((aa + 1.0) / 2.0 * CW_N); i = clamp(i, 0, CW_N); bp(); ctx.arc(CW_TX[i], CW_TY[i], 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('curvedWall', { draw: drawCurvedWall, box: [0.91, 0.54], tags: ['wall', 'curve', 'light', 'notch'] }, 9);

  /* sheetStack: five opaque sheets stacked with air between them; they slide and turn against each other */
  function drawSheetStack(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u, i, k, y, dx, dz, a, ca, sa, X0, Z0, sx, sz;
    begin(c, p, { tilt: -0.55, spin: 0.5, soft: 0.5, persp: 7, off: [0, 0] });
    for (i = 0; i < 5; i++) {
      y = 0.27 - i * 0.12; dx = 0.13 * sin(ph + i * 1.3); dz = 0.07 * sin(ph + i * 0.8 + 1.0); a = 0.28 * sin(ph + i * 0.9 + 0.5); ca = cos(a); sa = sin(a);
      for (k = 0; k < 4; k++) { sx = k === 0 || k === 3 ? -0.27 : 0.27; sz = k < 2 ? -0.18 : 0.18; X0 = dx + sx * ca + sz * sa; Z0 = dz - sx * sa + sz * ca; setRP(k, X0, y + 0.016, Z0); RP_R[k] = 0.03 * SC * F; }
      bp(); roundPolyPath(4); fillC(INK, 1);
      for (k = 0; k < 4; k++) { sx = k === 0 || k === 3 ? -0.27 : 0.27; sz = k < 2 ? -0.18 : 0.18; X0 = dx + sx * ca + sz * sa; Z0 = dz - sx * sa + sz * ca; setRP(k, X0, y, Z0); RP_R[k] = 0.03 * SC * F; }
      bp(); roundPolyPath(4); fillC(i === 2 ? G4 : PAPER, 1); strokeC(LW.mid * 0.7, INK, 1);
    }
    bp(); ctx.arc(RP_X[1] * 0.7 + RP_X[2] * 0.3, RP_Y[1] * 0.7 + RP_Y[2] * 0.3, 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('sheetStack', { draw: drawSheetStack, box: [0.76, 0.68], tags: ['sheets', 'layers', 'stack', 'slide'] }, 8);

  /* tetraWire: a wire octahedron that breathes in height while it turns; hidden edges dashed and ghosted */
  var TW_V = new Float64Array(18), TW_S = new Float64Array(12), TW_F = new Float64Array(8);
  function drawTetraWire(c, p) {
    var u = frac((+p.t || 0) / 9), ph = TAU * u, a = 0.34, b = 0.3 + 0.1 * sin(ph), i, f, sx, sy, sz, nl, A, B, C_, sa, sb, sc, ia, ib, f0, f1, vis, q;
    begin(c, p, { tilt: -0.5, spin: PI / 2 * u + 0.3, soft: 0.5, persp: 8, off: [0, 0] });
    for (i = 0; i < 6; i++) {
      sx = i === 0 ? a : i === 1 ? -a : 0; sy = i === 2 ? b : i === 3 ? -b : 0; sz = i === 4 ? a : i === 5 ? -a : 0;
      R(sx, sy, sz); TW_V[3 * i] = RX; TW_V[3 * i + 1] = RY; TW_V[3 * i + 2] = RZ; q = PERSP / (PERSP - RZ); TW_S[2 * i] = RX * q * SC + OFX; TW_S[2 * i + 1] = RY * q * SC + OFY;
    }
    for (f = 0; f < 8; f++) { R((f & 1 ? -1 : 1) / a, (f & 2 ? -1 : 1) / b, (f & 4 ? -1 : 1) / a); nl = sqrt(RX * RX + RY * RY + RZ * RZ); TW_F[f] = RZ / nl; }
    // ink-tinted floor ring
    bp(); circ3(0, 0.36, 0, 0.45, 1, 0, 0, 0, 0, 1, 0, TAU, 32); dots(5.2); strokeC(LW.thin * 0.9, G1, 0.8); nodash();
    for (q = 0; q < 2; q++) {
      bp();
      for (A = 0; A < 3; A++) for (B = A + 1; B < 3; B++) for (sa = 0; sa < 2; sa++) for (sb = 0; sb < 2; sb++) {
        C_ = 3 - A - B; ia = A * 2 + sa; ib = B * 2 + sb; f0 = 0; f1 = 0;
        f0 |= sa << A; f0 |= sb << B; f1 = f0 | (1 << C_);
        vis = max(sstep(-0.03, 0.03, TW_F[f0]), sstep(-0.03, 0.03, TW_F[f1]));
        if (q === 0 ? vis > 0.5 : vis <= 0.5) continue;
        ctx.moveTo(TW_S[2 * ia], TW_S[2 * ia + 1]); ctx.lineTo(TW_S[2 * ib], TW_S[2 * ib + 1]);
      }
      if (q === 0) { dash(4.6, 4.6); strokeC(LW.hair * 1.2, G1, 0.9); nodash(); } else strokeC(LW.mid * 0.85, INK, 1);
    }
    bp(); for (i = 0; i < 6; i++) { ctx.moveTo(TW_S[2 * i] + DM * 3.2, TW_S[2 * i + 1]); ctx.arc(TW_S[2 * i], TW_S[2 * i + 1], DM * 3.2, 0, TAU); } fillPaper(1); strokeC(LW.thin * 0.8, INK, 1);
    bp(); ctx.arc(TW_S[6], TW_S[7], 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('tetraWire', { draw: drawTetraWire, box: [0.88, 0.92], tags: ['wire', 'octahedron', 'rotation', 'volume'] }, 9);

  /* rollingSphere: a sphere with one seam rolls to and fro along a shallow curved track, with a flat contact shadow */
  function drawRollingSphere(c, p) {
    beginFlat(c, p);
    var u = frac((+p.t || 0) / 8), ph = TAU * u, xb = 0.36 * sin(ph), r = 0.1, sl, nl, nx, ny, tx, ty, cxb, cyb, i, x, th;
    function tr(xx) { return 0.36 - 0.18 * (xx / 0.46) * (xx / 0.46); }
    sl = -0.36 * xb / 0.2116; nl = sqrt(1 + sl * sl); nx = -sl / nl; ny = -1 / nl; tx = xb; ty = tr(xb); cxb = tx + nx * r; cyb = ty + ny * r;
    CN = 0; for (i = 0; i <= 26; i++) { x = -0.46 + 0.92 * i / 26; fcp(x, tr(x)); } bp(); curveOut(false, true); strokeC(LW.mid * 0.9, INK, 1);
    flatEll(tx + 0.03, ty + 0.014, 0.12, 0.026, atan2(sl, 1)); fillC(G3, 1);
    flatEll(cxb, cyb, r, r, 0); fillPaper(1); strokeC(LW.mid * 0.95, INK, 1);
    th = -xb / r; flatEll(cxb, cyb, r * 0.4, r * 0.96, th); strokeC(LW.thin * 0.9, G1, 1);
    bp(); ctx.arc(fx(cxb + 0.62 * r * sin(th + 1.3)), fy(cyb - 0.62 * r * cos(th + 1.3)), 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('rollingSphere', { draw: drawRollingSphere, box: [1.02, 0.33], tags: ['sphere', 'roll', 'track', 'shadow'] }, 8);

  /* breathingArcs: five open arcs, not concentric, each turning at its own pace, widening and narrowing */
  function drawBreathingArcs(c, p) {
    beginFlat(c, p);
    var u = frac((+p.t || 0) / 8), ph = TAU * u, KS = [1, -1, 2, -1, 1], i, j, m = 40, r, cxi, cyi, a0, span, a;
    for (i = 0; i < 5; i++) {
      r = (0.14 + 0.075 * i) * (1 + 0.07 * sin(ph + i * 1.3)); cxi = -0.14 + 0.07 * i; cyi = 0.1 - 0.05 * i; a0 = TAU * u * KS[i] + i * 1.3; span = 1.5 + 0.9 * (0.5 + 0.5 * sin(ph + i)); CN = 0;
      for (j = 0; j <= m; j++) { a = a0 + span * j / m; fcp(cxi + r * cos(a), cyi + r * sin(a)); WD[j] = K * LW.mid * (0.55 + 0.25 * i) * (0.12 + 0.88 * spw(j / m, 0.7)); }
      bp(); ribbonOut(m + 1); fillC(i % 2 ? G1 : INK, 1);
      if (i === 0 || i === 3) { a = a0 + span; bp(); ctx.arc(fx(cxi + r * cos(a)), fy(cyi + r * sin(a)), 0.0165 * SC * DM, 0, TAU); fillC(INK, 1); }
    }
    end();
  }
  reg('breathingArcs', { draw: drawBreathingArcs, box: [0.91, 0.93], tags: ['arcs', 'breath', 'offset', 'line'] }, 8);

  /* dotCompass: dotted arcs about a pivot, a sweeping line and a dot that rides the middle arc */
  function drawDotCompass(c, p) {
    beginFlat(c, p);
    var u = frac((+p.t || 0) / 8), ph = TAU * u, px = -0.3, py = 0.26, RS = [0.26, 0.44, 0.62], th = -0.78 + 0.5 * sin(ph), i, j, a, k;
    for (i = 0; i < 3; i++) { CN = 0; for (j = 0; j <= 14; j++) { a = -1.42 + 1.3 * j / 14; fcp(px + RS[i] * cos(a), py + RS[i] * sin(a)); } bp(); curveOut(false, true); dots(5.2); strokeC(LW.thin * 0.95, i === 1 ? INK : G1, 1); nodash(); }
    bp(); ctx.moveTo(fx(px), fy(py)); ctx.lineTo(fx(px + 0.64 * cos(th)), fy(py + 0.64 * sin(th))); strokeC(LW.thin, INK, 1);
    bp(); for (k = 0; k < 2; k++) { i = k * 2; ctx.moveTo(fx(px + RS[i] * cos(th)) + DM * 3.4, fy(py + RS[i] * sin(th))); ctx.arc(fx(px + RS[i] * cos(th)), fy(py + RS[i] * sin(th)), DM * 3.4, 0, TAU); } fillPaper(1); strokeC(LW.thin * 0.9, INK, 1);
    bp(); ctx.arc(fx(px + RS[1] * cos(th)), fy(py + RS[1] * sin(th)), 0.0165 * SC * DM, 0, TAU); fillC(INK, 1);
    bp(); ctx.arc(fx(px), fy(py), DM * 3.6, 0, TAU); fillPaper(1); strokeC(LW.mid * 0.8, INK, 1);
    end();
  }
  reg('dotCompass', { draw: drawDotCompass, box: [0.62, 0.62], tags: ['compass', 'dotted', 'arcs', 'sweep'] }, 8);

  /* shadowSweep: a slender block on a floor plate; a hard-edged shadow wedge sweeps once round it as the sun marker circles on a dotted ring */
  function drawShadowSweep(c, p) {
    var u = frac((+p.t || 0) / 8), ph = TAU * u, fl = 0.22, th = ph + 0.4, len = 0.22 + 0.18 * (0.5 - 0.5 * cos(2 * ph)), i, j, hn, n = 0, cx0, cz0, hw = 0.07;
    begin(c, p, { tilt: -0.55, spin: 0.45, soft: 0.5, persp: 7, off: [0, 0] });
    BV[0] = M[6]; BV[1] = M[7]; BV[2] = M[8];
    bp(); mv(-0.46, fl, -0.34); ln(0.46, fl, -0.34); ln(0.46, fl, 0.34); ln(-0.46, fl, 0.34); ctx.closePath(); fillPaper(1); strokeC(LW.thin, G1, 1);
    bp(); circ3(0, fl, 0, 0.4, 1, 0, 0, 0, 0, 1, 0, TAU, 36); dots(5.2); strokeC(LW.thin * 0.9, G1, 0.9); nodash();
    for (j = 0; j < 4; j++) { cx0 = j & 1 ? hw : -hw; cz0 = j & 2 ? hw : -hw; P(cx0, fl, cz0); MQ_HX[n] = X; MQ_HY[n] = Y; n++; P(cx0 + cos(th) * len, fl, cz0 + sin(th) * len * 0.8); MQ_HX[n] = X; MQ_HY[n] = Y; n++; }
    hn = hull2(MQ_HX, MQ_HY, n, MQ_HO); bp(); for (j = 0; j < hn; j++) { if (j === 0) ctx.moveTo(MQ_HX[MQ_HO[j]], MQ_HY[MQ_HO[j]]); else ctx.lineTo(MQ_HX[MQ_HO[j]], MQ_HY[MQ_HO[j]]); } ctx.closePath(); fillC(G3, 1);
    boxVisible(-hw, fl - 0.3, -hw, hw, fl, hw, PAPER, PAPER, PAPER, INK, LW.mid * 0.9, 1, 1);
    P(0.4 * cos(th + PI), fl, 0.4 * sin(th + PI)); bp(); ctx.arc(X, Y, 0.0165 * SC * DM * F, 0, TAU); fillC(INK, 1);
    end();
  }
  reg('shadowSweep', { draw: drawShadowSweep, box: [1.11, 0.59], tags: ['shadow', 'sun', 'light', 'sweep'] }, 8);

  /* mobileBalance: three shapes hung from two bars on slanted wires, swaying out of phase (the small solid disc is the accent) */
  function drawMobileBalance(c, p) {
    beginFlat(c, p);
    var u = frac((+p.t || 0) / 9), ph = TAU * u, a1 = 0.2 * sin(ph), a2 = 0.28 * sin(ph + 1.2), b1y = -0.28, lx, ly, rx, ry, p2x, p2y, l2x, l2y, r2x, r2y, w, ex, ey;
    function sw(k) { return 0.24 * sin(ph + k * 1.7 + 0.5); }
    lx = -0.32 * cos(a1); ly = b1y - 0.32 * sin(a1); rx = 0.32 * cos(a1); ry = b1y + 0.32 * sin(a1);
    w = sw(0); p2x = rx + sin(w) * 0.14; p2y = ry + cos(w) * 0.14; l2x = p2x - 0.2 * cos(a2); l2y = p2y - 0.2 * sin(a2); r2x = p2x + 0.2 * cos(a2); r2y = p2y + 0.2 * sin(a2);
    bp(); ctx.moveTo(fx(0), fy(-0.43)); ctx.lineTo(fx(0), fy(b1y)); ctx.moveTo(fx(rx), fy(ry)); ctx.lineTo(fx(p2x), fy(p2y));
    w = sw(1); ex = lx + sin(w) * 0.17; ey = ly + cos(w) * 0.17; ctx.moveTo(fx(lx), fy(ly)); ctx.lineTo(fx(ex), fy(ey));
    bp(); strokeC(LW.thin * 0.8, INK, 1);
    bp(); ctx.moveTo(fx(0), fy(-0.43)); ctx.lineTo(fx(0), fy(b1y)); ctx.moveTo(fx(rx), fy(ry)); ctx.lineTo(fx(p2x), fy(p2y)); ctx.moveTo(fx(lx), fy(ly)); ctx.lineTo(fx(ex), fy(ey));
    w = sw(2); var mx = l2x + sin(w) * 0.13, my = l2y + cos(w) * 0.13; ctx.moveTo(fx(l2x), fy(l2y)); ctx.lineTo(fx(mx), fy(my));
    w = sw(3); var qx = r2x + sin(w) * 0.19, qy = r2y + cos(w) * 0.19; ctx.moveTo(fx(r2x), fy(r2y)); ctx.lineTo(fx(qx), fy(qy)); strokeC(LW.thin * 0.8, INK, 1);
    bp(); ctx.moveTo(fx(lx), fy(ly)); ctx.lineTo(fx(rx), fy(ry)); ctx.moveTo(fx(l2x), fy(l2y)); ctx.lineTo(fx(r2x), fy(r2y)); strokeC(LW.mid * 0.8, INK, 1);
    flatEll(ex + 0.02, ey + 0.045, 0.13, 0.05, -0.35 + 0.2 * sin(ph + 1)); fillC(G4, 1); strokeC(LW.mid * 0.8, INK, 1);
    flatEll(mx, my + 0.065, 0.065, 0.065, 0); fillC(INK, 1);
    flatEll(qx - 0.01, qy + 0.06, 0.1, 0.06, 0.4 * sin(ph + 2)); fillPaper(1); strokeC(LW.mid * 0.8, INK, 1);
    bp(); ctx.arc(fx(0), fy(-0.455), 0.028 * SC * DM, 0, TAU); fillPaper(1); strokeC(LW.thin * 0.9, INK, 1);
    bp(); ctx.arc(fx(0), fy(b1y), DM * 3.2, 0, TAU); fillPaper(1); strokeC(LW.thin * 0.8, INK, 1);
    bp(); ctx.arc(fx(p2x), fy(p2y), DM * 3.2, 0, TAU); fillPaper(1); strokeC(LW.thin * 0.8, INK, 1);
    end();
  }
  reg('mobileBalance', { draw: drawMobileBalance, box: [1.12, 0.75], tags: ['mobile', 'balance', 'sway', 'shapes'] }, 9);

  /*SMALL-END*/
  GA.propsD = { names: NAMES, period: PERIOD, center: CENTER, kit: { begin: begin, end: end, P: P } };
  GA.propsD.bounds = function (name, p) {
    var rec = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, globalAlpha: 1, lineDashOffset: 0 };
    function pt(x, y) { if (x < rec.x0) rec.x0 = x; if (x > rec.x1) rec.x1 = x; if (y < rec.y0) rec.y0 = y; if (y > rec.y1) rec.y1 = y; }
    rec.moveTo = rec.lineTo = pt; rec.quadraticCurveTo = function (a, b, x, y) { pt(x, y); }; rec.bezierCurveTo = function (a, b, c, d, x, y) { pt(x, y); };
    rec.arc = function (x, y, r) { pt(x - r, y - r); pt(x + r, y + r); }; rec.arcTo = function (x1, y1, x2, y2) { pt(x2, y2); }; rec.rect = function (x, y, w, h) { pt(x, y); pt(x + w, y + h); };
    ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke', 'clip', 'setLineDash', 'fillRect', 'strokeRect', 'translate', 'scale', 'rotate', 'transform'].forEach(function (n) { rec[n] = function () {}; });
    GA.props.draw(name, rec, p);
    return rec;
  };
})();


/* ===== props_e.js ===== */
/* props_e.js -- small FREEHAND ICONS: hand-drawn, brush-pen style line icons (ink on paper) for the swirling mind of the girl who reads, plays tennis, drinks chai and designs spaces.
   Classic script; needs util.js + style.js.  Registers into the same GA.props registry as props_a..d:  GA.props.register(name, { draw, box, tags:['icon','freehand',..], hero:false, abstract:false, period }).
   Every icon is ORIGINAL line work drawn on a 24-unit grid (no third-party artwork), in the spirit of freehand line-icon sets: a modulated stroke (thick middle, thin ends, slight pressure wobble along
   each stroke), gentle seeded wobble, round caps, small overshoots at stroke ends and corners, imperfect loop closings, a few tiny hatch lines and one flat dark accent here and there.
   draw(ctx, p) paints at the ctx origin in WORLD units:  p = { s, t, seed, rot:[rx,ry,rz], alpha, lw }
     s     nominal size = the full 24-unit grid (the ink spans roughly 0.8-0.9 of s); designed for s = 40-90, line weight floor 1.6 units so it stays crisp at s = 40
     t     seconds since the icon appeared: phase = t mod period.  DRAW-ON: the strokes draw themselves one after the other in ~0.75 s, the icon then holds with a sketchy 'boil' (the wobble is
           re-jittered with a quantised seed every 0.18 s, cached per step), and erases in the last ~0.75 s of its period (5-9 s); the next cycle redraws it with a new wobble seed (from p.seed + cycle).
     lw    stroke weight multiplier;  rot[2] roll (soft-limited, the icons are flat: rx / ry are ignored);  alpha multiplies the context alpha.
   Deterministic (hash noise, no Math.random), no per-frame allocations in the hot path (cached geometry per icon / seed / boil step), 0.01-0.06 ms per icon.
   Exports: GA.propsE = { names, period, bounds(name, p) }. */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util, ST = GA.style;
  var TAU = Math.PI * 2, PI = Math.PI;
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, min = Math.min, max = Math.max, floor = Math.floor, ceil = Math.ceil, pow = Math.pow, round = Math.round, tanh = Math.tanh;
  var NAMES = [], PERIOD = {}, ICONS = {};
  var BOX = {/*BOX-BEGIN*/ icPencil: [0.7, 0.69], icRuler: [0.91, 0.65], icSetSquare: [0.72, 0.73], icCompass: [0.77, 0.96], icScissors: [0.74, 0.83], icMagnifier: [0.82, 0.8], icNotebook: [0.68, 0.83], icOpenBook: [0.81, 0.69], icClosedBook: [0.62, 0.89], icLightbulb: [0.94, 0.9], icRacket: [0.83, 0.84], icTennisBall: [0.9, 0.76], icChaiGlass: [0.7, 0.96], icCoffeeCup: [0.79, 0.93], icLaptop: [0.88, 0.72], icEraser: [0.85, 0.8], icTablet: [0.58, 0.82], icPaperPlane: [0.86, 0.83], icBoat: [0.89, 0.85], icCube: [0.74, 0.83], icEye: [0.85, 0.72], icHeadSpiral: [0.73, 0.83], icPuzzle: [0.77, 0.72], icKey: [0.78, 0.78], icInfinity: [0.87, 0.3], icRefresh: [0.76, 0.7], icSparkle: [0.89, 0.9], icHeadphones: [0.85, 0.8], icCamera: [0.83, 0.68], icPlant: [0.65, 0.85], icBrush: [0.81, 0.83], icCloud: [0.82, 0.58] /*BOX-END*/};      // ink extents (w, h as multiples of s, pixel-measured), filled in by the build
  var INK = '#151412', PAPER = '#faf8f3';
  var ctx = null, A0 = 1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function hashI(a, b) { var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return h | 0; }
  function r01(a, b) { return (hashI(a, b) >>> 0) / 4294967296; }
  function nz(x, seed) { return U.noise1(x, seed); }

  /* ------------------------------------------------------------------ geometry builders (flat [x, y, x, y, ...] point lists on the 24 grid, y down) */
  function arc(cx, cy, r, a0, a1, n) { var o = [], i, a; n = n || max(4, ceil(abs(a1 - a0) * r / 2.4)); for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; o.push(cx + r * cos(a), cy + r * sin(a)); } return o; }
  function ell(cx, cy, rx, ry, rot, a0, a1, n) {
    var o = [], cr = cos(rot), sr = sin(rot), i, a, x, y; n = n || max(5, ceil(abs(a1 - a0) * max(rx, ry) / 2.4));
    for (i = 0; i <= n; i++) { a = a0 + (a1 - a0) * i / n; x = rx * cos(a); y = ry * sin(a); o.push(cx + x * cr - y * sr, cy + x * sr + y * cr); }
    return o;
  }
  function ring(cx, cy, rx, ry, rot, n) {            // n points around (no duplicate): for closed smooth strokes
    var o = [], cr = cos(rot), sr = sin(rot), i, a, x, y;
    for (i = 0; i < n; i++) { a = TAU * i / n - 1.1; x = rx * cos(a); y = ry * sin(a); o.push(cx + x * cr - y * sr, cy + x * sr + y * cr); }
    return o;
  }
  function spiral(cx, cy, r0, r1, turns, a0, n) { var o = [], i, q, a, r; for (i = 0; i <= n; i++) { q = i / n; a = a0 + TAU * turns * q; r = r0 + (r1 - r0) * q; o.push(cx + r * cos(a), cy + r * sin(a)); } return o; }
  function xf(pts, cx, cy, ang, ox, oy, sx, sy) {      // local -> grid: (p - (ox, oy)) scaled, rotated by ang, moved to (cx, cy)
    var o = [], i, c = cos(ang), s = sin(ang), x, y; sx = sx || 1; sy = sy || sx;
    for (i = 0; i < pts.length; i += 2) { x = (pts[i] - ox) * sx; y = (pts[i + 1] - oy) * sy; o.push(cx + x * c - y * s, cy + x * s + y * c); }
    return o;
  }
  function rectp(x0, y0, x1, y1) { return [x0, y0, x1, y0, x1, y1, x0, y1]; }
  function lerp2(a, b, t) { return a + (b - a) * t; }

  /* ------------------------------------------------------------------ stroke specs */
  function mkS(kind, closed, pts, o) { o = o || {}; return { kind: kind, closed: closed, pts: pts, w: o.w === undefined ? 1 : o.w, f: o.f || '', ov: o.ov === undefined ? 1 : o.ov }; }
  function sm(p, o) { return mkS('s', false, p, o); }       // smooth open stroke
  function smc(p, o) { return mkS('s', true, p, o); }       // smooth closed loop (drawn with a small overlap, imperfect closing)
  function pl(p, o) { return mkS('p', false, p, o); }       // polyline, corners kept
  function plc(p, o) { return mkS('p', true, p, o); }       // closed polyline
  /* options: w = weight factor (0 = fill only, no ink); f = 'p' paper fill (opaque, behind the ink) | 'k' flat ink accent fill; ov = overshoot factor (0 = none) */

  /* dense sampling of one stroke (grid units, unwobbled): x0 / y0 / u (arc fraction) / L (length) / ch (chunks: index ranges drawn as separate ribbons) */
  function buildStroke(st) {
    var P = st.pts, n = P.length >> 1, xs = [], ys = [], ch = [], i, j, m, d, t, i0, i1, i2, i3, t2, t3, segs, cnt, ov;
    function cr(a, b, c, d2, tt) { return 0.5 * (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d2) * tt * tt + (-a + 3 * b - 3 * c + d2) * tt * tt * tt); }
    if (st.kind === 's') {
      segs = st.closed ? n : n - 1;
      for (i = 0; i < segs; i++) {
        i0 = st.closed ? (i + n - 1) % n : (i > 0 ? i - 1 : 0); i1 = i; i2 = st.closed ? (i + 1) % n : i + 1; i3 = st.closed ? (i + 2) % n : (i + 2 < n ? i + 2 : n - 1);
        d = Math.sqrt(Math.pow(P[2 * i2] - P[2 * i1], 2) + Math.pow(P[2 * i2 + 1] - P[2 * i1 + 1], 2)); m = clamp(ceil(d / 1.9), 1, 9);
        for (j = 0; j < m; j++) { t = j / m; xs.push(cr(P[2 * i0], P[2 * i1], P[2 * i2], P[2 * i3], t)); ys.push(cr(P[2 * i0 + 1], P[2 * i1 + 1], P[2 * i2 + 1], P[2 * i3 + 1], t)); }
      }
      if (!st.closed) { xs.push(P[2 * n - 2]); ys.push(P[2 * n - 1]); }
      else { cnt = xs.length; ov = max(2, round(cnt * 0.07)); for (i = 0; i <= ov; i++) { xs.push(xs[i]); ys.push(ys[i]); } }
      ch.push([0, xs.length - 1]);
    } else {
      var pp = st.closed ? P.concat([P[0], P[1]]) : P, nn = pp.length >> 1;
      for (i = 0; i < nn - 1; i++) {
        d = Math.sqrt(Math.pow(pp[2 * i + 2] - pp[2 * i], 2) + Math.pow(pp[2 * i + 3] - pp[2 * i + 1], 2)); m = max(1, ceil(d / 2.2));
        ch.push([xs.length, xs.length + m]);
        for (j = 0; j < m; j++) { t = j / m; xs.push(lerp2(pp[2 * i], pp[2 * i + 2], t)); ys.push(lerp2(pp[2 * i + 1], pp[2 * i + 3], t)); }
      }
      xs.push(pp[2 * nn - 2]); ys.push(pp[2 * nn - 1]);
    }
    var N = xs.length, u = new Float32Array(N), L = 0;
    for (i = 1; i < N; i++) { L += Math.sqrt(Math.pow(xs[i] - xs[i - 1], 2) + Math.pow(ys[i] - ys[i - 1], 2)); u[i] = L; }
    if (L < 1e-6) L = 1e-6;
    for (i = 0; i < N; i++) u[i] /= L;
    st.x0 = Float32Array.from(xs); st.y0 = Float32Array.from(ys); st.u = u; st.L = L; st.ch = ch;
  }
  function prep(ic) {
    var k, st, tot = 0, cum = 0;
    for (k = 0; k < ic.strokes.length; k++) { st = ic.strokes[k]; buildStroke(st); if (st.w > 0) tot += st.L; }
    for (k = 0; k < ic.strokes.length; k++) { st = ic.strokes[k]; if (st.w > 0) { st.cum = cum / tot; cum += st.L; } else st.cum = 0; }
    ic.tot = tot; ic.built = true;
  }

  /* wobbled geometry, cached per (icon, cycle seed, boil step): a steady hand wobble (seed per cycle) + a small boil (seed per 0.18 s step) */
  var GEO = {}, GEON = 0;
  var A_WOB = 0.23, A_BOIL = 0.08;
  function geo(ic, seedB, step) {
    var key = ic.id + '|' + seedB + '|' + step, g = GEO[key], k, st, n, X, Y, PN, i, a, u, dx, dy, c, seedS, nc, es, ee, e0, e1;
    if (g) return g;
    if (GEON > 320) { GEO = {}; GEON = 0; }
    g = { x: [], y: [], pn: [], es: [], ee: [] }; seedS = hashI(seedB, step * 7 + 3);
    for (k = 0; k < ic.strokes.length; k++) {
      st = ic.strokes[k]; n = st.x0.length; X = new Float32Array(n); Y = new Float32Array(n); PN = new Float32Array(n);
      for (i = 0; i < n; i++) {
        u = st.u[i]; a = st.L * u;
        dx = A_WOB * nz(a / 3.4 + k * 5.7, seedB) + A_BOIL * nz(a / 2.4 + k * 2.3, seedS);
        dy = A_WOB * nz(a / 3.4 + k * 5.7 + 91.3, seedB) + A_BOIL * nz(a / 2.4 + k * 2.3 + 57.1, seedS);
        X[i] = st.x0[i] + dx; Y[i] = st.y0[i] + dy; PN[i] = nz(a / 4.2 + 37 + k * 3.3, seedB);
      }
      if (!st.closed || st.kind === 's') {      // loose ends: the first and last points drift a little (imperfect joins)
        X[0] += (r01(seedB, k * 11 + 1) - 0.5) * 0.5; Y[0] += (r01(seedB, k * 11 + 2) - 0.5) * 0.5; X[n - 1] += (r01(seedB, k * 11 + 3) - 0.5) * 0.5; Y[n - 1] += (r01(seedB, k * 11 + 4) - 0.5) * 0.5;
      }
      nc = st.ch.length; es = new Float32Array(nc); ee = new Float32Array(nc);
      for (c = 0; c < nc; c++) {
        e0 = st.ov * (0.12 + 0.5 * r01(seedB, k * 131 + c * 7 + 5)); e1 = st.ov * (0.12 + 0.5 * r01(seedB, k * 131 + c * 7 + 9));
        if (st.kind === 'p') { if (c > 0 && r01(seedB, k * 131 + c * 7 + 13) < 0.45) es[c] = e0 * 0.8; else if (c === 0) es[c] = e0; if (c < nc - 1 && r01(seedB, k * 131 + c * 7 + 17) < 0.45) ee[c] = e1 * 0.8; else if (c === nc - 1) ee[c] = e1; }
        else if (!st.closed) { es[c] = e0; ee[c] = e1; }
      }
      g.x.push(X); g.y.push(Y); g.pn.push(PN); g.es.push(es); g.ee.push(ee);
    }
    GEO[key] = g; GEON++;
    return g;
  }

  /* ------------------------------------------------------------------ ribbon (variable width, smooth, round caps): path only, the caller fills */
  var CX = new Float64Array(400), CY = new Float64Array(400), WD = new Float64Array(400), CU = new Float64Array(400), CPN = new Float64Array(400);
  var RLX = new Float64Array(400), RLY = new Float64Array(400), RRX = new Float64Array(400), RRY = new Float64Array(400);
  function curveArr(xs, ys, n, closed, move) {
    var i, i0, i2, i3, last = closed ? n : n - 1;
    if (n < 2) return;
    if (move !== false) ctx.moveTo(xs[0], ys[0]); else ctx.lineTo(xs[0], ys[0]);
    for (i = 0; i < last; i++) {
      i0 = closed ? (i + n - 1) % n : (i > 0 ? i - 1 : 0); i2 = closed ? (i + 1) % n : i + 1; i3 = closed ? (i + 2) % n : (i + 2 < n ? i + 2 : n - 1);
      ctx.bezierCurveTo(xs[i] + (xs[i2] - xs[i0]) / 6, ys[i] + (ys[i2] - ys[i0]) / 6, xs[i2] - (xs[i3] - xs[i]) / 6, ys[i2] - (ys[i3] - ys[i]) / 6, xs[i2], ys[i2]);
    }
    if (closed) ctx.closePath();
  }
  function ribbonOut(n) {
    var i, dx, dy, d, w, a, b, phiE, phi0;
    if (n < 2) return;
    for (i = 0; i < n; i++) {
      a = i > 0 ? i - 1 : 0; b = i < n - 1 ? i + 1 : n - 1;
      dx = CX[b] - CX[a]; dy = CY[b] - CY[a]; d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d; w = WD[i] * 0.5;
      RLX[i] = CX[i] - dy * w; RLY[i] = CY[i] + dx * w; RRX[n - 1 - i] = CX[i] + dy * w; RRY[n - 1 - i] = CY[i] - dx * w;
    }
    curveArr(RLX, RLY, n, false, true);
    phiE = Math.atan2(CY[n - 1] - CY[n - 2], CX[n - 1] - CX[n - 2]); w = WD[n - 1] * 0.5;
    ctx.arc(CX[n - 1], CY[n - 1], w, phiE + PI / 2, phiE - PI / 2, true);
    curveArr(RRX, RRY, n, false, false);
    phi0 = Math.atan2(CY[1] - CY[0], CX[1] - CX[0]); w = WD[0] * 0.5;
    ctx.arc(CX[0], CY[0], w, phi0 - PI / 2, phi0 - 3 * PI / 2, true);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------ drawing */
  var T0 = 0.05, TD = 0.72, ER0 = 0.78, ERW = 0.34, ERD = 0.34, MINW = 1.6;
  var SX = 0, SY = 0, SC = 1, CR = 1, SR = 0, BW = 2, KK = 1, PATH = false;
  function tx(gx, gy) { var x = (gx - 12) * SC, y = (gy - 12) * SC; SX = x * CR - y * SR; SY = x * SR + y * CR; }
  function flushInk() { if (PATH) { ctx.globalAlpha = A0; ctx.fillStyle = INK; ctx.fill(); PATH = false; } }
  function widthAt(u, pn, wf) { var e = 0.58 + 0.42 * pow(sin(PI * (u < 0 ? 0 : u > 1 ? 1 : u)), 0.7), w = BW * wf * e * (1 + 0.15 * pn); return w < MINW ? MINW : w; }

  /** emit one chunk [a, b] of stroke k (with the overshoot extensions) clipped to the visible interval [tail, head] of the stroke's arc fraction */
  function emitChunk(st, g, k, c, tail, head) {
    var X = g.x[k], Y = g.y[k], PN = g.pn[k], a = st.ch[c][0], b = st.ch[c][1], n = 0, i, ux, uy, l, ex, u, lo, hi, px, py, pu, ppn, t, wf = st.w, L = st.L, x1, y1, u1;
    function push(gx, gy, uu, pn) { tx(gx, gy); CX[n] = SX; CY[n] = SY; CU[n] = uu; CPN[n] = pn; n++; }
    // start extension
    ex = g.es[k][c];
    if (ex > 0.01 && b > a) { ux = X[a] - X[min(a + 2, b)]; uy = Y[a] - Y[min(a + 2, b)]; l = Math.sqrt(ux * ux + uy * uy) || 1; push(X[a] + ux / l * ex, Y[a] + uy / l * ex, st.u[a] - ex / L, PN[a]); }
    for (i = a; i <= b; i++) push(X[i], Y[i], st.u[i], PN[i]);
    ex = g.ee[k][c];
    if (ex > 0.01 && b > a) { ux = X[b] - X[max(b - 2, a)]; uy = Y[b] - Y[max(b - 2, a)]; l = Math.sqrt(ux * ux + uy * uy) || 1; push(X[b] + ux / l * ex, Y[b] + uy / l * ex, st.u[b] + ex / L, PN[b]); }
    // clip to [tail, head]
    var m = 0, outX = RLX, outY = RLY, outU = RRX, outP = RRY;   // (scratch arrays reused: they are free until ribbonOut)
    for (i = 0; i < n; i++) {
      u = CU[i];
      if (i > 0 && ((CU[i - 1] < tail && u > tail) || (CU[i - 1] < head && u > head))) {
        if (CU[i - 1] < tail && u > tail) { t = (tail - CU[i - 1]) / (u - CU[i - 1]); outX[m] = CX[i - 1] + (CX[i] - CX[i - 1]) * t; outY[m] = CY[i - 1] + (CY[i] - CY[i - 1]) * t; outU[m] = tail; outP[m] = CPN[i - 1]; m++; }
        if (CU[i - 1] < head && u > head) { t = (head - CU[i - 1]) / (u - CU[i - 1]); outX[m] = CX[i - 1] + (CX[i] - CX[i - 1]) * t; outY[m] = CY[i - 1] + (CY[i] - CY[i - 1]) * t; outU[m] = head; outP[m] = CPN[i - 1]; m++; }
      }
      if (u >= tail && u <= head) { outX[m] = CX[i]; outY[m] = CY[i]; outU[m] = u; outP[m] = CPN[i]; m++; }
    }
    if (m < 2) return;
    for (i = 0; i < m; i++) { CX[i] = outX[i]; CY[i] = outY[i]; WD[i] = widthAt(outU[i], outP[i], wf); }
    if (!PATH) { ctx.beginPath(); PATH = true; }
    ribbonOut(m);
  }
  function fillPoly(st, g, k, col, al) {
    var X = g.x[k], Y = g.y[k], n = X.length, i;
    flushInk(); ctx.beginPath();
    for (i = 0; i < n; i++) { tx(X[i], Y[i]); if (i === 0) ctx.moveTo(SX, SY); else ctx.lineTo(SX, SY); }
    ctx.closePath(); ctx.globalAlpha = A0 * al; ctx.fillStyle = col; ctx.fill();
  }

  function drawIcon(c, p, ic) {
    if (!ic.built) prep(ic);
    ctx = c; INK = ST.INK; PAPER = ST.PAPER;
    var per = ic.period, t = +p.t || 0, s = p.s || 48, rz = (p.rot && p.rot[2]) || 0, k, st, g, ph, cyc, step, seedB, head, tail, t0, d, t1, al, h2, ch, cc;
    ph = ((t % per) + per) % per; cyc = floor(t / per); step = floor(ph / 0.18);
    if (ph > per - 0.04 || ph < 0.005) return;
    A0 = (p.alpha === undefined ? 1 : p.alpha) * (c.globalAlpha === undefined ? 1 : c.globalAlpha);
    SC = s / 24; rz = 0.7 * tanh(rz / 0.7) + 0.02 * sin(TAU * t / per * 2 + (p.seed | 0)); CR = cos(rz); SR = sin(rz);
    KK = p.lw === undefined ? 1 : p.lw; BW = max(1.25 * SC, 2.5) * KK; MINW = 1.85 * min(1, KK + 0.3);
    seedB = hashI(cyc * 131 + ((p.seed | 0) * 17), ic.id * 977);
    g = geo(ic, seedB, step);
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; PATH = false;
    var ersA = 1 - sstep(per - 0.7, per - 0.3, ph);
    for (k = 0; k < ic.strokes.length; k++) {
      st = ic.strokes[k];
      if (st.w <= 0) {                                  // background fill only
        if (st.f === 'p') fillPoly(st, g, k, PAPER, sstep(0.04, 0.3, ph) * ersA);
        continue;
      }
      t0 = T0 + TD * st.cum * 0.92; d = max(0.08, TD * (st.L / ic.tot) * 1.05); head = clamp((ph - t0) / d, 0, 1); head = head * 0.5 + head * head * (3 - 2 * head) * 0.5;
      t1 = per - ER0 + ERW * st.cum; tail = clamp((ph - t1) / ERD, 0, 1);
      if (head <= 0.002 || tail >= 0.999) continue;
      if (st.f === 'p') fillPoly(st, g, k, PAPER, sstep(0.5, 0.95, head) * (1 - sstep(0, 0.4, tail)));
      else if (st.f === 'k') { al = sstep(0.8, 1, head) * (1 - sstep(0, 0.5, tail)); if (al > 0.01) fillPoly(st, g, k, INK, al); }
      for (cc = 0; cc < st.ch.length; cc++) emitChunk(st, g, k, cc, tail <= 0.001 ? -1 : tail, head >= 0.999 ? 2 : head);
    }
    flushInk();
    c.restore();
  }

  function reg(name, per, tags, strokes) {
    var ic = { id: NAMES.length + 1, name: name, period: per, strokes: strokes, built: false, tot: 1 };
    ICONS[name] = ic; NAMES.push(name); PERIOD[name] = per;
    GA.props.register(name, { draw: function (c, p) { drawIcon(c, p, ic); }, box: BOX[name] || [1, 1], tags: ['icon', 'freehand'].concat(tags), hero: false, abstract: false, period: per });
  }

  /* ================================================================== ICONS, set 1 (24 grid, y down; each is a list of strokes: sm / smc smooth, pl / plc corners; o = {w, f, ov}) ================================================================== */
  var BG = { w: 0, f: 'p' }, PF = { f: 'p' }, KF = { f: 'k', w: 0.6 }, HW = { w: 0.5 };

  /* pencil: tip down-left, a wood cone with a dark graphite point, ferrule and eraser */
  (function () {
    var A = -0.785, X0 = 9.6;
    function L(pts, o) { return pl(xf(pts, 12, 12, A, X0, 0, 1, 1), o); }
    reg('icPencil', 6.5, ['pencil', 'write', 'draw'], [
      plc(xf(rectp(4.2, -2.2, 16.4, 2.2), 12, 12, A, X0, 0, 1, 1), BG),
      L([4.2, -2.2, 16.4, -2.2]), L([4.2, 2.2, 16.4, 2.2]), L([4.2, -2.2, 0, 0, 4.2, 2.2]),
      sm(xf([4.2, -2.2, 4.9, 0, 4.2, 2.2], 12, 12, A, X0, 0, 1, 1), { w: 0.6 }),
      plc(xf([0, 0, 1.9, -1, 1.9, 1], 12, 12, A, X0, 0, 1, 1), KF),
      L([16.4, -2.2, 16.4, 2.2]), L([17.7, -2.2, 17.7, 2.2]),
      sm(xf([17.7, -2.2, 19.5, -1.7, 19.8, 0, 19.5, 1.7, 17.7, 2.2], 12, 12, A, X0, 0, 1, 1)),
      L([7.4, -0.7, 13.6, -0.7], HW), L([9.2, 0.9, 12.4, 0.9], HW)
    ]);
  })();

  /* ruler with a few tick marks */
  (function () {
    var A = -0.5, st = [plc(xf(rectp(-9.5, -3, 9.5, 3), 12, 12, A, 0, 0, 1, 1), BG), plc(xf(rectp(-9.5, -3, 9.5, 3), 12, 12, A, 0, 0, 1, 1), PF)], i, x, len;
    for (i = 0; i < 7; i++) { x = -7.2 + 2.4 * i; len = i % 2 === 0 ? 2.6 : 1.5; st.push(pl(xf([x, -3, x, -3 + len], 12, 12, A, 0, 0, 1, 1), { w: 0.6, ov: 0.4 })); }
    st.push(sm(xf([4.6, 0.6, 6.4, 0.2, 8.2, 0.8], 12, 12, A, 0, 0, 1, 1), HW));
    reg('icRuler', 7, ['ruler', 'measure', 'draw'], st);
  })();

  /* set square with a cut-out and a small angle arc */
  reg('icSetSquare', 7.5, ['square', 'draw', 'measure'], [
    plc([4, 4.4, 4, 20, 19.6, 20], BG),
    plc([4, 4.4, 4, 20, 19.6, 20], PF),
    plc([8.2, 11.8, 8.2, 16.2, 12.6, 16.2], { w: 0.8 }),
    sm(arc(4, 20, 4.2, -1.2, -0.1, 6), HW),
    pl([4, 8.6, 5.6, 8.6], HW), pl([4, 12.4, 5.2, 12.4], HW), pl([4, 16.2, 5.6, 16.2], HW)
  ]);

  /* drawing compass */
  reg('icCompass', 6, ['compass', 'draw', 'circle'], [
    pl([12, 5.2, 6.4, 19.8]), pl([12, 5.2, 17.6, 19.8]),
    pl([6.4, 19.8, 6, 22.2], { w: 0.7 }), plc([16.9, 19.4, 18.3, 19.6, 18, 22.2], KF), pl([17.6, 19.8, 18, 22.2], { w: 0.6 }),
    smc(ring(12, 4.4, 1.7, 1.7, 0, 8), PF), pl([12, 2.7, 12, 0.9], { w: 0.8 }),
    sm([8.9, 13.2, 12, 15, 15.1, 13.2], { w: 0.8 }),
    sm(arc(12, 4.4, 17.6, 1.06, 2.08, 8), { w: 0.5, ov: 1.4 })
  ]);

  /* scissors */
  reg('icScissors', 5.5, ['scissors', 'cut', 'craft'], [
    smc(ring(7, 18.3, 3.3, 3.3, 0, 10), PF), smc(ring(17, 18.3, 3.3, 3.3, 0, 10), PF),
    pl([8.9, 15.8, 18.6, 3.4]), pl([15.1, 15.8, 5.4, 3.4]),
    pl([9.4, 15.2, 17.2, 5.4], { w: 0.4, ov: 0.3 }),
    smc(ring(12, 11.8, 0.95, 0.95, 0, 6), KF)
  ]);

  /* magnifier */
  reg('icMagnifier', 6, ['magnifier', 'look', 'search'], [
    smc(ring(10, 10, 6.5, 6.5, 0, 16), { f: 'p', w: 1.1 }),
    pl([14.8, 14.8, 20.9, 20.9], { w: 1.8 }),
    sm(arc(10, 10, 3.9, 3.5, 4.5, 6), { w: 0.6 }),
    pl([7.8, 6.4, 7.8, 6.4], { w: 0.5, ov: 0.2 })
  ]);

  /* spiral notebook with a ribbon and a doodle */
  (function () {
    var st = [plc([6.8, 3.2, 18.6, 3.2, 18.6, 20.8, 6.8, 20.8], BG), plc([6.8, 3.2, 18.6, 3.2, 18.6, 20.8, 6.8, 20.8], PF), plc([15, 3.2, 15, 9.4, 16.4, 8, 17.8, 9.4, 17.8, 3.2], { f: 'k', w: 0.7 })], i;
    for (i = 0; i < 4; i++) st.push(smc(ring(6, 6.4 + 3.9 * i, 1.7, 1.1, 0, 8), { w: 0.75 }));
    st.push(sm([9.8, 15.6, 11.4, 11.6, 13.2, 14.8, 15.4, 10.8], { w: 0.7 }));
    reg('icNotebook', 7, ['notebook', 'sketch', 'book'], st);
  })();

  /* open book */
  reg('icOpenBook', 7.5, ['book', 'read'], [
    sm([12, 6.8, 8.6, 5, 3.6, 5.6, 3.4, 18.2, 8.4, 17.4, 12, 19.2], { w: 0, f: 'p' }), sm([12, 6.8, 15.4, 5, 20.4, 5.6, 20.6, 18.2, 15.6, 17.4, 12, 19.2], { w: 0, f: 'p' }),
    sm([12, 6.8, 8.6, 5, 3.6, 5.6, 3.4, 18.2, 8.4, 17.4, 12, 19.2]), sm([12, 6.8, 15.4, 5, 20.4, 5.6, 20.6, 18.2, 15.6, 17.4, 12, 19.2]),
    pl([12, 6.8, 12, 19.2]),
    sm([5.8, 9.4, 8.2, 8.9, 10.4, 9.8], HW), sm([5.8, 12.4, 8.2, 11.9, 10.4, 12.8], HW), sm([13.6, 9.8, 15.8, 8.9, 18.2, 9.4], HW), sm([13.6, 12.8, 15.8, 11.9, 18.2, 12.4], HW)
  ]);

  /* closed book with a spine band, a round emblem and a hanging ribbon */
  reg('icClosedBook', 8, ['book', 'read'], [
    plc([5.6, 3.4, 18.4, 3.4, 18.4, 20.2, 5.6, 20.2], BG), plc([5.6, 3.4, 18.4, 3.4, 18.4, 20.2, 5.6, 20.2], PF),
    pl([8.6, 3.4, 8.6, 20.2], { w: 0.9 }), plc([5.6, 3.4, 8.6, 3.4, 8.6, 6, 5.6, 6], KF),
    smc(ring(13.6, 9.8, 2.3, 2.3, 0, 8), { w: 0.8 }), sm([11.4, 14.4, 13.6, 15.4, 15.8, 14.4], HW),
    plc([14.2, 20.2, 14.2, 23, 15.5, 21.9, 16.8, 23, 16.8, 20.2], { w: 0.7 })
  ]);

  /* lightbulb with glow ticks */
  reg('icLightbulb', 6, ['idea', 'bulb', 'light'], [
    sm(arc(12, 9.4, 6.5, 2.15, 7.2, 22), PF),
    pl([8.4, 14.8, 9.6, 17.6]), pl([15.9, 14.6, 14.4, 17.6]), pl([9.4, 17.9, 14.6, 17.9]),
    pl([9.7, 19.9, 14.3, 19.9], { w: 0.9 }), pl([10.6, 21.9, 13.4, 21.9], { w: 0.8 }),
    sm([10.6, 17.8, 10.5, 13.8], { w: 0.6 }), sm([13.4, 17.8, 13.5, 13.8], { w: 0.6 }),
    pl([10.5, 13.8, 11.3, 11.8, 12, 13.4, 12.7, 11.8, 13.5, 13.8], { w: 0.7 }),
    pl([12, 0.8, 12, 2.3], { w: 0.8 }), pl([3.7, 3.3, 4.9, 4.5], { w: 0.8 }), pl([20.3, 3.3, 19.1, 4.5], { w: 0.8 }), pl([1.5, 9.4, 3.1, 9.4], { w: 0.8 }), pl([22.5, 9.4, 20.9, 9.4], { w: 0.8 })
  ]);

  /* tennis racket: tilted oval head with strings, throat, handle and grip bands */
  (function () {
    var A = -0.785, cx = 9, cy = 9, st = [], i, x, hy;
    function loc(pts) { return xf(pts, cx, cy, A, 0, 0, 1, 1); }
    st.push(smc(loc(ring(0, 0, 5.3, 6.9, 0, 16)), { w: 0, f: 'p' }));
    for (i = -1; i <= 1; i++) { x = i * 2.7; hy = 6.9 * sqrt(max(0, 1 - (x / 5.3) * (x / 5.3))) - 0.5; st.push(pl(loc([x, -hy, x, hy]), { w: 0.4, ov: 0.2 })); }
    for (i = -1; i <= 1; i++) { x = i * 3.4; hy = 5.3 * sqrt(max(0, 1 - (x / 6.9) * (x / 6.9))) - 0.5; st.push(pl(loc([-hy, x, hy, x]), { w: 0.4, ov: 0.2 })); }
    st.push(smc(loc(ring(0, 0, 5.3, 6.9, 0, 16)), { w: 1.1 }));
    st.push(sm(loc([-1.4, 6.8, -0.5, 8.6, -0.2, 10.4]), { w: 0.8 }), sm(loc([1.4, 6.8, 0.5, 8.6, 0.2, 10.4]), { w: 0.8 }));
    st.push(pl(loc([0, 10.2, 0, 17.4]), { w: 1.7 }));
    st.push(pl(loc([-1.5, 12.6, 1.5, 12.6]), { w: 0.6 }), pl(loc([-1.5, 14.2, 1.5, 14.2]), { w: 0.6 }), pl(loc([-1.5, 15.8, 1.5, 15.8]), { w: 0.6 }));
    reg('icRacket', 7, ['tennis', 'racket', 'sport'], st);
  })();

  /* tennis ball with its two seams and a few speed ticks */
  reg('icTennisBall', 6, ['tennis', 'ball', 'sport'], [
    smc(ring(12.4, 12, 8.3, 8.3, 0, 18), { f: 'p', w: 1.1 }),
    sm(arc(0.9, 12, 10.5, -0.74, 0.74, 8), { w: 0.9 }), sm(arc(23.9, 12, 10.5, PI - 0.74, PI + 0.74, 8), { w: 0.9 }),
    pl([1.2, 8.6, 3.6, 8.6], { w: 0.6 }), pl([0.8, 12.2, 3.4, 12.2], { w: 0.6 }), pl([1.6, 15.6, 3.8, 15.6], { w: 0.6 })
  ]);

  /* chai glass with steam, a liquid line and hatch */
  reg('icChaiGlass', 7, ['chai', 'tea', 'drink'], [
    plc([6.8, 9.3, 17.2, 9.3, 16, 20.6, 8, 20.6], BG), plc([6.8, 9.3, 17.2, 9.3, 16, 20.6, 8, 20.6], PF),
    sm([7.4, 12.4, 12, 13.4, 16.6, 12.4], { w: 0.8 }),
    pl([9, 15.2, 10.2, 17.8], HW), pl([11.6, 15.6, 12.8, 18.6], HW), pl([14, 15.2, 14.8, 17.2], HW),
    sm([9.8, 7.4, 11, 5.2, 9.2, 3.6, 10.6, 1.4], { w: 0.8 }), sm([14, 7.4, 15.2, 5.6, 13.6, 4], { w: 0.7 }),
    sm([4.6, 22, 12, 22.8, 19.4, 22], { w: 0.8 })
  ]);

  /* coffee cup with a saucer */
  reg('icCoffeeCup', 7.5, ['coffee', 'cup', 'drink'], [
    sm([4.8, 9.8, 5, 14, 6.8, 18.2, 10.2, 19.8, 13.2, 19.4, 15.8, 16.4, 16.8, 12.2, 17, 9.8], { f: 'p' }),
    sm([4.4, 9.8, 11, 9.2, 17.4, 9.8], { w: 0.9 }),
    sm(arc(17.2, 13.6, 3.2, -1.45, 1.5, 10), { w: 0.9 }),
    sm([6.2, 11.8, 11, 12.6, 15.8, 11.8], { w: 0.5 }),
    sm([3.2, 21.8, 11, 22.7, 19.4, 21.8], { w: 0.8 }),
    sm([9, 7.2, 10.2, 5, 8.6, 3.2, 9.8, 1.6], { w: 0.8 }), sm([12.8, 7, 14, 5.2, 12.8, 3.8], { w: 0.7 })
  ]);

  /* laptop with a little graph squiggle on the screen */
  reg('icLaptop', 8, ['laptop', 'work', 'screen'], [
    plc([5, 4.6, 19, 4.6, 19, 15.6, 5, 15.6], BG), plc([5, 4.6, 19, 4.6, 19, 15.6, 5, 15.6], PF),
    plc([7.2, 6.8, 16.8, 6.8, 16.8, 13.4, 7.2, 13.4], { w: 0.55 }),
    sm([8.6, 12, 10.4, 9.6, 12.2, 11.2, 14, 8.8, 15.4, 10.2], { w: 0.7 }),
    plc([2.6, 17.2, 21.4, 17.2, 19.8, 20, 4.2, 20], PF), pl([10.4, 18.4, 13.6, 18.4], { w: 0.6 })
  ]);

  /* eraser with a band and crumbs */
  (function () {
    var A = -0.45;
    function L(pts, o) { return pl(xf(pts, 12, 12, A, 0, 0, 1, 1), o); }
    reg('icEraser', 6.5, ['eraser', 'draw', 'fix'], [
      plc(xf(rectp(-8, -4.4, 8, 4.4), 12, 12, A, 0, 0, 1, 1), BG), plc(xf(rectp(-8, -4.4, 8, 4.4), 12, 12, A, 0, 0, 1, 1), PF),
      L([1.4, -4.4, 1.4, 4.4], { w: 0.9 }),
      L([3.8, 2.8, 4.8, -2.6], HW), L([5.8, 3.2, 6.6, -2.2], HW), L([7.2, 3.4, 7.6, -1], HW),
      L([-5.8, 7, -4.6, 7.4], { w: 0.7, ov: 0.2 }), L([-2.4, 7.8, -1.8, 7.6], { w: 0.7, ov: 0.2 }), L([-7.4, 8.2, -7.2, 8.4], { w: 0.7, ov: 0.1 })
    ]);
  })();

  /* ================================================================== ICONS, set 2 ================================================================== */
  function arrowV(tx, ty, ang, l, sp) { return [tx - l * cos(ang - sp), ty - l * sin(ang - sp), tx, ty, tx - l * cos(ang + sp), ty - l * sin(ang + sp)]; }

  /* tablet with a little squiggle on its screen */
  reg('icTablet', 7.5, ['tablet', 'screen', 'sketch'], [
    plc([6.2, 3.2, 17.8, 3.2, 17.8, 20.8, 6.2, 20.8], BG), plc([6.2, 3.2, 17.8, 3.2, 17.8, 20.8, 6.2, 20.8], PF),
    plc([8.1, 5.4, 15.9, 5.4, 15.9, 17.2, 8.1, 17.2], { w: 0.6 }),
    sm([9.4, 13.8, 10.8, 9.8, 12.2, 12.6, 13.6, 8.6, 14.8, 11.2], { w: 0.7 }),
    smc(ring(12, 19.1, 0.75, 0.75, 0, 6), KF)
  ]);

  /* paper plane with a fold, a keel and a curly trail */
  reg('icPaperPlane', 6, ['plane', 'paper', 'send'], [
    plc([3, 11.2, 21, 3, 14.6, 20.8, 11.2, 13.8], BG), plc([3, 11.2, 21, 3, 14.6, 20.8, 11.2, 13.8], PF),
    pl([11.2, 13.8, 21, 3], { w: 0.8 }), pl([11.2, 13.8, 11.7, 18.6], { w: 0.6 }),
    sm([2.2, 19.4, 4.6, 16.6, 7, 17.8, 8.6, 15.4], { w: 0.6 })
  ]);

  /* origami boat on a wavy line, one dark sail panel */
  reg('icBoat', 7, ['boat', 'origami', 'paper'], [
    plc([3, 15.2, 21, 15.2, 17.4, 20.2, 6.6, 20.2], BG), plc([3, 15.2, 21, 15.2, 17.4, 20.2, 6.6, 20.2], PF),
    plc([12, 3.6, 12, 15.2, 5.8, 15.2], PF), pl([12, 6.2, 18.8, 15.2], { w: 0.9 }),
    plc([12.6, 8.4, 17.2, 14.6, 12.6, 14.6], { f: 'k', w: 0.4 }),
    sm([2.4, 22.4, 5, 21.6, 7.4, 22.4, 9.8, 21.6, 12.2, 22.4, 14.6, 21.6, 17, 22.4, 19.4, 21.6, 21.6, 22.2], { w: 0.6 })
  ]);

  /* cube with hatch on one face */
  reg('icCube', 6.5, ['cube', 'volume', 'design'], [
    plc([12, 3, 20, 7.6, 20, 16.6, 12, 21, 4, 16.6, 4, 7.6], BG), plc([12, 3, 20, 7.6, 20, 16.6, 12, 21, 4, 16.6, 4, 7.6], PF),
    pl([12, 12.2, 4, 7.6], { w: 0.85 }), pl([12, 12.2, 20, 7.6], { w: 0.85 }), pl([12, 12.2, 12, 21], { w: 0.85 }),
    pl([14.2, 15.6, 17.8, 13.6], HW), pl([14.2, 18.2, 17.8, 16.2], HW), pl([14.2, 13.2, 17.8, 11.2], HW)
  ]);

  /* eye with lashes, an iris, a dark pupil and a highlight */
  reg('icEye', 6.5, ['eye', 'look', 'visual'], [
    smc([2.4, 12, 6.6, 7.4, 12, 5.8, 17.4, 7.4, 21.6, 12, 17.4, 16.8, 12, 18.4, 6.6, 16.8], BG), smc([2.4, 12, 6.6, 7.4, 12, 5.8, 17.4, 7.4, 21.6, 12, 17.4, 16.8, 12, 18.4, 6.6, 16.8], PF),
    smc(ring(12, 12.1, 4.1, 4.1, 0, 12), { w: 0.9 }), smc(ring(12, 12.1, 1.7, 1.7, 0, 8), KF), sm(arc(12, 12.1, 2.8, 3.7, 4.6, 5), { w: 0.5 }),
    pl([12, 2.2, 12, 3.9], { w: 0.8 }), pl([6.2, 3.8, 7.3, 5.3], { w: 0.8 }), pl([17.8, 3.8, 16.7, 5.3], { w: 0.8 })
  ]);

  /* head in profile with a spiral inside (thinking) */
  reg('icHeadSpiral', 8, ['head', 'mind', 'think'], [
    sm([8.2, 21.4, 6.4, 17.4, 5, 12.4, 6.4, 7.4, 10.4, 4, 15.6, 4.2, 19, 7.6, 19.6, 11.2, 21.6, 14.2, 19.4, 15, 19.8, 17.4, 17, 18.6, 16.6, 21.6], { f: 'p' }),
    sm(spiral(11.4, 10.6, 0.5, 4.2, 1.9, 0.5, 26), { w: 0.9 })
  ]);

  /* jigsaw puzzle piece */
  reg('icPuzzle', 7, ['puzzle', 'solve', 'piece'], [
    plc([4.8, 7.2, 19.2, 7.2, 19.2, 19.2, 4.8, 19.2], BG),
    sm([4.8, 7.2, 9.6, 7.2, 10.4, 5.6, 12, 4.2, 13.6, 5.6, 14.4, 7.2, 19.2, 7.2]),
    sm([19.2, 7.2, 19.2, 10.2, 20.8, 10.8, 21.6, 12.4, 20.8, 14, 19.2, 14.6, 19.2, 19.2]),
    pl([19.2, 19.2, 4.8, 19.2]),
    sm([4.8, 19.2, 4.8, 14.4, 6.6, 13.8, 7.4, 12.4, 6.6, 11, 4.8, 10.4, 4.8, 7.2]),
    pl([9, 10.6, 11.2, 9.6], HW), pl([9, 13.4, 12.6, 11.4], HW)
  ]);

  /* key */
  reg('icKey', 6.5, ['key', 'unlock', 'solve'], [
    smc(ring(7.6, 7.6, 4, 4, 0, 12), PF), smc(ring(7.6, 7.6, 1.5, 1.5, 0, 8), { w: 0.7 }),
    pl([10.6, 10.6, 20.6, 20.6], { w: 1.2 }), pl([15.2, 15.2, 17.4, 13], { w: 0.9 }), pl([18.2, 18.2, 20.2, 16], { w: 0.9 })
  ]);

  /* infinity loop with a small ink dot */
  (function () {
    var pts = [], i, a, d;
    for (i = 0; i < 20; i++) { a = TAU * i / 20; d = 1 + sin(a) * sin(a); pts.push(12 + 9.6 * cos(a) / d, 12 + 7.6 * sin(a) * cos(a) / d); }
    reg('icInfinity', 6, ['infinity', 'loop', 'iterate'], [smc(pts, { w: 1.1 }), smc(ring(19.8, 12, 0.9, 0.9, 0, 6), KF)]);
  })();

  /* circular refresh arrows (iteration) */
  reg('icRefresh', 6, ['refresh', 'iterate', 'loop'], [
    sm(arc(12, 12, 7.6, 3.5, 6.0, 12)), pl(arrowV(19.3, 9.9, 1.29, 3.8, 0.55)),
    sm(arc(12, 12, 7.6, 0.36, 2.86, 12)), pl(arrowV(4.7, 14.1, -1.85, 3.8, 0.55)),
    smc(ring(12, 12, 1, 1, 0, 6), KF)
  ]);

  /* sparkle: one big four-point star, a small dark one and a dot */
  reg('icSparkle', 5.5, ['sparkle', 'star', 'idea'], [
    plc([12, 2.4, 13.7, 10.3, 21.6, 12, 13.7, 13.7, 12, 21.6, 10.3, 13.7, 2.4, 12, 10.3, 10.3], PF),
    plc([19.2, 1.6, 19.8, 4.2, 22.4, 4.8, 19.8, 5.4, 19.2, 8, 18.6, 5.4, 16, 4.8, 18.6, 4.2], { f: 'k', w: 0.7 }),
    smc(ring(4.6, 19.6, 0.85, 0.85, 0, 6), KF)
  ]);

  /* headphones */
  reg('icHeadphones', 7, ['headphones', 'music', 'listen'], [
    sm([4.4, 15.4, 4.6, 9.2, 8, 5, 12, 3.8, 16, 5, 19.4, 9.2, 19.6, 15.4]),
    smc([3, 14, 6.9, 14, 7.2, 20.6, 3.2, 20.6], PF), smc([17.1, 14, 21, 14, 20.8, 20.6, 16.8, 20.6], PF),
    pl([5, 16, 5.5, 18.8], HW), pl([18.8, 16, 19.3, 18.8], HW)
  ]);

  /* camera with a lens and a dark flash dot */
  reg('icCamera', 7.5, ['camera', 'photo', 'visual'], [
    plc([3, 8.4, 8.4, 8.4, 9.4, 5.6, 14.6, 5.6, 15.6, 8.4, 21, 8.4, 21, 19.6, 3, 19.6], BG), plc([3, 8.4, 8.4, 8.4, 9.4, 5.6, 14.6, 5.6, 15.6, 8.4, 21, 8.4, 21, 19.6, 3, 19.6], PF),
    smc(ring(12, 14, 4, 4, 0, 12), { w: 0.9 }), smc(ring(12, 14, 1.7, 1.7, 0, 8), KF),
    smc(ring(18, 11.2, 0.9, 0.9, 0, 6), KF), pl([4.8, 17.2, 6.6, 17.2], { w: 0.5 })
  ]);

  /* plant in a pot */
  reg('icPlant', 8, ['plant', 'grow', 'calm'], [
    plc([7.6, 15, 16.4, 15, 15, 21.6, 9, 21.6], BG), plc([7.6, 15, 16.4, 15, 15, 21.6, 9, 21.6], PF), pl([6.8, 15, 17.2, 15], { w: 1 }),
    pl([10.2, 17.2, 10.6, 20], HW), pl([13.2, 17.2, 13.5, 20], HW),
    sm([12, 15, 12.4, 11, 12, 6.8]),
    smc([12.1, 12.4, 9.2, 9.6, 5.4, 9.2, 5.8, 12, 9, 13.4], PF), pl([11.4, 12.2, 7.4, 10.8], HW),
    smc([12.3, 10.6, 15.2, 7.8, 19.2, 7.6, 19, 10.4, 15.6, 11.8], PF),
    smc([12, 6.8, 10.5, 4.6, 12, 2.6, 13.5, 4.6], { f: 'k', w: 0.8 })
  ]);

  /* paint brush */
  (function () {
    var A = -0.785;
    function L(pts, o, closed) { return (closed ? plc : pl)(xf(pts, 12, 12, A, 11, 0, 1, 1), o); }
    reg('icBrush', 6.5, ['brush', 'paint', 'draw'], [
      smc(xf([0, 0, 2.4, -1.9, 6.2, -2.1, 7.4, 0, 6.2, 2.1, 2.4, 1.9], 12, 12, A, 11, 0, 1, 1), { f: 'k', w: 0.8 }),
      L([7, -2.2, 10, -2.2, 10, 2.2, 7, 2.2], PF, true), L([8.5, -2.2, 8.5, 2.2], { w: 0.6 }),
      L([10, -1.7, 21.4, -1.2, 21.4, 1.2, 10, 1.7], PF, true),
      sm([2.6, 22.2, 5.4, 21.6, 8.6, 22.4], { w: 0.7 })
    ]);
  })();

  /* cloud */
  reg('icCloud', 8, ['cloud', 'dream', 'sky'], [
    smc([6.4, 18.6, 3.8, 16.6, 3.6, 13.4, 6.2, 11.8, 7.2, 8.4, 11, 6.6, 14.8, 7.8, 16.4, 10.6, 19.6, 11, 21.4, 13.8, 20.4, 17.2, 17.6, 18.6, 12, 19], { f: 'p', w: 1.1 }),
    sm(arc(11.6, 13, 4.2, 3.6, 4.6, 5), { w: 0.5 })
  ]);

  GA.propsE = { names: NAMES, period: PERIOD };
  GA.propsE.bounds = function (name, p) {
    var rec = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, globalAlpha: 1, lineCap: '', lineJoin: '', fillStyle: '' };
    function pt(x, y) { if (x < rec.x0) rec.x0 = x; if (x > rec.x1) rec.x1 = x; if (y < rec.y0) rec.y0 = y; if (y > rec.y1) rec.y1 = y; }
    rec.moveTo = rec.lineTo = pt; rec.quadraticCurveTo = function (a, b, x, y) { pt(x, y); }; rec.bezierCurveTo = function (a, b, c, d, x, y) { pt(x, y); };
    rec.arc = function (x, y, r) { pt(x - r, y - r); pt(x + r, y + r); };
    ['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke', 'clip', 'setLineDash', 'fillRect', 'strokeRect', 'translate', 'scale', 'rotate', 'transform'].forEach(function (n) { rec[n] = function () {}; });
    GA.props.draw(name, rec, p);
    return rec;
  };
})();


/* ===== swirl.js ===== */
/* ============================================================================================================================
   GA.swirl  -  thought dots + the flowing "vortex" of ribbon lines around the girl   (SPEC 4.2)
   Classic script, IIFE, deterministic (GA.util.rng only), everything is a pure function of t.

   ROUND 10 (ACTS, THOUGHTS agent): the births follow the four acts of the ~20 s thought process (k = seconds after turnFront1 = tStart - 1.1): act I (k < 5.5) only the lead arm and ONE small
   tight ring (r0 1.25) orbit her; act II (5.5-12) the 3 golden ribbons, the counter ring, the S gesture, the first silk bundle, the pale sweeps and two dotted trails wind in; act III (12-17.7)
   the two other bundles, the hooks, the loop flourishes, the flicks and the other trails tangle it (turbulence 0.18 -> 0.45 -> 1.0, loop amplitude 0.80 -> 0.88 -> 1.0 per act); act IV = the surge.
   The envelope the scene passes is ~30 % larger (rx min(0.35 W, 1000), ry 460; ery is still clamped to the visible canvas).
   ROUND 4: ENVELOPE + ORBITS.  build() opts rx, ry (+ cx, cy) are the vortex ENVELOPE ellipse around her head / neck (scene: rx = min(0.27 W, 780), ry = 380; clamped so that it fits the
   visible canvas).  EVERY vertex of every arm, trail, scribble and flick is inside it: lines are built inside a circle-space radius cap (soft limiter), the world position is squeezed
   below the rim at the end of evalLine (q > 0.93 is compressed, never reaches 1) and the width fades from 0.80 to 1.03 of the rim - nothing is ever cut by a screen / band edge.
   Motion is ORBITAL: differential rotation (inner faster, speed ramps up with the build), a few counter-rotating arms, rigid revolving scribble clusters, sway of the orbit planes, breathing,
   one smooth turbulence field that grows with the build (calm early, tangled toward the climax and in the last 2 s before the hit) and the funnel pull (surge) in the last 2 s.
   ROUND 4f (LOOPY): the 3 ribbons, the 2 rings and the S gesture carry loop-the-loop windows (build rows key lw: c = centre, hw, a = radius, l = spacing, sg): a spirograph / epitrochoid
   offset a*(cos psi, sin psi) added in WORLD space (so the loops are always round), psi = 2 pi (arclength from the window start) / l + roll * t, speed a*2pi/l > the line speed => a round loop every l units,
   never a cusp; weight swells at the loops; lazy loops (a 40, l 120-130), end curls (a 28-30, l 70-75), tight ones (a 20, l 52); amplitude grows 0.82 -> 1.0 with the build (+12 % in the surge).
   ROUND 4c (ENCOMPASS): the ribbons / rings / silk bundles sweep AROUND the whole thought cloud (circle-space radius 1.4-2.5 = 0.55-0.97 of the envelope, tilt matched to the envelope axes, rim usable up to ~0.99:
   fade 0.91-1.04, squeeze from 0.96), the eye sits at neck height (eyeDy -14) so the vortex is concentric with the cloud; 25 arms (lead, 3 golden ribbons, 2 rings, 1 S gesture, 3 bundles of 4/3/3, 2 hooks,
   2 round cursive loop flourishes, 4 flicks) + 2 pale sweeps (one is a sheen under the first ribbon) + 4 dotted trails with graded dots; ~3.3k lineTo at tl 12.8-15.4.
   PRESENCE (round 4b): 8 long bold tapered SWOOSHES (weights 3.6-5.8 at the thick middle, hairline tips, taper fraction 0.4, 3 in front of her, own tilts / speeds, 2 counter-rotating) +
   darker mid arms, scribbles 2.6, flicks 2.2-3.0 wide, pale sweeps alpha 0.07 / 0.16.  33 arms: lead + 6 inward spirals (4 of them swooshes, 1 mirrored) + 2 rings + 4 orbit arcs + 2 S gestures + 4 overshoot-and-curl hooks + 4 pencil scribbles + 10 flicks (short windows racing along
   a path, repeating), + 2 pale sweeps + 5 dotted / dashed / comet trails.  Decimation is deviation based (tolerance 0.3-1.0 units, union of three moments).
   GA.swirl.testBounds(t0,t1,dt) -> {vertices, drawnVertices, outsideVisible, maxOutsideVisible, beyondEnvelope, maxBeyondEnvelope, maxQ, env:{cx,cy,rx,ry}, visible:{...}} self test (no drawing).
   API otherwise unchanged (build / isReady / prepare / draw / track / armCount (33) / intensity / dissolveFrom / reset / isActive / surge / rescale / warmGPU / info / debug).

   ROUND 3 (QA): the vortex is now a real FUNNEL - the eye (build key eyeDy, default -42 world units from the cy you pass) sits at her head / neck; 6 long arms start at the top and
   bottom edges of the visible area and spiral in to head height (radius shrinking, weight GROWING), 4 slimmer arms swing in from the sides, 2 big black rings with opposite tilts
   (+-30 degrees), 2 gesture arcs, ONE broad pale loop at waist height + 2 pale funnel sweeps, 3 dotted / dashed arcs; every family has its own tilt (+-14..34 degrees).  Arms keep
   a hairline away from her head (hair ellipse) and shoes.  surge(tHit): the funnel tightens by 14 % and winds 3x faster over tHit-2.0 .. tHit-0.1, the dissolve at the hit releases it.
   RASTER: lines are drawn from curvature-decimated vertices (~6x fewer lineTo), all back runs of one colour share one path / one fill, soft sweeps = 2 low-alpha strokes
   gathered once, invisible runs are skipped (14.5k lineTo -> 2.3k at tl 13-15; real GPU at DPR 2: the swirl's share of the climax frame 21 ms -> 5 ms).
   SLICED BUILD: build(o) is synchronous as before; build(o) with o.sliced:true returns at once (~0.2 ms) and prepare(budgetMs) (<= ~4 ms of line jobs per call) finishes it;
   isReady() is true when draw() / track() / armCount() have everything (before that draw() draws nothing, track() returns zeros, armCount() 0; dissolveFrom() finishes the build itself).
   rescale(): no-op (nothing here depends on the canvas pixel ratio).  warmGPU(ctx, step, rect): 2 steps, invisible draws of every distinct draw state (true after step 1).

   PUBLIC API (SPEC 4.2 + UPDATE v2: interactive, runtime dissolve)
     GA.swirl.build({W,H,cx,cy,rx,ry,seed,origin:{x,y},tDots,tStart,tFull [,tHit,autoDissolve,cubes,dots]})
         precomputes all geometry (NO particles are spawned unless a finite tHit is given and autoDissolve !== false: then build() simply
         calls dissolveFrom(tHit,{speed:1,stagger:0.9}) for backwards compatibility).  tHit undefined / Infinity / NaN => nothing is ever
         scheduled: the vortex just keeps flowing until the director calls dissolveFrom().  A finite tHit with autoDissolve:false is only a
         "hint" (the vortex tightens slightly during the 1.6 s before it).  The director must call GA.fx.cubes.reset() / GA.fx.dots.reset()
         BEFORE building the modules.   optional keys: cubes = cube budget of a FULL vortex (default ~330 for 16:9, scales with W (x0.85..1.5)),
         dots = dot budget (default 0.9 x cubes).  Eye ellipse = (0.30*rx, 0.38*ry) clamped to (170..300, 125..205); rx/ry only set the eye,
         the arms run off-screen on their own.  Timing is relative: arms are born between tStart+0.1*(tFull-tStart) and tFull-2.2 s, all finished by tFull-0.25.
         LOOK (QA round 1): 16 main arms = lead + 11 spirals (the outer ones light) + 4 GESTURE arms (two S-curve/inward spirals that thin to a hairline near her
         head, one big S sweep, one that breaks out of the ellipse and fades off the top), +-8 degrees of tilt per arm, a visibly travelling thick-thin swell on 4 arms,
         pale sweeps = 5 stacked low-alpha ink strokes (feathered), 22 accents.  Arms thin out and vanish within 22 units of her shoes (|x-cx|<90, y>groundY-40;
         full weight again beyond 62), and nothing is ever drawn in front of her inside the exclusion box.  The world range used for visibility is GA.stage.visTop..visBottom.
         PERF: build() runs one tiny silent trial dissolve; draw() runs 3 more (one per frame, rolled back, once, from tStart+0.6 on) or call prepare(budgetMs) yourself.
         Cubes: skewed sizes (many 3-7, a few up to the line's cap 9-26, ~1.5 % chunks 28-42), ~375 cubes + ~320 dots for a full vortex at W = 2773, cubes that appear inside her
         box go to the BACK layer.  dissolveFrom() itself only freezes + cuts (~4 ms warm) and queues the particle spawns, which draw() / prepare() work off (2.5 ms per frame).
     GA.swirl.dissolveFrom(t0,{speed,stagger}) -> bool   RUNTIME, callable at any moment (also with t0 in the future).  From t0 on the vortex
         stops growing (no new arm, dot or accent appears; arms that are half drawn stay half drawn) and everything that exists at t0 cracks
         into pieces which erode, nearest to her head first, into small black cubes (GA.fx.cubes.spawn) and dots (GA.fx.dots.spawn).
         stagger (default 0.9 s) = time between the first and the last piece starting to crack, speed (default 1) compresses ALL time
         constants (erosion 0.30-0.55 s / speed, burst, hover); the whole thing is gone ~(stagger + 0.75/speed) after t0.  Interrupt: {speed:1.6, stagger:0.35}.
         All particles are spawned INSIDE this call with a seeded RNG and t0-based times (cheap, ~1 ms; cube count scales with how much of
         the vortex exists at t0).  A second call while a dissolve exists is ignored (returns false) - earliest call wins.  To re-arm:
         reset() (+ GA.fx.cubes.clearFrom / dots.clearFrom or full fx reset, because spawned particles cannot be recalled).
     GA.swirl.prepare(budgetMs=3) -> bool   budgeted background work (warm-up trials before a dissolve, the spawn queue after dissolveFrom); true while work remains. Optional.
     GA.swirl.reset({clearFx})   cancel the dissolve, back to the pre-start state (geometry kept).  clearFx:true also calls
         GA.fx.cubes/dots.clearFrom(t0 of the dissolve) (that removes EVERY particle spawned at/after that time, also other modules').
     GA.swirl.isActive(t) -> bool   true while t >= tDots and nothing has dissolved yet (the vortex is, or will be, on screen), and - after
         dissolveFrom - until the last piece AND the last cube/dot it released has left the screen.
     GA.swirl.draw(ctx,t,layer)    layer 'back' | 'front'. 'front' = only the stretches of 4 arms + 1 pale sweep that pass in front of the
                                    vortex centre (lower half of the tilted vortex), each with a thin PAPER-coloured halo (~2 units). Inside the girl's
                                    EXCLUSION BOX (|x-cx| < girlHalfW (115), y from headTop = groundY-girlHeight(500)-14 to groundY+16; build keys girlHalfW /
                                    girlHeight / groundY, defaults from GA.stage) nothing is ever in front: those stretches are 'back' (they pass behind her), so no pale
                                    stroke or halo can cut her legs / feet / face / hands. Everything else is 'back'. Draws nothing before tDots and
                                    after the dissolve is over. PURE function of (t, dissolve state). Cost ~0.7 ms CPU/frame, no per-frame allocation.
                                    Colours are read from GA.style (INK, PAPER, GRAY1-4) at every draw call (never hard-coded white/black).
     GA.swirl.track(i,u,t) -> {x,y,a,z,grown}   point on main arm i (0..armCount()-1) at normalised arclength u (0 = inner end,
                                    1 = outer end; arms are 3000-5000 units long), a = tangent angle (direction of increasing u),
                                    z = depth -1..1 (z>0 = nearer than the girl = belongs to the 'front' layer), grown = the arm has been
                                    drawn out to u at time t. The pattern flows INWARD (toward the eye): a prop riding an arm should
                                    slowly DEcrease u. t is clamped to the dissolve start (the arms are frozen from then on).
     GA.swirl.intensity(t) -> 0..1  smoothstep(tStart,tFull) (frozen at t0) * (1 - smoothstep(t0, end of the dissolve))
   EXTRAS
     GA.swirl.armCount()   number of main arms (17; 18-20 on stages wider than ~2300 units)
     GA.swirl.info()       { cubes, dots, lines, lastDeath } what the (last) dissolve spawned; lastDeath = seconds after t0 when the last piece is gone
     GA.swirl.dissolveTime() -> t0 of the running/scheduled dissolve or null
     GA.swirl.debug()      internal state (demo / tests only)

   MODEL: every line is a spiral in a "circle space" (rho, theta) mapped to the world by an eye-ellipse, a tilt that twists with radius,
   a mild perspective term (lower/near half bigger, thicker), a vertical squash that grows with radius, and a slow DIFFERENTIAL rotation
   (inner arms faster, so the pattern shears and flows inward). Each line is a variable-width filled ribbon (own routine on typed arrays)
   whose width = taper * (lo + (1-lo) * travelling swells) * depth factor. Lines are born one after another and draw themselves out
   behind a leading tip (the first one starts exactly at the big thought dot and arcs up and around her). Besides 17+ arms there are
   5 broad pale sweeps (3 stacked flat tones), 2 dotted lines + 1 dashed line (marching dots/dashes with swelling size and varying
   spacing) and ~32 floating dots / rings / ticks / chevrons. At tHit the frozen geometry (with its flow velocity, so it is continuous)
   cracks into pieces; a shock wave runs outward from the head (+0..stagger s by distance); every piece trembles, bursts apart and is eaten
   along its length (width pinches) while black cubes / dots are released at the erosion front (closed-form, spawned inside dissolveFrom).
   ============================================================================================================================ */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util;
  var TAU = Math.PI * 2, HP = Math.PI / 2;
  var sstep = U.smoothstep;

  var PERSP = 0.11;      // near (lower) half of the vortex appears larger
  var SQ = 0.16;         // vertical squash grows with radius (outer arms flatter -> wider vortex)
  var DIFFROT = 0.6;     // differential rotation: angular speed ~ rho^-0.6 (inner arms turn faster, the pattern winds and shears slowly)
  var TW_ = -0.13;       // axis twist: outer arms are rotated further than inner ones (galaxy-like, breaks the nested-ellipse look)
  var DS = 10.0;         // sample spacing along lines (world units); smooth enough (sagitta < 0.15 units at the tightest curvature)
  var HALO = 2.2;        // white halo (per side) for front arms crossing the silhouette
  var TAU0 = 0.14;       // burst acceleration time constant
  var DRIFT_TAU = 0.55;  // after t0 the flow keeps coasting for a moment with this decay time, then locks up
  var BIG_R = 10.5, SMALL_R = 4.4;   // thought dots

  var G = null;          // built state
  var WARM_N = 4;        // silent trial dissolves that warm the JIT during the thinking phase (one per frame, ~3-6 ms each, spread over a few frames)
  var D = null;          // dissolve state (null = none)  {t0,speed,stagger,lastDeath,tEnd,tLines,info}
  var lastT = NaN;

  // ------------------------------------------------------------------------------------------------ helpers
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function eIO(x) { x = clamp01(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); }
  function eOut3(x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); }
  function eBack(x) { return U.easeOutBack(x, 1.9); }
  function f32(n) { return new Float32Array(n); }
  /** '#rgb' | '#rrggbb' | 'rgb(...)' | 'rgba(...)'  ->  [r,g,b,a] or null */
  function parseCol(s) {
    s = String(s).replace(/\s+/g, '');
    var m, h, n;
    if (s.charAt(0) === '#') {
      h = s.slice(1); if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { var p = m[1].split(','); return [+p[0], +p[1], +p[2], p.length > 3 ? +p[3] : 1]; }
    return null;
  }
  function cssOf(c) { return c[3] < 1 ? 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + c[3].toFixed(3) + ')' : 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function midCol(a, b) {
    var x = parseCol(a), y = parseCol(b);
    if (!x || !y) return String(b);
    return cssOf([(x[0] + y[0]) / 2, (x[1] + y[1]) / 2, (x[2] + y[2]) / 2, (x[3] + y[3]) / 2]);
  }
  /** colour table from GA.style (re-read at every draw call so the page theme can change at any time) */
  function makeColors(st) {
    return {
      ink: st.INK || '#151412', g1: st.GRAY1 || '#5a5854', g2: st.GRAY2 || '#8f8d88', g3: st.GRAY3 || '#c6c4bf', g4: st.GRAY4 || '#e4e2dc', paper: st.PAPER || '#faf8f3',
      gm: midCol(st.GRAY4 || '#e4e2dc', st.GRAY3 || '#c6c4bf'),
    };
  }
  function colSig(st) { return st.INK + '|' + st.PAPER + '|' + st.GRAY1 + '|' + st.GRAY2 + '|' + st.GRAY3 + '|' + st.GRAY4; }
  function refreshColors() {
    var st = GA.style || {}, sig = colSig(st);
    if (sig !== G.colSig) { G.colSig = sig; G.C = makeColors(st); }
  }
  /** time at which the vortex is frozen: the dissolve start, else never */
  function freezeT() { return D ? D.t0 : Infinity; }

  // ------------------------------------------------------------------------------------------------ global (time dependent) state
  /** rotation integral: unit speed; if a finite tHit hint was given it speeds up (x2.2) during the last 1.6 s before it (the vortex tightens) */
  function rotInt(te) {
    var P = G.P;
    if (te <= P.tStart) return 0;
    var x0 = te - P.tStart, T0 = P.tFull - P.tStart, r = x0 + (x0 < T0 ? 0.9 * x0 * x0 / (2 * T0) : 0.9 * T0 / 2 + 0.9 * (x0 - T0)), a = P.tHit - 2.0;
    if (te > a) { var x = Math.min(1, (te - a) / 1.9); r += 2.8 * 1.9 * (x * x * x - 0.5 * x * x * x * x); }      // the winding speeds up (x 3.8 at the end of the surge)
    return r;
  }
  function gstate(t, g) {
    var P = G.P, te = Math.min(t, freezeT());
    var k = clamp01((te - P.tStart) / (P.tFull - P.tStart));
    var fun = P.tHit < 1e8 ? sstep(P.tHit - 2.6, P.tHit - 0.3, te) : 0;                            // ROUND 10 act IV: the vortex winds into a tight funnel around her head (30 % smaller, lifted 70 units, winding faster)
    g.es = (0.80 + 0.20 * eOut3(k)) * (1 - 0.30 * fun); g.fy = -70 * fun;
    g.ex = P.ex * (1 + 0.018 * Math.sin(0.55 * te + 1.2));
    g.ey = P.ey * (1 + 0.022 * Math.sin(0.47 * te + 2.1));
    var tilt = -0.20 + 0.03 * Math.sin(0.31 * te + 0.4);
    g.ct = Math.cos(tilt); g.st = Math.sin(tilt);
    g.R = rotInt(te);
    var kk = te - P.tStart + 1.1;                                                                       // ROUND 10: seconds after turnFront1 (the acts: II from 5.5, III from 12, IV = the surge)
    g.tur = (0.18 + 0.27 * sstep(5.0, 8.0, kk) + 0.55 * sstep(11.5, 15.5, kk)) * (1 + 0.45 * sstep(P.tHit - 2.3, P.tHit - 0.2, te));   // calm in act I, lively in II, tangled in III and in the surge
    g.lp = (0.80 + 0.08 * sstep(5.0, 8.0, kk) + 0.12 * sstep(11.5, 15.5, kk)) * (1 + 0.12 * sstep(P.tHit - 2.3, P.tHit - 0.2, te));
    g.p1 = 0.70 * te + 1.1; g.p2 = 0.53 * te + 4.0; g.p3 = 0.61 * te + 2.3; g.p4 = 0.47 * te + 5.2;
    return g;
  }
  /** circle space (u,v with rho already multiplied in; rho = |(u,v)|) -> world. */
  function toWorld(u, v, rho, g, out) {
    var sn = rho > 0 ? v / rho : 0, pf = 1 + PERSP * sn, vs = Math.pow(Math.max(rho, 0.2), -SQ);
    var ux = u * g.ex * pf * Math.pow(Math.max(rho, 0.2), G.P.gam), vy = v * vs * g.ey * pf, b = TW_ * Math.log(Math.max(rho, 0.2)), cb = Math.cos(b), sb = Math.sin(b);
    var c = g.ct * cb - g.st * sb, s = g.st * cb + g.ct * sb;
    out.x = G.P.cx + g.es * (ux * c - vy * s);
    out.y = G.P.cy + (g.fy || 0) + g.es * (ux * s + vy * c);
    out.sn = sn;
    return out;
  }
  function worldToCircle(x, y, g) {
    var P = G.P, dx = (x - P.cx) / g.es, dy = (y - P.cy - (g.fy || 0)) / g.es;
    var u = dx / g.ex, v = dy / g.ey;
    for (var it = 0; it < 12; it++) {
      var rho = Math.hypot(u, v) || 1e-3, sn = v / rho, pf = 1 + PERSP * sn, vs = Math.pow(Math.max(rho, 0.2), -SQ);
      var b = TW_ * Math.log(Math.max(rho, 0.2)), cb = Math.cos(b), sb = Math.sin(b), c = g.ct * cb - g.st * sb, s = g.st * cb + g.ct * sb;
      var px = dx * c + dy * s, py = -dx * s + dy * c;
      u = px / (g.ex * pf * Math.pow(Math.max(rho, 0.2), G.P.gam)); v = py / (g.ey * pf * vs);
    }
    return { u: u, v: v };
  }

  // ------------------------------------------------------------------------------------------------ ribbon (typed arrays, sub-range, optional batching)
  var RB = { lx: f32(1400), ly: f32(1400), rx: f32(1400), ry: f32(1400) };
  /** variable-width ribbon along X[i0..i1],Y[i0..i1] with full widths Wd[]*sc. append=true: only adds the sub-path (caller fills). */
  function ribbon(ctx, X, Y, Wd, i0, i1, capA, capB, sc, append) {
    var n = i1 - i0 + 1;
    if (n < 2) return;
    var lx = RB.lx, ly = RB.ly, rx = RB.rx, ry = RB.ry, k, j;
    for (j = i0; j <= i1; j++) {
      var ja = j > i0 ? j - 1 : j, jb = j < i1 ? j + 1 : j;
      var dx = X[jb] - X[ja], dy = Y[jb] - Y[ja], d = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= d; dy /= d;
      var w = Wd[j] * sc * 0.5; if (!(w > 0)) w = 0;
      k = j - i0;
      lx[k] = X[j] - dy * w; ly[k] = Y[j] + dx * w; rx[k] = X[j] + dy * w; ry[k] = Y[j] - dx * w;
    }
    if (!append) ctx.beginPath();
    ctx.moveTo(lx[0], ly[0]);
    for (k = 1; k < n; k++) ctx.lineTo(lx[k], ly[k]);
    var w1 = Wd[i1] * sc * 0.5;
    if (capB && w1 > 0.06) ctx.arc(X[i1], Y[i1], w1, Math.atan2(Y[i1] - Y[i1 - 1], X[i1] - X[i1 - 1]) + HP, Math.atan2(Y[i1] - Y[i1 - 1], X[i1] - X[i1 - 1]) - HP, true);
    for (k = n - 1; k >= 0; k--) ctx.lineTo(rx[k], ry[k]);
    var w0 = Wd[i0] * sc * 0.5;
    if (capA && w0 > 0.06) { var p0 = Math.atan2(Y[i0 + 1] - Y[i0], X[i0 + 1] - X[i0]); ctx.arc(X[i0], Y[i0], w0, p0 - HP, p0 - 3 * HP, true); }
    ctx.closePath();
    if (!append) ctx.fill();
  }

  // ------------------------------------------------------------------------------------------------ line generation
  /** soft radial limiter: identity below 0.82 m, then eases towards m and never reaches it */
  function slim(r, m) { var a = 0.92 * m; if (r <= a) return r; var d = (r - a) / (m - a); return a + (m - a) * d / (1 + d); }
  /** One line. sp = {kind:'arm'|'sweep'|'dots'|'dash', polar spiral: rho0, th0, dir, k0, k1, phiEnd | rhoEnd, wob, launch  --or--  uv(p,out) over p in [0,phiEnd], dp;
      rmax (circle-space radius the line can never exceed), rwc (constant rotation weight = rigid cluster), base, lo, tin, tout, tipDot, f1,nu1,f2,nu2,p1,p2, ua,mu,pu,uOm, omega,
      sway/swayNu/swayPh, pul/pulNu/pulPh, ub/wl/pb/bOm (2nd breathing), tA (turbulence), flick {t0,per,dur,hw}, ds} */
  function makeLine(sp) {
    var P = G.P, gb = G.gb, rng = G.rng;
    var wob = sp.wob, rmax = sp.rmax || 99, dirn = sp.dir || 1;
    function polarUV(phi, out) {
      var f = sstep(0, 1.2, phi);
      var r = sp.rho0 * Math.exp(sp.k0 * phi + sp.k1 * phi * phi / 12 + (sp.launch || 0) * 0.35 * (1 - Math.exp(-phi / 0.35))) *
        (1 + f * (wob.a1 * Math.sin(wob.m1 * phi + wob.p1) + wob.a2 * Math.sin(wob.m2 * phi + wob.p2)));
      var th = sp.th0 + dirn * phi;
      out.u = r * Math.cos(th); out.v = r * Math.sin(th);
    }
    var uvf = sp.uv || polarUV, q = { u: 0, v: 0 };
    function uvAt(p) {
      uvf(p, q);
      var r = Math.sqrt(q.u * q.u + q.v * q.v);
      if (r > 0.92 * rmax) { var f = slim(r, rmax) / r; q.u *= f; q.v *= f; r *= f; }
      return r;
    }
    var tmp = { x: 0, y: 0, sn: 0 };
    var ph = [], cum = [], phi = 0, L = 0, px = 0, py = 0, first = true, phiMax = sp.phiEnd || 18, dp = sp.dp || 0.01;
    for (;;) {
      var rho = uvAt(phi);
      toWorld(q.u, q.v, rho, gb, tmp);
      if (!first) L += Math.hypot(tmp.x - px, tmp.y - py);
      first = false; px = tmp.x; py = tmp.y;
      ph.push(phi); cum.push(L);
      if (phi >= phiMax || (sp.rhoEnd && rho >= sp.rhoEnd)) break;
      phi += dp;
      if (phi > phiMax) phi = phiMax;
    }
    var total = L, ds = sp.ds || DS, n = Math.max(24, Math.min(1300, Math.round(total / ds) + 1)), idx = 0, j;
    var phiJ = f32(n), sJ = f32(n);
    for (j = 0; j < n; j++) {
      var target = total * j / (n - 1);
      while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
      var seg = cum[idx + 1] - cum[idx], f = seg > 0 ? (target - cum[idx]) / seg : 0;
      phiJ[j] = ph[idx] + (ph[idx + 1] - ph[idx]) * f; sJ[j] = target;
    }
    var Ln = { kind: sp.kind, n: n, len: total, sp: sp, idx: -1 };
    Ln.C = f32(n); Ln.S = f32(n); Ln.iR = f32(n); Ln.vs = f32(n); Ln.uS = f32(n); Ln.uC = f32(n); Ln.wS = f32(n); Ln.wC = f32(n);
    Ln.rw = f32(n); Ln.ax = f32(n); Ln.cb = f32(n); Ln.sb = f32(n); Ln.s1S = f32(n); Ln.s1C = f32(n); Ln.s2S = f32(n); Ln.s2C = f32(n); Ln.env = f32(n); Ln.rhoJ = f32(n);
    Ln.X = f32(n + 2); Ln.Y = f32(n + 2); Ln.Wd = f32(n + 2); Ln.F = new Uint8Array(n + 2);
    var rwc = sp.rwc;
    for (j = 0; j < n; j++) {
      var p = phiJ[j], r = uvAt(p), s = sJ[j];
      Ln.rhoJ[j] = r; Ln.ax[j] = Math.pow(Math.max(r, 0.2), G.P.gam); Ln.rw[j] = rwc !== undefined ? rwc : Math.pow(Math.max(r, 0.5), -DIFFROT);
      var bb = TW_ * Math.log(Math.max(r, 0.2)) + (sp.tilt || 0); Ln.cb[j] = Math.cos(bb); Ln.sb[j] = Math.sin(bb);
      Ln.C[j] = q.u; Ln.S[j] = q.v; Ln.iR[j] = 1 / r; Ln.vs[j] = Math.pow(Math.max(r, 0.2), -SQ);
      var amp = sp.ua * sstep(0, 350, s), ang = sp.mu * (s / 250) + sp.pu;
      Ln.uS[j] = amp * Math.sin(ang); Ln.uC[j] = amp * Math.cos(ang);
      if (sp.ub) { var am2 = sp.ub * sstep(0, 220, s), an2 = TAU * s / sp.wl + sp.pb; Ln.wS[j] = am2 * Math.sin(an2); Ln.wC[j] = am2 * Math.cos(an2); }
      var P1 = TAU * (s / 1000) * sp.f1 + sp.p1, P2 = TAU * (s / 1000) * sp.f2 + sp.p2;
      Ln.s1S[j] = Math.sin(P1); Ln.s1C[j] = Math.cos(P1); Ln.s2S[j] = Math.sin(P2); Ln.s2C[j] = Math.cos(P2);
      var tin = sstep(0, sp.tinF ? sp.tinF * total : sp.tin, s), so = total - s, tout = sstep(0, sp.toutF ? sp.toutF * total : sp.tout, so);
      if (sp.tipDot) tout = 0.5 + 0.5 * tout;
      var rad = 1 - 0.62 * sstep(1.7, 4.8, r);
      Ln.env[j] = sp.base * tin * tout * rad;
    }
    Ln.lo = sp.lo; Ln.omega = sp.omega; Ln.uOm = sp.uOm; Ln.nu1 = sp.nu1; Ln.nu2 = sp.nu2;
    Ln.rigid = rwc !== undefined; Ln.bOm = sp.bOm || 0;
    Ln.sway = sp.sway || 0; Ln.swayNu = sp.swayNu || 0; Ln.swayPh = sp.swayPh || 0; Ln.pul = sp.pul || 0; Ln.pulNu = sp.pulNu || 0; Ln.pulPh = sp.pulPh || 0; Ln.tA = sp.tA === undefined ? 1 : sp.tA;
    Ln.flick = sp.flick || null;
    Ln.lA = null; Ln.lK = null; Ln.lP = null; Ln.lW = null; Ln.loopRoll = sp.loopRoll || 0;
    if (sp.lw) {
      Ln.lA = f32(n); Ln.lK = f32(n); Ln.lP = f32(n); Ln.lW = new Uint8Array(n).fill(255);
      for (j = 0; j < n; j++) {
        var sj = sJ[j], wbest = 0, abest = 0, pbest = 0, kbest = 0;
        for (var wi = 0; wi < sp.lw.length; wi++) {
          var wd = sp.lw[wi], uu = Math.abs(sj - wd.c * total) / wd.hw, tt = (1 - uu) / 0.45; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          var Wn = tt * tt * (3 - 2 * tt);
          if (Wn > wbest) { wbest = Wn; Ln.lW[j] = wi; abest = wd.a; kbest = wd.sg * TAU / wd.l; pbest = wd.ph; }
        }
        Ln.lA[j] = wbest * abest; Ln.lK[j] = kbest; Ln.lP[j] = pbest;
        if (wbest > 0 && sp.loopSwell) Ln.env[j] *= 1 + sp.loopSwell * wbest;
      }
    } Ln.own = !!sp.tol && !sp.chord;                 // scribbles / hooks / flicks: own small paths (a self-overlapping loop mass in one big batched path is slow on the GPU)
    Ln.tipR = sp.tipDot || 0; Ln.lead = !!sp.lead; Ln.frontable = !!sp.front;
    Ln.tb = 0; Ln.dur = 2; Ln.hs = 0; Ln.iEnd = n - 1; Ln.iA = 0; Ln.iB = -1;
    Ln.col = sp.col; Ln.col2 = sp.col2 || null;
    Ln.tipX = 0; Ln.tipY = 0; Ln.tipF = 0;
    Ln.shoe = sp.kind === 'arm';                                   // arms keep away from her shoes (see evalLine)
    G.lines.push(Ln);
    return Ln;
  }

  function growth(L, t) {
    var x = (t - L.tb) / L.dur;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return L.lead ? eIO(x) : 0.3 * x + 0.7 * eIO(x);
  }

  /** the vortex envelope: soft world-space fade of the width from 0.80 of the envelope ellipse, gone at 1.03, positions squeezed so that NOTHING ever leaves the ellipse */
  var TURB_A = 15, KX = TAU / 820, KY = TAU / 700, K2 = TAU / 560 * 0.7071, K3 = TAU / 640 * 0.7071;
  /** fill X,Y,Wd,F for the whole line at (clamped) time te */
  function evalLine(L, te, g) {
    var P = G.P, n = L.n, W0 = -L.omega * g.R, rwA = L.rw, rigid = L.rigid, cr = 1, sr = 0;
    if (rigid) { var an0 = W0 * rwA[0]; cr = Math.cos(an0); sr = Math.sin(an0); }
    var wu = L.uOm * te, cu = Math.cos(wu), su = Math.sin(wu);
    var wb = L.bOm * te, cb2 = Math.cos(wb), sb2 = Math.sin(wb), hasB = L.sp.ub ? 1 : 0;
    var a1 = TAU * L.nu1 * te, c1 = Math.cos(a1), s1 = Math.sin(a1);
    var a2 = TAU * L.nu2 * te, c2 = Math.cos(a2), s2 = Math.sin(a2);
    var kpul = L.pul ? L.pul * Math.sin(TAU * L.pulNu * te + L.pulPh) : 0;
    var swa = L.sway ? L.sway * Math.sin(TAU * L.swayNu * te + L.swayPh) : 0, csw = Math.cos(swa), ssw = Math.sin(swa);
    var TA = g.tur * L.tA * TURB_A, doT = TA > 0.05, p1 = g.p1, p2 = g.p2, p3 = g.p3, p4 = g.p4;
    var ex = g.ex, ey = g.ey, es = g.es, ct = g.ct, st = g.st, cx = P.cx, cy = P.cy + (g.fy || 0);
    var ecx = P.ecx, ecy = P.ecy, iEx = 1 / P.erx, iEy = 1 / P.ery;
    var lo = L.lo, one = 1 - lo;
    var axA = L.ax, cbA = L.cb, sbA = L.sb, C = L.C, S = L.S, iR = L.iR, vs = L.vs, uS = L.uS, uC = L.uC, wS = L.wS, wC = L.wC, s1S = L.s1S, s1C = L.s1C, s2S = L.s2S, s2C = L.s2C, env = L.env;
    var X = L.X, Y = L.Y, Wd = L.Wd, F = L.F;
    var x0 = -60, x1 = P.W + 60, y0 = P.vt - 60, y1 = P.vb + 60, iA = -1, iB = -2;
    var gx0 = P.gx0, gx1 = P.gx1, gy0 = P.gy0, gy1 = P.gy1;
    var shoe = L.shoe, hf0 = !L.lead, shx = P.shx, shw = P.shw, shy0 = P.shy0, shy1 = P.shy1, hhx = P.hhx, hhy = P.hhy, ihrx = 1 / P.hrx, ihry = 1 / P.hry;
    var LA = L.lA, LK = L.lK, LP = L.lP, LW = L.lW, lpa = g.lp, aL = 0, lsum = 0, lpx = 0, lpy = 0, curW = -1, sw0 = 0;
    if (LA) aL = L.loopRoll * te;
    var fk = L.flick, fc = 0, fh = 1, fa = 0, fb = 0;
    if (fk) {                                                       // a flick: a short bright window that races along the path, then rests
      var tau = te - fk.t0;
      if (tau < 0) { fa = 1; fb = 0; fh = 0; }
      else {
        var ph0 = (tau % fk.per) / fk.dur;
        if (ph0 >= 1) { fa = 1; fb = 0; fh = 0; }
        else { var xe = 1 - Math.pow(1 - ph0, 1.6); fc = -fk.hw + (1 + 2 * fk.hw) * xe; fa = fc - fk.hw; fb = fc + fk.hw; fh = 1; }
      }
    }
    var inv = n > 1 ? 1 / (n - 1) : 0;
    for (var j = 0; j < n; j++) {
      if (!rigid) { var an = W0 * rwA[j]; cr = Math.cos(an); sr = Math.sin(an); }
      var u0 = C[j] * cr - S[j] * sr, v0 = C[j] * sr + S[j] * cr;
      var sn = v0 * iR[j], k = 1 + (uS[j] * cu - uC[j] * su) + kpul, pf = 1 + PERSP * sn;
      if (hasB) k += wS[j] * cb2 - wC[j] * sb2;
      var ux = u0 * k * ex * pf * axA[j], vy = v0 * k * vs[j] * ey * pf;
      var cc = ct * cbA[j] - st * sbA[j], ss = st * cbA[j] + ct * sbA[j];
      var dx = es * (ux * cc - vy * ss), dy = es * (ux * ss + vy * cc);
      if (swa !== 0) { var ddx = dx * csw - dy * ssw; dy = dx * ssw + dy * csw; dx = ddx; }
      var x = cx + dx, y = cy + dy;
      if (LA) {
        if (j > 0) { var lx_ = x - lpx, ly_ = y - lpy; lsum += Math.sqrt(lx_ * lx_ + ly_ * ly_); }
        lpx = x; lpy = y;
        var aj = LA[j] * lpa;
        if (aj > 0) { if (LW[j] !== curW) { curW = LW[j]; sw0 = lsum; } var psi = LK[j] * (lsum - sw0) + LP[j] + aL; x += aj * Math.cos(psi); y += aj * Math.sin(psi); }
      }
      if (doT) {                                                    // low-frequency turbulence: one smooth field, so neighbouring arms drift together
        var tx = TA * (Math.sin(KY * y + p1) + 0.55 * Math.sin(K2 * (x + y) + p2)), ty = TA * (Math.sin(KX * x + p3) + 0.55 * Math.sin(K3 * (y - x) + p4));
        x += tx; y += ty;
      }
      // envelope: fade + squeeze
      var qx = (x - ecx) * iEx, qy = (y - ecy) * iEy, q2 = qx * qx + qy * qy, ef = 1;
      if (q2 > 0.80) {
        var qq = Math.sqrt(q2);
        if (qq >= 1.04) ef = 0; else if (qq <= 0.91) ef = 1; else { var fe = (qq - 0.91) / 0.13; ef = 1 - fe * fe * (3 - 2 * fe); }
        if (qq > 0.96) { var dd = (qq - 0.96) / 0.04, q3 = 0.96 + 0.04 * dd / (1 + dd), sc2 = q3 / qq; x = ecx + (x - ecx) * sc2; y = ecy + (y - ecy) * sc2; }
      }
      // 'front' = the near half of the vortex, EXCEPT inside the girl's exclusion box: there everything passes BEHIND her, so no pale stroke / halo can ever
      // slice her shins, feet, face, hands (a front stroke over the black silhouette can only show up as a hard pale cut)
      X[j] = x; Y[j] = y; F[j] = (sn > 0 && !(x > gx0 && x < gx1 && y > gy0 && y < gy1)) ? 1 : 0;
      var q1 = 0.5 + 0.5 * (s1S[j] * c1 + s1C[j] * s1), qb = 0.5 + 0.5 * (s2S[j] * c2 + s2C[j] * s2);
      var wj = env[j] * (lo + one * (0.82 * q1 * q1 * q1 + 0.18 * qb)) * (0.60 + 0.66 * (0.5 + 0.5 * sn)) * ef;
      if (fk) {
        var uu = j * inv, dw = (uu - fc) / fk.hw, fw = fh > 0 && dw > -1 && dw < 1 ? (1 - dw * dw) : 0;
        wj *= fw * fw;
      }
      if (shoe) {                                                  // distance to the shoe zone: gone within 22 units, full weight from 62
        var dxs = Math.abs(x - shx) - shw, dys = shy0 - y;
        if (dxs < 0) dxs = 0;
        if (dys < y - shy1) dys = y - shy1;
        if (dys < 0) dys = 0;
        var ds2 = dxs * dxs + dys * dys;
        if (ds2 < 3844) { var ds = Math.sqrt(ds2), fz = ds <= 22 ? 0 : (ds - 22) / 40; wj *= fz * fz * (3 - 2 * fz); }
        var hnx = (x - hhx) * ihrx, hny = (y - hhy) * ihry, hq2 = hnx * hnx + hny * hny;     // head ellipse (not for the lead arm: it leaves the big dot right beside her head)
        if (hf0 && hq2 < 2.4025) { var hq = Math.sqrt(hq2), hf = hq <= 1.05 ? 0 : (hq - 1.05) / 0.5; wj *= hf * hf * (3 - 2 * hf); }
      }
      Wd[j] = wj;
      if (x > x0 && x < x1 && y > y0 && y < y1 && (!fk || (fh > 0 && j * inv >= fa - 0.02 && j * inv <= fb + 0.02))) { if (iA < 0) iA = j; iB = j; }
    }
    L.iA = iA; L.iB = iB;
    // growth head (fractional) ------------------------------------------------------
    var hs = growth(L, te); L.hs = hs;
    if (hs >= 1) { L.iEnd = n - 1; }
    else {
      var jh = hs * (n - 1), i = Math.floor(jh), fr = jh - i;
      if (i >= n - 1) { i = n - 2; fr = 1; }
      if (fr > 0.002) {
        X[i + 1] = X[i] + (X[i + 1] - X[i]) * fr; Y[i + 1] = Y[i] + (Y[i + 1] - Y[i]) * fr; Wd[i + 1] = Wd[i] + (Wd[i + 1] - Wd[i]) * fr; F[i + 1] = F[i];
        L.iEnd = i + 1;
      } else L.iEnd = i;
      if (!L.tipR && L.iEnd > 1) {   // soft taper right behind the drawing head
        var m = 12, e = L.iEnd;
        for (var q = 0; q < m && e - q >= 0; q++) Wd[e - q] *= Math.pow(sstep(0, 1, q / m), 0.9);
      }
    }
    L.tipX = X[L.iEnd]; L.tipY = Y[L.iEnd]; L.tipF = F[L.iEnd];
  }

  // ------------------------------------------------------------------------------------------------ build
  /** Builds the geometry as a list of small JOBS (one line per job, a few ms each).  build(o) runs them all at once; build(o, true) returns at once and the
      jobs are worked off by prepare(budgetMs) (the scene runs that during the walk-in); isReady() tells when draw() has everything. */
  function build(o, sliced) {
    o = o || {};
    var S0 = GA.stage || {};
    var W = o.W || S0.W || 1778, H = o.H || S0.H || 1000;
    var cx = o.cx !== undefined ? o.cx : W / 2, cy = (o.cy !== undefined ? o.cy : 560) + (o.eyeDy !== undefined ? o.eyeDy : -14);   // the eye of the funnel sits at her head / neck
    var P = {
      W: W, H: H, cx: cx, cy: cy, rx: o.rx || 0.42 * W, ry: o.ry || 430, seed: o.seed === undefined ? 7 : o.seed,
      origin: o.origin || { x: cx + 105, y: cy - 215 },
      tDots: o.tDots !== undefined ? o.tDots : 4.6, tStart: o.tStart !== undefined ? o.tStart : 5.4,
      tFull: o.tFull !== undefined ? o.tFull : 14.5, tHit: (typeof o.tHit === 'number' && isFinite(o.tHit)) ? o.tHit : Infinity,   // finite = surge hint (+ auto dissolve unless autoDissolve:false)
    };
    P.tStart = Math.max(P.tStart, P.tDots + 0.2); P.tFull = Math.max(P.tFull, P.tStart + 3);
    if (isFinite(P.tHit)) P.tHit = Math.max(P.tHit, P.tFull + 0.8);
    P.auto = isFinite(P.tHit) && o.autoDissolve !== false;
    // ENVELOPE: the ellipse (rx, ry) around her head / neck - every arm, trail, flick and scribble lives INSIDE it (soft fade toward its rim, hard guarantee by squeezing)
    var vt0 = S0.visTop !== undefined ? S0.visTop : 0, vb0 = S0.visBottom !== undefined ? S0.visBottom : H, ecy0 = o.cy !== undefined ? o.cy : 560, eyeDy0 = o.eyeDy !== undefined ? o.eyeDy : -14;
    P.ecx = cx; P.ecy = ecy0;
    P.erx = Math.max(150, Math.min(1.07 * (o.rx || 0.27 * W), cx - 40, W - cx - 40));
    P.ery = Math.max(150, Math.min(o.ry || 380, ecy0 - (vt0 + 40), (vb0 - 40) - ecy0));
    P.rhoE = 2.6;                                                     // circle-space radius that maps onto the envelope rim (unrotated)
    P.ex = P.erx / P.rhoE; P.ey = (P.ery - 0.5 * Math.abs(eyeDy0)) / Math.pow(P.rhoE, 1 - SQ);
    P.gam = 0;
    P.hx = cx; P.hy = cy - 88;                                       // approx. impact point (top of head)
    // girl exclusion box (nothing of the vortex is ever drawn in FRONT of her inside it): |x-cx| < girlHalfW, headTop .. just below the feet
    var gnd = o.groundY !== undefined ? o.groundY : (S0.groundY || H * 0.9), gh = o.girlHeight || 500, gw = o.girlHalfW || 115;
    P.gx0 = cx - gw; P.gx1 = cx + gw; P.gy0 = gnd - gh - 14; P.gy1 = gnd + 16;
    // shoe keep-out zone: arms thin out and vanish within 22 units of it (full weight again beyond 62), so no dark arc ever fuses with her shoes
    P.shx = cx; P.shw = o.shoeHalfW || 90; P.shy0 = gnd - 40; P.shy1 = gnd + 14;
    // head keep-out (hair + ponytail ellipse): arms thin to a hairline within 1.05 x the ellipse and are back at full weight from 1.55 x, so a dark arc never fuses with her head
    P.hhx = cx - 8; P.hhy = gnd - gh + 56; P.hrx = o.headHalfW || 110; P.hry = o.headHalfH || 78;
    // visible world range of the (taller than the band) canvas: arms / cubes exist and are budgeted over all of it
    P.vt = S0.visTop !== undefined ? S0.visTop : 0; P.vb = S0.visBottom !== undefined ? S0.visBottom : H;
    P.cubeBudget = o.cubes || Math.round(175 * U.clamp(W / 1778, 0.85, 1.5));   // ~375 cubes for a FULL vortex at W = 2773
    P.dotBudget = o.dots || Math.round(0.85 * P.cubeBudget);
    var st = GA.style || {};
    var rng = U.rng(P.seed);
    D = null;
    G = {
      P: P, rng: rng, lines: [], arms: [], sweeps: [], pats: [], acc: [], items: [], g: {}, gt: {}, pt: { x: 0, y: 0, sn: 0 },
      gb: { es: 1, ex: P.ex, ey: P.ey, ct: Math.cos(-0.2), st: Math.sin(-0.2), R: 0, fy: 0 },
      C: makeColors(st), colSig: colSig(st), dst: { sx: 0, sy: 0, sr: 0, bx: 0, by: 0, br: 0 },
      info: { cubes: 0, dots: 0, lines: 0, lastDeath: 0 }, haloF: 1, ready: false, jobs: [], ji: 0, warm: o.warmup === false ? WARM_N : 0, opts: o,
    };
    var jobs = G.jobs;
    var T = P.tFull - P.tStart;
    var DEG = Math.PI / 180;
    var eyeDy_ = o.eyeDy !== undefined ? o.eyeDy : -14;
    /** largest circle-space radius at which the ellipse (tilted by `tilt`) still fits into the envelope (perspective / breathing margin included) */
    function capRho(tilt) {
      for (var r = 3.4; r > 0.4; r -= 0.03) {
        var a = P.ex * r, b = P.ey * Math.pow(r, 1 - SQ), tau = -0.2 + tilt + TW_ * Math.log(r), sn = Math.sin(tau), cs = Math.cos(tau);
        var hw = Math.sqrt(a * a * cs * cs + b * b * sn * sn) * 1.08, hh = Math.sqrt(a * a * sn * sn + b * b * cs * cs) * 1.1 + 0.5 * Math.abs(eyeDy_);
        if (hw <= 0.96 * P.erx && hh <= 0.96 * P.ery) return r;
      }
      return 0.4;
    }

    function wobble() { return { a1: rng.range(0.025, 0.055), m1: rng.range(0.55, 1.25), p1: rng.range(0, TAU), a2: rng.range(0.008, 0.02), m2: rng.range(1.8, 3.2), p2: rng.range(0, TAU) }; }
    function common(sp) {
      sp.wob = wobble();
      sp.f1 = rng.range(0.5, 1.0); sp.nu1 = rng.range(0.06, 0.12); sp.f2 = rng.range(2.4, 3.6); sp.nu2 = rng.range(0.15, 0.28);
      sp.p1 = rng.range(0, TAU); sp.p2 = rng.range(0, TAU);
      sp.ua = rng.range(0.012, 0.034); sp.mu = rng.range(0.8, 1.8); sp.pu = rng.range(0, TAU); sp.uOm = rng.range(0.45, 0.8);
      sp.omega = 0.125 * rng.range(0.9, 1.15) * 1.45;
      sp.sway = rng.range(0.03, 0.08); sp.swayNu = rng.range(0.05, 0.11); sp.swayPh = rng.range(0, TAU);
      sp.pul = rng.range(0.006, 0.02); sp.pulNu = rng.range(0.08, 0.16); sp.pulPh = rng.range(0, TAU);
      sp.tA = rng.range(0.6, 1.2);
      return sp;
    }

    // ---- THE VORTEX (everything lives inside the envelope ellipse and REVOLVES around her; the eye is at her head / neck) ---------------------------------
    //  * lead arm from the big thought dot
    //  * 6 inward-spiralling arms (the pinwheel / funnel of the approved look), 2 heavy ink ones, one of them mirrored (counter-rotating)
    //  * 2 big black rings (opposite tilts), 4 orbit arcs at mid radius with organic radius noise (two counter-rotating), 2 hand-drawn S gestures with strong wobble
    //  * 4 hooks that overshoot and bend back on themselves, 4 pencil-scribble clusters circling her head, 6 quick thin flicks that race across the field and fade
    //  * 2 broad pale sweeps, 5 dotted / dashed / comet trails
    // arm rows: t kind, a start angle (deg), r0 start/outer rho, k log-spiral slope (negative = inward), r1 inner rho ('in') | phiEnd, w width, c colour, tilt (deg), fr front,
    //           nu/f swell cycles per s / per 1000 u, lo min width, tin/tout end tapers, om omega multiplier (negative = counter-rotating), dir spiral sense, bf birth (fraction of T), dd draw seconds, wa/wm wobble
    // GOLDEN LOGIC: the inward spirals grow by the golden ratio every quarter turn (k = -ln(phi) / (pi/2) = -0.306); start angles of ribbons / rings / hooks / flicks are spaced by the golden angle
    // (137.5 deg), so nothing clumps and nothing is accidentally parallel.  One dominant gesture = 3 long bold ribbons; supporting fine lines come as intentional silk BUNDLES.
    var armRows = [
      // --- 3 dominant tapered ribbons around the cloud (thick middle, hairline tips); the first is the golden spiral that sweeps in to her head; the first two pass in front of her
      { t: 'in', a: -100, r0: 2.40, k: -0.306, r1: 0.95, w: 7.0, c: 'ink', tilt: 12, fr: 0, lw: [{ c: 0.42, hw: 98, a: 40, l: 120, sg: 1, ph: 0 }, { c: 0.9, hw: 53, a: 28, l: 70, sg: -1, ph: 0 }], roll: 1.3, nu: -0.40, f: 0.90, lo: 0.70, tf: 0.42, om: 1.0, dir: 1, bf: 0.27, dd: 3.6 },
      { t: 'in', a: 37.5, r0: 2.50, k: -0.12, r1: 1.55, w: 6.6, c: 'ink', tilt: 8, fr: 1, lw: [{ c: 0.34, hw: 106, a: 42, l: 130, sg: -1, ph: 0 }, { c: 0.92, hw: 56, a: 30, l: 75, sg: -1, ph: 0 }], roll: -1.1, nu: -0.36, f: 0.95, lo: 0.70, tf: 0.42, om: 1.1, dir: 1, bf: 0.355, dd: 3.6 },
      { t: 'in', a: 175, r0: 2.40, k: -0.10, r1: 1.45, w: 5.8, c: 'ink', tilt: 14, fr: 0, lw: [{ c: 0.7, hw: 98, a: 40, l: 120, sg: 1, ph: 0 }], roll: 1.5, nu: -0.28, f: 1.00, lo: 0.70, tf: 0.42, om: 0.9, dir: 1, bf: 0.50, dd: 3.4 },
      // --- two rings that hold the cloud; the second is a counter-current
      { t: 'out', a: 80, r0: 1.25, k: 0.045, r1: 4.2, w: 3.8, c: 'ink', tilt: 10, fr: 0, lw: [{ c: 0.5, hw: 100, a: 34, l: 100, sg: 1, ph: 0 }], roll: -1.2, nu: 0.30, f: 0.90, lo: 0.70, tf: 0.38, om: 1.15, dir: 1, bf: 0.072, dd: 3.0 },   // ROUND 10 act I: a small tight ring that begins to orbit her early and slowly widens
      { t: 'out', a: 217.5, r0: 2.20, k: 0.02, r1: 4.6, w: 3.4, c: 'ink', tilt: 6, fr: 0, lw: [{ c: 0.5, hw: 105, a: 42, l: 130, sg: -1, ph: 0 }], roll: 1.0, nu: 0.26, f: 1.00, lo: 0.70, tf: 0.40, om: -0.9, dir: -1, bf: 0.428, dd: 3.2 },
      // --- one calligraphic S gesture that weaves across the cloud
      { t: 'ges', a: 138, r0: 1.20, k: 0.17, r1: 4.2, w: 4.0, c: 'ink', tilt: -2, fr: 0, lw: [{ c: 0.5, hw: 94, a: 34, l: 100, sg: 1, ph: 0 }], roll: -1.4, nu: 0.36, f: 1.00, lo: 0.40, tf: 0.34, om: 1.0, dir: 1, bf: 0.572, dd: 3.2, wa: 0.20, wm: 1.15 },
    ];
    // silk BUNDLES (3 + 3 + 4 fine lines): same path / speed / breathing, small fan-out, centre lines bolder, ends staggered
    var bundleRows = [
      { t: 'in', n: 3, a: -92, r0: 2.35, k: -0.306, r1: 1.00, w: 2.5, tilt: 12, om: 1.0, dir: 1, da: 0.060, dr: 0.040, bf: 0.319, dd: 3.4, cols: ['g1', 'ink', 'g1'] },     // sweeps with the first ribbon
      { t: 'orb', n: 3, a: 150, r0: 2.15, k: 0.03, r1: 4.3, w: 2.2, tilt: 10, om: 1.3, dir: 1, da: 0.045, dr: 0.040, bf: 0.675, dd: 3.2, wa: 0.0, wm: 1.1, cols: ['g1', 'ink', 'g1'] },   // outer silk orbit around the whole cloud
      { t: 'in', n: 2, a: 20, r0: 2.30, k: -0.14, r1: 1.40, w: 2.0, tilt: 8, om: -1.0, dir: -1, da: 0.060, dr: 0.045, bf: 0.729, dd: 3.0, cols: ['ink', 'g1'] },     // elegant counter-current
    ];
    var hookRows = [   // overshoot-and-curl arcs: a start angle, dir, r rho, span rad, drift, curl (inward bend of the return leg), w, c, tilt, bf
      { a: -30, dir: 1, r: 1.70, span: 2.4, drift: 0.15, curl: 0.50, w: 2.8, c: 'ink', tilt: 12, bf: 0.705, om: 1.0 },
      { a: 107.5, dir: -1, r: 1.50, span: 2.2, drift: 0.15, curl: 0.50, w: 2.4, c: 'ink', tilt: 6, bf: 0.80, om: -1.1 },
    ];
    var scribRows = [  // 2 graceful cursive LOOP flourishes drifting along an orbit: a start angle, dir, rho cluster radius, span orbit rad, loop size, loops, w, c, tilt, bf
      { a: -120, dir: 1, r: 1.50, span: 0.8, size: 0.27, m: 2.3, w: 2.4, c: 'ink', tilt: 8, bf: 0.753, om: 1.5 },
      { a: 17.5, dir: -1, r: 1.35, span: 0.75, size: 0.27, m: 2.1, w: 2.2, c: 'ink', tilt: -4, bf: 0.85, om: -1.7 },
    ];
    var flickRows = [];   // quick thin flicks (golden-angle spaced): a angle, ra rho, span (deg) to the end point, rb rho, bend, curl, w, c, tilt, t0 (fraction of T), per s, dur s, hw half window
    (function () {
      var FW = [2.2, 2.4, 2.6, 2.2, 2.5, 2.3, 2.6, 2.4], FT = [10, -16, 22, -22, 6, -8, 14, -12], FS = [120, 100, 140, 110, 95, 125, 115, 105];
      for (var q = 0; q < 8; q += 2) flickRows.push({ a: -160 + q * 137.5, ra: 1.9 + 0.2 * ((q * 3) % 4) / 3, span: FS[q], rb: 1.35 + 0.35 * ((q * 5) % 4) / 3, bend: (q & 1 ? -1 : 1) * (0.22 + 0.03 * (q % 3)), curl: (q & 2 ? -1 : 1) * 0.06,
        w: FW[q], c: q === 2 || q === 5 ? 'g1' : 'ink', tilt: FT[q], t0: 0.69 + 0.07 * q, per: 2.7 + 0.18 * ((q * 7) % 6), dur: 0.85 + 0.04 * (q % 4), hw: 0.15 + 0.01 * (q % 4) });
    })();
    var nBun = 0; for (var bq = 0; bq < bundleRows.length; bq++) nBun += bundleRows[bq].n;
    var N = 1 + armRows.length + nBun + hookRows.length + scribRows.length + flickRows.length;
    var i;
    // ---- lead arm: starts at the big thought dot (inverse of the transform at t = tStart)
    var g0 = gstate(P.tStart, {});
    var inv = worldToCircle(P.origin.x, P.origin.y, g0);
    var rhoO = Math.hypot(inv.u, inv.v), thO = Math.atan2(inv.v, inv.u);
    jobs.push(function () {
      var sp = common({ kind: 'arm' }), L;
      sp.base = 8.0; sp.col = 'ink'; sp.tipDot = BIG_R; sp.front = 1; sp.lo = rng.range(0.16, 0.26);
      sp.lead = true; sp.rho0 = rhoO; sp.th0 = thO; sp.k0 = 0.030; sp.k1 = 0.03; sp.launch = 0.85; sp.phiEnd = 6.4; sp.tin = 70; sp.tout = 260;
      sp.wob.a1 *= 0.7; sp.wob.a2 *= 0.7; sp.tilt = 0; sp.nu1 = 0.42; sp.f1 = 0.85; sp.lo = 0.10; sp.rmax = capRho(0) * 0.97;
      sp.sway = 0.02; sp.tA = 0.5; sp.tol = 1.7; sp.chord = 200;
      L = makeLine(sp); L.idx = 0; L.bf = 0; L.dd = U.clamp(0.36 * T, 2.2, 3.8); G.arms.push(L);
    });
    function armJob(r) {
      jobs.push(function () {
        var sp = common({ kind: 'arm' }), L, tl = (r.tilt + rng.range(-3, 3)) * DEG;
        sp.base = r.w; sp.col = r.c; sp.tipDot = 0; sp.front = r.fr; sp.lo = r.lo; sp.tin = r.tin || 300; sp.tout = r.tout || 300; if (r.tf) { sp.tinF = r.tf; sp.toutF = r.tf; sp.tol = 1.3; sp.chord = 170; }
        sp.tilt = tl; sp.nu1 = r.nu; sp.f1 = r.f; sp.dir = r.dir;
        sp.th0 = (r.a + rng.range(-8, 8)) * DEG; sp.k1 = 0; sp.omega *= r.om;
        sp.rmax = capRho(tl) * 0.97;
        if (r.lw) { sp.lw = r.lw; sp.loopRoll = r.roll || 1; sp.ds = 2.5; sp.tol = 2.0; sp.chord = 180; sp.loopSwell = r.w >= 4 ? 0.5 : 0.35; }
        if (r.t === 'in' || r.t === 'out') { sp.ub = 0.032; sp.wl = rng.range(470, 560); sp.pb = rng.range(0, TAU); sp.bOm = rng.range(0.25, 0.45); }
        if (r.t === 'in') {                                                       // inward spiral from the outer field to the wanted radius
          sp.rho0 = Math.min(r.r0 * rng.range(0.96, 1.05), sp.rmax * 0.99); sp.k0 = r.k * rng.range(0.94, 1.06);
          sp.phiEnd = Math.log(sp.rho0 / (r.r1 * rng.range(0.94, 1.08))) / -sp.k0;
        } else if (r.t === 'out') {                                               // a ring: slowly outward
          sp.rho0 = r.r0; sp.k0 = r.k; sp.phiEnd = r.r1 * rng.range(0.95, 1.05);
        } else if (r.t === 'orb') {                                               // orbit arc: nearly circular, organically displaced radius
          sp.rho0 = r.r0 * rng.range(0.96, 1.04); sp.k0 = r.k; sp.phiEnd = r.r1 * rng.range(0.95, 1.05);
          sp.wob.a1 = r.wa; sp.wob.m1 = r.wm; sp.wob.a2 = 0.05; sp.wob.m2 = rng.range(2.6, 4.0);
          sp.ub = 0.008; sp.wl = rng.range(130, 200); sp.pb = rng.range(0, TAU); sp.bOm = rng.range(0.9, 1.5);          // a little high-frequency wobble
        } else {                                                                  // gesture: strong wobble = S-curve
          sp.rho0 = r.r0 * rng.range(0.97, 1.04); sp.k0 = r.k; sp.phiEnd = r.r1 * rng.range(0.97, 1.04);
          sp.wob.a1 = r.wa; sp.wob.m1 = r.wm; sp.wob.a2 = 0.04; sp.wob.m2 = rng.range(2.0, 2.8); sp.gest = true;
          sp.ub = 0.030; sp.wl = rng.range(300, 400); sp.pb = rng.range(0, TAU); sp.bOm = rng.range(0.5, 0.8);
        }
        L = makeLine(sp); L.idx = G.arms.length; L.bf = r.bf; L.dd = r.dd; G.arms.push(L);
      });
    }
    for (i = 0; i < armRows.length; i++) armJob(armRows[i]);
    // silk bundles: all lines of a bundle share ONE set of motion parameters (they flow, breathe, sway and shear together); only the fan-out differs
    function bundleJobs(r) {
      var sh = null;
      for (var bi = 0; bi < r.n; bi++) (function (bi) {
        jobs.push(function () {
          var sp = common({ kind: 'arm' }), L, mid = (r.n - 1) / 2, off = bi - mid, tl = r.tilt * DEG, am = Math.abs(off) / Math.max(1, mid);
          if (!sh) sh = { ub: 0.032, wl: 520, pb: rng.range(0, TAU), bOm: 0.35, wob: sp.wob, mu: sp.mu, pu: sp.pu, uOm: sp.uOm, omega: sp.omega, sway: sp.sway, swayNu: sp.swayNu, swayPh: sp.swayPh, pul: sp.pul, pulNu: sp.pulNu, pulPh: sp.pulPh, tA: 1, nu1: sp.nu1, f1: sp.f1, p1: sp.p1, ua: 0.010 };
          sp.wob = sh.wob; sp.mu = sh.mu; sp.pu = sh.pu; sp.uOm = sh.uOm; sp.omega = sh.omega * r.om; sp.sway = sh.sway; sp.swayNu = sh.swayNu; sp.swayPh = sh.swayPh; sp.pul = sh.pul; sp.pulNu = sh.pulNu; sp.pulPh = sh.pulPh;
          sp.tA = 1; sp.ua = sh.ua; sp.ub = sh.ub; sp.wl = sh.wl; sp.pb = sh.pb; sp.bOm = sh.bOm; sp.nu1 = sh.nu1; sp.f1 = sh.f1 + 0.07 * off; sp.p1 = sh.p1;
          sp.base = r.w * (1.25 - 0.55 * am); sp.col = r.cols[bi % r.cols.length]; sp.tipDot = 0; sp.front = 0; sp.lo = 0.62; sp.tilt = tl; sp.dir = r.dir; sp.k1 = 0;
          sp.tinF = 0.30 + 0.12 * am; sp.toutF = 0.36 + 0.10 * am; sp.tin = 300; sp.tout = 300; sp.tol = 1.2; sp.chord = 220;
          sp.rmax = capRho(tl) * 0.97;
          sp.th0 = r.a * DEG + off * r.da; sp.k0 = r.k;
          if (r.t === 'in') { sp.rho0 = Math.min(r.r0 * (1 + off * r.dr), sp.rmax * 0.99); sp.phiEnd = Math.log(sp.rho0 / (r.r1 * (1 + 0.05 * off))) / -sp.k0; }
          else { sp.rho0 = r.r0 * (1 + off * r.dr); sp.phiEnd = r.r1 * (1 - 0.04 * am); sp.wob.a1 = r.wa; sp.wob.m1 = r.wm; sp.wob.a2 = 0.0; sp.wob.m2 = 2.9; }
          sp.own = true;
          L = makeLine(sp); L.idx = G.arms.length; L.bf = r.bf + 0.02 * bi; L.dd = r.dd; G.arms.push(L);
        });
      })(bi);
    }
    for (i = 0; i < bundleRows.length; i++) bundleJobs(bundleRows[i]);

    // ---- hooks: the arc runs on past its target, then bends back on itself on a smaller radius
    function hookJob(r) {
      jobs.push(function () {
        var sp = common({ kind: 'arm' }), L, tl = (r.tilt + rng.range(-3, 3)) * DEG, th0 = (r.a + rng.range(-8, 8)) * DEG, back = rng.range(0.50, 0.58);
        sp.base = r.w; sp.col = r.c; sp.tipDot = 0; sp.front = 0; sp.lo = 0.18; sp.tin = 220; sp.tout = 260; sp.tilt = tl; sp.omega *= r.om; sp.rmax = capRho(tl) * 0.97;
        sp.phiEnd = 1; sp.dp = 1 / 900; sp.nu1 = 0.3; sp.f1 = 1.0; sp.ds = 6; sp.tol = 0.7;
        sp.uv = function (p, out) {
          var th = th0 + r.dir * r.span * (p + 0.12 * back * sstep(0.5, 1, p)), rr_ = r.r * (1 + r.drift * p) * (1 - r.curl * sstep(0.3, 1, p));      // overshoot, then curl in (monotonic angle: no cusp, whatever the shear)
          out.u = rr_ * Math.cos(th); out.v = rr_ * Math.sin(th);
        };
        sp.ub = 0.007; sp.wl = rng.range(110, 170); sp.pb = rng.range(0, TAU); sp.bOm = rng.range(1.0, 1.6);
        L = makeLine(sp); L.idx = G.arms.length; L.bf = r.bf; L.dd = 2.2; G.arms.push(L);
      });
    }
    for (i = 0; i < hookRows.length; i++) hookJob(hookRows[i]);
    // ---- loose pencil scribbles: a looping stroke that drifts along an orbit around her head (rigid: the whole cluster revolves as one)
    function scribJob(r) {
      jobs.push(function () {
        var sp = common({ kind: 'arm' }), L, tl = (r.tilt + rng.range(-3, 3)) * DEG, th0 = (r.a + rng.range(-10, 10)) * DEG, ph = rng.range(0, TAU);
        sp.base = r.w; sp.col = r.c; sp.tipDot = 0; sp.front = 0; sp.lo = 0.45; sp.tin = 90; sp.tout = 120; sp.tilt = tl; sp.omega *= r.om; sp.rmax = capRho(tl) * 0.97;
        sp.phiEnd = 1; sp.dp = 1 / 1500; sp.nu1 = 0.35; sp.f1 = 2.4; sp.ds = 4; sp.tol = 1.1; sp.rwc = Math.pow(r.r, -DIFFROT); sp.tA = 1.1; sp.sway = rng.range(0.04, 0.10);
        sp.uv = function (p, out) {
          var thc = th0 + r.dir * r.span * p, Rp = r.r * (1 + 0.07 * Math.sin(2.3 * p + ph)), en = Math.sin(Math.PI * p); en = en * en * (0.9 + 0.1 * Math.sin(5.1 * p + ph * 1.7));
          var psi = TAU * r.m * p + ph * 2, a = r.size * (0.80 + 0.20 * Math.min(1, 1.6 * en));
          var lx = a * Math.cos(psi), ly = a * Math.sin(psi);       // along the orbit / radial: overlapping, overshooting loops
          var c = Math.cos(thc), s = Math.sin(thc);
          out.u = (Rp + ly) * c - lx * s; out.v = (Rp + ly) * s + lx * c;
        };
        L = makeLine(sp); L.idx = G.arms.length; L.bf = r.bf; L.dd = 2.0; G.arms.push(L);
      });
    }
    for (i = 0; i < scribRows.length; i++) scribJob(scribRows[i]);
    // ---- quick thin flicks: a long gentle path (static), a short bright window races along it and fades; repeats
    function flickJob(r) {
      jobs.push(function () {
        var sp = common({ kind: 'arm' }), L, tl = (r.tilt + rng.range(-3, 3)) * DEG, ta = (r.a + rng.range(-10, 10)) * DEG, tb2 = ta + r.span * DEG * (rng.next() < 0.5 ? 1 : -1);
        sp.base = r.w; sp.col = r.c; sp.tipDot = 0; sp.front = 0; sp.lo = 0.6; sp.tin = 60; sp.tout = 60; sp.tilt = tl; sp.omega = 0; sp.rwc = 0; sp.rmax = capRho(tl) * 0.97;
        sp.phiEnd = 1; sp.dp = 1 / 500; sp.nu1 = 0.2; sp.f1 = 0.6; sp.tA = 0.8; sp.sway = 0; sp.ua = 0.0; sp.ds = 8; sp.tol = 0.7;
        var au = r.ra * Math.cos(ta), av = r.ra * Math.sin(ta), bu = r.rb * Math.cos(tb2), bv = r.rb * Math.sin(tb2);
        sp.uv = function (p, out) {
          var x = au + (bu - au) * p, y = av + (bv - av) * p, nx = -(bv - av), ny = bu - au, bw = r.bend * Math.sin(Math.PI * p) + r.curl * Math.sin(TAU * p);
          out.u = x + nx * bw; out.v = y + ny * bw;
        };
        sp.flick = { t0: 0, per: r.per, dur: r.dur, hw: r.hw };
        L = makeLine(sp); L.idx = G.arms.length; L.bf = r.t0; L.dd = 0.01; G.arms.push(L);
      });
    }
    for (i = 0; i < flickRows.length; i++) flickJob(flickRows[i]);

    // ---- broad pale sweeps (soft): [mode, angle deg, rho start, k, rho end | phiEnd, width, front, tilt deg]
    var swRows = [
      ['loop', 200, 0.80, 0.045, 6.2, 18, 1, 8],            // ONE broad pale loop around her at waist height (near-circular, slowly widening)
      ['in', 74, 2.35, -0.306, 1.00, 22, 0, 12],            // a pale sheen under the first ribbon
    ];
    function sweepJob(k) {
      jobs.push(function () {
        var r = swRows[k], sp = common({ kind: 'sweep' }), L, ph;
        sp.tilt = r[7] * DEG; sp.rmax = capRho(sp.tilt) * 0.97;
        if (r[0] === 'loop') { sp.rho0 = r[2]; sp.th0 = r[1] * DEG; sp.k0 = r[3]; sp.k1 = 0; sp.phiEnd = r[4]; }
        else { ph = Math.log(r[2] / r[4]) / -r[3]; sp.rho0 = Math.min(r[2], sp.rmax * 0.99); sp.th0 = r[1] * DEG - ph; sp.k0 = r[3]; sp.k1 = 0; sp.phiEnd = Math.log(sp.rho0 / r[4]) / -r[3]; sp.th0 = r[1] * DEG - sp.phiEnd; }
        sp.base = r[5]; sp.front = r[6];
        sp.col = 'g4'; sp.col2 = 'g3'; sp.lo = 0.14; sp.tin = 330; sp.tout = 420; sp.tipDot = 0; sp.tA = 0.6;
        sp.f1 = rng.range(0.55, 0.9); sp.nu1 = -rng.range(0.05, 0.09);
        L = makeLine(sp); L.idx = 100 + k; G.sweeps.push(L);
      });
    }
    for (i = 0; i < swRows.length; i++) sweepJob(i);
    // ---- dotted / dashed lines + comet trails: [kind, angle at the inner end deg, rho inner, k, rho outer, width, colour, gap, gap variation]
    var patRows = [['dots', -150, 1.00, -0.45, 2.45, 7.2, 'ink', 15, 0.65], ['dots', 70, 1.10, -0.50, 2.35, 4.8, 'g1', 11, 0.7], ['dash', -20, 1.30, -0.40, 2.45, 2.6, 'ink', 20, 0.55],
      ['dots', 235, 1.00, -0.55, 2.1, 4.2, 'g1', 10, 0.6]];
    var patTilt = [8, 14, 6, 12];
    function patJob(k) {
      jobs.push(function () {
        var r = patRows[k], sp = common({ kind: r[0] }), L;
        sp.tilt = patTilt[k] * DEG; sp.rmax = capRho(sp.tilt) * 0.97;
        var rout = Math.min(r[4], sp.rmax * 0.99), ph = Math.log(rout / r[2]) / -r[3];
        sp.rho0 = rout; sp.th0 = r[1] * DEG - ph; sp.k0 = r[3]; sp.k1 = 0; sp.phiEnd = ph; sp.base = r[5]; sp.col = r[6]; sp.gap = r[7]; sp.gv = r[8];
        sp.lo = 0.5; sp.tin = 260; sp.tout = 300; sp.tinF = 0.9; sp.toutF = 0.07; sp.tipDot = 0;     // dot size grows from a speck at the far end to full size near her sp.f1 = rng.range(1.2, 1.8); sp.nu1 = rng.range(0.08, 0.14); sp.tA = 0.7;
        L = makeLine(sp); L.idx = 200 + k; G.pats.push(L);
        // slots (static): positions as fractions of the arclength, varying spacing
        var A = [], Ln2 = [], a = 0.012, gp = rng.range(0, TAU), gf = rng.range(1.3, 2.4);
        while (a < 0.995) {
          var gapw = sp.gap * (1 + 0.5 * sp.gv * Math.sin(TAU * gf * a + gp)) * (1.5 - 0.8 * a) * rng.range(0.92, 1.08);        // cadence: spacing tightens as the dots approach her
          var len = sp.kind === 'dash' ? rng.range(10, 44) : 0;
          A.push(a); Ln2.push(len / L.len);
          a += (gapw + len) / L.len;
        }
        L.slotA = Float32Array.from(A); L.slotL = Float32Array.from(Ln2); L.flow = -rng.range(2.4, 3.6); L.flowPh = rng.range(0, 50);
      });
    }
    for (i = 0; i < patRows.length; i++) patJob(i);

    // ---- growth schedule + accents + budget reference + launch direction (one job each, all cheap)
    jobs.push(function () {
      var L, k, tLate = isFinite(P.tHit) ? P.tHit - 0.9 : P.tFull + 2.0;
      for (k = 0; k < G.arms.length; k++) {
        L = G.arms[k];
        L.dur = L.dd;
        if (k === 0) { L.tb = P.tStart; continue; }
        L.tb = P.tStart + L.bf * T + rng.range(-0.03, 0.03) * T;
        if (L.flick) { L.sp.flick.t0 = L.tb; L.dur = 0.01; L.tb = L.tb - 0.01; L.hs = 1; }
        else if (L.bf <= 1) L.tb = Math.min(L.tb, P.tFull - L.dur - 0.25);
        else L.tb = Math.min(L.tb, tLate - L.dur);
      }
      var swBirth = [0.39, 0.48];
      for (k = 0; k < G.sweeps.length; k++) { L = G.sweeps[k]; L.dur = U.clamp(rng.range(0.30, 0.40) * T, 2.4, 3.8); L.tb = Math.min(P.tStart + swBirth[k] * T, P.tFull - L.dur - 0.2); }
      var patBirth = [0.46, 0.56, 0.72, 0.81, 0.86];
      for (k = 0; k < G.pats.length; k++) { L = G.pats[k]; L.dur = U.clamp(rng.range(0.26, 0.34) * T, 2.0, 3.2); L.tb = Math.min(P.tStart + patBirth[k] * T, P.tFull - L.dur - 0.2); }
      // floating accents: calm dots and rings
      var kinds = ['dot', 'dot', 'ring', 'dot', 'dot', 'ring', 'dot', 'dot', 'ring', 'dot', 'dot', 'dot', 'ring', 'dot'];
      for (k = 0; k < kinds.length; k++) {
        var ac = { k: kinds[k] };
        ac.rho = rng.range(0.9, 2.3); ac.th = rng.range(0, TAU); ac.om = 0.125 * rng.range(0.7, 1.3) * 1.4 * (rng.next() < 0.3 ? -1 : 1);
        ac.tb = P.tStart + T * (0.10 + 0.82 * rng.next());
        ac.ph = rng.range(0, TAU); ac.ang = rng.range(0, TAU);
        if (ac.k === 'dot') { ac.r = rng.range(2.2, 4.6); ac.col = rng.next() < 0.7 ? 'ink' : 'g1'; }
        else { ac.r = rng.range(5, 8.5); ac.col = rng.next() < 0.6 ? 'ink' : 'g1'; }
        ac.front = 0;
        G.acc.push(ac);
      }
      G.accPos = new Array(G.acc.length);
      for (k = 0; k < G.acc.length; k++) G.accPos[k] = { x: 0, y: 0, a: 0, s: 0 };
    });
    // decimation + cube-budget reference: one small job per line (each evaluates the complete line at three moments), then the final job
    var nLines = 1 + armRows.length + nBun + hookRows.length + scribRows.length + flickRows.length + swRows.length + patRows.length, dec = null;
    function decJob(k) {
      jobs.push(function () {
        if (!dec) {
          var tM = P.tStart + 0.25 * (P.tFull - P.tStart), tB = isFinite(P.tHit) ? P.tHit - 0.2 : P.tFull + 2.0;
          dec = { tM: tM, tB: tB, gM: gstate(tM, {}), gB: gstate(tB, {}), gF: gstate(P.tFull, {}) };
          G.refAcc = 0;
        }
        var L = G.lines[k];
        if (!L) return;
        var tb0 = L.tb; L.tb = -1e9;                                          // evaluate the complete line (no growth head)
        var mask = new Uint8Array(L.n);
        evalLine(L, dec.tM, dec.gM); decimateMask(L, mask);
        evalLine(L, dec.tB, dec.gB); decimateMask(L, mask);
        evalLine(L, P.tFull, dec.gF); decimateMask(L, mask);
        L.tb = tb0;
        finishDecimate(L, mask);
        if (L.kind === 'dots' || L.kind === 'dash') return;
        lineWeights(L, L.n);
        G.refAcc += L.visLen * L.wt;
      });
    }
    for (i = 0; i < nLines; i++) decJob(i);
    jobs.push(function () {
      P.refW = Math.max(1, G.refAcc);
      // direction the big dot launches in (for the anticipation pull-back)
      var l = G.arms[0], g = gstate(P.tStart, {});
      evalLine(l, P.tStart, g);
      var d = Math.hypot(l.X[4] - l.X[0], l.Y[4] - l.Y[0]) || 1;
      G.leadDir = { x: (l.X[4] - l.X[0]) / d, y: (l.Y[4] - l.Y[0]) / d };
      G.ready = true; lastT = NaN;
    });
    lastT = NaN;
    if (!sliced) finishBuild();
  }
  /** run the pending build jobs (all of them, or until budgetMs is used up); true while jobs remain */
  function buildJobs(budgetMs) {
    if (!G || G.ready) return false;
    var t0 = nowMs(), jobs = G.jobs;
    while (G.ji < jobs.length) {
      jobs[G.ji++]();
      if (budgetMs !== Infinity && nowMs() - t0 >= budgetMs) break;
    }
    return !G.ready;
  }
  function finishBuild() { buildJobs(Infinity); }

  /** vertex decimation (deviation based): a vertex is kept when the polyline would otherwise deviate more than tol units from the line (tol 0.2-0.55 by line weight, sweeps 0.9),
      or span more than 90 units (sweeps 160); every 2nd vertex near the tapering ends.  The mask of several moments is OR-ed, then L.keep = kept indices, L.kidx[j] = first kept
      position with keep >= j. */
  function decimateMask(L, mask) {
    var n = L.n, X = L.X, Y = L.Y, sweep = L.kind === 'sweep', tol = L.sp.tol || (sweep ? 1.0 : Math.min(0.7, 0.32 + 0.07 * L.sp.base)), maxChord = L.sp.chord || (sweep ? 160 : 90), endLen = sweep ? 160 : 60;
    if (tol < 1.5) tol *= 1.15;                                                     // ROUND 10: the arms are ~30 % longer in the bigger envelope: +15 % tolerance (still sub-pixel) and +25 % chord keep the vertex count near the round-9 budget
    if (!sweep) maxChord *= 1.25;
    var dist = new Float32Array(n), j, m, last = 0;
    for (j = 1; j < n; j++) { var dx = X[j] - X[j - 1], dy = Y[j] - Y[j - 1]; dist[j] = dist[j - 1] + Math.sqrt(dx * dx + dy * dy); }
    var total = dist[n - 1];
    mask[0] = 1; mask[n - 1] = 1;
    for (j = 1; j < n - 1; j++) {
      var e = j + 1, ax = X[last], ay = Y[last], bx = X[e] - ax, by = Y[e] - ay, bl = Math.sqrt(bx * bx + by * by) || 1e-6;
      var ok = dist[e] - dist[last] < maxChord && !((dist[j] < endLen || total - dist[j] < endLen) && j - last >= 2);
      if (ok) for (m = last + 1; m < e; m++) { var d = Math.abs((X[m] - ax) * by - (Y[m] - ay) * bx) / bl; if (d > tol) { ok = false; break; } }
      if (!ok) { mask[j] = 1; last = j; }
    }
  }
  function finishDecimate(L, mask) {
    var n = L.n, keep = [], j, q = 0;
    for (j = 0; j < n; j++) if (mask[j]) keep.push(j);
    L.keep = Uint16Array.from(keep);
    L.kidx = new Uint16Array(n + 1);
    for (j = 0; j <= n; j++) { while (q < keep.length && keep[q] < j) q++; L.kidx[j] = q; }
  }

  function inBox(x, y, m) { var P = G.P; return x > -m && x < P.W + m && y > P.vt - m && y < P.vb + m; }
  /** visible length (inside the stage +40 units) of the first nE frozen/evaluated points of L + the cube weight / max cube size of its kind */
  function lineWeights(L, nE) {
    var vis = 0, X = L.X, Y = L.Y;
    for (var j = 1; j < nE; j++) if (inBox(X[j], Y[j], 40)) { var dx = X[j] - X[j - 1], dy = Y[j] - Y[j - 1]; vis += Math.sqrt(dx * dx + dy * dy); }
    if (L.flick) vis *= 2.2 * L.flick.hw;
    L.visLen = vis; L.wt = L.kind === 'sweep' ? 0.9 : 0.7 + 0.12 * L.sp.base;
    L.maxCube = L.kind === 'sweep' ? 26 : U.clamp(8 + 3.6 * L.sp.base, 9, 26);
  }

  // ------------------------------------------------------------------------------------------------ accents
  function accentPos(ac, te, g, out) {
    var th = ac.th - ac.om * g.R * Math.pow(Math.max(ac.rho, 0.5), -DIFFROT);
    var rho = ac.rho * (1 + 0.025 * Math.sin(0.7 * te + ac.ph));
    toWorld(rho * Math.cos(th), rho * Math.sin(th), rho, g, G.pt);
    var x = G.pt.x, y = G.pt.y;
    toWorld(rho * Math.cos(th - 0.03), rho * Math.sin(th - 0.03), rho, g, G.pt);   // tangent along the inward flow
    out.a = Math.atan2(G.pt.y - y, G.pt.x - x);
    squeeze(x + 4 * Math.sin(0.9 * te + ac.ph), y + 4 * Math.cos(0.77 * te + ac.ph * 1.3), out);
    out.s = eBack((te - ac.tb) / 0.45);
    return out;
  }

  // ------------------------------------------------------------------------------------------------ pattern lines (dots / dashes): shared geometry callback
  /** positions of the dots (mode 'dots') or dashes ('dash') of pattern line L at time te. Calls emit(x,y,r|w, ex,ey, mx,my). */
  function patternGeom(L, te, emit) {
    var K = L.slotA.length, n = L.n, A = L.slotA, Ls = L.slotL, tau = L.flow * te + L.flowPh, hs = L.hs;
    var X = L.X, Y = L.Y, Wd = L.Wd, nm = n - 1;
    for (var k = 0; k < K; k++) {
      var q = k - tau; q -= Math.floor(q / K) * K;                 // dot k marches inward and wraps around
      var q0 = Math.floor(q), fq = q - q0, q1 = q0 + 1 >= K ? q0 : q0 + 1;
      var a = A[q0] + (A[q1] - A[q0]) * fq;
      if (a > hs) continue;
      var j = a * nm, j0 = Math.floor(j), f = j - j0; if (j0 >= nm) { j0 = nm - 1; f = 1; }
      var x = X[j0] + (X[j0 + 1] - X[j0]) * f, y = Y[j0] + (Y[j0 + 1] - Y[j0]) * f, w = Wd[j0] + (Wd[j0 + 1] - Wd[j0]) * f;
      w *= sstep(0, 0.035, hs - a);
      if (w < 0.25 || x < -30 || x > G.P.W + 30 || y < G.P.vt - 30 || y > G.P.vb + 30) continue;
      var sdx_ = Math.abs(x - G.P.shx) - G.P.shw - 22, sdy_ = G.P.shy0 - 22 - y;       // dots / dashes keep away from her shoes too
      if (sdx_ < 0 && sdy_ < 0 && y < G.P.shy1 + 22) continue;
      if (L.kind === 'dots') emit(x, y, w * 0.5, 0, 0, 0, 0);
      else {
        var la = Ls[q0] + (Ls[q1] - Ls[q0]) * fq, b = Math.min(hs, a + la);
        var jb = b * nm, jb0 = Math.floor(jb), fb = jb - jb0; if (jb0 >= nm) { jb0 = nm - 1; fb = 1; }
        var ex2 = X[jb0] + (X[jb0 + 1] - X[jb0]) * fb, ey2 = Y[jb0] + (Y[jb0 + 1] - Y[jb0]) * fb;
        var jm = (a + b) * 0.5 * nm, jm0 = Math.floor(jm), fm = jm - jm0; if (jm0 >= nm) { jm0 = nm - 1; fm = 1; }
        emit(x, y, w * 0.8, ex2, ey2, X[jm0] + (X[jm0 + 1] - X[jm0]) * fm, Y[jm0] + (Y[jm0 + 1] - Y[jm0]) * fm);
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ dissolve (runtime): freeze, pieces, spawning
  /** state of the two thought dots before the launch (+ the small one afterwards) at time t -> o {sx,sy,sr, bx,by,br}  (r = 0: not visible) */
  function dotsState(t, o) {
    var P = G.P, p0 = P.origin;
    o.sr = 0; o.br = 0;
    if (t < P.tDots) return o;
    var sa = eBack((t - P.tDots) / 0.55), ba = eBack((t - P.tDots - 0.28) / 0.55);
    var risS = 1 - eOut3((t - P.tDots) / 0.9), risB = 1 - eOut3((t - P.tDots - 0.28) / 0.9);
    var calm = 1 - sstep(P.tStart - 0.5, P.tStart, t);
    o.sx = p0.x - 30 + 3.2 * calm * Math.sin(2.6 * t) - 10 * risS;
    o.sy = p0.y + 34 + 2.6 * calm * Math.sin(2.2 * t + 1) + 26 * risS;
    o.sr = SMALL_R * Math.max(0, sa);
    if (t <= P.tStart) {                                   // the big dot is the head of the lead arm from tStart on
      var ant = t > P.tStart - 0.38 ? 9 * Math.sin(Math.PI * clamp01((t - (P.tStart - 0.38)) / 0.38)) : 0;
      o.bx = p0.x + 3.4 * calm * Math.sin(2.3 * t + 2) - 8 * risB - G.leadDir.x * ant;
      o.by = p0.y + 3.0 * calm * Math.sin(1.9 * t) + 30 * risB - G.leadDir.y * ant;
      o.br = BIG_R * Math.max(0, ba);
    }
    return o;
  }

  // ---- tiny deterministic RNG for the (lazy) spawn jobs: every piece / item reseeds it, so the result never depends on WHEN the job runs
  var _rs = 0;
  function rseed(a, b) { _rs = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA6B)) | 0; }
  function rnd() { _rs = (_rs + 0x6D2B79F5) | 0; var t = Math.imul(_rs ^ (_rs >>> 15), 1 | _rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function rr(a, b) { return a + (b - a) * rnd(); }
  // fx.spawn() reads its argument immediately and keeps no reference: one reusable option object per kind => no garbage per particle
  var CO = { x: 0, y: 0, size: 0, t0: 0, vx: 0, vy: 0, spin: [0, 0, 0], rot0: [0, 0, 0], z: 0, hover: 0 };
  var DOO = { x: 0, y: 0, r: 0, t0: 0, vx: 0, vy: 0, kind: 'dot', z: 0 };
  var JS_ = { tx: 0, ty: 0, ang: 0, e: 0, vx: 0, vy: 0, om: 0 };

  function spawnCube(o) { D.info.cubes++; if (D.cubeAPI) { var te = D.cubeAPI.spawn(o); if (te > D.tEnd) D.tEnd = te; } }
  function spawnDot(o) { D.info.dots++; if (D.dotAPI) { var te = D.dotAPI.spawn(o); if (te > D.tEnd) D.tEnd = te; } }
  /** cube edge length (world units), still random but with CLEARLY visible mid-size cubes: ~50 % dust 3-8, ~30 % small 8-18, ~13 % mid 16-30, ~4-6 % chunky 36-62
      (heavier lines give a few more chunky ones; ~15-20 chunks in a full dissolve; the fx pools hold 1536 per layer) */
  function rndSize(maxS) {
    var r = rnd(), big = 0.04 + 0.025 * U.clamp((maxS - 9) / 17, 0, 1);
    if (r < 0.50) return 3 + 5 * Math.pow(rnd(), 1.6);
    if (r < 0.80) return rr(8, 18);
    if (r < 1 - big) return rr(16, 30);
    return rr(36, 62);
  }
  /** the girl's box (head .. feet, +-140): a cube / dot that would appear inside it is PUSHED OUT sideways to just outside (and flies on outward), so nothing sits on her
      ponytail, torso, skirt or shoes (black on black reads as a bump) */
  function inGirl(x, y) { var P = G.P; return x > P.gx0 - 25 && x < P.gx1 + 25 && y > P.gy0 - 20 && y < P.gy1 + 6; }
  var PUSH = { x: 0, vx: 0 };
  function pushOut(x, vx) {
    var P = G.P, side = x >= P.cx ? 1 : -1, nx = P.cx + side * (P.gx1 - P.cx + 28 + rr(0, 70));
    PUSH.x = nx; PUSH.vx = vx * 0.3 + side * rr(60, 170);
    return PUSH;
  }

  /** spawn the cubes and dots released along the erosion front of one piece (a lazy job; sets nothing but fx particles) */
  function spawnPiece(q) {
    var P = G.P, L = q.L, F = L.fz, cp = JS_, K08 = D.K08;
    rseed(P.seed * 131 + 7, q.id);
    var ec = q.visLen * L.wt * D.cubePerW, nc = Math.floor(ec) + (rnd() < ec - Math.floor(ec) ? 1 : 0);
    var ed = q.visLen * L.wt * D.dotPerW, nd = Math.floor(ed) + (rnd() < ed - Math.floor(ed) ? 1 : 0);
    for (var c = 0; c < nc + nd; c++) {
      var isCube = c < nc, tauK = q.lam * rr(isCube ? 0.04 : 0, isCube ? 1 : 1.15);
      pieceState(q, q.ts + tauK, cp);
      var ee = eIO(Math.min(1, tauK / q.lam)), jf = q.a + ee * (q.b - q.a), j0 = Math.min(q.b - 1, Math.floor(jf)), fr = jf - j0;
      var fx0 = F.X[j0] + (F.X[j0 + 1] - F.X[j0]) * fr, fy0 = F.Y[j0] + (F.Y[j0 + 1] - F.Y[j0]) * fr;
      var ox = fx0 - q.mx, oy = fy0 - q.my, ca = Math.cos(cp.ang), sa = Math.sin(cp.ang);
      var rx0 = ox * ca - oy * sa, ry0 = ox * sa + oy * ca;
      var wx = q.mx + cp.tx + rx0 + rr(-5, 5), wy = q.my + cp.ty + ry0 + rr(-5, 5);
      if (!inBox(wx, wy, 70)) continue;
      var vx = cp.vx - cp.om * ry0 + rr(-45, 45), vy = cp.vy + cp.om * rx0 + rr(-45, 45);
      var z = (q.front ? 1 : -1) * rr(0.15, 1);
      if (inGirl(wx, wy)) { var pu = pushOut(wx, vx); wx = pu.x; vx = pu.vx; }
      if (isCube) {
        CO.x = wx; CO.y = wy; CO.size = rndSize(L.maxCube); CO.t0 = q.ts + tauK; CO.vx = vx; CO.vy = vy; CO.z = z; CO.hover = rr(0.08, 0.45) / K08;
        CO.spin[0] = rr(-7, 7); CO.spin[1] = rr(-7, 7); CO.spin[2] = rr(-6, 6);
        CO.rot0[0] = rr(0, TAU); CO.rot0[1] = rr(0, TAU); CO.rot0[2] = rr(0, TAU);
        spawnCube(CO);
      } else {
        var rt = rnd();
        DOO.x = wx; DOO.y = wy; DOO.r = 1.2 + 3.4 * Math.pow(rnd(), 1.6); DOO.t0 = q.ts + tauK; DOO.vx = vx * rr(0.8, 1.5); DOO.vy = vy * rr(0.8, 1.5) - rr(0, 60);
        DOO.kind = rt < 0.72 ? 'dot' : rt < 0.82 ? 'ring' : rt < 0.92 ? 'square' : 'tick'; DOO.z = z;
        spawnDot(DOO);
      }
    }
  }
  /** release a loose item (dot of a dotted line, accent, tip dot, thought dot) into GA.fx.dots at its death time (+ a few tiny cubes for the bigger thought dots) */
  function spawnItem(im) {
    var P = G.P, cp = JS_, K08 = D.K08;
    rseed(P.seed * 977 + 3, im.id);
    pieceState(im, im.ts, cp);
    var kind = im.k === 'dot' ? 'dot' : im.k === 'ring' ? 'ring' : 'tick';
    var sz = im.k === 'dash' ? Math.hypot(im.ex, im.ey) * 0.5 : im.r;
    var zz = im.front ? 0.5 : -0.5, ix = im.x + cp.tx, iy = im.y + cp.ty, ivx = cp.vx + im.bx * 0.9 * K08;
    if (inGirl(ix, iy)) { var pu = pushOut(ix, ivx); ix = pu.x; ivx = pu.vx; }
    DOO.x = ix; DOO.y = iy; DOO.r = Math.max(1.2, sz); DOO.t0 = im.ts; DOO.vx = ivx; DOO.vy = cp.vy + im.by * 0.9 * K08; DOO.kind = kind; DOO.z = zz;
    spawnDot(DOO);
    if (im.k === 'dot' && im.r >= 3.4) {                       // a bigger thought dot (the two first dots, tip dots of the arms) also breaks into a few tiny cubes
      var nq = im.r >= 6 ? 4 : 2;
      for (var q2 = 0; q2 < nq; q2++) {
        var qa = rr(0, TAU), qs = rr(80, 260);
        CO.x = DOO.x + Math.cos(qa) * im.r * 0.6; CO.y = DOO.y + Math.sin(qa) * im.r * 0.6; CO.size = rr(3.5, 6.5 + im.r * 0.3); CO.t0 = im.ts;
        CO.vx = DOO.vx * 0.8 + Math.cos(qa) * qs * K08; CO.vy = DOO.vy * 0.8 + Math.sin(qa) * qs * K08 - 60; CO.z = zz; CO.hover = rr(0.1, 0.35) / K08;
        CO.spin[0] = rr(-8, 8); CO.spin[1] = rr(-8, 8); CO.spin[2] = rr(-6, 6);
        CO.rot0[0] = rr(0, TAU); CO.rot0[1] = rr(0, TAU); CO.rot0[2] = rr(0, TAU);
        spawnCube(CO);
      }
    }
  }
  function nowMs() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  /** run the pending spawn jobs of the dissolve (nearest pieces first) for at most budgetMs; returns true while jobs remain */
  function runJobs(budgetMs) {
    if (!D || !D.jobs || D.ji >= D.jobs.length) return false;
    var jobs = D.jobs, n = jobs.length, t0 = nowMs(), lim = budgetMs === undefined ? 3 : budgetMs;
    while (D.ji < n) {
      var jb = jobs[D.ji++];
      if (jb.k === 0) spawnPiece(jb.p); else spawnItem(jb.p);
      if (lim !== Infinity && (D.ji & 3) === 0 && nowMs() - t0 > lim) break;
    }
    if (D.ji >= n) { if (D.tEnd < D.tLines) D.tEnd = D.tLines; return false; }
    return true;
  }

  /** Freezes the vortex at D.t0, cuts every line into pieces and schedules the cubes / dots: the freeze + cutting (about 1.5 ms) happens HERE, the spawning of the
      particles is a queue of jobs (nearest piece first) that draw() / prepare() work off within ~2-3 ms per frame (everything is a closed form of t0-based times,
      so a late spawn is invisible).  Everything random comes from seeded RNGs, so the same call always gives the same result. */
  function startDissolve() {
    var P = G.P, rng = U.rng((P.seed * 7919 + 101) | 0), g = {}, ga = {}, i, j, k, L, F;
    var t0 = D.t0, K = D.speed, stagger = D.stagger, dtv = 0.02, K08 = Math.pow(K, 0.8);
    D.cubeAPI = !D.dry && GA.fx && GA.fx.cubes && GA.fx.cubes.spawn ? GA.fx.cubes : null;
    D.dotAPI = !D.dry && GA.fx && GA.fx.dots && GA.fx.dots.spawn ? GA.fx.dots : null;
    D.K08 = K08; D.cubePerW = P.cubeBudget / P.refW; D.dotPerW = P.dotBudget * 0.8 / P.refW;
    var info = D.info, lastDeath = t0;

    var lines = G.lines, vel = { x: 0, y: 0 };
    gstate(t0, g); gstate(t0 - dtv, ga);
    /** flow velocity of point j of line L (central difference of the rigid vortex motion over 20 ms; the growing head would carry the growth speed, so it borrows the point behind it) */
    function flowVel(Ln, j) {
      if (Ln.hs < 1 && j > Ln.nE - 3) j = Math.max(0, Ln.nE - 3);
      var a = pointOnLine(Ln, j, t0, g, P1), b = pointOnLine(Ln, j, t0 - dtv, ga, P2);
      vel.x = (a.x - b.x) / dtv; vel.y = (a.y - b.y) / dtv;
      return vel;
    }
    var P1 = { x: 0, y: 0, sn: 0 }, P2 = { x: 0, y: 0, sn: 0 };
    // ---------- 1. freeze every line at t0; only the part that has been drawn so far exists
    for (i = 0; i < lines.length; i++) {
      L = lines[i];
      L.pieces = null; L.fz = null;
      if (D.sub > 1 && i % D.sub !== 0) { L.nE = 0; continue; }       // warm-up trials work on a subset of the lines first (cheap cold start)
      evalLine(L, t0, g);
      var nE = L.hs <= 0 ? 0 : L.hs >= 1 ? L.n : Math.min(L.n, L.iEnd + 1);
      L.nE = nE;
      if (nE < 2) continue;
      L.fz = { n: nE, X: L.X.slice(0, nE), Y: L.Y.slice(0, nE), W: L.Wd.slice(0, nE), F: L.F.slice(0, nE) };
    }

    // ---------- 2. pieces of the arms / sweeps
    var pieceLines = [], allPieces = [], dmin = 1e18, dmax = 0;
    for (i = 0; i < lines.length; i++) {
      L = lines[i];
      if (L.kind === 'dots' || L.kind === 'dash' || L.nE < 2) continue;
      lineWeights(L, L.nE);
      pieceLines.push(L);
    }
    for (var pi = 0; pi < pieceLines.length; pi++) {
      L = pieceLines[pi]; F = L.fz;
      var nF = F.n, pcs = [], acc = 0, a0 = 0, sw = L.kind === 'sweep', target = rng.range(sw ? 160 : 130, sw ? 330 : 300);
      for (j = 1; j < nF; j++) {
        var sdx = F.X[j] - F.X[j - 1], sdy = F.Y[j] - F.Y[j - 1];
        acc += Math.sqrt(sdx * sdx + sdy * sdy);
        if (acc >= target || F.F[j] !== F.F[j - 1] || j === nF - 1) {
          if (j - a0 >= 3 || j === nF - 1) {
            if (j - a0 < 3 && pcs.length) pcs[pcs.length - 1].b = j;
            else pcs.push({ a: a0, b: j });
            a0 = j; acc = 0; target = rng.range(sw ? 160 : 130, sw ? 330 : 300);
          }
        }
      }
      L.pieces = pcs;
      for (k = 0; k < pcs.length; k++) {
        var p = pcs[k], mi = (p.a + p.b) >> 1, len = 0, on = false, visLen = 0;
        p.mi = mi; p.mx = F.X[mi]; p.my = F.Y[mi];
        for (j = p.a + 1; j <= p.b; j++) {
          var ldx = F.X[j] - F.X[j - 1], ldy = F.Y[j] - F.Y[j - 1], sl = Math.sqrt(ldx * ldx + ldy * ldy);
          len += sl;
          if (F.W[j] > 0.15 && inBox(F.X[j], F.Y[j], 60)) on = true;
          if (F.W[j] > 0.15 && inBox(F.X[j], F.Y[j], 40)) visLen += sl;
        }
        p.len = len; p.visLen = visLen; p.off = !on; p.front = F.F[mi] === 1; p.L = L; p.id = allPieces.length;
        p.dx = p.mx - P.hx; p.dy = p.my - P.hy; p.dist = Math.hypot(p.dx, p.dy) || 1;
        if (!p.off) { allPieces.push(p); if (p.dist < dmin) dmin = p.dist; if (p.dist > dmax) dmax = p.dist; }
        else { p.ts = t0; p.lam = 0.2; }
      }
    }

    // ---------- 3. loose items: dots of the dotted lines, dashes, accents, tip dots of the arms, the thought dots
    var items = G.items = [];
    function newItem(o, x, y) {
      o.x = x; o.y = y; o.dx = x - P.hx; o.dy = y - P.hy; o.dist = Math.hypot(o.dx, o.dy) || 1;
      if (o.dist < dmin) dmin = o.dist; if (o.dist > dmax) dmax = o.dist;
      items.push(o); return o;
    }
    function nearestIdx(Ln, x, y) {   // index of the frozen point of Ln nearest to (x,y) (only used for the flow velocity)
      var best = 0, bd = 1e18, Fz = Ln.fz;
      for (var q = 0; q < Fz.n; q += 2) { var d = (Fz.X[q] - x) * (Fz.X[q] - x) + (Fz.Y[q] - y) * (Fz.Y[q] - y); if (d < bd) { bd = d; best = q; } }
      return best;
    }
    for (i = 0; i < G.pats.length; i++) {
      L = G.pats[i];
      if (!L.fz) continue;
      patternGeom(L, t0, function (x, y, r, ex2, ey2, mx, my) {
        var jn = nearestIdx(L, x, y), fv = flowVel(L, jn);
        var it = { k: L.kind === 'dots' ? 'dot' : 'dash', r: r, col: L.sp.col, vx: fv.x, vy: fv.y, lw: r, fr: false };
        if (it.k === 'dash') { it.ex = ex2 - x; it.ey = ey2 - y; it.mx = mx - x; it.my = my - y; }
        it.quiet = rng.next() < 0.62;
        newItem(it, x, y);
      });
    }
    for (i = 0; i < G.acc.length; i++) {
      var ac = G.acc[i], ap = accentPos(ac, t0, g, { x: 0, y: 0, a: 0, s: 0 });
      if (ap.s <= 0.01) continue;                                   // has not popped in yet: it never will
      var ap2 = accentPos(ac, t0 - dtv, ga, { x: 0, y: 0, a: 0, s: 0 });
      newItem({ k: ac.k, r: ac.r * ap.s, col: ac.col, a: ap.a, vx: (ap.x - ap2.x) / dtv, vy: (ap.y - ap2.y) / dtv, ph: ac.ph, fr: false }, ap.x, ap.y);
    }
    for (i = 0; i < G.arms.length; i++) {
      L = G.arms[i];
      if (!L.tipR || L.nE < 2) continue;
      var rt = L.tipR * (L.lead ? 1 - 0.38 * eIO(L.hs) - 0.55 * sstep(0.82, 1, L.hs) : 1) * (L.lead ? 1 : Math.max(0, eBack((t0 - L.tb) / 0.3)));
      if (rt < 0.2) continue;
      var tv = flowVel(L, L.nE - 1);
      newItem({ k: 'dot', r: rt, col: 'ink', vx: tv.x, vy: tv.y, fr: L.tipF === 1 && L.frontable }, L.tipX, L.tipY);
    }
    var da = dotsState(t0, G.dst), sx = da.sx, sy = da.sy, sr = da.sr, bx = da.bx, by = da.by, br = da.br;
    if (sr > 0.1 || br > 0.1) {
      var db = dotsState(t0 - dtv, {});
      if (sr > 0.1) newItem({ k: 'dot', r: sr, col: 'ink', vx: (sx - db.sx) / dtv, vy: (sy - db.sy) / dtv, fr: false }, sx, sy);
      if (br > 0.1) newItem({ k: 'dot', r: br, col: 'ink', vx: (bx - db.bx) / dtv, vy: (by - db.by) / dtv, fr: false }, bx, by);
    }

    // ---------- 4. timing: the crack starts at the head and runs outwards over `stagger` seconds
    var span = Math.max(1, dmax - dmin), capT = t0 + stagger + 0.75 / K;
    function startAt(dist) { return t0 + stagger * Math.pow(U.clamp((dist - dmin) / span, 0, 1), 0.85) + rng.range(0, 0.04) / K; }
    for (k = 0; k < allPieces.length; k++) {
      var q = allPieces[k], ux = q.dx / q.dist, uy = q.dy / q.dist;
      L = q.L;
      q.ts = startAt(q.dist);
      q.lam = rng.range(0.30, 0.55) / K;
      if (q.ts + q.lam > capT) q.lam = Math.max(0.2 / K, capT - q.ts);
      var sb = rng.range(130, 380), tb = rng.range(60, 200), lift = rng.range(0, 150);
      var qv = flowVel(L, q.mi); q.vx = qv.x; q.vy = qv.y;
      q.bx = ux * sb + uy * tb + rng.range(-60, 60); q.by = uy * sb - ux * tb - lift + rng.range(-60, 60);
      q.spin = rng.range(-0.9, 0.9) * (1.2 - 0.6 * Math.min(1, q.len / 250));
      q.ph = rng.range(0, TAU);
      if (q.ts + q.lam > lastDeath) lastDeath = q.ts + q.lam;
    }
    for (i = 0; i < items.length; i++) {
      var it2 = items[i], iux = it2.dx / it2.dist, iuy = it2.dy / it2.dist;
      it2.ts = startAt(it2.dist); it2.lam = 0.01; it2.front = it2.fr; it2.id = i;
      var isb = rng.range(120, 360), itb = rng.range(50, 190), ilift = rng.range(0, 140);
      it2.bx = iux * isb + iuy * itb + rng.range(-50, 50); it2.by = iuy * isb - iux * itb - ilift + rng.range(-50, 50);
      it2.spin = rng.range(-1, 1); if (it2.ph === undefined) it2.ph = rng.range(0, TAU);
      if (it2.ts > lastDeath) lastDeath = it2.ts;
    }
    resetLive();
    // sort by colour so the draw loop switches styles rarely
    items.sort(function (a, b) { return a.col < b.col ? -1 : a.col > b.col ? 1 : 0; });
    // ---------- 5. the spawn queue: every piece, and every item that is released into GA.fx.dots at its death time (most dotted-line dots just melt away instead), nearest first
    var jobs = [];
    for (k = 0; k < allPieces.length; k++) jobs.push({ k: 0, p: allPieces[k], ts: allPieces[k].ts });
    for (i = 0; i < items.length; i++) if (!items[i].quiet) jobs.push({ k: 1, p: items[i], ts: items[i].ts });
    jobs.sort(function (a, b) { return a.ts - b.ts; });
    D.jobs = jobs; D.ji = 0;
    D.lastDeath = lastDeath; D.tLines = lastDeath + 0.02;
    D.tEnd = D.tLines;
    info.lines = lines.length; info.lastDeath = lastDeath - t0;
  }

  /** motion of a piece / item at absolute time t (>= t0): translation, rotation, erosion, instantaneous velocity.  speed K compresses time. */
  function pieceState(p, t, out) {
    var dt = t - D.t0, tau = t - p.ts, K = D.speed, dec = Math.exp(-dt / DRIFT_TAU), dr = DRIFT_TAU * (1 - dec);
    var tx = p.vx * dr, ty = p.vy * dr, ang = 0, e = 0, vx = p.vx * dec, vy = p.vy * dec, om = 0;
    if (tau > 0) {
      var T1 = TAU0 / K, ex = Math.exp(-tau / T1), B = K * (tau - T1 * (1 - ex)), kv = K * (1 - ex);
      tx += p.bx * B; ty += p.by * B; ang = p.spin * B; vx += p.bx * kv; vy += p.by * kv; om = p.spin * kv;
      e = tau / p.lam;
    } else if (tau > -0.12) {                              // short pre-crack tremble: a bump that is 0 at t0 and 0 at the crack
      var tr = Math.sin(Math.PI * (tau + 0.12) / 0.12) * sstep(0, 0.05, dt);
      tx += 1.3 * tr * Math.sin(150 * t + p.ph); ty += 1.3 * tr * Math.cos(131 * t + p.ph);
    }
    out.tx = tx; out.ty = ty; out.ang = ang; out.e = e; out.vx = vx; out.vy = vy; out.om = om;
    return out;
  }

  // ------------------------------------------------------------------------------------------------ drawing: lines before the hit
  // Raster budget (QA round 3: the swirl back layer was the hot spot, 12k lineTo + 5 stacked soft sweeps): every line is drawn from its CURVATURE-DECIMATED vertices
  // (L.keep, ~5-8x fewer than the 10-unit evaluation grid), runs whose width is invisible are skipped, all back runs of one colour are batched into ONE path and ONE
  // fill, and a soft sweep is 3 low-alpha strokes whose geometry is gathered once.
  var GX = f32(1400), GY = f32(1400), GW = f32(1400), GH = f32(1400);   // gather staging (decimated vertices of one run)
  /** decimated vertices of L[ra..rb] (always including ra and rb) -> GX/GY/GW; returns the count */
  function gather(L, ra, rb) {
    var keep = L.keep, X = L.X, Y = L.Y, Wd = L.Wd, m = 0, q, j;
    GX[0] = X[ra]; GY[0] = Y[ra]; GW[0] = Wd[ra]; m = 1;
    if (keep) {
      for (q = L.kidx[ra]; q < keep.length; q++) {
        j = keep[q];
        if (j <= ra) continue;
        if (j >= rb) break;
        GX[m] = X[j]; GY[m] = Y[j]; GW[m] = Wd[j]; m++;
      }
    } else for (j = ra + 1; j < rb; j++) { GX[m] = X[j]; GY[m] = Y[j]; GW[m] = Wd[j]; m++; }
    if (rb > ra) { GX[m] = X[rb]; GY[m] = Y[rb]; GW[m] = Wd[rb]; m++; }
    return m;
  }
  function maxW(m) { var w = 0; for (var i = 0; i < m; i++) if (GW[i] > w) w = GW[i]; return w; }
  /** draw the runs of L that belong to `layer` (all of it for a line that is never in front). append = add to the caller's path (no fill), else fill each run in `col`.
      halo = paper halo under a FRONT run. */
  function drawRuns(ctx, L, layer, sc, col, halo, append) {
    var a = Math.max(0, L.iA - 3), b = Math.min(L.iEnd, L.iB + 3), m, k, q, cx;
    if (b - a < 1) return;
    if (!L.frontable) {
      if (layer !== 'back') return;
      m = gather(L, a, b);
      if (maxW(m) * sc < 0.12) return;
      if (!append) ctx.fillStyle = col;
      ribbon(ctx, GX, GY, GW, 0, m - 1, true, true, sc, append);
      return;
    }
    var j = a, F = L.F, front = layer === 'front';
    while (j <= b) {
      var f = F[j];
      k = j;
      while (k + 1 <= b && F[k + 1] === f) k++;
      if ((f === 1) === front) {
        var ra = front ? j : Math.max(a, j - 1), rb = front ? k : Math.min(b, k + 1);
        if (rb - ra >= 1) {
          m = gather(L, ra, rb);
          if (maxW(m) * sc >= 0.12) {
            if (front && halo) {
              var any = false; cx = G.P.cx;
              for (q = 0; q < m; q++) {
                var h = HALO * G.haloF * (1 - sstep(170, 330, Math.abs(GX[q] - cx))) * Math.min(1, GW[q] * 1.2);
                GH[q] = GW[q] * sc + 2 * h; if (h > 0.05) any = true;
              }
              if (any) { ctx.fillStyle = G.C.paper; ribbon(ctx, GX, GY, GH, 0, m - 1, ra === a, rb === b, 1, false); }
            }
            if (!append) ctx.fillStyle = col;
            ribbon(ctx, GX, GY, GW, 0, m - 1, ra === a, rb === b, sc, append);
          }
        }
      }
      j = k + 1;
    }
  }

  // soft pale sweeps: three ink strokes of decreasing width and increasing alpha (~19 % ink in the core, feathered edges); the geometry of a sweep is gathered ONCE per layer
  var SWL_S = [1.0, 0.46], SWL_A = [0.07, 0.16];
  var SWX = f32(5000), SWY = f32(5000), SWW = f32(5000), SWR = new Int32Array(64);
  function drawSweep(ctx, L, layer) {
    var a = Math.max(0, L.iA - 3), b = Math.min(L.iEnd, L.iB + 3), pos = 0, nr = 0, i, ps;
    if (b - a < 1) return;
    var F = L.F, front = layer === 'front', j = a, k, m, ra, rb;
    if (!L.frontable) { if (layer !== 'back') return; ra = a; rb = b; m = gather(L, ra, rb); stash(); }
    else {
      while (j <= b) {
        var f = F[j];
        k = j;
        while (k + 1 <= b && F[k + 1] === f) k++;
        if ((f === 1) === front) {
          ra = front ? j : Math.max(a, j - 1); rb = front ? k : Math.min(b, k + 1);
          if (rb - ra >= 1) { m = gather(L, ra, rb); stash(); }
        }
        j = k + 1;
      }
    }
    function stash() {
      if (maxW(m) * 0.2 < 0.12 || pos + m > 4990 || nr > 30) return;
      for (i = 0; i < m; i++) { SWX[pos + i] = GX[i]; SWY[pos + i] = GY[i]; SWW[pos + i] = GW[i]; }
      SWR[2 * nr] = pos; SWR[2 * nr + 1] = pos + m - 1; nr++; pos += m;
    }
    if (!nr) return;
    var ink = G.C.ink;
    ctx.fillStyle = ink;
    for (ps = 0; ps < SWL_S.length; ps++) {
      ctx.globalAlpha = SWL_A[ps]; ctx.beginPath();
      for (i = 0; i < nr; i++) ribbon(ctx, SWX, SWY, SWW, SWR[2 * i], SWR[2 * i + 1], true, true, SWL_S[ps], true);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  var ARM_COLS = ['g3', 'g2', 'g1', 'ink'];   // pale first, dark last
  function drawPre(ctx, t, layer) {
    var i, L, back = layer === 'back', C = G.C, ci;
    G.haloF = 1;
    // pale sweeps
    for (i = 0; i < G.sweeps.length; i++) { L = G.sweeps[i]; if (L.hs > 0) drawSweep(ctx, L, layer); }
    // dotted / dashed lines
    if (back) {
      for (i = 0; i < G.pats.length; i++) {
        L = G.pats[i];
        if (L.hs <= 0) continue;
        ctx.fillStyle = C[L.col]; ctx.strokeStyle = C[L.col]; ctx.lineCap = 'round';
        if (L.kind === 'dots') {
          ctx.beginPath();
          patternGeom(L, t, function (x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); });
          ctx.fill();
        } else {
          patternGeom(L, t, function (x, y, w, ex, ey, mx, my) {
            ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(2 * mx - 0.5 * (x + ex), 2 * my - 0.5 * (y + ey), ex, ey); ctx.stroke();
          });
        }
      }
    }
    // arms
    if (back) {
      // all back runs of one colour in ONE path / ONE fill (pale colours first, dark last)
      for (ci = 0; ci < ARM_COLS.length; ci++) {
        var key = ARM_COLS[ci], any = false;
        ctx.fillStyle = C[key]; ctx.beginPath();
        for (i = 0; i < G.arms.length; i++) { L = G.arms[i]; if (L.hs > 0 && L.sp.col === key && !L.own) { drawRuns(ctx, L, 'back', 1, null, false, true); any = true; } }
        if (any) ctx.fill();
      }
      for (i = 0; i < G.arms.length; i++) { L = G.arms[i]; if (L.hs > 0 && L.own && L.iB >= L.iA) drawRuns(ctx, L, 'back', 1, C[L.col], false, false); }
    } else {
      for (i = 0; i < G.arms.length; i++) { L = G.arms[i]; if (L.hs > 0 && L.frontable) drawRuns(ctx, L, 'front', 1, C[L.col], true, false); }
    }
    // tip dots
    for (i = 0; i < G.arms.length; i++) {
      L = G.arms[i];
      if (!L.tipR || L.hs <= 0) continue;
      if ((L.frontable && L.tipF === 1) !== !back) continue;
      var pop = L.lead ? 1 : eBack((t - L.tb) / 0.3), r = L.tipR * (L.lead ? (1 - 0.38 * eIO(L.hs) - 0.55 * sstep(0.82, 1, L.hs)) : 1) * Math.max(0, pop);
      if (r < 0.2) continue;
      if (!back) { ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(L.tipX, L.tipY, r + HALO, 0, TAU); ctx.fill(); }
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(L.tipX, L.tipY, r, 0, TAU); ctx.fill();
    }
    if (back) {
      // accents
      for (i = 0; i < G.acc.length; i++) {
        var ac = G.acc[i], ap = G.accPos[i];
        if (ap.s <= 0.01) continue;
        drawAccent(ctx, ac.k, ap.x, ap.y, ac.r * ap.s, ap.a, C[ac.col], ac.ph);
      }
      thoughtDots(ctx, t);
    }
  }

  function drawAccent(ctx, k, x, y, r, a, col, ph) {
    if (r < 0.15) return;
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (k === 'dot') { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    else if (k === 'ring') { ctx.fillStyle = G.C.paper; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (k === 'tick') { var c = Math.cos(a) * r, s = Math.sin(a) * r; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.stroke(); }
    else {   // open chevron
      var aa = a + 0.35 * Math.sin(ph), l = r, spread = 0.95;
      ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x + Math.cos(aa + Math.PI - spread) * l, y + Math.sin(aa + Math.PI - spread) * l);
      ctx.lineTo(x, y);
      ctx.lineTo(x + Math.cos(aa + Math.PI + spread) * l, y + Math.sin(aa + Math.PI + spread) * l);
      ctx.stroke();
    }
  }

  /** the two thought dots before the launch + the small one afterwards (the big dot becomes the head of the lead arm) */
  function thoughtDots(ctx, t) {
    if (t < G.P.tDots) return;
    var d = dotsState(t, G.dst);
    ctx.fillStyle = G.C.ink;
    if (d.sr > 0.1) { ctx.beginPath(); ctx.arc(d.sx, d.sy, d.sr, 0, TAU); ctx.fill(); }
    if (d.br > 0.1) { ctx.beginPath(); ctx.arc(d.bx, d.by, d.br, 0, TAU); ctx.fill(); }
  }

  // ------------------------------------------------------------------------------------------------ drawing: after t0 (dissolve)
  var PX = f32(1400), PY = f32(1400), PW = f32(1400), SS = {};
  // staging buffers: the geometry of every live piece of a line is computed ONCE per frame and layer, then replayed for the (up to 5) soft passes of a sweep
  var SBX = f32(6000), SBY = f32(6000), SBW = f32(6000), SBS = new Int32Array(1600);
  /** per-line lists of the pieces that can still be seen, split by layer (pieces that are off screen from the start are never touched again) */
  function resetLive() {
    for (var i = 0; i < G.lines.length; i++) {
      var L = G.lines[i];
      if (!L.pieces) continue;
      L.lb = []; L.lf = [];
      for (var k = 0; k < L.pieces.length; k++) { var p = L.pieces[k]; if (!p.off) (p.front ? L.lf : L.lb).push(p); }
    }
  }
  function drawPost(ctx, t, layer) {
    var i, k, L, back = layer === 'back', C = G.C;
    if (t >= D.tLines) return;
    if (t < D.lastT) resetLive();                              // seeking backwards: revive the pieces that had been dropped
    D.lastT = t;
    var lines = G.lines;
    for (i = 0; i < lines.length; i++) {
      L = lines[i];
      if (!L.pieces) continue;
      var list = back ? L.lb : L.lf, F = L.fz, np = 0, pos = 0, w = 0;
      if (!list || !list.length) continue;
      for (k = 0; k < list.length; k++) {
        var p = list[k];
        if (t >= p.ts + p.lam) continue;                       // finished: dropped from the list for good (compaction)
        list[w++] = p;
        if (pos > 5900 || np > 790) continue;
        pieceState(p, t, SS);
        var ee = eIO(SS.e), ja = p.a + ee * (p.b - p.a), j0 = Math.floor(ja), fr = ja - j0;
        if (j0 >= p.b) continue;
        var ca = Math.cos(SS.ang), sa = Math.sin(SS.ang), cnt = 0, mx = p.mx, my = p.my;
        var tl = Math.max(2, (p.b - ja) * 0.3), thin = 1 - 0.5 * ee, mixT = Math.min(1, SS.e * 3), p0 = pos;
        var stride = p.b - j0 > 14 ? 3 : p.b - j0 > 6 ? 2 : 1;                       // long pieces: every 2nd vertex is plenty (they are short-lived and shrinking)
        for (var j = j0; j <= p.b; j = (j < p.b && j + stride > p.b) ? p.b : j + stride) {
          var x, y, wd;
          if (j === j0) { x = F.X[j] + (F.X[j + 1] - F.X[j]) * fr; y = F.Y[j] + (F.Y[j + 1] - F.Y[j]) * fr; wd = F.W[j] + (F.W[j + 1] - F.W[j]) * fr; }
          else { x = F.X[j]; y = F.Y[j]; wd = F.W[j]; }
          var dx = x - mx, dy = y - my;
          SBX[pos] = mx + SS.tx + dx * ca - dy * sa; SBY[pos] = my + SS.ty + dx * sa + dy * ca;
          var ft = sstep(0, 1, (j - ja) / tl);
          SBW[pos] = wd * thin * (1 + (ft - 1) * mixT);
          pos++; cnt++;
        }
        if (cnt >= 2) { SBS[2 * np] = p0; SBS[2 * np + 1] = pos - 1; np++; } else pos = p0;
      }
      list.length = w;
      if (!np) continue;
      var passes = L.kind === 'sweep' ? SWL_S.length : 1;
      for (var ps = 0; ps < passes; ps++) {
        ctx.fillStyle = L.kind === 'sweep' ? C.ink : C[L.col]; ctx.globalAlpha = L.kind === 'sweep' ? SWL_A[ps] : 1; ctx.beginPath();
        var sc = L.kind === 'sweep' ? SWL_S[ps] : 1;
        for (k = 0; k < np; k++) ribbon(ctx, SBX, SBY, SBW, SBS[2 * k], SBS[2 * k + 1], true, true, sc, true);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // items
    var its = G.items, bcol = null, bopen = false;
    for (i = 0; i < its.length; i++) {
      var it = its[i];
      if (it.front === back) continue;
      if (t >= it.ts) continue;                                 // already released into GA.fx.dots
      pieceState(it, t, SS);
      var x2 = it.x + SS.tx, y2 = it.y + SS.ty, isc = it.quiet ? 1 - sstep(Math.max(D.t0, it.ts - 0.2), it.ts, t) : 1;
      if (it.k === 'dot') {                                     // batched: all dots of one colour in one path
        var rr0 = it.r * isc;
        if (rr0 < 0.15) continue;
        if (!bopen || bcol !== it.col) { if (bopen) ctx.fill(); ctx.fillStyle = C[it.col]; ctx.beginPath(); bopen = true; bcol = it.col; }
        ctx.moveTo(x2 + rr0, y2); ctx.arc(x2, y2, rr0, 0, TAU);
        continue;
      }
      if (bopen) { ctx.fill(); bopen = false; }
      if (it.k === 'dash') {
        ctx.strokeStyle = C[it.col]; ctx.lineWidth = it.lw * isc; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(x2, y2); ctx.quadraticCurveTo(x2 + 2 * it.mx - 0.5 * it.ex, y2 + 2 * it.my - 0.5 * it.ey, x2 + it.ex, y2 + it.ey); ctx.stroke();
      } else drawAccent(ctx, it.k, x2, y2, it.r * isc, it.a || 0, C[it.col], it.ph);
    }
    if (bopen) ctx.fill();
  }

  // ------------------------------------------------------------------------------------------------ per-frame update + public API
  function update(t) {
    if (t === lastT) return;
    lastT = t;
    var i, ft = freezeT(), te = Math.min(t, ft), g = gstate(t, G.g);
    if (t < ft) {
      for (i = 0; i < G.lines.length; i++) evalLine(G.lines[i], te, g);
      for (i = 0; i < G.acc.length; i++) accentPos(G.acc[i], te, g, G.accPos[i]);
    }
  }

  function draw(ctx, t, layer) {
    if (!G || !G.ready || Math.min(t, freezeT()) < G.P.tDots) return;
    if (D) { if (D.jobs && D.ji < D.jobs.length && t >= D.t0 - 0.05) runJobs(t >= D.t0 + 0.4 ? Infinity : 2.5); }   // spawn queue: a few ms per frame, all of it once a seek jumps past the start
    else if (layer === 'back' && G.warm < WARM_N && t > G.P.tStart + 0.6) warmStep(3.5);       // one trial per frame (cheap, one-off)
    if (D && t >= D.tLines) return;
    refreshColors();
    update(t);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (D && t >= D.t0) drawPost(ctx, t, layer); else drawPre(ctx, t, layer);
    ctx.restore();
  }

  function track(i, u, t) {
    if (!G || !G.ready) return { x: 0, y: 0, a: 0, z: 0, grown: false };
    var n = G.arms.length, L = G.arms[((i % n) + n) % n], te = Math.min(t, freezeT());
    var g = gstate(te, G.gt);
    u = clamp01(u);
    var j = u * (L.n - 1), j0 = Math.min(L.n - 2, Math.floor(j)), f = j - j0;
    var p0 = pointOnLine(L, j0, te, g, { x: 0, y: 0, sn: 0 }), p1 = pointOnLine(L, j0 + 1, te, g, { x: 0, y: 0, sn: 0 });
    return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, a: Math.atan2(p1.y - p0.y, p1.x - p0.x), z: p0.sn + (p1.sn - p0.sn) * f, grown: growth(L, te) >= u };
  }
  function pointOnLine(L, j, te, g, out) {
    var P = G.P, rot = -L.omega * g.R * L.rw[j], cr = Math.cos(rot), sr = Math.sin(rot), wu = L.uOm * te;
    var u0 = L.C[j] * cr - L.S[j] * sr, v0 = L.C[j] * sr + L.S[j] * cr, sn = v0 * L.iR[j];
    var k = 1 + (L.uS[j] * Math.cos(wu) - L.uC[j] * Math.sin(wu)) + (L.pul ? L.pul * Math.sin(TAU * L.pulNu * te + L.pulPh) : 0), pf = 1 + PERSP * sn;
    if (L.sp.ub) { var wb = L.bOm * te; k += L.wS[j] * Math.cos(wb) - L.wC[j] * Math.sin(wb); }
    var ux = u0 * k * g.ex * pf * L.ax[j], vy = v0 * k * L.vs[j] * g.ey * pf;
    var cc = g.ct * L.cb[j] - g.st * L.sb[j], ss = g.st * L.cb[j] + g.ct * L.sb[j];
    var dx = g.es * (ux * cc - vy * ss), dy = g.es * (ux * ss + vy * cc);
    if (L.sway) { var swa = L.sway * Math.sin(TAU * L.swayNu * te + L.swayPh), cs = Math.cos(swa), sw = Math.sin(swa), ddx = dx * cs - dy * sw; dy = dx * sw + dy * cs; dx = ddx; }
    var x = P.cx + dx, y = P.cy + (g.fy || 0) + dy, TA = g.tur * L.tA * TURB_A;
    if (TA > 0.05) {
      var tx = TA * (Math.sin(KY * y + g.p1) + 0.55 * Math.sin(K2 * (x + y) + g.p2)), ty = TA * (Math.sin(KX * x + g.p3) + 0.55 * Math.sin(K3 * (y - x) + g.p4));
      x += tx; y += ty;
    }
    squeeze(x, y, out);
    out.sn = sn;
    return out;
  }
  /** envelope squeeze (same as evalLine): world point -> point inside the envelope ellipse */
  function squeeze(x, y, out) {
    var P = G.P, qx = (x - P.ecx) / P.erx, qy = (y - P.ecy) / P.ery, q2 = qx * qx + qy * qy;
    if (q2 > 0.9216) { var qq = Math.sqrt(q2), dd = (qq - 0.96) / 0.04, q3 = 0.96 + 0.04 * dd / (1 + dd), sc = q3 / qq; x = P.ecx + (x - P.ecx) * sc; y = P.ecy + (y - P.ecy) * sc; }
    out.x = x; out.y = y;
    return out;
  }

  function intensity(t) {
    if (!G) return 0;
    var P = G.P, te = Math.min(t, freezeT()), v = sstep(P.tStart, P.tFull, te);
    if (D && t > D.t0) v *= 1 - sstep(D.t0, Math.max(D.t0 + 0.2, D.tLines), t);
    return v;
  }

  /** runtime dissolve (see the header).  Returns true if this call started the dissolve, false if one already exists / swirl not built / bad t0. */
  function dissolveFrom(t0, o) {
    if (!G || D || !isFinite(t0)) return false;
    if (!G.ready) finishBuild();                                 // a dissolve before the sliced build has finished: finish it now
    o = o || {};
    var speed = o.speed > 0 ? +o.speed : 1, stagger = o.stagger >= 0 ? +o.stagger : 0.9;
    D = makeD(+t0, speed, stagger, false);
    G.items = [];
    startDissolve();
    G.info = D.info;
    lastT = NaN;
    return true;
  }

  /** Budgeted background work, safe to call every frame (a few ms at most): before a dissolve it runs the one-time JIT warm-up trials (silent: their particles are
      rolled back); after dissolveFrom() it spawns the queued cubes / dots (draw() also does that itself, 2.5 ms per frame).  Returns true while work remains. */
  function prepare(budgetMs) {
    if (!G) return false;
    var b = budgetMs === undefined ? 3.5 : budgetMs;
    if (!G.ready) { var more = buildJobs(Math.min(b, 4)); if (G.ready) afterBuild(false); return more || G.ready; }       // sliced build: <= ~4 ms of line jobs per call
    if (D) return runJobs(b);
    return warmStep(b);
  }
  /** after the geometry exists: the (tiny) first warm-up trial and the optional auto dissolve at a finite tHit */
  function afterBuild(sync) {
    if (G.warm === 0 && !G.P.auto && sync) warmStep(99);                // the first (tiny) trial pays the one-time compile cost here, in a synchronous build()
    if (G.P.auto && !D) dissolveFrom(G.P.tHit, { speed: 1, stagger: 0.9 });
  }
  var NOOP = function () {};
  var NULLCTX = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineCap: 'round', lineJoin: 'round', beginPath: NOOP, moveTo: NOOP, lineTo: NOOP, arc: NOOP, closePath: NOOP, fill: NOOP, stroke: NOOP, quadraticCurveTo: NOOP, save: NOOP, restore: NOOP };
  /** one warm-up trial = a dry dissolve at a fuller-vortex time incl. its spawn jobs, rolled back afterwards; only if the budget allows (>= 3 ms) */
  function warmStep(budgetMs) {
    if (!G || !G.ready || D || G.warm >= WARM_N || budgetMs < 3) return G ? G.warm < WARM_N : false;
    var fx = GA.fx, cm = fx && fx.cubes && fx.cubes.mark ? fx.cubes.mark() : null, dm = fx && fx.dots && fx.dots.mark ? fx.dots.mark() : null;
    var t0 = G.P.tFull + 0.2 * G.warm;
    D = makeD(t0, 1.2 + 0.1 * G.warm, 0.5, !(cm && dm));
    D.sub = G.warm === 0 ? 8 : G.warm === 1 ? 4 : G.warm === 2 ? 2 : 1;
    G.items = [];
    startDissolve();
    runJobs(Infinity);
    for (var wk = 1; wk <= 3; wk++) { drawPost(NULLCTX, t0 + 0.1 * wk, 'back'); drawPost(NULLCTX, t0 + 0.1 * wk, 'front'); }   // the piece renderer is warmed on a context that draws nothing
    clearDissolve();
    if (cm) fx.cubes.rollback(cm);
    if (dm) fx.dots.rollback(dm);
    G.warm++;
    return G.warm < WARM_N;
  }

  function makeD(t0, speed, stagger, dry) {   // one constructor for real and trial dissolves: same hidden class => the optimised code never deoptimises
    return { t0: t0, speed: speed, stagger: stagger, lastDeath: t0, tLines: t0, tEnd: t0, dry: dry, info: { cubes: 0, dots: 0, lines: 0, lastDeath: 0 },
      jobs: null, ji: 0, cubePerW: 0, dotPerW: 0, K08: 1, cubeAPI: null, dotAPI: null, sub: 1, lastT: -1e9 };
  }
  function clearDissolve() {
    D = null;
    for (var i = 0; i < G.lines.length; i++) { var L = G.lines[i]; L.pieces = null; L.fz = null; L.nE = 0; }
    G.items = [];
    G.info = { cubes: 0, dots: 0, lines: 0, lastDeath: 0 };
    lastT = NaN;
  }
  function reset(o) {
    if (!G) return;
    if (D && o && o.clearFx && GA.fx) {
      if (GA.fx.cubes && GA.fx.cubes.clearFrom) GA.fx.cubes.clearFrom(D.t0);
      if (GA.fx.dots && GA.fx.dots.clearFrom) GA.fx.dots.clearFrom(D.t0);
    }
    clearDissolve();
  }


  function isActive(t) {
    if (!G) return false;
    if (D) return Math.min(t, D.t0) >= G.P.tDots && (t < D.tEnd || (!!D.jobs && D.ji < D.jobs.length));
    return t >= G.P.tDots;
  }

  /** surge(tHit): announce the impact time AFTER the build - the funnel then visibly tightens (and winds faster) over tHit-2.0 .. tHit-0.1 and the dissolve releases it */
  function surge(tHit) {
    if (!G) return;
    G.P.tHit = typeof tHit === 'number' && isFinite(tHit) ? Math.max(tHit, G.P.tFull + 0.8) : Infinity;
    lastT = NaN;
  }
  /** Nothing in the swirl depends on the canvas pixel ratio (pure vector geometry, no offscreen canvas, no mask, no cached raster): a quality / DPR change needs NO work.
      Kept as an idempotent no-op so the scene can call it unconditionally. */
  function rescale() { lastT = NaN; return true; }

  /** GPU warm-up: draws, invisibly (alpha 0.004, inside rect), every distinct draw state the first real frames use: opaque and low-alpha path fills (ribbons with round caps,
      soft sweeps, dots, rings), paper-coloured halo fills, round-cap strokes (dashes).  2 steps, ~0.2 ms each; returns true after the last step. */
  function warmGPU(ctx, step, rect) {
    if (!ctx || !rect) return true;
    var C = G ? G.C : makeColors(GA.style || {}), x = rect.x, y = rect.y, w = rect.w, h = rect.h, i, k;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var ax = [x + 0.15 * w, x + 0.35 * w, x + 0.6 * w, x + 0.85 * w], ay = [y + 0.7 * h, y + 0.35 * h, y + 0.6 * h, y + 0.3 * h], aw = [0.5, 1.4, 1.1, 0.4];
    if (!(step > 0)) {
      ctx.globalAlpha = 0.004;
      var cols = [C.ink, C.g1, C.g2, C.g3, C.paper];
      for (k = 0; k < cols.length; k++) {                                       // ribbons in every colour (opaque style fills)
        ctx.fillStyle = cols[k]; ctx.beginPath(); ribbon(ctx, ax, ay, aw, 0, 3, true, true, 1, true); ctx.fill();
      }
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x + 0.3 * w, y + 0.5 * h, 0.12 * w, 0, TAU); ctx.moveTo(x + 0.8 * w, y + 0.5 * h); ctx.arc(x + 0.7 * w, y + 0.5 * h, 0.1 * w, 0, TAU); ctx.fill();   // dots
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.g1; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x + 0.5 * w, y + 0.5 * h, 0.2 * w, 0, TAU); ctx.fill(); ctx.stroke();                             // ring
    } else {
      for (k = 0; k < SWL_S.length; k++) {                                       // soft sweep: the alpha levels of one ink path
        ctx.globalAlpha = 0.004 * (1 + k); ctx.fillStyle = C.ink; ctx.beginPath(); ribbon(ctx, ax, ay, aw, 0, 3, true, true, SWL_S[k], true); ctx.fill();
      }
      ctx.globalAlpha = 0.004; ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8;     // dashes: quadratic round-cap strokes
      ctx.beginPath(); ctx.moveTo(ax[0], ay[0]); ctx.quadraticCurveTo(ax[1], ay[1], ax[2], ay[2]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 0.2 * w, y + 0.8 * h); ctx.lineTo(x + 0.8 * w, y + 0.2 * h); ctx.stroke();
    }
    ctx.restore();
    return step >= 1;
  }

  /** SELF TEST (no drawing): evaluates every line (arms, sweeps, dotted trails, flicks, scribbles) and the accents at the times t0..t1 step dt and reports how far anything gets
      beyond the envelope ellipse and beyond the visible canvas (x in [0,W], y in [visTop+24, visBottom-24]).  'visible' = vertices that are actually drawn (width > 0.05). */
  function testBounds(t0, t1, dt) {
    if (!G || !G.ready) return null;
    dt = dt > 0 ? dt : 0.1;
    var P = G.P, g = {}, r = { samples: 0, vertices: 0, drawnVertices: 0, outsideVisible: 0, maxOutsideVisible: 0, beyondEnvelope: 0, maxBeyondEnvelope: 0, maxBeyondEnvelopeDrawn: 0, alphaAtMaxBeyond: 0,
      maxQ: 0, maxQDrawn: 0, minWidthFracAtQ97: 1, lines: G.lines.length, arms: G.arms.length, env: { cx: P.ecx, cy: P.ecy, rx: P.erx, ry: P.ery }, visible: { x0: 0, x1: P.W, y0: P.vt + 24, y1: P.vb - 24 } };
    var tmp = { x: 0, y: 0 }, i, j, L, t;
    function chk(x, y, w, drawn) {
      var qx = (x - P.ecx) / P.erx, qy = (y - P.ecy) / P.ery, q = Math.sqrt(qx * qx + qy * qy);
      r.vertices++; if (drawn) r.drawnVertices++;
      if (q > r.maxQ) r.maxQ = q;
      if (drawn && q > r.maxQDrawn) r.maxQDrawn = q;
      if (q > 1) { var beyond = Math.hypot(x - P.ecx, y - P.ecy) * (1 - 1 / q); r.beyondEnvelope++; if (beyond > r.maxBeyondEnvelope) { r.maxBeyondEnvelope = beyond; r.alphaAtMaxBeyond = w; } if (drawn && beyond > r.maxBeyondEnvelopeDrawn) r.maxBeyondEnvelopeDrawn = beyond; }
      var ox = Math.max(0, 0 - x, x - P.W), oy = Math.max(0, P.vt + 24 - y, y - (P.vb - 24)), od = Math.max(ox, oy);
      if (od > 0 && drawn) { r.outsideVisible++; if (od > r.maxOutsideVisible) r.maxOutsideVisible = od; }
    }
    for (t = t0; t <= t1 + 1e-9; t += dt) {
      r.samples++;
      gstate(t, g);
      for (i = 0; i < G.lines.length; i++) {
        L = G.lines[i]; evalLine(L, t, g);
        var jb = L.hs >= 1 ? L.n - 1 : L.iEnd;
        for (j = 0; j <= jb; j++) chk(L.X[j], L.Y[j], L.Wd[j], L.Wd[j] > 0.05);
      }
      for (i = 0; i < G.acc.length; i++) { accentPos(G.acc[i], t, g, tmp); chk(tmp.x, tmp.y, 1, true); }
    }
    return r;
  }

  GA.swirl = {
    /** build(o): synchronous (default); build(o) with o.sliced:true returns at once - call prepare(budgetMs) (<= ~4 ms of work per call) until isReady(). */
    build: function (o) {
      build(o, !!(o && o.sliced));
      if (G.ready) afterBuild(true);
    },
    isReady: function () { return !!(G && G.ready); },
    draw: draw, track: track, intensity: intensity,
    dissolveFrom: dissolveFrom, reset: reset, isActive: isActive, prepare: prepare, surge: surge, rescale: rescale, warmGPU: warmGPU,
    dissolveTime: function () { return D ? D.t0 : null; }, testBounds: testBounds,
    armCount: function () { return G && G.ready ? G.arms.length : 0; },
    info: function () { return G ? G.info : null; },
    debug: function () { return G; },
  };
})();


/* ===== thoughts.js ===== */
/* ============================================================================================================================
   GA.thoughts  -  the "thought" pieces that pop into the vortex one after another, orbit it, and dissolve into cubes   (SPEC 4.5)
   Classic script, IIFE, deterministic (GA.util.rng only), everything drawn is a pure function of (t, current dissolve state).
   Load AFTER props_*.js and fx.js.  World geometry is read from GA.stage / the build options (nothing is hard-coded to 780 / 700);
   colours come from GA.style at draw time (ink / paper theme), nothing is ever filled with white (the canvas may be transparent).

   PUBLIC API
     GA.thoughts.build({W,H,cx,cy,rx,ry,seed,tStart,tFull,tHit,swirl [,cubes,dots,autoDissolve,variant,visTop,visBottom,tAct0]})   CHEAP (1-4 ms): picks the cast,
         schedules the pop-ins and creates the items.  The expensive work (orbit planning, per-item ink analysis, erase masks) is done
         INCREMENTALLY by prepare() / draw().  If tHit is finite and autoDissolve !== false, dissolveFrom(tHit,{speed:1,stagger:CFG.STAGGER = 0.55}) is armed
         (it forces the preparation first); tHit undefined / Infinity => nothing is scheduled (call dissolveFrom yourself).
         The director must call GA.fx.cubes.reset() / GA.fx.dots.reset() BEFORE building the modules (scene.js does).
         cx,cy = vortex centre (girl's neck); rx/ry = the VORTEX ENVELOPE (everything revolves around her inside it; default min(0.27 W, 780) x 380);
         visTop / visBottom = the visible canvas in world y (default GA.stage.visTop / visBottom: nothing is ever clipped by it);
         swirl = GA.swirl (only used to read the spin direction).  variant = integer that selects the cast (default: rotates per loop).  tAct0 = the loop time she
         faces us (cues.turnFront1; default tStart - 1.1): the origin of the four acts (k = seconds after it; the acts scale with tNom - tStart).
     GA.thoughts.prepare(budgetMs)   do (at most about) budgetMs milliseconds of the deferred work; true when everything is ready (== isReady()).
         Usable at ANY time before the first pop (also in the very first frames after build()): plan, per-item ink analysis, canvases, 3 dry dissolves
         (JIT warm-up, one every other call, ~5 ms each); ~250 ms of work in total on a fast CPU, ~700 ms on a slow one.  Call it every frame with 2-3 ms
         from the moment build() returned.  prepare(Infinity) finishes synchronously.
         THE FIRST POP WAITS FOR isReady(): draw() prepares by itself in small slices (CFG.PREP_MS) and, when the first pop is due and the cast is still not
         ready, nothing pops: the module's own clock waits (every frame spends CFG.WAIT_MS on the preparation, all pops move later by the time waited
         (info().delay), then the remaining pops are squeezed to still end ~1.5 s before the hit, order and rhythm kept; the dissolve stays tied to the host's
         t0 and never to the pops).  A jump in t (seek / first frame after a pause) completes the preparation synchronously instead (deterministic).
     GA.thoughts.isReady() -> bool   plan + analysis + canvases + JIT warm-up all done.   GA.thoughts.isCoreReady() -> bool   everything the first pop needs.
     GA.thoughts.warmGPU(ctx, frames) -> bool   GPU / shader warm-up for the walk-in: call it once per frame for `frames` (4-8) frames with the main ctx (any
         transform; it resets it and restores it) any time before the first pop; it exercises every composite / gradient / blit variant the module uses
         (destination-in + linear gradient, putImageData into the mask canvas, 'copy', destination-out masked drawImage with smoothing, radial gradient,
         dashed round-capped strokes, scaled smoothed drawImage with alpha, 1:1 blit) on tiny regions at 1 % alpha in the top-left corner of the canvas and on
         private canvases, ~0.2-1 ms per call; invisible, deterministic; returns true when finished (no-op afterwards).
     GA.thoughts.rescale() -> true   the canvas pixel ratio changed (quality governor): drops ONLY the px-dependent caches (scratch + work canvases, per-item
         dissolve bitmaps) and re-arms their allocation for the next prepare() slice / first use; layout, items, entrance and dissolve state, ink analysis and
         erase fields (all in world units) are untouched.  ~0.5 ms, idempotent, safe at any time (also mid-dissolve).  Use it instead of a module rebuild.
     GA.thoughts.draw(ctx, t, layer)       layer 'back' | 'front' (no layer = both).  ctx must carry the world transform (uniform scale + translate).
     GA.thoughts.dissolveFrom(t0, {speed, stagger, seed})   INTERRUPT-SAFE: may be called at any time (also long after build()).
         The scene calls it at tHit + 0.04 with {speed:1, stagger:0.55}, or with {speed:1.6, stagger:0.35} when '+' interrupts.  From t0 on no new item is
         added (items that have not popped by t0 never appear); every visible item starts within "stagger" seconds (nearest to her head first; the first
         one at t0, the first texel of it erases at once, the last item is gone ~1.3 s after t0) and is wiped away in (0.40..0.54)/speed s by a soft,
         noise-ragged diagonal front that starts on the side facing her head (line work and paper fill disappear together); the cubes (GA.fx.cubes.spawn,
         <= CFG.CUBE_CAP = 320, many tiny + a few large) and dots (<= CFG.DOT_CAP = 220) are released exactly where the front passes.
         IDEMPOTENT: while a dissolve is running (or pending) a second call is a no-op that returns the first call's result object.
         COST: the call itself ~1.5-4.5 ms (first call of a page ~4.5 ms; schedule + the item that starts first); the cubes / dots of the other items
         are spawned by draw() over the next frames (CFG.SPAWN_MS = 1.5 ms per frame, always in time: an item is spawned >= 0.06 s before it starts);
         flushSpawn() completes them at once (tests).  The result is a pure function of (items, t0, options), whatever the slicing.  Items still popping in
         at t0 finish their pop (<= 0.5 s) first.  Returns {items, cubes, dots, lastDeath, skipped} (cubes / dots count what has been spawned so far).
         Particles already in GA.fx cannot be recalled: reset fx first when a dissolve is restarted.
     GA.thoughts.reset({schedule})         cancels any dissolve and revives skipped items (layout kept); schedule:true re-arms the dissolve at tHit.
     GA.thoughts.isActive(t) -> bool       an item is visible at t, or cubes/dots of the dissolve are still pending/falling.
     GA.thoughts.flushSpawn()              finish the pending cube / dot spawning of a dissolve now (tests / recordings).
   EXTRAS
     GA.thoughts.cfg      tunables (CFG below)
     GA.thoughts.info()   { items, names, roles, heroes, cast, variant, cubes, dots, lastDeath, spawn:[{name,t}], missing:[], dir, buildMs, delay,
                            beats:[{kind:hero|bulb|firework, name, t (loop s), k (s after turnFront1), sync}], acts:{turnFront1, I, II, III, IV, hit, kScale} (loop s) }
     GA.thoughts.itemsAt(t) -> [{name,role,hero,x,y,s,ex,ey,front,age,state:'enter'|'orbit'|'crumble'}]   (tests / overlays)
     GA.thoughts.debug()  internal state
     GA.thoughts.testBounds({step, W, visTop, visBottom, dissolveAt}) -> {maxOutsideCanvas, maxOutsideEnvelope, maxAboveBand, maxBelowGround, worst, samples, items, ok}
         RUNTIME SELF-TEST over the whole loop (first pop .. end of the dissolve start): worst excursion in world units of any drawn box outside the visible
         canvas, and of any item centre outside the envelope (target 0 / 0); the band numbers are the soft 16:4.5 band.

   CAST: A BUSY MIND (the user: "my mind is very visual and chaotic and happening all the time"; design thinking - spatial thinking and iterating until a design is
         solved - stays the focus, abstract, never literal; she reads a lot: books are the biggest hobby; a chai glass and a tennis racket are small)
     Four hand-curated casts (GA.thoughts.casts, in loop order: iterate, spatial, solve, depth) rotate from loop to loop.  Every cast has the same 75 scheduled items
     (+ ~13 churn twins, ~88 in all; ~70 alive at the end: bulbs and fireworks burn out): 4 heroes 255-338 units (x SIZE_UP 1.25), 9 supporting 125-205, 5 books
     108-150 (open, stack, flipping pages, spines, closed), chai glass 87, racket 80, tennis ball / pencil, 6 small design pieces 66-110, 12 micro marks 21-52 (spark,
     spiral, loop, squiggle, zigzag, orbit with a satellite, dotted trail, tumbling mini cube, folded strip, pencil doodle that draws itself, constellation, redrawn
     triangle / square, dial: registered as mSpark .. mRing at the top of this file), 5 idea bulbs 38-88 (props_d bulb*, at the sync beats, fade after 5.2 s), 10 firework
     bursts 119-206 (props_d fw*; one-shot, each a fresh burst at a seeded polar position, life = one period, at the BEAT.fw / fwExtra times), 20 freehand icons 52-94.
     Design pieces and fragments come from props_d.js (rotatingVolume, stackShift, tryAgainFold,
     solvedMark, doodleLoop, stringModel, foldStrip, maquetteCluster, dotWarp, bendLattice ...), books / chai / racket from props_a / props_b.  A missing name falls
     back to the next unused piece of its ring.  BLACKLIST = literal pieces that can never be scheduled.
     FREEHAND ICONS (kind N): up to CFG.ICONS = 18 small hand-drawn line icons (props_e.js; every registered piece tagged 'icon' or named icXxx is discovered at build
     time, the cast takes 18 of them rotating per loop) at 46-80 units, distributed through the depth layers and orbits like the other small pieces; they start their
     draw-on cycle (p.t = age, boil included) when they pop, are drawn at alpha 0.9 and go into the sprite atlas at 18 Hz.  info().icons lists the names.
     PACING (ROUND 10, FOUR ACTS; see ACT / BEAT and the comment above them): k = seconds after turnFront1 (= tStart - 1.1).  I (0-5.5) the four heroes one at a time
     (1.4 / 2.9 / 4.15 / 5.35), the first bulb at 2.4, two sparks; II (5.5-12) a satellite icon per hero, the supporting pieces every 0.68 s each with a satellite
     (a GROUP: same orbit speed / layer, tethered, a thread), books / hobbies between, bulbs 6.2 / 9.8, firework 9.5; III (12-17.7) the rest of the small pieces
     swarm in with accelerating gaps, fireworks 12.6 / 14.1 / 15.6 / 16.8 (+ smaller extras), bulbs 13.4 / 16.2, random threads, churn twins; IV (17.7-20.3) no new
     pops, orbits contract (CFG.FUNNEL) and the flow surges.  info().beats / info().acts publish the real times (R10/tho/BEATS.json).
   GEOMETRY: EVERYTHING REVOLVES AROUND HER, INSIDE THE VORTEX ENVELOPE
     The scene passes the ENVELOPE (build({cx, cy, rx, ry}): an ellipse centred on her neck).  Slots are POLAR (radius fraction rf of (rx, ry), screen angle th).
     Every item rides its own ellipse around HER (a copy of the envelope ellipse scaled by rf, centre a little below the neck, slightly tilted, vertically
     squashed), in the swirl's direction, angular speed W_IN 0.118 (inner) .. W_OUT 0.072 (outer) rad per flow unit (flow = 0.7 .. 1.3 per second, +80 % in the
     last 1.6 s), times the DEPTH LAYER: far x0.76, mid x1, near x1.22 (parallax); a few small pieces turn the other way, slower.
     DEPTH LAYERS dl: far (smaller x0.84, fainter x0.62, thinner, slower, always drawn BEHIND her, may swoop in towards her and back out), mid (the main pieces), near
     (x1.14, crisper, faster).  The planner keeps (hard) every box inside the VISIBLE canvas (entrance overshoot, bob, tumble, pop ring and the dissolve push
     included), every CENTRE inside the envelope, off her head and column; (soft) inside the 16:4.5 band; it plans the 18 big pieces with a full search and the
     small ones with a handful of candidates each against the big ones (small pieces may overlap each other and, slightly, a piece in another depth layer).
     The near half of an orbit is drawn in the 'front' layer, the far half in the 'back' layer: nothing is ever drawn over her body.  testBounds() measures it.
   BEHAVIOUR
     * Pop-ins: every item glides out of her head while a spring scales it in (heroes and supporting pieces with the diagonal draw-on wipe + a ring and a few
       dots, at most two wipes at a time; everything else a plain spring pop); the animated pieces (iteration marks, flipping pages, steam, fireworks) start their story
       at their pop.  Gentle scale / alpha breathing, slow 3D tumbles, bob, occasional swoops, twinkles.
     * THREADS: ~11 taut hairlines link nearby pieces like a mind map / string model: they draw on, pulse, a glint runs along them, then fade (back pass).
     * SOFT SHADOWS: a faint ground shadow under every design piece (smaller / fainter the higher it floats) and the paper-coloured knockout under the heroes and
       supporting pieces (CFG.KNOCK, back pass) make the pieces float in a space instead of sticking to the page.
     * SPRITES (the GPU budget): every piece is rendered into ONE shared atlas canvas at its current device scale, refreshed at 12-24 Hz (CFG.SPR_HZ*, or when its size
       changes by 4 %), and blitted at integer pixels every frame; all re-renders of a frame go into the atlas in one batch (a GPU canvas pays for every render-target
       switch: separate sprite canvases cost 45 -> 28 fps, the atlas 45 -> 82 fps at 1080p).  The pop entrance and the dissolve use direct vector draws.
     * Every item bobs, breathes, tumbles slowly in 3D (p.rot) and is depth-sorted.  Heroes are drawn bolder (line multiplier HERO_LW 1.2 / SUP_LW 1.08 on top of
       LW 1.08; books 0.78, the other hobbies 0.7; far x0.85, near x1.12).
     * Dissolve: at its start the item is rendered ONCE into a per-item bitmap (frozen pose, canonical time = its start, so the picture is a pure function of
       the state); every frame the bitmap is translated (integer pixels) and, only while the front crosses it, only the still-visible rectangle goes through
       copy -> erase mask (one texel = 9-14 units, bilinear = soft ragged edges, rebuilt per frame from per-texel erase times) -> blit.  An untouched
       item is a plain blit, a swallowed one costs nothing.  The cubes are spawned at the same times (see dissolveFrom).
     * Knockout: every design piece (hero / supporting; not books / hobbies / tiny ones) gets a soft paper-coloured knockout (CFG.KNOCK = 0.86, paper colour from
       GA.style at draw time): a per-item field from its measured ink (enclosed areas filled, grown one texel, blurred: ~25-35 units of feather, no box, no halo)
       so the swirl lines behind it fade out.  It is always drawn in the BACK pass (under the girl, at the piece's depth), so it can never cover her.
     * Entrance: the draw-on wipe uses the shared scratch canvas ONLY while it runs (<= 0.9 s; pops are >= CFG.MIN_POP_GAP = 0.36 s apart: at most two wipes at
       a time); afterwards the spring settles on a plain vector draw.
     * Cost: one GA.props draw per item in steady state (no allocation); a shared scratch canvas only while an item enters; per-item bitmaps while it dissolves.
   ============================================================================================================================ */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util;
  var TAU = Math.PI * 2;
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, min = Math.min, max = Math.max, floor = Math.floor, ceil = Math.ceil, round = Math.round, exp = Math.exp, hypot = Math.hypot, atan2 = Math.atan2, pow = Math.pow, asin = Math.asin;

  // ------------------------------------------------------------------------------------------------ tunables
  var CFG = {
    LW: 1.08,            // base line-weight multiplier handed to every piece (props draw ~2-3 units at these sizes; the swirl arms are 2-6)
    HERO_LW: 1.2, SUP_LW: 1.08,    // heroes / supporting pieces: bolder than the base (the design pieces must out-weigh the swirl)
    LIFE_LW: 0.78,       // extra multiplier for the books (the hobbies are drawn in the same hand, a little lighter than the design pieces)
    KNOCK: 0.86,         // strength of the soft paper-coloured knockout behind every design piece (the swirl lines fade out behind it)
    LIFE_ALPHA: [0.82, 0.93],
    DEPTH_ALPHA: 0.14,   // the far half of an orbit is drawn up to this much lighter (and PERSP smaller)
    SPAWN_LAST: 1.2,     // after a wait for the preparation the remaining pops are squeezed to end this long before the hit (the schedule itself: ACT / BEAT below)
    GLIDE_FIRST: 0.60, GLIDE: 0.30,    // fraction of the way to her head an item starts from (the first three / the others)
    W_IN: 0.118, W_OUT: 0.072, // angular travel (rad) of an item per unit of "flow" (the flow clock runs ~0.7..1.3 units per second): inner rings faster
    COUNTER_K: 0.62,     // the few counter-revolving pieces turn this much slower
    SURGE: 1.7,          // the flow speeds up by this much (relative) in the last 2.5 s before the hit (the funnel)
    ENV_K: 0.87,        // the CENTRE of every item stays inside this multiple of the vortex envelope (rx, ry from the scene)
    VIS_MARGIN: 22,      // every item's box (entrance overshoot, bob, dissolve push included) stays this far inside the visible canvas
    FACE_HW: 100, FACE_HH: 100, GIRL_FAR_HW: 30, GIRL_GAP: 22,   // head clearance (all sides); half width of the column an item may hide behind (far side); gaps to the girl
    POP_R: 150,          // the entrance ring / dots never burst further than this (they must stay inside the canvas, too)
    DL_SZ: [0.84, 1, 1.14], DL_ALPHA: [0.62, 1, 1], DL_W: [0.76, 1, 1.22], DL_LW: [0.85, 1, 1.12],   // depth layers far / mid / near: size, alpha, orbit speed, line weight
    SPR_HZ: 12, SPR_HZ_FAST: 20, SPR_HZ_K: { A: 24, H: 24, M: 18, F: 24, I: 18, N: 12 }, SPR_TOL: 0.04,   // small pieces are drawn from cached sprites refreshed at this rate (or when their size changes more than SPR_TOL)
    LINKS: 16,           // taut hairline threads between nearby pieces (a string model / mind map), appearing and fading
    SHADOW: 0.1,         // peak alpha of the soft ground shadow under the design pieces
    HERO_W_K: 1.5,       // the heroes orbit this much faster than the ring they ride (ROUND 10: ~4-9 deg/s in acts I-III: alive, still readable for 2-3 s)
    SIZE_UP: 1.25,       // ROUND 10: every slot / size range is this much bigger than the approved round-9 cloud (the envelope grew ~30 % as well)
    FUNNEL: 0.28, FUNNEL_LIFT: 90, FUNNEL_SHRINK: 0.15,   // act IV (last 2.6 s): every orbit contracts by FUNNEL towards her HEAD centre (cy - FUNNEL_LIFT), the pieces shrink by FUNNEL_SHRINK, the flow surges: a pull-in (the planner scores the contracted path, so nothing crosses her body / face)
    ICONS: 20, ICON_SZ: [44, 80], RF_MIN: 0.34, RF_MAX: 0.87,   // freehand icons (props_e): how many alive at once, size range (x SIZE_UP); the centres of all pieces stay at 0.34-0.93 of the envelope (the swirl encompasses the cloud)
    LIGHT_TRIES: 32,     // orbit candidates tried for each small piece (the big ones get PLAN_TRIES + refinement)
    MATE_TRIES: 52, TETHER: 54,   // satellites of a group: more candidates, and their centre stays within TETHER units of touching their leader (planner penalty)
    BURSTS: 16,          // fireworks: one-shot bursts at seeded polar positions at the BEAT.fw / fwExtra times (see below); caps their number
    MIN_POP_GAP: 0.30,   // pops are never closer than this (at most two entrance wipes at a time)
    WAIT_MS: 8,          // while the first pop waits for the preparation, each frame spends this long on it
    WAIT_DT: 0.25,       // a frame step larger than this is a seek / jump: the preparation is completed synchronously instead of waiting
    FRONT_Z: 0.12,       // sin(orbit angle) above which an item is in front of the girl ('front' layer)
    PERSP: 0.12,         // near items are drawn this much bigger (far ones smaller)
    GIRL_HW: 125, HERO_GIRL_HW: 150, GIRL_TOP: 170,   // girl exclusion: |x-cx| < GIRL_HW (heroes: HERO_GIRL_HW) for y > cy - GIRL_TOP (items keep their whole box out of it)
    Y_MIN: -14, Y_BOTTOM_GAP: -40, X_MARGIN: 16,   // SOFT preference: items stay inside [Y_MIN, groundY - Y_BOTTOM_GAP] (the band + a hair: the page fades the canvas only beyond ~y -150 / 900); the hard limit is the visible canvas
    COMFORT: 30,         // wanted gap (units) between neighbouring items (books / small ones less)
    HOME_PULL: 0.18,     // planner: penalty per unit between an item's mean position and its slot's home (beyond 40 units)
    PLAN_TRIES: 100,         // random orbit candidates evaluated per item (pass 1; pass 2 uses half), plus local refinements (ROUND 10: 150 -> 100 and 0.45 s sampling: the preparation fits into the walk-in slices on a normal laptop)
    WARM_RUNS: 3,        // dry dissolves run during the preparation (JIT warm-up), one per frame
    PREP_MS: 6.0,        // budget of the preparation that draw() does by itself while the cast is not ready yet (ROUND 10: 2.4 -> 6 so the planner finishes during the cheap walk-in frames and the first pop never waits)
    STAGGER: 0.55,       // default stagger of a scheduled dissolve: item starts at t0 + 0 .. STAGGER (nearest to her head first)
    STAGGER_POW: 1.3,    // > 1: the first items start almost together, the far ones trail
    ERASE: [0.40, 0.54], // seconds (at speed 1) the front needs to cross an item (first texel erases at its start, the last one at start + this)
    FRONT_LOAD: 0.78,    // exponent of the erase-time distribution (< 1: more of the item goes early)
    DISS_PX: 0.9,        // the dissolve bitmaps are rendered at min(1, DISS_PX / device px per unit) of the screen resolution (>= 0.7)
    SPAWN_MS: 1.5,       // dissolveFrom() spawns the earliest items at once and the rest with this budget per call / per frame
    SOFT: 0.2,           // softness of the front (s at speed 1): every texel fades over this long
    MASK_CELL: 9, MASK_MAX: 56,   // erase mask: texel size (units, 8-14 in practice) and max texels per side
    CELL_MIN: 6, CELL_MAX: 32,    // cube-site cells (world units)
    INK_MIN: 0.012,      // a cell needs this fraction of dark pixels (relative to the paper) to be a cube site
    CUBE_CAP: 320, DOT_CAP: 220,  // per dissolve (the swirl has its own budget)
    SIZE_MAX: 34,        // largest cube edge
  };

  /* ---- BLACKLIST: literal / architectural-cliche pieces that can never be scheduled, whatever a cast says ---- */
  var BLACKLIST = { sketchPlan: 1, sketchPersp: 1, sketchSection: 1, planIterations: 1, interiorPersp: 1, courtyardSection: 1, axonExploded: 1, sitePlan: 1, spaceSequence: 1,
    modelPhoto: 1, facadeStudy: 1, elevationStudy: 1, staircaseStudy: 1, tracingOverlay: 1, tracingRoll: 1, bubbleDiagram: 1,
    massingEvolve: 1, massingA: 1, massingB: 1, massingC: 1, lightStudy: 1, conceptSpiral: 1, iterations: 1, processDiagram: 1,
    imagineBubble: 1, lightWedge: 1, helixLines: 1, gridFold: 1, rhythmBars: 1, scribble: 1, gridPlane: 1 };
  /* replacement ring for names that do not exist (abstract pieces only) */
  var FALLBACK = ['formIterations', 'arcVault', 'layeredTrace', 'sliceCut', 'offsetDiscs', 'voidRing', 'interlockArcs', 'suspendedPlane', 'spiralOrbit', 'foldedPlanes', 'wireVolume', 'kitOfParts', 'volumeShift',
    'rotatingVolume', 'stackShift', 'tryAgainFold', 'solvedMark', 'scaleSteps', 'onionContours', 'dotSurface'];
  var MICRO = ['mSpark', 'mSpiral', 'mLoop', 'mSquig', 'mZig', 'mOrbit', 'mTrail', 'mCube', 'mFold', 'mDoodle', 'mDots', 'mTri', 'mRedraw', 'mRing'];
  var RINGS = { D: FALLBACK, T: ['shapeCircle', 'dotCluster', 'dotDisc', 'cubeLine', 'volumeShift', 'kitOfParts'], B: ['bookOpen', 'bookClosed', 'bookStack', 'bookSpines', 'bookFlip'], C: ['chaiGlass', 'kulhad', 'chaiCup'], R: ['tennisRacket'],
    X: ['tennisBall', 'pencil'], N: [], M: MICRO, F: ['fwPeony', 'fwWillow', 'fwRing', 'fwSpiral', 'fwCrackle', 'fwChrysanthemum', 'fwSparkle', 'mSpark'], I: ['bulbClassic', 'bulbSpiral', 'bulbSwitch', 'bulbCluster', 'mRing'] };
  var SIZE_K = { tennisRacket: 1.0, bookSpines: 1.0, rotatingVolume: 0.8, tryAgainFold: 0.8 };   // per-piece size trim on top of the slot size
  var SIZE_UP_K = { B: 1.1, C: 1.12, R: 1.12, X: 1.12, T: 1.18, M: 1.18, N: 1.18 };            // ROUND 10 growth per kind (the rest: CFG.SIZE_UP): the hierarchy heroes > supporting > books / hobbies > small stays
  var LW_K = { solvedMark: 0.85 };                         // per-piece line-weight trim
  var HERO_MAX = 338;                                      // no hero is larger than this (longest visible side, world units; 270 x SIZE_UP)
  var ICON_EXCLUDE = { icRacket: 1, icChaiGlass: 1, icCoffeeCup: 1, icTennisBall: 1, icPencil: 1, icOpenBook: 1, icClosedBook: 1, icCube: 1 };   // the hobby slots (racket, chai glass, ball, pencil, 5 books) and the cubes already hold these subjects

  /* ---- the slots.  POLAR positions in the VORTEX ENVELOPE (ellipse rx, ry centred on her neck, given by the scene): rf = radius as a fraction of the envelope
          (0.3 inner .. 1.0 edge), th = screen angle of the home in degrees (0 right, 90 down = near side, 180 left, 270 = up = far side), s = size (longest visible
          side, world units), dl = depth layer (-1 far: smaller / fainter / slower, always behind her; 0 mid; 1 near: a little larger and crisper, faster).
          Kinds: A anchor hero, H hero (190-270), S supporting (100-170), B book (70-110), C chai glass, R racket, X tennis ball / pencil, T small design piece
          (55-95), M micro mark (18-44), I idea bulb (28-60), F firework burst (one-shot, positions generated, denser towards the hit).
          Every item revolves around HER on its own ellipse through its slot (v = variant of the piece, cw = -1 turns the other way). ---- */
  var HEAVY = [
    { k: 'A', rf: 0.62, th: 192, s: 270, dl: 0 },   { k: 'H', rf: 0.74, th: -12, s: 245, dl: 0 },   { k: 'H', rf: 0.86, th: 160, s: 225, dl: 0 },   { k: 'H', rf: 0.70, th: 32, s: 205, dl: 1 },
    { k: 'S', rf: 0.55, th: 104, s: 165, dl: 1 },   { k: 'S', rf: 0.78, th: -58, s: 150, dl: 0 },   { k: 'S', rf: 0.66, th: 238, s: 140, dl: -1 },  { k: 'S', rf: 0.92, th: 128, s: 135, dl: 0 },
    { k: 'S', rf: 0.60, th: -102, s: 125, dl: -1 }, { k: 'S', rf: 0.86, th: 6, s: 120, dl: 0 },     { k: 'S', rf: 0.94, th: 212, s: 112, dl: -1 },  { k: 'S', rf: 0.72, th: -32, s: 105, dl: 0 },
    { k: 'S', rf: 0.80, th: 74, s: 100, dl: 1 },
    { k: 'B', rf: 0.66, th: 218, s: 135, dl: 1, v: 0 }, { k: 'B', rf: 0.52, th: 126, s: 115, dl: 0, v: 1 },  { k: 'B', rf: 0.72, th: -26, s: 108, dl: 0, v: 2 }, { k: 'B', rf: 0.78, th: 40, s: 104, dl: 1, v: 3 },
    { k: 'B', rf: 0.80, th: -150, s: 98, dl: 0, v: 4 },
    { k: 'C', rf: 0.60, th: 62, s: 78, dl: 1 },
  ];
  var HOBBY = [{ k: 'R', rf: 0.98, th: 162, s: 72, dl: 0 }, { k: 'X', rf: 0.70, th: -82, s: 42, dl: 0 }, { k: 'X', rf: 0.92, th: 202, s: 78, dl: -1 }];
  var LIGHT_COUNT = { T: 6, M: 12, I: 5, N: 20 };           // small design pieces, micro marks, idea bulbs (= the 5 sync beats), freehand icons
  var CHURN = { N: 1, M: 1, T: 1 };                         // these small pieces live 3-7 s, fade, and a twin appears elsewhere (the cloud is never static); bulbs just fade
  /* ---- THE FOUR ACTS of the thought process (ROUND 10).  k = seconds after the scene's cue turnFront1 (she faces us).  The module only receives tStart
          (= turnFront1 + ACT_OFF: cues dots = turnFront1 + 0.2, swirlStart = dots + 0.9) and the hit tNom (= turnFront1 + 20.3): tOfK() maps k to loop seconds and
          scales the acts when a host's thinking span is not the 19.2 s of the landing page (build option tAct0 = turnFront1 overrides the offset).
          I  spark (0-5.5):      one hero at a time, each given its moment; the first bulb; two tiny sparks.
          II ideas multiply (5.5-12): a satellite icon attaches to every hero, then the supporting pieces every ~0.7 s, each with a satellite 0.3-0.5 s later
                                 (a GROUP: same orbit speed / depth layer, tethered by the planner, linked by a thread), books / chai / racket / ball / pencil
                                 in between, bulbs, the first firework.
          III overload (12-17.7): the rest of the small pieces swarm in with accelerating gaps, fireworks and bulbs pop all over, random threads, churn twins.
          IV funnel (17.7-20.3): no new piece; the orbits contract (CFG.FUNNEL) and the flow surges; the ball arrives.
          BEAT = the real pop times: bulb / fw are SYNC POINTS the girl reacts to; info().beats publishes them (loop seconds + k) after any wait / compression. ---- */
  var ACT_OFF = 1.1;
  var ACT = { I: 0, II: 5.5, III: 12.0, IV: 17.7, END: 20.3 };
  var BEAT = {
    hero: [1.4, 2.9, 4.15, 5.35], heroMate: [5.7, 6.1, 6.5, 6.9], spark: [4.55, 5.05],
    S: [5.9, 6.58, 7.26, 7.94, 8.62, 9.3, 9.98, 10.66, 11.34], mateLag: [0.32, 0.5],
    B: [6.25, 7.6, 8.95, 10.3, 11.65], C: [7.0], R: [8.3], X: [9.65, 11.0],
    bulb: [2.4, 6.2, 9.8, 13.4, 16.2], fw: [9.5, 12.6, 14.1, 15.6, 16.8], fwExtra: [13.35, 15.05, 17.35, 18.25, 19.05],
    swarm: [12.25, 17.6], swarmGap: [0.34, 0.11], bulbLife: 5.2,
  };
  /* the 32 freehand icons of props_e.js in a category-mixed order (design tools / mind / hobbies alternate); each cast takes 22 consecutive ones starting 8 further on, so all 32 appear over four loops */
  var ICON_ORDER = ['icPencil', 'icLightbulb', 'icOpenBook', 'icCube', 'icEye', 'icChaiGlass', 'icCompass', 'icRefresh', 'icRacket', 'icMagnifier', 'icHeadSpiral', 'icNotebook', 'icSetSquare', 'icInfinity', 'icCoffeeCup', 'icPaperPlane',
    'icKey', 'icClosedBook', 'icScissors', 'icSparkle', 'icHeadphones', 'icPuzzle', 'icCloud', 'icEraser', 'icCamera', 'icBoat', 'icRuler', 'icTennisBall', 'icBrush', 'icPlant', 'icTablet', 'icLaptop'];
  /* ---- the four hand-curated casts (lists per kind, in slot order; a missing name falls back to the next unused piece of its ring).  Every cast tells the
          design-thinking story twice over - ITERATING (a form revised until it is solved) and thinking SPATIALLY - with fragments of a busy mind around them. ---- */
  var CASTS = [
    { name: 'iterate',
      A: ['rotatingVolume'], H: ['interlockArcs', 'spiralOrbit', 'tryAgainFold'],
      S: ['solvedMark', 'stackShift', 'doodleLoop', 'stringModel', 'foldedPlanes', 'foldStrip', 'solveSquiggle', 'offsetDiscs', 'formIterations'],
      B: ['bookOpen', 'bookStack', 'bookClosed', 'bookFlip', 'bookSpines'], Bv: [0, 1, 4, 3, 0], C: ['chaiGlass'], R: ['tennisRacket'], X: ['tennisBall', 'pencil'],
      T: ['dotCluster', 'shapeCircle', 'maquetteCluster', 'slabRhythm', 'dotDisc', 'cubeLine'], M: ['mSpiral', 'mCube', 'mRedraw', 'mSpark', 'mLoop', 'mOrbit', 'mFold', 'mDoodle', 'mTri', 'mSquig', 'mDots', 'mZig', 'mTrail', 'mRing'],
      F: ['fwPeony', 'fwWillow', 'fwRing', 'fwSpiral', 'fwCrackle', 'fwChrysanthemum', 'fwSparkle'], I: ['bulbClassic', 'bulbSpiral', 'bulbSwitch', 'bulbCluster', 'bulbClassic'] },
    { name: 'spatial',
      A: ['stackShift'], H: ['rotatingVolume', 'wireVolume', 'onionContours'],
      S: ['tryAgainFold', 'foldedPlanes', 'maquetteCluster', 'dotWarp', 'bendLattice', 'curvedWall', 'sheetStack', 'tetraWire', 'mobileBalance'],
      B: ['bookClosed', 'bookOpen', 'bookSpines', 'bookStack', 'bookFlip'], Bv: [3, 1, 1, 0, 2], C: ['chaiGlass'], R: ['tennisRacket'], X: ['pencil', 'tennisBall'],
      T: ['shapeCircle', 'dotCluster', 'rollingSphere', 'dotCompass', 'dotDisc', 'volumeShift'], M: ['mCube', 'mOrbit', 'mSpark', 'mFold', 'mSpiral', 'mTrail', 'mTri', 'mDots', 'mLoop', 'mRedraw', 'mZig', 'mSquig', 'mDoodle', 'mRing'],
      F: ['fwRing', 'fwPeony', 'fwCrackle', 'fwWillow', 'fwSparkle', 'fwSpiral', 'fwChrysanthemum'], I: ['bulbSwitch', 'bulbClassic', 'bulbCluster', 'bulbSpiral', 'bulbClassic'] },
    { name: 'solve',
      A: ['interlockArcs'], H: ['solvedMark', 'stackShift', 'rotatingVolume'],
      S: ['spiralOrbit', 'doodleLoop', 'solveSquiggle', 'foldStrip', 'stringModel', 'dotPinch', 'breathingArcs', 'shadowSweep', 'voidRing'],
      B: ['bookStack', 'bookFlip', 'bookClosed', 'bookOpen', 'bookSpines'], Bv: [1, 0, 2, 2, 1], C: ['chaiGlass'], R: ['tennisRacket'], X: ['tennisBall', 'pencil'],
      T: ['dotCluster', 'shapeCircle', 'mobileBalance', 'maquetteCluster', 'dotDisc', 'kitOfParts'], M: ['mRedraw', 'mDoodle', 'mSpark', 'mTri', 'mLoop', 'mSpiral', 'mCube', 'mFold', 'mOrbit', 'mDots', 'mSquig', 'mTrail', 'mZig', 'mRing'],
      F: ['fwSpiral', 'fwChrysanthemum', 'fwPeony', 'fwRing', 'fwWillow', 'fwSparkle', 'fwCrackle'], I: ['bulbSpiral', 'bulbCluster', 'bulbClassic', 'bulbSwitch', 'bulbClassic'] },
    { name: 'depth',
      A: ['wireVolume'], H: ['tryAgainFold', 'onionContours', 'foldedPlanes'],
      S: ['stackShift', 'rotatingVolume', 'curvedWall', 'bendLattice', 'sheetStack', 'tetraWire', 'dotWarp', 'arcVault', 'layeredTrace'],
      B: ['bookSpines', 'bookOpen', 'bookClosed', 'bookStack', 'bookFlip'], Bv: [1, 0, 5, 0, 1], C: ['chaiGlass'], R: ['tennisRacket'], X: ['pencil', 'tennisBall'],
      T: ['shapeCircle', 'dotCluster', 'rollingSphere', 'slabRhythm', 'dotDisc', 'volumeShift'], M: ['mSpark', 'mCube', 'mTrail', 'mOrbit', 'mFold', 'mSquig', 'mSpiral', 'mDots', 'mTri', 'mRedraw', 'mLoop', 'mDoodle', 'mZig', 'mRing'],
      F: ['fwCrackle', 'fwSparkle', 'fwPeony', 'fwWillow', 'fwRing', 'fwChrysanthemum', 'fwSpiral'], I: ['bulbCluster', 'bulbClassic', 'bulbSpiral', 'bulbSwitch', 'bulbClassic'] },
  ];
  /* visible-ink extent of every piece (multiples of p.s: width, height, ink-centre offset x, y; 90th percentile over the animation period and mild tumbles),
     measured with measureInk(names) in demos/thoughts.html (re-run it when a prop changes).  A slot's size is the LONGEST VISIBLE side of the piece in world units. */
  var INK = { iterationChain: [1.03, 0.57, 0, 0.01], revisedCurve: [1, 0.58, 0, -0.01], tryAgainFold: [0.88, 0.65, 0, 0.02], solvedMark: [0.79, 0.66, 0.01, 0],
    rotatingVolume: [0.68, 0.72, 0, 0], stackShift: [1.02, 0.88, 0.01, 0.01], depthLayers: [1.09, 0.66, -0.01, 0], voidCarve: [1.44, 1.13, -0.01, 0.01], scaleSteps: [0.93, 0.72, 0.03, -0.01],
    formIterations: [0.84, 0.78, 0.04, -0.05], foldedPlanes: [1.12, 0.67, 0.01, -0.02], volumeShift: [0.78, 0.66, 0, 0.01], wireVolume: [0.96, 1.03, 0, 0], 
    arcVault: [0.99, 0.79, 0.01, 0.01], dotSurface: [1.2, 0.8, -0.02, -0.02], nestedFrames: [0.95, 0.73, 0, -0.01], sliceCut: [1.03, 0.89, 0, -0.01], 
    layeredTrace: [1.04, 0.79, -0.01, 0.01], apertureLight: [0.92, 0.83, 0.01, -0.02], spiralOrbit: [0.85, 0.93, -0.01, 0], 
    kitOfParts: [0.87, 0.79, -0.01, 0], onionContours: [0.89, 0.77, 0, -0.01], offsetDiscs: [0.99, 0.79, 0, -0.01], voidRing: [0.91, 1.03, -0.03, 0], 
    dotDisc: [1.11, 0.64, 0, 0], interlockArcs: [1.01, 0.49, 0, 0], suspendedPlane: [0.89, 1.01, -0.01, 0], cubeLine: [1.04, 0.92, -0.01, 0], 
    bookOpen: [1.02, 0.79, -0.01, 0.01], bookClosed: [0.89, 0.74, 0, 0], bookStack: [1, 1.02, 0, 0.01], chaiCup: [0.99, 0.96, 0, 0.01], 
    chaiGlass: [0.41, 1, 0, 0], kulhad: [0.53, 1, 0, 0], laptop: [1.02, 0.98, 0.01, -0.01], ipad: [1, 0.67, -0.01, 0], tennisRacket: [0.41, 1, -0.01, 0], 
    tennisBall: [1.01, 1.01, 0, 0], pencil: [0.99, 0.66, 0, -0.01], shapeCircle: [1.01, 1.01, 0, 0], dotCluster: [0.99, 0.7, 0, -0.03],
    bookFlip: [0.98, 0.81, -0.01, -0.06], bookSpines: [1.23, 0.97, 0.04, 0.07],
  
    fwPeony: [0.83, 0.93, 0, 0.06], fwWillow: [0.79, 0.96, -0.01, 0.23], fwRing: [0.92, 0.92, -0.03, 0.03], fwSpiral: [0.93, 0.93, -0.03, 0.06], fwCrackle: [0.89, 0.96, 0, 0.09], fwChrysanthemum: [0.8, 0.74, -0.01, 0.04], fwSparkle: [0.77, 0.82, 0.04, 0], bulbClassic: [0.94, 0.97, 0, 0], bulbSpiral: [0.94, 0.97, 0, 0], bulbSwitch: [0.87, 0.87, 0, 0], bulbCluster: [1.19, 0.91, 0, 0], stringModel: [0.96, 0.78, 0, 0], foldStrip: [0.83, 0.69, 0, -0.01], maquetteCluster: [1.09, 0.66, 0, 0.01], slabRhythm: [1.06, 0.63, 0.01, -0.01], doodleLoop: [1.04, 0.38, 0, -0.01], solveSquiggle: [0.92, 0.49, -0.01, 0], dotWarp: [0.97, 0.96, -0.01, 0], dotPinch: [0.98, 0.61, 0, -0.01], bendLattice: [1.04, 0.7, -0.02, -0.01], curvedWall: [0.89, 0.54, -0.01, 0], sheetStack: [0.88, 0.76, 0.03, 0.01], tetraWire: [0.88, 0.92, 0, 0], rollingSphere: [0.98, 0.3, 0, -0.01], breathingArcs: [0.87, 0.91, -0.01, 0], dotCompass: [0.63, 0.63, -0.01, 0], shadowSweep: [1.13, 0.65, -0.01, 0.01], mobileBalance: [1.13, 0.75, 0, 0], mSpark: [0.93, 0.93, 0, 0], mSpiral: [0.82, 0.93, -0.06, -0.07], mLoop: [0.85, 0.45, -0.07, -0.03], mSquig: [0.63, 0.85, -0.03, 0.02], mZig: [0.98, 0.64, -0.02, 0], mOrbit: [1.03, 0.49, 0.03, -0.01], mTrail: [0.68, 0.75, 0.01, 0.12], mCube: [0.95, 0.8, 0, 0], mFold: [1.04, 0.64, -0.01, 0.12], mDoodle: [0.48, 1, 0.06, 0.04], mDots: [0.67, 0.44, 0.18, -0.03], mTri: [0.89, 0.84, -0.02, -0.09], mRedraw: [0.62, 0.62, 0, 0], mRing: [1.02, 1.02, 0, 0],
  
    icPencil: [0.72, 0.72, 0.02, -0.02], icRuler: [0.9, 0.7, 0.01, 0], icSetSquare: [0.74, 0.76, -0.01, 0.01], icCompass: [0.75, 0.99, -0.01, -0.02], icScissors: [0.74, 0.85, 0, 0.01], icMagnifier: [0.83, 0.82, 0.03, 0.02], icNotebook: [0.69, 0.83, -0.01, 0.01], icOpenBook: [0.83, 0.69, 0, -0.01], icClosedBook: [0.63, 0.89, 0, 0.03], icLightbulb: [0.94, 0.93, -0.01, -0.03], icRacket: [0.87, 0.88, 0.02, 0.02], icTennisBall: [0.89, 0.74, -0.06, 0], icChaiGlass: [0.69, 0.94, 0, 0], icCoffeeCup: [0.79, 0.93, -0.02, 0], icLaptop: [0.87, 0.74, 0, 0.01], icEraser: [0.83, 0.83, -0.01, 0.06], icTablet: [0.59, 0.82, 0, 0], icPaperPlane: [0.87, 0.82, -0.01, -0.01], icBoat: [0.86, 0.84, 0, 0.04], icCube: [0.77, 0.8, 0, 0], icEye: [0.85, 0.71, 0, -0.07], icHeadSpiral: [0.75, 0.81, 0.05, 0.04], icPuzzle: [0.78, 0.69, 0.03, 0], icKey: [0.8, 0.8, 0.01, 0.01], icInfinity: [0.85, 0.3, -0.01, 0], icRefresh: [0.74, 0.69, 0.01, -0.01], icSparkle: [0.9, 0.93, 0.01, -0.02], icHeadphones: [0.84, 0.8, -0.01, 0.03], icCamera: [0.83, 0.67, 0, 0.03], icPlant: [0.65, 0.86, 0.01, 0.02], icBrush: [0.81, 0.86, -0.02, 0.03], icCloud: [0.81, 0.58, 0.01, 0.03],
  };
  var ROLL = { tennisRacket: 0.95, pencil: -0.5, scaleRuler: -0.35, shapeChevron: -0.5, shapeTri: 0.4, shapeDiamond: 0.3, ipad: 0.3, bookClosed: 0.35 };
  var BOXY = { cubeLine: 1, bookClosed: 1, bookStack: 1, wireVolume: 1, volumeShift: 1, foldedPlanes: 1, kitOfParts: 1, sliceCut: 1, interlockArcs: 1, suspendedPlane: 1 };
  var TUMBLE = {   // amplitudes (rad) of the slow 3D wobble, per class
    hero: [0.08, 0.17, 0.05], flat: [0.15, 0.28, 0.08], box: [0.22, 0.40, 0.11], tiny: [0.55, 0.55, 0.45], long: [0.22, 0.32, 0.10],
  };

  var G = null;                         // built state
  var GEN = -1;                         // cast rotation counter
  var SC = { cv: null, cx: null, w: 0, need: 0 };      // shared scratch canvas (entrance)
  var AN = { cv: null, cx: null, w: 0 };               // analysis canvas
  var WK = { cv: null, cx: null, w: 0 };               // work canvas of the dissolve (copy -> erase mask -> blit)
  var MK = { cv: null, cx: null };                     // erase-mask canvas (texels)
  var P = { s: 100, t: 0, seed: 1, rot: [0, 0, 0], alpha: 1, lw: 0.75 };   // reusable prop parameter object
  var TMP = { x: 0, y: 0 };
  var COLT = new Float64Array(128), PWL = new Float64Array(257), PWX = -1;                    // scratch row of the erase-time field

  // ------------------------------------------------------------------------------------------------ helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function eOut3(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return 1 - (1 - x) * (1 - x) * (1 - x); }
  /** unit step response of an under-damped spring (damping ratio z < 1, natural frequency w rad/s): starts at 0 with zero velocity, overshoots, settles */
  function spring(t, z, w) {
    if (t <= 0) return 0;
    var wd = w * sqrt(1 - z * z), e = exp(-z * w * t);
    return 1 - e * (cos(wd * t) + (z * w / wd) * sin(wd * t));
  }
  function evenCeil(v) { var n = ceil(v); return n + (n & 1); }
  function pxScale() { var S = GA.stage; return (S && S.px) || 1; }
  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function ST() { return GA.style || {}; }
  /** the freehand icons (props_e.js): every registered piece tagged 'icon' (or named icXxx), sorted by name; re-read at every build (the registry may fill in late) */
  function iconNames() {
    var L = GA.props && GA.props.list, out = [], n, d, i, tg, ok;
    if (!L) return out;
    for (n in L) {
      d = L[n]; ok = /^ic[A-Z]/.test(n); tg = d.tags;
      if (tg) for (i = 0; i < tg.length; i++) if (tg[i] === 'icon') ok = true;
      if (ok && !BLACKLIST[n]) out.push(n);
    }
    return out.sort();
  }
  function hasProp(n) { return !!(GA.props && GA.props.list[n]) && !BLACKLIST[n]; }

  // ------------------------------------------------------------------------------------------------ micro marks (15-45 units): the playful scribbles of a busy mind
  /* Cheap vector marks registered as props (mSpark, mSpiral, mLoop, mSquig, mZig, mOrbit, mTrail, mCube, mFold, mDoodle, mDots, mTri, mRedraw, mRing).  Each is a pure
     function of (p.t, p.seed, p.rot, p.s); most of them DRAW THEMSELVES over a few seconds and start again; one path or two per mark. */
  (function microMarks() {
    if (!GA.props || !GA.props.register) return;
    var PI = Math.PI;
    function fr(x) { return x - Math.floor(x); }
    function hs(a, b) { var x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); }
    function es(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); }
    function setup(c, p, wk) { c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = (1.0 + 0.03 * p.s) * (p.lw || 1) * (wk || 1); }
    function reg(name, fn) {
      GA.props.register(name, { draw: function (c, p) { c.save(); setup(c, p); fn(c, p, ST(), p.t || 0, p.s, (p.seed | 0) % 97); c.restore(); }, box: [1, 1], tags: ['micro', 'abstract'] });
    }
    // an asterisk glint that pulses (twinkle)
    reg('mSpark', function (c, p, S, t, s, sd) {
      var per = 1.1 + 0.9 * hs(sd, 1), k = Math.pow(Math.max(0, Math.sin(TAU * t / per + sd)), 2) * 0.75 + 0.25, i, a, L;
      c.rotate((p.rot ? p.rot[2] : 0) + 0.4 * hs(sd, 2)); c.strokeStyle = S.INK; c.globalAlpha *= 0.45 + 0.55 * k; c.beginPath();
      for (i = 0; i < 4; i++) { a = i * PI / 4; L = (i % 2 ? 0.28 : 0.5) * s * k; c.moveTo(-Math.cos(a) * L, -Math.sin(a) * L); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); }
      c.stroke(); c.fillStyle = S.INK; c.beginPath(); c.arc(0, 0, 0.05 * s + 0.5, 0, TAU); c.fill();
    });
    // a spiral that winds itself
    reg('mSpiral', function (c, p, S, t, s, sd) {
      var ph = fr(t / 5.2 + hs(sd, 3)), u = es(Math.min(1, ph / 0.68)), n = 30, i, th, r, m = Math.floor(u * n), dir = sd % 2 ? 1 : -1;
      c.rotate((p.rot ? p.rot[2] : 0) + sd); c.strokeStyle = S.INK; c.globalAlpha *= 1 - es((ph - 0.82) / 0.18); c.beginPath();
      for (i = 0; i <= m; i++) { th = (i / n) * 4.6 * PI; r = 0.48 * s * Math.pow(i / n, 0.85); if (i) c.lineTo(dir * r * Math.cos(th), r * Math.sin(th)); else c.moveTo(0, 0); }
      c.stroke();
      if (m > 1) { th = (m / n) * 4.6 * PI; r = 0.48 * s * Math.pow(m / n, 0.85); c.fillStyle = S.INK; c.beginPath(); c.arc(dir * r * Math.cos(th), r * Math.sin(th), 0.055 * s + 0.6, 0, TAU); c.fill(); }
    });
    // a cursive loop-de-loop
    reg('mLoop', function (c, p, S, t, s, sd) {
      var ph = fr(t / 4.4 + hs(sd, 4)), u = es(Math.min(1, ph / 0.7)), n = 34, i, th, m = Math.floor(u * n), a = 0.052 * s, b = 0.16 * s;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.5 + 0.3 * hs(sd, 5)); c.strokeStyle = S.INK; c.globalAlpha *= 1 - es((ph - 0.84) / 0.16); c.beginPath();
      for (i = 0; i <= m; i++) { th = (i / n) * 2.3 * TAU; var x = a * th - b * Math.sin(th) - 0.4 * s, y = -b * Math.cos(th); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    });
    // a squiggle
    reg('mSquig', function (c, p, S, t, s, sd) {
      var ph = fr(t / 3.6 + hs(sd, 6)), u = es(Math.min(1, ph / 0.62)), n = 26, i, m = Math.floor(u * n), f = 1.5 + hs(sd, 7);
      c.rotate((p.rot ? p.rot[2] : 0) * 0.5 + sd * 0.3); c.strokeStyle = S.INK; c.globalAlpha *= 1 - es((ph - 0.8) / 0.2); c.beginPath();
      for (i = 0; i <= m; i++) { var q = i / n, x = (q - 0.5) * s, y = 0.22 * s * Math.sin(TAU * f * q + sd) * (0.4 + 0.6 * Math.sin(PI * q)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    });
    // a zigzag
    reg('mZig', function (c, p, S, t, s, sd) {
      var ph = fr(t / 3.2 + hs(sd, 8)), u = es(Math.min(1, ph / 0.6)) * 6, i, k = Math.floor(u), f = u - k, px = -0.5 * s, py = 0, nx, ny;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.5 + hs(sd, 9) * 1.2); c.strokeStyle = S.INK; c.globalAlpha *= 1 - es((ph - 0.8) / 0.2); c.beginPath(); c.moveTo(px, py);
      for (i = 0; i < 6 && i <= k; i++) {
        nx = (-0.5 + (i + 1) / 6) * s; ny = (i % 2 ? 0.2 : -0.2) * s * (0.8 + 0.4 * hs(sd, 10 + i));
        if (i === k) { nx = px + (nx - px) * f; ny = py + (ny - py) * f; }
        c.lineTo(nx, ny); px = nx; py = ny;
      }
      c.stroke();
    });
    // a tiny orbit with a satellite
    reg('mOrbit', function (c, p, S, t, s, sd) {
      var ang = (p.rot ? p.rot[2] : 0) + sd, a = t * (0.9 + 0.6 * hs(sd, 11)) + sd;
      c.rotate(ang); c.strokeStyle = S.GRAY1; c.lineWidth *= 0.7; c.beginPath(); c.ellipse(0, 0, 0.48 * s, 0.2 * s, 0, 0, TAU); c.stroke();
      c.fillStyle = S.INK; c.beginPath(); c.arc(0, 0, 0.055 * s + 0.5, 0, TAU); c.fill();
      c.beginPath(); c.arc(0.48 * s * Math.cos(a), 0.2 * s * Math.sin(a), 0.07 * s + 0.6, 0, TAU); c.fill();
    });
    // a dotted trail that streams along an arc
    reg('mTrail', function (c, p, S, t, s, sd) {
      var i, n = 9, k = fr(t * 0.35 + hs(sd, 12)), q, x, y, r;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.5 + sd * 0.7); c.fillStyle = S.INK;
      for (i = 0; i < n; i++) {
        q = fr(i / n + k); x = (q - 0.5) * s; y = -0.3 * s * Math.sin(PI * q); r = (0.02 + 0.07 * q) * s + 0.4;
        c.globalAlpha = 0.25 + 0.75 * q; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
    });
    // a tumbling wire cube (hidden edges ghosted)
    reg('mCube', function (c, p, S, t, s, sd) {
      var ax = (p.rot ? p.rot[0] : 0) + 0.5 + 0.55 * t + sd, ay = (p.rot ? p.rot[1] : 0) + 0.7 + 0.42 * t * (sd % 2 ? 1 : -1), az = (p.rot ? p.rot[2] : 0) * 0.4;
      var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az), V = [], Z = [], i, h = 0.27 * s, x, y, z, y1, z1, x2, z2;
      for (i = 0; i < 8; i++) {
        x = (i & 1 ? h : -h); y = (i & 2 ? h : -h); z = (i & 4 ? h : -h);
        y1 = y * cx - z * sx; z1 = y * sx + z * cx; x2 = x * cy + z1 * sy; z2 = -x * sy + z1 * cy;
        V.push([x2 * cz - y1 * sz, x2 * sz + y1 * cz]); Z.push(z2);
      }
      var E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], zs = Z.slice().sort(function (a, b) { return a - b; }), zm = (zs[3] + zs[4]) / 2, e, pass;
      for (pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (i = 0; i < 12; i++) { e = E[i]; if (((Z[e[0]] + Z[e[1]]) / 2 < zm) === (pass === 0)) { c.moveTo(V[e[0]][0], V[e[0]][1]); c.lineTo(V[e[1]][0], V[e[1]][1]); } }
        if (pass === 0) { c.strokeStyle = S.GRAY3; c.lineWidth *= 0.7; } else { c.strokeStyle = S.INK; c.lineWidth *= 1.15; }
        c.stroke();
      }
    });
    // a folded paper strip
    reg('mFold', function (c, p, S, t, s, sd) {
      var i, n = 5, w = 0.2 * s, a = 0.1 * s * Math.sin(t * 0.9 + sd), x0 = -0.5 * s;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.5 + 0.4 * Math.sin(sd));
      for (i = 0; i < n; i++) {
        var xa = x0 + i * w, xb = xa + w, ya = (i % 2 ? 0.11 : -0.07) * s + (i % 2 ? a : -a), yb = (i % 2 ? -0.07 : 0.11) * s + (i % 2 ? -a : a), hgt = 0.2 * s;
        c.beginPath(); c.moveTo(xa, ya); c.lineTo(xb, yb); c.lineTo(xb, yb + hgt); c.lineTo(xa, ya + hgt); c.closePath();
        c.fillStyle = i % 2 ? S.GRAY4 : S.PAPER; c.fill(); c.strokeStyle = S.INK; c.stroke();
      }
    });
    // a pencil doodle that draws itself
    reg('mDoodle', function (c, p, S, t, s, sd) {
      var ph = fr(t / 6.5 + hs(sd, 13)), u = Math.min(1, ph / 0.75), i, k, n = 18, tot = 3 * n, m = Math.floor(es(u) * tot), cxk, cyk, rk, q, x, y;
      c.rotate(hs(sd, 14) * 1.5); c.strokeStyle = S.INK; c.globalAlpha *= 1 - es((ph - 0.86) / 0.14); c.beginPath();
      for (k = 0; k < 3; k++) {
        cxk = (hs(sd, 20 + k) - 0.5) * 0.4 * s; cyk = (hs(sd, 30 + k) - 0.5) * 0.3 * s; rk = (0.16 + 0.12 * hs(sd, 40 + k)) * s;
        for (i = 0; i <= n; i++) {
          if (k * n + i > m) break;
          q = i / n; x = cxk + rk * Math.cos(TAU * (0.9 * q) + k * 2) * (1 + 0.3 * q); y = cyk + rk * 0.8 * Math.sin(TAU * (0.9 * q) + k * 2) * (1 - 0.2 * q);
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
      }
      c.stroke();
    });
    // a constellation of dots with hairlines
    reg('mDots', function (c, p, S, t, s, sd) {
      var i, n = 5, X = [], Y = [], pulse = (Math.floor(t * 0.7 + sd) % n);
      for (i = 0; i < n; i++) { X.push((hs(sd, 50 + i) - 0.5) * 0.9 * s); Y.push((hs(sd, 60 + i) - 0.5) * 0.7 * s); }
      c.strokeStyle = S.GRAY2; c.lineWidth *= 0.6; c.beginPath(); c.moveTo(X[0], Y[0]);
      for (i = 1; i < n; i++) c.lineTo(X[i], Y[i]);
      c.stroke(); c.fillStyle = S.INK;
      for (i = 0; i < n; i++) { c.beginPath(); c.arc(X[i], Y[i], (0.04 + 0.04 * hs(sd, 70 + i) + (i === pulse ? 0.04 * (0.5 + 0.5 * Math.sin(t * 6)) : 0)) * s + 0.5, 0, TAU); c.fill(); }
    });
    // nested triangles redrawn one after another (iteration)
    reg('mTri', function (c, p, S, t, s, sd) {
      var st = fr(t / 5 + hs(sd, 80)) * 3.6, k, j, r, a, f, full;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.4);
      for (k = 0; k < 3; k++) {
        if (st < k) break;
        f = Math.min(1, st - k); r = 0.5 * s * (1 - 0.18 * k); a = k * 0.3 + sd * 0.2; full = st >= k + 1;
        c.strokeStyle = k === 2 ? S.INK : k === 1 ? S.GRAY1 : S.GRAY2; c.lineWidth = Math.max(0.8, c.lineWidth * (k === 2 ? 1 : 0.7)); c.beginPath();
        for (j = 0; j <= 3; j++) {
          if (j > 3 * f + 1e-6 && !full) { var q = 3 * f - (j - 1); if (q > 0) c.lineTo(r * Math.cos(a + (j - 1) * TAU / 3) + (r * Math.cos(a + j * TAU / 3) - r * Math.cos(a + (j - 1) * TAU / 3)) * q, r * Math.sin(a + (j - 1) * TAU / 3) + (r * Math.sin(a + j * TAU / 3) - r * Math.sin(a + (j - 1) * TAU / 3)) * q); break; }
          if (j) c.lineTo(r * Math.cos(a + j * TAU / 3), r * Math.sin(a + j * TAU / 3)); else c.moveTo(r * Math.cos(a), r * Math.sin(a));
        }
        c.stroke();
      }
    });
    // a square sketched three times, converging
    reg('mRedraw', function (c, p, S, t, s, sd) {
      var st = fr(t / 5.5 + hs(sd, 90)) * 3.5, k, r, a, f, i, q, j;
      c.rotate((p.rot ? p.rot[2] : 0) * 0.3 + 0.1 * Math.sin(sd));
      for (k = 0; k < 3; k++) {
        if (st < k) break;
        f = Math.min(1, st - k); r = (0.5 - 0.04 * k) * s; a = (0.2 - 0.1 * k) * (sd % 2 ? 1 : -1);
        c.strokeStyle = k === 2 ? S.INK : S.GRAY3; c.lineWidth = Math.max(0.9, c.lineWidth * (k === 2 ? 1.2 : 0.8)); c.beginPath();
        for (i = 0; i <= 4 * f + 1e-6 && i <= 4; i++) { q = Math.min(i, 4 * f); j = Math.floor(q); var ax = a + j * PI / 2 + PI / 4, bx = a + (j + 1) * PI / 2 + PI / 4, tf = q - j, px = r * 0.7 * Math.cos(ax), py = r * 0.7 * Math.sin(ax), qx = r * 0.7 * Math.cos(bx), qy = r * 0.7 * Math.sin(bx); if (i) c.lineTo(px + (qx - px) * tf, py + (qy - py) * tf); else c.moveTo(px, py); }
        c.stroke();
      }
    });
    // a little dial
    reg('mRing', function (c, p, S, t, s, sd) {
      var i, a = t * 0.5 + sd, n = 12;
      c.strokeStyle = S.INK; c.beginPath(); c.arc(0, 0, 0.3 * s, 0, TAU); c.stroke();
      c.lineWidth *= 0.7; c.strokeStyle = S.GRAY1; c.beginPath();
      for (i = 0; i < n; i++) { var q = a + i * TAU / n; c.moveTo(0.38 * s * Math.cos(q), 0.38 * s * Math.sin(q)); c.lineTo((i % 3 ? 0.44 : 0.5) * s * Math.cos(q), (i % 3 ? 0.44 : 0.5) * s * Math.sin(q)); }
      c.stroke(); c.fillStyle = S.INK; c.beginPath(); c.arc(0.3 * s * Math.cos(a * 2), 0.3 * s * Math.sin(a * 2), 0.06 * s + 0.6, 0, TAU); c.fill();
    });
  })();

  // ------------------------------------------------------------------------------------------------ flow clock
  /** "flow" = the clock that drives every orbit: runs faster with the swirl's intensity and surges in the last 1.6 s before the (nominal) hit */
  /** k (seconds after turnFront1) of loop time t, and back (G.actOff = tStart - turnFront1, G.kScale = the host's thinking span / the landing page's) */
  function kOf(t) { return G.actOff + (t - G.tStart) / G.kScale; }
  function tOfK(k) { return G.tStart + (k - G.actOff) * G.kScale; }
  function flowRate(t) {
    var k = kOf(t), r = 0.52 + 0.36 * sstep(ACT.II - 0.8, ACT.II + 1.8, k) + 0.57 * sstep(ACT.III - 0.6, ACT.III + 3.6, k);   // the acts: I calm (0.52), II lively (0.88), III busy (1.45)
    r *= 1 + CFG.SURGE * sstep(G.tNom - 2.5, G.tNom, t);                             // act IV, the funnel: everything speeds up in the last 2.5 s
    r *= 1 - 0.5 * sstep(G.tNom, G.tNom + 0.9, t);
    return r;
  }
  function buildFlow() {
    var n = floor((G.tNom + 6 - (G.tStart - 1)) * 60) + 2, tab = new Float64Array(n), t0 = G.tStart - 1, r0 = flowRate(t0), acc = 0, prev = r0;
    for (var i = 1; i < n; i++) { var r = flowRate(t0 + i / 60); acc += 0.5 * (prev + r) / 60; tab[i] = acc; prev = r; }
    G.ft0 = t0; G.fn = n; G.ftab = tab; G.fr0 = r0; G.fr1 = prev;
  }
  function rint(t) {
    var u = (t - G.ft0) * 60;
    if (u <= 0) return G.fr0 * (t - G.ft0);
    var i = u | 0;
    if (i >= G.fn - 1) return G.ftab[G.fn - 1] + G.fr1 * (t - G.ft0 - (G.fn - 1) / 60);
    return G.ftab[i] + (G.ftab[i + 1] - G.ftab[i]) * (u - i);
  }

  // ------------------------------------------------------------------------------------------------ orbit + pose
  /** position on the item's tilted ellipse at flow value R (planning + runtime share this) */
  function orbitXY(it, R, t, out) {
    var phi = it.phi0 + G.dir * it.sg * it.w * (R - it.R0), sp = sin(phi), cp = cos(phi), fs = sstep(G.tNom - 2.6, G.tNom - 0.4, t), f = 1 - CFG.FUNNEL * fs;   // act IV: the funnel pulls everything in towards her head
    var ex = it.a * f * (1 + 0.04 * sin(0.33 * t + it.p1)) * cp, ey = it.b * f * (1 + 0.05 * sin(0.27 * t + it.p2)) * sp;
    out.x = G.cx + it.ox * f + ex * it.ct - ey * it.st;
    out.y = G.cy + it.oy + ex * it.st + ey * it.ct - (it.oy + CFG.FUNNEL_LIFT) * (1 - f);
    out.zn = sp;
    return out;
  }
  /** full pose of an item at time t (R = flow value at t) */
  function poseInto(it, t, R, o) {
    orbitXY(it, R, t, o);
    var x0 = o.x, y0 = o.y;
    if (it.swA) {                                                                         // an occasional swoop: the piece loops in towards her (behind her) and back out
      var q = (t - it.tp) / it.swP + it.swPh; q -= floor(q);
      if (q < it.swD) { var s2 = sin(Math.PI * q / it.swD), f = 1 - it.swA * s2 * s2; x0 = G.cx + (x0 - G.cx) * f; y0 = G.cy + (y0 - G.cy) * f; }
    }
    if (it.dtA) {                                                                         // a quick flick: a short dart across the cloud and back
      var q2 = (t - it.tp) / it.dtP + it.dtPh; q2 -= floor(q2);
      if (q2 < it.dtD) {
        var s3 = sin(Math.PI * q2 / it.dtD); s3 *= s3;
        if (it.dtRad) { var rdx = x0 - G.cx, rdy = y0 - G.cy, rl = hypot(rdx, rdy) || 1; x0 += rdx / rl * it.dtRad * s3; y0 += rdy / rl * it.dtRad * s3; } else { x0 += it.dtX * s3; y0 += it.dtY * s3; }
      }
    }
    var bw = it.wob * (1 + 0.9 * sstep(G.tNom - 2.5, G.tNom, t));                         // bob / wobble: larger for the small pieces, stronger in the crescendo
    var x = x0 + bw * (10 * sin(0.83 * t + it.p3) + 4 * sin(2.3 * t + it.p5)), y = y0 + bw * (12 * sin(1.17 * t + it.p4) + 5 * sin(2.9 * t + it.p6)), zn = o.zn;
    var age = t - it.tp, dt = t - G.shockT, enter = age < it.enter ? (1 - spring(age, 0.9, 5.5)) * (1 - sstep(it.enter * 0.6, it.enter, age)) : 0, swell = 0;
    if (enter !== 0) { x += (G.hx - x) * it.glide * enter; y += (G.hy - y) * it.glide * enter; }   // glides out of her head on a soft spring
    if (dt > 0) {
      if (t < it.t0) {                                                                    // anticipation: a soft shiver, a small inhale, then a swell
        var tr = 1.5 * sstep(0, 0.12, dt) * (1 - sstep(it.t0 - 0.12, it.t0, t)), u = clamp((t - (it.t0 - 0.24)) / 0.24, 0, 1);
        x += tr * sin(44 * t + it.p5); y += tr * cos(37 * t + it.p6);
        swell = 0.05 * sstep(0.45, 1, u) - 0.028 * sstep(0, 0.5, u) * (1 - sstep(0.5, 1, u));
      } else {
        var g = 1 - exp(-(t - it.t0) / 0.4);                                              // blown outward a little while it dissolves
        x += it.ux * 70 * g; y += it.uy * 70 * g;
        swell = 0.05;                                                                    // (held: the dissolving item keeps its size, the bitmap cache is translated only)
      }
    }
    o.x = x; o.y = y; o.zn = zn;
    o.sc = it.sc0 > 0 && t >= it.t0 ? it.sc0 : (1 + CFG.PERSP * zn) * (1 + it.br * sin(0.9 * t + it.p7)) * (1 + swell) * (1 - CFG.FUNNEL_SHRINK * sstep(G.tNom - 2.6, G.tNom - 0.4, t));   // (act IV: sucked in, a little smaller)
    o.da = min(1, (1 - CFG.DEPTH_ALPHA * sstep(0.1, -1, zn)) * it.dla * (1 + 0.05 * sin(1.3 * t + it.p6)));   // far = a little lighter; gentle breathing of the alpha
    var ph = R * 0.9;
    o.rx = it.rx0 + it.ax * sin(ph * it.f1 + it.q1);
    o.ry = it.ry0 + it.ay * sin(ph * it.f2 + it.q2);
    o.rz = it.rz0 + it.az * sin(ph * it.f3 + it.q3) + it.rzr * (t - it.tp) + it.spin * enter;
    o.pt = (t - it.tp) + it.pt0;                                                          // (pieces that animate over time start their story when they pop)
    return o;
  }

  // ------------------------------------------------------------------------------------------------ cast / schedule / items
  function detectDir(swirl, cx, cy, t) {
    // orbit direction of the swirl's lines around the vortex centre: -1 = counter-clockwise on screen (y down), +1 = clockwise
    try {
      if (!swirl || !swirl.track || !swirl.armCount) return -1;
      var n = swirl.armCount(), sum = 0, cnt = 0, us = [0.12, 0.25, 0.4];
      for (var i = 0; i < n; i += 2) for (var k = 0; k < us.length; k++) {
        var a = swirl.track(i, us[k], t), b = swirl.track(i, us[k], t + 0.2);
        if (!a.grown || !b.grown) continue;
        var d = atan2(b.y - cy, b.x - cx) - atan2(a.y - cy, a.x - cx);
        d = U.mod(d + Math.PI, TAU) - Math.PI;
        sum += d; cnt++;
      }
      if (!cnt || abs(sum) < 1e-4) return -1;
      return sum > 0 ? 1 : -1;
    } catch (e) { return -1; }
  }

  /** the slots of a cast with their prop names resolved (missing / blacklisted names replaced by the next unused piece of the fallback rings) */
  function selectCast(W, gen) {
    var cast = CASTS[((gen % CASTS.length) + CASTS.length) % CASTS.length], used = {}, ctr = {}, fb = { D: gen * 5, B: 0, C: 0, R: 0, X: 0, T: 0, M: gen * 3, F: 0, I: 0 }, i, n, j = 0;
    var rng = U.rng(G.seed * 53 + gen * 11 + 7);
    function nameFor(kind) {
      var list = cast[kind], want, key = kind === 'A' || kind === 'H' || kind === 'S' ? 'D' : kind, ring = RINGS[key], k, rep = kind === 'B' || kind === 'M' || kind === 'F' || kind === 'I';
      ctr[kind] = (ctr[kind] || 0) + 1; want = list ? list[ctr[kind] - 1] : undefined;
      if (want && hasProp(want) && (rep || !used[want])) { used[want] = 1; return want; }
      if (want && !hasProp(want) && G.info.missing.indexOf(want) < 0) G.info.missing.push(want);
      for (k = 0; k < ring.length; k++) { n = ring[(fb[key] + k) % ring.length]; if (hasProp(n) && (rep || !used[n])) { used[n] = 1; fb[key] += k + 1; return n; } }
      return null;
    }
    function ent(sl, name, extra) {
      var e = { n: name, k: sl.k, rf: clamp(sl.rf, CFG.RF_MIN, CFG.RF_MAX), th: sl.th * Math.PI / 180, cw: sl.cw || 1, v: sl.k === 'B' && cast.Bv && cast.Bv[ctr.B - 1] !== undefined ? cast.Bv[ctr.B - 1] : sl.v, size: sl.s * (SIZE_UP_K[sl.k] || CFG.SIZE_UP) * (SIZE_K[name] || 1), dl: sl.dl || 0, kt: 0, u: 0 };
      if (extra) for (var k in extra) e[k] = extra[k];
      return e;
    }
    var heavy = [], light = [], bursts = [], sl, name, kind, q;
    for (i = 0; i < HEAVY.length; i++) { sl = HEAVY[i]; name = nameFor(sl.k); if (name) heavy.push(ent(sl, name)); }
    for (i = 0; i < HOBBY.length; i++) { sl = HOBBY[i]; name = nameFor(sl.k); if (name) light.push(ent(sl, name, { u: 0.12 + 0.2 * i + 0.1 * (i & 1) })); }
    function golden(jj) { return { th: (20 + jj * 137.508) % 360, rf: 0.37 + 0.56 * Math.sqrt((jj * 0.7548776662 + 0.31) % 1) }; }
    var DLP = [-1, 0, 0, 1, -1, 0, -1, 0, 1, 0];
    var icons = iconNames().filter(function (n2) { return !ICON_EXCLUDE[n2]; }), iconPick = [], ii, seen = {}, nm, order = ICON_ORDER.filter(function (n2) { return hasProp(n2) && !ICON_EXCLUDE[n2]; }), c4 = ((gen % 4) + 4) % 4;
    for (ii = 0; ii < icons.length; ii++) if (order.indexOf(icons[ii]) < 0) order.push(icons[ii]);          // (icons that are not in the mixed order go to the end)
    for (ii = 0; ii < order.length && iconPick.length < CFG.ICONS; ii++) { nm = order[(c4 * 5 + ii) % order.length]; if (!seen[nm]) { seen[nm] = 1; iconPick.push(nm); } }
    G.info.icons = iconPick.slice();
    var iconCtr = 0;
    for (kind in LIGHT_COUNT) {
      for (q = 0; q < LIGHT_COUNT[kind]; q++, j++) {
        if (kind === 'N') { name = iconPick[iconCtr++]; if (!name) continue; used[name] = 1; }
        else name = nameFor(kind);
        if (!name) continue;
        var g = golden(j), sz = kind === 'T' ? rng.range(56, 92) : kind === 'I' ? rng.range(30, 56) : kind === 'N' ? CFG.ICON_SZ[0] + (CFG.ICON_SZ[1] - CFG.ICON_SZ[0]) * ((q * 0.6180339887 + 0.17 * (gen % 4)) % 1) : rng.range(18, 44);
        light.push(ent({ k: kind, rf: g.rf, th: g.th, s: sz, dl: DLP[j % 10], cw: kind === 'M' && j % 6 === 5 ? -1 : 1 }, name, { u: (q + 0.5) / LIGHT_COUNT[kind] }));
      }
    }
    light.sort(function (a, b) { return a.u - b.u; });
    // ---- THE ACT SCHEDULE (k = seconds after turnFront1, see ACT / BEAT).  Heroes one at a time in act I; in act II every hero and every supporting piece gets a
    //      SATELLITE (a small piece beside it, same orbit speed / sense / depth layer: a group), books and hobbies in between; the remaining small pieces swarm in
    //      during act III with accelerating gaps; bulbs and fireworks at the sync beats.
    function byKind(list, ks) { var o = []; for (var q2 = 0; q2 < list.length; q2++) if (ks.indexOf(list[q2].k) >= 0) o.push(list[q2]); return o; }
    var heroes = byKind(heavy, 'AH'), sups = byKind(heavy, 'S'), books = byKind(heavy, 'B'), chai = byKind(heavy, 'C');
    var tl = byKind(light, 'T'), ml = byKind(light, 'M'), il = byKind(light, 'I'), nl = byKind(light, 'N'), rl = byKind(light, 'R'), xl = byKind(light, 'X');
    function at(list, ks, step) { for (var q2 = 0; q2 < list.length; q2++) list[q2].kt = q2 < ks.length ? ks[q2] : ks[ks.length - 1] + (step || 0.4) * (q2 - ks.length + 1); }
    at(heroes, BEAT.hero, 0.6); at(sups, BEAT.S, 0.68); at(books, BEAT.B, 0.7); at(chai, BEAT.C, 0.7); at(rl, BEAT.R, 0.7); at(xl, BEAT.X, 0.7); at(il, BEAT.bulb, 1.5);
    for (i = 0; i < il.length; i++) { il[i].life = BEAT.bulbLife; il[i].churn = false; }
    if (il.length) { il[0].rf = 0.44; il[0].th = -62 * Math.PI / 180; il[0].dl = 0; il[0].cw = 1; il[0].size *= 1.35; }                        // the first idea lights up beside her head
    var sparks = ml.splice(0, min(2, ml.length)); at(sparks, BEAT.spark, 0.5);
    for (i = 0; i < sparks.length; i++) sparks[i].churn = false;
    function mate(en, lead, k) {                                                                   // a satellite: beside its leader, same depth layer / sense / (later) orbit speed
      en.leader = lead; en.kt = k; en.dl = lead.dl; en.cw = lead.cw; en.churn = 'mate';
      en.th = lead.th + rng.sign() * rng.range(28, 42) * Math.PI / 180; en.rf = clamp(lead.rf + rng.range(-0.1, 0.12), CFG.RF_MIN, CFG.RF_MAX);
    }
    var leaders = heroes.concat(sups), pick = [nl, ml, tl], pi = 0, cand, lead, en;
    for (i = 0; i < leaders.length; i++) {
      lead = leaders[i];
      if (i < heroes.length) cand = nl.length ? nl : ml.length ? ml : tl;                           // the heroes get icons
      else { cand = null; for (q = 0; q < 3 && !cand; q++) { var lst = pick[(pi + q) % 3]; if (lst.length) cand = lst; } pi++; }
      if (!cand || !cand.length) break;
      en = cand.shift();
      mate(en, lead, i < heroes.length ? BEAT.heroMate[min(i, BEAT.heroMate.length - 1)] : lead.kt + rng.range(BEAT.mateLag[0], BEAT.mateLag[1]));
    }
    // the swarm (act III): the rest, kinds interleaved, accelerating gaps, a few pops in bursts of 2-3 and a few stragglers
    var swarm = [], lists = [nl, tl, ml], li = 0, guard = 0;
    while ((nl.length || tl.length || ml.length) && guard++ < 200) { var L2 = lists[li % 3]; li++; if (L2.length) swarm.push(L2.shift()); }
    var nsw = swarm.length, g0 = BEAT.swarmGap[0], g1 = BEAT.swarmGap[1], acc = 0, gaps = [];
    for (i = 0; i < nsw; i++) { gaps.push(g0 + (g1 - g0) * i / max(1, nsw - 1)); acc += gaps[i]; }
    var kk = BEAT.swarm[0], span = (BEAT.swarm[1] - BEAT.swarm[0]) / max(1e-3, acc);
    for (i = 0; i < nsw; i++) { swarm[i].kt = kk; kk += gaps[i] * span; }
    for (i = 1; i < nsw - 2; i++) {
      if ((i * 7 + 3) % 5 === 0) { swarm[i + 1].kt = swarm[i].kt + 0.05; swarm[i + 2].kt = swarm[i].kt + 0.11; i += 2; }
      else if ((i * 11 + 1) % 9 === 0) swarm[i].kt += 0.3;
    }
    var seq = heavy.concat(light);
    seq.sort(function (a, b) { return a.kt - b.kt || (a.u || 0) - (b.u || 0); });
    // fireworks: one-shot bursts at seeded polar positions: the 5 sync bursts (big, mid layer) and the smaller extras of the overload / the funnel
    var nb = clamp(round(CFG.BURSTS * pow(W / 2773, 0.9)), 4, CFG.BURSTS), fk = BEAT.fw.concat(BEAT.fwExtra);
    for (i = 0; i < nb && i < fk.length; i++) {
      name = nameFor('F'); if (!name) continue;
      var gb = golden(j++), per = GA.props.list[name] && GA.props.list[name].period, sync = i < BEAT.fw.length;
      bursts.push(ent({ k: 'F', rf: 0.45 + 0.47 * Math.sqrt((gb.rf - 0.37) / 0.56), th: gb.th, s: sync ? rng.range(128, 165) : rng.range(95, 120), dl: sync ? 0 : DLP[j % 10] }, name, { kt: fk[i], sync: sync, life: clamp(per || 2.4, 1.4, 3.4) }));
    }
    function twin(en) {                                                                                  // the same kind of piece re-enters at another slot (another radius, angle and depth layer)
      var g = golden(j++), e = {}, k;
      for (k in en) e[k] = en[k];
      e.rf = clamp(g.rf, CFG.RF_MIN, CFG.RF_MAX); e.th = g.th * Math.PI / 180; e.dl = DLP[j % 10]; e.life = undefined; e.size = en.size * rng.range(0.85, 1.15); e.cw = (j % 5 === 0) ? -1 : 1;
      e.leader = undefined; e.item = undefined; e.churn = false;                                       // (a twin is free: no group, no further twin)
      return e;
    }
    G.info.cast = cast.name;
    var keepN = clamp(round(seq.length * pow(W / 2773, 0.9)), 14, seq.length);       // narrow stages: fewer pieces (the opening ones always stay)
    return { seq: seq.slice(0, keepN), bursts: bursts, twin: twin };
  }

  /** pop times of the entries in pop order: every gap is weighted by the kind (heroes slow, small marks quick) and shrinks towards the end; scaled to fill [tA, tB];
      pieces that wipe in are never closer than MIN_POP_GAP (at most two wipes at a time) */
  function variantSeed(seed, v) { return v === undefined ? seed : seed - (seed % 6) + v; }
  var KINDS = {
    A: { hero: 1, heavy: 1, wipe: 1, knock: 1, spr: 1, enter: 1.5 }, H: { hero: 1, heavy: 1, wipe: 1, knock: 1, spr: 1, enter: 1.5 },
    S: { heavy: 1, wipe: 1, knock: 1, spr: 1, enter: 1.1 }, B: { heavy: 1, life: 1, spr: 1, enter: 0.9 },
    C: { heavy: 1, life: 1, spr: 1, enter: 0.9 }, R: { life: 1, spr: 1, enter: 0.9 }, X: { life: 1, spr: 1, enter: 0.9 },
    T: { tiny: 1, spr: 1, enter: 0.9 }, N: { tiny: 1, spr: 1, t0: 1, enter: 0.8 }, M: { tiny: 1, spr: 1, enter: 0.7 }, F: { tiny: 1, burst: 1, spr: 1, enter: 0.5 }, I: { tiny: 1, spr: 1, enter: 0.7 },
  };
  var FAST_SPR = { bookFlip: 1, bookOpen: 1, chaiGlass: 1, tennisBall: 1 };
  function makeItem(en, idx, ts, sizeK, rng) {
    var K = KINDS[en.k] || KINDS.S, def = GA.props.list[en.n], box = def.box || [1, 0.8], hero = !!K.hero, ink = INK[en.n] || [box[0], box[1], 0, 0], dl = en.dl | 0;
    var size = en.size * sizeK * CFG.DL_SZ[dl + 1]; if (hero) size = min(size, HERO_MAX * sizeK); var s = size / Math.max(ink[0], ink[1]);                      // the slot's size = the longest VISIBLE side
    if (hero && ink[1] * s > 0.9 * size) s *= 0.9 * size / (ink[1] * s);                    // square-ish heroes: limit the height
    var bw = ink[0] * s, bh = ink[1] * s, Lw = bw * 1.45 + 24, Lh = bh * 1.45 + 24;     // working region (centred on the INK centre): ink 90th percentile + tumble + entrance overshoot
    var life = !!K.life, tiny = !!K.tiny, heavy = !!K.heavy, burst = !!K.burst;
    var cls = hero ? 'hero' : tiny ? 'tiny' : en.n === 'tennisRacket' || en.n === 'pencil' ? 'long' : BOXY[en.n] ? 'box' : 'flat';
    var rfw = clamp((en.rf - 0.3) / 0.65, 0, 1), wBase = (CFG.W_IN - (CFG.W_IN - CFG.W_OUT) * rfw) * (en.cw < 0 ? CFG.COUNTER_K : 1) * CFG.DL_W[dl + 1] * (hero ? CFG.HERO_W_K : en.k === 'S' ? 1.15 : 1);
    var amp = TUMBLE[cls], rest = ROLL[en.n] !== undefined ? ROLL[en.n] : rng.range(-0.12, 0.12), rz0 = rest + rng.range(-0.05, 0.05), cz = abs(cos(rz0)), sz = abs(sin(rz0));
    var life_ = G.tNom - ts, per = en.life !== undefined ? en.life : Infinity, swoop = dl < 0 && (en.k === 'M' || en.k === 'T' || en.k === 'S' || en.k === 'N' || en.k === 'I');
    var bc = en.k === 'B' || en.k === 'C', wob = hero ? rng.range(0.8, 1.2) : heavy ? rng.range(0.9, 1.5) : rng.range(0.9, 2.0), spd = hero || bc ? rng.range(0.9, 1.1) : heavy ? rng.range(0.8, 1.4) : rng.range(0.6, 1.9);
    wBase *= spd; if (heavy && !hero) wBase = min(wBase, 0.115);                            // (the big supporting pieces and books never sweep faster than this: they would run through her column)
    var dartFar = !heavy && !burst && dl < 0 && en.rf <= 0.72, dartMid = !heavy && !burst && dl === 0 && en.rf <= 0.6, tk = hero ? 1 : 1.5;
    if (en.k === 'N') { rest = rng.range(-0.45, 0.45); rz0 = rest; cz = abs(cos(rz0)); sz = abs(sin(rz0)); }                          // the icons roll more
    var it = {
      name: en.n, role: life ? 'L' : tiny ? 'A' : 'D', hero: hero, kind: en.k, sync: !!en.sync, def: def, idx: idx, small: tiny, s: s, bw: bw, bh: bh, seed: variantSeed(rng.int(1, 9999), en.v), ts: ts,
      heavy: heavy, light: !heavy, mstep: heavy ? 1 : 2, useWipe: !!K.wipe, spr: !!K.spr, fast: !!FAST_SPR[en.n], sprite: null, shd: heavy, dl: dl, dla: CFG.DL_ALPHA[dl + 1], life: per, m1: 0,
      wob: wob, bobMax: wob * 32, noBehind: bc, dtA: dartFar || dartMid ? 1 : 0, dtP: rng.range(3.6, 6.4), dtPh: rng.range(0, 1), dtD: 0.075, dtX: dartFar ? rng.sign() * rng.range(55, 85) : 0, dtY: dartFar ? rng.range(-25, 25) : 0, dtRad: dartMid ? rng.range(35, 55) : 0,
      swA: swoop ? rng.range(0.28, 0.5) : 0, swP: rng.range(3.6, 6.2), swPh: rng.range(0, 1), swD: 0.38,
      popR: 1.3 * min(0.52 * hypot(bw, bh) * 1.15, CFG.POP_R) + 6, rf: en.rf, th: en.th, sg: en.cw, wBase: wBase, gwFar: bc ? CFG.GIRL_HW : heavy ? CFG.GIRL_FAR_HW : 85, gg: heavy ? CFG.GIRL_GAP : 12,
      home: { x: G.cx + en.rf * G.rx * cos(en.th), y: G.cy + en.rf * G.ry * sin(en.th) },
      alpha: (bc ? 1 : life ? rng.range(CFG.LIFE_ALPHA[0], CFG.LIFE_ALPHA[1]) : en.k === 'N' ? 0.9 : en.k === 'M' ? 0.82 : en.k === 'T' ? 0.92 : 1), lwm: (life ? CFG.LIFE_LW * (bc ? 1.15 : 0.9) : hero ? CFG.HERO_LW : tiny ? 1 : CFG.SUP_LW) * CFG.DL_LW[dl + 1] * (LW_K[en.n] || 1),
      tp: ts, comfort: hero ? CFG.COMFORT + 6 : en.k === 'S' ? CFG.COMFORT - 4 : en.k === 'B' ? 46 : en.k === 'C' ? 40 : 8, br: hero ? 0.03 : heavy ? 0.026 : 0.045, knock: !!K.knock, age: 0, rotF: 0, kn: null, fieldOK: false,
      enter: K.enter || 1, wipeT: hero ? 0.9 : 0.55, pz: null, sz: hero ? 0.74 : K.wipe ? rng.range(0.5, 0.64) : rng.range(0.34, 0.55), sw: hero ? 7 : K.wipe ? 11 : rng.range(11, 18), glide: burst ? 0 : idx < 3 ? CFG.GLIDE_FIRST : CFG.GLIDE,
      ex: 0.5 * (bw * cz + bh * sz) * 1.04, ey: 0.5 * (bw * sz + bh * cz) * 1.04,
      ocx: ink[2], ocy: ink[3], diag: hypot(bw, bh), Lw: Lw, Lh: Lh, L: max(Lw, Lh), gw: hero ? CFG.HERO_GIRL_HW : heavy ? CFG.GIRL_HW : 100, sc0: 0,
      rx0: rng.range(-0.08, 0.08) * (hero ? 0.6 : 1.5), ry0: rng.range(-0.18, 0.18) * (hero ? 0.6 : 1), rz0: rz0,
      ax: amp[0] * tk * rng.range(0.8, 1.2), ay: amp[1] * tk * rng.range(0.8, 1.2), az: amp[2] * tk * rng.range(0.8, 1.2),
      f1: rng.range(0.35, 0.6), f2: rng.range(0.28, 0.5), f3: rng.range(0.25, 0.45),
      q1: rng.range(0, TAU), q2: rng.range(0, TAU), q3: rng.range(0, TAU),
      rzr: rng.range(-0.025, 0.025) * (tiny ? 6 : hero ? 0.4 : 2), spin: rng.sign() * rng.range(0.6, 1.0) * (hero ? 0.3 : 1),
      p1: rng.range(0, TAU), p2: rng.range(0, TAU), p3: rng.range(0, TAU), p4: rng.range(0, TAU), p5: rng.range(0, TAU), p6: rng.range(0, TAU), p7: rng.range(0, TAU),
      pt0: burst || K.t0 || en.k === 'I' ? 0.04 : hero ? 0.2 : rng.range(0, 40), wipe: rng.range(0, TAU), pa: rng.range(0, TAU),   // (bursts, icons and bulbs start their story at their pop: the bulb lights up on its beat)
      // orbit (filled by the planner)
      a: 500, b: 250, tilt: 0, ct: 1, st: 0, ox: 0, oy: 0, phi0: 0, w: 0.12, R0: 0, dRm: 0,
      // preparation + dissolve state
      ready: false, anStage: 0, an: null, anTmp: null, Ts: burst ? [ts + 0.22 * per, ts + 0.42 * per, ts + 0.62 * per] : K.t0 ? [ts + 1.0, ts + 1.3, ts + 1.6] : [ts + 0.3 * life_, ts + 0.65 * life_, G.tNom + 0.2],
      mw: 0, mh: 0, mN: null, mHas: null, cache: null, ccN: 0, ccU: null, ccV: null, ccS: null, ccI: null, dsN: 0, dsU: null, dsV: null, dsS: null,
      dead: false, t0: Infinity, dur: 0.6, fade: CFG.SOFT, tEnd: Infinity, ux: 0, uy: -1, hdx: 0, hdy: 1, mT: null, mImg: null, mU32: null, bx0: 0, by0: 0, bx1: 0, by1: 0,
      pose: { x: 0, y: 0, zn: 0, sc: 1, da: 1, rx: 0, ry: 0, rz: 0, pt: 0 }, front: false, vis: false, zd: 0,
    };
    it.R0 = rint(ts);
    it.dRm = rint(ts + 0.5 * min(per, G.tNom + 0.3 - ts)) - it.R0;
    if (en.leader && en.leader.item) {                                                       // a SATELLITE: it rides its leader's orbit (speed, sense, phase offset: a group that stays together), no swoops / darts of its own
      var ld = en.leader.item; it.lead = ld; it.wBase = ld.wBase; it.sg = ld.sg; it.mside = en.th > ld.th ? 1 : -1; it.wob = min(it.wob, 1.2); it.swA = 0; it.dtA = 0;
    }
    return it;
  }

  // ------------------------------------------------------------------------------------------------ orbit planning (incremental)
  /** gap between two oriented rectangles (> 0 clear distance, < 0 penetration depth): separating-axis test over the four edge normals */
  function obbGap(ax, ay, ahw, ahh, ac, as_, bx, by, bhw, bhh, bc, bs) {
    var dx = bx - ax, dy = by - ay, best = -1e9, k, nx, ny, d, ra, rb, g;
    for (k = 0; k < 4; k++) {
      if (k === 0) { nx = ac; ny = as_; } else if (k === 1) { nx = -as_; ny = ac; } else if (k === 2) { nx = bc; ny = bs; } else { nx = -bs; ny = bc; }
      d = abs(dx * nx + dy * ny);
      ra = ahw * abs(ac * nx + as_ * ny) + ahh * abs(-as_ * nx + ac * ny);
      rb = bhw * abs(bc * nx + bs * ny) + bhh * abs(-bs * nx + bc * ny);
      g = d - ra - rb; if (g > best) best = g;
    }
    return best;
  }
  var PK = ['a', 'b', 'tilt', 'ct', 'st', 'ox', 'oy', 'phi0', 'w', 'R0', 'p1', 'p2', 'sg'];
  function copyParams(src, dst) { for (var k = 0; k < PK.length; k++) dst[PK[k]] = src[PK[k]]; }
  function blankParams() { return { a: 0, b: 0, tilt: 0, ct: 1, st: 0, ox: 0, oy: 0, phi0: 0, w: 0, R0: 0, p1: 0, p2: 0, sg: 1 }; }

  /** set up the planner state machine (cheap).  The orbits are chosen by random candidates (built around each slot's home) + local refinement,
      scored over the whole time span (on screen, off the girl, away from the ball corridor, comfortable gaps, near home); big pieces first,
      then everybody again against ALL the others, then repair rounds for the unhappy ones.  The random stream is consumed in a fixed order,
      so the result does not depend on how the work is sliced. */
  function planInit(items, opt) {
    var W = G.W, N = items.length, dtg = 0.45, tg0 = items[0].ts, M = floor((G.tNom + 0.3 - tg0) / dtg) + 1, i, m, it;
    var gTop = G.cy - CFG.GIRL_TOP, gBot = G.groundY + 20, hTop = G.vt - 10, hBot = G.cy - 150;
    var Pl = G.plan = {
      N: N, M: M, tg0: tg0, items: items, rng: U.rng(G.seed + 3), RT: new Float64Array(M), TT: new Float64Array(M),
      gy: (gTop + gBot) / 2, ghh: (gBot - gTop) / 2, hy: (hTop + hBot) / 2, hhh: max(10, (hBot - hTop) / 2), hhw: 140, corridor: isFinite(G.tHit),
      rx: G.rx, ry: G.ry, AMAX: G.rx * 1.04, AMIN: G.rx * 0.3, BMAX: G.ry * 1.06, BMIN: G.ry * 0.2, cand: blankParams(), best: blankParams(),
      xm: CFG.VIS_MARGIN, vt: G.vt + CFG.VIS_MARGIN, vb: G.vb - CFG.VIS_MARGIN, sTop: CFG.Y_MIN, sBot: G.groundY - CFG.Y_BOTTOM_GAP, hdY: G.hy - 20,
      hv: [], lt: [], stage: 0, idx: 0, job: null, order0: null, bad: null, rs: 0, done: false,
    };
    for (m = 0; m < M; m++) { Pl.TT[m] = tg0 + m * dtg; Pl.RT[m] = rint(Pl.TT[m]); }
    for (i = 0; i < N; i++) {
      it = items[i];
      it.m0 = max(0, ceil((it.ts - tg0) / dtg - 1e-6)); it.m1 = isFinite(it.life) ? min(M, floor((it.ts + it.life - tg0) / dtg) + 1) : M; if (it.m1 <= it.m0) it.m1 = min(M, it.m0 + 1);
      it.mstep = isFinite(it.life) ? 1 : it.heavy ? 1 : 2;
      it.px = new Float32Array(M); it.py = new Float32Array(M); it.ps = new Float32Array(M); it.pz = new Float32Array(M); it.placed = false;
      it.ohw = 0.5 * it.bw * 0.9; it.ohh = 0.5 * it.bh * 0.9; it.oc = cos(it.rz0); it.os = sin(it.rz0);
      (it.heavy ? Pl.hv : Pl.lt).push(i);
    }
    Pl.hv.sort(function (a, b) { return items[b].bw * items[b].bh - items[a].bw * items[a].bh; });   // big pieces choose first
  }

  function planScore(it, i, cand, bound) {
    var Pl = G.plan, items = Pl.items, N = Pl.N, M = Pl.M, RT = Pl.RT, TT = Pl.TT, W = G.W, lt = it.light;
    var pen = 0, dmin = 1e9, comfort = it.comfort, sx = 0, sy = 0, cnt = 0, x, y, v, g, q, m2, j2, ex, ey, hw, hh, cf, zn, gwU, exb, eyb, dx, dy, dl, df, nr, qz, kk, pairs;
    for (m2 = it.m0; m2 < it.m1; m2++) {
      orbitXY(cand, RT[m2], TT[m2], TMP);
      x = TMP.x; y = TMP.y; zn = TMP.zn; sx += x; sy += y; cnt++;
      kk = (1 + CFG.PERSP * zn) * 1.03; ex = it.ex * kk; ey = it.ey * kk + 9; hw = it.ohw * kk; hh = it.ohh * kk;
      exb = ex * 1.1 + 6 + 0.6 * it.bobMax; eyb = ey * 1.1 + 6 + 0.6 * it.bobMax;      // + the entrance overshoot + the wobble
      if (it.popR > exb) exb = it.popR; if (it.popR > eyb) eyb = it.popR;      // + the pop ring / dots
      if (TT[m2] >= G.tNom - 0.3) { dx = x - G.hx; dy = y - G.hy; dl = hypot(dx, dy) || 1; exb += 74 * abs(dx) / dl; eyb += 74 * abs(dy) / dl; }   // + the push of the dissolve start
      v = Pl.xm - (x - exb); if (v > 0) pen += v * 4;
      v = (x + exb) - (W - Pl.xm); if (v > 0) pen += v * 4;
      v = Pl.vt - (y - eyb); if (v > 0) pen += v * 4;
      v = (y + eyb) - Pl.vb; if (v > 0) pen += v * 4;
      v = Pl.sTop - (y - ey); if (v > 0) pen += v * 5;                          // (soft: stay inside the band)
      v = (y + ey) - Pl.sBot; if (v > 0) pen += v * 8;                            // (nothing hangs below her feet)
      dx = (x - G.cx) / Pl.rx; dy = (y - G.cy) / Pl.ry; nr = sqrt(dx * dx + dy * dy);
      if (nr > CFG.ENV_K) pen += (nr - CFG.ENV_K) * Pl.rx * 14;                 // the centre stays inside the vortex envelope
      gwU = zn < -0.15 || it.dl < 0 ? it.gwFar : it.gw;                          // far side / far depth layer: she may hide part of it
      var gxt = TT[m2] > G.tNom - 2.6 ? 60 : 0;                                   // (act IV: the funnel moves pieces ~250 u/s: keep 60 extra units so nothing drifts into her between two samples)
      g = obbGap(x, y, hw, hh, it.oc, it.os, G.cx, Pl.gy, gwU, Pl.ghh, 1, 0); if (g < it.gg + gxt) pen += (it.gg + gxt - g) * (zn > -0.15 && it.dl >= 0 ? 25 : 5);   // (a piece passing in FRONT of her column is never acceptable: 5x the far-side weight)
      g = obbGap(x, y, hw, hh, it.oc, it.os, G.cx, Pl.hdY, CFG.FACE_HW, CFG.FACE_HH, 1, 0); if (g < 20) pen += (20 - g) * 5;     // never crowd her face
      if (Pl.corridor && TT[m2] > G.tHit - 1.7) { g = obbGap(x, y, hw, hh, it.oc, it.os, G.cx, Pl.hy, Pl.hhw, Pl.hhh, 1, 0); if (g < 0) pen -= g * 2; }
      if (it.lead && it.lead.placed && m2 >= it.lead.m0 && m2 < it.lead.m1) {                 // a satellite stays tethered to its leader (centre within TETHER of touching it)
        var ld = it.lead; v = hypot(x - ld.px[m2], y - ld.py[m2]) - 0.45 * (ld.diag * ld.ps[m2] + it.diag * kk) - CFG.TETHER; if (v > 0) pen += v * 0.5;
      }
      if ((m2 - it.m0) % it.mstep === 0) {
        for (j2 = 0; j2 < N; j2++) {
          q = items[j2];
          if (j2 === i || !q.placed || q.m0 > m2 || m2 >= q.m1) continue;
          if (lt && q.light) {                                                   // small vs small: only a sparse check (no pile-ups of icons / marks), overlaps stay cheap and slight
            if ((m2 - it.m0) % 3 !== 0 || q.life < 1e8 || it.life < 1e8) continue;
            g = obbGap(x, y, hw, hh, it.oc, it.os, q.px[m2], q.py[m2], q.ohw * q.ps[m2], q.ohh * q.ps[m2], q.oc, q.os);
            if (g < 14) pen += (14 - (g > 0 ? g : 0)) * 0.6 + (g < 0 ? -g * 0.8 : 0);
            continue;
          }
          g = obbGap(x, y, hw, hh, it.oc, it.os, q.px[m2], q.py[m2], q.ohw * q.ps[m2], q.ohh * q.ps[m2], q.oc, q.os);
          cf = lt ? it.comfort : comfort > q.comfort ? comfort : q.comfort;
          qz = q.pz[m2]; df = (zn * qz < 0 && abs(zn - qz) > 0.6) || it.dl !== q.dl ? 0.5 : 1;       // different depth layers / one in front of her, one behind: they may overlap a little
          if (it.noBehind && q.noBehind) df = 1;
          cf *= df;
          if (g < cf) pen += (cf - (g > 0 ? g : 0)) * (lt ? 0.3 : 0.45) + (g < 0 ? (12 - g * 3) * df * (lt ? 0.4 : 1) : 0);
          if (m2 === it.m0) { v = hypot(x - q.px[m2], y - q.py[m2]); if (v < dmin) dmin = v; }
        }
      }
      if (pen > bound + 80) return Infinity;
    }
    v = hypot(sx / cnt - it.home.x, sy / cnt - it.home.y) - 40;
    if (v > 0) pen += CFG.HOME_PULL * v * (lt ? 0.5 : 1);                                               // the slot's home: the mean position over the run
    return pen - 0.10 * min(dmin, 450);                                                                  // room around the item at its pop
  }
  /** a candidate orbit: a copy of the envelope ellipse scaled by the slot's radius, centred on HER (a little below the neck), slightly tilted, the phase
      such that the mean position of its life is the slot's home (small pieces try a wider neighbourhood) */
  function planSample(it) {
    var Pl = G.plan, rng = Pl.rng, c = Pl.cand, lt = it.light, rf = clamp(it.rf + rng.gauss() * (lt ? 0.1 : 0.06), CFG.RF_MIN - 0.02, CFG.RF_MAX + 0.02), kap = lt ? rng.range(0.62, 1.25) : rng.range(0.84, 1.1);
    if (it.lead) {                                                                          // a satellite: (nearly) its leader's ellipse, the same speed and flow origin, a phase offset beside it
      var ld = it.lead;
      c.tilt = clamp(ld.tilt + rng.gauss() * 0.06, -0.6, 0.5); c.ct = cos(c.tilt); c.st = sin(c.tilt);
      c.ox = clamp(ld.ox + rng.range(-24, 24), -60, 60); c.oy = clamp(ld.oy + rng.range(-16, 24), -20, 80);
      c.a = clamp(ld.a * (1 + rng.gauss() * 0.07), Pl.AMIN, Pl.AMAX); c.b = clamp(ld.b * (1 + rng.gauss() * 0.09), Pl.BMIN, Pl.BMAX);
      c.w = ld.w * rng.range(0.985, 1.015); c.R0 = ld.R0; c.sg = ld.sg; c.p1 = ld.p1; c.p2 = ld.p2;
      c.phi0 = ld.phi0 + it.mside * (rng.next() < 0.8 ? 1 : -1) * rng.range(0.34, 0.62);
      return;
    }
    c.tilt = lt ? rng.range(-0.55, 0.45) : rng.range(-0.2, 0.14); c.ct = cos(c.tilt); c.st = sin(c.tilt);
    c.ox = lt ? rng.range(-60, 60) : rng.range(-28, 28); c.oy = lt ? rng.range(-20, 70) : rng.range(0, 50);
    c.a = clamp(rf * Pl.rx, Pl.AMIN, Pl.AMAX); c.b = clamp(rf * Pl.ry * kap, Pl.BMIN, Pl.BMAX);
    c.w = it.wBase * rng.range(0.92, 1.1);
    var spread = lt ? (Pl.job && Pl.job.sc > CFG.LIGHT_TRIES * 0.4 ? 1.5 : 0.5) : (Pl.job && Pl.job.sc > Pl.job.tries * 0.35 ? 0.65 : 0.2);           // (a small piece whose slot is blocked looks further round the ring)
    c.phi0 = it.th + rng.range(-spread, spread) - G.dir * it.sg * c.w * it.dRm;
    c.R0 = it.R0; c.p1 = it.p1; c.p2 = it.p2; c.sg = it.sg;
  }
  function planPerturb(src, it) {
    var Pl = G.plan, rng = Pl.rng, c = Pl.cand;
    copyParams(src, c);
    var k = rng.next() < 0.5 ? 1 : 0.35;
    c.phi0 = src.phi0 + rng.gauss() * 0.2 * k;
    c.a = clamp(src.a * (1 + rng.gauss() * 0.06 * k), Pl.AMIN, Pl.AMAX); c.b = clamp(src.b * (1 + rng.gauss() * 0.07 * k), Pl.BMIN, Pl.BMAX);
    c.tilt = clamp(src.tilt + rng.gauss() * 0.04 * k, it.light ? -0.6 : -0.3, it.light ? 0.5 : 0.2); c.ct = cos(c.tilt); c.st = sin(c.tilt);
    c.ox = clamp(src.ox + rng.gauss() * 14 * k, -45, 45); c.oy = clamp(src.oy + rng.gauss() * 14 * k, -10, 80);
    c.w = it.lead ? src.w : clamp(src.w + rng.gauss() * 0.008 * k, it.wBase * 0.85, it.wBase * 1.15);     // (a satellite keeps its leader's speed)
  }
  /** the next job: {i, tries, hill, again} or a re-score job {score:true, i}; null when the plan is complete */
  function planNextJob() {
    var Pl = G.plan, items = Pl.items, hv = Pl.hv, k;
    for (;;) {
      if (Pl.stage === 0) { if (Pl.idx < hv.length) return { i: hv[Pl.idx++], tries: CFG.PLAN_TRIES, hill: 70, again: false }; Pl.stage = 1; Pl.idx = 0; }
      else if (Pl.stage === 1) { if (Pl.idx < hv.length) return { i: hv[Pl.idx++], tries: CFG.PLAN_TRIES >> 1, hill: 45, again: true }; Pl.stage = 2; Pl.idx = 0; Pl.bad = null; Pl.rs = 0; }
      else if (Pl.stage <= 5) {            // repair rounds: re-score the big pieces against the final layout, then give the unhappy ones (worst first) more tries
        if (!Pl.bad) {
          if (Pl.rs < hv.length) return { score: true, i: hv[Pl.rs++] };       // (one re-score per job, so the slices stay short)
          Pl.bad = [];
          for (k = 0; k < hv.length; k++) if (items[hv[k]].planScore > (Pl.stage === 2 ? 14 : 40)) Pl.bad.push(hv[k]);
          Pl.bad.sort(function (a, b) { return items[b].planScore - items[a].planScore; });
        }
        if (Pl.idx < Pl.bad.length) return { i: Pl.bad[Pl.idx++], tries: CFG.PLAN_TRIES * (Pl.stage === 2 ? 1 : 2), hill: Pl.stage === 2 ? 110 : 160, again: true };
        if (!Pl.bad.length) { Pl.stage = 6; Pl.idx = 0; continue; }
        Pl.stage++; Pl.idx = 0; Pl.bad = null; Pl.rs = 0;
      }
      else if (Pl.stage === 6) {           // the small pieces: a handful of candidates each, against the big ones only (they may overlap each other a little)
        if (Pl.idx < Pl.lt.length) { var li2 = Pl.lt[Pl.idx++], mt = !!items[li2].lead; return { i: li2, tries: mt ? CFG.MATE_TRIES : CFG.LIGHT_TRIES, hill: mt ? 30 : 16, again: false }; }
        Pl.stage = 7;
      }
      else return null;
    }
  }
  /** run the planner for about `budget` ms (Infinity = to the end) */
  function planStep(budget) {
    var Pl = G.plan;
    if (!Pl || Pl.done) return;
    var deadline = budget === Infinity ? Infinity : now() + budget, items = Pl.items, J, it, sc, k, m;
    for (;;) {
      if (!Pl.job) {
        J = planNextJob();
        if (!J) { finishPlan(); return; }
        it = items[J.i]; J.sc = 0; J.hc = 0; J.bestScore = Infinity;
        if (J.score) { it.planScore = planScore(it, J.i, it, Infinity); continue; }
        if (J.again) { copyParams(it, Pl.best); J.bestScore = planScore(it, J.i, it, Infinity); }
        Pl.job = J;
      }
      J = Pl.job; it = items[J.i];
      for (k = 0; k < 2; k++) {
        if (J.sc < J.tries) { planSample(it); J.sc++; sc = planScore(it, J.i, Pl.cand, J.bestScore); }
        else if (J.hc < J.hill) { planPerturb(Pl.best, it); J.hc++; sc = planScore(it, J.i, Pl.cand, J.bestScore); }
        else {
          copyParams(Pl.best, it);
          for (m = 0; m < Pl.M; m++) { orbitXY(it, Pl.RT[m], Pl.TT[m], TMP); it.px[m] = TMP.x; it.py[m] = TMP.y; it.ps[m] = (1 + CFG.PERSP * TMP.zn) * 1.03; it.pz[m] = TMP.zn; }
          it.placed = true; it.planScore = J.bestScore; Pl.job = null;
          break;
        }
        if (sc < J.bestScore) { J.bestScore = sc; copyParams(Pl.cand, Pl.best); }
      }
      if (deadline !== Infinity && now() >= deadline) return;
    }
  }
  function finishPlan() {
    var Pl = G.plan, i, it;
    Pl.done = true; G.planned = true;
    for (i = 0; i < Pl.N; i++) { it = Pl.items[i]; it.px = it.py = it.ps = it.pz = null; }
    Pl.RT = Pl.TT = null;
  }

  // ------------------------------------------------------------------------------------------------ dissolve templates: ink analysis, cube sites, erase noise (incremental, per item)
  function ensureCanvas(h, side, readback) {
    if (!h.cv) { h.cv = document.createElement('canvas'); h.cx = null; h.w = 0; }
    if (h.w < side || !h.cx) {
      h.cv.width = h.cv.height = max(side, h.w || 0); h.w = h.cv.width;
      h.cx = readback ? h.cv.getContext('2d', { willReadFrequently: true }) : h.cv.getContext('2d');
    }
    return h.cx;
  }
  function setProp(it, pose, scaleExtra) {
    P.s = it.s * pose.sc * scaleExtra; P.t = pose.pt; P.seed = it.seed;
    P.rot[0] = pose.rx; P.rot[1] = pose.ry; P.rot[2] = pose.rz;
    P.alpha = 1; P.lw = CFG.LW * it.lwm;
  }
  /** analysis, part 1: render the item at time t at scale ka (px/unit) and read the pixels back */
  function analyseRender(it, t, ka) {
    var pose = poseInto(it, t, rint(t), {}), Wa = evenCeil(it.L * ka), cx2 = ensureCanvas(AN, Wa, true);
    cx2.setTransform(1, 0, 0, 1, 0, 0); cx2.clearRect(0, 0, Wa, Wa);
    cx2.setTransform(ka, 0, 0, ka, Wa / 2, Wa / 2);
    setProp(it, pose, 1);
    cx2.translate(-it.ocx * P.s, -it.ocy * P.s);
    it.def.draw(cx2, P);
    cx2.setTransform(1, 0, 0, 1, 0, 0);
    return { Wa: Wa, ka: ka, sc: pose.sc, img: cx2.getImageData(0, 0, Wa, Wa).data };
  }
  /** analysis, part 2: summed-area tables of alpha and darkness (relative to the paper colour) */
  function analyseTables(r) {
    var Wa = r.Wa, img = r.img, sty = ST(), pr = sty.paperRGB || [255, 255, 255], lp = (pr[0] * 0.299 + pr[1] * 0.587 + pr[2] * 0.114) / 255 || 1;
    var n1 = Wa + 1, SA = new Float32Array(n1 * n1), SD = new Float32Array(n1 * n1), x, y, i, a, rowA, rowD, d;
    for (y = 0; y < Wa; y++) {
      rowA = 0; rowD = 0;
      for (x = 0; x < Wa; x++) {
        i = (y * Wa + x) * 4; a = img[i + 3] / 255;
        d = (lp - (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) / 255) / lp; if (d < 0) d = 0;
        rowA += a; rowD += a * d;
        SA[(y + 1) * n1 + x + 1] = SA[y * n1 + x + 1] + rowA;
        SD[(y + 1) * n1 + x + 1] = SD[y * n1 + x + 1] + rowD;
      }
    }
    return { W: Wa, n1: n1, SA: SA, SD: SD, ka: r.ka, sc: r.sc };
  }
  function rectSum(S, n1, Wa, x0, y0, x1, y1) {
    x0 = max(0, floor(x0)); y0 = max(0, floor(y0)); x1 = min(Wa, ceil(x1)); y1 = min(Wa, ceil(y1));
    if (x1 <= x0 || y1 <= y0) return 0;
    return S[y1 * n1 + x1] - S[y0 * n1 + x1] - S[y1 * n1 + x0] + S[y0 * n1 + x0];
  }

  /** quadtree-ish decomposition of the item's pixels into cube-site cells (CELL_MIN..CELL_MAX units); packs typed arrays on the item:
      cc* = cells with ink (u,v = centre in unit-scale local units, size, ink in the 3 analysis poses), ds* = a sample of paper-only cells (dust) */
  function makeCells(it, an, rng) {
    var cells = [], ka, Wa, scA, n1;
    if (an) { ka = an[0].ka; Wa = an[0].W; scA = an[0].sc; n1 = an[0].n1; }
    else { ka = 1; scA = 1; Wa = evenCeil(it.L); }
    function alphaOf(x0, y0, x1, y1) {
      if (!an) { var cx0 = Wa / 2 - it.bw * 0.5, cy0 = Wa / 2 - it.bh * 0.5; return (min(x1, cx0 + it.bw) - max(x0, cx0) > 0 && min(y1, cy0 + it.bh) - max(y0, cy0) > 0) ? (x1 - x0) * (y1 - y0) : 0; }
      return rectSum(an[0].SA, n1, Wa, x0, y0, x1, y1) + rectSum(an[1].SA, n1, Wa, x0, y0, x1, y1) + rectSum(an[2].SA, n1, Wa, x0, y0, x1, y1);
    }
    function node(x0, y0, w, h, depth) {
      if (alphaOf(x0, y0, x0 + w, y0 + h) < 0.5) return;
      var ww = w / ka, hh = h / ka, bg = max(ww, hh), tgt = CFG.CELL_MIN + (CFG.CELL_MAX - CFG.CELL_MIN) * pow(rng.next(), 1.2);
      if (depth < 10 && (bg > CFG.CELL_MAX * 1.12 || (bg > tgt * 1.2 && bg > CFG.CELL_MIN * 1.9))) {
        var fx = rng.range(0.4, 0.6), fy = rng.range(0.4, 0.6);
        if (ww > hh * 1.7) { node(x0, y0, w * fx, h, depth + 1); node(x0 + w * fx, y0, w * (1 - fx), h, depth + 1); }
        else if (hh > ww * 1.7) { node(x0, y0, w, h * fy, depth + 1); node(x0, y0 + h * fy, w, h * (1 - fy), depth + 1); }
        else { node(x0, y0, w * fx, h * fy, depth + 1); node(x0 + w * fx, y0, w * (1 - fx), h * fy, depth + 1); node(x0, y0 + h * fy, w * fx, h * (1 - fy), depth + 1); node(x0 + w * fx, y0 + h * fy, w * (1 - fx), h * (1 - fy), depth + 1); }
      } else cells.push({ x0: x0, y0: y0, w: w, h: h });
    }
    node(0, 0, Wa, Wa, 0);
    var k = 1 / (ka * scA), i, c, j, nI = 0, nD = 0, ink;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      c.cu = (c.x0 + c.w * 0.5 - Wa / 2) * k; c.cv = (c.y0 + c.h * 0.5 - Wa / 2) * k; c.size = sqrt(c.w * c.h) / ka;
      c.ink = [0.2, 0.2, 0.2];
      if (an) for (j = 0; j < 3; j++) c.ink[j] = rectSum(an[j].SD, an[j].n1, Wa, c.x0, c.y0, c.x0 + c.w, c.y0 + c.h) / max(1, c.w * c.h);
      c.hasInk = max(c.ink[0], c.ink[1], c.ink[2]) > CFG.INK_MIN;
      if (c.hasInk) nI++; else nD++;
    }
    var dust = [];
    for (i = 0; i < cells.length; i++) if (!cells[i].hasInk && rng.next() < 40 / max(40, nD)) dust.push(cells[i]);
    it.ccN = nI; it.ccU = new Float32Array(nI); it.ccV = new Float32Array(nI); it.ccS = new Float32Array(nI); it.ccI = new Float32Array(nI * 3);
    for (i = 0, j = 0; i < cells.length; i++) {
      c = cells[i]; if (!c.hasInk) continue;
      it.ccU[j] = c.cu; it.ccV[j] = c.cv; it.ccS[j] = c.size; it.ccI[j * 3] = c.ink[0]; it.ccI[j * 3 + 1] = c.ink[1]; it.ccI[j * 3 + 2] = c.ink[2]; j++;
    }
    it.dsN = dust.length; it.dsU = new Float32Array(dust.length); it.dsV = new Float32Array(dust.length); it.dsS = new Float32Array(dust.length);
    for (i = 0; i < dust.length; i++) { it.dsU[i] = dust[i].cu; it.dsV[i] = dust[i].cv; it.dsS[i] = dust[i].size; }
    // erase mask: a coarse texel field over the item's working rectangle (unit-scale local units, centred on the ink centre), the item's own smooth noise in [0,1],
    // and a map of the texels that hold any pixels at all
    var Lw = it.Lw, Lh = it.Lh, tex = max(CFG.MASK_CELL, max(Lw, Lh) / CFG.MASK_MAX), mw = max(6, ceil(Lw / tex)), mh = max(6, ceil(Lh / tex)), n = mw * mh;
    var N = new Float32Array(n), Hs = new Uint8Array(n), lo = 1e9, hi = -1e9, sd = it.seed % 97, u, v, val, kx = ka * scA;
    for (j = 0; j < mh; j++) {
      v = ((j + 0.5) / mh - 0.5) * Lh;
      for (i = 0; i < mw; i++) {
        u = ((i + 0.5) / mw - 0.5) * Lw;
        val = 0.68 * U.noise2(u * 0.012 + 3.1, v * 0.012, sd) + 0.32 * U.noise2(u * 0.034, v * 0.034 + 7.7, sd + 1);
        N[j * mw + i] = val; if (val < lo) lo = val; if (val > hi) hi = val;
        if (an) {
          var xa = Wa / 2 + (i / mw - 0.5) * Lw * kx, xb = Wa / 2 + ((i + 1) / mw - 0.5) * Lw * kx, ya = Wa / 2 + (j / mh - 0.5) * Lh * kx, yb = Wa / 2 + ((j + 1) / mh - 0.5) * Lh * kx;
          Hs[j * mw + i] = rectSum(an[0].SA, n1, Wa, xa, ya, xb, yb) + rectSum(an[1].SA, n1, Wa, xa, ya, xb, yb) + rectSum(an[2].SA, n1, Wa, xa, ya, xb, yb) > 0.35 ? 1 : 0;
        } else Hs[j * mw + i] = abs(u) < it.bw * 0.5 && abs(v) < it.bh * 0.5 ? 1 : 0;
      }
    }
    for (i = 0; i < n; i++) N[i] = (N[i] - lo) / Math.max(1e-6, hi - lo);
    it.mw = mw; it.mh = mh; it.mN = N; it.mHas = Hs;
    if (it.knock && typeof document !== 'undefined') buildKnock(it);
    return cells.length;
  }

  /** the soft knockout field of a design piece (one byte per erase-mask texel): the ink texels, filled where enclosed (row / column spans: the inside of a ring
      or a frame), grown by one texel and blurred; alpha 255 on the ink, ~0 about 2.5 texels (25-35 units) away.  Drawn upscaled (bilinear) in paper colour. */
  function buildKnock(it) {
    var mw = it.mw, mh = it.mh, H = it.mHas, n = mw * mh, A = new Float32Array(n), B = new Float32Array(n), i, j, k, v, rmn = new Int16Array(mh).fill(9999), rmx = new Int16Array(mh).fill(-1), cmn = new Int16Array(mw).fill(9999), cmx = new Int16Array(mw).fill(-1);
    for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) if (H[j * mw + i]) { if (i < rmn[j]) rmn[j] = i; if (i > rmx[j]) rmx[j] = i; if (j < cmn[i]) cmn[i] = j; if (j > cmx[i]) cmx[i] = j; }
    for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) A[j * mw + i] = (H[j * mw + i] || (i >= rmn[j] && i <= rmx[j] && j >= cmn[i] && j <= cmx[i])) ? 1 : 0;
    for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) {              // grow by one texel (cross)
      k = j * mw + i; v = A[k];
      if (i > 0 && A[k - 1] > v) v = A[k - 1]; if (i < mw - 1 && A[k + 1] > v) v = A[k + 1]; if (j > 0 && A[k - mw] > v) v = A[k - mw]; if (j < mh - 1 && A[k + mw] > v) v = A[k + mw];
      B[k] = v;
    }
    for (var pass = 0; pass < 2; pass++) {                           // two box blurs of radius 1 (separable), out-of-range counts as empty
      for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) { k = j * mw + i; A[k] = ((i > 0 ? B[k - 1] : 0) + B[k] + (i < mw - 1 ? B[k + 1] : 0)) / 3; }
      for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) { k = j * mw + i; B[k] = ((j > 0 ? A[k - mw] : 0) + A[k] + (j < mh - 1 ? A[k + mw] : 0)) / 3; }
    }
    var out = new Uint8Array(n);
    for (k = 0; k < n; k++) { v = B[k] * 1.5; out[k] = v >= 1 ? 255 : (v * v * (3 - 2 * v) * 255 + 0.5) | 0; }
    var kx0 = mw, ky0 = mh, kx1 = 0, ky1 = 0;                        // texel box that holds any knockout (the rest of the working rectangle is never drawn)
    for (j = 0; j < mh; j++) for (i = 0; i < mw; i++) if (out[j * mw + i] > 6) { if (i < kx0) kx0 = i; if (i >= kx1) kx1 = i + 1; if (j < ky0) ky0 = j; if (j >= ky1) ky1 = j + 1; }
    if (kx1 <= kx0 || ky1 <= ky0) { kx0 = 0; ky0 = 0; kx1 = mw; ky1 = mh; }
    it.koA = out; it.koB = [kx0, ky0, kx1, ky1]; it.koCv = null; it.koKey = -1;
  }

  /** one preparation step of one item: 7 small steps (render + read back / tables, for each of 3 poses; then the cells + mask noise) */
  function itemStep(it) {
    var haveDOM = typeof document !== 'undefined' && !!document.createElement, st = it.anStage;
    if (st < 6) {
      if (haveDOM) {
        try {
          if (!it.an) it.an = [];
          if (!(st & 1)) it.anTmp = analyseRender(it, it.Ts[st >> 1], clamp(min(0.9, 300 / it.L), 0.4, 0.9));
          else { it.an.push(analyseTables(it.anTmp)); it.anTmp = null; }
        } catch (e) { it.an = null; it.anTmp = null; it.anStage = 5; }
      }
      it.anStage++;
    } else {
      makeCells(it, it.an && it.an.length === 3 ? it.an : null, U.rng(G.seed * 31 + it.idx * 977 + 5));
      it.an = null; it.anStage = 7; it.ready = true;
    }
  }
  function itemReady(it) {          // synchronous completion of one item (the plan first)
    if (G.plan && !G.plan.done) planStep(Infinity);
    while (!it.ready) itemStep(it);
  }
  /** preparation: plan, then the items in order of appearance; ~budget ms; true when all done */
  function prepStep(budget) {
    if (!G || !G.items.length) return true;
    if (G.prepared) return true;
    var deadline = budget === Infinity ? Infinity : now() + budget, i, it;
    if (G.plan && !G.plan.done) { planStep(budget); if (!G.plan.done) return false; }
    while (G.anIdx < G.items.length) {
      it = G.items[G.anIdx];
      if (it.ready) { G.anIdx++; continue; }
      itemStep(it);
      if (deadline !== Infinity && now() >= deadline) return false;
    }
    if (!G.links) makeLinks();
    G.coreReady = true;                                    // everything the first pop needs
    if (typeof document !== 'undefined') {                 // canvases are allocated now, not in the first dissolving frame
      var maxL = 0; for (i = 0; i < G.items.length; i++) maxL = max(maxL, G.items[i].L);
      SC.need = max(SC.need, evenCeil(maxL * pxScale())); ensureCanvas(SC, evenCeil(SC.need * 1.15), false); SC.cx.setTransform(1, 0, 0, 1, 0, 0); SC.cx.clearRect(0, 0, 3, 3); SC.cx.fillStyle = 'rgba(0,0,0,0.01)'; SC.cx.fillRect(0, 0, 2, 2); SC.touch = true;
      ensureMask();
    }
    while (G.warmN < CFG.WARM_RUNS) {                      // dry dissolves: JIT warm-up (the first real call would cost ~2x more), masks allocated; each one in a frame of its own
      if (deadline !== Infinity && !G.warmGo) { G.warmGo = true; return false; }          // (every other call: one dry run per two frames)
      G.warmGo = false; dissolveFrom(G.tNom + 5, { dry: true, speed: 1, stagger: CFG.STAGGER }); G.warmN++;
      if (deadline !== Infinity) return false;
    }
    G.prepared = true; G.armed = true;
    return true;
  }

  // ------------------------------------------------------------------------------------------------ dissolve (scheduled or interrupt)
  function ensureMask() {
    if (typeof document === 'undefined') return;
    if (!MK.cx) { MK.cv = document.createElement('canvas'); MK.cv.width = MK.cv.height = CFG.MASK_MAX + 2; MK.cx = MK.cv.getContext('2d'); }
  }
  /** the erase mask of an item at time t: one texel per cell of the coarse field, alpha = smoothstep of (t - erase time) / softness.
      Returns 0 = nothing erased yet, 1 = partly erased, 2 = everything erased; sets the texel bounding box (bx0..by1) of the content that is still (partly) there. */
  function fillMask(it, t) {
    var mw = it.mw, mh = it.mh, T = it.mT, H = it.mHas, U32 = it.mU32, inv = 1 / it.fade, d, i, j, kk = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, touched = false, open = false;
    for (j = 0; j < mh; j++) {
      for (i = 0; i < mw; i++, kk++) {
        d = (t - T[kk]) * inv;
        if (d <= 0) { U32[kk] = 0; d = 0; }
        else if (d >= 1) U32[kk] = 0xFF000000;
        else U32[kk] = (((d * d * (3 - 2 * d)) * 255) | 0) << 24;
        if (H[kk]) {
          if (d > 0) touched = true;
          if (d < 1) { open = true; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
        }
      }
    }
    it.bx0 = x0; it.by0 = y0; it.bx1 = x1 + 1; it.by1 = y1 + 1;
    return !open ? 2 : touched ? 1 : 0;
  }
  var TP1 = {}, TP2 = {};
  /** per-item dissolve preparation, once per item and dissolve: the pose knots over its dissolve (positions + velocities of its cube sites are interpolated
      from them) and its erase-time field: a diagonal sweep that starts on the side facing her head, ragged by the item's own noise, normalised over the texels
      that hold content (the first piece goes at the item's start, the last at start + dur) and front-loaded */
  function prepItem(it) {
    if (it.fieldOK) return;
    var NK = 6, kn = it.kn = new Float64Array(NK * 7), k, j, tk, o7, kp = TP1, kp2 = TP2;
    for (k = 0; k < NK; k++) {
      tk = it.t0 + it.dur * k / (NK - 1); o7 = k * 7;
      poseInto(it, tk, rint(tk), kp); poseInto(it, tk + 0.01, rint(tk + 0.01), kp2);
      kn[o7] = kp.x; kn[o7 + 1] = kp.y; kn[o7 + 2] = kp.sc; kn[o7 + 3] = (kp2.x - kp.x) * 100; kn[o7 + 4] = (kp2.y - kp.y) * 100; kn[o7 + 5] = kp.zn;
    }
    var mw = it.mw, mh = it.mh, n = mw * mh, T = it.mT && it.mT.length === n ? it.mT : (it.mT = new Float32Array(n)), N = it.mN, Hs = it.mHas, cr = cos(it.rotF), sr = sin(it.rotF);
    var hx = it.hdx * cr - it.hdy * sr, hy = it.hdx * sr + it.hdy * cr, Lw = it.Lw, Lh = it.Lh, norm = 1 / (0.5 * (Lw * abs(hx) + Lh * abs(hy)) + 1e-6), idx = 0, rawMin = 1e9, rawMax = -1e9, raw, rowv, i;
    for (k = 0; k < mw; k++) COLT[k] = -0.66 * norm * hx * (((k + 0.5) / mw - 0.5) * Lw);
    for (j = 0; j < mh; j++) {
      rowv = 0.33 - 0.66 * norm * hy * (((j + 0.5) / mh - 0.5) * Lh);
      for (k = 0; k < mw; k++, idx++) {
        raw = rowv + COLT[k] + 0.34 * N[idx]; T[idx] = raw;
        if (Hs[idx]) { if (raw < rawMin) rawMin = raw; if (raw > rawMax) rawMax = raw; }
      }
    }
    if (rawMax <= rawMin) { rawMin = 0; rawMax = 1; }
    var inv = 255 / (rawMax - rawMin), tt0 = it.t0, dd = it.dur, qi;
    for (idx = 0; idx < n; idx++) { raw = (T[idx] - rawMin) * inv; qi = raw <= 0 ? 0 : raw >= 255 ? 255 : raw | 0; T[idx] = tt0 + dd * (PWL[qi] + (PWL[qi + 1] - PWL[qi]) * (raw - qi > 0 && raw < 255 ? raw - qi : 0)); }
    if (typeof document !== 'undefined' && MK.cx && (!it.mImg || it.mImg.width !== mw || it.mImg.height !== mh)) { it.mImg = MK.cx.createImageData(mw, mh); it.mU32 = new Uint32Array(it.mImg.data.buffer); }
    if (it.dry && it.mU32) fillMask(it, it.t0 + 0.5 * it.dur);
    it.fieldOK = true;
  }
  /** Start the dissolve of every item that is visible at t0 (see the header).  Spawns the cubes / dots into GA.fx now. */
  function dissolveFrom(t0, o) {
    if (!G || !G.items.length) return null;
    o = o || {};
    var speed = o.speed > 0 ? o.speed : 1, stagger = o.stagger !== undefined ? max(0, o.stagger) : 0.35, dry = !!o.dry;      // dry: the whole computation, but nothing is spawned and no state is kept (JIT warm-up)
    var rng = U.rng(G.seed * 7919 + ((t0 * 1000) | 0) + (o.seed || 0) + 13), items = G.items, part = [], i, j, k, it;
    if (!dry && isFinite(G.shockT)) return G.lastResult || { items: 0, cubes: 0, dots: 0, lastDeath: 0, skipped: 0 };      // a dissolve is already running: idempotent no-op
    if (G.plan && !G.plan.done) planStep(Infinity);
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (it.dead || it.t0 <= t0) continue;                    // already dissolving / never to appear
      if (it.tp + it.life <= t0) continue;                       // a firework that has burnt out
      if (it.tp > t0) { it.dead = true; continue; }            // not popped in yet: it never will
      if (!it.ready) itemReady(it);
      part.push(it);
    }
    G.shockT = min(G.shockT, t0);
    for (i = 0; i < part.length; i++) part[i].dry = dry;
    ensureMask();
    if (PWX !== CFG.FRONT_LOAD) { PWX = CFG.FRONT_LOAD; for (i = 0; i < 257; i++) PWL[i] = pow(min(1, i / 255), PWX); }
    var pose = {}, dist = [], dmin = 1e9, dmax = 0, d, dx, dy;
    for (i = 0; i < part.length; i++) {
      it = part[i];
      it.t0 = Infinity; poseInto(it, t0, rint(t0), pose);
      dx = pose.x - G.hx; dy = pose.y - G.hy; d = hypot(dx, dy) || 1;
      dist.push(d); if (d < dmin) dmin = d; if (d > dmax) dmax = d;
      it.ux = dx / d; it.uy = dy / d; it.hdx = -it.ux; it.hdy = -it.uy;
    }
    for (i = 0; i < part.length; i++) {
      it = part[i];
      it.t0 = t0 + stagger * pow((dist[i] - dmin) / (dmax - dmin + 1e-6), CFG.STAGGER_POW);
      if (t0 - it.tp < 0.5) it.t0 = max(it.t0, it.tp + 0.5);     // let a popping item finish its pop first
      it.dur = rng.range(CFG.ERASE[0], CFG.ERASE[1]) / speed; it.fade = CFG.SOFT / speed;
      it.tEnd = it.t0 + it.dur + it.fade + 0.02;
      it.sc0 = 0; poseInto(it, it.t0, rint(it.t0), pose); it.sc0 = pose.sc; it.cache = null;      // the size the item keeps while it dissolves
    }
    // per-item preparation (pose knots + erase-time field) is lazy: done by prepItem() when the item's cubes are spawned (draw() spreads that over frames)
    var NK = 6, lastTe = t0;
    for (i = 0; i < part.length; i++) {
      it = part[i];
      it.rotF = rng.range(-0.5, 0.5); it.kn = null; it.fieldOK = false;
      if (it.t0 + it.dur > lastTe) lastTe = it.t0 + it.dur;
    }
    // cube sites: every ink cell is a candidate; thin to the budget (random, keeps the proportions), skew the sizes (many tiny, a few large)
    var cubeAPI = !dry && GA.fx && GA.fx.cubes && GA.fx.cubes.spawn ? GA.fx.cubes : null, dotAPI = !dry && GA.fx && GA.fx.dots && GA.fx.dots.spawn ? GA.fx.dots : null;
    var capC = o.cubes || G.capC, capD = o.dots || G.capD, totC = 0, totD = 0;
    for (i = 0; i < part.length; i++) { totC += part[i].ccN; totD += part[i].dsN; }
    var pk = min(1, capC / max(1, totC)), pd = min(1, capD / max(1, totC * (pk * 0.9 + (1 - pk) * 0.3) + totD * 0.5));
    var nCubes = 0, nDots = 0, kinds = ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'ring', 'square', 'tick'];
    var S0 = { x: 0, y: 0, vx: 0, vy: 0, front: false, bx: 0, by: 0, te: 0 }, vk = 1 + 0.25 * (speed - 1), girlX = G.cx, girlTop = G.cy - 190;
    function site(ii, it2, cu, cv) {      // erase time + world position / velocity of a site (interpolated between the item's pose knots)
      var mw2 = it2.mw, ix = clamp(floor((cu / it2.Lw + 0.5) * mw2), 0, mw2 - 1), iy = clamp(floor((cv / it2.Lh + 0.5) * it2.mh), 0, it2.mh - 1), te = it2.mT[iy * mw2 + ix], KN = it2.kn;
      var f = (te - it2.t0) / it2.dur * (NK - 1); if (f < 0) f = 0; var k0 = f | 0; if (k0 > NK - 2) k0 = NK - 2; f -= k0;
      var o0 = k0 * 7, o1 = o0 + 7, sc = KN[o0 + 2] + (KN[o1 + 2] - KN[o0 + 2]) * f;
      S0.te = te; S0.x = KN[o0] + (KN[o1] - KN[o0]) * f + cu * sc; S0.y = KN[o0 + 1] + (KN[o1 + 1] - KN[o0 + 1]) * f + cv * sc;
      S0.vx = KN[o0 + 3] + (KN[o1 + 3] - KN[o0 + 3]) * f; S0.vy = KN[o0 + 4] + (KN[o1 + 4] - KN[o0 + 4]) * f; S0.front = KN[o0 + 5] + (KN[o1 + 5] - KN[o0 + 5]) * f > CFG.FRONT_Z;
    }
    function burst(cu, cv, sp) {   // outward direction: mix of "away from her head" and "away from the item's centre"; result in S0.bx / S0.by
      var a1 = atan2(S0.y - G.hy, S0.x - G.hx), a2 = atan2(cv, cu), a = atan2(sin(a1) * 0.55 + sin(a2) * 0.45, cos(a1) * 0.55 + cos(a2) * 0.45) + rng.range(-0.5, 0.5);
      S0.bx = cos(a) * sp; S0.by = sin(a) * sp;
    }
    function g2() { return (rng.next() + rng.next() - 1) * 1.7; }       // cheap bell-shaped noise, about +-1.2 sigma
    function behindGirl(x, y, sz) { return abs(x - girlX) < CFG.GIRL_HW + 24 + sz && y > girlTop; }
    function spawnItem(i) {      // all the cubes / dots of one item (random stream consumed in item start order: independent of how the work is sliced over frames)
      var it = part[i], j;
      prepItem(it);
      for (j = 0; j < it.ccN; j++) {
        var cu = it.ccU[j], cv = it.ccV[j], cs = it.ccS[j], r = rng.next();
        if (r >= pk) {                                         // a site that lost its cube may still give a dot
          if (dotAPI && rng.next() < 0.3 * pd) {
            site(i, it, cu, cv); burst(cu, cv, rng.range(120, 460) * vk);
            dotAPI.spawn({ x: S0.x + rng.range(-0.5, 0.5) * cs, y: S0.y + rng.range(-0.5, 0.5) * cs, r: 1.3 + 3.2 * pow(rng.next(), 1.7), t0: S0.te + rng.range(0, 0.05),
              vx: S0.vx + S0.bx, vy: S0.vy + S0.by - rng.range(0, 90), kind: kinds[rng.int(0, kinds.length - 1)], z: (S0.front ? 1 : -1) * rng.range(0.15, 1), hover: rng.range(0.1, 0.45) / sqrt(speed) });
            nDots++;
          }
          continue;
        }
        site(i, it, cu, cv);
        var ink = it.ccI[j * 3 + (S0.te - it.t0 < it.dur * 0.33 ? 0 : S0.te - it.t0 < it.dur * 0.66 ? 1 : 2)];
        var size = clamp((3.5 + (CFG.SIZE_MAX - 3.5) * pow(rng.next(), 3)) * (0.6 + 0.4 * clamp(cs / 18, 0, 1.4)) * (0.8 + 0.4 * sqrt(clamp(ink * 3.5, 0, 1))), 3.5, CFG.SIZE_MAX);
        burst(cu, cv, rng.range(80, 380) * vk * (1.1 - 0.4 * size / CFG.SIZE_MAX));
        var cz = (S0.front ? 1 : -1) * rng.range(0.15, 1), kx = S0.x + rng.range(-0.18, 0.18) * cs, ky = S0.y + rng.range(-0.18, 0.18) * cs, kvx = S0.vx * 0.9 + S0.bx + g2() * 26;
        if (behindGirl(kx, ky, size)) { cz = -rng.range(0.3, 1); kvx += (kx < girlX ? -1 : 1) * 160; }      // never in front of her torso: behind her, and pushed away from her
        if (cubeAPI) cubeAPI.spawn({
          x: kx, y: ky, size: size, t0: S0.te, vx: kvx, vy: S0.vy * 0.9 + S0.by - rng.range(0, 150) + g2() * 26,
          spin: [rng.range(-7, 7), rng.range(-7, 7), rng.range(-6, 6)], rot0: [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)],
          z: cz, hover: rng.range(0.1, 0.5) / sqrt(speed),
        });
        nCubes++;
        if (dotAPI && rng.next() < 0.9 * pd) {
          burst(cu, cv, rng.range(120, 460) * vk);
          dotAPI.spawn({ x: S0.x + rng.range(-0.5, 0.5) * cs, y: S0.y + rng.range(-0.5, 0.5) * cs, r: 1.3 + 3.2 * pow(rng.next(), 1.7), t0: S0.te + rng.range(0, 0.05),
            vx: S0.vx + S0.bx, vy: S0.vy + S0.by - rng.range(0, 90), kind: kinds[rng.int(0, kinds.length - 1)], z: cz, hover: rng.range(0.1, 0.45) / sqrt(speed) });
          nDots++;
        }
      }
      for (j = 0; j < it.dsN; j++) {                           // paper-only cells: a little dust
        if (!dotAPI || rng.next() > 0.5 * pd) continue;
        site(i, it, it.dsU[j], it.dsV[j]); burst(it.dsU[j], it.dsV[j], rng.range(60, 260) * vk);
        dotAPI.spawn({ x: S0.x + rng.range(-0.5, 0.5) * it.dsS[j], y: S0.y + rng.range(-0.5, 0.5) * it.dsS[j], r: 1.2 + 2.2 * pow(rng.next(), 1.5), t0: S0.te,
          vx: S0.vx + S0.bx, vy: S0.vy + S0.by - rng.range(0, 60), kind: rng.next() < 0.8 ? 'dot' : 'ring', z: (S0.front ? 1 : -1) * rng.range(0.15, 1), hover: rng.range(0.1, 0.4) / sqrt(speed) });
        nDots++;
      }
    }
    var order = part.map(function (e, k) { return k; }).sort(function (p, q) { return part[p].t0 - part[q].t0 || p - q; });
    var job = G.job = { part: part, order: order, next: 0, spawnItem: spawnItem, stats: null };
    var last = 0; for (i = 0; i < part.length; i++) last = max(last, part[i].tEnd);
    job.stats = { items: part.length, get cubes() { return nCubes; }, get dots() { return nDots; }, lastDeath: last - t0, skipped: 0 };
    if (dry) {                                                   // undo: the real dissolve starts from a clean slate
      runJob(job, Infinity, Infinity);
      for (i = 0; i < part.length; i++) { part[i].t0 = Infinity; part[i].tEnd = Infinity; }
      G.job = null; G.shockT = Infinity; G.spawnEnd = -Infinity; G.lastT = NaN; refreshSpan();
      return { items: part.length, cubes: nCubes, dots: nDots, lastDeath: last - t0, skipped: 0 };
    }
    G.spawnEnd = max(G.spawnEnd, lastTe + 2.2);                  // hover (0.5) + fall through the bottom of the stage + margin
    G.lastT = NaN; refreshSpan();
    var skipped = 0; for (i = 0; i < items.length; i++) if (items[i].dead) skipped++;
    job.stats.skipped = skipped;
    runJob(job, t0 - 0.06, 0.5);                                 // only the item that starts first right now, the rest in the following frames (draw() / flushSpawn())
    return (G.lastResult = job.stats);
  }

  /** spawn the pending items of a dissolve job: always those that start before t + 0.06 s, then more while the time budget (ms) lasts */
  function runJob(job, t, budget) {
    var deadline = budget === Infinity ? Infinity : now() + budget, n = job.order.length, it;
    while (job.next < n) {
      it = job.part[job.order[job.next]];
      if (it.t0 - 0.06 > t && now() >= deadline) break;          // not due yet and the budget is used up
      job.spawnItem(job.order[job.next]); job.next++;
    }
    if (job.next >= n && job.stats) { var st = job.stats; job.stats = { items: st.items, cubes: st.cubes, dots: st.dots, lastDeath: st.lastDeath, skipped: st.skipped }; if (G.lastResult === st) G.lastResult = job.stats; G.info.cubes = job.stats.cubes; G.info.dots = job.stats.dots; G.info.lastDeath = job.stats.lastDeath; job.done = true; }
  }
  function flushSpawn() { if (G && G.job && !G.job.done) runJob(G.job, Infinity, Infinity); return G && G.lastResult; }

  function refreshSpan() {
    var i, last = 0, first = Infinity, it;
    for (i = 0; i < G.items.length; i++) { it = G.items[i]; if (it.dead) continue; if (it.tEnd > last) last = it.tEnd; if (it.tp < first) first = it.tp; }
    G.tFirst = first; G.tLast = last;
  }

  function reset(o) {
    if (!G) return;
    for (var i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      it.dead = false; it.t0 = Infinity; it.tEnd = Infinity; it.vis = false; it.cache = null; it.sc0 = 0;
    }
    G.job = null; G.lastResult = null; G.shockT = Infinity; G.spawnEnd = -Infinity; G.lastT = NaN; G.maxT = -Infinity;
    refreshSpan();
    if (o && o.schedule && isFinite(G.tHit)) { var r = dissolveFrom(G.tHit, { speed: 1, stagger: CFG.STAGGER }); G.info.cubes = r.cubes; G.info.dots = r.dots; G.info.lastDeath = r.lastDeath; }
  }

  function isActive(t) {
    if (!G) return false;
    var i, it;
    for (i = 0; i < G.items.length; i++) { it = G.items[i]; if (!it.dead && t >= it.tp && t < it.tEnd) return true; }
    return (G.job && !G.job.done) || (t >= G.shockT && t < G.spawnEnd);
  }

  // ------------------------------------------------------------------------------------------------ build
  function build(o) {
    o = o || {};
    var t00 = now(), S = GA.stage || {}, W = o.W || S.W || 2773, H = o.H || S.H || 780, groundY = S.groundY || (H - 80);
    var cx = o.cx !== undefined ? o.cx : W / 2, cy = o.cy !== undefined ? o.cy : groundY - 345;
    var tStart = o.tStart !== undefined ? o.tStart : 6.0, tFull = o.tFull !== undefined ? o.tFull : 12.8, tHit = o.tHit !== undefined ? o.tHit : Infinity;
    tFull = max(tFull, tStart + 3);
    if (isFinite(tHit)) tHit = max(tHit, tFull + 0.8);
    // cast rotation: a new cast once the previous one has been consumed (dissolved / run up to the hit); a resize rebuild keeps it
    if (o.variant !== undefined) GEN = o.variant | 0;
    else if (GEN < 0) GEN = 0;
    else if (G && (isFinite(G.shockT) || G.maxT >= G.tNom - 0.5)) GEN++;
    var gen = GEN, seed = o.seed === undefined ? 9 : o.seed, rng = U.rng(seed * 101 + gen * 17 + 1);
    var rxE = clamp(o.rx || min(0.27 * W, 780), 200, 0.47 * W), ryE = clamp(o.ry || 380, 150, 600);
    var vt = o.visTop !== undefined ? o.visTop : S.visTop !== undefined ? S.visTop : -0.14 * H, vb = o.visBottom !== undefined ? o.visBottom : S.visBottom !== undefined ? S.visBottom : 1.34 * H;
    var tNom0 = isFinite(tHit) ? tHit : tFull + 2.6, actOff = o.tAct0 !== undefined ? tStart - o.tAct0 : ACT_OFF, kScale = max(0.2, (tNom0 - tStart) / (ACT.END - actOff));   // the acts in loop seconds (see ACT / BEAT)
    G = {
      W: W, H: H, cx: cx, cy: cy, groundY: groundY, rx: rxE, ry: ryE, vt: vt, vb: vb, seed: seed, gen: gen,
      tStart: tStart, tFull: tFull, tHit: tHit, tNom: tNom0, actOff: actOff, kScale: kScale, hx: cx, hy: cy - 0.36 * CFG.GIRL_TOP,
      items: [], order: [], dir: -1, lastT: NaN, shockT: Infinity, spawnEnd: -Infinity, tFirst: Infinity, tLast: -Infinity, maxT: -Infinity,
      capC: o.cubes || CFG.CUBE_CAP, capD: o.dots || CFG.DOT_CAP, prepAt: -1e9, plan: null, planned: false, prepared: false, coreReady: false, armed: false, delay: 0, waited: 0, drawT: -Infinity, anIdx: 0, warmN: 0, warmGo: false, lastResult: null, job: null,
      info: { items: 0, names: [], roles: [], heroes: [], cast: '', variant: gen, spawn: [], cubes: 0, dots: 0, lastDeath: 0, missing: [], dir: -1, buildMs: 0 },
    };
    G.dir = detectDir(o.swirl || GA.swirl, cx, cy, tFull - 1.0);
    buildFlow();
    var sel = selectCast(W, gen), cast = sel.seq;
    if (!cast.length) { G.prepared = true; G.armed = true; G.coreReady = true; return; }
    var sizeK = clamp(pow(W / 2773, 0.5), 0.6, 1.08), i, all = [], times = [];
    for (i = 0; i < cast.length; i++) { times.push(tOfK(cast[i].kt)); all.push({ en: cast[i], ts: times[i], o: i }); }
    for (i = 0; i < sel.bursts.length; i++) all.push({ en: sel.bursts[i], ts: tOfK(sel.bursts[i].kt), o: 1000 + i });
    for (i = 4; i < cast.length; i++) {                                                                // CHURN: many small pieces live 3-7 s, fade, and a twin pops up elsewhere (a group's satellites a little longer)
      var en2 = cast[i];
      if (CHURN[en2.k] && en2.churn !== false && (i * 7 + 1) % 3 !== 0) {
        var Lf = (en2.churn === 'mate' ? 4.5 : 3.0) + 2.5 * rng.next(), t1 = times[i];
        if (t1 + Lf < G.tNom - 1.4) { en2.life = Lf; var tw = sel.twin(en2); tw.kt = kOf(t1 + Lf - 0.1); all.push({ en: tw, ts: t1 + Lf - 0.1, o: 2000 + i }); }
      }
    }
    all.sort(function (a, b) { return a.ts - b.ts || a.o - b.o; });
    for (i = 0; i < all.length; i++) { var it0 = makeItem(all[i].en, i, all[i].ts, sizeK, rng); all[i].en.item = it0; G.items.push(it0); }
    planInit(G.items, o);
    for (i = 0; i < G.items.length; i++) {
      var it = G.items[i]; G.order.push(it);
      G.info.names.push(it.name); G.info.roles.push(it.role); if (it.hero) G.info.heroes.push(it.name); G.info.spawn.push({ name: it.name, t: +it.ts.toFixed(2) });
    }
    G.info.items = G.items.length; G.info.dir = G.dir; G.info.env = { cx: cx, cy: cy, rx: rxE, ry: ryE, visTop: vt, visBottom: vb };
    G.info.acts = { turnFront1: +tOfK(0).toFixed(3), I: +tOfK(ACT.I).toFixed(3), II: +tOfK(ACT.II).toFixed(3), III: +tOfK(ACT.III).toFixed(3), IV: +tOfK(ACT.IV).toFixed(3), hit: +G.tNom.toFixed(3), kScale: +kScale.toFixed(4) };
    syncInfo();
    refreshSpan();
    if (isFinite(tHit) && o.autoDissolve !== false) {
      var r = dissolveFrom(tHit, { speed: 1, stagger: CFG.STAGGER });   // (forces the preparation: only used by demos / simple hosts)
      G.info.cubes = r.cubes; G.info.dots = r.dots; G.info.lastDeath = r.lastDeath;
    }
    G.info.buildMs = Math.round(now() - t00);
  }

  // ------------------------------------------------------------------------------------------------ drawing
  var KA = 1, KD = 1, TE = 0, TF = 0;     // main ctx transform of the current draw call
  function update(t) {
    if (t === G.lastT) return;
    G.lastT = t;
    if (t > G.maxT) G.maxT = t;
    var items = G.items, R = rint(t), i, it, ord = G.order, j, v;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      it.vis = !it.dead && t >= it.tp && t < it.tEnd && (t < it.tp + it.life || t >= it.t0);
      if (!it.vis) continue;
      it.age = t - it.tp;
      if (!it.ready) itemReady(it);                // (normally prepared long before; this is the safety net)
      poseInto(it, t, R, it.pose);
      it.front = it.dl >= 0 && it.pose.zn > CFG.FRONT_Z && it.age >= 0.7;           // the near half of the orbit is in front of the girl's layer, the far half behind her; a piece that has just popped out of her head comes out from BEHIND her (never over her body)
      it.zd = it.pose.zn + it.idx * 1e-4;
    }
    for (i = 1; i < ord.length; i++) {          // insertion sort (nearly sorted frame to frame): far items first
      v = ord[i];
      for (j = i - 1; j >= 0 && ord[j].zd > v.zd; j--) ord[j + 1] = ord[j];
      ord[j + 1] = v;
    }
  }

  /** the knockout canvas of an item (mw x mh, paper colour, alpha = the field); re-tinted when the theme's paper colour changes */
  function koCanvas(it) {
    var pr = ST().paperRGB || [250, 248, 243], key = (pr[0] << 16) | (pr[1] << 8) | pr[2];
    if (it.koCv && it.koKey === key) return it.koCv;
    if (!it.koCv) { it.koCv = document.createElement('canvas'); it.koCv.width = it.mw; it.koCv.height = it.mh; }
    var c = it.koCv.getContext('2d'), im = c.createImageData(it.mw, it.mh), d = im.data, A = it.koA, i, n = it.mw * it.mh;
    for (i = 0; i < n; i++) { d[i * 4] = pr[0]; d[i * 4 + 1] = pr[1]; d[i * 4 + 2] = pr[2]; d[i * 4 + 3] = A[i]; }
    c.putImageData(im, 0, 0); it.koKey = key;
    return it.koCv;
  }
  /** soft knockout behind a design piece (strength k in 0..1, scale ent while it springs in): the swirl lines behind it fade out, no box, no halo */
  function drawKnock(ctx, it, k, ent) {
    if (!it.knock || !it.koA || k < 0.02) return;
    var cv = koCanvas(it), po = it.pose, sc = po.sc * (ent === undefined ? 1 : ent), B = it.koB, fx = it.Lw * sc / it.mw, fy = it.Lh * sc / it.mh;
    if (fx * it.mw < 2) return;
    ctx.save(); ctx.globalAlpha *= CFG.KNOCK * k * it.alpha; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, B[0], B[1], B[2] - B[0], B[3] - B[1], po.x - it.Lw * 0.5 * sc + B[0] * fx, po.y - it.Lh * 0.5 * sc + B[1] * fy, (B[2] - B[0]) * fx, (B[3] - B[1]) * fy);
    ctx.restore();
  }

  function drawDirect(ctx, it, ent) {
    var po = it.pose, al = it.alpha * po.da;
    if (ent !== undefined && !it.useWipe) al *= sstep(0, 0.3, it.age);                   // (the wiped-in pieces fade through their wipe)
    if (it.life < 1e8) al *= 1 - sstep(it.life - 0.35, it.life, it.age);                  // a firework burns out
    if (al <= 0.004 || (ent !== undefined && ent < 0.03)) return;
    setProp(it, po, ent === undefined ? 1 : ent);
    ctx.save(); ctx.translate(po.x - it.ocx * P.s, po.y - it.ocy * P.s);
    if (al < 0.999) ctx.globalAlpha *= al;              // lifestyle items are lighter, far items a little lighter (plain globalAlpha: no offscreen group, no extra cost)
    it.def.draw(ctx, P);
    ctx.restore();
  }

  /** SPRITES.  The small pieces (supporting, books, hobbies, small design pieces) are drawn from a cached bitmap of the piece at its current device scale,
      re-rendered at SPR_HZ (SPR_HZ_FAST for the quick ones) or when its size has moved more than SPR_TOL, and blitted at integer device pixels every frame:
      the vector cost of the piece is paid ~12 times a second instead of 60. */
  var AT = { cv: null, cx: null, S: 0, x: 0, y: 0, rowH: 0, k: 0, kd: 0, full: false };
  function atlasReset() { AT.cv = null; AT.cx = null; AT.S = 0; AT.x = 0; AT.y = 0; AT.rowH = 0; AT.k = 0; AT.kd = 0; AT.full = false; if (G) for (var i = 0; i < G.items.length; i++) { G.items[i].sprite = null; } }
  function atlasInit() {                                     // size: the smallest power of two that holds every sprite cell (x1.45 for the shelf waste)
    var area = 0, i, it, S = 512;
    for (i = 0; i < G.items.length; i++) { it = G.items[i]; if (it.spr) area += (evenCeil(it.Lw * KA) + 2) * (evenCeil(it.Lh * KD) + 2); }
    while (S * S < area * 1.45 && S < 4096) S *= 2;
    AT.cv = document.createElement('canvas'); AT.cv.width = AT.cv.height = S; AT.cx = AT.cv.getContext('2d'); AT.S = S; AT.x = 0; AT.y = 0; AT.rowH = 0; AT.k = KA; AT.kd = KD; AT.full = false;
  }
  function atlasCell(W, H) {                                 // shelf allocator; null when full
    if (AT.x + W > AT.S) { AT.x = 0; AT.y += AT.rowH; AT.rowH = 0; }
    if (AT.y + H > AT.S) return null;
    var c = { x: AT.x, y: AT.y }; AT.x += W; if (H > AT.rowH) AT.rowH = H;
    return c;
  }
  function renderSprite(it, t) {
    var po = it.pose, W = evenCeil(it.Lw * KA), H = evenCeil(it.Lh * KD), sp = it.sprite, c;
    if (!AT.cv || AT.k !== KA || AT.kd !== KD) { atlasReset(); atlasInit(); sp = null; }
    if (!sp) { var cell = atlasCell(W + 2, H + 2); if (!cell) { it.spr = false; return null; } sp = it.sprite = { x: cell.x + 1, y: cell.y + 1, W: W, H: H, k: KA, kd: KD, t: 0, sc: 1, dt: 0.08 }; }
    c = AT.cx; c.save();
    c.beginPath(); c.rect(sp.x, sp.y, W, H); c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(sp.x, sp.y, W, H);
    c.setTransform(KA, 0, 0, KD, sp.x + W / 2, sp.y + H / 2);
    setProp(it, po, 1);
    c.translate(-it.ocx * P.s, -it.ocy * P.s);
    it.def.draw(c, P);
    c.restore();
    sp.k = KA; sp.kd = KD; sp.t = t; sp.sc = po.sc; sp.dt = 1 / (it.fast ? CFG.SPR_HZ_FAST : CFG.SPR_HZ_K[it.kind] || CFG.SPR_HZ);
    return sp;
  }
  /** once per frame, before anything is blitted: re-render the sprites that are due (they all go into the one atlas canvas) */
  function refreshSprites(t) {
    var items = G.items, i, it, sp;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (!it.vis || !it.spr || it.age < it.enter || t >= it.t0) continue;
      sp = it.sprite;
      if (!sp || AT.k !== KA || AT.kd !== KD || t - sp.t >= sp.dt || t < sp.t || abs(it.pose.sc / sp.sc - 1) > CFG.SPR_TOL) renderSprite(it, t);
    }
  }
  function drawSprite(ctx, it, t) {
    var po = it.pose, al = it.alpha * po.da, sp = it.sprite;
    if (it.life < 1e8) al *= 1 - sstep(it.life - 0.45, it.life, it.age);
    if (al <= 0.004) return;
    if (!sp || AT.k !== KA || AT.kd !== KD) { sp = renderSprite(it, t); if (!sp) { drawDirect(ctx, it); return; } }
    var k = po.sc / sp.sc, w = abs(k - 1) < 0.003 ? sp.W : sp.W * k, h = abs(k - 1) < 0.003 ? sp.H : sp.H * k, dx = round(KA * po.x + TE), dy = round(KD * po.y + TF);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (al < 0.999) ctx.globalAlpha *= al;
    ctx.drawImage(AT.cv, sp.x, sp.y, sp.W, sp.H, dx - w / 2, dy - h / 2, w, h);
    ctx.restore();
  }

  /** soft ground shadow under the design pieces (a pre-rendered ellipse: fainter and smaller the higher the piece floats) */
  var SHD = null;
  function shadowSprite() {
    if (SHD) return SHD;
    SHD = document.createElement('canvas'); SHD.width = 64; SHD.height = 24;
    var c = SHD.getContext('2d'), ink = ST().inkRGB || [21, 20, 18], g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + ink[0] + ',' + ink[1] + ',' + ink[2] + ',0.55)'); g.addColorStop(0.55, 'rgba(' + ink[0] + ',' + ink[1] + ',' + ink[2] + ',0.2)'); g.addColorStop(1, 'rgba(' + ink[0] + ',' + ink[1] + ',' + ink[2] + ',0)');
    c.setTransform(1, 0, 0, 0.375, 0, 0); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return SHD;
  }
  function drawShadows(ctx, t) {
    var ord = G.order, i, it, po, h, a, wd, ht, gy, sh = shadowSprite();
    ctx.save();
    for (i = 0; i < ord.length; i++) {
      it = ord[i];
      if (!it.vis || !it.shd || it.age < 0.2) continue;
      po = it.pose; gy = G.groundY + 6 + 22 * po.zn; h = gy - po.y; if (h < 8) continue;
      a = CFG.SHADOW * clamp(1.15 - h / 720, 0.12, 1) * sstep(0.2, 0.9, it.age) * it.dla; if (t >= it.t0) a *= 1 - sstep(0, 0.3, t - it.t0);
      if (a < 0.005) continue;
      wd = max(14, it.ex * po.sc * (0.95 - 0.3 * clamp(h / 720, 0, 1))); ht = wd * 0.13 + 3;
      ctx.globalAlpha = a; ctx.drawImage(sh, po.x - wd, gy - ht, 2 * wd, 2 * ht);
    }
    ctx.restore();
  }

  /** THREADS: taut hairlines that link a few nearby pieces like a mind map or a string model, drawing on, pulsing, a glint running along, then fading */
  function makeLinks() {
    var rng = U.rng(G.seed * 29 + G.gen * 7 + 3), its = G.items, n = its.length, out = [], tries = 0, pa = {}, pb = {}, k, a, b, tm, span, t0, dur, ok, d, gap, ts2, j, tether, tIII = tOfK(ACT.III);
    while (tries++ < 900) {
      tether = tries <= n;                                                                           // first every group (leader <-> satellite, right after the satellite pops), then random pairs in act III
      if (tether) { b = its[tries - 1]; a = b.lead; if (!a || b.dead) continue; } else { if (out.length >= CFG.LINKS) break; a = its[rng.int(0, n - 1)]; b = its[rng.int(0, n - 1)]; }
      if (a === b || a.life < 1e8 || (b.life < 1e8 && !tether) || (a.kind === 'M' && b.kind === 'M')) continue;
      tm = max(a.tp, b.tp) + (tether ? 0.45 : 0.7); if (!tether) tm = max(tm, tIII); span = min(G.tNom - 0.4, b.tp + b.life - 0.3) - tm; if (span < 1.1) continue;
      if (tether) { t0 = tm; dur = min(rng.range(2.6, 4.2), span); } else { t0 = tm + rng.range(0, span - 1.1); dur = rng.range(1.0, min(3.2, span - (t0 - tm))); }
      ok = true;
      for (k = 0; k < 3 && ok; k++) {
        ts2 = t0 + dur * k / 2; poseInto(a, ts2, rint(ts2), pa); poseInto(b, ts2, rint(ts2), pb);
        d = hypot(pa.x - pb.x, pa.y - pb.y); gap = d - 0.5 * max(a.bw, a.bh) - 0.5 * max(b.bw, b.bh);
        if (gap < 16 || gap > (tether ? 260 : 200) || d > (tether ? 520 : 440)) ok = false;
        else { for (j = 0; j <= 12 && ok; j++) { var qx = pa.x + (pb.x - pa.x) * j / 12, qy = pa.y + (pb.y - pa.y) * j / 12; if (abs(qx - G.cx) < 200 && qy > G.cy - 240) ok = false; } }       // (the thread never runs near her body or head)
      }
      for (j = 0; j < out.length && ok; j++) if ((out[j].a === a && out[j].b === b) || (out[j].a === b && out[j].b === a)) ok = false;
      if (ok) out.push({ a: a, b: b, t0: t0, t1: t0 + dur, ph: rng.range(0, TAU), sp: rng.range(0.8, 1.5), ra: 0.5 * min(a.bw, a.bh) * 0.9, rb: 0.5 * min(b.bw, b.bh) * 0.9, tether: tether });
    }
    out.sort(function (p, q) { return p.t0 - q.t0; });
    G.links = out;
  }
  function drawThreads(ctx, t) {
    var L = G.links, i, l, a, b, env, p, dx, dy, d, ux, uy, ax, ay, bx, by, pulse, q, S = ST();
    if (!L || !L.length) return;
    ctx.save(); ctx.lineCap = 'round';
    for (i = 0; i < L.length; i++) {
      l = L[i]; if (t < l.t0 || t > l.t1) continue;
      a = l.a; b = l.b; if (!a.vis || !b.vis || a.age < 0.5 || b.age < 0.5 || t >= a.t0 || t >= b.t0) continue;
      p = sstep(l.t0, l.t0 + 0.35, t); env = p * (1 - sstep(l.t1 - 0.35, l.t1, t)); if (env < 0.02) continue;
      dx = b.pose.x - a.pose.x; dy = b.pose.y - a.pose.y; d = hypot(dx, dy); if (d < 30) continue; ux = dx / d; uy = dy / d;
      ax = a.pose.x + ux * (l.ra * a.pose.sc + 4); ay = a.pose.y + uy * (l.ra * a.pose.sc + 4); bx = b.pose.x - ux * (l.rb * b.pose.sc + 4); by = b.pose.y - uy * (l.rb * b.pose.sc + 4);
      if ((bx - ax) * ux + (by - ay) * uy < 10) continue;
      pulse = 0.62 + 0.38 * sin(t * l.sp * 3.2 + l.ph);
      ctx.globalAlpha = (l.tether ? 0.8 : 0.62) * pulse * env; ctx.strokeStyle = l.tether ? (S.INK || '#111') : (S.GRAY1 || '#555'); ctx.lineWidth = l.tether ? 1.8 : 1.15;     // (a group's thread is bolder and in ink: the grouping reads at page scale)
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p); ctx.stroke();
      ctx.fillStyle = S.INK || '#111'; ctx.globalAlpha = 0.8 * env; ctx.beginPath(); ctx.arc(ax, ay, l.tether ? 3.0 : 2.3, 0, TAU);
      if (p > 0.98) { ctx.moveTo(bx + 2.3, by); ctx.arc(bx, by, 2.3, 0, TAU); }
      ctx.fill();
      if (p > 0.95) { q = (t * 0.5 * l.sp + l.ph) % 1; ctx.globalAlpha = 0.9 * env * pulse; ctx.beginPath(); ctx.arc(ax + (bx - ax) * q, ay + (by - ay) * q, 1.9, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  /** ENTRANCE.  The prop is rendered into the shared scratch canvas (the item's working rectangle) with its origin on a device-pixel grid,
      post-processed (diagonal draw-on wipe), and blitted 1:1 (no resampling, so it is as crisp as the direct vector drawing). */
  function drawEnter(ctx, it, t) {
    var po = it.pose, age = t - it.tp, ent = spring(age, it.sz, it.sw), alpha = it.alpha * po.da * sstep(0, 0.28, age);
    if (ent < 0.03 || alpha <= 0) return;
    var Wi = evenCeil(it.Lw * KA), Hi = evenCeil(it.Lh * KD), side = max(Wi, Hi);
    if (SC.need < side || !SC.cx) { SC.need = max(SC.need, side); ensureCanvas(SC, evenCeil(SC.need * 1.15), false); }
    var sx = SC.cx, dx = KA * po.x + TE, dy = KD * po.y + TF, rx = round(dx), ry = round(dy), ox = Wi / 2 + (dx - rx), oy = Hi / 2 + (dy - ry);
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, Wi, Hi);
    sx.setTransform(KA, 0, 0, KD, ox, oy);
    setProp(it, po, ent);
    sx.translate(-it.ocx * P.s, -it.ocy * P.s);
    it.def.draw(sx, P);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    var u = eOut3(age / it.wipeT);
    if (u < 1) {                 // diagonal "draw-on" wipe with a soft edge (only the alpha of the mask matters)
      var h = 0.5 * it.diag * po.sc * KA * ent, ux = cos(it.wipe), uy = sin(it.wipe), f = 0.4, q = u * (1 + f);
      var g = sx.createLinearGradient(ox - ux * h, oy - uy * h, ox + ux * h, oy + uy * h), s1 = clamp(q - f, 0, 1), s2 = clamp(q, 0, 1);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(s1, 'rgba(0,0,0,1)'); g.addColorStop(s2, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      sx.globalCompositeOperation = 'destination-in'; sx.fillStyle = g; sx.fillRect(0, 0, Wi, Hi); sx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.drawImage(SC.cv, 0, 0, Wi, Hi, rx - Wi / 2, ry - Hi / 2, Wi, Hi);
    ctx.restore();
  }

  /** DISSOLVE.  The item is rendered ONCE at its start (frozen pose, canonical time = its dissolve start) into a per-item bitmap; every frame that bitmap is
      translated (integer pixels: crisp), and while the front crosses it only the still-visible rectangle goes through a copy / erase-mask / blit pass.
      An untouched item is a plain blit, an item whose mask has swallowed everything costs nothing (its cubes carry on). */
  function drawDissolve(ctx, it, t) {
    var po = it.pose, al = it.alpha * po.da;
    if (!it.fieldOK) { prepItem(it); if (it.cache) it.cache = null; }
    if (!it.mImg || !MK.cx) return;
    var st = fillMask(it, t);
    if (st === 2) return;
    var c = it.cache;
    if (!c || c.k !== KA || c.kd !== KD || c.te !== TE || c.tf !== TF) c = it.cache = buildCache(it);
    var q = c.q, dx = KA * po.x + TE, dy = KD * po.y + TF, ix = round(c.rx0 - c.Wc / (2 * q)) + round(dx - c.dx0), iy = round(c.ry0 - c.Hc / (2 * q)) + round(dy - c.dy0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (al < 0.999) ctx.globalAlpha *= al;
    if (st === 0) { if (q === 1) ctx.drawImage(c.cv, ix, iy); else { ctx.imageSmoothingEnabled = true; ctx.drawImage(c.cv, ix, iy, c.Wc / q, c.Hc / q); } }
    else {
      var mw = it.mw, mh = it.mh, fx = c.Wc / mw, fy = c.Hc / mh;
      var px0 = max(0, floor(it.bx0 * fx) - 2), py0 = max(0, floor(it.by0 * fy) - 2), px1 = min(c.Wc, ceil(it.bx1 * fx) + 2), py1 = min(c.Hc, ceil(it.by1 * fy) + 2), w = px1 - px0, h = py1 - py0;
      if (w > 0 && h > 0) {
        var side = max(c.Wc, c.Hc);
        if (WK.w < side || !WK.cx) ensureCanvas(WK, evenCeil(side * 1.1), false);
        var wx = WK.cx;
        MK.cx.putImageData(it.mImg, 0, 0);
        wx.globalCompositeOperation = 'copy';
        wx.drawImage(c.cv, px0, py0, w, h, 0, 0, w, h);
        wx.globalCompositeOperation = 'destination-out';
        wx.imageSmoothingEnabled = true; wx.imageSmoothingQuality = 'low';
        wx.drawImage(MK.cv, px0 / fx, py0 / fy, w / fx, h / fy, 0, 0, w, h);
        wx.globalCompositeOperation = 'source-over';
        if (q === 1) ctx.drawImage(WK.cv, 0, 0, w, h, ix + px0, iy + py0, w, h);
        else { ctx.imageSmoothingEnabled = true; ctx.drawImage(WK.cv, 0, 0, w, h, ix + px0 / q, iy + py0 / q, w / q, h / q); }
      }
    }
    ctx.restore();
  }
  /** the item's bitmap at the canonical moment (its dissolve start): a pure function of the item, the device scale and the stage transform */
  function buildCache(it) {
    var q = clamp(CFG.DISS_PX / max(KA, KD), 0.7, 1), po0 = poseInto(it, it.t0, rint(it.t0), {}), Wc = evenCeil(it.Lw * KA * q), Hc = evenCeil(it.Lh * KD * q), cv = it.ccv || (it.ccv = document.createElement('canvas'));      // (q < 1 on dense screens: the dissolving item is in motion and fading, a slightly softer bitmap is invisible)
    if (cv.width !== Wc || cv.height !== Hc) { cv.width = Wc; cv.height = Hc; }
    var cx = cv.getContext('2d'), dx = KA * po0.x + TE, dy = KD * po0.y + TF, rx = round(dx), ry = round(dy);
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, Wc, Hc);
    cx.setTransform(KA * q, 0, 0, KD * q, Wc / 2 + (dx - rx) * q, Hc / 2 + (dy - ry) * q);
    setProp(it, po0, 1);
    cx.translate(-it.ocx * P.s, -it.ocy * P.s);
    it.def.draw(cx, P);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    return { cv: cv, k: KA, kd: KD, te: TE, tf: TF, q: q, Wc: Wc, Hc: Hc, rx0: rx, ry0: ry, dx0: dx, dy0: dy };
  }

  /** ring + a handful of dots bursting out of a freshly popped item */
  function drawPop(ctx, it, age) {
    var T = it.wipeT * 1.1, u = age / T;
    if (u >= 1 || u < 0) return;
    var e = eOut3(u), po = it.pose, R = min(0.52 * it.diag * po.sc, CFG.POP_R), i, a, r, n = 8, sty = ST();
    ctx.save();
    ctx.lineWidth = 1.7 * (1 - u) + 0.3; ctx.strokeStyle = sty.GRAY2 || '#8f8f95'; ctx.globalAlpha = 0.85 * (1 - u);
    ctx.beginPath(); ctx.arc(po.x, po.y, R * (0.25 + 0.75 * e), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = sty.INK || '#111'; ctx.beginPath();
    for (i = 0; i < n; i++) {
      a = it.pa + i * TAU / n + 0.35 * sin(i * 7.13); r = (2.0 + 2.6 * (0.5 + 0.5 * sin(i * 3.7 + it.pa))) * (1 - u) * (1 - u * 0.4);
      var rad = R * (0.35 + (0.62 + 0.3 * (0.5 + 0.5 * sin(i * 5.3))) * e);
      ctx.moveTo(po.x + cos(a) * rad + r, po.y + sin(a) * rad); ctx.arc(po.x + cos(a) * rad, po.y + sin(a) * rad, r, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }

  /** once per frame: the deferred preparation.  Before the first pop it works in small slices; when the first pop is due and the cast is not ready
      the thoughts' own clock WAITS: nothing has popped yet, G.delay grows by the frame step (all the pops move later), every frame spends WAIT_MS on the
      preparation, and the pops that are left are squeezed to still end before the hit when it is done (order kept).  The dissolve stays tied to the host's t0.
      A jump in t (seek, first frame after a pause) completes the preparation synchronously instead (deterministic). */
  function frameLogic(t) {
    var dtf = t - G.drawT, tn = now(); G.drawT = t;
    if (G.armed || isFinite(G.shockT)) { if (!G.prepared && tn - G.prepAt > 6) { prepStep(CFG.PREP_MS); G.prepAt = now(); } return; }
    if (t < G.tFirst) { if (tn - G.prepAt > 6) { prepStep(t > G.tFirst - 0.3 ? CFG.WAIT_MS : CFG.PREP_MS); G.prepAt = now(); } return; }
    if (dtf > 0 && dtf <= CFG.WAIT_DT) {                    // the first pop is due and the cast is not ready: wait
      setDelay(G.delay + (t - G.tFirst)); G.waited += dtf;
      prepStep(CFG.WAIT_MS); G.prepAt = now();
      if (G.armed) compressTail(t);
    } else { planStep(Infinity); prepStep(Infinity); }
  }
  /** info.spawn / info.beats follow the real pop times (after a wait for the preparation or a tail compression).  beats = the SYNC POINTS for the girl's performance:
      {kind: 'hero' | 'bulb' | 'firework', name, t: loop seconds, k: seconds after turnFront1 (= t - info.acts.turnFront1), sync: a scripted beat (the extra bursts are not)} */
  function syncInfo() {
    var i, it, b = [];
    for (i = 0; i < G.items.length; i++) {
      it = G.items[i]; G.info.spawn[i].t = +it.tp.toFixed(2);
      if (it.dead) continue;
      if (it.hero) b.push({ kind: 'hero', name: it.name, t: +it.tp.toFixed(2), k: +kOf(it.tp).toFixed(2), sync: true });
      else if (it.kind === 'I') b.push({ kind: 'bulb', name: it.name, t: +it.tp.toFixed(2), k: +kOf(it.tp).toFixed(2), sync: true });
      else if (it.kind === 'F') b.push({ kind: 'firework', name: it.name, t: +it.tp.toFixed(2), k: +kOf(it.tp).toFixed(2), sync: !!it.sync });
    }
    b.sort(function (p, q) { return p.t - q.t; });
    G.info.beats = b; G.info.delay = +G.delay.toFixed(3);
  }
  function setDelay(d) {
    G.delay = d; var i;
    for (i = 0; i < G.items.length; i++) G.items[i].tp = G.items[i].ts + d;
    syncInfo(); G.lastT = NaN; refreshSpan();
  }
  /** after a wait: the pops that are still to come are squeezed (same order, same relative rhythm, at least 0.2 s apart) so the last one is still ~1.5 s before the hit */
  function compressTail(t) {
    var lim = G.tNom - CFG.SPAWN_LAST, list = [], i, it;
    for (i = 0; i < G.items.length; i++) { it = G.items[i]; if (!it.dead && it.tp > t && it.kind !== 'I' && !it.sync) list.push(it); }     // (the sync beats - bulbs, scripted fireworks - keep their time + the uniform delay)
    if (list.length < 2) return;
    list.sort(function (a, b) { return a.tp - b.tp || a.idx - b.idx; });
    var first = max(list[0].tp, t + 0.05), last = list[list.length - 1].tp;
    if (last <= lim) return;
    var f = max(0.2, (lim - first) / (last - first)), prev = -1e9, t0 = list[0].tp;
    for (i = 0; i < list.length; i++) {
      it = list[i]; it.tp = max(first + (it.tp - t0) * f, prev + 0.03); prev = it.tp;
      if (it.tp > lim + 0.3) it.dead = true;                  // (only with an extreme delay: it would pop too close to the hit)
    }
    syncInfo(); G.lastT = NaN; refreshSpan();
  }

  function draw(ctx, t, layer) {
    if (!G || !G.items.length) return;
    if (t !== G.drawT) frameLogic(t);
    if (!G.armed && !isFinite(G.shockT)) { G.lastT = NaN; return; }          // the first pop waits until the cast is ready (see frameLogic)
    if (G.job && !G.job.done && G.job.t !== t) { G.job.t = t; runJob(G.job, t, CFG.SPAWN_MS); }      // the rest of a dissolve's cubes / dots: a little each frame
    if (t < G.tFirst || t >= G.tLast) return;
    update(t);
    var m = ctx.getTransform ? ctx.getTransform() : null, S = GA.stage || {};
    KA = m ? m.a : (S.px || 1); KD = m ? m.d : (S.px || 1); TE = m ? m.e : 0; TF = m ? m.f : ((S.offsetY || 0) * (S.dpr || 1));
    var ord = G.order, i, it, wantFront = layer === 'front', both = layer !== 'front' && layer !== 'back';
    if (G.sprT !== t) { G.sprT = t; refreshSprites(t); }
    ctx.save();
    if (both || !wantFront) { drawShadows(ctx, t); drawThreads(ctx, t); }
    for (i = 0; i < ord.length; i++) {
      it = ord[i];
      if (!it.vis) continue;
      if (it.knock && (both || !wantFront)) {                                   // the soft paper knockout is always drawn in the back pass (under the girl: it can never cover her)
        if (t >= it.t0) drawKnock(ctx, it, 1 - sstep(0, 1, (t - it.t0) / (it.dur * 0.7)));
        else if (it.age < it.enter) drawKnock(ctx, it, sstep(0.1, 0.5, it.age), spring(it.age, it.sz, it.sw));
        else drawKnock(ctx, it, 1);
      }
      if (!both && it.front !== wantFront) continue;
      if (t >= it.t0) drawDissolve(ctx, it, t);
      else if (it.age < it.enter) {
        if (it.useWipe) {
          if (it.age < it.wipeT) drawEnter(ctx, it, t);                      // the draw-on wipe needs the scratch canvas (at most two items at a time)
          else drawDirect(ctx, it, spring(it.age, it.sz, it.sw));            // afterwards the spring settles on a plain vector draw
          drawPop(ctx, it, it.age);
        } else drawDirect(ctx, it, spring(it.age, it.sz, it.sw));
      }
      else if (it.spr) drawSprite(ctx, it, t);
      else drawDirect(ctx, it);
    }
    ctx.restore();
  }

  /** the device pixel ratio / canvas resolution changed (quality governor): drops ONLY the px-dependent caches (the scratch + work canvases and the per-item
      dissolve bitmaps); layout, item state, entrance and dissolve state, analysis and erase fields (all in world units) are untouched.  The canvases are sized
      again by the next prepare() slice (or at first use), the bitmaps when an item next dissolves / is drawn dissolving.  Idempotent, ~0.1 ms. */
  function rescale() {
    function drop(h) { if (h.cv) { h.cv.width = h.cv.height = 1; } h.cx = null; h.w = 0; }
    drop(SC); drop(WK); SC.need = 0;
    if (!G) return true;
    for (var i = 0; i < G.items.length; i++) { G.items[i].cache = null; G.items[i].sprite = null; if (i === G.items.length - 1) atlasReset(); if (G.items[i].ccv) G.items[i].ccv.width = G.items[i].ccv.height = 1; }
    if (G.coreReady) { G.prepared = false; G.warmN = max(G.warmN, CFG.WARM_RUNS); }      // (the next prepare() slice re-allocates the scratch canvas)
    G.lastT = NaN;
    return true;
  }

  /** GPU warm-up: exercises every composite / gradient / blit variant the show uses, on tiny regions at near-zero alpha (top-left corner of the canvas:
      the extension above the band, masked out by CSS) and on small private canvases, so Skia / ANGLE compile their pipelines during the walk-in and not at
      the first pop or the shatter.  Call it once per frame for a few frames: warmGPU(ctx, 6); returns true when finished.  Invisible, deterministic. */
  var WARM = { n: 0, done: false, a: null, b: null, m: null };
  function warmGPU(ctx, frames) {
    if (WARM.done || typeof document === 'undefined') return true;
    if (!WARM.a) {
      WARM.a = document.createElement('canvas'); WARM.b = document.createElement('canvas'); WARM.m = document.createElement('canvas');
      WARM.a.width = WARM.a.height = WARM.b.width = WARM.b.height = 192; WARM.m.width = WARM.m.height = 12;
    }
    var stages = WARM_STAGES, per = max(1, ceil(stages.length / max(1, frames | 0 || 6))), k;
    for (k = 0; k < per && WARM.n < stages.length; k++) stages[WARM.n++](ctx);
    if (WARM.n >= stages.length && ctx && G && G.items && G.items.length && !WARM.big) {
      WARM.big = 1;
      var S0 = GA.stage || {}, m0 = ctx.getTransform ? ctx.getTransform() : null; KA = m0 ? m0.a : (S0.px || 1); KD = m0 ? m0.d : (S0.px || 1);
      if (!AT.cv || AT.k !== KA || AT.kd !== KD) { atlasReset(); atlasInit(); }
      AT.cx.setTransform(1, 0, 0, 1, 0, 0); AT.cx.clearRect(0, 0, 3, 3); AT.cx.fillStyle = 'rgba(0,0,0,0.01)'; AT.cx.fillRect(0, 0, 2, 2);
      wBlit(ctx, AT.cv, 3, 3, false, 1);
      if (SC.cv && SC.cx) wBlit(ctx, SC.cv, 3, 3, false, 1);
      return false;
    }
    if (WARM.n >= stages.length) { WARM.done = true; WARM.a.getContext('2d').clearRect(0, 0, 48, 48); }
    return WARM.done;
  }
  function wBlit(ctx, src, w, h, smooth, scale) {              // blit a private canvas into the real canvas corner at ~2 % alpha (the next frame clears it)
    if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.01; ctx.imageSmoothingEnabled = !!smooth;
    ctx.drawImage(src, 0, 0, w, h, 0, 0, w * (scale || 1), h * (scale || 1));
    ctx.restore();
  }
  var WARM_STAGES = [
    function (ctx) {                                            // entrance wipe: linear gradient + destination-in, then the 1:1 blit
      var c = WARM.a.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 48, 48); c.fillStyle = '#222'; c.fillRect(4, 4, 36, 36);
      var g = c.createLinearGradient(0, 0, 48, 48); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.4, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, 48, 48); c.globalCompositeOperation = 'source-over';
      wBlit(ctx, WARM.a, 32, 32, false, 1);
    },
    function (ctx) {                                            // dissolve: putImageData mask, 'copy' composite, destination-out masked drawImage (smoothed, upscaled), blit
      var m = WARM.m.getContext('2d'), im = m.createImageData(12, 12), u = new Uint32Array(im.data.buffer), i;
      for (i = 0; i < 144; i++) u[i] = ((i * 7) % 256) << 24;
      m.putImageData(im, 0, 0);
      var a = WARM.a.getContext('2d'), b = WARM.b.getContext('2d');
      a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, 48, 48); a.fillStyle = '#333'; a.fillRect(2, 2, 40, 40);
      b.globalCompositeOperation = 'copy'; b.drawImage(WARM.a, 4, 4, 40, 40, 0, 0, 40, 40);
      b.globalCompositeOperation = 'destination-out'; b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'low'; b.drawImage(WARM.m, 0.5, 0.5, 11, 11, 0, 0, 40, 40);
      b.globalCompositeOperation = 'source-over';
      wBlit(ctx, WARM.b, 40, 40, true, 1.2);
    },
    function (ctx) {                                            // radial gradient fill (soft shadows, the knockout's relatives), source-over with alpha
      var c = WARM.a.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 48, 48);
      var g = c.createRadialGradient(24, 24, 0, 24, 24, 24); g.addColorStop(0, 'rgba(30,30,34,0.5)'); g.addColorStop(0.6, 'rgba(30,30,34,0.2)'); g.addColorStop(1, 'rgba(30,30,34,0)');
      c.fillStyle = g; c.fillRect(0, 0, 48, 48); c.globalAlpha = 0.5; c.fillStyle = '#556'; c.beginPath(); c.arc(24, 24, 10, 0, TAU); c.fill(); c.globalAlpha = 1;
      wBlit(ctx, WARM.a, 48, 48, true, 1);
    },
    function (ctx) {                                            // dashed + round-capped strokes, arcs, curves (props_d / swirl)
      var c = WARM.a.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 48, 48);
      c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#222'; c.lineWidth = 1.5; c.setLineDash([4, 3]);
      c.beginPath(); c.arc(24, 24, 16, 0.2, 4.5); c.stroke(); c.setLineDash([]); c.lineWidth = 3;
      c.beginPath(); c.moveTo(4, 40); c.bezierCurveTo(14, 4, 34, 44, 44, 8); c.stroke();
      c.fillStyle = '#111'; c.beginPath(); c.moveTo(6, 6); c.lineTo(20, 8); c.lineTo(12, 20); c.closePath(); c.fill();
      wBlit(ctx, WARM.a, 48, 48, false, 1);
    },
    function (ctx) {                                            // the soft paper knockout: smoothed, scaled drawImage with alpha straight onto the real canvas; integer-pixel cache blit
      if (!ctx) return;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.01; ctx.imageSmoothingEnabled = true; ctx.drawImage(WARM.m, 0, 0, 40, 30); ctx.imageSmoothingEnabled = false; ctx.drawImage(WARM.a, 0, 0, 48, 48, 0, 0, 24, 24); ctx.restore();
    },
  ];

  /** RUNTIME SELF-TEST.  Over the whole loop (first pop .. the end of the dissolve start) it measures, in world units, the worst excursion of any item's drawn box
      outside the VISIBLE canvas [0,W] x [visTop,visBottom] (entrance overshoot, bob, tumble margin and the dissolve's outward push included), and of any
      item's centre outside the vortex envelope ellipse.  Target: 0 and 0.  o: {step: s (0.05), W, visTop, visBottom, dissolveAt}.
      Returns {maxOutsideCanvas, maxOutsideEnvelope, maxAboveBand, maxBelowGround, worst:{name, t, what}, samples, items, ok}. */
  function testBounds(o) {
    if (!G || !G.items.length) return null;
    if (G.plan && !G.plan.done) planStep(Infinity);
    o = o || {};
    var W = o.W || G.W, vt = o.visTop !== undefined ? o.visTop : G.vt, vb = o.visBottom !== undefined ? o.visBottom : G.vb, step = o.step || 0.05, sched = isFinite(G.shockT);
    var tD = o.dissolveAt !== undefined ? o.dissolveAt : sched ? G.shockT : G.tNom + 0.04;
    var res = { maxOutsideCanvas: 0, maxOutsideEnvelope: 0, maxAboveBand: 0, maxBelowGround: 0, worst: null, samples: 0, items: 0, ok: true }, pose = {}, pd = {}, i, it, t, tEnd, age, ent, f, cz, sn, ex, ey, exc, eyc, x, y, out, popr, nr, dx, dy, ux, uy, dl, gg, gdt;
    function note(v, name, t2, what, key) { if (v > res[key]) { res[key] = v; if (key === 'maxOutsideCanvas' || !res.worst) res.worst = { name: name, t: +t2.toFixed(2), what: what, v: +v.toFixed(1) }; } }
    for (i = 0; i < G.items.length; i++) {
      it = G.items[i]; if (it.dead) continue;
      res.items++;
      poseInto(it, tD, rint(tD), pd);
      dx = pd.x - G.hx; dy = pd.y - G.hy; dl = hypot(dx, dy) || 1; ux = dx / dl; uy = dy / dl;
      tEnd = sched && isFinite(it.t0) ? it.t0 + 0.9 : tD + 0.9; if (it.life < 1e8) tEnd = min(tEnd, it.tp + it.life);
      for (t = it.tp; t <= tEnd; t += step) {
        poseInto(it, t, rint(t), pose);
        age = t - it.tp; ent = age < it.enter ? max(1, spring(age, it.sz, it.sw)) : 1;
        f = pose.sc * ent * 1.04; x = pose.x; y = pose.y; popr = age < it.wipeT * 1.1 ? 1.3 * min(0.52 * it.diag * pose.sc, CFG.POP_R) + 5 : 0;
        if (!sched && t > tD) { gg = 1 - exp(-(t - tD) / 0.4); x += ux * 70 * gg; y += uy * 70 * gg; f *= 1 + 0.05 * sstep(0, 0.3, t - tD); }
        cz = abs(cos(pose.rz)); sn = abs(sin(pose.rz));
        ex = 0.5 * (it.bw * cz + it.bh * sn) * f; ey = 0.5 * (it.bw * sn + it.bh * cz) * f;
        exc = max(ex, popr); eyc = max(ey, popr);
        out = max(0, exc - x, x + exc - W, vt - (y - eyc), (y + eyc) - vb);
        note(out, it.name, t, 'canvas', 'maxOutsideCanvas');
        dx = (x - G.cx) / G.rx; dy = (y - G.cy) / G.ry; nr = sqrt(dx * dx + dy * dy);
        if (nr > 1 && t <= tD) note((nr - 1) * hypot(x - G.cx, y - G.cy) / nr, it.name, t, 'envelope', 'maxOutsideEnvelope');
        if (t <= tD) { note(max(0, -(y - ey)), it.name, t, 'band-top', 'maxAboveBand'); note(max(0, (y + ey) - G.groundY), it.name, t, 'ground', 'maxBelowGround'); }
        res.samples++;
      }
    }
    res.maxOutsideCanvas = +res.maxOutsideCanvas.toFixed(2); res.maxOutsideEnvelope = +res.maxOutsideEnvelope.toFixed(2);
    res.maxAboveBand = +res.maxAboveBand.toFixed(1); res.maxBelowGround = +res.maxBelowGround.toFixed(1);
    res.ok = res.maxOutsideCanvas <= 0.5 && res.maxOutsideEnvelope <= 0.5;
    return res;
  }

  GA.thoughts = {
    build: build,
    testBounds: testBounds,
    draw: draw,
    prepare: function (budgetMs) { return prepStep(budgetMs === undefined ? CFG.PREP_MS : budgetMs); },
    isReady: function () { return !G || G.prepared; },
    isCoreReady: function () { return !G || G.coreReady || G.prepared; },
    warmGPU: warmGPU,
    rescale: rescale,
    dissolveFrom: dissolveFrom,
    flushSpawn: flushSpawn,
    reset: reset,
    isActive: isActive,
    cfg: CFG,
    casts: CASTS,
    info: function () { return G ? G.info : null; },
    debug: function () { return G; },
    itemsAt: function (t) {
      if (!G) return [];
      if (G.plan && !G.plan.done) planStep(Infinity);
      update(t);
      var out = [];
      for (var i = 0; i < G.items.length; i++) {
        var it = G.items[i]; if (!it.vis) continue;
        out.push({ name: it.name, role: it.role, hero: it.hero, x: it.pose.x, y: it.pose.y, s: it.s * it.pose.sc, ex: it.ex, ey: it.ey, front: it.front, age: t - it.tp, state: t >= it.t0 ? 'crumble' : t - it.tp < it.enter ? 'enter' : 'orbit' });
      }
      return out;
    },
  };
})();


GA.heavyLoaded = true;
if (GA.onHeavyLoaded) GA.onHeavyLoaded();
})();
