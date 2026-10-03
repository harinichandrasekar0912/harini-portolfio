(function () {
  "use strict";

  var root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  var NS = "http://www.w3.org/2000/svg";
  var PROFILE_BOUNDS = { minX: -58, maxX: 92 };
  var BASE_HEIGHT = 226;
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
      d: "M-10 -78 C-21 -56 -23 -29 -18 -8 C-15 -3 -8 -3 -5 -9 C-7 -31 -3 -56 7 -76 C3 -82 -6 -83 -10 -78 Z"
    }, backLeg);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-18 -8 C-33 -5 -39 2 -28 6 L-5 6 C2 3 0 -3 -9 -6 C-12 -7 -15 -8 -18 -8 Z"
    }, backLeg);

    var frontLeg = svgEl("g", { class: "profile-leg profile-leg-front" }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M12 -78 C23 -55 30 -30 31 -9 C35 -5 43 -7 44 -14 C39 -38 31 -62 21 -79 C18 -84 12 -83 12 -78 Z"
    }, frontLeg);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M36 -13 C50 -14 58 -10 59 -3 C48 3 34 5 22 2 C18 -1 21 -8 29 -11 C31 -12 34 -13 36 -13 Z"
    }, frontLeg);

    var backArm = svgEl("g", { class: "profile-arm profile-arm-back" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-18 -148 C-31 -128 -37 -103 -34 -83 C-30 -78 -23 -79 -21 -87 C-22 -106 -12 -128 3 -143 C0 -150 -12 -153 -18 -148 Z"
    }, backArm);

    var frontArm = svgEl("g", { class: "profile-arm profile-arm-front" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M19 -148 C34 -128 43 -105 44 -86 C48 -81 57 -82 58 -90 C54 -113 43 -136 28 -152 C23 -154 18 -153 19 -148 Z"
    }, frontArm);

    svgEl("path", {
      class: "girl-silhouette profile-dress",
      d: "M-16 -156 C-28 -134 -34 -101 -36 -72 C-17 -62 14 -62 38 -74 C34 -106 26 -137 12 -156 C5 -162 -9 -162 -16 -156 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-7 -184 L8 -184 L10 -154 C5 -151 -4 -151 -9 -154 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-14 -218 C0 -231 22 -227 30 -208 C37 -190 27 -172 9 -166 C-8 -161 -23 -170 -28 -185 C-37 -186 -40 -192 -30 -196 C-29 -206 -24 -214 -14 -218 Z"
    }, head);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-27 -198 C-36 -196 -39 -191 -30 -187 C-27 -176 -18 -167 -6 -164 C-18 -164 -30 -172 -35 -185 C-43 -187 -45 -194 -36 -200 Z"
    }, head);
    var ponytail = svgEl("path", {
      class: "girl-silhouette profile-ponytail",
      d: "M28 -205 C48 -219 72 -211 75 -193 C78 -176 60 -163 38 -167 C50 -175 57 -187 53 -198 C49 -208 38 -211 28 -205 Z"
    }, head);

    [
      "M-20 -221 C-31 -211 -29 -195 -40 -183",
      "M-7 -229 C-18 -213 -12 -193 -23 -176",
      "M24 -213 C35 -205 33 -190 43 -178",
      "M35 -210 C50 -205 51 -190 43 -177",
      "M46 -214 C68 -207 68 -181 51 -161",
      "M58 -207 C80 -194 69 -168 51 -154",
      "M68 -195 C82 -181 71 -162 57 -153",
      "M34 -201 C45 -198 47 -189 43 -181",
      "M-27 -204 C-37 -199 -37 -190 -45 -184"
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
      d: "M-22 -76 C-29 -52 -31 -28 -28 -8 C-24 -3 -16 -4 -13 -11 C-14 -34 -11 -56 -4 -75 C-9 -81 -18 -81 -22 -76 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M7 -75 C15 -53 18 -29 16 -9 C20 -4 29 -5 32 -12 C31 -35 26 -57 18 -76 C14 -82 7 -81 7 -75 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-26 -8 C-41 -5 -45 3 -32 6 L-13 6 C-7 3 -10 -3 -18 -6 C-21 -7 -24 -8 -26 -8 Z"
    }, legs);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M25 -11 C40 -12 47 -8 48 -1 C38 5 24 6 13 3 C10 0 13 -7 20 -10 C22 -11 24 -11 25 -11 Z"
    }, legs);

    var leftArm = svgEl("g", { class: "front-arm front-arm-left" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-30 -146 C-40 -124 -44 -101 -40 -84 C-36 -79 -29 -80 -28 -88 C-31 -106 -27 -126 -17 -142 C-20 -149 -27 -151 -30 -146 Z"
    }, leftArm);

    var rightArmRelaxed = svgEl("g", { class: "front-arm front-arm-right-relaxed" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M29 -146 C40 -124 45 -101 41 -84 C37 -78 29 -80 28 -88 C31 -107 26 -126 17 -142 C20 -149 27 -151 29 -146 Z"
    }, rightArmRelaxed);

    var rightArmScratch = svgEl("g", { class: "front-arm front-arm-right-scratch" }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M29 -146 C48 -154 50 -178 36 -194 C29 -196 25 -189 27 -183 C34 -176 34 -165 22 -157 C21 -151 25 -146 29 -146 Z"
    }, rightArmScratch);
    svgEl("circle", { class: "girl-silhouette", cx: "36", cy: "-195", r: "4.2" }, rightArmScratch);

    svgEl("path", {
      class: "girl-silhouette",
      d: "M-22 -158 C-36 -132 -44 -97 -46 -66 C-24 -53 15 -53 45 -67 C42 -104 34 -136 20 -158 C9 -166 -12 -166 -22 -158 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-9 -184 L10 -184 L12 -156 C5 -153 -5 -153 -11 -156 Z"
    }, body);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-24 -214 C-17 -238 18 -243 34 -221 C48 -203 41 -176 20 -164 C-5 -152 -31 -168 -34 -194 C-35 -203 -31 -210 -24 -214 Z"
    }, head);
    var ponytail = svgEl("path", {
      class: "girl-silhouette front-ponytail",
      d: "M30 -209 C52 -222 70 -209 68 -191 C66 -174 53 -163 35 -166 C44 -175 46 -190 38 -200 C35 -204 32 -207 30 -209 Z"
    }, head);
    svgEl("path", {
      class: "girl-silhouette",
      d: "M-20 -218 C-2 -234 25 -228 34 -205 C42 -183 27 -162 3 -162 C-19 -162 -35 -177 -35 -196 C-35 -206 -29 -214 -20 -218 Z"
    }, head);

    [
      "M-24 -226 C-38 -214 -33 -197 -44 -183",
      "M-7 -235 C-20 -218 -12 -197 -24 -180",
      "M26 -222 C39 -212 35 -193 45 -179",
      "M45 -212 C66 -201 60 -175 43 -159",
      "M58 -201 C74 -186 64 -166 49 -154",
      "M34 -204 C44 -198 43 -187 38 -178",
      "M-31 -207 C-39 -200 -37 -190 -45 -184"
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
