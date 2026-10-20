(function () {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function noop() {}

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  /*
    Images ship as AVIF with a WebP fallback (same file name, different extension). Project data lists the
    .webp path; when the browser can decode AVIF the smaller .avif sibling is requested instead.
  */
  var supportsAvif = false;
  (function detectAvif() {
    var probe = new Image();
    probe.onload = function () {
      supportsAvif = probe.width > 0 && probe.height > 0;
    };
    probe.onerror = function () {
      supportsAvif = false;
    };
    probe.src =
      "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB4AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgQAMAAAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAmbWRhdBIACggYADaICGg0IDIQHEeHhd3TTTTCxsAAkDWX8A==";
  })();

  /* 1 x 1 transparent placeholder for panel images that have not been requested yet */
  var BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  /* same curve as --ease-standard in the style sheets */
  var FLIGHT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  /* the colour comes in more slowly than the picture grows, so it is still gaining colour as it settles */
  var COLOUR_EASE = "cubic-bezier(0.3, 0.2, 0.4, 1)";

  function imageUrl(path) {
    if (!path) {
      return path;
    }

    return supportsAvif && /\.webp$/i.test(path) ? path.replace(/\.webp$/i, ".avif") : path;
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
    var revealTimer = 0;
    var clearTrackTimer = 0;
    var pendingShift = 0;
    var shiftFrame = 0;
    var openToken = 0;
    var activeClone = null;
    var isClosingProject = false;
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;

    /* window.innerWidth / innerHeight make the browser finish any pending layout first, so they are read while the layout is clean
       (at the start of an open, and on resize) and used from here on */
    function readViewport() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
    }

    window.addEventListener("resize", readViewport, { passive: true });

    function notifyProjectState(name) {
      document.dispatchEvent(new CustomEvent(name));
    }

    function isStackedMode() {
      return viewportWidth <= 767;
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

    /* the track is moved with a transform set straight on it (not through a custom property on the viewer, which would
       restyle every panel on every wheel step) */
    function applyShift(value) {
      track.style.transform = value ? "translate3d(" + -value + "px, 0, 0)" : "";
    }

    function setViewerVars(trigger, measuredRect) {
      var rect = measuredRect || trigger.getBoundingClientRect();
      var vw = viewportWidth;
      var vh = viewportHeight;
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

    /* resolves when the picture is loaded and decoded (so painting it costs nothing); never rejects */
    function ensureImageReady(img) {
      if (!img) {
        return Promise.resolve();
      }

      if (img.decode) {
        return img.decode().catch(function () {
          return img.complete ? undefined : waitForImageLoad(img);
        });
      }

      return img.complete ? Promise.resolve() : waitForImageLoad(img);
    }

    function removeActiveClone() {
      if (activeClone) {
        if (typeof activeClone._stopFlight === "function") {
          activeClone._stopFlight();
        }

        if (activeClone.parentElement) {
          activeClone.parentElement.removeChild(activeClone);
        }
      }

      activeClone = null;
    }

    function createOpenClone(trigger, project, rect) {
      var sourceImage = trigger.querySelector("img");
      var clone = document.createElement("div");
      var cloneImage = document.createElement("img");

      clone.className = "project-open-clone";
      clone.style.borderRadius = cornerRadius(trigger);
      applyBox(clone, rect);
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

    function applyBox(element, rect) {
      element.style.left = rect.left + "px";
      element.style.top = rect.top + "px";
      element.style.width = rect.width + "px";
      element.style.height = rect.height + "px";
    }

    /* an element's corner radii as one string, e.g. "0px 28px 28px 0px" (a tile that sits flush against the page edge has square corners on that side) */
    function cornerRadius(element) {
      var style = window.getComputedStyle(element);

      /* the four corners one by one (the border-radius shorthand comes back empty in some older Safari versions) */
      return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
        .map(function (value) {
          return String(value || "0px").split(" ")[0];
        })
        .join(" ");
    }

    function boxKeyframe(rect, radius) {
      var keyframe = {
        left: rect.left + "px",
        top: rect.top + "px",
        width: rect.width + "px",
        height: rect.height + "px"
      };

      if (radius) {
        keyframe.borderRadius = radius;
      }

      return keyframe;
    }

    /*
      Moves a fixed element from one rectangle to another. Resolves true when it arrived and false when the flight was
      stopped (see stopFlight). A timer is the fallback for browsers that hold animation events back (hidden tab).
    */
    function sameBox(a, b) {
      return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
    }

    /*
      extra = { radiusFrom, radiusTo, filterFrom, filterTo }: the corner radii the element moves between, and the filter of the picture inside it
      (the tile is grey, the picture inside the popup is in colour: it gains its colour as it grows and loses it as it shrinks back).
    */
    function flyBetween(element, from, to, duration, extra) {
      var options = extra || {};
      var image = element.querySelector("img");
      var hasFilter = Boolean(image && options.filterFrom && options.filterTo);

      applyBox(element, from);

      if (options.radiusFrom) {
        element.style.borderRadius = options.radiusFrom;
      }

      if (hasFilter) {
        image.style.filter = options.filterFrom;
      }

      /* nothing to travel (closed before the picture had moved): no animation to wait for */
      if (!element.animate || reducedMotion.matches || (sameBox(from, to) && (!options.radiusTo || options.radiusFrom === options.radiusTo))) {
        applyBox(element, to);

        if (options.radiusTo) {
          element.style.borderRadius = options.radiusTo;
        }

        if (hasFilter) {
          image.style.filter = options.filterTo;
        }

        return Promise.resolve(true);
      }

      return new Promise(function (resolve) {
        var settled = false;
        var timer = 0;
        var animation = element.animate([boxKeyframe(from, options.radiusFrom), boxKeyframe(to, options.radiusTo)], {
          duration: duration,
          easing: FLIGHT_EASE,
          fill: "both"
        });
        var colourAnimation = hasFilter
          ? image.animate([{ filter: options.filterFrom }, { filter: options.filterTo }], { duration: duration, easing: COLOUR_EASE, fill: "both" })
          : null;

        function settle(arrived) {
          if (settled) {
            return;
          }

          settled = true;
          window.clearTimeout(timer);
          element._stopFlight = null;

          if (arrived) {
            applyBox(element, to);

            if (options.radiusTo) {
              element.style.borderRadius = options.radiusTo;
            }

            if (hasFilter) {
              image.style.filter = options.filterTo;
            }
          }

          animation.cancel();

          if (colourAnimation) {
            colourAnimation.cancel();
          }

          resolve(arrived);
        }

        element._stopFlight = function () {
          settle(false);
        };
        animation.onfinish = function () {
          settle(true);
        };
        animation.oncancel = function () {
          settle(false);
        };
        timer = window.setTimeout(function () {
          settle(true);
        }, duration + 600);
      });
    }

    /* freezes a flying element where it is and returns that rectangle */
    function stopFlight(element) {
      var rect = element.getBoundingClientRect();
      var radius = cornerRadius(element);
      var image = element.querySelector("img");
      var filter = image ? window.getComputedStyle(image).filter : "none";

      if (typeof element._stopFlight === "function") {
        element._stopFlight();
      }

      applyBox(element, rect);
      element.style.borderRadius = radius;

      if (image) {
        image.style.filter = filter === "none" ? "grayscale(0)" : filter;
      }

      return rect;
    }

    function openFlightDuration() {
      if (reducedMotion.matches) {
        return 1;
      }

      return isTabletLandscapeTouchViewport() || isStackedMode() ? 1100 : 1000;
    }

    function closeFlightDuration() {
      if (reducedMotion.matches) {
        return 1;
      }

      return isTabletLandscapeTouchViewport() || isStackedMode() ? 1000 : 940;
    }

    function introFigure() {
      return track.querySelector(".project-panel-intro .project-panel-image");
    }

    function introImage() {
      return track.querySelector(".project-panel-intro .project-panel-image img");
    }

    /* where the first frame sits (or will sit) on screen: the flying picture lands exactly there */
    function introFigureRect() {
      var figure = introFigure();

      return figure ? figure.getBoundingClientRect() : frame.getBoundingClientRect();
    }

    function prepareProjectOpen(trigger, project, rect) {
      activeTrigger = trigger;
      activeProject = project;
      currentShift = 0;
      pendingShift = 0;
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearTrackTimer);
      closeButton.disabled = false;
      isClosingProject = false;

      if (shiftFrame) {
        window.cancelAnimationFrame(shiftFrame);
        shiftFrame = 0;
      }

      viewer.classList.add("is-active", "is-preparing");
      viewer.classList.remove("is-ready", "is-closing", "is-expanded", "is-landed", "is-shrinking");
      viewer.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-project-open", "is-project-dark");
      document.body.classList.remove("is-project-closing");
      /* told before the panels are built: whatever the listeners measure is then measured on the small, clean layout */
      notifyProjectState("harini:project-open");
      setViewerVars(trigger, rect);
      fillProject(project);
      observePanelImages();
      applyShift(0);
      track.style.transition = "";
      frame.style.cssText = "";
      hero.style.filter = "";
    }

    function revealProjectContent(token) {
      if (token !== openToken || !viewer.classList.contains("is-active") || viewer.classList.contains("is-ready")) {
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
        applyShift(0);
        setProgress();
        return;
      }

      maxShift = Math.max(0, track.scrollWidth - story.clientWidth);
      currentShift = clamp(currentShift, 0, maxShift);
      applyShift(currentShift);
      setProgress();
    }

    function setShift(value, quick) {
      if (isStackedMode()) {
        return;
      }

      currentShift = clamp(value, 0, maxShift);
      track.classList.toggle("is-dragging", Boolean(quick));
      applyShift(currentShift);
      setProgress();

      if (quick) {
        window.setTimeout(function () {
          track.classList.remove("is-dragging");
        }, 120);
      }
    }

    /* the arrow keys move panel by panel: the shift that puts the next (or the previous) panel at the left edge */
    function stepPanel(direction) {
      var panels = track.children;
      var target = currentShift;
      var index;

      for (index = 0; index < panels.length; index += 1) {
        var left = panels[index].offsetLeft;

        if (direction > 0 && left > currentShift + 8) {
          target = left;
          break;
        }

        if (direction < 0 && left < currentShift - 8) {
          target = left;
        }
      }

      if (direction > 0 && target === currentShift) {
        target = maxShift;
      }

      setShift(target, false);
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

    function animateScrollToTop(element) {
      var startTop = element.scrollTop;
      var duration = reducedMotion.matches ? 1 : clamp(Math.abs(startTop) * 0.45, 500, 1200);

      if (startTop <= 1 || reducedMotion.matches) {
        element.scrollTop = 0;
        return Promise.resolve();
      }

      return new Promise(function (resolve) {
        var startTime = performance.now();

        function step(now) {
          var raw = clamp((now - startTime) / duration, 0, 1);
          var eased = easeInOutCubic(raw);

          element.scrollTop = startTop * (1 - eased);

          if (raw < 1) {
            window.requestAnimationFrame(step);
            return;
          }

          element.scrollTop = 0;
          resolve();
        }

        window.requestAnimationFrame(step);
      });
    }

    function animateShiftToStart() {
      var startShift = currentShift;
      var duration = reducedMotion.matches ? 1 : clamp(Math.abs(startShift) * 0.45, 500, 1200);

      if (startShift <= 1 || reducedMotion.matches) {
        setShift(0, false);
        return Promise.resolve();
      }

      return new Promise(function (resolve) {
        var startTime = performance.now();
        var previousTransition = track.style.transition;

        track.style.transition = "none";

        function step(now) {
          var raw = clamp((now - startTime) / duration, 0, 1);
          var eased = easeInOutCubic(raw);

          currentShift = startShift * (1 - eased);
          applyShift(currentShift);
          setProgress();

          if (raw < 1) {
            window.requestAnimationFrame(step);
            return;
          }

          currentShift = 0;
          applyShift(0);
          setProgress();
          track.style.transition = previousTransition;
          resolve();
        }

        window.requestAnimationFrame(step);
      });
    }

    function animateProjectReturnToStart() {
      if (isStackedMode()) {
        return animateScrollToTop(story);
      }

      return animateShiftToStart();
    }

    function fillProject(project) {
      var initialImageClass = viewer.dataset.projectSide === "left" ? "project-panel-image is-initial-left-edge" : "project-panel-image";
      var stepTotal = String(project.panels.length).padStart(2, "0");

      hero.src = imageUrl(project.image);
      hero.alt = "";

      track.innerHTML = project.panels.map(function (panel, index) {
        if (index === 0) {
          return [
            '<article class="project-panel project-panel-intro">',
            '<figure class="',
            initialImageClass,
            '">',
            '<img src="',
            escapeHtml(imageUrl(project.image)),
            '" alt="',
            escapeHtml(project.alt || ""),
            '" decoding="async">',
            "</figure>",
            '<div class="project-panel-copy">',
            '<p class="project-step">01 / ',
            stepTotal,
            "</p>",
            "<h3>",
            escapeHtml(project.title),
            "</h3>",
            "<p>",
            escapeHtml(project.summary),
            "</p>",
            project.meta ? '<p class="project-meta">' + escapeHtml(project.meta) + "</p>" : "",
            "</div>",
            "</article>"
          ].join("");
        }

        /*
          Panels after the first size their frame from the image's own aspect ratio (panel.ratio = width / height), so plans,
          sections and diagrams are shown whole, never cropped. Very wide drawings get a wide frame the viewer pans across.
          panel.colour = true keeps the original colours (for images where colour carries the meaning, such as heat maps).
          Images are requested as the panel nears the screen (see observePanelImages): only the second panel is loaded straight away.
          A frame is "is-loading" until its picture has arrived, so the picture fades in instead of popping in.
        */
        var ratio = panel.ratio > 0 ? panel.ratio : 8 / 7;
        var shape = ratio > 2.2 ? " is-wide" : ratio > 1.45 ? " is-landscape" : "";
        var imageSrc = imageUrl(panel.image || project.image);

        return [
          '<article class="project-panel' + shape + (panel.colour ? " is-colour" : "") + '" style="--ratio:' + ratio.toFixed(3) + '">',
          '<figure class="project-panel-image project-panel-placeholder is-loading">',
          index === 1
            ? '<img src="' + escapeHtml(imageSrc) + '"'
            : '<img src="' + BLANK_IMAGE + '" data-src="' + escapeHtml(imageSrc) + '"',
          ' alt="',
          escapeHtml(panel.alt || project.alt || ""),
          '" decoding="async">',
          "</figure>",
          '<div class="project-panel-copy">',
          '<p class="project-step">',
          String(index + 1).padStart(2, "0"),
          " / ",
          stepTotal,
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

      watchPanelImages();
    }

    /* take the "is-loading" mark off a frame as soon as its real picture (not the placeholder) has loaded */
    function watchPanelImages() {
      Array.prototype.forEach.call(track.querySelectorAll(".project-panel-image.is-loading img"), function (img) {
        var figure = img.parentElement;

        function settle() {
          if (!img.hasAttribute("data-src")) {
            figure.classList.remove("is-loading");
          }
        }

        img.addEventListener("load", settle);
        img.addEventListener("error", function () {
          figure.classList.remove("is-loading");
        });

        if (img.complete && img.naturalWidth > 1) {
          settle();
        }
      });
    }

    /*
      Panel images (after the second) carry their address in data-src. They are requested when their panel comes within a
      couple of screens of the visible area, so a long project opens fast and only fetches what is about to be seen.
    */
    var panelObserver = null;

    function loadPanelImage(img) {
      var src = img.getAttribute("data-src");

      if (src) {
        img.removeAttribute("data-src");
        img.src = src;

        /* decode ahead of time, off screen, so the picture is ready to paint the moment its panel slides in */
        if (img.decode) {
          img.decode().catch(noop);
        }
      }
    }

    function disconnectPanelObserver() {
      if (panelObserver) {
        panelObserver.disconnect();
        panelObserver = null;
      }
    }

    function observePanelImages() {
      var pending = Array.prototype.slice.call(track.querySelectorAll(".project-panel")).filter(function (panel) {
        return panel.querySelector("img[data-src]");
      });

      disconnectPanelObserver();

      if (!("IntersectionObserver" in window)) {
        Array.prototype.forEach.call(track.querySelectorAll("img[data-src]"), loadPanelImage);
        return;
      }

      /* the panels themselves are observed: far-away panels keep their layout box (see content-visibility in motion.css) while their contents are skipped */
      panelObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target.querySelector("img[data-src]");

            if (img) {
              loadPanelImage(img);
            }

            panelObserver.unobserve(entry.target);
          }
        });
      }, { root: story, rootMargin: isStackedMode() ? "1400px 0px" : "0px 1600px" });

      pending.forEach(function (panel) {
        panelObserver.observe(panel);
      });
    }

    /* warm the cache with the two images a project needs first, as soon as someone shows interest in its tile */
    var warmedProjects = {};

    function warmProject(project) {
      if (!project || warmedProjects[project.id]) {
        return;
      }

      warmedProjects[project.id] = true;

      [project.image, project.panels && project.panels[1] && project.panels[1].image].forEach(function (path) {
        if (path) {
          var image = new Image();
          image.decoding = "async";
          image.src = imageUrl(path);

          if (image.decode) {
            image.decode().catch(noop);
          }
        }
      });
    }

    /*
      Opening: the tile's picture is lifted into a clone that flies to the first frame (the flight starts at once, it never waits for
      the big picture), the page fades to black and the text fades in on the way. On landing, the first frame is shown and the clone
      removed in the same step.
    */
    async function openProject(trigger) {
      if (viewer.classList.contains("is-active")) {
        return;
      }

      var project = findProject(trigger.getAttribute("data-project-trigger"));

      if (!project) {
        return;
      }

      var token = openToken + 1;
      readViewport();
      var tileRect = trigger.getBoundingClientRect();
      var cloneParts;
      openToken = token;
      removeActiveClone();
      cloneParts = createOpenClone(trigger, project, tileRect);
      prepareProjectOpen(trigger, project, tileRect);

      /* the clone has to be painted before the tile underneath is hidden: wait for its picture to be decoded and for two frames
         (phones and tablets also let the layout settle for a few more) */
      await Promise.all([
        Promise.race([ensureImageReady(cloneParts.image), wait(300)]),
        waitForLayout()
      ]);
      await waitForProjectMeasurementLayout();

      if (token !== openToken) {
        return;
      }

      var targetRect = introFigureRect();
      trigger.classList.add("is-project-source");
      viewer.classList.add("is-expanded");
      updateMaxShift();
      cloneParts.element.classList.add("is-moving");

      var flight = flyBetween(cloneParts.element, tileRect, targetRect, openFlightDuration(), {
        radiusFrom: cornerRadius(trigger),
        radiusTo: cornerRadius(introFigure()),
        filterFrom: "grayscale(1)",
        filterTo: "grayscale(0)"
      });

      revealTimer = window.setTimeout(function () {
        revealProjectContent(token);
      }, reducedMotion.matches ? 1 : isStackedMode() ? 520 : 440);

      await flight;

      if (token !== openToken) {
        return;
      }

      /* landed. Only if the full-size picture is not decoded yet does the clone (the same picture, smaller) wait for it. */
      await Promise.race([ensureImageReady(introImage()), wait(4000)]);

      if (token !== openToken) {
        return;
      }

      window.clearTimeout(revealTimer);
      revealProjectContent(token);
      viewer.classList.add("is-landed");
      await waitForLayoutFrames(2);

      if (token !== openToken) {
        return;
      }

      removeActiveClone();
    }

    function clearTrack() {
      if (!viewer.classList.contains("is-active")) {
        track.innerHTML = "";
        story.scrollTop = 0;
      }
    }

    /* the viewer disappears and the tile comes back in the same step: the hero frame is exactly on the tile, so nothing changes on screen */
    function finishClose() {
      var trigger = activeTrigger;

      viewer.classList.remove("is-active", "is-expanded", "is-ready", "is-closing", "is-preparing", "is-landed", "is-shrinking");
      viewer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-project-open", "is-project-dark", "is-project-closing");
      disconnectPanelObserver();
      frame.style.cssText = "";
      hero.style.filter = "";
      applyShift(0);
      activeProject = null;
      closeButton.disabled = false;
      isClosingProject = false;
      removeActiveClone();

      if (trigger) {
        trigger.classList.remove("is-project-source");
      }

      notifyProjectState("harini:project-closed");

      if (trigger) {
        trigger.focus({ preventScroll: true });
      }

      activeTrigger = null;

      /* emptying the (long) track is left for after the swap frame */
      window.clearTimeout(clearTrackTimer);
      clearTrackTimer = window.setTimeout(clearTrack, 80);
    }

    /*
      Closing: the track slides back to the first panel, the first frame is swapped for the hero frame (same place, same picture, one
      frame apart so nothing flashes) and that flies back onto the tile while the page comes back. If the project is closed while its
      picture is still flying in, that same picture simply turns around.
    */
    async function closeProject() {
      if (!viewer.classList.contains("is-active") || isClosingProject) {
        return;
      }

      isClosingProject = true;
      pendingShift = 0;
      openToken += 1;
      var token = openToken;
      var flying = activeClone;
      var shrinker = flying || frame;
      var from;
      var fromRadius;
      var fromFilter = "grayscale(0)";
      window.clearTimeout(revealTimer);

      if (shiftFrame) {
        window.cancelAnimationFrame(shiftFrame);
        shiftFrame = 0;
      }

      closeButton.disabled = true;
      document.body.classList.add("is-project-closing");
      notifyProjectState("harini:project-closing");

      if (flying) {
        from = stopFlight(flying);
        fromRadius = flying.style.borderRadius;
        fromFilter = flying.querySelector("img").style.filter || fromFilter;
      } else {
        await animateProjectReturnToStart();

        if (token !== openToken || !viewer.classList.contains("is-active")) {
          return;
        }

        from = introFigureRect();
        fromRadius = cornerRadius(introFigure());
        applyBox(frame, from);
        frame.style.borderRadius = fromRadius;
      }

      viewer.classList.remove("is-ready");
      viewer.classList.add("is-closing");

      if (!flying) {
        /* let the hero frame paint underneath the first frame before the first frame is taken away */
        await waitForLayoutFrames(2);

        if (token !== openToken) {
          return;
        }
      }

      var tileRect = activeTrigger ? activeTrigger.getBoundingClientRect() : from;

      viewer.classList.add("is-shrinking");
      viewer.classList.remove("is-expanded");
      await flyBetween(shrinker, from, tileRect, closeFlightDuration(), {
        radiusFrom: fromRadius,
        radiusTo: activeTrigger ? cornerRadius(activeTrigger) : fromRadius,
        filterFrom: fromFilter,
        filterTo: "grayscale(1)"
      });

      if (token !== openToken) {
        return;
      }

      finishClose();
    }

    triggers.forEach(function (trigger) {
      var warm = function () {
        warmProject(findProject(trigger.getAttribute("data-project-trigger")));
      };

      trigger.addEventListener("pointerenter", warm, { passive: true });
      trigger.addEventListener("focus", warm);
      trigger.addEventListener("touchstart", warm, { passive: true });
      trigger.addEventListener("click", function () {
        openProject(trigger).catch(function (error) {
          console.error("Project open failed", error);
          viewer.classList.add("is-landed");
          removeActiveClone();
          revealProjectContent(openToken);
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

      if (!isClosingProject) {
        queueShift(event.deltaY * 1.15);
      }
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

      if (!isClosingProject) {
        queueShift(delta * 1.25);
      }
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

        if (!isClosingProject) {
          stepPanel(1);
        }
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        if (isStackedMode()) {
          return;
        }

        event.preventDefault();

        if (!isClosingProject) {
          stepPanel(-1);
        }
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
