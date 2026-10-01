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
  var LANDING_BOUNCE_HEIGHT = 14;
  var FLIGHT_DURATION_MULTIPLIER = 1.22;

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
    var debugOverlay = createDebugOverlay();

    items.forEach(function (item) {
      var original = item.getAttribute("data-nav-target");
      item.dataset.navOriginalTarget = original;
      item.dataset.navOriginalLabel = item.textContent.trim();
      item.setAttribute("aria-label", "go to " + original);
    });

    function originalTarget(button) {
      return button.dataset.navOriginalTarget || button.getAttribute("data-nav-target");
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
      polyline.setAttribute("stroke", "rgba(255, 129, 0, 0.92)");
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

    function setMenuA11y(open) {
      core.setAttribute("aria-expanded", String(open));
      core.setAttribute("aria-label", isProjectMode ? "close project" : open ? "close navigation" : "open navigation");
      menu.setAttribute("aria-hidden", String(!open));
      items.forEach(function (item) {
        item.tabIndex = open ? 0 : -1;
      });
    }

    function getSafeViewportBounds() {
      var radius = ballRadius();
      var margin = Math.max(radius + 16, 16);

      return {
        safeMinX: margin,
        safeMaxX: window.innerWidth - margin,
        safeMinY: margin,
        safeMaxY: window.innerHeight - margin
      };
    }

    function clampToViewport(point) {
      var bounds = getSafeViewportBounds();

      return {
        x: clamp(point.x, bounds.safeMinX, bounds.safeMaxX),
        y: clamp(point.y, bounds.safeMinY, bounds.safeMaxY)
      };
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

    function debugRenderLandingTarget(platform) {
      if (!DEBUG_NAV_GEOMETRY || !platform) {
        return;
      }

      var finalScroll = targetScrollFor(platform);
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
        "is-contact-landing"
      );
    }

    function updateSpokeGeometry() {
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

        line.setAttribute("x1", originX);
        line.setAttribute("y1", originY);
        line.setAttribute("x2", point.x);
        line.setAttribute("y2", point.y);
        line.setAttribute("vector-effect", "non-scaling-stroke");
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
        debugOverlay.hideMarker("landing target");
        window.requestAnimationFrame(updateSpokeGeometry);
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
      if (isOpen) {
        isOpen = false;
        nav.classList.remove("is-open", "is-choosing", "is-travelling");
        setMenuA11y(false);
      }

      isProjectMode = true;
      nav.classList.add("is-project-close");
      setState(STATES.PLUS_IDLE);
      setMenuA11y(false);
    }

    function exitProjectMode() {
      isProjectMode = false;
      nav.classList.remove("is-project-close");
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

    function createFlightConfig(startPoint, endPoint, targetId, startScroll) {
      var fromIndex = sectionIndex(currentSection || detectCurrentSection());
      var toIndex = sectionIndex(targetId);
      var upward = toIndex < fromIndex;
      var side = targetSideFor(targetId);
      var horizontalDirection = side === "right" ? 1 : side === "left" ? -1 : endPoint.x >= startPoint.x ? 1 : -1;
      var distanceX = Math.abs(endPoint.x - startPoint.x);
      var distanceY = Math.abs(endPoint.y - startPoint.y);
      var pathDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      var lift = upward ? clamp(pathDistance * 0.16, 160, 280) : clamp(pathDistance * 0.08, 72, 170);
      var safeBounds = getSafeViewportBounds();
      var controlX = mix(startPoint.x, endPoint.x, upward ? 0.42 : 0.5) + horizontalDirection * clamp(window.innerWidth * 0.08, 42, 130);
      var controlY = Math.min(startPoint.y, endPoint.y) - lift;
      var finalScroll = targetScrollFor(endPoint);
      var duration = reducedMotion.matches ? 1 : clamp((pathDistance * 0.34 + 820) * FLIGHT_DURATION_MULTIPLIER, 1280, 2680);
      var denominator = startPoint.y - 2 * controlY + endPoint.y;
      var peakT = denominator === 0 ? 0.38 : clamp((startPoint.y - controlY) / denominator, 0.22, 0.58);

      controlX = clamp(controlX, safeBounds.safeMinX, safeBounds.safeMaxX);

      if (targetId === "contact") {
        controlY = Math.min(startPoint.y, endPoint.y) - clamp(pathDistance * 0.05, 52, 110);
        peakT = upward ? 0.32 : 0.4;
      }

      if (targetId === "landing") {
        controlY = Math.min(startPoint.y, endPoint.y) - clamp(pathDistance * 0.12, 100, 220);
        peakT = upward ? 0.2 : 0.36;
      }

      return {
        targetId: targetId,
        startPoint: startPoint,
        endPoint: endPoint,
        startScroll: startScroll,
        finalScroll: finalScroll,
        control: {
          x: controlX,
          y: controlY
        },
        upward: upward,
        duration: duration,
        scrollDelay: upward ? 0 : peakT,
        hasShadow: endPoint.kind !== "floor"
      };
    }

    function flightPointAt(raw, config) {
      var eased = easeInOut(raw);
      var inverse = 1 - eased;
      var startPoint = config.startPoint;
      var endPoint = config.endPoint;
      var control = config.control;

      return {
        x: inverse * inverse * startPoint.x + 2 * inverse * eased * control.x + eased * eased * endPoint.x,
        y: inverse * inverse * startPoint.y + 2 * inverse * eased * control.y + eased * eased * endPoint.y
      };
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

      for (var step = 0; step <= 36; step += 1) {
        var raw = step / 36;
        var point = flightPointAt(raw, config);
        var actualScroll = flightScrollAt(raw, config);
        points.push(clampToViewport(documentPointToScreen(point, actualScroll)));
      }

      debugOverlay.trajectory(points);
    }

    function restorePlus() {
      setState(STATES.PLUS_RESTORED);
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);
      document.documentElement.classList.remove("is-ball-animating");

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        resetBallClasses();
        ballLabel.textContent = "";
        setState(STATES.PLUS_IDLE);
        updateCurrentSection(detectCurrentSection(), true);
      }, reducedMotion.matches ? 1 : 260);
    }

    function rollOut(targetId, landingPoint) {
      var direction = rollDirectionFor(targetId);
      var startX = landingPoint.x;
      var endX = direction < 0 ? -ballRadius() - 18 : window.innerWidth + ballRadius() + 18;
      var y = landingPoint.screenY;
      var duration = reducedMotion.matches ? 1 : 860;
      var startTime = 0;

      setState(STATES.BALL_ROLLING_OUT);
      ball.classList.remove("is-arrived", "is-landing", "is-landed");
      ball.classList.add("is-rolling");

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var eased = easeInOut(raw);

        setBallPosition(mix(startX, endX, eased), y);

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        restorePlus();
      }

      window.requestAnimationFrame(frame);
    }

    function landingBounce(targetId, screen, callback) {
      if (reducedMotion.matches || targetId === "contact") {
        callback();
        return;
      }

      var duration = 320;
      var startTime = 0;

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var bounce = Math.sin(Math.PI * raw) * LANDING_BOUNCE_HEIGHT;

        setBallPosition(screen.x, screen.y - bounce);

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        setBallPosition(screen.x, screen.y);
        callback();
      }

      window.requestAnimationFrame(frame);
    }

    function finishTravel(targetId, endPoint) {
      var endScroll = targetScrollFor(endPoint);
      var screen = clampToViewport(documentPointToScreen(endPoint, endScroll));
      var target = document.getElementById(targetId);
      var cleanUrl = window.location.pathname + window.location.search;

      window.scrollTo(0, endScroll);
      setBallPosition(screen.x, screen.y);
      debugRenderLandingTarget(endPoint);
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

      landingBounce(targetId, screen, function () {
        window.setTimeout(function () {
          rollOut(targetId, {
            x: screen.x,
            screenY: screen.y
          });
        }, reducedMotion.matches ? 1 : 160);
      });
    }

    function flyBall(startPoint, targetId) {
      var endPoint = targetPlatformFor(targetId);
      var startScroll = window.scrollY || window.pageYOffset;
      var config = createFlightConfig(startPoint, endPoint, targetId, startScroll);
      var startTime = 0;

      document.documentElement.classList.add("is-ball-animating");

      if (reducedMotion.matches) {
        window.scrollTo(0, config.finalScroll);
        finishTravel(targetId, endPoint);
        return;
      }

      setState(STATES.BALL_FLYING);
      ball.classList.remove("is-forming", "is-landed", "is-ready", "is-landing", "is-contact-landing");
      ball.classList.add("is-visible", "is-moving", "is-flying");

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / config.duration, 0, 1);
        var point = flightPointAt(raw, config);
        var actualScroll = flightScrollAt(raw, config);
        var screen = clampToViewport(documentPointToScreen(point, actualScroll));

        window.scrollTo(0, actualScroll);
        setBallPosition(screen.x, screen.y);
        debugRenderLandingTarget(endPoint);

        if (config.hasShadow && raw >= 0.85) {
          setState(STATES.BALL_LANDING);
          ball.classList.remove("is-flying");
          ball.classList.add("is-landing");
        } else {
          ball.classList.remove("is-landing", "is-landed", "is-arrived");
        }

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        finishTravel(targetId, endPoint);
      }

      window.requestAnimationFrame(frame);
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

      var debugEndPoint = targetPlatformFor(targetId);
      debugRenderBase();
      debugOverlay.marker("ball start", startX, startY, "rgb(132, 0, 255)");
      debugRenderLandingTarget(debugEndPoint);
      debugRenderTrajectory(startPoint, debugEndPoint, targetId, scrollY);
      debugLogGeometry({
        selectedNaviCircle: label,
        selectedNaviCircleCentreX: startX,
        selectedNaviCircleCentreY: startY,
        ballStartX: startX,
        ballStartY: startY,
        landingTargetX: debugEndPoint.x,
        landingTargetY: debugEndPoint.y - targetScrollFor(debugEndPoint)
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
      ballLabel.textContent = "";
      resetBallClasses();
      ball.classList.add("is-visible", "is-forming");

      window.setTimeout(function () {
        setState(STATES.NAVI_TEXT_VANISHING);
      }, reducedMotion.matches ? 1 : 80);

      window.setTimeout(function () {
        setState(STATES.NAVI_TO_BALL_MORPH);
      }, reducedMotion.matches ? 1 : 280);

      window.setTimeout(function () {
        nav.classList.add("is-travelling");
        setState(STATES.BALL_READY);
        ball.classList.remove("is-forming");
        ball.classList.add("is-ready");
        flyBall(startPoint, targetId);
      }, reducedMotion.matches ? 1 : 1320);
    }

    core.addEventListener("click", function () {
      if (isProjectMode) {
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
    document.addEventListener("harini:project-closed", exitProjectMode);

    window.addEventListener("scroll", queueCurrentSectionUpdate, { passive: true });

    window.addEventListener("resize", function () {
      updateCurrentSection(detectCurrentSection(), true);

      if (isOpen) {
        updateSpokeGeometry();
      }
    }, { passive: true });

    setMenuA11y(false);
    setState(STATES.PLUS_IDLE);
    updateCurrentSection(detectCurrentSection(), true);
    debugRenderBase();
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
