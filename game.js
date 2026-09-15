(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var promptEl = document.getElementById("prompt");
  var stage = document.getElementById("stage");

  var WORLD_W = 960;
  var WORLD_H = 600;

  function fitCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD_W * dpr;
    canvas.height = WORLD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var stageRect = stage.getBoundingClientRect();
    var scale = Math.min(stageRect.width / WORLD_W, stageRect.height / WORLD_H);
    canvas.style.width = Math.floor(WORLD_W * scale) + "px";
    canvas.style.height = Math.floor(WORLD_H * scale) + "px";
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

  function playerBox(p) {
    return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  }

  // ---------- Scenes ----------
  var WALL_COLOR = "#caa472";
  var FLOOR_COLOR = "#e8d3ab";
  var BEDROOM_FLOOR = "#f0dfc0";

  var scenes = {};

  scenes.house = {
    bg: FLOOR_COLOR,
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
      spawn: { x: 720, y: 170, facing: "down" },
    },
  ];

  scenes.frontyard = {
    bg: "#7ec850",
    sky: true,
    walls: [
      { x: 0, y: 0, w: 680, h: 40 },
      { x: 760, y: 0, w: 200, h: 40 },
      { x: 0, y: 560, w: 960, h: 40 },
      { x: 0, y: 0, w: 20, h: 600 },
      { x: 940, y: 0, w: 20, h: 600 },
    ],
    furniture: [],
    decor: [
      { type: "tree", x: 90, y: 90 },
      { type: "tree", x: 870, y: 90 },
      { type: "flowerbed", x: 150, y: 480, w: 120, h: 30 },
      { type: "flowerbed", x: 690, y: 480, w: 120, h: 30 },
      { type: "mailbox", x: 480, y: 500 },
    ],
    doors: [
      {
        trigger: { x: 680, y: 0, w: 80, h: 70 },
        target: "house",
        spawn: { x: 720, y: 460, facing: "up" },
      },
    ],
    label: "Front Yard",
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
    furniture: [{ x: 300, y: 250, w: 200, h: 130, type: "car" }],
    decor: [
      { type: "tree", x: 850, y: 460 },
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
    car: { x: 300, y: 250, w: 200, h: 130, parkX: 300, parkY: 250 },
  };

  var currentSceneKey = "house";
  var driving = false;
  var carPos = { x: 0, y: 0 };
  var carAngleFacing = "down";
  var armDoorAfterExit = false;

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
    var cx = driving ? carPos.x : f.x;
    var cy = driving ? carPos.y : f.y;
    return { x: cx, y: cy, w: f.w, h: f.h };
  }

  function update(dt) {
    var scene = getScene();
    var mv = getMoveVector();

    if (driving) {
      var speed = 320;
      var nx = carPos.x + mv.x * speed * dt;
      var ny = carPos.y + mv.y * speed * dt;
      var box = { x: nx, y: carPos.y, w: 200, h: 130 };
      if (!collidesWalls(box, scene, true)) carPos.x = nx;
      box = { x: carPos.x, y: ny, w: 200, h: 130 };
      if (!collidesWalls(box, scene, true)) carPos.y = ny;

      if (mv.x !== 0 || mv.y !== 0) {
        carAngleFacing = Math.abs(mv.x) > Math.abs(mv.y)
          ? (mv.x > 0 ? "right" : "left")
          : (mv.y > 0 ? "down" : "up");
      }

      if (interactPressed) {
        // exit car, stand beside it, snap car back to parking spot
        var scn = getScene();
        var f = scn.furniture.filter(function (it) {
          return it.type === "car";
        })[0];
        f.x = scn.car.parkX;
        f.y = scn.car.parkY;
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

      player.x = clamp(player.x, 0, WORLD_W);
      player.y = clamp(player.y, 0, WORLD_H);

      // door checks
      var pbox = playerBox(player);
      var teleported = false;
      var overlappingDoor = scene.doors.some(function (door) {
        return rectsOverlap(pbox, door.trigger);
      });

      if (armDoorAfterExit) {
        if (!overlappingDoor) armDoorAfterExit = false;
      } else if (overlappingDoor) {
        scene.doors.forEach(function (door) {
          if (teleported) return;
          if (rectsOverlap(pbox, door.trigger)) {
            changeScene(door.target, door.spawn);
            teleported = true;
          }
        });
      }

      if (!teleported) {
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
          if (interactPressed) {
            driving = true;
            carPos.x = cb.x;
            carPos.y = cb.y;
            hidePrompt();
          }
        } else {
          hidePrompt();
        }
      }
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
  function drawSky() {
    var grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, "#87c9f2");
    grad.addColorStop(1, "#bfe8ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, 160);
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(860, 70, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWall(w) {
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }

  function drawTree(x, y) {
    ctx.fillStyle = "#7a4a26";
    ctx.fillRect(x - 6, y, 12, 30);
    ctx.fillStyle = "#3f9142";
    ctx.beginPath();
    ctx.arc(x, y - 10, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBush(x, y) {
    ctx.fillStyle = "#4caa4f";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFlowerbed(d) {
    ctx.fillStyle = "#5b3b23";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    var colors = ["#ff5a7a", "#ffd35a", "#ff8bd1"];
    for (var i = 0; i < d.w; i += 16) {
      ctx.fillStyle = colors[(i / 16) % colors.length];
      ctx.beginPath();
      ctx.arc(d.x + i + 8, d.y + d.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMailbox(x, y) {
    ctx.fillStyle = "#666";
    ctx.fillRect(x - 3, y, 6, 30);
    ctx.fillStyle = "#3767d6";
    ctx.fillRect(x - 12, y - 18, 24, 20);
  }

  function drawBed(f) {
    ctx.fillStyle = "#8a5a34";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = "#dfe8f5";
    ctx.fillRect(f.x + 8, f.y + 8, f.w - 16, 34);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(f.x + 8, f.y + 50, f.w - 16, f.h - 60);
  }

  function drawTV(f) {
    ctx.fillStyle = "#5b3b23";
    ctx.fillRect(f.x - 6, f.y + f.h - 8, f.w + 12, 8);
    ctx.fillStyle = "#111";
    ctx.fillRect(f.x, f.y, f.w, f.h - 10);
    ctx.fillStyle = "#3aa7ff";
    ctx.fillRect(f.x + 5, f.y + 5, f.w - 10, f.h - 20);
  }

  function drawCouch(f) {
    ctx.fillStyle = "#4a6fa5";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = "#3a5a8a";
    ctx.fillRect(f.x, f.y, f.w, 14);
  }

  function drawCar(x, y, w, h, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#e0433a";
    ctx.fillRect(0, h * 0.2, w, h * 0.6);
    ctx.fillRect(w * 0.2, 0, w * 0.6, h);
    ctx.fillStyle = "#bfe3ff";
    ctx.fillRect(w * 0.28, h * 0.15, w * 0.44, h * 0.28);
    ctx.fillStyle = "#222";
    [
      [w * 0.18, 0],
      [w * 0.82, 0],
      [w * 0.18, h],
      [w * 0.82, h],
    ].forEach(function (wheel) {
      ctx.beginPath();
      ctx.arc(wheel[0], wheel[1], 14, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#fff6b0";
    if (facing === "up") {
      ctx.fillRect(w * 0.15, 0, 10, 6);
      ctx.fillRect(w * 0.75, 0, 10, 6);
    } else if (facing === "down") {
      ctx.fillRect(w * 0.15, h - 6, 10, 6);
      ctx.fillRect(w * 0.75, h - 6, 10, 6);
    }
    ctx.restore();
  }

  function drawPlayer(p) {
    var x = p.x,
      y = p.y;
    ctx.save();
    ctx.translate(x, y);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, p.h / 2 - 2, p.w / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    var bob = p.moving ? Math.sin(Date.now() / 90) * 2 : 0;

    // legs
    ctx.fillStyle = "#2f3e6b";
    ctx.fillRect(-p.w / 2 + 4, 6 + bob, 8, 14);
    ctx.fillRect(p.w / 2 - 12, 6 - bob, 8, 14);

    // body
    ctx.fillStyle = "#3aa76d";
    ctx.fillRect(-p.w / 2, -10, p.w, 22);

    // head
    ctx.fillStyle = "#f2c29c";
    ctx.beginPath();
    ctx.arc(0, -22, 11, 0, Math.PI * 2);
    ctx.fill();

    // hair
    ctx.fillStyle = "#4a3524";
    ctx.beginPath();
    ctx.arc(0, -27, 11, Math.PI, 0);
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

  function drawScene() {
    var scene = getScene();
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    if (scene.sky) {
      ctx.fillStyle = scene.bg;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      drawSky();
    } else {
      ctx.fillStyle = scene.bg;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      // subtle floor divide for bedroom area
      ctx.fillStyle = BEDROOM_FLOOR;
      ctx.fillRect(40, 40, 420, 520);
    }

    if (scene.decor) {
      scene.decor.forEach(function (d) {
        if (d.type === "tree") drawTree(d.x, d.y);
        else if (d.type === "bush") drawBush(d.x, d.y);
        else if (d.type === "flowerbed") drawFlowerbed(d);
        else if (d.type === "mailbox") drawMailbox(d.x, d.y);
      });
    }

    scene.walls.forEach(drawWall);

    scene.furniture.forEach(function (f) {
      if (f.type === "bed") drawBed(f);
      else if (f.type === "tv") drawTV(f);
      else if (f.type === "couch") drawCouch(f);
      else if (f.type === "car" && !driving) {
        drawCar(f.x, f.y, f.w, f.h, "down");
      }
    });

    if (scene.label) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(scene.label, 20, 30);
    }

    if (driving) {
      drawCar(carPos.x, carPos.y, 200, 130, carAngleFacing);
    } else {
      drawPlayer(player);
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
