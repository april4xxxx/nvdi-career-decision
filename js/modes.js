/* =============================================================
   modes.js —— 模式切换：常规 / 心流(专注计时) / 预言(决策推演)
   window.App.modes
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var flowVeil, prophVeil;
  var timer = null, remain = 0, total = 25 * 60, demoSpeed = false, flowStartedInDemo = false;
  var VALID_MODES = ["normal", "flow", "prophecy"];

  /* ---------- 模式入口 ---------- */
  function switchTo(m) {
    if (VALID_MODES.indexOf(m) < 0) m = "normal";
    var current = store.get().mode;
    var targetIsVisible =
      (m === "flow" && flowVeil && flowVeil.classList.contains("active")) ||
      (m === "prophecy" && prophVeil && prophVeil.classList.contains("active"));

    // 顶部 Tab 是模式选择器：重复点击当前已显示的模式不刷新、不重置。
    if (current === m && ((m === "normal" && !isOverlayActive()) || targetIsVisible)) return false;

    exitOverlays();
    if (current !== m) store.setMode(m);
    if (m === "flow") openFlow();
    else if (m === "prophecy") openProphecy();
    return true;
  }

  // 只负责清理模式 UI；供模式之间切换时复用，不单独修改 store.mode。
  function exitOverlays() {
    stopTimer();
    if (flowVeil) flowVeil.classList.remove("active");
    if (prophVeil) prophVeil.classList.remove("active");
    if (App.prophecy && prophVeil) App.prophecy.close(prophVeil);
  }

  // 地图导航、独立面板等离开模式的入口必须同时归位视觉层和顶部状态。
  function exitToNormal() {
    exitOverlays();
    if (store.get().mode !== "normal") store.setMode("normal");
  }

  function isOverlayActive() {
    return !!(
      (flowVeil && flowVeil.classList.contains("active")) ||
      (prophVeil && prophVeil.classList.contains("active"))
    );
  }

  /* ================= 心流模式 ================= */
  function firstPending() {
    var st = store.get();
    return st.mapTasks.filter(function (t) { return !t.done; })[0] || null;
  }

  function openFlow() {
    var mins = 25;
    total = mins * 60; remain = total;
    var activeT = firstPending();
    var taskName = activeT ? activeT.title : "静心批阅奏章";
    flowVeil.innerHTML =
      '<div class="ftitle">心 流 · 专 注</div>' +
      '<div class="flow-ring">' +
        '<svg width="240" height="240" viewBox="0 0 240 240">' +
          '<defs><linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#6fa89a"/><stop offset="1" stop-color="#e7c985"/></linearGradient></defs>' +
          '<circle class="track" cx="120" cy="120" r="110"/>' +
          '<circle class="prog" id="flowProg" cx="120" cy="120" r="110" ' +
            'stroke-dasharray="' + (2 * Math.PI * 110).toFixed(1) + '" stroke-dashoffset="0"/>' +
        '</svg>' +
        '<div class="time"><div class="tt" id="flowTime">25:00</div><div class="ss">专注中</div></div>' +
      '</div>' +
      '<div class="flow-task">当前专注：' + ui.esc(taskName) + '</div>' +
      '<div class="flow-ctrl">' +
        '<button class="btn btn-gold" id="flowStart">开始专注</button>' +
        '<button class="btn btn-ghost" id="flowExit" style="color:#f7f2e6;border-color:rgba(255,255,255,.4)">退出</button>' +
      '</div>';
    flowVeil.classList.add("active");
    ui.$("#flowStart").onclick = startTimer;
    ui.$("#flowExit").onclick = function () { switchTo("normal"); };
  }

  function updateFlow() {
    var mm = String(Math.floor(remain / 60)).padStart(2, "0");
    var ss = String(remain % 60).padStart(2, "0");
    var tEl = ui.$("#flowTime"); if (tEl) tEl.textContent = mm + ":" + ss;
    var circ = 2 * Math.PI * 110;
    var prog = ui.$("#flowProg");
    if (prog) prog.setAttribute("stroke-dashoffset", (circ * (1 - remain / total)).toFixed(1));
  }

  function startTimer() {
    stopTimer();
    flowStartedInDemo = !!(App.demo && App.demo.active === true);
    var btn = ui.$("#flowStart"); if (btn) { btn.textContent = "专注进行中…"; btn.disabled = true; }
    var tickMs = demoSpeed ? 60 : 1000;
    var decr = demoSpeed ? 25 : 1;   // 演示时加速
    timer = setInterval(function () {
      remain -= decr;
      if (remain <= 0) { remain = 0; updateFlow(); completeFlow(); return; }
      updateFlow();
    }, tickMs);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function completeFlow() {
    stopTimer();
    var countsForAchievements = !flowStartedInDemo;
    store.addFlowMinutes(25, { countsForAchievements: countsForAchievements });
    var st = store.get();
    store.addEnergy(-10, {
      id: flowStartedInDemo ? "demo-flow:" + Date.now() : "flow:" + st.dayKey + ":" + st.counters.flowMinutes,
      type: "flow",
      source: "flow",
      countsForAchievements: countsForAchievements
    });
    store.addJournal("心流专注", "一次 25 分钟的深度专注，心如止水，意随笔行。结算：精力 -10，心流不发金币。");
    var ss = flowVeil.querySelector(".flow-task");
    if (ss) ss.innerHTML = '<b style="color:#e7c985">✓ 专注圆满达成</b> · 已记入起居注';
    var ctrl = flowVeil.querySelector(".flow-ctrl");
    if (ctrl) ctrl.innerHTML = '<button class="btn btn-gold" id="flowDone">功成身退 ▸</button>';
    var d = ui.$("#flowDone"); if (d) d.onclick = function () { switchTo("normal"); };
  }

  /* ================= 预言模式 ================= */
  function openProphecy() {
    if (!App.prophecy) {
      prophVeil.style.backgroundImage = "url('" + data.ASSET_BASE + "场景/钦天监.png')";
      prophVeil.innerHTML =
        '<div class="prophecy-inner"><h2>预 言 天 机</h2>' +
        '<div class="sub">预言模块尚未载入，请刷新后再试</div>' +
        '<div class="prophecy-foot"><button class="btn btn-gold" id="prophExit">退出预言 ▸</button></div></div>';
      prophVeil.classList.add("active");
      ui.$("#prophExit").onclick = function () { switchTo("normal"); };
      return;
    }

    var model = App.prophecy.open(prophVeil, {
      onExit: function () { switchTo("normal"); }
    });
    prophVeil.classList.add("active");
    store.useProphecy(model.sourceKey);
  }

  function init() {
    flowVeil = ui.$("#flowVeil");
    prophVeil = ui.$("#prophecyVeil");
    // 心流计时与预言遮罩均不跨刷新恢复，避免存档 mode 与实际画面错位。
    if (store.get().mode !== "normal") store.setMode("normal");
  }

  App.modes = {
    init: init, switchTo: switchTo, exitOverlays: exitOverlays, exitToNormal: exitToNormal,
    isOverlayActive: isOverlayActive,
    openFlow: openFlow, openProphecy: openProphecy,
    setDemoSpeed: function (v) { demoSpeed = v; },
    _startTimer: startTimer
  };
})();
