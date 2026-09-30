(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function mix(from, to, t) {
    return from + (to - from) * t;
  }

  function getCenter(element) {
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getPlatformPoint(element, section, side, weight) {
    var rect = element.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var x = rect.left + rect.width / 2;

    if (side === "left") {
      x = rect.left + rect.width * 0.28;
    }

    if (side === "right") {
      x = rect.left + rect.width * 0.72;
    }

    return {
      element: element,
      section: section,
      side: side || "center",
      weight: weight || 0,
      x: clamp(x, 34, window.innerWidth - 34),
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  var STATES = {
    PLUS_IDLE: "plus_idle",
    MENU_OPEN: "menu_open",
    DESTINATION_SELECTED: "destination_selected",
    BALL_TRAVELLING: "ball_travelling",
    BALL_PAUSED: "ball_paused",
    BALL_RESUMING: "ball_resuming",
    BALL_ARRIVED: "ball_arrived",
    PLUS_RESTORED: "plus_restored"
  };

  function init() {
    var nav = document.querySelector("[data-nav-object]");
    var core = document.querySelector("[data-nav-core]");
    var menu = document.getElementById("radial-menu");
    var ball = document.querySelector("[data-travel-ball]");
    var ballLabel = document.querySelector("[data-travel-label]");
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-nav-target]"));

    if (!nav || !core || !menu || !ball || !ballLabel || items.length === 0) {
      return;
    }

    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var isOpen = false;
    var isTravelling = false;
    var resetTimer = 0;
    var closeOnBlurTimer = 0;
    var pauseTimer = 0;
    var resumeTimer = 0;
    var activeTravelLabel = "";
    var navState = STATES.PLUS_IDLE;

    function setState(nextState) {
      navState = nextState;
      nav.dataset.navState = nextState;
      ball.dataset.ballState = nextState;
    }

    function setMenuA11y(open) {
      core.setAttribute("aria-expanded", String(open));
      core.setAttribute("aria-label", open ? "close navigation" : "open navigation");
      menu.setAttribute("aria-hidden", String(!open));
      items.forEach(function (item) {
        item.tabIndex = open ? 0 : -1;
      });
    }

    function setOpen(open) {
      if (isTravelling) {
        return;
      }

      window.clearTimeout(closeOnBlurTimer);
      isOpen = open;
      nav.classList.toggle("is-open", open);
      setState(open ? STATES.MENU_OPEN : STATES.PLUS_IDLE);
      setMenuA11y(open);
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
      activeTravelLabel = "";
      setState(finalState || STATES.PLUS_IDLE);
    }

    function setBallPosition(x, y) {
      ball.style.setProperty("--ball-x", x + "px");
      ball.style.setProperty("--ball-y", y + "px");
    }

    function ballRadius() {
      return ball.getBoundingClientRect().width / 2 || 22;
    }

    function documentPointToScreen(point, scrollY) {
      return {
        x: point.x,
        y: point.y - scrollY - ballRadius()
      };
    }

    function targetScrollFor(point) {
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      return clamp(point.y - window.innerHeight * 0.46, 0, Math.max(0, maxScroll));
    }

    function collectPlatforms() {
      var platforms = [];
      var landing = document.querySelector(".landing-media");
      var about = document.querySelector(".about-portrait img");
      var archiveVisual = document.querySelector(".archive-visual img");
      var contact = document.querySelector(".contact-form");

      if (landing) {
        platforms.push(getPlatformPoint(landing, "landing", "center", 1));
      }

      if (about) {
        platforms.push(getPlatformPoint(about, "about", "left", 4));
      }

      Array.prototype.slice.call(document.querySelectorAll(".work-tile")).forEach(function (tile, index) {
        platforms.push(getPlatformPoint(tile, "work", index % 2 === 0 ? "left" : "right", 8 + index));
      });

      if (archiveVisual) {
        platforms.push(getPlatformPoint(archiveVisual, "archive", "left", 4));
      }

      Array.prototype.slice.call(document.querySelectorAll(".archive-item")).forEach(function (item, index) {
        platforms.push(getPlatformPoint(item, "archive", "right", 3 + index));
      });

      if (contact) {
        platforms.push(getPlatformPoint(contact, "contact", "left", 4));
      }

      return platforms.sort(function (a, b) {
        return a.y - b.y;
      });
    }

    function fallbackPlatform(section) {
      var target = document.getElementById(section);
      var rect = target ? target.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth };
      var scrollY = window.scrollY || window.pageYOffset;

      return {
        element: target,
        section: section,
        side: "center",
        weight: 0,
        x: clamp(rect.left + rect.width / 2, 34, window.innerWidth - 34),
        y: rect.top + scrollY + window.innerHeight * 0.38,
        width: rect.width,
        height: 1
      };
    }

    function targetPlatformFor(section, platforms) {
      var matches = platforms.filter(function (platform) {
        return platform.section === section;
      });

      if (matches.length === 0) {
        return fallbackPlatform(section);
      }

      return matches[0];
    }

    function nearestCurrentPlatform(platforms) {
      var currentY = (window.scrollY || window.pageYOffset) + window.innerHeight * 0.52;
      var best = platforms[0] || fallbackPlatform("landing");

      platforms.forEach(function (platform) {
        if (Math.abs(platform.y - currentY) < Math.abs(best.y - currentY)) {
          best = platform;
        }
      });

      return best;
    }

    function trimPlatforms(platforms, start, target) {
      var downward = target.y >= start.y;
      var between = platforms.filter(function (platform) {
        if (platform === start || platform === target) {
          return false;
        }

        return downward
          ? platform.y > start.y + 80 && platform.y < target.y - 80
          : platform.y < start.y - 80 && platform.y > target.y + 80;
      });

      between.sort(function (a, b) {
        return downward ? a.y - b.y : b.y - a.y;
      });

      if (downward) {
        return between.filter(function (_, index) {
          return index % Math.max(1, Math.ceil(between.length / 3)) === 0;
        }).slice(0, 3);
      }

      var chosen = [];
      var lastSide = "";

      between.forEach(function (platform) {
        if (chosen.length >= 5) {
          return;
        }

        if (!lastSide || platform.side !== lastSide || chosen.length === 0) {
          chosen.push(platform);
          lastSide = platform.side;
        }
      });

      return chosen.length > 0 ? chosen : between.slice(0, 4);
    }

    function buildPath(startPoint, destinationSection) {
      var platforms = collectPlatforms();
      var current = nearestCurrentPlatform(platforms);
      var target = targetPlatformFor(destinationSection, platforms);
      var hops = trimPlatforms(platforms, current, target);
      var path = [startPoint];

      if (Math.abs(current.y - startPoint.y) > 80) {
        path.push(current);
      }

      hops.forEach(function (hop) {
        path.push(hop);
      });

      path.push(target);
      return path;
    }

    function pauseBall() {
      if (!isTravelling || navState !== STATES.BALL_TRAVELLING) {
        return;
      }

      setState(STATES.BALL_PAUSED);
      ball.classList.remove("is-moving", "is-lifting");
      ball.classList.add("is-visible", "is-landed", "is-paused");
    }

    function resumeBall() {
      if (!isTravelling || navState !== STATES.BALL_PAUSED) {
        return;
      }

      setState(STATES.BALL_RESUMING);
      ball.classList.remove("is-landed", "is-paused");
      ball.classList.add("is-lifting");

      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(function () {
        if (isTravelling && navState === STATES.BALL_RESUMING) {
          setState(STATES.BALL_TRAVELLING);
          ball.classList.remove("is-lifting");
          ball.classList.add("is-moving");
        }
      }, reducedMotion.matches ? 1 : 120);
    }

    function noteScrollProgress() {
      if (!isTravelling || !activeTravelLabel || navState === STATES.BALL_ARRIVED) {
        return;
      }

      if (navState === STATES.BALL_PAUSED) {
        resumeBall();
      }

      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(pauseBall, reducedMotion.matches ? 1 : 190);
    }

    function restorePlus() {
      setState(STATES.PLUS_RESTORED);
      ball.classList.remove("is-arrived", "is-paused");
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        ball.classList.remove(
          "is-visible",
          "is-landed",
          "is-moving",
          "is-lifting",
          "is-paused",
          "is-arrived",
          "is-restoring"
        );
        ballLabel.textContent = "";
        setState(STATES.PLUS_IDLE);
      }, reducedMotion.matches ? 1 : 300);
    }

    function finishTravel(label, targetId, endPoint) {
      var endScroll = targetScrollFor(endPoint);
      var screen = documentPointToScreen(endPoint, endScroll);

      window.clearTimeout(pauseTimer);
      window.clearTimeout(resumeTimer);
      window.scrollTo(0, endScroll);
      setBallPosition(screen.x, screen.y);
      setState(STATES.BALL_ARRIVED);
      ball.classList.remove("is-moving", "is-lifting", "is-paused");
      ball.classList.add("is-visible", "is-landed", "is-arrived");

      var target = document.getElementById(targetId);
      if (target) {
        target.focus({ preventScroll: true });
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + targetId);
      }

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(restorePlus, reducedMotion.matches ? 80 : 1000);
    }

    function travelTo(button, target, label) {
      var startCenter = getCenter(button);
      var startScroll = window.scrollY || window.pageYOffset;
      var startPoint = {
        element: button,
        section: "menu",
        side: "center",
        weight: 0,
        x: startCenter.x,
        y: startCenter.y + startScroll + ballRadius(),
        width: button.offsetWidth,
        height: button.offsetHeight
      };
      var path = buildPath(startPoint, target.id);
      var totalDistance = Math.max(1, Math.abs(path[path.length - 1].y - startPoint.y));
      var duration = reducedMotion.matches ? 0 : clamp(totalDistance * 0.52 + path.length * 120, 850, 2400);
      var segmentCount = Math.max(1, path.length - 1);

      activeTravelLabel = label;
      setBallPosition(startCenter.x, startCenter.y);
      ballLabel.textContent = "";
      ball.classList.remove("is-restoring", "is-arrived", "is-moving", "is-lifting", "is-paused");
      ball.classList.add("is-visible", "is-landed");

      if (reducedMotion.matches || duration === 0) {
        finishTravel(label, target.id, path[path.length - 1]);
        return;
      }

      window.requestAnimationFrame(function () {
        setState(STATES.BALL_RESUMING);
        ball.classList.remove("is-landed");
        ball.classList.add("is-lifting");
      });

      var startTime = 0;

      function pointAt(rawProgress) {
        var scaled = clamp(rawProgress, 0, 1) * segmentCount;
        var index = Math.min(segmentCount - 1, Math.floor(scaled));
        var local = scaled - index;
        var eased = easeInOut(local);
        var from = path[index];
        var to = path[index + 1];
        var upward = to.y < from.y;
        var lift = clamp(Math.abs(to.y - from.y) * (upward ? 0.34 : 0.18), 82, upward ? 230 : 170);
        var control = {
          x: mix(from.x, to.x, upward ? 0.58 : 0.46),
          y: Math.min(from.y, to.y) - lift
        };
        var inverse = 1 - eased;

        return {
          x: inverse * inverse * from.x + 2 * inverse * eased * control.x + eased * eased * to.x,
          y: inverse * inverse * from.y + 2 * inverse * eased * control.y + eased * eased * to.y
        };
      }

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var point = pointAt(raw);
        var scrollY = targetScrollFor(point);
        var screen = documentPointToScreen(point, scrollY);

        if (raw > 0.03) {
          if (navState === STATES.BALL_RESUMING) {
            setState(STATES.BALL_TRAVELLING);
          }
          ball.classList.remove("is-lifting", "is-landed");
          ball.classList.add("is-moving");
        }

        window.scrollTo(0, scrollY);
        setBallPosition(screen.x, screen.y);
        noteScrollProgress();

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        finishTravel(label, target.id, path[path.length - 1]);
      }

      window.requestAnimationFrame(frame);
    }

    function chooseDestination(button) {
      if (isTravelling) {
        return;
      }

      var targetId = button.getAttribute("data-nav-target");
      var target = document.getElementById(targetId);
      var label = button.textContent.trim();

      if (!target) {
        return;
      }

      isTravelling = true;
      setState(STATES.DESTINATION_SELECTED);
      nav.classList.remove("is-open");
      nav.classList.add("is-choosing");
      button.parentElement.classList.add("is-selected");
      items.forEach(function (item) {
        item.disabled = true;
      });
      setMenuA11y(false);

      window.setTimeout(function () {
        nav.classList.add("is-travelling");
        travelTo(button, target, label);
      }, reducedMotion.matches ? 0 : 540);
    }

    core.addEventListener("click", function () {
      if (canHover.matches && isOpen) {
        return;
      }

      setOpen(!isOpen);
    });

    nav.addEventListener("pointerenter", function () {
      if (canHover.matches) {
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

    window.addEventListener("scroll", noteScrollProgress, { passive: true });
    setMenuA11y(false);
    setState(STATES.PLUS_IDLE);
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
