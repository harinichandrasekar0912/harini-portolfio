(function () {
  const DEBUG_NAV_GEOMETRY = false;
  const DEBUG_NAV_BALL_PATH = false;
  const DEBUG_NAV_BALL_TRAJECTORY = false;
  const DEBUG_NAV_BALL_EXACT_PATH = false;
  const DEBUG_BALL_PATH = false;
  const DEBUG_NAV_BALL_CAMERA = false;
  const DEBUG_NAV_BALL_TIMING = false;

  var SECTION_IDS = ["landing", "about", "work", "archive", "contact"];
  var SECTION_INDEX = {
    landing: 0,
    about: 1,
    work: 2,
    archive: 3,
    contact: 4
  };
  var FLIGHT_DURATION_MULTIPLIER = 1.32;
  var MOBILE_BALL_TIME_SCALE = 1.42;
  var BALL_MORPH_DURATION = 1300;
  var NAV_BALL_BOUNCE_HEIGHT_SCALE = 1.08;
  var NAV_BALL_PREP_DURATIONS = [360, 430, 500];
  var NAV_BALL_TRAJECTORY_DURATIONS = {
    launch: 430,
    arc: 480,
    fall: 560
  };
  var NAV_BALL_LANDING_DURATIONS = [480, 360, 260];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    var safeT = clamp(t, 0, 1);
    return 1 - Math.pow(1 - safeT, 3);
  }

  function easeInOutSine(t) {
    var safeT = clamp(t, 0, 1);
    return -(Math.cos(Math.PI * safeT) - 1) / 2;
  }

  function easeRollOut(t) {
    var safeT = clamp(t, 0, 1);
    return 1 - Math.pow(1 - safeT, 2.2);
  }

  function launchProgress(t) {
    var p = clamp(t, 0, 1);

    return 0.82 * p + 0.18 * (1 - Math.pow(1 - p, 2));
  }

  function fallProgress(t) {
    var p = clamp(t, 0, 1);

    return 0.55 * p + 0.45 * p * p;
  }

  function smoothstep(t) {
    var p = clamp(t, 0, 1);

    return p * p * (3 - 2 * p);
  }

  function mix(from, to, t) {
    return from + (to - from) * t;
  }

  function round(value) {
    return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  function parsePixel(value) {
    var parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function centerOf(element) {
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
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
    if (section === "archive" || section === "contact") {
      return 1;
    }

    return -1;
  }

  function platformFromElement(element, section, side, kind) {
    var safeElement = element || document.body;
    var rect = safeElement.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var x = rect.left + rect.width / 2;

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
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  var STATES = {
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

  function init() {
    var nav = document.querySelector("[data-nav-object]");
    var core = document.querySelector("[data-nav-core]");
    var spokes = document.querySelector(".radial-lines");
    var menu = document.getElementById("radial-menu");
    var ball = document.querySelector("[data-travel-ball]");
    var ballLabel = document.querySelector("[data-travel-label]");
    var travelShadow = ball ? ball.querySelector(".travel-shadow") : null;
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-nav-target]"));
    var lines = {
      about: document.querySelector(".radial-line-about"),
      work: document.querySelector(".radial-line-work"),
      archive: document.querySelector(".radial-line-archive"),
      contact: document.querySelector(".radial-line-contact")
    };
    var spokeMasks = {};

    if (!nav || !core || !spokes || !menu || !ball || !ballLabel || items.length === 0) {
      return;
    }

    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    var coarsePointer = window.matchMedia("(pointer: coarse)");
    var mobileViewport = window.matchMedia("(max-width: 767px)");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var isOpen = false;
    var isTravelling = false;
    var isProjectMode = false;
    var closeOnBlurTimer = 0;
    var phoneMenuReadyTimer = 0;
    var resetTimer = 0;
    var sectionFrame = 0;
    var navGeometryFrame = 0;
    var currentSection = "landing";
    var navState = STATES.PLUS_IDLE;
    var activeAnimationToken = 0;
    var ballFrames = [];
    var ballTimers = [];
    var debugOverlay = createDebugOverlay();

    Array.prototype.slice.call(document.querySelectorAll("[data-travel-ball]")).forEach(function (travelBall, index) {
      if (index > 0) {
        travelBall.remove();
      }
    });

    items.forEach(function (item) {
      var original = item.getAttribute("data-nav-target");
      item.dataset.navOriginalTarget = original;
      item.dataset.navOriginalLabel = item.textContent.trim();
      item.setAttribute("aria-label", "go to " + original);
    });

    function originalTarget(button) {
      return button.dataset.navOriginalTarget || button.getAttribute("data-nav-target");
    }

    function ensureSpokeMask(label) {
      var maskParts = spokeMasks[label];

      if (maskParts) {
        return maskParts;
      }

      var defs = spokes.querySelector("defs");

      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        spokes.insertBefore(defs, spokes.firstChild);
      }

      var mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
      var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      var drawLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      var maskId = "nav-spoke-mask-" + label;

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

      maskParts = {
        id: maskId,
        mask: mask,
        rect: rect,
        drawLine: drawLine,
        length: 0
      };
      spokeMasks[label] = maskParts;
      return maskParts;
    }

    function playSpokeDraw() {
      var labels = ["about", "work", "archive", "contact"];

      labels.forEach(function (label, index) {
        var maskParts = spokeMasks[label];

        if (!maskParts) {
          return;
        }

        maskParts.drawLine.style.transition = "stroke-dashoffset " + (reducedMotion.matches ? "1ms" : "560ms") + " cubic-bezier(0.22, 1, 0.36, 1)";
        maskParts.drawLine.style.transitionDelay = reducedMotion.matches ? "0ms" : 520 + index * 38 + "ms";
        maskParts.drawLine.style.strokeDashoffset = "0";
      });
    }

    function createDebugOverlay() {
      if (!DEBUG_NAV_GEOMETRY) {
        return {
          marker: function () {},
          hideMarker: function () {},
          trajectory: function () {},
          clearTrajectory: function () {},
          outline: function () {},
          clearOutline: function () {}
        };
      }

      var existing = document.querySelector("[data-nav-debug-overlay]");

      if (existing) {
        existing.remove();
      }

      var root = document.createElement("div");
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      var polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      var outline = document.createElement("div");
      var markers = {};

      root.setAttribute("data-nav-debug-overlay", "");
      root.style.cssText = [
        "position: fixed",
        "inset: 0",
        "z-index: 5000",
        "pointer-events: none",
        "overflow: visible"
      ].join(";");

      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText = [
        "position: fixed",
        "inset: 0",
        "width: 100vw",
        "height: 100vh",
        "overflow: visible",
        "pointer-events: none"
      ].join(";");

      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke", "rgba(218, 22, 22, 0.88)");
      polyline.setAttribute("stroke-width", "1.25");
      polyline.setAttribute("stroke-linecap", "round");
      polyline.setAttribute("stroke-linejoin", "round");
      polyline.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(polyline);

      outline.style.cssText = [
        "position: fixed",
        "display: none",
        "border: 1px solid rgba(255, 0, 0, 0.86)",
        "background: rgba(255, 0, 0, 0.035)",
        "box-sizing: border-box",
        "pointer-events: none"
      ].join(";");

      root.appendChild(svg);
      root.appendChild(outline);
      document.body.appendChild(root);

      function buildMarker(name, color) {
        var marker = document.createElement("div");
        var horizontal = document.createElement("span");
        var vertical = document.createElement("span");
        var label = document.createElement("span");

        marker.style.cssText = [
          "position: fixed",
          "left: 0",
          "top: 0",
          "width: 15px",
          "height: 15px",
          "transform: translate(-50%, -50%)",
          "pointer-events: none"
        ].join(";");

        horizontal.style.cssText = [
          "position: absolute",
          "left: 0",
          "top: 7px",
          "width: 15px",
          "height: 1px",
          "background: " + color
        ].join(";");

        vertical.style.cssText = [
          "position: absolute",
          "left: 7px",
          "top: 0",
          "width: 1px",
          "height: 15px",
          "background: " + color
        ].join(";");

        label.textContent = name;
        label.style.cssText = [
          "position: absolute",
          "left: 12px",
          "top: 10px",
          "padding: 2px 4px",
          "border: 1px solid rgba(0, 0, 0, 0.14)",
          "background: rgba(250, 248, 243, 0.92)",
          "color: " + color,
          "font: 10px/1.15 ui-monospace, SFMono-Regular, Consolas, monospace",
          "white-space: nowrap"
        ].join(";");

        marker.appendChild(horizontal);
        marker.appendChild(vertical);
        marker.appendChild(label);
        root.appendChild(marker);
        markers[name] = marker;
        return marker;
      }

      return {
        marker: function (name, x, y, color) {
          var marker = markers[name] || buildMarker(name, color);
          marker.style.display = "block";
          marker.style.left = round(x) + "px";
          marker.style.top = round(y) + "px";
        },
        hideMarker: function (name) {
          if (markers[name]) {
            markers[name].style.display = "none";
          }
        },
        trajectory: function (points) {
          polyline.setAttribute("points", points.map(function (point) {
            return round(point.x) + "," + round(point.y);
          }).join(" "));
        },
        clearTrajectory: function () {
          polyline.setAttribute("points", "");
        },
        outline: function (rect) {
          outline.style.display = "block";
          outline.style.left = round(rect.left) + "px";
          outline.style.top = round(rect.top) + "px";
          outline.style.width = round(rect.width) + "px";
          outline.style.height = round(rect.height) + "px";
        },
        clearOutline: function () {
          outline.style.display = "none";
        }
      };
    }

    function setState(nextState) {
      navState = nextState;
      nav.dataset.navState = nextState;
      ball.dataset.ballState = nextState;
    }

    function debugNavBall(message, detail) {
      if (DEBUG_NAV_GEOMETRY) {
        console.debug(message, detail || "");
      }
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
      var frameId = window.requestAnimationFrame(function (now) {
        ballFrames = ballFrames.filter(function (storedFrameId) {
          return storedFrameId !== frameId;
        });

        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
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
      var timerId = window.setTimeout(function () {
        ballTimers = ballTimers.filter(function (storedTimerId) {
          return storedTimerId !== timerId;
        });

        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        callback();
      }, delay);

      ballTimers.push(timerId);
      return timerId;
    }

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
      const isTabletLandscapeTouch =
        window.matchMedia("(min-width: 768px) and (max-width: 1180px) and (orientation: landscape) and (pointer: coarse)").matches;
      return isTabletLandscapeTouch;
    }

    function canUseHoverNav() {
      return canHover.matches && !isMobileTapMode();
    }

    function clearPhoneMenuOpeningState() {
      window.clearTimeout(phoneMenuReadyTimer);
      phoneMenuReadyTimer = 0;
      nav.classList.remove("is-phone-preparing", "is-phone-opening", "is-phone-items-ready");
    }

    function mobileMotionScale() {
      return isMobileViewport() ? MOBILE_BALL_TIME_SCALE : 1;
    }

    function scaleMotionDuration(duration) {
      return reducedMotion.matches ? 1 : duration * mobileMotionScale();
    }

    function queueNavGeometryUpdate() {
      if (navGeometryFrame) {
        return;
      }

      navGeometryFrame = window.requestAnimationFrame(function () {
        navGeometryFrame = 0;
        updateSpokeGeometry();
        debugRenderBase();
      });
    }

    function cancelBallAnimation() {
      activeAnimationToken += 1;
      clearBallTimersAndFrames();
    }

    function landingAnimationController() {
      return window.landingGirlAnimation || null;
    }

    function shouldDelayForLandingAnimation(targetId) {
      var landingAnimation = landingAnimationController();

      return targetId !== "landing" &&
        landingAnimation &&
        typeof landingAnimation.isLandingActive === "function" &&
        landingAnimation.isLandingActive() &&
        typeof landingAnimation.interruptForNavigation === "function";
    }

    function notifyLandingPlusOpened() {
      var landingAnimation = landingAnimationController();

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
      var landingAnimation = landingAnimationController();

      if (!shouldDelayForLandingAnimation(targetId)) {
        return Promise.resolve();
      }

      window.dispatchEvent(new CustomEvent("landing-nav-circle-selected", {
        detail: {
          targetSectionId: targetId
        }
      }));

      return landingAnimation.interruptForNavigation();
    }

    function waitForLandingAnimationBeforeFlight(targetId, pendingInterrupt) {
      if (pendingInterrupt) {
        return pendingInterrupt;
      }

      return startLandingAnimationInterrupt(targetId);
    }

    function beginBallAnimation(targetId) {
      cancelBallAnimation();
      activeAnimationToken += 1;
      debugNavBall("nav ball animation start", targetId);
      return activeAnimationToken;
    }

    function hideTravelBallImmediately() {
      resetBallClasses();
      ball.style.opacity = "0";
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
      ball.style.removeProperty("--restore-duration");
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
      setTimelineShadow(0, 0.72);

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
      nav.classList.remove("is-plus-restoring");
      document.documentElement.classList.remove("is-ball-animating");
      setState(finalState || STATES.PLUS_IDLE);
    }

    function setMenuA11y(open) {
      core.setAttribute("aria-expanded", String(open));
      core.setAttribute("aria-label", isProjectMode ? "close project" : open ? "close navigation" : "open navigation");
      menu.setAttribute("aria-hidden", String(!open));
      items.forEach(function (item) {
        item.tabIndex = open ? 0 : -1;
      });
    }

    function getSafeBounds(options) {
      var radius = ballRadius();
      var margin = Math.max(radius + 18, 18);
      var allowFloor = Boolean(options && options.allowFloor);

      return {
        minX: margin,
        maxX: window.innerWidth - margin,
        minY: margin,
        maxY: allowFloor ? window.innerHeight - radius : window.innerHeight - margin,
        floorY: window.innerHeight - radius,
        marginX: margin,
        marginY: margin
      };
    }

    function getSafeViewportBounds() {
      var bounds = getSafeBounds();

      return {
        safeMinX: bounds.minX,
        safeMaxX: bounds.maxX,
        safeMinY: bounds.minY,
        safeMaxY: bounds.maxY
      };
    }

    function fitControlPointInsideBounds(point, bounds) {
      return {
        x: clamp(point.x, bounds.minX, bounds.maxX),
        y: clamp(point.y, bounds.minY, bounds.maxY)
      };
    }

    function clampToViewport(point) {
      return fitControlPointInsideBounds(point, getSafeBounds());
    }

    function samePlatformElement(element, targetElement) {
      if (!element || !targetElement) {
        return false;
      }

      return element === targetElement || element.contains(targetElement) || targetElement.contains(element);
    }

    function getObstacleRects(targetElement) {
      var selectors = [".landing-media", ".about-portrait", ".about-portrait img", ".work-tile", ".archive-bar"];
      var scrollY = window.scrollY || window.pageYOffset;
      var seen = [];
      var clearance = Math.max(ballRadius() + 24, 48);
      var obstacles = [];

      selectors.forEach(function (selector) {
        Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (element) {
          var rect;

          if (seen.indexOf(element) !== -1 || samePlatformElement(element, targetElement)) {
            return;
          }

          rect = element.getBoundingClientRect();

          if (rect.width < 4 || rect.height < 4) {
            return;
          }

          seen.push(element);
          obstacles.push({
            element: element,
            left: rect.left + window.scrollX - clearance,
            top: rect.top + scrollY - clearance,
            right: rect.left + window.scrollX + rect.width + clearance,
            bottom: rect.top + scrollY + rect.height + clearance,
            clearance: clearance
          });
        });
      });

      return obstacles;
    }

    function screenRectForObstacle(obstacle, scrollY) {
      return {
        left: obstacle.left,
        top: obstacle.top - scrollY,
        right: obstacle.right,
        bottom: obstacle.bottom - scrollY
      };
    }

    function pointInsideRect(point, rect) {
      return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    }

    function detectPathCollision(config, obstacles) {
      var samples = 68;
      var collision = null;

      if (!obstacles || obstacles.length === 0) {
        return null;
      }

      for (var index = 2; index <= samples - 2; index += 1) {
        var raw = index / samples;
        var point = flightPointAt(raw, config);
        var scrollY = flightScrollAt(raw, config);

        for (var obstacleIndex = 0; obstacleIndex < obstacles.length; obstacleIndex += 1) {
          var obstacle = obstacles[obstacleIndex];
          var rect = screenRectForObstacle(obstacle, scrollY);

          if (pointInsideRect(point, rect)) {
            collision = {
              raw: raw,
              point: point,
              rect: rect,
              obstacle: obstacle
            };
            break;
          }
        }

        if (collision) {
          break;
        }
      }

      return collision;
    }

    function whitespaceLaneX(config, attempt) {
      var side = targetSideFor(config.targetId);
      var drift = attempt * clamp(window.innerWidth * 0.04, 18, 52);
      var x = window.innerWidth * 0.5;

      if (side === "left") {
        x = window.innerWidth * 0.2 - drift;
      } else if (side === "right") {
        x = window.innerWidth * 0.8 + drift;
      }

      return clamp(x, config.bounds.minX, config.bounds.maxX);
    }

    function nudgePathAroundCollision(config, collision, attempt) {
      var laneX = whitespaceLaneX(config, attempt);
      var lift = clamp(window.innerHeight * (0.09 + attempt * 0.055), 72, 190);
      var controlBias = clamp(0.46 + attempt * 0.16, 0.46, 0.78);
      var topClear = collision ? collision.rect.top - lift : config.path.apex.y - lift;
      var controlAX = config.upward ? config.path.controlA.x : mix(config.path.controlA.x, laneX, controlBias * 0.28);
      var controlBX = hasFinitePoint(config.path.controlB) ?
        config.path.controlB.x :
        finalApproachControlX(config.path.start, config.path.end, config.upward);

      if (Array.isArray(config.path.segments) && config.path.segments.length === 2) {
        config.path.segments[0].controlA = fitControlPointInsideBounds({
          x: controlAX,
          y: Math.min(config.path.segments[0].controlA.y, topClear)
        }, config.bounds);
        config.path.segments[0].controlB = fitControlPointInsideBounds({
          x: config.path.segments[0].controlB.x,
          y: Math.min(config.path.segments[0].controlB.y, topClear)
        }, config.bounds);
        config.path.segments[1].controlA = fitControlPointInsideBounds({
          x: config.path.segments[1].controlA.x,
          y: Math.min(config.path.segments[1].controlA.y, topClear + lift * 0.16)
        }, config.bounds);
        config.path.segments[1].controlB = fitControlPointInsideBounds({
          x: controlBX,
          y: Math.min(config.path.segments[1].controlB.y, topClear + lift * 0.24)
        }, config.bounds);
        syncCompositePath(config.path);
        updatePathApex(config.path);
        return;
      }

      config.path.controlA = fitControlPointInsideBounds({
        x: controlAX,
        y: Math.min(config.path.controlA.y, topClear)
      }, config.bounds);

      config.path.controlB = fitControlPointInsideBounds({
        x: controlBX,
        y: Math.min(config.path.controlB.y, topClear + lift * 0.18)
      }, config.bounds);

      updatePathApex(config.path);
    }

    function adjustPathForObstacles(config) {
      var obstacles = getObstacleRects(config.endPoint.element);
      var attempts = 0;

      config.obstacles = obstacles;

      if (config.path && config.path.kind === "exact-nav-trajectory") {
        return;
      }

      while (attempts < 3) {
        var collision = detectPathCollision(config, obstacles);

        if (!collision) {
          return;
        }

        nudgePathAroundCollision(config, collision, attempts + 1);
        attempts += 1;
      }
    }

    function emergencyClampToViewport(point, config, raw) {
      var bounds = config.bounds;
      var clamped = fitControlPointInsideBounds(point, bounds);
      var changed = Math.abs(clamped.x - point.x) > 0.5 || Math.abs(clamped.y - point.y) > 0.5;

      if (changed && DEBUG_NAV_GEOMETRY && !config.emergencyClampLogged) {
        config.emergencyClampLogged = true;
        console.warn("Navigation ball emergency clamp activated", {
          target: config.targetId,
          progress: round(raw),
          x: round(point.x),
          y: round(point.y),
          clampedX: round(clamped.x),
          clampedY: round(clamped.y)
        });
      }

      return clamped;
    }

    function detectCurrentSection() {
      var scrollY = window.scrollY || window.pageYOffset;
      var probe = scrollY + window.innerHeight * 0.52;
      var detected = "landing";

      SECTION_IDS.forEach(function (id) {
        var section = document.getElementById(id);

        if (!section) {
          return;
        }

        var rect = section.getBoundingClientRect();
        var top = rect.top + scrollY;

        if (top <= probe) {
          detected = id;
        }
      });

      return detected;
    }

    function updateCurrentSection(section, force) {
      var nextSection = section || detectCurrentSection();

      if (!force && isTravelling) {
        return;
      }

      currentSection = nextSection;
      items.forEach(function (button) {
        var original = originalTarget(button);
        var isCurrentDestination = currentSection !== "landing" && original === currentSection;
        var nextLabel = isCurrentDestination ? "home" : button.dataset.navOriginalLabel || original;
        var nextTarget = isCurrentDestination ? "landing" : original;

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

    function readPlusGeometry() {
      var coreRect = core.getBoundingClientRect();
      var coreStyle = window.getComputedStyle(core);
      var plusCircleSize = parsePixel(coreStyle.width) || coreRect.width;
      var bottomBuffer = parsePixel(coreStyle.bottom) || window.innerHeight - coreRect.bottom;
      var measuredPlusCentreX = coreRect.left + coreRect.width / 2;
      var measuredPlusCentreY = coreRect.top + coreRect.height / 2;
      var measuredSpokeOriginX = coreRect.left + coreRect.width / 2;
      var measuredSpokeOriginY = coreRect.top;

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        plusCircleSize: plusCircleSize,
        bottomBuffer: bottomBuffer,
        measuredPlusCentreX: measuredPlusCentreX,
        measuredPlusCentreY: measuredPlusCentreY,
        expectedPlusCentreX: window.innerWidth / 2,
        expectedPlusCentreY: window.innerHeight - (bottomBuffer + plusCircleSize / 2),
        measuredSpokeOriginX: measuredSpokeOriginX,
        measuredSpokeOriginY: measuredSpokeOriginY,
        expectedSpokeOriginX: window.innerWidth / 2,
        expectedSpokeOriginY: window.innerHeight - (bottomBuffer + plusCircleSize)
      };
    }

    function naviCircleCentres() {
      return items.map(function (button) {
        var label = originalTarget(button);
        var centre = centerOf(button);

        return {
          label: label,
          x: centre.x,
          y: centre.y
        };
      });
    }

    function debugSnapshot(extra) {
      var plus = readPlusGeometry();
      var selected = extra || {};
      var spokeLine = lines.about;
      var spokeLineX1 = spokeLine ? parsePixel(spokeLine.getAttribute("x1")) : null;
      var spokeLineY1 = spokeLine ? parsePixel(spokeLine.getAttribute("y1")) : null;
      var centres = {
        aboutCircleCentreX: null,
        aboutCircleCentreY: null,
        workCircleCentreX: null,
        workCircleCentreY: null,
        archiveCircleCentreX: null,
        archiveCircleCentreY: null,
        contactCircleCentreX: null,
        contactCircleCentreY: null
      };

      naviCircleCentres().forEach(function (point) {
        centres[point.label + "CircleCentreX"] = round(point.x);
        centres[point.label + "CircleCentreY"] = round(point.y);
      });

      return {
        viewportWidth: round(plus.viewportWidth),
        viewportHeight: round(plus.viewportHeight),
        plusCircleSize: round(plus.plusCircleSize),
        bottomBuffer: round(plus.bottomBuffer),
        plusCircleCentreX: round(plus.measuredPlusCentreX),
        plusCircleCentreY: round(plus.measuredPlusCentreY),
        expectedPlusCircleCentreX: round(plus.expectedPlusCentreX),
        expectedPlusCircleCentreY: round(plus.expectedPlusCentreY),
        measuredRedX: round(plus.measuredPlusCentreX),
        measuredBlueX: round(plus.measuredSpokeOriginX),
        expectedCentreX: round(plus.expectedPlusCentreX),
        spokeOriginX: round(plus.measuredSpokeOriginX),
        spokeOriginY: round(plus.measuredSpokeOriginY),
        expectedSpokeOriginX: round(plus.expectedSpokeOriginX),
        expectedSpokeOriginY: round(plus.expectedSpokeOriginY),
        spokeLineX1: round(spokeLineX1),
        spokeLineY1: round(spokeLineY1),
        blueMarkerX: round(plus.measuredSpokeOriginX),
        blueMarkerY: round(plus.measuredSpokeOriginY),
        differenceBetweenSpokeStartAndBlueMarkerX: round(spokeLineX1 - plus.measuredSpokeOriginX),
        differenceBetweenSpokeStartAndBlueMarkerY: round(spokeLineY1 - plus.measuredSpokeOriginY),
        aboutCircleCentreX: centres.aboutCircleCentreX,
        aboutCircleCentreY: centres.aboutCircleCentreY,
        workCircleCentreX: centres.workCircleCentreX,
        workCircleCentreY: centres.workCircleCentreY,
        archiveCircleCentreX: centres.archiveCircleCentreX,
        archiveCircleCentreY: centres.archiveCircleCentreY,
        contactCircleCentreX: centres.contactCircleCentreX,
        contactCircleCentreY: centres.contactCircleCentreY,
        selectedNaviCircle: selected.selectedNaviCircle || null,
        selectedNaviCircleCentreX: round(selected.selectedNaviCircleCentreX),
        selectedNaviCircleCentreY: round(selected.selectedNaviCircleCentreY),
        ballStartX: round(selected.ballStartX),
        ballStartY: round(selected.ballStartY),
        landingTargetX: round(selected.landingTargetX),
        landingTargetY: round(selected.landingTargetY)
      };
    }

    function debugLogGeometry(extra) {
      if (!DEBUG_NAV_GEOMETRY) {
        return;
      }

      console.table(debugSnapshot(extra));
    }

    function debugRenderBase() {
      if (!DEBUG_NAV_GEOMETRY) {
        return;
      }

      var plus = readPlusGeometry();
      debugOverlay.marker("plus centre", plus.measuredPlusCentreX, plus.measuredPlusCentreY, "rgb(220, 0, 0)");
      debugOverlay.marker("spoke origin", plus.measuredSpokeOriginX, plus.measuredSpokeOriginY, "rgb(0, 86, 255)");
      naviCircleCentres().forEach(function (point) {
        debugOverlay.marker(point.label + " centre", point.x, point.y, "rgb(0, 150, 54)");
      });
    }

    function landingTargetScreenRect(platform, finalScroll) {
      if (platform && platform.kind === "floor") {
        return {
          left: 0,
          top: window.innerHeight - 1,
          width: window.innerWidth,
          height: 1
        };
      }

      if (platform && platform.element) {
        var rect = platform.element.getBoundingClientRect();
        var scrollY = window.scrollY || window.pageYOffset;

        return {
          left: rect.left,
          top: rect.top + scrollY - finalScroll,
          width: rect.width,
          height: rect.height
        };
      }

      return {
        left: 0,
        top: window.innerHeight - 1,
        width: window.innerWidth,
        height: 1
      };
    }

    function debugRenderLandingTarget(platform, finalScrollOverride) {
      if (!DEBUG_NAV_GEOMETRY || !platform) {
        return;
      }

      var finalScroll = typeof finalScrollOverride === "number" ? finalScrollOverride : targetScrollFor(platform);
      var rect = landingTargetScreenRect(platform, finalScroll);
      var screenPoint = documentPointToScreen(platform, finalScroll);

      debugOverlay.outline(rect);
      debugOverlay.marker("landing target", screenPoint.x, screenPoint.y + ballRadius(), "rgb(220, 0, 0)");
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
      var liftRatio = 4 * clamp(raw, 0, 1) * (1 - clamp(raw, 0, 1));
      var safeIntensity = clamp(intensity, 0, 1);
      var baseScaleX = 1 + 0.08 * safeIntensity;
      var baseScaleY = 1 - 0.08 * safeIntensity;
      var topScaleX = 1 - 0.04 * safeIntensity;
      var topScaleY = 1 + 0.06 * safeIntensity;

      setBallScale(
        mix(baseScaleX, topScaleX, liftRatio),
        mix(baseScaleY, topScaleY, liftRatio)
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

    function ballRadius() {
      return ball.getBoundingClientRect().width / 2 || 22;
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

    function updateSpokeGeometry(options) {
      var resetDraw = Boolean(options && options.resetDraw);
      var plus = readPlusGeometry();
      var originX = plus.measuredSpokeOriginX;
      var originY = plus.measuredSpokeOriginY;

      spokes.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);
      spokes.setAttribute("width", String(window.innerWidth));
      spokes.setAttribute("height", String(window.innerHeight));

      items.forEach(function (button) {
        var label = originalTarget(button);
        var line = lines[label];
        var point = centerOf(button);

        if (!line) {
          return;
        }

        var length = Math.max(1, Math.hypot(point.x - originX, point.y - originY));
        var maskParts = ensureSpokeMask(label);

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

      debugRenderBase();
    }

    function setOpen(open) {
      if (isTravelling || isProjectMode) {
        return;
      }

      window.clearTimeout(closeOnBlurTimer);

      if (!open) {
        clearPhoneMenuOpeningState();
      }

      if (open) {
        updateCurrentSection(detectCurrentSection(), true);
      }

      isOpen = open;
      nav.classList.toggle("is-open", open);
      setState(open ? STATES.MENU_OPEN : STATES.PLUS_IDLE);
      setMenuA11y(open);

      if (open) {
        debugOverlay.clearTrajectory();
        debugOverlay.clearOutline();
        debugOverlay.hideMarker("ball start");
        debugOverlay.hideMarker("start point");
        debugOverlay.hideMarker("ascent control");
        debugOverlay.hideMarker("descent control");
        debugOverlay.hideMarker("apex point");
        debugOverlay.hideMarker("landing point");
        debugOverlay.hideMarker("landing target");
        window.requestAnimationFrame(function () {
          updateSpokeGeometry({ resetDraw: true });
          window.requestAnimationFrame(playSpokeDraw);
        });
        window.setTimeout(function () {
          updateSpokeGeometry();
          debugLogGeometry();
        }, reducedMotion.matches ? 1 : 1120);
      }
    }

    function preparePhoneMenuOpen() {
      if (isTravelling || isProjectMode || isOpen) {
        return;
      }

      clearPhoneMenuOpeningState();
      nav.classList.add("is-phone-preparing");
      updateCurrentSection(detectCurrentSection(), true);
      updateSpokeGeometry({ resetDraw: true });

      window.requestAnimationFrame(function () {
        if (isTravelling || isProjectMode || isOpen) {
          clearPhoneMenuOpeningState();
          return;
        }

        nav.classList.remove("is-phone-preparing");
        nav.classList.add("is-phone-opening");
        setOpen(true);

        phoneMenuReadyTimer = window.setTimeout(function () {
          nav.classList.add("is-phone-items-ready");
        }, reducedMotion.matches ? 1 : 980);
      });
    }

    function clearChoiceState(finalState) {
      nav.classList.remove("is-open", "is-choosing", "is-travelling", "is-phone-preparing", "is-phone-opening", "is-phone-items-ready");
      window.clearTimeout(phoneMenuReadyTimer);
      phoneMenuReadyTimer = 0;
      items.forEach(function (item) {
        item.disabled = false;
        item.parentElement.classList.remove("is-selected");
      });
      setMenuA11y(false);
      isOpen = false;
      isTravelling = false;
      setState(finalState || STATES.PLUS_IDLE);
    }

    function documentPointToScreen(point, scrollY) {
      return {
        x: point.x,
        y: point.y - scrollY - ballRadius()
      };
    }

    function enterProjectMode() {
      resetBallState(STATES.PLUS_IDLE);

      if (isOpen) {
        isOpen = false;
      }

      nav.classList.remove("is-open", "is-choosing", "is-travelling", "is-phone-preparing", "is-phone-opening", "is-phone-items-ready");
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

    function sectionTopScroll(sectionId) {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var section = document.getElementById(sectionId);
      var scrollY = window.scrollY || window.pageYOffset;
      var sectionTop = section ? section.getBoundingClientRect().top + scrollY : maxScroll;

      return clamp(sectionTop, 0, maxScroll);
    }

    function sectionVisualScroll(sectionId, endPoint) {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var section = document.getElementById(sectionId);
      var scrollY = window.scrollY || window.pageYOffset;
      var title;
      var titleTop;
      var topBuffer;
      var targetScroll;
      var contentScreenY;
      var maxContentScreenY;

      if (sectionId === "contact") {
        return sectionTopScroll("contact");
      }

      if (!section || ["about", "work", "archive"].indexOf(sectionId) === -1) {
        return null;
      }

      title = section.querySelector(".section-title");
      titleTop = title ? title.getBoundingClientRect().top + scrollY : section.getBoundingClientRect().top + scrollY;
      topBuffer = clamp(window.innerHeight * 0.13, 78, 124);
      targetScroll = titleTop - topBuffer;

      if (endPoint && typeof endPoint.y === "number") {
        contentScreenY = endPoint.y - targetScroll;
        maxContentScreenY = window.innerHeight * 0.72;

        if (contentScreenY > maxContentScreenY) {
          targetScroll = endPoint.y - maxContentScreenY;
        }
      }

      return clamp(targetScroll, 0, maxScroll);
    }

    function contactFloor() {
      var contact = document.getElementById("contact");
      var scrollY = window.scrollY || window.pageYOffset;
      var contactTop = contact ? contact.getBoundingClientRect().top + scrollY : sectionTopScroll("contact");

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

      var target = document.getElementById(section);
      return platformFromElement(target || document.body, section, "center");
    }

    function targetScrollFor(point) {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      var visualScroll = sectionVisualScroll(point.section, point);

      if (visualScroll !== null) {
        return visualScroll;
      }

      if (point.kind === "floor" && point.section === "contact") {
        return sectionTopScroll("contact");
      }

      if (point.kind === "floor") {
        return maxScroll;
      }

      return clamp(point.y - window.innerHeight * 0.48, 0, maxScroll);
    }

    function cubicSegmentPointAt(t, path) {
      var inverse = 1 - t;
      var p0 = path.start;
      var p1 = path.controlA;
      var p2 = path.controlB;
      var p3 = path.end;

      return {
        x: inverse * inverse * inverse * p0.x + 3 * inverse * inverse * t * p1.x + 3 * inverse * t * t * p2.x + t * t * t * p3.x,
        y: inverse * inverse * inverse * p0.y + 3 * inverse * inverse * t * p1.y + 3 * inverse * t * t * p2.y + t * t * t * p3.y
      };
    }

    function cubicPointAt(t, path) {
      var safeT = clamp(t, 0, 1);
      var split;
      var segmentT;

      if (path && Array.isArray(path.segments) && path.segments.length === 2) {
        split = clamp(path.split || 0.42, 0.22, 0.72);

        if (safeT <= split) {
          segmentT = split === 0 ? 1 : safeT / split;
          return cubicSegmentPointAt(segmentT, path.segments[0]);
        }

        segmentT = (safeT - split) / (1 - split);
        return cubicSegmentPointAt(segmentT, path.segments[1]);
      }

      return cubicSegmentPointAt(safeT, path);
    }

    function cubicSegmentVelocityAt(t, path) {
      var inverse = 1 - t;
      var p0 = path.start;
      var p1 = path.controlA;
      var p2 = path.controlB;
      var p3 = path.end;

      return {
        x: 3 * inverse * inverse * (p1.x - p0.x) + 6 * inverse * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
        y: 3 * inverse * inverse * (p1.y - p0.y) + 6 * inverse * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
      };
    }

    function cubicVelocityAt(t, path) {
      var safeT = clamp(t, 0, 1);
      var split;
      var segmentT;
      var velocity;

      if (path && Array.isArray(path.segments) && path.segments.length === 2) {
        split = clamp(path.split || 0.42, 0.22, 0.72);

        if (safeT <= split) {
          segmentT = split === 0 ? 1 : safeT / split;
          velocity = cubicSegmentVelocityAt(segmentT, path.segments[0]);
          return {
            x: velocity.x / split,
            y: velocity.y / split
          };
        }

        segmentT = (safeT - split) / (1 - split);
        velocity = cubicSegmentVelocityAt(segmentT, path.segments[1]);
        return {
          x: velocity.x / (1 - split),
          y: velocity.y / (1 - split)
        };
      }

      return cubicSegmentVelocityAt(safeT, path);
    }

    function evaluateBounce(baseX, baseY, height, elapsedMs, durationMs) {
      var p = clamp(durationMs > 0 ? elapsedMs / durationMs : 1, 0, 1);
      var yOffset = -4 * height * p * (1 - p);

      return {
        x: baseX,
        y: baseY + yOffset
      };
    }

    function createExactTrackMetrics(start, landing, geometry) {
      var length1 = geometry && geometry.D ? Math.abs(start.y - geometry.D.y) : 0;
      var length2 = geometry && Number.isFinite(geometry.horizontalSpan) && Number.isFinite(geometry.arcHeight) ?
        Math.max(1, geometry.horizontalSpan + geometry.arcHeight * 2) :
        0;
      var length3 = geometry && geometry.E ? Math.abs(landing.y - geometry.E.y) : 0;
      var totalLength = Math.max(1, length1 + length2 + length3);
      var descentStartDistance = length1 + length2;

      return {
        length1: length1,
        length2: length2,
        length3: length3,
        totalLength: totalLength,
        ascentEndDistance: length1,
        descentStartDistance: descentStartDistance,
        ascentEndProgress: length1 / totalLength,
        descentStartProgress: descentStartDistance / totalLength
      };
    }

    function evaluateTrackAtDistance(distance, path) {
      var geometry = path.geometry;
      var track = path.track || createExactTrackMetrics(path.start, path.end, geometry);
      var s = clamp(distance, 0, track.totalLength);
      var arcS;
      var arcProgress;
      var sx;
      var fallS;

      if (s <= track.length1) {
        return {
          x: path.start.x,
          y: path.start.y - s
        };
      }

      if (track.length2 > 0 && s <= track.descentStartDistance) {
        arcS = s - track.length1;
        arcProgress = clamp(arcS / track.length2, 0, 1);
        sx = smoothstep(arcProgress);

        return {
          x: geometry.D.x + (geometry.E.x - geometry.D.x) * sx,
          y: geometry.arcBaseY - geometry.arcHeight * 4 * arcProgress * (1 - arcProgress)
        };
      }

      fallS = s - track.length1 - track.length2;
      return {
        x: path.end.x,
        y: geometry.E.y + fallS
      };
    }

    function navBallMasterHeight(ballSize) {
      return isMobileViewport() ?
        clamp(ballSize * 1.55, 44, 78) :
        clamp(ballSize * 2, 64, 120);
    }

    function visiblePathTopMargin(options) {
      var fallback = ballRadius() + 24;

      if (options && Number.isFinite(options.safeTop)) {
        return Math.max(0, options.safeTop);
      }

      if (options && options.bounds && Number.isFinite(options.bounds.minY)) {
        return Math.max(fallback, options.bounds.minY);
      }

      return fallback;
    }

    function createExactPathGeometry(start, landing, baseZ, options) {
      var safeTop = visiblePathTopMargin(options);
      var dx = landing.x - start.x;
      var horizontalSpan = Math.abs(dx);
      var r = horizontalSpan / 2;
      var topY = Math.min(start.y, landing.y);
      var z = Math.max(0, baseZ);
      var prepBounceZMax = Math.max(0, (start.y - safeTop) / 0.75);
      var landingBounceZMax = Math.max(0, (landing.y - safeTop) / 0.75);
      var bounceVisibleZMax = Math.min(prepBounceZMax, landingBounceZMax);
      var requestedOvershoot;
      var availableRise;
      var minimumOvershoot;
      var overshoot;
      var arcBaseY;
      var arcHeight;
      var apexY;
      var m;
      var centerX = (start.x + landing.x) / 2;
      var centerY;

      z = Math.min(z, bounceVisibleZMax);
      requestedOvershoot = clamp(z * 0.75, 42, 92);
      availableRise = topY - safeTop;
      minimumOvershoot = Math.min(Math.max(z * 0.35, 18), Math.max(1, availableRise));
      overshoot = availableRise > 0 ?
        Math.min(requestedOvershoot, Math.max(minimumOvershoot, availableRise * 0.72)) :
        1;
      arcBaseY = topY - overshoot;
      arcHeight = clamp(horizontalSpan * 0.18, 36, 96);
      arcHeight = Math.min(arcHeight, Math.max(1, arcBaseY - safeTop));
      apexY = arcBaseY - arcHeight;
      m = start.y - arcBaseY;
      centerY = arcBaseY;

      return {
        z: z,
        a: m,
        m: m,
        topY: topY,
        overshoot: overshoot,
        requestedOvershoot: requestedOvershoot,
        arcBaseY: arcBaseY,
        arcHeight: arcHeight,
        horizontalSpan: horizontalSpan,
        safeTop: safeTop,
        bounceVisibleZMax: bounceVisibleZMax,
        apexY: apexY,
        visibilityLimited: overshoot < requestedOvershoot || apexY < safeTop,
        D: {
          x: start.x,
          y: arcBaseY
        },
        C: {
          x: centerX,
          y: apexY
        },
        E: {
          x: landing.x,
          y: arcBaseY
        },
        r: r,
        centerX: centerX,
        centerY: centerY,
        direction: Math.sign(dx) || 1,
        startTheta: landing.x < start.x ? 0 : Math.PI,
        endTheta: landing.x < start.x ? Math.PI : 0
      };
    }

    function evaluateExactNavTrajectory(raw, start, landing, options) {
      var t = clamp(raw, 0, 1);
      var geometry = options && options.geometry ?
        options.geometry :
        createExactPathGeometry(start, landing, navBallMasterHeight(ballRadius() * 2), options);
      var track = options && options.track ? options.track : createExactTrackMetrics(start, landing, geometry);

      return evaluateTrackAtDistance(track.totalLength * t, {
        start: start,
        end: landing,
        geometry: geometry,
        track: track
      });
    }

    function pathPointAt(raw, path) {
      if (path && path.kind === "exact-nav-trajectory") {
        return evaluateExactNavTrajectory(raw, path.start, path.end, path);
      }

      return cubicPointAt(clamp(raw, 0, 1), path);
    }

    function pathVelocityAt(raw, path) {
      var safeT = clamp(raw, 0, 1);
      var delta = 0.001;
      var beforeT;
      var afterT;
      var before;
      var after;

      if (path && path.kind === "exact-nav-trajectory") {
        beforeT = Math.max(0, safeT - delta);
        afterT = Math.min(1, safeT + delta);

        if (beforeT === afterT) {
          return {
            x: 0,
            y: 0
          };
        }

        before = pathPointAt(beforeT, path);
        after = pathPointAt(afterT, path);
        return {
          x: (after.x - before.x) / (afterT - beforeT),
          y: (after.y - before.y) / (afterT - beforeT)
        };
      }

      return cubicVelocityAt(safeT, path);
    }

    function resolveFinalScroll(endPoint, startScreen, downward, targetId, bounds) {
      var radius = ballRadius();
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var desiredCenterY = 0;

      var visualScroll = sectionVisualScroll(targetId, endPoint);

      if (visualScroll !== null) {
        return visualScroll;
      }

      if (endPoint.kind === "floor" && endPoint.section === "contact") {
        return sectionTopScroll("contact");
      }

      if (endPoint.kind === "floor") {
        return maxScroll;
      }

      if (targetId === "landing") {
        desiredCenterY = clamp(window.innerHeight * 0.42, bounds.minY, bounds.maxY);
      } else if (downward) {
        desiredCenterY = clamp(Math.max(startScreen.y + 48, window.innerHeight * 0.7), bounds.minY, bounds.maxY);
      } else {
        desiredCenterY = clamp(Math.min(startScreen.y - 40, window.innerHeight * 0.52), bounds.minY, bounds.maxY);
      }

      return clamp(endPoint.y - (desiredCenterY + radius), 0, maxScroll);
    }

    function resolveCameraFinalScroll(endPoint, startScreen, targetId, bounds) {
      var radius = ballRadius();
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var safeTop = visiblePathTopMargin({ bounds: bounds });
      var z = navBallMasterHeight(radius * 2);
      var overshoot = clamp(z * 0.75, 42, 92);
      var horizontalSpan = Math.abs(endPoint.x - startScreen.x);
      var arcHeight = clamp(horizontalSpan * 0.18, 36, 96);
      var minLandingY = safeTop + arcHeight + overshoot + 8;
      var preferredLandingY = Math.max(window.innerHeight * 0.58, minLandingY);
      var desiredLandingY = clamp(preferredLandingY, bounds.minY, bounds.maxY);

      if (endPoint.kind === "floor" && endPoint.section === "contact") {
        return sectionTopScroll("contact");
      }

      if (endPoint.kind === "floor") {
        return maxScroll;
      }

      return clamp(endPoint.y - (desiredLandingY + radius), 0, maxScroll);
    }

    function updatePathApex(path) {
      var apex = path.start;

      if (path && path.kind === "exact-nav-trajectory" && path.geometry && hasFinitePoint(path.geometry.C)) {
        path.apex = path.geometry.C;
        return;
      }

      for (var step = 1; step <= 48; step += 1) {
        var point = pathPointAt(step / 48, path);

        if (point.y < apex.y) {
          apex = point;
        }
      }

      path.apex = apex;
    }

    function landingApproachHeight() {
      return clamp(window.innerHeight * 0.18, 130, 230);
    }

    function directionXFor(start, landing) {
      var dx = landing.x - start.x;

      return dx === 0 ? 1 : dx / Math.abs(dx);
    }

    function finalApproachControlX(start, landing, upward) {
      var directionX = directionXFor(start, landing);
      var absDeltaX = Math.abs(landing.x - start.x);

      if (upward) {
        return landing.x + directionX * clamp(absDeltaX * 0.02, 0, 20);
      }

      return landing.x + directionX * clamp(absDeltaX * 0.02, 0, 24);
    }

    function createCompositePath(start, firstA, firstB, apex, secondA, secondB, landing, bounds, split, direction) {
      var fittedApex = fitControlPointInsideBounds(apex, bounds);
      var segmentA = {
        start: start,
        controlA: fitControlPointInsideBounds(firstA, bounds),
        controlB: fitControlPointInsideBounds(firstB, bounds),
        end: fittedApex
      };
      var segmentB = {
        start: fittedApex,
        controlA: fitControlPointInsideBounds(secondA, bounds),
        controlB: fitControlPointInsideBounds(secondB, bounds),
        end: landing
      };
      var path = {
        start: start,
        controlA: segmentA.controlA,
        controlB: segmentB.controlB,
        end: landing,
        split: split,
        direction: direction,
        joinPoint: fittedApex,
        segments: [segmentA, segmentB]
      };

      updatePathApex(path);
      return path;
    }

    function syncCompositePath(path) {
      if (!path || !Array.isArray(path.segments) || path.segments.length !== 2) {
        return;
      }

      path.start = path.segments[0].start;
      path.controlA = path.segments[0].controlA;
      path.controlB = path.segments[1].controlB;
      path.end = path.segments[1].end;
      path.joinPoint = path.segments[0].end;
    }

    function enforceLandingVelocity(path, bounds) {
      var minVisibleY = Math.max(bounds.minY, 36);
      var approachHeight = landingApproachHeight();
      var finalControl;

      if (path && path.kind === "exact-nav-trajectory") {
        path.controlA = path.geometry.D;
        path.controlB = path.geometry.E;
        updatePathApex(path);
        return;
      }

      if (path && Array.isArray(path.segments) && path.segments.length === 2) {
        finalControl = path.segments[1].controlB;
        path.segments[1].controlB = fitControlPointInsideBounds({
          x: hasFinitePoint(finalControl) ? finalControl.x : path.end.x,
          y: Math.max(minVisibleY, path.end.y - approachHeight)
        }, bounds);
        syncCompositePath(path);
        updatePathApex(path);
        return;
      }

      path.controlB = fitControlPointInsideBounds({
        x: hasFinitePoint(path.controlB) ? path.controlB.x : path.end.x,
        y: Math.max(minVisibleY, path.end.y - approachHeight)
      }, bounds);

      updatePathApex(path);
    }

    function hasFinitePoint(point) {
      return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
    }

    function hasFinitePath(path) {
      if (!path) {
        return false;
      }

      if (path.kind === "exact-nav-trajectory") {
        return hasFinitePoint(path.start) &&
          hasFinitePoint(path.end) &&
          hasFinitePoint(path.apex) &&
          hasFinitePoint(path.controlA) &&
          hasFinitePoint(path.controlB) &&
          path.geometry &&
          hasFinitePoint(path.geometry.D) &&
          hasFinitePoint(path.geometry.C) &&
          hasFinitePoint(path.geometry.E) &&
          Number.isFinite(path.geometry.z) &&
          Number.isFinite(path.geometry.m) &&
          Number.isFinite(path.geometry.r) &&
          Number.isFinite(path.geometry.apexY) &&
          Number.isFinite(path.geometry.topY) &&
          Number.isFinite(path.geometry.arcBaseY) &&
          Number.isFinite(path.geometry.arcHeight) &&
          Number.isFinite(path.geometry.horizontalSpan) &&
          Number.isFinite(path.geometry.overshoot) &&
          Number.isFinite(path.geometry.centerX) &&
          Number.isFinite(path.geometry.centerY);
      }

      if (Array.isArray(path.segments)) {
        return path.segments.length === 2 &&
          path.segments.every(function (segment) {
            return hasFinitePoint(segment.start) &&
              hasFinitePoint(segment.controlA) &&
              hasFinitePoint(segment.controlB) &&
              hasFinitePoint(segment.end);
          }) &&
          hasFinitePoint(path.start) &&
          hasFinitePoint(path.end);
      }

      return Boolean(path) &&
        hasFinitePoint(path.start) &&
        hasFinitePoint(path.controlA) &&
        hasFinitePoint(path.controlB) &&
        hasFinitePoint(path.end);
    }

    function createExactNavTrajectoryPath(start, landing, config, direction) {
      var z = navBallMasterHeight(ballRadius() * 2);
      var geometry = createExactPathGeometry(start, landing, z, {
        bounds: config.bounds
      });
      var path = {
        kind: "exact-nav-trajectory",
        start: start,
        controlA: geometry.D,
        controlB: geometry.E,
        end: landing,
        apex: geometry.C,
        geometry: geometry,
        z: geometry.z,
        track: createExactTrackMetrics(start, landing, geometry),
        direction: direction
      };

      updatePathApex(path);
      return path;
    }

    function createDownwardFlightPath(start, landing, config) {
      var path = createExactNavTrajectoryPath(start, landing, config, "downward");

      enforceLandingVelocity(path, config.bounds);
      return path;
    }

    function fallbackUpwardFlightPath(start, landing, config) {
      var path = createExactNavTrajectoryPath(start, landing, config, "upward");

      enforceLandingVelocity(path, config.bounds);
      return path;
    }

    function createUpwardFlightPath(start, landing, config) {
      var path = createExactNavTrajectoryPath(start, landing, config, "upward");

      if (!hasFinitePath(path)) {
        return fallbackUpwardFlightPath(start, landing, config);
      }

      enforceLandingVelocity(path, config.bounds);
      if (!hasFinitePath(path)) {
        return fallbackUpwardFlightPath(start, landing, config);
      }

      return path;
    }

    function createSmoothFlightPath(startScreen, endScreen, config) {
      var bounds = config.bounds;
      var start = fitControlPointInsideBounds(startScreen, bounds);
      var landing = config.targetId === "contact" ? {
        x: clamp(endScreen.x, bounds.minX, bounds.maxX),
        y: bounds.floorY
      } : fitControlPointInsideBounds(endScreen, bounds);

      if (config.upward) {
        return createUpwardFlightPath(start, landing, config);
      }

      return createDownwardFlightPath(start, landing, config);
    }

    function createFlightConfig(startPoint, endPoint, targetId, startScroll) {
      var fromIndex = sectionIndex(currentSection || detectCurrentSection());
      var toIndex = sectionIndex(targetId);
      var upward = toIndex < fromIndex;
      var side = targetSideFor(targetId);
      var horizontalDirection = side === "right" ? 1 : side === "left" ? -1 : endPoint.x >= startPoint.x ? 1 : -1;
      var distanceX = Math.abs(endPoint.x - startPoint.x);
      var distanceY = Math.abs(endPoint.y - startPoint.y);
      var pathDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      var downward = toIndex > fromIndex;
      var bounds = getSafeBounds({ allowFloor: targetId === "contact" });
      var startScreen = fitControlPointInsideBounds(documentPointToScreen(startPoint, startScroll), bounds);
      var finalScroll = resolveCameraFinalScroll(endPoint, startScreen, targetId, bounds);
      var endScreen = documentPointToScreen(endPoint, finalScroll);
      var duration = reducedMotion.matches ? 1 : clamp((pathDistance * 0.34 + 820) * FLIGHT_DURATION_MULTIPLIER, 1400, 2600);

      if (targetId === "contact") {
        endScreen = {
          x: clamp(endScreen.x, bounds.minX, bounds.maxX),
          y: bounds.floorY
        };
      } else {
        endScreen = fitControlPointInsideBounds(endScreen, bounds);
      }

      var config = {
        targetId: targetId,
        startPoint: startPoint,
        endPoint: endPoint,
        startScroll: startScroll,
        finalScroll: finalScroll,
        startScreen: startScreen,
        endScreen: endScreen,
        bounds: bounds,
        horizontalDirection: horizontalDirection,
        upward: upward,
        downward: downward,
        duration: duration,
        scrollDelay: 0,
        cameraMode: upward ? "pre-scroll-before-flight" : "delayed-descent-scroll",
        initialScroll: startScroll,
        hasShadow: endPoint.kind !== "floor",
        emergencyClampLogged: false,
        path: null
      };

      config.path = createSmoothFlightPath(startScreen, endScreen, config);
      adjustPathForObstacles(config);
      enforceLandingVelocity(config.path, bounds);
      if (!hasFinitePath(config.path)) {
        config.path = config.upward ? fallbackUpwardFlightPath(startScreen, endScreen, config) : createSmoothFlightPath(startScreen, endScreen, config);
      }
      debugNavBallPath(config);
      return config;
    }

    function flightPointAt(raw, config) {
      return pathPointAt(clamp(raw, 0, 1), config.path);
    }

    function flightVelocityAt(raw, config) {
      return pathVelocityAt(clamp(raw, 0, 1), config.path);
    }

    function flightScrollAt(raw, config) {
      var progress = clamp(raw, 0, 1);
      var arcEnd = config.path && config.path.track && Number.isFinite(config.path.track.descentStartProgress) ?
        config.path.track.descentStartProgress :
        0.68;
      var fallProgress;

      if (config.cameraMode === "pre-scrolled-freeze") {
        return config.finalScroll;
      }

      if (config.cameraMode === "delayed-descent-scroll") {
        if (progress < arcEnd) {
          return config.startScroll;
        }

        fallProgress = (progress - arcEnd) / (1 - arcEnd);
        return mix(config.startScroll, config.finalScroll, clamp(fallProgress, 0, 1));
      }

      return mix(config.startScroll, config.finalScroll, progress);
    }

    function debugNavBallPath(config) {
      var samples;
      var p0;
      var p28;
      var p48;
      var p68;
      var p100;
      var finalVelocity;
      var geometry;

      if (!(DEBUG_BALL_PATH || DEBUG_NAV_BALL_PATH || DEBUG_NAV_BALL_TRAJECTORY || DEBUG_NAV_BALL_EXACT_PATH) || !config || !config.path) {
        return;
      }

      samples = [0, 0.28, 0.48, 0.68, 1].map(function (raw) {
        var point = flightPointAt(raw, config);

        return {
          t: raw,
          x: round(point.x),
          y: round(point.y)
        };
      });
      p0 = flightPointAt(0, config);
      p28 = flightPointAt(0.28, config);
      p48 = flightPointAt(0.48, config);
      p68 = flightPointAt(0.68, config);
      p100 = flightPointAt(1, config);
      finalVelocity = flightVelocityAt(1, config);
      geometry = config.path.geometry || {};

      if (geometry.D && geometry.E) {
        console.assert(geometry.D.y < config.path.start.y, "D must be above A");
        console.assert(geometry.E.y < config.path.end.y, "E must be above B");
        console.assert(Math.abs(geometry.D.x - config.path.start.x) < 0.001, "A-D must be vertical");
        console.assert(Math.abs(geometry.E.x - config.path.end.x) < 0.001, "E-B must be vertical");
      }

      console.table({
        targetId: config.targetId,
        direction: config.upward ? "upward" : "downward",
        pathKind: config.path.kind || "cubic",
        usesCompositePath: Array.isArray(config.path.segments),
        Ax: round(config.path.start.x),
        Ay: round(config.path.start.y),
        Bx: round(config.path.end.x),
        By: round(config.path.end.y),
        z: round(geometry.z),
        a: round(geometry.a),
        m: round(geometry.m),
        topY: round(geometry.topY),
        arcBaseY: round(geometry.arcBaseY),
        arcHeight: round(geometry.arcHeight),
        overshoot: round(geometry.overshoot),
        requestedOvershoot: round(geometry.requestedOvershoot),
        safeTop: round(geometry.safeTop),
        bounceVisibleZMax: round(geometry.bounceVisibleZMax),
        apexY: round(geometry.apexY),
        visibilityLimited: Boolean(geometry.visibilityLimited),
        Dx: round(geometry.D && geometry.D.x),
        Dy: round(geometry.D && geometry.D.y),
        Cx: round(geometry.C && geometry.C.x),
        Cy: round(geometry.C && geometry.C.y),
        Ex: round(geometry.E && geometry.E.x),
        Ey: round(geometry.E && geometry.E.y),
        radius: round(geometry.r),
        horizontalSpan: round(geometry.horizontalSpan),
        centerX: round(geometry.centerX),
        centerY: round(geometry.centerY),
        launchXFixed: Math.abs(p0.x - p28.x) < 0.5,
        capMovesX: Math.abs(p28.x - p48.x) > 0.5 || Math.abs(p48.x - p68.x) > 0.5,
        capHasSingleArch: p48.y < p28.y && p48.y < p68.y,
        fallXFixed: Math.abs(p68.x - p100.x) < 0.5,
        finalVelocityNonZero: Math.abs(finalVelocity.x) + Math.abs(finalVelocity.y) > 0.5,
        finalVelocityX: round(finalVelocity.x),
        finalVelocityY: round(finalVelocity.y)
      });
      console.debug("nav ball path samples", samples);
    }

    function debugRenderTrajectory(startPoint, endPoint, targetId, startScroll) {
      if (!DEBUG_NAV_GEOMETRY) {
        return;
      }

      var config = createFlightConfig(startPoint, endPoint, targetId, startScroll);
      var points = [];

      for (var step = 0; step <= 72; step += 1) {
        var raw = step / 72;
        var point = flightPointAt(raw, config);
        points.push(point);
      }

      debugOverlay.trajectory(points);
      debugOverlay.marker("start point", config.path.start.x, config.path.start.y, "rgb(132, 0, 255)");
      debugOverlay.marker("ascent control", config.path.controlA.x, config.path.controlA.y, "rgb(0, 98, 190)");
      debugOverlay.marker("descent control", config.path.controlB.x, config.path.controlB.y, "rgb(0, 130, 96)");
      debugOverlay.marker("apex point", config.path.apex.x, config.path.apex.y, "rgb(194, 0, 160)");
      debugOverlay.marker("landing point", config.path.end.x, config.path.end.y, "rgb(210, 0, 0)");
    }

    function restorePlusAfterRoll(token, targetId) {
      var restoreDuration = scaleMotionDuration(340);

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      debugNavBall("normal roll complete: hiding travel ball and restoring plus");
      hideTravelBallForPlusRestore();
      nav.classList.add("is-plus-restoring");
      document.documentElement.classList.remove("is-ball-animating");
      clearChoiceState(STATES.PLUS_RESTORED);

      resetTimer = setBallTimeout(function () {
        nav.classList.remove("is-plus-restoring");
        hideTravelBallForPlusRestore();
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, restoreDuration, token);
    }

    function morphBallIntoPlus(token, targetId, options) {
      var restoreDuration = scaleMotionDuration(options && typeof options.duration === "number" ? options.duration : 260);

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      debugNavBall("home return: morphing ball into plus");
      setState(STATES.PLUS_RESTORED);
      ball.style.setProperty("--restore-duration", restoreDuration + "ms");
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);
      document.documentElement.classList.remove("is-ball-animating");

      resetTimer = setBallTimeout(function () {
        debugNavBall("nav ball animation end", targetId);
        resetBallState(STATES.PLUS_IDLE);
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, reducedMotion.matches ? 1 : restoreDuration);
    }

    function bounceLift(raw, height) {
      var safeRaw = clamp(raw, 0, 1);
      var apexAt = 0.43;

      if (safeRaw <= apexAt) {
        return Math.sin((safeRaw / apexAt) * (Math.PI / 2)) * height;
      }

      return Math.cos(((safeRaw - apexAt) / (1 - apexAt)) * (Math.PI / 2)) * height;
    }

    function runHomeReturnMotion(startPoint, targetId, token) {
      var startScroll = window.scrollY || window.pageYOffset;
      var startScreen = documentPointToScreen(startPoint, startScroll);
      var plus = readPlusGeometry();
      var endScreen = {
        x: plus.measuredPlusCentreX,
        y: plus.measuredPlusCentreY
      };
      var dx = endScreen.x - startScreen.x;
      var firstPrepHeight = clamp(window.innerHeight * 0.034, 24, 34);
      var secondPrepHeight = clamp(firstPrepHeight * 1.7, 40, 58);
      var thirdPrepHeight = clamp(secondPrepHeight * 1.34, 52, 76);
      var baseFirstPrepDuration = clamp(window.innerHeight * 0.52, 380, 440);
      var baseSecondPrepDuration = clamp(baseFirstPrepDuration + 80, 420, 540);
      var baseThirdPrepDuration = clamp(baseSecondPrepDuration + 70, 460, 620);
      var firstPrepDuration = scaleMotionDuration(baseFirstPrepDuration);
      var secondPrepDuration = scaleMotionDuration(baseSecondPrepDuration);
      var thirdPrepDuration = scaleMotionDuration(baseThirdPrepDuration);
      var previousHomeArcDuration = scaleMotionDuration(clamp(Math.abs(startScreen.y - endScreen.y) * 0.78 + Math.abs(dx) * 0.28 + 900, 1300, 2200) * 2.1);
      var homeRouteLeadProgress = 0.65;
      var routeLeadDuration = previousHomeArcDuration * homeRouteLeadProgress;
      var finalHomeApproachDuration = previousHomeArcDuration * (1 - homeRouteLeadProgress) * 1.6;
      var homeArcDuration = routeLeadDuration + finalHomeApproachDuration;
      var homeMorphDuration = 680;
      var arcDuration = homeArcDuration;
      var prep1End = firstPrepDuration;
      var prep2End = prep1End + secondPrepDuration;
      var prep3End = prep2End + thirdPrepDuration;
      var arcEnd = prep3End + arcDuration;
      var apexY = clamp(window.innerHeight * 0.12, 72, 128);
      var launchLift = clamp(window.innerHeight * 0.42, 260, 480);
      var path = {
        start: startScreen,
        controlA: {
          x: startScreen.x + dx * 0.08,
          y: Math.min(startScreen.y - launchLift, apexY + 120)
        },
        controlB: {
          x: window.innerWidth / 2,
          y: apexY
        },
        end: endScreen
      };
      var startTime = 0;
      var cleanUrl = window.location.pathname + window.location.search;

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        window.scrollTo(0, 0);
        setBallPosition(endScreen.x, endScreen.y);
        updateCurrentSection("landing", true);
        morphBallIntoPlus(token, targetId);
        return;
      }

      if (DEBUG_NAV_GEOMETRY) {
        console.table({
          isHomeReturn: true,
          timelinePhases: "prepBounceSmall, prepBounceHigher, prepBounceHighest, homeReturnArc, morphToPlus",
          firstPrepBounceHeight: round(firstPrepHeight),
          secondPrepBounceHeight: round(secondPrepHeight),
          thirdPrepBounceHeight: round(thirdPrepHeight),
          firstPrepBounceDuration: round(firstPrepDuration),
          secondPrepBounceDuration: round(secondPrepDuration),
          thirdPrepBounceDuration: round(thirdPrepDuration),
          noLandingBounces: true,
          noRollAway: true,
          homeTargetX: round(endScreen.x),
          homeTargetY: round(endScreen.y)
        });
        console.debug("home timing", {
          homeArcDuration: homeArcDuration,
          finalHomeApproachDuration: finalHomeApproachDuration,
          homeMorphDuration: homeMorphDuration
        });
      }

      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving");
      resetTimelineShadow();

      function frame(now) {
        var elapsed;
        var arcElapsed;
        var finalRaw;
        var raw;
        var point;

        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        elapsed = clamp(now - startTime, 0, arcEnd);

        if (elapsed < prep1End) {
          raw = elapsed / firstPrepDuration;
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(startScreen.x, startScreen.y - bounceLift(raw, firstPrepHeight));
        } else if (elapsed < prep2End) {
          raw = (elapsed - prep1End) / secondPrepDuration;
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(startScreen.x, startScreen.y - bounceLift(raw, secondPrepHeight));
        } else if (elapsed < prep3End) {
          raw = (elapsed - prep2End) / thirdPrepDuration;
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(startScreen.x, startScreen.y - bounceLift(raw, thirdPrepHeight));
        } else if (elapsed < arcEnd) {
          arcElapsed = elapsed - prep3End;

          if (arcElapsed < routeLeadDuration) {
            raw = (arcElapsed / routeLeadDuration) * homeRouteLeadProgress;
          } else {
            finalRaw = (arcElapsed - routeLeadDuration) / finalHomeApproachDuration;
            raw = homeRouteLeadProgress + (1 - homeRouteLeadProgress) * easeOutCubic(finalRaw);
          }

          point = cubicPointAt(raw, path);
          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting");
          ball.classList.add("is-flying");
          window.scrollTo(0, mix(startScroll, 0, easeInOut(raw)));
          setBallPosition(point.x, point.y);
        } else {
          window.scrollTo(0, 0);
          setBallPosition(endScreen.x, endScreen.y);
          resetTimelineShadow();
          updateCurrentSection("landing", true);

          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", cleanUrl);
          }

          morphBallIntoPlus(token, targetId, { duration: homeMorphDuration });
          return;
        }

        setTimelineShadow(0, 0.72);
        requestBallFrame(frame, token);
      }

      requestBallFrame(frame, token);
    }

    function flyBall(startPoint, targetId, token) {
      if (targetId === "landing") {
        runHomeReturnMotion(startPoint, targetId, token);
        return;
      }

      var endPoint = targetPlatformFor(targetId);
      var startScroll = window.scrollY || window.pageYOffset;
      var config = createFlightConfig(startPoint, endPoint, targetId, startScroll);
      var startTime = 0;
      var impactVelocity = flightVelocityAt(1, config);
      var impactVelocityY = Math.max(0, impactVelocity.y);
      var ballSize = ballRadius() * 2;
      var z = config.path && config.path.geometry && Number.isFinite(config.path.geometry.z) ?
        config.path.geometry.z :
        navBallMasterHeight(ballSize);
      var bounceZ = z * NAV_BALL_BOUNCE_HEIGHT_SCALE;
      var firstPrepHeight = bounceZ / 4;
      var secondPrepHeight = bounceZ / 2;
      var thirdPrepHeight = (3 * bounceZ) / 4;
      var track = config.path && config.path.track ? config.path.track : createExactTrackMetrics(config.path.start, config.path.end, config.path.geometry);
      var trajectoryDurationScale = clamp(track.totalLength / 720, 0.85, 1.08);
      var firstPrepDuration = scaleMotionDuration(NAV_BALL_PREP_DURATIONS[0]);
      var secondPrepDuration = scaleMotionDuration(NAV_BALL_PREP_DURATIONS[1]);
      var thirdPrepDuration = scaleMotionDuration(NAV_BALL_PREP_DURATIONS[2]);
      var preScrollDistance = Math.abs(config.finalScroll - config.startScroll);
      var shouldPreScrollBeforeFlight = config.upward && preScrollDistance > 1;
      var preScrollMotionDuration = shouldPreScrollBeforeFlight ?
        scaleMotionDuration(clamp(preScrollDistance * 0.45, 520, 700)) :
        0;
      var launchDuration = scaleMotionDuration(NAV_BALL_TRAJECTORY_DURATIONS.launch * trajectoryDurationScale);
      var arcDuration = scaleMotionDuration(NAV_BALL_TRAJECTORY_DURATIONS.arc * trajectoryDurationScale);
      var fallDuration = scaleMotionDuration(NAV_BALL_TRAJECTORY_DURATIONS.fall * trajectoryDurationScale);
      var firstLandingHeight = (3 * bounceZ) / 4;
      var secondLandingHeight = bounceZ / 2;
      var thirdLandingHeight = bounceZ / 4;
      var firstLandingDuration = scaleMotionDuration(NAV_BALL_LANDING_DURATIONS[0]);
      var secondLandingDuration = scaleMotionDuration(NAV_BALL_LANDING_DURATIONS[1]);
      var thirdLandingDuration = scaleMotionDuration(NAV_BALL_LANDING_DURATIONS[2]);
      var rollDuration = scaleMotionDuration(2180);
      var prep1End = firstPrepDuration;
      var prep2End = prep1End + secondPrepDuration;
      var prep3End = prep2End + thirdPrepDuration;
      var launchEnd = prep3End + launchDuration;
      var arcEnd = launchEnd + arcDuration;
      var fallEnd = arcEnd + fallDuration;
      var rebound1End = fallEnd + firstLandingDuration;
      var rebound2End = rebound1End + secondLandingDuration;
      var rebound3End = rebound2End + thirdLandingDuration;
      var rollEnd = rebound3End + rollDuration;
      var rollDirection = rollDirectionFor(targetId);
      var rollStartX = config.endScreen.x;
      var rollEndX = rollDirection < 0 ? -ballRadius() - 18 : window.innerWidth + ballRadius() + 18;
      var rollCircumference = Math.max(1, Math.PI * ballRadius() * 2);
      var target = document.getElementById(targetId);
      var cleanUrl = window.location.pathname + window.location.search;
      var impactHandled = false;
      var rollStarted = false;
      var preScrollPrepared = !shouldPreScrollBeforeFlight;
      var cameraDebugPhase = "";
      var timingLogged = false;

      if (config.upward && !shouldPreScrollBeforeFlight) {
        config.cameraMode = "pre-scrolled-freeze";
      }

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        window.scrollTo(0, config.finalScroll);
        setBallPosition(config.endScreen.x, config.endScreen.y);
        updateCurrentSection(targetId, true);
        restorePlusAfterRoll(token, targetId);
        return;
      }

      if (DEBUG_NAV_GEOMETRY) {
        var debugP0 = flightPointAt(0, config);
        var debugP28 = flightPointAt(0.28, config);
        var debugP48 = flightPointAt(0.48, config);
        var debugP68 = flightPointAt(0.68, config);
        var debugP100 = flightPointAt(1, config);
        var debugGeometry = config.path.geometry || {};
        var debugFinalVelocity = flightVelocityAt(1, config);

        console.table({
          isUpwardNavigation: config.upward,
          timelinePhases: "prepBounceSmall, prepBounceHigher, prepBounceHighest, launchArc, impactReboundLarge, impactReboundSmall, impactReboundTiny, rollOut",
          usedSetTimeoutForBounce: false,
          transformTransitionDuringFlight: false,
          usedEaseOutIntoLanding: false,
          trajectoryKind: config.path.kind || "cubic",
          launchXFixed: Math.abs(debugP0.x - debugP28.x) < 0.5,
          capMovesX: Math.abs(debugP28.x - debugP48.x) > 0.5 || Math.abs(debugP48.x - debugP68.x) > 0.5,
          fallXFixed: Math.abs(debugP68.x - debugP100.x) < 0.5,
          z: round(z),
          bounceZ: round(bounceZ),
          a: round(debugGeometry.a),
          m: round(debugGeometry.m),
          topY: round(debugGeometry.topY),
          arcBaseY: round(debugGeometry.arcBaseY),
          overshoot: round(debugGeometry.overshoot),
          requestedOvershoot: round(debugGeometry.requestedOvershoot),
          safeTop: round(debugGeometry.safeTop),
          bounceVisibleZMax: round(debugGeometry.bounceVisibleZMax),
          apexY: round(debugGeometry.apexY),
          visibilityLimited: Boolean(debugGeometry.visibilityLimited),
          pointD: debugGeometry.D ? {
            x: round(debugGeometry.D.x),
            y: round(debugGeometry.D.y)
          } : null,
          pointC: debugGeometry.C ? {
            x: round(debugGeometry.C.x),
            y: round(debugGeometry.C.y)
          } : null,
          pointE: debugGeometry.E ? {
            x: round(debugGeometry.E.x),
            y: round(debugGeometry.E.y)
          } : null,
          firstPrepBounceHeight: round(firstPrepHeight),
          secondPrepBounceHeight: round(secondPrepHeight),
          thirdPrepBounceHeight: round(thirdPrepHeight),
          firstPrepBounceDuration: round(firstPrepDuration),
          secondPrepBounceDuration: round(secondPrepDuration),
          thirdPrepBounceDuration: round(thirdPrepDuration),
          bounceHeightScale: NAV_BALL_BOUNCE_HEIGHT_SCALE,
          trajectoryDurationScale: round(trajectoryDurationScale),
          launchDuration: round(launchDuration),
          arcDuration: round(arcDuration),
          fallDuration: round(fallDuration),
          preScrollMotionDuration: round(preScrollMotionDuration),
          trackLengthAscent: round(track.length1),
          trackLengthArc: round(track.length2),
          trackLengthDescent: round(track.length3),
          trackLengthTotal: round(track.totalLength),
          ascentEndProgress: round(track.ascentEndProgress),
          descentStartProgress: round(track.descentStartProgress),
          firstLandingBounceHeight: round(firstLandingHeight),
          secondLandingBounceHeight: round(secondLandingHeight),
          thirdLandingBounceHeight: round(thirdLandingHeight),
          firstLandingBounceDuration: round(firstLandingDuration),
          secondLandingBounceDuration: round(secondLandingDuration),
          thirdLandingBounceDuration: round(thirdLandingDuration),
          delayBetweenImpactAndBounceMs: 0,
          impactVelocityY: round(impactVelocityY),
          upwardArcLiftNew: config.upward ? round(config.path.start.y - config.path.apex.y) : 0,
          usesCompositeTrajectory: Array.isArray(config.path.segments),
          usesEaseOutNearLanding: false,
          morphDurationNew: BALL_MORPH_DURATION
        });
        console.debug("exact landing velocity check", {
          usedEaseOutNearLanding: false,
          finalVelocity: debugFinalVelocity
        });
        console.debug("roll duration active", rollDuration);
      }

      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving");
      resetTimelineShadow();

      function markPreScrollComplete() {
        if (preScrollPrepared) {
          return;
        }

        preScrollPrepared = true;
        config.cameraMode = "pre-scrolled-freeze";
        window.scrollTo(0, config.finalScroll);
      }

      function syncPrepScroll(elapsedMs) {
        var prepScrollRaw;
        var prepScrollY;

        if (!shouldPreScrollBeforeFlight || preScrollPrepared) {
          return;
        }

        prepScrollRaw = clamp(preScrollMotionDuration > 0 ? elapsedMs / preScrollMotionDuration : 1, 0, 1);
        prepScrollY = mix(config.startScroll, config.finalScroll, easeInOutSine(prepScrollRaw));
        window.scrollTo(0, prepScrollY);

        if (prepScrollRaw >= 1) {
          preScrollPrepared = true;
          config.cameraMode = "pre-scrolled-freeze";
        }
      }

      function debugCamera(phase, raw, scrollY, screenPoint) {
        if (!DEBUG_NAV_BALL_CAMERA || cameraDebugPhase === phase) {
          return;
        }

        cameraDebugPhase = phase;
        console.table({
          phase: phase,
          targetId: targetId,
          scenario: config.upward ?
            (config.endScreen.x < config.startScreen.x ? "B left of A and above A" : "B right of A and above A") :
            (config.endScreen.x < config.startScreen.x ? "B left of A and below A" : "B right of A and below A"),
          cameraMode: config.cameraMode,
          progress: round(raw),
          initialScroll: round(config.initialScroll),
          startScroll: round(config.startScroll),
          finalScroll: round(config.finalScroll),
          currentScrollY: round(scrollY),
          Ax: round(config.startScreen.x),
          Ay: round(config.startScreen.y),
          Bx: round(config.endScreen.x),
          By: round(config.endScreen.y),
          Dx: round(config.path.geometry && config.path.geometry.D && config.path.geometry.D.x),
          Dy: round(config.path.geometry && config.path.geometry.D && config.path.geometry.D.y),
          Cx: round(config.path.geometry && config.path.geometry.C && config.path.geometry.C.x),
          Cy: round(config.path.geometry && config.path.geometry.C && config.path.geometry.C.y),
          Ex: round(config.path.geometry && config.path.geometry.E && config.path.geometry.E.x),
          Ey: round(config.path.geometry && config.path.geometry.E && config.path.geometry.E.y),
          screenX: round(screenPoint && screenPoint.x),
          screenY: round(screenPoint && screenPoint.y)
        });
      }

      function applyImpact() {
        if (impactHandled) {
          return;
        }

        impactHandled = true;
        window.scrollTo(0, config.finalScroll);
        setBallPosition(config.endScreen.x, config.endScreen.y);
        debugRenderLandingTarget(endPoint, config.finalScroll);
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
          window.history.replaceState(null, "", targetId === "landing" ? cleanUrl : "#" + targetId);
        }
      }

      function applyApproachShadow(raw) {
        var approach = clamp((raw - 0.78) / 0.22, 0, 1);

        if (endPoint.kind === "floor" || approach <= 0) {
          setTimelineShadow(0, 0.72);
          return;
        }

        setTimelineShadow(mix(0.06, 0.34, approach), mix(0.72, 1.18, approach));
      }

      function applyBounceShadow(raw, bounceIndex) {
        var liftRatio = Math.sin(Math.PI * raw);
        var compressedOpacity = bounceIndex === 1 ? 0.42 : bounceIndex === 2 ? 0.32 : 0.24;
        var airborneOpacity = bounceIndex === 1 ? 0.1 : bounceIndex === 2 ? 0.16 : 0.2;
        var compressedScale = bounceIndex === 1 ? 1.32 : bounceIndex === 2 ? 1.14 : 1.04;
        var airborneScale = bounceIndex === 1 ? 0.62 : bounceIndex === 2 ? 0.8 : 0.92;

        if (endPoint.kind === "floor") {
          setTimelineShadow(0, 0.72);
          return;
        }

        setTimelineShadow(mix(compressedOpacity, airborneOpacity, liftRatio), mix(compressedScale, airborneScale, liftRatio));
      }

      function launchPointAt(raw) {
        var geometry = config.path.geometry;
        var progress = launchProgress(raw);

        return {
          x: config.path.start.x,
          y: mix(config.path.start.y, geometry.D.y, progress)
        };
      }

      function arcPointAt(raw) {
        var geometry = config.path.geometry;
        var progress = clamp(raw, 0, 1);
        var sx = smoothstep(progress);

        return {
          x: geometry.D.x + (geometry.E.x - geometry.D.x) * sx,
          y: geometry.arcBaseY - geometry.arcHeight * 4 * progress * (1 - progress)
        };
      }

      function fallPointAt(raw) {
        var geometry = config.path.geometry;
        var progress = fallProgress(raw);

        return {
          x: config.path.end.x,
          y: mix(geometry.E.y, config.path.end.y, progress)
        };
      }

      function scrollDuringFall(raw) {
        if (!config.downward) {
          return config.finalScroll;
        }

        return mix(config.startScroll, config.finalScroll, fallProgress(raw));
      }

      function logTimingSummary() {
        if (!DEBUG_NAV_BALL_TIMING || timingLogged) {
          return;
        }

        timingLogged = true;
        console.table({
          targetId: targetId,
          prepBounceTotalDuration: round(prep3End),
          launchDuration: round(launchDuration),
          arcDuration: round(arcDuration),
          fallDuration: round(fallDuration),
          mainTrajectoryDuration: round(launchDuration + arcDuration + fallDuration),
          landingBounceTotalDuration: round(firstLandingDuration + secondLandingDuration + thirdLandingDuration),
          scrollDuration: round(preScrollMotionDuration),
          rollDuration: round(rollDuration),
          totalUntilRollStarts: round(rebound3End),
          totalIncludingRoll: round(rollEnd)
        });
      }

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        var elapsed = now - startTime;
        var raw = 0;
        var point;
        var screen;
        var actualScroll;
        var bouncePoint;
        var rollRaw;
        var easedRoll;
        var x;
        var rotation;

        if (elapsed < prep1End) {
          raw = elapsed / firstPrepDuration;
          bouncePoint = evaluateBounce(config.startScreen.x, config.startScreen.y, firstPrepHeight, elapsed, firstPrepDuration);
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(bouncePoint.x, bouncePoint.y);
          applyBounceScale(raw, 0.68);
          syncPrepScroll(elapsed);
          setTimelineShadow(0, 0.72);
        } else if (elapsed < prep2End) {
          raw = (elapsed - prep1End) / secondPrepDuration;
          bouncePoint = evaluateBounce(config.startScreen.x, config.startScreen.y, secondPrepHeight, elapsed - prep1End, secondPrepDuration);
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(bouncePoint.x, bouncePoint.y);
          applyBounceScale(raw, 0.78);
          syncPrepScroll(elapsed);
          setTimelineShadow(0, 0.72);
        } else if (elapsed < prep3End) {
          raw = (elapsed - prep2End) / thirdPrepDuration;
          bouncePoint = evaluateBounce(config.startScreen.x, config.startScreen.y, thirdPrepHeight, elapsed - prep2End, thirdPrepDuration);
          setState(STATES.BALL_TAKEOFF);
          ball.classList.add("is-launching", "is-lifting");
          setBallPosition(bouncePoint.x, bouncePoint.y);
          applyBounceScale(raw, 0.9);
          syncPrepScroll(elapsed);
          setTimelineShadow(0, 0.72);
        } else if (elapsed < launchEnd) {
          markPreScrollComplete();
          raw = (elapsed - prep3End) / launchDuration;
          point = launchPointAt(raw);
          actualScroll = config.downward ? config.startScroll : config.finalScroll;
          screen = point;

          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting", "is-landing", "is-landed", "is-arrived");
          ball.classList.add("is-flying");
          window.scrollTo(0, actualScroll);
          setBallPosition(screen.x, screen.y);
          setBallScale(1, 1);
          debugRenderLandingTarget(endPoint, config.finalScroll);
          setTimelineShadow(0, 0.72);
          debugCamera("main-flight-launch", raw, actualScroll, screen);
        } else if (elapsed < arcEnd) {
          raw = (elapsed - launchEnd) / arcDuration;
          point = arcPointAt(raw);
          actualScroll = config.downward ? config.startScroll : config.finalScroll;
          screen = point;

          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting", "is-landing", "is-landed", "is-arrived");
          ball.classList.add("is-flying");
          window.scrollTo(0, actualScroll);
          setBallPosition(screen.x, screen.y);
          setBallScale(1, 1);
          debugRenderLandingTarget(endPoint, config.finalScroll);
          setTimelineShadow(0, 0.72);
          debugCamera("main-flight-arc", raw, actualScroll, screen);
        } else if (elapsed < fallEnd) {
          raw = (elapsed - arcEnd) / fallDuration;
          point = fallPointAt(raw);
          actualScroll = scrollDuringFall(raw);
          screen = point;

          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-launching", "is-lifting", "is-landing", "is-landed", "is-arrived");
          ball.classList.add("is-flying");
          window.scrollTo(0, actualScroll);
          setBallPosition(screen.x, screen.y);
          setBallScale(0.985, 1.025);
          debugRenderLandingTarget(endPoint, config.finalScroll);
          applyApproachShadow(0.78 + 0.22 * fallProgress(raw));
          debugCamera("main-flight-descent", raw, actualScroll, screen);
        } else {
          applyImpact();

          if (elapsed < rebound1End) {
            raw = (elapsed - fallEnd) / firstLandingDuration;
            bouncePoint = evaluateBounce(config.endScreen.x, config.endScreen.y, firstLandingHeight, elapsed - fallEnd, firstLandingDuration);
            setBallPosition(bouncePoint.x, bouncePoint.y);
            applyBounceScale(raw, 1);
            applyBounceShadow(raw, 1);
          } else if (elapsed < rebound2End) {
            raw = (elapsed - rebound1End) / secondLandingDuration;
            bouncePoint = evaluateBounce(config.endScreen.x, config.endScreen.y, secondLandingHeight, elapsed - rebound1End, secondLandingDuration);
            setBallPosition(bouncePoint.x, bouncePoint.y);
            applyBounceScale(raw, 0.72);
            applyBounceShadow(raw, 2);
          } else if (elapsed < rebound3End) {
            raw = (elapsed - rebound2End) / thirdLandingDuration;
            bouncePoint = evaluateBounce(config.endScreen.x, config.endScreen.y, thirdLandingHeight, elapsed - rebound2End, thirdLandingDuration);
            setBallPosition(bouncePoint.x, bouncePoint.y);
            applyBounceScale(raw, 0.48);
            applyBounceShadow(raw, 3);
          } else if (elapsed < rollEnd) {
            logTimingSummary();

            if (!rollStarted) {
              rollStarted = true;
              setState(STATES.BALL_ROLLING_OUT);
              ball.classList.remove("is-arrived", "is-landing", "is-landed");
              ball.classList.add("is-rolling");
            }

            rollRaw = (elapsed - rebound3End) / rollDuration;
            easedRoll = easeRollOut(rollRaw);
            x = mix(rollStartX, rollEndX, easedRoll);
            rotation = rollDirection * (Math.abs(x - rollStartX) / rollCircumference) * 360;

            ball.style.setProperty("--ball-rotation", rotation + "deg");
            setBallPosition(x, config.endScreen.y);
            setBallScale(1, 1);

            if (endPoint.kind === "floor") {
              setTimelineShadow(0, 0.72);
            } else {
              setTimelineShadow(mix(0.3, 0, rollRaw), mix(1.08, 0.72, rollRaw));
            }
          } else {
            restorePlusAfterRoll(token, targetId);
            return;
          }
        }

        requestBallFrame(frame, token);
      }

      requestBallFrame(frame, token);
    }

    function chooseDestination(button) {
      if (isTravelling || isProjectMode) {
        return;
      }

      var targetId = button.getAttribute("data-nav-target");
      var target = document.getElementById(targetId);
      var label = button.textContent.trim();
      var buttonRect = button.getBoundingClientRect();
      var startX = buttonRect.left + buttonRect.width / 2;
      var startY = buttonRect.top + buttonRect.height / 2;
      var scrollY = window.scrollY || window.pageYOffset;
      var delayForLandingAnimation = shouldDelayForLandingAnimation(targetId);
      var morphDuration = reducedMotion.matches ? 1 : delayForLandingAnimation ? 1500 : BALL_MORPH_DURATION;
      var landingInterruptPromise = null;
      var startPoint = {
        element: button,
        section: "menu",
        side: "center",
        kind: "navi-circle",
        x: startX,
        y: startY + scrollY + ballRadius(),
        width: buttonRect.width,
        height: buttonRect.height
      };

      if (!target) {
        return;
      }

      var token = beginBallAnimation(targetId);
      var isHomeReturn = targetId === "landing";
      var homeTarget = null;
      var debugEndPoint = isHomeReturn ? null : targetPlatformFor(targetId);
      var debugConfig = debugEndPoint ? createFlightConfig(startPoint, debugEndPoint, targetId, scrollY) : null;
      debugRenderBase();
      debugOverlay.marker("ball start", startX, startY, "rgb(132, 0, 255)");
      if (isHomeReturn) {
        homeTarget = readPlusGeometry();
        debugOverlay.clearTrajectory();
        debugOverlay.clearOutline();
        debugOverlay.marker("landing target", homeTarget.measuredPlusCentreX, homeTarget.measuredPlusCentreY, "rgb(220, 0, 0)");
      } else {
        debugRenderLandingTarget(debugEndPoint, debugConfig.finalScroll);
        debugRenderTrajectory(startPoint, debugEndPoint, targetId, scrollY);
      }
      debugLogGeometry({
        selectedNaviCircle: label,
        selectedNaviCircleCentreX: startX,
        selectedNaviCircleCentreY: startY,
        ballStartX: startX,
        ballStartY: startY,
        landingTargetX: isHomeReturn ? homeTarget.measuredPlusCentreX : debugConfig.endScreen.x,
        landingTargetY: isHomeReturn ? homeTarget.measuredPlusCentreY : debugConfig.endScreen.y
      });

      isTravelling = true;
      setState(STATES.NAVI_SELECTED);
      nav.classList.remove("is-open");
      nav.classList.add("is-choosing");
      button.parentElement.classList.add("is-selected");
      items.forEach(function (item) {
        item.disabled = true;
      });
      setMenuA11y(false);

      setBallPosition(startX, startY);
      ball.style.opacity = "";
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
      ball.style.setProperty("--nav-ball-form-duration", morphDuration + "ms");
      ballLabel.textContent = "";
      resetBallClasses();
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

        waitForLandingAnimationBeforeFlight(targetId, landingInterruptPromise).then(function () {
          if (!isCurrentAnimation(token)) {
            return;
          }

          flyBall(startPoint, targetId, token);
        }, function () {
          if (!isCurrentAnimation(token)) {
            return;
          }

          flyBall(startPoint, targetId, token);
        });
      }, morphDuration, token);
    }

    core.addEventListener("click", function (event) {
      if (isProjectMode) {
        beginProjectClose();
        document.dispatchEvent(new CustomEvent("harini:project-close-request"));
        return;
      }

      if (isMobileTapMode()) {
        event.preventDefault();
      }

      if (canUseHoverNav() && isOpen) {
        return;
      }

      if (!isOpen) {
        notifyLandingPlusOpened();
      }

      if ((isMobileViewport() || isTabletLandscapeTouchViewport()) && !isOpen) {
        preparePhoneMenuOpen();
        return;
      }

      setOpen(!isOpen);
    });

    nav.addEventListener("pointerenter", function () {
      if (canUseHoverNav() && !isProjectMode) {
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
      if (!nav.contains(event.target) && isOpen) {
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
    debugRenderBase();
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
