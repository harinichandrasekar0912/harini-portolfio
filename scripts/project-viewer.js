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
    var contentReadyTimer = 0;
    var pendingShift = 0;
    var shiftFrame = 0;
    var openToken = 0;
    var activeClone = null;

    function notifyProjectState(name) {
      document.dispatchEvent(new CustomEvent(name));
    }

    function isStackedMode() {
      return window.innerWidth <= 767;
    }

    function isTabletLandscapeTouchViewport() {
      const isTabletLandscapeTouch =
        window.matchMedia("(min-width: 768px) and (max-width: 1180px) and (orientation: landscape) and (pointer: coarse)").matches;
      return isTabletLandscapeTouch;
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

    function setViewerVars(trigger, measuredRect) {
      var rect = measuredRect || trigger.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var stacked = isStackedMode();
      var side = rect.left + rect.width / 2 > vw / 2 ? "right" : "left";
      var topBuffer = stacked ? Math.max(88, vh * 0.12) : clamp(vh * 0.07, 48, 88);
      var bottomUiZone = stacked ? clamp(vh * 0.14, 104, 150) : clamp(vh * 0.16, 120, 180);
      var maxFocusHeight = Math.max(240, vh - topBuffer - bottomUiZone);
      var mobileFocusWidth = Math.min(vw * 0.9, 520);
      var focusHeight = stacked ? Math.min(mobileFocusWidth, maxFocusHeight, 520) : maxFocusHeight;
      var focusWidth = stacked ? mobileFocusWidth : Math.min(vw * 0.54, focusHeight * 1.25, 780);
      var panelPeek = stacked || side === "right" ? 0 : clamp(vw * 0.16, 72, 220);
      var panelWidth = stacked ? vw : vw - panelPeek;
      var focusLeft = stacked ? (vw - focusWidth) / 2 : side === "right" ? vw - focusWidth : 0;
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

    function waitForFrame() {
      return new Promise(function (resolve) {
        window.requestAnimationFrame(resolve);
      });
    }

    function waitForLayoutFrames(count) {
      var frames = Math.max(1, count || 2);
      var chain = Promise.resolve();

      while (frames > 0) {
        chain = chain.then(waitForFrame);
        frames -= 1;
      }

      return chain;
    }

    function waitForLayout() {
      return waitForLayoutFrames(2);
    }

    function waitForPhoneLayout() {
      if (!isStackedMode()) {
        return Promise.resolve();
      }

      return waitForLayout().then(waitForLayout);
    }

    function waitForProjectMeasurementLayout() {
      if (isTabletLandscapeTouchViewport()) {
        return waitForLayoutFrames(3);
      }

      return waitForPhoneLayout();
    }

    function waitForImageLoad(img) {
      return new Promise(function (resolve) {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    }

    function ensureImageReady(img) {
      if (!img) {
        return Promise.resolve();
      }

      if (img.complete) {
        return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      }

      if (!isStackedMode() && !isTabletLandscapeTouchViewport()) {
        return img.decode ? img.decode().catch(function () {}) : waitForImageLoad(img);
      }

      if (img.decode) {
        return img.decode().catch(function () {
          return waitForImageLoad(img);
        });
      }

      return waitForImageLoad(img);
    }

    function removeActiveClone() {
      if (activeClone && activeClone.parentElement) {
        activeClone.parentElement.removeChild(activeClone);
      }

      activeClone = null;
    }

    function createOpenClone(trigger, project, rect) {
      var sourceImage = trigger.querySelector("img");
      var clone = document.createElement("div");
      var cloneImage = document.createElement("img");

      clone.className = "project-open-clone" + (isStackedMode() ? "" : " " + (rect.left + rect.width / 2 > window.innerWidth / 2 ? "is-right-attached" : "is-left-attached"));
      clone.style.left = rect.left + "px";
      clone.style.top = rect.top + "px";
      clone.style.width = rect.width + "px";
      clone.style.height = rect.height + "px";
      cloneImage.src = sourceImage ? sourceImage.currentSrc || sourceImage.src : project.image;
      cloneImage.alt = "";
      cloneImage.decoding = "async";
      clone.appendChild(cloneImage);
      document.body.appendChild(clone);
      activeClone = clone;

      return {
        element: clone,
        image: cloneImage
      };
    }

    function measureProjectTargetRect() {
      return frame.getBoundingClientRect();
    }

    function firstPanelImage() {
      return track.querySelector(".project-panel-image img");
    }

    function animateCloneTo(clone, targetRect) {
      if (!clone || reducedMotion.matches) {
        return Promise.resolve();
      }

      return new Promise(function (resolve) {
        var finished = false;

        function finish() {
          if (finished) {
            return;
          }

          finished = true;
          clone.removeEventListener("transitionend", handleTransitionEnd);
          resolve();
        }

        function handleTransitionEnd(event) {
          if (event.target === clone) {
            finish();
          }
        }

        clone.addEventListener("transitionend", handleTransitionEnd);
        window.setTimeout(finish, isTabletLandscapeTouchViewport() ? 1440 : isStackedMode() ? 1480 : 1280);
        window.requestAnimationFrame(function () {
          clone.classList.add("is-moving");
          clone.style.left = targetRect.left + "px";
          clone.style.top = targetRect.top + "px";
          clone.style.width = targetRect.width + "px";
          clone.style.height = targetRect.height + "px";
        });
      });
    }

    function prepareProjectOpen(trigger, project, rect) {
      activeTrigger = trigger;
      activeProject = project;
      currentShift = 0;
      pendingShift = 0;
      window.clearTimeout(closeTimer);
      window.clearTimeout(readyTimer);
      window.clearTimeout(contentReadyTimer);

      if (shiftFrame) {
        window.cancelAnimationFrame(shiftFrame);
        shiftFrame = 0;
      }

      setViewerVars(trigger, rect);
      fillProject(project);
      viewer.style.setProperty("--project-shift", "0px");
      story.scrollTop = 0;
      viewer.classList.add("is-active", "is-preparing");
      viewer.classList.remove("is-ready", "is-closing", "is-expanded");
      viewer.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-project-open", "is-project-dark");
      document.body.classList.remove("is-project-closing");
      notifyProjectState("harini:project-open");
    }

    function revealProjectContent(token) {
      if (token !== openToken || !viewer.classList.contains("is-active")) {
        return;
      }

      viewer.classList.remove("is-preparing");
      viewer.classList.add("is-ready");
      viewer.focus({ preventScroll: true });
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
      var initialImageClass = viewer.dataset.projectSide === "left" ? "project-panel-image is-initial-left-edge" : "project-panel-image";

      hero.src = project.image;
      hero.alt = project.alt || "";

      track.innerHTML = project.panels.map(function (panel, index) {
        if (index === 0) {
          return [
            '<article class="project-panel project-panel-intro">',
            '<figure class="',
            initialImageClass,
            '">',
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
          '<figure class="project-panel-image project-panel-placeholder">',
          '<img src="',
          escapeHtml(panel.image || project.image),
          '" alt="',
          escapeHtml(panel.alt || project.alt || ""),
          '">',
          "</figure>",
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

    async function openProject(trigger) {
      if (viewer.classList.contains("is-active")) {
        return;
      }

      var project = findProject(trigger.getAttribute("data-project-trigger"));

      if (!project) {
        return;
      }

      var token = openToken + 1;
      var tileRect = trigger.getBoundingClientRect();
      var cloneParts;
      var targetRect;
      var cloneMotion;
      openToken = token;
      removeActiveClone();
      cloneParts = createOpenClone(trigger, project, tileRect);
      prepareProjectOpen(trigger, project, tileRect);
      await waitForProjectMeasurementLayout();

      await Promise.all([
        ensureImageReady(cloneParts.image),
        ensureImageReady(hero),
        ensureImageReady(firstPanelImage()),
        waitForLayout()
      ]);

      if (token !== openToken) {
        removeActiveClone();
        return;
      }

      viewer.classList.add("is-expanded");
      updateMaxShift();
      setProgress();
      await waitForProjectMeasurementLayout();

      await Promise.all([
        ensureImageReady(hero),
        ensureImageReady(firstPanelImage()),
        waitForLayout()
      ]);

      if (token !== openToken) {
        removeActiveClone();
        return;
      }

      targetRect = measureProjectTargetRect();
      cloneMotion = animateCloneTo(cloneParts.element, targetRect);
      contentReadyTimer = window.setTimeout(function () {
        revealProjectContent(token);
      }, reducedMotion.matches ? 1 : isStackedMode() ? 560 : isTabletLandscapeTouchViewport() ? 520 : 420);

      await cloneMotion;

      if (token !== openToken) {
        removeActiveClone();
        return;
      }

      window.clearTimeout(contentReadyTimer);
      revealProjectContent(token);
      readyTimer = window.setTimeout(removeActiveClone, reducedMotion.matches ? 1 : 180);
    }

    function finishClose() {
      viewer.classList.remove("is-active", "is-expanded", "is-ready", "is-closing", "is-preparing");
      viewer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-project-open", "is-project-dark", "is-project-closing");
      track.innerHTML = "";
      hero.removeAttribute("src");
      activeProject = null;
      removeActiveClone();
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
      openToken += 1;
      removeActiveClone();
      window.clearTimeout(readyTimer);
      window.clearTimeout(contentReadyTimer);

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

      closeTimer = window.setTimeout(finishClose, reducedMotion.matches ? 1 : isTabletLandscapeTouchViewport() ? 1380 : isStackedMode() ? 1380 : 1220);
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        openProject(trigger).catch(function (error) {
          console.error("Project open failed", error);
        });
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
