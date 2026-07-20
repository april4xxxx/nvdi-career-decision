/* =============================================================
   modes.js —— 模式切换：常规 / 心流(专注计时) / 预言(决策推演)
   window.App.modes
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var flowVeil, prophVeil;
  var timer = null, remain = 0, total = 25 * 60, demoSpeed = false;

  /* ---------- 模式入口 ---------- */
  function switchTo(m) {
    store.setMode(m);
    exitOverlays();
    if (m === "flow") openFlow();
    else if (m === "prophecy") openProphecy();
  }
  function exitOverlays() {
    stopTimer();
    flowVeil.classList.remove("active");
    prophVeil.classList.remove("active");
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
        '<button class="btn btn-jade" id="flowStart">开始专注</button>' +
        '<button class="btn btn-ghost" id="flowExit" style="color:#f7f2e6;border-color:rgba(255,255,255,.4)">退出</button>' +
      '</div>';
    flowVeil.classList.add("active");
    ui.$("#flowStart").onclick = startTimer;
    ui.$("#flowExit").onclick = function () { switchTo("normal"); App.topbar.render(); };
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
    store.addFlowMinutes(25);
    store.addEnergy(-10);
    store.addGold(30, "flow");
    store.addJournal("心流专注", "一次 25 分钟的深度专注，心如止水，意随笔行。");
    var ss = flowVeil.querySelector(".flow-task");
    if (ss) ss.innerHTML = '<b style="color:#e7c985">✓ 专注圆满达成</b> · 获 +30 金，功力精进';
    var ctrl = flowVeil.querySelector(".flow-ctrl");
    if (ctrl) ctrl.innerHTML = '<button class="btn btn-gold" id="flowDone">功成身退 ▸</button>';
    var d = ui.$("#flowDone"); if (d) d.onclick = function () { switchTo("normal"); App.topbar.render(); };
  }

  /* ================= 预言模式 ================= */
  // 推演一份「决策奏折」在三种朱批下的走向：同意(采纳推荐) / 再议(暂缓) / 大胆(另采备选)
  function openProphecy() {
    var d = (data.SCENARIOS[0] && data.SCENARIOS[0].decision) || null;
    prophVeil.style.backgroundImage = "url('" + data.ASSET_BASE + "场景/预言模式底图.png')";
    if (!d) {
      prophVeil.innerHTML =
        '<div class="prophecy-inner"><h2>预 言 天 机</h2>' +
        '<div class="sub">暂无可推演的决策</div>' +
        '<div class="prophecy-foot"><button class="btn btn-gold" id="prophExit">退出预言 ▸</button></div></div>';
      prophVeil.classList.add("active");
      ui.$("#prophExit").onclick = function () { switchTo("normal"); App.topbar.render(); };
      return;
    }
    store.useProphecy();
    var recGold = (d.recommend.tasks || []).reduce(function (s, t) { return s + (t.gold || 0); }, 0);
    var altGold = ((d.alt && d.alt.tasks) || []).reduce(function (s, t) { return s + (t.gold || 0); }, 0);
    var cards = [
      forecastCard("agree", "同意", "采纳推荐：" + d.recommend.label, d.recommend.text, recGold, (d.recommend.tasks || []).length),
      forecastCard("again", "再议", "留中不发，补充信息后重拟", "暂不落定，记入起居注，待信息更全再作决断。", 0, 0),
      forecastCard("bold", "大胆", (d.alt ? "改采备选：" + d.alt.label : "推翻重来"), (d.alt ? d.alt.text : "大臣重新补充信息，另拟一策。"), altGold, d.alt ? (d.alt.tasks || []).length : 0)
    ].join("");
    prophVeil.innerHTML =
      '<div class="prophecy-inner">' +
      '<h2>预 言 天 机</h2>' +
      '<div class="sub">推演决策「' + ui.esc(d.title) + '」三种朱批之可能</div>' +
      '<div class="forecast-grid">' + cards + '</div>' +
      '<div class="prophecy-foot">' +
        '<button class="btn btn-gold" id="prophGo">回对话落笔朱批 ▸</button> ' +
        '<button class="btn btn-ghost" id="prophExit" style="color:#f7f2e6;border-color:rgba(255,255,255,.4)">退出</button>' +
      '</div></div>';
    prophVeil.classList.add("active");
    ui.$("#prophExit").onclick = function () { switchTo("normal"); App.topbar.render(); };
    ui.$("#prophGo").onclick = function () {
      switchTo("normal"); App.topbar.render();
      if (App.conversation) App.conversation.expand();
    };
  }

  function forecastCard(kind, label, head, body, gold, taskN) {
    var risk = kind === "agree" ? "稳健" : kind === "again" ? "保守" : "进取";
    return '<div class="forecast-card ' + kind + '">' +
      '<h4>' + label + ' <span class="pill">' + risk + '</span></h4>' +
      '<p><b>' + ui.esc(head) + '</b><br/>' + ui.esc(body) + '</p>' +
      '<div class="stat"><span>预计赏金 +' + gold + '</span><span>' + (taskN ? "生成 " + taskN + " 项任务" : "不生成任务") + '</span></div>' +
      '</div>';
  }

  function init() {
    flowVeil = ui.$("#flowVeil");
    prophVeil = ui.$("#prophecyVeil");
  }

  App.modes = {
    init: init, switchTo: switchTo, exitOverlays: exitOverlays,
    openFlow: openFlow, openProphecy: openProphecy,
    setDemoSpeed: function (v) { demoSpeed = v; },
    _startTimer: startTimer
  };
})();
