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

  function centerOf(element) {
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function platformFromElement(element, section, side, kind) {
    var rect = element.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var x = rect.left + rect.width / 2;

    if (side === "left") {
      x = rect.left + rect.width * 0.22;
    }

    if (side === "right") {
      x = rect.right - rect.width * 0.22;
    }

    return {
      element: element,
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
    var closeOnBlurTimer = 0;
    var resetTimer = 0;
    var activeLabel = "";
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
        "is-restoring"
      );
    }

    function updateSpokeGeometry() {
      var coreRect = core.getBoundingClientRect();
      var originX = coreRect.left + coreRect.width / 2;
      var originY = coreRect.top;

      spokes.setAttribute("viewBox", "0 0 " + window.innerWidth + " " + window.innerHeight);

      items.forEach(function (button) {
        var label = button.getAttribute("data-nav-target");
        var line = lines[label];
        var point = centerOf(button);

        if (!line) {
          return;
        }

        line.setAttribute("x1", originX);
        line.setAttribute("y1", originY);
        line.setAttribute("x2", point.x);
        line.setAttribute("y2", point.y);
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

      if (open) {
        window.requestAnimationFrame(updateSpokeGeometry);
        window.setTimeout(updateSpokeGeometry, reducedMotion.matches ? 1 : 480);
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
      activeLabel = "";
      setState(finalState || STATES.PLUS_IDLE);
    }

    function documentPointToScreen(point, scrollY) {
      return {
        x: point.x,
        y: point.y - scrollY - ballRadius()
      };
    }

    function contactFloor() {
      var section = document.getElementById("contact");
      var rect = section ? section.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      var scrollY = window.scrollY || window.pageYOffset;
      var documentBottom = document.documentElement.scrollHeight;
      var floorY = Math.min(rect.top + scrollY + rect.height - 34, documentBottom - 24);

      return {
        element: section,
        section: "contact",
        side: "right",
        kind: "floor",
        x: window.innerWidth * 0.78,
        y: floorY,
        width: window.innerWidth,
        height: 1
      };
    }

    function targetPlatformFor(section) {
      if (section === "about") {
        return platformFromElement(document.querySelector(".about-portrait img"), "about", "left");
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
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      if (point.kind === "floor") {
        return clamp(point.y - window.innerHeight + 76, 0, Math.max(0, maxScroll));
      }

      return clamp(point.y - window.innerHeight * 0.48, 0, Math.max(0, maxScroll));
    }

    function restorePlus() {
      setState(STATES.PLUS_RESTORED);
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        resetBallClasses();
        ballLabel.textContent = "";
        setState(STATES.PLUS_IDLE);
      }, reducedMotion.matches ? 1 : 260);
    }

    function rollOut(targetId, landingPoint) {
      var direction = targetId === "about" || targetId === "work" ? -1 : 1;
      var startX = landingPoint.x;
      var endX = direction < 0 ? -ballRadius() - 18 : window.innerWidth + ballRadius() + 18;
      var y = landingPoint.screenY;
      var duration = reducedMotion.matches ? 1 : 680;
      var startTime = 0;

      setState(STATES.BALL_ROLLING_OUT);
      ball.classList.remove("is-arrived");
      ball.classList.add("is-rolling", "is-landed");

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

    function finishTravel(targetId, endPoint) {
      var endScroll = targetScrollFor(endPoint);
      var screen = documentPointToScreen(endPoint, endScroll);
      var target = document.getElementById(targetId);

      window.scrollTo(0, endScroll);
      setBallPosition(screen.x, screen.y);
      setState(STATES.BALL_LANDING);
      ball.classList.remove("is-moving", "is-flying", "is-lifting");
      ball.classList.add("is-landing", "is-landed", "is-arrived");

      if (target) {
        target.focus({ preventScroll: true });
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + targetId);
      }

      window.setTimeout(function () {
        rollOut(targetId, {
          x: screen.x,
          screenY: screen.y
        });
      }, reducedMotion.matches ? 1 : 360);
    }

    function flyBall(startPoint, target, targetId) {
      var endPoint = targetPlatformFor(targetId);
      var startScroll = window.scrollY || window.pageYOffset;
      var distance = Math.abs(endPoint.y - startPoint.y);
      var duration = reducedMotion.matches ? 0 : clamp(distance * 0.42 + 720, 950, 1900);
      var horizontalDirection = targetId === "about" || targetId === "work" ? -1 : 1;
      var startTime = 0;
      var takeoffHeight = reducedMotion.matches ? 0 : 32;

      if (reducedMotion.matches) {
        window.scrollTo(0, targetScrollFor(endPoint));
        finishTravel(targetId, endPoint);
        return;
      }

      setState(STATES.BALL_TAKEOFF);
      ball.classList.remove("is-forming", "is-landed", "is-ready");
      ball.classList.add("is-visible", "is-lifting");

      function pointAt(raw) {
        if (raw < 0.16) {
          var bounce = raw / 0.16;
          return {
            x: startPoint.x,
            y: startPoint.y - Math.sin(Math.PI * bounce) * takeoffHeight
          };
        }

        var local = (raw - 0.16) / 0.84;
        var eased = easeInOut(local);
        var lift = targetId === "contact" ? 58 : clamp(distance * 0.07, 48, 104);
        var control = {
          x: mix(startPoint.x, endPoint.x, 0.48) + horizontalDirection * clamp(window.innerWidth * 0.08, 38, 110),
          y: Math.min(startPoint.y, endPoint.y) - lift
        };
        var inverse = 1 - eased;

        return {
          x: inverse * inverse * startPoint.x + 2 * inverse * eased * control.x + eased * eased * endPoint.x,
          y: inverse * inverse * startPoint.y + 2 * inverse * eased * control.y + eased * eased * endPoint.y
        };
      }

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var point = pointAt(raw);
        var desiredScroll = targetScrollFor(raw > 0.82 ? endPoint : point);
        var actualScroll = mix(startScroll, desiredScroll, easeInOut(raw));
        var screen = documentPointToScreen(point, actualScroll);

        window.scrollTo(0, actualScroll);
        setBallPosition(screen.x, screen.y);

        if (raw > 0.16 && raw < 0.85) {
          setState(STATES.BALL_FLYING);
          ball.classList.remove("is-lifting", "is-landing", "is-landed");
          ball.classList.add("is-moving", "is-flying");
        }

        if (raw >= 0.85) {
          setState(STATES.BALL_LANDING);
          ball.classList.remove("is-flying");
          ball.classList.add("is-landing");
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
      if (isTravelling) {
        return;
      }

      var targetId = button.getAttribute("data-nav-target");
      var target = document.getElementById(targetId);
      var label = button.textContent.trim();
      var buttonCenter = centerOf(button);
      var scrollY = window.scrollY || window.pageYOffset;
      var startPoint = {
        element: button,
        section: "menu",
        side: "center",
        kind: "navi-circle",
        x: buttonCenter.x,
        y: buttonCenter.y + scrollY + ballRadius(),
        width: button.offsetWidth,
        height: button.offsetHeight
      };

      if (!target) {
        return;
      }

      isTravelling = true;
      activeLabel = label;
      setState(STATES.NAVI_SELECTED);
      nav.classList.remove("is-open");
      nav.classList.add("is-choosing");
      button.parentElement.classList.add("is-selected");
      items.forEach(function (item) {
        item.disabled = true;
      });
      setMenuA11y(false);

      setBallPosition(buttonCenter.x, buttonCenter.y);
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
        flyBall(startPoint, target, targetId);
      }, reducedMotion.matches ? 1 : 1250);
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

    window.addEventListener("resize", function () {
      if (isOpen) {
        updateSpokeGeometry();
      }
    }, { passive: true });

    setMenuA11y(false);
    setState(STATES.PLUS_IDLE);
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
