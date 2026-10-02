(function () {
  "use strict";

  const root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  const NS = "http://www.w3.org/2000/svg";
  const STAGE = { width: 1920, height: 620 };
  const STAGE_WIDTH = STAGE.width;
  const STAGE_HEIGHT = STAGE.height;
  const DURATION = 30000;
  const GROUND_Y = 500;
  const CENTRE_X = STAGE_WIDTH / 2;
  const OFFSCREEN_RIGHT = STAGE_WIDTH + 180;
  const OFFSCREEN_LEFT = -220;
  const PEEK_RIGHT = STAGE_WIDTH + 160;
  const PEEK_X = STAGE_WIDTH - 95;
  const THOUGHT_CX = CENTRE_X + 12;
  const THOUGHT_CY = 292;
  const INTERRUPT_DURATION = 3600;
  const INTERRUPT_RUN_START = 760;
  const INTERRUPT_RUN_END = 2850;

  const TIME = {
    walkInStart: 1200,
    walkInEnd: 6000,
    turnStart: 6000,
    turnEnd: 7100,
    threadStart: 7100,
    threadEnd: 8600,
    orbitStart: 8600,
    orbitEnd: 10800,
    buildStart: 10800,
    buildEnd: 15500,
    vortexStart: 15500,
    vortexEnd: 19200,
    ballStart: 19200,
    impact: 20000,
    collapseStart: 20000,
    collapseEnd: 22800,
    recoverEnd: 24000,
    turnOutStart: 24000,
    turnOutEnd: 24700,
    walkOutStart: 24700,
    walkOutEnd: 27000,
    peekInStart: 27700,
    peekInEnd: 28600,
    peekOutEnd: 29200
  };

  const config = createConfig();
  const state = createState(config);
  const scene = createScene(root, config, state);

  exposeController(scene, state, config);
  setupLandingVisibilityObserver(scene, state, config);

  if (config.prefersReducedMotion) {
    renderStaticScene(scene, state, config);
  } else if (state.landingVisible) {
    restart(scene, state, config);
  } else {
    renderFrame(scene, state, 0, config);
  }

  function createConfig() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isPhone = window.matchMedia("(max-width: 700px)").matches;
    const isTablet = window.matchMedia("(min-width: 701px) and (max-width: 1120px)").matches;
    const density = isPhone ? 0.55 : isTablet ? 0.78 : 1;

    return {
      stage: STAGE,
      duration: DURATION,
      groundY: GROUND_Y,
      centreX: CENTRE_X,
      prefersReducedMotion: prefersReducedMotion,
      isPhone: isPhone,
      isTablet: isTablet,
      density: density,
      particleCount: Math.round((isPhone ? 92 : isTablet ? 132 : 176) * density),
      landingThreshold: 0.42
    };
  }

  function createState(config) {
    const rng = createSeededRandom(912);
    const thoughtLines = createThoughtLineSpecs();
    const thoughtIcons = createThoughtIconSpecs(rng);
    const particleOrigins = createParticleOrigins(thoughtIcons, thoughtLines);

    return {
      rng: rng,
      startTime: 0,
      elapsed: 0,
      rafId: 0,
      landingSection: document.getElementById("landing") || root.closest("section"),
      landingVisible: measureLandingVisible(config),
      plusDistractionStart: 0,
      thoughtLines: thoughtLines,
      thoughtIcons: thoughtIcons,
      backgroundDust: createBackgroundDust(rng),
      particles: createParticleSpecs(rng, particleOrigins, config.particleCount),
      manualDisintegrationMode: "",
      interrupt: {
        active: false,
        completed: false,
        startTime: 0,
        startX: CENTRE_X,
        promise: null,
        resolve: null
      }
    };
  }

  function createScene(root, config, state) {
    root.textContent = "";

    const svg = svgEl("svg", {
      class: "landing-girl-svg",
      viewBox: "0 0 " + config.stage.width + " " + config.stage.height,
      preserveAspectRatio: "xMidYMid slice",
      focusable: "false",
      "aria-hidden": "true"
    }, root);

    const layers = {
      backgroundDust: svgEl("g", { class: "background-dust-layer" }, svg),
      thoughtsBehind: svgEl("g", { class: "thoughts-behind-layer" }, svg),
      shadow: svgEl("g", { class: "shadow-layer" }, svg),
      girl: svgEl("g", { class: "girl-layer" }, svg),
      thoughtsFront: svgEl("g", { class: "thoughts-front-layer" }, svg),
      thoughtIcons: svgEl("g", { class: "thought-icons-layer" }, svg),
      ball: svgEl("g", { class: "ball-layer" }, svg),
      impact: svgEl("g", { class: "impact-layer" }, svg),
      particles: svgEl("g", { class: "particles-layer" }, svg)
    };

    const scene = {
      svg: svg,
      layers: layers,
      shadow: svgEl("ellipse", {
        class: "girl-shadow",
        cx: "0",
        cy: GROUND_Y + 8,
        rx: "44",
        ry: "5"
      }, layers.shadow)
    };

    scene.backgroundDust = createBackgroundDustElements(scene, state);
    scene.profileGirl = createProfileGirl(scene);
    scene.frontGirl = createFrontGirl(scene);
    scene.thoughtLines = createThoughtLines(scene, state);
    scene.thoughtIcons = createThoughtIcons(scene, state);
    scene.particles = createParticlePool(scene, state);
    scene.ball = createBall(scene);

    return scene;
  }

  function createProfileGirl(scene) {
    const group = svgEl("g", { class: "girl-profile" }, scene.layers.girl);
    const pose = svgEl("g", { class: "girl-profile-pose" }, group);
    const legs = svgEl("g", { class: "profile-legs" }, pose);
    const body = svgEl("g", { class: "profile-body" }, pose);
    const head = svgEl("g", { class: "profile-head" }, body);
    const hairStrands = [];

    const backLeg = svgEl("g", { class: "profile-leg profile-leg-back" }, legs);
    svgEl("path", {
      class: "girl-limb",
      d: "M-10 -78 C-28 -58 -35 -30 -30 -8 C-24 -2 -12 -3 -8 -11 C-8 -33 -1 -55 14 -74 C8 -82 -3 -84 -10 -78 Z"
    }, backLeg);
    svgEl("ellipse", { class: "girl-foot", cx: "-26", cy: "-3", rx: "22", ry: "5.5" }, backLeg);

    const frontLeg = svgEl("g", { class: "profile-leg profile-leg-front" }, legs);
    svgEl("path", {
      class: "girl-limb",
      d: "M15 -77 C32 -56 40 -32 39 -9 C45 -3 58 -5 63 -14 C59 -39 47 -62 27 -80 C22 -83 16 -82 15 -77 Z"
    }, frontLeg);
    svgEl("ellipse", { class: "girl-foot", cx: "60", cy: "-3", rx: "24", ry: "5.5" }, frontLeg);

    const backArm = svgEl("g", { class: "profile-arm profile-arm-back" }, body);
    svgEl("path", {
      class: "girl-limb",
      d: "M-17 -148 C-32 -129 -40 -104 -38 -82 C-33 -75 -22 -77 -20 -86 C-20 -104 -10 -126 7 -140 C4 -149 -10 -153 -17 -148 Z"
    }, backArm);

    const frontArm = svgEl("g", { class: "profile-arm profile-arm-front" }, body);
    svgEl("path", {
      class: "girl-limb",
      d: "M22 -146 C39 -128 48 -104 47 -84 C53 -76 64 -78 67 -88 C64 -111 51 -134 33 -151 C28 -153 22 -151 22 -146 Z"
    }, frontArm);

    svgEl("path", {
      class: "girl-fill profile-dress",
      d: "M-20 -158 C-35 -137 -45 -103 -52 -64 C-29 -48 7 -43 49 -60 C43 -105 31 -140 10 -160 C0 -166 -13 -165 -20 -158 Z"
    }, body);
    svgEl("path", { class: "girl-fill profile-neck", d: "M-8 -178 L13 -177 L14 -151 L-8 -149 Z" }, body);
    svgEl("path", {
      class: "girl-fill profile-head-hair",
      d: "M-25 -205 C-20 -236 17 -243 43 -219 C55 -202 48 -177 26 -164 C2 -151 -27 -170 -31 -193 C-32 -198 -30 -202 -25 -205 Z"
    }, head);
    const ponytail = svgEl("path", {
      class: "girl-fill profile-ponytail",
      d: "M34 -207 C78 -231 126 -205 115 -176 C105 -151 75 -139 42 -160 C28 -169 31 -190 41 -198 C44 -202 41 -206 34 -207 Z"
    }, head);
    svgEl("path", {
      class: "girl-fill profile-head-shape",
      d: "M-20 -219 C10 -232 38 -212 41 -185 C42 -162 16 -151 -7 -160 C-19 -165 -27 -175 -31 -187 C-43 -187 -46 -194 -34 -198 C-32 -208 -28 -215 -20 -219 Z"
    }, head);

    [
      "M-28 -219 C-42 -207 -39 -191 -49 -179",
      "M-9 -229 C-20 -211 -15 -192 -27 -174",
      "M31 -211 C47 -198 39 -180 51 -166",
      "M76 -209 C105 -198 99 -166 72 -148",
      "M95 -197 C130 -179 112 -145 83 -137",
      "M44 -218 C59 -216 64 -204 60 -190"
    ].forEach(function (d) {
      hairStrands.push(svgEl("path", { class: "girl-strand", d: d }, head));
    });

    return {
      group: group,
      pose: pose,
      head: head,
      ponytail: ponytail,
      hairStrands: hairStrands,
      backLeg: backLeg,
      frontLeg: frontLeg,
      backArm: backArm,
      frontArm: frontArm
    };
  }

  function createFrontGirl(scene) {
    const group = svgEl("g", { class: "girl-front" }, scene.layers.girl);
    const pose = svgEl("g", { class: "girl-front-pose" }, group);
    const legs = svgEl("g", { class: "front-legs" }, pose);
    const body = svgEl("g", { class: "front-body" }, pose);
    const head = svgEl("g", { class: "front-head" }, body);
    const hairStrands = [];

    svgEl("path", {
      class: "girl-limb front-leg-left",
      d: "M-28 -75 C-37 -51 -40 -27 -37 -8 C-31 -3 -20 -4 -16 -12 C-17 -34 -12 -55 -4 -73 C-11 -80 -23 -80 -28 -75 Z"
    }, legs);
    svgEl("path", {
      class: "girl-limb front-leg-right",
      d: "M7 -73 C16 -52 20 -29 18 -9 C24 -3 36 -5 39 -13 C38 -35 31 -56 22 -75 C17 -81 9 -80 7 -73 Z"
    }, legs);
    svgEl("ellipse", { class: "girl-foot", cx: "-25", cy: "-3", rx: "21", ry: "5.2" }, legs);
    svgEl("ellipse", { class: "girl-foot", cx: "38", cy: "-3", rx: "21", ry: "5.2" }, legs);

    const leftArm = svgEl("g", { class: "front-arm-left" }, body);
    svgEl("path", {
      class: "girl-limb",
      d: "M-36 -145 C-48 -124 -53 -101 -49 -82 C-43 -76 -34 -78 -32 -87 C-34 -106 -29 -125 -18 -141 C-22 -149 -31 -151 -36 -145 Z"
    }, leftArm);

    const rightArmRelaxed = svgEl("g", { class: "front-arm-right-relaxed" }, body);
    svgEl("path", {
      class: "girl-limb",
      d: "M35 -145 C48 -124 54 -101 50 -82 C44 -75 34 -78 32 -87 C34 -106 29 -126 18 -142 C22 -149 31 -151 35 -145 Z"
    }, rightArmRelaxed);

    const rightArmScratch = svgEl("g", { class: "front-arm-right-scratch" }, body);
    svgEl("path", {
      class: "girl-limb",
      d: "M33 -145 C58 -154 59 -182 40 -197 C33 -198 27 -191 30 -185 C40 -178 39 -165 25 -156 C24 -149 28 -145 33 -145 Z"
    }, rightArmScratch);
    svgEl("circle", { class: "girl-fill", cx: "39", cy: "-197", r: "5.2" }, rightArmScratch);

    svgEl("path", {
      class: "girl-fill front-dress",
      d: "M-27 -160 C-44 -132 -54 -96 -58 -61 C-26 -44 18 -43 58 -62 C52 -101 42 -135 25 -160 C12 -171 -14 -170 -27 -160 Z"
    }, body);
    svgEl("path", { class: "girl-fill front-neck", d: "M-11 -180 L14 -180 L16 -154 L-13 -154 Z" }, body);
    svgEl("path", {
      class: "girl-fill front-hair",
      d: "M-38 -212 C-28 -244 19 -252 45 -225 C63 -206 55 -171 25 -158 C-6 -145 -42 -164 -47 -194 C-48 -201 -45 -208 -38 -212 Z"
    }, head);
    const ponytail = svgEl("path", {
      class: "girl-fill front-ponytail",
      d: "M39 -212 C80 -232 114 -205 104 -177 C96 -154 69 -143 42 -158 C30 -166 29 -187 40 -198 Z"
    }, head);
    svgEl("path", {
      class: "girl-fill front-head-shape",
      d: "M-30 -217 C-8 -237 31 -231 44 -204 C55 -180 34 -156 5 -156 C-22 -156 -45 -173 -45 -194 C-45 -203 -39 -212 -30 -217 Z"
    }, head);

    [
      "M-31 -230 C-47 -216 -41 -198 -53 -184",
      "M-12 -239 C-27 -219 -18 -197 -31 -178",
      "M34 -224 C51 -211 45 -188 58 -173",
      "M71 -212 C97 -196 90 -166 65 -150",
      "M93 -198 C119 -179 104 -150 80 -138",
      "M17 -240 C26 -226 18 -209 27 -193"
    ].forEach(function (d) {
      hairStrands.push(svgEl("path", { class: "girl-strand", d: d }, head));
    });

    return {
      group: group,
      pose: pose,
      head: head,
      ponytail: ponytail,
      hairStrands: hairStrands,
      leftArm: leftArm,
      rightArmRelaxed: rightArmRelaxed,
      rightArmScratch: rightArmScratch
    };
  }

  function createThoughtLines(scene, state) {
    return state.thoughtLines.map(function (spec, index) {
      const parent = spec.layer === "front" ? scene.layers.thoughtsFront : scene.layers.thoughtsBehind;
      const className = [
        "thought-line",
        spec.dotted ? "is-dotted" : "",
        spec.ribbon ? "is-ribbon" : ""
      ].filter(Boolean).join(" ");
      const element = svgEl("path", {
        class: className,
        d: spec.d,
        pathLength: "1"
      }, parent);

      element.style.setProperty("--line-width", spec.width + "px");
      element.style.setProperty("--line-color", spec.color);
      element.style.strokeDasharray = spec.dotted ? "0.012 0.038" : "1";
      element.style.strokeDashoffset = "1";
      element.style.opacity = "0";

      return Object.assign({ element: element, index: index }, spec);
    });
  }

  function createThoughtIcons(scene, state) {
    return state.thoughtIcons.map(function (spec, index) {
      const group = svgEl("g", {
        class: "thought-icon thought-icon-" + spec.type
      }, scene.layers.thoughtIcons);

      buildIcon(spec.type, group);
      group.style.opacity = "0";

      return Object.assign({ element: group, index: index }, spec);
    });
  }

  function createParticlePool(scene, state) {
    return state.particles.map(function (spec) {
      let element;

      if (spec.shape === "dot") {
        element = svgEl("circle", {
          class: "particle particle-dot",
          r: spec.size / 2,
          cx: "0",
          cy: "0"
        }, scene.layers.particles);
      } else if (spec.shape === "cube") {
        element = svgEl("g", { class: "particle particle-cube" }, scene.layers.particles);
        svgEl("rect", {
          class: "particle-face-main",
          x: -spec.size / 2,
          y: -spec.size / 2,
          width: spec.size,
          height: spec.size
        }, element);
        svgEl("path", {
          class: "particle-face-side",
          d: "M" + (spec.size / 2) + " " + (-spec.size / 2) + " L" + (spec.size * 0.92) + " " + (-spec.size * 0.78) + " L" + (spec.size * 0.92) + " " + (spec.size * 0.22) + " L" + (spec.size / 2) + " " + (spec.size / 2) + " Z"
        }, element);
        svgEl("path", {
          class: "particle-face-top",
          d: "M" + (-spec.size / 2) + " " + (-spec.size / 2) + " L0 " + (-spec.size * 0.78) + " L" + (spec.size * 0.92) + " " + (-spec.size * 0.78) + " L" + (spec.size / 2) + " " + (-spec.size / 2) + " Z"
        }, element);
      } else {
        element = svgEl("rect", {
          class: "particle particle-square",
          x: -spec.size / 2,
          y: -spec.size / 2,
          width: spec.size,
          height: spec.size
        }, scene.layers.particles);
      }

      element.style.opacity = "0";

      return Object.assign({ element: element }, spec);
    });
  }

  function createBall(scene) {
    const group = svgEl("g", { class: "bonk-ball-group" }, scene.layers.ball);
    const ball = svgEl("circle", { class: "bonk-ball", r: "10", cx: "0", cy: "0" }, group);
    const impact = svgEl("g", { class: "impact-burst" }, scene.layers.impact);

    [
      [-18, -14, -34, -26],
      [-7, -21, -10, -41],
      [10, -18, 22, -35],
      [19, -6, 38, -10],
      [-22, 2, -42, 6]
    ].forEach(function (coords) {
      svgEl("line", {
        class: "impact-line",
        x1: coords[0],
        y1: coords[1],
        x2: coords[2],
        y2: coords[3]
      }, impact);
    });

    group.style.opacity = "0";
    impact.style.opacity = "0";

    return {
      group: group,
      ball: ball,
      impact: impact
    };
  }

  function getTimelineState(elapsed, config) {
    const t = elapsed % config.duration;
    const turnIn = phase(t, TIME.turnStart, TIME.turnEnd);
    const turnOut = phase(t, TIME.turnOutStart, TIME.turnOutEnd);
    const walkIn = phase(t, TIME.walkInStart, TIME.walkInEnd);
    const walkOut = phase(t, TIME.walkOutStart, TIME.walkOutEnd);
    const peekIn = phase(t, TIME.peekInStart, TIME.peekInEnd);
    const peekOut = phase(t, TIME.peekInEnd, TIME.peekOutEnd);
    const collapseProgress = phase(t, TIME.collapseStart, TIME.collapseEnd);
    const thoughtCollapseFade = phase(t, TIME.collapseStart, TIME.collapseStart + 760);

    let profileX = OFFSCREEN_RIGHT;
    let profileOpacity = 0;
    let profileMode = "walk";
    let frontOpacity = 0;

    if (t >= TIME.walkInStart && t < TIME.turnEnd) {
      profileX = lerp(OFFSCREEN_RIGHT, CENTRE_X, easeInOutCubic(walkIn));
      profileOpacity = t < TIME.turnStart ? 1 : 1 - easeInOutCubic(turnIn);
    } else if (t >= TIME.turnOutStart && t < TIME.walkOutEnd) {
      profileX = t < TIME.walkOutStart ? CENTRE_X : lerp(CENTRE_X, OFFSCREEN_LEFT, easeInOutCubic(walkOut));
      profileOpacity = t < TIME.walkOutStart ? easeInOutCubic(turnOut) : 1;
    } else if (t >= TIME.peekInStart && t < TIME.peekOutEnd) {
      profileMode = "peek";
      profileX = t < TIME.peekInEnd
        ? lerp(PEEK_RIGHT, PEEK_X, easeOutCubic(peekIn))
        : lerp(PEEK_X, PEEK_RIGHT, easeInCubic(peekOut));
      profileOpacity = 1;
    }

    if (t >= TIME.turnStart && t < TIME.turnOutEnd) {
      frontOpacity = t < TIME.turnEnd ? easeInOutCubic(turnIn) : 1 - easeInOutCubic(turnOut);
    }

    return {
      elapsed: t,
      profileX: profileX,
      profileOpacity: clamp(profileOpacity, 0, 1),
      profileMode: profileMode,
      profileSpeed: profileMode === "peek" ? 0 : 1,
      profileRun: false,
      frontOpacity: clamp(frontOpacity, 0, 1),
      thoughtIntensity: clamp(phase(t, TIME.threadStart, TIME.vortexEnd), 0, 1),
      threadProgress: phase(t, TIME.threadStart, TIME.threadEnd),
      orbitProgress: phase(t, TIME.orbitStart, TIME.vortexEnd),
      buildProgress: phase(t, TIME.buildStart, TIME.buildEnd),
      vortexProgress: phase(t, TIME.vortexStart, TIME.vortexEnd),
      collapseProgress: collapseProgress,
      thoughtCollapseFade: thoughtCollapseFade,
      particleProgress: collapseProgress,
      impactProgress: phase(t, TIME.impact - 80, TIME.impact + 250),
      scratchProgress: getScratchProgress(t),
      headShakeProgress: phase(t, TIME.collapseEnd, TIME.recoverEnd),
      ballApproachProgress: phase(t, TIME.ballStart, TIME.impact),
      ballReboundProgress: phase(t, TIME.impact, TIME.impact + 840),
      shadowAllowed: true,
      interrupt: false
    };
  }

  function renderProfileGirl(scene, timeline, elapsed, config) {
    const girl = scene.profileGirl;
    const opacity = timeline.profileOpacity;

    girl.group.style.opacity = opacity.toFixed(3);

    if (opacity <= 0.002) {
      return;
    }

    const run = timeline.profileRun;
    const peek = timeline.profileMode === "peek";
    const cycle = elapsed * (run ? 0.020 : 0.0078);
    const step = Math.sin(cycle);
    const counterStep = Math.sin(cycle + Math.PI);
    const bob = peek ? 0 : Math.abs(Math.sin(cycle)) * (run ? 8 : 4);
    const lean = run ? -11 : peek ? -7 : 0;
    const scale = run ? 0.98 : 0.95;
    const plus = plusDistractionAmount(state);
    const headTilt = plus * 7 + (run ? -4 : 0);
    const ponyLag = run ? 18 : 8;

    setTransform(girl.group, "translate(" + timeline.profileX.toFixed(2) + " " + (config.groundY + bob).toFixed(2) + ")");
    setTransform(girl.pose, "rotate(" + lean.toFixed(2) + ") scale(" + scale.toFixed(3) + ")");
    setTransform(girl.frontLeg, "rotate(" + (step * (run ? 38 : 21)).toFixed(2) + " 16 -76)");
    setTransform(girl.backLeg, "rotate(" + (counterStep * (run ? 34 : 19)).toFixed(2) + " -8 -76)");
    setTransform(girl.frontArm, "rotate(" + (counterStep * (run ? 24 : 13)).toFixed(2) + " 22 -145)");
    setTransform(girl.backArm, "rotate(" + (step * (run ? 26 : 12)).toFixed(2) + " -15 -145)");
    setTransform(girl.head, "rotate(" + headTilt.toFixed(2) + " 0 -190)");
    setTransform(girl.ponytail, "translate(" + (Math.abs(step) * ponyLag).toFixed(2) + " " + (run ? -2 : 0) + ") rotate(" + (-step * 4 - (run ? 7 : 0)).toFixed(2) + " 40 -190)");

    girl.hairStrands.forEach(function (strand, index) {
      const strandLag = Math.sin(cycle + index * 0.72) * (run ? 6 : 3);
      setTransform(strand, "translate(" + strandLag.toFixed(2) + " 0)");
    });
  }

  function renderFrontGirl(scene, timeline, elapsed, config) {
    const girl = scene.frontGirl;
    const opacity = timeline.frontOpacity;

    girl.group.style.opacity = opacity.toFixed(3);

    if (opacity <= 0.002) {
      return;
    }

    const settle = Math.sin(elapsed * 0.004) * 1.1 * (1 - timeline.collapseProgress);
    const plus = plusDistractionAmount(state);
    const impact = Math.sin(timeline.impactProgress * Math.PI) * 7;
    const scratch = easeInOutCubic(timeline.scratchProgress);
    const shakeRaw = timeline.headShakeProgress > 0 && timeline.headShakeProgress < 1
      ? Math.sin(elapsed * 0.052) * (1 - timeline.headShakeProgress) * 5
      : 0;
    const headTilt = plus * 5 - impact + scratch * 3 + shakeRaw;

    setTransform(girl.group, "translate(" + config.centreX + " " + (config.groundY + settle).toFixed(2) + ") scale(0.96)");
    setTransform(girl.pose, "translate(0 0)");
    setTransform(girl.head, "rotate(" + headTilt.toFixed(2) + " 0 -192)");
    setTransform(girl.ponytail, "translate(" + (scratch * 5 + shakeRaw * 0.7).toFixed(2) + " 0) rotate(" + (scratch * 4 + shakeRaw).toFixed(2) + " 40 -196)");
    girl.rightArmRelaxed.style.opacity = (1 - scratch).toFixed(3);
    girl.rightArmScratch.style.opacity = scratch.toFixed(3);
    setTransform(girl.leftArm, "rotate(" + (impact * 0.3).toFixed(2) + " -30 -140)");
    setTransform(girl.rightArmScratch, "rotate(" + (shakeRaw * 0.35).toFixed(2) + " 31 -146)");

    girl.hairStrands.forEach(function (strand, index) {
      const sway = Math.sin(elapsed * 0.004 + index * 0.85) * (1.2 + scratch * 3);
      setTransform(strand, "translate(" + sway.toFixed(2) + " 0)");
    });
  }

  function renderThoughts(scene, timeline, elapsed, config) {
    const disintegrating = timeline.collapseProgress > 0 || timeline.interrupt;
    const collapseFade = disintegrating ? 1 - easeOutCubic(clamp(timeline.thoughtCollapseFade * 1.25, 0, 1)) : 1;
    const resetFade = timeline.elapsed > TIME.collapseEnd ? 1 - phase(timeline.elapsed, TIME.collapseEnd, TIME.recoverEnd) : 1;
    const thoughtVisibility = collapseFade * resetFade;

    scene.thoughtLines.forEach(function (item) {
      const draw = easeOutCubic(phase(elapsed, item.start, item.start + item.draw));
      const mature = phase(elapsed, item.start + item.draw * 0.35, TIME.vortexEnd);
      const vortex = Math.max(timeline.vortexProgress, timeline.interrupt ? 0.78 : 0);
      const driftX = Math.sin(elapsed * 0.00072 + item.index * 0.8) * item.driftX * (0.2 + mature);
      const driftY = Math.cos(elapsed * 0.00058 + item.index * 1.1) * item.driftY * (0.2 + mature);
      const spin = vortex * item.spin + Math.sin(elapsed * 0.0004 + item.index) * 2.4 * mature;
      const opacity = item.opacity * draw * (0.35 + timeline.thoughtIntensity * 0.65) * thoughtVisibility;

      if (opacity <= 0.002 || draw <= 0) {
        item.element.style.opacity = "0";
        return;
      }

      item.element.style.opacity = opacity.toFixed(3);
      item.element.style.strokeDashoffset = item.dotted ? "0" : (1 - draw).toFixed(3);
      setTransform(
        item.element,
        "translate(" + driftX.toFixed(2) + " " + driftY.toFixed(2) + ") rotate(" + spin.toFixed(2) + " " + THOUGHT_CX + " " + THOUGHT_CY + ")"
      );
    });

    scene.thoughtIcons.forEach(function (item) {
      const intro = easeOutBackSmall(phase(elapsed, item.start, item.start + 1050));
      const orbit = phase(elapsed, item.start + 400, TIME.vortexEnd);
      const vortex = Math.max(timeline.vortexProgress, timeline.interrupt ? 0.8 : 0);
      const angle = item.baseAngle + elapsed * 0.00034 * item.speed + vortex * item.speed * 0.9;
      const x = item.x + Math.cos(angle) * item.orbitX * (0.2 + orbit * 0.55);
      const y = item.y + Math.sin(angle * 1.18) * item.orbitY * (0.15 + orbit * 0.5);
      const rotation = item.rotation + Math.sin(angle) * 5 + vortex * item.speed * 22;
      const scale = item.scale * (0.82 + intro * 0.18);
      const opacity = item.opacity * intro * thoughtVisibility;

      if (opacity <= 0.002 || intro <= 0) {
        item.element.style.opacity = "0";
        return;
      }

      item.element.style.opacity = opacity.toFixed(3);
      setTransform(
        item.element,
        "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + rotation.toFixed(2) + ") scale(" + scale.toFixed(3) + ")"
      );
    });

    renderThreadDot(scene, timeline, elapsed, thoughtVisibility);
  }

  function renderBall(scene, timeline, elapsed, config) {
    if (timeline.interrupt) {
      scene.ball.group.style.opacity = "0";
      scene.ball.impact.style.opacity = "0";
      return;
    }

    const approach = timeline.ballApproachProgress;
    const rebound = timeline.ballReboundProgress;
    const impactPoint = { x: CENTRE_X + 35, y: GROUND_Y - 218 };
    let point = { x: STAGE_WIDTH + 88, y: 112 };
    let opacity = 0;

    if (approach > 0 && approach < 1) {
      point = cubicPoint(
        { x: STAGE_WIDTH + 88, y: 112 },
        { x: 1710, y: 48 },
        { x: 1274, y: 122 },
        impactPoint,
        easeInOutCubic(approach)
      );
      opacity = phase(elapsed, TIME.ballStart, TIME.ballStart + 180);
    } else if (elapsed >= TIME.impact && elapsed < TIME.impact + 900) {
      point = quadraticPoint(
        impactPoint,
        { x: impactPoint.x + 128, y: impactPoint.y - 86 },
        { x: impactPoint.x + 286, y: impactPoint.y + 24 },
        easeOutCubic(rebound)
      );
      opacity = 1 - phase(elapsed, TIME.impact + 650, TIME.impact + 900);
    }

    scene.ball.group.style.opacity = opacity.toFixed(3);
    setTransform(scene.ball.group, "translate(" + point.x.toFixed(2) + " " + point.y.toFixed(2) + ")");

    const burst = Math.sin(clamp(timeline.impactProgress, 0, 1) * Math.PI) * (1 - phase(elapsed, TIME.impact + 180, TIME.impact + 620));
    scene.ball.impact.style.opacity = clamp(burst, 0, 1).toFixed(3);
    setTransform(scene.ball.impact, "translate(" + impactPoint.x + " " + impactPoint.y + ") scale(" + (0.8 + burst * 0.28).toFixed(3) + ")");
  }

  function renderParticles(scene, timeline, elapsed, config) {
    const progress = clamp(timeline.particleProgress || 0, 0, 1);

    scene.particles.forEach(function (particle) {
      if (progress <= 0.002) {
        particle.element.style.opacity = "0";
        return;
      }

      const raw = clamp((progress - particle.delay) / (1 - particle.delay), 0, 1);
      const scatter = easeOutCubic(clamp(raw / 0.34, 0, 1));
      const falling = smoothstep(clamp((raw - 0.14) / 0.86, 0, 1));
      const x = particle.originX + particle.scatterX * scatter + Math.sin(raw * Math.PI * 2 + particle.angle) * particle.orbit;
      const y = particle.originY + particle.scatterY * scatter + particle.gravity * falling * falling + 210 * raw * raw;
      const rotation = particle.rotation + particle.rotationSpeed * raw;
      const scale = 1 - raw * 0.18;
      const opacity = particle.opacity * (1 - smoothstep(clamp((raw - 0.64) / 0.36, 0, 1)));

      particle.element.style.opacity = clamp(opacity, 0, 1).toFixed(3);
      if (particle.shape === "dot") {
        setAttrs(particle.element, {
          cx: x.toFixed(2),
          cy: y.toFixed(2)
        });
      } else {
        setTransform(
          particle.element,
          "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + rotation.toFixed(2) + ") scale(" + scale.toFixed(3) + ")"
        );
      }
    });
  }

  function renderFrame(scene, state, elapsed, config) {
    const timeline = state.interrupt.active
      ? getInterruptTimelineState(performance.now() - state.interrupt.startTime, config, state)
      : getTimelineState(elapsed, config);

    renderBackgroundDust(scene, timeline, elapsed);
    renderThoughts(scene, timeline, timeline.interrupt ? Math.max(state.elapsed, TIME.vortexStart + 1800) : timeline.elapsed, config);
    renderProfileGirl(scene, timeline, timeline.interrupt ? performance.now() - state.interrupt.startTime : timeline.elapsed, config);
    renderFrontGirl(scene, timeline, timeline.interrupt ? performance.now() - state.interrupt.startTime : timeline.elapsed, config);
    renderShadow(scene, timeline, config);
    renderBall(scene, timeline, timeline.elapsed, config);
    renderParticles(scene, timeline, timeline.elapsed, config);
  }

  function triggerDisintegration(scene, state, config, mode) {
    state.manualDisintegrationMode = mode || "normal";
  }

  function triggerNavigationInterrupt(scene, state, config) {
    if (!isLandingActive(state) || config.prefersReducedMotion) {
      return config.prefersReducedMotion
        ? new Promise(function (resolve) { window.setTimeout(resolve, 260); })
        : Promise.resolve();
    }

    if (state.interrupt.active && state.interrupt.promise) {
      return state.interrupt.promise;
    }

    const timeline = getTimelineState(state.elapsed, config);
    state.plusDistractionStart = 0;
    state.interrupt.active = true;
    state.interrupt.completed = false;
    state.interrupt.startTime = performance.now();
    state.interrupt.startX = timeline.profileOpacity > timeline.frontOpacity ? timeline.profileX : CENTRE_X;
    state.interrupt.promise = new Promise(function (resolve) {
      state.interrupt.resolve = resolve;
    });

    triggerDisintegration(scene, state, config, "navigation");
    startLoop(scene, state, config);

    return state.interrupt.promise;
  }

  function exposeController(scene, state, config) {
    window.landingGirlAnimation = {
      isLandingActive: function () {
        return isLandingActive(state);
      },
      isPlaying: function () {
        return Boolean(state.rafId) && state.landingVisible && !config.prefersReducedMotion;
      },
      restart: function () {
        restart(scene, state, config);
      },
      pause: function () {
        pause(state);
      },
      resume: function () {
        if (state.landingVisible) {
          startLoop(scene, state, config);
        }
      },
      handlePlusDistraction: function () {
        handlePlusDistraction(scene, state, config);
      },
      interruptForNavigation: function () {
        return triggerNavigationInterrupt(scene, state, config);
      }
    };

    window.addEventListener("landing-nav-plus-opened", function () {
      handlePlusDistraction(scene, state, config);
    });

    window.addEventListener("landing-nav-circle-selected", function () {
      triggerNavigationInterrupt(scene, state, config);
    });

    window.addEventListener("pagehide", function () {
      pause(state);
    });
  }

  function setupLandingVisibilityObserver(scene, state, config) {
    if (!state.landingSection || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const visible = entry.isIntersecting && entry.intersectionRatio >= config.landingThreshold;

        if (visible === state.landingVisible) {
          return;
        }

        state.landingVisible = visible;

        if (visible) {
          restart(scene, state, config);
          return;
        }

        if (state.interrupt.active) {
          completeInterrupt(scene, state, config);
        }

        pause(state);
        resetRuntimeState(state, true);
        renderFrame(scene, state, 0, config);
      });
    }, {
      threshold: [0, 0.35, config.landingThreshold, 0.6]
    });

    observer.observe(state.landingSection);
  }

  function restart(scene, state, config) {
    stopLoop(state);
    resetRuntimeState(state, false);
    state.startTime = performance.now();
    state.elapsed = 0;
    renderFrame(scene, state, 0, config);

    if (!config.prefersReducedMotion && state.landingVisible) {
      startLoop(scene, state, config);
    }
  }

  function pause(state) {
    stopLoop(state);
  }

  function startLoop(scene, state, config) {
    if (config.prefersReducedMotion || state.rafId) {
      return;
    }

    state.rafId = requestAnimationFrame(function tick(now) {
      if (!state.landingVisible && !state.interrupt.active) {
        state.rafId = 0;
        return;
      }

      if (state.interrupt.active) {
        renderFrame(scene, state, state.elapsed, config);

        if (now - state.interrupt.startTime >= INTERRUPT_DURATION) {
          completeInterrupt(scene, state, config);
          return;
        }

        state.rafId = requestAnimationFrame(tick);
        return;
      }

      state.elapsed = (now - state.startTime) % config.duration;
      renderFrame(scene, state, state.elapsed, config);
      state.rafId = requestAnimationFrame(tick);
    });
  }

  function stopLoop(state) {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function renderStaticScene(scene, state, config) {
    state.elapsed = 11200;
    renderFrame(scene, state, state.elapsed, config);
    scene.ball.group.style.opacity = "0";
    scene.ball.impact.style.opacity = "0";
    scene.particles.forEach(function (particle) {
      particle.element.style.opacity = "0";
    });
  }

  function getInterruptTimelineState(elapsed, config, state) {
    const frontToRun = phase(elapsed, INTERRUPT_RUN_START - 260, INTERRUPT_RUN_START + 120);
    const runProgress = phase(elapsed, INTERRUPT_RUN_START, INTERRUPT_RUN_END);
    const x = lerp(state.interrupt.startX, OFFSCREEN_LEFT, easeInCubic(runProgress));

    return {
      elapsed: elapsed,
      profileX: x,
      profileOpacity: easeInOutCubic(frontToRun),
      profileMode: "run",
      profileSpeed: 1.8,
      profileRun: true,
      frontOpacity: 1 - easeInOutCubic(frontToRun),
      thoughtIntensity: 1,
      threadProgress: 1,
      orbitProgress: 1,
      buildProgress: 1,
      vortexProgress: 1,
      collapseProgress: phase(elapsed, 0, 2500),
      thoughtCollapseFade: phase(elapsed, 0, 780),
      particleProgress: phase(elapsed, 0, 2900),
      impactProgress: 0,
      scratchProgress: 0.3 * (1 - frontToRun),
      headShakeProgress: phase(elapsed, 160, 900),
      ballApproachProgress: 0,
      ballReboundProgress: 0,
      shadowAllowed: true,
      interrupt: true
    };
  }

  function completeInterrupt(scene, state, config) {
    renderFrame(scene, state, state.elapsed, config);
    stopLoop(state);
    state.interrupt.active = false;
    state.interrupt.completed = true;

    if (state.interrupt.resolve) {
      state.interrupt.resolve();
    }

    state.interrupt.promise = null;
    state.interrupt.resolve = null;
  }

  function resetRuntimeState(state, keepCompleted) {
    state.plusDistractionStart = 0;
    state.manualDisintegrationMode = "";
    state.interrupt.active = false;
    state.interrupt.startTime = 0;
    state.interrupt.startX = CENTRE_X;
    state.interrupt.promise = null;
    state.interrupt.resolve = null;
    state.interrupt.completed = keepCompleted ? state.interrupt.completed : false;
  }

  function isLandingActive(state) {
    return state.landingVisible && !state.interrupt.completed;
  }

  function handlePlusDistraction(scene, state, config) {
    if (!isLandingActive(state) || state.interrupt.active || config.prefersReducedMotion) {
      return;
    }

    state.plusDistractionStart = performance.now();
  }

  function plusDistractionAmount(state) {
    if (!state.plusDistractionStart) {
      return 0;
    }

    const age = performance.now() - state.plusDistractionStart;

    if (age > 1300) {
      state.plusDistractionStart = 0;
      return 0;
    }

    return Math.sin(clamp(age / 1300, 0, 1) * Math.PI);
  }

  function measureLandingVisible(config) {
    const section = document.getElementById("landing") || root.closest("section");

    if (!section) {
      return true;
    }

    const rect = section.getBoundingClientRect();
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;
    const threshold = config && config.landingThreshold ? config.landingThreshold : 0.35;

    return visibleHeight > 0 && ratio >= threshold;
  }

  function renderBackgroundDust(scene, timeline, elapsed) {
    const visibility = timeline.thoughtIntensity * (1 - timeline.thoughtCollapseFade);

    scene.backgroundDust.forEach(function (item) {
      const intro = phase(elapsed, item.start, item.start + 900);
      const x = item.x + Math.sin(elapsed * 0.0005 + item.index) * item.drift;
      const y = item.y + Math.cos(elapsed * 0.0004 + item.index) * item.drift * 0.32;
      const opacity = item.opacity * intro * visibility;

      item.element.style.opacity = opacity.toFixed(3);
      setAttrs(item.element, {
        cx: x.toFixed(2),
        cy: y.toFixed(2)
      });
    });
  }

  function renderShadow(scene, timeline, config) {
    const opacity = Math.max(timeline.profileOpacity, timeline.frontOpacity);

    if (!timeline.shadowAllowed || opacity <= 0.002) {
      scene.shadow.style.opacity = "0";
      return;
    }

    const x = timeline.profileOpacity > timeline.frontOpacity ? timeline.profileX : config.centreX;
    const run = timeline.profileRun ? 1 : 0;
    const rx = 38 + timeline.profileOpacity * (timeline.profileRun ? 15 : 8) + timeline.frontOpacity * 10;
    const ry = run ? 4.6 : 5.2;
    const shadowOpacity = (0.12 + opacity * 0.08 + run * 0.04).toFixed(3);

    setAttrs(scene.shadow, {
      cx: x.toFixed(2),
      cy: GROUND_Y + 8,
      rx: rx.toFixed(2),
      ry: ry.toFixed(2)
    });
    scene.shadow.style.opacity = shadowOpacity;
  }

  function renderThreadDot(scene, timeline, elapsed, visibility) {
    const dot = scene.threadDot || (scene.threadDot = svgEl("circle", { class: "thought-dot", r: "4.2" }, scene.layers.thoughtsFront));
    const p = easeOutCubic(timeline.threadProgress);
    const orbit = timeline.orbitProgress;
    let point = cubicPoint(
      { x: CENTRE_X + 10, y: 286 },
      { x: CENTRE_X + 96, y: 242 },
      { x: CENTRE_X + 176, y: 286 },
      { x: CENTRE_X + 260, y: 218 },
      p
    );

    if (orbit > 0) {
      const angle = elapsed * 0.001 + 0.8;
      point = {
        x: lerp(point.x, THOUGHT_CX + Math.cos(angle) * 356, orbit * 0.72),
        y: lerp(point.y, THOUGHT_CY + Math.sin(angle) * 128, orbit * 0.72)
      };
    }

    dot.style.opacity = (p * visibility).toFixed(3);
    setAttrs(dot, {
      cx: point.x.toFixed(2),
      cy: point.y.toFixed(2)
    });
  }

  function createThoughtLineSpecs() {
    const lines = [
      {
        id: "first-thread",
        layer: "front",
        start: TIME.threadStart,
        draw: 1400,
        opacity: 0.72,
        width: 1.2,
        color: "#111",
        driftX: 3,
        driftY: 2,
        spin: 0,
        d: "M972 286 C1034 244 1116 265 1178 210 C1260 136 1418 154 1536 226"
      },
      {
        id: "quiet-orbit-left",
        layer: "behind",
        start: TIME.orbitStart,
        draw: 1700,
        opacity: 0.38,
        width: 1.15,
        color: "#333",
        driftX: 6,
        driftY: 4,
        spin: -4,
        d: "M468 390 C622 240 874 176 1128 226 C1376 274 1468 438 1234 500 C960 566 642 506 468 390"
      },
      {
        id: "front-ribbon",
        layer: "front",
        start: TIME.orbitStart + 260,
        draw: 1800,
        opacity: 0.28,
        width: 6,
        color: "#999",
        ribbon: true,
        driftX: 7,
        driftY: 3,
        spin: 2,
        d: "M306 434 C540 330 774 332 1012 380 C1238 426 1404 368 1616 256"
      },
      {
        id: "upper-sweep",
        layer: "front",
        start: TIME.orbitStart + 620,
        draw: 1600,
        opacity: 0.34,
        width: 1.1,
        color: "#555",
        driftX: 5,
        driftY: 6,
        spin: 5,
        d: "M598 226 C802 98 1128 132 1388 302 C1534 398 1458 512 1194 494"
      },
      {
        id: "dotted-path-a",
        layer: "behind",
        start: TIME.buildStart,
        draw: 1500,
        opacity: 0.46,
        width: 1.1,
        color: "#222",
        dotted: true,
        driftX: 6,
        driftY: 4,
        spin: -3,
        d: "M462 268 C690 382 1000 402 1310 246 C1440 182 1542 218 1618 292"
      },
      {
        id: "process-sweep",
        layer: "behind",
        start: TIME.buildStart + 440,
        draw: 1700,
        opacity: 0.42,
        width: 1.5,
        color: "#444",
        driftX: 8,
        driftY: 5,
        spin: 6,
        d: "M270 414 C510 258 760 186 1044 198 C1302 206 1510 254 1686 358"
      },
      {
        id: "low-return",
        layer: "behind",
        start: TIME.buildStart + 900,
        draw: 1600,
        opacity: 0.3,
        width: 0.9,
        color: "#777",
        driftX: 7,
        driftY: 3,
        spin: -5,
        d: "M1572 444 C1320 380 1100 400 828 484 C650 540 450 518 302 440"
      },
      {
        id: "dotted-path-b",
        layer: "front",
        start: TIME.buildStart + 1320,
        draw: 1500,
        opacity: 0.32,
        width: 0.95,
        color: "#555",
        dotted: true,
        driftX: 4,
        driftY: 5,
        spin: 4,
        d: "M1570 184 C1324 132 1138 206 914 338 C734 444 560 460 390 388"
      },
      {
        id: "wide-tail",
        layer: "front",
        start: TIME.buildStart + 1760,
        draw: 1500,
        opacity: 0.25,
        width: 0.8,
        color: "#777",
        driftX: 9,
        driftY: 5,
        spin: 3,
        d: "M214 314 C454 230 660 260 834 368 C1012 482 1262 486 1734 306"
      }
    ];

    for (let i = 0; i < 11; i += 1) {
      lines.push({
        id: "peak-vortex-" + i,
        layer: i % 3 === 0 ? "front" : "behind",
        start: TIME.vortexStart + i * 115,
        draw: 1600 + (i % 4) * 120,
        opacity: i % 4 === 0 ? 0.22 : 0.34,
        width: i % 5 === 0 ? 2.2 : seededRange(i + 80, 0.7, 1.6),
        color: i % 4 === 0 ? "#777" : i % 2 === 0 ? "#222" : "#555",
        dotted: i === 4 || i === 8,
        ribbon: i === 2,
        driftX: seededRange(i + 10, 4, 12),
        driftY: seededRange(i + 20, 2, 8),
        spin: seededRange(i + 30, -12, 12),
        d: vortexPath(i)
      });
    }

    return lines;
  }

  function createThoughtIconSpecs(rng) {
    return [
      iconSpec("book", 444, 164, 0.86, TIME.buildStart + 400, 46, 22, -0.45, 0.78, rng),
      iconSpec("floor-plan", 552, 398, 1.0, TIME.buildStart + 680, 34, 18, 0.4, 0.45, rng),
      iconSpec("sketch-panel", 738, 196, 0.72, TIME.buildStart + 920, 52, 24, 0.38, 0.56, rng),
      iconSpec("iteration", 1015, 158, 0.74, TIME.buildStart + 1160, 44, 24, 0.5, 0.54, rng),
      iconSpec("tablet", 1132, 180, 0.66, TIME.buildStart + 1340, 50, 26, -0.32, 0.58, rng),
      iconSpec("perspective", 1298, 276, 0.78, TIME.buildStart + 1540, 60, 30, 0.42, 0.48, rng),
      iconSpec("laptop", 1434, 366, 0.72, TIME.buildStart + 1780, 70, 36, -0.38, 0.54, rng),
      iconSpec("pencil", 1518, 226, 0.62, TIME.buildStart + 1960, 62, 28, 0.34, 0.44, rng),
      iconSpec("massing", 1280, 430, 0.66, TIME.buildStart + 2200, 58, 30, 0.38, 0.62, rng),
      iconSpec("model", 730, 426, 0.64, TIME.buildStart + 2460, 52, 26, -0.4, 0.5, rng),
      iconSpec("chai", 1378, 178, 0.52, TIME.buildStart + 2740, 58, 26, 0.3, 0.48, rng),
      iconSpec("loose-page", 626, 250, 0.56, TIME.buildStart + 2980, 48, 25, -0.42, 0.42, rng),
      iconSpec("tennis", 386, 418, 0.88, TIME.buildStart + 3200, 56, 24, 0.36, 0.72, rng),
      iconSpec("tennis-ball", 520, 324, 0.62, TIME.buildStart + 3460, 46, 22, -0.44, 0.68, rng),
      iconSpec("cube", 1510, 414, 0.72, TIME.buildStart + 3660, 68, 32, 0.44, 0.68, rng),
      iconSpec("cube", 1186, 414, 0.56, TIME.buildStart + 3860, 62, 30, -0.38, 0.52, rng),
      iconSpec("grid-fragment", 1320, 326, 0.78, TIME.vortexStart + 420, 76, 34, 0.36, 0.38, rng),
      iconSpec("panels", 1580, 282, 0.7, TIME.vortexStart + 720, 70, 38, -0.34, 0.46, rng),
      iconSpec("reading", 612, 140, 0.56, TIME.vortexStart + 980, 62, 28, 0.42, 0.5, rng)
    ];
  }

  function createParticleSpecs(rng, origins, count) {
    const particles = [];

    for (let i = 0; i < count; i += 1) {
      const origin = origins[i % origins.length];
      const angle = rng() * Math.PI * 2;
      const shapeRoll = rng();
      const shape = shapeRoll > 0.68 ? "dot" : shapeRoll > 0.36 ? "cube" : "square";

      particles.push({
        originX: origin.x + lerp(-32, 32, rng()),
        originY: origin.y + lerp(-22, 22, rng()),
        scatterX: Math.cos(angle) * lerp(110, 430, rng()),
        scatterY: Math.sin(angle) * lerp(36, 190, rng()) - lerp(0, 84, rng()),
        gravity: lerp(520, 860, rng()),
        size: shape === "dot" ? lerp(2, 6, rng()) : lerp(3, 10, rng()),
        shape: shape,
        angle: angle,
        orbit: lerp(8, 40, rng()),
        rotation: lerp(-180, 180, rng()),
        rotationSpeed: lerp(-320, 320, rng()),
        opacity: lerp(0.34, 0.78, rng()),
        delay: lerp(0, 0.18, rng())
      });
    }

    return particles;
  }

  function createBackgroundDust(rng) {
    const dust = [];

    for (let i = 0; i < 58; i += 1) {
      dust.push({
        x: lerp(230, 1700, rng()),
        y: lerp(122, 460, rng()),
        r: lerp(1, 3.2, rng()),
        opacity: lerp(0.08, 0.3, rng()),
        drift: lerp(2, 9, rng()),
        start: TIME.buildStart + lerp(0, 5600, rng()),
        index: i
      });
    }

    return dust;
  }

  function createBackgroundDustElements(scene, state) {
    return state.backgroundDust.map(function (spec) {
      const element = svgEl("circle", {
        class: "background-dust",
        cx: spec.x,
        cy: spec.y,
        r: spec.r
      }, scene.layers.backgroundDust);

      element.style.opacity = "0";
      return Object.assign({ element: element }, spec);
    });
  }

  function createParticleOrigins(icons, lines) {
    const origins = icons.map(function (icon) {
      return { x: icon.x, y: icon.y };
    });

    lines.forEach(function (line, index) {
      const angle = index * 0.68;
      origins.push({
        x: THOUGHT_CX + Math.cos(angle) * (170 + (index % 7) * 54),
        y: THOUGHT_CY + Math.sin(angle) * (68 + (index % 5) * 24)
      });
    });

    origins.push(
      { x: CENTRE_X + 40, y: GROUND_Y - 224 },
      { x: CENTRE_X - 120, y: GROUND_Y - 150 },
      { x: CENTRE_X + 150, y: GROUND_Y - 140 }
    );

    return origins;
  }

  function iconSpec(type, x, y, scale, start, orbitX, orbitY, speed, opacity, rng) {
    return {
      type: type,
      x: x,
      y: y,
      scale: scale,
      start: start,
      orbitX: orbitX,
      orbitY: orbitY,
      speed: speed,
      opacity: opacity,
      rotation: lerp(-9, 9, rng()),
      baseAngle: rng() * Math.PI * 2
    };
  }

  function buildIcon(type, group) {
    if (type === "book") {
      path(group, "M-43 -24 C-22 -31 -8 -23 0 -12 C10 -24 27 -31 43 -23 L42 30 C24 22 11 25 0 38 C-10 25 -25 22 -43 30 Z");
      line(group, 0, -12, 0, 37);
      line(group, -31, -5, -10, 1);
      line(group, 12, -4, 34, -10);
      line(group, -31, 9, -11, 14);
      line(group, 12, 13, 33, 7);
      return;
    }

    if (type === "floor-plan") {
      rect(group, -42, -30, 84, 60);
      line(group, -17, -30, -17, 30);
      line(group, 9, -30, 9, 30);
      line(group, 28, -30, 28, 12);
      line(group, -42, -9, 42, -9);
      line(group, -42, 11, 42, 11);
      line(group, -42, 30, 42, -30);
      return;
    }

    if (type === "sketch-panel") {
      rect(group, -48, -28, 96, 56);
      path(group, "M-36 12 C-14 -20 12 -20 36 9");
      path(group, "M-38 -9 C-15 -2 12 -5 38 -15");
      line(group, -26, 20, 26, 20);
      return;
    }

    if (type === "iteration") {
      path(group, "M-34 2 C-28 -25 24 -30 33 -2");
      path(group, "M33 -2 L22 -8 M33 -2 L27 -14");
      rect(group, -15, -5, 30, 21);
      path(group, "M24 22 C8 39 -29 32 -35 6");
      path(group, "M-35 6 L-25 15 M-35 6 L-28 18");
      return;
    }

    if (type === "tablet") {
      rect(group, -31, -40, 62, 80);
      line(group, -18, -23, 18, -23);
      line(group, -18, -6, 12, -6);
      line(group, -18, 12, 21, 12);
      circle(group, 0, 30, 2.2);
      return;
    }

    if (type === "perspective") {
      rect(group, -42, -24, 84, 48);
      circle(group, 0, 1, 2.1);
      line(group, -42, -24, 0, 1);
      line(group, 42, -24, 0, 1);
      line(group, -42, 24, 0, 1);
      line(group, 42, 24, 0, 1);
      return;
    }

    if (type === "laptop") {
      rect(group, -44, -28, 88, 50);
      path(group, "M-58 31 L58 31 L42 22 L-42 22 Z");
      line(group, -30, -13, 28, -13);
      line(group, -24, 2, 18, 2);
      circle(group, 0, 27, 1.8);
      return;
    }

    if (type === "pencil") {
      line(group, -40, 22, 30, -30);
      path(group, "M30 -30 L42 -39 L36 -23 Z");
      line(group, -22, 9, -8, 22);
      return;
    }

    if (type === "massing") {
      path(group, "M-42 18 L-12 0 L17 15 L-13 35 Z");
      path(group, "M-12 0 L-12 -31 L17 -12 L17 15");
      path(group, "M18 14 L43 0 L43 24 L17 39 Z");
      path(group, "M18 14 L18 -8 L43 0");
      return;
    }

    if (type === "model") {
      path(group, "M-39 16 L-4 -6 L37 14 L2 36 Z");
      path(group, "M-4 -6 L-4 -35 L37 -14 L37 14");
      path(group, "M-4 -35 L-39 -12 L-39 16");
      return;
    }

    if (type === "chai") {
      path(group, "M-27 -6 L19 -6 L13 19 C4 26 -12 26 -21 19 Z");
      path(group, "M18 -2 C39 -2 38 18 19 17");
      path(group, "M-33 27 C-10 34 14 34 35 27");
      path(group, "M-12 -17 C-22 -28 -5 -29 -14 -41");
      path(group, "M5 -17 C-3 -29 14 -30 5 -42");
      return;
    }

    if (type === "loose-page") {
      path(group, "M-34 -27 C-9 -38 18 -30 36 -12 L24 31 C4 20 -16 24 -36 11 Z");
      line(group, -21, -9, 18, -15);
      line(group, -19, 1, 20, -4);
      line(group, -16, 12, 12, 8);
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
      return;
    }

    if (type === "tennis-ball") {
      circle(group, 0, 0, 14);
      path(group, "M-10 -9 C-1 -2 -1 2 -10 9");
      path(group, "M10 -9 C1 -2 1 2 10 9");
      return;
    }

    if (type === "cube") {
      path(group, "M0 -33 L29 -16 L29 18 L0 35 L-29 18 L-29 -16 Z");
      path(group, "M0 -33 L0 1 L29 -16 M0 1 L-29 -16 M0 1 L0 35");
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

    if (type === "panels") {
      rect(group, -42, -24, 32, 42);
      rect(group, 0, -31, 44, 28);
      rect(group, -3, 12, 34, 25);
      line(group, -36, -11, -17, -11);
      line(group, 7, -20, 34, -20);
      line(group, 4, 23, 23, 26);
      return;
    }

    if (type === "reading") {
      rect(group, -32, -26, 64, 42);
      path(group, "M-23 -15 C-8 -21 7 -20 23 -15");
      line(group, -22, -2, 23, -2);
      line(group, -22, 10, 13, 10);
    }
  }

  function vortexPath(index) {
    const points = [];
    const turnOffset = -1.25 + index * 0.39;
    const turns = 0.72 + (index % 5) * 0.13;
    const startRadius = 96 + index * 14;
    const endRadius = 390 + (index % 7) * 42;
    const count = 42;

    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const angle = turnOffset + t * Math.PI * 2 * turns;
      const radius = lerp(startRadius, endRadius, t);
      const sweep = (t - 0.5) * (95 + index * 5);
      const wobble = Math.sin(t * Math.PI * 3 + index * 0.7) * 10;
      points.push([
        THOUGHT_CX + 42 + sweep + Math.cos(angle) * (radius * 1.2 + wobble),
        THOUGHT_CY + 38 + Math.sin(angle) * (radius * 0.46 + wobble * 0.25)
      ]);
    }

    return smoothPath(points);
  }

  function getScratchProgress(t) {
    const lift = phase(t, TIME.impact, TIME.impact + 760);
    const hold = 1 - phase(t, TIME.impact + 1200, TIME.collapseEnd + 650);

    return clamp(easeOutCubic(lift) * hold, 0, 1);
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

  function svgEl(tag, attrs, parent) {
    const element = document.createElementNS(NS, tag);

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

  function cubicPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;

    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  function quadraticPoint(p0, p1, p2, t) {
    const u = 1 - t;

    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
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

  function easeOutBackSmall(t) {
    const c1 = 1.18;
    const c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);

    return x * x * (3 - 2 * x);
  }

  function seededRange(seed, min, max) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    const fraction = value - Math.floor(value);

    return min + (max - min) * fraction;
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
})();
