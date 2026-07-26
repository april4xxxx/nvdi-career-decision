/* =============================================================
   coinfly.js —— 盖印结算金币飞入动画(方案 B)
   window.App.coinfly

   用法:在“盖印/办结”那一刻,先取被点中卡片的真实坐标(rect),
   再执行结算,然后 play(rect, amount) 播放:
     金光铜币沿弧线飞向顶栏金币框 → 落框迸发金光 + 框体轻弹 → 数字滚动到新值。

   任务卡位置不固定(数量/滚动位置在变),故起点必须由调用方在点击当刻
   用 getBoundingClientRect() 现取,不能写死。
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;

  var COIN_COUNT_MIN = 5, COIN_COUNT_MAX = 8;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function goldBox() { return document.getElementById("goldRes"); }
  function goldValEl() { return document.getElementById("goldVal"); }

  function centerOf(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* 供调用方在点击当刻抓起点:接受元素或已算好的 rect/point */
  function pointFrom(elOrRect) {
    if (!elOrRect) return null;
    if (typeof elOrRect.getBoundingClientRect === "function") return centerOf(elOrRect);
    if (elOrRect.x != null && elOrRect.y != null) return { x: elOrRect.x, y: elOrRect.y };
    if (elOrRect.left != null) return { x: elOrRect.left + (elOrRect.width || 0) / 2, y: elOrRect.top + (elOrRect.height || 0) / 2 };
    return null;
  }

  /*
   * play(from, amount, opts)
   *   from   : 起点(卡片元素 / rect / {x,y}),点击当刻现取
   *   amount : 本次入账金币(>0 才播),用于数字滚动的增量
   *   opts.startVal / opts.endVal : 手动指定滚动区间(默认读顶栏当前值→当前值+amount)
   */
  function play(from, amount, opts) {
    opts = opts || {};
    amount = Math.max(0, Number(amount) || 0);
    var valEl = goldValEl();
    var box = goldBox();

    var to = centerOf(box);
    var start = pointFrom(from);

    // 无金币入账,或拿不到坐标/框:直接落定数值,不做动画
    if (!amount || !start || !to || !valEl || reduce) {
      if (valEl && opts.endVal != null) valEl.textContent = String(opts.endVal);
      return;
    }

    var endVal = opts.endVal != null ? Number(opts.endVal) : (parseInt(valEl.textContent, 10) || 0);
    var startVal = opts.startVal != null ? Number(opts.startVal) : Math.max(0, endVal - amount);

    // 顶栏可能已被重绘为新值:先把显示值拨回旧值,等落框再滚上去
    valEl.textContent = String(startVal);

    var n = Math.min(COIN_COUNT_MAX, Math.max(COIN_COUNT_MIN, Math.round(amount / 4)));
    var arrived = 0;
    var rolled = false;

    function onArrive() {
      arrived++;
      bump(box);
      burstSparks(to.x, to.y);
      // 第一枚落框即开始滚动数字,视觉与飞行并进
      if (!rolled) { rolled = true; rollNumber(valEl, startVal, endVal, 620); }
      if (arrived === n && valEl) valEl.textContent = String(endVal);
    }

    for (var i = 0; i < n; i++) flyOne(start, to, i, onArrive);
  }

  function flyOne(start, to, idx, onArrive) {
    var coin = document.createElement("div");
    coin.className = "fly-coin";
    document.body.appendChild(coin);

    // 起点小幅散开
    var jx = (Math.random() - 0.5) * 46;
    var jy = (Math.random() - 0.5) * 30;
    var sx = start.x + jx, sy = start.y + jy;

    // 二次贝塞尔控制点:先小幅上抛再归框(直线为主,轻微弧度)
    var cx = sx + (to.x - sx) * 0.5;
    var cy = Math.min(sy, to.y) - (40 + Math.random() * 36);

    var delay = idx * 55;
    var dur = 560 + Math.random() * 160;
    var startTs = null;

    coin.style.transform = "translate(" + sx + "px," + sy + "px)";
    coin.style.opacity = "0";

    function frame(ts) {
      if (startTs === null) startTs = ts;
      var el = ts - startTs;
      if (el < delay) { requestAnimationFrame(frame); return; }
      var t = Math.min(1, (el - delay) / dur);
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

      var mt = 1 - e;
      var x = mt * mt * sx + 2 * mt * e * cx + e * e * to.x;
      var y = mt * mt * sy + 2 * mt * e * cy + e * e * to.y;
      var scale = 1 - 0.35 * e;
      var rot = e * 260;

      coin.style.opacity = el < delay + 80 ? String((el - delay) / 80) : (t > 0.85 ? String((1 - t) / 0.15) : "1");
      coin.style.transform = "translate(" + (x - 13) + "px," + (y - 13) + "px) rotate(" + rot + "deg) scale(" + scale + ")";

      if (t > 0.05 && t < 0.95 && Math.random() < 0.5) spawnTrail(x, y);

      if (t < 1) { requestAnimationFrame(frame); }
      else { coin.remove(); onArrive(); }
    }
    requestAnimationFrame(frame);
  }

  function spawnTrail(x, y) {
    var tr = document.createElement("div");
    tr.className = "fly-trail";
    tr.style.transform = "translate(" + (x - 10) + "px," + (y - 10) + "px)";
    document.body.appendChild(tr);
    var s = null, dur = 280;
    (function f(ts) {
      if (s === null) s = ts;
      var t = Math.min(1, (ts - s) / dur);
      tr.style.opacity = String(1 - t);
      tr.style.transform = "translate(" + (x - 10) + "px," + (y - 10) + "px) scale(" + (1 - 0.6 * t) + ")";
      if (t < 1) requestAnimationFrame(f); else tr.remove();
    })(0);
  }

  function burstSparks(x, y) {
    for (var i = 0; i < 7; i++) {
      (function () {
        var sp = document.createElement("div");
        sp.className = "fly-spark";
        document.body.appendChild(sp);
        var ang = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 22;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        var s = null, dur = 360 + Math.random() * 160;
        (function f(ts) {
          if (s === null) s = ts;
          var t = Math.min(1, (ts - s) / dur);
          var e = 1 - Math.pow(1 - t, 2);
          sp.style.opacity = String(1 - t);
          sp.style.transform = "translate(" + (x - 4 + dx * e) + "px," + (y - 4 + dy * e) + "px) scale(" + (1 - 0.5 * t) + ")";
          if (t < 1) requestAnimationFrame(f); else sp.remove();
        })(0);
      })();
    }
  }

  function bump(box) {
    if (!box) return;
    box.classList.add("cf-bump", "cf-glow");
    clearTimeout(box._cfT1); clearTimeout(box._cfT2);
    box._cfT1 = setTimeout(function () { box.classList.remove("cf-bump"); }, 200);
    box._cfT2 = setTimeout(function () { box.classList.remove("cf-glow"); }, 420);
  }

  function rollNumber(el, from, to, dur) {
    if (!el) return;
    var start = null;
    (function f(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * e));
      if (t < 1) requestAnimationFrame(f);
    })(0);
  }

  App.coinfly = { play: play, pointFrom: pointFrom };
})();
