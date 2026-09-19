(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var promptEl = document.getElementById("prompt");
  var stage = document.getElementById("stage");

  var VIEW_W = 960;
  var VIEW_H = 600;
  var camera = { x: 0, y: 0 };

  function fitCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var stageRect = stage.getBoundingClientRect();
    var scale = Math.min(stageRect.width / VIEW_W, stageRect.height / VIEW_H);
    canvas.style.width = Math.floor(VIEW_W * scale) + "px";
    canvas.style.height = Math.floor(VIEW_H * scale) + "px";
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", fitCanvas);

  // ---------- Input ----------
  var keys = {};
  var interactPressed = false;
  var interactHeld = false;

  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === " " || e.key.toLowerCase() === "e" || e.key === "Enter") {
      if (!interactHeld) interactPressed = true;
      interactHeld = true;
    }
  });
  window.addEventListener("keyup", function (e) {
    keys[e.key.toLowerCase()] = false;
    if (e.key === " " || e.key.toLowerCase() === "e" || e.key === "Enter") {
      interactHeld = false;
    }
  });

  var joyBase = document.getElementById("joystick-base");
  var joyKnob = document.getElementById("joystick-knob");
  var joyVec = { x: 0, y: 0 };
  var joyActive = false;
  var joyPointerId = null;
  var joyCenter = { x: 0, y: 0 };
  var JOY_RADIUS = 50;

  function joyStart(e) {
    joyActive = true;
    joyPointerId = e.pointerId;
    var rect = joyBase.getBoundingClientRect();
    joyCenter.x = rect.left + rect.width / 2;
    joyCenter.y = rect.top + rect.height / 2;
    joyMove(e);
    joyBase.setPointerCapture(e.pointerId);
  }
  function joyMove(e) {
    if (!joyActive || e.pointerId !== joyPointerId) return;
    var dx = e.clientX - joyCenter.x;
    var dy = e.clientY - joyCenter.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    joyKnob.style.transform =
      "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
    joyVec.x = dx / JOY_RADIUS;
    joyVec.y = dy / JOY_RADIUS;
  }
  function joyEnd(e) {
    if (e.pointerId !== joyPointerId) return;
    joyActive = false;
    joyPointerId = null;
    joyVec.x = 0;
    joyVec.y = 0;
    joyKnob.style.transform = "translate(-50%, -50%)";
  }
  joyBase.addEventListener("pointerdown", joyStart);
  joyBase.addEventListener("pointermove", joyMove);
  joyBase.addEventListener("pointerup", joyEnd);
  joyBase.addEventListener("pointercancel", joyEnd);

  var interactBtn = document.getElementById("interact-btn");
  interactBtn.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    interactPressed = true;
  });

  function getMoveVector() {
    var x = 0,
      y = 0;
    if (keys["arrowleft"] || keys["a"]) x -= 1;
    if (keys["arrowright"] || keys["d"]) x += 1;
    if (keys["arrowup"] || keys["w"]) y -= 1;
    if (keys["arrowdown"] || keys["s"]) y += 1;

    if (x === 0 && y === 0 && (joyVec.x !== 0 || joyVec.y !== 0)) {
      x = joyVec.x;
      y = joyVec.y;
    }

    var len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x: x, y: y };
  }

  // ---------- Helpers ----------
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function shade(hex, amt) {
    var num = parseInt(hex.slice(1), 16);
    var r = (num >> 16) & 255,
      g = (num >> 8) & 255,
      b = num & 255;
    r = amt < 0 ? r * (1 + amt) : r + (255 - r) * amt;
    g = amt < 0 ? g * (1 + amt) : g + (255 - g) * amt;
    b = amt < 0 ? b * (1 + amt) : b + (255 - b) * amt;
    return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
  }

  function groundShadow(cx, cy, rx, ry) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---------- Player ----------
  var player = {
    w: 28,
    h: 40,
    x: 720,
    y: 500,
    speed: 190,
    facing: "down",
    moving: false,
  };

  var PLAYER_PALETTE = { shirt: "#3aa76d", hair: "#4a3524", pants: "#2f3e6b", skin: "#f2c29c" };
  var NPC_PALETTES = [
    { shirt: "#e07a5f", hair: "#2b2b2b", pants: "#3d5a80", skin: "#f2c29c" },
    { shirt: "#f2cc8f", hair: "#6b4a36", pants: "#4a4a4a", skin: "#d9a878" },
    { shirt: "#81b29a", hair: "#1f1f1f", pants: "#5c3d2e", skin: "#f2c29c" },
    { shirt: "#bc6c25", hair: "#3a2a1f", pants: "#283618", skin: "#c78a5c" },
    { shirt: "#9d8189", hair: "#5e3023", pants: "#22223b", skin: "#f2c29c" },
  ];

  function playerBox(p) {
    return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  }

  function getWorldSize(scene) {
    return { w: scene.worldW || VIEW_W, h: scene.worldH || VIEW_H };
  }

  function updateCamera(scene) {
    var world = getWorldSize(scene);
    var focusX = driving ? carPos.x : player.x;
    var focusY = driving ? carPos.y : player.y;
    camera.x = clamp(focusX - VIEW_W / 2, 0, Math.max(0, world.w - VIEW_W));
    camera.y = clamp(focusY - VIEW_H / 2, 0, Math.max(0, world.h - VIEW_H));
  }

  // ---------- NPCs: wander back and forth within a strip of sidewalk ----------
  function makeNpc(bounds, paletteIndex, speed, home) {
    return {
      w: 26,
      h: 38,
      bounds: bounds,
      home: home || null,
      palette: NPC_PALETTES[paletteIndex % NPC_PALETTES.length],
      speed: speed,
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      targetX: bounds.x + bounds.w / 2,
      targetY: bounds.y + bounds.h / 2,
      waitTimer: Math.random() * 2,
      facing: "down",
      moving: false,
      bobOffset: Math.random() * 10,
      state: "wander",
      headingHome: false,
      insideTimer: 0,
    };
  }

  function pickNpcTarget(npc) {
    var b = npc.bounds;
    npc.targetX = b.x + Math.random() * b.w;
    npc.targetY = b.y + Math.random() * b.h;
  }

  function updateNpc(npc, dt) {
    if (npc.state === "inside") {
      npc.insideTimer -= dt;
      npc.moving = false;
      if (npc.insideTimer <= 0) {
        npc.state = "wander";
        npc.x = npc.home.x;
        npc.y = npc.home.y;
        pickNpcTarget(npc);
        npc.waitTimer = 0.4 + Math.random() * 1.5;
      }
      return;
    }

    if (npc.waitTimer > 0) {
      npc.waitTimer -= dt;
      npc.moving = false;
      return;
    }
    var dx = npc.targetX - npc.x;
    var dy = npc.targetY - npc.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) {
      if (npc.headingHome) {
        npc.state = "inside";
        npc.insideTimer = 5 + Math.random() * 8;
        npc.headingHome = false;
        npc.moving = false;
        return;
      }
      if (npc.home && Math.random() < 0.3) {
        npc.targetX = npc.home.x;
        npc.targetY = npc.home.y;
        npc.headingHome = true;
      } else {
        pickNpcTarget(npc);
        npc.headingHome = false;
      }
      npc.waitTimer = 0.6 + Math.random() * 2.2;
      npc.moving = false;
      return;
    }
    npc.moving = true;
    npc.x += (dx / dist) * npc.speed * dt;
    npc.y += (dy / dist) * npc.speed * dt;
    if (Math.abs(dx) > Math.abs(dy)) {
      npc.facing = dx > 0 ? "right" : "left";
    } else {
      npc.facing = dy > 0 ? "down" : "up";
    }
  }

  // ---------- Scenes ----------
  var WALL_COLOR = "#caa472";
  var FLOOR_COLOR = "#e8d3ab";
  var BEDROOM_FLOOR = "#f0dfc0";

  var scenes = {};

  scenes.house = {
    bg: FLOOR_COLOR,
    floorAccent: { x: 40, y: 40, w: 420, h: 520, color: BEDROOM_FLOOR },
    walls: [
      // top wall, gap for back door x:600-680
      { x: 0, y: 0, w: 600, h: 40 },
      { x: 680, y: 0, w: 280, h: 40 },
      // bottom wall, gap for front door x:680-760
      { x: 0, y: 560, w: 680, h: 40 },
      { x: 760, y: 560, w: 200, h: 40 },
      // left/right outer walls
      { x: 0, y: 0, w: 40, h: 600 },
      { x: 920, y: 0, w: 40, h: 600 },
      // dividing wall between bedroom/living room, gap y:250-330
      { x: 460, y: 40, w: 40, h: 210 },
      { x: 460, y: 330, w: 40, h: 230 },
    ],
    furniture: [
      { x: 70, y: 70, w: 180, h: 120, type: "bed" },
      { x: 880, y: 120, w: 40, h: 80, type: "tv" },
      { x: 620, y: 400, w: 180, h: 60, type: "couch" },
    ],
    doors: [],
  };
  scenes.house.doors = [
    {
      trigger: { x: 600, y: 0, w: 80, h: 60 },
      target: "backyard",
      spawn: { x: 640, y: 170, facing: "down" },
    },
    {
      trigger: { x: 680, y: 540, w: 80, h: 60 },
      target: "frontyard",
      spawn: { x: 800, y: 90, facing: "down" },
    },
  ];

  scenes.frontyard = {
    bg: "#7ec850",
    sky: true,
    worldW: 1700,
    worldH: 1300,
    zones: [
      // sidewalks first, road surface drawn on top so it wins at the corner
      { x: 660, y: 170, w: 40, h: 830, color: "#c9c9c9" },
      { x: 900, y: 170, w: 40, h: 830, color: "#c9c9c9" },
      { x: 700, y: 760, w: 960, h: 40, color: "#c9c9c9" },
      { x: 700, y: 1000, w: 960, h: 40, color: "#c9c9c9" },
      { x: 700, y: 170, w: 200, h: 830, color: "#454545" },
      { x: 700, y: 800, w: 960, h: 200, color: "#454545" },
    ],
    roadLines: [
      { orientation: "v", pos: 800, from: 170, to: 800 },
      { orientation: "h", pos: 900, from: 900, to: 1660 },
    ],
    walls: [
      // top wall = edge of the property, gap for the front door
      { x: 0, y: 0, w: 700, h: 40 },
      { x: 900, y: 0, w: 700, h: 40 },
      // world boundary
      { x: 0, y: 1260, w: 1700, h: 40 },
      { x: 0, y: 0, w: 40, h: 1300 },
      { x: 1660, y: 0, w: 40, h: 1300 },
    ],
    furniture: [
      { x: 440, y: 280, w: 200, h: 120, type: "neighborhouse", color: "#7d9fc9" },
      { x: 960, y: 280, w: 200, h: 120, type: "neighborhouse", color: "#d9a865" },
      { x: 960, y: 560, w: 180, h: 190, type: "diner", color: "#e0a63a", label: "DINER" },
      { x: 1160, y: 560, w: 260, h: 190, type: "school", color: "#c96b5a", label: "SCHOOL" },
      { x: 1440, y: 560, w: 170, h: 190, type: "cafe", color: "#8a6fb0", label: "CAFE" },
      { x: 718, y: 189, w: 64, h: 112, type: "car", facing: "down" },
    ],
    decor: [
      { type: "tree", x: 640, y: 110 },
      { type: "tree", x: 960, y: 110 },
      { type: "flowerbed", x: 700, y: 95, w: 60, h: 18 },
      { type: "flowerbed", x: 830, y: 95, w: 60, h: 18 },
      { type: "mailbox", x: 940, y: 230 },
      { type: "streetlamp", x: 680, y: 340 },
      { type: "streetlamp", x: 920, y: 340 },
      { type: "streetlamp", x: 680, y: 600 },
      { type: "streetlamp", x: 920, y: 600 },
      { type: "bush", x: 500, y: 420 },
      { type: "bush", x: 1100, y: 420 },
      { type: "streetlamp", x: 1150, y: 785 },
      { type: "streetlamp", x: 1420, y: 785 },
      { type: "streetlamp", x: 1620, y: 785 },
      { type: "tree", x: 1050, y: 1100 },
      { type: "tree", x: 1300, y: 1150 },
    ],
    doors: [
      {
        trigger: { x: 700, y: 0, w: 200, h: 70 },
        target: "house",
        spawn: { x: 720, y: 495, facing: "up" },
      },
      {
        trigger: { x: 1000, y: 750, w: 100, h: 40 },
        target: "diner",
        interact: true,
        prompt: "Tap A or press E to go into the diner",
        spawn: { x: 480, y: 230, facing: "down" },
      },
      {
        trigger: { x: 1240, y: 750, w: 100, h: 40 },
        target: "school",
        interact: true,
        prompt: "Tap A or press E to go into the school",
        spawn: { x: 480, y: 230, facing: "down" },
      },
      {
        trigger: { x: 1475, y: 750, w: 100, h: 40 },
        target: "cafe",
        interact: true,
        prompt: "Tap A or press E to go into the cafe",
        spawn: { x: 480, y: 230, facing: "down" },
      },
      {
        trigger: { x: 490, y: 400, w: 100, h: 40 },
        target: "blueHouse",
        interact: true,
        prompt: "Tap A or press E to go into the house",
        spawn: { x: 480, y: 230, facing: "down" },
      },
      {
        trigger: { x: 1010, y: 400, w: 100, h: 40 },
        target: "yellowHouse",
        interact: true,
        prompt: "Tap A or press E to go into the house",
        spawn: { x: 480, y: 230, facing: "down" },
      },
    ],
    labelZones: [
      { x: 0, y: 0, w: 1700, h: 760, text: "Elm Avenue" },
    ],
    label: "Main Street",
    npcs: [
      makeNpc({ x: 670, y: 280, w: 20, h: 440 }, 0, 55, { x: 540, y: 415 }),
      makeNpc({ x: 910, y: 280, w: 20, h: 440 }, 1, 65, { x: 1060, y: 415 }),
      makeNpc({ x: 720, y: 770, w: 400, h: 20 }, 2, 60),
      makeNpc({ x: 1150, y: 770, w: 480, h: 20 }, 3, 50),
      makeNpc({ x: 720, y: 1010, w: 900, h: 20 }, 4, 70),
    ],
  };

  var ROOM_WALLS = [
    { x: 0, y: 0, w: 960, h: 40 },
    { x: 0, y: 560, w: 400, h: 40 },
    { x: 560, y: 560, w: 400, h: 40 },
    { x: 0, y: 0, w: 40, h: 600 },
    { x: 920, y: 0, w: 40, h: 600 },
  ];
  var ROOM_EXIT_TRIGGER = { x: 400, y: 540, w: 160, h: 60 };

  scenes.diner = {
    bg: FLOOR_COLOR,
    walls: ROOM_WALLS,
    furniture: [
      { x: 80, y: 80, w: 500, h: 60, type: "block", color: "#8a5a34", accent: "#d8c39a" },
      { x: 700, y: 100, w: 90, h: 70, type: "block", color: "#c0392b" },
      { x: 700, y: 250, w: 90, h: 70, type: "block", color: "#c0392b" },
      { x: 700, y: 400, w: 90, h: 70, type: "block", color: "#c0392b" },
    ],
    decor: [
      { type: "stool", x: 130, y: 160 },
      { type: "stool", x: 190, y: 160 },
      { type: "stool", x: 250, y: 160 },
      { type: "stool", x: 310, y: 160 },
      { type: "stool", x: 370, y: 160 },
    ],
    doors: [
      {
        trigger: ROOM_EXIT_TRIGGER,
        target: "frontyard",
        spawn: { x: 1050, y: 780, facing: "down" },
      },
    ],
    label: "Diner",
  };

  scenes.school = {
    bg: FLOOR_COLOR,
    walls: ROOM_WALLS,
    furniture: [
      { x: 350, y: 60, w: 260, h: 70, type: "block", color: "#2f4f3a" },
      { x: 430, y: 150, w: 100, h: 50, type: "block", color: "#8a5a34" },
      // desks kept clear of the x:400-560 aisle so the entrance and exit
      // door stay reachable in a straight line
      { x: 180, y: 260, w: 70, h: 50, type: "block", color: "#a9784f" },
      { x: 730, y: 260, w: 70, h: 50, type: "block", color: "#a9784f" },
      { x: 180, y: 360, w: 70, h: 50, type: "block", color: "#a9784f" },
      { x: 730, y: 360, w: 70, h: 50, type: "block", color: "#a9784f" },
      { x: 180, y: 460, w: 70, h: 50, type: "block", color: "#a9784f" },
      { x: 730, y: 460, w: 70, h: 50, type: "block", color: "#a9784f" },
    ],
    doors: [
      {
        trigger: ROOM_EXIT_TRIGGER,
        target: "frontyard",
        spawn: { x: 1290, y: 780, facing: "down" },
      },
    ],
    label: "Classroom",
  };

  scenes.cafe = {
    bg: FLOOR_COLOR,
    walls: ROOM_WALLS,
    furniture: [
      { x: 600, y: 80, w: 280, h: 60, type: "block", color: "#6b4a36", accent: "#d8c39a" },
      { x: 150, y: 250, w: 60, h: 60, type: "block", color: "#caa472" },
      { x: 350, y: 250, w: 60, h: 60, type: "block", color: "#caa472" },
      { x: 150, y: 420, w: 60, h: 60, type: "block", color: "#caa472" },
    ],
    decor: [
      { type: "stool", x: 135, y: 295 },
      { type: "stool", x: 225, y: 280 },
      { type: "stool", x: 335, y: 295 },
      { type: "stool", x: 425, y: 280 },
      { type: "stool", x: 135, y: 465 },
      { type: "stool", x: 225, y: 450 },
    ],
    doors: [
      {
        trigger: ROOM_EXIT_TRIGGER,
        target: "frontyard",
        spawn: { x: 1525, y: 780, facing: "down" },
      },
    ],
    label: "Cafe",
  };

  scenes.blueHouse = {
    bg: FLOOR_COLOR,
    walls: ROOM_WALLS,
    furniture: [
      { x: 850, y: 130, w: 40, h: 80, type: "tv" },
      { x: 620, y: 370, w: 180, h: 60, type: "couch" },
      { x: 150, y: 90, w: 70, h: 50, type: "block", color: "#8a5a34" },
    ],
    doors: [
      {
        trigger: ROOM_EXIT_TRIGGER,
        target: "frontyard",
        spawn: { x: 540, y: 440, facing: "down" },
      },
    ],
    label: "A Neighbor's House",
  };

  scenes.yellowHouse = {
    bg: FLOOR_COLOR,
    walls: ROOM_WALLS,
    furniture: [
      { x: 120, y: 90, w: 160, h: 110, type: "bed" },
      { x: 320, y: 110, w: 60, h: 60, type: "block", color: "#8a5a34" },
      { x: 650, y: 350, w: 180, h: 60, type: "couch" },
    ],
    doors: [
      {
        trigger: ROOM_EXIT_TRIGGER,
        target: "frontyard",
        spawn: { x: 1060, y: 440, facing: "down" },
      },
    ],
    label: "A Neighbor's House",
  };

  scenes.backyard = {
    bg: "#7ec850",
    sky: true,
    walls: [
      { x: 0, y: 0, w: 600, h: 40 },
      { x: 680, y: 0, w: 280, h: 40 },
      { x: 0, y: 560, w: 960, h: 40 },
      { x: 0, y: 0, w: 20, h: 600 },
      { x: 940, y: 0, w: 20, h: 600 },
    ],
    furniture: [],
    decor: [
      { type: "tree", x: 850, y: 460 },
      { type: "tree", x: 300, y: 300 },
      { type: "bush", x: 90, y: 460 },
      { type: "bush", x: 150, y: 460 },
    ],
    doors: [
      {
        trigger: { x: 600, y: 0, w: 80, h: 70 },
        target: "house",
        spawn: { x: 640, y: 170, facing: "down" },
      },
    ],
    label: "Backyard",
  };

  var currentSceneKey = "house";
  var driving = false;
  // carPos is the car's CENTER point (while driving); the parked furniture
  // entry keeps the usual top-left + w/h like every other piece of furniture.
  var carPos = { x: 0, y: 0 };
  var carAngleFacing = "down";
  var armDoorAfterExit = false;

  var CAR_LENGTH = 112; // nose-to-tail
  var CAR_WIDTH = 64; // side-to-side, narrow enough to fit one lane

  function carDims(facing) {
    return facing === "left" || facing === "right"
      ? { w: CAR_LENGTH, h: CAR_WIDTH }
      : { w: CAR_WIDTH, h: CAR_LENGTH };
  }

  function getScene() {
    return scenes[currentSceneKey];
  }

  function changeScene(key, spawn) {
    currentSceneKey = key;
    driving = false;
    player.x = spawn.x;
    player.y = spawn.y;
    player.facing = spawn.facing || "down";
    // require the player to step out of the doorway zone before another
    // door can fire, so holding a direction key doesn't bounce them
    // straight back through the door they just walked in.
    armDoorAfterExit = true;
  }

  // ---------- Update ----------
  function carBox(scene) {
    var f = scene.furniture.filter(function (it) {
      return it.type === "car";
    })[0];
    if (!f) return null;
    if (driving) {
      var dims = carDims(carAngleFacing);
      return { x: carPos.x - dims.w / 2, y: carPos.y - dims.h / 2, w: dims.w, h: dims.h };
    }
    return { x: f.x, y: f.y, w: f.w, h: f.h };
  }

  function update(dt) {
    var scene = getScene();
    var mv = getMoveVector();

    if (scene.npcs) {
      scene.npcs.forEach(function (npc) {
        updateNpc(npc, dt);
      });
    }

    if (driving) {
      var speed = 320;
      if (mv.x !== 0 || mv.y !== 0) {
        carAngleFacing = Math.abs(mv.x) > Math.abs(mv.y)
          ? (mv.x > 0 ? "right" : "left")
          : (mv.y > 0 ? "down" : "up");
      }
      var dims = carDims(carAngleFacing);
      var nx = carPos.x + mv.x * speed * dt;
      var ny = carPos.y + mv.y * speed * dt;
      var box = { x: nx - dims.w / 2, y: carPos.y - dims.h / 2, w: dims.w, h: dims.h };
      if (!collidesWalls(box, scene, true)) carPos.x = nx;
      box = { x: carPos.x - dims.w / 2, y: ny - dims.h / 2, w: dims.w, h: dims.h };
      if (!collidesWalls(box, scene, true)) carPos.y = ny;

      if (interactPressed) {
        // exit the car and stand beside it, right where it was left
        var scn = getScene();
        var f = scn.furniture.filter(function (it) {
          return it.type === "car";
        })[0];
        var exitDims = carDims(carAngleFacing);
        f.x = carPos.x - exitDims.w / 2;
        f.y = carPos.y - exitDims.h / 2;
        f.w = exitDims.w;
        f.h = exitDims.h;
        f.facing = carAngleFacing;
        player.x = f.x - player.w;
        player.y = f.y + f.h / 2;
        driving = false;
      }
    } else {
      player.moving = mv.x !== 0 || mv.y !== 0;
      if (player.moving) {
        if (Math.abs(mv.x) > Math.abs(mv.y)) {
          player.facing = mv.x > 0 ? "right" : "left";
        } else {
          player.facing = mv.y > 0 ? "down" : "up";
        }
      }

      var nx2 = player.x + mv.x * player.speed * dt;
      var ny2 = player.y + mv.y * player.speed * dt;

      var testBox = playerBox({ x: nx2, y: player.y, w: player.w, h: player.h });
      if (!collidesWalls(testBox, scene, false)) player.x = nx2;
      testBox = playerBox({ x: player.x, y: ny2, w: player.w, h: player.h });
      if (!collidesWalls(testBox, scene, false)) player.y = ny2;

      var world = getWorldSize(scene);
      player.x = clamp(player.x, 0, world.w);
      player.y = clamp(player.y, 0, world.h);

      // door checks - "auto" doors trigger by walking through them;
      // "interact" doors (building entrances) need a button press, so
      // wandering past one doesn't suck the player inside.
      var pbox = playerBox(player);
      var teleported = false;
      var autoDoors = scene.doors.filter(function (door) {
        return !door.interact;
      });
      var overlappingAuto = autoDoors.some(function (door) {
        return rectsOverlap(pbox, door.trigger);
      });

      if (armDoorAfterExit) {
        if (!overlappingAuto) armDoorAfterExit = false;
      } else if (overlappingAuto) {
        autoDoors.forEach(function (door) {
          if (teleported) return;
          if (rectsOverlap(pbox, door.trigger)) {
            changeScene(door.target, door.spawn);
            teleported = true;
          }
        });
      }

      var shownPrompt = false;

      if (!teleported) {
        var interactDoors = scene.doors.filter(function (door) {
          return door.interact;
        });
        var nearDoor = null;
        interactDoors.forEach(function (door) {
          if (!nearDoor && rectsOverlap(pbox, door.trigger)) nearDoor = door;
        });
        if (nearDoor) {
          showPrompt(nearDoor.prompt);
          shownPrompt = true;
          if (interactPressed) {
            changeScene(nearDoor.target, nearDoor.spawn);
            teleported = true;
            hidePrompt();
          }
        }
      }

      if (!teleported && !shownPrompt) {
        // car interact prompt
        var cb = carBox(scene);
        var nearCar =
          cb &&
          rectsOverlap(
            { x: player.x - 60, y: player.y - 60, w: 120, h: 120 },
            cb
          );
        if (nearCar) {
          showPrompt("Tap A or press E to get in the car");
          shownPrompt = true;
          if (interactPressed) {
            var carF = scene.furniture.filter(function (it) {
              return it.type === "car";
            })[0];
            driving = true;
            carAngleFacing = carF.facing || "down";
            carPos.x = cb.x + cb.w / 2;
            carPos.y = cb.y + cb.h / 2;
            hidePrompt();
          }
        }
      }

      if (!shownPrompt) hidePrompt();
    }

    interactPressed = false;
  }

  function collidesWalls(box, scene, isCar) {
    var i;
    for (i = 0; i < scene.walls.length; i++) {
      if (rectsOverlap(box, scene.walls[i])) return true;
    }
    for (i = 0; i < scene.furniture.length; i++) {
      var f = scene.furniture[i];
      if (f.type === "car" && (driving || isCar)) continue;
      if (rectsOverlap(box, f)) return true;
    }
    return false;
  }

  function showPrompt(text) {
    promptEl.textContent = text;
    promptEl.classList.remove("hidden");
  }
  function hidePrompt() {
    promptEl.classList.add("hidden");
  }

  // ---------- Draw ----------
  function drawSky(width) {
    var grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, "#87c9f2");
    grad.addColorStop(1, "#bfe8ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 160);
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(width - 100, 70, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWall(w) {
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = shade(WALL_COLOR, 0.28);
    ctx.fillRect(w.x, w.y, w.w, Math.min(6, w.h));
    ctx.fillStyle = shade(WALL_COLOR, -0.25);
    ctx.fillRect(w.x, w.y + w.h - Math.min(5, w.h), w.w, Math.min(5, w.h));
  }

  function drawTree(x, y) {
    groundShadow(x + 6, y + 22, 26, 9);
    ctx.fillStyle = "#6b3f20";
    ctx.fillRect(x - 6, y, 12, 30);
    ctx.fillStyle = shade("#6b3f20", 0.3);
    ctx.fillRect(x - 6, y, 4, 30);

    var grad = ctx.createRadialGradient(x - 12, y - 22, 4, x, y - 10, 36);
    grad.addColorStop(0, "#5cc46a");
    grad.addColorStop(0.55, "#3f9142");
    grad.addColorStop(1, "#2a6b30");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y - 10, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBush(x, y) {
    groundShadow(x + 3, y + 14, 22, 7);
    var grad = ctx.createRadialGradient(x - 8, y - 8, 3, x, y, 22);
    grad.addColorStop(0, "#78cf7d");
    grad.addColorStop(0.6, "#4caa4f");
    grad.addColorStop(1, "#33823a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStool(x, y) {
    groundShadow(x, y + 3, 10, 4);
    var grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10);
    grad.addColorStop(0, shade("#8a5a34", 0.3));
    grad.addColorStop(1, "#8a5a34");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlock(f) {
    groundShadow(f.x + f.w / 2, f.y + f.h + 4, f.w / 2, 6);
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = shade(f.color, 0.3);
    ctx.fillRect(f.x, f.y, f.w, Math.min(8, f.h * 0.2));
    ctx.fillStyle = shade(f.color, -0.3);
    ctx.fillRect(f.x, f.y + f.h - Math.min(6, f.h * 0.15), f.w, Math.min(6, f.h * 0.15));
    if (f.accent) {
      ctx.fillStyle = f.accent;
      ctx.fillRect(f.x, f.y + Math.min(8, f.h * 0.2), f.w, Math.min(10, f.h * 0.2));
    }
  }

  function drawFlowerbed(d) {
    ctx.fillStyle = "#5b3b23";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = shade("#5b3b23", 0.3);
    ctx.fillRect(d.x, d.y, d.w, Math.min(4, d.h * 0.3));
    var colors = ["#ff5a7a", "#ffd35a", "#ff8bd1"];
    for (var i = 0; i < d.w; i += 16) {
      var fx = d.x + i + 8,
        fy = d.y + d.h / 2;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(fx + 1, fy + 2, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors[(i / 16) % colors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMailbox(x, y) {
    groundShadow(x + 2, y + 30, 8, 4);
    ctx.fillStyle = "#666";
    ctx.fillRect(x - 3, y, 6, 30);
    ctx.fillStyle = "#3767d6";
    ctx.fillRect(x - 12, y - 18, 24, 20);
    ctx.fillStyle = shade("#3767d6", 0.35);
    ctx.fillRect(x - 12, y - 18, 24, 5);
    ctx.fillStyle = shade("#3767d6", -0.3);
    ctx.fillRect(x - 12, y - 3, 24, 5);
  }

  function drawStreetlamp(x, y) {
    groundShadow(x, y + 60, 10, 5);
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(x - 3, y, 6, 60);
    ctx.fillStyle = shade("#3a3a3a", 0.3);
    ctx.fillRect(x - 3, y, 2, 60);
    var glow = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 16);
    glow.addColorStop(0, "rgba(255,233,138,0.55)");
    glow.addColorStop(1, "rgba(255,233,138,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 6, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe98a";
    ctx.beginPath();
    ctx.arc(x, y - 6, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBuilding(f) {
    var roofColor = f.roofColor || "#6b4a36";
    var depth = Math.min(26, f.w * 0.1);
    var wallTop = f.y + f.h * 0.3;
    var wallH = f.h * 0.7;
    var roofY = f.y - f.h * 0.22;
    var baseLeft = f.x - 10;
    var baseRight = f.x + f.w + 10;
    var baseMid = f.x + f.w / 2;

    groundShadow(f.x + f.w / 2 + depth * 0.4, f.y + f.h + 6, f.w / 2 + depth * 0.5, 10);

    // right side wall, implying the building has depth
    ctx.fillStyle = shade(f.color, -0.32);
    ctx.beginPath();
    ctx.moveTo(f.x + f.w, wallTop);
    ctx.lineTo(f.x + f.w + depth, wallTop - depth * 0.5);
    ctx.lineTo(f.x + f.w + depth, wallTop + wallH - depth * 0.5);
    ctx.lineTo(f.x + f.w, wallTop + wallH);
    ctx.closePath();
    ctx.fill();

    // right roof slope's side face, closing the box
    ctx.fillStyle = shade(roofColor, -0.4);
    ctx.beginPath();
    ctx.moveTo(baseRight, wallTop);
    ctx.lineTo(baseMid, roofY);
    ctx.lineTo(baseMid + depth, roofY - depth * 0.5);
    ctx.lineTo(baseRight + depth, wallTop - depth * 0.5);
    ctx.closePath();
    ctx.fill();

    // front wall, lighter along the top edge to catch the light
    var wallGrad = ctx.createLinearGradient(0, wallTop, 0, wallTop + wallH);
    wallGrad.addColorStop(0, shade(f.color, 0.12));
    wallGrad.addColorStop(0.25, f.color);
    wallGrad.addColorStop(1, shade(f.color, -0.1));
    ctx.fillStyle = wallGrad;
    ctx.fillRect(f.x, wallTop, f.w, wallH);

    // two-tone gabled roof, front face
    ctx.fillStyle = shade(roofColor, 0.16);
    ctx.beginPath();
    ctx.moveTo(baseLeft, wallTop);
    ctx.lineTo(baseMid, roofY);
    ctx.lineTo(baseMid, wallTop);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(roofColor, -0.15);
    ctx.beginPath();
    ctx.moveTo(baseMid, wallTop);
    ctx.lineTo(baseMid, roofY);
    ctx.lineTo(baseRight, wallTop);
    ctx.closePath();
    ctx.fill();

    var winCount = f.w >= 280 ? 4 : f.w >= 220 ? 3 : 2;
    var winW = 26;
    var margin = f.w * 0.14;
    var span = f.w - margin * 2 - winW;
    for (var i = 0; i < winCount; i++) {
      var wx = f.x + margin + (winCount > 1 ? (span * i) / (winCount - 1) : span / 2);
      var wy = f.y + f.h * 0.5;
      ctx.fillStyle = "#8a715c";
      ctx.fillRect(wx - 2, wy - 2, winW + 4, 30);
      var winGrad = ctx.createLinearGradient(wx, wy, wx, wy + 26);
      winGrad.addColorStop(0, "#e8f6ff");
      winGrad.addColorStop(1, "#8fc7ea");
      ctx.fillStyle = winGrad;
      ctx.fillRect(wx, wy, winW, 26);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx + 2, wy + 24);
      ctx.lineTo(wx + winW - 2, wy + 4);
      ctx.stroke();
    }

    var doorW = 32;
    var doorX = f.x + f.w / 2 - doorW / 2;
    var doorY = f.y + f.h - 34;
    var doorGrad = ctx.createLinearGradient(doorX, 0, doorX + doorW, 0);
    doorGrad.addColorStop(0, shade("#3a2a1f", -0.2));
    doorGrad.addColorStop(0.5, "#3a2a1f");
    doorGrad.addColorStop(1, shade("#3a2a1f", 0.15));
    ctx.fillStyle = doorGrad;
    ctx.fillRect(doorX, doorY, doorW, 34);
    ctx.fillStyle = "#d8a34a";
    ctx.beginPath();
    ctx.arc(doorX + doorW - 7, doorY + 19, 2, 0, Math.PI * 2);
    ctx.fill();

    if (f.label) {
      ctx.font = "bold 13px sans-serif";
      var signW = ctx.measureText(f.label).width + 20;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(f.x + f.w / 2 - signW / 2 + 2, f.y + f.h * 0.34 + 2, signW, 20);
      ctx.fillStyle = "#fff";
      ctx.fillRect(f.x + f.w / 2 - signW / 2, f.y + f.h * 0.34, signW, 20);
      ctx.fillStyle = "#222";
      ctx.textAlign = "center";
      ctx.fillText(f.label, f.x + f.w / 2, f.y + f.h * 0.34 + 14);
      ctx.textAlign = "left";
    }
  }

  function drawBed(f) {
    groundShadow(f.x + f.w / 2 + 5, f.y + f.h + 4, f.w / 2, 8);
    ctx.fillStyle = "#8a5a34";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = shade("#8a5a34", -0.35);
    ctx.fillRect(f.x + f.w - 6, f.y, 6, f.h);
    ctx.fillStyle = "#dfe8f5";
    ctx.fillRect(f.x + 8, f.y + 8, f.w - 16, 34);
    ctx.fillStyle = shade("#dfe8f5", -0.15);
    ctx.fillRect(f.x + 8, f.y + 34, f.w - 16, 8);
    var blanketGrad = ctx.createLinearGradient(0, f.y + 50, 0, f.y + f.h);
    blanketGrad.addColorStop(0, shade("#c0392b", 0.15));
    blanketGrad.addColorStop(1, shade("#c0392b", -0.15));
    ctx.fillStyle = blanketGrad;
    ctx.fillRect(f.x + 8, f.y + 50, f.w - 16, f.h - 60);
  }

  function drawTV(f) {
    groundShadow(f.x + f.w / 2, f.y + f.h + 4, f.w / 2 + 6, 6);
    ctx.fillStyle = "#5b3b23";
    ctx.fillRect(f.x - 6, f.y + f.h - 8, f.w + 12, 8);
    ctx.fillStyle = "#111";
    ctx.fillRect(f.x, f.y, f.w, f.h - 10);
    var screenGrad = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
    screenGrad.addColorStop(0, "#5bc4ff");
    screenGrad.addColorStop(1, "#1f6fa8");
    ctx.fillStyle = screenGrad;
    ctx.fillRect(f.x + 5, f.y + 5, f.w - 10, f.h - 20);
  }

  function drawCouch(f) {
    groundShadow(f.x + f.w / 2 + 4, f.y + f.h + 5, f.w / 2, 8);
    ctx.fillStyle = shade("#4a6fa5", -0.3);
    ctx.fillRect(f.x + f.w - 8, f.y + 6, 8, f.h - 6);
    ctx.fillStyle = "#4a6fa5";
    ctx.fillRect(f.x, f.y + 14, f.w, f.h - 14);
    ctx.fillStyle = shade("#4a6fa5", 0.18);
    ctx.fillRect(f.x, f.y, f.w, 16);
  }

  function drawCar(cx, cy, facing) {
    var bodyColor = "#e0433a";
    var L = CAR_LENGTH;
    var W = CAR_WIDTH;
    var angle =
      facing === "down" ? Math.PI
      : facing === "left" ? -Math.PI / 2
      : facing === "right" ? Math.PI / 2
      : 0; // "up" is the drawn-facing default (nose points to -Y)

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // from here on, the nose is always at local y = -L/2

    groundShadow(2, 4, W / 2 + 7, L / 2 + 3);

    // chassis
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-W / 2, -L / 2 + 8, W, L - 8);
    ctx.fillStyle = shade(bodyColor, -0.28);
    ctx.fillRect(-W / 2, L / 2 - 10, W, 10);

    // cabin/roof, glossy left-to-right gradient
    var cabinGrad = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    cabinGrad.addColorStop(0, shade(bodyColor, 0.3));
    cabinGrad.addColorStop(0.5, bodyColor);
    cabinGrad.addColorStop(1, shade(bodyColor, -0.18));
    ctx.fillStyle = cabinGrad;
    ctx.fillRect(-W * 0.4, -L * 0.25, W * 0.8, L * 0.55);

    // windshield near the nose end of the cabin
    var winGrad = ctx.createLinearGradient(0, -L * 0.22, 0, -L * 0.02);
    winGrad.addColorStop(0, "#eaf7ff");
    winGrad.addColorStop(1, "#7fb8e0");
    ctx.fillStyle = winGrad;
    ctx.fillRect(-W * 0.32, -L * 0.22, W * 0.64, L * 0.2);

    // wheels: front pair near the nose, rear pair near the tail
    [
      [-W / 2, -L * 0.28],
      [W / 2, -L * 0.28],
      [-W / 2, L * 0.28],
      [W / 2, L * 0.28],
    ].forEach(function (wheel) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(wheel[0], wheel[1], 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.arc(wheel[0] - 1.5, wheel[1] - 1.5, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#fff6b0";
    ctx.fillRect(-W * 0.35, -L / 2, W * 0.18, 6);
    ctx.fillRect(W * 0.17, -L / 2, W * 0.18, 6);

    ctx.fillStyle = "#7a2119";
    ctx.fillRect(-W * 0.35, L / 2 - 6, W * 0.18, 6);
    ctx.fillRect(W * 0.17, L / 2 - 6, W * 0.18, 6);

    ctx.restore();
  }

  function drawPerson(p, palette) {
    var pal = palette || PLAYER_PALETTE;
    ctx.save();
    ctx.translate(p.x, p.y);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(1, p.h / 2, p.w / 2 + 1, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    var bob = p.moving ? Math.sin(Date.now() / 90 + (p.bobOffset || 0)) * 2 : 0;

    // legs
    ctx.fillStyle = shade(pal.pants, -0.2);
    ctx.fillRect(-p.w / 2 + 4, 6 + bob, 8, 14);
    ctx.fillStyle = pal.pants;
    ctx.fillRect(p.w / 2 - 12, 6 - bob, 8, 14);

    // body, shaded left-to-right for roundness
    var bodyGrad = ctx.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
    bodyGrad.addColorStop(0, shade(pal.shirt, -0.22));
    bodyGrad.addColorStop(0.5, pal.shirt);
    bodyGrad.addColorStop(1, shade(pal.shirt, 0.15));
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-p.w / 2, -10, p.w, 22);

    // head, radial shading for a rounder look
    var headGrad = ctx.createRadialGradient(-4, -25, 2, 0, -22, 13);
    headGrad.addColorStop(0, shade(pal.skin, 0.2));
    headGrad.addColorStop(1, shade(pal.skin, -0.1));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -22, 11, 0, Math.PI * 2);
    ctx.fill();

    // hair
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(0, -27, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shade(pal.hair, 0.25);
    ctx.beginPath();
    ctx.arc(-4, -29, 4, 0, Math.PI * 2);
    ctx.fill();

    // face direction hint (simple eyes) - only when facing down/left/right
    ctx.fillStyle = "#2b2b2b";
    if (p.facing === "down") {
      ctx.fillRect(-5, -23, 3, 3);
      ctx.fillRect(2, -23, 3, 3);
    } else if (p.facing === "left") {
      ctx.fillRect(-6, -23, 3, 3);
    } else if (p.facing === "right") {
      ctx.fillRect(3, -23, 3, 3);
    }

    ctx.restore();
  }

  function drawPlayer(p) {
    drawPerson(p, PLAYER_PALETTE);
  }

  function currentLabel(scene) {
    if (scene.labelZones) {
      var box;
      if (driving) {
        var dims = carDims(carAngleFacing);
        box = { x: carPos.x - dims.w / 2, y: carPos.y - dims.h / 2, w: dims.w, h: dims.h };
      } else {
        box = playerBox(player);
      }
      for (var i = 0; i < scene.labelZones.length; i++) {
        if (rectsOverlap(box, scene.labelZones[i])) {
          return scene.labelZones[i].text;
        }
      }
    }
    return scene.label;
  }

  function drawScene() {
    var scene = getScene();
    var world = getWorldSize(scene);
    updateCamera(scene);

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    if (scene.sky) {
      ctx.fillStyle = scene.bg;
      ctx.fillRect(camera.x, camera.y, VIEW_W, VIEW_H);
      drawSky(world.w);
    } else {
      ctx.fillStyle = scene.bg;
      ctx.fillRect(camera.x, camera.y, VIEW_W, VIEW_H);
      if (scene.floorAccent) {
        ctx.fillStyle = scene.floorAccent.color;
        var fa = scene.floorAccent;
        ctx.fillRect(fa.x, fa.y, fa.w, fa.h);
      }
    }

    if (scene.zones) {
      scene.zones.forEach(function (z) {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x, z.y, z.w, z.h);
      });
    }

    if (scene.roadLines) {
      ctx.strokeStyle = "#e8d95a";
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 20]);
      scene.roadLines.forEach(function (line) {
        ctx.beginPath();
        if (line.orientation === "h") {
          ctx.moveTo(line.from, line.pos);
          ctx.lineTo(line.to, line.pos);
        } else {
          ctx.moveTo(line.pos, line.from);
          ctx.lineTo(line.pos, line.to);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    if (scene.decor) {
      scene.decor.forEach(function (d) {
        if (d.type === "tree") drawTree(d.x, d.y);
        else if (d.type === "bush") drawBush(d.x, d.y);
        else if (d.type === "flowerbed") drawFlowerbed(d);
        else if (d.type === "mailbox") drawMailbox(d.x, d.y);
        else if (d.type === "streetlamp") drawStreetlamp(d.x, d.y);
        else if (d.type === "stool") drawStool(d.x, d.y);
      });
    }

    scene.walls.forEach(drawWall);

    var buildingTypes = ["neighborhouse", "school", "diner", "cafe"];
    scene.furniture.forEach(function (f) {
      if (f.type === "bed") drawBed(f);
      else if (f.type === "tv") drawTV(f);
      else if (f.type === "couch") drawCouch(f);
      else if (f.type === "block") drawBlock(f);
      else if (buildingTypes.indexOf(f.type) !== -1) drawBuilding(f);
      else if (f.type === "car" && !driving) {
        drawCar(f.x + f.w / 2, f.y + f.h / 2, f.facing || "down");
      }
    });

    if (scene.npcs) {
      scene.npcs.forEach(function (npc) {
        if (npc.state !== "inside") drawPerson(npc, npc.palette);
      });
    }

    if (driving) {
      drawCar(carPos.x, carPos.y, carAngleFacing);
    } else {
      drawPlayer(player);
    }

    ctx.restore();

    var vignette = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    var label = currentLabel(scene);
    if (label) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(label, 20, 30);
    }
  }

  // ---------- Loop ----------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    drawScene();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
