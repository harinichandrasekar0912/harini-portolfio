/* Navigation plus console + travelling ball.
 *
 * Trip sequence (every non-phone trip, in this exact order):
 *   selected nav circle morphs into the ball -> capture A once -> freeze scroll -> three prep bounces at A (z/4, z/2, 3z/4)
 *   -> compute scrollTarget and the final visible landing point F -> ONE continuous arch A -> straight up -> over the top -> straight down
 *   into E -> straight down to F (vertical tangent at A and at E; constant speed along arc length, page scrolls with the ball in the same
 *   requestAnimationFrame loop) -> exact landing at F
 *   -> three landing bounces at F (3z/4, z/2, z/4) -> roll out of the screen -> travelling ball hidden -> plus fades in IN PLACE.
 * Phone (max-width: 767px): same sequence, but the ball never moves sideways before the roll-away (F.x = A.x, vertical quadratic Bezier).
 *
 * Obsolete experimental path systems (obstacle nudging, "exact" trajectory, composite camera modes) were removed so
 * that nothing can run by accident. The path modes below share ONE arc-length engine; NAV_BALL_PATH_MODE switches them.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ configuration */

  // "spline"    = the final arch: ONE continuous sampled path A -> up -> over -> down into E -> down to F (cubic arch with vertical tangents at A and E,
  //               joined tangent-continuously to the vertical descent E -> F).
  // "bezier"    = a single cubic from A to F with vertical tangents at both ends.
  // "catmull"   = centripetal Catmull-Rom through the guide points [A, DHigh, C, EHigh, E, F].
  // "segmented" = the old stitched look (straight rise, shallow cap, straight fall) - only kept for comparison.
  const NAV_BALL_PATH_MODE = "spline";

  const DEBUG_NAV_BALL_SEQUENCE = false;
  const DEBUG_NAV_BALL_SPLINE = false;
  const DEBUG_PHONE_NAV_BALL = false;
  const DEBUG_NAV_TRAJECTORY_OVERLAY = true;
  const DEBUG_NAV_TRAJECTORY_LOGS = true;

  const MAIN_PATH_SPEED = 430; // px/s along the desktop/tablet path (constant, no easing)
  const PHONE_PATH_SPEED = 380; // px/s along the phone path
  const SPLINE_ALPHA = 0.5; // centripetal (used by the "catmull" mode)
  const SAMPLES_PER_SEGMENT = 36;

  // the arch (see buildDesktopPath)
  const ARCH_LIFT_FACTOR = 1.12; // m = z * 1.12 (> z): how far above the higher of A and F the guide level E sits
  const ARCH_LIFT_MIN = 40;
  const ARCH_HEIGHT_FACTOR = 0.35; // h = clamp(|dx| * 0.35, ARCH_HEIGHT_MIN, ARCH_HEIGHT_MAX): controlled apex height
  const ARCH_HEIGHT_MIN = 40;
  const ARCH_HEIGHT_MAX = 130;
  const ARCH_CONTROL_FACTOR = 0.65; // the two cubic control points sit 0.65 h above the guide level
  const ARCH_MIN_APEX_FACTOR = 0.3; // the arch must rise at least 0.3 h above E (tall, narrow trips raise the controls to keep a visible arch)
  const ARCH_MIN_LANDING_DROP = 14; // E stays at least this far above F, so the ball always comes down into F
  const PHONE_PATH_SAMPLE_COUNT = 100;
  const BEZIER_SAMPLE_COUNT = 160;
  const SCROLL_PROGRESS_MODE = "smootherstep"; // page scroll easing only ("linear" = scroll progress equals path progress); the ball itself is never eased

  // "home" trips (the circle of the section you are in turns into "home"): true = the previous behaviour (prep bounces, arc up and over to the plus,
  // the ball closes into the plus). false = the same sequence as every other trip, landing on the landing media and rolling away.
  const HOME_TRIP_CLOSES_INTO_PLUS = true;

  const BALL_MORPH_DURATION = 1300;
  const NAV_BALL_PREP_DURATIONS = [360, 430, 500];
  const NAV_BALL_LANDING_DURATIONS = [480, 360, 260];
  const NAV_BALL_ROLL_DURATION = 2180;
  const MOBILE_BALL_TIME_SCALE = 1.42; // calmer bounces / roll on phones

  // staged (phone) menu opening: total under 650 ms
  const PHONE_MENU_SPOKE_DURATION = 420;
  const PHONE_MENU_SPOKE_STAGGER = 45;
  const PHONE_MENU_READY_DELAY = 610; // circles are fully in by ~615 ms after the opening starts

  const SECTION_IDS = ["landing", "about", "work", "archive", "contact"];
  const SECTION_INDEX = { landing: 0, about: 1, work: 2, archive: 3, contact: 4 };

  const STATES = {
    PLUS_IDLE: "plus_idle",
    MENU_OPEN: "menu_open",
    NAVI_HOVERED: "navi_hovered",
    NAVI_SELECTED: "navi_selected",
    NAVI_TEXT_VANISHING: "navi_text_vanishing",
    NAVI_TO_BALL_MORPH: "navi_to_ball_morph",
    BALL_READY: "ball_ready",
    BALL_TAKEOFF: "ball_takeoff",
    BALL_FLYING: "ball_flying",
    BALL_LANDING: "ball_landing",
    BALL_ROLLING_OUT: "ball_rolling_out",
    PLUS_RESTORED: "plus_restored"
  };

  // ball trip phases (also written to data-ball-phase for tests / styling hooks)
  const PHASE = {
    MORPH: "morph",
    PREP1: "prep1",
    PREP2: "prep2",
    PREP3: "prep3",
    MAIN: "main",
    LAND1: "land1",
    LAND2: "land2",
    LAND3: "land3",
    ROLL: "roll",
    PLUS: "plus"
  };
  const PHASE_ORDER = [PHASE.PREP1, PHASE.PREP2, PHASE.PREP3, PHASE.MAIN, PHASE.LAND1, PHASE.LAND2, PHASE.LAND3, PHASE.ROLL];

  /* ------------------------------------------------------------------ small helpers */

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mix(from, to, t) {
    return from + (to - from) * t;
  }

  function smootherstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeRollOut(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 2.2);
  }

  function round(value) {
    return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  function parsePixel(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function copyPoint(point) {
    return { x: point.x, y: point.y };
  }

  function centerOf(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function sectionIndex(section) {
    return Object.prototype.hasOwnProperty.call(SECTION_INDEX, section) ? SECTION_INDEX[section] : 0;
  }

  function targetSideFor(section) {
    if (section === "about" || section === "work") {
      return "left";
    }

    if (section === "archive" || section === "contact") {
      return "right";
    }

    return "center";
  }

  function rollDirectionFor(section) {
    return section === "archive" || section === "contact" ? 1 : -1;
  }

  function currentScrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function maxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function scrollInstantly(y) {
    // the page has scroll-behavior: smooth; html.is-ball-animating switches it off, "instant" is the belt and braces
    try {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    } catch (error) {
      window.scrollTo(0, y);
    }
  }

  function platformFromElement(element, section, side, kind) {
    const safeElement = element || document.body;
    const rect = safeElement.getBoundingClientRect();
    const scrollY = currentScrollY();
    let x = rect.left + rect.width / 2;

    if (side === "left") {
      x = rect.left + rect.width * 0.72;
    }

    if (side === "right") {
      x = rect.left + rect.width * 0.28;
    }

    return {
      element: safeElement,
      section: section,
      side: side || "center",
      kind: kind || "platform",
      x: clamp(x, 28, window.innerWidth - 28),
      y: rect.top + scrollY, // document y of the top edge of the platform
      width: rect.width,
      height: rect.height
    };
  }

  /* ------------------------------------------------------------------ path engine (pure functions) */

  function appendSample(samples, x, y) {
    const last = samples[samples.length - 1];

    if (last && Math.abs(last.x - x) < 0.0005 && Math.abs(last.y - y) < 0.0005) {
      return; // zero-length duplicate: skip so cumulative distance never gets a flat step
    }

    samples.push({ x: x, y: y, distance: 0 });
  }

  function finalizePath(samples, extra) {
    let total = 0;

    for (let index = 1; index < samples.length; index += 1) {
      total += Math.hypot(samples[index].x - samples[index - 1].x, samples[index].y - samples[index - 1].y);
      samples[index].distance = total;
    }

    if (samples.length > 0) {
      samples[0].distance = 0;
    }

    const path = { samples: samples, totalLength: total };

    if (extra) {
      Object.keys(extra).forEach(function (key) {
        path[key] = extra[key];
      });
    }

    return path;
  }

  function getPointAtDistance(path, targetDistance) {
    const samples = path.samples;
    const total = path.totalLength;

    if (samples.length === 0) {
      return { x: 0, y: 0 };
    }

    if (samples.length === 1 || targetDistance <= 0 || total <= 0) {
      return { x: samples[0].x, y: samples[0].y };
    }

    if (targetDistance >= total) {
      return { x: samples[samples.length - 1].x, y: samples[samples.length - 1].y };
    }

    let low = 0;
    let high = samples.length - 1;

    while (low < high) {
      const middle = (low + high) >> 1;

      if (samples[middle].distance < targetDistance) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    const after = samples[low];
    const before = samples[Math.max(0, low - 1)];
    const span = after.distance - before.distance;

    if (span <= 0.0001) {
      return { x: after.x, y: after.y };
    }

    const local = (targetDistance - before.distance) / span;
    return { x: mix(before.x, after.x, local), y: mix(before.y, after.y, local) };
  }

  /* centripetal Catmull-Rom (Barry-Goldman pyramid) */
  function catmullKnot(previous, current, startKnot) {
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    return startKnot + Math.pow(Math.max(distance, 0.0001), SPLINE_ALPHA);
  }

  function lerpPoint(pointA, pointB, knotA, knotB, knot) {
    const span = knotB - knotA;

    if (Math.abs(span) < 0.0001) {
      return copyPoint(pointB);
    }

    const weightA = (knotB - knot) / span;
    const weightB = (knot - knotA) / span;
    return { x: pointA.x * weightA + pointB.x * weightB, y: pointA.y * weightA + pointB.y * weightB };
  }

  function catmullRomPoint(p0, p1, p2, p3, raw) {
    const t0 = 0;
    const t1 = catmullKnot(p0, p1, t0);
    const t2 = catmullKnot(p1, p2, t1);
    const t3 = catmullKnot(p2, p3, t2);
    const t = mix(t1, t2, clamp(raw, 0, 1));
    const a1 = lerpPoint(p0, p1, t0, t1, t);
    const a2 = lerpPoint(p1, p2, t1, t2, t);
    const a3 = lerpPoint(p2, p3, t2, t3, t);
    const b1 = lerpPoint(a1, a2, t0, t2, t);
    const b2 = lerpPoint(a2, a3, t1, t3, t);
    return lerpPoint(b1, b2, t1, t2, t);
  }

  function phantomPoint(edge, neighbour) {
    // reflects the neighbour through the edge point, so the end tangents follow A->B and E->F exactly
    return { x: edge.x + (edge.x - neighbour.x), y: edge.y + (edge.y - neighbour.y) };
  }

  function sampleCatmullRom(points, samplesPerSegment) {
    const perSegment = Math.max(4, samplesPerSegment || SAMPLES_PER_SEGMENT);
    const samples = [];

    if (points.length < 2) {
      return finalizePath(samples, { samplesPerSegment: perSegment });
    }

    const extended = [phantomPoint(points[0], points[1])]
      .concat(points)
      .concat([phantomPoint(points[points.length - 1], points[points.length - 2])]);

    for (let segment = 0; segment < points.length - 1; segment += 1) {
      for (let step = 0; step <= perSegment; step += 1) {
        if (segment > 0 && step === 0) {
          continue;
        }

        const point = catmullRomPoint(extended[segment], extended[segment + 1], extended[segment + 2], extended[segment + 3], step / perSegment);
        appendSample(samples, point.x, point.y);
      }
    }

    // the path starts exactly at A and ends exactly at F
    samples[0].x = points[0].x;
    samples[0].y = points[0].y;
    samples[samples.length - 1].x = points[points.length - 1].x;
    samples[samples.length - 1].y = points[points.length - 1].y;

    return finalizePath(samples, { samplesPerSegment: perSegment });
  }

  function cubicBezierPoint(p0, p1, p2, p3, raw) {
    const t = clamp(raw, 0, 1);
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  function quadraticBezierPoint(p0, p1, p2, raw) {
    const t = clamp(raw, 0, 1);
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  // roughly one sample every 3 px (never fewer than BEZIER_SAMPLE_COUNT), so even wide arches keep smooth, evenly spaced samples
  function cubicSampleCount(p0, p1, p2, p3) {
    const controlLength = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);

    return clamp(Math.ceil(controlLength / 3), BEZIER_SAMPLE_COUNT, 900);
  }

  function sampleCubic(samples, p0, p1, p2, p3, count) {
    const sampleTotal = Math.max(count, cubicSampleCount(p0, p1, p2, p3));

    for (let index = 0; index <= sampleTotal; index += 1) {
      const point = cubicBezierPoint(p0, p1, p2, p3, index / sampleTotal);
      appendSample(samples, point.x, point.y);
    }
  }

  function sampleLine(samples, from, to, count) {
    for (let index = 0; index <= count; index += 1) {
      appendSample(samples, mix(from.x, to.x, index / count), mix(from.y, to.y, index / count));
    }
  }

  function minSampleY(path) {
    let minY = Infinity;

    path.samples.forEach(function (sample) {
      minY = Math.min(minY, sample.y);
    });

    return minY;
  }

  /* ---- the arch ------------------------------------------------------------------------------------------------------------------
   * One continuous trajectory (viewport coordinates, y grows downward):  A -> straight up -> rounded arch -> straight down into E -> down to F
   *   guide level  G = (higher of A and F) - m,   m = 1.12 z  (> z, so the ball clears its own bounce height)
   *   E = (F.x, G)      h = clamp(|dx| * 0.35, 40, 130)      control height c = 0.65 h above G
   *   cubic arch   P0 = A,  P1 = (A.x, G - c),  P2 = (F.x, G - c),  P3 = E
   *   -> dx/dt = 0 and the ball moves UP at A, dx/dt = 0 and the ball moves DOWN at E, and x never leaves [A.x, F.x] (no side bulge).
   *   Then the vertical descent E -> F. Both parts go into ONE sample table, so tangent and speed stay continuous: no visible join.
   * The same formulas serve all four directions (left/right, higher/lower); the sign of dx mirrors the arch. */
  function archGuide(A, F, z, scale) {
    const topY = Math.min(A.y, F.y);
    const absDx = Math.abs(F.x - A.x);
    const lift = Math.max(z * ARCH_LIFT_FACTOR, ARCH_LIFT_MIN) * scale;
    const height = clamp(absDx * ARCH_HEIGHT_FACTOR, ARCH_HEIGHT_MIN, ARCH_HEIGHT_MAX) * scale;

    return { topY: topY, absDx: absDx, lift: lift, height: height, guideY: topY - lift };
  }

  function archKeyPoints(A, F, guideY, height, control) {
    return {
      A: copyPoint(A),
      P1: { x: A.x, y: guideY - control },
      P2: { x: F.x, y: guideY - control },
      E: { x: F.x, y: guideY },
      F: copyPoint(F),
      DHigh: { x: A.x, y: guideY - height * 0.25 },
      C: { x: (A.x + F.x) / 2, y: guideY - height },
      EHigh: { x: F.x, y: guideY - height * 0.25 }
    };
  }

  function sampleVerticalDescent(samples, from, to) {
    const count = Math.max(2, Math.ceil(Math.abs(to.y - from.y) / 8));

    for (let index = 1; index <= count; index += 1) {
      appendSample(samples, to.x, mix(from.y, to.y, index / count));
    }
  }

  function buildArchPath(mode, points) {
    const samples = [];

    if (mode === "catmull") {
      const catmull = sampleCatmullRom([points.A, points.DHigh, points.C, points.EHigh, points.E, points.F], SAMPLES_PER_SEGMENT);

      catmull.mode = "catmull";
      return catmull;
    }

    if (mode === "bezier") {
      sampleCubic(samples, points.A, points.P1, points.P2, points.F, BEZIER_SAMPLE_COUNT);
      return finalizePath(samples, { mode: "bezier" });
    }

    if (mode === "segmented") {
      const riseEnd = { x: points.A.x, y: points.E.y };

      sampleLine(samples, points.A, riseEnd, 24);
      sampleCubic(samples, riseEnd, { x: points.A.x, y: points.C.y }, { x: points.F.x, y: points.C.y }, points.E, BEZIER_SAMPLE_COUNT);
      sampleLine(samples, points.E, points.F, 24);
      return finalizePath(samples, { mode: "segmented" });
    }

    sampleCubic(samples, points.A, points.P1, points.P2, points.E, BEZIER_SAMPLE_COUNT);
    sampleVerticalDescent(samples, points.E, points.F);

    // the path starts exactly at A and ends exactly at F
    samples[0].x = points.A.x;
    samples[0].y = points.A.y;
    samples[samples.length - 1].x = points.F.x;
    samples[samples.length - 1].y = points.F.y;

    return finalizePath(samples, { mode: "spline" });
  }

  /* desktop / tablet main path A -> F, kept inside the visible frame: the guide level and the control points move down together (A and F never move) */
  function buildDesktopPath(A, F, z, safeTop, mode) {
    const pathMode = mode === "bezier" || mode === "segmented" || mode === "catmull" ? mode : "spline";
    let scale = 1;
    let result = null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const guide = archGuide(A, F, z, scale);
      let guideY = guide.guideY;
      let control = ARCH_CONTROL_FACTOR * guide.height;
      let points = archKeyPoints(A, F, guideY, guide.height, control);
      let path = buildArchPath(pathMode, points);
      let adjustment = 0;

      // tall, narrow trips: raise the control points until the arch visibly rises above E
      for (let step = 0; step < 40 && guideY - minSampleY(path) < ARCH_MIN_APEX_FACTOR * guide.height; step += 1) {
        control *= 1.12;
        points = archKeyPoints(A, F, guideY, guide.height, control);
        path = buildArchPath(pathMode, points);
      }

      // SAFE_TOP: if the apex would leave the visible frame, move the guide level (and with it the controls) down
      for (let step = 0; step < 4 && minSampleY(path) < safeTop - 0.5; step += 1) {
        const shift = safeTop - minSampleY(path);

        adjustment += shift;
        guideY += shift;
        points = archKeyPoints(A, F, guideY, guide.height, control);
        path = buildArchPath(pathMode, points);
      }

      result = { guide: guide, guideY: guideY, control: control, points: points, path: path, adjustment: adjustment, scale: scale };

      if (guideY <= F.y - ARCH_MIN_LANDING_DROP) {
        break;
      }

      scale *= 0.85; // very small screen / F close to the top edge: flatten the arch a little before giving up on the shape
    }

    const resultPath = result.path;

    resultPath.geometry = {
      A: result.points.A,
      P1: result.points.P1,
      P2: result.points.P2,
      E: result.points.E,
      F: result.points.F,
      DHigh: result.points.DHigh,
      C: result.points.C,
      EHigh: result.points.EHigh,
      guideY: result.guideY,
      lift: result.guide.lift,
      height: result.guide.height,
      control: result.control,
      topY: result.guide.topY
    };
    resultPath.mode = pathMode;
    resultPath.visibilityAdjustment = result.adjustment;
    resultPath.arcScale = result.scale;
    resultPath.safeTop = safeTop;
    resultPath.speed = MAIN_PATH_SPEED;
    return resultPath;
  }

  /* phone main path: vertical quadratic Bezier A -> C -> FPhone, constant x */
  function buildPhonePath(A, FPhone, z, safeTop) {
    const topY = Math.min(A.y, FPhone.y);
    const phoneLift = clamp(z * 1.15, 58, 110);
    const C = { x: A.x, y: topY - phoneLift };
    let path;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const samples = [];

      for (let index = 0; index <= PHONE_PATH_SAMPLE_COUNT; index += 1) {
        const point = quadraticBezierPoint(A, C, FPhone, index / PHONE_PATH_SAMPLE_COUNT);
        appendSample(samples, A.x, point.y); // x is constant by construction
      }

      path = finalizePath(samples, { mode: "phone-vertical" });

      if (minSampleY(path) >= safeTop - 0.5) {
        break;
      }

      C.y += safeTop - minSampleY(path);
    }

    path.geometry = { A: copyPoint(A), C: copyPoint(C), F: copyPoint(FPhone), topY: topY, phoneLift: phoneLift };
    path.mode = "phone-vertical";
    path.safeTop = safeTop;
    path.speed = PHONE_PATH_SPEED;
    return path;
  }

  function bouncePoint(base, height, p) {
    const q = clamp(p, 0, 1);
    return { x: base.x, y: base.y - 4 * height * q * (1 - q) };
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    const nav = document.querySelector("[data-nav-object]");
    const core = document.querySelector("[data-nav-core]");
    const spokes = document.querySelector(".radial-lines");
    const menu = document.getElementById("radial-menu");
    const ball = document.querySelector("[data-travel-ball]");
    const ballLabel = document.querySelector("[data-travel-label]");
    const travelShadow = ball ? ball.querySelector(".travel-shadow") : null;
    const items = Array.prototype.slice.call(document.querySelectorAll("[data-nav-target]"));
    const lines = {
      about: document.querySelector(".radial-line-about"),
      work: document.querySelector(".radial-line-work"),
      archive: document.querySelector(".radial-line-archive"),
      contact: document.querySelector(".radial-line-contact")
    };
    const spokeMasks = {};

    if (!nav || !core || !spokes || !menu || !ball || !ballLabel || items.length === 0) {
      return;
    }

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const mobileViewport = window.matchMedia("(max-width: 767px)");
    const tabletLandscapeTouch = window.matchMedia("(min-width: 768px) and (max-width: 1180px) and (orientation: landscape) and (pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let isOpen = false;
    let isTravelling = false;
    let isBallAnimating = false; // guard: never two ball animations at once
    let isProjectMode = false;
    let isPhoneNavOpening = false; // guard: ignore repeated taps while the staged menu opens
    let isPhoneNavOpen = false;
    let closeOnBlurTimer = 0;
    let phoneMenuReadyTimer = 0;
    let resetTimer = 0;
    let sectionFrame = 0;
    let navGeometryFrame = 0;
    let currentSection = "landing";
    let navState = STATES.PLUS_IDLE;
    let activeAnimationToken = 0;
    let ballFrames = [];
    let ballTimers = [];
    let scrollLockActive = false;
    let navTrajectoryDebug = null;

    Array.prototype.slice.call(document.querySelectorAll("[data-travel-ball]")).forEach(function (travelBall, index) {
      if (index > 0) {
        travelBall.remove();
      }
    });

    items.forEach(function (item) {
      const original = item.getAttribute("data-nav-target");
      item.dataset.navOriginalTarget = original;
      item.dataset.navOriginalLabel = item.textContent.trim();
      item.setAttribute("aria-label", "go to " + original);
    });

    function originalTarget(button) {
      return button.dataset.navOriginalTarget || button.getAttribute("data-nav-target");
    }

    /* -------------------------------------------------------------- device / mode helpers */

    function isMobileViewport() {
      return mobileViewport.matches;
    }

    function isCoarsePointer() {
      return coarsePointer.matches;
    }

    function isMobileTapMode() {
      return isMobileViewport() || isCoarsePointer();
    }

    function isTabletLandscapeTouchViewport() {
      return tabletLandscapeTouch.matches;
    }

    function usesStagedMenuOpen() {
      return isMobileViewport() || isTabletLandscapeTouchViewport();
    }

    function canUseHoverNav() {
      return canHover.matches && !isMobileTapMode();
    }

    /* -------------------------------------------------------------- temporary trajectory debug overlay */

    function createNavTrajectoryDebugOverlay() {
      const svgNamespace = "http://www.w3.org/2000/svg";
      const phaseColours = {
        prep: "#ff8a00",
        main: "#ff1f1f",
        landing: "#ff4fb3",
        roll: "#777777",
        other: "#111111"
      };
      const state = {
        overlay: null,
        panel: null,
        layers: {},
        tracePoints: {
          prep: [],
          main: [],
          landing: [],
          roll: [],
          other: []
        },
        active: false,
        info: {},
        panelInfo: {},
        phoneGuideX: null,
        phoneLateralWarned: false
      };

      function svgElement(tagName, attributes) {
        const element = document.createElementNS(svgNamespace, tagName);

        Object.keys(attributes || {}).forEach(function (key) {
          element.setAttribute(key, String(attributes[key]));
        });

        return element;
      }

      function ensure() {
        if (!DEBUG_NAV_TRAJECTORY_OVERLAY) {
          return false;
        }

        if (!state.overlay) {
          state.overlay = document.querySelector(".nav-debug-overlay");

          if (!state.overlay) {
            state.overlay = svgElement("svg", {
              class: "nav-debug-overlay",
              "aria-hidden": "true",
              focusable: "false"
            });
            document.body.appendChild(state.overlay);
          }
        }

        if (!state.panel) {
          state.panel = document.querySelector(".nav-debug-panel");

          if (!state.panel) {
            state.panel = document.createElement("div");
            state.panel.className = "nav-debug-panel";
            document.body.appendChild(state.panel);
          }
        }

        state.overlay.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
        state.overlay.setAttribute("width", String(window.innerWidth));
        state.overlay.setAttribute("height", String(window.innerHeight));
        state.overlay.style.display = "";
        state.panel.style.display = "";
        return true;
      }

      function pointsToString(points) {
        return points.map(function (point) {
          return round(point.x) + "," + round(point.y);
        }).join(" ");
      }

      function clear() {
        if (!ensure()) {
          return;
        }

        state.overlay.innerHTML = "";
        state.layers = {
          intended: svgElement("g", { "data-debug-layer": "intended" }),
          samples: svgElement("g", { "data-debug-layer": "samples" }),
          points: svgElement("g", { "data-debug-layer": "points" }),
          bases: svgElement("g", { "data-debug-layer": "bases" }),
          trace: svgElement("g", { "data-debug-layer": "trace" })
        };

        Object.keys(state.layers).forEach(function (key) {
          state.overlay.appendChild(state.layers[key]);
        });

        state.tracePoints = {
          prep: [],
          main: [],
          landing: [],
          roll: [],
          other: []
        };
      }

      function traceKeyForPhase(phase) {
        if (phase === PHASE.PREP1 || phase === PHASE.PREP2 || phase === PHASE.PREP3) {
          return "prep";
        }

        if (phase === PHASE.MAIN) {
          return "main";
        }

        if (phase === PHASE.LAND1 || phase === PHASE.LAND2 || phase === PHASE.LAND3) {
          return "landing";
        }

        if (phase === PHASE.ROLL) {
          return "roll";
        }

        return "other";
      }

      function drawLabel(text, x, y, colour) {
        state.layers.points.appendChild(svgElement("text", {
          class: "nav-debug-label",
          x: x + 8,
          y: y - 8,
          fill: colour || "#111"
        })).textContent = text;
      }

      function drawPoint(label, point, colour, radius) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return;
        }

        state.layers.points.appendChild(svgElement("circle", {
          cx: point.x,
          cy: point.y,
          r: radius || 5,
          fill: colour,
          stroke: "#ffffff",
          "stroke-width": 2
        }));
        drawLabel(label, point.x, point.y, colour);
      }

      function drawRing(label, point, colour, radius) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return;
        }

        state.layers.bases.appendChild(svgElement("circle", {
          cx: point.x,
          cy: point.y,
          r: radius || 7,
          fill: "none",
          stroke: colour,
          "stroke-width": 2.5
        }));
        state.layers.bases.appendChild(svgElement("text", {
          class: "nav-debug-label",
          x: point.x + 9,
          y: point.y + 14,
          fill: colour
        })).textContent = label;
      }

      function updateTracePath(key) {
        const points = state.tracePoints[key];
        let path = state.layers.trace.querySelector("[data-trace-phase='" + key + "']");

        if (!path) {
          path = svgElement("polyline", {
            "data-trace-phase": key,
            fill: "none",
            stroke: phaseColours[key],
            "stroke-width": key === "main" ? 2.5 : 2,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            opacity: key === "other" ? 0.55 : 0.9
          });
          state.layers.trace.appendChild(path);
        }

        path.setAttribute("points", pointsToString(points));
      }

      function setPanel(extra) {
        if (!ensure()) {
          return;
        }

        state.panelInfo = Object.assign({}, state.panelInfo, extra || {});
        state.panel.innerHTML = [
          "device: " + (state.panelInfo.deviceType || "-"),
          "path mode: " + (state.panelInfo.pathMode || "-"),
          "phase: " + (state.panelInfo.phase || "-"),
          "scrollStart: " + round(state.panelInfo.scrollStart),
          "scrollTarget: " + round(state.panelInfo.scrollTarget),
          "scrollY: " + round(currentScrollY()),
          "pathProgress: " + round(state.panelInfo.pathProgress || 0),
          "distanceTravelled: " + round(state.panelInfo.distanceTravelled || 0),
          "totalPathLength: " + round(state.panelInfo.totalPathLength || 0),
          "scroll frozen: " + Boolean(state.panelInfo.scrollFrozen),
          "scroll moved during prep: " + Boolean(state.panelInfo.scrollMovedDuringPrep),
          "scroll moved during landing: " + Boolean(state.panelInfo.scrollMovedDuringLanding)
        ].join("<br>");
      }

      function startTrip(info) {
        clear();
        state.active = true;
        state.info = Object.assign({}, info || {});
        state.panelInfo = Object.assign({}, info || {}, {
          phase: PHASE.MORPH,
          pathProgress: 0,
          distanceTravelled: 0,
          totalPathLength: 0,
          scrollFrozen: true,
          scrollMovedDuringPrep: false,
          scrollMovedDuringLanding: false
        });
        state.phoneGuideX = null;
        state.phoneLateralWarned = false;
        setPanel();

        if (state.info.A0) {
          drawPoint("A", state.info.A0, "#ff8a00", 5);
          drawRing("prep base", state.info.A0, "#ff8a00", 9);
        }
      }

      function drawPath(path, options) {
        const geometry = path && path.geometry ? path.geometry : {};
        const samples = path && Array.isArray(path.samples) ? path.samples : [];
        const sampleStep = Math.max(1, Math.ceil(samples.length / 80));
        const FVisual = options && options.FVisual;
        const FPhone = options && options.FPhone;

        if (!ensure() || !path || samples.length === 0) {
          return;
        }

        state.layers.intended.appendChild(svgElement("polyline", {
          points: pointsToString(samples),
          fill: "none",
          stroke: "#0057ff",
          "stroke-width": 3,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }));

        samples.forEach(function (sample, index) {
          if (index % sampleStep !== 0 && index !== samples.length - 1) {
            return;
          }

          state.layers.samples.appendChild(svgElement("circle", {
            cx: sample.x,
            cy: sample.y,
            r: 2,
            fill: "#0057ff",
            opacity: 0.6
          }));
        });

        if (path.mode === "phone-vertical") {
          drawPoint("A", geometry.A, "#ff8a00", 5);
          drawPoint("C", geometry.C, "#ff1f1f", 5);
          drawPoint("F", geometry.F, "#ff00d4", 5);

          if (FVisual) {
            drawPoint("FVisual original", FVisual, "#888888", 4);
          }

          if (FPhone) {
            drawPoint("FPhone x = A.x", FPhone, "#ff00d4", 5);
            state.phoneGuideX = geometry.A && Number.isFinite(geometry.A.x) ? geometry.A.x : FPhone.x;
            state.layers.intended.appendChild(svgElement("line", {
              x1: state.phoneGuideX,
              y1: 0,
              x2: state.phoneGuideX,
              y2: window.innerHeight,
              stroke: "#32ff00",
              "stroke-width": 2,
              "stroke-dasharray": "8 8"
            }));
          }
        } else {
          drawPoint("A", geometry.A, "#ff8a00", 5);
          drawPoint("B", geometry.P1 || geometry.DHigh, "#16a34a", 5);
          drawPoint("C", geometry.C, "#ff1f1f", 5);
          drawPoint("D", geometry.P2 || geometry.EHigh, "#7c3aed", 5);
          drawPoint("E", geometry.E, "#00c7d9", 5);
          drawPoint("F", geometry.F, "#ff00d4", 5);
        }

        setPanel({
          pathMode: path.mode,
          totalPathLength: path.totalLength
        });

        if (DEBUG_NAV_TRAJECTORY_LOGS) {
          console.table({
            stage: "nav-trajectory-debug-path",
            pathMode: path.mode,
            sampleCount: samples.length,
            totalPathLength: round(path.totalLength),
            A: JSON.stringify(geometry.A || null),
            B: JSON.stringify(geometry.P1 || geometry.DHigh || null),
            C: JSON.stringify(geometry.C || null),
            D: JSON.stringify(geometry.P2 || geometry.EHigh || null),
            E: JSON.stringify(geometry.E || null),
            F: JSON.stringify(geometry.F || null),
            FVisualOriginal: JSON.stringify(FVisual || null),
            FPhone: JSON.stringify(FPhone || null)
          });
        }
      }

      function addTracePoint(phase, point) {
        const key = traceKeyForPhase(phase);
        const points = state.tracePoints[key];
        const last = points[points.length - 1];

        if (!state.active || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
          return;
        }

        if (!last || Math.abs(last.x - point.x) > 0.15 || Math.abs(last.y - point.y) > 0.15) {
          points.push({ x: point.x, y: point.y });
          updateTracePath(key);
        }

        if (
          state.phoneGuideX !== null &&
          phase !== PHASE.ROLL &&
          phase !== PHASE.PLUS &&
          Math.abs(point.x - state.phoneGuideX) > 0.5 &&
          !state.phoneLateralWarned
        ) {
          state.phoneLateralWarned = true;

          if (DEBUG_NAV_TRAJECTORY_LOGS) {
            console.warn("BUG: phone ball has lateral motion", point.x, state.phoneGuideX);
          }
        }
      }

      function drawPrepBase(index, point) {
        const colours = ["#ff8a00", "#ffd400", "#ff1f1f"];

        drawRing("prep base " + (index + 1), point, colours[index] || "#ff8a00", 8 + index * 2);
      }

      function drawLandingBase(index, point) {
        const colours = ["#ff00d4", "#8b5cf6", "#ff80c8"];

        drawRing("landing base " + (index + 1), point, colours[index] || "#ff00d4", 8 + index * 2);
      }

      function updateFrame(extra) {
        setPanel(extra);
      }

      return {
        startTrip: startTrip,
        drawPath: drawPath,
        addTracePoint: addTracePoint,
        drawPrepBase: drawPrepBase,
        drawLandingBase: drawLandingBase,
        updateFrame: updateFrame
      };
    }

    function getTrajectoryDebugOverlay() {
      if (!DEBUG_NAV_TRAJECTORY_OVERLAY) {
        return null;
      }

      if (!navTrajectoryDebug) {
        navTrajectoryDebug = createNavTrajectoryDebugOverlay();
      }

      return navTrajectoryDebug;
    }

    function motionScale() {
      return isMobileViewport() ? MOBILE_BALL_TIME_SCALE : 1;
    }

    function scaleMotionDuration(duration) {
      return reducedMotion.matches ? 1 : duration * motionScale();
    }

    /* -------------------------------------------------------------- state + bookkeeping */

    function setState(nextState) {
      navState = nextState;
      nav.dataset.navState = nextState;
      ball.dataset.ballState = nextState;
    }

    function setBallPhase(phase) {
      ball.dataset.ballPhase = phase;
    }

    function clearBallTimersAndFrames() {
      ballFrames.forEach(function (frameId) {
        window.cancelAnimationFrame(frameId);
      });
      ballTimers.forEach(function (timerId) {
        window.clearTimeout(timerId);
      });
      ballFrames = [];
      ballTimers = [];
      window.clearTimeout(resetTimer);
      resetTimer = 0;
    }

    function isCurrentAnimation(token) {
      return token === activeAnimationToken;
    }

    function requestBallFrame(callback, token) {
      const frameId = window.requestAnimationFrame(function (now) {
        ballFrames = ballFrames.filter(function (storedFrameId) {
          return storedFrameId !== frameId;
        });

        if (!isCurrentAnimation(token)) {
          return;
        }

        try {
          callback(now);
        } catch (error) {
          console.error("Navigation ball animation failed", error);
          resetBallState(STATES.PLUS_IDLE);
          clearChoiceState(STATES.PLUS_IDLE);
        }
      });

      ballFrames.push(frameId);
      return frameId;
    }

    function setBallTimeout(callback, delay, token) {
      const timerId = window.setTimeout(function () {
        ballTimers = ballTimers.filter(function (storedTimerId) {
          return storedTimerId !== timerId;
        });

        if (!isCurrentAnimation(token)) {
          return;
        }

        callback();
      }, delay);

      ballTimers.push(timerId);
      return timerId;
    }

    function cancelBallAnimation() {
      activeAnimationToken += 1;
      clearBallTimersAndFrames();
    }

    function beginBallAnimation() {
      cancelBallAnimation();
      activeAnimationToken += 1;
      return activeAnimationToken;
    }

    /* -------------------------------------------------------------- user scroll lock while the ball travels */

    function preventScrollInput(event) {
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    function preventScrollKeys(event) {
      const typingTarget = event.target;

      if (typingTarget && typingTarget.nodeType === 1 && (typingTarget.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(typingTarget.tagName))) {
        return; // never interfere with typing in the contact form
      }

      const keys = [" ", "Spacebar", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];

      if (keys.indexOf(event.key) !== -1 && event.cancelable) {
        event.preventDefault();
      }
    }

    function lockUserScroll() {
      if (scrollLockActive) {
        return;
      }

      scrollLockActive = true;
      window.addEventListener("wheel", preventScrollInput, { passive: false });
      window.addEventListener("touchmove", preventScrollInput, { passive: false });
      window.addEventListener("keydown", preventScrollKeys, { passive: false });
    }

    function unlockUserScroll() {
      if (!scrollLockActive) {
        return;
      }

      scrollLockActive = false;
      window.removeEventListener("wheel", preventScrollInput, { passive: false });
      window.removeEventListener("touchmove", preventScrollInput, { passive: false });
      window.removeEventListener("keydown", preventScrollKeys, { passive: false });
    }

    /* -------------------------------------------------------------- landing animation hooks (kept as they were) */

    function landingAnimationController() {
      return window.landingGirlAnimation || null;
    }

    function shouldDelayForLandingAnimation(targetId) {
      const landingAnimation = landingAnimationController();

      return targetId !== "landing" &&
        landingAnimation &&
        typeof landingAnimation.isLandingActive === "function" &&
        landingAnimation.isLandingActive() &&
        typeof landingAnimation.interruptForNavigation === "function";
    }

    function notifyLandingPlusOpened() {
      const landingAnimation = landingAnimationController();

      window.dispatchEvent(new CustomEvent("landing-nav-plus-opened"));

      if (
        landingAnimation &&
        typeof landingAnimation.isLandingActive === "function" &&
        landingAnimation.isLandingActive() &&
        typeof landingAnimation.handlePlusDistraction === "function"
      ) {
        landingAnimation.handlePlusDistraction();
      }
    }

    function startLandingAnimationInterrupt(targetId) {
      const landingAnimation = landingAnimationController();

      if (!shouldDelayForLandingAnimation(targetId)) {
        return Promise.resolve();
      }

      window.dispatchEvent(new CustomEvent("landing-nav-circle-selected", { detail: { targetSectionId: targetId } }));
      return landingAnimation.interruptForNavigation();
    }

    /* -------------------------------------------------------------- travelling ball: visuals */

    function ballDiameter() {
      return ball.offsetWidth || 44; // layout size: not affected by the squash transform
    }

    function ballRadius() {
      return ballDiameter() / 2;
    }

    function setBallPosition(x, y) {
      ball.style.setProperty("--ball-x", x + "px");
      ball.style.setProperty("--ball-y", y + "px");

      if (navTrajectoryDebug) {
        navTrajectoryDebug.addTracePoint(ball.dataset.ballPhase || PHASE.MORPH, { x: x, y: y });
      }
    }

    function setBallScale(scaleX, scaleY) {
      ball.style.setProperty("--ball-scale-x", String(scaleX));
      ball.style.setProperty("--ball-scale-y", String(scaleY));
    }

    function applyBounceScale(raw, intensity) {
      const p = clamp(raw, 0, 1);
      const liftRatio = 4 * p * (1 - p);
      const safeIntensity = clamp(intensity, 0, 1);

      setBallScale(
        mix(1 + 0.08 * safeIntensity, 1 - 0.04 * safeIntensity, liftRatio),
        mix(1 - 0.08 * safeIntensity, 1 + 0.06 * safeIntensity, liftRatio)
      );
    }

    function setTimelineShadow(opacity, scale) {
      if (!travelShadow) {
        return;
      }

      travelShadow.style.animation = "none";
      travelShadow.style.transition = "none";
      travelShadow.style.opacity = String(clamp(opacity, 0, 1));
      travelShadow.style.transform = "translateX(-50%) scaleX(" + clamp(scale, 0.5, 1.4) + ")";
    }

    function resetTimelineShadow() {
      if (!travelShadow) {
        return;
      }

      travelShadow.style.animation = "";
      travelShadow.style.transition = "";
      travelShadow.style.opacity = "";
      travelShadow.style.transform = "";
    }

    function resetBallClasses() {
      ball.classList.remove(
        "is-visible",
        "is-forming",
        "is-ready",
        "is-lifting",
        "is-moving",
        "is-flying",
        "is-landing",
        "is-landed",
        "is-arrived",
        "is-paused",
        "is-rolling",
        "is-restoring",
        "is-contact-landing",
        "is-launching"
      );
    }

    function hideTravelBallImmediately() {
      resetBallClasses();
      ball.style.opacity = "0";
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
      ball.style.removeProperty("--restore-duration");
      delete ball.dataset.ballPhase;
      resetTimelineShadow();
    }

    function hideTravelBallForPlusRestore() {
      ball.style.transition = "none";
      resetBallClasses();
      ballLabel.textContent = "";
      ball.style.opacity = "0";
      ball.style.setProperty("--ball-x", "-9999px");
      ball.style.setProperty("--ball-y", "-9999px");
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
      ball.style.removeProperty("--restore-duration");
      resetTimelineShadow();

      window.requestAnimationFrame(function () {
        ball.style.transition = "";
        resetTimelineShadow();
      });
    }

    function resetBallState(finalState) {
      cancelBallAnimation();
      hideTravelBallImmediately();
      ballLabel.textContent = "";
      isTravelling = false;
      isBallAnimating = false;
      unlockUserScroll();
      nav.classList.remove("is-plus-restoring", "is-ball-closing");
      document.documentElement.classList.remove("is-ball-animating");
      setState(finalState || STATES.PLUS_IDLE);
    }

    /* -------------------------------------------------------------- menu a11y + current section ("home" label logic) */

    function setMenuA11y(open) {
      core.setAttribute("aria-expanded", String(open));
      core.setAttribute("aria-label", isProjectMode ? "close project" : open ? "close navigation" : "open navigation");
      menu.setAttribute("aria-hidden", String(!open));
      items.forEach(function (item) {
        item.tabIndex = open ? 0 : -1;
      });
    }

    function detectCurrentSection() {
      const scrollY = currentScrollY();
      const probe = scrollY + window.innerHeight * 0.52;
      let detected = "landing";

      SECTION_IDS.forEach(function (id) {
        const section = document.getElementById(id);

        if (!section) {
          return;
        }

        if (section.getBoundingClientRect().top + scrollY <= probe) {
          detected = id;
        }
      });

      return detected;
    }

    function updateCurrentSection(section, force) {
      const nextSection = section || detectCurrentSection();

      if (!force && isTravelling) {
        return;
      }

      currentSection = nextSection;
      items.forEach(function (button) {
        const original = originalTarget(button);
        const isCurrentDestination = currentSection !== "landing" && original === currentSection;
        const nextLabel = isCurrentDestination ? "home" : button.dataset.navOriginalLabel || original;
        const nextTarget = isCurrentDestination ? "landing" : original;

        if (button.textContent.trim() !== nextLabel) {
          button.textContent = nextLabel;
        }

        button.setAttribute("data-nav-target", nextTarget);
        button.setAttribute("aria-label", isCurrentDestination ? "go home" : "go to " + original);
      });

      if (isOpen) {
        updateSpokeGeometry();
      }
    }

    function queueCurrentSectionUpdate() {
      if (isTravelling || sectionFrame) {
        return;
      }

      sectionFrame = window.requestAnimationFrame(function () {
        sectionFrame = 0;
        updateCurrentSection(detectCurrentSection());
      });
    }

    /* -------------------------------------------------------------- spokes (SVG dotted lines revealed through masks) */

    function ensureSpokeMask(label) {
      let maskParts = spokeMasks[label];

      if (maskParts) {
        return maskParts;
      }

      let defs = spokes.querySelector("defs");

      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        spokes.insertBefore(defs, spokes.firstChild);
      }

      const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const drawLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const maskId = "nav-spoke-mask-" + label;

      mask.setAttribute("id", maskId);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      rect.setAttribute("fill", "black");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      drawLine.setAttribute("stroke", "white");
      drawLine.setAttribute("stroke-width", "8");
      drawLine.setAttribute("stroke-linecap", "round");
      drawLine.setAttribute("fill", "none");
      drawLine.setAttribute("vector-effect", "non-scaling-stroke");

      mask.appendChild(rect);
      mask.appendChild(drawLine);
      defs.appendChild(mask);

      maskParts = { id: maskId, mask: mask, rect: rect, drawLine: drawLine, length: 0 };
      spokeMasks[label] = maskParts;
      return maskParts;
    }

    function playSpokeDraw(options) {
      const staged = Boolean(options && options.staged);
      const duration = reducedMotion.matches ? 1 : staged ? PHONE_MENU_SPOKE_DURATION : 560;

      ["about", "work", "archive", "contact"].forEach(function (label, index) {
        const maskParts = spokeMasks[label];

        if (!maskParts) {
          return;
        }

        maskParts.drawLine.style.transition = "stroke-dashoffset " + duration + "ms cubic-bezier(0.22, 1, 0.36, 1)";
        maskParts.drawLine.style.transitionDelay = reducedMotion.matches ? "0ms" : staged ? index * PHONE_MENU_SPOKE_STAGGER + "ms" : 520 + index * 38 + "ms";
        maskParts.drawLine.style.strokeDashoffset = "0";
      });
    }

    function readPlusGeometry() {
      const coreRect = core.getBoundingClientRect();

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        measuredPlusCentreX: coreRect.left + coreRect.width / 2,
        measuredPlusCentreY: coreRect.top + coreRect.height / 2,
        measuredSpokeOriginX: coreRect.left + coreRect.width / 2,
        measuredSpokeOriginY: coreRect.top
      };
    }

    function updateSpokeGeometry(options) {
      const resetDraw = Boolean(options && options.resetDraw);
      const plus = readPlusGeometry();
      const originX = plus.measuredSpokeOriginX;
      const originY = plus.measuredSpokeOriginY;

      spokes.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
      spokes.setAttribute("width", String(window.innerWidth));
      spokes.setAttribute("height", String(window.innerHeight));

      items.forEach(function (button) {
        const label = originalTarget(button);
        const line = lines[label];
        const point = centerOf(button);

        if (!line) {
          return;
        }

        const length = Math.max(1, Math.hypot(point.x - originX, point.y - originY));
        const maskParts = ensureSpokeMask(label);

        maskParts.length = length;
        maskParts.mask.setAttribute("x", "0");
        maskParts.mask.setAttribute("y", "0");
        maskParts.mask.setAttribute("width", String(window.innerWidth));
        maskParts.mask.setAttribute("height", String(window.innerHeight));
        maskParts.rect.setAttribute("width", String(window.innerWidth));
        maskParts.rect.setAttribute("height", String(window.innerHeight));
        maskParts.drawLine.setAttribute("x1", originX);
        maskParts.drawLine.setAttribute("y1", originY);
        maskParts.drawLine.setAttribute("x2", point.x);
        maskParts.drawLine.setAttribute("y2", point.y);
        maskParts.drawLine.style.strokeDasharray = String(length);

        if (resetDraw) {
          maskParts.drawLine.style.transition = "none";
          maskParts.drawLine.style.transitionDelay = "0ms";
          maskParts.drawLine.style.strokeDashoffset = String(length);
        } else if (isOpen) {
          maskParts.drawLine.style.strokeDashoffset = "0";
        }

        line.setAttribute("x1", originX);
        line.setAttribute("y1", originY);
        line.setAttribute("x2", point.x);
        line.setAttribute("y2", point.y);
        line.setAttribute("vector-effect", "non-scaling-stroke");
        line.setAttribute("mask", "url(#" + maskParts.id + ")");
        line.removeAttribute("pathLength");
      });
    }

    function queueNavGeometryUpdate() {
      if (navGeometryFrame) {
        return;
      }

      navGeometryFrame = window.requestAnimationFrame(function () {
        navGeometryFrame = 0;
        updateSpokeGeometry();
      });
    }

    /* -------------------------------------------------------------- menu open / close (desktop hover + click, staged phone opening) */

    function clearPhoneMenuState() {
      window.clearTimeout(phoneMenuReadyTimer);
      phoneMenuReadyTimer = 0;
      isPhoneNavOpening = false;
      isPhoneNavOpen = false;
      nav.classList.remove("is-phone-nav-preparing", "is-phone-nav-opening", "is-phone-nav-ready");
    }

    function setOpen(open, options) {
      if (isTravelling || isProjectMode || isBallAnimating) {
        return; // the console stays untouched while a ball animation or the plus restore is running
      }

      const staged = Boolean(options && options.staged);

      window.clearTimeout(closeOnBlurTimer);

      if (!open) {
        clearPhoneMenuState();
      }

      if (open) {
        updateCurrentSection(detectCurrentSection(), true);
      }

      isOpen = open;
      nav.classList.toggle("is-open", open);
      setState(open ? STATES.MENU_OPEN : STATES.PLUS_IDLE);
      setMenuA11y(open);

      if (open && !staged) {
        window.requestAnimationFrame(function () {
          updateSpokeGeometry({ resetDraw: true });
          window.requestAnimationFrame(function () {
            playSpokeDraw();
          });
        });
        window.setTimeout(function () {
          updateSpokeGeometry();
        }, reducedMotion.matches ? 1 : 1120);
      }
    }

    /* Phone menu: closed state first -> two animation frames -> spokes outward, circles staggered -> pointer-events on after the animation. */
    function openStagedMenu() {
      if (isPhoneNavOpening || isOpen || isTravelling || isProjectMode || isBallAnimating) {
        return;
      }

      clearPhoneMenuState();
      isPhoneNavOpening = true;
      nav.classList.add("is-phone-nav-preparing");
      updateCurrentSection(detectCurrentSection(), true);
      updateSpokeGeometry({ resetDraw: true });

      if (DEBUG_PHONE_NAV_BALL) {
        console.debug("phone nav: prepared closed state", { viewport: [window.innerWidth, window.innerHeight] });
      }

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if (!isPhoneNavOpening || isTravelling || isProjectMode) {
            clearPhoneMenuState();
            return;
          }

          nav.classList.remove("is-phone-nav-preparing");
          nav.classList.add("is-phone-nav-opening");
          setOpen(true, { staged: true });
          playSpokeDraw({ staged: true });

          phoneMenuReadyTimer = window.setTimeout(function () {
            if (!isOpen) {
              return;
            }

            nav.classList.add("is-phone-nav-ready");
            isPhoneNavOpening = false;
            isPhoneNavOpen = true;
            updateSpokeGeometry(); // re-measure once the circles have settled (covers a rotation during the opening)

            if (DEBUG_PHONE_NAV_BALL) {
              console.debug("phone nav: open and interactive");
            }
          }, reducedMotion.matches ? 1 : PHONE_MENU_READY_DELAY);
        });
      });
    }

    function clearChoiceState(finalState) {
      nav.classList.remove("is-open", "is-choosing", "is-travelling");
      clearPhoneMenuState();
      items.forEach(function (item) {
        item.disabled = false;
        item.parentElement.classList.remove("is-selected");
      });
      setMenuA11y(false);
      isOpen = false;
      isTravelling = false;
      setState(finalState || STATES.PLUS_IDLE);
    }

    /* -------------------------------------------------------------- project popup interplay (unchanged contract) */

    function enterProjectMode() {
      resetBallState(STATES.PLUS_IDLE);
      clearChoiceState(STATES.PLUS_IDLE); // re-enables the circles if a project opens in the middle of a trip

      isOpen = false;
      nav.classList.remove("is-open", "is-choosing", "is-travelling");
      clearPhoneMenuState();
      isProjectMode = true;
      nav.classList.remove("is-project-closing");
      nav.classList.add("is-project-close");
      setState(STATES.PLUS_IDLE);
      setMenuA11y(false);
    }

    function beginProjectClose() {
      if (!isProjectMode) {
        return;
      }

      nav.classList.add("is-project-closing");
      setMenuA11y(false);
    }

    function exitProjectMode() {
      isProjectMode = false;
      nav.classList.remove("is-project-close", "is-project-closing");
      setMenuA11y(false);
      updateCurrentSection(detectCurrentSection(), true);
    }

    /* -------------------------------------------------------------- destination logic (kept from the previous working version) */

    function getSafeBounds(options) {
      const radius = ballRadius();
      const margin = Math.max(radius + 18, 18);
      const allowFloor = Boolean(options && options.allowFloor);

      return {
        minX: margin,
        maxX: window.innerWidth - margin,
        minY: margin,
        maxY: allowFloor ? window.innerHeight - radius : window.innerHeight - margin,
        floorY: window.innerHeight - radius
      };
    }

    function sectionTopScroll(sectionId) {
      const section = document.getElementById(sectionId);
      const sectionTop = section ? section.getBoundingClientRect().top + currentScrollY() : maxScrollY();

      return clamp(sectionTop, 0, maxScrollY());
    }

    function contactFloor() {
      const contact = document.getElementById("contact");
      const contactTop = contact ? contact.getBoundingClientRect().top + currentScrollY() : sectionTopScroll("contact");

      return {
        element: contact,
        section: "contact",
        side: "right",
        kind: "floor",
        x: window.innerWidth * 0.78,
        y: contactTop + window.innerHeight,
        width: window.innerWidth,
        height: 1
      };
    }

    function targetPlatformFor(section) {
      if (section === "landing") {
        return platformFromElement(document.querySelector(".landing-media") || document.getElementById("landing"), "landing", "center");
      }

      if (section === "about") {
        return platformFromElement(document.querySelector(".about-portrait img") || document.querySelector(".about-portrait"), "about", "left");
      }

      if (section === "work") {
        return platformFromElement(document.querySelector(".work-tile"), "work", "left");
      }

      if (section === "archive") {
        return platformFromElement(document.querySelector(".archive-bar"), "archive", "right");
      }

      if (section === "contact") {
        return contactFloor();
      }

      return platformFromElement(document.getElementById(section) || document.body, section, "center");
    }

    function visiblePathTopMargin(bounds) {
      return Math.max(ballRadius() + 24, bounds && Number.isFinite(bounds.minY) ? bounds.minY : 0);
    }

    function tripBounceHeight(isPhone) {
      const ballSize = ballDiameter();

      return isPhone ? clamp(ballSize * 1.45, 38, 72) : clamp(ballSize * 2, 64, 118);
    }

    /* the scroll position that puts the landing point at a comfortable height of the final screen */
    function resolveScrollTarget(endPoint, targetId, bounds) {
      const radius = ballRadius();
      const maxScroll = maxScrollY();
      const safeTop = visiblePathTopMargin(bounds);
      const z = tripBounceHeight(false);
      const overshoot = clamp(z * 0.65, 36, 84);
      const minLandingY = safeTop + overshoot + 8;
      const preferredLandingY = Math.max(window.innerHeight * 0.58, minLandingY);
      const desiredLandingY = clamp(preferredLandingY, bounds.minY, bounds.maxY);

      if (endPoint.kind === "floor" && endPoint.section === "contact") {
        return sectionTopScroll("contact");
      }

      if (endPoint.kind === "floor") {
        return maxScroll;
      }

      return clamp(endPoint.y - (desiredLandingY + radius), 0, maxScroll);
    }

    /* final visible landing point F (viewport coordinates, after the page has reached scrollTarget) */
    function resolveFinalLandingPoint(endPoint, scrollTarget, targetId, bounds) {
      const raw = { x: endPoint.x, y: endPoint.y - scrollTarget - ballRadius() };

      if (targetId === "contact") {
        return { x: clamp(raw.x, bounds.minX, bounds.maxX), y: bounds.floorY };
      }

      return { x: clamp(raw.x, bounds.minX, bounds.maxX), y: clamp(raw.y, bounds.minY, bounds.maxY) };
    }

    /* -------------------------------------------------------------- plus reappears in place */

    function showPlusInPlace(token, targetId) {
      const restoreDuration = reducedMotion.matches ? 1 : 420; // matches the plusRestore animation in motion.css

      if (!isCurrentAnimation(token)) {
        return;
      }

      setBallPhase(PHASE.PLUS);

      if (DEBUG_NAV_BALL_SEQUENCE) {
        console.table({ stage: "plus-reappear-in-place", targetId: targetId, travelBallHidden: true, plusState: STATES.PLUS_RESTORED });
      }

      hideTravelBallForPlusRestore();
      nav.classList.add("is-plus-restoring");
      document.documentElement.classList.remove("is-ball-animating");
      unlockUserScroll();
      clearChoiceState(STATES.PLUS_RESTORED);

      resetTimer = setBallTimeout(function () {
        nav.classList.remove("is-plus-restoring");
        hideTravelBallImmediately();
        isBallAnimating = false;
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, restoreDuration, token);
    }

    function morphBallIntoPlus(token, options) {
      const restoreDuration = scaleMotionDuration(options && typeof options.duration === "number" ? options.duration : 260);

      if (!isCurrentAnimation(token)) {
        return;
      }

      setState(STATES.PLUS_RESTORED);
      ball.style.setProperty("--restore-duration", restoreDuration + "ms");
      ball.style.removeProperty("--ball-scale-x"); // let the is-restoring class shrink the ball into the plus
      ball.style.removeProperty("--ball-scale-y");
      ball.classList.add("is-restoring");
      nav.classList.add("is-ball-closing");
      clearChoiceState(STATES.PLUS_RESTORED);
      document.documentElement.classList.remove("is-ball-animating");
      unlockUserScroll();

      resetTimer = setBallTimeout(function () {
        resetBallState(STATES.PLUS_IDLE);
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, reducedMotion.matches ? 1 : restoreDuration, token);
    }

    /* -------------------------------------------------------------- home: three prep bounces, arc to the plus, ball becomes the plus */

    function bounceLift(raw, height) {
      const safeRaw = clamp(raw, 0, 1);
      const apexAt = 0.43;

      if (safeRaw <= apexAt) {
        return Math.sin((safeRaw / apexAt) * (Math.PI / 2)) * height;
      }

      return Math.cos(((safeRaw - apexAt) / (1 - apexAt)) * (Math.PI / 2)) * height;
    }

    function runHomeReturnMotion(startScreen, targetId, token) {
      const startScroll = currentScrollY();
      const plus = readPlusGeometry();
      const endScreen = { x: plus.measuredPlusCentreX, y: plus.measuredPlusCentreY };
      const dx = endScreen.x - startScreen.x;
      const prepHeights = [clamp(window.innerHeight * 0.034, 24, 34)];
      prepHeights.push(clamp(prepHeights[0] * 1.7, 40, 58));
      prepHeights.push(clamp(prepHeights[1] * 1.34, 52, 76));
      const baseDurations = [clamp(window.innerHeight * 0.52, 380, 440)];
      baseDurations.push(clamp(baseDurations[0] + 80, 420, 540));
      baseDurations.push(clamp(baseDurations[1] + 70, 460, 620));
      const prepDurations = baseDurations.map(scaleMotionDuration);
      const previousArc = scaleMotionDuration(clamp(Math.abs(startScreen.y - endScreen.y) * 0.78 + Math.abs(dx) * 0.28 + 900, 1300, 2200) * 2.1);
      const leadProgress = 0.65;
      const leadDuration = previousArc * leadProgress;
      const finalDuration = previousArc * (1 - leadProgress) * 1.6;
      const arcDuration = leadDuration + finalDuration;
      const prep1End = prepDurations[0];
      const prep2End = prep1End + prepDurations[1];
      const prep3End = prep2End + prepDurations[2];
      const arcEnd = prep3End + arcDuration;
      const apexY = clamp(window.innerHeight * 0.12, 72, 128);
      const launchLift = clamp(window.innerHeight * 0.42, 260, 480);
      const p0 = startScreen;
      const p1 = { x: startScreen.x + dx * 0.08, y: Math.min(startScreen.y - launchLift, apexY + 120) };
      const p2 = { x: window.innerWidth / 2, y: apexY };
      const p3 = endScreen;
      const cleanUrl = window.location.pathname + window.location.search;
      let startTime = 0;

      if (!isCurrentAnimation(token)) {
        return;
      }

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        scrollInstantly(0);
        setBallPosition(endScreen.x, endScreen.y);
        updateCurrentSection("landing", true);
        morphBallIntoPlus(token, {});
        return;
      }

      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving");
      resetTimelineShadow();

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        const elapsed = clamp(now - startTime, 0, arcEnd);
        let raw;

        if (elapsed < prep3End) {
          const index = elapsed < prep1End ? 0 : elapsed < prep2End ? 1 : 2;
          const phaseStart = index === 0 ? 0 : index === 1 ? prep1End : prep2End;

          raw = (elapsed - phaseStart) / prepDurations[index];
          setBallPhase([PHASE.PREP1, PHASE.PREP2, PHASE.PREP3][index]);
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(startScreen.x, startScreen.y - bounceLift(raw, prepHeights[index]));
        } else if (elapsed < arcEnd) {
          const arcElapsed = elapsed - prep3End;

          if (arcElapsed < leadDuration) {
            raw = (arcElapsed / leadDuration) * leadProgress;
          } else {
            raw = leadProgress + (1 - leadProgress) * easeOutCubic((arcElapsed - leadDuration) / finalDuration);
          }

          const point = cubicBezierPoint(p0, p1, p2, p3, raw);
          setBallPhase(PHASE.MAIN);
          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting");
          ball.classList.add("is-flying");
          scrollInstantly(mix(startScroll, 0, easeInOutCubic(raw)));
          setBallPosition(point.x, point.y);
        } else {
          scrollInstantly(0);
          setBallPosition(endScreen.x, endScreen.y);
          resetTimelineShadow();
          updateCurrentSection("landing", true);

          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", cleanUrl);
          }

          morphBallIntoPlus(token, { duration: 680 });
          return;
        }

        setTimelineShadow(0, 0.72);
        requestBallFrame(frame, token);
      }

      requestBallFrame(frame, token);
    }

    /* -------------------------------------------------------------- the trip: prep bounces -> main path (+ scroll) -> landing bounces -> roll */

    function runTrip(A0, targetId, token) {
      const isPhone = isMobileViewport();
      const bounds = getSafeBounds({ allowFloor: targetId === "contact" });
      const radius = ballRadius();
      const z = tripBounceHeight(isPhone);
      const prepHeights = [z / 4, z / 2, (3 * z) / 4];
      const landingHeights = [(3 * z) / 4, z / 2, z / 4];
      const prepDurations = NAV_BALL_PREP_DURATIONS.map(scaleMotionDuration);
      const landingDurations = NAV_BALL_LANDING_DURATIONS.map(scaleMotionDuration);
      const rollDuration = scaleMotionDuration(NAV_BALL_ROLL_DURATION);
      const rollDirection = rollDirectionFor(targetId);
      const rollCircumference = Math.max(1, Math.PI * radius * 2);
      const target = document.getElementById(targetId);
      const cleanUrl = window.location.pathname + window.location.search;
      const scrollStart = currentScrollY(); // captured once; frozen until the main path starts
      const debugInfo = {
        deviceType: isPhone ? "phone" : "desktop/tablet",
        pathMode: isPhone ? "phone-vertical" : NAV_BALL_PATH_MODE,
        A0: copyPoint(A0),
        z: z,
        prepBases: [],
        prepScroll: [],
        landingBases: [],
        scrollMovedDuringPrep: false,
        scrollMovedDuringLanding: false,
        lastPathProgress: 0,
        lastScrollProgress: 0,
        lateral: { min: A0.x, max: A0.x }
      };
      const trajectoryDebug = getTrajectoryDebugOverlay();
      let endPoint = null; // measured only after the third prep bounce (the page has not moved, so nothing changes - but nothing is recomputed early either)
      let scrollTarget = scrollStart;
      let F = null;
      let FVisual = null;
      let path = null;
      let mainMs = 1;
      let phase = PHASE.PREP1;
      let phaseStart = 0;
      let speedMin = Infinity;
      let speedMax = 0;
      let previousSample = null;
      let rollStartX = 0;
      let rollEndX = 0;

      if (!isCurrentAnimation(token)) {
        return;
      }

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        const reducedEnd = targetPlatformFor(targetId);
        const reducedScroll = resolveScrollTarget(reducedEnd, targetId, bounds);
        const reducedPoint = resolveFinalLandingPoint(reducedEnd, reducedScroll, targetId, bounds);

        scrollInstantly(reducedScroll);
        setBallPosition(reducedPoint.x, reducedPoint.y);
        updateCurrentSection(targetId, true);
        showPlusInPlace(token, targetId);
        return;
      }

      if (trajectoryDebug) {
        trajectoryDebug.startTrip({
          targetId: targetId,
          deviceType: debugInfo.deviceType,
          pathMode: debugInfo.pathMode,
          A0: copyPoint(A0),
          scrollStart: scrollStart,
          scrollTarget: scrollTarget,
          z: z,
          phase: PHASE.MORPH
        });
      }

      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving");
      resetTimelineShadow();

      function freezeScrollAt(y, flagName) {
        if (Math.abs(currentScrollY() - y) > 0.5) {
          debugInfo[flagName] = true;
          scrollInstantly(y);
        }
      }

      /* after prep bounce 3: compute the final scroll target, the final visible landing point F and the one continuous path */
      function buildMainPath() {
        endPoint = targetPlatformFor(targetId);
        scrollTarget = resolveScrollTarget(endPoint, targetId, bounds);
        FVisual = resolveFinalLandingPoint(endPoint, scrollTarget, targetId, bounds);
        F = copyPoint(FVisual);

        if (isPhone) {
          F = { x: A0.x, y: F.y }; // phone: the ball never moves sideways before the roll-away
        }

        const safeTop = visiblePathTopMargin(bounds);

        path = isPhone ? buildPhonePath(A0, F, z, safeTop) : buildDesktopPath(A0, F, z, safeTop, NAV_BALL_PATH_MODE);
        mainMs = Math.max(1, (path.totalLength / path.speed) * 1000);
        rollStartX = F.x;
        rollEndX = rollDirection < 0 ? -radius - 18 : window.innerWidth + radius + 18;

        if (trajectoryDebug) {
          trajectoryDebug.drawPath(path, {
            FVisual: isPhone ? FVisual : null,
            FPhone: isPhone ? F : null
          });
          trajectoryDebug.updateFrame({
            pathMode: path.mode,
            scrollTarget: scrollTarget,
            totalPathLength: path.totalLength,
            scrollFrozen: false
          });
        }

        if (DEBUG_NAV_BALL_SEQUENCE || DEBUG_NAV_BALL_SPLINE || DEBUG_PHONE_NAV_BALL) {
          const geometry = path.geometry || {};

          console.table({
            device: debugInfo.deviceType,
            pathMode: path.mode,
            A0: JSON.stringify(A0),
            z: round(z),
            prepBounceBase1: JSON.stringify(debugInfo.prepBases[0] || null),
            prepBounceBase2: JSON.stringify(debugInfo.prepBases[1] || null),
            prepBounceBase3: JSON.stringify(debugInfo.prepBases[2] || null),
            prepScroll: JSON.stringify(debugInfo.prepScroll.map(round)),
            scrollStart: round(scrollStart),
            scrollTarget: round(scrollTarget),
            F: JSON.stringify(F),
            pathTotalLength: round(path.totalLength),
            speed: path.speed,
            visibilityAdjustment: round(path.visibilityAdjustment || 0),
            safeTop: round(safeTop)
          });

          if (DEBUG_NAV_BALL_SPLINE && geometry.E) {
            console.debug("nav ball arch points", { A: geometry.A, P1: geometry.P1, P2: geometry.P2, E: geometry.E, F: geometry.F, guideY: geometry.guideY, lift: geometry.lift, height: geometry.height, control: geometry.control });
          }
        }

        if (debugInfo.scrollMovedDuringPrep) {
          console.warn("BUG: scroll moved during prep bounces");
        }

        if (debugInfo.prepBases.some(function (base) {
          return base && (Math.abs(base.x - A0.x) > 0.5 || Math.abs(base.y - A0.y) > 0.5);
        })) {
          console.warn("BUG: prep bounce base drift", debugInfo.prepBases[0], debugInfo.prepBases[1], debugInfo.prepBases[2]);
        }
      }

      function phaseDuration(name) {
        switch (name) {
          case PHASE.PREP1:
            return prepDurations[0];
          case PHASE.PREP2:
            return prepDurations[1];
          case PHASE.PREP3:
            return prepDurations[2];
          case PHASE.MAIN:
            return mainMs;
          case PHASE.LAND1:
            return landingDurations[0];
          case PHASE.LAND2:
            return landingDurations[1];
          case PHASE.LAND3:
            return landingDurations[2];
          default:
            return rollDuration;
        }
      }

      function enterPhase(name) {
        phase = name;
        setBallPhase(name);

        if (name === PHASE.PREP1 || name === PHASE.PREP2 || name === PHASE.PREP3) {
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          debugInfo.prepBases.push(copyPoint(A0));
          debugInfo.prepScroll.push(currentScrollY());

          if (trajectoryDebug) {
            trajectoryDebug.drawPrepBase(debugInfo.prepBases.length - 1, A0);
          }

          setTimelineShadow(0, 0.72);
          return;
        }

        if (name === PHASE.MAIN) {
          buildMainPath();
          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting", "is-landing", "is-landed", "is-arrived");
          ball.classList.add("is-flying");
          previousSample = null;
          return;
        }

        if (name === PHASE.LAND1) {
          /* exact landing: ball at F, scroll exactly at scrollTarget, then everything is frozen */
          scrollInstantly(scrollTarget);
          setBallPosition(F.x, F.y);
          setState(STATES.BALL_LANDING);
          ball.classList.remove("is-moving", "is-flying", "is-lifting", "is-launching");

          if (endPoint.kind === "floor") {
            ball.classList.add("is-contact-landing", "is-arrived");
            setTimelineShadow(0, 0.72);
          } else {
            ball.classList.add("is-landing", "is-landed", "is-arrived");
            setTimelineShadow(0.42, 1.32);
          }

          if (target) {
            target.focus({ preventScroll: true });
          }

          updateCurrentSection(targetId, true);

          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", "#" + targetId);
          }

          debugInfo.landingBases.push(copyPoint(F));

          if (trajectoryDebug) {
            trajectoryDebug.drawLandingBase(0, F);
          }

          return;
        }

        if (name === PHASE.LAND2 || name === PHASE.LAND3) {
          debugInfo.landingBases.push(copyPoint(F));

          if (trajectoryDebug) {
            trajectoryDebug.drawLandingBase(debugInfo.landingBases.length - 1, F);
          }

          return;
        }

        if (name === PHASE.ROLL) {
          setState(STATES.BALL_ROLLING_OUT);
          ball.classList.remove("is-arrived", "is-landing", "is-landed");
          ball.classList.add("is-rolling");

          reportLandingSummary();
        }
      }

      /* the BUG warnings only fire when something is really wrong; the tables only print when a debug flag is on */
      function reportLandingSummary() {
        const baseDrift = debugInfo.landingBases.some(function (base) {
          return Math.abs(base.x - F.x) > 0.5 || Math.abs(base.y - F.y) > 0.5;
        });
        const phoneLateral = isPhone && debugInfo.lateral.max - debugInfo.lateral.min > 0.5;

        if (DEBUG_NAV_BALL_SEQUENCE || DEBUG_NAV_BALL_SPLINE || DEBUG_PHONE_NAV_BALL) {
          console.table({
            stage: "after-landing-bounces",
            targetId: targetId,
            mainSpeedMin: round(speedMin),
            mainSpeedMax: round(speedMax),
            lastPathProgress: round(debugInfo.lastPathProgress),
            lastScrollProgress: round(debugInfo.lastScrollProgress),
            scrollAtLanding: round(currentScrollY()),
            scrollTarget: round(scrollTarget),
            landingBase1: JSON.stringify(debugInfo.landingBases[0] || null),
            landingBase2: JSON.stringify(debugInfo.landingBases[1] || null),
            landingBase3: JSON.stringify(debugInfo.landingBases[2] || null),
            scrollMovedDuringLanding: debugInfo.scrollMovedDuringLanding,
            lateralRange: round(debugInfo.lateral.max - debugInfo.lateral.min)
          });
        }

        if (baseDrift) {
          console.warn("BUG: landing bounce base drift", debugInfo.landingBases[0], debugInfo.landingBases[1], debugInfo.landingBases[2]);
        }

        if (debugInfo.scrollMovedDuringLanding) {
          console.warn("BUG: scroll moved during landing bounces");
        }

        if (phoneLateral) {
          console.warn("BUG: phone ball has lateral motion", debugInfo.lateral.min, A0.x);
        }
      }

      function renderPhase(name, elapsed, now) {
        let raw;
        let point;

        switch (name) {
          case PHASE.PREP1:
          case PHASE.PREP2:
          case PHASE.PREP3: {
            const index = name === PHASE.PREP1 ? 0 : name === PHASE.PREP2 ? 1 : 2;

            raw = elapsed / prepDurations[index];
            freezeScrollAt(scrollStart, "scrollMovedDuringPrep");
            point = bouncePoint(A0, prepHeights[index], raw);
            setBallPosition(point.x, point.y);
            applyBounceScale(raw, [0.68, 0.78, 0.9][index]);
            setTimelineShadow(0, 0.72);

            if (trajectoryDebug) {
              trajectoryDebug.updateFrame({
                phase: name,
                scrollStart: scrollStart,
                scrollTarget: scrollTarget,
                pathProgress: debugInfo.lastPathProgress,
                distanceTravelled: 0,
                totalPathLength: path ? path.totalLength : 0,
                scrollFrozen: true,
                scrollMovedDuringPrep: debugInfo.scrollMovedDuringPrep,
                scrollMovedDuringLanding: debugInfo.scrollMovedDuringLanding
              });
            }

            break;
          }

          case PHASE.MAIN: {
            const distance = Math.min(path.totalLength, (elapsed / 1000) * path.speed);
            const progress = path.totalLength > 0 ? distance / path.totalLength : 1;
            const scrollProgress = SCROLL_PROGRESS_MODE === "linear" ? progress : smootherstep(progress);

            point = getPointAtDistance(path, distance);
            debugInfo.lastPathProgress = progress;
            debugInfo.lastScrollProgress = scrollProgress;
            scrollInstantly(mix(scrollStart, scrollTarget, scrollProgress));
            setBallPosition(point.x, point.y);
            const stretch = smootherstep((progress - 0.6) / 0.2); // eases in over the last 40%, no pop

            setBallScale(1 - 0.015 * stretch, 1 + 0.025 * stretch);

            if (endPoint.kind === "floor") {
              setTimelineShadow(0, 0.72);
            } else {
              const approach = clamp((progress - 0.78) / 0.22, 0, 1);

              setTimelineShadow(approach <= 0 ? 0 : mix(0.06, 0.34, approach), approach <= 0 ? 0.72 : mix(0.72, 1.18, approach));
            }

            if (previousSample && elapsed > previousSample.elapsed) {
              // phase-relative time (exact at the phase-end render), so the debug speed matches the real constant speed
              const speed = Math.hypot(point.x - previousSample.x, point.y - previousSample.y) / ((elapsed - previousSample.elapsed) / 1000);

              speedMin = Math.min(speedMin, speed);
              speedMax = Math.max(speedMax, speed);
            }

            previousSample = { x: point.x, y: point.y, elapsed: elapsed };
            debugInfo.lateral.min = Math.min(debugInfo.lateral.min, point.x);
            debugInfo.lateral.max = Math.max(debugInfo.lateral.max, point.x);

            if (trajectoryDebug) {
              trajectoryDebug.updateFrame({
                phase: name,
                scrollStart: scrollStart,
                scrollTarget: scrollTarget,
                pathProgress: progress,
                distanceTravelled: distance,
                totalPathLength: path.totalLength,
                scrollFrozen: false,
                scrollMovedDuringPrep: debugInfo.scrollMovedDuringPrep,
                scrollMovedDuringLanding: debugInfo.scrollMovedDuringLanding
              });
            }

            break;
          }

          case PHASE.LAND1:
          case PHASE.LAND2:
          case PHASE.LAND3: {
            const index = name === PHASE.LAND1 ? 0 : name === PHASE.LAND2 ? 1 : 2;

            raw = elapsed / landingDurations[index];
            freezeScrollAt(scrollTarget, "scrollMovedDuringLanding");
            point = bouncePoint(F, landingHeights[index], raw);
            setBallPosition(point.x, point.y);
            applyBounceScale(raw, [1, 0.72, 0.48][index]);

            if (endPoint.kind === "floor") {
              setTimelineShadow(0, 0.72);
            } else {
              const lift = Math.sin(Math.PI * clamp(raw, 0, 1));
              const compressedOpacity = [0.42, 0.32, 0.24][index];
              const airborneOpacity = [0.1, 0.16, 0.2][index];
              const compressedScale = [1.32, 1.14, 1.04][index];
              const airborneScale = [0.62, 0.8, 0.92][index];

              setTimelineShadow(mix(compressedOpacity, airborneOpacity, lift), mix(compressedScale, airborneScale, lift));
            }

            if (trajectoryDebug) {
              trajectoryDebug.updateFrame({
                phase: name,
                scrollStart: scrollStart,
                scrollTarget: scrollTarget,
                pathProgress: debugInfo.lastPathProgress,
                distanceTravelled: path ? path.totalLength : 0,
                totalPathLength: path ? path.totalLength : 0,
                scrollFrozen: true,
                scrollMovedDuringPrep: debugInfo.scrollMovedDuringPrep,
                scrollMovedDuringLanding: debugInfo.scrollMovedDuringLanding
              });
            }

            break;
          }

          default: {
            raw = elapsed / rollDuration;
            freezeScrollAt(scrollTarget, "scrollMovedDuringLanding");
            const eased = easeRollOut(raw);
            const x = mix(rollStartX, rollEndX, eased);

            ball.style.setProperty("--ball-rotation", rollDirection * (Math.abs(x - rollStartX) / rollCircumference) * 360 + "deg");
            setBallPosition(x, F.y);
            setBallScale(1, 1);

            if (endPoint.kind === "floor") {
              setTimelineShadow(0, 0.72);
            } else {
              setTimelineShadow(mix(0.3, 0, clamp(raw, 0, 1)), mix(1.08, 0.72, clamp(raw, 0, 1)));
            }

            if (trajectoryDebug) {
              trajectoryDebug.updateFrame({
                phase: name,
                scrollStart: scrollStart,
                scrollTarget: scrollTarget,
                pathProgress: debugInfo.lastPathProgress,
                distanceTravelled: path ? path.totalLength : 0,
                totalPathLength: path ? path.totalLength : 0,
                scrollFrozen: true,
                scrollMovedDuringPrep: debugInfo.scrollMovedDuringPrep,
                scrollMovedDuringLanding: debugInfo.scrollMovedDuringLanding
              });
            }
          }
        }
      }

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          return;
        }

        if (!phaseStart) {
          phaseStart = now;
          enterPhase(PHASE.PREP1);
        }

        /* leave finished phases; leftover time carries into the next one so the rhythm never drifts */
        let guard = 0;

        while (guard < 12) {
          guard += 1;

          const duration = phaseDuration(phase);
          const elapsed = now - phaseStart;

          if (elapsed < duration) {
            break;
          }

          const nextIndex = PHASE_ORDER.indexOf(phase) + 1;

          renderPhase(phase, duration, now); // final, exact pose of the phase that just ended

          if (nextIndex >= PHASE_ORDER.length) {
            showPlusInPlace(token, targetId);
            return;
          }

          phaseStart += duration;
          enterPhase(PHASE_ORDER[nextIndex]);
        }

        renderPhase(phase, now - phaseStart, now);
        requestBallFrame(frame, token);
      }

      requestBallFrame(frame, token);
    }

    function flyBall(startPoint, targetId, token) {
      if (targetId === "landing" && HOME_TRIP_CLOSES_INTO_PLUS) {
        runHomeReturnMotion(startPoint, targetId, token);
        return;
      }

      runTrip(startPoint, targetId, token);
    }

    /* -------------------------------------------------------------- choosing a destination: circle -> ball */

    function chooseDestination(button) {
      if (isTravelling || isProjectMode || isBallAnimating || isPhoneNavOpening) {
        return;
      }

      const targetId = button.getAttribute("data-nav-target");
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const A0 = { x: buttonRect.left + buttonRect.width / 2, y: buttonRect.top + buttonRect.height / 2 };
      const delayForLandingAnimation = shouldDelayForLandingAnimation(targetId);
      const morphDuration = reducedMotion.matches ? 1 : delayForLandingAnimation ? 1500 : BALL_MORPH_DURATION;
      let landingInterruptPromise = null;
      const token = beginBallAnimation();

      isTravelling = true;
      isBallAnimating = true;
      lockUserScroll();
      document.documentElement.classList.add("is-ball-animating");
      setState(STATES.NAVI_SELECTED);
      nav.classList.remove("is-open");
      nav.classList.add("is-choosing");
      button.parentElement.classList.add("is-selected");
      items.forEach(function (item) {
        item.disabled = true;
      });
      setMenuA11y(false);

      setBallPosition(A0.x, A0.y);
      ball.style.opacity = "";
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
      ball.style.setProperty("--nav-ball-form-duration", morphDuration + "ms");
      ballLabel.textContent = "";
      resetBallClasses();
      setBallPhase(PHASE.MORPH);
      ball.classList.add("is-visible", "is-forming");

      if (delayForLandingAnimation) {
        landingInterruptPromise = startLandingAnimationInterrupt(targetId);
      }

      setBallTimeout(function () {
        setState(STATES.NAVI_TEXT_VANISHING);
      }, reducedMotion.matches ? 1 : morphDuration * 0.14, token);

      setBallTimeout(function () {
        setState(STATES.NAVI_TO_BALL_MORPH);
      }, reducedMotion.matches ? 1 : morphDuration * 0.24, token);

      setBallTimeout(function () {
        nav.classList.add("is-travelling");
        setState(STATES.BALL_READY);
        ball.classList.remove("is-forming");
        ball.classList.add("is-ready");

        function go() {
          if (!isCurrentAnimation(token)) {
            return;
          }

          flyBall(A0, targetId, token);
        }

        (landingInterruptPromise || startLandingAnimationInterrupt(targetId)).then(go, go);
      }, morphDuration, token);
    }

    /* -------------------------------------------------------------- events */

    core.addEventListener("click", function (event) {
      if (isProjectMode) {
        beginProjectClose();
        document.dispatchEvent(new CustomEvent("harini:project-close-request"));
        return;
      }

      if (isMobileTapMode()) {
        event.preventDefault();
      }

      if (isTravelling || isBallAnimating) {
        return; // never start a second animation
      }

      if (canUseHoverNav() && isOpen) {
        return;
      }

      if (usesStagedMenuOpen() && !isOpen) {
        if (isPhoneNavOpening) {
          return; // repeated tap while opening: ignored
        }

        notifyLandingPlusOpened();
        openStagedMenu();
        return;
      }

      if (isPhoneNavOpening) {
        return;
      }

      if (!isOpen) {
        notifyLandingPlusOpened();
      }

      setOpen(!isOpen);
    });

    nav.addEventListener("pointerenter", function () {
      if (canUseHoverNav() && !isProjectMode && !isBallAnimating) {
        if (!isOpen) {
          notifyLandingPlusOpened();
        }

        setOpen(true);
      }
    });

    nav.addEventListener("pointerleave", function () {
      if (canUseHoverNav() && !nav.contains(document.activeElement)) {
        setOpen(false);
      }
    });

    nav.addEventListener("focusout", function () {
      if (isMobileTapMode()) {
        return;
      }

      window.clearTimeout(closeOnBlurTimer);
      closeOnBlurTimer = window.setTimeout(function () {
        if (isOpen && !nav.contains(document.activeElement)) {
          setOpen(false);
        }
      }, 0);
    });

    items.forEach(function (item) {
      item.addEventListener("pointerenter", function () {
        if (canUseHoverNav() && !isTravelling) {
          setState(STATES.NAVI_HOVERED);
        }
      });

      item.addEventListener("click", function (event) {
        if (isMobileTapMode()) {
          event.preventDefault();
        }

        chooseDestination(item);
      });
    });

    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && isOpen && !isTravelling) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen) {
        setOpen(false);
        core.focus();
      }
    });

    document.addEventListener("harini:project-open", enterProjectMode);
    document.addEventListener("harini:project-closing", beginProjectClose);
    document.addEventListener("harini:project-closed", exitProjectMode);

    window.addEventListener("scroll", queueCurrentSectionUpdate, { passive: true });

    window.addEventListener("resize", function () {
      updateCurrentSection(detectCurrentSection(), true);

      if (isOpen) {
        queueNavGeometryUpdate();
      }
    }, { passive: true });

    hideTravelBallImmediately();
    setMenuA11y(false);
    setState(STATES.PLUS_IDLE);
    updateCurrentSection(detectCurrentSection(), true);
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
