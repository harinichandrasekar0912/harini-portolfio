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

    function pauseBall() {
      if (!isTravelling || navState !== STATES.BALL_TRAVELLING) {
        return;
      }

      setState(STATES.BALL_PAUSED);
      ballLabel.textContent = activeTravelLabel;
      ball.classList.remove("is-moving", "is-lifting");
      ball.classList.add("is-visible", "is-landed", "is-labelled", "is-paused");
    }

    function resumeBall() {
      if (!isTravelling || navState !== STATES.BALL_PAUSED) {
        return;
      }

      setState(STATES.BALL_RESUMING);
      ball.classList.remove("is-landed", "is-labelled", "is-paused");
      ball.classList.add("is-lifting");

      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(function () {
        if (isTravelling && navState === STATES.BALL_RESUMING) {
          setState(STATES.BALL_TRAVELLING);
          ball.classList.remove("is-lifting");
          ball.classList.add("is-moving");
        }
      }, reducedMotion.matches ? 1 : 140);
    }

    function noteScrollProgress() {
      if (!isTravelling || !activeTravelLabel || navState === STATES.BALL_ARRIVED) {
        return;
      }

      if (navState === STATES.BALL_PAUSED) {
        resumeBall();
      }

      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(pauseBall, reducedMotion.matches ? 1 : 170);
    }

    function restorePlus() {
      setState(STATES.PLUS_RESTORED);
      ball.classList.remove("is-labelled", "is-arrived", "is-paused");
      ball.classList.add("is-restoring");
      clearChoiceState(STATES.PLUS_RESTORED);

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        ball.classList.remove(
          "is-visible",
          "is-landed",
          "is-labelled",
          "is-moving",
          "is-lifting",
          "is-paused",
          "is-arrived",
          "is-restoring"
        );
        ballLabel.textContent = "";
        setState(STATES.PLUS_IDLE);
      }, reducedMotion.matches ? 1 : 280);
    }

    function finishTravel(label, targetId, end) {
      window.clearTimeout(pauseTimer);
      window.clearTimeout(resumeTimer);
      setState(STATES.BALL_ARRIVED);
      ballLabel.textContent = label;
      ball.classList.remove("is-moving", "is-lifting", "is-paused");
      ball.classList.add("is-visible", "is-landed", "is-labelled", "is-arrived");

      if (!reducedMotion.matches) {
        setBallPosition(end.x + 7, end.y);
        window.requestAnimationFrame(function () {
          setBallPosition(end.x, end.y);
        });
      }

      var target = document.getElementById(targetId);
      if (target) {
        target.focus({ preventScroll: true });
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + targetId);
      }

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(restorePlus, reducedMotion.matches ? 80 : 1150);
    }

    function travelTo(button, target, label) {
      var start = getCenter(button);
      var movesLeft = label === "about" || label === "work";
      var end = {
        x: window.innerWidth * (movesLeft ? 0.28 : 0.72),
        y: window.innerHeight * 0.5
      };
      var startScroll = window.scrollY || window.pageYOffset;
      var targetTop = target.getBoundingClientRect().top + startScroll;
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var endScroll = clamp(targetTop, 0, Math.max(0, maxScroll));
      var distance = Math.abs(endScroll - startScroll);
      var duration = reducedMotion.matches ? 0 : clamp(distance * 0.48, 620, 1350);

      activeTravelLabel = label;
      setBallPosition(start.x, start.y);
      ballLabel.textContent = label;
      ball.classList.remove("is-restoring", "is-arrived", "is-moving", "is-lifting", "is-paused");
      ball.classList.add("is-visible", "is-labelled", "is-landed");

      if (reducedMotion.matches || duration === 0) {
        window.scrollTo(0, endScroll);
        setBallPosition(end.x, end.y);
        finishTravel(label, target.id, end);
        return;
      }

      window.requestAnimationFrame(function () {
        setState(STATES.BALL_RESUMING);
        ball.classList.remove("is-labelled", "is-landed");
        ball.classList.add("is-lifting");
      });

      var control = {
        x: mix(start.x, end.x, 0.42),
        y: Math.min(start.y, end.y) - clamp(window.innerHeight * 0.18, 96, 180)
      };
      var startTime = 0;

      function frame(now) {
        if (!startTime) {
          startTime = now;
        }

        var raw = clamp((now - startTime) / duration, 0, 1);
        var eased = easeInOut(raw);
        var inverse = 1 - eased;
        var x = inverse * inverse * start.x + 2 * inverse * eased * control.x + eased * eased * end.x;
        var y = inverse * inverse * start.y + 2 * inverse * eased * control.y + eased * eased * end.y;

        if (raw > 0.08) {
          if (navState === STATES.BALL_RESUMING) {
            setState(STATES.BALL_TRAVELLING);
          }
          ball.classList.remove("is-lifting");
          ball.classList.add("is-moving");
        }

        setBallPosition(x, y);
        window.scrollTo(0, mix(startScroll, endScroll, eased));
        noteScrollProgress();

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        finishTravel(label, target.id, end);
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
      }, reducedMotion.matches ? 0 : 520);
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
