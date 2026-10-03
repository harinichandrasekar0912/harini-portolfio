(function () {
  "use strict";

  var root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  var NS = "http://www.w3.org/2000/svg";
  var PROFILE_BOUNDS = { minX: -108, maxX: 120 };
  var BASE_HEIGHT = 238;
  var STATES = {
    ENTER_WALK: "ENTER_WALK",
    CENTER_TURN: "CENTER_TURN",
    CENTER_IDLE: "CENTER_IDLE",
    HIT_REACT: "HIT_REACT",
    EXIT_WALK: "EXIT_WALK",
    PEEK_IN: "PEEK_IN",
    PEEK_OUT: "PEEK_OUT",
    RESTART_WALK: "RESTART_WALK",
    INTERRUPT_CENTER: "INTERRUPT_CENTER",
    INTERRUPT_ENTER_WALK: "INTERRUPT_ENTER_WALK",
    INTERRUPT_EXIT_WALK: "INTERRUPT_EXIT_WALK",
    INTERRUPT_RUN_OUT: "INTERRUPT_RUN_OUT",
    HIDDEN: "HIDDEN"
  };
  var TIMING = {
    enterWalk: 5200,
    turn: 740,
    centerIdle: 10000,
    hitReact: 2050,
    exitWalk: 3900,
    peekIn: 760,
    peekOut: 620,
    restartBeat: 520,
    interruptNotice: 300,
    interruptShudder: 430
  };

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var state = {
    name: STATES.HIDDEN,
    stateStart: 0,
    rafId: 0,
    landingVisible: isLandingVisible(),
    currentX: 0,
    currentProfileOpacity: 0,
    currentFrontOpacity: 0,
    currentMode: "hidden",
    lastPlusReaction: 0,
    interruptFrom: "",
    interruptStartX: 0,
    interruptRunDuration: 1400
  };
  var layout = measureLayout();
  var scene = createScene();

  window.landingGirlAnimation = {
    isLandingActive: function () {
      return state.landingVisible;
    },
    handlePlusDistraction: handlePlusDistraction,
    getState: function () {
      return state.name;
    }
  };

  setupVisibilityObserver();
  setupResizeObserver();
  window.addEventListener("landing-nav-plus-opened", handlePlusDistraction);

  if (reducedMotion.matches) {
    renderReducedMotion();
  } else if (state.landingVisible) {
    restartFromBeginning(performance.now());
  } else {
    renderHidden();
  }

  function createScene() {
    root.textContent = "";

    var svg = svgEl("svg", {
      class: "landing-girl-actor-svg",
      viewBox: "0 0 " + layout.width + " " + layout.height,
      preserveAspectRatio: "none",
      focusable: "false",
      "aria-hidden": "true"
    }, root);
    var defs = svgEl("defs", {}, svg);
    var layers = {
      shadow: svgEl("g", { class: "actor-shadow-layer" }, svg),
      girl: svgEl("g", { class: "actor-girl-layer" }, svg),
      ball: svgEl("g", { class: "actor-ball-layer" }, svg),
      impact: svgEl("g", { class: "actor-impact-layer" }, svg)
    };
    var scene = {
      svg: svg,
      defs: defs,
      layers: layers,
      shadow: svgEl("ellipse", { class: "actor-shadow landing-girl-shadow", cx: "0", cy: "0", rx: "42", ry: "6" }, layers.shadow)
    };

    scene.girl = createGirlActor(layers.girl);
    scene.ball = createHitBall(layers.ball, layers.impact);

    return scene;
  }

  function createGirlActor(parent) {
    var group = svgEl("g", { class: "landing-girl-actor" }, parent);
    var actor = {
      group: group,
      poses: {},
      hairGroups: {}
    };

    actor.poses.sideA = createPose(group, "girl-pose sideWalkPoseA girl-pose-side-a");
    actor.hairGroups.sideA = buildSideWalkPoseA(actor.poses.sideA);
    actor.poses.sideB = createPose(group, "girl-pose sideWalkPoseB girl-pose-side-b");
    actor.hairGroups.sideB = buildSideWalkPoseB(actor.poses.sideB);
    actor.poses.front = createPose(group, "girl-pose frontStandPose girl-pose-front");
    actor.hairGroups.front = buildFrontStandPose(actor.poses.front, false);
    actor.poses.run = createPose(group, "girl-pose runScurryPose girl-pose-run");
    actor.hairGroups.run = buildRunScurryPose(actor.poses.run);
    actor.poses.scratch = createPose(group, "girl-pose scratchPose girl-pose-scratch");
    actor.hairGroups.scratch = buildFrontStandPose(actor.poses.scratch, true);

    return actor;
  }

  function createPose(parent, className) {
    var pose = svgEl("g", { class: className }, parent);
    pose.style.opacity = "0";
    return pose;
  }

  function addPath(parent, d, className) {
    return svgEl("path", {
      class: className || "girl-silhouette",
      d: d
    }, parent);
  }

  function addHairStrands(parent, paths) {
    var group = svgEl("g", { class: "girl-hair-strands" }, parent);

    paths.forEach(function (d) {
      addPath(group, d, "girl-hair-strand");
    });

    return group;
  }

  function buildSideWalkPoseA(parent) {
    var hair = svgEl("g", { class: "girl-hair-group" }, parent);

    addPath(parent, "M-16 -156 C-26 -136 -32 -101 -34 -69 C-18 -58 14 -58 34 -69 C31 -103 23 -139 12 -158 C4 -164 -9 -164 -16 -156 Z");
    addPath(parent, "M-8 -181 L8 -181 L9 -154 C4 -151 -5 -151 -10 -154 Z");
    addPath(parent, "M-15 -70 C-24 -48 -30 -27 -33 -8 C-30 -3 -22 -3 -19 -8 C-15 -32 -8 -52 2 -70 C-3 -75 -11 -75 -15 -70 Z");
    addPath(parent, "M-34 -8 C-49 -8 -58 -4 -58 2 C-45 6 -31 5 -21 1 C-18 -2 -23 -7 -34 -8 Z");
    addPath(parent, "M10 -71 C19 -51 25 -29 27 -8 C31 -4 39 -6 41 -12 C37 -36 29 -58 19 -72 C16 -76 10 -76 10 -71 Z");
    addPath(parent, "M28 -11 C42 -13 52 -10 54 -4 C45 4 29 5 18 1 C16 -3 20 -9 28 -11 Z");
    addPath(parent, "M-15 -150 C-29 -129 -35 -106 -33 -88 C-29 -83 -22 -84 -20 -91 C-22 -109 -14 -129 -2 -144 C-4 -151 -11 -154 -15 -150 Z");
    addPath(parent, "M16 -149 C30 -129 40 -107 42 -89 C46 -84 53 -86 54 -93 C50 -114 40 -135 25 -151 C21 -154 16 -153 16 -149 Z");
    addPath(parent, "M-20 -219 C-8 -236 17 -235 29 -218 C41 -199 32 -179 13 -170 C-3 -162 -21 -168 -29 -183 C-37 -184 -40 -191 -30 -196 C-30 -205 -27 -213 -20 -219 Z", "girl-silhouette girl-head-fill");
    addPath(hair, "M22 -217 C44 -228 69 -218 75 -201 C82 -181 62 -165 36 -170 C51 -178 59 -190 55 -201 C51 -214 37 -219 22 -217 Z", "girl-silhouette girl-ponytail-fill");

    return addHairStrands(hair, [
      "M-21 -224 C-35 -214 -31 -198 -43 -184",
      "M-7 -235 C-19 -218 -13 -198 -24 -180",
      "M14 -230 C26 -219 23 -201 34 -187",
      "M35 -221 C51 -216 56 -199 45 -179",
      "M49 -222 C76 -211 73 -181 54 -160",
      "M61 -214 C84 -197 72 -168 50 -154",
      "M69 -202 C83 -186 72 -164 57 -153",
      "M-30 -206 C-39 -201 -38 -190 -47 -183"
    ]);
  }

  function buildSideWalkPoseB(parent) {
    var hair = svgEl("g", { class: "girl-hair-group" }, parent);

    addPath(parent, "M-17 -156 C-27 -136 -33 -100 -34 -68 C-17 -59 15 -58 33 -70 C31 -105 22 -139 11 -158 C3 -164 -10 -164 -17 -156 Z");
    addPath(parent, "M-8 -181 L8 -181 L9 -154 C4 -151 -5 -151 -10 -154 Z");
    addPath(parent, "M-9 -71 C-18 -51 -22 -29 -22 -9 C-18 -4 -10 -5 -8 -12 C-9 -35 -4 -55 6 -72 C2 -77 -5 -77 -9 -71 Z");
    addPath(parent, "M-20 -11 C-35 -11 -43 -7 -44 -1 C-34 5 -20 6 -9 2 C-6 -2 -11 -9 -20 -11 Z");
    addPath(parent, "M14 -70 C23 -47 32 -28 39 -9 C44 -6 51 -10 50 -17 C42 -39 31 -58 22 -72 C19 -76 14 -75 14 -70 Z");
    addPath(parent, "M39 -14 C51 -18 61 -17 65 -11 C59 -2 43 3 31 2 C28 -2 31 -10 39 -14 Z");
    addPath(parent, "M-18 -149 C-32 -130 -43 -110 -46 -91 C-43 -85 -35 -84 -32 -91 C-28 -111 -18 -130 -7 -145 C-9 -151 -15 -154 -18 -149 Z");
    addPath(parent, "M17 -150 C27 -128 29 -106 24 -90 C27 -84 35 -83 38 -90 C40 -111 35 -133 26 -150 C23 -155 18 -154 17 -150 Z");
    addPath(parent, "M-20 -219 C-8 -236 17 -235 29 -218 C41 -199 32 -179 13 -170 C-3 -162 -21 -168 -29 -183 C-37 -184 -40 -191 -30 -196 C-30 -205 -27 -213 -20 -219 Z", "girl-silhouette girl-head-fill");
    addPath(hair, "M22 -217 C45 -229 70 -219 76 -202 C83 -182 61 -165 35 -170 C50 -178 58 -190 54 -201 C50 -214 37 -220 22 -217 Z", "girl-silhouette girl-ponytail-fill");

    return addHairStrands(hair, [
      "M-22 -224 C-35 -214 -32 -198 -43 -184",
      "M-8 -235 C-20 -218 -14 -197 -24 -180",
      "M14 -230 C26 -219 23 -201 34 -187",
      "M36 -221 C52 -216 56 -199 45 -179",
      "M50 -222 C75 -211 73 -181 54 -160",
      "M62 -214 C83 -197 71 -169 50 -154",
      "M69 -202 C83 -186 72 -164 57 -153",
      "M-30 -206 C-39 -201 -38 -190 -47 -183"
    ]);
  }

  function buildFrontStandPose(parent, scratch) {
    var hair = svgEl("g", { class: "girl-hair-group" }, parent);

    addPath(parent, "M-20 -156 C-32 -132 -38 -98 -39 -68 C-21 -56 15 -56 38 -68 C35 -104 28 -136 17 -156 C7 -163 -10 -163 -20 -156 Z");
    addPath(parent, "M-7 -181 L9 -181 L10 -154 C5 -151 -5 -151 -10 -154 Z");
    addPath(parent, "M-17 -69 C-23 -47 -27 -27 -25 -8 C-21 -3 -14 -4 -12 -10 C-13 -31 -9 -52 -2 -70 C-6 -75 -14 -75 -17 -69 Z");
    addPath(parent, "M7 -70 C14 -50 17 -29 15 -9 C19 -4 27 -5 29 -11 C28 -33 24 -53 16 -71 C13 -76 8 -75 7 -70 Z");
    addPath(parent, "M-25 -8 C-40 -5 -46 1 -39 6 C-29 8 -17 6 -10 1 C-8 -3 -15 -8 -25 -8 Z");
    addPath(parent, "M24 -10 C39 -11 47 -7 48 -1 C38 6 24 7 14 2 C12 -2 16 -8 24 -10 Z");
    addPath(parent, "M-27 -146 C-38 -125 -43 -102 -40 -85 C-36 -80 -29 -81 -27 -88 C-30 -108 -25 -127 -15 -143 C-18 -149 -24 -151 -27 -146 Z");

    if (scratch) {
      addPath(parent, "M26 -146 C42 -153 44 -176 33 -190 C27 -193 22 -188 24 -181 C31 -174 30 -163 19 -156 C19 -150 23 -146 26 -146 Z");
      addPath(parent, "M31 -194 C38 -197 43 -192 42 -186 C38 -181 29 -182 27 -187 C27 -190 29 -192 31 -194 Z");
    } else {
      addPath(parent, "M27 -146 C38 -125 43 -101 40 -85 C36 -80 29 -81 27 -88 C30 -108 25 -127 15 -143 C18 -149 24 -151 27 -146 Z");
    }

    addPath(parent, "M-22 -220 C-14 -238 13 -241 29 -225 C43 -211 40 -187 22 -174 C5 -160 -21 -165 -30 -184 C-38 -200 -33 -214 -22 -220 Z", "girl-silhouette girl-head-fill");
    addPath(hair, "M24 -218 C45 -229 64 -220 67 -202 C69 -184 54 -169 33 -171 C43 -181 43 -197 35 -207 C31 -213 27 -216 24 -218 Z", "girl-silhouette girl-ponytail-fill");
    addPath(parent, "M-22 -221 C-4 -236 24 -230 33 -208 C40 -187 27 -169 5 -168 C-17 -168 -33 -181 -33 -197 C-33 -208 -29 -216 -22 -221 Z", "girl-silhouette girl-hair-cap");

    return addHairStrands(hair, [
      "M-25 -228 C-38 -216 -34 -199 -45 -184",
      "M-8 -238 C-20 -220 -13 -198 -25 -179",
      "M16 -232 C29 -222 25 -202 37 -185",
      "M38 -221 C58 -209 55 -182 38 -162",
      "M52 -211 C73 -193 61 -168 45 -154",
      "M31 -206 C41 -199 40 -188 35 -178",
      "M-32 -209 C-41 -201 -39 -190 -48 -182"
    ]);
  }

  function buildRunScurryPose(parent) {
    var hair = svgEl("g", { class: "girl-hair-group" }, parent);

    addPath(parent, "M-19 -156 C-30 -134 -35 -101 -34 -70 C-16 -58 18 -58 39 -71 C35 -104 25 -137 12 -157 C4 -164 -12 -164 -19 -156 Z");
    addPath(parent, "M-8 -181 L8 -181 L9 -154 C4 -151 -5 -151 -10 -154 Z");
    addPath(parent, "M-13 -70 C-32 -48 -48 -27 -61 -8 C-60 -2 -51 0 -46 -5 C-30 -27 -13 -48 4 -66 C2 -74 -8 -77 -13 -70 Z");
    addPath(parent, "M-59 -8 C-75 -6 -86 -1 -88 6 C-73 10 -58 8 -46 2 C-43 -2 -49 -8 -59 -8 Z");
    addPath(parent, "M15 -70 C39 -55 63 -40 84 -24 C90 -24 94 -31 90 -37 C69 -55 45 -68 23 -77 C17 -79 12 -75 15 -70 Z");
    addPath(parent, "M84 -27 C96 -31 107 -30 112 -24 C105 -15 89 -11 77 -13 C73 -17 76 -24 84 -27 Z");
    addPath(parent, "M-16 -149 C-36 -140 -51 -125 -61 -108 C-60 -101 -52 -98 -47 -104 C-36 -120 -22 -132 -5 -141 C-4 -148 -11 -153 -16 -149 Z");
    addPath(parent, "M18 -150 C35 -137 49 -120 57 -103 C64 -101 70 -107 67 -114 C58 -134 41 -149 24 -156 C19 -156 16 -153 18 -150 Z");
    addPath(parent, "M-21 -219 C-9 -236 17 -235 29 -218 C42 -199 32 -179 13 -170 C-3 -162 -22 -168 -30 -183 C-38 -185 -41 -191 -30 -196 C-30 -205 -28 -213 -21 -219 Z", "girl-silhouette girl-head-fill");
    addPath(hair, "M23 -219 C51 -235 89 -222 100 -197 C108 -177 82 -157 45 -166 C63 -176 74 -190 69 -204 C64 -219 42 -224 23 -219 Z", "girl-silhouette girl-ponytail-fill");

    return addHairStrands(hair, [
      "M-23 -226 C-37 -216 -33 -199 -45 -184",
      "M-8 -236 C-20 -218 -14 -198 -25 -180",
      "M16 -232 C30 -221 27 -202 39 -186",
      "M38 -224 C59 -220 66 -201 52 -179",
      "M54 -227 C87 -217 92 -185 62 -159",
      "M71 -220 C105 -204 96 -169 62 -151",
      "M88 -203 C111 -184 90 -157 66 -146",
      "M-32 -208 C-42 -201 -39 -190 -49 -183"
    ]);
  }

  function createHitBall(ballLayer, impactLayer) {
    var group = svgEl("g", { class: "actor-hit-ball" }, ballLayer);
    var ball = svgEl("circle", { class: "actor-hit-ball-fill", cx: "0", cy: "0", r: "7.5" }, group);
    var burst = svgEl("g", { class: "actor-hit-burst" }, impactLayer);

    [
      [-14, -8, -30, -18],
      [-3, -15, -5, -33],
      [9, -12, 22, -28],
      [15, 0, 34, -4]
    ].forEach(function (line) {
      svgEl("line", {
        class: "actor-hit-line",
        x1: line[0],
        y1: line[1],
        x2: line[2],
        y2: line[3]
      }, burst);
    });

    group.style.opacity = "0";
    burst.style.opacity = "0";

    return {
      group: group,
      ball: ball,
      burst: burst
    };
  }

  function setupVisibilityObserver() {
    if (!("IntersectionObserver" in window)) {
      if (state.landingVisible) {
        restartFromBeginning(performance.now());
      }
      return;
    }

    var section = document.getElementById("landing") || root.closest("section");
    var observer = new IntersectionObserver(function (entries) {
      var entry = entries[0];
      var visible = Boolean(entry && entry.isIntersecting && entry.intersectionRatio >= 0.34);

      if (visible === state.landingVisible) {
        return;
      }

      state.landingVisible = visible;

      if (reducedMotion.matches) {
        renderReducedMotion();
      } else if (visible) {
        restartFromBeginning(performance.now());
      } else {
        stopAnimation();
        setState(STATES.HIDDEN, performance.now());
        renderHidden();
      }
    }, {
      threshold: [0, 0.34, 0.65]
    });

    if (section) {
      observer.observe(section);
    }
  }

  function setupResizeObserver() {
    if ("ResizeObserver" in window) {
      var observer = new ResizeObserver(function () {
        layout = measureLayout();
        setAttrs(scene.svg, {
          viewBox: "0 0 " + layout.width + " " + layout.height
        });
      });
      observer.observe(root);
    } else {
      window.addEventListener("resize", function () {
        layout = measureLayout();
        setAttrs(scene.svg, {
          viewBox: "0 0 " + layout.width + " " + layout.height
        });
      });
    }
  }

  function restartFromBeginning(now) {
    stopAnimation();
    layout = measureLayout();
    setAttrs(scene.svg, {
      viewBox: "0 0 " + layout.width + " " + layout.height
    });
    setState(STATES.ENTER_WALK, now || performance.now());
    state.currentX = layout.offRight;
    requestNextFrame();
  }

  function stopAnimation() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function requestNextFrame() {
    state.rafId = window.requestAnimationFrame(tick);
  }

  function tick(now) {
    state.rafId = 0;

    if (!state.landingVisible || reducedMotion.matches) {
      return;
    }

    update(now);
    requestNextFrame();
  }

  function update(now) {
    var elapsed = now - state.stateStart;
    var next = null;

    if (state.name === STATES.ENTER_WALK) {
      renderEnterWalk(elapsed);
      if (elapsed >= TIMING.enterWalk) {
        next = STATES.CENTER_TURN;
      }
    } else if (state.name === STATES.CENTER_TURN) {
      renderCenterTurn(elapsed);
      if (elapsed >= TIMING.turn) {
        next = STATES.CENTER_IDLE;
      }
    } else if (state.name === STATES.CENTER_IDLE) {
      renderCenterIdle(elapsed);
      if (elapsed >= TIMING.centerIdle) {
        next = STATES.HIT_REACT;
      }
    } else if (state.name === STATES.HIT_REACT) {
      renderHitReact(elapsed);
      if (elapsed >= TIMING.hitReact) {
        next = STATES.EXIT_WALK;
      }
    } else if (state.name === STATES.EXIT_WALK) {
      renderExitWalk(elapsed);
      if (elapsed >= TIMING.exitWalk) {
        next = STATES.PEEK_IN;
      }
    } else if (state.name === STATES.PEEK_IN) {
      renderPeekIn(elapsed);
      if (elapsed >= TIMING.peekIn) {
        next = STATES.PEEK_OUT;
      }
    } else if (state.name === STATES.PEEK_OUT) {
      renderPeekOut(elapsed);
      if (elapsed >= TIMING.peekOut) {
        next = STATES.RESTART_WALK;
      }
    } else if (state.name === STATES.RESTART_WALK) {
      renderRestartBeat();
      if (elapsed >= TIMING.restartBeat) {
        next = STATES.ENTER_WALK;
      }
    } else if (
      state.name === STATES.INTERRUPT_CENTER ||
      state.name === STATES.INTERRUPT_ENTER_WALK ||
      state.name === STATES.INTERRUPT_EXIT_WALK ||
      state.name === STATES.INTERRUPT_RUN_OUT
    ) {
      renderInterrupt(elapsed);
      if (elapsed >= interruptDuration()) {
        next = STATES.PEEK_IN;
      }
    } else {
      renderHidden();
      next = STATES.ENTER_WALK;
    }

    if (next) {
      setState(next, now);
    }
  }

  function renderEnterWalk(elapsed) {
    var raw = clamp(elapsed / TIMING.enterWalk, 0, 1);
    var x = lerp(layout.offRight, layout.centerX, easeInOutCubic(raw));

    renderProfile({
      x: x,
      opacity: 1,
      elapsed: elapsed,
      mode: "walk",
      run: false,
      lookDown: 0,
      shudder: 0,
      peek: false
    });
    renderFront({ opacity: 0 });
    renderHitBall(0, 0);
    renderShadow(x, 1, false, false);
  }

  function renderCenterTurn(elapsed) {
    var raw = clamp(elapsed / TIMING.turn, 0, 1);
    var eased = easeInOutCubic(raw);

    renderProfile({
      x: layout.centerX,
      opacity: 1 - eased,
      elapsed: elapsed,
      mode: "walk",
      run: false,
      lookDown: 0,
      shudder: 0,
      peek: false
    });
    renderFront({
      opacity: eased,
      elapsed: elapsed,
      scratch: 0,
      lookDown: 0,
      shudder: 0
    });
    renderHitBall(0, 0);
    renderShadow(layout.centerX, 1, false, false);
  }

  function renderCenterIdle(elapsed) {
    renderProfile({ opacity: 0 });
    renderFront({
      opacity: 1,
      elapsed: elapsed,
      scratch: 0,
      lookDown: 0,
      shudder: 0
    });
    renderHitBall(0, 0);
    renderShadow(layout.centerX, 1, false, false);
  }

  function renderHitReact(elapsed) {
    var hitStart = 120;
    var impactAt = 640;
    var scratch = clamp((elapsed - impactAt) / 520, 0, 1) * (1 - clamp((elapsed - 1580) / 360, 0, 1));
    var shake = clamp((elapsed - impactAt) / 700, 0, 1) * (1 - clamp((elapsed - 1280) / 360, 0, 1));

    renderProfile({ opacity: 0 });
    renderFront({
      opacity: 1,
      elapsed: elapsed,
      scratch: scratch,
      lookDown: 0,
      shudder: shake
    });
    renderHitBall(phase(elapsed, hitStart, impactAt + 460), phase(elapsed, impactAt - 70, impactAt + 180));
    renderShadow(layout.centerX, 1, false, false);
  }

  function renderExitWalk(elapsed) {
    var raw = clamp(elapsed / TIMING.exitWalk, 0, 1);
    var x = lerp(layout.centerX, layout.offLeft, easeInOutCubic(raw));

    renderProfile({
      x: x,
      opacity: 1,
      elapsed: elapsed,
      mode: "walk",
      run: false,
      lookDown: 0,
      shudder: 0,
      peek: false
    });
    renderFront({ opacity: 0 });
    renderHitBall(0, 0);
    renderShadow(x, 1, false, false);
  }

  function renderPeekIn(elapsed) {
    var raw = clamp(elapsed / TIMING.peekIn, 0, 1);
    var x = lerp(layout.offRight, layout.peekX, easeOutCubic(raw));

    renderProfile({
      x: x,
      opacity: 1,
      elapsed: elapsed,
      mode: "peek",
      run: false,
      lookDown: 0,
      shudder: 0,
      peek: true
    });
    renderFront({ opacity: 0 });
    renderHitBall(0, 0);
    renderShadow(x, 0.45, false, true);
  }

  function renderPeekOut(elapsed) {
    var raw = clamp(elapsed / TIMING.peekOut, 0, 1);
    var x = lerp(layout.peekX, layout.offRight, easeInCubic(raw));

    renderProfile({
      x: x,
      opacity: 1,
      elapsed: elapsed,
      mode: "peek",
      run: false,
      lookDown: 0,
      shudder: 0,
      peek: true
    });
    renderFront({ opacity: 0 });
    renderHitBall(0, 0);
    renderShadow(x, 0.35, false, true);
  }

  function renderRestartBeat() {
    renderHidden();
  }

  function renderInterrupt(elapsed) {
    var noticeEnd = TIMING.interruptNotice;
    var shudderEnd = noticeEnd + TIMING.interruptShudder;
    var fromCenter = state.interruptFrom === "center";
    var duration = interruptDuration();
    var runRaw = fromCenter ?
      clamp((elapsed - shudderEnd * 0.7) / (duration - shudderEnd * 0.7), 0, 1) :
      clamp(elapsed / duration, 0, 1);
    var x = fromCenter ?
      lerp(state.interruptStartX, layout.offLeft, easeInCubic(runRaw)) :
      lerp(state.interruptStartX, layout.offLeft, easeInCubic(runRaw));
    var lookDown = 1 - clamp((elapsed - shudderEnd) / 420, 0, 1);
    var shudder = clamp((elapsed - noticeEnd) / TIMING.interruptShudder, 0, 1) *
      (1 - clamp((elapsed - shudderEnd) / 420, 0, 1));
    var profileOpacity = fromCenter ? clamp((elapsed - noticeEnd) / 280, 0, 1) : 1;
    var frontOpacity = fromCenter ? 1 - profileOpacity : 0;
    var running = elapsed > noticeEnd || !fromCenter;

    if (!fromCenter && elapsed < shudderEnd) {
      x = lerp(state.interruptStartX, Math.max(layout.offLeft, state.interruptStartX - layout.width * 0.12), elapsed / shudderEnd);
    }

    renderProfile({
      x: x,
      opacity: profileOpacity,
      elapsed: elapsed,
      mode: running ? "run" : "walk",
      run: running,
      lookDown: lookDown,
      shudder: shudder,
      peek: false
    });
    renderFront({
      opacity: frontOpacity,
      elapsed: elapsed,
      scratch: 0,
      lookDown: lookDown,
      shudder: shudder
    });
    renderHitBall(0, 0);
    renderShadow(fromCenter && frontOpacity > profileOpacity ? layout.centerX : x, 1, running, false);
  }

  function setPoseOpacity(pose, opacity) {
    pose.style.opacity = clamp(opacity || 0, 0, 1).toFixed(3);
  }

  function hideProfilePoses(girl) {
    setPoseOpacity(girl.poses.sideA, 0);
    setPoseOpacity(girl.poses.sideB, 0);
    setPoseOpacity(girl.poses.run, 0);
  }

  function hideFrontPoses(girl) {
    setPoseOpacity(girl.poses.front, 0);
    setPoseOpacity(girl.poses.scratch, 0);
  }

  function hideAllGirlPoses(girl) {
    hideProfilePoses(girl);
    hideFrontPoses(girl);
    girl.group.style.opacity = "0";
  }

  function poseTransform(x, y, scale, angle) {
    return "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") scale(" + scale.toFixed(4) + ") rotate(" + angle.toFixed(2) + " 0 -120)";
  }

  function animateHair(hairGroup, elapsed, amount, verticalAmount) {
    if (!hairGroup) {
      return;
    }

    setTransform(hairGroup, "translate(" + (Math.sin(elapsed * 0.006) * amount).toFixed(2) + " " + (Math.cos(elapsed * 0.004) * verticalAmount).toFixed(2) + ")");
  }

  function renderProfile(options) {
    var girl = scene.girl;
    var opacity = clamp(options.opacity || 0, 0, 1);
    var x = Number.isFinite(options.x) ? options.x : state.currentX;
    var elapsed = options.elapsed || 0;
    var run = Boolean(options.run);
    var peek = Boolean(options.peek);
    var shudder = options.shudder || 0;
    var lookDown = options.lookDown || 0;
    var cycle = elapsed * (run ? 0.026 : peek ? 0.004 : 0.0095);
    var step = Math.sin(cycle);
    var walkBlend = (step + 1) / 2;
    var runBlend = (Math.sin(cycle * 1.12) + 1) / 2;
    var bob = peek ? 0 : Math.abs(Math.sin(cycle)) * (run ? 8 : 3.8);
    var lean = run ? -13 : peek ? -7 : 0;
    var shudderOffset = shudder ? Math.sin(elapsed * 0.07) * 4.5 * shudder : 0;
    var shudderAngle = shudder ? Math.sin(elapsed * 0.105) * 3.2 * shudder : 0;
    var angle = lean + shudderAngle + lookDown * 4;
    var transform = poseTransform(x + shudderOffset, layout.groundY + bob, layout.scale, angle);

    girl.group.style.opacity = "1";
    hideFrontPoses(girl);

    if (opacity <= 0.002) {
      hideProfilePoses(girl);
      state.currentProfileOpacity = 0;
      return;
    }

    setTransform(girl.poses.sideA, transform);
    setTransform(girl.poses.sideB, transform);
    setTransform(girl.poses.run, poseTransform(x + shudderOffset, layout.groundY + bob, layout.scale, angle - 2));

    if (run) {
      setPoseOpacity(girl.poses.sideA, opacity * (0.16 + 0.12 * (1 - runBlend)));
      setPoseOpacity(girl.poses.sideB, opacity * 0.08 * runBlend);
      setPoseOpacity(girl.poses.run, opacity * (0.82 + 0.18 * runBlend));
    } else if (peek) {
      setPoseOpacity(girl.poses.sideA, opacity);
      setPoseOpacity(girl.poses.sideB, 0);
      setPoseOpacity(girl.poses.run, 0);
    } else {
      setPoseOpacity(girl.poses.sideA, opacity * (1 - walkBlend));
      setPoseOpacity(girl.poses.sideB, opacity * walkBlend);
      setPoseOpacity(girl.poses.run, 0);
    }

    animateHair(girl.hairGroups.sideA, elapsed + 40, run ? 5.2 : 2.4, run ? 1.8 : 1.1);
    animateHair(girl.hairGroups.sideB, elapsed + 120, run ? 4.8 : 2.2, run ? 1.8 : 1.1);
    animateHair(girl.hairGroups.run, elapsed + 240, run ? 7.2 : 0, run ? 2.4 : 0);

    state.currentX = x;
    state.currentProfileOpacity = opacity;
    state.currentMode = run ? "run" : peek ? "peek" : "walk";
  }

  function renderFront(options) {
    var girl = scene.girl;
    var opacity = clamp(options.opacity || 0, 0, 1);
    var elapsed = options.elapsed || 0;
    var scratch = options.scratch || 0;
    var lookDown = options.lookDown || 0;
    var shudder = options.shudder || 0;
    var breathe = Math.sin(elapsed * 0.002) * 1.2;
    var shudderOffset = shudder ? Math.sin(elapsed * 0.08) * 4 * shudder : 0;
    var shudderAngle = shudder ? Math.sin(elapsed * 0.11) * 3 * shudder : 0;
    var angle = shudderAngle + lookDown * 2 + scratch * 1.6;
    var transform = poseTransform(layout.centerX + shudderOffset, layout.groundY + breathe, layout.scale, angle);

    girl.group.style.opacity = "1";

    if (opacity <= 0.002) {
      hideFrontPoses(girl);
      state.currentFrontOpacity = 0;
      return;
    }

    setTransform(girl.poses.front, transform);
    setTransform(girl.poses.scratch, transform);
    setPoseOpacity(girl.poses.front, opacity * (1 - scratch));
    setPoseOpacity(girl.poses.scratch, opacity * scratch);
    animateHair(girl.hairGroups.front, elapsed, 1.6 + shudder * 2, 1.1);
    animateHair(girl.hairGroups.scratch, elapsed + 180, 2.5 + scratch * 1.8, 1.3);

    state.currentX = layout.centerX;
    state.currentFrontOpacity = opacity;
    state.currentMode = "front";
  }

  function renderHitBall(progress, impactProgress) {
    var visible = progress > 0 && progress < 1 ? 1 : impactProgress > 0 && impactProgress < 1 ? 1 : 0;
    var p = clamp(progress, 0, 1);
    var start = {
      x: layout.centerX + layout.scale * 175,
      y: layout.groundY - layout.scale * 330
    };
    var apex = {
      x: layout.centerX + layout.scale * 78,
      y: layout.groundY - layout.scale * 355
    };
    var hit = {
      x: layout.centerX + layout.scale * 31,
      y: layout.groundY - layout.scale * 220
    };
    var rebound = {
      x: layout.centerX - layout.scale * 16,
      y: layout.groundY - layout.scale * 258
    };
    var point = p < 0.72 ?
      quadraticPoint(start, apex, hit, p / 0.72) :
      quadraticPoint(hit, { x: hit.x - 18 * layout.scale, y: hit.y - 44 * layout.scale }, rebound, (p - 0.72) / 0.28);

    scene.ball.group.style.opacity = visible.toFixed(3);
    setTransform(scene.ball.group, "translate(" + point.x.toFixed(2) + " " + point.y.toFixed(2) + ") scale(" + layout.scale.toFixed(3) + ")");

    scene.ball.burst.style.opacity = (impactProgress > 0 && impactProgress < 1 ? (1 - impactProgress) : 0).toFixed(3);
    setTransform(scene.ball.burst, "translate(" + hit.x.toFixed(2) + " " + hit.y.toFixed(2) + ") scale(" + layout.scale.toFixed(3) + ")");
  }

  function renderShadow(x, opacity, run, peek) {
    var visible = Math.max(state.currentProfileOpacity, state.currentFrontOpacity, opacity || 0);
    var rx = layout.scale * (peek ? 28 : run ? 58 : 44);
    var ry = layout.scale * (run ? 4.5 : 5.6);

    scene.shadow.style.opacity = clamp(visible * (peek ? 0.08 : run ? 0.18 : 0.14), 0, 0.24).toFixed(3);
    setAttrs(scene.shadow, {
      cx: x.toFixed(2),
      cy: (layout.groundY + layout.scale * 7).toFixed(2),
      rx: rx.toFixed(2),
      ry: ry.toFixed(2)
    });
  }

  function renderHidden() {
    hideAllGirlPoses(scene.girl);
    scene.shadow.style.opacity = "0";
    scene.ball.group.style.opacity = "0";
    scene.ball.burst.style.opacity = "0";
    state.currentProfileOpacity = 0;
    state.currentFrontOpacity = 0;
    state.currentMode = "hidden";
  }

  function renderReducedMotion() {
    stopAnimation();
    layout = measureLayout();
    setAttrs(scene.svg, {
      viewBox: "0 0 " + layout.width + " " + layout.height
    });
    renderProfile({ opacity: 0 });
    renderFront({
      opacity: state.landingVisible ? 1 : 0,
      elapsed: 0,
      scratch: 0,
      lookDown: 0,
      shudder: 0
    });
    renderHitBall(0, 0);
    renderShadow(layout.centerX, state.landingVisible ? 1 : 0, false, false);
  }

  function handlePlusDistraction() {
    var now = performance.now();
    var current = state.name;

    if (now - state.lastPlusReaction < 90 || reducedMotion.matches || !state.landingVisible) {
      return;
    }

    state.lastPlusReaction = now;

    if (current === STATES.CENTER_TURN || current === STATES.CENTER_IDLE) {
      beginInterrupt(STATES.INTERRUPT_CENTER, "center", layout.centerX, now);
      return;
    }

    if (current === STATES.ENTER_WALK) {
      beginInterrupt(STATES.INTERRUPT_ENTER_WALK, "enter", state.currentX, now);
      return;
    }

    if (current === STATES.EXIT_WALK) {
      beginInterrupt(STATES.INTERRUPT_EXIT_WALK, "exit", state.currentX, now);
    }
  }

  function beginInterrupt(nextState, from, x, now) {
    var distance = Math.max(0, x - layout.offLeft);
    var runDuration = clamp(distance / Math.max(layout.width, 1) * 1450, 960, 1900);

    state.name = nextState;
    state.stateStart = now;
    state.interruptFrom = from;
    state.interruptStartX = x;
    state.interruptRunDuration = runDuration;

    if (!state.rafId && state.landingVisible) {
      requestNextFrame();
    }
  }

  function interruptDuration() {
    return TIMING.interruptNotice + TIMING.interruptShudder + state.interruptRunDuration;
  }

  function setState(nextState, now) {
    state.name = nextState;
    state.stateStart = now || performance.now();

    if (nextState === STATES.ENTER_WALK) {
      state.currentX = layout.offRight;
    } else if (nextState === STATES.EXIT_WALK) {
      state.currentX = layout.centerX;
    }
  }

  function measureLayout() {
    var rect = root.getBoundingClientRect();
    var width = Math.max(320, rect.width || window.innerWidth || 320);
    var height = Math.max(220, rect.height || 360);
    var actorHeight = clamp(height * 0.46, 155, Math.min(226, height * 0.5));
    var scale = actorHeight / BASE_HEIGHT;
    var groundY = clamp(height * 0.82, actorHeight + 10, height - 20);
    var offRight = width - PROFILE_BOUNDS.minX * scale;
    var offLeft = -PROFILE_BOUNDS.maxX * scale;

    return {
      width: width,
      height: height,
      scale: scale,
      centerX: width / 2,
      groundY: groundY,
      offRight: offRight,
      offLeft: offLeft,
      peekX: width + 22 * scale
    };
  }

  function isLandingVisible() {
    var section = document.getElementById("landing") || root.closest("section");
    var rect;

    if (!section) {
      return true;
    }

    rect = section.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.62 && rect.bottom > window.innerHeight * 0.38;
  }

  function svgEl(tag, attrs, parent) {
    var element = document.createElementNS(NS, tag);

    setAttrs(element, attrs || {});

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  function setAttrs(element, attrs) {
    Object.keys(attrs).forEach(function (key) {
      element.setAttribute(key, attrs[key]);
    });
  }

  function setTransform(element, value) {
    element.setAttribute("transform", value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function phase(value, start, end) {
    return clamp((value - start) / (end - start), 0, 1);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function quadraticPoint(p0, p1, p2, t) {
    var u = 1 - t;

    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }
})();
