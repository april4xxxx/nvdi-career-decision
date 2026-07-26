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
    if (App.flowAudio) App.flowAudio.stop();
    if (App.silverleaf) App.silverleaf.stop();
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

  var currentTask = "";

  function openFlow() {
    var mins = 25;
    total = mins * 60; remain = total;
    var activeT = firstPending();
    currentTask = activeT ? activeT.title : "静心批阅奏章";
    flowVeil.classList.add("active");
    if (App.flowAudio) App.flowAudio.start();   // 按当前场景播背景音
    renderTeaLanding();   // 先进茶席落地态；饮下茶汤后再入沉浸态
  }

  // 茶席态：金色 UI 静置卡片 + 右侧半圆茶盏（内嵌银叶菊随水流实时预览，作页面蒙版）
  function renderTeaLanding() {
    flowVeil.classList.remove("flow-immersed");
    flowVeil.classList.add("flow-tea");
    flowVeil.innerHTML =
      '<div class="flow-tea-scene">' +
        '<div class="flow-tea-copy">' +
          '<p class="flow-eyebrow">心流 · 茶席</p>' +
          '<h1 class="flow-h1">静 心 一 盏</h1>' +
          '<p class="flow-tea-desc">备下一盏银叶茶汤。<br>饮罢入席，静守二十五分钟深度专注。</p>' +
          '<p class="flow-focus-label">当前专注</p>' +
          '<div class="flow-task">' + ui.esc(currentTask) + '</div>' +
          '<div class="flow-tea-clock" aria-label="专注时间">' +
            '<span class="flow-clock-label">专注时间</span>' +
            '<strong class="flow-clock-time" id="flowTime">25:00</strong>' +
          '</div>' +
          '<div class="flow-ctrl">' +
            '<button class="btn btn-gold" id="flowStart">开始专注</button>' +
            '<button class="btn btn-ghost" id="flowExit">退出</button>' +
          '</div>' +
        '</div>' +
        '<div class="flow-tea-side">' +
          '<button class="flow-teacup" id="flowTea" ' +
            'aria-label="饮下这盏银叶茶汤，进入专注">' +
            '<canvas class="flow-teacup-canvas" id="flowTeaCanvas" role="img" ' +
              'aria-label="银叶菊在茶汤中随水流流动"></canvas>' +
            '<span class="flow-teacup-shine"></span>' +
          '</button>' +
          '<div class="flow-teacup-cap">' +
            '<span class="flow-teacup-title">一 盏 茶 汤</span>' +
            '<span class="flow-teacup-hint">点击入席 ▸</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    if (App.silverleaf) App.silverleaf.start(ui.$("#flowTeaCanvas"));
    updateFlow();   // 若已在计时，切回茶席时同步显示当前剩余
    ui.$("#flowStart").onclick = startTimer;
    ui.$("#flowTea").onclick = enterImmersion;
    ui.$("#flowExit").onclick = function () { switchTo("normal"); };
  }

  // 沉浸态：银叶菊随水流铺满全屏 + 居中金色专注计时
  function enterImmersion() {
    flowVeil.classList.remove("flow-tea");
    flowVeil.classList.add("flow-immersed");
    flowVeil.innerHTML =
      '<canvas class="flow-water" id="flowWater" role="img" ' +
        'aria-label="多枝银叶菊随水流经过画面，鼠标移动会拨动水流与附近花枝"></canvas>' +
      // 时钟单独绝对居中，对齐水面漩涡中心
      '<div class="flow-clock" aria-label="专注时间">' +
        '<div>' +
          '<span class="flow-clock-label">专注时间</span>' +
          '<strong class="flow-clock-time" id="flowTime">25:00</strong>' +
        '</div>' +
      '</div>' +
      // 任务与按钮排在时钟正下方
      '<div class="flow-below">' +
        '<p class="flow-focus-label">当前专注</p>' +
        '<div class="flow-task">' + ui.esc(currentTask) + '</div>' +
        '<div class="flow-ctrl">' +
          '<button class="btn btn-ghost" id="flowExit">退出</button>' +
        '</div>' +
      '</div>';
    if (App.silverleaf) App.silverleaf.start(ui.$("#flowWater"));
    updateFlow();                     // 沿用茶席起的表，接着显示当前剩余
    if (!timer) startTimer();         // 兜底：若在茶席未点开始就入席，则此刻起表
    ui.$("#flowExit").onclick = function () { switchTo("normal"); };
  }

  function updateFlow() {
    var mm = String(Math.floor(remain / 60)).padStart(2, "0");
    var ss = String(remain % 60).padStart(2, "0");
    var tEl = ui.$("#flowTime"); if (tEl) tEl.textContent = mm + ":" + ss;
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
    _startTimer: startTimer, _stopTimer: stopTimer, _renderTea: renderTeaLanding
  };
})();
