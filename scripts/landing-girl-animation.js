(function () {
  "use strict";

  const root = document.querySelector("[data-landing-girl-animation]");

  if (!root) {
    return;
  }

  const VIEWBOX = { width: 1920, height: 620 };
  const DURATION = 24000;
  const NS = "http://www.w3.org/2000/svg";
  const GROUND_Y = 480;
  const GIRL_CENTER_X = 960;
  const THOUGHT_CX = GIRL_CENTER_X;
  const THOUGHT_CY = 305;

  const TIMING = {
    emptyEnd: 1500,
    walkInStart: 1500,
    walkInEnd: 6000,
    settleStart: 6000,
    settleEnd: 7100,
    threadStart: 7100,
    threadEnd: 8600,
    loopsStart: 8600,
    loopsEnd: 10800,
    designStart: 10800,
    designEnd: 14000,
    hobbyStart: 14000,
    hobbyEnd: 16500,
    vortexStart: 16500,
    vortexEnd: 19000,
    ballStart: 19000,
    impact: 19750,
    collapseStart: 20000,
    collapseEnd: 21900,
    recoverStart: 21900,
    recoverEnd: 22600,
    walkOutStart: 22600,
    walkOutEnd: 23700,
    resetEnd: 24000
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPhone = window.matchMedia("(max-width: 767px)").matches;
  const isTablet = window.matchMedia("(min-width: 768px) and (max-width: 1180px)").matches;

  const config = {
    width: VIEWBOX.width,
    height: VIEWBOX.height,
    duration: DURATION,
    density: isPhone ? 0.7 : isTablet ? 0.85 : 1
  };

  const state = createSceneState(config);
  const scene = createScene(root, config, state);

  if (prefersReducedMotion) {
    renderStaticScene(scene, state, config);
    return;
  }

  let startTime = performance.now();
  let frameId = 0;

  function tick(now) {
    const elapsed = (now - startTime) % config.duration;
    renderFrame(scene, state, elapsed, config);
    frameId = requestAnimationFrame(tick);
  }

  frameId = requestAnimationFrame(tick);

  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frameId);
  });

  function createSceneState(sceneConfig) {
    const rng = createSeededRandom(42);
    const threadPaths = [
      {
        id: "first-thread",
        layer: "behind",
        start: TIMING.threadStart,
        draw: 1200,
        opacity: 0.78,
        soft: false,
        d: "M960 318 C1018 280 920 254 994 218 C1066 184 1146 232 1084 278 C1046 306 1000 294 1038 236"
      },
      {
        id: "head-loop",
        layer: "behind",
        start: TIMING.loopsStart,
        draw: 1500,
        opacity: 0.38,
        soft: true,
        d: "M690 350 C762 206 1058 188 1190 305 C1310 414 1134 506 920 462 C706 418 626 372 690 350"
      },
      {
        id: "torso-loop",
        layer: "front",
        start: TIMING.loopsStart + 360,
        draw: 1500,
        opacity: 0.28,
        soft: true,
        d: "M610 408 C728 276 984 220 1196 286 C1376 342 1398 446 1216 500 C1000 565 716 522 610 408"
      },
      {
        id: "upper-orbit",
        layer: "behind",
        start: TIMING.loopsStart + 760,
        draw: 1450,
        opacity: 0.34,
        soft: true,
        d: "M812 228 C948 154 1228 202 1312 340 C1394 478 1140 552 884 498 C650 448 674 300 812 228"
      },
      {
        id: "spatial-sweep-left",
        layer: "behind",
        start: TIMING.designStart + 400,
        draw: 1700,
        opacity: 0.3,
        soft: true,
        d: "M410 432 C552 312 744 236 1000 220 C1198 208 1398 252 1530 348"
      },
      {
        id: "spatial-sweep-right",
        layer: "front",
        start: TIMING.designStart + 900,
        draw: 1650,
        opacity: 0.24,
        soft: true,
        d: "M470 292 C690 410 974 384 1246 238 C1330 196 1410 212 1484 270"
      },
      {
        id: "lower-return",
        layer: "behind",
        start: TIMING.hobbyStart - 650,
        draw: 1500,
        opacity: 0.26,
        soft: true,
        d: "M1430 440 C1258 378 1068 384 822 464 C698 504 556 500 448 448"
      }
    ];

    for (let i = 0; i < 18; i += 1) {
      threadPaths.push({
        id: "vortex-" + i,
        layer: i % 3 === 0 ? "front" : "behind",
        start: TIMING.vortexStart + i * 82,
        draw: 1550,
        opacity: i % 3 === 0 ? 0.28 : 0.42,
        soft: i % 4 === 0,
        d: spiralPath(i),
        spin: seededRange(i + 8, -0.9, 1.2),
        scatterX: seededRange(i + 21, -260, 280),
        scatterY: seededRange(i + 34, -70, 140)
      });
    }

    const designIcons = [
      iconSpec("sketchbook", -305, -116, 0.88, TIMING.designStart, 118, 44, 0.48, rng),
      iconSpec("floor-plan", -430, 42, 0.94, TIMING.designStart + 420, 132, 48, -0.42, rng),
      iconSpec("perspective", 318, -88, 0.88, TIMING.designStart + 820, 132, 46, 0.46, rng),
      iconSpec("pencil", 452, 54, 0.78, TIMING.designStart + 1240, 150, 54, -0.36, rng),
      iconSpec("iteration", 12, -154, 0.8, TIMING.designStart + 1600, 118, 38, 0.54, rng),
      iconSpec("panels", -98, 142, 0.88, TIMING.designStart + 2020, 128, 52, -0.5, rng),
      iconSpec("cube", 246, 132, 0.78, TIMING.designStart + 2440, 122, 46, 0.4, rng),
      iconSpec("model", -252, 128, 0.78, TIMING.designStart + 2780, 128, 46, -0.48, rng)
    ];

    const hobbyIcons = [
      iconSpec("chai", 520, -18, 0.54, TIMING.hobbyStart, 170, 62, 0.38, rng),
      iconSpec("book", -548, -20, 0.56, TIMING.hobbyStart + 640, 170, 60, -0.34, rng),
      iconSpec("tennis", 500, 126, 0.52, TIMING.hobbyStart + 1240, 180, 70, 0.45, rng),
      iconSpec("reading", -474, 136, 0.5, TIMING.hobbyStart + 1860, 158, 62, -0.46, rng)
    ];

    const particleCount = Math.round(66 * sceneConfig.density);
    const particles = [];

    for (let i = 0; i < particleCount; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = lerp(70, 470, rng());
      const shape = rng() > 0.38 ? "square" : "dot";

      particles.push({
        originX: THOUGHT_CX + Math.cos(angle) * radius,
        originY: THOUGHT_CY + Math.sin(angle) * radius * 0.44,
        scatterX: Math.cos(angle) * lerp(90, 270, rng()),
        scatterY: Math.sin(angle) * lerp(24, 118, rng()),
        gravity: lerp(54, 150, rng()),
        size: lerp(1.5, 4.8, rng()),
        shape: shape,
        angle: angle,
        orbit: lerp(8, 42, rng()),
        speed: lerp(-0.52, 0.56, rng()) || 0.18,
        rotation: lerp(-160, 160, rng()),
        rotationSpeed: lerp(-260, 260, rng()),
        opacity: lerp(0.28, 0.72, rng()),
        delay: lerp(0, 0.35, rng())
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
      floor: svgEl("g", { class: "floor-layer" }, svg),
      behind: svgEl("g", { class: "thoughts-behind" }, svg),
      girl: svgEl("g", { class: "girl-layer" }, svg),
      front: svgEl("g", { class: "thoughts-front" }, svg),
      particles: svgEl("g", { class: "particle-layer" }, svg),
      impact: svgEl("g", { class: "impact-layer" }, svg)
    };

    const scene = {
      svg: svg,
      layers: layers,
      floorLine: svgEl("path", {
        class: "floor-line",
        d: "M330 484 C506 474 642 486 790 480 C1010 470 1176 490 1384 480 C1466 476 1538 478 1604 483",
        pathLength: "1"
      }, layers.floor)
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
    const group = svgEl("g", { class: "landing-girl" }, scene.layers.girl);
    const legs = svgEl("g", { class: "girl-legs" }, group);
    const body = svgEl("g", { class: "girl-body" }, group);
    const head = svgEl("g", { class: "girl-head" }, body);

    const legLeft = svgEl("path", {
      class: "girl-limb leg-left",
      d: "M-22 -66 C-29 -48 -31 -27 -28 -7 C-22 -4 -15 -5 -12 -10 C-14 -30 -11 -48 -6 -64 C-10 -68 -17 -69 -22 -66 Z"
    }, legs);
    const legRight = svgEl("path", {
      class: "girl-limb leg-right",
      d: "M8 -64 C13 -46 15 -28 12 -9 C16 -4 24 -4 30 -8 C32 -28 29 -49 22 -66 C17 -69 11 -68 8 -64 Z"
    }, legs);
    const footLeft = svgEl("ellipse", {
      class: "girl-foot foot-left",
      cx: "-28",
      cy: "-3",
      rx: "16",
      ry: "4.5"
    }, legs);
    const footRight = svgEl("ellipse", {
      class: "girl-foot foot-right",
      cx: "28",
      cy: "-3",
      rx: "16",
      ry: "4.5"
    }, legs);

    const armLeft = svgEl("path", {
      class: "girl-limb arm-left",
      d: "M-33 -136 C-45 -118 -52 -96 -53 -76 C-49 -70 -41 -70 -38 -78 C-36 -96 -29 -116 -20 -130 C-23 -136 -28 -139 -33 -136 Z"
    }, body);
    const armRight = svgEl("path", {
      class: "girl-limb arm-right",
      d: "M21 -130 C31 -116 38 -96 40 -78 C43 -70 51 -70 55 -76 C53 -96 46 -118 34 -136 C29 -139 24 -136 21 -130 Z"
    }, body);

    svgEl("path", {
      class: "girl-fill dress",
      d: "M-30 -147 C-42 -130 -47 -100 -54 -59 C-36 -50 -12 -47 9 -49 C29 -50 45 -54 56 -60 C48 -101 42 -130 30 -147 C13 -155 -14 -155 -30 -147 Z"
    }, body);
    svgEl("rect", {
      class: "girl-fill neck",
      x: "-9",
      y: "-162",
      width: "18",
      height: "23",
      rx: "6"
    }, body);
    svgEl("ellipse", {
      class: "girl-fill hair",
      cx: "-7",
      cy: "-192",
      rx: "30",
      ry: "36"
    }, head);
    const ponytail = svgEl("path", {
      class: "girl-fill ponytail",
      d: "M21 -198 C58 -215 73 -176 46 -160 C25 -151 10 -182 21 -198 Z"
    }, head);
    svgEl("ellipse", {
      class: "girl-fill head-shape",
      cx: "0",
      cy: "-186",
      rx: "24",
      ry: "30"
    }, head);

    return {
      group: group,
      legs: legs,
      body: body,
      head: head,
      ponytail: ponytail,
      legLeft: legLeft,
      legRight: legRight,
      footLeft: footLeft,
      footRight: footRight,
      armLeft: armLeft,
      armRight: armRight
    };
  }

  function createThoughtPaths(scene, sceneState) {
    return sceneState.threadPaths.map(function (spec, index) {
      const parent = spec.layer === "front" ? scene.layers.front : scene.layers.behind;
      const element = svgEl("path", {
        class: "thought-line" + (spec.soft ? " is-soft" : ""),
        d: spec.d,
        pathLength: "1"
      }, parent);

      element.style.strokeDasharray = "1";
      element.style.strokeDashoffset = "1";

      return {
        element: element,
        index: index,
        start: spec.start,
        draw: spec.draw,
        opacity: spec.opacity,
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

    return {
      group: group,
      ball: ball,
      impact: impact
    };
  }

  function getGirlState(elapsed) {
    const state = {
      x: 2050,
      y: GROUND_Y,
      opacity: 0,
      mode: "hidden",
      facing: "left",
      turnProgress: 0,
      walkPhase: elapsed * 0.0088,
      bodyBob: 0,
      headTilt: 0,
      impactAmount: 0,
      breathingAmount: 0
    };

    if (elapsed < TIMING.walkInStart) {
      return state;
    }

    if (elapsed < TIMING.walkInEnd) {
      const p = easeInOutCubic(phase(elapsed, TIMING.walkInStart, TIMING.walkInEnd));
      state.x = lerp(2050, GIRL_CENTER_X, p);
      state.opacity = phase(elapsed, TIMING.walkInStart, TIMING.walkInStart + 420);
      state.mode = "walkIn";
      state.bodyBob = Math.abs(Math.sin(state.walkPhase)) * 2.2;
      return state;
    }

    if (elapsed < TIMING.settleEnd) {
      const settle = phase(elapsed, TIMING.settleStart, TIMING.settleEnd);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "settle";
      state.facing = "front";
      state.turnProgress = smoothstep(settle);
      state.walkPhase = Math.PI * 0.5;
      state.bodyBob = Math.sin(settle * Math.PI) * 2;
      return state;
    }

    if (elapsed < TIMING.impact) {
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "zoned";
      state.facing = "front";
      state.turnProgress = 1;
      state.walkPhase = Math.PI * 0.5;
      state.breathingAmount = Math.sin(elapsed * 0.0016) * 1.4;
      return state;
    }

    if (elapsed < TIMING.collapseEnd) {
      const hitIn = Math.sin(phase(elapsed, TIMING.impact, TIMING.impact + 230) * Math.PI);
      const hitOut = 1 - phase(elapsed, TIMING.impact + 230, TIMING.collapseEnd);
      const hit = Math.max(hitIn, hitOut * 0.68);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "impact";
      state.facing = "front";
      state.turnProgress = 1;
      state.walkPhase = Math.PI * 0.5;
      state.impactAmount = hit;
      state.headTilt = -4.5 * hit;
      state.bodyBob = 3.6 * hit;
      return state;
    }

    if (elapsed < TIMING.recoverEnd) {
      const recover = 1 - phase(elapsed, TIMING.recoverStart, TIMING.recoverEnd);
      state.x = GIRL_CENTER_X;
      state.opacity = 1;
      state.mode = "recover";
      state.facing = "front";
      state.turnProgress = 1;
      state.walkPhase = Math.PI * 0.5;
      state.bodyBob = Math.sin((1 - recover) * Math.PI) * 1.2;
      return state;
    }

    if (elapsed < TIMING.walkOutEnd) {
      const p = easeInOutCubic(phase(elapsed, TIMING.walkOutStart, TIMING.walkOutEnd));
      state.x = lerp(GIRL_CENTER_X, -160, p);
      state.opacity = 1 - phase(elapsed, TIMING.walkOutEnd - 260, TIMING.walkOutEnd) * 0.55;
      state.mode = "walkOut";
      state.facing = "left";
      state.walkPhase = elapsed * 0.0096;
      state.bodyBob = Math.abs(Math.sin(state.walkPhase)) * 2.2;
      return state;
    }

    return state;
  }

  function renderGirl(scene, girlState) {
    const walk = girlState.mode === "walkIn" || girlState.mode === "walkOut" ? 1 : 0;
    const sideScale = 0.78;
    const scaleX = girlState.facing === "front" ? lerp(sideScale, 0.96, girlState.turnProgress) : sideScale;
    const breathing = girlState.breathingAmount;
    const y = girlState.y + girlState.bodyBob + breathing;
    const swing = Math.sin(girlState.walkPhase) * 14 * walk;
    const armEase = girlState.mode === "zoned" ? 2.4 : 0;

    scene.girl.group.style.opacity = girlState.opacity.toFixed(3);
    setTransform(
      scene.girl.group,
      "translate(" + girlState.x.toFixed(2) + " " + y.toFixed(2) + ") scale(" + scaleX.toFixed(3) + " 1)"
    );

    setTransform(scene.girl.armLeft, "rotate(" + (swing * 0.56 - armEase).toFixed(2) + " -30 -132)");
    setTransform(scene.girl.armRight, "rotate(" + (-swing * 0.56 + armEase).toFixed(2) + " 30 -132)");
    setTransform(scene.girl.legLeft, "rotate(" + (-swing * 0.82).toFixed(2) + " -15 -63)");
    setTransform(scene.girl.legRight, "rotate(" + (swing * 0.82).toFixed(2) + " 16 -63)");
    setTransform(
      scene.girl.footLeft,
      "translate(" + (-Math.sin(girlState.walkPhase) * 6 * walk).toFixed(2) + " " + (Math.max(0, Math.cos(girlState.walkPhase)) * -2.2 * walk).toFixed(2) + ")"
    );
    setTransform(
      scene.girl.footRight,
      "translate(" + (Math.sin(girlState.walkPhase) * 6 * walk).toFixed(2) + " " + (Math.max(0, -Math.cos(girlState.walkPhase)) * -2.2 * walk).toFixed(2) + ")"
    );
    setTransform(
      scene.girl.head,
      "translate(0 " + (girlState.impactAmount * 3).toFixed(2) + ") rotate(" + (girlState.headTilt + Math.sin(girlState.walkPhase) * 1.1 * walk).toFixed(2) + " 0 -164)"
    );
    setTransform(
      scene.girl.ponytail,
      "rotate(" + (Math.sin(girlState.walkPhase + 1.1) * 5 * walk + girlState.impactAmount * 10).toFixed(2) + " 22 -183)"
    );
  }

  function renderThoughts(scene, state, elapsed) {
    const vortexProgress = phase(elapsed, TIMING.vortexStart, TIMING.vortexEnd);
    const disintegrateProgress = phase(elapsed, TIMING.collapseStart, TIMING.collapseEnd);
    const resetProgress = phase(elapsed, TIMING.collapseEnd, TIMING.recoverEnd);

    renderThreadDot(scene, elapsed, disintegrateProgress);
    renderPathItems(scene.thoughtPaths, elapsed, vortexProgress, disintegrateProgress, resetProgress);
    renderIconItems(scene.designIcons, elapsed, vortexProgress, disintegrateProgress, resetProgress);
    renderIconItems(scene.hobbyIcons, elapsed, vortexProgress, disintegrateProgress, resetProgress);
  }

  function renderThreadDot(scene, elapsed, disintegrateProgress) {
    const threadProgress = easeOutCubic(phase(elapsed, TIMING.threadStart, TIMING.threadEnd));
    const fade = 1 - phase(elapsed, TIMING.designEnd, TIMING.hobbyStart);
    const dis = easeOutCubic(disintegrateProgress);
    const orbitProgress = phase(elapsed, TIMING.threadEnd, TIMING.vortexEnd);
    let point = cubicPoint(
      { x: GIRL_CENTER_X, y: 318 },
      { x: 1032, y: 280 },
      { x: 918, y: 242 },
      { x: 1088, y: 226 },
      threadProgress
    );

    if (orbitProgress > 0) {
      const angle = elapsed * 0.0011 + 0.7;
      point = {
        x: lerp(point.x, THOUGHT_CX + Math.cos(angle) * 260, orbitProgress * 0.72),
        y: lerp(point.y, THOUGHT_CY + Math.sin(angle) * 92, orbitProgress * 0.72)
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
      const dis = easeOutCubic(clamp((disintegrateProgress - item.index * 0.005) / 0.92, 0, 1));
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
      const dis = easeOutCubic(clamp((disintegrateProgress - item.index * 0.025) / 0.9, 0, 1));
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
    const rebound = phase(elapsed, TIMING.impact, TIMING.impact + 430);
    const impactPoint = {
      x: GIRL_CENTER_X + 28,
      y: GROUND_Y - 214
    };
    let point = { x: 1608, y: 118 };
    let opacity = 0;

    if (approach > 0 && approach < 1) {
      point = quadraticPoint(
        { x: 1608, y: 118 },
        { x: 1332, y: 96 },
        impactPoint,
        easeInOutCubic(approach)
      );
      opacity = phase(elapsed, TIMING.ballStart, TIMING.ballStart + 160);
    } else if (elapsed >= TIMING.impact && elapsed < TIMING.impact + 620) {
      const r = easeOutCubic(rebound);
      point = {
        x: impactPoint.x + r * 42,
        y: impactPoint.y - Math.sin(rebound * Math.PI) * 22 - r * 12
      };
      opacity = 1 - phase(elapsed, TIMING.impact + 380, TIMING.impact + 620);
    }

    scene.ball.group.style.opacity = opacity.toFixed(3);
    setTransform(scene.ball.group, "translate(" + point.x.toFixed(2) + " " + point.y.toFixed(2) + ")");

    const mark = phase(elapsed, TIMING.impact - 70, TIMING.impact + 70) * (1 - phase(elapsed, TIMING.impact + 160, TIMING.impact + 520));
    scene.ball.impact.style.opacity = mark.toFixed(3);
    setTransform(scene.ball.impact, "translate(" + impactPoint.x + " " + impactPoint.y + ")");
  }

  function renderDisintegration(scene, state, elapsed) {
    const vortexProgress = phase(elapsed, TIMING.vortexStart, TIMING.vortexEnd);
    const disintegrateProgress = phase(elapsed, TIMING.collapseStart, TIMING.collapseEnd);
    const settleFade = phase(elapsed, TIMING.collapseEnd, TIMING.recoverEnd);

    scene.particles.forEach(function (item) {
      if (elapsed < TIMING.collapseStart) {
        const show = vortexProgress * (1 - phase(elapsed, TIMING.impact - 240, TIMING.collapseStart) * 0.28);
        const angle = item.angle + elapsed * 0.00055 * item.speed;
        const x = item.originX + Math.cos(angle) * item.orbit;
        const y = item.originY + Math.sin(angle * 1.17) * item.orbit * 0.56;
        const opacity = item.opacity * 0.36 * show;

        placeParticle(item, x, y, item.rotation + angle * 20, 0.78, opacity);
        return;
      }

      const rawD = clamp((disintegrateProgress - item.delay) / (1 - item.delay), 0, 1);
      const d = easeOutCubic(rawD);
      const fade = 1 - smoothstep(clamp(rawD * 1.08 + settleFade * 0.5, 0, 1));
      const outward = easeOutCubic(clamp(rawD / 0.42, 0, 1));
      const falling = smoothstep(clamp((rawD - 0.22) / 0.78, 0, 1));
      const x = item.originX + item.scatterX * outward;
      const y = item.originY + item.scatterY * outward + item.gravity * falling * falling;
      const opacity = item.opacity * 0.9 * fade;
      const rotation = item.rotation + item.rotationSpeed * d;
      const scale = 0.92 - d * 0.22;

      placeParticle(item, x, y, rotation, scale, opacity);
    });
  }

  function renderFrame(scene, state, elapsed, sceneConfig) {
    const girlState = getGirlState(elapsed, sceneConfig);

    renderFloor(scene, elapsed, girlState);
    renderThoughts(scene, state, elapsed, sceneConfig);
    renderGirl(scene, girlState, elapsed);
    renderBall(scene, state, elapsed, sceneConfig);
    renderDisintegration(scene, state, elapsed, sceneConfig);
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

  function renderFloor(scene, elapsed, girlState) {
    const enter = phase(elapsed, TIMING.walkInStart, TIMING.walkInStart + 900);
    const exit = phase(elapsed, TIMING.walkOutStart, TIMING.walkOutEnd);
    const opacity = (0.11 + enter * 0.15) * girlState.opacity * (1 - exit * 0.4);

    scene.floorLine.style.opacity = opacity.toFixed(3);
    scene.floorLine.style.strokeDasharray = "1";
    scene.floorLine.style.strokeDashoffset = (1 - enter).toFixed(3);
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

    if (type === "reading") {
      rect(group, -32, -26, 64, 42);
      path(group, "M-23 -15 C-8 -21 7 -20 23 -15");
      line(group, -22, -2, 23, -2);
      line(group, -22, 10, 13, 10);
    }
  }

  function spiralPath(index) {
    const points = [];
    const turnOffset = index * 0.47;
    const turns = 0.86 + (index % 5) * 0.12;
    const startRadius = 70 + index * 13;
    const endRadius = 320 + (index % 6) * 34;
    const pointCount = 48;

    for (let i = 0; i < pointCount; i += 1) {
      const t = i / (pointCount - 1);
      const angle = turnOffset + t * Math.PI * 2 * turns;
      const radius = lerp(startRadius, endRadius, t);
      const wobble = Math.sin(t * Math.PI * 5 + index) * 12;
      points.push([
        THOUGHT_CX + Math.cos(angle) * (radius + wobble),
        THOUGHT_CY + Math.sin(angle) * (radius * 0.42 + wobble * 0.22)
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
