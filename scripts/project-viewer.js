(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function init() {
    var projects = window.HariniProjectData || [];
    var triggers = Array.prototype.slice.call(document.querySelectorAll("[data-project-trigger]"));
    var viewer = document.querySelector("[data-project-viewer]");
    var frame = document.querySelector("[data-project-frame]");
    var hero = document.querySelector("[data-project-hero]");
    var story = document.querySelector("[data-project-story]");
    var track = document.querySelector("[data-project-track]");
    var closeButton = document.querySelector("[data-project-close]");
    var progress = document.querySelector("[data-project-progress]");
    var progressBar = document.querySelector("[data-project-progress-bar]");

    if (!viewer || !frame || !hero || !story || !track || !closeButton || !progress || !progressBar || triggers.length === 0) {
      return;
    }

    closeButton.tabIndex = -1;
    closeButton.setAttribute("aria-hidden", "true");

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var activeTrigger = null;
    var activeProject = null;
    var currentShift = 0;
    var maxShift = 0;
    var touchY = 0;
    var closeTimer = 0;
    var readyTimer = 0;
    var pendingShift = 0;
    var shiftFrame = 0;

    function notifyProjectState(name) {
      document.dispatchEvent(new CustomEvent(name));
    }

    function isStackedMode() {
      return window.innerWidth < 760;
    }

    function findProject(id) {
      return projects.find(function (project) {
        return project.id === id;
      });
    }

    function setProgress() {
      var amount = maxShift > 0 ? currentShift / maxShift : 0;
      progressBar.style.transform = "scaleX(" + clamp(amount, 0, 1) + ")";
    }

    function setViewerVars(trigger) {
      var rect = trigger.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var stacked = isStackedMode();
      var side = rect.left + rect.width / 2 > vw / 2 ? "right" : "left";
      var topBuffer = stacked ? Math.max(88, vh * 0.12) : clamp(vh * 0.07, 48, 88);
      var bottomUiZone = stacked ? clamp(vh * 0.14, 104, 150) : clamp(vh * 0.16, 120, 180);
      var maxFocusHeight = Math.max(240, vh - topBuffer - bottomUiZone);
      var focusHeight = stacked ? Math.min(vw - 32, maxFocusHeight, 520) : maxFocusHeight;
      var focusWidth = stacked ? Math.min(vw - 32, 520) : Math.min(vw * 0.54, focusHeight * 1.25, 780);
      var panelPeek = stacked ? 0 : clamp(vw * 0.16, 72, 220);
      var panelWidth = stacked ? vw : vw - panelPeek;
      var focusLeft = stacked ? 16 : side === "right" ? vw - focusWidth : 0;
      var focusTop = stacked ? topBuffer : topBuffer;

      viewer.dataset.projectMode = stacked ? "stacked" : "horizontal";
      viewer.dataset.projectSide = side;
      viewer.style.setProperty("--tile-left", rect.left + "px");
      viewer.style.setProperty("--tile-top", rect.top + "px");
      viewer.style.setProperty("--tile-width", rect.width + "px");
      viewer.style.setProperty("--tile-height", rect.height + "px");
      viewer.style.setProperty("--focus-left", focusLeft + "px");
      viewer.style.setProperty("--focus-top", focusTop + "px");
      viewer.style.setProperty("--focus-width", focusWidth + "px");
      viewer.style.setProperty("--focus-height", focusHeight + "px");
      viewer.style.setProperty("--project-top-buffer", topBuffer + "px");
      viewer.style.setProperty("--project-bottom-ui-zone", bottomUiZone + "px");
      viewer.style.setProperty("--project-panel-peek", panelPeek + "px");
      viewer.style.setProperty("--panel-width", panelWidth + "px");
    }

    function updateMaxShift() {
      if (isStackedMode()) {
        maxShift = 0;
        currentShift = 0;
        viewer.style.setProperty("--project-shift", "0px");
        setProgress();
        return;
      }

      maxShift = Math.max(0, track.scrollWidth - story.clientWidth);
      currentShift = clamp(currentShift, 0, maxShift);
      viewer.style.setProperty("--project-shift", currentShift + "px");
      setProgress();
    }

    function setShift(value, quick) {
      if (isStackedMode()) {
        return;
      }

      currentShift = clamp(value, 0, maxShift);
      track.classList.toggle("is-dragging", Boolean(quick));
      viewer.style.setProperty("--project-shift", currentShift + "px");
      setProgress();

      if (quick) {
        window.setTimeout(function () {
          track.classList.remove("is-dragging");
        }, 120);
      }
    }

    function queueShift(delta) {
      if (isStackedMode()) {
        return;
      }

      pendingShift += delta;

      if (shiftFrame) {
        return;
      }

      shiftFrame = window.requestAnimationFrame(function () {
        setShift(currentShift + pendingShift, true);
        pendingShift = 0;
        shiftFrame = 0;
      });
    }

    function fillProject(project) {
      hero.src = project.image;
      hero.alt = project.alt || "";

      track.innerHTML = project.panels.map(function (panel, index) {
        if (index === 0) {
          return [
            '<article class="project-panel project-panel-intro">',
            '<figure class="project-panel-image">',
            '<img src="',
            escapeHtml(project.image),
            '" alt="',
            escapeHtml(project.alt || ""),
            '">',
            "</figure>",
            '<div class="project-panel-copy">',
            '<p class="project-step">01 / 05</p>',
            "<h3>",
            escapeHtml(project.title),
            "</h3>",
            "<p>",
            escapeHtml(project.summary),
            "</p>",
            "</div>",
            "</article>"
          ].join("");
        }

        return [
          '<article class="project-panel">',
          '<div class="project-panel-copy">',
          '<p class="project-step">',
          String(index + 1).padStart(2, "0"),
          " / 05",
          "</p>",
          "<h3>",
          escapeHtml(panel.heading),
          "</h3>",
          "<p>",
          escapeHtml(panel.body),
          "</p>",
          "</div>",
          "</article>"
        ].join("");
      }).join("");
    }

    function openProject(trigger) {
      var project = findProject(trigger.getAttribute("data-project-trigger"));

      if (!project) {
        return;
      }

      activeTrigger = trigger;
      activeProject = project;
      currentShift = 0;
      pendingShift = 0;
      window.clearTimeout(closeTimer);
      window.clearTimeout(readyTimer);
      setViewerVars(trigger);
      fillProject(project);
      viewer.style.setProperty("--project-shift", "0px");
      story.scrollTop = 0;
      viewer.classList.add("is-active");
      viewer.classList.remove("is-ready", "is-closing");
      viewer.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-project-open", "is-project-dark");
      document.body.classList.remove("is-project-closing");
      notifyProjectState("harini:project-open");

      window.requestAnimationFrame(function () {
        viewer.classList.add("is-expanded");
        updateMaxShift();
        setProgress();
        viewer.focus({ preventScroll: true });
        readyTimer = window.setTimeout(function () {
          viewer.classList.add("is-ready");
        }, reducedMotion.matches ? 1 : 520);
      });
    }

    function finishClose() {
      viewer.classList.remove("is-active", "is-expanded", "is-ready", "is-closing");
      viewer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-project-open", "is-project-dark", "is-project-closing");
      track.innerHTML = "";
      hero.removeAttribute("src");
      activeProject = null;
      notifyProjectState("harini:project-closed");

      if (activeTrigger) {
        activeTrigger.focus({ preventScroll: true });
      }

      activeTrigger = null;
    }

    function closeProject() {
      if (!viewer.classList.contains("is-active")) {
        return;
      }

      pendingShift = 0;
      window.clearTimeout(readyTimer);

      if (shiftFrame) {
        window.cancelAnimationFrame(shiftFrame);
        shiftFrame = 0;
      }

      viewer.classList.add("is-closing");
      viewer.classList.remove("is-ready");
      document.body.classList.add("is-project-closing");
      notifyProjectState("harini:project-closing");
      setShift(0, false);
      story.scrollTop = 0;
      window.clearTimeout(closeTimer);

      if (activeTrigger) {
        setViewerVars(activeTrigger);
      }

      window.requestAnimationFrame(function () {
        viewer.classList.remove("is-expanded");
      });

      closeTimer = window.setTimeout(finishClose, reducedMotion.matches ? 1 : 980);
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        openProject(trigger);
      });
    });

    closeButton.addEventListener("click", closeProject);

    document.addEventListener("harini:project-close-request", closeProject);

    viewer.addEventListener("wheel", function (event) {
      if (!viewer.classList.contains("is-expanded")) {
        return;
      }

      if (isStackedMode()) {
        return;
      }

      event.preventDefault();
      queueShift(event.deltaY * 1.15);
    }, { passive: false });

    viewer.addEventListener("touchstart", function (event) {
      if (event.touches.length > 0) {
        touchY = event.touches[0].clientY;
      }
    }, { passive: true });

    viewer.addEventListener("touchmove", function (event) {
      if (!viewer.classList.contains("is-expanded") || event.touches.length === 0) {
        return;
      }

      if (isStackedMode()) {
        return;
      }

      var nextY = event.touches[0].clientY;
      var delta = touchY - nextY;
      touchY = nextY;
      event.preventDefault();
      queueShift(delta * 1.25);
    }, { passive: false });

    document.addEventListener("keydown", function (event) {
      if (!viewer.classList.contains("is-expanded")) {
        return;
      }

      if (event.key === "Escape") {
        closeProject();
      }

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        if (isStackedMode()) {
          return;
        }

        event.preventDefault();
        setShift(currentShift + window.innerWidth * 0.72, false);
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        if (isStackedMode()) {
          return;
        }

        event.preventDefault();
        setShift(currentShift - window.innerWidth * 0.72, false);
      }
    });

    window.addEventListener("resize", function () {
      if (!viewer.classList.contains("is-active") || !activeTrigger || !activeProject) {
        return;
      }

      setViewerVars(activeTrigger);
      updateMaxShift();
    });
  }

  window.HariniProjectViewer = {
    init: init
  };
})();
