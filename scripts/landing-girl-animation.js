(function () {
  "use strict";

  const root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  const VIEWBOX = { width: 1920, height: 620 };
  const DURATION = 30000;
  const NS = "http://www.w3.org/2000/svg";
  const STAGE_WIDTH = VIEWBOX.width;
  const GROUND_Y = 480;
  const GIRL_CENTER_X = STAGE_WIDTH / 2;
  const GIRL_OFFSCREEN_RIGHT = STAGE_WIDTH + 180;
  const GIRL_OFFSCREEN_LEFT = -180;
  const GIRL_PEEK_X = STAGE_WIDTH - 70;
  const THOUGHT_CX = GIRL_CENTER_X;
  const THOUGHT_CY = 305;
  const INTERRUPT_DURATION = 3400;
  const INTERRUPT_RUN_START = 900;
  const INTERRUPT_RUN_END = 2700;

  const TIMING = {
    emptyEnd: 1200,
    walkInStart: 1200,
    walkInEnd: 5800,
    settleStart: 5800,
    settleEnd: 7000,
    threadStart: 7000,
    threadEnd: 8700,
    loopsStart: 8700,
    loopsEnd: 10500,
    designStart: 10500,
    designEnd: 14000,
    hobbyStart: 13200,
    hobbyEnd: 15500,
    vortexStart: 15500,
    vortexEnd: 19500,
    ballStart: 19500,
    impact: 20000,
    collapseStart: 20000,
    collapseEnd: 22400,
    recoverStart: 21900,
    recoverEnd: 24000,
    walkOutStart: 24700,
    walkOutEnd: 27000,
    emptyAfterExitStart: 27000,
    peekInStart: 27700,
    peekInEnd: 28600,
    peekOutEnd: 29200,
    resetEnd: 30000
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPhone = window.matchMedia("(max-width: 767px)").matches;
  const isTablet = window.matchMedia("(min-width: 768px) and (max-width: 1180px)").matches;

  const config = {
    width: VIEWBOX.width,
    height: VIEWBOX.height,
    duration: DURATION,
    density: isPhone ? 0.52 : isTablet ? 0.78 : 1
  };

  const state = createSceneState(config);
  const scene = createScene(root, config, state);
  const landingSection = document.getElementById("landing") || root.closest("section");
  const plusDistraction = {
    active: false,
    startTime: 0,
    duration: 1200
  };
  const interruptState = {
    active: false,
    startTime: 0,
    frozenElapsed: 0,
    startX: GIRL_CENTER_X,
    promise: null,
    resolve: null,
    completed: false
  };

  let startTime = performance.now();
  let frameId = 0;
  let currentElapsed = 0;
  let isLandingVisible = measureLandingVisible();

  window.landingGirlAnimation = {
    isLandingActive: isLandingActive,
    isPlaying: isPlaying,
    restart: restart,
    pause: pause,
    resume: resume,
    handlePlusDistraction: handlePlusDistraction,
    interruptForNavigation: interruptForNavigation
  };

  window.addEventListener("landing-nav-plus-opened", handlePlusDistraction);
  window.addEventListener("landing-nav-circle-selected", function () {
    interruptForNavigation();
  });

  setupVisibilityObserver();

  if (prefersReducedMotion) {
    renderStaticScene(scene, state, config);
  } else if (isLandingVisible) {
    restart();
  } else {
    renderFrame(scene, state, 0, config, performance.now());
  }

  function tick(now) {
    if (!isLandingVisible && !interruptState.active) {
      frameId = 0;
      return;
    }

    if (interruptState.active) {
      const interruptElapsed = now - interruptState.startTime;
      renderInterruptFrame(scene, state, interruptElapsed, config, now);

      if (interruptElapsed >= INTERRUPT_DURATION) {
        completeInterrupt();
        return;
      }

      frameId = requestAnimationFrame(tick);
      return;
    }

    currentElapsed = (now - startTime) % config.duration;
    renderFrame(scene, state, currentElapsed, config, now);
    frameId = requestAnimationFrame(tick);
  }

  window.addEventListener("pagehide", function () {
    pause();
  });

  function setupVisibilityObserver() {
    if (!landingSection || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;

        if (visible === isLandingVisible) {
          return;
        }

        isLandingVisible = visible;

        if (visible) {
          restart();
          return;
        }

        if (interruptState.active) {
          completeInterrupt();
        }

        pause();
        resetRuntimeState(false);
      });
    }, {
      threshold: [0, 0.35, 0.5]
    });

    observer.observe(landingSection);
  }

  function measureLandingVisible() {
    if (!landingSection) {
      return true;
    }

    const rect = landingSection.getBoundingClientRect();
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;

    return visibleHeight > 0 && ratio >= 0.35;
  }

  function isLandingActive() {
    return isLandingVisible && !interruptState.completed;
  }

  function isPlaying() {
    return Boolean(frameId) && isLandingVisible && !prefersReducedMotion;
  }

  function startLoop() {
    if (prefersReducedMotion || frameId) {
      return;
    }

    frameId = requestAnimationFrame(tick);
  }

  function pause() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function resume() {
    if (!isLandingVisible || prefersReducedMotion) {
      return;
    }

    startLoop();
  }

  function restart() {
    pause();
    resetRuntimeState(true);
    startTime = performance.now();
    currentElapsed = 0;

    if (prefersReducedMotion) {
      renderStaticScene(scene, state, config);
      return;
    }

    renderFrame(scene, state, 0, config, startTime);

    if (isLandingVisible) {
      startLoop();
    }
  }

  function resetRuntimeState(resolvePending) {
    plusDistraction.active = false;
    plusDistraction.startTime = 0;
    resetInterruptState(resolvePending);
  }

  function resetInterruptState(resolvePending) {
    if (resolvePending && interruptState.resolve) {
      interruptState.resolve();
    }

    interruptState.active = false;
    interruptState.startTime = 0;
    interruptState.frozenElapsed = 0;
    interruptState.startX = GIRL_CENTER_X;
    interruptState.promise = null;
    interruptState.resolve = null;
    interruptState.completed = false;
  }

  function handlePlusDistraction() {
    if (!isLandingActive() || interruptState.active || prefersReducedMotion) {
      return;
    }

    plusDistraction.active = true;
    plusDistraction.startTime = performance.now();
  }

  function interruptForNavigation() {
    if (!isLandingActive()) {
      return Promise.resolve();
    }

    if (prefersReducedMotion) {
      pause();
      interruptState.completed = true;

      return new Promise(function (resolve) {
        window.setTimeout(resolve, 360);
      });
    }

    if (interruptState.active && interruptState.promise) {
      return interruptState.promise;
    }

    const now = performance.now();
    const frozenGirlState = getGirlState(currentElapsed);

    plusDistraction.active = false;
    interruptState.active = true;
    interruptState.completed = false;
    interruptState.startTime = now;
    interruptState.frozenElapsed = currentElapsed;
    interruptState.startX = Number.isFinite(frozenGirlState.x) ? frozenGirlState.x : GIRL_CENTER_X;
    interruptState.promise = new Promise(function (resolve) {
      interruptState.resolve = resolve;
    });

    startLoop();
    return interruptState.promise;
  }

  function completeInterrupt() {
    renderInterruptFrame(scene, state, INTERRUPT_DURATION, config, performance.now());
    pause();
    interruptState.active = false;
    interruptState.completed = true;

    if (interruptState.resolve) {
      interruptState.resolve();
    }

    interruptState.resolve = null;
    interruptState.promise = null;
  }

  function createSceneState(sceneConfig) {
    const rng = createSeededRandom(42);
    const threadPaths = [
      {
        id: "first-thread",
        layer: "behind",
        start: TIMING.threadStart,
        draw: 1450,
        opacity: 0.76,
        soft: false,
        width: 1.25,
        d: "M972 294 C1040 248 1128 264 1178 210 C1250 132 1412 154 1532 226"
      },
      {
        id: "waist-ribbon-front",
        layer: "front",
        start: TIMING.loopsStart,
        draw: 1850,
        opacity: 0.64,
        soft: true,
        width: 2.35,
        d: "M332 446 C536 348 760 332 1014 374 C1226 410 1398 364 1608 258"
      },
      {
        id: "main-fluid-left",
        layer: "behind",
        start: TIMING.loopsStart + 220,
        draw: 1700,
        opacity: 0.5,
        soft: true,
        width: 1.45,
        d: "M410 398 C580 214 924 166 1248 250 C1490 314 1512 452 1252 500 C968 553 610 510 410 398"
      },
      {
        id: "high-orbit-right",
        layer: "front",
        start: TIMING.loopsStart + 520,
        draw: 1750,
        opacity: 0.34,
        soft: true,
        width: 1,
        d: "M642 226 C820 102 1152 132 1398 302 C1542 402 1452 518 1190 494"
      },
      {
        id: "low-dream-return",
        layer: "behind",
        start: TIMING.loopsStart + 820,
        draw: 1600,
        opacity: 0.28,
        soft: true,
        width: 0.86,
        d: "M1568 444 C1320 380 1102 398 828 484 C650 540 450 518 302 440"
      },
      {
        id: "wide-process-sweep",
        layer: "behind",
        start: TIMING.designStart + 120,
        draw: 1700,
        opacity: 0.42,
        soft: true,
        width: 1.65,
        d: "M278 412 C512 260 760 188 1044 198 C1290 206 1498 250 1680 358"
      },
      {
        id: "dotted-orbit-a",
        layer: "front",
        start: TIMING.designStart + 680,
        draw: 1550,
        opacity: 0.42,
        soft: true,
        dotted: true,
        width: 1.15,
        d: "M478 270 C690 382 990 402 1306 246 C1438 182 1538 218 1612 292"
      },
      {
        id: "dotted-orbit-b",
        layer: "behind",
        start: TIMING.hobbyStart - 650,
        draw: 1500,
        opacity: 0.32,
        soft: true,
        dotted: true,
        width: 0.95,
        d: "M1568 184 C1322 132 1138 206 914 338 C734 444 560 460 390 388"
      },
      {
        id: "pencil-tail-sweep",
        layer: "front",
        start: TIMING.hobbyStart + 250,
        draw: 1550,
        opacity: 0.24,
        soft: true,
        width: 0.78,
        d: "M214 314 C454 230 660 260 834 368 C1012 482 1262 486 1734 306"
      }
    ];

    for (let i = 0; i < 14; i += 1) {
      threadPaths.push({
        id: "vortex-" + i,
        layer: i % 3 === 0 ? "front" : "behind",
        start: TIMING.vortexStart + i * 105,
        draw: 1800,
        opacity: i % 3 === 0 ? 0.24 : 0.34,
        soft: i % 4 === 0,
        dotted: i === 4 || i === 11,
        width: seededRange(i + 4, 0.7, 2.6),
        d: spiralPath(i),
        spin: seededRange(i + 8, -0.38, 0.54),
        scatterX: seededRange(i + 21, -340, 360),
        scatterY: seededRange(i + 34, -90, 190)
      });
    }

    const designIcons = [
      iconSpec("sketchbook", -360, -126, 0.8, TIMING.designStart, 144, 54, 0.48, rng),
      iconSpec("floor-plan", -518, 64, 1.04, TIMING.designStart + 330, 150, 52, -0.42, rng),
      iconSpec("perspective", 360, -108, 0.82, TIMING.designStart + 650, 148, 54, 0.46, rng),
      iconSpec("laptop", 486, 18, 0.74, TIMING.designStart + 960, 170, 60, -0.32, rng),
      iconSpec("tablet", 178, 96, 0.68, TIMING.designStart + 1240, 136, 50, 0.38, rng),
      iconSpec("pencil", 554, 92, 0.68, TIMING.designStart + 1480, 168, 60, -0.36, rng),
      iconSpec("iteration", 12, -172, 0.74, TIMING.designStart + 1720, 128, 42, 0.54, rng),
      iconSpec("panels", -126, 154, 0.78, TIMING.designStart + 2020, 150, 58, -0.5, rng),
      iconSpec("sketch-panel", -602, -76, 0.76, TIMING.designStart + 2300, 170, 56, 0.34, rng),
      iconSpec("cube", 288, 154, 0.66, TIMING.designStart + 2560, 132, 48, 0.4, rng),
      iconSpec("model", -296, 138, 0.68, TIMING.designStart + 2840, 142, 50, -0.48, rng),
      iconSpec("massing", 420, -164, 0.66, TIMING.designStart + 3120, 150, 54, 0.42, rng),
      iconSpec("grid-fragment", -650, 150, 0.72, TIMING.designStart + 3440, 178, 66, -0.34, rng),
      iconSpec("loose-page", 628, -86, 0.58, TIMING.designStart + 3700, 178, 58, 0.32, rng)
    ];

    const hobbyIcons = [
      iconSpec("chai", 560, -22, 0.52, TIMING.hobbyStart, 190, 68, 0.38, rng),
      iconSpec("book", -604, -12, 0.54, TIMING.hobbyStart + 520, 186, 62, -0.34, rng),
      iconSpec("book", -454, 92, 0.44, TIMING.hobbyStart + 880, 176, 58, -0.26, rng),
      iconSpec("tennis", 540, 146, 0.48, TIMING.hobbyStart + 1160, 200, 74, 0.45, rng),
      iconSpec("tennis-ball", 684, 78, 0.42, TIMING.hobbyStart + 1460, 202, 74, 0.44, rng),
      iconSpec("reading", -524, 146, 0.44, TIMING.hobbyStart + 1780, 176, 64, -0.46, rng),
      iconSpec("chai", 392, 180, 0.42, TIMING.hobbyStart + 2100, 170, 60, 0.31, rng),
      iconSpec("loose-page", -690, -170, 0.46, TIMING.hobbyStart + 2360, 212, 70, -0.27, rng)
    ];

    const thoughtOrigins = iconParticleOrigins(designIcons.concat(hobbyIcons), threadPaths);
    const particleCount = Math.round(150 * sceneConfig.density);
    const particles = [];

    for (let i = 0; i < particleCount; i += 1) {
      const origin = thoughtOrigins[i % thoughtOrigins.length];
      const angle = rng() * Math.PI * 2;
      const shape = rng() > 0.38 ? "square" : "dot";

      particles.push({
        originX: origin.x + lerp(-34, 34, rng()),
        originY: origin.y + lerp(-26, 26, rng()),
        scatterX: Math.cos(angle) * lerp(120, 420, rng()),
        scatterY: Math.sin(angle) * lerp(30, 190, rng()) - lerp(0, 78, rng()),
        gravity: lerp(520, 840, rng()),
        size: lerp(1.5, 8, rng()),
        shape: shape,
        angle: angle,
        orbit: lerp(8, 42, rng()),
        speed: lerp(-0.52, 0.56, rng()) || 0.18,
        rotation: lerp(-160, 160, rng()),
        rotationSpeed: lerp(-260, 260, rng()),
        opacity: lerp(0.28, 0.72, rng()),
        delay: lerp(0, 0.22, rng())
      });
    }

    return {
      rng: rng,
      threadPaths: threadPaths,
      designIcons: designIcons,
      hobbyIcons: hobbyIcons,
      particles: particles
    };
  }

  function createScene(container, sceneConfig, sceneState) {
    container.textContent = "";

    const svg = svgEl("svg", {
      class: "landing-girl-svg",
      viewBox: "0 0 " + sceneConfig.width + " " + sceneConfig.height,
      preserveAspectRatio: "xMidYMid meet",
      focusable: "false",
      "aria-hidden": "true"
    }, container);

    const layers = {
      behind: svgEl("g", { class: "thoughts-behind" }, svg),
      girl: svgEl("g", { class: "girl-layer" }, svg),
      front: svgEl("g", { class: "thoughts-front" }, svg),
      particles: svgEl("g", { class: "particle-layer" }, svg),
      impact: svgEl("g", { class: "impact-layer" }, svg)
    };

    const scene = {
      svg: svg,
      layers: layers
    };

    scene.thoughtPaths = createThoughtPaths(scene, sceneState);
    scene.threadDot = svgEl("circle", { class: "thought-dot", r: "4.2" }, layers.front);
    scene.girl = createGirl(scene);
    scene.designIcons = createDesignIcons(scene, sceneState);
    scene.hobbyIcons = createHobbyIcons(scene, sceneState);
    scene.particles = createParticles(scene, sceneState);
    scene.ball = createBall(scene);

    return scene;
  }

  function createGirl(scene) {
    const shadow = svgEl("ellipse", {
      class: "girl-shadow",
      cx: "0",
      cy: "0",
      rx: "40",
      ry: "5"
    }, scene.layers.girl);
    const group = svgEl("g", { class: "landing-girl" }, scene.layers.girl);
    const profile = svgEl("g", { class: "girl-profile" }, group);
    const profileLegs = svgEl("g", { class: "girl-legs profile-legs" }, profile);
    const profileBody = svgEl("g", { class: "girl-body profile-body" }, profile);
    const profileHead = svgEl("g", { class: "girl-head profile-head" }, profileBody);
    const front = svgEl("g", { class: "girl-front" }, group);
    const frontLegs = svgEl("g", { class: "girl-legs front-legs" }, front);
    const frontBody = svgEl("g", { class: "girl-body front-body" }, front);
    const frontHead = svgEl("g", { class: "girl-head front-head" }, frontBody);

    const profileLegBack = svgEl("path", {
      class: "girl-limb profile-leg-back",
      d: "M-10 -76 C-22 -54 -27 -29 -27 -9 C-22 -4 -12 -5 -8 -12 C-8 -32 -2 -52 10 -72 C6 -78 -4 -80 -10 -76 Z"
    }, profileLegs);
    const profileLegFront = svgEl("path", {
      class: "girl-limb profile-leg-front",
      d: "M16 -75 C32 -54 40 -31 39 -9 C45 -4 56 -5 61 -13 C58 -38 45 -61 27 -79 C22 -81 16 -80 16 -75 Z"
    }, profileLegs);
    const profileFootBack = svgEl("ellipse", {
      class: "girl-foot profile-foot-back",
      cx: "-25",
      cy: "-3",
      rx: "21",
      ry: "5.4"
    }, profileLegs);
    const profileFootFront = svgEl("ellipse", {
      class: "girl-foot profile-foot-front",
      cx: "59",
      cy: "-3",
      rx: "24",
      ry: "5.6"
    }, profileLegs);
    const profileArmBack = svgEl("path", {
      class: "girl-limb profile-arm-back",
      d: "M-14 -144 C-30 -124 -38 -98 -37 -78 C-32 -72 -22 -74 -20 -83 C-19 -102 -10 -122 6 -138 C3 -146 -8 -149 -14 -144 Z"
    }, profileBody);
    const profileArmFront = svgEl("path", {
      class: "girl-limb profile-arm-front",
      d: "M22 -142 C39 -124 48 -101 47 -81 C52 -74 62 -75 66 -84 C64 -106 51 -132 33 -149 C28 -150 22 -148 22 -142 Z"
    }, profileBody);

    svgEl("path", {
      class: "girl-fill profile-dress",
      d: "M-20 -156 C-36 -134 -45 -102 -51 -64 C-28 -48 8 -44 48 -61 C42 -104 30 -139 10 -158 C0 -164 -12 -163 -20 -156 Z"
    }, profileBody);
    svgEl("path", {
      class: "girl-fill profile-neck",
      d: "M-9 -176 L12 -175 L13 -150 L-8 -148 Z"
    }, profileBody);
    svgEl("path", {
      class: "girl-fill profile-hair",
      d: "M-26 -204 C-20 -234 16 -241 42 -218 C54 -202 48 -176 25 -163 C2 -151 -27 -170 -31 -193 C-32 -197 -30 -201 -26 -204 Z"
    }, profileHead);
    const profilePonytail = svgEl("path", {
      class: "girl-fill profile-ponytail",
      d: "M34 -206 C78 -226 122 -203 112 -176 C104 -152 75 -141 43 -160 C28 -169 31 -187 40 -196 C43 -200 40 -204 34 -206 Z"
    }, profileHead);
    svgEl("path", {
      class: "girl-fill profile-head-shape",
      d: "M-20 -218 C11 -231 39 -211 40 -184 C40 -161 15 -151 -7 -160 C-19 -165 -26 -174 -31 -186 C-42 -187 -45 -194 -34 -198 C-32 -207 -28 -214 -20 -218 Z"
    }, profileHead);
    const profileStrands = [
      svgEl("path", { class: "girl-strand", d: "M-28 -218 C-42 -205 -39 -190 -49 -178" }, profileHead),
      svgEl("path", { class: "girl-strand", d: "M-9 -228 C-20 -210 -15 -191 -26 -174" }, profileHead),
      svgEl("path", { class: "girl-strand", d: "M31 -210 C45 -198 38 -180 50 -166" }, profileHead),
      svgEl("path", { class: "girl-strand", d: "M76 -207 C104 -196 98 -166 72 -148" }, profileHead),
      svgEl("path", { class: "girl-strand", d: "M92 -196 C128 -180 112 -148 84 -137" }, profileHead)
    ];

    const frontLegLeft = svgEl("path", {
      class: "girl-limb front-leg-left",
      d: "M-28 -74 C-36 -50 -39 -26 -37 -8 C-31 -3 -20 -4 -16 -11 C-17 -32 -12 -54 -4 -72 C-11 -78 -22 -79 -28 -74 Z"
    }, frontLegs);
    const frontLegRight = svgEl("path", {
      class: "girl-limb front-leg-right",
      d: "M6 -72 C16 -51 20 -29 18 -9 C23 -4 34 -4 40 -10 C42 -31 36 -56 25 -76 C18 -80 9 -78 6 -72 Z"
    }, frontLegs);
    svgEl("ellipse", { class: "girl-foot front-foot-left", cx: "-39", cy: "-3", rx: "21", ry: "5.2" }, frontLegs);
    svgEl("ellipse", { class: "girl-foot front-foot-right", cx: "41", cy: "-3", rx: "21", ry: "5.2" }, frontLegs);
    const frontArmLeft = svgEl("path", {
      class: "girl-limb front-arm-left",
      d: "M-44 -146 C-58 -124 -66 -98 -66 -76 C-61 -69 -50 -70 -47 -80 C-45 -101 -36 -123 -24 -140 C-28 -148 -38 -151 -44 -146 Z"
    }, frontBody);
    const frontArmRight = svgEl("path", {
      class: "girl-limb front-arm-right",
      d: "M28 -140 C42 -122 51 -99 52 -79 C56 -70 67 -70 72 -78 C70 -101 60 -126 44 -146 C38 -151 30 -148 28 -140 Z"
    }, frontBody);
    svgEl("path", {
      class: "girl-fill front-dress",
      d: "M-34 -158 C-51 -132 -60 -100 -69 -58 C-44 -44 -12 -41 10 -44 C38 -46 62 -52 77 -62 C66 -104 54 -136 34 -158 C14 -168 -16 -168 -34 -158 Z"
    }, frontBody);
    svgEl("rect", { class: "girl-fill front-neck", x: "-11", y: "-177", width: "22", height: "28", rx: "7" }, frontBody);
    svgEl("path", {
      class: "girl-fill front-hair",
      d: "M-38 -204 C-34 -235 4 -244 34 -224 C55 -209 50 -174 25 -159 C2 -146 -34 -154 -44 -178 C-48 -188 -46 -198 -38 -204 Z"
    }, frontHead);
    const frontPonytail = svgEl("path", {
      class: "girl-fill front-ponytail",
      d: "M28 -211 C73 -226 94 -192 73 -166 C52 -140 15 -164 24 -194 C26 -202 28 -207 28 -211 Z"
    }, frontHead);
    svgEl("path", {
      class: "girl-fill front-head-shape",
      d: "M-26 -217 C-4 -235 31 -226 39 -197 C47 -168 24 -150 -3 -154 C-31 -158 -45 -185 -35 -204 C-32 -210 -30 -214 -26 -217 Z"
    }, frontHead);
    const frontStrands = [
      svgEl("path", { class: "girl-strand", d: "M-34 -216 C-50 -198 -38 -181 -50 -164" }, frontHead),
      svgEl("path", { class: "girl-strand", d: "M-10 -229 C-22 -204 -12 -184 -24 -164" }, frontHead),
      svgEl("path", { class: "girl-strand", d: "M20 -222 C8 -202 24 -181 8 -160" }, frontHead),
      svgEl("path", { class: "girl-strand", d: "M38 -204 C62 -190 52 -166 34 -150" }, frontHead),
      svgEl("path", { class: "girl-strand", d: "M59 -198 C90 -178 74 -146 46 -138" }, frontHead)
    ];

    return {
      shadow: shadow,
      group: group,
      profile: profile,
      profileLegs: profileLegs,
      profileBody: profileBody,
      profileHead: profileHead,
      profilePonytail: profilePonytail,
      profileStrands: profileStrands,
      profileLegBack: profileLegBack,
      profileLegFront: profileLegFront,
      profileFootBack: profileFootBack,
      profileFootFront: profileFootFront,
      profileArmBack: profileArmBack,
      profileArmFront: profileArmFront,
      front: front,
      frontLegs: frontLegs,
      frontBody: frontBody,
      frontHead: frontHead,
      frontPonytail: frontPonytail,
      frontStrands: frontStrands,
      frontLegLeft: frontLegLeft,
      frontLegRight: frontLegRight,
      frontArmLeft: frontArmLeft,
      frontArmRight: frontArmRight
    };
  }

  function createThoughtPaths(scene, sceneState) {
    return sceneState.threadPaths.map(function (spec, index) {
      const parent = spec.layer === "front" ? scene.layers.front : scene.layers.behind;
      const element = svgEl("path", {
        class: "thought-line" + (spec.soft ? " is-soft" : "") + (spec.dotted ? " is-dotted" : ""),
        d: spec.d,
        pathLength: "1"
      }, parent);

      element.style.setProperty("--line-width", (spec.width || 1.15) + "px");
      element.style.strokeDasharray = spec.dotted ? "0.018 0.055" : "1";
      element.style.strokeDashoffset = "1";

      return {
        element: element,
        index: index,
        start: spec.start,
        draw: spec.draw,
        opacity: spec.opacity,
        dotted: Boolean(spec.dotted),
        spin: spec.spin || seededRange(index + 4, -0.4, 0.55),
        scatterX: spec.scatterX || seededRange(index + 10, -110, 120),
        scatterY: spec.scatterY || seededRange(index + 20, -36, 120)
      };
    });
  }

  function createDesignIcons(scene, sceneState) {
    return sceneState.designIcons.map(function (spec, index) {
      const group = svgEl("g", { class: "thought-icon design-icon design-icon-" + spec.type }, spec.layer === "front" ? scene.layers.front : scene.layers.behind);
      buildIcon(spec.type, group);
      return Object.assign({ element: group, index: index, category: "design" }, spec);
    });
  }

  function createHobbyIcons(scene, sceneState) {
    return sceneState.hobbyIcons.map(function (spec, index) {
      const group = svgEl("g", { class: "thought-icon hobby-icon hobby-icon-" + spec.type }, spec.layer === "front" ? scene.layers.front : scene.layers.behind);
      buildIcon(spec.type, group);
      return Object.assign({ element: group, index: index, category: "hobby" }, spec);
    });
  }

  function createParticles(scene, sceneState) {
    return sceneState.particles.map(function (spec) {
      const element = spec.shape === "square"
        ? svgEl("rect", { class: "particle", width: spec.size, height: spec.size, rx: spec.size > 4.8 ? "1" : "0" }, scene.layers.particles)
        : svgEl("circle", { class: "particle", r: spec.size * 0.46 }, scene.layers.particles);

      return Object.assign({ element: element }, spec);
    });
  }

  function createBall(scene) {
    const group = svgEl("g", { class: "reset-ball-group" }, scene.layers.impact);
    const ball = svgEl("circle", { class: "reset-ball", cx: "0", cy: "0", r: "9" }, group);
    const impact = svgEl("g", { class: "impact-mark" }, scene.layers.impact);

    svgEl("line", { class: "impact-line", x1: "0", y1: "-18", x2: "0", y2: "-38" }, impact);
    svgEl("line", { class: "impact-line", x1: "12", y1: "-11", x2: "30", y2: "-26" }, impact);
    svgEl("line", { class: "impact-line", x1: "-10", y1: "-10", x2: "-26", y2: "-24" }, impact);
    svgEl("path", { class: "impact-line", d: "M-7 -30 L0 -21 L8 -31" }, impact);

    return {
      group: group,
      ball: ball,
      impact: impact
    };
  }

  function getGirlState(elapsed) {
    const state = {
      x: GIRL_OFFSCREEN_RIGHT,
      y: GROUND_Y,
      opacity: 0,
      mode: "hidden",
      facing: "left",
      turnProgress: 0,
      walkPhase: elapsed * 0.0078,
      bodyBob: 0,
      headTilt: 0,
      impactAmount: 0,
      breathingAmount: 0,
      profileOpacity: 0,
      frontOpacity: 0,
      scratchProgress: 0,
      shakeProgress: 0,
      lean: 0,
      peekLean: 0,
      distractionAmount: 0
    };

    if (elapsed < TIMING.walkInStart) {
      return state;
    }

    if (elapsed < TIMING.walkInEnd) {
      const p = easeInOutCubic(phase(elapsed, TIMING.walkInStart, TIMING.walkInEnd));
      state.x = lerp(GIRL_OFFSCREEN_RIGHT, GIRL_CENTER_X, p);
      state.opacity = phase(elapsed, TIMING.walkInStart, TIMING.walkInStart + 420);
      state.profileOpacity = state.opacity;
      state.mode = "walkProfile";
      state.bodyBob = Math.abs(Math.sin(state.walkPhase)) * 1.9;
      return state;
    }

    if (elapsed < TIMING.settleEnd) {
      const settle = phase(elapsed, TIMING.settleStart, TIMING.settleEnd);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "settle";
      state.facing = "front";
      state.turnProgress = smoothstep(settle);
      state.walkPhase = elapsed * 0.0078;
      state.bodyBob = Math.sin(settle * Math.PI) * 2;
      state.profileOpacity = 1 - state.turnProgress;
      state.frontOpacity = state.turnProgress;
      return state;
    }

    if (elapsed < TIMING.impact) {
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "frontThinking";
      state.facing = "front";
      state.turnProgress = 1;
      state.frontOpacity = 1;
      state.walkPhase = Math.PI * 0.5;
      state.breathingAmount = Math.sin(elapsed * 0.0016) * 1.4;
      return state;
    }

    if (elapsed < TIMING.recoverEnd) {
      const scratch = phase(elapsed, TIMING.impact, TIMING.impact + 1300);
      const shake = phase(elapsed, TIMING.impact + 900, TIMING.recoverEnd);
      const hitIn = Math.sin(phase(elapsed, TIMING.impact, TIMING.impact + 220) * Math.PI);
      const hitOut = 1 - phase(elapsed, TIMING.impact + 220, TIMING.recoverEnd);
      const hit = Math.max(hitIn, hitOut * 0.68);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "owReaction";
      state.facing = "front";
      state.turnProgress = 1;
      state.frontOpacity = 1;
      state.walkPhase = Math.PI * 0.5;
      state.impactAmount = hit;
      state.scratchProgress = scratch;
      state.shakeProgress = shake;
      state.headTilt = -5.2 * hit + Math.sin(shake * Math.PI * 6) * 3.5 * (1 - shake);
      state.bodyBob = 3.2 * hit;
      state.lean = -2.6 * hit;
      return state;
    }

    if (elapsed < TIMING.walkOutStart) {
      const turn = phase(elapsed, TIMING.recoverEnd, TIMING.walkOutStart);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "recover";
      state.facing = "front";
      state.turnProgress = 1 - smoothstep(turn);
      state.frontOpacity = state.turnProgress;
      state.profileOpacity = 1 - state.turnProgress;
      state.walkPhase = Math.PI * 0.5;
      state.bodyBob = Math.sin(turn * Math.PI) * 1.1;
      return state;
    }

    if (elapsed < TIMING.walkOutEnd) {
      const p = easeInOutCubic(phase(elapsed, TIMING.walkOutStart, TIMING.walkOutEnd));
      state.x = lerp(GIRL_CENTER_X, GIRL_OFFSCREEN_LEFT, p);
      state.opacity = 1 - phase(elapsed, TIMING.walkOutEnd - 360, TIMING.walkOutEnd) * 0.65;
      state.profileOpacity = state.opacity;
      state.mode = "walkOutProfile";
      state.facing = "left";
      state.walkPhase = elapsed * 0.0078;
      state.bodyBob = Math.abs(Math.sin(state.walkPhase)) * 1.9;
      return state;
    }

    if (elapsed < TIMING.peekInStart) {
      return state;
    }

    if (elapsed < TIMING.peekInEnd) {
      const p = easeOutCubic(phase(elapsed, TIMING.peekInStart, TIMING.peekInEnd));
      state.x = lerp(GIRL_OFFSCREEN_RIGHT, GIRL_PEEK_X, p);
      state.opacity = phase(elapsed, TIMING.peekInStart, TIMING.peekInStart + 220);
      state.profileOpacity = state.opacity;
      state.mode = "peekProfile";
      state.walkPhase = Math.PI * 0.2;
      state.peekLean = -6 * p;
      return state;
    }

    if (elapsed < TIMING.peekOutEnd) {
      const p = easeInOutCubic(phase(elapsed, TIMING.peekInEnd, TIMING.peekOutEnd));
      state.x = lerp(GIRL_PEEK_X, GIRL_OFFSCREEN_RIGHT, p);
      state.opacity = 1 - phase(elapsed, TIMING.peekOutEnd - 180, TIMING.peekOutEnd);
      state.profileOpacity = state.opacity;
      state.mode = "peekProfile";
      state.walkPhase = Math.PI * 0.2;
      state.peekLean = -6 * (1 - p);
      return state;
    }

    return state;
  }

  function getInterruptGirlState(elapsed) {
    const snap = phase(elapsed, 0, 260);
    const turn = smoothstep(phase(elapsed, 220, INTERRUPT_RUN_START));
    const run = easeInCubic(phase(elapsed, INTERRUPT_RUN_START, INTERRUPT_RUN_END));
    const fade = 1 - phase(elapsed, INTERRUPT_RUN_END - 260, INTERRUPT_RUN_END);
    const runActive = elapsed >= INTERRUPT_RUN_START;
    const x = runActive
      ? lerp(interruptState.startX, GIRL_OFFSCREEN_LEFT - 70, run)
      : interruptState.startX;
    const opacity = clamp(fade, 0, 1);

    return {
      x: x,
      y: GROUND_Y,
      opacity: opacity,
      mode: runActive ? "interruptRunProfile" : "owReaction",
      facing: "left",
      turnProgress: turn,
      walkPhase: elapsed * 0.021,
      bodyBob: runActive ? Math.abs(Math.sin(elapsed * 0.021)) * 2.8 : Math.sin(snap * Math.PI) * 2.2,
      headTilt: runActive ? -2 : -6 * Math.sin(snap * Math.PI),
      impactAmount: runActive ? 0 : Math.sin(snap * Math.PI) * 0.38,
      breathingAmount: 0,
      profileOpacity: runActive ? opacity : opacity * turn,
      frontOpacity: runActive ? 0 : opacity * (1 - turn),
      scratchProgress: 0,
      shakeProgress: 0,
      lean: runActive ? -7 : -2.2 * Math.sin(snap * Math.PI),
      peekLean: 0,
      distractionAmount: 0
    };
  }

  function applyPlusDistraction(girlState, now) {
    if (!plusDistraction.active) {
      return girlState;
    }

    const t = phase(now, plusDistraction.startTime, plusDistraction.startTime + plusDistraction.duration);

    if (t >= 1) {
      plusDistraction.active = false;
      girlState.distractionAmount = 0;
      return girlState;
    }

    const baseAmount = Math.sin(t * Math.PI);
    const thinkingMode = girlState.mode === "frontThinking" || girlState.mode === "settle" || girlState.mode === "recover";
    girlState.distractionAmount = baseAmount * (thinkingMode ? 1 : 0.35);
    return girlState;
  }

  function renderGirl(scene, girlState) {
    const walk = girlState.mode === "walkProfile" || girlState.mode === "walkOutProfile" ? 1 : 0;
    const run = girlState.mode === "interruptRunProfile" ? 1 : 0;
    const peek = girlState.mode === "peekProfile" ? 1 : 0;
    const distraction = girlState.distractionAmount || 0;
    const breathing = girlState.breathingAmount;
    const y = girlState.y + girlState.bodyBob + breathing + distraction * 1.5;
    const swing = Math.sin(girlState.walkPhase) * (12 * walk + 21 * run);
    const footLift = Math.abs(Math.sin(girlState.walkPhase)) * (walk + run * 1.35);
    const scratchRaise = smoothstep(clamp(girlState.scratchProgress / 0.32, 0, 1)) * (1 - smoothstep(clamp((girlState.scratchProgress - 0.78) / 0.22, 0, 1)));
    const scratchRub = Math.sin(girlState.scratchProgress * Math.PI * 8) * scratchRaise;
    const frontArmEase = girlState.mode === "frontThinking" ? 2.4 : 0;
    const shadowOpacity = girlState.opacity * (girlState.mode === "hidden" ? 0 : 0.17);
    const shadowRx = 36 + footLift * 7 + peek * 2 + run * 4;

    scene.girl.group.style.opacity = girlState.opacity.toFixed(3);
    setTransform(
      scene.girl.group,
      "translate(" + girlState.x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + (girlState.lean + girlState.peekLean + distraction * 1.6).toFixed(2) + " 0 -96)"
    );

    scene.girl.profile.style.opacity = String(clamp(girlState.profileOpacity, 0, 1).toFixed(3));
    scene.girl.front.style.opacity = String(clamp(girlState.frontOpacity, 0, 1).toFixed(3));
    setAttrs(scene.girl.shadow, {
      cx: girlState.x.toFixed(2),
      cy: String(GROUND_Y + 3),
      rx: shadowRx.toFixed(2),
      ry: (4.5 + footLift * 1.8).toFixed(2)
    });
    scene.girl.shadow.style.opacity = shadowOpacity.toFixed(3);

    setTransform(scene.girl.profileArmBack, "rotate(" + (swing * 0.38).toFixed(2) + " -7 -132)");
    setTransform(scene.girl.profileArmFront, "rotate(" + (-swing * 0.58).toFixed(2) + " 26 -132)");
    setTransform(scene.girl.profileLegBack, "rotate(" + (-swing * 0.85).toFixed(2) + " -6 -64)");
    setTransform(scene.girl.profileLegFront, "rotate(" + (swing * 0.9).toFixed(2) + " 14 -64)");
    setTransform(
      scene.girl.profileFootBack,
      "translate(" + (-Math.sin(girlState.walkPhase) * (5 * walk + 11 * run)).toFixed(2) + " " + (Math.max(0, Math.cos(girlState.walkPhase)) * (-2.4 * walk - 5.6 * run)).toFixed(2) + ")"
    );
    setTransform(
      scene.girl.profileFootFront,
      "translate(" + (Math.sin(girlState.walkPhase) * (5 * walk + 11 * run)).toFixed(2) + " " + (Math.max(0, -Math.cos(girlState.walkPhase)) * (-2.4 * walk - 5.6 * run)).toFixed(2) + ")"
    );
    setTransform(
      scene.girl.profileHead,
      "translate(0 " + (girlState.impactAmount * 2 + distraction * 2).toFixed(2) + ") rotate(" + (girlState.headTilt + distraction * 8 + Math.sin(girlState.walkPhase) * 0.8 * (walk + run)).toFixed(2) + " 0 -164)"
    );
    setTransform(
      scene.girl.profilePonytail,
      "rotate(" + (Math.sin(girlState.walkPhase + 1.1) * (6 * walk + 11 * run) + girlState.impactAmount * 12 + girlState.peekLean * -0.4).toFixed(2) + " 26 -186)"
    );

    setTransform(scene.girl.frontLegLeft, "rotate(" + (-1.8 + girlState.impactAmount * 1.2).toFixed(2) + " -16 -64)");
    setTransform(scene.girl.frontLegRight, "rotate(" + (1.8 - girlState.impactAmount * 1.2).toFixed(2) + " 16 -64)");
    setTransform(scene.girl.frontArmLeft, "rotate(" + (-frontArmEase - girlState.impactAmount * 2).toFixed(2) + " -30 -132)");
    setTransform(
      scene.girl.frontArmRight,
      "rotate(" + (-112 * scratchRaise + frontArmEase + scratchRub * 5).toFixed(2) + " 31 -132) translate(" + (scratchRub * 1.2).toFixed(2) + " " + (-scratchRaise * 10).toFixed(2) + ")"
    );
    setTransform(
      scene.girl.frontHead,
      "translate(0 " + (girlState.impactAmount * 3 + distraction * 2).toFixed(2) + ") rotate(" + (girlState.headTilt + distraction * 8).toFixed(2) + " 0 -164)"
    );
    setTransform(
      scene.girl.frontPonytail,
      "rotate(" + (girlState.impactAmount * 16 + Math.sin(girlState.scratchProgress * Math.PI * 4) * scratchRaise * 4).toFixed(2) + " 23 -188)"
    );
  }

  function renderThoughts(scene, state, elapsed, sceneConfig, options) {
    const renderOptions = options || {};
    const vortexProgress = renderOptions.vortexProgress != null
      ? renderOptions.vortexProgress
      : phase(elapsed, TIMING.vortexStart, TIMING.vortexEnd);
    const disintegrateProgress = renderOptions.disintegrateProgress != null
      ? renderOptions.disintegrateProgress
      : phase(elapsed, TIMING.collapseStart, TIMING.collapseEnd);
    const resetProgress = renderOptions.resetProgress != null
      ? renderOptions.resetProgress
      : phase(elapsed, TIMING.collapseEnd, TIMING.recoverEnd);

    renderThreadDot(scene, elapsed, disintegrateProgress);
    renderPathItems(scene.thoughtPaths, elapsed, vortexProgress, disintegrateProgress, resetProgress);
    renderIconItems(scene.designIcons, elapsed, vortexProgress, disintegrateProgress, resetProgress);
    renderIconItems(scene.hobbyIcons, elapsed, vortexProgress, disintegrateProgress, resetProgress);
  }

  function renderThreadDot(scene, elapsed, disintegrateProgress) {
    const threadProgress = easeOutCubic(phase(elapsed, TIMING.threadStart, TIMING.threadEnd));
    const fade = 1 - phase(elapsed, TIMING.hobbyStart, TIMING.vortexStart);
    const dis = easeOutCubic(disintegrateProgress);
    const orbitProgress = phase(elapsed, TIMING.threadEnd, TIMING.vortexEnd);
    let point = cubicPoint(
      { x: GIRL_CENTER_X + 12, y: 300 },
      { x: GIRL_CENTER_X + 96, y: 250 },
      { x: GIRL_CENTER_X + 176, y: 292 },
      { x: GIRL_CENTER_X + 252, y: 220 },
      threadProgress
    );

    if (orbitProgress > 0) {
      const angle = elapsed * 0.001 + 0.7;
      point = {
        x: lerp(point.x, THOUGHT_CX + Math.cos(angle) * 360, orbitProgress * 0.72),
        y: lerp(point.y, THOUGHT_CY + Math.sin(angle) * 132, orbitProgress * 0.72)
      };
    }

    scene.threadDot.style.opacity = (threadProgress * fade * (1 - dis)).toFixed(3);
    setAttrs(scene.threadDot, {
      cx: point.x.toFixed(2),
      cy: point.y.toFixed(2)
    });
  }

  function renderPathItems(items, elapsed, vortexProgress, disintegrateProgress, resetProgress) {
    items.forEach(function (item) {
      const draw = easeOutCubic(phase(elapsed, item.start, item.start + item.draw));
      const dis = easeOutCubic(clamp((disintegrateProgress - item.index * 0.004) / 0.48, 0, 1));
      const opacity = item.opacity * draw * (0.72 + vortexProgress * 0.38) * (1 - dis) * (1 - resetProgress * 0.85);
      const wobbleX = Math.sin(elapsed * 0.0012 + item.index * 0.7) * (1.1 + vortexProgress * 3.6);
      const wobbleY = Math.cos(elapsed * 0.001 + item.index * 1.1) * (0.9 + vortexProgress * 2.8);
      const spin = vortexProgress * item.spin * 18;
      const scatterX = item.scatterX * dis;
      const scatterY = (item.scatterY + 78 * dis) * dis;

      if (opacity <= 0.002 || draw <= 0) {
        item.element.style.opacity = "0";
        return;
      }

      item.element.style.opacity = opacity.toFixed(3);
      item.element.style.strokeDashoffset = clamp(1 - draw + dis * 0.78, 0, 1).toFixed(3);
      setTransform(
        item.element,
        "translate(" + (wobbleX + scatterX).toFixed(2) + " " + (wobbleY + scatterY).toFixed(2) + ") rotate(" + spin.toFixed(2) + " " + THOUGHT_CX + " " + THOUGHT_CY + ")"
      );
    });
  }

  function renderIconItems(items, elapsed, vortexProgress, disintegrateProgress, resetProgress) {
    items.forEach(function (item) {
      const intro = easeOutBackSmall(phase(elapsed, item.start, item.start + 980));
      const orbitBuild = phase(elapsed, item.start + 320, TIMING.vortexEnd);
      const dis = easeOutCubic(clamp((disintegrateProgress - item.index * 0.014) / 0.5, 0, 1));
      const angle = item.baseAngle + elapsed * 0.00042 * item.speed + vortexProgress * item.speed * 1.35;
      const orbitScale = 0.2 + orbitBuild * 0.52 + vortexProgress * 0.42;
      const x = THOUGHT_CX + item.x + Math.cos(angle) * item.radiusX * orbitScale + item.scatterX * dis;
      const y = THOUGHT_CY + item.y + Math.sin(angle * 1.12) * item.radiusY * orbitScale + (item.scatterY + 98 * dis) * dis;
      const rotation = item.rotation + Math.sin(angle * 0.9) * 4 + vortexProgress * item.speed * 32 + item.scatterRotation * dis;
      const scale = item.scale * (0.84 + intro * 0.16) * (1 + vortexProgress * 0.04) * (1 - dis * 0.28);
      const hierarchy = item.category === "design" ? 0.78 : 0.52;
      const opacity = hierarchy * intro * (1 - dis) * (1 - resetProgress);

      if (opacity <= 0.002) {
        item.element.style.opacity = "0";
        return;
      }

      item.element.style.opacity = opacity.toFixed(3);
      setTransform(
        item.element,
        "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + rotation.toFixed(2) + ") scale(" + scale.toFixed(3) + ")"
      );
    });
  }

  function renderBall(scene, state, elapsed) {
    const approach = phase(elapsed, TIMING.ballStart, TIMING.impact);
    const rebound = phase(elapsed, TIMING.impact, TIMING.impact + 760);
    const impactPoint = {
      x: GIRL_CENTER_X + 28,
      y: GROUND_Y - 222
    };
    let point = { x: STAGE_WIDTH + 80, y: 108 };
    let opacity = 0;

    if (approach > 0 && approach < 1) {
      point = cubicPoint(
        { x: STAGE_WIDTH + 80, y: 108 },
        { x: 1706, y: 70 },
        { x: 1260, y: 118 },
        impactPoint,
        easeInOutCubic(approach)
      );
      opacity = phase(elapsed, TIMING.ballStart, TIMING.ballStart + 160);
    } else if (elapsed >= TIMING.impact && elapsed < TIMING.impact + 900) {
      point = quadraticPoint(
        impactPoint,
        { x: impactPoint.x + 126, y: impactPoint.y - 78 },
        { x: impactPoint.x + 282, y: impactPoint.y + 28 },
        easeOutCubic(rebound)
      );
      opacity = 1 - phase(elapsed, TIMING.impact + 620, TIMING.impact + 900);
    }

    scene.ball.group.style.opacity = opacity.toFixed(3);
    setTransform(scene.ball.group, "translate(" + point.x.toFixed(2) + " " + point.y.toFixed(2) + ")");

    const mark = phase(elapsed, TIMING.impact - 70, TIMING.impact + 90) * (1 - phase(elapsed, TIMING.impact + 190, TIMING.impact + 650));
    scene.ball.impact.style.opacity = mark.toFixed(3);
    setTransform(scene.ball.impact, "translate(" + impactPoint.x + " " + impactPoint.y + ")");
  }

  function renderDisintegration(scene, state, elapsed, sceneConfig, options) {
    const renderOptions = options || {};
    const forceDisintegration = Boolean(renderOptions.forceDisintegration);
    const disintegrateProgress = renderOptions.disintegrateProgress != null
      ? renderOptions.disintegrateProgress
      : phase(elapsed, TIMING.collapseStart, TIMING.collapseEnd);
    const settleFade = renderOptions.settleFade != null
      ? renderOptions.settleFade
      : phase(elapsed, TIMING.collapseEnd, TIMING.recoverEnd);

    scene.particles.forEach(function (item) {
      if (!forceDisintegration && elapsed < TIMING.collapseStart) {
        item.element.style.opacity = "0";
        return;
      }

      const rawD = clamp((disintegrateProgress - item.delay) / (1 - item.delay), 0, 1);
      const d = easeOutCubic(rawD);
      const fade = 1 - smoothstep(clamp(rawD * 0.82 + settleFade * 0.7, 0, 1));
      const outward = easeOutCubic(clamp(rawD / 0.42, 0, 1));
      const falling = smoothstep(clamp((rawD - 0.22) / 0.78, 0, 1));
      const x = item.originX + item.scatterX * outward;
      const y = item.originY + item.scatterY * outward + item.gravity * falling * falling + 160 * rawD * rawD;
      const opacity = item.opacity * 1.08 * fade;
      const rotation = item.rotation + item.rotationSpeed * d;
      const scale = 0.92 - d * 0.22;

      placeParticle(item, x, y, rotation, scale, opacity);
    });
  }

  function renderFrame(scene, state, elapsed, sceneConfig) {
    const now = arguments.length > 4 ? arguments[4] : performance.now();
    const girlState = applyPlusDistraction(getGirlState(elapsed, sceneConfig), now);

    renderThoughts(scene, state, elapsed, sceneConfig);
    renderGirl(scene, girlState, elapsed);
    renderBall(scene, state, elapsed, sceneConfig);
    renderDisintegration(scene, state, elapsed, sceneConfig);
  }

  function renderInterruptFrame(scene, state, elapsed, sceneConfig) {
    const thoughtElapsed = Math.max(interruptState.frozenElapsed, TIMING.threadStart + 900);
    const vortexProgress = Math.max(phase(interruptState.frozenElapsed, TIMING.vortexStart, TIMING.vortexEnd), 0.38);
    const thoughtDisintegration = phase(elapsed, 0, 760);
    const particleDisintegration = phase(elapsed, 0, 2600);
    const settleFade = phase(elapsed, 2500, INTERRUPT_DURATION);
    const resetProgress = phase(elapsed, 900, 1900);

    scene.ball.group.style.opacity = "0";
    scene.ball.impact.style.opacity = "0";
    renderThoughts(scene, state, thoughtElapsed, sceneConfig, {
      vortexProgress: vortexProgress,
      disintegrateProgress: thoughtDisintegration,
      resetProgress: resetProgress
    });
    renderGirl(scene, getInterruptGirlState(elapsed), elapsed);
    renderDisintegration(scene, state, thoughtElapsed, sceneConfig, {
      forceDisintegration: true,
      disintegrateProgress: particleDisintegration,
      settleFade: settleFade
    });
  }

  function renderStaticScene(scene, state, sceneConfig) {
    scene.svg.classList.add("is-static");
    renderFrame(scene, state, 11200, sceneConfig);
    scene.ball.group.style.opacity = "0";
    scene.ball.impact.style.opacity = "0";
    scene.particles.forEach(function (item) {
      item.element.style.opacity = "0";
    });
  }

  function placeParticle(item, x, y, rotation, scale, opacity) {
    item.element.style.opacity = clamp(opacity, 0, 1).toFixed(3);

    if (item.shape === "square") {
      setTransform(
        item.element,
        "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + rotation.toFixed(2) + ") scale(" + scale.toFixed(3) + ")"
      );
    } else {
      setAttrs(item.element, {
        cx: x.toFixed(2),
        cy: y.toFixed(2)
      });
    }
  }

  function iconSpec(type, x, y, scale, start, radiusX, radiusY, speed, rng) {
    return {
      type: type,
      layer: rng() > 0.36 ? "behind" : "front",
      x: x,
      y: y,
      scale: scale,
      start: start,
      radiusX: radiusX,
      radiusY: radiusY,
      speed: speed,
      baseAngle: rng() * Math.PI * 2,
      rotation: lerp(-9, 9, rng()),
      scatterX: lerp(-190, 190, rng()),
      scatterY: lerp(-48, 145, rng()),
      scatterRotation: lerp(-120, 120, rng())
    };
  }

  function iconParticleOrigins(icons, paths) {
    const origins = icons.map(function (icon) {
      return {
        x: THOUGHT_CX + icon.x,
        y: THOUGHT_CY + icon.y
      };
    });

    paths.forEach(function (pathSpec, index) {
      const angle = index * 0.72;
      const radiusX = index < 7 ? 180 + index * 34 : 260 + (index % 5) * 58;
      const radiusY = index < 7 ? 76 + index * 7 : 96 + (index % 4) * 16;

      origins.push({
        x: THOUGHT_CX + Math.cos(angle) * radiusX,
        y: THOUGHT_CY + Math.sin(angle) * radiusY
      });
    });

    return origins;
  }

  function buildIcon(type, group) {
    if (type === "sketchbook") {
      rect(group, -34, -24, 30, 48);
      rect(group, 4, -24, 30, 48);
      line(group, 0, -25, 0, 26);
      line(group, -26, -11, -10, -7);
      line(group, -27, 2, -9, 5);
      line(group, 10, -13, 26, -9);
      line(group, 11, 5, 28, 1);
      return;
    }

    if (type === "floor-plan") {
      rect(group, -37, -27, 74, 54);
      line(group, -15, -27, -15, 27);
      line(group, 8, -27, 8, 27);
      line(group, 25, -27, 25, 11);
      line(group, -37, -8, 37, -8);
      line(group, -37, 10, 37, 10);
      line(group, -37, 27, 37, -27);
      return;
    }

    if (type === "grid-fragment") {
      for (let i = -3; i <= 3; i += 1) {
        line(group, i * 12, -34, i * 12 + 18, 34);
        line(group, -44, i * 9, 48, i * 9 - 10);
      }
      path(group, "M-46 -35 C-18 -24 22 -31 48 -18");
      return;
    }

    if (type === "loose-page") {
      path(group, "M-34 -27 C-9 -38 18 -30 36 -12 L24 31 C4 20 -16 24 -36 11 Z");
      line(group, -21, -9, 18, -15);
      line(group, -19, 1, 20, -4);
      line(group, -16, 12, 12, 8);
      return;
    }

    if (type === "perspective") {
      rect(group, -39, -23, 78, 46);
      circle(group, 0, 1, 2.2);
      line(group, -39, -23, 0, 1);
      line(group, 39, -23, 0, 1);
      line(group, -39, 23, 0, 1);
      line(group, 39, 23, 0, 1);
      return;
    }

    if (type === "pencil") {
      line(group, -38, 21, 28, -28);
      path(group, "M28 -28 L39 -36 L34 -22 Z");
      line(group, -22, 9, -9, 21);
      return;
    }

    if (type === "laptop") {
      rect(group, -42, -28, 84, 48);
      path(group, "M-56 29 L56 29 L42 20 L-42 20 Z");
      line(group, -30, -14, 26, -14);
      line(group, -24, 0, 16, 0);
      circle(group, 0, 25, 1.8);
      return;
    }

    if (type === "tablet") {
      rect(group, -30, -40, 60, 80);
      line(group, -18, -24, 18, -24);
      line(group, -18, -8, 12, -8);
      line(group, -18, 10, 20, 10);
      circle(group, 0, 30, 2.2);
      return;
    }

    if (type === "iteration") {
      path(group, "M-32 2 C-26 -24 23 -28 31 -2");
      path(group, "M31 -2 L21 -7 M31 -2 L26 -13");
      rect(group, -14, -5, 28, 20);
      path(group, "M24 21 C8 38 -28 31 -33 6");
      path(group, "M-33 6 L-24 14 M-33 6 L-27 18");
      return;
    }

    if (type === "panels") {
      rect(group, -42, -24, 32, 42);
      rect(group, 0, -31, 44, 28);
      rect(group, -3, 12, 34, 25);
      line(group, -36, -11, -17, -11);
      line(group, 7, -20, 34, -20);
      line(group, 4, 23, 23, 26);
      return;
    }

    if (type === "sketch-panel") {
      rect(group, -46, -29, 92, 58);
      path(group, "M-34 12 C-12 -18 10 -19 34 9");
      path(group, "M-38 -9 C-15 -2 11 -5 37 -15");
      line(group, -26, 20, 26, 20);
      return;
    }

    if (type === "cube") {
      path(group, "M0 -33 L29 -16 L29 18 L0 35 L-29 18 L-29 -16 Z");
      path(group, "M0 -33 L0 1 L29 -16 M0 1 L-29 -16 M0 1 L0 35");
      return;
    }

    if (type === "model") {
      path(group, "M-38 16 L-4 -5 L36 14 L2 35 Z");
      path(group, "M-4 -5 L-4 -34 L36 -14 L36 14");
      path(group, "M-4 -34 L-38 -12 L-38 16");
      return;
    }

    if (type === "massing") {
      path(group, "M-42 18 L-12 0 L16 15 L-13 34 Z");
      path(group, "M-12 0 L-12 -30 L17 -12 L16 15");
      path(group, "M18 14 L42 0 L42 24 L17 39 Z");
      path(group, "M18 14 L18 -8 L42 0");
      line(group, -33, 17, -6, 32);
      return;
    }

    if (type === "chai") {
      path(group, "M-26 -6 L18 -6 L13 18 C4 25 -12 25 -20 18 Z");
      path(group, "M17 -2 C38 -2 37 17 18 16");
      path(group, "M-32 26 C-10 33 13 33 34 26");
      path(group, "M-12 -16 C-21 -27 -5 -28 -14 -39");
      path(group, "M5 -16 C-2 -28 13 -29 5 -40");
      return;
    }

    if (type === "book") {
      path(group, "M-38 -22 C-21 -27 -9 -22 0 -12 C10 -23 24 -28 39 -21 L39 27 C22 20 11 24 0 35 C-10 24 -23 21 -39 27 Z");
      line(group, 0, -12, 0, 34);
      line(group, -28, -3, -10, 1);
      line(group, 11, -2, 30, -7);
      line(group, -29, 9, -11, 13);
      line(group, 10, 12, 29, 7);
      return;
    }

    if (type === "tennis") {
      ellipse(group, -8, -14, 23, 32);
      line(group, -4, 19, 24, 45);
      line(group, -20, -14, 4, -14);
      line(group, -24, -1, 7, -1);
      line(group, -19, 13, 4, 13);
      line(group, -8, -43, -8, 16);
      line(group, 5, -35, 5, 9);
      circle(group, 34, -28, 5);
      return;
    }

    if (type === "tennis-ball") {
      circle(group, 0, 0, 14);
      path(group, "M-10 -9 C-1 -2 -1 2 -10 9");
      path(group, "M10 -9 C1 -2 1 2 10 9");
      return;
    }

    if (type === "reading") {
      rect(group, -32, -26, 64, 42);
      path(group, "M-23 -15 C-8 -21 7 -20 23 -15");
      line(group, -22, -2, 23, -2);
      line(group, -22, 10, 13, 10);
    }
  }

  function spiralPath(index) {
    const points = [];
    const turnOffset = -1.25 + index * 0.38;
    const turns = 0.72 + (index % 5) * 0.13;
    const startRadius = 110 + index * 16;
    const endRadius = 380 + (index % 7) * 46;
    const pointCount = 42;
    const centerX = THOUGHT_CX + 40;
    const centerY = THOUGHT_CY + 36;

    for (let i = 0; i < pointCount; i += 1) {
      const t = i / (pointCount - 1);
      const angle = turnOffset + t * Math.PI * 2 * turns;
      const radius = lerp(startRadius, endRadius, t);
      const wobble = Math.sin(t * Math.PI * 3 + index * 0.7) * 10;
      const sweep = (t - 0.5) * (90 + index * 5);
      points.push([
        centerX + sweep + Math.cos(angle) * (radius * 1.24 + wobble),
        centerY + Math.sin(angle) * (radius * 0.46 + wobble * 0.24)
      ]);
    }

    return smoothPath(points);
  }

  function smoothPath(points) {
    let d = "M" + points[0][0].toFixed(1) + " " + points[0][1].toFixed(1);

    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      const cx = (current[0] + next[0]) / 2;
      const cy = (current[1] + next[1]) / 2;
      d += " Q" + current[0].toFixed(1) + " " + current[1].toFixed(1) + " " + cx.toFixed(1) + " " + cy.toFixed(1);
    }

    return d;
  }

  function rect(parent, x, y, width, height) {
    return svgEl("rect", {
      class: "thought-icon-line",
      x: x,
      y: y,
      width: width,
      height: height,
      rx: "2"
    }, parent);
  }

  function line(parent, x1, y1, x2, y2) {
    return svgEl("line", {
      class: "thought-icon-line",
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2
    }, parent);
  }

  function path(parent, d) {
    return svgEl("path", {
      class: "thought-icon-line",
      d: d
    }, parent);
  }

  function circle(parent, cx, cy, r) {
    return svgEl("circle", {
      class: "thought-icon-line",
      cx: cx,
      cy: cy,
      r: r
    }, parent);
  }

  function ellipse(parent, cx, cy, rx, ry) {
    return svgEl("ellipse", {
      class: "thought-icon-line",
      cx: cx,
      cy: cy,
      rx: rx,
      ry: ry
    }, parent);
  }

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(NS, tag);
    setAttrs(el, attrs);

    if (parent) {
      parent.appendChild(el);
    }

    return el;
  }

  function setAttrs(el, attrs) {
    Object.entries(attrs).forEach(function ([key, value]) {
      el.setAttribute(key, value);
    });
  }

  function setTransform(el, transform) {
    el.setAttribute("transform", transform);
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const oneMinusT = 1 - t;

    return {
      x: oneMinusT * oneMinusT * oneMinusT * p0.x + 3 * oneMinusT * oneMinusT * t * p1.x + 3 * oneMinusT * t * t * p2.x + t * t * t * p3.x,
      y: oneMinusT * oneMinusT * oneMinusT * p0.y + 3 * oneMinusT * oneMinusT * t * p1.y + 3 * oneMinusT * t * t * p2.y + t * t * t * p3.y
    };
  }

  function quadraticPoint(p0, p1, p2, t) {
    const oneMinusT = 1 - t;

    return {
      x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
      y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
    };
  }

  function seededRange(seed, min, max) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    const fraction = value - Math.floor(value);

    return min + (max - min) * fraction;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, value) {
    return clamp((value - a) / (b - a), 0, 1);
  }

  function phase(elapsed, start, end) {
    return invLerp(start, end, elapsed);
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

  function easeOutBackSmall(t) {
    const c1 = 1.12;
    const c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);

    return x * x * (3 - 2 * x);
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
})();
