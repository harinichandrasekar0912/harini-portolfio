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
      setMenuA11y(open);
    }

    function clearChoiceState() {
      nav.classList.remove("is-open", "is-choosing", "is-travelling");
      items.forEach(function (item) {
        item.disabled = false;
        item.parentElement.classList.remove("is-selected");
      });
      setMenuA11y(false);
      isOpen = false;
      isTravelling = false;
    }

    function setBallPosition(x, y) {
      ball.style.setProperty("--ball-x", x + "px");
      ball.style.setProperty("--ball-y", y + "px");
    }

    function finishTravel(label, targetId) {
      ballLabel.textContent = label;
      ball.classList.remove("is-moving", "is-lifting");
      ball.classList.add("is-landed", "is-labelled");

      var target = document.getElementById(targetId);
      if (target) {
        target.focus({ preventScroll: true });
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#" + targetId);
      }

      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        ball.classList.remove("is-visible", "is-landed", "is-labelled");
        ballLabel.textContent = "";
        clearChoiceState();
      }, reducedMotion.matches ? 80 : 850);
    }

    function travelTo(button, target, label) {
      var start = getCenter(button);
      var end = {
        x: window.innerWidth / 2,
        y: window.innerHeight - clamp(window.innerHeight * 0.065, 42, 70)
      };
      var startScroll = window.scrollY || window.pageYOffset;
      var targetTop = target.getBoundingClientRect().top + startScroll;
      var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      var endScroll = clamp(targetTop, 0, Math.max(0, maxScroll));
      var distance = Math.abs(endScroll - startScroll);
      var duration = reducedMotion.matches ? 0 : clamp(distance * 0.48, 620, 1350);

      setBallPosition(start.x, start.y);
      ballLabel.textContent = label;
      ball.classList.add("is-visible", "is-labelled", "is-landed");

      window.requestAnimationFrame(function () {
        ball.classList.remove("is-labelled", "is-landed");
        ball.classList.add("is-lifting");
      });

      if (reducedMotion.matches || duration === 0) {
        window.scrollTo(0, endScroll);
        setBallPosition(end.x, end.y);
        finishTravel(label, target.id);
        return;
      }

      var control = {
        x: mix(start.x, end.x, 0.5),
        y: Math.min(start.y, end.y) - clamp(window.innerHeight * 0.16, 80, 150)
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
          ball.classList.remove("is-lifting");
          ball.classList.add("is-moving");
        }

        setBallPosition(x, y);
        window.scrollTo(0, mix(startScroll, endScroll, eased));

        if (raw < 1) {
          window.requestAnimationFrame(frame);
          return;
        }

        finishTravel(label, target.id);
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
      }, reducedMotion.matches ? 0 : 320);
    }

    core.addEventListener("click", function () {
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

    setMenuA11y(false);
  }

  window.HariniNavigationBall = {
    init: init
  };
})();
