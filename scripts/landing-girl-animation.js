(function () {
  "use strict";

  var root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  var NS = "http://www.w3.org/2000/svg";
  var PROFILE_BOUNDS = { minX: -82, maxX: 132 };
  var BASE_HEIGHT = 260;
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
      shadow: svgEl("ellipse", { class: "actor-shadow", cx: "0", cy: "0", rx: "42", ry: "6" }, layers.shadow)
    };

    scene.profileGirl = createProfileGirl(layers.girl);
    scene.frontGirl = createFrontGirl(layers.girl);
    scene.ball = createHitBall(layers.ball, layers.impact);

    return scene;
  }

  function createProfileGirl(parent) {
    var group = svgEl("g", { class: "girl-profile-actor" }, parent);
    var pose = svgEl("g", { class: "girl-profile-pose" }, group);
    var legs = svgEl("g", { class: "girl-profile-legs" }, pose);
    var body = svgEl("g", { class: "girl-profile-body" }, pose);
    var head = svgEl("g", { class: "girl-profile-head" }, body);
    var strands = [];

    var backLeg = svgEl("g", { class: "profile-leg profile-leg-back" }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-8 -82 C-27 -61 -36 -31 -31 -9 C-25 -2 -12 -3 -8 -12 C-8 -35 -1 -57 15 -76 C11 -83 -2 -88 -8 -82 Z"
    }, backLeg);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-34 -8 C-53 -2 -56 7 -37 9 L-8 8 C-2 4 -6 -3 -17 -7 C-23 -9 -29 -10 -34 -8 Z"
    }, backLeg);

    var frontLeg = svgEl("g", { class: "profile-leg profile-leg-front" }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M17 -80 C38 -58 49 -31 48 -9 C54 -2 69 -3 73 -13 C69 -39 55 -65 31 -82 C25 -86 18 -85 17 -80 Z"
    }, frontLeg);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M62 -13 C80 -15 91 -10 92 -1 C78 6 59 8 44 4 C39 0 43 -8 53 -11 C56 -12 59 -13 62 -13 Z"
    }, frontLeg);

    var backArm = svgEl("g", { class: "profile-arm profile-arm-back" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-20 -149 C-36 -130 -44 -104 -41 -82 C-36 -75 -24 -76 -22 -86 C-22 -105 -12 -129 6 -143 C2 -151 -13 -154 -20 -149 Z"
    }, backArm);

    var frontArm = svgEl("g", { class: "profile-arm profile-arm-front" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M21 -148 C42 -128 53 -103 52 -84 C58 -76 70 -78 72 -89 C67 -113 54 -137 34 -153 C28 -155 21 -153 21 -148 Z"
    }, frontArm);

    svgEl("path", {
      class: "girl-silhouette profile-dress",
      d: "M-22 -163 C-38 -139 -47 -101 -55 -63 C-30 -45 9 -42 53 -60 C48 -103 35 -140 12 -162 C3 -170 -13 -170 -22 -163 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-8 -184 L14 -183 L16 -154 C8 -149 -4 -149 -12 -154 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-23 -226 C-6 -243 24 -240 42 -218 C59 -198 50 -172 24 -161 C2 -152 -24 -163 -32 -183 C-45 -184 -48 -191 -35 -196 C-37 -209 -32 -220 -23 -226 Z"
    }, head);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-34 -200 C-46 -197 -49 -189 -34 -184 C-31 -174 -20 -163 -5 -159 C-21 -159 -37 -169 -42 -185 C-52 -187 -55 -195 -43 -201 Z"
    }, head);
    var ponytail = svgEl("path", {
      class: "girl-silhouette profile-ponytail",
      d: "M36 -210 C80 -237 130 -209 120 -176 C111 -146 75 -136 41 -159 C25 -171 27 -193 39 -203 C43 -207 42 -210 36 -210 Z"
    }, head);

    [
      "M-30 -225 C-45 -213 -40 -194 -53 -179",
      "M-12 -235 C-27 -215 -20 -192 -33 -174",
      "M20 -233 C34 -218 25 -195 38 -177",
      "M48 -218 C64 -207 58 -187 71 -170",
      "M72 -221 C101 -209 96 -174 68 -151",
      "M96 -205 C132 -184 113 -147 80 -137",
      "M105 -191 C122 -174 112 -154 91 -143"
    ].forEach(function (d) {
      strands.push(svgEl("path", { class: "girl-hair-strand", d: d }, head));
    });

    return {
      group: group,
      pose: pose,
      legs: legs,
      body: body,
      head: head,
      ponytail: ponytail,
      strands: strands,
      backLeg: backLeg,
      frontLeg: frontLeg,
      backArm: backArm,
      frontArm: frontArm
    };
  }

  function createFrontGirl(parent) {
    var group = svgEl("g", { class: "girl-front-actor" }, parent);
    var pose = svgEl("g", { class: "girl-front-pose" }, group);
    var legs = svgEl("g", { class: "girl-front-legs" }, pose);
    var body = svgEl("g", { class: "girl-front-body" }, pose);
    var head = svgEl("g", { class: "girl-front-head" }, body);
    var strands = [];

    svgEl("path", {
      class: "girl-silhouette",
      d: "M-30 -76 C-40 -51 -43 -26 -39 -8 C-33 -3 -21 -4 -17 -12 C-18 -35 -13 -56 -5 -75 C-12 -82 -25 -82 -30 -76 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M8 -75 C18 -53 22 -29 20 -9 C27 -3 39 -5 43 -14 C41 -36 34 -58 24 -77 C18 -83 9 -82 8 -75 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-34 -8 C-53 -3 -57 6 -38 8 L-15 7 C-8 3 -13 -4 -23 -7 C-27 -8 -31 -9 -34 -8 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M36 -12 C55 -13 65 -8 65 1 C50 7 32 8 18 4 C14 0 18 -8 28 -11 C31 -12 34 -12 36 -12 Z"
    }, legs);

    var leftArm = svgEl("g", { class: "front-arm front-arm-left" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-37 -146 C-50 -125 -55 -101 -51 -82 C-45 -76 -35 -78 -33 -88 C-35 -107 -30 -126 -19 -142 C-23 -150 -32 -152 -37 -146 Z"
    }, leftArm);

    var rightArmRelaxed = svgEl("g", { class: "front-arm front-arm-right-relaxed" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M35 -146 C49 -125 56 -101 52 -82 C46 -75 35 -78 33 -88 C35 -108 29 -127 18 -143 C22 -150 31 -152 35 -146 Z"
    }, rightArmRelaxed);

    var rightArmScratch = svgEl("g", { class: "front-arm front-arm-right-scratch" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M33 -146 C57 -154 60 -179 43 -197 C35 -199 29 -191 32 -184 C41 -178 39 -166 25 -157 C24 -151 28 -146 33 -146 Z"
    }, rightArmScratch);
    svgEl("circle", { class: "girl-silhouette", cx: "42", cy: "-198", r: "5.4" }, rightArmScratch);

    svgEl("path", {
      class: "girl-silhouette",
      d: "M-28 -162 C-46 -133 -56 -96 -60 -62 C-27 -44 20 -43 60 -63 C54 -103 44 -136 26 -162 C12 -173 -15 -172 -28 -162 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-12 -184 L15 -184 L17 -155 C7 -150 -5 -150 -14 -155 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-37 -215 C-28 -247 20 -255 47 -227 C66 -207 56 -171 25 -158 C-9 -144 -45 -165 -49 -195 C-50 -203 -45 -211 -37 -215 Z"
    }, head);
    var ponytail = svgEl("path", {
      class: "girl-silhouette front-ponytail",
      d: "M39 -215 C82 -237 118 -207 108 -177 C99 -151 69 -140 40 -158 C29 -167 28 -190 40 -201 Z"
    }, head);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-29 -222 C-7 -242 32 -235 46 -207 C57 -181 35 -156 4 -156 C-24 -156 -47 -174 -47 -195 C-47 -206 -39 -216 -29 -222 Z"
    }, head);

    [
      "M-33 -232 C-50 -218 -42 -198 -55 -184",
      "M-12 -241 C-29 -221 -19 -196 -33 -178",
      "M35 -228 C52 -214 46 -190 60 -174",
      "M70 -216 C99 -198 91 -166 63 -149",
      "M95 -200 C122 -181 106 -148 78 -137"
    ].forEach(function (d) {
      strands.push(svgEl("path", { class: "girl-hair-strand", d: d }, head));
    });

    return {
      group: group,
      pose: pose,
      head: head,
      ponytail: ponytail,
      strands: strands,
      leftArm: leftArm,
      rightArmRelaxed: rightArmRelaxed,
      rightArmScratch: rightArmScratch
    };
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

  function renderProfile(options) {
    var girl = scene.profileGirl;
    var opacity = clamp(options.opacity || 0, 0, 1);
    var x = Number.isFinite(options.x) ? options.x : state.currentX;
    var elapsed = options.elapsed || 0;
    var run = Boolean(options.run);
    var peek = Boolean(options.peek);
    var shudder = options.shudder || 0;
    var lookDown = options.lookDown || 0;
    var cycle = elapsed * (run ? 0.026 : peek ? 0.004 : 0.0095);
    var step = Math.sin(cycle);
    var counterStep = Math.sin(cycle + Math.PI);
    var bob = peek ? 0 : Math.abs(Math.sin(cycle)) * (run ? 8 : 3.8);
    var lean = run ? -13 : peek ? -7 : 0;
    var shudderOffset = shudder ? Math.sin(elapsed * 0.07) * 4.5 * shudder : 0;
    var shudderAngle = shudder ? Math.sin(elapsed * 0.105) * 3.2 * shudder : 0;
    var headTilt = lookDown * 13 + (run ? -3 : 0) + shudderAngle * 0.6;
    var ponyLag = run ? 20 : 8;

    girl.group.style.opacity = opacity.toFixed(3);
    girl.legs.style.opacity = peek ? "0" : "1";

    if (opacity <= 0.002) {
      state.currentProfileOpacity = 0;
      return;
    }

    setTransform(girl.group, "translate(" + (x + shudderOffset).toFixed(2) + " " + (layout.groundY + bob).toFixed(2) + ") scale(" + layout.scale.toFixed(4) + ")");
    setTransform(girl.pose, "rotate(" + (lean + shudderAngle).toFixed(2) + " 0 -120)");
    setTransform(girl.frontLeg, "rotate(" + (step * (run ? 40 : 22)).toFixed(2) + " 18 -78)");
    setTransform(girl.backLeg, "rotate(" + (counterStep * (run ? 36 : 19)).toFixed(2) + " -7 -78)");
    setTransform(girl.frontArm, "rotate(" + (counterStep * (run ? 28 : 13)).toFixed(2) + " 24 -146)");
    setTransform(girl.backArm, "rotate(" + (step * (run ? 30 : 12)).toFixed(2) + " -18 -146)");
    setTransform(girl.head, "rotate(" + headTilt.toFixed(2) + " -4 -192)");
    setTransform(girl.ponytail, "translate(" + (Math.abs(step) * ponyLag).toFixed(2) + " " + (run ? -3 : 0) + ") rotate(" + (-step * (run ? 7 : 3.5) - lookDown * 2).toFixed(2) + " 42 -194)");
    girl.strands.forEach(function (strand, index) {
      setTransform(strand, "translate(" + (Math.sin(cycle + index) * (run ? 4.8 : 2.1)).toFixed(2) + " " + (Math.cos(cycle * 0.7 + index) * 1.2).toFixed(2) + ")");
    });

    state.currentX = x;
    state.currentProfileOpacity = opacity;
    state.currentMode = run ? "run" : peek ? "peek" : "walk";
  }

  function renderFront(options) {
    var girl = scene.frontGirl;
    var opacity = clamp(options.opacity || 0, 0, 1);
    var elapsed = options.elapsed || 0;
    var scratch = options.scratch || 0;
    var lookDown = options.lookDown || 0;
    var shudder = options.shudder || 0;
    var breathe = Math.sin(elapsed * 0.002) * 1.2;
    var shudderOffset = shudder ? Math.sin(elapsed * 0.08) * 4 * shudder : 0;
    var shudderAngle = shudder ? Math.sin(elapsed * 0.11) * 3 * shudder : 0;
    var headTilt = lookDown * 9 + shudderAngle + scratch * 3;

    girl.group.style.opacity = opacity.toFixed(3);

    if (opacity <= 0.002) {
      state.currentFrontOpacity = 0;
      return;
    }

    setTransform(girl.group, "translate(" + (layout.centerX + shudderOffset).toFixed(2) + " " + (layout.groundY + breathe).toFixed(2) + ") scale(" + layout.scale.toFixed(4) + ")");
    setTransform(girl.pose, "rotate(" + shudderAngle.toFixed(2) + " 0 -120)");
    setTransform(girl.head, "rotate(" + headTilt.toFixed(2) + " 0 -194)");
    setTransform(girl.ponytail, "translate(" + (shudder * 5).toFixed(2) + " " + (-scratch * 2).toFixed(2) + ") rotate(" + (-scratch * 5 + shudderAngle).toFixed(2) + " 42 -194)");
    girl.leftArm.setAttribute("transform", "rotate(" + (-scratch * 4).toFixed(2) + " -34 -145)");
    girl.rightArmRelaxed.style.opacity = (1 - scratch).toFixed(3);
    girl.rightArmScratch.style.opacity = scratch.toFixed(3);
    girl.rightArmScratch.setAttribute("transform", "translate(0 " + (-scratch * 2).toFixed(2) + ")");
    girl.strands.forEach(function (strand, index) {
      setTransform(strand, "translate(" + (Math.sin(elapsed * 0.005 + index) * (1.5 + scratch * 2)).toFixed(2) + " " + (Math.cos(elapsed * 0.004 + index) * 1.1).toFixed(2) + ")");
    });

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
    scene.profileGirl.group.style.opacity = "0";
    scene.frontGirl.group.style.opacity = "0";
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
    var actorHeight = clamp(height * 0.73, 190, Math.min(354, height * 0.86));
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
