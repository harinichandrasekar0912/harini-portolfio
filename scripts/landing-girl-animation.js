/* landing-girl-animation.js — interactive landing animation (canvas, no dependencies).
   Mounts into [data-landing-girl-animation]; reads --color-ink / --color-paper from :root.
   Public contract used by scripts/navigation-ball.js: window.landingGirlAnimation = { isLandingActive, handlePlusDistraction, getState }.
   Core of the landing animation: 13 modules. The thought cloud (props, swirl, thoughts) is loaded after the first frame from landing-girl-thoughts.js. */
(function () {
"use strict";
var GA = (window.__landingGirl = window.__landingGirl || {});
/* ===== util.js ===== */
/* Shared math / drawing helpers. Classic script (no modules) so it works from file://.
   Everything hangs off window.__landingGirl. Load this FIRST. */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = (GA.util = GA.util || {});
  var TAU = Math.PI * 2;

  U.TAU = TAU;
  U.clamp = function (v, a, b) {
    if (a === undefined) { a = 0; b = 1; }
    return v < a ? a : v > b ? b : v;
  };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.invLerp = function (a, b, v) { return (v - a) / (b - a); };
  /** remap v from [a,b] to [c,d]; clamped unless cl===false */
  U.remap = function (v, a, b, c, d, cl) {
    var t = (v - a) / (b - a);
    if (cl !== false) t = t < 0 ? 0 : t > 1 ? 1 : t;
    return c + (d - c) * t;
  };
  U.smoothstep = function (a, b, x) {
    var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t);
  };
  U.smootherstep = function (a, b, x) {
    var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * t * (t * (t * 6 - 15) + 10);
  };
  U.mod = function (a, n) { return ((a % n) + n) % n; };
  U.dist = function (ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); };
  U.lerpAngle = function (a, b, t) {
    var d = U.mod(b - a + Math.PI, TAU) - Math.PI; return a + d * t;
  };

  // ---- easings (t in 0..1, clamped) ----
  var c01 = U.clamp;
  U.easeInQuad = function (t) { t = c01(t); return t * t; };
  U.easeOutQuad = function (t) { t = c01(t); return 1 - (1 - t) * (1 - t); };
  U.easeInOutQuad = function (t) { t = c01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  U.easeInCubic = function (t) { t = c01(t); return t * t * t; };
  U.easeOutCubic = function (t) { t = c01(t); return 1 - Math.pow(1 - t, 3); };
  U.easeInOutCubic = function (t) { t = c01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  U.easeInOutSine = function (t) { t = c01(t); return -(Math.cos(Math.PI * t) - 1) / 2; };
  U.easeOutSine = function (t) { t = c01(t); return Math.sin((t * Math.PI) / 2); };
  U.easeInOutQuint = function (t) { t = c01(t); return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2; };
  U.easeOutBack = function (t, s) { t = c01(t); s = s === undefined ? 1.70158 : s; var c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  U.easeInBack = function (t, s) { t = c01(t); s = s === undefined ? 1.70158 : s; var c3 = s + 1; return c3 * t * t * t - s * t * t; };
  U.easeOutElastic = function (t) {
    t = c01(t); if (t === 0 || t === 1) return t; var c4 = TAU / 3; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };
  U.easeOutBounce = function (t) {
    t = c01(t); var n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  };
  /** 0..1..0 bump: rises over [a,b], holds, falls over [c,d] */
  U.pulse = function (t, a, b, c, d) { return U.smoothstep(a, b, t) * (1 - U.smoothstep(c, d, t)); };

  // ---- deterministic random ----
  U.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** rng object: next(), range(a,b), int(a,b) inclusive, pick(arr), sign(), gauss() */
  U.rng = function (seed) {
    var f = U.mulberry32(seed === undefined ? 1 : seed);
    return {
      next: f,
      range: function (a, b) { return a + (b - a) * f(); },
      int: function (a, b) { return a + Math.floor(f() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(f() * arr.length)]; },
      sign: function () { return f() < 0.5 ? -1 : 1; },
      gauss: function () { var u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); },
    };
  };
  function hash1(n, seed) {
    var h = (n * 374761393 + (seed | 0) * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  /** smooth 1D value noise in [-1,1] */
  U.noise1 = function (x, seed) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    var a = hash1(i, seed || 0) * 2 - 1, b = hash1(i + 1, seed || 0) * 2 - 1;
    return a + (b - a) * u;
  };
  /** smooth 2D value noise in [-1,1] */
  U.noise2 = function (x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    function h(a, b) { return hash1(a * 73856093 ^ b * 19349663, seed || 0) * 2 - 1; }
    var a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
  };

  // ---- curves ----
  /** Catmull-Rom through pts [{x,y}] -> dense polyline [{x,y}] */
  U.catmull = function (pts, seg, closed) {
    seg = seg || 8;
    var n = pts.length, out = [];
    if (n < 2) return pts.slice();
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      var p1 = pts[i];
      var p2 = pts[closed ? (i + 1) % n : i + 1];
      var p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      for (var s = 0; s < seg; s++) {
        var t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    if (!closed) out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
    return out;
  };
  /** Adds a smooth path through pts (quadratic curves through midpoints) to ctx's current path. Does not fill/stroke. */
  U.smoothPath = function (ctx, pts, closed) {
    var n = pts.length;
    if (n < 2) return;
    if (!closed) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < n - 1; i++) {
        var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    } else {
      var m0x = (pts[n - 1].x + pts[0].x) / 2, m0y = (pts[n - 1].y + pts[0].y) / 2;
      ctx.moveTo(m0x, m0y);
      for (var j = 0; j < n; j++) {
        var a = pts[j], b = pts[(j + 1) % n];
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      ctx.closePath();
    }
  };
  U.polylineLength = function (pts) {
    var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L;
  };
  /** point + tangent angle at arclength s along polyline */
  U.pointAt = function (pts, s) {
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + d >= s || i === pts.length - 1) {
        var t = d ? (s - acc) / d : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, a: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) };
      }
      acc += d;
    }
    return { x: pts[0].x, y: pts[0].y, a: 0 };
  };

  /** Fill a variable-width ribbon along dense polyline pts [{x,y}]. widths: number[] (full width per point) or fn(u,i)->width.
      Round caps at both ends (opts.caps !== false). Uses current fillStyle. This is the tool for "fluid line-weight" strokes. */
  U.ribbon = function (ctx, pts, widths, opts) {
    var n = pts.length;
    if (n < 2) return;
    var caps = !(opts && opts.caps === false);
    var L = new Array(n), R = new Array(n), W = new Array(n);
    for (var i = 0; i < n; i++) {
      var p = pts[i], a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      var w = (typeof widths === 'function' ? widths(i / (n - 1), i) : widths[i]) * 0.5;
      if (!(w > 0)) w = 0;
      W[i] = w;
      L[i] = { x: p.x - dy * w, y: p.y + dx * w };
      R[i] = { x: p.x + dy * w, y: p.y - dx * w };
    }
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    for (var k = 1; k < n; k++) ctx.lineTo(L[k].x, L[k].y);
    var pe = pts[n - 1], ae = pts[n - 2];
    var phiE = Math.atan2(pe.y - ae.y, pe.x - ae.x);
    if (caps && W[n - 1] > 0.05) ctx.arc(pe.x, pe.y, W[n - 1], phiE + Math.PI / 2, phiE - Math.PI / 2, true);
    for (var m = n - 1; m >= 0; m--) ctx.lineTo(R[m].x, R[m].y);
    var p0 = pts[0], p1 = pts[1];
    var phi0 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    if (caps && W[0] > 0.05) ctx.arc(p0.x, p0.y, W[0], phi0 - Math.PI / 2, phi0 - (3 * Math.PI) / 2, true);
    ctx.closePath();
    ctx.fill();
  };

  /** 3D helper: rotate (x,y,z) by Euler angles (rx about X, ry about Y, rz about Z) then weak perspective.
      Returns {x,y,z} where x,y are screen offsets (y down). persp = camera distance in the same units (0 = orthographic). */
  U.rot3 = function (x, y, z, rx, ry, rz, persp) {
    var c, s, t;
    c = Math.cos(rx); s = Math.sin(rx); t = y * c - z * s; z = y * s + z * c; y = t;
    c = Math.cos(ry); s = Math.sin(ry); t = x * c + z * s; z = -x * s + z * c; x = t;
    c = Math.cos(rz); s = Math.sin(rz); t = x * c - y * s; y = x * s + y * c; x = t;
    if (persp) { var f = persp / (persp - z); return { x: x * f, y: y * f, z: z }; }
    return { x: x, y: y, z: z };
  };
})();


/* ===== style.js ===== */
/* Shared look-and-feel constants + the props registry. Load after util.js.
   COLOURS come from the host page: --color-ink / --color-paper CSS custom properties on :root (fallbacks = the portfolio's #151412 / #faf8f3),
   or window.GA_THEME = {ink:'#..', paper:'#..'}. Greys are mixes of ink and paper so everything sits on the paper colour. */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});

  function parseColor(s) {
    s = (s || '').trim();
    var m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    if ((m = /^#([0-9a-f]{6})$/i.exec(s))) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s))) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  function cssVar(name) {
    try { return window.getComputedStyle(document.documentElement).getPropertyValue(name); } catch (e) { return ''; }
  }

  var theme = window.GA_THEME || {};
  var ink = parseColor(theme.ink) || parseColor(cssVar('--color-ink')) || [21, 20, 18];
  var paper = parseColor(theme.paper) || parseColor(cssVar('--color-paper')) || [250, 248, 243];

  GA.style = {
    INK: hex(ink), // the black of the silhouette, cubes, solid fills
    INK2: mix(ink, paper, 0.14), // slightly lifted black (cube faces, shading)
    GRAY1: mix(ink, paper, 0.36), // dark line
    GRAY2: mix(ink, paper, 0.56), // mid line
    GRAY3: mix(ink, paper, 0.76), // light line / soft sweep strokes
    GRAY4: mix(ink, paper, 0.9), // faint hatch / grid
    PAPER: hex(paper), // opaque "paper" fill for props = the page background colour
    inkRGB: ink, paperRGB: paper,
    /** line weights in WORLD units (world is 780 units tall; the band is ~0.5-0.7 px per unit on laptops). */
    lw: { hair: 1.0, thin: 1.6, mid: 2.5, bold: 3.8, heavy: 6.0 },
    mix: mix, parseColor: parseColor,
    /** common ctx setup for line-art */
    line: function (ctx, w, color) {
      ctx.lineWidth = w; ctx.strokeStyle = color || GA.style.INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    },
  };

  /** Props registry. Props are line-art "thought" objects (books, chai cups, laptops, ...). Each prop module calls GA.props.register().
      def = {
        draw(ctx, p)  // draws at the CURRENT ctx origin (0,0 = centre of the prop), in WORLD units (do NOT ctx.scale; multiply coordinates by p.s).
                      // p = { s: nominal size (world units, ~largest dimension), t: seconds (animated bits e.g. steam), seed, rot:[rx,ry,rz] radians 3D tumble (optional, may be ignored by flat props),
                      //       alpha: 0..1 multiplier, lw: line weight multiplier (default 1) }
        box: [w,h]    // bounding box as multiples of s (centered on origin), used for the dissolve-into-cubes effect
        tags: []      // e.g. ['book','work','design','sport'] (free-form)
      } */
  GA.props = GA.props || {
    list: {},
    register: function (name, def) { def.name = name; this.list[name] = def; },
    draw: function (name, ctx, p) { var d = this.list[name]; if (d) d.draw(ctx, p); },
    names: function () { return Object.keys(this.list); },
  };
})();


/* ===== stage.js ===== */
/* Stage: canvas <-> world coordinate mapping. Load after util.js.
   WORLD: y down, always 780 units tall = the 16:4.5 BAND (GA.stage.H). Width W = 780 * (band aspect) so the world ALWAYS spans the full band width
   (x=0 is the left screen edge, x=W the right screen edge). Ground line y = groundY (700). Standing girl ~500 units tall.
   The CANVAS may be TALLER than the band (extension above/below, see the CSS in tools/bundle_site.mjs): the world then continues beyond y=0 / y=H
   (visible range = GA.stage.visTop .. GA.stage.visBottom, in world units) and a CSS mask fades the extension to transparent, so swirl arms,
   thrown cubes and the ball are never cut by a hard edge; cubes fall out of the screen through the (faded) bottom extension.
   For narrow canvases W is clamped to >= 900 and the picture is letterboxed vertically. */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var S = (GA.stage = {
    H: 780, W: 2773, groundY: 700, px: 1, // px = device pixels per world unit
    canvas: null, ctx: null, opts: {}, onResize: null, offsetY: 0, cssW: 0, cssH: 0, dpr: 1, scale: 1,
    visTop: 0, visBottom: 780, // visible world y range (extends beyond 0..H when the canvas is taller than the band)
    quality: 1, // pixel-ratio multiplier (the scene's frame-time governor lowers it on slow machines)
    maxPixels: 4.2e6, // device-pixel budget of the canvas
  });

  /** setup(canvas, opts): opts.pxWidth/pxHeight => fixed pixel size (used by demos & test shots); otherwise the canvas follows its CSS box. */
  S.setup = function (canvas, opts) {
    S.canvas = canvas; S.ctx = canvas.getContext('2d'); S.opts = opts || {};
    S.resize();
    if (!S.opts.pxWidth && !S.opts.manualResize) window.addEventListener('resize', function () { S.resize(); if (S.onResize) S.onResize(); });
    return S;
  };

  S.resize = function () {
    var o = S.opts, c = S.canvas, dpr, cw, ch, bandW, bandH, exTop = 0;
    if (o.pxWidth) {
      dpr = 1; cw = o.pxWidth; ch = o.pxHeight || Math.round(cw * 9 / 16); bandW = cw; bandH = ch;
      c.style.width = cw + 'px'; c.style.height = ch + 'px';
    } else {
      dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr || 2);
      cw = c.clientWidth || window.innerWidth; ch = c.clientHeight || window.innerHeight; bandW = cw; bandH = ch;
      var par = c.parentElement;
      if (par && o.band !== false) { // the canvas is allowed to extend above/below its parent (= the band)
        var pr = par.getBoundingClientRect(), cr = c.getBoundingClientRect();
        if (pr.width > 0 && pr.height > 0 && cr.height >= pr.height - 1 && cr.top <= pr.top + 1) { bandW = pr.width; bandH = pr.height; exTop = pr.top - cr.top; }
      }
    }
    var sc = bandH / S.H, W = bandW / sc;
    if (W < 900) { W = 900; sc = bandW / W; }
    // device-pixel budget (very wide / hi-dpi screens) and the governor's quality factor
    dpr = dpr * S.quality;
    var cssPx = cw * ch;
    if (!o.pxWidth) dpr = Math.max(0.6, Math.min(dpr, Math.sqrt(S.maxPixels / Math.max(1, cssPx)), 4096 / Math.max(1, cw), 4096 / Math.max(1, ch)));
    S.W = W; S.dpr = dpr; S.cssW = cw; S.cssH = ch;
    S.offsetY = exTop + (bandH - S.H * sc) / 2;
    S.px = sc * dpr; S.scale = sc;
    S.visTop = -S.offsetY / sc; S.visBottom = (ch - S.offsetY) / sc;
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    return S;
  };

  /** governor hook: set the pixel-ratio multiplier (0.6..1) and re-fit the canvas backing store (world mapping is unchanged) */
  S.setQuality = function (q) {
    q = Math.max(0.6, Math.min(1, q));
    if (Math.abs(q - S.quality) < 0.01) return false;
    S.quality = q; S.resize(); return true;
  };

  /** Clears to the background colour and installs the world transform. Call at the start of every frame. */
  S.begin = function (bg) {
    var ctx = S.ctx, c = S.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg === 'transparent') ctx.clearRect(0, 0, c.width, c.height);
    else { ctx.fillStyle = bg || '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.setTransform(S.px, 0, 0, S.px, 0, S.offsetY * S.dpr);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return ctx;
  };
})();


/* ===== girl_a_core.js ===== */
/* girl_a_core.js  --  Girl rig, VARIANT A ("3D-projected lofts"): math + silhouette primitives.
   Classic script. Attaches GA.girlA.core.  Load after util.js/style.js/stage.js, before girl_a_data.js / girl_a_hair.js / girl_a.js.

   Conventions
     body frame  (f, c, h): f = forward (the way she faces), c = her RIGHT, h = height above the ground.
     yaw theta   : screen X = ox - (f*cos(theta) + c*sin(theta)),  depth Z (toward viewer) = f*sin(theta) - c*cos(theta),  screen Y = oy - h.
                   theta = 0  -> faces screen-LEFT (pure side profile, we see her left side);  theta = PI/2 -> faces the viewer.
     3x3 matrices are row-major arrays of 9; a "frame" is {R:[9], o:[3]} mapping local -> parent coordinates.
     The silhouette is the UNION of convex pieces (hulls of consecutive projected cross-sections, tapered capsules) filled in one path;
     every piece has the same winding so nonzero fill = exact union (no seams, no holes). */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var A = (GA.girlA = GA.girlA || {});
  var K = (A.core = A.core || {});
  var PI = Math.PI, TAU = PI * 2;
  var sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, abs = Math.abs, atan2 = Math.atan2, acos = Math.acos, pow = Math.pow;

  K.PI = PI; K.TAU = TAU;
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.lerp = function (a, b, t) { return a + (b - a) * t; };
  K.sstep = function (a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  K.sstep5 = function (a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * t * (t * (t * 6 - 15) + 10); };
  K.frac = function (x) { return x - Math.floor(x); };
  /** polynomial smooth minimum */
  K.smin = function (a, b, k) { var h = Math.max(k - abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  K.smax = function (a, b, k) { return -K.smin(-a, -b, k); };
  K.rad = function (d) { return d * PI / 180; };

  // ---------------------------------------------------------------- matrices / frames
  K.mI = function () { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; };
  K.mMul = function (a, b) {
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
  };
  /** rotation about the up axis: turns forward toward her right (+c) */
  K.mRz = function (a) { var c = cos(a), s = sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  /** pitch about the lateral axis: positive tips forward vector UP (look up / lean back) */
  K.mRy = function (a) { var c = cos(a), s = sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
  /** roll about the forward axis: positive tilts the up vector toward her LEFT (-c) */
  K.mRx = function (a) { var c = cos(a), s = sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  K.mEuler = function (yaw, pitch, roll) { return K.mMul(K.mRz(yaw), K.mMul(K.mRy(pitch), K.mRx(roll))); };
  K.mVec = function (m, x, y, z) { return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z]; };
  K.frame = function (R, o) { return { R: R, o: o }; };
  /** compose: child expressed in parent's coordinates then parent applied */
  K.fMul = function (P, L) {
    var o = K.mVec(P.R, L.o[0], L.o[1], L.o[2]);
    return { R: K.mMul(P.R, L.R), o: [P.o[0] + o[0], P.o[1] + o[1], P.o[2] + o[2]] };
  };
  K.fApply = function (F, x, y, z) {
    var R = F.R, o = F.o;
    return [R[0] * x + R[1] * y + R[2] * z + o[0], R[3] * x + R[4] * y + R[5] * z + o[1], R[6] * x + R[7] * y + R[8] * z + o[2]];
  };

  // ---------------------------------------------------------------- projection (global, set per draw)
  var PJ = (K.pj = { c: 1, s: 0, ox: 0, oy: 0, ele: 0 });
  K.setProj = function (theta, ox, oy) { PJ.c = cos(theta); PJ.s = sin(theta); PJ.ox = ox; PJ.oy = oy; PJ.theta = theta; };
  /** body (f,c,h) -> screen [x,y] */
  K.proj = function (f, c, h) { return [PJ.ox - (f * PJ.c + c * PJ.s), PJ.oy - h]; };
  /** body (f,c,h) -> sim space [X, Y(down), Z(toward viewer)] */
  K.world = function (f, c, h) { return [PJ.ox - (f * PJ.c + c * PJ.s), PJ.oy - h, f * PJ.s - c * PJ.c]; };
  /** direction version (no translation) */
  K.worldDir = function (f, c, h) { return [-(f * PJ.c + c * PJ.s), -h, f * PJ.s - c * PJ.c]; };

  // ---------------------------------------------------------------- convex hull (monotone chain), scratch buffers
  var CAP = 384;
  var qx = new Float64Array(CAP), qy = new Float64Array(CAP), ord = new Int32Array(CAP), hid = new Int32Array(CAP * 2);
  var hx = (K.hx = new Float64Array(CAP * 2)), hy = (K.hy = new Float64Array(CAP * 2));
  K.qx = qx; K.qy = qy;
  /** hull of the n points currently in qx,qy -> hx,hy (CCW in math orientation); returns count */
  K.hull = function (n) {
    var i, j, t, m, p, v;
    for (i = 0; i < n; i++) ord[i] = i;
    for (i = 1; i < n; i++) {
      v = ord[i]; j = i - 1;
      while (j >= 0 && (qx[ord[j]] > qx[v] || (qx[ord[j]] === qx[v] && qy[ord[j]] > qy[v]))) { ord[j + 1] = ord[j]; j--; }
      ord[j + 1] = v;
    }
    m = 0;
    for (i = 0; i < n; i++) {
      p = ord[i];
      while (m >= 2 && (qx[hid[m - 1]] - qx[hid[m - 2]]) * (qy[p] - qy[hid[m - 2]]) - (qy[hid[m - 1]] - qy[hid[m - 2]]) * (qx[p] - qx[hid[m - 2]]) <= 0) m--;
      hid[m++] = p;
    }
    t = m + 1;
    for (i = n - 2; i >= 0; i--) {
      p = ord[i];
      while (m >= t && (qx[hid[m - 1]] - qx[hid[m - 2]]) * (qy[p] - qy[hid[m - 2]]) - (qy[hid[m - 1]] - qy[hid[m - 2]]) * (qx[p] - qx[hid[m - 2]]) <= 0) m--;
      hid[m++] = p;
    }
    m--;
    for (i = 0; i < m; i++) { hx[i] = qx[hid[i]]; hy[i] = qy[hid[i]]; }
    return m;
  };

  /** emits the hull currently in hx,hy (m pts) inflated by eps (miter offset) so abutting pieces overlap (no anti-aliasing seams) */
  var INFL = 0.9, SEP = true;      // pieces are filled one by one and inflated so that neighbours overlap by > 1px (avoids rasteriser seams)
  K.inflation = function (e) { INFL = e; };
  K.separateFills = function (b) { SEP = b; };
  K.EPS = function () { return INFL; };
  function emitHull(ctx, m) {
    var i, p, nx, ny, e1x, e1y, e2x, e2y, l1, l2, dn, k;
    if (SEP) ctx.beginPath();
    for (i = 0; i < m; i++) {
      p = i === 0 ? m - 1 : i - 1; k = i === m - 1 ? 0 : i + 1;
      e1x = hx[i] - hx[p]; e1y = hy[i] - hy[p]; l1 = sqrt(e1x * e1x + e1y * e1y) || 1;
      e2x = hx[k] - hx[i]; e2y = hy[k] - hy[i]; l2 = sqrt(e2x * e2x + e2y * e2y) || 1;
      // outward normals (CCW polygon): (dy,-dx)
      var n1x = e1y / l1, n1y = -e1x / l1, n2x = e2y / l2, n2y = -e2x / l2;
      dn = 1 + n1x * n2x + n1y * n2y; if (dn < 0.35) dn = 0.35;
      nx = (n1x + n2x) / dn * INFL; ny = (n1y + n2y) / dn * INFL;
      if (i === 0) ctx.moveTo(hx[i] + nx, hy[i] + ny); else ctx.lineTo(hx[i] + nx, hy[i] + ny);
    }
    ctx.closePath();
    if (SEP) ctx.fill();
  }
  /** adds hull of ring A (nA pts) and ring B (nB pts) given as interleaved x,y arrays + offsets to the current path */
  K.addHull2 = function (ctx, ra, oa, na, rb, ob, nb) {
    var n = 0, i;
    for (i = 0; i < na; i++) { qx[n] = ra[oa + 2 * i]; qy[n] = ra[oa + 2 * i + 1]; n++; }
    for (i = 0; i < nb; i++) { qx[n] = rb[ob + 2 * i]; qy[n] = rb[ob + 2 * i + 1]; n++; }
    var m = K.hull(n);
    if (m < 3) return;
    emitHull(ctx, m);
  };
  /** adds a single convex ring as a polygon (ordered CCW in math orientation, forced) */
  K.addRing = function (ctx, ra, oa, na) {
    var n = 0, i;
    for (i = 0; i < na; i++) { qx[n] = ra[oa + 2 * i]; qy[n] = ra[oa + 2 * i + 1]; n++; }
    var m = K.hull(n);
    if (m < 3) return;
    emitHull(ctx, m);
  };

  // ---------------------------------------------------------------- tapered capsule (exact hull of two discs), CCW
  K.addCapsule = function (ctx, x1, y1, r1, x2, y2, r2) {
    if (SEP) ctx.beginPath();
    capsuleInner(ctx, x1, y1, r1, x2, y2, r2);
    if (SEP) ctx.fill();
  };
  function capsuleInner(ctx, x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1, d = sqrt(dx * dx + dy * dy);
    if (d <= abs(r1 - r2) + 1e-4) {
      if (r1 >= r2) { ctx.moveTo(x1 + r1, y1); ctx.arc(x1, y1, r1, 0, TAU, false); }
      else { ctx.moveTo(x2 + r2, y2); ctx.arc(x2, y2, r2, 0, TAU, false); }
      ctx.closePath();
      return;
    }
    var a0 = atan2(dy, dx), al = acos((r1 - r2) / d);
    ctx.moveTo(x1 + r1 * cos(a0 + al), y1 + r1 * sin(a0 + al));
    ctx.arc(x1, y1, r1, a0 + al, a0 - al + TAU, false);
    ctx.arc(x2, y2, r2, a0 - al, a0 + al, false);
    ctx.closePath();
  }
  K.addDisc = function (ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU, false); ctx.closePath(); };

  // ---------------------------------------------------------------- table interpolation
  /** cubic Hermite resampling of rows [[z, v1, v2, ...], ...] (z strictly decreasing or increasing). 'sub' extra rows between neighbours. */
  K.resampleRows = function (rows, sub) {
    var n = rows.length, nv = rows[0].length, out = [], i, k, j;
    function tang(i, j) {
      var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      var dz = rows[b][0] - rows[a][0];
      return dz === 0 ? 0 : (rows[b][j] - rows[a][j]) / dz;
    }
    for (i = 0; i < n - 1; i++) {
      var r0 = rows[i], r1 = rows[i + 1], h = r1[0] - r0[0];
      for (k = 0; k < sub; k++) {
        var t = k / sub, t2 = t * t, t3 = t2 * t;
        var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        var row = [r0[0] + h * t];
        for (j = 1; j < nv; j++) {
          // monotone-ish: clamp the tangents so the curve never overshoots the neighbours much
          var m0 = tang(i, j) * h, m1 = tang(i + 1, j) * h;
          var dv = r1[j] - r0[j];
          if (dv === 0) { m0 = 0; m1 = 0; } else {
            if (m0 * dv < 0) m0 = 0; if (m1 * dv < 0) m1 = 0;
            var lim = 3 * abs(dv);
            if (abs(m0) > lim) m0 = lim * (m0 < 0 ? -1 : 1);
            if (abs(m1) > lim) m1 = lim * (m1 < 0 ? -1 : 1);
          }
          row.push(h00 * r0[j] + h10 * m0 + h01 * r1[j] + h11 * m1);
        }
        out.push(row);
      }
    }
    out.push(rows[n - 1].slice());
    return out;
  };
  /** piecewise cubic (Catmull-Rom, clamped) evaluation of keys [[x,y],...] at x */
  K.curve = function (keys, x) {
    var n = keys.length;
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    var i = 0;
    while (i < n - 2 && x > keys[i + 1][0]) i++;
    var x0 = keys[i][0], x1 = keys[i + 1][0], y0 = keys[i][1], y1 = keys[i + 1][1], h = x1 - x0, t = (x - x0) / h;
    var pa = keys[Math.max(0, i - 1)], pb = keys[Math.min(n - 1, i + 2)];
    var m0 = (y1 - pa[1]) / (x1 - pa[0]) * h, m1 = (pb[1] - y0) / (pb[0] - x0) * h;
    var dv = y1 - y0;
    if (dv === 0) { m0 = 0; m1 = 0; } else { if (m0 * dv < 0) m0 = 0; if (m1 * dv < 0) m1 = 0; }
    var t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
  };

  // ---------------------------------------------------------------- lofts
  /** Half-ellipse cross-section lofts. rows: [z, fm, df, db, w, p?]  (z = local height). N ring points per row.
      local ring point = (fm + (cos>=0 ? df : db) * sgnpow(cos), w * sgnpow(sin), z) with exponent 2/p (p=2 ellipse, >2 boxier, <2 pointier). */
  K.makeLoft = function (rows, N, shrink) {
    shrink = shrink || 0;
    var R = rows.length, pts = new Float64Array(R * N * 3), r, k;
    for (r = 0; r < R; r++) {
      var row = rows[r], z = row[0], fm = row[1], df = Math.max(0, row[2] - shrink), db = Math.max(0, row[3] - shrink), w = Math.max(0, row[4] - shrink), e = 2 / (row[5] || 2), fc = row[6] || 0;
      for (k = 0; k < N; k++) {
        var ph = TAU * k / N, ca = cos(ph), sa = sin(ph);
        var sc = ca >= 0 ? pow(ca, e) : -pow(-ca, e), ss = sa >= 0 ? pow(sa, e) : -pow(-sa, e);
        var o = (r * N + k) * 3;
        pts[o] = fm + (ca >= 0 ? df : db) * sc;
        pts[o + 1] = fc + w * ss;
        pts[o + 2] = z;
      }
    }
    return { rows: rows, N: N, R: R, pts: pts, buf: new Float64Array(R * N * 2) };
  };
  /** Rect-section loft along local x (shoes): rows [s, zc, hz, wz, p?] -> ring in the (y,z) plane. */
  K.makeRectLoft = function (rows, N, shrink) {
    shrink = shrink || 0;
    var R = rows.length, pts = new Float64Array(R * N * 3), r, k;
    for (r = 0; r < R; r++) {
      var row = rows[r], s = row[0], zc = row[1], hz = Math.max(0.2, row[2] - shrink), wz = Math.max(0.2, row[3] - shrink), e = 2 / (row[4] || 3);
      for (k = 0; k < N; k++) {
        var ph = TAU * k / N, ca = cos(ph), sa = sin(ph);
        var sc = ca >= 0 ? pow(ca, e) : -pow(-ca, e), ss = sa >= 0 ? pow(sa, e) : -pow(-sa, e);
        var o = (r * N + k) * 3;
        pts[o] = s; pts[o + 1] = wz * sc; pts[o + 2] = zc + hz * ss;
      }
    }
    return { rows: rows, N: N, R: R, pts: pts, buf: new Float64Array(R * N * 2) };
  };
  /** dst.pts = a.pts*(1-w) + b.pts*w (same row/ring layout); dst may be a clone made by K.cloneLoft */
  K.cloneLoft = function (l) { return { rows: l.rows, N: l.N, R: l.R, pts: new Float64Array(l.pts), buf: new Float64Array(l.buf.length) }; };
  K.lerpLoft = function (dst, a, b, w) {
    var p = dst.pts, pa = a.pts, pb = b.pts, n = p.length, w1 = 1 - w;
    for (var i = 0; i < n; i++) p[i] = pa[i] * w1 + pb[i] * w;
  };
  /** project row r of a loft through frame F (local -> body) into loft.buf. ele: optional camera elevation term (adds depth*ele to screen Y) */
  K.projectRow = function (loft, r, F, ele) {
    var N = loft.N, pts = loft.pts, buf = loft.buf, R = F.R, o = F.o, cth = PJ.c, sth = PJ.s, ox = PJ.ox, oy = PJ.oy;
    var R0 = R[0], R1 = R[1], R2 = R[2], R3 = R[3], R4 = R[4], R5 = R[5], R6 = R[6], R7 = R[7], R8 = R[8];
    var o0 = o[0], o1 = o[1], o2 = o[2];
    for (var k = 0; k < N; k++) {
      var i = (r * N + k) * 3, x = pts[i], y = pts[i + 1], z = pts[i + 2];
      var f = R0 * x + R1 * y + R2 * z + o0, c = R3 * x + R4 * y + R5 * z + o1, h = R6 * x + R7 * y + R8 * z + o2;
      var j = (r * N + k) * 2;
      buf[j] = ox - (f * cth + c * sth);
      buf[j + 1] = oy - h + (ele ? ele * (f * sth - c * cth) : 0);
    }
  };
  /** adds the union of hulls between consecutive projected rows [r0..r1] of a loft (rows must be projected first) */
  K.addLoftHulls = function (ctx, loft, r0, r1) {
    var N = loft.N, buf = loft.buf;
    for (var r = r0; r < r1; r++) K.addHull2(ctx, buf, r * N * 2, N, buf, (r + 1) * N * 2, N);
  };

  /** spans: [[r0,r1,stride],...]: hull between rows r and r+stride inside each span (use big strides where the profile is convex) */
  K.addLoftSpans = function (ctx, loft, spans) {
    var N = loft.N, buf = loft.buf;
    for (var s = 0; s < spans.length; s++) {
      var r0 = spans[s][0], r1 = spans[s][1], st = spans[s][2];
      for (var r = r0; r < r1; r += st) { var rb = Math.min(r + st, r1); K.addHull2(ctx, buf, r * N * 2, N, buf, rb * N * 2, N); }
    }
  };
  // ---------------------------------------------------------------- smooth silhouette of a projected mesh ("sweep")
  /** Exact silhouette of a closed projected surface mesh (rings x rows) that is single-interval per scanline (head, trunk, shoe, sleeve):
      the left/right extent per scanline is the min/max of the mesh edges crossing it (the extent of a polygon lies on its boundary); the closed
      outline is resampled by arclength and faired with a 3-pass box filter (a quadratic B-spline kernel => C1, curvature-bounded outline: no facets,
      no stair-steps, rounded creases).  One path / one fill per component instead of hundreds of abutting hull fills.
        var sw = K.newSweep(); sw.begin(ymin, ymax); sw.addLoft(loft, r0, r1); sw.addRings(buf, nRings, N); sw.emit(ctx, sigma);   */
  K.loftRange = function (loft, r0, r1, out) {
    var b = loft.buf, n = loft.N, lo = 1e30, hi = -1e30, e = (r1 + 1) * n * 2;
    for (var i = r0 * n * 2 + 1; i < e; i += 2) { var y = b[i]; if (y < lo) lo = y; if (y > hi) hi = y; }
    out[0] = lo < out[0] ? lo : out[0]; out[1] = hi > out[1] ? hi : out[1];
  };
  var FOFF = [0.008, 0.04, 0.12, 0.28, 0.55, 0.95, 1.5], NF = FOFF.length, ZONE = 1.5;
  K.newSweep = function (maxBins) {
    maxBins = maxBins || 1400;
    var L = new Float64Array(maxBins), Rr = new Float64Array(maxBins), TL = new Float64Array(NF), TR = new Float64Array(NF), BL = new Float64Array(NF), BR = new Float64Array(NF);
    var px = new Float64Array(2 * maxBins + 2 * NF + 8), py = new Float64Array(px.length), sx = new Float64Array(4096), sy = new Float64Array(4096), tx = new Float64Array(4096), ty = new Float64Array(4096);
    var yb = 0, ye = 0, dy = 0.4, nb = 0, j, ZT = 0, ZB = 0;
    var sw = {};
    sw.begin = function (ymin, ymax, step) {
      dy = step || 0.4; yb = ymin; ye = ymax; ZT = yb + ZONE; ZB = ye - ZONE;
      nb = Math.min(maxBins, Math.max(2, Math.floor((ye - yb) / dy) + 1));
      if (nb === maxBins) dy = (ye - yb) / (maxBins - 1);
      for (j = 0; j < nb; j++) { L[j] = 1e30; Rr[j] = -1e30; }
      for (j = 0; j < NF; j++) { TL[j] = BL[j] = 1e30; TR[j] = BR[j] = -1e30; }
    };
    function edge(x0, y0, x1, y1) {
      if (y0 === y1) return;
      var t;
      if (y0 > y1) { t = x0; x0 = x1; x1 = t; t = y0; y0 = y1; y1 = t; }
      var s = (x1 - x0) / (y1 - y0), j0 = Math.ceil((y0 - yb) / dy), j1 = Math.floor((y1 - yb) / dy), x, jj;
      if (j0 < 0) j0 = 0; if (j1 >= nb) j1 = nb - 1;
      if (j0 <= j1) {
        x = x0 + (yb + j0 * dy - y0) * s; var ds = dy * s;
        for (jj = j0; jj <= j1; jj++, x += ds) { if (x < L[jj]) L[jj] = x; if (x > Rr[jj]) Rr[jj] = x; }
      }
      if (y0 < ZT) for (jj = 0; jj < NF; jj++) { var yy = yb + FOFF[jj]; if (yy >= y0 && yy <= y1) { x = x0 + (yy - y0) * s; if (x < TL[jj]) TL[jj] = x; if (x > TR[jj]) TR[jj] = x; } }
      if (y1 > ZB) for (jj = 0; jj < NF; jj++) { var yz = ye - FOFF[jj]; if (yz >= y0 && yz <= y1) { x = x0 + (yz - y0) * s; if (x < BL[jj]) BL[jj] = x; if (x > BR[jj]) BR[jj] = x; } }
    }
    /** same as edge() but takes the two end points as INDICES into the interleaved x,y buffer b (small integers): calling edge() with four double arguments boxes every double into a heap
        number (about 64 bytes per call, ~1 MB of garbage per frame); the body is duplicated on purpose so that nothing is passed or allocated per edge */
    function edgeI(b, ia, ib) {
      var x0 = b[ia], y0 = b[ia + 1], x1 = b[ib], y1 = b[ib + 1], t, jj, x;
      if (y0 === y1) return;
      if (y0 > y1) { t = x0; x0 = x1; x1 = t; t = y0; y0 = y1; y1 = t; }
      var s = (x1 - x0) / (y1 - y0), j0 = Math.ceil((y0 - yb) / dy), j1 = Math.floor((y1 - yb) / dy);
      if (j0 < 0) j0 = 0; if (j1 >= nb) j1 = nb - 1;
      if (j0 <= j1) {
        x = x0 + (yb + j0 * dy - y0) * s; var ds = dy * s;
        for (jj = j0; jj <= j1; jj++, x += ds) { if (x < L[jj]) L[jj] = x; if (x > Rr[jj]) Rr[jj] = x; }
      }
      if (y0 < ZT) for (jj = 0; jj < NF; jj++) { var yy = yb + FOFF[jj]; if (yy >= y0 && yy <= y1) { x = x0 + (yy - y0) * s; if (x < TL[jj]) TL[jj] = x; if (x > TR[jj]) TR[jj] = x; } }
      if (y1 > ZB) for (jj = 0; jj < NF; jj++) { var yz = ye - FOFF[jj]; if (yz >= y0 && yz <= y1) { x = x0 + (yz - y0) * s; if (x < BL[jj]) BL[jj] = x; if (x > BR[jj]) BR[jj] = x; } }
    }
    sw.edge = edge;
    /** adds the edges of rows r0..r1 of a projected loft: ring edges and column edges */
    sw.addLoft = function (loft, r0, r1) {
      var N = loft.N, b = loft.buf, r, k, o, o2, k1;
      for (r = r0; r <= r1; r++) {
        o = r * N * 2; o2 = o + N * 2;
        for (k = 0; k < N; k++) {
          k1 = k + 1 === N ? 0 : k + 1;
          edgeI(b, o + 2 * k, o + 2 * k1);
          if (r < r1) edgeI(b, o + 2 * k, o2 + 2 * k);
        }
      }
    };
    /** same for a plain buffer of nR rings x N points (x,y interleaved) */
    sw.addRings = function (b, nR, N) {
      sw.addLoft({ N: N, buf: b }, 0, nR - 1);
    };
    /** builds the faired closed outline and appends it to the current path of ctx. sigma: fairing radius in screen units. returns point count */
    /** removes single-scanline "thorns": a run of <= SPK_MAX scanlines whose extent juts out by more than SPK_T beyond BOTH neighbours (extent artefacts of ring edges that are
        almost horizontal) is replaced by the linear interpolation of the neighbours.  Real horizontal features (cuffs, hem) are steps, not excursions, and survive. */
    var SPK_T = 2.2;
    function despike(a, lo, hi, isMin) {
      var maxRun = Math.max(2, Math.ceil(3.0 / dy)), i2, r, m, va, vb, thr, ok, v;
      for (i2 = lo + 1; i2 < hi; i2++) {
        va = a[i2 - 1]; if (va > 1e29 || va < -1e29) continue;
        if (isMin ? a[i2] >= va - SPK_T : a[i2] <= va + SPK_T) continue;
        for (r = 1; r <= maxRun && i2 + r <= hi; r++) {
          vb = a[i2 + r]; if (vb > 1e29 || vb < -1e29) break;
          thr = isMin ? Math.min(va, vb) - SPK_T : Math.max(va, vb) + SPK_T; ok = true;
          for (m = 0; m < r; m++) { v = a[i2 + m]; if (isMin ? v >= thr : v <= thr) { ok = false; break; } }
          if (ok) { for (m = 0; m < r; m++) a[i2 + m] = va + (vb - va) * (m + 1) / (r + 1); i2 += r - 1; break; }
        }
      }
    }
    sw.emit = function (ctx, sigma) {
      var n = 0, i, k;
      var dj0 = Math.ceil((ZT - yb) / dy), dj1 = Math.min(Math.floor((ZB - yb) / dy), nb - 1);
      if (dj1 - dj0 > 4) { despike(L, dj0, dj1, true); despike(Rr, dj0, dj1, false); }
      // left chain, top -> bottom
      for (j = NF - 1; j >= 0; j--) if (TL[j] < 1e29) { px[n] = TL[j]; py[n] = yb + FOFF[j]; n++; }
      var j0 = Math.ceil((ZT - yb) / dy), j1 = Math.floor((ZB - yb) / dy);
      for (j = j0; j <= j1 && j < nb; j++) if (L[j] < 1e29) { px[n] = L[j]; py[n] = yb + j * dy; n++; }
      for (j = 0; j < NF; j++) if (BL[j] < 1e29) { px[n] = BL[j]; py[n] = ye - FOFF[j]; n++; }
      // right chain, bottom -> top
      for (j = 0; j < NF; j++) if (BR[j] > -1e29) { px[n] = BR[j]; py[n] = ye - FOFF[j]; n++; }
      for (j = Math.min(j1, nb - 1); j >= j0; j--) if (Rr[j] > -1e29) { px[n] = Rr[j]; py[n] = yb + j * dy; n++; }
      for (j = NF - 1; j >= 0; j--) if (TR[j] > -1e29) { px[n] = TR[j]; py[n] = yb + FOFF[j]; n++; }
      if (n < 4) return 0;
      // arclength resample
      var per = 0, cum = tx;                        // reuse tx as cumulative length
      cum[0] = 0;
      for (i = 1; i <= n; i++) { var a = i === n ? 0 : i, dx = px[a] - px[i - 1], ddy = py[a] - py[i - 1]; per += Math.sqrt(dx * dx + ddy * ddy); cum[i] = per; }
      if (per < 1e-6) return 0;
      var h = Math.max(0.85, per / 2000), M = Math.max(8, Math.round(per / h)); h = per / M;
      var seg = 0;
      for (i = 0; i < M; i++) {
        var d = i * h; while (seg < n - 1 && cum[seg + 1] < d) seg++;
        var a0 = seg, a1 = seg + 1 === n ? 0 : seg + 1, f = cum[seg + 1] - cum[seg]; f = f > 1e-9 ? (d - cum[seg]) / f : 0;
        sx[i] = px[a0] + (px[a1] - px[a0]) * f; sy[i] = py[a0] + (py[a1] - py[a0]) * f;
      }
      // fairing: 3 box passes of width w (samples), closed loop
      var ss = sigma / h, w = Math.round(Math.sqrt(4 * ss * ss + 1)); if (w < 1) w = 1; if (w % 2 === 0) w++;
      var hw = (w - 1) >> 1, ax = sx, ay = sy, bx = tx, by = ty;
      if (hw > 0 && M > 2 * w + 2) {
        for (var pass = 0; pass < 3; pass++) {
          var sux = 0, suy = 0;
          for (k = -hw; k <= hw; k++) { var q = (k + M) % M; sux += ax[q]; suy += ay[q]; }
          for (i = 0; i < M; i++) {
            bx[i] = sux / w; by[i] = suy / w;
            var rem = (i - hw + M) % M, add = (i + hw + 1) % M;
            sux += ax[add] - ax[rem]; suy += ay[add] - ay[rem];
          }
          var t2 = ax; ax = bx; bx = t2; t2 = ay; ay = by; by = t2;
        }
      }
      ctx.moveTo(ax[0], ay[0]);
      for (i = 1; i < M; i++) ctx.lineTo(ax[i], ay[i]);
      ctx.closePath();
      return M;
    };
    return sw;
  };

  /** run fn() with all capsule/disc pieces collected into ONE path and one fill (cheap, for overlapping chains of discs) */
  K.batch = function (ctx, fn) { var s = SEP; SEP = false; ctx.beginPath(); fn(); ctx.fill(); SEP = s; };

  // ---------------------------------------------------------------- ribbons (hair strands): smooth tapered filled polygons
  var rbx = new Float64Array(1024), rby = new Float64Array(1024), rbw = new Float64Array(1024);
  var rlx = new Float64Array(1024), rly = new Float64Array(1024), rrx = new Float64Array(1024), rry = new Float64Array(1024);
  /** Fill a smooth tapered ribbon through nodes xs[],ys[] (n nodes) with half-widths ws[] (full widths). Catmull-Rom subdivided. Uses current fillStyle. */
  K.fillRibbon = function (ctx, xs, ys, ws, n, sub, capRound) { ctx.beginPath(); K.addRibbon(ctx, xs, ys, ws, n, sub, capRound); ctx.fill(); };
  /** appends the ribbon polygon to the current path (all ribbons have the same winding, so many can share one path / one fill) */
  K.addRibbon = function (ctx, xs, ys, ws, n, sub, capRound) {
    if (n < 2) return;
    sub = sub || 3;
    var m = 0, i, s;
    for (i = 0; i < n - 1; i++) {
      var i0 = i > 0 ? i - 1 : 0, i3 = i < n - 2 ? i + 2 : n - 1;
      for (s = 0; s < sub; s++) {
        var t = s / sub, t2 = t * t, t3 = t2 * t;
        var c0 = -0.5 * t3 + t2 - 0.5 * t, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * t, c3 = 0.5 * t3 - 0.5 * t2;
        rbx[m] = c0 * xs[i0] + c1 * xs[i] + c2 * xs[i + 1] + c3 * xs[i3];
        rby[m] = c0 * ys[i0] + c1 * ys[i] + c2 * ys[i + 1] + c3 * ys[i3];
        rbw[m] = ws[i] + (ws[i + 1] - ws[i]) * (t * t * (3 - 2 * t));
        m++;
      }
    }
    rbx[m] = xs[n - 1]; rby[m] = ys[n - 1]; rbw[m] = ws[n - 1]; m++;
    var lx = rlx, ly = rly, rx = rrx, ry = rry;
    for (i = 0; i < m; i++) {
      var a = i > 0 ? i - 1 : 0, b = i < m - 1 ? i + 1 : m - 1;
      var dx = rbx[b] - rbx[a], dy = rby[b] - rby[a], d = sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      var hw = rbw[i] * 0.5;
      lx[i] = rbx[i] - dy * hw; ly[i] = rby[i] + dx * hw;
      rx[i] = rbx[i] + dy * hw; ry[i] = rby[i] - dx * hw;
    }
    ctx.moveTo(lx[0], ly[0]);
    for (i = 1; i < m; i++) ctx.lineTo(lx[i], ly[i]);
    if (capRound && rbw[m - 1] > 0.3) {
      var ae = atan2(rby[m - 1] - rby[m - 2], rbx[m - 1] - rbx[m - 2]);
      ctx.arc(rbx[m - 1], rby[m - 1], rbw[m - 1] * 0.5, ae + PI / 2, ae - PI / 2, true);
    }
    for (i = m - 1; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
    ctx.closePath();
  };
})();


/* ===== girl_a_data.js ===== */
/* girl_a_data.js -- Girl rig variant A: proportion tables (all in "girl units", standing height = 500).
   Measured from ref9 (side), ref8 / sample frames (front) and tuned with overlays.  Attaches GA.girlA.data.

   head rows : [u, fm, df, db, w, p]   u = height above head centre (ear level), chin u=-54, crown u=+58.
               fm = f of the widest plane, df = depth in front of fm, db = depth behind fm, w = half width, p = superellipse exponent (2 = ellipse)
   torso rows: [h, fm, df, db, w, p]   h = absolute standing height (waist 292 ... neck top 402); f measured from the pelvis axis
   skirt rows: [h, fm, df, db, w, p]   from the waist ring (292) to the hem (162)
   shoe rows : [s, zc, hz, wz, p]      s along the foot (ankle at 0, toe +), zc/hz = vertical centre / half height, wz = half width            */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var A = (GA.girlA = GA.girlA || {});
  var D = (A.data = {});

  D.head = [
    [58.0, 0, 0.00, 0.00, 0.0],
    [57.7, 0, 5.82, 5.82, 5.3],
    [57.0, 0, 10.67, 10.19, 9.6],
    [56.0, 0, 15.52, 15.04, 13.5],
    [54.5, 0, 20.86, 19.88, 17.8],
    [53.0, 0, 24.25, 23.28, 21.1],
    [51.0, 0, 27.64, 27.16, 24.7],
    [48.5, 0, 31.52, 31.04, 28.3],
    [45.5, 0, 34.92, 34.44, 31.9],
    [42.0, 0, 38.31, 37.83, 35.3],
    [38.0, 0, 41.52, 41.52, 39.5],
    [33.0, 0, 44.62, 45.10, 44],
    [27.0, 0, 47.53, 48.02, 48.5],
    [20.0, 0, 49.95, 50.44, 52],
    [12.0, 0, 50.92, 51.41, 51],
    [4.0, 0, 50.63, 51.70, 49.5],
    [-2.0, 0, 49.76, 51.41, 47.2],
    [-7.0, 0, 48.11, 50.92, 46],
    [-11.0, 0, 47.82, 49.95, 45.5],
    [-14.5, 0, 49.28, 49.28, 45.0],
    [-18.0, 0, 52.57, 48.50, 44.7],
    [-21.0, 0, 55.10, 48.02, 44.4],
    [-23.5, 0, 56.07, 47.14, 44.0],
    [-25.5, 0, 53.93, 46.17, 43.6],
    [-28.0, 0, 50.63, 44.81, 43.0],
    [-31.0, 0, 48.98, 42.29, 42.2],
    [-34.0, 0, 49.37, 37.44, 40.5],
    [-36.5, 0, 48.31, 33.56, 38.5],
    [-38.5, 0, 47.34, 29.68, 36.5],
    [-41.0, 0, 46.17, 26.77, 34.0],
    [-44.0, 0, 45.40, 24.44, 30.5],
    [-47.0, 0, 44.81, 23.09, 25.5],
    [-50.0, 0, 43.84, 22.50, 19.0],
    [-52.5, 0, 41.52, 22.12, 12.0],
    [-54.0, 0, 36.86, 21.34, 6.0],
  ];


  // torso + neck chain (spine rows) -- the bending spine is integrated through these rows
  D.torso = [
    [292, 0.0, 28.5, 32.0, 36.5],
    [310, -1.0, 29.0, 31.5, 37.5],
    [330, -3.5, 29.0, 31.0, 39.0],
    [340, -5.0, 28.5, 30.0, 42.0],
    [348, -6.8, 27.2, 28.8, 49.0],
    [355, -8.2, 24.8, 26.8, 55.0],
    [361, -8.8, 22.0, 24.0, 56.0],
    [366, -9.0, 18.4, 20.5, 51.5],
    [371, -8.8, 16.8, 18.8, 43.0],
    [376, -8.0, 15.6, 17.5, 33.0],
    [381, -6.5, 14.6, 16.0, 26.0],
    [386, -5.6, 14.2, 15.0, 21.5],
    [392, -5.2, 14.2, 14.6, 18.8],
    [402, -5.0, 15.0, 15.0, 17.5],
  ];

  D.skirt = [
    [292, 0, 28.5, 32.5, 36.5],
    [270, 0, 34.5, 38.5, 41.8],
    [245, 0, 39.4, 43.7, 47.8],
    [220, 0, 46.5, 51.0, 53.8],
    [195, 0, 53.4, 57.5, 59.8],
    [176, 0, 58.6, 62.4, 64.8],
    [162, 0, 62.0, 66.0, 68.6],
  ];

  D.shoe = [
    [-16.5, 8.6, 8.6, 7.8, 3],
    [-14.0, 10.0, 10.0, 9.7, 3],
    [-8.0, 11.4, 11.4, 11.0, 3],
    [-2.0, 10.8, 10.8, 11.5, 3],
    [6.0, 9.4, 9.4, 12.2, 3],
    [16.0, 8.2, 8.2, 13.1, 3],
    [26.0, 7.2, 7.2, 13.6, 3],
    [36.0, 6.3, 6.3, 13.3, 3],
    [46.0, 5.7, 4.9, 11.7, 3],
    [54.0, 5.9, 4.1, 9.2, 3],
    [59.0, 6.0, 2.8, 6.2, 3],
    [62.5, 5.8, 1.4, 3.2, 3],
    [64.2, 5.7, 0.4, 0.9, 3],
  ];
})();


/* ===== girl_a_hair.js ===== */
/* girl_a_hair.js -- Girl rig (variant C2/F): ponytail ROOTED in the back of the head (gathered knot + hair tie) + loose face / crown / nape strands.   (v4, round 10 "attached pony")

   ATTACHMENT (the tail can never float): the hair tie sits on the skull's back contour (head-local height HC.knotU, ~26 % below the crown as in ref9, HC.knotOut units outside
     the skull).  Head-rigid ELLIPSOIDS are projected exactly (orthographic: an ellipsoid always projects to an ellipse) at every yaw / pitch / roll and unioned with the skull
     (same ink, same winding): the gathered KNOT (centred inside the skull, reaching out to the tie), the tie BAND (a small bump across the root of the tail) and an optional
     hair-volume CAP (HC.capK, off by default).  The tail's first node IS the tie, so skull -> knot -> band -> tail is one continuous silhouette in every pose.
     Front view (body yaw HC.hideY): the tail RETRACTS behind the head (length x0.25, width x0.4) and the knot lies inside the head outline -> no tail, only a few strands.
   PONYTAIL  (screen-plane simulation of a 3D rest curve, fixed step 1/120 s, deterministic / seeded, no per-frame allocation)
     * spine: 21 nodes on a DESIGNED rest curve (direction keys DIRW / DIRR: a short fountain arc back + up out of the tie, then a soft S-curve fall; streams back when she runs),
       built segment by segment in 3D: each direction = the design in the HEAD frame blended toward the same design in an UPRIGHT frame (gravity) by hang x weight (root 0.64 ->
       1 at mid length; the whole tail hangs when the head tilts far from upright: look-down bow, peek).  Per step: wind / speed streaming, idle breeze, shudder.  The run weight
       and the streaming amount are eased (0.2 / 0.18 s) so a reaction's instant speed-up swings the tail back instead of snapping it.
       Every node is a soft spring (natural frequency tie -> tip HC.spineOm, damping HC.spineZ) toward its moving target with damping RELATIVE to the target's own velocity (constant
       speed walking adds no lag) + length constraints + bending stiffness (the deviation from the target is smoothed along the strand: no zig-zag kinks after a fast head snap)
       + a hard distance clamp + NaN guard: follow-through, swing through turns, bounce on steps, whip on the bonk / startle, no explosions.
     * shape: a solid body ribbon (HWD: pinched at the tie, ~31 u wide at mid length) that hands over to HC.nLock long S-curved LOCKS of different lengths whose lateral slots open
       beyond the body -> separate pointed wavy tips with white notches; bold peeling locks, medium / fine / long flyaways off the edge (tapered, hooked tips), wisps arcing out
       of the tie (fade out early in the turn), a strand along the inner edge, a white teardrop under the tie (HC.gapShift).  Quadratic-B-spline ribbons.
   LOOSE HAIR: fringe strands falling in front of the face, temple / ear / nape strands, 'gathered' strands lying along the back of the skull into the tie (profile only), short
       flyaway arcs lifting off the crown (profile; fade out toward the front where they are edge-on), 'halo' flyaways seen only from the front / 3-4 (curved flicks).  Head-local
       rest polylines (on a SMOOTHED head surface) projected through the head frame and simulated like the tail (screen-plane gravity hang).
   All hair goes into ONE path / ONE fill (nonzero, identical winding: ribbons and ellipses alike).

   GA.girlA.createHair(seed) -> { reset(seed), step(dt,S,sc), draw(ctx,S,sc), bounds(), spine(), spineN(), chains(), dbg(), snapshot(out?), restore(s), settle(S) }
   Head-surface helper: GA.girlA.headSurface(u, phi, shrink).  Test hook: GA.girlA.lastHair = the most recently created hair.
   Pose fields consumed (via the rig state S): S.P.{yaw, wind{x,y}, shudder, shudderT, peek (0..1), speed / amount, flinch, dizzy}, S.run, S.theta, S.ox, S.oy, S.Fhead (its rotation gives
   lean / squash / hop / roll / peek; its motion gives the inertia).  Everything else (squash, air, flinch, turns, head shakes) acts through the motion of S.Fhead.
   Tunables: GA.girlA.hairCfg (HC) -- see the DEF table below.                                                                                                                      */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var A = (GA.girlA = GA.girlA || {});
  var K = A.core, D = A.data;
  var sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, exp = Math.exp, pow = Math.pow, atan2 = Math.atan2, PI = Math.PI, TAU = PI * 2, abs = Math.abs, min = Math.min, max = Math.max;
  var lerp = K.lerp, sstep = K.sstep;

  // ---- head surface helper (head-local coordinates) from the loft table
  var keys = { df: [], db: [], w: [], fm: [] };
  function refreshKeys() {
    var rows = D.head.slice().reverse();
    keys.df = []; keys.db = []; keys.w = []; keys.fm = [];
    for (var i = 0; i < rows.length; i++) { keys.fm.push([rows[i][0], rows[i][1] || 0]); keys.df.push([rows[i][0], rows[i][2]]); keys.db.push([rows[i][0], rows[i][3]]); keys.w.push([rows[i][0], rows[i][4]]); }
  }
  // smoothed copies (wide kernel): strands standing off the face follow the head's big shape, not the nose / lips / brow bumps
  var keysS = { df: [], db: [], w: [], fm: [] }, smoothFor = null;
  function smoothTab(arr, rad) {
    var out = [];
    for (var u = -56; u <= 59.6; u += 1.5) {
      var sum = 0, ws = 0;
      for (var d = -rad; d <= rad; d += 1.5) { var w = 1 - Math.abs(d) / (rad + 1); sum += K.curve(arr, Math.max(-56, Math.min(59.5, u + d))) * w; ws += w; }
      out.push([u, sum / ws]);
    }
    return out;
  }
  function refreshSmooth() {
    if (smoothFor === D.head) return;
    smoothFor = D.head;
    keysS.df = smoothTab(keys.df, 13); keysS.db = smoothTab(keys.db, 13); keysS.w = smoothTab(keys.w, 13); keysS.fm = smoothTab(keys.fm, 13);
  }
  refreshKeys();
  /** point on the head surface at height u and ring angle phi (0 = straight ahead / nose side, PI/2 = her right (c+)); shrink<1 puts it inside */
  function surf(u, phi, shrink) {
    var df = K.curve(keys.df, u), db = K.curve(keys.db, u), w = K.curve(keys.w, u), fm = K.curve(keys.fm, u);
    var ca = cos(phi), sa = sin(phi), s = shrink === undefined ? 1 : shrink;
    return [fm + (ca >= 0 ? df : db) * ca * s, w * sa * s, u];
  }
  A.headSurface = surf;

  /** tunable hair design (defaults are filled in only where not already set, so girl_a_tuned.js / tools can override) */
  var HC = (A.hairCfg = A.hairCfg || {});
  var DEF = {
    knotU: 29,                    // head-local height of the hair tie (crown 59.5, chin -55: ~26 % down from the top, as in ref9)
    knotOut: 2.4,                 // the tie sits this far (units) outside the skull's back contour
    knotIn: 3.2,                  // centre of the gathered-knot ellipsoid this far INSIDE the skull (keeps it overlapping the skull in every pose)
    knotR: [6.4, 4.6, 6.5],       // knot ellipsoid radii (units): along the tail root, across (in the head's f-u plane), lateral
    bandR: [2.4, 6.0],            // hair-tie band radii (along, across)
    bow: 1,                       // round 11: a little bow on the hair tie (two head-rigid loops, 0 = off); bowSize: loop semi-axes (along, across, lateral), bowOff: loop centre offset (across, back)
    bowSize: [10.5, 6.8, 3.2], bowOff: [12.5, 5],
    capK: 0,                      // optional hair-volume cap over the back / top of the skull (0 = off: the traced head already carries the reference's hair volume; >0 swells the back of the head)
    capC: [-2, 24],               // cap ellipsoid centre (head-local f, u) and radii (head-local f, c-fraction of the head width, u)
    capR: [37.5, 0.9, 36.5],
    gapShift: 3.8,                // the upper body of the tail is shifted this far away from the head: a white teardrop stays under the tie (ref9)
    pLen: 128,                    // length of the tail's spine (units); the longest locks reach ~1.15 x
    pWid: 1,                      // body width factor (HWD table)
    runSlim: 0.8,                 // run: body width factor (the strands fan out instead)
    ringK: 1,                     // strand ring radius factor (HRING table)
    lockRef: 15, lockFan: 12, coreEnd: [0.36, 0.66],  // solid locks: reference width (units), lateral fan radius at the tips, and where the body ribbon hands over to them
    boldW: 0.85, boldRu: 0.75,    // bold peeling locks: width and peel-off scale
    looseLen: 1,                  // length factor of the loose face strands
    hang: 0.86,                   // gravity-hang compensation (0 = hair rotates rigidly with the head, 1 = hangs vertically whatever the head does)
    stream: 1,                    // wind streaming strength when running
    streamV: [430, 960],          // speed range (units/s) over which the tail swings back
    windGain: 2.5,                // multiplier of pose.wind (units/s^2)
    runDamp: 40,                  // run: extra coupling (1/s) of the hair to the head's motion (limits the up/down whip at the step frequency)
    runCut: 0.85,                 // run: fraction of the wind streaming removed (the run rest curve already streams back)
    runStiff: 1.5,                // run: spring stiffness gain (omega^2)
    nLock: 5, nBold: 4, nMed: 3, nFine: 7, nEdge: 5, nWisp: 5,
    spineOm: [46, 8.5], spineZ: [0.8, 0.72],     // spine natural frequency (rad/s) and damping ratio tie -> tip
    strandOm: [58, 26], strandZ: [0.92, 0.88],
    headOm: [40, 13], headZ: [0.85, 0.8],
    haloY: [0.4, 0.88],           // body yaw range over which the 'halo' flyaways (strands standing off the head, only seen from the front / 3-4) fade in
    hideY: [0.45, 0.92],          // body yaw range over which the tail retracts behind her head and slims when she faces us (front view: only strands show)
    bodyRamp: 0.4,                // how far down the tail (0..1) the low-passed bob is fully applied
    bodyLP: 12,                   // rad/s: the body of the tail follows a low-passed copy of the head bob (the tie itself stays exact): lazy follow-through
    tipW: 0.2,                    // width added along the whole strand (the tip never gets thinner than this)
    minW: 0.55,                   // minimum width (units) of a fine strand over the first 70 % of its length (thinner strands shimmer when they cross pixel boundaries)
    calmHold: 90,                 // steps of stillness (0.75 s) before the calm LOD (60 Hz hair update + cached path) kicks in; 1e9 disables it
    breeze: 1, tremble: 1,
  };
  for (var dk in DEF) if (HC[dk] === undefined) HC[dk] = DEF[dk];

  var PN = 21;                    // spine nodes
  // designed rest curve: direction (deg) from the head's BACKWARD axis (+ = up) over the normalised spine position; walk / stand and run (ref1: streams back, gentle droop)
  var DIRW = [[0, 22], [0.06, -2], [0.16, -46], [0.3, -80], [0.5, -96], [0.68, -100], [0.85, -93], [1, -84]];
  var DIRR = [[0, 8], [0.14, -5], [0.34, -15], [0.6, -21], [0.85, -25], [1, -29]];
  // solid body half width (units) over the spine position: pinched at the tie, ~34 u wide at mid length, tapering into the locks
  var HWD = [[0, 3.8], [0.04, 5.2], [0.1, 8.6], [0.2, 12.4], [0.34, 15.2], [0.5, 15.6], [0.64, 14.0], [0.76, 11.0], [0.86, 7.0], [0.94, 3.4], [1, 1.4]];
  // outer radius of the strand ring (units): where the flyaways live (incl. the body)
  var HRING = [[0, 7], [0.06, 14], [0.15, 20], [0.3, 24], [0.5, 25], [0.66, 24], [0.8, 20], [0.92, 14], [1, 8]];

  A.createHair = function (seed0) {
    // ------------------------------------------------------------------ node pool (no allocation after build)
    var MAXN = 1400;
    var X = new Float64Array(MAXN), Y = new Float64Array(MAXN), PX = new Float64Array(MAXN), PY = new Float64Array(MAXN), TX = new Float64Array(MAXN), TY = new Float64Array(MAXN);
    var QX = new Float64Array(MAXN), QY = new Float64Array(MAXN), OM2 = new Float64Array(MAXN), CZ = new Float64Array(MAXN), DM = new Float64Array(MAXN), SL = new Float64Array(MAXN);
    var HWt = new Float64Array(MAXN), SWt = new Float64Array(MAXN), HS = new Float64Array(MAXN), TTa = new Float64Array(MAXN);
    var EEa = new Float64Array(MAXN), PAC = new Float64Array(MAXN), PAS = new Float64Array(MAXN), PBC = new Float64Array(MAXN), PBS = new Float64Array(MAXN);      // static per-node tables of the breeze (no transcendental calls per step)
    var nAlloc = 0, lastD = -1, chains = [], pony = [], heads = [], spine = null, inited = false, bnd = null, simT = 0;

    function alloc(n) { var o = nAlloc; nAlloc += n; if (nAlloc > MAXN) throw new Error('hair pool exhausted'); return o; }
    function newChain(kind, n, o) {
      var ch = { kind: kind, o: alloc(n), n: n, ready: false, hn: 0, hk: 0, hr: 3, w0: 1.5, wp: 0.9, tq: 1, wmin: 0, wf: 0, maxD: 20, br: 0, bf: 1, bp: 0, tr: 1, tp: null, L: null, s: null,
        alpha: 0, amp: 0, cf: 1, cp: 0, drift: 0, dp: 1.2, droop: 0, s0: 0, s1: 1, ri: 0.12, sg: 1, phi0: 0, kap: 0, len: 30, ru: -1, ss: 1, bw: 0.4, fy: false };
      for (var i = 0; i < n; i++) { var t = i / (n - 1), j = ch.o + i; TTa[j] = t; EEa[j] = t * t * (1.4 - 0.4 * t); PAC[j] = cos(2.3 * t); PAS[j] = sin(2.3 * t); PBC[j] = cos(1.1 + 3.1 * t); PBS[j] = sin(1.1 + 3.1 * t); }
      if (o) for (var k in o) ch[k] = o[k];
      chains.push(ch);
      return ch;
    }
    function setDyn(ch, om, z, jit) {            // natural frequency (rad/s) / damping ratio from the root to the tip
      var j = jit || 1;
      for (var i = 0; i < ch.n; i++) {
        var t = i / (ch.n - 1), w = lerp(om[0], om[1], pow(t, 0.8)) * j, zz = lerp(z[0], z[1], t);
        OM2[ch.o + i] = w * w; CZ[ch.o + i] = 2 * zz * w;
      }
      lastD = -1;
    }
    function setTaper(ch) {                       // static width taper over the drawn nodes (+ hook nodes)
      var N = ch.n + ch.hn;
      ch.tp = new Float64Array(N); ch.tf = new Float64Array(N);
      for (var i = 0; i < N; i++) { var tt = i / (N - 1); ch.tp[i] = pow(max(0, 1 - pow(tt, ch.tq)), ch.wp) * (ch.ri > 0 ? sstep(0, ch.ri, tt) : 1); ch.tf[i] = (1 - sstep(0.68, 1.0, tt)) * (ch.ri > 0 ? sstep(0, ch.ri, tt) : 1); }
    }

    // ------------------------------------------------------------------ head strands: rest polylines in head-local coordinates
    /** polyline hugging the head surface (u falls, phi sweeps), lifting off by a margin, falling free past the chin */
    function headRest(L, n, o) {
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), ts = t * t * (3 - 2 * t);
        var uu = o.u0 - o.drop * pow(t, o.dg), ph = o.ph0 + o.dph * ts;
        var mg = o.m0 + (o.mk - o.m0) * sin(PI * pow(t, o.mq)) + (o.m1 - o.m0) * t * t + o.wav * sin(TAU * o.wf * t + o.wp) * sstep(0, 0.3, t);
        var uc = min(59, max(-54, uu)), ca = cos(ph), sa = sin(ph);
        var a = ca >= 0 ? K.curve(keysS.df, uc) : K.curve(keysS.db, uc), w = K.curve(keysS.w, uc), fm = K.curve(keysS.fm, uc);
        var nx = ca / (a + 0.5), ny = sa / (w + 0.5), nl = sqrt(nx * nx + ny * ny) || 1;
        L[3 * i] = fm + a * ca + nx / nl * mg; L[3 * i + 1] = w * sa + ny / nl * mg; L[3 * i + 2] = uu;
      }
    }
    function crownRest(L, n, o) {                 // arc over the top of the head in the sagittal plane, floating a few units above the scalp
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), psi = lerp(o.psi0, o.psi1, t), mg = o.m0 + o.m1 * sin(PI * pow(t, 0.8)) + o.drift * t;
        L[3 * i] = (44 + mg) * cos(psi); L[3 * i + 1] = o.c0 + o.cd * t; L[3 * i + 2] = 17 + (44 + mg) * sin(psi) * 0.97;
      }
    }
    function addHead(o, crown) {
      var n = o.n, ch = newChain('head', n, { w0: o.w0, wp: o.wpw || 0.9, tq: o.tq || 1, hk: o.hk || 0, hr: o.hr || 3, hn: o.hk ? 3 : 0, maxD: 26, br: o.br === undefined ? 1.1 : o.br, bf: o.bf, bp: o.bp, tr: o.tr || 1.4, ri: 0.03 });
      ch.L = new Float64Array(3 * n);
      (crown ? crownRest : headRest)(ch.L, n, o);
      var hw = o.hang === undefined ? 1 : o.hang, sw = o.sw === undefined ? 0.7 : o.sw;
      for (var i = 0; i < n; i++) { var t = i / (n - 1), q = sstep(0.08, 0.9, t); HWt[ch.o + i] = hw * q; SWt[ch.o + i] = sw * q; }
      setDyn(ch, o.om || HC.headOm, o.z || HC.headZ, o.jit || 1);
      setTaper(ch);
      ch.fy = !!o.fy; ch.fc = crown ? 1 : 0;          // crown arcs stand up like antennae from the front: they thin out as she turns to us
      ch.fw = o.fw === undefined ? 1 : o.fw;            // 0 = a profile-only strand (fades out in the front view)
      heads.push(ch);
      return ch;
    }
    function buildHead(R) {
      var k, sg, ll = HC.looseLen, hkS = function (a, b) { return R.range(a, b) * (R.next() < 0.5 ? -1 : 1); };
      // fringe: leaves the hairline above the forehead and falls in front of the face, close to it (ref9), tucking back toward the chin; hooked tips
      for (k = 0; k < 3; k++) {
        var ph0 = (k - 1) * 0.3 + R.range(-0.04, 0.04);
        addHead({ n: 12, u0: R.range(42, 50), ph0: ph0, dph: (ph0 >= 0 ? 1 : -1) * R.range(0.05, 0.3), drop: R.range(62, 98) * ll, dg: 0.9, m0: 1.6, mk: R.range(3.5, k === 1 ? 9 : 7), mq: R.range(0.6, 0.8), m1: R.range(0.5, 4),
          wav: R.range(0.5, 1.2), wf: R.range(0.8, 1.3), wp: R.range(0, TAU), w0: R.range(1.6, 2.3), hk: hkS(0.9, 2.2), hr: R.range(2.5, 4.5), jit: R.range(0.9, 1.15), bf: R.range(1.2, 2.2), bp: R.range(0, TAU) });
      }
      // gathered hair: a few strands lying along the back of the skull, flowing from the crown into the tie (the hair is pulled into the tail)
      for (k = 0; k < 3; k++) {
        var gu = R.range(51, 57);
        addHead({ n: 9, u0: gu, ph0: PI + (k - 1) * 0.32 + R.range(-0.06, 0.06), dph: -(k - 1) * 0.22, drop: gu - HC.knotU - 1.5, dg: 1, m0: 0.4, mk: R.range(1.4, 2.6), mq: 0.7, m1: 0.6, wav: 0, wf: 1, wp: 0,
          w0: R.range(1.2, 1.6), wpw: 0.7, hk: 0, jit: 1, bf: 1.2, bp: R.range(0, TAU), br: 0.2, hang: 0, sw: 0, om: [40, 30], z: [0.95, 0.95], fw: 0 });
      }
      for (k = 0; k < 2; k++) {                      // short wisps right at the forehead hairline
        var phs = (k - 0.5) * 0.4 + R.range(-0.08, 0.08);
        addHead({ n: 9, u0: R.range(43, 51), ph0: phs, dph: phs * 0.3, drop: R.range(24, 38) * ll, dg: 1, m0: 1.6, mk: R.range(4, 8), mq: 0.8, m1: R.range(2, 6), wav: R.range(0.2, 0.6), wf: 1, wp: R.range(0, TAU), w0: R.range(1.3, 1.7),
          hk: hkS(1.0, 2.0), hr: R.range(2, 3.5), jit: R.range(0.95, 1.2), bf: R.range(1.4, 2.4), bp: R.range(0, TAU) });
      }
      // temples: fall along the sides of the face and hang beside the jaw / neck (from the front only one per side stays: no 'bracket' cage around the face)
      for (k = 0; k < 4; k++) {
        sg = k % 2 ? 1 : -1;
        addHead({ n: 12, u0: R.range(30, 44), ph0: sg * R.range(1.1, 1.45), dph: -sg * R.range(0.0, 0.4), drop: R.range(74, 98) * ll, dg: 0.9, m0: 1.4, mk: R.range(3, 8), mq: R.range(0.7, 0.95), m1: R.range(2, 8),
          wav: R.range(0.4, 1.0), wf: R.range(0.8, 1.3), wp: R.range(0, TAU), w0: R.range(1.4, 1.9), hk: hkS(0.9, 2.2), hr: R.range(2.5, 4.2), jit: R.range(0.9, 1.15), bf: R.range(1.2, 2.2), bp: R.range(0, TAU), fw: k < 2 ? 1 : 0 });
      }
      // ear wisps (short)
      for (k = 0; k < 2; k++) {
        sg = k % 2 ? 1 : -1;
        addHead({ n: 10, u0: R.range(16, 28), ph0: sg * R.range(1.3, 1.7), dph: sg * R.range(0.0, 0.3), drop: R.range(40, 56) * ll, dg: 0.95, m0: 1.2, mk: R.range(3, 6), mq: 0.85, m1: R.range(2, 6),
          wav: R.range(0.2, 0.6), wf: R.range(0.8, 1.1), wp: R.range(0, TAU), w0: R.range(1.2, 1.5), hk: hkS(0.8, 1.8), hr: R.range(2, 3.5), jit: R.range(0.95, 1.2), bf: R.range(1.4, 2.4), bp: R.range(0, TAU) });
      }
      // nape: a few short strands escaping under the tail, down the back of the neck
      for (k = 0; k < 3; k++) {
        addHead({ n: 10, u0: R.range(-30, -14), ph0: PI + R.range(-0.8, 0.8), dph: R.range(-0.2, 0.2), drop: R.range(28, 46) * ll, dg: 1, m0: 1.2, mk: R.range(2, 5), mq: 0.9, m1: R.range(2, 7),
          wav: R.range(0.3, 0.8), wf: R.range(0.8, 1.2), wp: R.range(0, TAU), w0: R.range(1.2, 1.6), hk: hkS(0.9, 2.0), hr: R.range(2, 3.5), jit: R.range(0.95, 1.2), bf: R.range(1.4, 2.4), bp: R.range(0, TAU) });
      }
      // crown flyaways: thin arcs floating just above the head contour (psi = angle in the sagittal plane: PI/2 = top, > PI/2 toward the back)
      var cr = [{ psi0: 2.25, psi1: 1.45, m0: 0.4, m1: 1.6, drift: 6.0, c0: -6, cd: 4 }, { psi0: 1.6, psi1: 0.85, m0: 0.4, m1: 2.0, drift: 5.0, c0: 5, cd: -3 },
        { psi0: 2.8, psi1: 2.2, m0: 0.4, m1: 1.2, drift: 4.5, c0: -2, cd: 3 }, { psi0: 1.15, psi1: 1.85, m0: 0.4, m1: 1.4, drift: 5.5, c0: 3, cd: -5 }];
      for (k = 0; k < cr.length; k++) {               // short, springy and smooth (no hang: they ride with the head; soft tips, no kinks)
        var o = cr[k]; o.n = 9; o.w0 = R.range(1.2, 1.6); o.wpw = 0.8; o.hk = k < 2 ? hkS(0.6, 1.2) : 0; o.hr = 2.5; o.jit = R.range(0.95, 1.05); o.bf = R.range(1, 1.8); o.bp = R.range(0, TAU); o.sw = 0.3; o.hang = 0; o.br = 0.6;
        o.om = [34, 22]; o.z = [0.95, 0.9];
        addHead(o, true);
      }
    }

    /** halo flyaways: strands standing off the head at the ears / temples / nape; only visible from the front and the 3/4 views (fade in with the yaw), the profile is unchanged */
    function buildHalo(R) {
      var k, sg, hkS = function (a, b) { return R.range(a, b) * (R.next() < 0.5 ? -1 : 1); };
      for (k = 0; k < 2; k++) {                      // short flicks standing off the sides of the head at ear level (ref8), curling out
        sg = k % 2 ? 1 : -1;
        addHead({ fy: true, n: 10, u0: R.range(20, 30), ph0: sg * R.range(1.35, 1.5), dph: sg * R.range(0.05, 0.3), drop: R.range(26, 40), dg: 0.95, m0: 1.0, mk: R.range(6, 10), mq: R.range(0.5, 0.7), m1: R.range(6, 10),
          wav: R.range(0.3, 0.8), wf: R.range(0.8, 1.2), wp: R.range(0, TAU), w0: R.range(1.4, 1.8), hk: sg * R.range(1.4, 2.4), hr: R.range(3, 4.5), jit: R.range(0.9, 1.15), bf: R.range(1.2, 2.2), bp: R.range(0, TAU) });
      }
      addHead({ fy: true, n: 11, u0: R.range(32, 38), ph0: -R.range(1.3, 1.45), dph: -R.range(0.0, 0.2), drop: R.range(48, 60), dg: 0.95, m0: 1.2, mk: R.range(7, 11), mq: 0.6, m1: R.range(5, 9),       // one longer loose wisp (asymmetry)
        wav: R.range(0.5, 1.1), wf: R.range(0.9, 1.3), wp: R.range(0, TAU), w0: R.range(1.3, 1.7), hk: hkS(1.2, 2.2), hr: R.range(3, 5), jit: R.range(0.9, 1.15), bf: R.range(1.2, 2.2), bp: R.range(0, TAU) });
      addHead({ fy: true, n: 10, u0: R.range(-12, -20), ph0: R.range(1.9, 2.3), dph: R.range(0.0, 0.3), drop: R.range(34, 46), dg: 1, m0: 1.2, mk: R.range(5, 8), mq: 0.8, m1: R.range(4, 8),       // behind the ear, beside the neck
        wav: R.range(0.3, 0.9), wf: R.range(0.8, 1.3), wp: R.range(0, TAU), w0: R.range(1.2, 1.6), hk: hkS(1.0, 2.2), hr: R.range(2.5, 4.5), jit: R.range(0.95, 1.2), bf: R.range(1.4, 2.4), bp: R.range(0, TAU) });
      for (k = 0; k < 2; k++) {                      // two little curved flyaways off the upper corners of the head (front view: the crown arcs are edge-on there)
        sg = k ? 1 : -1;
        addHead({ fy: true, n: 9, u0: R.range(52, 56), ph0: sg * R.range(1.0, 1.3), dph: sg * R.range(0.2, 0.4), drop: R.range(8, 12), dg: 1, m0: 0.6, mk: R.range(2.5, 4), mq: 0.7, m1: R.range(3, 5),
          wav: 0.2, wf: 1, wp: R.range(0, TAU), w0: R.range(1.1, 1.4), hk: sg * R.range(1.2, 2.0), hr: R.range(2.5, 3.5), jit: 1, bf: R.range(1.2, 2), bp: R.range(0, TAU), om: [36, 22], z: [0.95, 0.9] });
      }
    }

    // ------------------------------------------------------------------ ponytail strands (parametrised on the lagged spine)
    var nrX = new Float64Array(PN), nrY = new Float64Array(PN), Hb = new Float64Array(PN), Hs = new Float64Array(PN), Hv = new Float64Array(PN), Hc = new Float64Array(PN), shf = new Float64Array(PN), sOut = new Float64Array(PN), spineLen = 100;
    var BX = new Float64Array(PN), BY = new Float64Array(PN);
    var ThW = new Float64Array(PN), ThR = new Float64Array(PN), tieF = -40, knotF = -34;          // segment directions (rad, from the backward axis, + = up): walk / run
    function addPony(o) {
      var m = o.m, ch = newChain(o.kind || 'pony', m, { w0: o.w0 || 1.4, wp: o.wp || 0.9, tq: o.tq || 1, wf: o.wf || 0, hk: o.hk || 0, hr: o.hr || 3, hn: o.hk ? 3 : 0, alpha: o.a || 0, amp: o.amp || 0, cf: o.cf || 1, cp: o.cp || 0, drift: o.drift || 0, dp: o.dp || 1.2,
        droop: o.droop || 0, s0: o.s0 || 0, s1: o.s1 || 1, maxD: o.wf ? 7 : (o.kind === 'wisp' ? 14 : 12), br: o.br === undefined ? 0.7 : o.br, bf: o.bf || 1.5, bp: o.bp || 0, tr: o.tr || 1.3, ri: o.ri === undefined ? 0.12 : o.ri,
        sg: o.sg || 1, phi0: o.phi0 || 0, kap: o.kap || 0, len: o.len || 30, ru: o.ru === undefined ? -1 : o.ru, ss: o.ss || 1, bw: o.bw === undefined ? 0.4 : o.bw });
      ch.fanS = new Float64Array(m); ch.s = new Float64Array(m); ch.wvS = new Float64Array(m); ch.esS = new Float64Array(m); ch.flS = new Float64Array(m); ch.pwS = new Float64Array(m); ch.drS = new Float64Array(m);
      for (var j = 0; j < m; j++) {                   // everything that depends only on the position along the strand is tabulated once
        var sj = ch.s0 + (ch.s1 - ch.s0) * (j / (m - 1)), q = (sj - ch.s0) / (ch.s1 - ch.s0);
        ch.s[j] = sj;
        ch.wvS[j] = ch.amp * sin(TAU * ch.cf * q + ch.cp) * sstep(0, 0.35, q) * (0.55 + 0.45 * q);
        ch.esS[j] = (1 - ch.bw) * sin(PI * pow(q, ch.dp)) + ch.bw * q * q * (3 - 2 * q);
        ch.flS[j] = max(0, sj - 0.85) * q;
        ch.pwS[j] = pow(q, ch.dp);
        ch.drS[j] = sj > 0.7 ? (sj - 0.7) * (sj - 0.7) : 0;
        ch.fanS[j] = sstep(0.5, 1.12, sj);
      }
      setDyn(ch, HC.strandOm, HC.strandZ, o.jit || 1);
      setTaper(ch);
      pony.push(ch);
      return ch;
    }
    function buildPony(R) {
      var i, a, sg, n, s0, k;
      n = HC.nLock;
      for (i = 0; i < n; i++) {                       // solid LOCKS: long S-curved ribbons in lateral slots; they fill the lower body and split into separate pointed wavy tips
        a = -0.8 + 1.6 * (n > 1 ? i / (n - 1) : 0.5) + R.range(-0.05, 0.05); var aa = abs(a) / 0.8; sg = a < 0 ? -1 : 1;
        addPony({ m: 13, a: a, s0: R.range(0.08, 0.16), ri: 0.26, s1: [1.2, 1.0, 1.14, 0.93, 1.08][i % 5] + R.range(-0.03, 0.03), wf: R.range(0.34, 0.39) * (1 - 0.15 * aa), w0: 1, wp: 1.0, tq: 2.0,
          amp: R.range(3.2, 5.0), cf: R.range(0.75, 1.1), cp: R.range(0, TAU), dp: 1.6, droop: 0, hk: (sg * 0.8 + R.range(-0.5, 0.5)) * R.range(1.2, 2.2), hr: R.range(4, 6.5), br: 0.5, jit: R.range(0.92, 1.08), bf: R.range(1, 1.8), bp: R.range(0, TAU) });
      }
      var fr = function (x) { return x - Math.floor(x); }, phM = R.next(), phD = R.next(), phF = R.next(), phE = R.next();
      n = HC.nBold;                                   // bold peeling locks: S-curves leaving both flanks of the lower tail, curled tips
      for (i = 0; i < n; i++) {
        sg = i % 2 ? 1 : -1; k = i >> 1;
        s0 = 0.3 + 0.28 * fr(k * 0.618034 + phM);
        addPony({ m: 9, ss: sg, ru: (0.35 + 0.4 * fr(k * 0.381966 + phM * 0.5)) * HC.boldRu, s0: s0, s1: min(1.2, s0 + 0.5 + 0.3 * fr(k * 0.754877 + phM)), w0: R.range(3.2, 4.4) * HC.boldW, wp: 0.95, tq: 1.25, ri: 0.14, amp: R.range(2.5, 5), cf: R.range(0.55, 0.95), cp: R.range(0, TAU),
          dp: R.range(0.7, 1.05), bw: R.range(0.2, 0.55), droop: R.range(0, 0.06), hk: -sg * R.range(1.3, 2.6), hr: R.range(4, 6.5), jit: R.range(0.92, 1.1), bf: R.range(0.9, 1.7), bp: R.range(0, TAU), br: 0.8 });
      }
      for (i = 0; i < HC.nMed; i++) {                 // medium strands: S-curves peeling off the edge
        sg = i % 2 ? 1 : -1; s0 = R.range(0.18, 0.5);
        addPony({ m: 8, ss: sg, ru: 0.4 + 0.6 * fr((i >> 1) * 0.618034 + phD), s0: s0, s1: min(1.24, s0 + R.range(0.45, 0.75)), w0: R.range(1.8, 2.5), wp: 0.9, tq: 1.3, amp: R.range(2.0, 4.5), cf: R.range(0.6, 1.2), cp: R.range(0, TAU),
          dp: R.range(0.6, 1.0), bw: R.range(0.15, 0.7), droop: R.range(0, 0.08), hk: R.next() < 0.7 ? -sg * R.range(0.9, 2.0) : 0, hr: R.range(2.5, 4.5), jit: R.range(0.92, 1.12), bf: R.range(1, 2), bp: R.range(0, TAU) });
      }
      for (i = 0; i < HC.nFine; i++) {                // fine flyaways around the edge (mostly the outer, back edge of the upper tail)
        sg = i % 3 === 2 ? -1 : 1; s0 = 0.1 + 0.45 * pow(R.next(), 0.9);
        addPony({ m: 7, ss: sg, ru: 0.45 + 0.6 * fr((i >> 1) * 0.618034 + phF), s0: s0, s1: min(1.2, s0 + R.range(0.2, 0.45)), w0: R.range(1.1, 1.6), wp: 0.9, tq: 1.15, amp: R.range(1.2, 3.2), cf: R.range(0.8, 1.6), cp: R.range(0, TAU),
          dp: R.range(0.6, 1.0), bw: R.range(0.15, 0.7), droop: R.range(0, 0.08), hk: R.next() < 0.55 ? -sg * R.range(1.0, 2.4) : 0, hr: R.range(2.5, 4), jit: R.range(0.9, 1.15), bf: R.range(1, 2.2), bp: R.range(0, TAU) });
      }
      for (i = 0; i < HC.nEdge; i++) {                // long thin flyaways on the outline: big S, curled tips
        sg = i % 2 ? 1 : -1; s0 = R.range(0.16, 0.5);
        addPony({ m: 9, ss: sg, ru: 0.95 + 0.4 * fr((i >> 1) * 0.618034 + phE), s0: s0, s1: min(1.28, s0 + R.range(0.45, 0.75)), w0: R.range(1.0, 1.4), wp: 0.85, tq: 1.1, amp: R.range(3.0, 5.5), cf: R.range(0.6, 1.1), cp: R.range(0, TAU),
          dp: R.range(0.6, 0.9), bw: R.range(0.3, 0.8), droop: R.range(0, 0.05), hk: R.next() < 0.65 ? -sg * R.range(1.3, 2.6) : 0, hr: R.range(3, 5.5), jit: R.range(0.9, 1.2), bf: R.range(0.8, 1.6), bp: R.range(0, TAU), br: 1.0 });
      }
      for (i = 0; i < HC.nWisp; i++) {                // stray hairs at the tie: arc up and back over the tail (fountain), then fall; the last one drops into the gap under the tie
        var lo = i === HC.nWisp - 1, wl = lo ? R.range(30, 40) : R.range(24, 46);
        addPony({ kind: 'wisp', m: 11, sg: lo ? -1 : 1, phi0: lo ? 0.55 : R.range(0.15, 0.85), len: wl, kap: (lo ? -0.5 : R.range(1.7, 2.6)) / wl, w0: R.range(1.0, 1.35), wp: 0.85, tq: 1.0, ri: 0.12, hk: (lo ? -1 : 1) * R.range(1.0, 2.2), hr: R.range(3, 5), jit: R.range(0.9, 1.2), bf: R.range(1, 2), bp: R.range(0, TAU), br: 1.0 });
      }
      for (i = 0; i < 1; i++)                         // a long strand hugging the inner edge (the head side)
        addPony({ m: 12, a: -1.04 - 0.08 * i, s0: 0.08, s1: 0.96 - 0.1 * i, w0: 1.5, wp: 0.9, tq: 1.2, amp: 1.0, cf: 1.2, cp: R.range(0, TAU), drift: 0, jit: 1, bf: 1, bp: R.range(0, TAU), br: 0.5 });
    }
    /** samples the direction keys at the segment midpoints (rad) */
    function designDirs(dk, Th) { Th[0] = dk[0][1] * PI / 180; for (var i = 1; i < PN; i++) Th[i] = K.curve(dk, (i - 0.5) / (PN - 1)) * PI / 180; }

    // ------------------------------------------------------------------ build
    function build(seed) {
      refreshKeys(); refreshSmooth();
      nAlloc = 0; chains.length = 0; pony.length = 0; heads.length = 0; lastD = -1;
      var sd = seed === undefined ? 1 : seed, R = GA.util.rng(sd * 7919 + 13);
      // the tie on the skull's back contour (head-local f at the tie height), the knot centre just inside it
      var fS = K.curve(keys.fm, HC.knotU) - K.curve(keys.db, HC.knotU);
      tieF = fS - HC.knotOut; knotF = fS + HC.knotIn;
      designDirs(DIRW, ThW); designDirs(DIRR, ThR);
      spine = newChain('spine', PN, { maxD: 48, br: 0.5, bf: 1, bp: 0.7, tr: 1.0 });
      for (var i = 0; i < PN; i++) { var t = i / (PN - 1); HWt[spine.o + i] = sstep(-0.9, 0.45, t); SWt[spine.o + i] = pow(sstep(0.0, 0.5, t), 0.8) * 0.9; }   // gravity weight: the tail bends right below the tie (no plume when she bows her head)
      setDyn(spine, HC.spineOm, HC.spineZ, 1);
      buildHead(R);
      buildPony(GA.util.rng(sd * 104729 + 7));
      buildHalo(GA.util.rng(sd * 15485863 + 11));
      inited = false; simT = 0; bnd = null; curSeed = sd; calmN = 0; parity = 0; cacheAge = 99; envReady = false;
      for (var q = 0; q < chains.length; q++) chains[q].ready = false;
    }

    // ------------------------------------------------------------------ per-step frame data
    var tlx = 0, tly = 0, tlInit = false, fhide = 0, gHide = 1, gRing = 1, fhalo = 0, fcrn = 0, fwsp = 1, calmN = 0, parity = 0, curSeed = 1, stiffK = 1, runDampF = 1, cth = 1, sth = 0, ox = 0, oy = 0, roll = 0, hcx = 0, hcy = 0, shud = 0, shT = 0, hangW = 0.78, amt = 0, wdx = 1, wdy = 0, vLPx = 0, vLPy = 0, lastTx = 0, lastTy = 0, haveLast = false, ponyRunW = 0, tFront = 0;
    function frame(S) {
      cth = cos(S.theta); sth = sin(S.theta); ox = S.ox; oy = S.oy;
      var R = S.Fhead.R, O = S.Fhead.o;
      var ux = -(R[2] * cth + R[5] * sth), uh = R[8];
      roll = atan2(ux, uh); if (roll > 2.3) roll = 2.3; else if (roll < -2.3) roll = -2.3;          // deep bows (look down at the console) reach ~1.6 rad
      hcx = ox - (O[0] * cth + O[1] * sth); hcy = oy - O[2];
      var P = S.P; shud = P.shudder || 0; shT = P.shudderT || 0;
      hangW = HC.hang + 0.1 * (P.peek || 0);
      tFront = 0;
      var yy = P.yaw > 1 ? 1 : P.yaw < 0 ? 0 : P.yaw;
      fhide = sstep(HC.hideY[0], HC.hideY[1], yy); gHide = 1 - 0.6 * fhide; gRing = max(0, 1 - 1.6 * fhide); fhalo = sstep(HC.haloY[0], HC.haloY[1], yy); fcrn = sstep(0.2, 0.6, yy); fwsp = 1 - sstep(0.12, 0.45, yy);
    }
    /** ponytail rest nodes (screen): the designed curve hung from the tie, built segment by segment in 3D.  Each segment direction is the designed direction in the
        HEAD frame blended toward the same direction in an UPRIGHT frame (same heading, world up) by hang x HWt: gravity hang that is right in every view (a bow seen in 3/4
        view, the peek, the run lean), the root stays with the head, the body hangs. */
    var envReady = false, rwS = 0, havePony = false, rdF = -1, rdC = 0, rdH = 0;
    function ponyBase(S, d) {
      havePony = true;
      var rT = S.run || 0; rwS = envReady && d > 0 ? rwS + (rT - rwS) * (1 - exp(-d / 0.2)) : rT;          // the rig blends walk -> run in ~0.1 s: the tail swings back over ~0.3 s instead of snapping
      var rw = rwS, R = S.Fhead.R, O = S.Fhead.o, so = spine.o;
      var fx = R[0], fy = R[3], fz = R[6], ux = R[2], uy = R[5], uz = R[8], ul = sqrt(ux * ux + uy * uy + uz * uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      var hx = R[4], hy = -R[1], hl = sqrt(hx * hx + hy * hy);          // heading = c x up (horizontal; unaffected by head pitch / roll)
      if (hl > 1e-6) { hx /= hl; hy /= hl; } else { hx = fx; hy = fy; hl = sqrt(hx * hx + hy * hy) || 1; hx /= hl; hy /= hl; }
      // round 11: a look back over the shoulder while running must not swing the tail round to the front: the air streams it along the BODY's heading, not the head's
      var lookBack = rw * sstep(0.45, 1.5, abs(atan2(R[3], R[0])));
      if (lookBack > 0) { hx += (1 - hx) * lookBack; hy -= hy * lookBack; hl = sqrt(hx * hx + hy * hy) || 1; hx /= hl; hy /= hl; }
      var tu = HC.knotU, pf = R[0] * tieF + R[2] * tu + O[0], pc = R[3] * tieF + R[5] * tu + O[1], ph = R[6] * tieF + R[8] * tu + O[2];
      var ds = HC.pLen / (PN - 1) * (1 + 0.05 * rw) * (1 - 0.75 * fhide);          // facing us: the tail retracts behind her head (no tail in the front view)
      var bowK = sstep(0.35, 1.1, Math.acos(uz > 1 ? 1 : uz < -1 ? -1 : uz)) * (1 - 0.85 * rw);   // head tilted far from upright (look-down bow, peek): the root hangs too (no bun / plume on top); not in the run (it streams)
      BX[0] = ox - (pf * cth + pc * sth); BY[0] = oy - ph; Hb[0] = HWD[0][1];
      for (var i = 1; i < PN; i++) {
        var th = ThW[i] + (ThR[i] - ThW[i]) * rw; th += (-1.31 - th) * 0.7 * bowK;            // bowed: no fountain arc, the tail drops from the tie and hangs (a little behind her)
        var ct = cos(th), st = sin(th), hw0 = HWt[so + i], w = hangW * (hw0 + (1 - hw0) * max(bowK, 0.6 * rw));          // (run lean: the root must not rise above the head)
        var dx = -fx * ct + ux * st, dy = -fy * ct + uy * st, dz = -fz * ct + uz * st;          // designed direction in the head frame
        dx += (-hx * ct - dx) * w; dy += (-hy * ct - dy) * w; dz += (st - dz) * w;             // ... toward the upright frame
        var dl = sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= dl; dy /= dl; dz /= dl;
        if (i === 1) { rdF = dx; rdC = dy; rdH = dz; }
        pf += dx * ds; pc += dy * ds; ph += dz * ds;
        BX[i] = ox - (pf * cth + pc * sth); BY[i] = oy - ph; Hb[i] = K.curve(HWD, i / (PN - 1));
      }
      ponyRunW = rw;
    }
    /** bends the target polyline of a chain: gravity hang (against the head tilt), wind streaming */
    function shape(o, n, hang, rollA, amtA, dx_, dy_) {
      var opx = TX[o], opy = TY[o], px = opx, py = opy;
      for (var i = 1; i < n; i++) {
        var idx = o + i, dx = TX[idx] - opx, dy = TY[idx] - opy, L = sqrt(dx * dx + dy * dy);
        opx = TX[idx]; opy = TY[idx];
        var a = -rollA * hang * HWt[idx], ca = cos(a), sa = sin(a), rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
        if (amtA > 0) {
          var w = amtA * SWt[idx];
          if (w > 0) {
            var nx = (1 - w) * rx + w * L * dx_, ny = (1 - w) * ry + w * L * dy_, nl = sqrt(nx * nx + ny * ny);
            if (nl > 1e-3 * L + 1e-6) { rx = nx / nl * L; ry = ny / nl * L; }
          }
        }
        px += rx; py += ry; TX[idx] = px; TY[idx] = py;
      }
    }
    /** idle breeze + shudder tremble added to the targets (smooth, grows toward the tip) */
    function perturb(ch) {
      var o = ch.o, n = ch.n, br = ch.br * HC.breeze, tr = shud > 0 ? shud * ch.tr * HC.tremble : 0, T1 = simT * ch.bf + ch.bp, T2 = T1 * 0.83;
      var s1 = sin(T1), c1 = cos(T1), s2 = sin(T2), c2 = cos(T2);
      for (var i = 1; i < n; i++) {
        var j = o + i, e = EEa[j], bx = br * e * (s1 * PAC[j] + c1 * PAS[j]), by = br * 0.6 * e * (s2 * PBC[j] + c2 * PBS[j]);
        if (tr > 0) { var ph = TAU * 15 * shT + ch.bp * 3 + 9 * TTa[j]; bx += tr * e * sin(ph); by += tr * 0.7 * e * cos(ph * 0.93 + 1.3); }
        TX[j] += bx; TY[j] += by;
      }
    }

    // ------------------------------------------------------------------ integration (relative-velocity damped springs + length constraints)
    function prepStep(d) {
      if (d === lastD) return;
      lastD = d;
      for (var i = 0; i < nAlloc; i++) DM[i] = exp(-CZ[i] * d);
    }
    function integrate(ch, d, ax, ay) {
      var o = ch.o, n = ch.n, dd = d * d * stiffK, xd = runDampF, i, idx;
      for (i = 1; i < n; i++) { idx = o + i; var dx = TX[idx] - TX[idx - 1], dy = TY[idx] - TY[idx - 1]; SL[idx] = sqrt(dx * dx + dy * dy) || 0.01; }
      X[o] = TX[o]; Y[o] = TY[o]; PX[o] = QX[o]; PY[o] = QY[o];
      for (i = 1; i < n; i++) {
        idx = o + i;
        var tvx = TX[idx] - QX[idx], tvy = TY[idx] - QY[idx], vx = X[idx] - PX[idx], vy = Y[idx] - PY[idx], dm = DM[idx], w = 0.35 + 0.65 * TTa[idx];
        PX[idx] = X[idx]; PY[idx] = Y[idx];
        X[idx] += tvx + (vx - tvx) * dm * xd + OM2[idx] * (TX[idx] - X[idx]) * dd + ax * w * dd;
        Y[idx] += tvy + (vy - tvy) * dm * xd + OM2[idx] * (TY[idx] - Y[idx]) * dd + ay * w * dd;
      }
      for (var it = 0, its = n > 15 ? 3 : 2; it < its; it++) {
        for (i = 1; i < n; i++) {
          var a = o + i - 1, b = o + i, ex = X[b] - X[a], ey = Y[b] - Y[a], dl = sqrt(ex * ex + ey * ey) || 1e-6, df = (dl - SL[b]) / dl;
          if (i === 1) { X[b] -= ex * df; Y[b] -= ey * df; } else { X[b] -= ex * df * 0.5; Y[b] -= ey * df * 0.5; X[a] += ex * df * 0.5; Y[a] += ey * df * 0.5; }
        }
      }
      // bending stiffness: smooth the DEVIATION from the target along the strand (keeps the designed curls, removes the zig-zag kinks a fast head snap would buckle into the chain)
      for (var bp = 0, bpN = ch.kind === 'head' ? 2 : 1; bp < bpN; bp++) {
        var pdx = 0, pdy = 0;                         // node 0 is pinned: deviation 0
        for (i = 1; i < n; i++) {
          idx = o + i;
          var cdx = X[idx] - TX[idx], cdy = Y[idx] - TY[idx], ndx, ndy;
          if (i < n - 1) { ndx = X[idx + 1] - TX[idx + 1]; ndy = Y[idx + 1] - TY[idx + 1]; } else { ndx = cdx; ndy = cdy; }
          var ex2 = 0.35 * (0.5 * (pdx + ndx) - cdx), ey2 = 0.35 * (0.5 * (pdy + ndy) - cdy);
          X[idx] += ex2; Y[idx] += ey2;               // (a position correction like the length constraints: it also damps the kink modes)
          pdx = cdx; pdy = cdy;
        }
      }
      var md = ch.maxD, md2 = md * md;
      for (i = 1; i < n; i++) {                       // never let a node wander far from its target (no explosions, ever)
        idx = o + i;
        var rx = X[idx] - TX[idx], ry = Y[idx] - TY[idx], r2 = rx * rx + ry * ry;
        if (r2 > md2) { var sc = md / sqrt(r2), sx = rx * sc - rx, sy = ry * sc - ry; X[idx] += sx; Y[idx] += sy; PX[idx] += sx; PY[idx] += sy; }
        else if (r2 !== r2) { X[idx] = TX[idx]; Y[idx] = TY[idx]; PX[idx] = TX[idx]; PY[idx] = TY[idx]; }
      }
    }
    function savePrev(ch) { var e = ch.o + ch.n; for (var i = ch.o; i < e; i++) { QX[i] = TX[i]; QY[i] = TY[i]; } }
    function initChain(ch) { var e = ch.o + ch.n; for (var i = ch.o; i < e; i++) { X[i] = TX[i]; Y[i] = TY[i]; PX[i] = TX[i]; PY[i] = TY[i]; QX[i] = TX[i]; QY[i] = TY[i]; } ch.ready = true; }
    function shiftAll(jx, jy) { for (var i = 0; i < nAlloc; i++) { X[i] += jx; Y[i] += jy; PX[i] += jx; PY[i] += jy; QX[i] += jx; QY[i] += jy; TX[i] += jx; TY[i] += jy; } }

    // ------------------------------------------------------------------ spine helpers (normals, envelope, sampling)
    function spineNormals() {
      var o = spine.o, len = 0, i;
      for (i = 0; i < PN; i++) {
        var a = i > 0 ? i - 1 : 0, b = i < PN - 1 ? i + 1 : PN - 1, tx = X[o + b] - X[o + a], ty = Y[o + b] - Y[o + a], tl = sqrt(tx * tx + ty * ty) || 1;
        nrX[i] = ty / tl; nrY[i] = -tx / tl;
        if (i > 0) { var ex = X[o + i] - X[o + i - 1], ey = Y[o + i] - Y[o + i - 1]; len += sqrt(ex * ex + ey * ey); }
      }
      spineLen = len || 1;
    }
    var tmpA = new Float64Array(PN);
    function smooth3(a, n, passes) {                 // [1 2 1]/4, ends fixed
      for (var p = 0; p < passes; p++) {
        tmpA[0] = a[0]; tmpA[n - 1] = a[n - 1];
        for (var i = 1; i < n - 1; i++) tmpA[i] = 0.25 * a[i - 1] + 0.5 * a[i] + 0.25 * a[i + 1];
        for (i = 1; i < n - 1; i++) a[i] = tmpA[i];
      }
    }
    /** body half width Hs, strand ring radius Hv, body-ribbon half width Hc, side facing away from the head sOut */
    var sRaw = new Float64Array(PN);
    function envelope(kLP) {
      var o = spine.o, rw = ponyRunW, vol = HC.pWid * (1 + 0.12 * amt) * lerp(1, HC.runSlim, rw), rk = HC.ringK * (1 + 0.2 * amt + 0.25 * rw), i;
      for (i = 0; i < PN; i++) {
        var h = Hb[i] * vol;
        // curvature clamp: the offset outline must not fold where the tail bends sharply
        var a = i > 0 ? i - 1 : 0, b = i < PN - 1 ? i + 1 : PN - 1;
        if (b - a === 2 && i >= 2) {
          var t1x = X[o + i] - X[o + a], t1y = Y[o + i] - Y[o + a], t2x = X[o + b] - X[o + i], t2y = Y[o + b] - Y[o + i], l1 = sqrt(t1x * t1x + t1y * t1y) || 1, l2 = sqrt(t2x * t2x + t2y * t2y) || 1;
          var cr = (t1x * t2y - t1y * t2x) / (l1 * l2), kap = abs(cr) / (0.5 * (l1 + l2));
          if (kap > 1e-4) h = K.smin(h, 0.9 / kap, 6);
        }
        Hs[i] = h;
        var s = (nrX[i] * (X[o + i] - hcx) + nrY[i] * (Y[o + i] - hcy)) / 18; sRaw[i] = s > 1 ? 1 : s < -1 ? -1 : s;      // + = the +normal side faces away from the head
      }
      smooth3(Hs, PN, 1); smooth3(sRaw, PN, 3);
      for (i = 0; i < PN; i++) sOut[i] += (sRaw[i] - sOut[i]) * kLP;          // low-passed in time: no side flips when the tail swings past the head centre (bows)
      for (i = 0; i < PN; i++) {
        var t2 = i / (PN - 1), h2 = Hs[i];
        Hv[i] = max(h2 * 1.2, K.curve(HRING, t2) * rk);
        Hc[i] = h2 * (1 - sstep(HC.coreEnd[0], HC.coreEnd[1], t2) * 0.97);
        shf[i] = HC.gapShift * sstep(0.02, 0.16, t2) * (1 - sstep(0.4, 0.85, t2)) * sOut[i];
      }
    }
    var sp = { x: 0, y: 0, nx: 0, ny: 1, h: 0, hv: 0, so: 0 };
    function spineAt(s) {
      var o = spine.o, u = s * (PN - 1), i0, f, nx, ny;
      if (u >= PN - 1) {
        var tx = X[o + PN - 1] - X[o + PN - 3], ty = Y[o + PN - 1] - Y[o + PN - 3], tl = sqrt(tx * tx + ty * ty) || 1, d = (s - 1) * spineLen;
        sp.x = X[o + PN - 1] + tx / tl * d; sp.y = Y[o + PN - 1] + ty / tl * d; sp.nx = ty / tl; sp.ny = -tx / tl; sp.h = Hs[PN - 1]; sp.hv = Hv[PN - 1]; sp.so = sOut[PN - 1]; return sp;
      }
      if (u < 0) u = 0;
      i0 = Math.floor(u); if (i0 > PN - 2) i0 = PN - 2; f = u - i0;
      var a = i0 > 0 ? i0 - 1 : 0, b = i0 + 1, c3 = i0 < PN - 2 ? i0 + 2 : PN - 1, t2 = f * f, t3 = t2 * f;
      var c0 = -0.5 * t3 + t2 - 0.5 * f, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * f, cc3 = 0.5 * t3 - 0.5 * t2;
      sp.x = c0 * X[o + a] + c1 * X[o + i0] + c2 * X[o + b] + cc3 * X[o + c3]; sp.y = c0 * Y[o + a] + c1 * Y[o + i0] + c2 * Y[o + b] + cc3 * Y[o + c3];
      nx = nrX[i0] * (1 - f) + nrX[b] * f; ny = nrY[i0] * (1 - f) + nrY[b] * f; var nl = sqrt(nx * nx + ny * ny) || 1; sp.nx = nx / nl; sp.ny = ny / nl;
      sp.h = Hs[i0] * (1 - f) + Hs[b] * f; sp.hv = Hv[i0] * (1 - f) + Hv[b] * f; sp.so = sOut[i0] * (1 - f) + sOut[b] * f;
      var sh = shf[i0] * (1 - f) + shf[b] * f; sp.x += sp.nx * sh; sp.y += sp.ny * sh;          // the upper body is shifted away from the head (teardrop gap under the tie)
      return sp;
    }
    function strandTargets(ch) {
      var o = ch.o, m = ch.n, j, sgn = ch.alpha < 0 ? -1 : 1, drA = ch.drift * 0.1 * spineLen * (1 + 0.5 * amt), ring = ch.ru >= 0, fk = ch.ru * spineLen * 0.1 * ch.bw, dk = ch.droop * spineLen * 1.5 * (1 - amt), ss = ch.ss;
      var WV = ch.wvS, ES = ch.esS, FL = ch.flS, PW = ch.pwS, DR = ch.drS, fan = ch.fanS;
      for (j = 0; j < m; j++) {
        var P = spineAt(ch.s[j]), h = P.h, off;
        HS[o + j] = h;
        if (ring) {                                   // ring strand: leaves the body edge and peels outward to its own lateral slot of the ring (stratified, so the strands stay separate)
          var inn = 0.12 + 0.88 * (0.5 + 0.5 * ss * P.so);
          off = ss * (h + max(0, P.hv - h) * ch.ru * ES[j] * inn + fk * FL[j] * inn) + WV[j];
        } else if (ch.wf > 0) {                       // solid lock: lateral slot across the tail, opening into a fan toward the tips
          off = ch.alpha * (0.9 * h + HC.lockFan * fan[j] * (1 + 0.25 * amt)) * (1 - 0.15 * min(1, max(0, 0.5 - 0.5 * sgn * P.so))) + WV[j];          // the slots open beyond the body: separate lock tips
        } else off = ch.alpha * h * (1 - 0.25 * min(1, max(0, 0.5 - 0.5 * sgn * P.so))) + sgn * drA * PW[j] * (0.45 + 0.55 * (0.5 + 0.5 * sgn * P.so)) + WV[j];
        TX[o + j] = P.x + P.nx * off;
        TY[o + j] = P.y + P.ny * off + dk * DR[j];
      }
    }
    /** wisps: constant-curvature arcs in the frame of the tie: leave it along the normal (sg side), turn toward the tail direction and over (fountain) */
    function wispTargets(ch) {
      var o = ch.o, n = ch.n, so = spine.o, tx = X[so + 2] - X[so], ty = Y[so + 2] - Y[so], tl = sqrt(tx * tx + ty * ty) || 1, tax = tx / tl, tay = ty / tl, nbx = nrX[0] * ch.sg, nby = nrY[0] * ch.sg;
      var px = X[so] + tax * 1.5, py = Y[so] + tay * 1.5, phi = ch.phi0, dl = ch.len / (n - 1);
      for (var i = 0; i < n; i++) {
        TX[o + i] = px; TY[o + i] = py;
        var cp = cos(phi), sp_ = sin(phi);
        px += (nbx * cp + tax * sp_) * dl; py += (nby * cp + tay * sp_) * dl; phi += ch.kap * dl;
      }
    }
    function headTargets(ch, R, O) {
      var o = ch.o, n = ch.n, L = ch.L;
      for (var i = 0; i < n; i++) {
        var lx = L[3 * i], ly = L[3 * i + 1], lz = L[3 * i + 2];
        var pf = R[0] * lx + R[1] * ly + R[2] * lz + O[0], pc = R[3] * lx + R[4] * ly + R[5] * lz + O[1], ph = R[6] * lx + R[7] * ly + R[8] * lz + O[2];
        TX[o + i] = ox - (pf * cth + pc * sth); TY[o + i] = oy - ph;
      }
    }

    // ------------------------------------------------------------------ one fixed step
    var CALM_V2 = 36;               // calm: tie speed < 6 u/s, nothing else going on for 0.75 s -> the hair is integrated at 60 Hz instead of 120 Hz
    function update(d, S) {
      var j, ch, P = S.P, iv2 = 1e9;
      frame(S);
      simT += d;
      var R = S.Fhead.R, O = S.Fhead.o;
      // wind field + streaming (relative wind from the measured tie velocity and the commanded speed)
      var wx = ((P.wind && P.wind.x) || 0) * HC.windGain, wy = ((P.wind && P.wind.y) || 0) * HC.windGain;
      ponyBase(S, d);
      var t0x = BX[0], t0y = BY[0];
      if (haveLast) {
        var jx = t0x - lastTx, jy = t0y - lastTy;
        if (jx * jx + jy * jy > 140 * 140) { shiftAll(jx, jy); calmN = 0; }                // teleport (pose.x jumped): carry the hair along
        else { var ka = 1 - exp(-d / 0.12); vLPx += (jx / d - vLPx) * ka; vLPy += (jy / d - vLPy) * ka; iv2 = (jx * jx + jy * jy) / (d * d); }
      }
      lastTx = t0x; lastTy = t0y; haveLast = true;
      var vm = sqrt(vLPx * vLPx + vLPy * vLPy), spParam = (P.speed || 0) * max(P.amount || 0, S.run || 0), sps = max(vm, spParam);
      if (iv2 < CALM_V2 && vm < 5 && spParam === 0 && wx === 0 && wy === 0 && shud === 0 && ponyRunW === 0 && !(P.flinch > 0) && !(P.dizzy > 0)) calmN++; else calmN = 0;
      if (calmN > HC.calmHold) { parity ^= 1; if (parity) return; d *= 2; }                // calm: every second step does a full update with 2d
      prepStep(d);
      if (vm > 1) { wdx = -vLPx / vm; wdy = -vLPy / vm; } else { wdx = cth; wdy = 0; }
      if (spParam > vm) { var qq = vm / (spParam + 1e-6); wdx = wdx * qq + cth * (1 - qq); wdy *= qq; }
      wdy += 0.1; var wl = sqrt(wdx * wdx + wdy * wdy) || 1; wdx /= wl; wdy /= wl;
      var amtT = HC.stream * sstep(HC.streamV[0], HC.streamV[1], sps) * (1 - HC.runCut * ponyRunW); amt = spine.ready ? amt + (amtT - amt) * (1 - exp(-d / 0.18)) : amtT;          // eased: the commanded speed jumps when a reaction starts
      stiffK = 1 + HC.runStiff * ponyRunW; runDampF = exp(-HC.runDamp * ponyRunW * d);       // run: stiffer springs, the tail follows the big head bob instead of folding up behind the head
      // ---- spine + ponytail strands
      savePrev(spine);
      var so = spine.o;
      var trx = BX[0] - ox, try_ = BY[0] - oy;                        // tie relative to the body root (no walking translation in it: only the bob / sway / lean of the head)
      if (!tlInit || !haveLast) { tlx = trx; tly = try_; tlInit = true; } else { var kl = 1 - exp(-d * HC.bodyLP); tlx += (trx - tlx) * kl; tly += (try_ - tly) * kl; }
      var ddx = tlx - trx, ddy = tly - try_;
      for (var i = 0; i < PN; i++) { var wl2 = sstep(0, HC.bodyRamp, i / (PN - 1)); TX[so + i] = BX[i] + wl2 * ddx; TY[so + i] = BY[i] + wl2 * ddy; }
      shape(so, PN, 0, roll, amt, wdx, wdy);                           // (gravity is already in the 3D rest curve: only the streaming here)
      perturb(spine);
      if (!spine.ready) initChain(spine); else integrate(spine, d, wx, wy);
      spineNormals(); envelope(envReady ? 1 - exp(-d / 0.1) : 1); envReady = true;
      for (j = 0; j < pony.length; j++) {
        ch = pony[j]; savePrev(ch);
        if (ch.kind === 'wisp') wispTargets(ch); else strandTargets(ch);
        perturb(ch);
        if (!ch.ready) initChain(ch); else integrate(ch, d, wx, wy);
      }
      // ---- loose head strands
      for (j = 0; j < heads.length; j++) {
        ch = heads[j]; savePrev(ch); headTargets(ch, R, O);
        shape(ch.o, ch.n, hangW, roll, amt, wdx, wdy); perturb(ch);
        if (!ch.ready) initChain(ch); else integrate(ch, d, wx, wy);
      }
      inited = true;
    }

    var H = {};
    H.reset = function (s) { build(s); haveLast = false; vLPx = 0; vLPy = 0; };
    H.step = function (dt, S, sc) {
      if (!(dt > 0) || !S || !S.Fhead) return;
      var n = Math.max(1, Math.min(8, Math.round(dt * 120))), d = dt / n;
      for (var i = 0; i < n; i++) update(d, S);
    };

    // ------------------------------------------------------------------ snapshot / restore / settle
    var SC_N = 36;
    /** typed-array copy of the complete simulation state (reuse a previous snapshot as 'out' to avoid any allocation) */
    H.snapshot = function (out) {
      var n = nAlloc, nc = chains.length, need = 6 * n + 10 * PN + SC_N + nc, v, p = 0, i, a;
      if (!out || !out.v || out.v.length !== need) out = { v: new Float64Array(need), n: n, nc: nc, seed: curSeed };
      v = out.v; out.n = n; out.nc = nc; out.seed = curSeed;
      var big = [X, Y, PX, PY, TX, TY], small = [nrX, nrY, Hb, Hs, Hv, Hc, shf, sOut, BX, BY];
      for (a = 0; a < 6; a++) { var A_ = big[a]; for (i = 0; i < n; i++) v[p++] = A_[i]; }
      for (a = 0; a < 10; a++) { var B_ = small[a]; for (i = 0; i < PN; i++) v[p++] = B_[i]; }
      var sc = [simT, lastTx, lastTy, haveLast ? 1 : 0, vLPx, vLPy, wdx, wdy, amt, stiffK, runDampF, cth, sth, ox, oy, roll, hcx, hcy, shud, shT, hangW, tFront, ponyRunW, havePony ? 1 : 0, inited ? 1 : 0, spineLen, calmN, parity, fhide, fhalo, tlx, tly, tlInit ? 1 : 0, fcrn, fwsp, rwS];
      for (i = 0; i < SC_N; i++) v[p++] = sc[i];
      for (i = 0; i < nc; i++) v[p++] = chains[i].ready ? 1 : 0;
      return out;
    };
    /** exact inverse of snapshot (false and no-op when the snapshot comes from a hair with a different layout) */
    H.restore = function (s) {
      var n = nAlloc, nc = chains.length, v, p = 0, i, a;
      if (!s || !s.v || s.n !== n || s.nc !== nc || s.v.length !== 6 * n + 10 * PN + SC_N + nc) return false;
      v = s.v;
      var big = [X, Y, PX, PY, TX, TY], small = [nrX, nrY, Hb, Hs, Hv, Hc, shf, sOut, BX, BY];
      for (a = 0; a < 6; a++) { var A_ = big[a]; for (i = 0; i < n; i++) A_[i] = v[p++]; }
      for (a = 0; a < 10; a++) { var B_ = small[a]; for (i = 0; i < PN; i++) B_[i] = v[p++]; }
      simT = v[p++]; lastTx = v[p++]; lastTy = v[p++]; haveLast = v[p++] === 1; vLPx = v[p++]; vLPy = v[p++]; wdx = v[p++]; wdy = v[p++]; amt = v[p++]; stiffK = v[p++]; runDampF = v[p++]; cth = v[p++]; sth = v[p++];
      ox = v[p++]; oy = v[p++]; roll = v[p++]; hcx = v[p++]; hcy = v[p++]; shud = v[p++]; shT = v[p++]; hangW = v[p++]; tFront = v[p++]; ponyRunW = v[p++]; havePony = v[p++] === 1; inited = v[p++] === 1;
      spineLen = v[p++]; calmN = v[p++]; parity = v[p++]; fhide = v[p++]; gHide = 1 - 0.6 * fhide; gRing = max(0, 1 - 1.6 * fhide); fhalo = v[p++]; tlx = v[p++]; tly = v[p++]; tlInit = v[p++] === 1; fcrn = v[p++]; fwsp = v[p++]; rwS = v[p++];
      for (i = 0; i < nc; i++) chains[i].ready = v[p++] === 1;
      for (i = 0; i < n; i++) { QX[i] = TX[i]; QY[i] = TY[i]; }
      lastD = -1; cacheAge = 99; envReady = true;
      return true;
    };
    /** re-initialises every chain to its current rest targets in ONE step (teleport / loop wrap / restart without a 100-step pre-roll) */
    H.settle = function (S) {
      if (!S || !S.Fhead) return;
      for (var i = 0; i < chains.length; i++) chains[i].ready = false;
      haveLast = false; vLPx = 0; vLPy = 0; calmN = 0; parity = 0; cacheAge = 99; envReady = false;
      update(1 / 120, S);
    };

    // ------------------------------------------------------------------ drawing
    var XS = new Float64Array(48), YS = new Float64Array(48), WS = new Float64Array(48), LX = new Float64Array(48), LY = new Float64Array(48), RX = new Float64Array(48), RY = new Float64Array(48);
    /** smooth tapered ribbon (quadratic B-spline outline) through n nodes with FULL widths ws[]; appended to the current path (identical winding for every ribbon) */
    function emit(ctx, xs, ys, ws, n) {
      var i, a, b, tx, ty, tl, hw, nx, ny;
      for (i = 0; i < n; i++) {
        a = i > 0 ? i - 1 : 0; b = i < n - 1 ? i + 1 : n - 1;
        tx = xs[b] - xs[a]; ty = ys[b] - ys[a]; tl = sqrt(tx * tx + ty * ty) || 1;
        hw = ws[i] * 0.5; nx = -ty / tl * hw; ny = tx / tl * hw;
        LX[i] = xs[i] + nx; LY[i] = ys[i] + ny; RX[i] = xs[i] - nx; RY[i] = ys[i] - ny;
      }
      // clamped quadratic B-spline per side (left chain forward, right chain back); the tip is hair fine, so L and R meet there
      ctx.moveTo(LX[0], LY[0]);
      if (n === 2) { ctx.lineTo(LX[1], LY[1]); ctx.lineTo(RX[1], RY[1]); ctx.closePath(); return; }
      for (i = 1; i < n - 2; i++) ctx.quadraticCurveTo(LX[i], LY[i], (LX[i] + LX[i + 1]) * 0.5, (LY[i] + LY[i + 1]) * 0.5);
      ctx.quadraticCurveTo(LX[n - 2], LY[n - 2], LX[n - 1], LY[n - 1]);
      for (i = n - 2; i > 1; i--) ctx.quadraticCurveTo(RX[i], RY[i], (RX[i] + RX[i - 1]) * 0.5, (RY[i] + RY[i - 1]) * 0.5);
      ctx.quadraticCurveTo(RX[1], RY[1], RX[0], RY[0]);
      ctx.closePath();
    }
    function growB(x, y) { if (x < bnd.x0) bnd.x0 = x; if (x > bnd.x1) bnd.x1 = x; if (y < bnd.y0) bnd.y0 = y; if (y > bnd.y1) bnd.y1 = y; }
    /** copies the chain nodes into the scratch buffers, appends the analytic curling hook, fills widths, emits the ribbon */
    var vx0 = -1e9, vx1 = 1e9;
    function drawChain(ctx, ch) {
      var o = ch.o, n = ch.n, i, N = n, lockW = ch.wf > 0, mnx = 1e9, mxx = -1e9;
      for (i = 0; i < n; i++) { var xx = X[o + i]; XS[i] = xx; YS[i] = Y[o + i]; growB(xx, YS[i]); if (xx < mnx) mnx = xx; if (xx > mxx) mxx = xx; }
      if (mxx < vx0 - 24 || mnx > vx1 + 24) return;                      // completely outside the visible x range (girl partly off-screen)
      if (ch.hn > 0) {
        var ax = XS[n - 1] - XS[n - 3], ay = YS[n - 1] - YS[n - 3], ang = atan2(ay, ax), hk = ch.hk, hr = ch.kind === 'head' ? ch.hr : ch.hr * (1 - 0.8 * fhide), hn = ch.hn, ds = hr * abs(hk) / hn, px = XS[n - 1], py = YS[n - 1];
        for (var q = 1; q <= hn; q++) { var an = ang + hk * pow(q / hn, 1.15); px += cos(an) * ds; py += sin(an) * ds; XS[n - 1 + q] = px; YS[n - 1 + q] = py; }
        N = n + hn; growB(px, py);
      }
      var tp = ch.tp, gw = ch.kind === 'head' ? (ch.fy ? fhalo : (1 - ch.fc * fcrn) * (1 - (1 - ch.fw) * fhalo)) : (lockW ? gHide : ch.kind === 'wisp' ? gRing * fwsp : gRing);          // tie wisps would poke up over the crown in 3/4 views
      if (gw < 0.03) return;
      if (lockW) { var lwR = 2 * ch.wf * HC.lockRef * gw; for (i = 0; i < N; i++) WS[i] = lwR * tp[i] + 0.05; }
      else { var w0g = ch.w0 * gw, fl = HC.minW * gw, tf = ch.tf; for (i = 0; i < N; i++) { var wv = w0g * tp[i], wf = fl * tf[i]; WS[i] = (wv > wf ? wv : wf) + HC.tipW; } }
      emit(ctx, XS, YS, WS, N);
    }
    /** the tail's body ribbon: starts AT the tie (node 0) with the pinched root width and follows the spine (the locks take over below coreEnd) */
    function drawCore(ctx) {
      var o = spine.o, i;
      for (i = 0; i < PN; i++) { XS[i] = X[o + i] + nrX[i] * shf[i]; YS[i] = Y[o + i] + nrY[i] * shf[i]; WS[i] = (2 * Hc[i] + 0.1) * gHide; growB(XS[i], YS[i]); }
      emit(ctx, XS, YS, WS, PN);
    }
    // ---- head-rigid ellipsoids (knot, band, cap): exact projected ellipses, appended with the ribbons' winding (anticlockwise on screen)
    function ellip(ctx, cf, cc, ch, a1f, a1c, a1h, a2f, a2c, a2h, a3f, a3c, a3h) {
      var p1x = -(a1f * cth + a1c * sth), p1y = -a1h, p2x = -(a2f * cth + a2c * sth), p2y = -a2h, p3x = -(a3f * cth + a3c * sth), p3y = -a3h;
      var sxx = p1x * p1x + p2x * p2x + p3x * p3x, sxy = p1x * p1y + p2x * p2y + p3x * p3y, syy = p1y * p1y + p2y * p2y + p3y * p3y;
      var tr = 0.5 * (sxx + syy), df = sqrt(max(0, tr * tr - (sxx * syy - sxy * sxy))), r1 = sqrt(tr + df), r2 = sqrt(max(0, tr - df)), ang = 0.5 * atan2(2 * sxy, sxx - syy);
      if (r1 < 0.05) return;
      var cx = ox - (cf * cth + cc * sth), cy = oy - ch;
      ctx.moveTo(cx + r1 * cos(ang), cy + r1 * sin(ang));
      ctx.ellipse(cx, cy, r1, max(r2, 0.01), ang, 0, TAU, true);
      growB(cx - r1, cy - r1); growB(cx + r1, cy + r1);
    }
    function drawKnot(ctx, S) {
      var R = S.Fhead.R, O = S.Fhead.o;
      var ux = R[2], uy = R[5], uz = R[8], ul = sqrt(ux * ux + uy * uy + uz * uz) || 1, cx = R[1], cy = R[4], cz = R[7], cl = sqrt(cx * cx + cy * cy + cz * cz) || 1;
      ux /= ul; uy /= ul; uz /= ul; cx /= cl; cy /= cl; cz /= cl;
      var dF = rdF, dC = rdC, dH = rdH;                                                        // tail root direction (world, from the last rest curve)
      var ud = ux * dF + uy * dC + uz * dH, nF = ux - ud * dF, nC = uy - ud * dC, nH = uz - ud * dH, nl = sqrt(nF * nF + nC * nC + nH * nH) || 1;
      nF /= nl; nC /= nl; nH /= nl;                                                            // perpendicular (head up, orthogonalised)
      var tu = HC.knotU, kr = HC.knotR, br = HC.bandR, g = gHide;
      // gathered knot: centred inside the skull, reaching out to the tie
      var kf = R[0] * knotF + R[2] * tu + O[0], kc = R[3] * knotF + R[5] * tu + O[1], kh = R[6] * knotF + R[8] * tu + O[2];
      ellip(ctx, kf, kc, kh, dF * kr[0], dC * kr[0], dH * kr[0], nF * kr[1], nC * kr[1], nH * kr[1], cx * kr[2], cy * kr[2], cz * kr[2]);
      // hair-volume cap over the back / top of the skull (head-local ellipsoid: scales with the head)
      if (HC.capK > 0) {
        var c0 = HC.capC, cr = HC.capR, k = HC.capK, wq = K.curve(keys.w, c0[1]) * cr[1] * k;
        var qf = R[0] * c0[0] + R[2] * c0[1] + O[0], qc = R[3] * c0[0] + R[5] * c0[1] + O[1], qh = R[6] * c0[0] + R[8] * c0[1] + O[2];
        ellip(ctx, qf, qc, qh, R[0] * cr[0] * k, R[3] * cr[0] * k, R[6] * cr[0] * k, R[1] * wq, R[4] * wq, R[7] * wq, R[2] * cr[2] * k, R[5] * cr[2] * k, R[8] * cr[2] * k);
      }
      // hair-tie band: a small bump across the root of the tail (fades with the tail when she faces us; it is behind her head then anyway)
      if (g > 0.03) {
        var tf_ = R[0] * tieF + R[2] * tu + O[0], tc_ = R[3] * tieF + R[5] * tu + O[1], th_ = R[6] * tieF + R[8] * tu + O[2], b0 = br[0] * g, b1 = br[1] * g;
        ellip(ctx, tf_, tc_, th_, dF * b0, dC * b0, dH * b0, nF * b1, nC * b1, nH * b1, cx * b1, cy * b1, cz * b1);
        if (HC.bow > 0) {        // the bow: two loops either side of the knot, tilted away from the head (a butterfly in profile), drawn like the band (same ink, same winding)
          var bs = HC.bowSize, bo = HC.bowOff, bk = HC.bow * g, side;
          for (side = -1; side <= 1; side += 2) {
            var lF = side * nF + 0.7 * dF, lC = side * nC + 0.7 * dC, lH = side * nH + 0.7 * dH, ll = sqrt(lF * lF + lC * lC + lH * lH) || 1;
            lF /= ll; lC /= ll; lH /= ll;
            var pd = dF * lF + dC * lC + dH * lH, mF = dF - pd * lF, mC = dC - pd * lC, mH = dH - pd * lH, ml = sqrt(mF * mF + mC * mC + mH * mH) || 1;
            mF /= ml; mC /= ml; mH /= ml;
            ellip(ctx, tf_ + side * nF * bo[0] * bk + dF * bo[1] * bk, tc_ + side * nC * bo[0] * bk + dC * bo[1] * bk, th_ + side * nH * bo[0] * bk + dH * bo[1] * bk,
              lF * bs[0] * bk, lC * bs[0] * bk, lH * bs[0] * bk, mF * bs[1] * bk, mC * bs[1] * bk, mH * bs[1] * bk, cx * bs[2] * bk, cy * bs[2] * bk, cz * bs[2] * bk);
          }
        }
      }
    }
    var bndObj = { x0: 0, y0: 0, x1: 0, y1: 0 }, cachePath = null, cacheAge = 99, cK = [0, 0, 0, 0, 0, 0, 0, 0];
    var hasP2D = typeof Path2D !== 'undefined';
    function buildInto(c, S) {
      var j;
      drawKnot(c, S);
      if (havePony && spine.ready && fhide < 0.985) {
        drawCore(c);
        for (j = 0; j < pony.length; j++) drawChain(c, pony[j]);
      }
      for (j = 0; j < heads.length; j++) { if (heads[j].fy && fhalo < 0.03) continue; drawChain(c, heads[j]); }
    }
    H.draw = function (ctx, S, sc) {
      if (!inited) update(1 / 120, S);
      ctx.fillStyle = GA.style ? GA.style.INK : '#0b0b0c';
      vx0 = -1e9; vx1 = 1e9;
      if (ctx.getTransform && ctx.canvas) {               // visible world x range (so strands outside the screen are not even built)
        var m = ctx.getTransform();
        if (m.a > 1e-6 && abs(m.b) < 1e-9 && abs(m.c) < 1e-9) { vx0 = -m.e / m.a; vx1 = (ctx.canvas.width - m.e) / m.a; }
      }
      var calmDraw = hasP2D && calmN > HC.calmHold + 20, Fo = S.Fhead.o;
      if (calmDraw) {                                     // calm: the strands change by < 0.1 unit in 3 frames -> rebuild the path every 3rd frame only
        if (cachePath && cacheAge < 2 && abs(S.ox - cK[0]) < 0.02 && abs(S.oy - cK[1]) < 0.02 && abs(S.theta - cK[2]) < 1e-4 && abs(Fo[0] - cK[3]) < 0.1 && abs(Fo[1] - cK[4]) < 0.1 && abs(Fo[2] - cK[5]) < 0.1 && abs(vx0 - cK[6]) < 1 && abs(vx1 - cK[7]) < 1) {
          cacheAge++; ctx.fill(cachePath); return;
        }
        bnd = bndObj; bnd.x0 = 1e9; bnd.y0 = 1e9; bnd.x1 = -1e9; bnd.y1 = -1e9;
        cachePath = new Path2D(); buildInto(cachePath, S); ctx.fill(cachePath);
        cacheAge = 0; cK[0] = S.ox; cK[1] = S.oy; cK[2] = S.theta; cK[3] = Fo[0]; cK[4] = Fo[1]; cK[5] = Fo[2]; cK[6] = vx0; cK[7] = vx1;
        return;
      }
      cacheAge = 99;
      bnd = bndObj; bnd.x0 = 1e9; bnd.y0 = 1e9; bnd.x1 = -1e9; bnd.y1 = -1e9;
      ctx.beginPath();
      buildInto(ctx, S);
      ctx.fill();
    };
    H.bounds = function () { return bnd; };
    H.chains = function () { return chains; };
    H.spine = function () { var o = []; for (var i = 0; i < PN; i++) o.push(X[spine.o + i], Y[spine.o + i]); return o; };
    H.spineN = function () { var o = []; for (var i = 0; i < PN; i++) o.push(nrX[i], nrY[i]); return o; };
    H.build = build;
    H.dbg = function () { return { calmN: calmN, parity: parity, X: X, Y: Y, TX: TX, TY: TY, spine: spine, pony: pony, heads: heads, roll: roll, amt: amt, vx: vLPx, vy: vLPy, Hs: Hs, Hv: Hv, Hb: Hb, Hc: Hc, nrX: nrX, nrY: nrY, shf: shf, nAlloc: nAlloc, tieF: tieF, knotF: knotF, BX: BX, BY: BY, tlx: tlx, tly: tly }; };
    build(seed0);
    A.lastHair = H;                                     // (test hook: the most recently created hair)
    return H;
  };
})();


/* ===== girl_a.js ===== */
/* girl_a.js -- Girl rig, variant C2 ("trace-driven parts on the 3D-projected loft rig").  Defines GA.createGirl(opts)  (see SPEC 4.1 + 8.4).

   She is a light 3D skeleton + volumes, everything rotated by ONE yaw angle and projected orthographically (so every yaw between profile 0 and front 1 is a
   consistent silhouette):
     head / neck+torso / dress = lofts of elliptical cross-sections whose per-row extents (front, back, half width, centre offset) are TRACED from the
        reference silhouettes (ref8 front, ref9 side, ref1 run) -- tables in girl_c2_trace.js (generated by trace/run_all.mjs: bake -> extract -> build)
     legs / arms = capsule chains swept along the joint chain with TRACED profiles (centre offset + radius per sample, per view / role)
     hands / shoes = lofts in their own frames with traced rows
   At the reference poses the silhouette therefore equals the traced outlines; every other yaw / gait phase is the smooth 3D-consistent in-between.
   Outlines of the lofts are faired (3-pass box filter on the arc-length resampled outline = C1 curvature-bounded), limbs are unions of tangent circle arcs.
   Messy ponytail + loose strands: simulated 3D chains (girl_a_hair.js).

   API:  girl = GA.createGirl({height:500, seed:1})
         girl.STRIDE  girl.STRIDE_RUN  girl.reset(seed)  girl.step(dt,pose)  girl.draw(ctx,pose)  girl.anchors(pose)
   pose (all optional, SPEC 4.1 + 8.4): x,y,yaw,gait{amount,phase,speed,run},headYaw,headPitch,headRoll,lean,squash(-0.4..1.3),scratch,scratchT,think,
         shudder,shudderT,air,wind{x,y},t.      gait phase 0 = the traced reference pose (walk: ref9, run: ref1; her left leg 0.1 cycle after heel strike); scratch/think use her LEFT arm (screen-right when she faces us).
   Additions of this variant (all default 0, additive):
     dizzy 0..1  post-bonk stagger (use ~0 -> 1 -> 0 over ~1.3 s, phase from pose.t): pelvis sway +-12 u / ~1.6 Hz with the unloaded foot lifting its heel (half-step), torso counter-roll, arms out for balance,
                 shoulders hunched, head wobble.   Idle layer (a = run = 0, pose.t driven, all 0 at t = 0): chest rise 0.26 Hz (+-2.2 u), pelvis sway +-6 (front) / +-5 (profile) with foot unweight,
                 shoulder shrug beats every ~6-10 s, head nod / roll (~+-3 deg) -- subtle but alive.
     think       TEMPLE touch: elbow out, forearm up along the side of the head, fingertip tapping the temple (the scratch -- hand on the crown with fingers above the head -- is unique to the bonk).
     THINK-IDLE SCRIPT (cfg.ideaT = [10.4, 12.2, 13.2, 13.8] seconds of pose.t = loop time; only while standing calm, off with cfg.idleScript = 0): weight shift + head tilt + shoulder lift, toe tap, 'aha' perk-up on the toes, slow glance away to the left.
     (old) think: elbow out, forearm up, rounded hand at the cheek (the arm leaves the torso outline).  scratch: rounded hand rubbing the head top in circles at 6.5 Hz (pose.scratchT), elbow out,
                 head tilting into the hand with wince beats; the hand arcs out when scratch eases in / out.
     girl.snapshot(out?) / girl.restore(s) -> bool / girl.settle(pose): hair state snapshot (the body is a pure function of the pose); solve / anchors are memoised per distinct pose
                 (anchors(pose) returns a shared read-only object until the next step / reset).
     peek 0..1   (best root x = W + 4; visible ~148 x 218 units at root W+4) profile pose (yaw 0, facing screen-LEFT) leaning out around the RIGHT screen edge: the body above the hips leans ~47 deg forward as one straight beam (hips stay at
                 pose.x, feet braced back, dress swept back), head held up (pitch +50 deg, cocked), near hand reaching back toward the edge, far arm swept back.
                 With peek = 1 (screen units relative to pose.x): head centre 112 left (y = 400 above the ground), face/hair front 158 left, neck 93 left, shoulder 66 left, near hand 44 left
                 (y 360 up), hips 24 RIGHT, dress/legs hidden when pose.x >= W + 30.  peek 1 -> 0 returns to the upright stance in place (head centre 7 left).
     flinch 0..1 transient startle recoil (use ~0 -> 1 -> 0 over 0.35 s together with a fast peek -> 0 for the DUCK): shoulders up, neck short, arms tucked, chin down, body recoils back + squash.
     squash      -0.4..1.3: bonk squash (1 = ~14 % shorter: knees bent, torso/neck compressed, hunched shoulders, wider torso + flared dress, arms flung out), negative = boing stretch
                 (on the toes, taller, arms fly up).   shudder 0..1 + shudderT: DEER IN THE HEADLIGHTS freeze (was a shiver): envelope 0..1 (attack ~0.12 s, release = snap out), shudderT = seconds since the onset: a quick soft recoil (tiny lift onto the toes,
                 shoulders up, small lean back, chin a little up, hands drawn up to the chest as little paws), then a held stillness with only a sub-unit slow tremble and ONE slow comic blink (head dip + rise
                 at shudderT ~0.5-1.0); legs / gait untouched while walking.  The rig state exposes S.recoil (0..1 pulse) / S.freeze for the hair; P.shudder is zeroed in S.P so the hair module does not rattle.
     bow 0..1.2  forward bend from the waist (28 deg per unit, curved spine), shoulders up, neck short, head tilts; chestHand 0..1 the left hand comes to the chest; twist -1.2..1.2 the upper body turns by 52 deg
                 per unit relative to the hips (twist > 0 toward the viewer = an over-the-shoulder look back when walking away to the left).
     HEAD SIZE: ONE head size at every yaw (cfg.headMorph = 0: vertical head scale suSide for all yaw; cfg.headW = 0.88 narrows the front head laterally, so head height / area stay within +-2 % of the profile head).
     ELEGANT WALK: swing foot with quintic eases (zero 1st + 2nd derivative at toe-off / heel strike), zero-slope lift hump, C1 swing tangents, smooth arm swing (no wrist lag), calm bob (cfg.bob 4.6, bobH2 0.08).
     BARE FEET (no shoes): procedural foot loft (heel, arch, ball, tapered toes) + five tiny toe tips; toes turned out ~26 deg when standing.  CHEERFUL WALK: see the walkStyle block of girl_a_tuned.js (STRIDE 372).
     headPitch   -1 = chin down 38 deg (look down at the console; in profile with headYaw +0.95 the face turns toward the viewer and down).
     air 0..1    hop: legs tucked, arms flung up/out, dress flared, head up.   gait.run 0..1: fitted comedic scurry (tables traced from ref1, see trace/).
   ROUND 10 performance fields (all default 0, additive; set by timeline.js):
     startle 0..1  five short ink strokes radiating from the crown (a comic startled mark, no lettering) + a touch of shoulder lift; they shoot out as the envelope rises, collapse as it falls.
     spread 0..1   open hands: a fan of four still fingers on both hands (the startled jump, the shrug).
     poke 0..1     the LEFT hand rises to poke at a floating thought beside her head (cfg.pokeAt, head frame), index finger out, small hesitant wobble.
     clutch 0..1   BOTH hands grab the sides of the head above the temples ('so many ideas!'; cfg.clutchAt, mirrored per side), elbows out, shoulders a little up.
     shrug 0..1    sheepish shrug: shoulders hiked, elbows in, forearms swung out and up with open palms; the feminine skirt hand lets go.
     reach 0..1    the RIGHT hand reaches down-forward toward the nav console below her (cfg.reachAt, pelvis frame), index finger out ('what is THAT?').
     chestHand > 1 (up to 1.6) lifts the chest hand on to the MOUTH (cfg.mouthHand, head frame) = a gasp.
     thinkT        clock of the think-idle script (seconds after she turned to the front; -1 = off): cfg.ideaT = [E1 weight shift + tilt, E2 toe tap, E3 'aha' perk-up, E4 glance away] are RELATIVE to it.
     (the dress frame follows the small flinch recoil pitch so no sliver opens at the waist in profile)
   Extras: girl.solve(pose) (rig state), girl.version = 'C2', GA.girlA.cfg (tunables), GA.girlA.int (internals for the offline bake tools).
   Load order: util.js style.js stage.js girl_a_core.js girl_a_data.js girl_a_hair.js girl_a.js girl_c2_trace.js girl_a_tuned.js                       */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var A = (GA.girlA = GA.girlA || {});
  var K = A.core, D = A.data;
  var PI = Math.PI, TAU = PI * 2;
  var pow = Math.pow, floor = Math.floor, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, atan2 = Math.atan2, exp = Math.exp;
  var clamp = K.clamp, lerp = K.lerp, sstep = K.sstep, sstep5 = K.sstep5, frac = K.frac, rad = K.rad;

  // ------------------------------------------------------------------------------------------------ tunable configuration (fitted)
  var C = (A.cfg = {
    stride: 300,          // world units per full gait cycle (2 steps) while walking at normal speed
    strideRun: 375,       // ... in the scurry run (cadence 2.4 cycles/s at 900 u/s)
    hipRest: 241,         // pelvis centre height used as the local origin of the skirt rows
    hipW: 21.5,           // lateral half-distance between hip joints
    L1: 111, L2: 110,     // thigh, shin
    legReach: 0.996,      // fraction of the full leg length the pelvis may use (stance legs are nearly straight)
    ankleZ: 21,           // ankle joint height above the sole
    waistH: 292, shoulderH: 350, neckBaseH: 372, neckTopH: 402,
    shoulderC: 44,        // lateral offset of the shoulder joints
    armU: 68, armF: 58,
    foreBeta: 0.55,       // forearm lateral angle as a fraction of the upper arm's
    handOut: -0.22,       // lateral lean of the hand direction (+ = outward, away from the body)
    ele: 0.15,            // camera elevation term applied to the skirt only (hem "smile")
    headPivot: [-7, 0, -41.5],
    suSide: 0.90, suFront: 1.0,     // head height scale in profile / front (the references differ: the rig morphs between them), torso stretch keeps total height
    crown: 500,           // standing height (crown of the hair cap)
    rho: 0.60, q1: 0.12, q2: 0.42, bhs: 16, bto: 35,   // gait: stance fraction, heel-strike->flat, heel-off, foot angles (deg)
    heelS: -15, ballS: 35, // foot-local contact points (s along foot)
    lift: 10,             // swing foot clearance
    // GAIT R10 graceful walk: heel-strike contact point ahead of the pelvis axis; stance knee flexion keys (q, deg) and soft-min radii of the knee-target pelvis solve;
    // swing keys: swE world-travel fraction (u, e) + residual landing velocity swR, swZ height keys (u, x lift) + touch-down slope swZ1, swB pitch fraction keys (u, 0..1)
    hsF: 82, kneeK: [[0, 5], [0.1, 17], [0.2, 14], [0.32, 4], [0.44, 5], [0.52, 12], [0.6, 20]], kneeSmin: 6, pelvisSmoothW: 1.0,
    swE: [[0, 0], [0.25, 0.2], [0.5, 0.56], [0.75, 0.86], [0.9, 0.96], [1, 1]], swR: 0.15, swZ: [[0.25, 1.0], [0.45, 0.9], [0.65, 0.57], [0.85, 0.2]], swZ1: -14,
    swB: [[0, 0], [0.2, 0.06], [0.45, 0.25], [0.65, 0.44], [0.82, 0.75], [0.93, 1], [1, 1]],
    // GAIT R10 run: heel-strike-equivalent contact point (the ball lands 50 further ahead), ball-landing pitch (deg, toes down), flight keys: world-travel fraction (u, e) + residual
    // landing velocity, ankle height keys (u, z) + touch-down slope, foot pitch keys (u, deg)
    runHsF: 75, runBhs: -12, runE: [[0, 0], [0.14, 0.05], [0.32, 0.2], [0.52, 0.5], [0.72, 0.75], [0.88, 0.924], [1, 1]], runR: 0.1, runZ: [[0.14, 60], [0.32, 150], [0.52, 125], [0.72, 80], [0.88, 48]], runZ1: -25,
    runB: [[0.14, -70], [0.32, -110], [0.52, -75], [0.72, -40], [0.88, -28]], runHeadLevel: 1,          // runHeadLevel 1 = the head stays level in the world while the torso leans          // (u 0.14: the trailing leg still stretched back = the flight 'stretch'; 0.32: heel kicked to the hip; 0.52: tucked; 0.72: knee high; 0.88: reaching, toes pointed)
    idleStance: 22.5, walkStance: 18.5, toeIdle: 26, toeWalk: 5, stanceL: 0, stanceR: 0, toeL: 0, toeR: 0,
    waveBeta: 84, waveGamma: 142, waveAmp: 26, waveHz: 3.1,          // round 11: the hello wave (upper arm elevation, mean elbow angle, swing amplitude (deg), swing frequency (Hz))
    pelvisIdle: 244.5, bob: 2.5, walkAlpha0: -2, walkXoff: 0, walkLean: 2.5, walkYaw: 6,
    armBetaL: 19, armBetaR: 19, armAlphaL: 4, armAlphaR: 4, armGammaL: 10, armGammaR: 10, swingFwd: 17, swingBack: 17, gammaWalk0: 9, gammaWalk1: 14,
    // run (scurry)
    runRho: 0.36, runQ1: 0.05, runQ2: 0.2, runLift: 52, runLean: 17, runPelvis: 233, runBob: 15,
    runArmFwd: 52, runArmBack: -40, runGammaFwd: 95, runGammaBack: 72,
    runKick: [-222, 105, -55], runKickU: 0.375, runFwd: [60, 70, 6], runXoff: 0, runPelvisF: 0, runHead: 11, runBendH: 30, runLeanDeg: 18, runLean0: 0.4, idleChest: 5.2, idleSway: 10, idleSwayF: 8, idleRoll: 0.22, idleNod: 0.08, shrugAmp: 4.5, idleBeat: 1, idleScript: 1, ideaT: [5.8, 7.3, 2.4, 10.9], dizzyC: 12, dizzyF: 9, hopAbsorb: 14,
    thinkHand: [8, -52, 4], thinkPole: [0.1, -1, -0.35], mouthHand: [74, -8, -52], pokeAt: [50, -132, -24], pokePole: [0.25, -1, -0.15], clutchAt: [6, 46, 24], reachAt: [70, 14, -110], reachPole: [0.9, 0.3, -0.2], scratchHz: 6.5, scratchAmp: [8, 11], scratchAt: [0, -18, 51], paw: [18, 135, 16], pelvisSmooth: 20, liftPow: 1.6, swingTan: 1, swingTan1: 1, liftSkew: 0.35, walkDrop: 0, bobH2: 0, bobH2ph: 0, bobPh: 0.27, hipSway: 2.2, shoulderCounter: 1.9, handLag: 0, headNod: 2, headTilt: 0, hemBounce: 0, headMorph: 0, headMorph0: 1, headW: 0.88, freezeBack: 6, bowDeg: 35, twistDeg: 52, chestHand: [18, -9, -20], chestPole: [-0.25, -1, -0.45], stepLift: 11, turnLift: 8, armIdleM: 0.25, armIdleGP: 0.5, sleeveR: [11.4, 10], sleeveRS: [13.5, 12], sleeveL: 26, neckShort: 0.88, shDrop: -3, armOut: 6, kneeSoft: 0.008, hemTiltA: 7.5, walkChest: 2.4, headBob: 2.6, pelvTilt: 3, hemFlutter: 1.8, shLag: 0.07, armLag: 0.035, foreLag: 0.11, headLag: 0.15, spineAmp: 3.4, spineLag: 0.1, asym: 1,
    femWeight: 1, femPeriod: 14, femShift: 10, femRoll: 8, femCounter: 11, femHead: 0.5, femChest: 4, femFoot: [13, 9, 14], femHand: [3, 60, -25], femHandPole: [-0.1, 1, -0.1], peekSpread: 0.75, peekNeck: 12, peekLean: 58, peekHead: 72, peekYaw: 0.2, peekHand: [20, -22, -60], peekPelvisF: 52, peekLegBack: 140, peekHemF: 140, peekHemTilt: 18, peekPole: [0.8, -0.3, -0.5], runBobK: [[0, 0.3], [0.2, -0.536], [0.35, -0.7], [0.5, 0.1], [0.62, 0.85], [0.78, 1.1], [0.9, 0.75]], runLeanK: 0.06, runHemF: 16, runHemTilt: 5, runHemLift: 0.6, runSpread: 0.06, runTilt: [0, 0, 0, 0], runShift: [0, 0, 0],   // run swing foot keys: [f, z, beta deg] at the kick-back extreme (u = runKickU of the swing) and at u = 0.75
    runKeyed: false, runLegK: 0, runArmK: 0, runShoulderBack: 0, runShoulderFwd: 0, runPelvisPitch: -6, runCrownK: 0, runWaistK: 0, runNeckK: 0,                                           // limbs are a bit longer in the traced run drawing
    runArmA: [52, 95], runArmB: [-40, 72],                                  // run arm roles [alpha, gamma] deg: forward (A) / back (B)
    headRowStep: 2, skirtRowStep: 2, shoeRowStep: 2, handRowStep: 2, limbStep: 2, ringHead: 52, ringTrunk: 40, ringShoe: 24, ringHand: 24,   // ring resolution of the lofts (silhouettes are faired, so this only needs to beat the fairing radius)
    fair: { head: 0.9, trunk: 1.4, shoe: 1.0, hand: 0.7 },     // outline fairing radius (screen units) per component
    phaseOff: 0.1,        // pose.gait.phase is offset by this internally: the traced walk / run reference poses (internal phase keyQ = 0.1) sit at POSE phase 0
    keyQ: 0.1,            // INTERNAL gait phase of the traced walk pose (leg 0 role A at this phase; leg 1 is role B)
    keyQRun: 0.1,         // same for the run
    keyFw: 0.81,          // |cos(2 pi keyQ)|: arm role weights saturate at the key
  });

  // ------------------------------------------------------------------------------------------------ lofts (rebuilt when the tables change)
  var SWH = K.newSweep(1400), SWT = K.newSweep(1800), SWS = K.newSweep(400), SWL = K.newSweep(400), YR = [0, 0];
  var HEAD, TORSO, TORSO_H, torsoRows, SKIRT, SKIRT_H, skirtRows, SHOE = [], HAND = [], SH_IDX, NECK_IDX, SHOE_S = [], HAND_S = [];
  var SKIRT_T, SKIRT_NORM = false;
  var HEAD_R, TORSO_R, SKIRT_R, SHOE_R = [], HAND_R = [], HEAD_B, TORSO_B, SKIRT_B, SHOE_S2 = [], HAND_S2 = [];   // run-pose tables (A.dataRun) and scratch lofts for the walk/run blend
  function nearestRowIdx(h) { var bi = 0, best = 1e9; for (var i = 0; i < TORSO_H.length; i++) { var d = abs(TORSO_H[i] - h); if (d < best) { best = d; bi = i; } } return bi; }
  function rowsIn(t) { return K.resampleRows(t, 1); }
  /** keeps every step-th row (and always the last): the faired sweep silhouette is insensitive to the row density, the cost is proportional to it */
  function decim(rows, step) { if (!(step > 1)) return rows; var o = [], i; for (i = 0; i < rows.length; i += step) o.push(rows[i]); if ((rows.length - 1) % step) o.push(rows[rows.length - 1]); return o; }
  function zeroZ(rows) { return rows.map(function (r) { return [0, r[1], r[2], r[3], r[4], r[5], r[6]]; }); }
  function build() {
    var i;
    HEAD = K.makeLoft(decim(rowsIn(D.head), C.headRowStep), C.ringHead);
    torsoRows = rowsIn(D.torso);
    TORSO_H = torsoRows.map(function (r) { return r[0]; });
    TORSO = K.makeLoft(zeroZ(torsoRows), C.ringTrunk);
    skirtRows = decim(rowsIn(D.skirt), C.skirtRowStep);
    SKIRT_T = skirtRows.map(function (r) { return r[0]; });
    SKIRT_NORM = !!A.hem && skirtRows[skirtRows.length - 1][0] <= 1.0001;       // traced tables: row coordinate = 0..1 from the waist to the hem (hem height blends with the run)
    SKIRT_H = SKIRT_NORM ? SKIRT_T.map(function (t) { return C.waistH - (C.waistH - A.hem.walk) * t; }) : SKIRT_T;
    SKIRT = K.makeLoft(zeroZ(skirtRows), C.ringTrunk);
    // shoes / hands: per limb index i two role tables [A, B] (D.shoe[i] = [A, B]) blended by the gait role weight; a plain table is used for both
    function per(t) { return Array.isArray(t[0][0]) ? (Array.isArray(t[0][0][0]) ? t : [t, t]) : [[t, t], [t, t]]; }
    var shoeT = per(D.shoe);
    SHOE = shoeT.map(function (pair) { return pair.map(function (t) { return K.makeRectLoft(decim(rowsIn(t), C.shoeRowStep), C.ringShoe); }); });
    SHOE_S = [K.cloneLoft(SHOE[0][0]), K.cloneLoft(SHOE[1][0])];
    HAND = []; HAND_S = [];
    if (D.hand) {
      HAND = per(D.hand).map(function (pair) { return pair.map(function (t) { return K.makeLoft(decim(rowsIn(t), C.handRowStep), C.ringHand); }); });
      HAND_S = [K.cloneLoft(HAND[0][0]), K.cloneLoft(HAND[1][0])];
    }
    var DR = A.dataRun;
    HEAD_R = null;
    if (DR) {                                           // traced run tables: same row layout as the walk tables, blended by gait.run
      HEAD_R = K.makeLoft(decim(rowsIn(DR.head), C.headRowStep), C.ringHead); TORSO_R = K.makeLoft(zeroZ(rowsIn(DR.torso)), C.ringTrunk); SKIRT_R = K.makeLoft(zeroZ(decim(rowsIn(DR.skirt), C.skirtRowStep)), C.ringTrunk);
      HEAD_B = K.cloneLoft(HEAD); TORSO_B = K.cloneLoft(TORSO); SKIRT_B = K.cloneLoft(SKIRT);
      SHOE_R = per(DR.shoe).map(function (pair) { return pair.map(function (t) { return K.makeRectLoft(decim(rowsIn(t), C.shoeRowStep), C.ringShoe); }); });
      SHOE_S2 = [K.cloneLoft(SHOE[0][0]), K.cloneLoft(SHOE[1][0])];
      if (DR.hand) { HAND_R = per(DR.hand).map(function (pair) { return pair.map(function (t) { return K.makeLoft(decim(rowsIn(t), C.handRowStep), C.ringHand); }); }); HAND_S2 = [K.cloneLoft(HAND[0][0]), K.cloneLoft(HAND[1][0])]; }
    }
    SH_IDX = nearestRowIdx(C.shoulderH); NECK_IDX = nearestRowIdx(378);
    A.parts = { HEAD: HEAD, TORSO: TORSO, SKIRT: SKIRT, SHOE: SHOE, HAND: HAND };
  }
  build();
  A.rebuild = build;
  A.touchVer = 0; A.touch = function () { A.touchVer++; };          // dev tools that change A.cfg between two draws of the same pose call A.touch() to drop the per-pose memo

  // ------------------------------------------------------------------------------------------------ small vector helpers
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function v3mad(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
  function v3len(a) { return sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function v3norm(a) { var l = v3len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function v3lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  /** two-bone IK. returns knee/elbow position; pole = direction the joint bulges toward. */
  function ik2(Hp, Ap, pole, L1, L2) {
    var d3 = v3sub(Ap, Hp), d = v3len(d3) || 1e-6;
    var dd = clamp(d, abs(L1 - L2) + 0.5, (L1 + L2) * 0.9995);
    var u = [d3[0] / d, d3[1] / d, d3[2] / d];
    var a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), b2 = L1 * L1 - a * a, b = b2 > 0 ? sqrt(b2) : 0;
    var pd = v3dot(pole, u), n = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]];
    var nl = v3len(n);
    if (nl < 1e-5) { n = abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; pd = v3dot(n, u); n = [n[0] - pd * u[0], n[1] - pd * u[1], n[2] - pd * u[2]]; nl = v3len(n); }
    n = [n[0] / nl, n[1] / nl, n[2] / nl];
    return [Hp[0] + u[0] * a + n[0] * b, Hp[1] + u[1] * a + n[1] * b, Hp[2] + u[2] * a + n[2] * b];
  }

  // ------------------------------------------------------------------------------------------------ gait
  /** Ankle trajectory relative to the pelvis axis for leg phase q (0 = heel strike): [f, z, beta]
      While a foot is planted its contact point (heel -> flat -> ball) is fixed on the ground, i.e. it moves backwards at exactly STRIDE per cycle in
      the body frame: no sliding when phase = distance / STRIDE.  gp = gait parameter set (walk or run). */
  var WALK_BETA = [[0, -38], [0.3, -21], [0.55, -4], [0.8, 14], [1, 19]];
  var WB = [[0, -38], [0.07, -38], [0.34, -17], [0.58, -3], [0.82, 11], [0.93, 15], [1, 15]];          // swing foot pitch (deg): ends are rewritten per call from the stance function
  function stanceFoot(q, Xhs, g) {
    var S = g.S, rho = g.rho, q1 = g.q1, q2 = g.q2, aF = -C.heelS, az = C.ankleZ, bs = C.ballS - C.heelS, bhs = rad(C.bhs) * g.bk, bto = rad(C.bto) * g.bk;
    var beta, f, z;
    if (q < q1 && g.ball) {                              // RUN: ball-of-foot landing (the ball is the planted pivot, the heel comes down from the toes-down pitch g.bhsBall)
      beta = g.bhsBall * (1 - sstep5(0, 1, q / q1));
      var ballF0 = Xhs - S * q + bs, sS0 = -C.ballS;
      f = ballF0 + sS0 * cos(beta) - az * sin(beta); z = sS0 * sin(beta) + az * cos(beta);
    } else if (q < q1) {
      beta = bhs * (1 - sstep5(0, 1, q / q1));
      var hf = Xhs - S * q;
      f = hf + aF * cos(beta) - az * sin(beta); z = aF * sin(beta) + az * cos(beta);
    } else if (q < q2) {
      beta = 0; f = Xhs - S * q + aF; z = az;
    } else {
      var u = (q - q2) / (rho - q2);
      beta = -bto * sstep5(0, 1, u);
      var ballF = Xhs - S * q2 + bs - S * (q - q2), sS = -C.ballS;
      f = ballF + sS * cos(beta) - az * sin(beta); z = sS * sin(beta) + az * cos(beta);
    }
    return [f, z, beta];
  }
  /** C1 Hermite through keys (u, value) with Catmull-Rom tangents and prescribed end slopes */
  function hermKeys(ks, u, m0, m1) {
    var n = ks.length, i = 0;
    while (i < n - 2 && u > ks[i + 1][0]) i++;
    var u0 = ks[i][0], u1 = ks[i + 1][0], h = u1 - u0, t = (u - u0) / h, t2 = t * t, t3 = t2 * t;
    var d0 = i === 0 ? m0 : (ks[i + 1][1] - ks[i - 1][1]) / (ks[i + 1][0] - ks[i - 1][0]);
    var d1 = i + 1 === n - 1 ? m1 : (ks[i + 2][1] - ks[i][1]) / (ks[i + 2][0] - ks[i][0]);
    return (2 * t3 - 3 * t2 + 1) * ks[i][1] + (t3 - 2 * t2 + t) * h * d0 + (-2 * t3 + 3 * t2) * ks[i + 1][1] + (t3 - t2) * h * d1;
  }
  var GW = { S: 0, rho: 0, q1: 0, q2: 0, bk: 1, ball: false, bhsBall: 0 }, GR = { S: 0, rho: 0, q1: 0, q2: 0, bk: 1.25, ball: true, bhsBall: 0 };
  /** k = stride scale: when the scene integrates the phase with a shorter stride than the rig's (pose.gait.stride, e.g. the quick small first steps of a dash), the foot travel
      and the contact points shrink by the same factor, so the planted foot still does not slide */
  function gaitSets(k) { GW.k = GR.k = k; GW.S = C.stride * k; GW.rho = C.rho; GW.q1 = C.q1; GW.q2 = C.q2; GR.S = C.strideRun * k; GR.rho = C.runRho; GR.q1 = C.runQ1; GR.q2 = C.runQ2; GR.bhsBall = rad(C.runBhs); }
  function legFoot(q, g, lift, xoff) {
    var S = g.S, rho = g.rho;
    var Xhs = (g === GR ? C.runHsF : C.hsF) * g.k + xoff;          // heel-strike contact point ahead of the pelvis axis (walk: the trailing ball is then hsF + 50 - S/2 behind; run: the ball lands at runHsF + 50)
    if (q < rho) return stanceFoot(q, Xhs, g);
    var to = stanceFoot(rho - 1e-6, Xhs, g), hs = stanceFoot(0, Xhs, g);
    var u = (q - rho) / (1 - rho);
    if (g === GR) {                                      // RUN flight (GAIT R10, elegant cartoon run): world-keyed like the walk swing (zero world velocity at toe-off, nearly zero at the ball strike):
                                                         // the heel kicks up high behind (runZ/runB keys at u ~0.3: shin about horizontal, toes pointed back), the knee drives through high, the shin reaches forward
      var dWr = S * (1 - rho), er = hermKeys(C.runE, u, 0, C.runR * dWr / (dWr + hs[0] - to[0]));
      var xr = to[0] + (hs[0] - to[0]) * er + dWr * (er - u);
      RZ[0][1] = to[1]; RZ[6][1] = hs[1]; RB[0][1] = to[2]; RB[6][1] = hs[2];
      for (var ri = 1; ri < 6; ri++) { RZ[ri][0] = C.runZ[ri - 1][0]; RZ[ri][1] = C.runZ[ri - 1][1]; RB[ri][0] = C.runB[ri - 1][0]; RB[ri][1] = rad(C.runB[ri - 1][1]); }
      return [xr, hermKeys(RZ, u, 0, C.runZ1), hermKeys(RB, u, 0, 0)];
    }
    // ---- WALK swing (GAIT R10, graceful walk): keyed in the WORLD frame. e(u) = fraction of the foot's world travel (toe-off spot -> heel-strike spot): zero world velocity at
    //      toe-off (the ball was planted), a quick reach through mid-swing and a long deceleration, landing with a residual forward velocity of swR x the body speed (a real heel
    //      strike is not a dead stop; it also keeps the maximum reach AT the contact instead of before it).  Body frame: f = to + (hs - to) e + S (1 - rho) (e - u).
    //      Height: keys in units of `lift` above the heel-strike ankle height (the knee lifts the heel first, the ankle sinks while the leg reaches), touching down with the small
    //      vertical velocity swZ1 (no floor skimming).  Pitch: the toe stays POINTED (plantar-flexed) through mid-swing, ballet-like, and flips to heel-first late (swB = fraction
    //      of the way from the toe-off pitch to the heel-strike pitch).  All curves are C1 Hermite splines through the keys (no pops).
    var dW = S * (1 - rho), e = hermKeys(C.swE, u, 0, C.swR * dW / (dW + hs[0] - to[0]));
    var x = to[0] + (hs[0] - to[0]) * e + dW * (e - u);
    SZ[0][1] = to[1]; SZ[5][1] = hs[1];
    for (var zi = 1; zi < 5; zi++) { var zk = C.swZ[zi - 1]; SZ[zi][0] = zk[0]; SZ[zi][1] = hs[1] + lift * zk[1]; }
    var z = hermKeys(SZ, u, 0, C.swZ1);
    return [x, z, to[2] + (hs[2] - to[2]) * hermKeys(C.swB, u, 0, 0)];
  }
  var SZ = [[0, 0], [0.25, 0], [0.45, 0], [0.65, 0], [0.85, 0], [1, 0]];          // walk swing height keys (filled per call from C.swZ)
  var RZ = [[0, 0], [0.14, 0], [0.32, 0], [0.52, 0], [0.72, 0], [0.88, 0], [1, 0]], RB = [[0, 0], [0.14, 0], [0.32, 0], [0.52, 0], [0.72, 0], [0.88, 0], [1, 0]];          // run flight height / pitch keys (5 interior keys from C.runZ / C.runB)

  // ------------------------------------------------------------------------------------------------ pose prep
  function prep(p) {
    p = p || {};
    var g = p.gait || {}, w = p.wind || {};
    return {
      x: num(p.x, 0), y: num(p.y, 880), yaw: num(p.yaw, 0),
      amount: clamp(num(g.amount, 0), 0, 1), phase: num(g.phase, 0), speed: num(g.speed, 0), run: clamp(num(g.run, 0), 0, 1),
      strideK: g.stride > 0 ? clamp(g.stride / lerp(C.stride, C.strideRun, clamp(num(g.run, 0), 0, 1)), 0.2, 1.5) : 1,          // optional: the stride the scene integrates the phase with (see gaitSets)
      hy: clamp(num(p.headYaw, 0), -1.6, 1.6), hp: clamp(num(p.headPitch, 0), -1.6, 1.6), hr: clamp(num(p.headRoll, 0), -1.6, 1.6),
      lean: clamp(num(p.lean, 0), -1.5, 1.5), squash: clamp(num(p.squash, 0), -0.4, 1.3),
      scratch: clamp(num(p.scratch, 0), 0, 1.1), scratchT: num(p.scratchT, 0), think: clamp(num(p.think, 0), 0, 1),
      shudder: clamp(num(p.shudder, 0), 0, 1), shudderT: num(p.shudderT, 0), air: clamp(num(p.air, 0), 0, 1),
      peek: clamp(num(p.peek, 0), 0, 1), flinch: clamp(num(p.flinch, 0), 0, 1), dizzy: clamp(num(p.dizzy, 0), 0, 1),
      bow: clamp(num(p.bow, 0), 0, 1.2), twist: clamp(num(p.twist, 0), -1.2, 1.2), chestHand: clamp(num(p.chestHand, 0), 0, 1.6),
      // round-10 performance fields (all default 0, additive): startle ticks, open spread hands, poke at the air, both hands clutching the head, sheepish shrug, thinking-script clock
      startle: clamp(num(p.startle, 0), 0, 1), spread: clamp(num(p.spread, 0), 0, 1), poke: clamp(num(p.poke, 0), 0, 1), clutch: clamp(num(p.clutch, 0), 0, 1), shrug: clamp(num(p.shrug, 0), 0, 1), thinkT: num(p.thinkT, -1),
      reach: clamp(num(p.reach, 0), 0, 1),          // the right hand reaches down-forward (toward the nav console below her), index finger out
      wave: clamp(num(p.wave, 0), 0, 1),          // round 11: the right hand waves hello at the viewer (open hand, the forearm swings)
      wind: { x: num(w.x, 0), y: num(w.y, 0) }, t: num(p.t, 0),
    };
  }
  /** smooth one-shot pulse inside a repeating period: rises over `rise` s, falls over `fall` s, starting at `ph` (+ k * P). Returns [value, side] (side alternates -1 / +1 per repetition) */
  var BV = [0, 1];
  function beat(t, P, ph, rise, fall) {
    var q = (t - ph) / P, k = Math.floor(q), x = (q - k) * P;
    BV[1] = (k & 1) ? -1 : 1;
    BV[0] = x < rise + fall ? sstep(0, rise, x) * (1 - sstep(rise, rise + fall, x)) : 0;
    return BV;
  }
  /** smooth trapezoid pulse of absolute time: 0 -> 1 over `rise` starting at t0, holds `hold`, back to 0 over `fall` (all smoothstepped) */
  function pulseT(t, t0, rise, hold, fall) { return sstep(t0, t0 + rise, t) * (1 - sstep(t0 + rise + hold, t0 + rise + hold + fall, t)); }
  /** DEER IN THE HEADLIGHTS (pose.shudder = freeze envelope 0..1, pose.shudderT = seconds since the onset):
      recoil pulse (0..1) = the quick soft recoil right after the onset (tiny lift onto the toes, shoulders up, lean back);
      blink pulse (0..1)  = the one slow comic blink (a small head dip and rise) after the freeze has settled;
      everything else is a held stillness with a sub-unit tremble. */
  function recoilPulse(T) { return sstep(0, 0.07, T) * (1 - sstep(0.1, 0.38, T)); }
  function blinkPulse(T) { return sstep(0.46, 0.7, T) * (1 - sstep(0.7, 1.0, T)); }

  /** run skirt profiles along the skirt (t = 0 waist ... 1 hem): smooth curve through keys at t = 0, 1/3, 2/3, 1 (tilt: 4 keys, deg; shift: keys at 1/3, 2/3, 1 with 0 at the waist) */
  var PROF_K = [[0, 0], [1 / 3, 0], [2 / 3, 0], [1, 0]];
  function runProf(k, t) { var o = k.length - 3; PROF_K[0][1] = o ? k[0] : 0; PROF_K[1][1] = k[o]; PROF_K[2][1] = k[o + 1]; PROF_K[3][1] = k[o + 2]; return K.curve(PROF_K, t); }

  /** periodic pelvis bob shape of the run (one period per step = 2 * phase): keys (u, v) in units of runBob, u in [0, 1) */
  var BOBX = null, BOBSRC = null;
  function runBobShape(u) {
    var k = C.runBobK;
    if (BOBSRC !== k) {
      BOBSRC = k; BOBX = [];
      for (var i = -2; i < k.length + 2; i++) { var j = ((i % k.length) + k.length) % k.length, w = Math.floor(i / k.length); BOBX.push([k[j][0] + w, k[j][1]]); }
    }
    return K.curve(BOBX, u - Math.floor(u));
  }

  /** walk pelvis bob (one period per step = 2 * phase): fundamental + a second harmonic that makes the rise quick (push-off) and the settle soft: a springy double bounce */
  function walkBobShape(u) { return cos(TAU * u) + C.bobH2 * cos(TAU * 2 * u - C.bobH2ph); }

  // ------------------------------------------------------------------------------------------------ rig solve
  function solve(pose, sc) {
    var P = prep(pose), S = { P: P };
    gaitSets(P.strideK);
    var pk = sstep(0, 1, P.peek);
    P.yaw = P.yaw + C.peekYaw * pk * (1 - clamp(P.yaw, 0, 1));          // peek: a three-quarter view (both shoulders / the chest turn toward the viewer)
    S.theta = P.yaw * PI / 2; S.ox = P.x / sc; S.oy = P.y / sc;
    var Yw = clamp(P.yaw, 0, 1), yawS = sstep(0, 1, Yw);
    var a = P.amount, run = sstep(0, 1, P.run), air = P.air, ph = P.phase + C.phaseOff, t = P.t, lean = P.lean, idleA = (1 - a) * (1 - run), sh = P.shudder;
    var cPh = cos(TAU * ph), sPh = sin(TAU * ph), scrN = sstep(0.3, 0.8, P.scratch);
    var fl = P.flinch, shT = P.shudderT, fz = sh, rcA = fz > 0 ? recoilPulse(shT) * sqrt(fz) : 0, blk = fz > 0 ? blinkPulse(shT) * fz : 0, trm = fz * sstep(0.25, 0.6, shT);          // deer-in-headlights: freeze envelope, recoil, blink, tremble weight
    var tr1 = sin(TAU * 5.3 * shT), tr2 = sin(TAU * 4.1 * shT + 1.7), tr3 = sin(TAU * 6.3 * shT + 0.6);          // the faint slow tremble (sub-unit)
    var bow = P.bow, twistU = P.twist, chestH = sstep(0, 1, P.chestHand);
    var dzy = P.dizzy, ld = clamp(-P.hp, 0, 1), dTT = TAU * 1.6 * t, dS1 = sin(dTT), dS2 = sin(dTT + 1.4), dS3 = sin(2 * dTT + 0.5);       // dizzy stagger phases (1.6 Hz), look-down amount
    var hunch = max(0.95 * fz, 0.95 * fl, 0.55 * bow), hunchS = max(0.4 * fz + 0.25 * rcA, 0.95 * fl, 0.8 * dzy, 0.5 * ld, 0.15 * bow, 0.35 * P.clutch, 0.6 * P.shrug);          // arms tucked (hands toward the chest) / shoulders up + neck shortened (the bow keeps the neck visible: the head sits forward of the shoulders)
    S.dzy = dzy; S.dS1 = dS1; S.hunchS = hunchS; S.ld = ld;
    S.recoil = rcA; S.freeze = fz; S.bow = bow;
    var sq = P.squash + 0.32 * fl, sqp = max(sq, 0), sqn = max(-sq, 0);          // squash (bonk / landing / flinch / shudder onset jolt) and its stretch half
    S.pk = pk; S.fl = fl; S.yawS = yawS;
    S.run = run; S.amount = a;
    S.ele = C.ele * sin(PI * Yw) * sin(PI * Yw);          // hem 'smile' (camera elevation) only between the traced views: at yaw 0 / 1 the traced rows already hold the hem curve

    // ---- idle life (all zero at t=0 so the default pose is the neutral reference pose)
    var breath = sin(TAU * t / 3.9);
    var wsh = (sin(TAU * t / 6.8) * 0.65 + sin(TAU * t / 4.3) * 0.35) * idleA;          // weight shift -1..1 (+ = toward her right)
    var wsf = (sin(TAU * t / 5.9) * 0.6 + sin(TAU * t / 3.7) * 0.4) * idleA;            // weight shift forward / back (the profile view's sway)
    // occasional beats on incommensurate 5-9 s cycles (all start at least 2 s after t = 0 and are zero at t = 0): stretch + exhale, hip shift + head tilt, one-sided shrug, glance-and-settle
    // THINK-IDLE script (deterministic, keyed on pose.thinkT = seconds since she turned to the front (round 10; off while thinkT < 0); only while she stands calmly):
    // E1 weight shift + head tilt + shoulder lift, E2 toe tap, E3 'aha' perk-up on her toes, E4 slow glance away (times: cfg.ideaT, relative to thinkT = 0)
    var tS = P.thinkT, calm = tS >= 0 ? idleA * (1 - min(1, 2 * ld)) * (1 - min(1, 2 * max(sh, dzy, fl, P.scratch, P.think, bow, P.clutch, P.poke, P.shrug))) * C.idleScript : 0;
    var e1 = pulseT(tS, C.ideaT[0], 0.6, 0.5, 1.0) * calm, e2 = pulseT(tS, C.ideaT[1], 0.25, 0.85, 0.3) * calm, e3 = pulseT(tS, C.ideaT[2], 0.2, 0.15, 0.75) * calm, e4 = pulseT(tS, C.ideaT[3], 0.7, 0.8, 0.75) * calm;
    var emax = max(e1, e2, e3, e4), tap = pow(max(0, sin(TAU * 3.3 * (tS - C.ideaT[1]))), 2) * e2;
    S.e1 = e1; S.e3 = e3;
    S.startle = P.startle; S.spread = P.spread; S.poke = P.poke; S.clutch = P.clutch; S.shrugX = P.shrug; S.reach = P.reach; S.wave = P.wave;          // round-10 performance fields (used by the arms / shoulders / the drawing)
    var ib = C.idleBeat * idleA * (1 - 0.85 * emax), b1 = beat(t, 5.3, 1.9, 0.55, 1.15)[0] * ib, bs2 = beat(t, 7.7, 3.3, 0.35, 0.95), b2 = bs2[0] * ib, s2 = bs2[1], bs3 = beat(t, 9.1, 5.7, 0.22, 0.7), b3 = bs3[0] * ib, s3 = bs3[1], b4 = beat(t, 6.3, 2.6, 0.2, 0.55)[0] * ib, s4 = (floor(t / 6.3) & 1) ? -1 : 1;
    var shrug = b3;
    S.shrug = shrug; S.b1 = b1; S.b2 = b2; S.s2 = s2; S.b3 = b3; S.s3 = s3;

    // ---- FEMININE STANDING POSE (a sweet, relaxed child's stance, only while she stands calmly): weight on one leg with a gentle hip shift and pelvis tilt, the other knee softly bent with the foot a little
    //      forward and turned out, shoulders counter-tilted (the support-side one a touch lower), a gentle S in the spine, a soft head tilt, one hand lightly holding the side of the skirt; the weight
    //      changes slowly (every femPeriod / 2 s) with smooth easing.  Blends in with the stop (idleA) and out for every reaction.
    var femK = C.femWeight * idleA * (1 - min(1, 2.2 * max(fz, dzy, fl, bow, pk, air, P.wave, sstep(0, 0.45, abs(sq))))) * (1 - 0.6 * min(1, 2 * ld));          // (round 11: the squash term fades the stance in over ~0.3 s as a squash dies away; the old 3 x |squash| did it in ~0.1 s = the arms dropped in a snap after every hop)
    var wc = Math.tanh(2.2 * sin(TAU * t / C.femPeriod + 1.2)), fw = femK * wc;          // wc > 0: the weight is on her RIGHT leg (screen-left in the front view)
    S.femK = femK; S.fw = fw;

    // ---- ankle targets (body frame): idle -> walk -> run, then tucked for a hop
    var legs = [], aw = max(a, run), pvt = pow(sin(PI * Yw), 0.6) * (1 - aw);          // turn-pivot weight: 0 at the profile / front views, 1 at three-quarter
    S.legQ = [0, 0];
    for (var li = 0; li < 2; li++) {
      var side = li === 0 ? -1 : 1;                    // left leg (c-), right leg (c+)
      var q = frac(ph + (li === 0 ? 0 : 0.5));
      S.legQ[li] = q;
      var wf = legFoot(q, GW, C.lift, C.walkXoff), rf = legFoot(q, GR, C.runLift, C.runXoff);
      // the swing foot LIFTS first and travels afterwards when the gait starts / stops (its clearance and pitch ramp in over a ~0.3 amount, its stride travel with the amount): no slide along the floor
      var swF = sstep(GW.rho, GW.rho + 0.07, q) * (1 - sstep(0.93, 1, q)), aL = lerp(a, sstep(0, 0.3, a), swF);
      var f = lerp(a * wf[0], rf[0], run), z = lerp(lerp(C.ankleZ, wf[1], aL), rf[1], run), beta = lerp(aL * wf[2], rf[2], run);
      // stopping / starting: a foot that has to travel between its stride position and the standing position is LIFTED on the way (never dragged along the floor)
      var wmx = max(a, run);
      if (wmx > 0 && wmx < 1) { var trv = min(1, lerp(abs(wf[0]), abs(rf[0]), run) / 36) * 4 * wmx * (1 - wmx); z += C.stepLift * trv; beta -= rad(14) * trv; }
      var c = side * lerp(lerp(C.idleStance + (side < 0 ? C.stanceL : C.stanceR), C.walkStance, a), C.walkStance - 2, run);
      var toe = lerp(lerp(rad(C.toeIdle + (side < 0 ? C.toeL : C.toeR)), rad(C.toeWalk), a), rad(4), run);
      var unw = idleA > 0 ? sstep(0.15, 0.75, -side * (wsh + 0.7 * b2 * s2 + 1.3 * e1)) * idleA : 0, unwD = dzy > 0 ? sstep(0.15, 0.9, -side * dS1) * dzy : 0;       // the unloaded foot lifts its heel (idle weight shift / dizzy half-step)
      if (unw > 0 || unwD > 0) { z += 5.5 * unw + 8 * e1 * (side < 0 ? 1 : 0) + 11 * unwD; f += 5 * unwD; c -= side * 3 * unw; beta = lerp(beta, rad(-18), max(0.85 * unw, unwD)); }
      if (rcA > 0) { var rt2 = rcA * (1 - aw) * (1 - min(1, 2 * max(sq, 0))); z += 8.5 * rt2; beta = lerp(beta, beta - rad(22), rt2); }          // recoil: a tiny lift up onto the toes (standing only)
      var freeW = femK * sstep(-0.35, 0.9, -side * wc);          // the unloaded leg: foot a little forward and turned out, the knee soft
      if (freeW > 0) { f += C.femFoot[0] * freeW; c += side * C.femFoot[1] * freeW; toe += rad(C.femFoot[2]) * freeW; }
      if (pvt > 0) { z += C.turnLift * pvt * (side < 0 ? 1 : 0.8); beta -= rad(13) * pvt; }          // turning on the spot: the feet pivot on the toes (heel up) instead of sliding with the rotating body
      if (e2 > 0 && side > 0) { var tb = rad(30) * tap; beta = lerp(beta, beta + tb, 1); z += 15 * sin(tb); }          // E2: the toe taps (the heel stays on the floor)
      if (e3 > 0) { beta = lerp(beta, rad(-20), e3); z += 11.5 * e3; }          // E3: up on her toes
      if (sqn > 0) { var tp = min(1, sqn * 5) * (1 - aw); z += 20 * tp; beta = lerp(beta, rad(-36), tp); }       // boing stretch: up on the toes
      if (pk > 0) f -= C.peekLegBack * pk;               // peek: the feet are braced back (away from the edge), hidden behind it
      if (air > 0) {                                   // hop: toes point first (push-off), then the knees tuck up under her
        var tk = sstep(0.1, 0.9, air), tp2 = sstep(0, 0.55, air);          // push-off: toes point first, then the knees come up; the feet end up behind the knees (not a chair)
        f = lerp(f, li ? -46 : -22, tk); z = lerp(z, li ? 84 : 102, tk); beta = lerp(beta, rad(li ? -58 : -48), tp2); c = lerp(c, side * 15, tk);
      }
      // toe bend weight (shoeFrame): the forefoot flexes against the ground while the heel rises in stance; it springs straight in the first 12 % of the swing (pointed foot in the air)
      var rhoG = lerp(GW.rho, GR.rho, run), usw = (q - rhoG) / (1 - rhoG), tbG = q < rhoG ? 1 : 1 - sstep(0.05, 0.3, usw) + sstep(0.85, 1, usw);          // (and the toes lift again for the ball landing)
      legs.push({ side: side, f: f, c: c, z: z, beta: beta, toe: toe, tb: lerp(1, tbG, aw) * (1 - air) });
    }

    // ---- pelvis: bob limited by leg reach (so legs never over-extend), twist, sway, shiver
    var yawP = aw * rad(C.walkYaw) * cPh * (1 - 0.5 * run);
    var pitchP0 = -a * rad(2.0) + a * (1 - run) * rad(C.pelvTilt) * sin(TAU * 2 * (ph - C.bobPh + 0.05)) + run * rad(C.runPelvisPitch) - max(lean, 0) * (1 - 0.9 * run) * rad(6) + (0.45 * fz + 0.55 * rcA) * rad(C.freezeBack) - bow * rad(4) * (1 - run);          // (deer: a small lean back; bow: the waist tips forward a little)
    var pitchP = pitchP0 - pk * (rad(C.peekLean) + rad(2.4) * sin(TAU * t / 2.3 + 0.7) + rad(1.2) * sin(TAU * t / 1.1)) + fl * rad(8);          // peek: she sways in and out a little (breathing, weight)
    var fP = -14 * max(lean, 0) * (1 - 0.9 * run) + C.runPelvisF * run - C.peekPelvisF * pk + C.idleSwayF * wsf - 3 * b1 + C.dizzyF * dzy * dS2 + trm * 0.35 * tr1;
    var cP = -C.hipSway * a * sPh + C.idleSway * wsh + 7 * b2 * s2 + 16 * e1 + trm * 0.3 * tr2 + C.dizzyC * dzy * dS1 + C.femShift * fw;
    var absorb = air * (1 - air) * 4;                       // knee absorb / anticipation while the hop blend passes through 0.5
    var lk = 1 + C.runLegK * run, L1 = C.L1 * lk, L2 = C.L2 * lk, ak = 1 + C.runArmK * run;
    S.lk = lk; S.ak = ak;
    // WALK pelvis (GAIT R10): knee-target solve. Each stance leg asks for the pelvis height at which its knee has the biomechanical flexion C.kneeK(q) (deg: ~5 at contact, ~17 in
    // loading, straight over mid-stance, ~36 into the push-off); the lowest request wins (soft min), so the pelvis is lowest in the double support and highest over the straight
    // mid-stance leg: the bob emerges from the geometry (no cosine).  The landing leg's reach limit takes over just before its heel strike (continuous: kneeK(0) ~ legReach).
    var pelvRoll = rad(C.femRoll) * fw, Rp = K.mEuler(yawP, pitchP, pelvRoll), rhoG = lerp(GW.rho, GR.rho, run);
    var kneeH = 1e9, Lmax = (L1 + L2) * (C.legReach - C.kneeSoft * aw * (1 - run)), lim = 1e9;
    for (var i2 = 0; i2 < 2; i2++) {
      var lg = legs[i2], hc = lg.side * C.hipW, hv0 = Rp[1] * hc - Rp[2] * 3, hv1 = Rp[4] * hc - Rp[5] * 3, hv2 = Rp[7] * hc - Rp[8] * 3;          // the hip joint's offset from the pelvis origin (exact, incl. the pelvis rotation)
      var dx = lg.f - (fP + hv0), dy = lg.c - (cP + hv1), l2 = Lmax * Lmax - dx * dx - dy * dy;
      var usw2 = (S.legQ[i2] - rhoG) / (1 - rhoG), relax = usw2 > 0 ? 30 * aw * sstep(0, 0.12, usw2) * (1 - sstep(0.75, 0.95, usw2)) : 0;          // a swing foot does not hold the pelvis down (its IK clamp keeps the leg straight instead: the flight 'stretch'); the limit returns before the landing
      var limi = lg.z + sqrt(l2 > 25 ? l2 : 25) - hv2 + relax;
      lim = i2 === 0 ? limi : K.smin(lim, limi, lerp(10, 4, aw));          // (idle: the R9 smoothing, so the approved standing / peek poses keep their height)
      if (a > 0 && S.legQ[i2] < GW.rho) {          // (the trailing leg's request fades out over the last 10 % of its stance: the landing leg has taken the weight)
        var kd = rad(K.curve(C.kneeK, S.legQ[i2])), Dk2 = L1 * L1 + L2 * L2 + 2 * L1 * L2 * cos(kd) - dx * dx - dy * dy, hk = lg.z + sqrt(Dk2 > 25 ? Dk2 : 25) - hv2 + 60 * sstep(GW.rho - 0.1, GW.rho, S.legQ[i2]);
        kneeH = kneeH > 1e8 ? hk : K.smin(kneeH, hk, C.kneeSmin);
      }
    }
    var idealW = kneeH > 1e8 ? C.pelvisIdle : lerp(C.pelvisIdle, kneeH, a);
    var ideal = lerp(idealW, C.runPelvis + C.runBob * runBobShape(2 * ph), run) + 9 * e3 - 44 * sqp + 14 * sqn - 14 * pk * (1 + 0.12 * sin(TAU * t / 2.3 + 2.2)) - C.hopAbsorb * absorb - 3 * dzy * (0.5 - 0.5 * cos(2 * dTT)) - 2 * scrN * (0.5 + 0.5 * sin(TAU * C.scratchHz * P.scratchT)) + 5 * rcA - 2.5 * blk - 7 * bow;
    var hP = K.smin(ideal, lim, lerp(lerp(C.pelvisSmooth, C.pelvisSmoothW, a), 10, run));
    if (air > 0) hP = lerp(hP, C.pelvisIdle - 4, air);
    var Fp = K.frame(Rp, [fP, cP, hP]), Fps = pk > 0 || fl > 0 || femK > 0 ? K.frame(K.mEuler(yawP, pitchP0 + fl * rad(8), 0), [fP, cP, hP]) : (femK > 0 ? K.frame(K.mEuler(yawP, pitchP0, pelvRoll * 0.4), [fP, cP, hP]) : Fp);      // the dress hangs down (not along the leaning pelvis); it does follow the small flinch recoil (else a sliver opens at the waist in profile)
    S.Fp = Fp; S.hipsMid = [fP, cP, hP];

    // ---- legs (IK) + feet
    S.leg = [];
    for (var lj = 0; lj < 2; lj++) {
      var L = legs[lj];
      var hip = K.fApply(Fp, 0, L.side * C.hipW, -3);
      var ank = [L.f, L.c, L.z];
      var dd = v3sub(ank, hip), dl = v3len(dd), reach = (L1 + L2) * 0.9995;
      if (dl > reach) ank = v3mad(hip, dd, reach / dl);
      var knock = fz * (1 - aw) * rad(7);          // frozen: the knees drift slightly inward
      var poleA = L.side * rad(7) + yawP * 0.5 - L.side * knock * 1.0;
      var knee = ik2(hip, ank, [cos(poleA), sin(poleA), 0], L1, L2);
      var Rf = K.mMul(K.mRz(L.side * L.toe), K.mRy(L.beta));
      var ofoot = v3sub(ank, K.mVec(Rf, 0, 0, C.ankleZ));
      S.leg.push({ side: L.side, hip: hip, knee: knee, ank: ank, Ff: K.frame(Rf, ofoot), beta: L.beta, tb: L.tb });
    }

    // ---- head angles (relative to the neck)
    var headLead = (P.yaw > 0 && P.yaw < 1) ? 0.22 * sin(PI * P.yaw) : 0;       // the head leads the body turn
    var scr = P.scratch;
    var hy = P.hy - 0.85 * e4 + 0.1 * e1 + 0.07 * sin(TAU * t / 5.3) * idleA + 0.4 * b4 * s4 * (1 - 0.25 * sin(TAU * 3 * t)) + 0.3 * dzy * sin(dTT + 0.6);
    var scT = P.scratchT, scW = sstep(0.3, 0.8, scr);          // scratch: head tilts into the hand, wince beats, rub-synchronous head wobble
    var hp = P.hp + 0.6 * e3 - 0.1 * e4 + 0.08 * e1 + (C.idleNod * sin(TAU * t / 3.9) + 0.05 * sin(TAU * t / 7.7)) * idleA + 0.16 * b1 - 0.08 * b4 - 0.10 * scr - 0.32 * sq - 0.12 * hunchS + 0.3 * air - 0.22 * fl - 0.1 * dzy - 0.1 * scW * max(0, sin(TAU * 1.7 * scT)) + 0.1 * fz + 0.1 * rcA - 0.3 * blk - 0.05 * femK;
    var hr = P.hr + 0.62 * e1 - 0.12 * e4 + (C.idleRoll * sin(TAU * t / 6.7) + 0.08 * sin(TAU * t / 3.1)) * idleA + 0.45 * b2 * s2 + 0.2 * b4 * s4 + 0.62 * scr + 0.1 * scW * sin(TAU * C.scratchHz * 0.5 * scT) + 0.12 * fz + 0.3 * bow + 0.3 * pk + a * (1 - run) * C.headTilt * sin(TAU * (ph - C.headLag)) - C.femHead * fw - 0.06 * femK + 0.1 * fl + 0.45 * dzy * dS3;
    var psiH = -hy * rad(55) - headLead * rad(14);
    var runLeanTot = run * (rad(C.runLean + C.runLeanDeg * (lean - C.runLean0)) - rad(C.runPelvisPitch));          // the torso's total forward tip in the run (spine lean + pelvis pitch), rad
    var phiH = (hp >= 0 ? hp * rad(35) : hp * rad(38)) + pk * rad(C.peekHead) - a * rad(C.headNod) * cos(TAU * 2 * (ph - C.headLag)) + C.runHeadLevel * runLeanTot + run * rad(C.runHead) * (1 + 0.15 * sin(TAU * 2 * ph));          // run (GAIT R10): the head counter-rotates the lean = LEVEL in the world, eyes on the horizon (+ runHead deg chin-up)
    var rhoH = hr * rad(20);
    S.headAng = [psiH, phiH, rhoH];

    // ---- head height scale (references differ between views) and the torso stretch that keeps the total height
    var su = lerp(C.suSide, C.suFront, yawS * C.headMorph);          // headMorph 0 = ONE head size at every yaw (user request: the face must not grow when she turns to the front)
    var nkS = lerp(1, C.neckShort, yawS);          // relaxed (shorter) neck in the front view; the torso takes the length
    var stretch = (C.crown + C.runCrownK * run - C.waistH - (58 + (-C.headPivot[2])) * su) / ((C.neckBaseH - C.waistH) + (C.neckTopH - C.neckBaseH) * nkS);
    S.su = su; S.stretch = stretch;

    // ---- spine / torso / neck chain (FK through the loft rows, bending smoothly from the waist upward)
    var leanT = lean >= 0 ? lean * rad(30) : lean * rad(11);
    var pitchT = -(1 - run) * leanT - a * (1 - run) * rad(C.walkLean) - run * rad(C.runLean + C.runLeanDeg * (lean - C.runLean0)) + wsf * rad(1.5) + dzy * rad(5) * dS2 - absorb * rad(10) + ld * rad(6.5) - bow * rad(C.bowDeg) + rcA * rad(3) + a * (1 - run) * rad(C.spineAmp) * walkBobShape(2 * (ph - C.bobPh - C.spineLag));
    var yawPl = aw * rad(C.walkYaw) * cos(TAU * (ph - C.shLag)) * (1 - 0.5 * run);          // the shoulders follow the hips with a small lag (successive breaking of the joints)
    var twistRel = -C.shoulderCounter * yawPl - twistU * rad(C.twistDeg);          // twist > 0: the upper body turns toward the viewer (look back over the shoulder)
    var rollT = wsh * rad(-4.5) - rad(C.femCounter) * fw - rad(6.5) * e1 - 0.07 * b2 * s2 - 0.04 * b3 * s3 + scr * rad(-5) - dzy * rad(7) * dS1;
    var comp = (1 - 0.07 * sqp + 0.2 * sqn) * stretch, wid = 1 + 0.07 * sqp - 0.02 * sqn;
    var nRows = TORSO_H.length;
    S.torsoF = new Array(nRows);
    var vbCs = trm * 0.25 * tr2, vbF = trm * 0.35 * tr1, vbC = vbCs - C.femChest * fw, vbH = trm * 0.3 * tr3 + 2.5 * rcA;          // upper-body shiver (the skirt top follows it: no seam at the waist)
    var oPrev = K.fApply(Fp, vbF, vbC, C.waistH - C.hipRest + C.runWaistK * run + vbH);
    var chestUp = C.idleChest * (breath + 0.5 * b1 + 1.5 * e3 + 0.15 * sin(TAU * t / 1.7) * idleA) * idleA + C.walkChest * a * (1 - run) * cos(TAU * 2 * (ph - C.bobPh - 0.1)), shUp = C.shrugAmp * (0.35 * b3 + 0.3 * b1 + 0.7 * e1 + 0.9 * e3) + 1.5 * ld + 5.0 * fz + 2.5 * rcA + 1.5 * bow + 8 * P.shrug + 2.5 * P.startle + 2 * P.clutch, exPrev = 0, fNPrev = 0;          // breathing chest rise, shrug beats, look-down shoulder drop (accumulated along the spine)
    for (var i = 0; i < nRows; i++) {
      var h = TORSO_H[i];
      var gb = lerp(sstep(C.waistH, C.neckBaseH, h), sstep(C.waistH, C.waistH + C.runBendH, h), run);
      var gn = sstep(C.neckBaseH, C.neckTopH, h) * 0.5;          // neck rows take half of the head rotation
      var Ri = K.mMul(Rp, K.mEuler(twistRel * sstep(C.waistH, 360, h) + psiH * gn, pitchT * gb + phiH * gn, rollT * gb + rhoH * gn));
      var oi = oPrev;
      if (i > 0) {
        var neckK = h > C.neckBaseH ? (1 - 0.55 * sqp + 1.1 * sqn - 0.5 * hunchS - 0.16 * ld) * (1 - C.runNeckK * run) * nkS : 1;
        var dz = (h - TORSO_H[i - 1]) * neckK * comp;
        var up = K.mVec(Ri, 0, 0, dz);
        oi = [oPrev[0] + up[0], oPrev[1] + up[1], oPrev[2] + up[2]];
      }
      var ex = chestUp * sstep(300, 352, h) + shUp * sstep(318, 346, h) * (1 - sstep(366, 392, h));
      if (pk > 0) { var fN = C.peekNeck * pk * sstep(C.neckBaseH - 20, C.neckTopH, h), uf = K.mVec(Ri, 1, 0, 0); oi = [oi[0] + uf[0] * (fN - fNPrev), oi[1] + uf[1] * (fN - fNPrev), oi[2] + uf[2] * (fN - fNPrev)]; fNPrev = fN; }          // peek: the head is thrust forward (the neck stretches)
      if (ex !== exPrev) { var uex = K.mVec(Ri, 0, 0, ex - exPrev); oi = [oi[0] + uex[0], oi[1] + uex[1], oi[2] + uex[2]]; exPrev = ex; }
      var sw = (1 + 0.012 * breath * sstep(300, 340, h) * (1 - sstep(360, 380, h))) * wid, sd = 1 + (sw - 1) * 1.8;   // breathing swell (width, depth)
      var fr = K.frame([Ri[0] * sd, Ri[1] * sw, Ri[2], Ri[3] * sd, Ri[4] * sw, Ri[5], Ri[6] * sd, Ri[7] * sw, Ri[8]], oi);
      fr.Rn = Ri;
      S.torsoF[i] = fr; oPrev = oi;
    }
    var Ftop = S.torsoF[nRows - 1];
    var Ntop = K.fApply(K.frame(Ftop.Rn, Ftop.o), 0, 0, 0);          // joints sit on the row axes (the traced rows carry their own centre offsets fm)
    var Rrot = K.mMul(Ftop.Rn, K.mEuler(psiH * 0.5, phiH * 0.5, rhoH * 0.5));
    var kwH = lerp(1, C.headW, yawS * C.headMorph0);          // lateral head scale: the front head (traced with the hair mass, bigger than the profile head) is brought to the profile head's size
    var Rhead = [Rrot[0], Rrot[1] * kwH, Rrot[2] * su, Rrot[3], Rrot[4] * kwH, Rrot[5] * su, Rrot[6], Rrot[7] * kwH, Rrot[8] * su];
    var pvw = K.mVec(Rhead, C.headPivot[0], C.headPivot[1], C.headPivot[2]);
    S.Fhead = K.frame(Rhead, [Ntop[0] - pvw[0], Ntop[1] - pvw[1], Ntop[2] - pvw[2] + C.headBob * a * (1 - run) * cos(TAU * 2 * (ph - C.bobPh - 0.18))]);
    S.Ntop = Ntop; S.neckR = S.torsoF[NECK_IDX].Rn;

    // ---- skirt rows: hangs from the waist, trails behind the walk, opens when the legs spread (and flares in a hop / run)
    var hemLift = aw * 0.5 * (1 + cos(TAU * 2 * ph)) + 0.8 * air + C.runHemLift * run + 1.2 * sqp;
    var hemF = a * (-9 * min(1, P.speed / 360)) + aw * 2.2 * sin(TAU * (2 * ph + 0.15)) - C.runHemF * run;
    var hemTilt = aw * (rad(C.hemTiltA) * sin(TAU * (ph - 0.07)) + rad(C.hemFlutter) * sin(TAU * (2 * ph - 0.22)) + rad(1.5)) + run * rad(C.runHemTilt);
    var spreadF = 1 + 0.05 * aw * hemLift + C.runSpread * run + 0.03 * rcA, spreadC = 1 + 0.03 * rcA;
    var wd0 = 1 + 0.07 * sqp - 0.02 * sqn, xF = 0.16 * sqp - 0.05 * sqn + 0.22 * air - C.peekSpread * pk, xC = 0.16 * sqp - 0.05 * sqn + 0.2 * air;       // extra skirt spread: starts at the torso's own widening at the waist, full at the hem
    S.skirtF = new Array(SKIRT_H.length);
    var hemH = SKIRT_NORM ? lerp(A.hem.walk, A.hem.run, run) : 162;
    for (var j = 0; j < SKIRT_H.length; j++) {
      var hj = SKIRT_NORM ? C.waistH - (C.waistH - hemH) * SKIRT_T[j] : SKIRT_H[j], tj = SKIRT_NORM ? SKIRT_T[j] : clamp((C.waistH - hj) / (C.waistH - 162), 0, 1), tj2 = tj * tj;
      var Rj = K.mRy(hemTilt * tj2 + (run > 0 ? run * rad(runProf(C.runTilt, tj)) : 0) + pk * rad(C.peekHemTilt) * tj2);
      var vk = 1 - sstep(0, 0.3, tj), bl = sstep(0, 0.5, tj), kF = spreadF + lerp(1 + (wd0 - 1) * 1.8 - 1, xF, bl), kC = spreadC + lerp(wd0 - 1, xC, bl);
      var Lc = K.frame([Rj[0] * kF, Rj[1] * kC, Rj[2], Rj[3] * kF, Rj[4] * kC, Rj[5], Rj[6] * kF, Rj[7] * kC, Rj[8]],
        [hemF * tj2 - (run > 0 ? run * runProf(C.runShift, tj) : 0) - C.peekHemF * pk * tj2 + vbF * vk, wsh * 1.2 * tj + vbC * vk, (hj - C.hipRest) + C.runWaistK * run * (1 - tj) + (3.0 * hemLift + 5 * air + 2.4 * rcA + C.hemBounce * a * (1 - run) * sin(TAU * 2 * (ph - 0.15))) * tj2 + vbH * vk]);
      if (femK > 0) {          // the skirt top follows the pelvis tilt exactly (no step at the waist), the hem hangs (blend of the two pelvis frames along the skirt)
        var A0 = K.fMul(Fp, Lc), A1 = K.fMul(Fps, Lc), wj = sstep(0, 0.7, tj), wi = 1 - wj, Ra = A0.R, Rb = A1.R;
        S.skirtF[j] = { R: [Ra[0] * wi + Rb[0] * wj, Ra[1] * wi + Rb[1] * wj, Ra[2] * wi + Rb[2] * wj, Ra[3] * wi + Rb[3] * wj, Ra[4] * wi + Rb[4] * wj, Ra[5] * wi + Rb[5] * wj, Ra[6] * wi + Rb[6] * wj, Ra[7] * wi + Rb[7] * wj, Ra[8] * wi + Rb[8] * wj],
          o: [A0.o[0] * wi + A1.o[0] * wj, A0.o[1] * wi + A1.o[1] * wj, A0.o[2] * wi + A1.o[2] * wj] };
      } else S.skirtF[j] = K.fMul(Fps, Lc);
    }

    // ---- arms
    S.arm = solveArms(S, P, a, run, air, ph, sq, scr, pitchT, rollT, hunch, 0);
    sleeveFlap(S, run);
    P.shudder = 0;          // (the hair module adds its own 15 Hz tremble for pose.shudder: that would fight the deer freeze; the hair follows the head motion instead)
    return S;
  }

  /** the traced front-view torso rows contain the sleeves (flat-cuffed flaps at the shoulders, ~25 units beyond the body): when an arm leaves its hanging position the flap on that side
      is removed from the torso (row width + centre shift) and the sleeve is drawn with the arm instead (drawSleeve). */
  function sleeveFlap(S, run) {
    var rL = S.arm[0].raise, rR = S.arm[1].raise;
    if (rL < 1e-3 && rR < 1e-3) return;
    for (var i = 0; i < TORSO_H.length; i++) {
      var z = TORSO_H[i];
      if (z < 314 || z > 364) continue;
      var w = torsoRows[i][4], bw = z < 344 ? min(w, 40 + 6 * sstep(310, 336, z)) : lerp(46, w, sstep(344, 360, z));
      var ex = w - min(w, bw); if (ex <= 0) continue;
      var wl = w - rL * ex, wr = w - rR * ex, g = (wl + wr) / (2 * w), shf = (wr - wl) / 2;
      var fr = S.torsoF[i], R = fr.R, Rn = fr.Rn;
      R[1] *= g; R[4] *= g; R[7] *= g;
      fr.o[0] += Rn[1] * shf; fr.o[1] += Rn[4] * shf; fr.o[2] += Rn[7] * shf;
    }
  }

  // ---- arms: FK swing blended with IK targets (scratch / think use her LEFT arm)
  function solveArms(S, P, a, run, air, ph, sq, scr, pitchT, rollT, hunch, jl) {
    var arms = [], Fsh = S.torsoF[SH_IDX], rowSh = torsoRows[SH_IDX];
    var psiC = atan2(Fsh.Rn[3], Fsh.Rn[0]);
    var Rarm = K.mEuler(psiC, pitchT * (0.45 - 0.3 * run), rollT * 0.5);
    for (var ai = 0; ai < 2; ai++) {
      var side = ai === 0 ? -1 : 1;                    // left arm (c-), right arm (c+)
      var fw = side * cos(TAU * ph);                   // +1 = arm swung fully forward (opposite arm to the leading leg)
      var fwU = side * cos(TAU * (ph - C.armLag)), fwF = side * cos(TAU * (ph - C.foreLag)), asy = 1 + 0.1 * C.asym * sin(TAU * 0.37 * ph + side * 1.3);          // upper arm lags the shoulder a little, the forearm more (overlapping action); each arm has its own slow amplitude drift
      var swing = fwU >= 0 ? C.swingFwd : C.swingBack;
      var alpha = lerp(rad(side < 0 ? C.armAlphaL : C.armAlphaR), rad(C.walkAlpha0) + rad(swing) * fwU * asy, a);
      var gIdle = rad(side < 0 ? C.armGammaL : C.armGammaR) * lerp(C.armIdleGP, 1, S.yawS);          // standing in profile: the forearm hangs (the traced 30 deg bend is the front-view fit)
      var gamma = lerp(gIdle, rad(C.gammaWalk0) + rad(C.gammaWalk1) * sstep(-0.3, 1, fwF), a);
      var beta = rad(side < 0 ? C.armBetaL : C.armBetaR) + sq * rad(18) + rad(C.armOut) * S.yawS * (1 - run) * (1 - a);          // front view: the arms hang a little away from the body (clear gap at the waist)
      if (S.femK > 0 && side < 0) { var fk2 = S.femK * S.yawS; beta = lerp(beta, rad(15), fk2); gamma += rad(12) * fk2; alpha += rad(4) * fk2; }          // feminine stance: the free arm hangs softly, close to the body, elbow slightly bent
      if (run > 0) {                                   // pumping run arms: role A (forward, elbow bent) / role B (swung back) of the traced pose, smooth in between
        // run arms (round 11): a continuous pump - the swing is a plain sinusoid of the gait phase (the old saturating role weight held each arm still for ~40 % of the cycle and snapped it across),
        // the forearm lags the upper arm a little (overlapping action)
        var wFa = 0.5 + 0.5 * fwU, wFg = 0.5 + 0.5 * fwF, alphaR = rad(lerp(C.runArmB[0], C.runArmA[0], wFa)), gammaR = rad(lerp(C.runArmB[1], C.runArmA[1], wFg));
        alpha = lerp(alpha, alphaR, run); gamma = lerp(gamma, gammaR, run); beta = lerp(beta, rad(8), run);
      }
      gamma += rad(24) * min(1, max(sq, 0)) * (1 - air) * (1 - run);
      alpha -= rad(36) * min(1, max(sq, 0)) * (1 - air) * (1 - 0.7 * run);          // crouch (hop anticipation / landing): the arms swing back
      if (sq < 0) alpha += -sq * rad(70);                        // boing stretch: the arms fly up a little
      if (S.e3 > 0) { alpha += rad(11) * S.e3; beta += rad(9) * S.e3; }          // the 'aha': the arms lift a little
      if (S.dzy > 0) { var dzw = 0.8 * S.dzy; alpha = lerp(alpha, rad(34) + rad(14) * side * S.dS1, dzw); beta = lerp(beta, rad(34), dzw); gamma = lerp(gamma, rad(22), 0.6 * S.dzy); }       // dizzy: arms out for balance
      if (hunch > 0) {
        alpha = lerp(alpha, rad(C.paw[0]), hunch * 0.9); gamma = lerp(gamma, rad(C.paw[1]), hunch * 0.9); beta = lerp(beta, rad(C.paw[2]), hunch * 0.8);          // paws: the forearms fold up, the hands come to the chest
      }
      if (S.pk > 0 && side === 1) { alpha = lerp(alpha, -rad(48), S.pk); gamma = lerp(gamma, rad(8), S.pk); }       // peek: the far arm hangs down loosely
      if (S.wave > 0 && side === 1) {                  // hello: the upper arm out and up, the forearm swinging to and fro from the elbow (a quick shy wave)
        var wvk = sstep(0, 1, S.wave);
        alpha = lerp(alpha, rad(14), wvk); beta = lerp(beta, rad(C.waveBeta), wvk); gamma = lerp(gamma, rad(C.waveGamma) + rad(C.waveAmp) * sin(TAU * C.waveHz * P.t), wvk);
      }
      if (air > 0) {
        alpha = lerp(alpha, rad(112), air); gamma = lerp(gamma, rad(52), air); beta = lerp(beta, rad(46), air);
      }
      if (S.shrugX > 0) {                              // sheepish shrug: elbows in, forearms swung out and up to the sides (palms up), the shoulders hiked (shUp)
        var sg = sstep(0, 1, S.shrugX); alpha = lerp(alpha, rad(6), sg); beta = lerp(beta, rad(30), sg); gamma = lerp(gamma, rad(108), sg);
      }
      var Ssh = K.fApply(Fsh, -1.0, side * C.shoulderC, 0);
      if (run > 0) { var wFs = 0.5 + 0.5 * fw; Ssh[0] += run * (C.runShoulderFwd * wFs - C.runShoulderBack * (1 - wFs)); }   // run: the arm that swings back also has its shoulder twisted back (far shoulder)
      if (side === -1) Ssh[2] += 21 * sstep(0, 1, min(1, P.scratch));          // the scratching shoulder is hiked up
      Ssh[2] += C.shDrop * S.yawS + 7 * S.hunchS + 5 * max(sq, 0) + 4 * P.scratch + C.shrugAmp * S.b3 * (side === S.s3 ? 1 : 0.15) + 2 * S.b1 + 2.5 * S.e1 * (side === 1 ? 1 : 0.3) + 3 * S.e3 + 3 * S.shrugX + 2 * S.startle;
      var ca = cos(alpha), sa = sin(alpha), cb = cos(beta), sb = sin(beta);
      var d1 = K.mVec(Rarm, sa * cb, side * sb, -ca * cb);
      var a2 = alpha + gamma, b2 = beta * C.foreBeta;
      var d2 = K.mVec(Rarm, sin(a2) * cos(b2), side * sin(b2), -cos(a2) * cos(b2));
      var E = v3mad(Ssh, d1, C.armU * S.ak), W = v3mad(E, d2, C.armF * S.ak);
      var arm = { side: side, S: Ssh, E: E, W: W, fw: fw, hd: v3norm(v3add(d2, K.mVec(Rarm, 0.16 + C.handLag * a * (1 - run) * side * sin(TAU * ph), side * C.handOut, 0))), curl: K.mVec(Rarm, 0, -side, 0), thumbDir: K.mVec(Rarm, 1, 0, 0) };
      arm.fist = max(hunch * 0.7, 0.5 * air); arm.scrW = 0; arm.scrPh = 0;
      arm.openW = max(S.spread, 0.85 * sstep(0, 1, S.shrugX), side === 1 ? 0.9 * sstep(0, 1, S.wave) : 0) * (1 - 0.8 * run);          // open hand with spread fingers (startled jump / shrug)
      if (side === -1 && (scr > 1e-3 || P.think > 1e-3 || S.pk > 1e-3 || P.chestHand > 1e-3 || P.poke > 1e-3 || P.clutch > 1e-3)) applyArmTargets(S, arm, P, scr);
      if (side === 1 && S.femK * S.yawS > 1e-3) applyFemArm(S, arm, S.femK * S.yawS);
      if (side === 1 && S.clutch > 1e-3) applyClutchR(S, arm, S.clutch);
      if (side === 1 && S.reach > 1e-3) applyReachR(S, arm, S.reach);
      arm.runW = run;
      var ud = v3sub(arm.E, arm.S), ul = v3len(ud) || 1;
      arm.raise = sstep(0.12, 0.45, 1 + ud[2] / ul);        // how far the upper arm is away from hanging (the sleeve then leaves the torso silhouette)
      arms.push(arm);
    }
    return arms;
  }
  /** FEMININE STANDING POSE: the right hand lightly holds the side of the skirt (elbow out, soft); weight w = fem * front-ness */
  function applyFemArm(S, arm, w) {
    var Ssh = arm.S, ws = sstep(0, 1, w), Fp = S.Fp, hw = ws * (1 - sstep(0.4, 0.9, S.hunchS)) * (1 - S.pk) * (1 - sstep(0, 1, S.shrugX));          // (the shrug lets go of the skirt)
    if (hw < 1e-3) return;
    var tgt = K.fApply(Fp, C.femHand[0], C.femHand[1], C.femHand[2]);
    var Wt = v3lerp(arm.W, tgt, hw);
    var d = v3sub(Wt, Ssh), dl = v3len(d), reach = (C.armU + C.armF) * S.ak * 0.998;
    if (dl > reach) Wt = v3mad(Ssh, d, reach / dl);
    var pole = v3lerp(v3sub(arm.E, v3lerp(Ssh, arm.W, C.armU / (C.armU + C.armF))), K.mVec(Fp.R, C.femHandPole[0], C.femHandPole[1], C.femHandPole[2]), hw);
    arm.E = ik2(Ssh, Wt, pole, C.armU * S.ak, C.armF * S.ak); arm.W = Wt;
    arm.hd = v3norm(v3lerp(arm.hd, K.mVec(Fp.R, 0.12, 0.3, -1), hw)); arm.fist = max(arm.fist || 0, 0.45 * hw);
  }
  /** REACH, right hand: reaches down-forward toward the nav console below her ('what is THAT?'), index finger out; target in the pelvis frame (cfg.reachAt) */
  function applyReachR(S, arm, w) {
    var Ssh = arm.S, wr = sstep(0, 1, w), Fp = S.Fp;
    var Wt = v3lerp(arm.W, K.fApply(Fp, C.reachAt[0], C.reachAt[1], C.reachAt[2]), wr);
    var d = v3sub(Wt, Ssh), dl = v3len(d), reach = (C.armU + C.armF) * S.ak * 0.998;
    if (dl > reach) Wt = v3mad(Ssh, d, reach / dl);
    var bend = v3sub(arm.E, v3lerp(Ssh, arm.W, C.armU / (C.armU + C.armF))), pole = v3lerp(v3len(bend) > 1.5 ? bend : [0.5, 0.5, -0.5], K.mVec(Fp.R, C.reachPole[0], C.reachPole[1], C.reachPole[2]), wr);
    arm.E = ik2(Ssh, Wt, pole, C.armU * S.ak, C.armF * S.ak); arm.W = Wt;
    arm.hd = v3norm(v3lerp(arm.hd, v3norm(v3sub(Wt, Ssh)), wr)); arm.fist = max(arm.fist || 0, 0.6 * wr); arm.pointW = max(arm.pointW || 0, wr);
  }
  /** CLUTCH, right hand: mirror of the left clutch target (both hands hold the head) */
  function applyClutchR(S, arm, w) {
    var Fh = S.Fhead, Ssh = arm.S, wcl = sstep(0, 1, w), arcC = sin(PI * wcl);
    var bend = v3sub(arm.E, v3lerp(Ssh, arm.W, C.armU / (C.armU + C.armF))), pole = v3len(bend) > 1.5 ? bend : [-0.3, 1, -0.5];
    var Wt = v3lerp(arm.W, K.fApply(Fh, C.clutchAt[0], C.clutchAt[1], C.clutchAt[2]), wcl);
    Wt = v3add(Wt, [6 * arcC, 36 * arcC, 2 * arcC]);
    pole = v3lerp(pole, [0.1, 1, -0.3], wcl);
    var d = v3sub(Wt, Ssh), dl = v3len(d), reach = (C.armU + C.armF) * S.ak * 0.998;
    if (dl > reach) Wt = v3mad(Ssh, d, reach / dl);
    arm.E = ik2(Ssh, Wt, pole, C.armU * S.ak, C.armF * S.ak); arm.W = Wt;
    arm.hd = v3norm(v3lerp(arm.hd, K.mVec(Fh.R, 0.15, -0.5, 0.85), wcl)); arm.fist = max(arm.fist || 0, wcl);
  }
  function applyArmTargets(S, arm, P, scr) {
    var Fh = S.Fhead, Ssh = arm.S, Wfk = arm.W;
    var bend = v3sub(arm.E, v3lerp(Ssh, Wfk, C.armU / (C.armU + C.armF)));
    var pole = v3len(bend) > 1.5 ? bend : [-0.3, -1, -0.5];
    var Wt = Wfk, hd = arm.hd, fist = arm.fist || 0;
    if (P.think > 1e-3) {                                // THINK: temple touch -- elbow out to the side, forearm up along the side of the head, fingertips at the temple (reads against white; the scratch is on the crown)
      var wsm = sstep(0, 1, P.think), arc = sin(PI * wsm);
      Wt = v3lerp(Wt, K.fApply(Fh, C.thinkHand[0], C.thinkHand[1], C.thinkHand[2]), wsm);
      Wt = v3add(Wt, [4 * arc, -22 * arc, 6 * arc + 1.6 * sin(TAU * 2.7 * P.t) * wsm * wsm]);      // the hand travels out and around (never straight through the torso); the fingertip taps the temple
      pole = v3lerp(pole, C.thinkPole, wsm);
      hd = v3norm(v3lerp(hd, K.mVec(Fh.R, 0.25, 0.55, 0.8), wsm));
      fist = max(fist, wsm);
    }
    if (P.chestHand > 1e-3) {                            // CHEST HAND: the left hand comes up to the chest (worry / surprise), elbow out and down; above 1 it rises on to the MOUTH (a gasp)
      var wch = sstep(0, 1, P.chestHand), wm = sstep(1, 1.6, P.chestHand), Fsh2 = S.torsoF[SH_IDX];
      var tgC = K.fApply(Fsh2, C.chestHand[0], C.chestHand[1], C.chestHand[2]), tgM = K.fApply(Fh, C.mouthHand[0], C.mouthHand[1], C.mouthHand[2]);
      Wt = v3lerp(Wt, v3lerp(tgC, tgM, wm), wch);
      pole = v3lerp(pole, C.chestPole, wch);
      hd = v3norm(v3lerp(hd, v3lerp(K.mVec(Fsh2.R, 0.3, 0.55, 0.6), K.mVec(Fh.R, -0.15, 0.7, 0.65), wm), wch));
      fist = max(fist, wch);
    }
    if (P.poke > 1e-3) {                                 // POKE: the hand rises up and forward to poke at a floating thought (index finger out), with a small hesitant wobble
      var wp = sstep(0, 1, P.poke), tp = P.t, arcP = sin(PI * wp);
      var Tg = K.fApply(Fh, C.pokeAt[0] + 6 * sin(TAU * 1.3 * tp), C.pokeAt[1], C.pokeAt[2] + 5 * sin(TAU * 0.9 * tp + 1));
      Wt = v3lerp(Wt, Tg, wp); Wt = v3add(Wt, [0, -14 * arcP, -10 * arcP]);
      pole = v3lerp(pole, C.pokePole, wp);
      hd = v3norm(v3lerp(hd, v3norm(v3sub(Tg, Ssh)), wp)); fist = max(fist, 0.6 * wp); arm.pointW = wp;
    }
    if (P.clutch > 1e-3) {                               // CLUTCH ('so many ideas!'): this (left) hand grabs the side of the head above the temple, elbow out; the right hand mirrors it (applyClutchR)
      var wcl = sstep(0, 1, P.clutch), arcC = sin(PI * wcl);
      Wt = v3lerp(Wt, K.fApply(Fh, C.clutchAt[0], -C.clutchAt[1], C.clutchAt[2]), wcl);
      Wt = v3add(Wt, [6 * arcC, -36 * arcC, 2 * arcC]);
      pole = v3lerp(pole, [0.1, -1, -0.3], wcl);
      hd = v3norm(v3lerp(hd, K.mVec(Fh.R, 0.15, 0.5, 0.85), wcl)); fist = max(fist, wcl);
    }
    if (scr > 1e-3) {                                    // SCRATCH: the hand rests on the CROWN, the fingers stick up above the head outline and rub / wiggle in small circles (6.5 Hz), the elbow pumps out
      var T = P.scratchT, w2 = sstep(0, 1, min(1, scr)), rw = sstep(0.25, 0.7, scr), pr = TAU * C.scratchHz * T, pe = pr * 0.5;
      var palm = K.fApply(Fh, C.scratchAt[0] + sin(pr) * C.scratchAmp[0] * rw, C.scratchAt[1] + cos(pr) * C.scratchAmp[1] * rw, C.scratchAt[2] + 2.5 * sin(pr + 1) * rw);
      var dirH = v3norm(v3add(K.mVec(Fh.R, 0.1, 0.5, 0.86), K.mVec(Fh.R, 0, 0.28 * cos(pr + 0.6) * rw, 0.1 * sin(pr) * rw)));
      Wt = v3lerp(Wt, v3mad(palm, dirH, -13), w2);
      Wt = v3add(Wt, [0, -20 * sin(PI * w2), 0]);        // the hand arcs out and up (anticipation and release read as one swing)
      pole = v3lerp(pole, [-0.25 + 0.45 * sin(pe), -1.0, 0.15 + 0.6 * cos(pe)], w2);
      hd = v3norm(v3lerp(hd, dirH, w2));
      fist = max(fist, w2); arm.scrW = sstep(0.2, 0.85, scr); arm.scrPh = pr;
    }
    if (S.pk > 1e-3) {                                   // peek: the near hand reaches back toward the screen edge (just inside it)
      var wk = S.pk, tap = Math.pow(max(0, sin(TAU * P.t / 2.7)), 3) * sin(TAU * 5.5 * P.t);          // the hand taps the edge now and then
      var Tg = [C.peekHand[0] + 1.5 * tap, C.peekHand[1], Ssh[2] + C.peekHand[2] + 3.5 * tap];
      Wt = v3lerp(Wt, Tg, wk);
      pole = v3lerp(pole, C.peekPole, wk);
      hd = v3norm(v3lerp(hd, [-0.55, -0.1, 0.5], wk));
    }
    var d = v3sub(Wt, Ssh), dl = v3len(d), reach = (C.armU + C.armF) * S.ak * 0.998;
    if (dl > reach) Wt = v3mad(Ssh, d, reach / dl);
    arm.E = ik2(Ssh, Wt, pole, C.armU * S.ak, C.armF * S.ak); arm.W = Wt; arm.hd = hd; arm.fist = fist;
  }

  // ------------------------------------------------------------------------------------------------ limbs: capsule chains swept along the joint chain
  /** Samples of the Catmull-Rom centre line through P0-P1-P2 (NS segments, same parameterisation as the traced profiles):
      centre (LC), unit tangent (LT), side normal e_n = T x c^ (in the sagittal plane, + = toward her front) (LN), lateral e_c = e_n x T (LE). */
  var NS = 24, NS1 = NS + 1;
  var LC = new Float64Array(3 * NS1), LT = new Float64Array(3 * NS1), LN = new Float64Array(3 * NS1), LE = new Float64Array(3 * NS1);
  var LTMP = new Float64Array(3 * NS1);
  function limbSamples(P0, P1, P2) {
    // centre line: the two bones sampled uniformly, the joint rounded by 3 smoothing passes (no overshoot, also for the sharp knees / elbows of the run)
    var half = NS >> 1, k, j, pass;
    for (k = 0; k <= NS; k++) {
      var seg2 = k > half, t = (seg2 ? k - half : k) / half, A0 = seg2 ? P1 : P0, B0 = seg2 ? P2 : P1;
      for (j = 0; j < 3; j++) LC[3 * k + j] = A0[j] + (B0[j] - A0[j]) * t;
    }
    for (pass = 0; pass < 3; pass++) {
      for (k = 1; k < NS; k++) for (j = 0; j < 3; j++) LTMP[3 * k + j] = 0.25 * LC[3 * k - 3 + j] + 0.5 * LC[3 * k + j] + 0.25 * LC[3 * k + 3 + j];
      for (k = 1; k < NS; k++) for (j = 0; j < 3; j++) LC[3 * k + j] = LTMP[3 * k + j];
    }
    for (k = 0; k <= NS; k++) {
      var a = k > 0 ? k - 1 : 0, b = k < NS ? k + 1 : NS;
      var tx = LC[3 * b] - LC[3 * a], ty = LC[3 * b + 1] - LC[3 * a + 1], tz = LC[3 * b + 2] - LC[3 * a + 2], tl = sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      LT[3 * k] = tx; LT[3 * k + 1] = ty; LT[3 * k + 2] = tz;
      var nx = -tz, nz = tx, nl = sqrt(nx * nx + nz * nz);
      if (nl < 1e-3) { nx = 1; nz = 0; nl = 1; }
      nx /= nl; nz /= nl;
      LN[3 * k] = nx; LN[3 * k + 1] = 0; LN[3 * k + 2] = nz;
      LE[3 * k] = -nz * ty; LE[3 * k + 1] = nz * tx - nx * tz; LE[3 * k + 2] = nx * ty;
    }
  }
  var TM = [new Float64Array(NS1), new Float64Array(NS1)], TR = [new Float64Array(NS1), new Float64Array(NS1)];   // scratch: blended side profile (m, r) per limb slot
  var FMs = [new Float64Array(NS1), new Float64Array(NS1)], FRs = [new Float64Array(NS1), new Float64Array(NS1)];  // front profile
  var T1M = new Float64Array(NS1), T1R = new Float64Array(NS1);
  function mixPair(dM, dR, tab, wA) {   // tab = [A, B] arrays of interleaved (m, r); weight wA on A
    var A_ = tab[0], B_ = tab[1], k;
    for (k = 0; k < NS1; k++) { dM[k] = A_[2 * k] * wA + B_[2 * k] * (1 - wA); dR[k] = A_[2 * k + 1] * wA + B_[2 * k + 1] * (1 - wA); }
  }
  function loadFront(dM, dR, arr) { for (var k = 0; k < NS1; k++) { dM[k] = arr[2 * k]; dR[k] = arr[2 * k + 1]; } }
  /** fills slot profiles for limb `kind` ('leg' | 'arm'), limb index i, role weight wA (walk) and run weight */
  function fillProfiles(kind, slot, i, wA, runW, mS) {
    var L = A.limbs && A.limbs[kind];
    if (!L) return false;
    mixPair(TM[slot], TR[slot], L.walk, wA);
    if (runW > 1e-4 && L.run) {
      mixPair(T1M, T1R, L.run, wA);
      for (var k = 0; k < NS1; k++) { TM[slot][k] = lerp(TM[slot][k], T1M[k], runW); TR[slot][k] = lerp(TR[slot][k], T1R[k], runW); }
    }
    if (mS < 1) for (var k2 = 0; k2 < NS1; k2++) TM[slot][k2] *= mS;          // idle: the traced swing offsets (two different gait roles mixed 50:50) are damped, the arm hangs straight
    loadFront(FMs[slot], FRs[slot], L.front[i]);
    return true;
  }
  var qxs = new Float64Array(NS1), qys = new Float64Array(NS1), qrs = new Float64Array(NS1);
  /** draws the swept capsule chain of a limb (view blend tF = sin^2(yaw)) */
  function drawLimb(ctx, P0, P1, P2, slot, tF) {
    limbSamples(P0, P1, P2);
    var k, ms, mf, rs, rf, cx, cy, cz, q;
    for (k = 0; k <= NS; k++) {
      ms = TM[slot][k]; mf = FMs[slot][k]; rs = TR[slot][k]; rf = FRs[slot][k];
      cx = LC[3 * k] + ms * LN[3 * k] + mf * LE[3 * k]; cy = LC[3 * k + 1] + ms * LN[3 * k + 1] + mf * LE[3 * k + 1]; cz = LC[3 * k + 2] + ms * LN[3 * k + 2] + mf * LE[3 * k + 2];
      q = K.proj(cx, cy, cz); qxs[k] = q[0]; qys[k] = q[1];
      qrs[k] = sqrt((1 - tF) * rs * rs + tF * rf * rf);
    }
    var st = C.limbStep > 1 ? C.limbStep : 1;
    K.batch(ctx, function () { for (var j = 0; j < NS; j += st) { var j2 = min(NS, j + st); K.addCapsule(ctx, qxs[j], qys[j], qrs[j], qxs[j2], qys[j2], qrs[j2]); } });
  }
  // legacy radius-key tube (used when no traced limb profiles are loaded)
  function legacyTube(ctx, P0, P1, P2, keys, nSeg) {
    var Pm = v3sub(P0, v3sub(P1, P0)), Pp = v3add(P2, v3sub(P2, P1));
    var pts = [], rs = [], half = nSeg >> 1, i, k;
    var segs = [[Pm, P0, P1, P2], [P0, P1, P2, Pp]];
    for (k = 0; k < 2; k++) {
      var Q = segs[k];
      for (i = (k === 0 ? 0 : 1); i <= half; i++) {
        var t = i / half, t2 = t * t, t3 = t2 * t;
        var c0 = -0.5 * t3 + t2 - 0.5 * t, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * t, c3 = 0.5 * t3 - 0.5 * t2;
        pts.push([c0 * Q[0][0] + c1 * Q[1][0] + c2 * Q[2][0] + c3 * Q[3][0], c0 * Q[0][1] + c1 * Q[1][1] + c2 * Q[2][1] + c3 * Q[3][1], c0 * Q[0][2] + c1 * Q[1][2] + c2 * Q[2][2] + c3 * Q[3][2]]);
        rs.push(K.curve(keys, (pts.length - 1) / (2 * half)));
      }
    }
    var prev = K.proj(pts[0][0], pts[0][1], pts[0][2]);
    for (i = 1; i < pts.length; i++) { var cur = K.proj(pts[i][0], pts[i][1], pts[i][2]); K.addCapsule(ctx, prev[0], prev[1], rs[i - 1], cur[0], cur[1], rs[i]); prev = cur; }
  }
  /** scratching hand: four fingers fanned over the crown, wiggling out of phase (drawn in the hand frame; the fist loft is the palm) */
  var FNG = [[-6.2, -16, 20], [-2.1, -5, 26], [2.1, 4, 27], [6.2, 15, 21]];          // [lateral offset at the knuckle, base fan angle (deg), length]
  function drawFingers(ctx, am, Fhd) {
    var ws = am.scrW; if (ws < 0.04) return;
    var ph = am.scrPh;
    K.batch(ctx, function () {
      for (var k = 0; k < 4; k++) {
        var g = FNG[k], ang = rad(g[1] + 12 * sin(ph + 1.7 * k)), L = g[2] * ws, ca = cos(ang), sa = sin(ang), fx = 2.5 * sin(ph + 2.1 * k + 0.5);
        var p0 = K.fApply(Fhd, 0, g[0], 13), p1 = K.fApply(Fhd, fx * 0.5, g[0] + L * 0.55 * sa, 13 + L * 0.55 * ca), p2 = K.fApply(Fhd, fx, g[0] + L * sa, 13 + L * ca);
        var q0 = K.proj(p0[0], p0[1], p0[2]), q1 = K.proj(p1[0], p1[1], p1[2]), q2 = K.proj(p2[0], p2[1], p2[2]);
        K.addCapsule(ctx, q0[0], q0[1], 2.9 * ws, q1[0], q1[1], 2.5 * ws);
        K.addCapsule(ctx, q1[0], q1[1], 2.5 * ws, q2[0], q2[1], 2.0 * ws);
      }
    });
  }
  /** open hand (startled jump / shrug): the same fan of fingers, held still and a little wider; a pointing hand (poke) shows one longer index finger */
  function drawOpenHand(ctx, am, Fhd) {
    var ws = am.openW || 0, wp = am.pointW || 0;
    if (ws < 0.04 && wp < 0.04) return;
    K.batch(ctx, function () {
      for (var k = 0; k < 4; k++) {
        var w = k === 1 ? max(ws, wp) : ws * (1 - wp);
        if (w < 0.04) continue;
        var g = FNG[k], ang = rad(g[1] * 1.2), L = g[2] * w * (k === 1 ? 1 + 0.35 * wp : 1), ca = cos(ang), sa = sin(ang);
        var p0 = K.fApply(Fhd, 0, g[0], 12), p1 = K.fApply(Fhd, 0, g[0] + L * 0.55 * sa, 12 + L * 0.55 * ca), p2 = K.fApply(Fhd, 0, g[0] + L * sa, 12 + L * ca);
        var q0 = K.proj(p0[0], p0[1], p0[2]), q1 = K.proj(p1[0], p1[1], p1[2]), q2 = K.proj(p2[0], p2[1], p2[2]);
        K.addCapsule(ctx, q0[0], q0[1], 2.9 * w, q1[0], q1[1], 2.5 * w);
        K.addCapsule(ctx, q1[0], q1[1], 2.5 * w, q2[0], q2[1], 2.0 * w);
      }
    });
  }
  /** STARTLE TICKS (pose.startle 0..1): five short ink strokes radiating from the crown (a comic 'startled' mark, no lettering); they shoot out as the envelope rises and
      collapse from the base as it falls.  Drawn by the rig so they belong to her (they move with the head). */
  var STK = [[-152, 30, 0], [-118, 40, 1], [-88, 44, 2], [-58, 40, 3], [-24, 30, 4]];          // [angle deg (screen, -90 = straight up), length, index]
  function drawStartle(ctx, S) {
    var w = S.startle; if (w < 0.02) return;
    K.setProj(S.theta, S.ox, S.oy);
    var top = K.fApply(S.Fhead, 0, 0, 58), q = K.proj(top[0], top[1], top[2]), cx = q[0], cy = q[1] - 4;
    var grow = sstep(0, 1, w), base = 1 - sstep(0.25, 1, w), lw = 2.4 * (0.5 + 0.5 * w);
    ctx.save(); ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.beginPath();
    for (var k = 0; k < STK.length; k++) {
      var tk = STK[k], a = rad(tk[0]), L = tk[1], ri = 18 + L * 0.6 * base, ro = 18 + L * grow;
      if (ro - ri < 2) continue;
      var c = cos(a), s = sin(a);
      ctx.moveTo(cx + c * ri, cy + s * ri); ctx.lineTo(cx + c * ro, cy + s * ro);
    }
    ctx.stroke(); ctx.restore();
  }
  var SLV = new Float64Array(2 * 3 * 12);
  /** the sleeve of a raised arm: a short truncated cone along the upper arm with softly rounded cuff corners (hull of the shoulder disc and two small corner discs) */
  function drawSleeve(ctx, am) {
    var tF0 = K.pj.s * K.pj.s, rs = max(sstep(0, 0.7, am.raise), sstep(0, 0.6, tF0)) * (1 - sstep(0, 0.5, am.runW));          // round cap sleeve: always in the front / three-quarter views, only with a raised arm in profile (the traced profile arm carries its own sleeve)
    if (rs < 0.03) return;
    var ud = v3sub(am.E, am.S), ul = v3len(ud) || 1, u = [ud[0] / ul, ud[1] / ul, ud[2] / ul];
    var P0 = [am.S[0], am.S[1], am.S[2] - 3.5], P1 = v3mad(am.S, u, C.sleeveL), q0 = K.proj(P0[0], P0[1], P0[2]), q1 = K.proj(P1[0], P1[1], P1[2]);
    var tFv = K.pj.s * K.pj.s, r0 = sqrt((1 - tFv) * C.sleeveRS[0] * C.sleeveRS[0] + tFv * C.sleeveR[0] * C.sleeveR[0]) * rs, r1 = sqrt((1 - tFv) * C.sleeveRS[1] * C.sleeveRS[1] + tFv * C.sleeveR[1] * C.sleeveR[1]) * rs, dx = q1[0] - q0[0], dy = q1[1] - q0[1], dl = sqrt(dx * dx + dy * dy);
    // a soft puff (tapered capsule): no flat cuff plate, curvature-continuous with the arm sweep
    var rm = 0.5 * (r0 + r1);
    K.batch(ctx, function () { K.addCapsule(ctx, q0[0], q0[1], r0, q1[0], q1[1], r1 * 0.96); K.addCapsule(ctx, q0[0] + dx * 0.5, q0[1] + dy * 0.5, rm * 0.98, q1[0] + dx * 0.12, q1[1] + dy * 0.12, r1 * 0.8); });
  }
  function kneeCtl(lg) { var m = v3lerp(lg.hip, lg.ank, 0.5); return v3mad(lg.knee, v3sub(lg.knee, m), 0.12); }
  function elbowCtl(am) { var m = v3lerp(am.S, am.W, 0.5); return v3mad(am.E, v3sub(am.E, m), 0.10); }

  // ------------------------------------------------------------------------------------------------ hands, shoes
  /** hand frame: local z along the hand, x = her forward side (a x c^), y = lateral (+ her right); origin at the wrist */
  function handFrame(am) {
    var a = v3norm(am.hd), xs = v3cross(a, [0, 1, 0]), xl = v3len(xs);
    xs = xl < 1e-3 ? [1, 0, 0] : [xs[0] / xl, xs[1] / xl, xs[2] / xl];
    var yl = v3cross(xs, a);
    return K.frame([xs[0], yl[0], a[0], xs[1], yl[1], a[1], xs[2], yl[2], a[2]], am.W);
  }
  /** frame of the shoe row at foot-local position s: the forefoot (beyond the ball) flexes so the toes stay flat on the ground while the heel lifts */
  function shoeFrame(lg, s) {
    var beta = lg.beta, Rf = lg.Ff.R, of = lg.Ff.o, bend = beta < 0 ? -beta * (lg.tb === undefined ? 0.9 : lg.tb) : 0, Bs = C.ballS, w = bend > 0 ? sstep(Bs - 1, Bs + 5, s) : 0;          // (lg.tb: only against the ground; a pointed foot in the air keeps its toes in line)
    if (w <= 0) return lg.Ff;
    var d = bend * w, Rr = K.mMul(Rf, K.mRy(d)), Ry = K.mRy(d), Bv = [Bs - (Ry[0] * Bs), -(Ry[3] * Bs), -(Ry[6] * Bs)];
    var sh = K.mVec(Rf, Bv[0], Bv[1], Bv[2]);
    return K.frame(Rr, [of[0] + sh[0], of[1] + sh[1], of[2] + sh[2]]);
  }
  /** five tiny toe tips (bare foot): a hint of toe separation at the end of the foot; big toe on the inner side (toward the other foot). Positions in the foot frame (s, y, z, radius). */
  var TOE = [[58.6, 5.0, 2.6, 2.4], [57.4, 1.8, 2.4, 2.1], [55.6, -1.2, 2.2, 1.9], [53.4, -3.9, 2.0, 1.7], [51.2, -6.3, 1.9, 1.5]];          // (GAIT R10: on the slimmer toe wedge of the bare-foot loft, tips just proud of it so they read as toes)
  function drawToes(ctx, lg, i) {
    var inner = lg.side < 0 ? 1 : -1;               // left foot: the inner side is +y (toward her right)
    K.batch(ctx, function () {
      for (var k = 0; k < 5; k++) {
        var t = TOE[k], Fr = shoeFrame(lg, t[0]), p = K.fApply(Fr, t[0], t[1] * inner, t[2]), q = K.proj(p[0], p[1], p[2]);
        K.addDisc(ctx, q[0], q[1], t[3]);
      }
    });
  }
  function projectShoe(lg, loft) { for (var r = 0; r < loft.R; r++) K.projectRow(loft, r, shoeFrame(lg, loft.rows[r][0]), 0); }
  /** role weight (weight of the "A" table) of leg i / arm i: A at the traced key phase, B half a cycle later; idle = even mix */
  function legRoleW(S, i) {
    var P = S.P, kq = lerp(C.keyQ, C.keyQRun, S.run), cyc = 0.5 + 0.5 * cos(TAU * (S.legQ[i] - kq));
    return lerp(0.5, cyc, max(S.amount, S.run));
  }
  function armRoleW(S, i) {
    var arm = S.arm[i], kf = C.keyFw, w = sstep(-kf, kf, arm.fw);
    return lerp(0.5, w, max(S.amount, S.run));
  }

  function buildPath(ctx, S) {
    var i, r, dbg = A.dbg || {}, tF = K.pj.s * K.pj.s;
    K.setProj(S.theta, S.ox, S.oy);
    tF = K.pj.s * K.pj.s;
    var runW = S.run, useR = runW > 1e-4 && HEAD_R, HD = HEAD, TS = TORSO, SK = SKIRT;
    var pxs = (GA.stage && GA.stage.px) || 1, dyS = max(0.4, 0.45 / pxs), dyShoe = max(0.3, 0.34 / pxs), dyHand = max(0.25, 0.3 / pxs);          // sweep step: resolution aware (a scanline per ~0.45 device px)
    if (useR) { K.lerpLoft(HEAD_B, HEAD, HEAD_R, runW); K.lerpLoft(TORSO_B, TORSO, TORSO_R, runW); K.lerpLoft(SKIRT_B, SKIRT, SKIRT_R, runW); HD = HEAD_B; TS = TORSO_B; SK = SKIRT_B; }
    if (!dbg.noHead) {
      for (r = 0; r < HD.R; r++) K.projectRow(HD, r, S.Fhead, 0);
      YR[0] = 1e30; YR[1] = -1e30; K.loftRange(HD, 0, HD.R - 1, YR);
      SWH.begin(YR[0], YR[1], dyS); SWH.addLoft(HD, 0, HD.R - 1);
      ctx.beginPath(); SWH.emit(ctx, C.fair.head); ctx.fill();
    }
    if (!dbg.noTorso || !dbg.noSkirt) {
      YR[0] = 1e30; YR[1] = -1e30;
      if (!dbg.noTorso) { for (r = 0; r < TS.R; r++) K.projectRow(TS, r, S.torsoF[r], 0); K.loftRange(TS, 0, TS.R - 1, YR); }
      if (!dbg.noSkirt) { for (r = 0; r < SK.R; r++) K.projectRow(SK, r, S.skirtF[r], S.ele); K.loftRange(SK, 0, SK.R - 1, YR); }
      SWT.begin(YR[0], YR[1], dyS);
      if (!dbg.noTorso) SWT.addLoft(TS, 0, TS.R - 1);
      if (!dbg.noSkirt) SWT.addLoft(SK, 0, SK.R - 1);
      ctx.beginPath(); SWT.emit(ctx, C.fair.trunk); ctx.fill();
    }
    if (dbg.noLimbs) return;
    for (i = 0; i < 2 && !dbg.noLegs; i++) {            // legs + shoes
      var lg = S.leg[i], wA = legRoleW(S, i);
      if (fillProfiles('leg', i, i, wA, runW)) drawLimb(ctx, lg.hip, kneeCtl(lg), lg.ank, i, tF);
      else K.batch(ctx, function () { legacyTube(ctx, lg.hip, kneeCtl(lg), lg.ank, [[0, 17], [1, 9]], 32); });
      K.lerpLoft(SHOE_S[i], SHOE[i][0], SHOE[i][1], 1 - wA);
      if (useR) { K.lerpLoft(SHOE_S2[i], SHOE_R[i][0], SHOE_R[i][1], 1 - wA); K.lerpLoft(SHOE_S[i], SHOE_S[i], SHOE_S2[i], runW); }
      projectShoe(lg, SHOE_S[i]);
      YR[0] = 1e30; YR[1] = -1e30; K.loftRange(SHOE_S[i], 0, SHOE_S[i].R - 1, YR);
      SWS.begin(YR[0], YR[1], dyShoe); SWS.addLoft(SHOE_S[i], 0, SHOE_S[i].R - 1);
      ctx.beginPath(); SWS.emit(ctx, C.fair.shoe); ctx.fill();
      drawToes(ctx, lg, i);
    }
    for (i = 0; i < 2 && !dbg.noArms; i++) {            // arms + hands
      var am = S.arm[i], wAa = armRoleW(S, i);
      if (fillProfiles('arm', i, i, wAa, runW, lerp(C.armIdleM, 1, sstep(0, 0.8, max(S.amount, S.run))) * (am.fist > 0.5 ? 0.5 : 1))) drawLimb(ctx, am.S, elbowCtl(am), am.W, i, tF);
      else K.batch(ctx, function () { legacyTube(ctx, am.S, elbowCtl(am), am.W, [[0, 11], [1, 7]], 24); });
      drawSleeve(ctx, am);
      if (HAND_S.length) {
        K.lerpLoft(HAND_S[i], HAND[i][0], HAND[i][1], 1 - wAa);
        var fw = max(runW, am.fist || 0);
        if (fw > 1e-3 && HAND_R.length) { K.lerpLoft(HAND_S2[i], HAND_R[i][0], HAND_R[i][1], 1 - wAa); K.lerpLoft(HAND_S[i], HAND_S[i], HAND_S2[i], fw); }
        var Fhd = handFrame(am);
        for (r = 0; r < HAND_S[i].R; r++) K.projectRow(HAND_S[i], r, Fhd, 0);
        YR[0] = 1e30; YR[1] = -1e30; K.loftRange(HAND_S[i], 0, HAND_S[i].R - 1, YR);
        SWL.begin(YR[0], YR[1], dyHand); SWL.addLoft(HAND_S[i], 0, HAND_S[i].R - 1);
        ctx.beginPath(); SWL.emit(ctx, C.fair.hand); ctx.fill();
        if (am.scrW > 0.04) drawFingers(ctx, am, Fhd);
        if (am.openW > 0.04 || am.pointW > 0.04) drawOpenHand(ctx, am, Fhd);
      }
    }
  }

  // ------------------------------------------------------------------------------------------------ factory
  GA.createGirl = function (opts) {
    opts = opts || {};
    var height = opts.height || 500, sc = height / 500;
    var seed = opts.seed === undefined ? 1 : opts.seed;
    var hair = A.createHair ? A.createHair(seed) : null;
    var girl = { version: 'C2', STRIDE: C.stride * sc, STRIDE_RUN: C.strideRun * sc, height: height };
    girl.setWalkPreset = function (n) { return A.setWalkPreset ? A.setWalkPreset(n) : false; };          // runtime switch between the walk style presets (see girl_a_tuned.js)
    girl.walkPresetName = function () { return A.walkPreset; };

    // ---- per-tick memo: step() (x2 per frame), draw() and anchors() are called with the same pose, so the rig is solved once per distinct pose
    var memoVer = -1, KEYN = 36, kLast = new Float64Array(KEYN), kNow = new Float64Array(KEYN), sLast = null, anchLast = null;
    function poseKey(p, o) {
      var g = p.gait || {}, w = p.wind || {};
      o[0] = p.x; o[1] = p.y; o[2] = p.yaw; o[3] = g.amount; o[4] = g.phase; o[5] = g.speed; o[6] = g.run; o[7] = p.headYaw; o[8] = p.headPitch; o[9] = p.headRoll; o[10] = p.lean; o[11] = p.squash;
      o[12] = p.scratch; o[13] = p.scratchT; o[14] = p.think; o[15] = p.shudder; o[16] = p.shudderT; o[17] = p.air; o[18] = p.peek; o[19] = p.flinch; o[20] = p.dizzy; o[24] = p.bow; o[25] = p.twist; o[26] = p.chestHand; o[21] = w.x; o[22] = w.y; o[23] = p.t;
      o[27] = p.startle; o[28] = p.spread; o[29] = p.poke; o[30] = p.clutch; o[31] = p.shrug; o[32] = p.thinkT; o[33] = p.reach; o[34] = g.stride || 0; o[35] = p.wave;
    }
    function solveMemo(pose) {
      poseKey(pose, kNow);
      var same = sLast !== null && memoVer === A.touchVer, i;
      memoVer = A.touchVer;
      if (same) for (i = 0; i < KEYN; i++) { var a = kNow[i], b = kLast[i]; if (a !== b && !(a !== a && b !== b)) { same = false; break; } }
      if (same) return sLast;
      sLast = solve(pose, sc); anchLast = null;
      var t = kLast; kLast = kNow; kNow = t;
      return sLast;
    }
    girl.solve = function (pose) { return solve(pose, sc); };
    girl.hairSpine = function () { return hair && hair.spine ? { p: hair.spine(), n: hair.spineN() } : null; };
    girl.reset = function (s) { anchLast = null; if (hair) hair.reset(s === undefined ? seed : s); girl.STRIDE = C.stride * sc; girl.STRIDE_RUN = C.strideRun * sc; };
    girl.step = function (dt, pose) { anchLast = null; if (hair) hair.step(dt, solveMemo(pose), sc); };
    girl.draw = function (ctx, pose) {
      var S = solveMemo(pose), dbg = A.dbg || {};
      ctx.save();
      if (sc !== 1) ctx.scale(sc, sc);
      ctx.fillStyle = GA.style ? GA.style.INK : '#0b0b0c';
      if (!dbg.noBody) buildPath(ctx, S);
      if (hair && !dbg.noHair) hair.draw(ctx, S, sc);
      if (S.startle > 0.02 && !dbg.noBody) drawStartle(ctx, S);
      ctx.restore();
    };
    function P2(p) { return K.proj(p[0], p[1], p[2]); }
    girl.anchors = function (pose) {
      var S = solveMemo(pose);
      if (anchLast) return anchLast;                  // same pose, same hair state: shared result object (read-only)
      K.setProj(S.theta, S.ox, S.oy);
      function W(p) { var q = P2(p); return { x: q[0] * sc, y: q[1] * sc }; }
      var Fh = S.Fhead;
      var top = K.fApply(Fh, 0, 0, 58), ctr = K.fApply(Fh, 0, 0, 0), spot = K.fApply(Fh, 0, 0, 55);
      function foot(L) { return K.fApply(L.Ff, 18, 0, 0); }
      var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, i, r;
      function growXY(x, y, rr) { if (x - rr < b.x0) b.x0 = x - rr; if (x + rr > b.x1) b.x1 = x + rr; if (y - rr < b.y0) b.y0 = y - rr; if (y + rr > b.y1) b.y1 = y + rr; }
      function grow(p, rr) { var q = P2(p); growXY(q[0], q[1], rr); }
      function growLoft(loft, frames, fixed, ele, step) {
        for (var rr = 0; rr < loft.R; rr += step || 1) {
          K.projectRow(loft, rr, fixed || frames[rr], ele || 0);
          for (var k = 0; k < loft.N; k++) growXY(loft.buf[(rr * loft.N + k) * 2], loft.buf[(rr * loft.N + k) * 2 + 1], 0.5);
        }
      }
      growLoft(HEAD, null, S.Fhead, 0, 3); growLoft(TORSO, S.torsoF, null, 0, 4); growLoft(SKIRT, S.skirtF, null, S.ele, 3);
      for (i = 0; i < 2; i++) {
        var lgb = S.leg[i], amb = S.arm[i];
        var sl = SHOE[i][0]; for (r = 0; r < sl.R; r += 2) { K.projectRow(sl, r, lgb.Ff, 0); for (var k2 = 0; k2 < sl.N; k2++) growXY(sl.buf[(r * sl.N + k2) * 2], sl.buf[(r * sl.N + k2) * 2 + 1], 0.5); }
        grow(lgb.knee, 13); grow(lgb.ank, 9);
        grow(amb.E, 9); grow(amb.W, 6); grow(v3mad(amb.W, v3norm(amb.hd), 26), 4);
      }
      if (hair && hair.bounds) { var hb = hair.bounds(); if (hb) { b.x0 = min(b.x0, hb.x0); b.x1 = max(b.x1, hb.x1); b.y0 = min(b.y0, hb.y0); b.y1 = max(b.y1, hb.y1); } }
      return (anchLast = {
        headTop: W(top), headCenter: W(ctr), headR: 52 * S.su * sc, scratchSpot: W(spot),
        neck: W(K.fApply(S.torsoF[NECK_IDX], torsoRows[NECK_IDX][1], 0, 0)), hips: W(S.hipsMid),
        footL: W(foot(S.leg[0])), footR: W(foot(S.leg[1])), bounds: { x0: b.x0 * sc, y0: b.y0 * sc, x1: b.x1 * sc, y1: b.y1 * sc },
      });
    };
    /** hair-simulation state snapshot / restore / settle (the body is a pure function of the pose, so only the hair carries state). snapshot(out?) reuses the buffer of a previous
        snapshot; restore(s) -> bool; settle(pose) re-initialises the hair at rest for that pose in one step (no 100-step pre-roll). */
    girl.snapshot = function (out) { return hair && hair.snapshot ? hair.snapshot(out) : null; };
    girl.restore = function (s) { anchLast = null; return !!(hair && s && hair.restore && hair.restore(s)); };
    girl.settle = function (pose) { anchLast = null; if (hair && hair.settle) hair.settle(solveMemo(pose)); };
    girl.reset(seed);
    return girl;
  };

  // ---- internals for the offline bake / extraction tools (the .mjs scripts in the trace folder); not used by the animation
  A.int = {
    solve: solve, NS: NS, limbSamples: function (P0, P1, P2) { limbSamples(P0, P1, P2); return { C: Array.from(LC), T: Array.from(LT), N: Array.from(LN), E: Array.from(LE) }; },
    kneeCtl: kneeCtl, elbowCtl: elbowCtl, handFrame: handFrame, projectShoe: projectShoe, shoeFrame: shoeFrame,
    lofts: function () { return { HEAD: HEAD, TORSO: TORSO, SKIRT: SKIRT, SHOE: SHOE, HAND: HAND, torsoRows: torsoRows, skirtRows: skirtRows, TORSO_H: TORSO_H, SKIRT_H: SKIRT_H }; },
    legRoleW: legRoleW, armRoleW: armRoleW,
  };
})();


/* ===== girl_c2_trace.js ===== */
/* girl_c2_trace.js -- GENERATED by trace/build_trace.mjs from the reference silhouettes (ref8 front, ref9 side walk, ref1 run). Do not edit by hand.
   Loft rows [z, fm, df, db, w, p, fc] (head: u / torso: standing height / skirt: 0..1 from waist to hem), shoe rows [s, zc, hz, wz, p],
   limb profiles = interleaved (centre offset, radius) x 25 samples, pony = head-local rest curve + half widths (21 samples). */
(function () {
  'use strict';
  var A = GA.girlA, D = A.data;
  D.head = [[59.5,-2.56,0.4,0.4,0.4,2,0],[59.164,-2.532,0.497,0.497,0,2,0],[58.728,-1.423,1.388,1.388,0,2,0],[58.292,1.637,4.759,4.759,7.477,2,0],[57.856,-0.685,6.67,6.67,8.541,2,0],[57.42,-1.395,8.29,8.29,10.016,2,0],[56.984,-1.399,10.259,10.259,11.947,2,0],[56.548,-1.217,12.176,12.176,14.29,2,0],[56.112,-1.022,13.929,13.929,16.916,2,0],[55.189,-0.562,16.602,16.602,19.661,2,0],[54.099,0.045,19.4,19.4,22.381,2,0],[53.009,0.496,21.781,21.781,24.951,2,0],[51.919,0.804,23.579,23.579,27.308,2,0],[50.829,0.61,25.243,25.243,29.435,2,0],[49.739,-0.028,27.552,27.552,31.364,2,0],[48.649,0.024,28.515,28.515,33.16,2,0],[47.559,0.138,29.561,29.561,34.904,2,0],[46.468,0.147,30.439,30.439,36.662,2,0],[45.378,0.192,31.111,31.111,38.467,2,0],[44.288,0.228,31.684,31.684,40.302,2,0],[43.198,0.032,32.433,32.433,42.097,2,0],[42.108,-0.002,32.972,32.972,43.748,2,0],[41.018,-0.079,33.58,33.58,45.153,2,0],[39.928,1.092,33.866,33.866,46.258,2,0],[38.838,2.867,37.202,37.202,47.076,2,0],[37.748,2.16,37.027,37.027,47.67,2,0],[36.658,3.086,38.179,38.179,48.116,2,0],[35.568,3.141,38.555,38.555,48.473,2,0],[34.477,2.874,38.784,38.784,48.774,2,0],[33.387,3.17,39.827,39.827,49.036,2,0],[32.297,3.247,40.244,40.244,49.267,2,0],[31.207,3.163,40.217,40.217,49.469,2,0],[30.117,2.893,40.403,40.403,49.642,2,0],[29.027,3.162,40.751,40.751,49.787,2,0],[27.937,2.908,40.841,40.841,49.904,2,0],[26.847,2.888,41.011,41.011,49.99,2,0],[25.757,2.864,41.133,41.133,50.044,2,0],[24.667,2.657,41.33,41.33,50.06,2,0],[23.577,2.65,41.33,41.33,50.029,2,0],[22.486,2.547,41.428,41.428,49.937,2,0],[21.396,2.402,41.562,41.562,49.771,2,0],[20.306,2.363,41.59,41.59,49.519,2,0],[19.216,2.117,41.762,41.762,49.187,2,0],[18.126,1.849,41.618,41.618,48.793,2,0],[17.036,1.81,41.59,41.59,48.374,2,0],[15.946,1.776,41.566,41.566,47.97,2,0],[14.856,1.648,41.439,41.439,47.616,2,0],[13.766,1.278,41.08,41.08,47.329,2,0],[12.676,1.267,41.08,41.08,47.111,2,0],[11.586,1.252,41.072,41.072,46.949,2,0],[10.495,1.179,41.216,41.216,46.828,2,0],[9.405,1.227,41.542,41.542,46.73,2,0],[8.315,1.396,41.763,41.763,46.642,2,0],[7.225,1.417,41.795,41.795,46.553,2,0],[6.135,1.298,41.695,41.695,46.457,2,0],[5.045,1.013,41.413,41.413,46.354,2,0],[3.955,0.746,41.156,41.156,46.249,2,0],[2.865,0.642,41.062,41.062,46.153,2,0],[1.775,0.492,40.916,40.916,46.073,2,0],[0.685,0.325,40.765,40.765,46.016,2,0],[-0.405,0.193,40.637,40.637,45.985,2,0],[-1.495,0.036,40.491,40.491,45.982,2,0],[-2.586,-0.14,40.326,40.326,46.006,2,0],[-3.676,-0.169,39.983,39.983,46.057,2,0],[-4.766,-0.265,39.705,39.705,46.131,2,0],[-5.856,-0.42,39.54,39.54,46.224,2,0],[-6.946,-0.525,39.454,39.454,46.327,2,0],[-8.036,-0.56,39.42,39.42,46.428,2,0],[-9.126,-0.567,39.424,39.424,46.519,2,0],[-10.216,-0.479,39.411,39.411,46.593,2,0],[-11.306,-0.183,39.31,39.31,46.65,2,0],[-12.396,0.066,39.36,39.36,46.689,2,0],[-13.486,0.408,39.388,39.388,46.711,2,0],[-14.577,0.777,39.463,39.463,46.713,2,0],[-15.667,1.147,39.623,39.623,46.693,2,0],[-16.757,1.639,39.733,39.733,46.645,2,0],[-17.847,2.041,40.011,40.011,46.559,2,0],[-18.937,2.643,40.135,40.135,46.419,2,0],[-20.027,3.279,40.259,40.259,46.21,2,0],[-21.117,3.682,40.577,40.577,45.919,2,0],[-22.207,4.212,40.655,40.655,45.543,2,0],[-23.297,4.521,40.711,40.711,45.081,2,0],[-24.387,4.671,40.546,40.546,44.539,2,0],[-25.477,4.583,40.196,40.196,43.919,2,0],[-26.568,4.27,39.594,39.594,43.227,2,0],[-27.658,3.804,38.685,38.685,42.469,2,0],[-28.748,3.451,37.602,37.602,41.652,2,0],[-29.838,3.405,36.738,36.738,40.782,2,0],[-30.928,3.698,36.137,36.137,39.865,2,0],[-32.018,4.25,35.613,35.613,38.9,2,0],[-33.108,4.895,35.166,35.166,37.879,2,0],[-34.198,5.643,34.699,34.699,36.785,2,0],[-35.288,6.004,34.423,34.423,35.581,2,0],[-36.378,5.57,34.534,34.534,34.217,2,0],[-37.468,5.856,33.538,33.538,32.629,2,0],[-38.559,7.247,31.533,31.533,30.761,2,0],[-39.649,8.314,30.369,30.369,28.594,2,0],[-40.739,8.462,30.421,30.421,26.177,2,0],[-41.829,8.582,30.309,30.309,23.639,2,0],[-42.919,8.545,29.842,29.842,21.166,2,0],[-44.009,9.424,27.895,27.895,18.956,2,0],[-45.099,9.102,27.007,27.007,17.149,2,0],[-46.189,9.237,26.084,26.084,15.798,2,0],[-47.279,9.701,25.232,25.232,14.872,2,0],[-48.369,10.501,24.163,24.163,14.277,2,0],[-49.459,10.865,23.506,23.506,13.913,2,0],[-50.55,11.245,22.731,22.731,13.693,2,0],[-51.64,11.642,21.762,21.762,13.559,2,0],[-52.73,10.036,19.239,19.239,13.474,2,0],[-53.82,4.463,14.302,14.302,12.47,2,0],[-54.91,-0.438,10.192,10.192,11.964,2,0],[-56,-1.873,8.014,8.014,11.262,2,0]];
  D.torso = [[292,11.12,30.48,30.48,33.683,2,-2.63],[293.5,11.27,30.16,30.16,33.312,2,-2.57],[295,11.14,29.8,29.8,32.975,2,-2.52],[296.5,11.2,29.66,29.66,32.62,2,-2.5],[298,11.13,29.65,29.65,32.271,2,-2.47],[299.5,10.69,29.48,29.48,31.958,2,-2.42],[301,10.51,29.57,29.57,31.712,2,-2.33],[302.5,10.35,29.65,29.65,31.56,2,-2.25],[304,10.08,29.75,29.75,31.486,2,-2.2],[305.5,9.02,29.17,29.17,31.477,2,-2.17],[307,8.72,29.21,29.21,31.529,2,-2.13],[308.5,8.54,29.4,29.4,31.638,2,-2.09],[310,8.25,29.62,29.62,31.8,2,-2],[311.5,7.94,29.83,29.83,32.026,2,-1.87],[313,7.83,29.77,29.77,32.321,2,-1.74],[314.5,7.68,29.69,29.69,32.668,2,-1.69],[316,7.84,29.36,29.36,33.053,2,-1.65],[317.5,7.99,29.07,29.07,33.461,2,-1.62],[319,7.9,28.94,28.94,33.885,2,-1.38],[320.5,8.02,28.57,28.57,34.336,2,-1.36],[322,7.94,28.51,28.51,34.81,2,-1.28],[323.5,8.13,28.21,28.21,35.299,2,-1.26],[325,8.23,28.03,28.03,35.799,2,-1.26],[326.5,8.28,27.88,27.88,36.301,2,-1.21],[328,8.51,27.61,27.61,36.8,2,-1.11],[329.5,8.49,27.61,27.61,37.292,2,-1.06],[331,8.74,27.36,27.36,37.782,2,-1.12],[332.5,8.77,27.29,27.29,38.274,2,-1.12],[334,8.92,27.06,27.06,38.776,2,-0.94],[335.5,9.13,26.76,26.76,39.292,2,-0.2],[337,9.08,26.72,26.72,39.829,2,0.78],[338.5,9.25,26.38,26.38,40.391,2,1.1],[340,9.1,26.21,26.21,40.987,2,0.63],[341.5,9.2,25.82,25.82,41.614,2,-0.34],[343,9.35,25.46,25.46,42.263,2,-0.87],[344.5,9.13,25.24,25.24,42.927,2,-1.01],[346,9.15,24.73,24.73,43.6,2,-1.02],[347.5,8.93,24.51,24.51,44.417,2,-1.01],[349,8.91,23.96,23.96,45.245,2,-0.91],[350.5,8.91,23.43,23.43,45.691,2,-0.9],[352,8.52,23.03,23.03,45.737,2,-0.84],[353.5,8.5,22.46,22.46,45.517,2,-0.84],[355,8.11,22.05,22.05,45.1,2,-0.79],[356.5,8,21.39,21.39,44.462,2,-0.82],[358,7.85,20.69,20.69,43.6,2,-0.78],[359.5,7.41,20.22,20.22,42.486,2,-0.81],[361,7.23,19.48,19.48,41.158,2,-0.75],[362.5,6.82,19.03,19.03,39.703,2,-0.76],[364,6.31,17.96,17.96,38.113,2,-0.71],[365.5,5.84,16.94,16.94,36.395,2,-0.74],[367,5.31,16.37,16.37,34.566,2,-0.76],[368.5,5.08,15.57,15.57,32.614,2,-0.69],[370,4.57,15.01,15.01,30.6,2,-0.62],[371.5,4.28,14.17,14.17,28.441,2,-0.61],[373,3.95,13.28,13.28,26.269,2,-0.71],[374.5,3.08,12.71,12.71,24.437,2,-0.86],[376,2.3,12.23,12.23,22.914,2,-0.98],[377.5,1.81,12.03,12.03,21.713,2,-1.12],[379,1.48,12.01,12.01,20.899,2,-1.43],[380.5,1.48,12.31,12.31,20.376,2,-1.66],[382,1.48,12.61,12.61,20.015,2,-1.8],[383.5,1.48,12.91,12.91,19.697,2,-1.52],[385,1.48,13.21,13.21,19.465,2,-1.24],[386.5,1.48,13.51,13.51,19.314,2,-0.98],[388,1.48,13.81,13.81,19.2,2,-0.73],[389.5,1.48,14.11,14.11,19.112,2,-0.34],[391,1.48,14.41,14.41,19.058,2,-0.43],[392.5,1.48,14.41,14.41,19.025,2,-0.43],[394,1.48,14.41,14.41,19,2,-0.43],[395.5,1.48,14.41,14.41,18.976,2,-0.43],[397,1.48,14.41,14.41,18.955,2,-0.43],[398.5,1.48,14.41,14.41,18.936,2,-0.43],[400,1.48,14.41,14.41,18.919,2,-0.43],[401.5,1.48,14.41,14.41,18.902,2,-0.43]];
  D.skirt = [[0,10.77,29.52,29.52,34.25,2,-2.63],[0.0105,10.509,29.83,29.83,34.254,2,-2.704],[0.0211,10.297,30.101,30.101,34.336,2,-2.758],[0.0316,10.033,30.42,30.42,34.449,2,-2.805],[0.0421,10.003,30.959,30.959,34.544,2,-2.903],[0.0526,9.724,31.347,31.347,34.708,2,-2.898],[0.0632,9.442,31.682,31.682,34.866,2,-2.843],[0.0737,9.173,32.02,32.02,35.089,2,-2.889],[0.0842,9.023,32.418,32.418,35.576,2,-2.993],[0.0947,8.928,32.903,32.903,36.312,2,-3.078],[0.1053,8.663,33.227,33.227,37.145,2,-3.115],[0.1158,8.411,33.55,33.55,37.961,2,-3.06],[0.1263,8.197,33.837,33.837,38.662,2,-3.053],[0.1368,8.229,34.362,34.362,39.446,2,-3.019],[0.1474,8.006,34.675,34.675,40.282,2,-2.922],[0.1579,7.272,34.407,34.407,41.033,2,-2.847],[0.1684,7.136,34.695,34.695,41.917,2,-2.832],[0.1789,7.021,35.062,35.062,42.685,2,-2.85],[0.1895,6.998,35.396,35.396,43.377,2,-2.845],[0.2,6.87,35.71,35.71,44.03,2,-2.82],[0.2105,6.777,35.989,35.989,44.575,2,-2.801],[0.2211,6.74,36.252,36.252,45.121,2,-2.752],[0.2316,6.635,36.588,36.588,45.635,2,-2.677],[0.2421,6.582,36.844,36.844,46.115,2,-2.687],[0.2526,6.558,37.124,37.124,46.578,2,-2.627],[0.2632,6.531,37.486,37.486,46.991,2,-2.511],[0.2737,6.507,37.714,37.714,47.348,2,-2.476],[0.2842,6.488,37.941,37.941,47.761,2,-2.474],[0.2947,6.443,38.262,38.262,48.099,2,-2.412],[0.3053,6.428,38.513,38.513,48.379,2,-2.308],[0.3158,6.422,38.73,38.73,48.801,2,-2.169],[0.3263,6.417,39.01,39.01,49.194,2,-2.109],[0.3368,6.415,39.332,39.332,49.547,2,-2.031],[0.3474,6.434,39.57,39.57,49.933,2,-1.905],[0.3579,6.526,39.884,39.884,50.224,2,-1.863],[0.3684,6.496,40.177,40.177,50.604,2,-1.731],[0.3789,6.514,40.461,40.461,51.033,2,-1.617],[0.3895,6.585,40.771,40.771,51.402,2,-1.538],[0.4,6.67,41.15,41.15,51.8,2,-1.41],[0.4105,6.719,41.495,41.495,52.154,2,-1.346],[0.4211,6.825,41.837,41.837,52.478,2,-1.244],[0.4316,6.842,42.208,42.208,52.784,2,-1.151],[0.4421,6.909,42.621,42.621,53.097,2,-1.074],[0.4526,7.06,43.002,43.002,53.486,2,-0.948],[0.4632,7.085,43.413,43.413,53.877,2,-0.918],[0.4737,7.179,43.801,43.801,54.288,2,-0.868],[0.4842,7.267,44.265,44.265,54.677,2,-0.745],[0.4947,7.305,44.696,44.696,55.011,2,-0.679],[0.5053,7.335,45.124,45.124,55.386,2,-0.561],[0.5158,7.418,45.602,45.602,55.765,2,-0.504],[0.5263,7.457,46.082,46.082,56.168,2,-0.412],[0.5368,7.446,46.581,46.581,56.561,2,-0.315],[0.5474,7.537,47.052,47.052,56.944,2,-0.252],[0.5579,7.551,47.586,47.586,57.333,2,-0.111],[0.5684,7.548,48.081,48.081,57.646,2,-0.007],[0.5789,7.55,48.657,48.657,57.986,2,0.054],[0.5895,7.561,49.175,49.175,58.423,2,0.167],[0.6,7.52,49.7,49.7,58.83,2,0.32],[0.6105,7.512,50.279,50.279,59.214,2,0.473],[0.621,7.527,50.897,50.897,59.567,2,0.557],[0.6316,7.452,51.473,51.473,59.959,2,0.633],[0.6421,7.404,52.041,52.041,60.334,2,0.677],[0.6526,7.396,52.68,52.68,60.764,2,0.798],[0.6632,7.339,53.257,53.257,61.171,2,0.981],[0.6737,7.307,53.843,53.843,61.525,2,1.148],[0.6842,7.288,54.477,54.477,61.939,2,1.242],[0.6947,7.244,55.068,55.068,62.326,2,1.349],[0.7053,7.148,55.687,55.687,62.687,2,1.518],[0.7158,7.127,56.368,56.368,63.011,2,1.625],[0.7263,7.059,56.968,56.968,63.385,2,1.742],[0.7368,6.997,57.547,57.547,63.746,2,1.871],[0.7474,6.948,58.251,58.251,64.092,2,1.981],[0.7579,6.866,58.922,58.922,64.465,2,2.117],[0.7684,6.784,59.529,59.529,64.825,2,2.197],[0.779,6.734,60.215,60.215,65.226,2,2.204],[0.7895,6.67,61.152,61.152,65.848,2,2.371],[0.8,6.774,61.699,61.699,66.252,2,2.479],[0.8105,6.979,61.864,61.864,66.471,2,2.507],[0.8211,7.353,61.958,61.958,66.753,2,2.533],[0.8316,8.035,61.821,61.821,67.092,2,2.565],[0.8421,9.037,61.396,61.396,67.46,2,2.61],[0.8526,10.385,60.633,60.633,67.843,2,2.677],[0.8632,11.942,59.661,59.661,68.219,2,2.764],[0.8737,13.573,58.615,58.615,68.54,2,2.835],[0.8842,15.127,57.647,57.647,68.73,2,2.805],[0.8947,16.473,56.875,56.875,68.646,2,2.525],[0.9053,17.592,56.273,56.273,68.134,2,1.913],[0.9158,18.576,55.602,55.602,67.038,2,1.012],[0.9263,19.582,54.407,54.407,65.3,2,-0.01],[0.9368,20.811,52.188,52.188,63.133,2,-0.985],[0.9474,22.393,48.785,48.785,60.881,2,-1.856],[0.9579,24.097,45.108,45.108,58.796,2,-2.628],[0.9684,25.447,42.091,42.091,56.386,2,-3.247],[0.9789,26.263,38.627,38.627,51.852,2,-3.701],[0.9895,26.606,33.536,33.536,44.561,2,-3.972],[1,26.769,26.516,26.516,35.487,2,-4.138]];
  D.shoe = [[[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]],[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]]],[[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]],[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]]]];
  D.hand = [[[[-4,5.099,8.9,8.9,6.8,2,0],[-3,5.059,9.031,9.031,6.926,2,0],[-2,5.023,9.16,9.16,7.05,2,0],[-1,4.999,9.288,9.288,7.174,2,0],[0,4.991,9.413,9.413,7.294,2,0],[1,4.993,9.534,9.534,7.412,2,0],[2,4.999,9.65,9.65,7.526,2,0],[3,5.007,9.76,9.76,7.636,2,0],[4,5.017,9.864,9.864,7.74,2,0],[5,5.029,9.961,9.961,7.839,2,0],[6,5.043,10.049,10.049,7.931,2,0],[7,5.058,10.129,10.129,8.017,2,0],[8,5.068,10.199,10.199,8.094,2,0],[9,5.062,10.259,10.259,8.164,2,0],[10,5.032,10.31,10.31,8.226,2,0],[11,4.975,10.349,10.349,8.278,2,0],[12,4.903,10.377,10.377,8.322,2,0],[13,4.846,10.394,10.394,8.356,2,0],[14,4.842,10.4,10.4,8.38,2,0],[15,4.918,10.384,10.384,8.395,2,0],[16,5.051,10.336,10.336,8.4,2,0],[17,5.169,10.255,10.255,8.381,2,0],[18,5.207,10.14,10.14,8.325,2,0],[19,5.162,9.991,9.991,8.23,2,0],[20,5.082,9.805,9.805,8.096,2,0],[21,5.017,9.581,9.581,7.92,2,0],[22,4.98,9.316,9.316,7.699,2,0],[23,4.968,9.007,9.007,7.429,2,0],[24,4.979,8.647,8.647,7.106,2,0],[25,5.011,8.232,8.232,6.72,2,0],[26,5.056,7.752,7.752,6.261,2,0],[27,5.095,7.193,7.193,5.711,2,0],[28,5.097,6.537,6.537,5.04,2,0],[29,5.017,5.749,5.749,4.191,2,0],[30,4.842,4.764,4.764,3.016,2,0],[31,4.617,3.418,3.418,0.3,2,0],[32,3.82,0.3,0.3,0.3,2,0]],[[-4,-7.052,8.9,8.9,6.8,2,0],[-3,-7.251,9.031,9.031,6.926,2,0],[-2,-7.515,9.16,9.16,7.05,2,0],[-1,-7.819,9.288,9.288,7.174,2,0],[0,-8.126,9.413,9.413,7.294,2,0],[1,-8.414,9.534,9.534,7.412,2,0],[2,-8.677,9.65,9.65,7.526,2,0],[3,-8.92,9.76,9.76,7.636,2,0],[4,-9.151,9.864,9.864,7.74,2,0],[5,-9.377,9.961,9.961,7.839,2,0],[6,-9.6,10.049,10.049,7.931,2,0],[7,-9.823,10.129,10.129,8.017,2,0],[8,-10.046,10.199,10.199,8.094,2,0],[9,-10.266,10.259,10.259,8.164,2,0],[10,-10.464,10.31,10.31,8.226,2,0],[11,-10.598,10.349,10.349,8.278,2,0],[12,-10.592,10.377,10.377,8.322,2,0],[13,-10.363,10.394,10.394,8.356,2,0],[14,-9.862,10.4,10.4,8.38,2,0],[15,-9.086,10.384,10.384,8.395,2,0],[16,-8.017,10.336,10.336,8.4,2,0],[17,-6.637,10.255,10.255,8.381,2,0],[18,-5.031,10.14,10.14,8.325,2,0],[19,-3.374,9.991,9.991,8.23,2,0],[20,-1.793,9.805,9.805,8.096,2,0],[21,-0.334,9.581,9.581,7.92,2,0],[22,0.979,9.316,9.316,7.699,2,0],[23,2.103,9.007,9.007,7.429,2,0],[24,2.964,8.647,8.647,7.106,2,0],[25,3.493,8.232,8.232,6.72,2,0],[26,3.731,7.752,7.752,6.261,2,0],[27,3.803,7.193,7.193,5.711,2,0],[28,3.818,6.537,6.537,5.04,2,0],[29,3.82,5.749,5.749,4.191,2,0],[30,3.82,4.764,4.764,3.016,2,0],[31,3.82,3.418,3.418,0.3,2,0],[32,3.82,0.3,0.3,0.3,2,0]]],[[[-4,5.099,8.9,8.9,6.8,2,0],[-3,5.059,9.031,9.031,6.926,2,0],[-2,5.023,9.16,9.16,7.05,2,0],[-1,4.999,9.288,9.288,7.174,2,0],[0,4.991,9.413,9.413,7.294,2,0],[1,4.993,9.534,9.534,7.412,2,0],[2,4.999,9.65,9.65,7.526,2,0],[3,5.007,9.76,9.76,7.636,2,0],[4,5.017,9.864,9.864,7.74,2,0],[5,5.029,9.961,9.961,7.839,2,0],[6,5.043,10.049,10.049,7.931,2,0],[7,5.058,10.129,10.129,8.017,2,0],[8,5.068,10.199,10.199,8.094,2,0],[9,5.062,10.259,10.259,8.164,2,0],[10,5.032,10.31,10.31,8.226,2,0],[11,4.975,10.349,10.349,8.278,2,0],[12,4.903,10.377,10.377,8.322,2,0],[13,4.846,10.394,10.394,8.356,2,0],[14,4.842,10.4,10.4,8.38,2,0],[15,4.918,10.384,10.384,8.395,2,0],[16,5.051,10.336,10.336,8.4,2,0],[17,5.169,10.255,10.255,8.381,2,0],[18,5.207,10.14,10.14,8.325,2,0],[19,5.162,9.991,9.991,8.23,2,0],[20,5.082,9.805,9.805,8.096,2,0],[21,5.017,9.581,9.581,7.92,2,0],[22,4.98,9.316,9.316,7.699,2,0],[23,4.968,9.007,9.007,7.429,2,0],[24,4.979,8.647,8.647,7.106,2,0],[25,5.011,8.232,8.232,6.72,2,0],[26,5.056,7.752,7.752,6.261,2,0],[27,5.095,7.193,7.193,5.711,2,0],[28,5.097,6.537,6.537,5.04,2,0],[29,5.017,5.749,5.749,4.191,2,0],[30,4.842,4.764,4.764,3.016,2,0],[31,4.617,3.418,3.418,0.3,2,0],[32,3.82,0.3,0.3,0.3,2,0]],[[-4,-7.052,8.9,8.9,6.8,2,0],[-3,-7.251,9.031,9.031,6.926,2,0],[-2,-7.515,9.16,9.16,7.05,2,0],[-1,-7.819,9.288,9.288,7.174,2,0],[0,-8.126,9.413,9.413,7.294,2,0],[1,-8.414,9.534,9.534,7.412,2,0],[2,-8.677,9.65,9.65,7.526,2,0],[3,-8.92,9.76,9.76,7.636,2,0],[4,-9.151,9.864,9.864,7.74,2,0],[5,-9.377,9.961,9.961,7.839,2,0],[6,-9.6,10.049,10.049,7.931,2,0],[7,-9.823,10.129,10.129,8.017,2,0],[8,-10.046,10.199,10.199,8.094,2,0],[9,-10.266,10.259,10.259,8.164,2,0],[10,-10.464,10.31,10.31,8.226,2,0],[11,-10.598,10.349,10.349,8.278,2,0],[12,-10.592,10.377,10.377,8.322,2,0],[13,-10.363,10.394,10.394,8.356,2,0],[14,-9.862,10.4,10.4,8.38,2,0],[15,-9.086,10.384,10.384,8.395,2,0],[16,-8.017,10.336,10.336,8.4,2,0],[17,-6.637,10.255,10.255,8.381,2,0],[18,-5.031,10.14,10.14,8.325,2,0],[19,-3.374,9.991,9.991,8.23,2,0],[20,-1.793,9.805,9.805,8.096,2,0],[21,-0.334,9.581,9.581,7.92,2,0],[22,0.979,9.316,9.316,7.699,2,0],[23,2.103,9.007,9.007,7.429,2,0],[24,2.964,8.647,8.647,7.106,2,0],[25,3.493,8.232,8.232,6.72,2,0],[26,3.731,7.752,7.752,6.261,2,0],[27,3.803,7.193,7.193,5.711,2,0],[28,3.818,6.537,6.537,5.04,2,0],[29,3.82,5.749,5.749,4.191,2,0],[30,3.82,4.764,4.764,3.016,2,0],[31,3.82,3.418,3.418,0.3,2,0],[32,3.82,0.3,0.3,0.3,2,0]]]];
  A.hem = { walk: 152, run: 177 };
  A.dataRun = {"head":[[62.3,-13.02,0.4,0.4,0.4,2,0],[61.939,-12.85,8.586,8.586,0,2,0],[61.477,-12.467,11.196,11.196,0,2,0],[61.016,-14.079,11.98,11.98,0,2,0],[60.555,-14.606,12.711,12.711,0,2,0],[60.094,-14.971,13.893,13.893,0,2,0],[59.632,-15.326,14.723,14.723,0,2,0],[59.171,-15.877,15.872,15.872,0,2,0],[58.71,-15.209,17.305,17.305,0,2,0],[58.249,-15.304,18.418,18.418,0,2,0],[57.787,-15.197,19.373,19.373,3.561,2,0],[57.326,-14.873,20.712,20.712,8.727,2,0],[56.865,-14.726,21.578,21.578,11.872,2,0],[56.404,-16.365,24.772,24.772,13.915,2,0],[55.856,-15.959,25.65,25.65,16.81,2,0],[54.703,-14.594,28.171,28.171,21.839,2,0],[53.55,-14.965,28.817,28.817,25.5,2,0],[52.396,-15.58,29.169,29.169,28.063,2,0],[51.243,-15.209,30.421,30.421,29.965,2,0],[50.09,-14.872,31.712,31.712,31.778,2,0],[48.937,-14.537,33.048,33.048,33.079,2,0],[47.784,-14.157,34.085,34.085,34.17,2,0],[46.631,-13.97,35.03,35.03,35.41,2,0],[45.477,-13.889,35.999,35.999,37.228,2,0],[44.324,-13.759,36.853,36.853,39.552,2,0],[43.171,-13.113,38.123,38.123,42.824,2,0],[42.018,-13.069,38.802,38.802,45.569,2,0],[40.865,-13.027,39.376,39.376,47.227,2,0],[39.712,-12.944,39.938,39.938,48.481,2,0],[38.559,-12.599,40.51,40.51,49.691,2,0],[37.405,-10.996,42.191,42.191,50.726,2,0],[36.252,-10.725,43.095,43.095,51.603,2,0],[35.099,-11.121,42.954,42.954,52.403,2,0],[33.946,-10.009,44.083,44.083,53.087,2,0],[32.793,-8.754,45.383,45.383,53.838,2,0],[31.64,-8.645,45.781,45.781,54.427,2,0],[30.486,-9.448,45.524,45.524,54.961,2,0],[29.333,-8.757,46.303,46.303,55.39,2,0],[28.18,-8.466,46.628,46.628,55.73,2,0],[27.027,-8.45,46.679,46.679,55.994,2,0],[25.874,-8.09,47.143,47.143,56.158,2,0],[24.721,-8.042,47.731,47.731,56.221,2,0],[23.568,-8.489,47.564,47.564,56.25,2,0],[22.414,-8.373,47.708,47.708,56.215,2,0],[21.261,-8.418,47.702,47.702,56.138,2,0],[20.108,-7.832,48.53,48.53,55.959,2,0],[18.955,-8.577,48.424,48.424,55.707,2,0],[17.802,-8.25,48.785,48.785,53.884,2,0],[16.649,-7.987,49.084,49.084,48.432,2,0],[15.495,-7.804,49.346,49.346,48.169,2,0],[14.342,-7.911,49.799,49.799,47.952,2,0],[13.189,-7.911,50.084,50.084,47.76,2,0],[12.036,-7.765,50.293,50.293,47.547,2,0],[10.883,-8.045,50.829,50.829,47.331,2,0],[9.73,-7.898,51.011,51.011,47.131,2,0],[8.577,-7.785,51.158,51.158,46.898,2,0],[7.423,-7.929,51.498,51.498,46.714,2,0],[6.27,-7.965,51.849,51.849,46.504,2,0],[5.117,-7.877,51.979,51.979,46.326,2,0],[3.964,-8.175,52.459,52.459,46.175,2,0],[2.811,-8.031,52.705,52.705,46.033,2,0],[1.658,-7.997,52.773,52.773,45.936,2,0],[0.505,-8.188,52.948,52.948,45.875,2,0],[-0.649,-8.441,53.172,53.172,45.854,2,0],[-1.802,-11.864,49.832,49.832,45.866,2,0],[-2.955,-12.891,49.143,49.143,45.908,2,0],[-4.108,-13.317,49.113,49.113,45.978,2,0],[-5.261,-14.154,48.276,48.276,46.064,2,0],[-6.414,-14.341,48.105,48.105,46.167,2,0],[-7.568,-14.589,47.898,47.898,46.322,2,0],[-8.721,-13.981,48.051,48.051,46.58,2,0],[-9.874,-14.601,47.153,47.153,46.842,2,0],[-11.027,-14.522,47.288,47.288,47.024,2,0],[-12.18,-14.64,47.124,47.124,47.198,2,0],[-13.333,-14.85,46.53,46.53,47.297,2,0],[-14.486,-15.061,45.969,45.969,47.315,2,0],[-15.64,-15.092,45.499,45.499,47.262,2,0],[-16.793,-15.091,45.29,45.29,47.145,2,0],[-17.946,-14.874,44.835,44.835,46.988,2,0],[-19.099,-14.94,44.611,44.611,46.795,2,0],[-20.252,-14.66,44.247,44.247,46.489,2,0],[-21.405,-14.492,44.096,44.096,46.132,2,0],[-22.559,-14.178,43.913,43.913,45.792,2,0],[-23.712,-13.805,43.765,43.765,45.276,2,0],[-24.865,-13.37,43.52,43.52,44.592,2,0],[-26.018,-12.901,43.419,43.419,43.928,2,0],[-27.171,-12.297,43.35,43.35,43.115,2,0],[-28.324,-11.598,43.317,43.317,42.151,2,0],[-29.477,-10.819,43.19,43.19,41.126,2,0],[-30.631,-9.923,43.039,43.039,40.067,2,0],[-31.784,-8.965,42.741,42.741,38.88,2,0],[-32.937,-6.582,40.537,40.537,37.776,2,0],[-34.09,-5.723,39.639,39.639,36.606,2,0],[-35.243,-5.313,39.189,39.189,35.25,2,0],[-36.396,-4.985,38.817,38.817,33.888,2,0],[-37.55,-3.898,37.463,37.463,32.489,2,0],[-38.703,-3.534,35.959,35.959,30.87,2,0],[-39.856,-2.814,33.798,33.798,29.172,2,0],[-41.009,-1.75,31.886,31.886,27.27,2,0],[-42.162,-2.203,31.972,31.972,23.233,2,0],[-43.315,-1.356,30.992,30.992,13.036,2,0],[-44.468,0.037,29.423,29.423,12.882,2,0],[-45.622,0.15,28.976,28.976,12.861,2,0],[-46.775,0.423,28.066,28.066,12.716,2,0],[-47.928,2.026,25.252,25.252,12.377,2,0],[-49.081,2.037,23.263,23.263,11.966,2,0],[-50.234,2.249,21.429,21.429,11.494,2,0],[-51.387,3.101,19.914,19.914,10.952,2,0],[-52.541,3.968,17.975,17.975,10.321,2,0],[-53.694,4.519,15.914,15.914,9.567,2,0],[-54.847,5.702,12.989,12.989,8.606,2,0],[-56,10.073,7.805,7.805,6.669,2,0]],"torso":[[292,-24.66,42.71,42.71,33.683,2,-2.63],[293.5,-23.72,41.97,41.97,33.312,2,-2.57],[295,-22.68,41.04,41.04,32.975,2,-2.52],[296.5,-21.46,39.89,39.89,32.62,2,-2.5],[298,-20.15,38.56,38.56,32.271,2,-2.47],[299.5,-18.73,37.02,37.02,31.958,2,-2.42],[301,-17.17,35.28,35.28,31.712,2,-2.33],[302.5,-15.6,33.46,33.46,31.56,2,-2.25],[304,-13.62,31.69,31.69,31.486,2,-2.2],[305.5,-11.49,30.17,30.17,31.477,2,-2.17],[307,-9.28,28.29,28.29,31.529,2,-2.13],[308.5,-6.94,26.6,26.6,31.638,2,-2.09],[310,-6.26,26.52,26.52,31.8,2,-2],[311.5,-6,25.97,25.97,32.026,2,-1.87],[313,-6.43,25.81,25.81,32.321,2,-1.74],[314.5,-5.52,25.42,25.42,32.668,2,-1.69],[316,-5.45,25.9,25.9,33.053,2,-1.65],[317.5,-5.42,26.33,26.33,33.461,2,-1.62],[319,-5.44,26.76,26.76,33.885,2,-1.38],[320.5,-5.46,27.18,27.18,34.336,2,-1.36],[322,-5.5,27.65,27.65,34.81,2,-1.28],[323.5,-5.68,28.22,28.22,35.299,2,-1.26],[325,-5.86,28.82,28.82,35.799,2,-1.26],[326.5,-6.12,29.52,29.52,36.301,2,-1.21],[328,-6.51,30.4,30.4,36.8,2,-1.11],[329.5,-7.01,31.54,31.54,37.292,2,-1.06],[331,-7.51,32.67,32.67,37.782,2,-1.12],[332.5,-7.98,33.74,33.74,38.274,2,-1.12],[334,-8.52,34.83,34.83,38.776,2,-0.94],[335.5,-9.66,35.33,35.33,39.292,2,-0.2],[337,-11.18,35.4,35.4,39.829,2,0.78],[338.5,-12.63,35.41,35.41,40.391,2,1.1],[340,-13.98,35.31,35.31,40.987,2,0.63],[341.5,-15.21,35.09,35.09,41.614,2,-0.34],[343,-16.28,34.72,34.72,42.263,2,-0.87],[344.5,-17.19,34.17,34.17,42.927,2,-1.01],[346,-17.92,33.46,33.46,43.6,2,-1.02],[347.5,-18.49,32.58,32.58,44.417,2,-1.01],[349,-18.9,31.54,31.54,45.245,2,-0.91],[350.5,-19.16,30.35,30.35,45.691,2,-0.9],[352,-19.3,29.04,29.04,45.737,2,-0.84],[353.5,-19.34,27.63,27.63,45.517,2,-0.84],[355,-19.3,26.14,26.14,45.1,2,-0.79],[356.5,-19.21,24.6,24.6,44.462,2,-0.82],[358,-19.08,23.02,23.02,43.6,2,-0.78],[359.5,-18.93,21.42,21.42,42.486,2,-0.81],[361,-18.78,19.82,19.82,41.158,2,-0.75],[362.5,-18.63,18.25,18.25,39.703,2,-0.76],[364,-18.49,16.71,16.71,38.113,2,-0.71],[365.5,-18.39,15.23,15.23,36.395,2,-0.74],[367,-18.3,13.84,13.84,34.566,2,-0.76],[368.5,-18.25,12.57,12.57,32.614,2,-0.69],[370,-18.2,11.42,11.42,30.6,2,-0.62],[371.5,-18.15,10.42,10.42,28.441,2,-0.61],[373,-18.09,10,10,26.269,2,-0.71],[374.5,-18,10,10,24.437,2,-0.86],[376,-17.88,10,10,22.914,2,-0.98],[377.5,-17.73,10,10,21.713,2,-1.12],[379,-17.55,10,10,20.899,2,-1.43],[380.5,-17.38,10,10,20.376,2,-1.66],[382,-17.21,10,10,20.015,2,-1.8],[383.5,-17.05,10,10,19.697,2,-1.8],[385,-16.89,10,10,19.465,2,-1.8],[386.5,-16.77,10,10,19.314,2,-1.8],[388,-16.7,10,10,19.2,2,-1.8],[389.5,-16.66,10,10,19.112,2,-1.8],[391,-16.64,10,10,19.058,2,-1.8],[392.5,-16.63,10,10,19.025,2,-1.8],[394,-16.63,10,10,19,2,-1.8],[395.5,-16.63,10,10,18.976,2,-1.8],[397,-16.63,10,10,18.955,2,-1.8],[398.5,-16.63,10,10,18.936,2,-1.8],[400,-16.63,10,10,18.919,2,-1.8],[401.5,-16.63,10,10,18.902,2,-1.8]],"skirt":[[0,-20.85,36.11,36.11,34.25,2,-2.63],[0.0105,-21.278,36.456,36.456,34.246,2,-2.691],[0.0211,-21.705,36.727,36.727,34.299,2,-2.743],[0.0316,-22.105,37.024,37.024,34.391,2,-2.773],[0.0421,-22.525,37.288,37.288,34.479,2,-2.831],[0.0526,-22.948,37.559,37.559,34.556,2,-2.911],[0.0632,-23.354,37.78,37.78,34.694,2,-2.904],[0.0737,-23.746,38.019,38.019,34.833,2,-2.851],[0.0842,-22.531,39.882,39.882,34.969,2,-2.861],[0.0947,-21.389,41.656,41.656,35.234,2,-2.924],[0.1053,-21.096,42.524,42.524,35.714,2,-3.016],[0.1158,-21.095,43.1,43.1,36.341,2,-3.079],[0.1263,-21.291,43.497,43.497,37.021,2,-3.111],[0.1368,-21.474,43.893,43.893,37.713,2,-3.076],[0.1474,-20.827,45.127,45.127,38.315,2,-3.06],[0.1579,-19.78,46.985,46.985,38.895,2,-3.047],[0.1684,-19.156,48.85,48.85,39.575,2,-3.004],[0.1789,-18.725,50.638,50.638,40.255,2,-2.925],[0.1895,-18.401,52.369,52.369,40.865,2,-2.861],[0.2,-17.98,54.2,54.2,41.57,2,-2.82],[0.2105,-17.733,55.899,55.899,42.273,2,-2.842],[0.2211,-17.579,57.647,57.647,42.858,2,-2.85],[0.2316,-17.472,59.451,59.451,43.427,2,-2.844],[0.2421,-17.458,61.28,61.28,43.962,2,-2.823],[0.2526,-17.497,63.082,63.082,44.419,2,-2.809],[0.2632,-17.652,64.968,64.968,44.867,2,-2.779],[0.2737,-17.868,66.884,66.884,45.311,2,-2.722],[0.2842,-18.243,68.839,68.839,45.719,2,-2.669],[0.2947,-18.699,70.836,70.836,46.115,2,-2.687],[0.3053,-19.307,72.996,72.996,46.494,2,-2.651],[0.3158,-20.142,75.382,75.382,46.859,2,-2.548],[0.3263,-21.136,77.871,77.871,47.151,2,-2.484],[0.3368,-22.22,80.413,80.413,47.466,2,-2.485],[0.3474,-23.361,83.025,83.025,47.805,2,-2.471],[0.3579,-25.56,86.667,86.667,48.084,2,-2.419],[0.3684,-27.943,90.534,90.534,48.295,2,-2.334],[0.3789,-31.268,95.269,95.269,48.614,2,-2.226],[0.3895,-34.16,99.589,99.589,48.969,2,-2.141],[0.4,-34.97,101.97,101.97,49.27,2,-2.1],[0.4105,-34.024,102.672,102.672,49.563,2,-2.025],[0.4211,-33.076,103.242,103.242,49.888,2,-1.913],[0.4316,-31.979,103.576,103.576,50.13,2,-1.877],[0.4421,-30.472,103.717,103.717,50.394,2,-1.811],[0.4526,-28.846,103.702,103.702,50.745,2,-1.677],[0.4632,-27.142,103.502,103.502,51.086,2,-1.607],[0.4737,-25.594,103.378,103.378,51.388,2,-1.542],[0.4842,-24.37,103.536,103.536,51.712,2,-1.442],[0.4947,-23.578,103.438,103.438,52.024,2,-1.374],[0.5053,-23.074,103.182,103.182,52.293,2,-1.312],[0.5158,-22.716,102.807,102.807,52.556,2,-1.221],[0.5263,-22.5,102.304,102.304,52.805,2,-1.143],[0.5368,-22.277,101.778,101.778,53.062,2,-1.081],[0.5474,-22.107,101.186,101.186,53.376,2,-0.975],[0.5579,-21.583,100.904,100.904,53.693,2,-0.912],[0.5684,-20.658,101.006,101.006,54.023,2,-0.913],[0.5789,-20.696,100.066,100.066,54.362,2,-0.842],[0.5895,-21.447,98.363,98.363,54.677,2,-0.745],[0.6,-23.29,95.46,95.46,54.95,2,-0.7],[0.6105,-23.906,93.546,93.546,55.239,2,-0.603],[0.6211,-25.021,90.977,90.977,55.565,2,-0.527],[0.6316,-26.198,88.223,88.223,55.874,2,-0.491],[0.6421,-26.645,86.071,86.071,56.214,2,-0.396],[0.6526,-28.145,82.623,82.623,56.534,2,-0.318],[0.6632,-28.812,79.138,79.138,56.848,2,-0.274],[0.6737,-28.095,75.947,75.947,57.168,2,-0.178],[0.6842,-28.762,72.682,72.682,57.461,2,-0.058],[0.6947,-29.338,70.867,70.867,57.709,2,0.006],[0.7053,-29.45,69.552,69.552,58.002,2,0.057],[0.7158,-29.551,68.083,68.083,58.362,2,0.148],[0.7263,-29.754,66.465,66.465,58.702,2,0.268],[0.7368,-29.703,65.058,65.058,59.029,2,0.408],[0.7474,-28.811,62.042,62.042,59.678,2,0.575],[0.7579,-28.237,61.387,61.387,59.857,2,0.611],[0.7684,-27.374,60.607,60.607,60.062,2,0.654],[0.7789,-26.063,59.457,59.457,60.317,2,0.715],[0.7895,-24.215,57.84,57.84,60.611,2,0.797],[0.8,-21.888,55.79,55.79,60.927,2,0.897],[0.8105,-19.366,53.572,53.572,61.248,2,1.01],[0.8211,-17.06,51.58,51.58,61.568,2,1.123],[0.8316,-15.127,49.964,49.964,61.884,2,1.231],[0.8421,-13.457,48.611,48.611,62.196,2,1.335],[0.8526,-11.793,47.255,47.255,62.5,2,1.439],[0.8632,-9.936,45.67,45.67,62.797,2,1.542],[0.8737,-7.985,43.896,43.896,63.091,2,1.644],[0.8842,-6.185,42.096,42.096,63.384,2,1.744],[0.8947,-4.778,40.42,40.42,63.677,2,1.842],[0.9053,-3.892,38.921,38.921,63.974,2,1.938],[0.9158,-3.431,37.531,37.531,64.273,2,2.027],[0.9263,-3.215,36.165,36.165,64.579,2,2.107],[0.9368,-3.142,34.774,34.774,64.893,2,2.178],[0.9474,-3.158,33.344,33.344,65.213,2,2.246],[0.9579,-3.254,31.818,31.818,65.401,2,2.314],[0.9684,-3.413,29.574,29.574,64.148,2,2.38],[0.9789,-3.608,26.362,26.362,60.587,2,2.436],[0.9895,-3.81,22.371,22.371,54.697,2,2.477],[1,-3.994,17.685,17.685,46.47,2,2.503]],"shoe":[[[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]],[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]]],[[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]],[[-15.5,6,1,1.2,2.2],[-14.14,6.9,5.22,3.91,2.2],[-12.78,7.39,6.91,4.7,2.2],[-11.42,8,7.91,5.19,2.2],[-10.06,8.36,8.36,5.47,2.2],[-8.7,8.45,8.45,5.6,2.2],[-7.34,8.48,8.48,5.68,2.2],[-5.98,8.58,8.58,5.78,2.2],[-4.62,8.7,8.7,5.88,2.2],[-3.26,8.79,8.79,5.98,2.2],[-1.9,8.79,8.79,6.08,2.2],[-0.54,8.76,8.76,6.18,2.2],[0.82,8.71,8.71,6.29,2.2],[2.18,8.66,8.61,6.39,2.2],[3.54,8.6,8.48,6.5,2.2],[4.89,8.55,8.27,6.59,2.2],[6.25,8.53,7.92,6.67,2.2],[7.61,8.52,7.49,6.74,2.2],[8.97,8.5,7.11,6.8,2.2],[10.33,8.5,6.82,6.83,2.22],[11.69,8.5,6.58,6.85,2.25],[13.05,8.47,6.36,6.87,2.28],[14.41,8.34,6.14,6.92,2.31],[15.77,8.12,5.92,6.98,2.34],[17.13,7.87,5.67,7.06,2.36],[18.49,7.63,5.43,7.16,2.39],[19.85,7.37,5.27,7.27,2.42],[21.21,7.05,5.19,7.4,2.44],[22.57,6.73,5.14,7.54,2.47],[23.93,6.42,5.1,7.69,2.5],[25.29,6.12,5.07,7.85,2.53],[26.65,5.84,5.05,8.02,2.56],[28.01,5.57,5.03,8.19,2.59],[29.37,5.34,4.99,8.34,2.6],[30.73,5.14,4.93,8.49,2.6],[32.09,4.96,4.86,8.64,2.6],[33.45,4.81,4.79,8.76,2.6],[34.81,4.68,4.68,8.85,2.6],[36.17,4.58,4.58,8.93,2.6],[37.53,4.47,4.47,8.98,2.6],[38.89,4.36,4.36,9,2.6],[40.25,4.24,4.24,8.97,2.58],[41.61,4.12,4.12,8.9,2.55],[42.96,4,4,8.8,2.52],[44.32,3.87,3.87,8.67,2.49],[45.68,3.74,3.74,8.51,2.47],[47.04,3.6,3.6,8.32,2.44],[48.4,3.46,3.46,8.1,2.41],[49.76,3.32,3.32,7.86,2.38],[51.12,3.17,3.17,7.6,2.35],[52.48,3.02,3.02,7.28,2.32],[53.84,2.86,2.85,6.89,2.29],[55.2,2.69,2.66,6.41,2.26],[56.56,2.51,2.43,5.81,2.21],[57.92,2.33,2.18,5.1,2.17],[59.28,2.13,1.86,4.17,2.11],[60.64,1.91,1.34,2.83,2.02],[62,1.75,0.45,1,2]]]],"hand":[[[[-4,0,6.5,6.5,6.17,2,0],[-3,0,6.5,6.5,6.17,2,0],[-2,0,6.5,6.5,6.17,2,0],[-1,0,6.9,6.9,6.55,2,0],[0,0,7.83,7.83,7.44,2,0],[1,0,8.61,8.61,8.17,2,0],[2,0,9.26,9.26,8.79,2,0],[3,0,9.81,9.81,9.32,2,0],[4,0,10.29,10.29,9.77,2,0],[5,0,10.69,10.69,10.15,2,0],[6,0,11.03,11.03,10.48,2,0],[7,0,11.31,11.31,10.75,2,0],[8,0,11.55,11.55,10.97,2,0],[9,0,11.73,11.73,11.14,2,0],[10,0,11.86,11.86,11.27,2,0],[11,0,11.95,11.95,11.35,2,0],[12,0,11.99,11.99,11.39,2,0],[13,0,11.99,11.99,11.39,2,0],[14,0,11.95,11.95,11.35,2,0],[15,0,11.86,11.86,11.27,2,0],[16,0,11.73,11.73,11.14,2,0],[17,0,11.55,11.55,10.97,2,0],[18,0,11.31,11.31,10.75,2,0],[19,0,11.03,11.03,10.48,2,0],[20,0,10.69,10.69,10.15,2,0],[21,0,10.29,10.29,9.77,2,0],[22,0,9.81,9.81,9.32,2,0],[23,0,9.26,9.26,8.79,2,0],[24,0,8.61,8.61,8.17,2,0],[25,0,7.83,7.83,7.44,2,0],[26,0,6.9,6.9,6.55,2,0],[27,0,5.73,5.73,5.44,2,0],[28,0,4.11,4.11,3.91,2,0],[29,0,0.3,0.3,0.28,2,0],[30,0,0.3,0.3,0.28,2,0],[31,0,0.3,0.3,0.28,2,0],[32,0,0.3,0.3,0.28,2,0]],[[-4,0,6.5,6.5,6.17,2,0],[-3,0,6.5,6.5,6.17,2,0],[-2,0,6.5,6.5,6.17,2,0],[-1,0,6.9,6.9,6.55,2,0],[0,0,7.83,7.83,7.44,2,0],[1,0,8.61,8.61,8.17,2,0],[2,0,9.26,9.26,8.79,2,0],[3,0,9.81,9.81,9.32,2,0],[4,0,10.29,10.29,9.77,2,0],[5,0,10.69,10.69,10.15,2,0],[6,0,11.03,11.03,10.48,2,0],[7,0,11.31,11.31,10.75,2,0],[8,0,11.55,11.55,10.97,2,0],[9,0,11.73,11.73,11.14,2,0],[10,0,11.86,11.86,11.27,2,0],[11,0,11.95,11.95,11.35,2,0],[12,0,11.99,11.99,11.39,2,0],[13,0,11.99,11.99,11.39,2,0],[14,0,11.95,11.95,11.35,2,0],[15,0,11.86,11.86,11.27,2,0],[16,0,11.73,11.73,11.14,2,0],[17,0,11.55,11.55,10.97,2,0],[18,0,11.31,11.31,10.75,2,0],[19,0,11.03,11.03,10.48,2,0],[20,0,10.69,10.69,10.15,2,0],[21,0,10.29,10.29,9.77,2,0],[22,0,9.81,9.81,9.32,2,0],[23,0,9.26,9.26,8.79,2,0],[24,0,8.61,8.61,8.17,2,0],[25,0,7.83,7.83,7.44,2,0],[26,0,6.9,6.9,6.55,2,0],[27,0,5.73,5.73,5.44,2,0],[28,0,4.11,4.11,3.91,2,0],[29,0,0.3,0.3,0.28,2,0],[30,0,0.3,0.3,0.28,2,0],[31,0,0.3,0.3,0.28,2,0],[32,0,0.3,0.3,0.28,2,0]]],[[[-4,0,6.5,6.5,6.17,2,0],[-3,0,6.5,6.5,6.17,2,0],[-2,0,6.5,6.5,6.17,2,0],[-1,0,6.9,6.9,6.55,2,0],[0,0,7.83,7.83,7.44,2,0],[1,0,8.61,8.61,8.17,2,0],[2,0,9.26,9.26,8.79,2,0],[3,0,9.81,9.81,9.32,2,0],[4,0,10.29,10.29,9.77,2,0],[5,0,10.69,10.69,10.15,2,0],[6,0,11.03,11.03,10.48,2,0],[7,0,11.31,11.31,10.75,2,0],[8,0,11.55,11.55,10.97,2,0],[9,0,11.73,11.73,11.14,2,0],[10,0,11.86,11.86,11.27,2,0],[11,0,11.95,11.95,11.35,2,0],[12,0,11.99,11.99,11.39,2,0],[13,0,11.99,11.99,11.39,2,0],[14,0,11.95,11.95,11.35,2,0],[15,0,11.86,11.86,11.27,2,0],[16,0,11.73,11.73,11.14,2,0],[17,0,11.55,11.55,10.97,2,0],[18,0,11.31,11.31,10.75,2,0],[19,0,11.03,11.03,10.48,2,0],[20,0,10.69,10.69,10.15,2,0],[21,0,10.29,10.29,9.77,2,0],[22,0,9.81,9.81,9.32,2,0],[23,0,9.26,9.26,8.79,2,0],[24,0,8.61,8.61,8.17,2,0],[25,0,7.83,7.83,7.44,2,0],[26,0,6.9,6.9,6.55,2,0],[27,0,5.73,5.73,5.44,2,0],[28,0,4.11,4.11,3.91,2,0],[29,0,0.3,0.3,0.28,2,0],[30,0,0.3,0.3,0.28,2,0],[31,0,0.3,0.3,0.28,2,0],[32,0,0.3,0.3,0.28,2,0]],[[-4,0,6.5,6.5,6.17,2,0],[-3,0,6.5,6.5,6.17,2,0],[-2,0,6.5,6.5,6.17,2,0],[-1,0,6.9,6.9,6.55,2,0],[0,0,7.83,7.83,7.44,2,0],[1,0,8.61,8.61,8.17,2,0],[2,0,9.26,9.26,8.79,2,0],[3,0,9.81,9.81,9.32,2,0],[4,0,10.29,10.29,9.77,2,0],[5,0,10.69,10.69,10.15,2,0],[6,0,11.03,11.03,10.48,2,0],[7,0,11.31,11.31,10.75,2,0],[8,0,11.55,11.55,10.97,2,0],[9,0,11.73,11.73,11.14,2,0],[10,0,11.86,11.86,11.27,2,0],[11,0,11.95,11.95,11.35,2,0],[12,0,11.99,11.99,11.39,2,0],[13,0,11.99,11.99,11.39,2,0],[14,0,11.95,11.95,11.35,2,0],[15,0,11.86,11.86,11.27,2,0],[16,0,11.73,11.73,11.14,2,0],[17,0,11.55,11.55,10.97,2,0],[18,0,11.31,11.31,10.75,2,0],[19,0,11.03,11.03,10.48,2,0],[20,0,10.69,10.69,10.15,2,0],[21,0,10.29,10.29,9.77,2,0],[22,0,9.81,9.81,9.32,2,0],[23,0,9.26,9.26,8.79,2,0],[24,0,8.61,8.61,8.17,2,0],[25,0,7.83,7.83,7.44,2,0],[26,0,6.9,6.9,6.55,2,0],[27,0,5.73,5.73,5.44,2,0],[28,0,4.11,4.11,3.91,2,0],[29,0,0.3,0.3,0.28,2,0],[30,0,0.3,0.3,0.28,2,0],[31,0,0.3,0.3,0.28,2,0],[32,0,0.3,0.3,0.28,2,0]]]]};
  A.limbs = {"leg":{"walk":[[5.78,24.2,5.78,24.2,5.78,24.2,6.1,24.2,7.28,24.2,8.78,24.2,9.16,24.2,8.28,24.19,6.85,23.51,4.97,21.03,2.94,18.06,1.32,16.31,-0.02,15.55,-1.19,15.21,-1.67,15.21,-1.29,15.41,-0.26,15.4,1.27,14.78,3.26,13.57,5.59,12.18,8.14,11.03,11.02,10.65,14.27,7.6,17.09,7,18.86,6.6],[-15.53,16.98,-15.85,16.98,-16.42,16.98,-15.15,16.98,-7.44,16.98,4.97,16.98,13.45,16.98,15.59,16.98,15.55,16.95,15.24,16.87,13.98,16.77,11.19,16.59,7.47,16.24,4.37,15.89,2.72,15.57,2.19,14.85,2.24,13.58,2.54,12.11,2.94,10.86,3.41,10.13,3.97,8.71,4.81,8.51,6.13,7.6,7.63,7,8.89,6.6]],"front":[[-20.33,15.1,-11.2,15.1,-6.63,15.1,-5.72,15.1,-5.72,15.1,-5.72,15.1,-5.72,15.1,-5.72,15.1,-5.72,15.1,-5.73,15.03,-5.76,14.7,-5.65,14.12,-5.11,13.68,-4.15,13.7,-3.21,14.01,-2.66,14.16,-2.47,13.9,-2.5,13.11,-2.64,11.92,-2.85,10.63,-3.1,9.53,-3.51,9.11,-2.06,7,-3.06,6.5,-4.51,6.1],[17.18,15.25,11.98,15.25,4.69,15.25,-0.53,15.25,-1.87,15.25,-1.87,15.25,-1.87,15.25,-0.51,15.25,3.58,15.25,6.32,15.15,3.68,14.74,-0.39,14.1,-2.01,13.71,-2.54,13.77,-3.06,14.07,-3.37,14.2,-3.46,13.9,-3.33,13.06,-3.03,11.87,-2.65,10.61,-2.2,9.51,-1.6,9.1,-0.14,7,1.08,6.5,2.9,6.1]],"run":[[16.15,27.1,16.17,27.1,16.26,27.09,16.55,26.99,17.2,26.61,18.08,25.73,18.46,24.46,17.13,23.23,13.15,22.33,6.69,21.52,-0.82,20.49,-7.56,19.32,-12.37,18.31,-15.08,17.52,-16.17,16.82,-16.19,16.07,-15.52,15.01,-14.37,13.64,-12.86,12.25,-11.04,11.23,-8.95,10.99,-6.7,9.4,-4.47,8,-2.42,7.4,-0.54,7],[18.43,19.09,20.93,19.09,22.37,19.09,21.93,19.09,19.5,19.09,15.95,19.09,12.79,19.09,11.28,19.04,11.75,18.88,13.38,18.52,14.77,17.93,14.79,17.21,13.28,16.54,10.98,16.01,8.86,15.54,7.51,14.94,6.94,13.95,6.91,12.61,7.18,11.22,7.65,10.15,8.37,9.73,9.48,8.32,10.98,8,12.72,7.4,14.52,7]]},"arm":{"walk":[[3.78,8.54,8.11,8.54,13.18,8.54,16.2,8.54,16.18,8.54,14.39,8.54,10.96,8.54,6.87,8.54,4.38,8.54,3.84,8.54,4,8.54,4.14,8.54,4.17,8.54,4.27,8.54,4.4,8.54,4.36,8.54,4.16,8.54,3.94,8.54,3.84,8.51,3.99,8.38,4.4,8.11,4.88,7.84,5.15,7.88,5.19,8.43,5.2,9.44],[-7.02,10.55,-11.54,10.55,-12.67,10.55,-11.35,10.55,-9.98,10.55,-9.21,10.55,-8.71,10.55,-8.22,10.55,-7.7,10.52,-7.23,10.37,-6.9,10.09,-6.69,9.89,-6.48,9.93,-6.3,10.12,-6.24,10.27,-6.31,10.23,-6.45,9.98,-6.61,9.57,-6.74,9.09,-6.81,8.65,-6.79,8.32,-6.68,8.14,-6.62,8.16,-6.79,8.55,-7.25,9.35]],"front":[[-7.75,10.39,-7.59,10.39,-6.44,10.39,-4.51,10.39,-3.01,10.38,-2.36,10.31,-2.08,10.16,-1.89,9.95,-1.75,9.73,-1.64,9.64,-1.54,9.74,-1.45,9.91,-1.44,9.95,-1.61,9.8,-1.95,9.51,-2.38,9.11,-2.83,8.6,-3.32,8.03,-3.86,7.45,-4.43,6.92,-4.95,6.6,-5.31,6.81,-5.41,7.72,-5.4,9.08,-5.46,10.41],[5.9,10.81,5.98,10.81,5.59,10.81,4.17,10.8,2.14,10.74,0.68,10.59,0.04,10.35,-0.32,10.06,-0.67,9.8,-1.01,9.64,-1.32,9.67,-1.54,9.85,-1.66,10.03,-1.67,10.04,-1.57,9.87,-1.36,9.53,-1.08,9.08,-0.79,8.62,-0.55,8.17,-0.33,7.74,-0.11,7.3,0.14,6.84,0.4,6.38,0.59,6.02,0.69,5.81]],"run":[[3.81,12.6,4.29,12.35,4.68,12.1,4.93,11.85,5.21,11.6,5.91,11.35,7.45,11.1,9.93,10.85,13.02,10.61,16.03,10.41,18.21,10.45,19.1,10.83,18.73,10.97,17.43,10.17,15.62,9.05,13.61,8.3,11.57,7.99,9.63,7.88,7.81,7.76,6.17,7.54,4.8,7.26,3.87,6.97,3.4,6.68,3.19,6.39,3.04,6.1],[-8.4,12.6,-11.75,12.35,-14.86,12.1,-17.58,11.85,-19.78,11.6,-21.29,11.35,-22.05,11.1,-22.18,10.85,-21.96,10.61,-21.65,10.41,-21.44,10.45,-21.52,10.83,-21.98,10.97,-22.75,10.17,-23.57,9.05,-24.17,8.3,-24.47,7.99,-24.55,7.88,-24.29,7.76,-23.22,7.54,-21.01,7.26,-18.4,6.97,-16.59,6.68,-15.97,6.39,-15.99,6.1]]}};
  A.pony = {"n":21,"side":{"f":[-50.12,-49.71,-52.8,-55.95,-58.49,-58.84,-57.87,-56.8,-56.53,-56.24,-54.66,-53.81,-54.15,-53.44,-53.35,-54.08,-55.92,-56.42,-55.85,-55.42,-53.15],"u":[32.22,27.51,21.38,15.28,8.78,1.55,-5.63,-12.8,-20.08,-27.35,-34.36,-41.53,-48.8,-56.04,-63.33,-70.53,-77.44,-84.64,-91.89,-99.14,-105.81],"H":[4.59,9.61,11.4,8.98,10.34,11.31,12.24,14.73,16.33,16.11,14.61,15.28,14.33,11.11,10.88,9.51,7.93,6.44,4.01,3.58,2.62]},"front":{"c":[44.64,58.59,60.45,61.9,63.25,64.32,65,65.45,65.72,65.4,63.99,62.3,60.77,59.01,56.45,53.27,49.88,47.67,48.51,50.43,51.58],"u":[41.87,39.68,35.46,31.12,26.76,22.35,17.87,13.38,8.87,4.37,0.03,-4.24,-8.55,-12.8,-16.74,-20.32,-23.77,-27.82,-32.21,-36.41,-40.81],"H":[9.76,10.54,11.39,12.21,13.5,14.79,15.58,16.07,16.38,15.79,13.95,12.81,12.36,12.01,11.46,10.96,11.46,12.29,8.58,5.87,4.73]},"run":{"f":[-59.15,-64.57,-69.59,-73.61,-77.55,-81.96,-86.54,-91.11,-95.63,-100.11,-105.01,-110.18,-114.77,-118.91,-123.12,-127.58,-131.77,-135.71,-140.02,-145.05,-150.35],"c":[44.64,58.59,60.45,61.9,63.25,64.32,65,65.45,65.72,65.4,63.99,62.3,60.77,59.01,56.45,53.27,49.88,47.67,48.51,50.43,51.58],"u":[29.42,24.28,22.52,18.11,13.57,9.79,6.36,2.9,-0.66,-4.3,-6.82,-8.32,-11.69,-15.94,-20.07,-23.76,-27.91,-32.46,-36.39,-38.42,-38.11],"H":[8.59,8.55,10.86,13.59,17.81,22.15,23.42,24.93,24.25,24.82,27.77,24.66,18.61,16.2,15.21,14.33,11.46,8.99,9.39,9.29,5.89]}};
  A.traceInfo = { kFront: 1.1746, kSide: 0.5177, kRun: 0.8159 };
  A.rebuild();
})();


/* ===== girl_a_tuned.js ===== */
/* girl_a_tuned.js -- fitted configuration overrides (gait / proportions / hair design); loaded after girl_a.js and girl_c2_trace.js. */
(function () {
  'use strict';
  var A = GA.girlA, k;
  var cfg = {"stride":348.6617,"strideRun":375,"hipRest":241,"hipW":17,"L1":111,"L2":110,"legReach":0.999,"ankleZ":21,"waistH":292,"shoulderH":350,"neckBaseH":372,"neckTopH":402,"shoulderC":38,"armU":71.0369,"armF":70,"ele":0.15,"headPivot":[-7,0,-41.5],"suSide":0.78,"suFront":1.165,"crown":506.9375,"rho":0.6116,"q1":0.1607,"q2":0.334,"bhs":13.4124,"bto":37.0001,"heelS":-15,"ballS":35,"lift":10.0547,"idleStance":20.5148,"walkStance":18.5,"toeIdle":26,"toeWalk":5,"stanceL":5.75,"stanceR":-2,"toeL":-2.9828,"toeR":-2.2667,"pelvisIdle":249.1198,"bob":4.0328,"walkAlpha0":-2.0152,"walkXoff":-9.6349,"walkLean":-3.2164,"walkYaw":11.3216,"armBetaL":22,"armBetaR":20.5,"armAlphaL":2,"armAlphaR":7,"armGammaL":30.5,"armGammaR":36,"swingFwd":22.4671,"swingBack":25.0136,"gammaWalk0":6.9459,"gammaWalk1":7.816,"runRho":0.36,"runQ1":0.05,"runQ2":0.2,"runLift":52,"runLean":17,"runPelvis":233,"runBob":15,"runArmFwd":52,"runArmBack":-40,"runGammaFwd":95,"runGammaBack":72,"sleeve":[13.5,14.5,0.51],"handScale":1.2562,"ringHead":64,"ringTrunk":48,"ringShoe":24,"fair":{"head":0.9,"trunk":1.4,"shoe":1,"hand":0.7},"legKeysF":[[0,18.9884],[0.2,18.5973],[0.38,17.404],[0.5,14.8642],[0.6,13.7595],[0.72,14.1784],[0.88,11.2208],[1,9.9248]],"armKeysF":[[0,12.8],[0.3,11.6],[0.5,10.6],[0.7,9.5],[0.85,8.4],[1,7.4]],"handScaleF":0.9375};
  for (k in cfg) A.cfg[k] = cfg[k];
  // ---- run (scurry) pose fitted to ref1 at the key phase (trace/fit_run.mjs): keep in sync with the traced run tables
  var run = {"runKeyed":true,"runPelvis":215.682,"runBob":26,"runXoff":28.005,"runPelvisF":-0.87,"runKick":[-210.406,124.126,-103.263],"runLean":22.489,"runBendH":32.731,"runHead":31.203,"runCrownK":32.716,"runWaistK":6.157,"runNeckK":0.307,"runLegK":0.037,"runArmK":0.03,"runArmA":[9.228,112.032],"runArmB":[-48.672,17.805],"runShoulderBack":47.818,"runShoulderFwd":12.923,"runPelvisPitch":-7.476,"runHemF":6,"runHemTilt":0,"runHemLift":1,"runSpread":0.1,"runTilt":[0,2,5,9],"runShift":[0,0,0]};
  for (k in run) A.cfg[k] = run[k];
  // ---- CHEERFUL WALK STYLE (user request: "a cheerful happy smooth walk"): springy double bounce, hip sway + counter-rotating shoulders, bigger relaxed arm swing with soft elbows and loose hands,
  //      head nod / tilt, toe push-off and a soft heel strike, longer smoother strides.  stride is also what the timeline uses for the foot contact (girl.STRIDE).
  var walkStyle = {"stride":372,"walkDrop":0,"bob":5.5,"bobH2":0.05,"bobH2ph":0.7,"bobPh":0.27,"hipSway":4,"walkYaw":10,"shoulderCounter":1.9,"swingFwd":29,"swingBack":29,"gammaWalk0":8,"gammaWalk1":28,"handLag":0.42,"headNod":3.4,"headTilt":0.14,"lift":17,"bhs":15,"bto":38,"q1":0.19,"q2":0.31,"walkLean":-2.2,"hemBounce":3.4,"swingTan":1,"swingTan1":1,"liftSkew":0.35};
  for (k in walkStyle) A.cfg[k] = walkStyle[k];
  // ---- GRACEFUL WALK (round 10, GAIT): long easy stride (380 u per cycle, 2.1 steps/s at V_WALK 400), biomechanical stance (heel strike toes-up 18 deg, flat by 11 %, heel rise
  //      from 36 %, toe-off at 46 deg), stance knee by the knee-target solve (girl_a.js C.kneeK), pointed swing foot with the keyed world-frame swing (C.swE/swZ/swB), upright
  //      torso (no lean), long relaxed arm swing with a SOFT elbow (9 + 9 deg), toe-out ~10 deg standing.  Bare feet: girl_c2_trace.js D.shoe (R10/gait/foot.mjs).
  var walkGrace = {"stride":380,"walkXoff":0,"hsF":73,"rho":0.6,"q1":0.11,"q2":0.36,"bhs":18,"bto":46,"lift":31,"walkLean":0,"walkStance":17,"toeWalk":6,"toeIdle":10,"toeL":-1,"toeR":-1,
    "hipSway":4.6,"walkYaw":11,"shoulderCounter":1.8,"swingFwd":24,"swingBack":26,"gammaWalk0":9,"gammaWalk1":9,"handLag":0.25,"kneeSoft":0,"pelvisSmooth":20,"legReach":1.0};
  for (k in walkGrace) A.cfg[k] = walkGrace[k];
  // ---- ELEGANT CARTOON RUN (round 10, GAIT; replaces the fitted scurry crouch): stride 620 (3 steps/s at V_RUN 940), stance 34 % (flight 32 %), ball-of-foot landing, heel kicked
  //      up to hip height behind, knee driving through high, bouncy pelvis (226 at mid-stance -> 257 in flight), torso lean ~17-20 deg from the hips, head LEVEL, arms pumping at ~90 deg.
  var runGrace = {"strideRun":580,"runRho":0.325,"runQ1":0.06,"runQ2":0.16,"runXoff":0,"runHsF":75,"runBhs":-12,"runPelvis":240,"runBob":14,
    "runBobK":[[0,-0.65],[0.3,-0.2],[0.65,-0.3],[0.78,0.7],[0.86,1.15],[0.95,0.1]],"runLean":17,"runLeanDeg":14,"runLean0":0.4,"runBendH":45,"runHead":3,"runHeadLevel":1,"runPelvisPitch":-4,
    "runArmA":[44,95],"runArmB":[-40,85],"runShoulderBack":20,"runShoulderFwd":8,"runHemLift":1.2,"runLegK":0.02};
  for (k in runGrace) A.cfg[k] = runGrace[k];

  // ---- WALK STYLE PRESETS (runtime switch: landingGirlAnimation.scene.girl.setWalkPreset('A'|'B'|'C'|'current'); the stride (372) and the foot contact are the same in all of them)
  //   current = the R8 values; A = 'tall glide' (upright, long extended legs, minimal bob, long relaxed arm swing); B = 'light and lifted' (chest lifted, buoyant push-off bounce, quicker toe-off, soft arms);
  //   C = 'poised flow' (A + visible hip sway, a lagging trailing hem, a floating head, a slightly longer swing arc)
  var WP_BASE = {"walkDrop":0,"bob":5.5,"bobH2":0.05,"bobH2ph":0.7,"bobPh":0.27,"hipSway":4,"walkYaw":10,"shoulderCounter":1.9,"swingFwd":29,"swingBack":29,"gammaWalk0":8,"gammaWalk1":28,"handLag":0.42,"headNod":3.4,"headTilt":0.14,"lift":17,"bhs":15,"bto":38,"q1":0.19,"q2":0.31,"walkLean":-2.2,"hemBounce":3.4,"liftSkew":0.35,
    "kneeSoft":0.008,"walkChest":2.4,"headBob":2.6,"pelvTilt":3,"hemFlutter":1.8,"hemTiltA":7.5,"shLag":0.07,"armLag":0.035,"foreLag":0.11,"headLag":0.15,"spineAmp":3.4,"spineLag":0.1,"asym":1};
  function wpMake(o) { var r = {}, q; for (q in WP_BASE) r[q] = WP_BASE[q]; for (q in o) r[q] = o[q]; return r; }
  var tallA = {"kneeSoft":0,"bob":2.6,"bobH2":0.02,"hipSway":3.2,"walkYaw":9,"shoulderCounter":1.8,"swingFwd":21,"swingBack":31,"gammaWalk0":10,"gammaWalk1":8,"handLag":0.25,"headNod":0.6,"headTilt":0.06,"headBob":0.7,"headLag":0.12,"walkLean":0,"spineAmp":1.6,"walkChest":1.2,"pelvTilt":1.5,"lift":20,"hemFlutter":1.2,"hemTiltA":5.5,"hemBounce":2.4,"foreLag":0.1,"armLag":0.03,"shLag":0.06,"asym":0.7};
  A.walkPresets = {
    current: wpMake({}),
    A: wpMake(tallA),
    B: wpMake({"kneeSoft":0,"bob":5,"bobH2":0.14,"hipSway":3.4,"walkYaw":9,"swingFwd":22,"swingBack":28,"gammaWalk0":10,"gammaWalk1":10,"handLag":0.3,"headNod":0.5,"headTilt":0.07,"headBob":1.1,"headLag":0.12,"walkLean":0,"spineAmp":1.4,"walkChest":3.4,"pelvTilt":1.8,"lift":22,"bto":44,"liftSkew":0.4,"q1":0.17,"hemFlutter":2,"hemTiltA":6.5,"hemBounce":3,"foreLag":0.1,"armLag":0.03,"shLag":0.06,"asym":0.8}),
    C: wpMake((function () { var o = {}, q; for (q in tallA) o[q] = tallA[q]; o.hipSway = 5.2; o.walkYaw = 12; o.shoulderCounter = 1.8; o.swingFwd = 28; o.swingBack = 28; o.gammaWalk0 = 11; o.gammaWalk1 = 14; o.walkDrop = 3; o.headBob = 1.8; o.headLag = 0.18; o.hemTiltA = 9; o.hemFlutter = 3.2; o.hemBounce = 3.6; o.lift = 21; o.spineAmp = 2.4; o.walkChest = 1.6; o.pelvTilt = 2.2; o.handLag = 0.35; o.asym = 0.9; return o; })())
  };
  A.walkPreset = 'current';
  A.setWalkPreset = function (n) { var p = A.walkPresets[n], q; if (!p) return false; for (q in p) A.cfg[q] = p[q]; for (q in walkGrace) if (q in p && n !== 'current') A.cfg[q] = p[q]; else if (n === 'current') A.cfg[q] = walkGrace[q]; A.walkPreset = n; if (A.touch) A.touch(); return true; };
  // round 10: the graceful walk (walkGrace above) is the default; the R9 presets A/B/C stay selectable for comparison only (they override some of its keys)
  A.walkPresets.current = (function () { var o = wpMake({}), q; for (q in walkGrace) o[q] = walkGrace[q]; return o; })();
  A.setWalkPreset('current');
  var hc = {"tieU":27,"tiePhi":2.4,"sprout":[-0.2,0.635,0.74],"lockN":8,"lockLen":1.03,"lockW":1.5,"lamK":0.59,"waveK":1,"curlK":1.1,"back":0.16,"backMed":0.21,"bTo":0.36,"medLen":0.9,"fineN":26,"fineLen":0.9,"looseLen":1,"lenSide":0.97,"lenFront":0.87,"widSide":1.07,"widFront":1.45,"runWind":120,"core":1,"coreT0":0.575,"coreT1":0.885,"rootW":7,"ribT0":0.4,"ribT1":0.58};
  for (k in hc) A.hairCfg[k] = hc[k];
  A.rebuild();
})();


/* ===== fx.js ===== */
/* GA.fx - effects: 3D black cubes, dots, burst, comic ball (+ cancel / pop), non-textual impact burst, soft shadow, dust specks.
   Classic script (IIFE on window.__landingGirl). Everything is a pure function of time t (seconds), deterministic, allocation-free in the hot paths.
   Colours are never hard-coded: ink = GA.style.INK (cubes, ball, dots, impact ticks, shadow + specks as ink at low alpha), paper = GA.style.PAPER (ball seams),
   greys = GA.style.GRAY1-2; they are read at every draw call, so the page theme may change at any time (canvas is transparent: nothing is ever filled white).

   ROUND 4: THE BALL IS AN EXACT PARABOLA.  Flight = constant horizontal speed + constant gravity (y(x) is a true quadratic, y(t) too): it enters just beyond the LEFT edge (entryX -80,
   entryY 400 = chest height), apex clearly inside the band (y ~ 56 on the 16:4.5 band, ~107 on the 16:8 band), falls onto her head at descentDeg (20) exactly at tHit, flight = 1.55 s (= the
   ballIn cue).  After the squash it leaves on a second, lower parabola (constant vx2 = 1000, apex exitApexY 86) through the RIGHT edge.  Closed form, no tables.  Speed lines are 3 short
   needles exactly along the tangent, they shorten / fade so that no screen edge ever cuts one; the ground shadow fades before it reaches either edge.  build() keys: entryX, entryY, descentDeg,
   flight, exitApexY, spin (+ the old ones: W,H,tHit,target,radius,headAt).  ball.info = {tStart,tHit,tRelease,tGone,apex:{x,y,t},bounceApex,impactVy,impactSpeed,descentDeg,entry,vx,gravity,k,...}.

   ROUND 3 (QA): ball motion stretch capped at an axis ratio of ~1.22 (1.25 in the whoosh), the seam is two subtle felt lines (no fat crescent), a faint ground shadow shrinks / fades with
   the ball's height during the lob, GA.fx.ball.build({... headAt: function(t){ return {x,y}; }}) = head-top probe so the squash disc rides the ducking head (without it the disc stays at the
   hit position while the head dips ~80 units and shifts ~40 right within 0.09 s of the hit).  GA.fx.rescale() = no-op (no pixel-ratio dependent cache).  GA.fx.warmGPU(ctx, step, rect):
   3 steps (<1 ms), invisible draws of every distinct draw state; true after step 2.

   API (SPEC 4.4 + UPDATE v2; extras marked +):
     GA.fx.gravity = 2400                                   world units / s^2 (used by cubes + dots)
     GA.fx.cubes.reset()  .spawn({x,y,size,t0,vx,vy,spin:[wx,wy,wz],rot0:[rx,ry,rz],z:-1..1,hover:s, +drag, +drift}) -> te   .draw(ctx,t,layer)  .count()  +.clearFrom(t)
          size = edge length in world units (3..30 typical, a few up to ~40). layer 'back' (z<0) | 'front' (z>=0); no layer = both (back first).
          Motion is closed form: for tau=t-t0 < hover the initial velocity is damped by exponential drag (k = drag || 3/hover), gravity is ramped in
          smoothly and the cube drifts/wobbles a little ("hangs and tumbles"); afterwards it is ballistic with GA.fx.gravity. Cubes never rest:
          they leave through the bottom edge and are skipped. Orientation = rot0 + spin*tau (Euler X,Y,Z), orthographic projection of the 3 visible faces.
          spawn() is cheap (typed arrays, pools pre-allocated for ~3000 particles, no per-call allocation): ~1500 cubes cost well under 1 ms. t0 may be in the future
          (the particle is simply not drawn before t0) and spawn() returns te = the time after which the particle is certainly below the bottom of the stage.
          reset() empties the pool completely.  +clearFrom(t) removes EVERY particle whose t0 >= t (discard not-yet-visible spawns), returns how many were removed.
     GA.fx.dots.reset() .spawn({x,y,r,t0,vx,vy,kind:'dot'|'ring'|'square'|'tick',z, +hover,+drag,+rot,+spin,+tone:0|1|2}) -> te  .draw(ctx,t,layer) .count()  +.clearFrom(t)
     GA.fx.burst({x,y,t0,count, +dots,+spread,+speed,+lift,+seed,+sizeMin,+sizeMax,+hover,+z})   random cubes+dots flying outward from (x,y)
     GA.fx.ball.build({W,H,tHit,target:{x,y},radius (minimum 44), +flight,+gravityDown,+gravityUp,+bounceRise,+exitTime,+exitY}) .draw(ctx,t[,dy]) .state(t[,dy]) .arc(t) .hint() (no-op) .reset() .drawPose(...)
          THE LOB: radius >= 54 (opaque INK, clear tennis seam). Enters at the UPPER-LEFT edge (y~250), rises on a floaty arc (gravity 420) to an apex at y~34 (ball top at the top of the solid band),
          brakes and hangs ~0.3 s above-left of her, then is slammed down (gravity 7000, a real parabola, ~65 degrees, >= 1100 u/s) onto the head top exactly at tHit; velocity-aligned stretch + speed needles.
          After the squash: a clear 0.5 s boing (apex y~30, inside the solid band), anticipation squash, whoosh over to the RIGHT, leaving through the right edge at y~520, with a crisp paper rim so it reads
          over the black cubes. The forward dashed path guide is gone.  GA.fx.gravity is 3000 (cubes cross the tall canvas quickly and visibly leave). ball.info: {tStart, tHit,
          tRelease, tGone, apex, bounceApex, impactVy, impactSpeed}. Culling uses GA.stage.visTop / visBottom (+40), never the band edges.
          dy (optional) = how far the head top has been pushed down (world units) by the director's squash: while the ball is pressed on the head it follows it.
          state(t[,dy]) -> {x,y,rot,sx,sy,sa,squash,visible,phase:'fly'|'hit'|'bounce'|'gone', +vx,+vy}  (x,y = ball centre; draw() applies translate(x,y) rotate(sa)
          scale(sx,sy); sa is 0 except while the ball is stretched along a diagonal; squash 0..1 peaks at the bonk. The ball touches the head exactly at tHit.)
          ball.info -> {tStart,tHit,tRelease,tGone,apex:{x,y},...} after build (for the director).
          +cancel(t)   the ball disappears from time t on (draw() skips it and its dashed hint, state(t>=cancel) -> visible:false, phase:'gone'); earliest call wins; build() clears it.
          +mark() / rollback(mark) exist on cubes and dots (undo of everything spawned since mark(); used for silent JIT warm-ups, not needed by the director).
          +pop(t[,dy]) cancel(t) + the ball bursts: ~20 small black cubes (3 chunky) and ~44 dots + ticks are spawned at the ball's position at time t (GA.fx.cubes/dots.spawn, so the ball
                       visibly shatters together with the thoughts). Returns true if something was spawned (ball visible at t). Ignored if the ball is already gone.
          state(t) stays a pure function of (t, cancel time).
     GA.fx.ow.build({t0,x,y,dir, ticks:true, +size,+seed}) .draw(ctx,t) .cancel()      NO TEXT any more: only a small impact burst, ~0.4 s, a handful (7) of short tapered ink
          ticks (+ 3 tiny dots) fanning out above (x,y) = the impact point (top of head); dir (-1/+1) leans the fan a little to that side. ticks:false => nothing is drawn.
          cancel() removes it at once.
     GA.fx.shadow(ctx,{x,y,w,h,alpha})                           w,h = full width/height of the soft ellipse (ink at low alpha)
     GA.fx.specks.build({W,H,seed=11,+groundY}) .draw(ctx)       barely-there dust specks (ink at 9-28 % alpha) from just above the feet line down into the faded lower margin; draw() auto-builds with the same defaults, so building later changes nothing
     GA.fx.stats                                                 {cubesDrawn, dotsDrawn} of the last draw calls (debug) */
(function () {
  'use strict';
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util;
  var ST = GA.style;
  var TAU = Math.PI * 2;
  var PI = Math.PI;
  var FX = (GA.fx = GA.fx || {});
  FX.gravity = 3000;
  FX.stats = { cubesDrawn: 0, dotsDrawn: 0 };

  /* ------------------------------------------------------------------ helpers */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp01(t); var u = 1 - t; return 1 - u * u * u; }
  function easeOutQuad(t) { t = clamp01(t); return 1 - (1 - t) * (1 - t); }
  function easeInOutQuad(t) { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeInOutSine(t) { t = clamp01(t); return -(Math.cos(PI * t) - 1) / 2; }
  /** deterministic hash -> [0,1) (used for per-particle defaults so spawn order alone defines the look) */
  function hash01(n) {
    n = (n | 0) + 0x9e3779b9;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  /** '#rgb' | '#rrggbb' | 'rgb(...)' | 'rgba(...)' -> [r,g,b,a] or null */
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
  /** ink (GA.style.INK) as 'rgba(r,g,b,a)' (cached per ink colour and alpha, so animated alphas never allocate for long) */
  var inkCache = { src: null, c: [21, 20, 18, 1], map: {}, n: 0 };
  function inkA(a) {
    var src = ST.INK;
    if (src !== inkCache.src) { inkCache.src = src; inkCache.c = parseCol(src) || [21, 20, 18, 1]; inkCache.map = {}; inkCache.n = 0; }
    var key = a.toFixed(4), v = inkCache.map[key];
    if (!v) {
      if (inkCache.n > 120) { inkCache.map = {}; inkCache.n = 0; }
      var c = inkCache.c;
      v = inkCache.map[key] = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * c[3]).toFixed(4) + ')';
      inkCache.n++;
    }
    return v;
  }
  /** cube face tones: ink lifted a hair towards paper (mid face 5 %, lightest face 15 %) - cached per (ink, paper) */
  var toneCache = { ink: null, paper: null, l1: '', l2: '' };
  function cubeTones() {
    if (toneCache.ink !== ST.INK || toneCache.paper !== ST.PAPER) {
      toneCache.ink = ST.INK; toneCache.paper = ST.PAPER;
      var a = parseCol(ST.INK) || [21, 20, 18, 1], b = parseCol(ST.PAPER) || [250, 248, 243, 1];
      var mix = function (k) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')'; };
      toneCache.l1 = mix(0.05); toneCache.l2 = mix(0.15);
    }
    return toneCache;
  }
  var cubeUid = 1, dotUid = 1;   // per-pool spawn counters (reset with the pool) so default random attributes are reproducible after a rebuild

  /** visible world bounds for culling (handles the letterboxed portrait case) */
  var VIS = { xMax: 2813, yMax: 820, yMin: -40 };
  /** cull bounds = the visible world range of the canvas (+40): GA.stage.visTop / visBottom (band 0..H extended by the faded canvas margins) */
  function updateVisible() {
    var S = GA.stage || {};
    VIS.xMax = (S.W || 2773) + 40;
    VIS.yMax = (S.visBottom !== undefined ? S.visBottom : (S.H || 780)) + 40;
    VIS.yMin = (S.visTop !== undefined ? S.visTop : 0) - 40;
    return S.px || 1;
  }
  /** world y below which a particle is out of sight for good (bottom of the visible canvas + margin): nothing ever rests on an invisible floor */
  function bottomLimit(size) {
    var S = GA.stage || {};
    return (S.visBottom !== undefined ? S.visBottom : (S.H || 780)) + 40 + 2 * size;
  }

  /* ------------------------------------------------------------------ particle pools (struct of arrays) */
  var KIN = ['x0', 'y0', 't0', 'vx', 'vy', 'hv', 'kd', 'dh', 'mh', 'wa', 'ww', 'wp', 'te'];
  function makePool(extra) {
    var names = KIN.concat(extra);
    var p = { n: 0, cap: 0, a: {}, names: names };
    for (var i = 0; i < names.length; i++) p.a[names[i]] = new Float64Array(0);
    return p;
  }
  var POOL_CAP = 1536;   // pre-allocated particles per layer pool: a full-scene dissolve (~1500 cubes + ~1000 dots) never has to grow arrays at runtime
  function growPool(p, need) {
    if (need <= p.cap) return;
    var cap = Math.max(POOL_CAP, p.cap * 2, need);
    for (var i = 0; i < p.names.length; i++) {
      var nm = p.names[i], na = new Float64Array(cap);
      na.set(p.a[nm]);
      p.a[nm] = na;
    }
    p.cap = cap;
  }
  /** removes every particle with t0 >= t (order of the others is kept); returns how many were removed */
  function clearPoolFrom(p, t) {
    var A = p.a, names = p.names, T0 = A.t0, n = p.n, w = 0, i, k;
    for (i = 0; i < n; i++) {
      if (T0[i] >= t) continue;
      if (w !== i) for (k = 0; k < names.length; k++) A[names[k]][w] = A[names[k]][i];
      w++;
    }
    p.n = w;
    return n - w;
  }
  /** fill the shared kinematic fields. Closed-form motion (see kin()). Returns te. */
  function setKin(A, i, o, size, seed) {
    var h = o.hover > 0 ? o.hover : 0;
    var k = o.drag > 0 ? o.drag : h > 0 ? 3 / h : 1;
    var vx = o.vx || 0, vy = o.vy || 0, y0 = o.y, t0 = o.t0 || 0;
    var mh = Math.exp(-k * h), dh = h > 0 ? (1 - mh) / k : 0;
    A.x0[i] = o.x; A.y0[i] = y0; A.t0[i] = t0; A.vx[i] = vx; A.vy[i] = vy;
    A.hv[i] = h; A.kd[i] = k; A.mh[i] = mh; A.dh[i] = dh;
    A.wa[i] = h > 0 ? (o.drift !== undefined ? o.drift : 2.5 + size * 0.3) : 0;
    A.ww[i] = 8 + 9 * hash01(seed * 3 + 1);
    A.wp[i] = TAU * hash01(seed * 3 + 2);
    // time after which the particle is below the visible area for good (exact closed form of kin(): hover phase integral + ballistic fall)
    var gg = FX.gravity, lim = bottomLimit(size);
    var ys = y0 + vy * dh + gg * 0.15 * h * h, b = vy * mh + 0.5 * gg * h, c = ys - lim;
    var te;
    if (c >= 0) te = t0 + h;
    else te = t0 + h + Math.max(0, (-b + Math.sqrt(b * b - 2 * gg * c)) / gg) + 0.05;
    A.te[i] = te;
    return te;
  }
  var _x = 0, _y = 0;
  /** position at tau = t - t0 >= 0 -> (_x,_y). hover phase: drag-damped launch velocity, smoothstep-ramped gravity, soft drift. then ballistic. */
  function kin(A, i, tau, g) {
    var h = A.hv[i], D, P, wx = 0, wy = 0;
    if (tau < h) {
      var u = tau / h, u2 = u * u, u4 = u2 * u2;
      D = (1 - Math.exp(-A.kd[i] * tau)) / A.kd[i];
      P = h * h * (u4 * 0.25 - u4 * u * 0.1); // integral of the smoothstep gravity ramp (twice)
      var e = Math.sin(PI * u); e *= e;
      var amp = A.wa[i] * e, ph = A.ww[i] * tau + A.wp[i];
      wx = amp * Math.sin(ph); wy = amp * 0.7 * Math.cos(ph * 0.83 + 1.3);
    } else {
      var d = tau - h;
      D = A.dh[i] + A.mh[i] * d;
      P = 0.15 * h * h + d * (0.5 * h + 0.5 * d);
    }
    _x = A.x0[i] + A.vx[i] * D + wx;
    _y = A.y0[i] + A.vy[i] * D + g * P + wy;
  }

  /* ------------------------------------------------------------------ CUBES */
  var cubePool = [makePool(['sz', 'wx', 'wy', 'wz', 'rx', 'ry', 'rz']), makePool(['sz', 'wx', 'wy', 'wz', 'rx', 'ry', 'rz'])]; // [back, front]
  var cubeBuf = { hex: new Float32Array(0), f1: new Float32Array(0), f2: new Float32Array(0), cap: 0 };
  // light from upper-left-front (y is down => negative y is up)
  var LX = -0.46, LY = -0.62, LZ = 0.64;

  var cubes = (FX.cubes = {});
  cubes.reset = function () { cubePool[0].n = 0; cubePool[1].n = 0; cubeUid = 1; };
  cubes.clearFrom = function (t) { return clearPoolFrom(cubePool[0], t) + clearPoolFrom(cubePool[1], t); };
  /** +mark() / rollback(mark): cheap "undo" of everything spawned since mark() (used for silent JIT warm-ups; not part of the director API) */
  cubes.mark = function () { return [cubePool[0].n, cubePool[1].n, cubeUid]; };
  cubes.rollback = function (m) { cubePool[0].n = m[0]; cubePool[1].n = m[1]; cubeUid = m[2]; };
  cubes.count = function () { return cubePool[0].n + cubePool[1].n; };
  cubes.spawn = function (o) {
    var id = cubeUid++;
    var z = o.z === undefined ? hash01(id * 7 + 5) * 2 - 1 : o.z;
    var P = cubePool[z < 0 ? 0 : 1];
    var i = P.n; growPool(P, i + 1); P.n = i + 1;
    var A = P.a, size = o.size === undefined ? 12 : o.size;
    var te = setKin(A, i, o, size, id);
    var sp = o.spin, r0 = o.rot0;
    A.sz[i] = size;
    A.wx[i] = sp ? sp[0] : (hash01(id * 11 + 1) - 0.5) * 14;
    A.wy[i] = sp ? sp[1] : (hash01(id * 11 + 2) - 0.5) * 14;
    A.wz[i] = sp ? sp[2] : (hash01(id * 11 + 3) - 0.5) * 10;
    A.rx[i] = r0 ? r0[0] : TAU * hash01(id * 11 + 4);
    A.ry[i] = r0 ? r0[1] : TAU * hash01(id * 11 + 5);
    A.rz[i] = r0 ? r0[2] : TAU * hash01(id * 11 + 6);
    return te;
  };

  /** parallelogram C, C+a, C+a+b, C+b written into arr at n (reversed winding if rev); returns n+8 */
  function quad(arr, n, Cx, Cy, ax, ay, bx, by, rev) {
    if (rev) { var tx = ax, ty = ay; ax = bx; ay = by; bx = tx; by = ty; }
    arr[n] = Cx; arr[n + 1] = Cy; arr[n + 2] = Cx + ax; arr[n + 3] = Cy + ay; arr[n + 4] = Cx + ax + bx; arr[n + 5] = Cy + ay + by; arr[n + 6] = Cx + bx; arr[n + 7] = Cy + by;
    return n + 8;
  }
  function drawCubePool(ctx, t, P, px) {
    var n = P.n;
    if (!n) return 0;
    if (cubeBuf.cap < n) {
      var cap = Math.max(256, n, cubeBuf.cap * 2);
      cubeBuf.hex = new Float32Array(cap * 12);
      cubeBuf.f1 = new Float32Array(cap * 24);
      cubeBuf.f2 = new Float32Array(cap * 24);
      cubeBuf.cap = cap;
    }
    var hex = cubeBuf.hex, f1 = cubeBuf.f1, f2 = cubeBuf.f2;
    var A = P.a, T0 = A.t0, TE = A.te, SZ = A.sz, WX = A.wx, WY = A.wy, WZ = A.wz, RX = A.rx, RY = A.ry, RZ = A.rz;
    var g = FX.gravity, xMax = VIS.xMax, yMax = VIS.yMax, yMin = VIS.yMin;
    var nh = 0, n1 = 0, n2 = 0; // vertex floats written
    var cnt = 0;
    var sin = Math.sin, cos = Math.cos;
    for (var i = 0; i < n; i++) {
      var t0 = T0[i];
      if (t < t0 || t > TE[i]) continue;
      var tau = t - t0;
      kin(A, i, tau, g);
      var x = _x, y = _y, sz = SZ[i];
      var pop = tau < 0.07 ? 0.4 + 0.6 * easeOutQuad(tau / 0.07) : 1;
      var hs = sz * 0.5 * pop, m = hs * 1.8;
      if (x < -m || x > xMax + m || y > yMax + m || y < yMin - m) continue;
      cnt++;
      var ax = RX[i] + WX[i] * tau, ay = RY[i] + WY[i] * tau, az = RZ[i] + WZ[i] * tau;
      var sx = sin(ax), cx = cos(ax), sy = sin(ay), cy = cos(ay), sz_ = sin(az), cz = cos(az);
      var r00 = cz * cy, r01 = cz * sy * sx - sz_ * cx, r02 = cz * sy * cx + sz_ * sx;
      var r10 = sz_ * cy, r11 = sz_ * sy * sx + cz * cx, r12 = sz_ * sy * cx - cz * sx;
      var r20 = -sy, r21 = cy * sx, r22 = cy * cx;
      var s0 = r20 >= 0 ? 1 : -1, s1 = r21 >= 0 ? 1 : -1, s2 = r22 >= 0 ? 1 : -1;
      var h2 = 2 * hs;
      var d0x = -s0 * h2 * r00, d0y = -s0 * h2 * r10;
      var d1x = -s1 * h2 * r01, d1y = -s1 * h2 * r11;
      var d2x = -s2 * h2 * r02, d2y = -s2 * h2 * r12;
      var Cx = x + hs * (s0 * r00 + s1 * r01 + s2 * r02), Cy = y + hs * (s0 * r10 + s1 * r11 + s2 * r12);
      // All polygons of a batch must wind the SAME way: with the non-zero rule two overlapping cubes of opposite winding would cancel and
      // punch a paper-coloured hole where they overlap. The winding of every polygon below is sign(s0*s1*s2), so reverse the vertex order when it is negative.
      var rev = s0 * s1 * s2 < 0;
      // silhouette hexagon C+d0, C+d0+d1, C+d1, C+d1+d2, C+d2, C+d2+d0  (reversed: d1 and d2 swapped)
      var ux = rev ? d2x : d1x, uy = rev ? d2y : d1y, vx = rev ? d1x : d2x, vy = rev ? d1y : d2y;
      hex[nh] = Cx + d0x; hex[nh + 1] = Cy + d0y;
      hex[nh + 2] = Cx + d0x + ux; hex[nh + 3] = Cy + d0y + uy;
      hex[nh + 4] = Cx + ux; hex[nh + 5] = Cy + uy;
      hex[nh + 6] = Cx + ux + vx; hex[nh + 7] = Cy + uy + vy;
      hex[nh + 8] = Cx + vx; hex[nh + 9] = Cy + vy;
      hex[nh + 10] = Cx + vx + d0x; hex[nh + 11] = Cy + vy + d0y;
      nh += 12;
      if (sz * px < 8.0) continue; // tiny: flat black hexagon is indistinguishable from the shaded one
      // face shading from the world-space face normals
      var b0 = s0 * (r00 * LX + r10 * LY + r20 * LZ); // face spanned by axes 1,2
      var b1 = s1 * (r01 * LX + r11 * LY + r21 * LZ); // face spanned by axes 2,0
      var b2 = s2 * (r02 * LX + r12 * LY + r22 * LZ); // face spanned by axes 0,1
      if (b0 > -0.05) { if (b0 > 0.42) n2 = quad(f2, n2, Cx, Cy, d1x, d1y, d2x, d2y, rev); else n1 = quad(f1, n1, Cx, Cy, d1x, d1y, d2x, d2y, rev); }
      if (b1 > -0.05) { if (b1 > 0.42) n2 = quad(f2, n2, Cx, Cy, d2x, d2y, d0x, d0y, rev); else n1 = quad(f1, n1, Cx, Cy, d2x, d2y, d0x, d0y, rev); }
      if (b2 > -0.05) { if (b2 > 0.42) n2 = quad(f2, n2, Cx, Cy, d0x, d0y, d1x, d1y, rev); else n1 = quad(f1, n1, Cx, Cy, d0x, d0y, d1x, d1y, rev); }
    }
    var k;
    if (nh) {
      ctx.fillStyle = ST.INK;
      ctx.beginPath();
      for (k = 0; k < nh; k += 12) {
        ctx.moveTo(hex[k], hex[k + 1]);
        ctx.lineTo(hex[k + 2], hex[k + 3]); ctx.lineTo(hex[k + 4], hex[k + 5]);
        ctx.lineTo(hex[k + 6], hex[k + 7]); ctx.lineTo(hex[k + 8], hex[k + 9]); ctx.lineTo(hex[k + 10], hex[k + 11]);
      }
      ctx.fill();
    }
    var tones = cubeTones();
    if (n1) {
      ctx.fillStyle = tones.l1;
      ctx.beginPath();
      for (k = 0; k < n1; k += 8) {
        ctx.moveTo(f1[k], f1[k + 1]); ctx.lineTo(f1[k + 2], f1[k + 3]); ctx.lineTo(f1[k + 4], f1[k + 5]); ctx.lineTo(f1[k + 6], f1[k + 7]);
      }
      ctx.fill();
    }
    if (n2) {
      ctx.fillStyle = tones.l2;
      ctx.beginPath();
      for (k = 0; k < n2; k += 8) {
        ctx.moveTo(f2[k], f2[k + 1]); ctx.lineTo(f2[k + 2], f2[k + 3]); ctx.lineTo(f2[k + 4], f2[k + 5]); ctx.lineTo(f2[k + 6], f2[k + 7]);
      }
      ctx.fill();
    }
    return cnt;
  }
  cubes.draw = function (ctx, t, layer) {
    var px = updateVisible(), c = 0;
    ctx.save();
    if (layer !== 'front') c += drawCubePool(ctx, t, cubePool[0], px);
    if (layer !== 'back') c += drawCubePool(ctx, t, cubePool[1], px);
    ctx.restore();
    FX.stats.cubesDrawn = c;
  };

  /* ------------------------------------------------------------------ DOTS (dot / ring / square / tick) */
  var dotPool = [makePool(['sz', 'kind', 'tone', 'rot', 'spin']), makePool(['sz', 'kind', 'tone', 'rot', 'spin'])];
  var dotBucket = [new Int32Array(12), new Int32Array(12)]; // spawn counts per (tone*4 + kind) bucket
  var dotView = { x: new Float32Array(0), y: new Float32Array(0), i: new Int32Array(0) };
  growPool(cubePool[0], 1); growPool(cubePool[1], 1); growPool(dotPool[0], 1); growPool(dotPool[1], 1);   // allocate once, spawn() never allocates later
  var KINDS = { dot: 0, ring: 1, square: 2, tick: 3 };
  var dots = (FX.dots = {});
  dots.reset = function () {
    for (var L = 0; L < 2; L++) { dotPool[L].n = 0; dotBucket[L].fill(0); }
    dotUid = 1;
  };
  dots.count = function () { return dotPool[0].n + dotPool[1].n; };
  dots.mark = function () { return [dotPool[0].n, dotPool[1].n, dotUid]; };
  dots.rollback = function (m) {
    dotPool[0].n = m[0]; dotPool[1].n = m[1]; dotUid = m[2];
    for (var L = 0; L < 2; L++) { var P = dotPool[L], b = dotBucket[L], A = P.a; b.fill(0); for (var i = 0; i < P.n; i++) b[A.tone[i] * 4 + A.kind[i]]++; }
  };
  dots.clearFrom = function (t) {
    var c = clearPoolFrom(dotPool[0], t) + clearPoolFrom(dotPool[1], t);
    for (var L = 0; L < 2; L++) {            // recount the style buckets
      var P = dotPool[L], b = dotBucket[L], A = P.a;
      b.fill(0);
      for (var i = 0; i < P.n; i++) b[A.tone[i] * 4 + A.kind[i]]++;
    }
    return c;
  };
  dots.spawn = function (o) {
    var id = dotUid++;
    var z = o.z === undefined ? hash01(id * 7 + 5) * 2 - 1 : o.z;
    var L = z < 0 ? 0 : 1, P = dotPool[L];
    var i = P.n; growPool(P, i + 1); P.n = i + 1;
    var A = P.a, r = o.r === undefined ? 2.4 : o.r;
    var kind = KINDS[o.kind || 'dot'] || 0, tone = o.tone | 0;
    if (tone < 0 || tone > 2) tone = 0;
    var te = setKin(A, i, o, r * 2, id);
    A.sz[i] = r; A.kind[i] = kind; A.tone[i] = tone;
    A.rot[i] = o.rot !== undefined ? o.rot : TAU * hash01(id * 13 + 1);
    A.spin[i] = o.spin !== undefined ? o.spin : (hash01(id * 13 + 2) - 0.5) * 9;
    dotBucket[L][tone * 4 + kind]++;
    return te;
  };
  var TONES = ['', '', ''];   // refreshed from GA.style at every draw
  function drawDotPool(ctx, t, P, buckets) {
    var n = P.n;
    if (!n) return 0;
    if (dotView.x.length < n) {
      var cap = Math.max(256, n, dotView.x.length * 2);
      dotView.x = new Float32Array(cap); dotView.y = new Float32Array(cap); dotView.i = new Int32Array(cap);
    }
    TONES[0] = ST.INK; TONES[1] = ST.GRAY1; TONES[2] = ST.GRAY2;
    var A = P.a, T0 = A.t0, TE = A.te, SZ = A.sz, VXs = dotView.x, VYs = dotView.y, VI = dotView.i;
    var g = FX.gravity, xMax = VIS.xMax, yMax = VIS.yMax, yMin = VIS.yMin, m = 0;
    for (var i = 0; i < n; i++) {
      var t0 = T0[i];
      if (t < t0 || t > TE[i]) continue;
      kin(A, i, t - t0, g);
      var r = SZ[i] + 3;
      if (_x < -r || _x > xMax + r || _y > yMax + r || _y < yMin - r) continue;
      VXs[m] = _x; VYs[m] = _y; VI[m] = i; m++;
    }
    if (!m) return 0;
    var KIND = A.kind, TONE = A.tone, ROT = A.rot, SPIN = A.spin, k, j, x, y, r_, a, c, s, q;
    for (var tone = 0; tone < 3; tone++) {
      for (var kind = 0; kind < 4; kind++) {
        if (!buckets[tone * 4 + kind]) continue;
        var col = TONES[tone];
        ctx.beginPath();
        for (k = 0; k < m; k++) {
          j = VI[k];
          if (KIND[j] !== kind || TONE[j] !== tone) continue;
          x = VXs[k]; y = VYs[k];
          var tau = t - T0[j];
          r_ = SZ[j] * (tau < 0.06 ? 0.3 + 0.7 * (tau / 0.06) : 1);
          if (kind === 0 || kind === 1) {
            ctx.moveTo(x + r_, y); ctx.arc(x, y, r_, 0, TAU);
          } else if (kind === 2) {
            a = ROT[j] + SPIN[j] * tau; c = Math.cos(a); s = Math.sin(a); q = r_ * 0.85;
            ctx.moveTo(x + q * (c - s), y + q * (s + c));
            ctx.lineTo(x + q * (-c - s), y + q * (-s + c));
            ctx.lineTo(x + q * (-c + s), y + q * (-s - c));
            ctx.lineTo(x + q * (c + s), y + q * (s - c));
            ctx.closePath();
          } else {
            a = ROT[j] + SPIN[j] * tau * 0.5; c = Math.cos(a) * r_ * 1.5; s = Math.sin(a) * r_ * 1.5;
            ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s);
          }
        }
        if (kind === 0 || kind === 2) { ctx.fillStyle = col; ctx.fill(); }
        else {
          ctx.strokeStyle = col; ctx.lineWidth = kind === 1 ? 1.5 : 2.0; ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }
    return m;
  }
  dots.draw = function (ctx, t, layer) {
    updateVisible();
    var c = 0;
    ctx.save();
    if (layer !== 'front') c += drawDotPool(ctx, t, dotPool[0], dotBucket[0]);
    if (layer !== 'back') c += drawDotPool(ctx, t, dotPool[1], dotBucket[1]);
    ctx.restore();
    FX.stats.dotsDrawn = c;
  };

  /* ------------------------------------------------------------------ BURST (convenience: random cubes + dots flying outward) */
  FX.burst = function (o) {
    var rng = U.rng(o.seed === undefined ? 7 : o.seed);
    var n = o.count === undefined ? 60 : o.count, nd = o.dots === undefined ? Math.round(n * 1.5) : o.dots;
    var spread = o.spread === undefined ? 90 : o.spread, speed = o.speed || 520, lift = o.lift === undefined ? 160 : o.lift;
    var smin = o.sizeMin || 3, smax = o.sizeMax || 30, hmax = o.hover === undefined ? 0.5 : o.hover;
    var x = o.x || 0, y = o.y || 0, t0 = o.t0 || 0, i, ang, rad, dir, sp, sz, c, s;
    for (i = 0; i < n; i++) {
      ang = rng.range(0, TAU); rad = spread * Math.sqrt(rng.next());
      sz = smin + (smax - smin) * Math.pow(rng.next(), 1.7);
      if (rng.next() < 0.04) sz = smax * rng.range(1.15, 1.35);        // a few chunky ones for drama
      dir = ang + rng.range(-0.55, 0.55);
      sp = speed * rng.range(0.25, 1) * (1.15 - 0.5 * sz / smax);
      c = Math.cos(dir); s = Math.sin(dir);
      cubes.spawn({
        x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad * 0.8, size: sz, t0: t0 + rng.range(0, 0.05),
        vx: c * sp, vy: s * sp - lift * rng.next(),
        spin: [rng.range(-1, 1) * 11, rng.range(-1, 1) * 11, rng.range(-1, 1) * 8],
        rot0: [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)],
        z: o.z !== undefined ? o.z : rng.range(-1, 1), hover: rng.range(0.05, hmax),
      });
    }
    var kinds = ['dot', 'dot', 'dot', 'dot', 'ring', 'square', 'tick', 'dot'];
    for (i = 0; i < nd; i++) {
      ang = rng.range(0, TAU); rad = spread * 1.15 * Math.sqrt(rng.next());
      dir = ang + rng.range(-0.7, 0.7);
      sp = speed * rng.range(0.2, 1.15);
      c = Math.cos(dir); s = Math.sin(dir);
      dots.spawn({
        x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad * 0.8, r: 0.9 + 3.6 * Math.pow(rng.next(), 2),
        t0: t0 + rng.range(0, 0.1), vx: c * sp, vy: s * sp - lift * rng.next(), kind: kinds[rng.int(0, kinds.length - 1)],
        z: o.z !== undefined ? o.z : rng.range(-1, 1), hover: rng.range(0.05, hmax), tone: rng.next() < 0.18 ? 1 : 0,
      });
    }
  };

  /* ------------------------------------------------------------------ SHADOW (soft elliptical contact shadow, ink at low alpha) */
  var SH_STOPS = [0, 0.22, 0.45, 0.68, 0.86], SH_MUL = [1, 0.9, 0.6, 0.27, 0.07];
  function blob(ctx, R, a) {
    var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    for (var j = 0; j < SH_STOPS.length; j++) gr.addColorStop(SH_STOPS[j], inkA(a * SH_MUL[j]));
    gr.addColorStop(1, inkA(0));
    ctx.fillStyle = gr;
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
  }
  /** Nothing in fx caches anything that depends on the canvas pixel ratio (typed-array pools, per-call gradients, no offscreen canvas): a quality / DPR change needs no work.
      Idempotent no-op so the scene can call it unconditionally. */
  FX.rescale = function () { return true; };
  /** GPU warm-up: draws, invisibly (alpha 0.004, inside rect = {x,y,w,h} world units), every distinct draw state the first real frames use: cube faces (3 solid batch fills),
      dots (fills, round-cap strokes, rotated squares), impact ticks, the shadow's radial gradient, the ball (clip + paper seams + paper rim + speed needles).  3 steps (0.2 / 0.3 / 0.3 ms); true after the last (step 2). */
  FX.warmGPU = function (ctx, step, rect) {
    if (!ctx || !rect) return true;
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h, tones = cubeTones(), k;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!(step > 0)) {
      ctx.globalAlpha = 0.004;
      var cols = [ST.INK, tones.l1, tones.l2, ST.GRAY1, ST.GRAY2];
      for (k = 0; k < cols.length; k++) {                                       // cube hexagon / face batches and dot batches: solid polygon fills
        ctx.fillStyle = cols[k]; ctx.beginPath();
        ctx.moveTo(x + 0.1 * w, y + 0.5 * h); ctx.lineTo(x + 0.3 * w, y + 0.2 * h); ctx.lineTo(x + 0.55 * w, y + 0.3 * h); ctx.lineTo(x + 0.6 * w, y + 0.7 * h); ctx.lineTo(x + 0.35 * w, y + 0.85 * h);
        ctx.moveTo(x + 0.7 * w + 1, y + 0.5 * h); ctx.arc(x + 0.7 * w, y + 0.5 * h, 0.1 * w, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = ST.INK; ctx.lineWidth = 0.8;                            // ring / tick dots
      ctx.beginPath(); ctx.moveTo(x + 0.4 * w + 1, y + 0.4 * h); ctx.arc(x + 0.4 * w, y + 0.4 * h, 0.12 * w, 0, TAU); ctx.moveTo(x + 0.2 * w, y + 0.8 * h); ctx.lineTo(x + 0.45 * w, y + 0.65 * h); ctx.stroke();
    } else if (step === 1) {
      FX.shadow(ctx, { x: x + 0.5 * w, y: y + 0.6 * h, w: 0.9 * w, h: 0.4 * h, alpha: 0.02 });   // radial gradient + fillRect under a scale
    } else {
      ctx.globalAlpha = 0.004;
      ball.drawPose(ctx, x + 0.5 * w, y + 0.5 * h, 0.2 * w, 1.1, 1, 1, 0.2, 0.3);               // clip + paper seams + paper rim
      ctx.fillStyle = ST.INK; ctx.beginPath(); ctx.moveTo(x + 0.2 * w, y + 0.3 * h); ctx.lineTo(x + 0.9 * w, y + 0.45 * h); ctx.lineTo(x + 0.2 * w, y + 0.55 * h); ctx.closePath(); ctx.fill();   // needles
    }
    ctx.restore();
    return step >= 2;
  };
  FX.shadow = function (ctx, o) {
    var x = o.x, y = o.y, w = o.w === undefined ? 200 : o.w, h = o.h === undefined ? w * 0.13 : o.h;
    var al = o.alpha === undefined ? 0.2 : o.alpha;
    if (!(al > 0.002) || !(w > 1)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, h / w);
    blob(ctx, w * 0.5, al * 0.82);         // wide soft pool
    blob(ctx, w * 0.27, al * 0.5);         // tighter core right under the feet
    ctx.restore();
  };

  /* ------------------------------------------------------------------ SPECKS (static dust: from just above the feet line to the bottom of the stage) */
  var specks = (FX.specks = { n: 0, x: null, y: null, rx: null, ry: null, bucket: null, W: 0, H: 0 });
  var SPECK_ALPHA = [0.09, 0.14, 0.20, 0.28];   // ink alpha of the four size buckets: a barely-there dust (it is always drawn, so it must never pop or shout)
  specks.build = function (o) {
    o = o || {};
    var S = GA.stage || {};
    var W = o.W || S.W || 2773, H = o.H || S.H || 780, G0 = o.groundY !== undefined ? o.groundY : (S.groundY || H * 0.9);
    var rng = U.rng(o.seed === undefined ? 11 : o.seed);          // default seed 11 = the scene's seed: an early auto-build and the scene's own build() are identical (no pop)
    var n = Math.round(U.clamp(105 * W / 1778, 80, 190));
    var x = new Float32Array(n), y = new Float32Array(n), rx = new Float32Array(n), ry = new Float32Array(n), bk = new Uint8Array(n);
    // clustered along x so the specks never read as a ruler-straight band
    var nc = Math.max(8, Math.round(W / 130)), cx = [], i, v;
    for (i = 0; i < nc; i++) cx.push(rng.range(0, W));
    var y1b = Math.min(H + 70, (S.visBottom !== undefined ? S.visBottom : H) - 90);
    var y0 = G0 - 10, y1 = Math.max(H - 9, y1b);     // a little above the feet line ... into the faded lower margin of the canvas (no hard edge)
    for (i = 0; i < n; i++) {
      if (rng.next() < 0.58) x[i] = U.clamp(rng.pick(cx) + rng.gauss() * 130, 4, W - 4);
      else x[i] = rng.range(4, W - 4);
      v = rng.next();
      y[i] = y0 + (y1 - y0) * Math.pow(v, 1.05) + rng.gauss() * 4;
      if (y[i] > y1 + 6) y[i] = y1 - rng.range(0, 6);
      if (rng.next() < 0.08) y[i] -= rng.range(10, 30);
      var q = rng.next(), r;
      if (q < 0.45) r = rng.range(0.85, 1.35); else if (q < 0.84) r = rng.range(1.35, 2.0); else r = rng.range(2.0, 2.9);
      rx[i] = r * (rng.next() < 0.22 ? rng.range(1.5, 2.6) : 1); // a few little horizontal dashes
      ry[i] = r * 0.8;
      bk[i] = rng.int(0, 3);
    }
    specks.n = n; specks.x = x; specks.y = y; specks.rx = rx; specks.ry = ry; specks.bucket = bk; specks.W = W; specks.H = H;
  };
  specks.draw = function (ctx) {
    if (!specks.n) specks.build({});
    var n = specks.n, X = specks.x, Y = specks.y, RX = specks.rx, RY = specks.ry, BK = specks.bucket;
    ctx.save();
    for (var b = 0; b < 4; b++) {
      ctx.fillStyle = inkA(SPECK_ALPHA[b]);
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        if (BK[i] !== b) continue;
        ctx.moveTo(X[i] + RX[i], Y[i]);
        ctx.ellipse(X[i], Y[i], RX[i], RY[i], 0, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------------ variable-width ribbon on typed arrays (no allocation) */
  /** Starts a new path holding a variable-width ribbon along (xs,ys)[0..n-1] with full widths ws (+grow on every width), round caps.
      Built as a union of per-segment quads + vertex discs, all wound the same way (non-zero fill), so tight bends of a fat stroke can never
      leave swallow-tail holes. Fill it with the current fillStyle. */
  var rbL = new Float32Array(1024), rbR = new Float32Array(1024);
  function ribbonPath(ctx, xs, ys, ws, n, grow) {
    if (n < 2) return;
    if (n > 256) n = 256;
    grow = grow || 0;
    var i, dx, dy, d, w, ia, ib, lx = rbL, rx = rbR;
    for (i = 0; i < n; i++) {
      ia = i > 0 ? i - 1 : 0; ib = i < n - 1 ? i + 1 : n - 1;
      dx = xs[ib] - xs[ia]; dy = ys[ib] - ys[ia]; d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      w = (ws[i] + grow) * 0.5; if (!(w > 0)) w = 0;
      lx[i * 2] = xs[i] - dy * w; lx[i * 2 + 1] = ys[i] + dx * w;
      rx[i * 2] = xs[i] + dy * w; rx[i * 2 + 1] = ys[i] - dx * w;
    }
    ctx.beginPath();
    for (i = 0; i < n - 1; i++) {
      ctx.moveTo(lx[i * 2], lx[i * 2 + 1]);
      ctx.lineTo(lx[i * 2 + 2], lx[i * 2 + 3]);
      ctx.lineTo(rx[i * 2 + 2], rx[i * 2 + 3]);
      ctx.lineTo(rx[i * 2], rx[i * 2 + 1]);
    }
    for (i = 0; i < n; i++) {
      w = (ws[i] + grow) * 0.5;
      if (w > 0.08) { ctx.moveTo(xs[i] + w, ys[i]); ctx.arc(xs[i], ys[i], w, 0, TAU, true); }
    }
  }
  /* ------------------------------------------------------------------ BALL */
  var ball = (FX.ball = { info: null });
  var B = null;
  var HIT_DUR = 0.08, SYE = 1.12;
  var SEAM_N = 84, seamX = new Float32Array(SEAM_N + 2), seamY = new Float32Array(SEAM_N + 2), seamZ = new Float32Array(SEAM_N + 2);
  var runX = new Float32Array(SEAM_N + 2), runY = new Float32Array(SEAM_N + 2), runW = new Float32Array(SEAM_N + 2);
  var cancelT = Infinity;   // ball.cancel(t): the ball is gone from this time on
  var SCR = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, sa: 0, squash: 0, visible: false, phase: 'fly', vx: 0, vy: 0 };
  var HALF_PI = PI / 2, FLY_DT = 1 / 240, FLY_K = 0.22, BOUNCE_K = 0.12;   // speed stretch: axis ratio 1 + FLY_K at >= 1300 u/s in the lob (sy^2), ~1.25 in the whoosh (kept calm: a ball, not a lemon)

  /** integral of smoothstep(a,b,u) du from 0 to s */
  function ssInt(a, b, s) {
    if (s <= a) return 0;
    if (s >= b) return (b - a) * 0.5 + (s - b);
    var w = (s - a) / (b - a);
    return (b - a) * (w * w * w - 0.5 * w * w * w * w);
  }
  /** angle -> (-pi/2, pi/2]: an ellipse (and the tennis seams) look the same after a half turn */
  function wrapHalf(a) { a = a % PI; if (a > HALF_PI) a -= PI; else if (a <= -HALF_PI) a += PI; return a; }
  /** vertical half extent of the ball ellipse (semi axes r*sx, r*sy) rotated by sa */
  function halfH(r, sx, sy, sa) { var c = Math.cos(sa), s = Math.sin(sa); return r * Math.sqrt(sx * sx * s * s + sy * sy * c * c); }
  /** velocity driven stretch: the long axis follows the direction of travel (local y axis); 1 below 450 u/s, 1+k at >= 1300 u/s */
  function stretchOf(speed, k) { return Math.sqrt(1 + k * clamp01((speed - 450) / 850)); }   // = sy; sx = 1 / sy, so the axis ratio is sy^2

  /** THE PARABOLA (QA round 4).  The ball enters just beyond the LEFT screen edge (x = -80, at chest height), flies on ONE exact parabola - constant horizontal speed, constant
      gravity, y(x) a true quadratic - rises to a clearly visible apex and falls onto the top of her head at descentDeg (default 20 deg), touching it exactly at tHit.  The flight lasts
      flight seconds (default 1.55).  After the squash it leaves on a SECOND, lower parabola (constant speed to the right, its own gravity) and exits through the RIGHT edge at mid height.
      Closed form (no tables).  Options: W,H,tHit,target{x,y},radius,headAt(t),entryY (default 400),entryX (-80),descentDeg (20),flight (1.55),exitApexY (86),spin. */
  ball.build = function (o) {
    var S = GA.stage || {};
    cancelT = Infinity;
    var W = o.W || S.W || 2773, H = o.H || S.H || 780;
    var vt = S.visTop !== undefined ? S.visTop : 0, vb = S.visBottom !== undefined ? S.visBottom : H;
    var r = Math.max(o.radius || 55, 40), tx = o.target.x, ty = o.target.y, tHit = o.tHit;
    var x0 = o.entryX !== undefined ? o.entryX : -80, y0 = o.entryY !== undefined ? o.entryY : 400, flight = o.flight || 1.55;
    var m = Math.tan((o.descentDeg || 20) * PI / 180);               // slope dy/dx at the impact
    var Lx = tx - x0, vx = Lx / flight, spinD = o.spin !== undefined ? o.spin : 3.2;
    var rotHit = -0.7;
    // ---- the parabola y(x) = ya + k (x - xa)^2 through the entry (x0,y0) and the impact (tx,yT) with slope m at the impact.  yT depends on the stretch at the impact -> iterate.
    var yT = ty - r * 1.1, k = 0, xa = 0, ya = 0, vyI = 0, syI = 1, sxI = 1, saI = 0, pass;
    for (pass = 0; pass < 4; pass++) {
      k = (y0 - yT + m * Lx) / (Lx * Lx); xa = tx - m / (2 * k); ya = yT - m * m / (4 * k);
      vyI = m * vx;
      syI = stretchOf(Math.hypot(vx, vyI), FLY_K); sxI = 1 / syI; saI = wrapHalf(Math.atan2(vyI, vx) - HALF_PI);
      yT = ty - halfH(r, sxI, syI, saI);
    }
    var gF = 2 * k * vx * vx, tS = tHit - flight;
    // ---- second parabola after the squash: released at the head, constant vx2 to the right edge, own gravity g2, apex at height exitApexY
    var yRel = ty - r * SYE, apex2 = Math.min(o.exitApexY !== undefined ? o.exitApexY : 86, yRel - 40), rise2 = yRel - apex2, Ta2 = 0.55;
    var vx2 = 1000, g2 = 2 * rise2 / (Ta2 * Ta2), vy2 = g2 * Ta2;
    var P = {
      W: W, H: H, vt: vt, vb: vb, r: r, tx: tx, ty: ty, tHit: tHit, tS: tS, x0: x0, y0: y0, vx: vx, k: k, xa: xa, ya: ya, gF: gF, spinD: spinD, rotHit: rotHit,
      yT: yT, syI: syI, sxI: sxI, saI: saI, vyI: vyI, m: m,
      tRel: tHit + HIT_DUR, yRel: yRel, apex2: apex2, Ta2: Ta2, vx2: vx2, g2: g2, vy2: vy2, tGone: 1e9,
    };
    B = P;
    // when has the ball left the visible region for good (right edge / bottom / top)?
    var tl = P.tRel, tg = tl + 4;
    for (var tt = tl + 0.2; tt < tl + 4; tt += 0.004) {
      evalBall(tt, SCR);
      if (SCR.x > W + r * 2.2 || SCR.y > vb + r * 2.2 || SCR.y < vt - r * 3) { tg = tt; break; }
    }
    P.tGone = tg;
    P.headAt = typeof o.headAt === 'function' ? o.headAt : null;
    ball.info = {
      tStart: tS, tHit: tHit, tRelease: P.tRel, tLaunch: P.tRel, tGone: tg, apex: { x: xa, y: ya, t: tS + (xa - x0) / vx }, bounceApex: { y: apex2, t: P.tRel + Ta2 },
      impactVy: vyI, impactSpeed: Math.hypot(vx, vyI), duration: tg - tS, r: r, descentDeg: Math.atan(m) * 180 / PI, entry: { x: x0, y: y0 }, vx: vx, gravity: gF, k: k,
    };
  };

  /** evaluate the ball at time t into o (no allocation) */
  function evalBall(t, o, dy) {
    dy = dy || 0;
    var P = B, r = P.r, x, y, rot, sx = 1, sy = 1, sa = 0, squash = 0, phase, vx = 0, vy = 0, tau = 0;
    if (t < P.tHit) {
      phase = 'fly';
      tau = t - P.tS;
      x = P.x0 + P.vx * tau; var dxa = x - P.xa;                      // constant horizontal speed ...
      y = P.ya + P.k * dxa * dxa; vx = P.vx; vy = 2 * P.k * dxa * P.vx;  // ... constant gravity: y(x) is an exact quadratic
      rot = P.rotHit - P.spinD * (P.tHit - t);
      var sp = Math.sqrt(vx * vx + vy * vy);
      sy = stretchOf(sp, FLY_K); sx = 1 / sy;
      sa = sp > 1 ? wrapHalf(Math.atan2(vy, vx) - HALF_PI) : 0;
    } else if (t < P.tRel) {
      phase = 'hit';
      var h = t - P.tHit;
      if (h < 0.03) sy = P.syI + (0.38 - P.syI) * easeOutQuad(h / 0.03);
      else if (h < 0.05) sy = 0.38 + 0.02 * Math.sin(((h - 0.03) / 0.02) * PI);
      else sy = 0.38 + (SYE - 0.38) * easeInOutQuad((h - 0.05) / 0.03);
      sx = sy < 1 ? 1 + (1 - sy) * 1.05 : 1 / sy;
      sa = P.saI * (1 - sstep(0, 0.03, h));
      // the squash disc sits on the head: follow the head probe (headAt option of build(): the head dips ~80 units and shifts ~40 right within 0.09 s of the hit), else dy
      var hx = P.tx, hy = P.ty + dy;
      if (P.headAt) { var hp = P.headAt(t); hx = hp.x; hy = hp.y; }
      x = hx; y = hy - halfH(r, sx, sy, sa);
      rot = P.rotHit;
      squash = clamp01((1 - sy) / 0.62);
    } else {
      phase = 'bounce';
      var tb = t - P.tRel;
      // second parabola: constant speed to the right, constant gravity g2, apex after Ta2
      x = P.tx + P.vx2 * tb; y = P.yRel - P.vy2 * tb + 0.5 * P.g2 * tb * tb; vx = P.vx2; vy = -P.vy2 + P.g2 * tb;
      rot = P.rotHit + 5 * tb + (17 / 3) * (1 - Math.exp(-3 * tb));
      var spd = Math.sqrt(vx * vx + vy * vy), q0 = clamp01((Math.hypot(P.vx2, P.vy2) - 450) / 850);
      var osc = Math.exp(-6 * tb) * Math.cos(TAU * 2.6 * tb), qn = clamp01((spd - 450) / 850);
      sy = 1 + (SYE - 1 - BOUNCE_K * q0) * osc + BOUNCE_K * qn;
      // anticipation squash at the apex just before the whoosh
      sx = 1 / Math.max(0.6, sy);
      sa = wrapHalf(Math.atan2(vy, vx) - HALF_PI) * sstep(0, 0.06, tb);
      var fol = 1 - sstep(0, 0.12, tb), dyw = dy * fol, dxw = 0;       // follow the head while it springs back
      if (P.headAt && tb < 0.12) { var hq = P.headAt(t); dyw = (hq.y - P.ty) * fol; dxw = (hq.x - P.tx) * fol; }
      x += dxw;
      y = tb < 0.3 ? Math.min(y + dyw, P.ty + dyw - halfH(r, sx, sy, sa)) : y;      // never sink into the head while it springs back
      if (t > P.tGone) phase = 'gone';
    }
    o.x = x; o.y = y; o.rot = rot; o.sx = sx; o.sy = sy; o.sa = sa; o.squash = squash; o.phase = phase; o.vx = vx; o.vy = vy;
    o.visible = phase !== 'gone' && x > -r * 2 && x < P.W + r * 2 && y > P.vt - r * 2 && y < P.vb + r * 2 && !(phase === 'fly' && tau < 0);
    if (t >= cancelT) { o.visible = false; o.phase = 'gone'; }
    return o;
  }

  ball.state = function (t, dy) {
    var o = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, sa: 0, squash: 0, visible: false, phase: 'gone', vx: 0, vy: 0 };
    if (!B) return o;
    return evalBall(t, o, dy);
  };
  /** pure path of the approach (debug): centre position for any t before the hit, ignoring squash */
  ball.arc = function (t) {
    if (!B) return { x: 0, y: 0 };
    var s = evalBall(Math.min(t, B.tHit - 1e-6), { x: 0, y: 0 });
    return { x: s.x, y: s.y };
  };
  /** the old dashed 'future path' guide pre-announced the hit and was removed; kept as a no-op so existing callers do not break */
  ball.hint = function () {};
  ball.reset = function () { cancelT = Infinity; };
  /** the ball disappears from time t on (earliest call wins; build() clears it). state() / draw() are still pure functions of (t, cancel time). */
  ball.cancel = function (t) { if (B && t < cancelT) cancelT = t; };
  /** cancel(t) + the ball bursts into small black cubes and dots at its position at time t (they fall out of the stage like all other cubes) */
  var popRng = null;
  ball.pop = function (t, dy) {
    if (!B || !(t < cancelT)) return false;
    var o = evalBall(t, SCR, dy), x = o.x, y = o.y, r = B.r, vis = o.visible, bvx = o.vx, bvy = o.vy, i;
    cancelT = t;
    if (!vis) return false;
    var rng = U.rng(4711 + Math.round(t * 1000));
    var nC = 20, nD = 44, spread = r * 0.9;
    var bs = Math.min(1, Math.hypot(bvx, bvy) / 1800);                 // fast ball: the debris keeps part of its momentum
    for (i = 0; i < nC; i++) {
      var ang = rng.range(0, TAU), rad = spread * Math.sqrt(rng.next()), dir = ang + rng.range(-0.35, 0.35);
      var sz = i < 3 ? rng.range(14, 24) : 4 + 11 * Math.pow(rng.next(), 1.5);
      var sp = rng.range(420, 1050) * (1.2 - 0.55 * sz / 24);
      cubes.spawn({
        x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad, size: sz, t0: t + rng.range(0, 0.025),
        vx: Math.cos(dir) * sp + bvx * 0.3 * bs, vy: Math.sin(dir) * sp - rng.range(80, 320) + bvy * 0.3 * bs,
        spin: [rng.range(-1, 1) * 12, rng.range(-1, 1) * 12, rng.range(-1, 1) * 9],
        rot0: [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)],
        z: rng.range(-0.4, 1), hover: rng.range(0.14, 0.42),
      });
    }
    var kinds = ['dot', 'dot', 'dot', 'ring', 'square', 'tick', 'dot', 'tick', 'tick'];
    for (i = 0; i < nD; i++) {
      var a2 = rng.range(0, TAU), r2 = spread * 1.05 * Math.sqrt(rng.next()), d2 = a2 + rng.range(-0.5, 0.5), sp2 = rng.range(300, 1250);
      var kd = kinds[rng.int(0, kinds.length - 1)];
      dots.spawn({
        x: x + Math.cos(a2) * r2, y: y + Math.sin(a2) * r2, r: kd === 'tick' ? 3 + 3.6 * rng.next() : 1 + 3.4 * Math.pow(rng.next(), 1.8), t0: t + rng.range(0, 0.04),
        vx: Math.cos(d2) * sp2 + bvx * 0.25 * bs, vy: Math.sin(d2) * sp2 - rng.range(0, 240) + bvy * 0.25 * bs, kind: kd,
        z: rng.range(-0.4, 1), hover: rng.range(0.1, 0.38), tone: rng.next() < 0.15 ? 1 : 0, rot: Math.atan2(Math.sin(d2), Math.cos(d2)), spin: 0,
      });
    }
    return true;
  };

  /** tennis-ball seam: the classic baseball/tennis curve on the unit sphere
        x=(1-k)cos t + k cos 3t,  y=(1-k)sin t - k sin 3t,  z=2 sqrt(k(1-k)) sin 2t
      spun / tilted in 3D; the front half is drawn as tapering white ribbons clipped to the disc (so seams slide over the horizon). */
  var SEAM_K = 0.27, SEAM_Z = 2 * Math.sqrt(SEAM_K * (1 - SEAM_K));
  function drawSeams(ctx, r, rot) {
    var al = rot * 0.85, be = 0.8 + 0.25 * Math.sin(rot * 0.37), ga = 0.5 + rot * 0.2;
    var ca = Math.cos(al), sa = Math.sin(al), cb = Math.cos(be), sb = Math.sin(be), cg = Math.cos(ga), sg = Math.sin(ga);
    var k, tt, X, Y, Z, t, kk = SEAM_K;
    for (k = 0; k < SEAM_N; k++) {
      tt = (k / SEAM_N) * TAU;
      X = (1 - kk) * Math.cos(tt) + kk * Math.cos(3 * tt);
      Z = -((1 - kk) * Math.sin(tt) - kk * Math.sin(3 * tt));
      Y = SEAM_Z * Math.sin(2 * tt);                                   // polar axis = screen Y before rotation
      t = X * ca + Z * sa; Z = -X * sa + Z * ca; X = t;                // spin about the polar axis
      t = Y * cb - Z * sb; Z = Y * sb + Z * cb; Y = t;                 // tilt
      t = X * cg - Y * sg; Y = X * sg + Y * cg; X = t;                 // roll
      seamX[k] = X * r; seamY[k] = Y * r; seamZ[k] = Z;
    }
    var start = -1;
    for (k = 0; k < SEAM_N; k++) if (seamZ[k] <= 0) { start = k; break; }
    if (start < 0) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 0.01, 0, TAU); ctx.clip();
    ctx.fillStyle = ST.PAPER; ctx.globalAlpha *= 0.8;
    var m = 1, wmax = r * 0.065, c, idx, vis;       // slot 0 is reserved for the extrapolated start point
    for (c = 1; c <= SEAM_N + 1; c++) {
      idx = (start + c) % SEAM_N; vis = seamZ[idx] > 0 && c <= SEAM_N;
      if (vis) {
        runX[m] = seamX[idx]; runY[m] = seamY[idx];
        runW[m] = wmax * (0.1 + 0.9 * Math.pow(clamp01(seamZ[idx] / 0.5), 0.65));
        m++;
      }
      if ((!vis || c === SEAM_N + 1) && m > 1) {
        if (m > 3) {
          // extend both ends past the horizon (the clip trims them) so a seam never stops inside the disc
          runX[0] = runX[1] - 1.8 * (runX[2] - runX[1]); runY[0] = runY[1] - 1.8 * (runY[2] - runY[1]); runW[0] = runW[1];
          runX[m] = runX[m - 1] + 1.8 * (runX[m - 1] - runX[m - 2]); runY[m] = runY[m - 1] + 1.8 * (runY[m - 1] - runY[m - 2]); runW[m] = runW[m - 1];
          ribbonPath(ctx, runX, runY, runW, m + 1); ctx.fill();
        }
        m = 1;
      }
    }
    ctx.restore();
  }

  ball.draw = function (ctx, t, dy) {
    if (!B || t >= cancelT) return;
    var o = evalBall(t, SCR, dy), r = B.r;
    if (!o.visible) return;
    // faint ground shadow: the lob's height cue (shrinks and fades with height; follows the ball along the ground; gone at the impact, back as the ball sails off to the right)
    var gy = (GA.stage && GA.stage.groundY !== undefined ? GA.stage.groundY : 700) + 4, hgt = Math.max(0, gy - o.y), sc = 0.3 + 0.7 * Math.exp(-hgt / 520);
    var sal = o.phase === 'fly' ? sstep(r * 1.4, r * 4.5, o.x) * (1 - sstep(B.tHit - 0.05, B.tHit, t)) : o.phase === 'bounce' ? sstep(B.tx + 150, B.tx + 420, o.x) * (1 - sstep(B.W - 5 * r, B.W - 1.5 * r, o.x)) : 0;   // never cut by a screen edge
    if (sal > 0.01) FX.shadow(ctx, { x: o.x, y: gy, w: r * 2.8 * sc, h: r * 0.5 * sc, alpha: 0.2 * sc * sal });
    // cartoon speed streaks trailing the ball while it is fast (plunge, boing, whoosh): three tapered ink needles opposite to the velocity
    var spd = Math.hypot(o.vx, o.vy);
    if (o.phase !== 'hit' && spd > 750) {
      var al2 = clamp01((spd - 750) / 650) * 0.9 * (1 - sstep(B.W, B.W + 1.8 * r, o.x)), dxn = o.vx / spd, dyn = o.vy / spd, nxn = -dyn, nyn = dxn, L = Math.min(110, spd * 0.085);
      if (dxn > 0.2) L = Math.min(L, Math.max(0, (o.x - dxn * r * 1.5 - 12) / dxn));        // short needles exactly along the tangent, never cut by the left screen edge
      if (L < 12) al2 = 0;
      if (al2 > 0.01) {
      ctx.save();
      ctx.globalAlpha = al2; ctx.fillStyle = ST.INK; ctx.beginPath();
      for (var li = -1; li <= 1; li++) {
        var off = li * r * 0.62, len = li === 0 ? L : L * 0.66, wd = li === 0 ? 5 : 3.8;
        var bx = o.x - dxn * r * (1.3 + 0.12 * (li & 1)) + nxn * off, by = o.y - dyn * r * (1.3 + 0.12 * (li & 1)) + nyn * off;
        ctx.moveTo(bx + nxn * wd * 0.5, by + nyn * wd * 0.5);
        ctx.lineTo(bx - dxn * len, by - dyn * len);
        ctx.lineTo(bx - nxn * wd * 0.5, by - nyn * wd * 0.5);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
      }
    }
    ball.drawPose(ctx, o.x, o.y, r, o.rot, o.sx, o.sy, o.sa, o.phase === 'bounce' ? 2.6 : 0);
  };
  /** draw the ball body + seams at an arbitrary pose (used by draw(); handy for tests) */
  ball.drawPose = function (ctx, x, y, r, rot, sx, sy, sa, rim) {
    ctx.save();
    ctx.translate(x, y);
    if (sa) ctx.rotate(sa);
    ctx.scale(sx, sy);
    if (rim > 0) { ctx.fillStyle = ST.PAPER; ctx.beginPath(); ctx.arc(0, 0, r + rim, 0, TAU); ctx.fill(); }   // crisp paper rim: the black ball stays readable over the black cubes
    ctx.fillStyle = ST.INK;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    drawSeams(ctx, r, rot);
    ctx.restore();
  };

  /* ------------------------------------------------------------------ IMPACT BURST (no lettering): a handful of short tapered ink ticks */
  var ow = (FX.ow = {});
  var OW = null;
  var OW_LIFE = 0.4;

  ow.build = function (o) {
    o = o || {};
    if (o.ticks === false) { OW = null; return; }
    var dir = o.dir < 0 ? -1 : 1, size = o.size || 1, rng = U.rng(o.seed === undefined ? 99 : o.seed);
    var ticks = [], nT = 7, j;
    // fan over the upper half plane, leaning a little towards 'dir'; long/short alternate, a tiny dot rides on every third tick
    for (j = 0; j < nT; j++) {
      var ang = ((-160 + (140 / (nT - 1)) * j * 1 + dir * 6 + rng.range(-4, 4)) * PI) / 180;
      ticks.push({ a: ang, L: ((j % 2 ? 36 : 56) + rng.range(-5, 14)) * size, r0: (44 + rng.range(0, 8)) * size, w: (6 + rng.range(-0.8, 1.2)) * size, d: rng.range(0, 0.03), dot: j % 3 === 1 });
    }
    OW = { t0: o.t0 || 0, x: o.x || 0, y: o.y || 0, ticks: ticks, size: size };
  };
  ow.cancel = function () { OW = null; };

  ow.draw = function (ctx, t) {
    if (!OW) return;
    var a = t - OW.t0;
    if (a < 0 || a > OW_LIFE) return;
    var i, tk, age, any = false;
    ctx.save();
    ctx.fillStyle = ST.INK;
    ctx.beginPath();
    for (i = 0; i < OW.ticks.length; i++) {
      tk = OW.ticks[i]; age = a - tk.d;
      if (age < 0 || age > 0.37) continue;
      var e = easeOutCubic(age / 0.12), ro = tk.r0 + tk.L * e, ri = tk.r0 + tk.L * 0.92 * sstep(0.14, 0.37, age);
      if (ro - ri < 1) continue;
      var w0 = tk.w * (1 - 0.45 * sstep(0.18, 0.37, age)) * 0.5, c = Math.cos(tk.a), s = Math.sin(tk.a);
      var bx = OW.x + c * ri, by = OW.y + s * ri, tx = OW.x + c * ro, ty = OW.y + s * ro;
      ctx.moveTo(bx - s * w0, by + c * w0);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + s * w0, by - c * w0);
      ctx.arc(bx, by, w0, tk.a + PI / 2, tk.a - PI / 2, false);
      ctx.closePath(); any = true;
      if (tk.dot && e > 0.55) {
        var dr = 3 * OW.size * (1 - sstep(0.18, 0.37, age)), dd = ro + (15 + 9 * e) * OW.size;
        if (dr > 0.2) { ctx.moveTo(OW.x + c * dd + dr, OW.y + s * dd); ctx.arc(OW.x + c * dd, OW.y + s * dd, dr, 0, TAU); }
      }
    }
    if (any) ctx.fill();
    ctx.restore();
  };
})();


/* ===== timeline.js ===== */
/* Timeline (baseline loop = scenario A; ROUND 10: the thinking phase lasts ~20 s, the loop ~38 s) + reaction clips (scenarios B/C/D/E) — all PURE functions of time; the scene integrates them.
   GA.timeline.build(W, {stride, strideRun}) -> T
     T.duration, T.cues        loop length (s) and named loop-local times
     T.poseAt(tl)              baseline girl pose at loop-local time tl (also valid for tl<0 : hair pre-roll)
     T.intensity(tl)           0..1 thinking energy (wind on hair)
     T.reaction(kind, cap, rt) -> controls for the reaction clip `kind` ('stand' | 'walk' | 'walkHop' | 'duck'), rt = seconds since the press;
                               cap = state captured at the press {x, yaw, speed, pose0, tl0}. Returns {pose (everything except x/phase), speed, run, stride, done, exited}
   Constants: V_WALK/V_RUN world units per second; M_RIGHT/M_LEFT distance beyond the screen edge at which she is completely out of sight. */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util;

  var V_WALK = 400; // relaxed child's walk = 0.8 body heights per second (round 10 GAIT: 2.1 steps/s with the rig's 380 u stride)
  var V_RUN = 940; // comedic scurry
  var M_RIGHT = 120; // root x beyond the right edge where the nose is just off-screen (she enters at once: no dead time)
  var M_LEFT = 200; // root x beyond the left edge where the ponytail has completely left
  var M_PARK = 260; // parking spot off the right edge (peek start / hidden)
  var PEEK_DX = 4; // peek root x beyond the right edge (rig geometry: with the root at W+4 hips, skirt and legs stay hidden at every moment of the slide-in / duck, no overshoot past W)
  var PEEK_LEAN = 1.5; // torso lean while peeking (~45 deg)

  function build(W, opts) {
    opts = opts || {};
    var G = GA.stage.groundY;
    var STRIDE = opts.stride || 410;
    var STRIDE_RUN = opts.strideRun || 340;
    var xStop = W * 0.5;
    var xStart = W + M_RIGHT;
    var c = {};

    // ---- 1. walk in from the right edge (already at full walking speed at t=0) ----
    var dDec = 190, dAcc = 190;
    var inD = xStart - xStop;
    var tDec = (2 * dDec) / V_WALK;
    var inCruise = (inD - dDec) / V_WALK;
    c.walkInEnd = inCruise + tDec;
    c.inCruise = inCruise;
    // ---- 2. turn to the front, think ~10 s ----
    c.turnFront0 = c.walkInEnd + 0.12;
    c.turnFront1 = c.turnFront0 + 1.05;
    c.thinkStart = c.turnFront1;
    c.dots = c.turnFront1 + 0.2; // thought dots rise
    c.swirlStart = c.dots + 0.9; // big dot launches the first arc
    c.swirlFull = c.swirlStart + 16.6; // the cloud is complete here (round 10: the thought process is 10 s LONGER, ~20 s in total)
    c.tHit = c.turnFront1 + 20.3; // ball bonks her head (≈20 s of thinking; was 10.3)
    c.ballIn = c.tHit - 1.55; // ball enters the screen
    // round-10 acts of the (now ~20 s) thought process, seconds after turnFront1: I spark 0-5.5, II ideas multiply 5.5-12, III overload 12-17.7, IV funnel tightens + ball 17.7-20.3
    c.actII = c.turnFront1 + 5.5;
    c.actIII = c.turnFront1 + 12.0;
    c.actIV = c.tHit - 2.6;
    // ---- 3. reaction ----
    c.owStart = c.tHit + 0.03;
    c.scratch0 = c.tHit + 0.85; // hand drifts up after the stagger
    c.scratch1 = c.tHit + 2.2;
    c.shake0 = c.tHit + 2.25;
    c.shake1 = c.shake0 + 1.15;
    c.turnLeft0 = c.shake1 - 0.1;
    c.turnLeft1 = c.turnLeft0 + 0.95;
    // ---- 4. walk away (walk, never run) out of the left edge ----
    c.walkOut0 = c.turnLeft1 - 0.2;
    var tAcc = (2 * dAcc) / V_WALK;
    var outD = xStop + M_LEFT; // distance to x = -M_LEFT
    c.walkOutEnd = c.walkOut0 + tAcc + (outD - dAcc) / V_WALK;
    // ---- 5. immediate peek from the right edge, withdraw, 1 s empty, loop ----
    c.teleport = c.walkOutEnd + 0.08; // she is off-screen left: hair sim reset, she is re-parked off-screen right
    c.peek0 = c.walkOutEnd + 0.4;
    c.peekIn1 = c.peek0 + 0.5;
    c.peekOut0 = c.peekIn1 + 1.5; // beats: look into the scene, double-take at the viewer, hold, shy duck-out
    c.peekOut1 = c.peekOut0 + 0.55;
    c.rebuild = c.peekOut1 + 0.25; // nothing on screen: modules are rebuilt here (no visible hitch)
    c.loopEnd = c.peekOut1 + 0.85;
    var duration = c.loopEnd;

    function distIn(t) {
      if (t <= 0) return V_WALK * t;
      if (t <= inCruise) return V_WALK * t;
      if (t >= c.walkInEnd) return inD;
      var tau = t - inCruise;
      return inD - dDec + V_WALK * 0.5 * (tau + (tDec / Math.PI) * Math.sin((Math.PI * tau) / tDec));
    }
    function speedIn(t) {
      if (t <= inCruise) return V_WALK;
      if (t >= c.walkInEnd) return 0;
      return V_WALK * 0.5 * (1 + Math.cos((Math.PI * (t - inCruise)) / tDec));
    }
    function distOut(t) {
      var tau = t - c.walkOut0;
      if (tau <= 0) return 0;
      if (tau <= tAcc) return V_WALK * 0.5 * (tau - (tAcc / Math.PI) * Math.sin((Math.PI * tau) / tAcc));
      return dAcc + V_WALK * (tau - tAcc);
    }
    function speedOut(t) {
      var tau = t - c.walkOut0;
      if (tau <= 0) return 0;
      if (tau >= tAcc) return V_WALK;
      return V_WALK * 0.5 * (1 - Math.cos((Math.PI * tau) / tAcc));
    }
    var amountOf = function (v) { return U.smoothstep(0.01, 0.3, v / V_WALK); }; // full stride until she is nearly stopped (less foot skating)
    // round 11: the steps SHRINK as she slows to a stop and GROW as she sets off (a real stop is a few short, quick steps; a constant stride at a falling speed is a wide-legged crawl).
    // phase = integral of speed / (STRIDE x kWalk(speed)); the rig scales its foot travel by the same factor (pose.gait.stride), so the planted feet still do not slide.
    var kWalk = function (v) { return U.lerp(0.5, 1, U.smoothstep(0.05, 0.75, v / V_WALK)); };
    var PH_N = 160, decPh = [0], accPh = [0], pi;
    for (pi = 1; pi <= PH_N; pi++) {
      var vD = V_WALK * 0.5 * (1 + Math.cos((Math.PI * (pi - 0.5)) / PH_N)), vA = V_WALK * 0.5 * (1 - Math.cos((Math.PI * (pi - 0.5)) / PH_N));
      decPh.push(decPh[pi - 1] + (vD / (STRIDE * kWalk(vD))) * (tDec / PH_N));
      accPh.push(accPh[pi - 1] + (vA / (STRIDE * kWalk(vA))) * (tAcc / PH_N));
    }
    function tab(a, u) { var f = U.clamp(u) * PH_N, i = Math.min(PH_N - 1, Math.floor(f)); return a[i] + (a[i + 1] - a[i]) * (f - i); }
    function phaseIn(t) {
      if (t <= inCruise) return (V_WALK * t) / STRIDE;
      if (t >= c.walkInEnd) return (V_WALK * inCruise) / STRIDE + decPh[PH_N];
      return (V_WALK * inCruise) / STRIDE + tab(decPh, (t - inCruise) / tDec);
    }
    function phaseOut(t) {
      var tau = t - c.walkOut0;
      if (tau <= 0) return 0.25;
      if (tau >= tAcc) return 0.25 + accPh[PH_N] + (V_WALK * (tau - tAcc)) / STRIDE;
      return 0.25 + tab(accPh, tau / tAcc);
    }
    function bump(t, a, b, c1, d) { return U.smoothstep(a, b, t) * (1 - U.smoothstep(c1, d, t)); }

    function turnLeftAt(t, headYawIn) {
      var ul = U.clamp((t - c.turnLeft0) / (c.turnLeft1 - c.turnLeft0));
      var lead = -0.55 * Math.sin(Math.PI * Math.min(1, ul * 1.1)) * (1 - U.smoothstep(0.8, 1, ul));
      return { yaw: 1 - U.easeInOutCubic(ul), headYaw: lead + headYawIn * (1 - U.smoothstep(0, 0.2, ul)), twist: -0.5 * Math.sin(Math.PI * (1 - (1 - ul) * (1 - ul))) };          // (head leads, then the shoulders, then the hips)
    }

    function intensity(t) {
      return U.smoothstep(c.swirlStart, c.swirlFull, t) * (1 - U.smoothstep(c.tHit, c.tHit + 0.6, t));
    }

    function newPose(t) {
      return {
        x: xStop, y: G, yaw: 0,
        gait: { amount: 0, phase: 0, speed: 0, run: 0 },
        headYaw: 0, headPitch: 0, headRoll: 0, lean: 0, peek: 0, flinch: 0, dizzy: 0, bow: 0, twist: 0, chestHand: 0, squash: 0, scratch: 0, scratchT: 0, think: 0, shudder: 0, shudderT: 0, air: 0,
        startle: 0, spread: 0, poke: 0, clutch: 0, shrug: 0, reach: 0, wave: 0, thinkT: -1,          // round 10: startle ticks, open hands, poke at the air, both hands to the head, sheepish shrug, reach down to the console, thinking-script clock (s since turnFront1, -1 = off)
        wind: { x: 0, y: 0 }, t: t,
      };
    }

    // ================= ROUND 10: the ~20 s THINKING PERFORMANCE (k = seconds after turnFront1).  Sync points shared with THOUGHTS (R10/tho/BEATS.json):
    //   bulbs k 2.4 6.2 9.8 13.4 16.2, fireworks 9.5 12.6 14.1 15.6 16.8, acts I 0 / II 5.5 / III 12.0 / IV 17.7, the ball enters at 18.75 (from the top-left), hit 20.3.
    //   Act I wonder (looks up at the first dot, temple tap, 'aha' bounce at the first bulb, pokes at a floating piece), II curiosity + delight (slow pursuit of an orbiting piece,
    //   fingertip tapping, happy bounces at the bulbs, eyes-wide shoulder lift at the first firework, a hop), III comic overload (both hands clutch the head, wobbles, the head
    //   whips after every firework, a dizzy sway, a hop of excitement), IV the funnel tightens (deer freeze, she spots the ball, alarm grows: hand to the chest, shoulders up,
    //   a cringe just before the hit).  The rig adds its own think-idle script (thinkT: E3 'aha' perk-up 2.4, E1 weight shift 5.8, E2 toe tap 7.3, E4 glance away 10.9) whenever
    //   her hands are free.  Everything is a smooth envelope on top of a dreamy base look-around; headYaw > 0 = toward screen-right (her left), headPitch > 0 = up. =================
    var BULBS = [2.4, 6.2, 9.8, 13.4, 16.2], FIRES = [9.5, 12.6, 14.1, 15.6, 16.8];
    function thinkPerf(p, k) {
      var K_HIT = c.tHit - c.turnFront1, K_BALL = c.ballIn - c.turnFront1, i, b, f, w, u;
      var settle = U.smoothstep(0, 1.2, k);
      var hy = (0.3 * Math.sin(k * 0.62 + 0.4) + 0.1 * U.noise1(k * 1.3, 5)) * settle;
      var hp = (0.22 + 0.1 * Math.sin(k * 0.7) + 0.1 * U.noise1(k * 0.9, 3)) * settle;
      var hr = 0.2 * Math.sin(k * 0.47 + 1.3) * settle;
      var sq = 0, air = 0, y = 0, fl = 0, dz = 0, ch = 0;
      function hop(k0, hgt) { // a small happy hop: crouch, up with the knees tucking a little, soft landing
        u = U.clamp((k - k0) / 0.3);
        y -= hgt * Math.sin(Math.PI * u);
        air = Math.max(air, 0.6 * bump(k, k0 - 0.02, k0 + 0.06, k0 + 0.22, k0 + 0.32));
        sq += 0.25 * bump(k, k0 - 0.14, k0 - 0.03, k0, k0 + 0.05) + 0.3 * bump(k, k0 + 0.27, k0 + 0.34, k0 + 0.38, k0 + 0.6);
      }
      // ---- ACT I (0-5.5): wonder
      var dotLook = bump(k, 0.25, 0.9, 1.9, 2.5);                       // the first dot rises up-right of her head: she looks up at it, head cocked
      hy += 0.35 * dotLook; hp += 0.42 * dotLook; hr += 0.22 * dotLook;
      p.think = bump(k, 0.95, 1.45, 2.0, 2.4);                            // 'hmm': fingertip at the temple, let go for the aha
      var aha = bump(k, 2.35, 2.5, 2.8, 3.4);                             // the first bulb (2.4): a happy bounce up on to the toes (+ the rig's E3 perk-up)
      sq -= 0.16 * aha; hp += 0.22 * aha;
      p.poke = bump(k, 3.0, 3.6, 4.3, 5.0);                               // a hand rises to poke at a floating piece; the head follows the hand
      hy += 0.3 * p.poke; hp += 0.25 * p.poke;
      hr -= 0.22 * bump(k, 4.9, 5.3, 5.7, 6.3);                           // the hand drops, the head cocks the other way
      // ---- ACT II (5.5-12): curiosity and delight
      var pursuit = U.smoothstep(5.6, 6.6, k) * (1 - U.smoothstep(11.4, 12.2, k));          // slow pursuit of an orbiting piece (one sweep each way in ~3 s)
      hy += 0.45 * Math.sin((k - 5.6) * 1.0) * pursuit; hp += 0.18 * Math.cos((k - 5.6) * 1.0) * pursuit;
      p.think = Math.max(p.think, bump(k, 8.5, 9.0, 10.2, 10.7));         // fingertip tapping the temple (after the rig's E2 toe tap at 7.3)
      for (i = 1; i < BULBS.length; i++) { b = BULBS[i]; w = bump(k, b - 0.05, b + 0.1, b + 0.3, b + 0.8); sq -= 0.14 * w; hp += 0.14 * w; }   // happy little bounces when the bulbs pop
      w = bump(k, 9.5, 9.65, 10.2, 10.8); fl += 0.35 * bump(k, 9.5, 9.62, 9.85, 10.3); hp += 0.45 * w; hy -= 0.2 * w;   // the first firework: eyes wide, shoulders up, looking up at it
      hop(9.85, 24); hop(16.25, 26);                                       // hops of excitement at the bulbs 9.8 / 16.2
      // ---- ACT III (12-17.7): comic overload
      p.clutch = U.smoothstep(12.0, 12.6, k) * (1 - U.smoothstep(14.5, 15.1, k));          // 'so many ideas!' both hands to the head
      w = p.clutch * U.smoothstep(12.6, 13.0, k); hr += 0.25 * Math.sin(Math.PI * 2 * 1.3 * (k - 12.6)) * w; hy += 0.12 * Math.sin(Math.PI * 2 * 0.9 * (k - 12.6)) * w;   // little wobbles
      dz = Math.max(0.3 * bump(k, 12.9, 13.4, 14.2, 14.8), 0.5 * bump(k, 15.1, 15.5, 15.9, 16.4));   // a dizzy sway
      for (i = 1; i < FIRES.length; i++) { f = FIRES[i]; w = U.smoothstep(f, f + 0.2, k) * (1 - U.smoothstep(f + 0.8, f + 1.3, k)); hy += (i & 1 ? -0.6 : 0.6) * w; hp += 0.4 * w; }   // the head whips after each firework
      // ---- ACT IV (17.7-20.3): the funnel tightens
      p.shudder = 0.55 * U.smoothstep(17.75, 17.95, k) * (1 - U.smoothstep(K_BALL + 0.3, K_BALL + 0.6, k)); p.shudderT = Math.max(0, k - 17.8);   // deer freeze (soft: recoil, blink, stillness, hands half-way up) until she spots the ball
      hr += 0.18 * U.smoothstep(17.9, 18.4, k) * (1 - U.smoothstep(K_BALL + 0.1, K_BALL + 0.3, k));                 // ... head cocked: curious and a little worried
      var spot = U.smoothstep(K_BALL + 0.1, K_BALL + 0.3, k) * (1 - U.smoothstep(K_HIT - 0.18, K_HIT - 0.04, k));   // she spots the ball coming from the top-left: the head snaps to it and follows it up
      hy = U.lerp(hy, -0.6, spot); hp = U.lerp(hp, 0.6 + 0.35 * U.smoothstep(K_BALL + 0.3, K_HIT - 0.3, k), spot); hr = U.lerp(hr, -0.15, spot);
      ch = 1.4 * U.smoothstep(K_BALL + 0.5, K_BALL + 0.85, k) * (1 - U.smoothstep(K_HIT - 0.12, K_HIT, k));        // 'oh no': the hand flies to the mouth
      sq -= 0.12 * bump(k, K_BALL + 0.45, K_BALL + 0.6, K_BALL + 0.7, K_BALL + 1.0);                                    // ... with a little jolt up on to the toes
      fl = Math.max(fl, (0.2 * U.smoothstep(K_BALL + 0.9, K_HIT - 0.35, k) + 0.7 * U.smoothstep(K_HIT - 0.25, K_HIT - 0.05, k)) * (1 - U.smoothstep(K_HIT - 0.02, K_HIT + 0.02, k)));   // growing alarm: shoulders up, then the cringe
      var cringe = U.smoothstep(K_HIT - 0.18, K_HIT - 0.04, k);           // she shuts her eyes, turns away and ducks a little... BONK
      hy = U.lerp(hy, 0.35, cringe); hp = U.lerp(hp, -0.2, cringe);
      p.headYaw = U.clamp(hy, -1, 1); p.headPitch = U.clamp(hp, -1, 1); p.headRoll = U.clamp(hr, -1, 1);
      p.squash += sq; p.air = air; p.y = G + y; p.flinch = Math.max(p.flinch, fl); p.dizzy = Math.max(p.dizzy, dz); p.chestHand = Math.max(p.chestHand, ch);
    }

    /** baseline pose (scenario A) at loop-local time t */
    function poseAt(t) {
      var p = newPose(t);
      var I = intensity(t);

      if (t < c.walkInEnd) { // walk in
        var d = distIn(t);
        p.x = xStart - d;
        p.gait.speed = speedIn(t);
        p.gait.amount = amountOf(p.gait.speed);
        p.gait.phase = phaseIn(t);
        p.gait.stride = STRIDE * kWalk(p.gait.speed);
        p.headPitch = 0.04 * Math.sin(t * 5.2) + 0.5 * bump(t, 1.9, 2.4, 3.0, 3.5); // a quick glance up at the empty centre
        return p;
      }

      if (t < c.walkOut0) { // stand, turn, think, get hit, react, turn away
        p.x = xStop;
        var u = U.clamp((t - c.turnFront0) / (c.turnFront1 - c.turnFront0));
        p.yaw = U.easeInOutCubic(u);
        p.headYaw = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - U.smoothstep(0.85, 1, u));
        p.twist = 0.5 * Math.sin(Math.PI * (1 - (1 - u) * (1 - u)));          // overlapping action: the shoulders are ahead of the hips during the turn
        // round 11: she turns to the viewer with a quick shy hello (the right hand waves for ~0.8 s as she comes round, head tilted, then she is off into her thoughts)
        var hello = bump(t, c.turnFront0 + 0.4, c.turnFront0 + 0.72, c.turnFront1 + 0.14, c.turnFront1 + 0.48);
        p.wave = hello; p.headRoll += 0.2 * hello; p.headPitch += 0.08 * hello;

        var windX = 0;
        if (t >= c.turnFront1) {
          var k = t - c.turnFront1;
          p.thinkT = k;          // the rig's think-idle script clock (weight shift, toe tap, 'aha' perk-up, glance away: cfg.ideaT, seconds after turnFront1)
          p.twist = 0.1 * Math.exp(-3.2 * k) * Math.sin(Math.PI * 2.2 * k) * U.smoothstep(0, 0.15, k);          // the shoulders settle with a small damped swing
          thinkPerf(p, k);        // the 20 s performance (acts I-IV, ends with the cringe at the hit)
        }

        // impact: squash with hold and elastic recovery (the girl module turns this into a comedic body reaction); round 10: bigger squash and stretch overshoot,
        // a springy head wobble after the hold, the ponytail whips (wind), then 'seeing stars' = a slow circling of the head while she staggers
        var h = t - c.tHit;
        if (h >= 0) {
          var attack = U.smoothstep(0, 0.07, h);
          var HOLD = 0.2; // the bottom of the squash is held ~3 frames
          var rel = h < HOLD ? 0 : 1 - Math.exp(-(h - HOLD) * 4.2) * Math.cos((h - HOLD) * 12);
          p.squash = h < HOLD ? 1.15 * attack : U.clamp(1.15 * (1 - rel), -0.4, 1.3); // overshoots into a visible stretch (boing) before settling
          p.dizzy = U.smoothstep(0.12, 0.4, h) * (1 - U.smoothstep(0.9, 1.6, h)); // staggering wobble after the bonk
          p.shudder = 0.55 * U.smoothstep(0.05, 0.2, h) * (1 - U.smoothstep(0.45, 0.8, h)); // stunned wobble right after the bonk
          p.shudderT = h;
          p.headPitch = U.lerp(p.headPitch, -0.55, U.smoothstep(0, 0.1, h) * (1 - U.smoothstep(0.4, 1.0, h)));
          p.headYaw = U.lerp(p.headYaw, 0, U.smoothstep(0, 0.2, h));
          p.headRoll = U.lerp(p.headRoll, 0.3, U.smoothstep(0, 0.2, h) * (1 - U.smoothstep(0.9, 1.6, h)));
          var hw = h - HOLD;
          if (hw > 0) { var wobE = Math.exp(-3.2 * hw); p.headRoll += 0.32 * wobE * Math.sin(Math.PI * 2 * 5.2 * hw); p.headYaw += 0.14 * wobE * Math.sin(Math.PI * 2 * 4.1 * hw); }
          var stars = bump(h, 0.35, 0.6, 1.25, 1.65), sa = Math.PI * 2 * 1.25 * (h - 0.35);
          p.headYaw += 0.3 * Math.sin(sa) * stars; p.headRoll += 0.28 * (Math.cos(sa) - 1) * stars; p.headPitch += 0.12 * Math.sin(sa + 1) * stars;
          windX += 420 * bump(h, 0, 0.05, 0.12, 0.32) - 320 * bump(h, 0.26, 0.36, 0.46, 0.72);
        }

        if (t >= c.scratch0 && t < c.scratch1 + 0.45) { // scratching the bonked spot
          var up = U.easeOutBack(U.clamp((t - c.scratch0) / 0.38), 1.2);
          var down = 1 - U.smoothstep(0, 1, U.clamp((t - c.scratch1) / 0.4));
          p.scratch = U.clamp(up * down, 0, 1.05);
          p.scratchT = t - c.scratch0;
          p.headRoll = U.lerp(p.headRoll, 0.2 * Math.sin(p.scratchT * 9), 0.5 * p.scratch);
          p.headPitch = U.lerp(p.headPitch, -0.2, 0.7 * p.scratch);
        }

        var SH1 = c.shake0 + 0.75;          // round 10: a shorter head shake, then a sheepish shrug before she turns away
        if (t >= c.shake0 && t < SH1) { // shake the head (no!)
          var s = (t - c.shake0) / (SH1 - c.shake0);
          var env = Math.sin(Math.PI * Math.min(1, s * 1.05)) * (1 - 0.25 * s);
          var kS = U.smoothstep(c.shake0, c.shake0 + 0.18, t); // cross-fade from the scratch head pose (no 1-frame pop)
          p.headYaw = U.lerp(p.headYaw, 0.95 * env * Math.sin(s * Math.PI * 4.0), kS);
          p.headRoll = U.lerp(p.headRoll, 0.15 * env * Math.sin(s * Math.PI * 4.0 + 1.4), kS);
          p.headPitch = U.lerp(p.headPitch, -0.1 * env, kS);
        }
        // sheepish shrug ('oops... well.'): shoulders up, palms out, head cocked; the turn away blends it out
        var shr = bump(t, SH1 - 0.1, SH1 + 0.22, c.turnLeft0 + 0.15, c.turnLeft0 + 0.55);
        p.shrug = shr; p.headRoll = U.lerp(p.headRoll, 0.3, shr); p.headPitch = U.lerp(p.headPitch, -0.12, shr); p.headYaw = U.lerp(p.headYaw, 0.15, 0.8 * shr);

        if (t >= c.turnLeft0) {
          var tl = turnLeftAt(t, p.headYaw), tb = U.smoothstep(c.turnLeft0, c.turnLeft0 + 0.3, t);
          p.yaw = tl.yaw; p.headYaw = tl.headYaw; p.twist = tl.twist; p.headPitch = U.lerp(p.headPitch, 0, tb); p.headRoll = U.lerp(p.headRoll, 0, tb);
        }
        p.wind.x = 260 * I * Math.sin(t * 1.9 + 0.6) + windX;
        p.wind.y = -110 * I * (0.6 + 0.4 * Math.sin(t * 1.3));
        return p;
      }

      if (t < c.walkOutEnd + 0.08) { // walk away to the left edge
        var dO = distOut(t);
        p.x = xStop - dO;
        p.gait.speed = speedOut(t);
        p.gait.amount = amountOf(p.gait.speed);
        p.gait.phase = phaseOut(t);
        p.gait.stride = STRIDE * kWalk(p.gait.speed);
        var tl2 = turnLeftAt(t, 0);
        p.yaw = tl2.yaw; p.headYaw = tl2.headYaw; p.twist = tl2.twist;
        p.headPitch = 0.03 * Math.sin(t * 5.2);
        // round 11: two looks back over the shoulder at the rubble (a real turn of the head AND the shoulders, ~110 deg in all: the first one long and puzzled with a tiny shrug, 'well, that
        // happened'; the second one a quick nervous double-check), the head leading the shoulders by ~0.08 s and the pony following
        var lb1 = bump(t, c.walkOut0 + 0.55, c.walkOut0 + 0.95, c.walkOut0 + 1.55, c.walkOut0 + 1.95), lb2 = bump(t, c.walkOut0 + 2.55, c.walkOut0 + 2.78, c.walkOut0 + 2.98, c.walkOut0 + 3.28);
        var lb = Math.max(lb1, lb2), lbS = Math.max(bump(t, c.walkOut0 + 0.63, c.walkOut0 + 1.03, c.walkOut0 + 1.5, c.walkOut0 + 1.9), bump(t, c.walkOut0 + 2.62, c.walkOut0 + 2.84, c.walkOut0 + 2.96, c.walkOut0 + 3.2));
        p.headYaw = U.clamp(p.headYaw + 1.55 * lb, -1.6, 1.6); p.twist += 1.0 * lbS; p.headPitch += -0.12 * lb1 + 0.05 * lb2;
        p.shrug = 0.5 * bump(t, c.walkOut0 + 1.1, c.walkOut0 + 1.3, c.walkOut0 + 1.5, c.walkOut0 + 1.85);          // ... with a tiny comic shrug ('well, that happened')
        p.headRoll = 0.2 * p.shrug + 0.18 * lb1;
        return p;
      }

      // off-screen beat, then peek from the right edge
      p.x = W + M_PARK;
      p.yaw = 0;
      if (t >= c.peek0 && t < c.peekOut1 + 0.05) {
        var X_PEEK = W + PEEK_DX; // hips+legs stay beyond the edge; the leaning torso shows head + upper torso
        var inK = U.easeOutCubic(U.clamp((t - c.peek0) / (c.peekIn1 - c.peek0))); // (no overshoot: the lower body must never cross the edge)
        var outK = U.easeInCubic(U.clamp((t - c.peekOut0) / (c.peekOut1 - c.peekOut0)));
        var vis = inK * (1 - outK);
        p.x = U.lerp(W + M_PARK, X_PEEK, vis);
        p.peek = U.smoothstep(0, 1, vis);
        var q = t - c.peekIn1;
        var look = U.smoothstep(-0.1, 0.25, q) * (1 - U.smoothstep(1.3, 1.5, q));
        // beat 1 (0-0.6 s): scans the empty stage; beat 2 (0.6-1.05 s): quick DOUBLE-TAKE toward the viewer with a startle bounce; beat 3: holds the gaze
        var take = U.easeOutBack(U.clamp((q - 0.6) / 0.22), 1.4) * (1 - U.smoothstep(1.2, 1.5, q));
        p.headPitch = U.clamp(look * (0.1 + 0.18 * Math.sin(Math.max(0, q) * 3.0)), -1, 1);
        p.headYaw = U.clamp(look * 0.35 * Math.sin(Math.max(0, q) * 4.2) * (1 - take) + 0.9 * take, -1, 1);
        p.headRoll = look * 0.14 * Math.sin(Math.max(0, q) * 2.1);
        p.flinch = Math.max(p.flinch, 0.4 * bump(q, 0.58, 0.68, 0.74, 1.0) + 0.5 * bump(t, c.peekOut0 - 0.05, c.peekOut0 + 0.1, c.peekOut0 + 0.2, c.peekOut0 + 0.4));
        p.x += 5 * (0.5 - 0.5 * Math.cos(Math.max(0, q) * 2.4)) * look; // a little weight sway while she looks around (outward only: never toward the edge)
      }
      return p;
    }

    /** a reaction clip: controls as a pure function of rt (seconds since the press) and the state captured at the press.
        Everything the baseline had in progress at the press (scratch arm, squash, stagger, think hand...) is released smoothly (no one-frame pops). */
    function reaction(kind, cap, rt) {
      var p0 = cap.pose0, o = { pose: newPose(p0.t + rt), speed: 0, run: 0, done: false, exited: false };
      var P = o.pose;
      var ease = function (a, b) { return U.easeOutCubic(U.clamp((rt - a) / (b - a))); };
      var lerpc = function (from, to, a, b) { return U.lerp(from, to, ease(a, b)); };
      function shudderEnv(a, b, c1, d) { return U.smoothstep(a, b, rt) * (1 - U.smoothstep(c1, d, rt)); }
      // the inherited baseline motion fades out over ~0.3 s instead of vanishing in one frame
      var rel0 = 1 - U.smoothstep(0, 0.3, rt);
      P.scratch = (p0.scratch || 0) * rel0; P.scratchT = (p0.scratchT || 0) + rt;
      P.squash = (p0.squash || 0) * (1 - U.smoothstep(0, 0.22, rt));
      P.dizzy = (p0.dizzy || 0) * (1 - U.smoothstep(0, 0.4, rt));
      P.think = (p0.think || 0) * (1 - U.smoothstep(0, 0.25, rt));
      P.twist = (p0.twist || 0) * (1 - U.smoothstep(0, 0.3, rt));
      P.clutch = (p0.clutch || 0) * (1 - U.smoothstep(0, 0.25, rt)); P.poke = (p0.poke || 0) * (1 - U.smoothstep(0, 0.25, rt)); P.shrug = (p0.shrug || 0) * rel0; P.reach = (p0.reach || 0) * rel0;
      P.wind.x = (p0.wind && p0.wind.x || 0) * rel0; P.wind.y = (p0.wind && p0.wind.y || 0) * rel0;

      if (kind === 'duck') { // startled peek: a visible flinch, then she slips back out (no cut)
        var startVis = U.clamp((cap.x - (W + M_PARK)) / (cap.xPeek - (W + M_PARK)), 0, 1.2);
        var back = U.easeInOutCubic(U.clamp((rt - 0.12) / 0.38));
        var vis = startVis * (1 - back);
        P.x = U.lerp(W + M_PARK, cap.xPeek, vis);
        P.yaw = 0; P.peek = U.smoothstep(0, 1, vis);
        P.flinch = Math.sin(Math.PI * U.clamp(rt / 0.5)) * 0.95;
        P.headPitch = lerpc(p0.headPitch, -0.4, 0, 0.14);
        P.headYaw = lerpc(p0.headYaw, 0.3, 0, 0.14);
        P.shudder = shudderEnv(0.0, 0.08, 0.22, 0.4); P.shudderT = rt;
        o.done = rt > 0.62; o.noMove = true;
        return o;
      }

      // ================= ROUND 10: the '+' reaction as four overlapping beats (B standing / C walking in / D walking away) =================
      //   1 LOOK DOWN at the console (0 .. T0, held to TH with a 'huh?' head wobble): the head turns toward the plus and the chin drops, the upper body bows after it,
      //     one hand rises to the mouth (gasp), the ponytail swings forward (wind pulse).  B: the body turns three-quarter (so the chin-down reads in silhouette).
      //   2 STARTLED JUMP (TH .. TL): anticipation crouch (TC), take-off stretch, HJ units up with the legs tucked, arms flung up with open spread hands, head snapped
      //     back, startle ticks over the crown; a soft landing squash with a wobble.  B: she turns to face us while in the air (the flung pose reads frontally).
      //   3 TURN BACK (TT0 .. TT1): to the escape direction (screen left): head leads, shoulders, hips; a quick glance back over the shoulder at the plus as she goes.
      //   4 RUN (from TR): coil (lean back + crouch), burst with a comic lean overshoot that settles into the run lean; the head snaps forward after the glance.
      var standing = kind === 'stand', hop = kind === 'walkHop', away = kind === 'walk';
      var sm = function (a, b) { return U.smoothstep(a, b, rt); };
      var bm = function (a, b, c1, d) { return bump(rt, a, b, c1, d); };
      var T0 = standing ? 0.40 : 0.36;            // the look is complete
      var TH = standing ? 0.84 : 0.64;            // the hold ends: the anticipation crouch starts (B: the hold has the reach-down beat)
      var TC = 0.11, TJ = TH + TC;                // crouch length, take-off
      var TA = standing ? 0.42 : 0.38, TL = TJ + TA, HJ = standing ? 58 : 48;   // air time, landing, jump height
      var TT0 = TL + 0.04, TT1 = TT0 + (standing ? 0.40 : 0.20);   // the turn back (B: front -> profile)
      var TR = standing ? TT1 - 0.06 : TL + 0.22;  // the run starts (speed ramps from here)
      var TG = standing ? TT1 - 0.12 : TL + 0.1;   // the glance back over the shoulder starts (while she coils; it lasts into the burst: running while looking back)

      var look = ease(0, T0);
      var holdW = sm(T0 - 0.06, T0 + 0.1) * (1 - sm(TH - 0.08, TH + 0.02)), tw = rt - T0;
      var wobR = 0.32 * holdW * Math.sin(Math.PI * 2 * 1.9 * tw) * Math.exp(-1.2 * Math.max(0, tw)), wobY = 0.1 * holdW * Math.sin(Math.PI * 2 * 1.4 * tw + 0.5);   // 'huh? what's that?' (a visible head tilt, then a smaller one)
      var lookRel = 1 - sm(TJ - 0.05, TJ + 0.07);          // the look pose lets go at the take-off
      var headUp = sm(TJ - 0.03, TJ + 0.1);                 // the head snaps back / up in the jump
      var landW = sm(TL - 0.05, TL + 0.14);
      var uA = U.clamp((rt - TJ) / TA), inAir = sm(TJ, TJ + 0.1) * (1 - sm(TL - 0.14, TL - 0.02));
      var glance = bm(TG, TG + 0.14, TG + 0.26, TG + 0.46);
      var ut = U.clamp((rt - TT0) / (TT1 - TT0)), turnK = U.easeInOutCubic(ut);

      // ---- beat 1 + 2: look / jump (per scenario, blended from the captured pose)
      if (standing) {
        P.yaw = U.lerp(U.lerp(p0.yaw, 0.45, look), 0.9, sm(TJ, TL - 0.06));   // three-quarter for the look (the head sits forward of the shoulders, chin and neck notch visible), back to (nearly) front in the air
        P.headYaw = U.lerp(p0.headYaw, -0.5, ease(0, 0.32)) + wobY;
        P.headYaw = U.lerp(P.headYaw, 0, headUp);
        P.headPitch = U.lerp(p0.headPitch, -0.85, ease(0.04, 0.36)) - 0.15 * bm(T0 + 0.2, T0 + 0.3, T0 + 0.36, T0 + 0.48);   // (+ a second small double-take nod as the hand reaches)
        P.headRoll = U.lerp(p0.headRoll, 0.22, look) + wobR;
        P.bow = (0.8 + 0.1 * sm(T0, TH)) * look * lookRel;
        P.chestHand = 1.45 * sm(0.06, 0.34) * lookRel;
        P.reach = sm(T0 + 0.06, T0 + 0.34) * (1 - sm(TH - 0.05, TH + 0.05));   // 'what is THAT?': the free hand reaches down toward the console, then snatches back at the startle
      } else if (hop) { // C: walking in (profile), the plus is ahead of her, down-left: the head turns toward the viewer and down, the upper body leans in
        P.yaw = p0.yaw;
        P.headYaw = U.lerp(p0.headYaw, 0.8, ease(0, 0.3)) + wobY;
        P.headYaw = U.lerp(P.headYaw, 0, headUp);
        P.headPitch = U.lerp(p0.headPitch, -1, ease(0.04, 0.34));
        P.headRoll = U.lerp(p0.headRoll, 0.2, look) + wobR;
        P.bow = 0.6 * look * lookRel;
        P.chestHand = 1.35 * sm(0.06, 0.32) * lookRel;
      } else { // D: walking away (profile), the plus is behind her, down-right: an over-the-shoulder look back (the upper body twists toward the viewer), chin down
        P.yaw = p0.yaw;
        P.twist = U.lerp(P.twist, 0.95, ease(0, 0.34));
        P.twist = U.lerp(P.twist, 0.22, sm(TJ, TL - 0.04));          // she 'jumps out of her skin' and lands nearly straight again
        P.headYaw = U.lerp(p0.headYaw, 0.95, ease(0, 0.3)) + wobY;
        P.headYaw = U.lerp(P.headYaw, 0.1, headUp);
        P.headPitch = U.lerp(p0.headPitch, -0.85, ease(0.04, 0.34));
        P.headRoll = U.lerp(p0.headRoll, 0.18, look) + wobR;
        P.bow = 0.35 * look * lookRel;
        P.chestHand = 1.3 * sm(0.06, 0.32) * lookRel;
      }
      P.headPitch = U.lerp(P.headPitch, 0.55, headUp);              // head snapped back in the air
      P.headPitch = U.lerp(P.headPitch, 0.08, landW);
      P.headRoll = U.lerp(P.headRoll, 0, headUp);
      // the jump: crouch, stretch at the take-off, flight (parabola), landing squash + wobble, open hands + startle ticks
      P.squash += 0.55 * bm(TH, TJ - 0.02, TJ, TJ + 0.06) - 0.32 * bm(TJ, TJ + 0.06, TJ + 0.2, TJ + 0.34) + 0.6 * bm(TL - 0.03, TL + 0.06, TL + 0.1, TL + 0.3);
      if (rt > TL + 0.3) P.squash += 0.16 * Math.exp(-6 * (rt - TL - 0.3)) * Math.sin(Math.PI * 2 * 4 * (rt - TL - 0.3));          // the landing wobble
      P.air = inAir;
      P.y = G - HJ * 4 * uA * (1 - uA);
      P.spread = sm(TJ, TJ + 0.12) * (1 - sm(TL, TL + 0.2));
      P.startle = sm(TJ - 0.02, TJ + 0.06) * (1 - sm(TJ + 0.24, TJ + 0.36));
      P.flinch = Math.max(P.flinch, 0.7 * bm(TL - 0.02, TL + 0.1, TL + 0.2, TL + 0.5));          // landed: shoulders up, hands drawn in as little paws (the startled stare)
      P.wind.x += -(standing ? 130 : 110) * bm(0.04, 0.2, 0.3, 0.6) + 160 * bm(TJ, TJ + 0.1, TJ + 0.2, TJ + 0.5);    // the ponytail swings forward and hangs over the shoulder, then whips in the jump
      P.wind.y += (standing ? 170 : 60) * bm(0.1, 0.3, 0.55, 0.85);

      // ---- beat 3: turn back (B: body front -> profile with the head leading and the shoulders ahead of the hips); the glance back over the shoulder (all)
      if (standing) {
        P.yaw = U.lerp(P.yaw, 0, turnK);
        P.headYaw = U.lerp(P.headYaw, -0.55 * Math.sin(Math.PI * Math.min(1, ut * 1.1)), sm(TT0 - 0.02, TT0 + 0.08));
        P.twist += -0.5 * Math.sin(Math.PI * (1 - (1 - ut) * (1 - ut))) * sm(TT0 - 0.02, TT0 + 0.05);
      }
      P.headYaw = U.lerp(P.headYaw, 1.3, glance);          // round 11: a real look back over the shoulder (head ~70 deg + the shoulders ~25 deg), not a half turn
      P.headPitch = U.lerp(P.headPitch, -0.3, glance);
      P.twist += (standing ? 0.5 : 0.6) * glance;

      // ---- beat 4: coil and burst into the run (comic lean overshoot), head snaps forward
      // round 11: the wind-up leans her back, the burst throws her far forward (~27 deg) and the lean settles (~23 deg) once the speed is there
      var g2 = bm(TR + 0.8, TR + 0.98, TR + 1.2, TR + 1.42);          // the second look back, over the shoulder, while running flat out
      P.lean = -0.4 * bm(TR - 0.14, TR - 0.03, TR + 0.03, TR + 0.15) + 0.9 * sm(TR + 0.03, TR + 0.36) + 0.4 * bm(TR + 0.12, TR + 0.3, TR + 0.5, TR + 1.1) - 0.5 * g2;
      P.headYaw = U.lerp(P.headYaw, 1.45, g2); P.headPitch = U.lerp(P.headPitch, 0.05, g2); P.twist += 0.85 * g2; P.headRoll = U.lerp(P.headRoll, -0.2, g2);
      P.squash += 0.4 * bm(TR - 0.1, TR, TR + 0.06, TR + 0.18);
      var vRun = V_RUN * U.easeOutQuad(U.clamp((rt - TR) / 0.62)), vLow = 0;          // round 11: 0.62 s to top speed (was 0.45): the first steps are really short and quick before she is up to speed
      if (standing) o.speed = vRun;
      else { // walking: she slows to a near-stop for the look + hop (the hop is on the spot), then the run
        vLow = U.lerp(cap.speed, 0.42 * V_WALK, sm(0, 0.3)) * (1 - 0.78 * sm(TH - 0.05, TJ));
        o.speed = Math.max(vLow, vRun);
      }
      o.run = U.smoothstep(0.35, 0.8, o.speed / V_RUN);
      var spdN = o.speed / V_WALK, amtRun = U.smoothstep(0.01, 0.3, spdN) * sm(TR - 0.02, TR + 0.26);          // the stride builds up over ~0.25 s at the burst (no one-frame leg pop; the rig lifts the swing foot while the amount ramps)
      P.gait.amount = standing ? amtRun : Math.max(amtRun, U.smoothstep(0.01, 0.3, vLow / V_WALK));
      P.gait.run = o.run;
      P.gait.speed = o.speed;
      P.wind.x += 140 * o.run; P.wind.y += -40 * o.run;
      o.TR = TR;
      return o;
    }

    return {
      W: W, duration: duration, cues: c, V_WALK: V_WALK, V_RUN: V_RUN, M_RIGHT: M_RIGHT, M_LEFT: M_LEFT, M_PARK: M_PARK, xStop: xStop, xStart: xStart,
      STRIDE: STRIDE, STRIDE_RUN: STRIDE_RUN, poseAt: poseAt, reaction: reaction, intensity: intensity, newPose: newPose,
      xPeek: W + PEEK_DX,
      shadowFor: function (p) {
        var w = U.lerp(150, 175, p.yaw) + 40 * Math.max(p.gait.amount, p.gait.run) + 30 * p.air;
        var sq = Math.max(0, p.squash);
        return { x: p.x + 8, w: w * (1 + 0.18 * sq) * (1 - 0.25 * p.air), h: 26 * (1 + 0.1 * sq), alpha: 0.2 * (1 - 0.35 * p.air) * (1 - 0.97 * Math.min(1, p.peek || 0)) };
      },
      phaseName: function (t) {
        if (t < c.walkInEnd) return 'walk in';
        if (t < c.turnFront1) return 'turn to front';
        if (t < c.swirlStart) return 'thought dots';
        if (t < c.ballIn) return 'thinking: swirl builds';
        if (t < c.tHit) return 'ball incoming';
        if (t < c.scratch1) return 'bonk + reaction + shatter';
        if (t < c.shake1) return 'shake head';
        if (t < c.walkOut0) return 'turn left';
        if (t < c.walkOutEnd) return 'walk out left';
        if (t < c.peek0) return 'empty';
        if (t < c.peekOut1) return 'peek from right';
        return 'empty (1 s)';
      },
    };
  }

  GA.timeline = { build: build, V_WALK: V_WALK, V_RUN: V_RUN, M_RIGHT: M_RIGHT, M_LEFT: M_LEFT, M_PARK: M_PARK };
})();


/* ===== dust.js ===== */
/* Round 11: ground dust for the dash (soft grey puffs kicked up by the feet, a cloud at the take-off) and a few thin speed strokes.
   GA.dust.reset()  GA.dust.puff(x, y, {n, r0, r1, vx, vy, life, a, spread})  GA.dust.streak(x, y, len, life, a)  GA.dust.step(dt)  GA.dust.draw(ctx)  GA.dust.live()
   World units (y down).  Everything is drawn as plain filled circles / lines in the page's greys (no blur, no gradient: nothing for the GPU to compile). */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util;
  var puffs = [], streaks = [], seed = 7, D = (GA.dust = {});
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  D.rand = rnd;
  D.reset = function () { puffs.length = 0; streaks.length = 0; seed = 7; };
  D.live = function () { return puffs.length + streaks.length; };
  /** a cluster of n soft discs that grow, drift (vx, vy in units/s, decaying) and fade over `life` seconds */
  D.puff = function (x, y, o) {
    o = o || {};
    var n = o.n || 3, i, c = [];
    if (puffs.length > 40) puffs.shift();
    for (i = 0; i < n; i++) {
      var a = rnd() * 6.2832, d = rnd() * (o.spread === undefined ? 8 : o.spread);
      c.push({ ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.5 - rnd() * 6, r: (o.r0 || 6) * (0.7 + 0.6 * rnd()), g: (o.r1 || 18) * (0.7 + 0.6 * rnd()), dx: (rnd() - 0.5) * 40, dy: -rnd() * 26 });
    }
    puffs.push({ x: x, y: y, vx: o.vx || 0, vy: o.vy || 0, age: 0, life: o.life || 0.7, a: o.a === undefined ? 0.5 : o.a, c: c });
  };
  /** a thin horizontal speed stroke: it starts at x and trails `len` units behind (dir = +1: the trail lies to the right of x) */
  D.streak = function (x, y, len, life, a, dir) {
    if (streaks.length > 24) streaks.shift();
    streaks.push({ x: x, y: y, len: len, age: 0, life: life || 0.28, a: a === undefined ? 0.55 : a, dir: dir || 1 });
  };
  D.step = function (dt) {
    var i, p, k;
    for (i = puffs.length - 1; i >= 0; i--) {
      p = puffs[i]; p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      k = Math.exp(-2.4 * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = streaks.length - 1; i >= 0; i--) { streaks[i].age += dt; if (streaks[i].age >= streaks[i].life) streaks.splice(i, 1); }
  };
  D.draw = function (ctx) {
    var i, j, p, c, u, e, st = GA.style, r;
    if (!puffs.length && !streaks.length) return;
    ctx.save();
    ctx.fillStyle = st.GRAY3;
    for (i = 0; i < puffs.length; i++) {
      p = puffs[i]; u = p.age / p.life; e = 1 - Math.pow(1 - u, 3);
      ctx.globalAlpha = p.a * Math.pow(1 - u, 1.3) * Math.min(1, p.age / 0.04);
      ctx.beginPath();
      for (j = 0; j < p.c.length; j++) {
        c = p.c[j]; r = c.r + (c.g - c.r) * e;
        ctx.moveTo(p.x + c.ox + c.dx * e + r, p.y + c.oy + c.dy * e);
        ctx.arc(p.x + c.ox + c.dx * e, p.y + c.oy + c.dy * e, r, 0, 6.2832, false);
      }
      ctx.fill();
    }
    ctx.strokeStyle = st.INK; ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
    for (i = 0; i < streaks.length; i++) {
      p = streaks[i]; u = p.age / p.life;
      ctx.globalAlpha = p.a * (1 - u) * Math.min(1, p.age / 0.03);
      var l = p.len * (0.35 + 0.65 * Math.min(1, u * 3));
      ctx.beginPath(); ctx.moveTo(p.x + p.dir * u * 40, p.y); ctx.lineTo(p.x + p.dir * (u * 40 + l), p.y); ctx.stroke();
    }
    ctx.restore();
  };
})();


/* ===== scene.js ===== */
/* Scene = forward-stepping director + renderer for the interactive landing animation.
   Fixed-step logic (1/120 s) so hair physics and reactions are deterministic; the render loop just feeds real dt.
   Modes:  'loop'  baseline sequence (scenario A), loop-local time tl
           'react' a reaction clip after the nav '+' was pressed (scenarios B/C/D, and the startled duck while peeking)
           'away'  she has run off-screen; waiting for the thoughts/cubes to finish and (if the menu is open) for it to close
   Public API (used by site.js and by the test harness):
     init(canvas, opts) restart() prepareRestart() press() setNavOpen(bool) navClosed() advanceTo(t) advanceBy(s) render() state() pause() play() resize()
   Testing: restart(); advanceTo(7.3); press(); advanceTo(9.0); render()   — all deterministic. */
(function () {
  var GA = (window.__landingGirl = window.__landingGirl || {});
  var U = GA.util, S = GA.stage;
  var DT = 1 / 120;
  var HEAVY_AT = 1.6; // loop time at which the heavy modules start building (idle slices, during the walk-in cruise; the very first loop starts 0.8 s in)

  var sc = (GA.scene = {
    mode: 'loop', tl: 0, T: null, girl: null, pose: null, R: null, trig: {}, navOpen: false, canvas: null, visible: true, live: true,
    heavyReady: false, playing: false, _raf: 0, _last: 0, _lastRender: 0, acc: 0, debug: false, bg: 'transparent', _errs: {}, reduced: false,
    ticks: 0, awayAt: 0, resumeTl: 0, impactTicks: true, fresh: false, _snaps: {}, heavyStarted: false, _gov: { dts: [], hist: [], prev: 0, last: -1e9, level: 0 }, _warm: { done: false }, _ri: 0, _par: false,
  });

  function safe(name, fn) {
    try { return fn(); } catch (e) { if (!sc._errs[name]) { sc._errs[name] = 1; if (window.console) console.error('[girl-animation:' + name + ']', e); } }
  }
  function later(fn, ms) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: ms || 300 });
    else window.setTimeout(fn, ms ? Math.min(ms, 80) : 40);
  }

  // ---------------------------------------------------------------- build
  sc.buildCore = function () {
    var W = S.W;
    sc.girl = GA.createGirl({ height: 500 });
    sc.T = GA.timeline.build(W, { stride: sc.girl.STRIDE, strideRun: sc.girl.STRIDE_RUN });
    sc.W = W; sc._snaps = {};
    // the faint ground specks are cheap and static: always present from the very first frame (no pop-in later)
    safe('specks', function () { if (GA.fx && GA.fx.specks) GA.fx.specks.build({ W: W, H: S.H, seed: 11 }); });
  };

  function geometry() {
    var T = sc.T, c = T.cues, girl = sc.girl;
    var a = girl.anchors(T.poseAt(c.thinkStart + 0.5));
    var hit = girl.anchors(T.poseAt(c.tHit - 0.001));
    sc.anch = { think: a, hit: hit };
    // the VORTEX ENVELOPE: everything she thinks revolves around her inside this ellipse (centre = her head/neck height); nothing drifts out to the page edges
    sc.geom = { cx: T.xStop, cy: a.neck.y + 12, rx: Math.min(0.35 * S.W, 1000), ry: 460 }; // round 10 (THOUGHTS): ~30 % larger than the approved cloud (was min(0.27 W, 780) x 380)
    return { a: a, hit: hit };
  }
  var STEP = {
    swirl: function (g, sliced) {
      var W = S.W, H = S.H, T = sc.T, c = T.cues, a = g.a, G = sc.geom;
      if (!GA.swirl) return;
      if (GA.swirl.reset) GA.swirl.reset();
      GA.swirl.build({
        sliced: !!sliced,
        W: W, H: H, cx: G.cx, cy: G.cy, rx: G.rx, ry: G.ry, seed: 5,
        origin: { x: a.headCenter.x + 0.5 * a.headR + 55, y: a.headTop.y - 38 },
        tDots: c.dots, tStart: c.swirlStart, tFull: c.swirlFull, tHit: c.tHit, autoDissolve: false, // finite tHit = hint only (the funnel tightens in the last 1.4 s); the dissolve is triggered by the scene
      });
    },
    thoughts: function () {
      var W = S.W, H = S.H, c = sc.T.cues, G = sc.geom;
      if (GA.thoughts) GA.thoughts.build({ W: W, H: H, cx: G.cx, cy: G.cy, rx: G.rx, ry: G.ry, seed: 9, tStart: c.swirlStart, tFull: c.swirlFull, tHit: Infinity, swirl: GA.swirl });
    },
    fx: function (g) {
      var W = S.W, H = S.H, c = sc.T.cues, hit = g.hit;
      if (GA.fx && GA.fx.ball) GA.fx.ball.build({ W: W, H: H, tHit: c.tHit, target: { x: hit.headTop.x, y: hit.headTop.y }, radius: 44,
        headAt: function (t) { var an = sc.girl.anchors(sc.T.poseAt(t)); return { x: an.headTop.x, y: an.headTop.y }; } }); // the squash disc follows the head as it dips
      if (GA.fx && GA.fx.ow && sc.impactTicks) GA.fx.ow.build({ t0: c.owStart, x: hit.headTop.x, y: hit.headTop.y - 6, dir: -1, ticks: true, headCenter: hit.headCenter, headR: hit.headR });
    },
  };

  /** all heavy modules at once (used when the screen is empty / hidden, where a hitch is invisible) */
  sc.buildHeavy = function () {
    var g = geometry();
    if (GA.fx) { GA.fx.cubes.reset(); GA.fx.dots.reset(); }
    safe('swirl.build', function () { STEP.swirl(g); });
    safe('thoughts.build', function () { STEP.thoughts(g); });
    safe('fx.build', function () { STEP.fx(g); });
    sc.heavyReady = true; sc.fresh = true;
  };
  /** the same, spread over idle slices so the walk-in at page load never hitches */
  sc.buildHeavyStaged = function (done) {
    var g = null; // measured when the first slice runs (the layout may change while the build waits for the landing to be on screen)
    if (GA.fx) { GA.fx.cubes.reset(); GA.fx.dots.reset(); }
    var names = ['swirl', 'thoughts', 'fx'], i = 0;
    (function next() {
      if (!sc.visible) { window.setTimeout(next, 500); return; } // nothing is built while the landing is scrolled out of view (it would only steal frames from whatever the visitor is doing)
      if (!g) g = geometry();
      if (i >= names.length) { sc.heavyReady = true; sc.fresh = true; if (done) done(); return; }
      var n = names[i++];
      if (n === 'swirl' && GA.swirl && GA.swirl.isReady) { // sliced build: returns at once, the work is done in small idle slices
        safe('swirl.build', function () { STEP.swirl(g, true); });
        (function pump() {
          if (!sc.visible) { window.setTimeout(pump, 500); return; }
          var more = false;
          safe('swirl.prepare', function () { more = GA.swirl.prepare(4) === true || !GA.swirl.isReady(); });
          if (more) later(pump, 40); else later(next, 80);
        })();
        return;
      }
      safe(n + '.build', function () { STEP[n](g); });
      later(next, 200);
    })();
  };

  // ---------------------------------------------------------------- hair
  function resetHair(still, t0) {
    var girl = sc.girl, T = sc.T, i, key = still ? 'still' : 'walk', early = !still && t0 > 0;
    t0 = early ? t0 : 0;
    if (!early && girl.snapshot && girl.restore && sc._snaps[key]) { safe('hair.restore', function () { girl.restore(sc._snaps[key]); }); return; }
    girl.reset(still ? 77 : 1);
    if (girl.settle) { // one-step settle (hair API) instead of a 100-120 step pre-roll
      girl.settle(still ? sc.pose : T.poseAt(t0));
      for (i = 0; i < 24; i++) girl.step(DT, still ? sc.pose : T.poseAt(t0 - (24 - i) * DT));
    } else if (!still) { for (i = 120; i > 0; i--) girl.step(DT, T.poseAt(t0 - i * DT)); }
    else { var p = sc.pose; for (i = 0; i < 100; i++) girl.step(DT, p); }
    if (!early && girl.snapshot) safe('hair.snapshot', function () { sc._snaps[key] = girl.snapshot(); });
  }

  // ---------------------------------------------------------------- lifecycle
  /** t0 (optional): start the loop that many seconds in (the page load starts her already on screen: she is mid-stride at the right edge in the very first frame) */
  sc.restart = function (t0) {
    if (!sc.T) sc.buildCore();
    t0 = t0 > 0 ? t0 : 0;
    sc.mode = 'loop'; sc.tl = t0; sc.R = null; sc.trig = { hit: false, rebuilt: false }; sc.acc = 0; sc._errs = {}; sc.live = true; sc.navOpen = false;
    sc.pose = sc.T.poseAt(t0);
    if (GA.dust) GA.dust.reset();
    resetHair(false, t0);
    if (sc.heavyReady && !sc.fresh) sc.rebuildModules();
  };
  /** called while the landing is scrolled out of view: do the expensive reset now so restart() on the way back is nearly free */
  sc.prepareRestart = function () {
    if (sc.heavyReady && !sc.fresh) {
      // the same sliced build as at page load (a few ms per idle slice) instead of one 60-90 ms task: heavyReady is false until it is done, so
      // restart() leaves it alone and the loop draws the girl alone while the modules finish (they are not needed before ~5 s into the loop)
      if (GA.fx) { GA.fx.cubes.reset(); GA.fx.dots.reset(); if (GA.fx.ball && GA.fx.ball.reset) GA.fx.ball.reset(); }
      sc.heavyReady = false;
      sc.buildHeavyStaged();
    }
    if (sc.girl && sc.T && !sc._snaps.walk) { var keep = sc.pose; resetHair(false); sc.pose = keep; }
  };

  /** the canvas resolution changed (governor / DPR / resize): modules drop only their pixel-ratio dependent caches when they can */
  sc.rescaleModules = function () {
    var cheap = GA.thoughts && GA.thoughts.rescale && GA.swirl && GA.swirl.rescale;
    if (!cheap) { sc.rebuildModules(); return; }
    safe('rescale', function () { GA.thoughts.rescale(); GA.swirl.rescale(); if (GA.fx && GA.fx.rescale) GA.fx.rescale(); });
  };

  sc.rebuildModules = function () {
    // reset every module to its pre-start state for the next loop (swirl/thoughts/ball/cubes)
    if (GA.fx) { GA.fx.cubes.reset(); GA.fx.dots.reset(); if (GA.fx.ball && GA.fx.ball.reset) GA.fx.ball.reset(); }
    sc.buildHeavy();
  };

  // ---------------------------------------------------------------- one fixed tick
  /** dust and speed strokes of the dash (all of it is dust-coloured decoration: it never touches the pose) */
  function runDust(R, o, p, h) {
    var D = GA.dust, T = sc.T, G = S.groundY, sp = o.speed / T.V_RUN, s2 = (p.gait.phase + 0.1) * 2, fresh = 1.7 - 1.0 * U.smoothstep(0.05, 0.85, sp);
    if (!D) return;
    if (o.TR !== undefined && !R.launched && R.rt >= o.TR) { // the take-off: a cloud kicked up behind her heels
      R.launched = true;
      D.puff(R.x + 40, G - 4, { n: 6, r0: 12, r1: 40, vx: 230, vy: -34, life: 0.95, a: 0.6, spread: 22 });
      D.puff(R.x + 90, G - 2, { n: 4, r0: 8, r1: 28, vx: 360, vy: -20, life: 0.8, a: 0.45, spread: 16 });
    }
    if (R.s2 !== undefined && Math.floor(s2) > Math.floor(R.s2) && (R.kind === 'stand' ? o.speed > 90 : o.run > 0.03)) { // a foot strike: a small puff behind the planted foot
      var an = sc.girl.anchors(p), f = an.footL.y > an.footR.y ? an.footL : an.footR;
      D.puff(f.x + 26, G - 2, { n: 2 + (fresh > 1.2 ? 1 : 0), r0: 5 * fresh, r1: 17 * fresh, vx: 90 + 160 * sp, vy: -34, life: 0.5 + 0.15 * fresh, a: 0.42 * Math.min(1, fresh), spread: 6 });
    }
    R.s2 = s2;
    if (o.TR !== undefined && R.rt > o.TR + 0.12 && R.rt < o.TR + 1.0 && sp > 0.4) { // a few thin speed strokes while she gathers pace
      R.sk = (R.sk || 0) + h;
      if (R.sk > 0.07) { R.sk = 0; D.streak(R.x + 120 + 40 * D.rand(), G - 120 - 330 * D.rand(), 70 + 90 * D.rand(), 0.3, 0.5, 1); }
    }
  }

  /** landing / impact dust: a small puff either side of her feet when a hop ends and when the ball bonks her (round 11) */
  function landingDust(p, T) {
    var D = GA.dust, G = S.groundY, up = G - p.y, c = T.cues;
    if (!D) return;
    if (up > 6) { sc._wasUp = true; if (up > (sc._hopPeak || 0)) sc._hopPeak = up; }
    else if (sc._wasUp && up < 1.2) {
      var k = Math.min(1.6, 0.55 + (sc._hopPeak || 0) / 60);
      D.puff(p.x - 46, G - 2, { n: 3, r0: 5 * k, r1: 15 * k, vx: -80 * k, vy: -24, life: 0.55, a: 0.42, spread: 7 });
      D.puff(p.x + 46, G - 2, { n: 3, r0: 5 * k, r1: 15 * k, vx: 80 * k, vy: -24, life: 0.55, a: 0.42, spread: 7 });
      sc._wasUp = false; sc._hopPeak = 0;
    }
    if (sc.mode === 'loop' && !sc._bonkDust && sc.tl >= c.tHit + 0.1 && sc.tl < c.tHit + 0.5) {
      sc._bonkDust = true;
      D.puff(p.x - 52, G - 2, { n: 4, r0: 7, r1: 22, vx: -130, vy: -30, life: 0.65, a: 0.45, spread: 8 });
      D.puff(p.x + 52, G - 2, { n: 4, r0: 7, r1: 22, vx: 130, vy: -30, life: 0.65, a: 0.45, spread: 8 });
    }
    if (sc.tl < c.tHit - 1) sc._bonkDust = false;
  }

  /** 'seeing stars' after the bonk: three small four-point sparkles circle above her head while she is dazed (round 11) */
  function drawStars(ctx, pose, t) {
    var c = sc.T.cues, h = t - c.tHit, i, a = U.smoothstep(0.38, 0.6, h) * (1 - U.smoothstep(1.35, 1.75, h));
    if (!(a > 0.01) || sc.mode !== 'loop') return;
    var an = sc.girl.anchors(pose), cx = an.headCenter.x, cy = an.headTop.y - 22, rx = an.headR * 1.5;
    ctx.save();
    ctx.fillStyle = GA.style.INK;
    for (i = 0; i < 3; i++) {
      var th = (i / 3) * 6.2832 + 7.6 * (h - 0.35), x = cx + Math.cos(th) * rx, y = cy + Math.sin(th) * rx * 0.24 - 6 * Math.sin(th * 2 + i), front = Math.sin(th) > 0, r = (front ? 19 : 13) + 2.5 * Math.sin(h * 11 + i * 2), sp = h * 3.1 + i;
      ctx.globalAlpha = a * (front ? 0.95 : 0.55);
      ctx.save(); ctx.translate(x, y); ctx.rotate(sp); ctx.beginPath();
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.16, -r * 0.16, r, 0); ctx.quadraticCurveTo(r * 0.16, r * 0.16, 0, r); ctx.quadraticCurveTo(-r * 0.16, r * 0.16, -r, 0); ctx.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  /** one simulation step of h seconds (the render loop uses h = the real frame time split in <= 1/120 s steps, tests use exactly DT) */
  function tick(h) {
    h = h || DT;
    var T = sc.T, c = T.cues, girl = sc.girl;
    sc.ticks++;
    if (GA.dust && GA.dust.live()) GA.dust.step(h);

    if (sc.mode === 'loop') {
      var empty = (sc.tl >= c.walkOutEnd + 0.08 && sc.tl < c.peek0 + 0.25) || sc.tl >= c.peekOut1 + 0.05;
      var holding = sc.navOpen && empty; // menu is open while the screen is empty: wait for it to close
      if (!holding) sc.tl += h;
      if (sc.fresh && sc.tl >= c.dots) sc.fresh = false;
      // the thought cloud (props / swirl / thoughts) is a second, lazily loaded script: wait for it, but never longer than ~2 s into the first thought (then the ball and the rest are built without it)
      if (!sc.heavyStarted && sc.tl >= HEAVY_AT && (GA.heavyLoaded || GA._heavyFailed || sc.tl > c.dots + 2)) { sc.heavyStarted = true; if (!sc.heavyReady) sc.buildHeavyStaged(); }
      if (!sc.trig.hit && sc.tl >= c.tHit - 0.05 && sc.heavyReady) {
        sc.trig.hit = true;
        // the eruption starts ~0.15 s AFTER the impact so the ball's bounce reads
        safe('dissolve@hit', function () {
          if (GA.thoughts && GA.thoughts.dissolveFrom) GA.thoughts.dissolveFrom(c.tHit + 0.04, { speed: 1, stagger: 0.55 });
          if (GA.swirl && GA.swirl.dissolveFrom) GA.swirl.dissolveFrom(c.tHit + 0.04, { speed: 1, stagger: 0.55 });
        });
      }
      // thoughts/swirl/ball/cubes are finished a few seconds after the hit: hide them until the next loop starts
      if (sc.live && sc.trig.hit && sc.tl >= c.tHit + 4.5) sc.live = false;
      // rebuild the modules while NOTHING is on screen (no visible hitch); they stay hidden (live=false) until the loop wraps
      if (!sc.trig.rebuilt && sc.tl >= c.rebuild && sc.heavyReady) { sc.trig.rebuilt = true; sc.live = false; sc.rebuildModules(); }
      if (sc.tl >= c.teleport && !sc.trig.teleported && sc.tl < c.teleport + 0.05) { sc.trig.teleported = true; sc.pose = T.poseAt(sc.tl); resetHair(true); }
      if (sc.tl >= c.loopEnd) {
        sc.tl -= c.loopEnd; sc.trig = { hit: false, rebuilt: false }; sc.live = true;
        sc.pose = T.poseAt(sc.tl); resetHair(false);
      }
      sc.pose = T.poseAt(sc.tl);
      girl.step(h, sc.pose);
      landingDust(sc.pose, T);
      return;
    }

    if (sc.mode === 'react') {
      var R = sc.R;
      R.rt += h; sc.tl += h;
      var o = T.reaction(R.kind, R.cap, R.rt);
      var p = o.pose;
      if (R.kind === 'duck') {
        // x comes from the clip itself
        sc.pose = p;
        if (o.done) { sc.mode = 'away'; sc.awayAt = sc.tl; sc.resumeTl = c.peekOut1 + 0.05; sc.pose.x = S.W + T.M_PARK; }
      } else {
        var stride = U.lerp(T.STRIDE, T.STRIDE_RUN, o.run);
        // a dash: quick small digging steps that grow with the speed (the rig scales its foot travel by p.gait.stride, so no sliding).  From standing the steps are short from the very first one;
        // from a walk the short steps blend in with the run weight (the walking steps themselves are not touched)
        var kRun = U.lerp(0.38, 1, U.smoothstep(0.1, 1, o.speed / T.V_RUN));
        var kw = R.kw === undefined ? (R.kw = (R.cap.pose0.gait && R.cap.pose0.gait.stride > 0 ? R.cap.pose0.gait.stride / T.STRIDE : 1)) : R.kw;          // the walking stride factor the baseline had at the press
        stride *= U.lerp(kw, 1, U.smoothstep(0, 0.5, R.rt)) * (R.kind === 'stand' ? kRun : U.lerp(1, kRun, o.run));
        R.x -= o.speed * h;
        R.phase += (o.speed / stride) * h;
        p.x = R.x; p.gait.phase = R.phase; p.gait.stride = stride;
        sc.pose = p;
        runDust(R, o, p, h);
        if (R.x <= -T.M_LEFT) { sc.mode = 'away'; sc.awayAt = sc.tl; sc.resumeTl = c.teleport; sc.pose.x = S.W + T.M_PARK; }
      }
      girl.step(h, sc.pose);
      landingDust(sc.pose, T);
      return;
    }

    // 'away': parked off-screen; cubes keep falling
    sc.tl += h;
    var settled = sc.tl - sc.awayAt > (sc.live ? 3.4 : 1.2);
    if (settled) sc.live = false;
    if (settled && !sc.navOpen) {
      sc.mode = 'loop'; sc.tl = sc.resumeTl; sc.trig = { hit: true, rebuilt: false, teleported: sc.resumeTl >= c.teleport };
      sc.pose = T.poseAt(sc.tl);
      resetHair(true);
      if (sc.resumeTl >= c.teleport) sc.trig.teleported = true;
    }
    sc.pose = sc.pose || T.poseAt(sc.tl);
    girl.step(h, sc.pose);
  }

  /** live driver: simulated time equals the real frame time EXACTLY (n equal sub-steps of <= 1/120 s), so the picture drawn at a vsync is
      never a few milliseconds behind the clock (no uneven strides on 60/90/120/144 Hz panels) and the hair stays attached to the body */
  sc.advance = function (dt) {
    dt = Math.min(dt, 0.1);
    if (!(dt > 0)) return;
    var n = Math.max(1, Math.ceil(dt / DT - 1e-6)), h = dt / n;
    for (var i = 0; i < n; i++) tick(h);
  };
  /** deterministic test driver: advance (from the current state) until loop-local time tl >= t */
  sc.advanceTo = function (t) { if (!sc.heavyReady) sc.buildHeavy(); var n = 0; while (sc.tl < t && n < 200000) { tick(DT); n++; } };
  sc.advanceBy = function (s) { if (!sc.heavyReady) sc.buildHeavy(); var n = Math.round(s / DT); for (var i = 0; i < n; i++) tick(DT); };

  // ---------------------------------------------------------------- interaction
  sc.setNavOpen = function (open) { sc.navOpen = !!open; };
  /** the menu is open at (re)start: keep her out of the picture until it closes, then she peeks back in */
  sc.holdIfOpen = function () {
    if (!sc.navOpen || !sc.T || sc.mode !== 'loop') return;
    var c = sc.T.cues;
    sc.mode = 'away'; sc.awayAt = sc.tl - 10; sc.resumeTl = c.teleport; sc.live = false;
    sc.pose = sc.T.poseAt(c.teleport + 0.02);
  };
  sc.navClosed = function () { sc.navOpen = false; };

  /** the nav '+' was activated: pick scenario B/C/D/E from where she is right now */
  sc.press = function () {
    if (!sc.T || !sc.visible || sc.reduced) return false;
    sc.navOpen = true;
    if (sc.mode !== 'loop') return false;
    var T = sc.T, c = T.cues, tl = sc.tl, p = sc.pose, kind = null;
    if (tl < c.walkInEnd) kind = 'walkHop'; // C: still walking in
    else if (tl < c.walkOut0) kind = 'stand'; // B (and: during ball flight / hit reaction)
    else if (tl < c.walkOutEnd + 0.08) kind = 'walk'; // D: walking away
    else if (tl >= c.peek0 && tl < c.peekOut1 && p.x < S.W + 200) kind = 'duck'; // E: startled while peeking
    if (!kind) return true; // E: empty screen — nothing for her to do; the loop simply holds until the menu closes
    sc.R = { kind: kind, rt: 0, x: p.x, phase: p.gait.phase, cap: { x: p.x, yaw: p.yaw, speed: p.gait.speed, pose0: p, tl0: tl, xPeek: T.xPeek } };
    sc.mode = 'react';
    var wasHit = sc.trig.hit;
    sc.trig.hit = true; // the baseline ball hit never happens now
    sc.fresh = false;
    if (tl < c.dots - 0.05) sc.live = false; // nothing is on screen yet: thoughts/swirl/ball must never build up behind her back
    safe('interrupt', function () {
      if (sc.live && !wasHit && (kind === 'stand' || kind === 'walk')) {
        var t0 = tl + (kind === 'stand' ? 0.25 : 0);
        if (GA.thoughts && GA.thoughts.dissolveFrom) GA.thoughts.dissolveFrom(t0, { speed: 1.6, stagger: 0.35 });
        if (GA.swirl && GA.swirl.dissolveFrom) GA.swirl.dissolveFrom(t0, { speed: 1.6, stagger: 0.35 });
      }
      if (GA.fx && GA.fx.ball && tl < c.tHit) { if (GA.fx.ball.pop) GA.fx.ball.pop(tl); else if (GA.fx.ball.cancel) GA.fx.ball.cancel(tl); }
      if (GA.fx && GA.fx.ow && GA.fx.ow.cancel && tl < c.owStart) GA.fx.ow.cancel();
    });
    return true;
  };

  sc.state = function () {
    if (!sc.T) return 'idle';
    if (sc.reduced) return 'static';
    if (sc.mode === 'react') return 'reacting';
    if (sc.mode === 'away') return 'away';
    var c = sc.T.cues, t = sc.tl;
    if (t < c.walkInEnd) return 'walk-in';
    if (t < c.turnFront1) return 'turn';
    if (t < c.tHit) return 'thinking';
    if (t < c.walkOut0) return 'hit-reaction';
    if (t < c.walkOutEnd + 0.08) return 'walk-out';
    if (t < c.peekOut1 + 0.05) return 'peek';
    return 'empty';
  };

  // ---------------------------------------------------------------- render
  sc.render = function () {
    if (!sc.T || !sc.pose) return;
    var T = sc.T, girl = sc.girl, t = sc.tl, pose = sc.pose, W = S.W, G = S.groundY;
    var ctx = S.begin(sc.bg);
    if (sc.reduced) { // static, calm: front-view girl standing (hair settled, soft shadow, faint specks)
      var rp = T.newPose(0); rp.yaw = 1; rp.x = T.xStop;
      if (!sc._redDone) { girl.reset(3); if (girl.settle) girl.settle(rp); for (var ri = 0; ri < 30; ri++) girl.step(DT, rp); sc._redDone = true; }
      safe('specks', function () { if (GA.fx && GA.fx.specks) GA.fx.specks.draw(ctx); });
      safe('shadow', function () { if (GA.fx && GA.fx.shadow) { var sh0 = T.shadowFor(rp); GA.fx.shadow(ctx, { x: sh0.x, y: G + 4, w: sh0.w, h: sh0.h, alpha: sh0.alpha }); } });
      girl.draw(ctx, rp);
      return;
    }
    var heavy = sc.heavyReady && sc.live;
    var onScreen = sc.mode !== 'away' && pose.x > -420 && pose.x < W + 420;
    if (sc.onlyGirl) { // test mode (tools/smooth.mjs): girl silhouette only
      if (onScreen) { var an0 = girl.anchors(pose); if (an0.bounds.x1 > -60 && an0.bounds.x0 < W + 60) girl.draw(ctx, pose); }
      return;
    }
    safe('specks', function () { if (GA.fx && GA.fx.specks) GA.fx.specks.draw(ctx); });
    safe('shadow', function () {
      if (GA.fx && GA.fx.shadow && onScreen && pose.x > -320 && pose.x < W + 320) {
        var sh = T.shadowFor(pose);
        GA.fx.shadow(ctx, { x: sh.x, y: G + 4, w: sh.w, h: sh.h, alpha: sh.alpha });
      }
    });
    safe('dust', function () { if (GA.dust) GA.dust.draw(ctx); });
    safe('swirl.back', function () { if (heavy && GA.swirl) GA.swirl.draw(ctx, t, 'back'); });
    safe('thoughts.back', function () { if (heavy && GA.thoughts) GA.thoughts.draw(ctx, t, 'back'); });
    safe('cubes.back', function () { if (heavy && GA.fx && GA.fx.cubes) { GA.fx.cubes.draw(ctx, t, 'back'); GA.fx.dots.draw(ctx, t, 'back'); } });
    safe('girl', function () {
      if (!onScreen) return;
      var an = girl.anchors(pose);
      if (an.bounds.x1 > -60 && an.bounds.x0 < W + 60) girl.draw(ctx, pose);
    });
    safe('swirl.front', function () { if (heavy && GA.swirl) GA.swirl.draw(ctx, t, 'front'); });
    safe('thoughts.front', function () { if (heavy && GA.thoughts) GA.thoughts.draw(ctx, t, 'front'); });
    safe('cubes.front', function () { if (heavy && GA.fx && GA.fx.cubes) { GA.fx.cubes.draw(ctx, t, 'front'); GA.fx.dots.draw(ctx, t, 'front'); } });
    safe('ball', function () { if (heavy && GA.fx && GA.fx.ball) GA.fx.ball.draw(ctx, t); });
    safe('impact', function () { if (heavy && sc.impactTicks && GA.fx && GA.fx.ow) GA.fx.ow.draw(ctx, t); });
    safe('stars', function () { if (onScreen) drawStars(ctx, pose, t); });
    if (sc.debug) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#d00'; ctx.font = 'bold 14px monospace';
      ctx.fillText('tl=' + t.toFixed(2) + '  ' + sc.mode + '/' + sc.state() + '  x=' + pose.x.toFixed(0) + '  W=' + W.toFixed(0), 10, 18);
    }
  };

  // ---------------------------------------------------------------- quality governor
  // Slow machines degrade gracefully, driven by the REAL frame cadence (rAF interval, which includes the raster cost the JS timer cannot see):
  // when the median frame interval stays far above the display's refresh the canvas backing store gets a lower pixel ratio (the picture is
  // identical, only a little softer). Steps only go down, at most one per 2 s, never while the thoughts are being dissolved.
  function govern(ts) {
    var g = sc._gov, d = g.prev ? (ts - g.prev) / (sc._n || 1) : 0, i;          // (drawn on every n-th vsync by pace(): judge the display's own rate, not ours)
    g.prev = ts;
    if (!(d > 0) || d > 250) { g.dts.length = 0; return false; } // first frame / tab was in the background
    g.hist.push(d); if (g.hist.length > 240) g.hist.shift();
    g.dts.push(d);
    if (g.dts.length < 40) return false;
    var a = g.dts.slice().sort(function (x, y) { return x - y; }), med = a[20];
    g.dts.length = 0;
    if (!sc.T || sc.mode !== 'loop' || sc.reduced) return false;
    var c = sc.T.cues, tl = sc.tl;
    if (tl < 0.8 || tl > c.tHit - 0.4) return false;
    var h = g.hist.slice().sort(function (x, y) { return x - y; }), p10 = h[Math.floor(h.length * 0.1)], p90 = h[Math.floor(h.length * 0.9)];
    var ref = Math.min(16.7, p10); // the display refreshes at least at 60 Hz, unless it is clearly a steady, capped 30 fps (power saver)
    if (h.length >= 120 && p10 > 30 && p10 < 37 && p90 - p10 < 4) ref = p10;
    var q = S.quality, nq = q;
    // median frame interval above ~55 fps worth of time (18 ms; 1.3 x the refresh on 60 Hz panels): a 48 fps cadence on a 144 Hz display judders
    if (med > Math.max(18, ref * 1.3)) nq = q * (med > Math.max(36, ref * 2.4) ? 0.78 : 0.88);
    nq = Math.max(0.6, nq);
    // sharpness first: never go below 1 device pixel per CSS pixel (a standard 1080p screen stays crisp) unless the machine is really struggling
    if (med < 30) nq = Math.max(nq, Math.min(q, 1 / Math.max(1, S.dpr / q)));
    var now = window.performance.now();
    if (nq < q - 0.01 && now - g.last > 2000) {
      g.last = now; g.level++;
      g.hist.length = 0;
      if (S.setQuality(nq)) {
        if (sc.heavyReady && sc.live) sc.rescaleModules(); // cached erase canvases depend on the pixel ratio
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- GPU warm-up
  // The first use of each canvas composite / gradient / blit compiles a GPU pipeline (~100 ms on a cold shader cache). The modules expose
  // warmGPU(ctx, step, rect) which draws every variant they use, invisibly, into a few pixels; we spread it over the cheap walk-in frames.
  var WARM_MODS = ['swirl', 'fx'];
  function warmUp() {
    var w = sc._warm;
    if (w.done || !S.ctx) return;
    var ctx = S.ctx, cv = S.canvas, pending = false;
    safe('warm', function () {
      var world = function () { ctx.setTransform(S.px, 0, 0, S.px, 0, S.offsetY * S.dpr); };
      // thoughts: draws its own invisible probes (1 % alpha, a few pixels in the faded top-left corner of the canvas + private canvases)
      var th = GA.thoughts;
      if (th && th.warmGPU && w.thoughts !== true) {
        ctx.save(); world();
        if (th.warmGPU(ctx, 6) === true) w.thoughts = true; else pending = true;
        ctx.restore();
      }
      // swirl / fx: clipped to 10x10 device pixels at the bottom-right of the (faded) canvas extension, rect = that square in world units
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath(); ctx.rect(cv.width - 10, cv.height - 10, 10, 10); ctx.clip();
      world();
      var rect = { x: (cv.width - 8) / S.px, y: (cv.height - 8) / S.px - S.offsetY / S.scale, w: 8 / S.px, h: 8 / S.px };
      for (var i = 0; i < WARM_MODS.length; i++) {
        var k = WARM_MODS[i], m = GA[k];
        if (!m || !m.warmGPU || w[k] === true) continue;
        var step = w[k] || 0;
        if (m.warmGPU(ctx, step, rect) === true) w[k] = true; else { w[k] = step + 1; pending = true; }
      }
      ctx.restore();
    });
    if (!pending) w.done = true;
  }

  // ---------------------------------------------------------------- frame pacing (round 11)
  // A frame of this scene costs 4-12 ms of script (girl + thought cloud); the budget of a 144 Hz panel is 6.9 ms, so frames land on every second or third vsync in an irregular mix, which
  // judders far more than a lower but EVEN rate.  The display rate is read from the rAF intervals (their 10th percentile, which our own slow frames cannot inflate much: the smallest value
  // seen is kept); the scene is then drawn on every n-th vsync, n = the smallest whole number for which the smoothed script cost fits (n x refresh x 0.8).  Simulated time is always the real
  // frame time, so the motion stays exactly in step with the clock at any n.  n goes up quickly, and comes back down only after 1.5 s of cheap frames.
  function pace(cost, ts) {
    var c = sc._cost = sc._cost ? sc._cost * 0.88 + cost * 0.12 : cost, ref = sc._ref || 16.7, n = sc._n || 1, want;
    want = Math.min(3, Math.max(1, Math.ceil(c / (0.8 * ref) - 1e-6)));
    if (want > n) { sc._n = want; sc._paceAt = ts; }
    else if (n > 1 && Math.ceil(c / (0.6 * ref) - 1e-6) < n && ts - (sc._paceAt || 0) > 1500) { sc._n = n - 1; sc._paceAt = ts; }          // (stricter way down: no flapping around the threshold)
  }
  function watchRefresh(d) { // d = rAF interval in ms
    var r = sc._ring || (sc._ring = []);
    if (d < 3 || d > 80) return;
    r.push(d); if (r.length > 90) r.shift();
    if (++sc._ringN % 15 || r.length < 45) return;
    var a = r.slice().sort(function (x, y) { return x - y; }), p10 = a[Math.floor(a.length * 0.1)];
    if (!sc._ref || p10 < sc._ref) sc._ref = Math.max(4, p10);
    else if ((sc._n || 1) > 1 && p10 > 1.6 * sc._ref) { sc._ref = p10; sc._n = 1; } // the display is slower than we thought (another monitor)
  }
  sc._ringN = 0; sc._n = 1; sc._k = 0;

  // ---------------------------------------------------------------- player
  function frame(ts) {
    sc._raf = 0;
    if (!sc.playing) return;
    var dt = sc._last ? (ts - sc._last) / 1000 : 1 / 60;
    sc._last = ts;
    if (!document.hidden) {
      // simulated time == real frame time: whatever vsync the panel has (60/90/120/144 Hz), each presented frame is exactly one frame later
      sc.advance(dt);
      var ri = sc._ri = sc._ri ? sc._ri * 0.9 + dt * 100 : dt * 1000; // smoothed refresh interval (ms)
      watchRefresh(dt * 1000);
      var skip = false;
      if (ri < 5.2) { sc._par = !sc._par; skip = sc._par; } // >190 Hz panels: draw every second frame (still evenly spaced)
      else if (sc._n > 1) { sc._k++; skip = sc._k % sc._n !== 0; } // round 11: an even n-th-vsync cadence while a frame costs more than one refresh (see pace())
      if (!skip) {
        var tc0 = window.performance.now();
        govern(ts); // may lower the canvas resolution (that clears the canvas: the render below is in the same frame, so nothing flashes)
        // modules do their expensive preparation (layout planning, ink analysis, JIT warm-up of the dissolve) in small slices while the
        // frames are still cheap (walk-in / turn), so nothing hitches during the thinking phase or on the hit frame
        var c = sc.T.cues;
        if (sc.heavyReady && sc.live && sc.mode === 'loop' && sc.tl > 0.9 && sc.tl < c.tHit - 1.0) {
          safe('prepare', function () {
            var pb = sc.tl < c.turnFront0 ? 4.5 : 3; // walk-in frames are cheap (girl only): spend a little more on the cloud plan so it is ready before the first thought pops
            if (GA.thoughts && GA.thoughts.prepare && !(GA.thoughts.isReady && GA.thoughts.isReady())) GA.thoughts.prepare(pb);
            else if (GA.swirl && GA.swirl.prepare && !(GA.swirl.isReady && GA.swirl.isReady())) GA.swirl.prepare(pb);
          });
        }
        sc.render();
        if (sc.heavyReady && sc.mode === 'loop' && sc.tl > 0.7 && sc.tl < c.turnFront1 + 0.6) warmUp();
        // second warm-up stage once the cloud exists: allocates/touches the sprite atlas and the entrance scratch canvas (the first GPU-accelerated
        // offscreen canvases) while she stands still, just before the first thought pops
        if (!sc._warm2 && sc.heavyReady && sc.live && sc.mode === 'loop' && sc.tl > c.turnFront1 + 0.1 && sc.tl < c.swirlStart) {
          safe('warm2', function () {
            var th = GA.thoughts, cx2 = S.ctx;
            if (!th || !th.warmGPU || !cx2) { sc._warm2 = true; return; }
            cx2.save(); cx2.setTransform(S.px, 0, 0, S.px, 0, S.offsetY * S.dpr);
            if (th.warmGPU(cx2, 6) === true) sc._warm2 = true;
            cx2.restore();
          });
        }
        pace(window.performance.now() - tc0, ts);
      }
    }
    sc._raf = window.requestAnimationFrame(frame);
  }
  sc.play = function () { if (sc.playing) return; sc.playing = true; sc._last = 0; sc._raf = window.requestAnimationFrame(frame); };
  sc.pause = function () { sc.playing = false; if (sc._raf) window.cancelAnimationFrame(sc._raf); sc._raf = 0; };

  sc.resize = function () {
    var oldW = sc.W || S.W, oldPx = S.px;
    S.resize();
    if (!sc.T) return;
    var wChanged = Math.abs(S.W - oldW) > 0.5, pxChanged = Math.abs(S.px / oldPx - 1) > 0.15;
    if (wChanged) { // the world got a different width: rebuild the timeline/girl (rare: only below the 900-unit clamp or when the band's aspect changes)
      var wasOpen = sc.navOpen;
      sc.buildCore(); sc.restart();
      if (sc.heavyReady) sc.rebuildModules();
      if (wasOpen) { sc.navOpen = true; sc.holdIfOpen(); } // a rotation with the menu open must not bring her back in
    } else if (pxChanged && sc.heavyReady && sc.mode === 'loop' && sc.tl < sc.T.cues.tHit - 0.2) {
      sc.rescaleModules(); // cached erase canvases depend on the pixel ratio; safe only before anything has been dissolved
    }
    if (!sc.playing) sc.render();
  };

  /** mount: opts {bg:'transparent', debug, paused, impactTicks} */
  sc.init = function (canvas, opts) {
    opts = opts || {};
    sc.canvas = canvas; sc.debug = !!opts.debug; sc.bg = opts.bg || 'transparent';
    if (opts.impactTicks === false) sc.impactTicks = false;
    S.maxPixels = opts.maxPixels || 7e6;
    S.setup(canvas, opts.stage || {}); // follows the canvas's CSS box (resize handled by site.js)
    sc.buildCore();
    sc.restart(opts.startAt);
    sc.render();
    // GPU warm-up NOW, while she is still ~0.3 s away from the screen edge: one longer first frame instead of 100 ms stalls during the walk-in
    // or at the first thought / the shatter (every first use of a canvas composite compiles a GPU pipeline once per browser profile)
    if (!sc.reduced) { var wg = 0; while (!sc._warm.done && wg++ < 16) warmUp(); }
    if (!opts.paused) sc.play();
    // heavy modules are built in idle slices AFTER the first frames (she walks in at once; the vortex is not needed before ~5 s)
    if (opts.heavyDelay !== undefined) window.setTimeout(function () { sc.heavyStarted = true; sc.buildHeavyStaged(); }, opts.heavyDelay);
    return sc;
  };
})();


/* ===== site.js ===== */
/* Site glue: mounts the canvas in [data-landing-girl-animation], keeps it laid out/sized/paused/restarted correctly and connects it to the
   portfolio's navigation ('+' console). Exposes the contract that scripts/navigation-ball.js already calls:
     window.landingGirlAnimation = { isLandingActive(), handlePlusDistraction(), getState(), ... }
   (We deliberately do NOT define interruptForNavigation: the nav's travel ball must never wait for the girl.)
   Start-up: the page is allowed to paint and to run its other scripts first; the animation boots right after the first paint. */
(function () {
  var GA = window.__landingGirl;
  var root = document.querySelector('[data-landing-girl-animation]');
  if (!root || !GA || !GA.scene) return;

  var scene = GA.scene;
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var landing = document.getElementById('landing') || root.closest('section');
  var titleEl = document.querySelector('.site-name');
  var booted = false, canvas = null;
  // the thought cloud lives in its own script (~660 KB of source): it is requested right now, in parallel with this script's start-up, and is not needed before the first thought (~5 s in)
  (function loadThoughts() {
    if (GA.heavyLoaded || GA._heavyRequested) return;
    GA._heavyRequested = true;
    var me = document.currentScript, el = document.createElement('script');
    el.src = (me && me.src ? me.src.replace(/[^\/]*$/, '') : 'scripts/') + 'landing-girl-thoughts.js';
    el.async = true;
    el.onerror = function () { GA._heavyFailed = true; };
    document.head.appendChild(el);
  })();
  var FIRST_LOOK = 0.8; // seconds into the walk-in at which the very first frame starts (at 400 u/s she is then ~200 u inside the right edge, not outside it)

  // The contract exists immediately (before the boot) so the nav script can always call it.
  function press() { return booted ? scene.press() : false; }
  window.landingGirlAnimation = {
    isLandingActive: function () { return booted && scene.visible; },
    handlePlusDistraction: press,
    getState: function () { return booted ? scene.state() : 'idle'; },
    restart: function () { if (booted) { scene.restart(); syncNav(); if (scene.visible && !reduced.matches) scene.play(); } },
    scene: scene,
  };

  function landingVisibleNow() {
    if (!landing) return true;
    var r = landing.getBoundingClientRect();
    return r.top < window.innerHeight * 0.62 && r.bottom > window.innerHeight * 0.38;
  }
  function navEl() { return document.querySelector('[data-nav-object]'); }
  function syncNav() { var nv = navEl(); if (nv && nv.classList.contains('is-open')) { scene.setNavOpen(true); scene.holdIfOpen(); } }

  /** The canvas is TALLER than the band (extra room above/below) so nothing is sliced by a hard edge; a CSS mask fades the extensions.
      Extension above is limited so it never runs over the page title; extension below runs towards the bottom of the viewport so falling cubes
      really leave the screen. Everything is set in px here (the stage reads the real rects back). */
  function layoutCanvas() {
    var br = root.getBoundingClientRect();
    var bandH = br.height;
    if (!bandH) return;
    var tBottom = titleEl ? titleEl.getBoundingClientRect().bottom : br.top - 60;
    var extTop = Math.max(0, Math.min(bandH * 0.22, br.top - tBottom - 10));
    var extBot = Math.max(bandH * 0.2, Math.min(window.innerHeight - br.bottom, bandH * 0.8));
    canvas.style.top = (-extTop).toFixed(1) + 'px';
    canvas.style.height = (bandH + extTop + extBot).toFixed(1) + 'px';
    // top fade: across the whole extension, or (when the title leaves no room above the band) a short fade inside the band's top edge,
    // so swirl arms that cross the top are never cut by a hard horizontal line
    var a = Math.max(extTop, bandH * 0.03), b = extTop + bandH, c = b + extBot * 0.5;
    var m = 'linear-gradient(to bottom, transparent 0, #000 ' + (a + 0.5).toFixed(1) + 'px, #000 ' + c.toFixed(1) + 'px, transparent 100%)';
    canvas.style.webkitMaskImage = m; canvas.style.maskImage = m;
  }

  var resizeTimer = 0, lastW = -1, lastH = -1, lastDpr = window.devicePixelRatio || 1;
  function onResize(force) {
    if (!booted) return;
    var r = root.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    if (!force && Math.abs(r.width - lastW) < 0.5 && Math.abs(r.height - lastH) < 0.5 && dpr === lastDpr) return; // no-op callbacks must not rebuild anything
    lastW = r.width; lastH = r.height; lastDpr = dpr;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { layoutCanvas(); scene.resize(); }, force ? 0 : 90);
  }
  function watchDpr() { // moving the window to another monitor changes devicePixelRatio without changing the CSS size
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    var fn = function () { onResize(true); watchDpr(); };
    if (mq.addEventListener) mq.addEventListener('change', fn, { once: true }); else if (mq.addListener) mq.addListener(fn);
  }

  /* runs fn once the page has been still for a moment (no scroll for ~350 ms) and the browser is idle: heavy resets must never land in the middle of a scroll */
  var lastScrollAt = 0;
  window.addEventListener('scroll', function () { lastScrollAt = window.performance.now(); }, { passive: true });
  function whenScrollIdle(fn) {
    (function check() {
      var still = window.performance.now() - lastScrollAt;
      if (still < 350) { window.setTimeout(check, 370 - still); return; }
      if (window.requestIdleCallback) window.requestIdleCallback(function () { fn(); }, { timeout: 800 }); else fn();
    })();
  }

  function setVisible(v) {
    if (!booted || v === scene.visible) return;
    scene.visible = v;
    if (reduced.matches) { scene.render(); return; }
    if (v) { scene.restart(); syncNav(); scene.play(); }
    else { scene.pause(); whenScrollIdle(function () { if (!scene.visible) scene.prepareRestart(); }); } // do the expensive reset while it is off-screen, once the page has stopped scrolling (a 60-90 ms task must not land in the middle of a scroll)
  }

  function boot() {
    if (booted) return;
    root.textContent = '';
    canvas = document.createElement('canvas');
    canvas.className = 'landing-girl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);
    layoutCanvas();
    scene.reduced = reduced.matches;
    scene.visible = landingVisibleNow();
    scene.init(canvas, { stage: { manualResize: true }, paused: !scene.visible || reduced.matches, startAt: FIRST_LOOK });
    booted = true;
    var r0 = root.getBoundingClientRect(); lastW = r0.width; lastH = r0.height;
    syncNav();

    if ('ResizeObserver' in window) new ResizeObserver(function () { onResize(false); }).observe(root);
    else window.addEventListener('resize', function () { onResize(false); });
    watchDpr();

    // run only while the landing section is on screen; coming back restarts from the first step (she walks in immediately)
    if ('IntersectionObserver' in window && landing) {
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        setVisible(Boolean(e && e.isIntersecting && e.intersectionRatio >= 0.34));
      }, { threshold: [0, 0.34, 0.65] }).observe(landing);
    }
    if (reduced.addEventListener) {
      reduced.addEventListener('change', function () {
        scene.reduced = reduced.matches;
        if (reduced.matches) { scene.pause(); scene.render(); } else if (scene.visible) { scene.restart(); syncNav(); scene.play(); }
      });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) scene._last = 0; });

    // navigation console: react the instant '+' is activated; stay away while the menu is open, come back when it closes
    window.addEventListener('landing-nav-plus-opened', press);
    var nav = navEl();
    if (nav && 'MutationObserver' in window) {
      var wasOpen = nav.classList.contains('is-open');
      new MutationObserver(function () {
        var open = nav.classList.contains('is-open') || nav.classList.contains('is-choosing') || nav.classList.contains('is-travelling');
        if (open === wasOpen) return;
        wasOpen = open;
        if (open) scene.setNavOpen(true); else scene.navClosed();
      }).observe(nav, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // boot at once (the script is deferred: the DOM and the stylesheets are ready): the first painted frame already shows her mid-stride at the right edge
  boot();
})();

})();
