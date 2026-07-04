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

    if (!viewer || !frame || !hero || !story || !track || !closeButton || triggers.length === 0) {
      return;
    }

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var activeTrigger = null;
    var activeProject = null;
    var currentShift = 0;
    var maxShift = 0;
    var touchY = 0;
    var closeTimer = 0;

    function findProject(id) {
      return projects.find(function (project) {
        return project.id === id;
      });
    }

    function setViewerVars(trigger) {
      var rect = trigger.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var mobile = vw < 760;
      var focusWidth = mobile ? Math.min(vw - 32, 620) : Math.min(vw * 0.48, 700);
      var focusHeight = mobile ? Math.min(vh * 0.34, focusWidth * 0.78) : Math.min(vh * 0.64, focusWidth * 0.78);
      var focusLeft = mobile ? 16 : Math.max(32, (vw - Math.min(vw * 0.88, 1240)) / 2);
      var focusTop = mobile ? Math.max(104, vh * 0.28) : vh / 2;
      var storyLeft = mobile ? 16 : focusLeft + focusWidth + clamp(vw * 0.055, 34, 86);
      var storyTop = mobile ? focusTop + focusHeight / 2 + 34 : Math.max(84, vh * 0.22);
      var storyWidth = mobile ? vw - 32 : Math.max(320, vw - storyLeft - Math.max(32, vw * 0.07));
      var storyHeight = mobile ? Math.max(230, vh - storyTop - 86) : Math.min(560, vh * 0.58);

      viewer.style.setProperty("--tile-left", rect.left + "px");
      viewer.style.setProperty("--tile-top", rect.top + "px");
      viewer.style.setProperty("--tile-width", rect.width + "px");
      viewer.style.setProperty("--tile-height", rect.height + "px");
      viewer.style.setProperty("--focus-left", focusLeft + "px");
      viewer.style.setProperty("--focus-top", focusTop + "px");
      viewer.style.setProperty("--focus-width", focusWidth + "px");
      viewer.style.setProperty("--focus-height", focusHeight + "px");
      viewer.style.setProperty("--story-left", storyLeft + "px");
      viewer.style.setProperty("--story-top", storyTop + "px");
      viewer.style.setProperty("--story-width", storyWidth + "px");
      viewer.style.setProperty("--story-height", storyHeight + "px");
    }

    function updateMaxShift() {
      maxShift = Math.max(0, track.scrollWidth - story.clientWidth);
      currentShift = clamp(currentShift, 0, maxShift);
      viewer.style.setProperty("--project-shift", currentShift + "px");
    }

    function setShift(value, quick) {
      currentShift = clamp(value, 0, maxShift);
      track.classList.toggle("is-dragging", Boolean(quick));
      viewer.style.setProperty("--project-shift", currentShift + "px");
      if (quick) {
        window.setTimeout(function () {
          track.classList.remove("is-dragging");
        }, 100);
      }
    }

    function fillProject(project) {
      hero.src = project.image;
      hero.alt = project.alt || "";
      track.innerHTML = project.panels.map(function (panel, index) {
        var heading = index === 0 ? project.title : panel.heading;
        var body = index === 0 ? project.summary : panel.body;
        return [
          '<article class="project-panel">',
          '<p class="project-step">',
          String(index + 1).padStart(2, "0"),
          " / 05",
          "</p>",
          "<h3>",
          escapeHtml(heading),
          "</h3>",
          "<p>",
          escapeHtml(body),
          "</p>",
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
      window.clearTimeout(closeTimer);
      setViewerVars(trigger);
      fillProject(project);
      viewer.style.setProperty("--project-shift", "0px");
      viewer.classList.add("is-active");
      viewer.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-project-open");

      window.requestAnimationFrame(function () {
        viewer.classList.add("is-expanded");
        updateMaxShift();
        viewer.focus({ preventScroll: true });
      });
    }

    function closeProject() {
      if (!viewer.classList.contains("is-active")) {
        return;
      }

      setShift(0, false);
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () {
        viewer.classList.remove("is-expanded");
        closeTimer = window.setTimeout(function () {
          viewer.classList.remove("is-active");
          viewer.setAttribute("aria-hidden", "true");
          document.body.classList.remove("is-project-open");
          track.innerHTML = "";
          hero.removeAttribute("src");
          activeProject = null;
          if (activeTrigger) {
            activeTrigger.focus({ preventScroll: true });
          }
          activeTrigger = null;
        }, reducedMotion.matches ? 1 : 720);
      }, reducedMotion.matches ? 1 : 520);
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        openProject(trigger);
      });
    });

    closeButton.addEventListener("click", closeProject);

    viewer.addEventListener("wheel", function (event) {
      if (!viewer.classList.contains("is-expanded")) {
        return;
      }

      event.preventDefault();
      setShift(currentShift + event.deltaY, true);
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

      var nextY = event.touches[0].clientY;
      var delta = touchY - nextY;
      touchY = nextY;
      event.preventDefault();
      setShift(currentShift + delta * 1.2, true);
    }, { passive: false });

    document.addEventListener("keydown", function (event) {
      if (!viewer.classList.contains("is-expanded")) {
        return;
      }

      if (event.key === "Escape") {
        closeProject();
      }

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setShift(currentShift + story.clientWidth * 0.75, false);
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setShift(currentShift - story.clientWidth * 0.75, false);
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
