(function () {
  const DEBUG_NAV_GEOMETRY = true;

  var SECTION_IDS = ["landing", "about", "work", "archive", "contact"];
  var SECTION_INDEX = {
    landing: 0,
    about: 1,
    work: 2,
    archive: 3,
    contact: 4
  };
  var FLIGHT_DURATION_MULTIPLIER = 1.32;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var isOpen = false;
    var isTravelling = false;
    var isProjectMode = false;
    var closeOnBlurTimer = 0;
    var resetTimer = 0;
    var sectionFrame = 0;
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

        callback(now);
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

    function cancelBallAnimation() {
      activeAnimationToken += 1;
      clearBallTimersAndFrames();
    }

    function beginBallAnimation(targetId) {
      cancelBallAnimation();
      activeAnimationToken += 1;
      debugNavBall("nav ball animation start", targetId);
      return activeAnimationToken;
    }

    function hideTravelBallImmediately() {
      resetBallClasses();
      ball.classList.remove("is-second-bounce");
      ball.style.opacity = "0";
      ball.style.setProperty("--ball-lift", "0px");
      ball.style.setProperty("--ball-scale-x", "1");
      ball.style.setProperty("--ball-scale-y", "1");
      ball.style.setProperty("--ball-rotation", "0deg");
    }

    function resetBallState(finalState) {
      cancelBallAnimation();
      hideTravelBallImmediately();
      ballLabel.textContent = "";
      isTravelling = false;
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

      config.path.apex = fitControlPointInsideBounds({
        x: mix(config.path.apex.x, laneX, controlBias * 0.66),
        y: Math.min(config.path.apex.y, topClear)
      }, config.bounds);

      rebuildPhasedPathControls(config.path, config);
    }

    function adjustPathForObstacles(config) {
      var obstacles = getObstacleRects(config.endPoint.element);
      var attempts = 0;

      config.obstacles = obstacles;

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
        "is-rebounding",
        "is-second-bounce",
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
        debugOverlay.hideMarker("apex point");
        debugOverlay.hideMarker("vertical approach start");
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

    function clearChoiceState(finalState) {
      nav.classList.remove("is-open", "is-choosing", "is-travelling");
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

      nav.classList.remove("is-open", "is-choosing", "is-travelling");
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

    function contactFloor() {
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

      return {
        element: document.getElementById("contact"),
        section: "contact",
        side: "right",
        kind: "floor",
        x: window.innerWidth * 0.78,
        y: maxScroll + window.innerHeight,
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

      if (point.kind === "floor") {
        return maxScroll;
      }

      return clamp(point.y - window.innerHeight * 0.48, 0, maxScroll);
    }

    function cubicPointAt(t, path) {
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

    function resolveFinalScroll(endPoint, startScreen, downward, targetId, bounds) {
      var radius = ballRadius();
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var desiredCenterY = 0;

      if (endPoint.kind === "floor") {
        return maxScroll;
      }

      if (targetId === "landing") {
        desiredCenterY = clamp(window.innerHeight * 0.42, bounds.minY, bounds.maxY);
      } else if (downward) {
        desiredCenterY = clamp(Math.max(startScreen.y + 48, window.innerHeight * 0.7), bounds.minY, bounds.maxY);
      } else {
        desiredCenterY = clamp(Math.min(startScreen.y - 54, window.innerHeight * 0.42), bounds.minY, bounds.maxY);
      }

      return clamp(endPoint.y - (desiredCenterY + radius), 0, maxScroll);
    }

    function rebuildPhasedPathControls(path, config) {
      var bounds = config.bounds;
      var start = path.start;
      var apex = path.apex;
      var verticalStart = path.verticalApproachStart;
      var landing = path.end;
      var dx = landing.x - start.x;
      var ascentLift = Math.max(90, start.y - apex.y);
      var verticalHeight = Math.max(1, landing.y - verticalStart.y);
      var isRightLanding = path.side === "right";

      path.ascent = {
        start: start,
        controlA: fitControlPointInsideBounds({
          x: start.x + dx * (isRightLanding ? 0.015 : 0.055),
          y: start.y - clamp(ascentLift * (isRightLanding ? 0.72 : 0.58), 92, isRightLanding ? 320 : 250)
        }, bounds),
        controlB: fitControlPointInsideBounds({
          x: mix(start.x, apex.x, isRightLanding ? 0.3 : 0.56),
          y: apex.y
        }, bounds),
        end: apex
      };

      path.descent = {
        start: apex,
        controlA: fitControlPointInsideBounds({
          x: mix(apex.x, verticalStart.x, isRightLanding ? 0.46 : 0.22),
          y: apex.y
        }, bounds),
        controlB: fitControlPointInsideBounds({
          x: verticalStart.x,
          y: mix(apex.y, verticalStart.y, isRightLanding ? 0.28 : 0.68)
        }, bounds),
        end: verticalStart
      };

      path.vertical = {
        start: verticalStart,
        controlA: {
          x: landing.x,
          y: verticalStart.y + verticalHeight * 0.34
        },
        controlB: {
          x: landing.x,
          y: landing.y - verticalHeight * 0.16
        },
        end: landing
      };
    }

    function createSmoothFlightPath(startScreen, endScreen, config) {
      var bounds = config.bounds;
      var start = fitControlPointInsideBounds(startScreen, bounds);
      var landing = config.targetId === "contact" ? {
        x: clamp(endScreen.x, bounds.minX, bounds.maxX),
        y: bounds.floorY
      } : fitControlPointInsideBounds(endScreen, bounds);
      var dx = landing.x - start.x;
      var distanceX = Math.abs(dx);
      var isRightLanding = config.horizontalDirection > 0;
      var verticalApproachHeight = isRightLanding ? clamp(window.innerHeight * 0.18, 120, 190) : clamp(window.innerHeight * 0.16, 90, 180);
      var verticalApproachStart = fitControlPointInsideBounds({
        x: landing.x,
        y: landing.y - verticalApproachHeight
      }, bounds);
      var arcHeight = isRightLanding ? clamp(Math.max(window.innerHeight * 0.48, distanceX * 0.5, Math.abs(landing.y - start.y) * 0.48), 280, 560) : clamp(Math.max(window.innerHeight * 0.38, distanceX * 0.38, Math.abs(landing.y - start.y) * 0.42), 230, 460);
      var apexY = Math.max(bounds.minY + 12, Math.min(start.y, verticalApproachStart.y, landing.y) - arcHeight);
      var apexX = clamp(mix(start.x, landing.x, isRightLanding && distanceX > 40 ? 0.24 : distanceX > 40 ? 0.58 : 0.5), bounds.minX, bounds.maxX);
      var path = {
        start: start,
        apex: {
          x: apexX,
          y: apexY
        },
        verticalApproachStart: verticalApproachStart,
        end: landing,
        side: isRightLanding ? "right" : "other",
        phaseAEnd: isRightLanding ? 0.34 : 0.44,
        phaseBEnd: isRightLanding ? 0.82 : 0.84
      };

      rebuildPhasedPathControls(path, config);
      return path;
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
      var finalScroll = resolveFinalScroll(endPoint, startScreen, downward, targetId, bounds);
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
        scrollDelay: upward ? 0 : targetId === "contact" ? 0.04 : 0.08,
        hasShadow: endPoint.kind !== "floor",
        emergencyClampLogged: false,
        path: null
      };

      config.path = createSmoothFlightPath(startScreen, endScreen, config);
      adjustPathForObstacles(config);
      return config;
    }

    function flightPointAt(raw, config) {
      var path = config.path;

      if (raw < path.phaseAEnd) {
        return cubicPointAt(easeInOut(raw / path.phaseAEnd), path.ascent);
      }

      if (raw < path.phaseBEnd) {
        return cubicPointAt(easeInOut((raw - path.phaseAEnd) / (path.phaseBEnd - path.phaseAEnd)), path.descent);
      }

      return cubicPointAt(clamp((raw - path.phaseBEnd) / (1 - path.phaseBEnd), 0, 1), path.vertical);
    }

    function flightScrollAt(raw, config) {
      var progress = 0;

      if (config.upward) {
        progress = easeInOut(raw);
      } else if (raw > config.scrollDelay) {
        progress = easeInOut((raw - config.scrollDelay) / (1 - config.scrollDelay));
      }

      return mix(config.startScroll, config.finalScroll, clamp(progress, 0, 1));
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
      debugOverlay.marker("apex point", config.path.apex.x, config.path.apex.y, "rgb(194, 0, 160)");
      debugOverlay.marker("vertical approach start", config.path.verticalApproachStart.x, config.path.verticalApproachStart.y, "rgb(0, 98, 190)");
      debugOverlay.marker("landing point", config.path.end.x, config.path.end.y, "rgb(210, 0, 0)");
    }

    function restorePlus(token, targetId) {
      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      setState(STATES.PLUS_RESTORED);
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);
      document.documentElement.classList.remove("is-ball-animating");

      resetTimer = setBallTimeout(function () {
        debugNavBall("nav ball animation end", targetId);
        resetBallState(STATES.PLUS_IDLE);
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, reducedMotion.matches ? 1 : 260);
    }

    function rollOut(targetId, landingPoint, token) {
      var direction = rollDirectionFor(targetId);
      var startX = landingPoint.x;
      var endX = direction < 0 ? -ballRadius() - 18 : window.innerWidth + ballRadius() + 18;
      var y = landingPoint.screenY;
      var duration = reducedMotion.matches ? 1 : 860;
      var circumference = Math.max(1, Math.PI * ballRadius() * 2);
      var startTime = 0;

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      setState(STATES.BALL_ROLLING_OUT);
      ball.classList.remove("is-arrived", "is-landing", "is-landed");
      ball.classList.add("is-rolling");

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var eased = easeInOut(raw);
        var x = mix(startX, endX, eased);
        var rotation = direction * (Math.abs(x - startX) / circumference) * 360;

        ball.style.setProperty("--ball-rotation", rotation + "deg");
        setBallPosition(x, y);

        if (raw < 1) {
          requestBallFrame(frame, token);
          return;
        }

        restorePlus(token, targetId);
      }

      requestBallFrame(frame, token);
    }

    function runBounce(screen, height, duration, token, secondBounce, callback) {
      var startTime = 0;

      ball.classList.remove("is-rebounding", "is-second-bounce");
      void ball.offsetWidth;
      ball.style.setProperty("--bounce-duration", duration + "ms");
      ball.classList.add("is-rebounding");

      if (secondBounce) {
        ball.classList.add("is-second-bounce");
      }

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var bounce = Math.sin(Math.PI * raw) * height;

        setBallPosition(screen.x, screen.y - bounce);

        if (raw < 1) {
          requestBallFrame(frame, token);
          return;
        }

        setBallPosition(screen.x, screen.y);
        ball.classList.remove("is-rebounding", "is-second-bounce");
        callback();
      }

      requestBallFrame(frame, token);
    }

    function runLaunchBounce(screen, height, duration, token, callback) {
      var startTime = 0;

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var bounce = Math.sin(Math.PI * raw) * height;

        setBallPosition(screen.x, screen.y - bounce);

        if (raw < 1) {
          requestBallFrame(frame, token);
          return;
        }

        setBallPosition(screen.x, screen.y);
        callback();
      }

      requestBallFrame(frame, token);
    }

    function upwardLaunchBounce(config, token, callback) {
      if (reducedMotion.matches || !config.upward) {
        callback();
        return;
      }

      setState(STATES.BALL_TAKEOFF);
      ball.classList.add("is-launching", "is-lifting");

      runLaunchBounce(config.startScreen, clamp(window.innerHeight * 0.014, 8, 12), clamp(window.innerHeight * 0.24, 160, 220), token, function () {
        runLaunchBounce(config.startScreen, clamp(window.innerHeight * 0.048, 24, 42), clamp(window.innerHeight * 0.4, 260, 360), token, function () {
          ball.classList.remove("is-launching", "is-lifting");
          callback();
        });
      });
    }

    function landingBounce(targetId, screen, token, callback) {
      if (reducedMotion.matches) {
        callback();
        return;
      }

      var firstHeight = clamp(window.innerHeight * 0.03, 18, 28);
      var secondHeight = clamp(firstHeight * 0.36, 6, 12);
      var firstDuration = clamp(window.innerHeight * 0.38, 260, 360);
      var secondDuration = clamp(window.innerHeight * 0.26, 180, 260);

      runBounce(screen, firstHeight, firstDuration, token, false, function () {
        runBounce(screen, secondHeight, secondDuration, token, true, callback);
      });
    }

    function finishTravel(targetId, config, token) {
      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      var endPoint = config.endPoint;
      var endScroll = config.finalScroll;
      var screen = config.endScreen;
      var target = document.getElementById(targetId);
      var cleanUrl = window.location.pathname + window.location.search;

      window.scrollTo(0, endScroll);
      setBallPosition(screen.x, screen.y);
      debugRenderLandingTarget(endPoint, endScroll);
      setState(STATES.BALL_LANDING);
      ball.classList.remove("is-moving", "is-flying", "is-lifting");

      if (endPoint.kind === "floor") {
        ball.classList.add("is-contact-landing", "is-arrived");
      } else {
        ball.classList.add("is-landing", "is-landed", "is-arrived");
      }

      if (target) {
        target.focus({ preventScroll: true });
      }

      updateCurrentSection(targetId, true);

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", targetId === "landing" ? cleanUrl : "#" + targetId);
      }

      landingBounce(targetId, screen, token, function () {
        rollOut(targetId, {
          x: screen.x,
          screenY: screen.y
        }, token);
      });
    }

    function flyBall(startPoint, targetId, token) {
      var endPoint = targetPlatformFor(targetId);
      var startScroll = window.scrollY || window.pageYOffset;
      var config = createFlightConfig(startPoint, endPoint, targetId, startScroll);
      var startTime = 0;

      if (!isCurrentAnimation(token)) {
        debugNavBall("stale nav ball frame cancelled");
        return;
      }

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        window.scrollTo(0, config.finalScroll);
        finishTravel(targetId, config, token);
        return;
      }

      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving");

      function frame(now) {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / config.duration, 0, 1);
        var point = flightPointAt(raw, config);
        var actualScroll = flightScrollAt(raw, config);
        var screen = emergencyClampToViewport(point, config, raw);

        window.scrollTo(0, actualScroll);
        setBallPosition(screen.x, screen.y);
        debugRenderLandingTarget(endPoint, config.finalScroll);

        if (config.hasShadow && raw >= 0.85) {
          setState(STATES.BALL_LANDING);
          ball.classList.remove("is-flying");
          ball.classList.add("is-landing");
        } else {
          ball.classList.remove("is-landing", "is-landed", "is-arrived");
        }

        if (raw < 1) {
          requestBallFrame(frame, token);
          return;
        }

        finishTravel(targetId, config, token);
      }

      function beginFlightFrames() {
        if (!isCurrentAnimation(token)) {
          debugNavBall("stale nav ball frame cancelled");
          return;
        }

        setState(STATES.BALL_FLYING);
        ball.classList.remove("is-launching", "is-lifting");
        ball.classList.add("is-flying");
        requestBallFrame(frame, token);
      }

      if (config.upward) {
        upwardLaunchBounce(config, token, beginFlightFrames);
        return;
      }

      beginFlightFrames();
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
      var debugEndPoint = targetPlatformFor(targetId);
      var debugConfig = createFlightConfig(startPoint, debugEndPoint, targetId, scrollY);
      debugRenderBase();
      debugOverlay.marker("ball start", startX, startY, "rgb(132, 0, 255)");
      debugRenderLandingTarget(debugEndPoint, debugConfig.finalScroll);
      debugRenderTrajectory(startPoint, debugEndPoint, targetId, scrollY);
      debugLogGeometry({
        selectedNaviCircle: label,
        selectedNaviCircleCentreX: startX,
        selectedNaviCircleCentreY: startY,
        ballStartX: startX,
        ballStartY: startY,
        landingTargetX: debugConfig.endScreen.x,
        landingTargetY: debugConfig.endScreen.y
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
      ballLabel.textContent = "";
      resetBallClasses();
      ball.classList.add("is-visible", "is-forming");

      setBallTimeout(function () {
        setState(STATES.NAVI_TEXT_VANISHING);
      }, reducedMotion.matches ? 1 : 80, token);

      setBallTimeout(function () {
        setState(STATES.NAVI_TO_BALL_MORPH);
      }, reducedMotion.matches ? 1 : 280, token);

      setBallTimeout(function () {
        nav.classList.add("is-travelling");
        setState(STATES.BALL_READY);
        ball.classList.remove("is-forming");
        ball.classList.add("is-ready");
        flyBall(startPoint, targetId, token);
      }, reducedMotion.matches ? 1 : 1320, token);
    }

    core.addEventListener("click", function () {
      if (isProjectMode) {
        beginProjectClose();
        document.dispatchEvent(new CustomEvent("harini:project-close-request"));
        return;
      }

      if (canHover.matches && isOpen) {
        return;
      }

      setOpen(!isOpen);
    });

    nav.addEventListener("pointerenter", function () {
      if (canHover.matches && !isProjectMode) {
        setOpen(true);
      }
    });

    nav.addEventListener("pointerleave", function () {
      if (canHover.matches && !nav.contains(document.activeElement)) {
        setOpen(false);
      }
    });

    nav.addEventListener("focusout", function () {
      window.clearTimeout(closeOnBlurTimer);
      closeOnBlurTimer = window.setTimeout(function () {
        if (isOpen && !nav.contains(document.activeElement)) {
          setOpen(false);
        }
      }, 0);
    });

    items.forEach(function (item) {
      item.addEventListener("pointerenter", function () {
        if (!isTravelling) {
          setState(STATES.NAVI_HOVERED);
        }
      });

      item.addEventListener("click", function () {
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
        updateSpokeGeometry();
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
