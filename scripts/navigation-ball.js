/* Navigation plus console + travelling ball.
 *
 * Trip sequence (every trip, in this exact order):
 *   selected nav circle morphs into the ball -> capture A once -> freeze scroll -> three prep bounces at A (z/4, z/2, 3z/4)
 *   -> compute scrollTarget and the final visible landing point B -> ONE continuous, physically plausible flight:
 *      A -> straight up to D -> rounded arc over C -> E -> straight down to B   (see planTrajectory: one smooth curve, vertical and bend-free where
 *      the arc meets the lines; the speed follows real physics - fast at launch and landing, slowest at the top; the page scrolls with the ball
 *      in the same requestAnimationFrame loop) -> exact landing at B
 *   -> three landing bounces at B (3z/4, z/2, z/4) -> roll out of the screen -> travelling ball hidden -> plus fades in IN PLACE.
 * B is on the top edge of the target image, near the end that is furthest from the screen edge the image is attached to (small buffer).
 * Phone (max-width: 767px): same sequence, but the ball never moves sideways before the roll-away (B.x = A.x: a straight vertical lob).
 *
 * Obsolete experimental path systems (obstacle nudging, "exact" trajectory, composite camera modes, spline / bezier / segmented paths,
 * debug overlay) were removed so that nothing can run by accident.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ configuration */

  // The main path is ONE physical flight (see planTrajectory): A -> straight up to D -> half-circle-like arc over C -> E -> straight down to B.
  const NAV_BALL_PATH_MODE = "arc";

  const DEBUG_NAV_BALL_SEQUENCE = false;
  const DEBUG_NAV_BALL_SPLINE = false;
  const DEBUG_PHONE_NAV_BALL = false;

  // Average speed of the whole flight in px/s (gravity is chosen so that length / duration matches). Lower = slower, easier to follow with the eye.
  const MAIN_PATH_AVERAGE_SPEED = 340;
  const PHONE_PATH_AVERAGE_SPEED = 300;
  const TRAJECTORY_LIFT_FACTOR = 1.12; // m = z * 1.12 (> z): how far above the higher of A and B the guide level (D and E) sits
  const TRAJECTORY_LIFT_MIN = 40;
  const TRAJECTORY_MIN_RISE_FACTOR = 0.4; // a squashed arc keeps at least 40% of the half-circle height ...
  const TRAJECTORY_MIN_RISE = 24; // ... and at least 24 px (only matters when the screen is too small for the full half circle)
  const TRAJECTORY_MIN_LANDING_DROP = 14; // E stays at least this far above B, so the ball always comes down into B
  const TRAJECTORY_MIN_LAUNCH_RISE = 12; // D stays at least this far above A
  const TRAJECTORY_APEX_FACTOR = 1.5; // apex C is this many half-spans (|dx| / 2) above the guide level: a little higher than a half circle = a rounded peak, no flat top
  const TRAJECTORY_ARC_EXPONENT = 0.8; // shape of the arc, y = G - rise * sin(phi)^q: below 1 the bend is gentlest where the arc meets the vertical lines
  const TRAJECTORY_MIN_DURATION = 0.9; // seconds
  const TRAJECTORY_MAX_DURATION = 9; // seconds - a safety net only: the average speed (not a time cap) decides how long a flight lasts, also on very large screens
  const LANDING_EDGE_BUFFER = 6; // px: extra room between the ball and the rounded image corner it lands near
  const SCROLL_PROGRESS_MODE = "smootherstep"; // easing of the page scroll over the flight time ("linear" = scroll progress equals flight progress)

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

  /* Landing platform = the top edge of an element. Images attached to the left edge of the screen are landed on near their RIGHT end, images
   * attached to the right edge near their LEFT end: never on the literal corner - the ball keeps clear of the rounded corner by the corner
   * radius + the ball radius + a small buffer, so it sits completely on the flat top edge. */
  function platformFromElement(element, section, side, kind, ballRadius) {
    const safeElement = element || document.body;
    const rect = safeElement.getBoundingClientRect();
    const scrollY = currentScrollY();
    const style = window.getComputedStyle(safeElement);
    let x = rect.left + rect.width / 2;

    if (side === "left" || side === "right") {
      const cornerRadius = parsePixel(side === "left" ? style.borderTopRightRadius : style.borderTopLeftRadius);
      const inset = Math.min(cornerRadius + (ballRadius || 22) + LANDING_EDGE_BUFFER, rect.width / 2);

      x = side === "left" ? rect.right - inset : rect.left + inset;
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

  function cubicBezierPoint(p0, p1, p2, p3, raw) {
    const t = clamp(raw, 0, 1);
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  /* ---- the trajectory ---------------------------------------------------------------------------------------------------------------
   * ONE continuous, physically plausible flight (viewport coordinates, y grows downward):
   *     A --straight up--> D --arc over C--> E --straight down--> B
   *   D = (A.x, G)   E = (B.x, G)   C = ((A.x + B.x) / 2, G - rise)   guide level G = (higher of A and B) - m,  m = 1.12 z  (> z)
   *   rise = |dx| / 2 * TRAJECTORY_APEX_FACTOR: the top C is a little higher than a half circle would be, so the peak is rounded (like a bounce
   *   that has drifted sideways), not a flat horizontal cap. C is the highest point of the whole flight.
   *
   * Shape: the arc is a smooth rounded arch whose ends are exactly vertical and whose bend is gentlest where it meets the straight lines
   * (a tall half ellipse, slightly sharpened at the top): x = A.x + dx (1 - cos phi) / 2, y = G - rise sin(phi)^q, phi = 0..pi, q slightly
   * below 1. The tangent is vertical at D and E and the curvature starts from 0 there, so nothing "turns sharply" where the arc meets the
   * lines: the three parts read as one fluid curve.
   *
   * Speed: real physics for a ball on this path. Mechanical energy is conserved, so the speed depends only on the height:
   *     v(h)^2 = v_top^2 + 2 g (h_top - h)
   * fastest at launch and landing, slowest at the top C, smooth everywhere (no easing curve is applied to the ball). v_top is the sideways speed
   * of a free-flying ball over the same span and height (v_top^2 = g (|dx| / 2)^2 / (2 rise)). Gravity g is chosen so that the whole flight lasts
   * length / averageSpeed seconds (a bit slower than before, so the eye can follow it).
   * The arc is lowered (only if the full height would leave the screen) before the guide level is lowered; A and B never move. */
  function planTrajectory(A, F, z, safeTop, averageSpeed) {
    const topY = Math.min(A.y, F.y);
    const dx = F.x - A.x;
    const halfSpan = Math.abs(dx) / 2;
    const lift = Math.max(z * TRAJECTORY_LIFT_FACTOR, TRAJECTORY_LIFT_MIN);
    let guideY = topY - lift;
    const fullRise = halfSpan * TRAJECTORY_APEX_FACTOR; // apex height above the guide level
    let rise = fullRise;

    // keep the apex on screen: lower the arc first, lower the guide level only as a last resort
    if (guideY - rise < safeTop) {
      // short screens: first lower the guide level a little (never below 0.85 z above the higher end, still above the last prep bounce) so the arc keeps its height ...
      guideY = clamp(safeTop + fullRise, guideY, topY - Math.max(z * 0.85, TRAJECTORY_LIFT_MIN));

      // ... and only then lower the arc
      const minRise = Math.min(fullRise, Math.max(TRAJECTORY_MIN_RISE_FACTOR * fullRise, TRAJECTORY_MIN_RISE));

      rise = clamp(guideY - safeTop, minRise, fullRise);

      if (guideY - rise < safeTop) {
        guideY = safeTop + rise;
      }
    }

    // E stays above B and D stays above A, so the ball always rises first and drops last
    guideY = Math.min(guideY, F.y - TRAJECTORY_MIN_LANDING_DROP, A.y - TRAJECTORY_MIN_LAUNCH_RISE);
    rise = Math.max(0, Math.min(rise, guideY - safeTop));

    // 1) the path as a table of points (about 2 px apart): straight up, arc, straight down
    const points = [{ x: A.x, y: A.y }];
    const addLine = function (toY) {
      const fromY = points[points.length - 1].y;
      const count = Math.max(1, Math.ceil(Math.abs(toY - fromY) / 2));

      for (let step = 1; step <= count; step += 1) {
        points.push({ x: points[points.length - 1].x, y: mix(fromY, toY, step / count) });
      }
    };

    addLine(guideY);
    const enterIndex = points.length - 1; // D

    if (halfSpan > 0.01 && rise > 0.01) {
      const arcLength = Math.PI * 0.5 * (halfSpan + rise) * 1.15;
      const count = clamp(Math.ceil(arcLength / 2), 60, 1600);

      for (let step = 1; step <= count; step += 1) {
        const phi = (Math.PI * step) / count;

        points.push({
          x: A.x + (dx * (1 - Math.cos(phi))) / 2,
          y: guideY - rise * Math.pow(Math.max(Math.sin(phi), 0), TRAJECTORY_ARC_EXPONENT)
        });
      }

      points[points.length - 1].x = F.x; // E exactly above B
      points[points.length - 1].y = guideY;
    } else {
      points.push({ x: F.x, y: guideY }); // no arc (A and B in a vertical line): D and E coincide
    }

    const exitIndex = points.length - 1; // E

    addLine(F.y);
    points[points.length - 1].x = F.x;
    points[points.length - 1].y = F.y;

    // 2) physics with g = 1 (unit time): speed from the height by energy conservation, time = sum of ds / v
    let apexIndex = 0;
    let topHeight = -Infinity;

    for (let index = 0; index < points.length; index += 1) {
      const height = A.y - points[index].y;

      if (height > topHeight + 1e-9) {
        topHeight = height;
        apexIndex = index;
      }
    }

    const topHead = rise > 0.5 ? (halfSpan * halfSpan) / (4 * rise) : 0; // v_top^2 / (2 g): a vertical lob (no sideways motion) stops dead at the top
    const arrival = [0];
    const distance = [0];
    let length = 0;

    for (let index = 1; index < points.length; index += 1) {
      const segment = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
      const midHeight = A.y - (points[index].y + points[index - 1].y) / 2;
      const speed = Math.sqrt(2 * Math.max(topHead + topHeight - midHeight, 1e-6));
      let unitTime = segment / speed;

      if (points[index].x === points[index - 1].x) {
        // straight vertical piece (A-D, E-B or a whole lob): exact free-fall time = difference of the end speeds (also exact where the speed reaches 0)
        const startSpeed = Math.sqrt(2 * Math.max(topHead + topHeight - (A.y - points[index - 1].y), 0));
        const endSpeed = Math.sqrt(2 * Math.max(topHead + topHeight - (A.y - points[index].y), 0));

        unitTime = Math.abs(endSpeed - startSpeed);
      }

      length += segment;
      distance.push(length);
      arrival.push(arrival[index - 1] + unitTime);
    }

    const totalUnit = arrival[arrival.length - 1];
    const duration = clamp(length / averageSpeed, TRAJECTORY_MIN_DURATION, TRAJECTORY_MAX_DURATION); // seconds
    const scale = duration / totalUnit; // seconds per unit time (gravity = 1 / scale^2)

    function unitSpeedAtHeight(height) {
      return Math.sqrt(2 * Math.max(topHead + topHeight - height, 1e-6));
    }

    function pointAt(seconds) {
      if (seconds >= duration) {
        return { x: F.x, y: F.y };
      }

      if (seconds <= 0) {
        return { x: A.x, y: A.y };
      }

      const unitTime = seconds / scale;
      let low = 0;
      let high = arrival.length - 1;

      while (low < high) {
        const middle = (low + high) >> 1;

        if (arrival[middle] < unitTime) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      const after = Math.max(low, 1);
      const span = arrival[after] - arrival[after - 1];
      const fraction = span > 1e-12 ? (unitTime - arrival[after - 1]) / span : 0;

      return {
        x: mix(points[after - 1].x, points[after].x, fraction),
        y: mix(points[after - 1].y, points[after].y, fraction)
      };
    }

    // analytic speed (px/s) from the height - used by the debug output and the tests
    function speedAt(seconds) {
      return unitSpeedAtHeight(A.y - pointAt(seconds).y) / scale;
    }

    return {
      mode: "arc",
      duration: duration,
      pointAt: pointAt,
      speedAt: speedAt,
      length: length,
      averageSpeed: length / duration,
      launchSpeed: unitSpeedAtHeight(0) / scale,
      landingSpeed: unitSpeedAtHeight(A.y - F.y) / scale,
      gravity: 1 / (scale * scale),
      times: { D: arrival[enterIndex] * scale, apex: arrival[apexIndex] * scale, E: arrival[exitIndex] * scale },
      safeTop: safeTop,
      geometry: {
        A: copyPoint(A),
        D: { x: A.x, y: guideY },
        C: { x: (A.x + F.x) / 2, y: guideY - rise },
        E: { x: F.x, y: guideY },
        F: copyPoint(F),
        guideY: guideY,
        lift: lift,
        rise: rise,
        fullRise: fullRise,
        halfSpan: halfSpan,
        topY: topY
      }
    };
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
        return platformFromElement(document.querySelector(".about-portrait img") || document.querySelector(".about-portrait"), "about", "left", "platform", ballRadius());
      }

      if (section === "work") {
        return platformFromElement(document.querySelector(".work-tile"), "work", "left", "platform", ballRadius());
      }

      if (section === "archive") {
        return platformFromElement(document.querySelector(".archive-bar"), "archive", "right", "platform", ballRadius());
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
      let endPoint = null; // measured only after the third prep bounce (the page has not moved, so nothing changes - but nothing is recomputed early either)
      let scrollTarget = scrollStart;
      let F = null;
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
        F = resolveFinalLandingPoint(endPoint, scrollTarget, targetId, bounds);

        if (isPhone) {
          F = { x: A0.x, y: F.y }; // phone: the ball never moves sideways before the roll-away
        }

        const safeTop = visiblePathTopMargin(bounds);

        path = planTrajectory(A0, F, z, safeTop, isPhone ? PHONE_PATH_AVERAGE_SPEED : MAIN_PATH_AVERAGE_SPEED);
        mainMs = Math.max(1, path.duration * 1000);
        rollStartX = F.x;
        rollEndX = rollDirection < 0 ? -radius - 18 : window.innerWidth + radius + 18;

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
            flightSeconds: round(path.duration),
            pathTotalLength: round(path.length),
            averageSpeed: round(path.averageSpeed),
            launchSpeed: round(path.launchSpeed),
            landingSpeed: round(path.landingSpeed),
            gravity: round(path.gravity),
            safeTop: round(safeTop)
          });

          if (DEBUG_NAV_BALL_SPLINE && geometry.E) {
            console.debug("nav ball trajectory points", { A: geometry.A, D: geometry.D, C: geometry.C, E: geometry.E, B: geometry.F, guideY: geometry.guideY, lift: geometry.lift, rise: geometry.rise, halfSpan: geometry.halfSpan, timesSeconds: path.times });
          }
        }

        if (debugInfo.scrollMovedDuringPrep) {
          console.warn("BUG: scroll moved during prep bounces");
        }

        if (debugInfo.prepBases.some(function (base) {
          return base && (Math.abs(base.x - A0.x) > 0.5 || Math.abs(base.y - A0.y) > 0.5);
        })) {
          console.warn("BUG: prep bounce base changed");
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
          return;
        }

        if (name === PHASE.LAND2 || name === PHASE.LAND3) {
          debugInfo.landingBases.push(copyPoint(F));
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
          console.warn("BUG: landing bounce base changed");
        }

        if (debugInfo.scrollMovedDuringLanding) {
          console.warn("BUG: scroll moved during landing bounces");
        }

        if (phoneLateral) {
          console.warn("BUG: phone ball has lateral motion");
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
            break;
          }

          case PHASE.MAIN: {
            const flightSeconds = Math.min(elapsed / 1000, path.duration);
            const progress = path.duration > 0 ? flightSeconds / path.duration : 1;
            const scrollProgress = SCROLL_PROGRESS_MODE === "linear" ? progress : smootherstep(progress);

            point = path.pointAt(flightSeconds);
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
              // phase-relative time (exact at the phase-end render), so the debug speed matches the real speed profile
              const speed = Math.hypot(point.x - previousSample.x, point.y - previousSample.y) / ((elapsed - previousSample.elapsed) / 1000);

              speedMin = Math.min(speedMin, speed);
              speedMax = Math.max(speedMax, speed);
            }

            previousSample = { x: point.x, y: point.y, elapsed: elapsed };
            debugInfo.lateral.min = Math.min(debugInfo.lateral.min, point.x);
            debugInfo.lateral.max = Math.max(debugInfo.lateral.max, point.x);
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
