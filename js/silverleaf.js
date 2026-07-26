/* =============================================================
   silverleaf.js —— 心流模式「银叶菊随水流」环境画布
   将 银叶菊随水流-demo.html 的 Canvas 引擎收进模块作用域。
   - 只负责水面/漩涡/花枝/鼠标水痕的实时绘制与交互；
   - 不拥有计时（25 分钟倒计时仍由 modes.js 掌控）；
   - 提供 start(canvas) / stop() 完整生命周期，退出时清 rAF、
     interval 与 pointer 监听，避免后台泄漏。
   window.App.silverleaf
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var IMG_SRC = "demo-assets/silverleaf.png";

  var PALETTES = {
    // 全屏沉浸：浅灰水色，与遮罩浅灰底一致
    light: {
      base: "rgba(215,218,211,.96)", top: "#f0eee4", topAlpha: .54,
      bottom: "#bfc6bd", bottomAlpha: .22,
      waveLight: "rgba(248,245,235,.46)", waveDark: "rgba(124,139,131,.16)"
    },
    // 茶盏预览：深茶汤色，衬出银叶菊漂浮
    tea: {
      base: "rgba(18,26,24,.94)", top: "#0d1512", topAlpha: .28,
      bottom: "#050807", bottomAlpha: .24,
      waveLight: "rgba(226,236,228,.4)", waveDark: "rgba(150,178,168,.16)"
    }
  };

  function createEngine(canvas, options) {
    options = options || {};
    var flowerScale = options.flowerScale || 1;   // 小画布（茶盏预览）缩小花枝
    var pal = PALETTES[options.palette] || PALETTES.light;
    var context = canvas.getContext("2d", { alpha: true });
    var image = new Image();
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var flowers = [];
    var trail = [];
    var pointer = { x: -1000, y: -1000, vx: 0, vy: 0, speed: 0, strength: 0, lastTime: 0, inside: false };
    var drag = { flower: null, pointerId: null, offsetX: 0, offsetY: 0 };
    var crop = { x: 0, y: 0, width: 1, height: 1 };
    var width = 0, height = 0, pixelRatio = 1;
    var vortexX = 0, vortexY = 0;
    var lastFrame = 0;
    var nextDetachedGroupId = 1000;
    var ready = false;
    var rafId = null;
    var stopped = false;

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function random(min, max) { return min + Math.random() * (max - min); }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      vortexX = width * .5;
      vortexY = height * .5;
      if (ready) {
        drag.flower = null;
        drag.pointerId = null;
        canvas.style.cursor = "default";
        seedFlowers();
      }
    }

    function findCropBounds() {
      var source = document.createElement("canvas");
      var sc = source.getContext("2d", { willReadFrequently: true });
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      sc.drawImage(image, 0, 0);
      var pixels = sc.getImageData(0, 0, source.width, source.height).data;
      var minX = source.width, minY = source.height, maxX = 0, maxY = 0;
      for (var y = 0; y < source.height; y += 2) {
        for (var x = 0; x < source.width; x += 2) {
          if (pixels[(y * source.width + x) * 4 + 3] > 12) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      crop.x = Math.max(0, minX - 4);
      crop.y = Math.max(0, minY - 4);
      crop.width = Math.min(source.width - crop.x, maxX - minX + 10);
      crop.height = Math.min(source.height - crop.y, maxY - minY + 10);
    }

    function makeFlower(index, groupId, baseX, baseY, offset, baseSpeed, size) {
      var depth = clamp(size / 235, .42, 1.18);
      return {
        x: baseX + offset.x, y: baseY + offset.y,
        vx: baseSpeed + random(-1.8, 1.8), vy: random(-2, 2),
        angle: random(-1.05, .65), angularVelocity: random(-.035, .035),
        targetHeight: size * flowerScale * (reduceMotion ? .82 : 1), depth,
        phase: random(0, Math.PI * 2), flowOffset: random(-22, 22),
        groupId, groupOffsetX: offset.x, groupOffsetY: offset.y, index
      };
    }

    function seedFlowers() {
      flowers.length = 0;
      var groupCount = clamp(Math.round(width / 380), 3, 4);
      var flowerIndex = 0;
      for (var groupId = 0; groupId < groupCount; groupId += 1) {
        var memberCount = Math.random() < .48 ? 2 : 3;
        var baseX = (groupId + .45) * width / groupCount + random(-80, 80);
        var baseY = random(height * .2, height * .78);
        var baseSpeed = random(17, 27);
        var spread = random(.8, 1.25) * flowerScale;
        var offsets = memberCount === 2
          ? [{ x: -54 * spread, y: 20 * spread }, { x: 54 * spread, y: -20 * spread }]
          : [{ x: -76 * spread, y: 24 * spread }, { x: 0, y: -35 * spread }, { x: 76 * spread, y: 18 * spread }];
        var sizes = memberCount === 2
          ? [random(92, 145), random(188, 282)]
          : [random(78, 122), random(145, 205), random(218, 305)];
        if (Math.random() < .5) sizes.reverse();
        offsets.forEach(function (offset, memberIndex) {
          flowers.push(makeFlower(flowerIndex, groupId, baseX, baseY, offset, baseSpeed, sizes[memberIndex]));
          flowerIndex += 1;
        });
      }
    }

    function resetGroup(groupId) {
      var members = flowers.filter(function (f) { return f.groupId === groupId; });
      var baseX = random(-310, -170);
      var baseY = random(height * .2, height * .78);
      var baseSpeed = random(17, 27);
      members.forEach(function (flower) {
        flower.x = baseX + flower.groupOffsetX;
        flower.y = baseY + flower.groupOffsetY;
        flower.vx = baseSpeed + random(-1.5, 1.5);
        flower.vy = random(-2, 2);
        flower.angle = random(-1.05, .65);
        flower.angularVelocity = random(-.035, .035);
      });
    }

    function findFlowerAt(x, y) {
      for (var index = flowers.length - 1; index >= 0; index -= 1) {
        var flower = flowers[index];
        var drawHeight = flower.targetHeight;
        var drawWidth = drawHeight * crop.width / crop.height;
        var dx = x - flower.x, dy = y - flower.y;
        var cosine = Math.cos(-flower.angle), sine = Math.sin(-flower.angle);
        var localX = dx * cosine - dy * sine;
        var localY = dx * sine + dy * cosine;
        var hitX = localX / Math.max(drawWidth * .46, 28);
        var hitY = localY / Math.max(drawHeight * .46, 28);
        if (hitX * hitX + hitY * hitY <= 1) return flower;
      }
      return null;
    }

    function flowAt(x, y, now) {
      var time = now * .00035;
      var xVelocity = 18 + Math.sin(y * .012 + time * 2.2) * 4.2;
      var yVelocity = Math.sin(x * .005 + y * .009 + time * 3) * 4.6;
      var vortexDX = vortexX - x, vortexDY = vortexY - y;
      var vortexDistance = Math.hypot(vortexDX, vortexDY) || 1;
      var vortexRadius = clamp(Math.min(width, height) * .52, 270, 390);
      var vortexInfluence = clamp(1 - vortexDistance / vortexRadius, 0, 1);
      if (vortexInfluence > 0) {
        var radialX = vortexDX / vortexDistance, radialY = vortexDY / vortexDistance;
        var tangentX = -radialY, tangentY = radialX;
        var orbitRadius = clamp(Math.min(width, height) * .24, 140, 184);
        var downstreamRelease = x <= vortexX ? 1 : clamp(1 - (x - vortexX) / (vortexRadius * .62), .08, 1);
        var attraction = clamp((vortexDistance - orbitRadius) / orbitRadius, 0, 1) * vortexInfluence * 13 * downstreamRelease;
        var corePush = clamp(1 - vortexDistance / orbitRadius, 0, 1) * vortexInfluence * 30;
        var rotation = vortexInfluence * 11 * downstreamRelease;
        xVelocity += radialX * (attraction - corePush) + tangentX * rotation;
        yVelocity += radialY * (attraction - corePush) + tangentY * rotation;
      }
      if (pointer.inside && pointer.strength > .01) {
        var dx = x - pointer.x, dy = y - pointer.y;
        var distanceSquared = dx * dx + dy * dy;
        var radius = 205;
        var influence = Math.exp(-distanceSquared / (radius * radius)) * pointer.strength;
        var distance = Math.sqrt(distanceSquared) || 1;
        var ptx = -dy / distance, pty = dx / distance;
        xVelocity += pointer.vx * influence * .46 + ptx * influence * 88;
        yVelocity += pointer.vy * influence * .46 + pty * influence * 88;
      }
      return { x: xVelocity, y: yVelocity };
    }

    function disturbFlowers() {
      flowers.forEach(function (flower) {
        if (flower === drag.flower) return;
        var dx = flower.x - pointer.x, dy = flower.y - pointer.y;
        var distance = Math.hypot(dx, dy);
        if (distance > 230) return;
        var influence = (1 - distance / 230) * clamp(pointer.speed / 520, .12, 1) * (reduceMotion ? .28 : 1);
        flower.vx += pointer.vx * influence * .022;
        flower.vy += pointer.vy * influence * .028;
        flower.angularVelocity += ((pointer.vx * dy - pointer.vy * dx) / Math.max(distance * distance, 900)) * influence * .028;
      });
    }

    function addTrailPoint(now) {
      trail.push({ x: pointer.x, y: pointer.y, vx: pointer.vx, vy: pointer.vy, life: 1, born: now });
      if (trail.length > 72) trail.shift();
    }

    function handlePointerMove(event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      var rect = canvas.getBoundingClientRect();
      var now = performance.now();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      var elapsed = Math.max(16, now - (pointer.lastTime || now - 16));
      var rawVX = (x - pointer.x) / elapsed * 1000;
      var rawVY = (y - pointer.y) / elapsed * 1000;
      if (!pointer.inside) { pointer.vx = 0; pointer.vy = 0; }
      else { pointer.vx = clamp(rawVX, -900, 900); pointer.vy = clamp(rawVY, -900, 900); }
      pointer.x = x; pointer.y = y;
      pointer.speed = Math.hypot(pointer.vx, pointer.vy);
      pointer.strength = clamp(pointer.speed / 520, .08, 1);
      pointer.lastTime = now;
      pointer.inside = true;
      if (drag.flower) {
        drag.flower.x = x + drag.offsetX;
        drag.flower.y = y + drag.offsetY;
        drag.flower.vx = 0; drag.flower.vy = 0;
        canvas.style.cursor = "grabbing";
      } else {
        canvas.style.cursor = ready && findFlowerAt(x, y) ? "grab" : "default";
      }
      disturbFlowers();
      addTrailPoint(now);
    }

    function handlePointerDown(event) {
      if (!ready || event.button !== 0 || (event.pointerType && event.pointerType !== "mouse")) return;
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left, y = event.clientY - rect.top;
      var flower = findFlowerAt(x, y);
      if (!flower) return;
      pointer.x = x; pointer.y = y;
      pointer.inside = true;
      pointer.lastTime = performance.now();
      drag.flower = flower;
      drag.pointerId = event.pointerId;
      drag.offsetX = flower.x - x;
      drag.offsetY = flower.y - y;
      flower.groupId = nextDetachedGroupId;
      nextDetachedGroupId += 1;
      flower.groupOffsetX = 0; flower.groupOffsetY = 0;
      flower.vx = 0; flower.vy = 0;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function handlePointerUp(event) {
      if (!drag.flower || event.pointerId !== drag.pointerId) return;
      drag.flower.vx = clamp(18 + pointer.vx * .12, -45, 85);
      drag.flower.vy = clamp(pointer.vy * .12, -55, 55);
      drag.flower.angularVelocity = clamp(pointer.vx * .0012, -.5, .5);
      drag.flower = null;
      drag.pointerId = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = findFlowerAt(pointer.x, pointer.y) ? "grab" : "default";
    }

    function handlePointerLeave() {
      if (!drag.flower) { pointer.inside = false; canvas.style.cursor = "default"; }
    }

    function updateFlowers(delta, now) {
      var seconds = Math.min(delta, 40) / 1000;
      var groups = new Map();
      flowers.forEach(function (flower) {
        var group = groups.get(flower.groupId) || { x: 0, y: 0, count: 0 };
        group.x += flower.x; group.y += flower.y; group.count += 1;
        groups.set(flower.groupId, group);
      });
      groups.forEach(function (group) { group.x /= group.count; group.y /= group.count; });
      flowers.forEach(function (flower) {
        if (flower === drag.flower) return;
        var field = flowAt(flower.x, flower.y, now);
        var group = groups.get(flower.groupId);
        var desiredX = group.x + flower.groupOffsetX;
        var desiredY = group.y + flower.groupOffsetY;
        var response = .75 * seconds;
        flower.vx += (field.x * flower.depth - flower.vx) * response;
        flower.vy += (field.y + Math.sin(now * .0014 + flower.phase) * 1.8 - flower.vy) * response;
        flower.vx += (desiredX - flower.x) * .16 * seconds;
        flower.vy += (desiredY - flower.y) * .2 * seconds;
        flower.angularVelocity += (-flower.angularVelocity * .9 + Math.sin(now * .0012 + flower.phase) * .018) * seconds;
        flower.angularVelocity = clamp(flower.angularVelocity, -.8, .8);
        flower.x += flower.vx * seconds;
        flower.y += flower.vy * seconds;
        flower.angle += flower.angularVelocity * seconds;
        if (flower.y < -140) flower.y = height + 120;
        if (flower.y > height + 140) flower.y = -120;
      });
      groups.forEach(function (group, groupId) { if (group.x > width + 340) resetGroup(groupId); });
      flowers.sort(function (a, b) { return a.depth - b.depth; });
    }

    function updateWater(delta) {
      var seconds = Math.min(delta, 40) / 1000;
      pointer.strength *= Math.pow(.11, seconds);
      pointer.vx *= Math.pow(.08, seconds);
      pointer.vy *= Math.pow(.08, seconds);
      trail.forEach(function (point) {
        point.x += 12 * seconds;
        point.y += Math.sin(point.x * .012 + point.born * .001) * 1.5 * seconds;
        point.life -= seconds * .78;
      });
      for (var index = trail.length - 1; index >= 0; index -= 1) {
        if (trail[index].life <= 0) trail.splice(index, 1);
      }
    }

    function drawWater(now) {
      context.clearRect(0, 0, width, height);
      // 水面底色：茶盏预览走深茶汤色，全屏沉浸走浅灰水色
      context.fillStyle = pal.base;
      context.fillRect(0, 0, width, height);

      context.fillStyle = pal.top;
      context.globalAlpha = pal.topAlpha;
      context.beginPath();
      context.moveTo(0, height * .08);
      context.bezierCurveTo(width * .25, height * .18, width * .46, height * .02, width * .72, height * .1);
      context.bezierCurveTo(width * .87, height * .14, width * .94, height * .2, width, height * .16);
      context.lineTo(width, 0); context.lineTo(0, 0); context.closePath(); context.fill();

      context.fillStyle = pal.bottom;
      context.globalAlpha = pal.bottomAlpha;
      context.beginPath();
      context.moveTo(0, height * .69);
      context.bezierCurveTo(width * .24, height * .6, width * .42, height * .77, width * .7, height * .68);
      context.bezierCurveTo(width * .82, height * .64, width * .92, height * .59, width, height * .66);
      context.lineTo(width, height); context.lineTo(0, height); context.closePath(); context.fill();

      context.globalAlpha = 1;
      // 更密集的水波纹：18 条横向流线，明暗交替显出水的层次
      var lineCount = 18;
      for (var line = 0; line < lineCount; line += 1) {
        var y = height * (.06 + line * .052);
        context.beginPath();
        for (var x = -30; x <= width + 30; x += 20) {
          var wave = Math.sin(x * .006 + line * 1.2 + now * .00025) * (6 + (line % 5) * 1.1)
            + Math.sin(x * .017 - line * .8 + now * .0004) * 2.6;
          var disturbedY = y + wave;
          if (pointer.inside) {
            var dx = x - pointer.x, dy = disturbedY - pointer.y;
            var distance = Math.hypot(dx, dy);
            if (distance < 275) {
              disturbedY += Math.sin(distance * .048 - now * .008) * (1 - distance / 275) * pointer.strength * 32;
            }
          }
          if (x === -30) context.moveTo(x, disturbedY);
          else context.lineTo(x, disturbedY);
        }
        context.strokeStyle = line % 2 ? pal.waveLight : pal.waveDark;
        context.lineWidth = line % 2 ? 1.4 : 1;
        context.stroke();
      }
    }

    function drawTrailPath(offset, lineWidth, opacity) {
      if (trail.length < 2) return;
      var speed = Math.hypot(pointer.vx, pointer.vy) || 1;
      var normalX = -pointer.vy / speed * offset;
      var normalY = pointer.vx / speed * offset;
      context.beginPath();
      context.moveTo(trail[0].x + normalX, trail[0].y + normalY);
      for (var index = 1; index < trail.length - 1; index += 1) {
        var current = trail[index], next = trail[index + 1];
        var midX = (current.x + next.x) * .5 + normalX;
        var midY = (current.y + next.y) * .5 + normalY;
        context.quadraticCurveTo(current.x + normalX, current.y + normalY, midX, midY);
      }
      var last = trail[trail.length - 1];
      context.lineTo(last.x + normalX, last.y + normalY);
      var life = trail.reduce(function (sum, point) { return sum + point.life; }, 0) / trail.length;
      context.strokeStyle = "rgba(250,248,239," + clamp(life * opacity, 0, opacity) + ")";
      context.lineWidth = lineWidth;
      context.lineCap = "round"; context.lineJoin = "round";
      context.stroke();
    }

    function drawPointerTrail() {
      drawTrailPath(0, 32, .24);
      drawTrailPath(0, 8.5, .66);
      drawTrailPath(-17, 3, .38);
    }

    function drawVortex(now) {
      context.save();
      context.translate(vortexX, vortexY);
      context.rotate(now * .00006);
      for (var arm = 0; arm < 5; arm += 1) {
        context.beginPath();
        for (var step = 0; step <= 42; step += 1) {
          var progress = step / 42;
          var radius = 82 + progress * 178;
          var angle = arm * Math.PI * .4 + progress * Math.PI * 1.36;
          var x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = "rgba(248,245,235," + (.18 + arm * .025) + ")";
        context.lineWidth = arm % 2 ? 2.2 : 3.5;
        context.lineCap = "round";
        context.stroke();
      }
      context.rotate(-now * .00011);
      context.strokeStyle = "rgba(130,143,134,.19)";
      context.lineWidth = 1.4;
      context.beginPath(); context.arc(0, 0, 202, -.6, 2.5); context.stroke();
      context.beginPath(); context.arc(0, 0, 236, 2.25, 5.35); context.stroke();
      context.restore();
    }

    function drawFlowers(now) {
      flowers.forEach(function (flower) {
        var drawHeight = flower.targetHeight;
        var drawWidth = drawHeight * crop.width / crop.height;
        context.save();
        context.translate(flower.x, flower.y);
        context.rotate(flower.angle + Math.sin(now * .0011 + flower.phase) * .025);
        context.globalAlpha = .56 + flower.depth * .36;
        context.drawImage(image, crop.x, crop.y, crop.width, crop.height,
          -drawWidth * .5, -drawHeight * .5, drawWidth, drawHeight);
        context.restore();
      });
      context.globalAlpha = 1;
    }

    function frame(now) {
      if (stopped) return;
      var delta = now - lastFrame;
      lastFrame = now;
      if (ready) {
        updateFlowers(delta, now);
        updateWater(delta);
        drawWater(now);
        drawVortex(now);
        drawPointerTrail();
        drawFlowers(now);
      }
      rafId = requestAnimationFrame(frame);
    }

    image.onload = function () {
      if (stopped) return;
      findCropBounds();
      ready = true;
      seedFlowers();
    };
    image.onerror = function () { /* 素材缺失时静默：仍保留水面底色 */ };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", resize);

    lastFrame = performance.now();
    resize();
    image.src = IMG_SRC;
    rafId = requestAnimationFrame(frame);

    return {
      stop: function () {
        stopped = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointerleave", handlePointerLeave);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        window.removeEventListener("resize", resize);
      }
    };
  }

  var active = null;

  // 小于该宽度视为茶盏预览，自动缩小花枝，避免大花瓣溢出盏面
  function start(canvas, options) {
    stop();
    if (!canvas) return;
    options = options || {};
    var rect = canvas.getBoundingClientRect();
    var isPreview = rect.width && rect.width < 420;   // 茶盏预览
    if (options.flowerScale == null) options.flowerScale = isPreview ? .42 : 1;
    if (options.palette == null) options.palette = isPreview ? "tea" : "light";
    active = createEngine(canvas, options);
  }

  function stop() {
    if (active) { active.stop(); active = null; }
  }

  App.silverleaf = { start: start, stop: stop };
})();
