/* =============================================================
   demo.js —— 演示模式：每个模块都有一段自动演示
   window.App.demo
   通过侧栏「▶ 演示」打开菜单，或 App.demo.run('key')
   演示会自动导航/点击/填充，并以底部徽标提示进行中。
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var running = false, badge, badgeText, cancelFlag = false;
  // 宁静观看档：先等窗口稳定，再给用户留出读完关键内容的时间。
  var DEMO_PACE = Object.freeze({
    typeChar: 54,
    typeSettle: 700,
    scene: 1800,
    window: 1200,
    focus: 1000,
    readShort: 1600,
    readMedium: 2400,
    readLong: 3200,
    chapter: 1200
  });

  function setBadge(on, text) {
    if (!badge) { badge = ui.$("#demoBadge"); badgeText = ui.$("#demoBadgeText"); }
    badge.classList.toggle("active", on);
    if (text && badgeText) badgeText.textContent = text;
  }
  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }
  function flash(sel) {
    var el = typeof sel === "string" ? ui.$(sel) : sel;
    if (!el) return;
    el.classList.add("demo-focus");
    setTimeout(function () { el.classList.remove("demo-focus"); }, DEMO_PACE.focus + 400);
  }

  /* ---------- 演示条目 ---------- */
  var ITEMS = [
    { key: "tour", label: "全流程巡览", desc: "自动走一遍：朝堂决策→模式→藏书→珍宝，一气呵成" },
    { key: "decision", label: "决策与朱批", desc: "在朝堂发布奏折，演示同意/再议/大胆三种朱批" },
    { key: "energy", label: "精力与金币", desc: "校准精力、赴钦天监恢复精力、金币入库" },
    { key: "flow", label: "心流专注", desc: "进入心流模式并加速跑完一次 25 分钟专注" },
    { key: "prophecy", label: "预言推演", desc: "对一份奏折推演三种朱批的可能走向" },
    { key: "library", label: "藏书阁", desc: "浏览主线里程碑、起居注，并上传一卷典籍" },
    { key: "treasury", label: "珍宝阁成就", desc: "解锁若干成就并展示 59 珍网格与详情" }
  ];

  function openMenu() {
    var list = ITEMS.map(function (it) {
      return '<button class="opt-btn" data-demo="' + it.key + '" style="margin-bottom:10px">' +
        '<b>' + ui.esc(it.label) + '</b>' +
        '<div class="muted" style="font-size:12px;margin-top:3px">' + ui.esc(it.desc) + '</div></button>';
    }).join("");
    ui.openModal(
      '<div style="padding:24px 28px">' +
      '<h3 style="font-size:21px;letter-spacing:.1em;margin-bottom:4px">演示模式</h3>' +
      '<p class="muted" style="margin-bottom:16px;font-size:13px">选择一段自动演示，系统将替你操作。随时可点右上角或底部停止。</p>' +
      '<div class="opt-list">' + list + '</div>' +
      '<div style="text-align:right;margin-top:16px">' +
      (running ? '<button class="btn btn-verm" id="demoStop">停止当前演示</button>' : '') +
      ' <button class="btn" id="demoCancel">关闭</button></div></div>'
    );
    Array.prototype.forEach.call(document.querySelectorAll("[data-demo]"), function (b) {
      b.addEventListener("click", function () { ui.closeModal(); run(b.getAttribute("data-demo")); });
    });
    ui.$("#demoCancel").onclick = ui.closeModal;
    var stop = ui.$("#demoStop"); if (stop) stop.onclick = function () { ui.closeModal(); stopDemo(); };
  }

  function stopDemo() {
    cancelFlag = true; running = false; App.demo.active = false; setBadge(false); App.modes.setDemoSpeed(false);
    if (store.clearDemoTasks) store.clearDemoTasks();
  }

  async function run(key) {
    if (running) { cancelFlag = true; await sleep(300); }
    cancelFlag = false; running = true; App.demo.active = true;
    setBadge(true, "演示：" + ((ITEMS.filter(function (i) { return i.key === key; })[0] || {}).label || ""));
    try {
      if (key === "tour") await demoTour();
      else if (key === "decision") await demoDecision();
      else if (key === "energy") await demoEnergy();
      else if (key === "flow") await demoFlow();
      else if (key === "prophecy") await demoProphecy();
      else if (key === "library") await demoLibrary();
      else if (key === "treasury") await demoTreasury();
    } catch (e) { console.warn("[demo] interrupted", e); }
    running = false; App.demo.active = false; setBadge(false); App.modes.setDemoSpeed(false);
    if (store.clearDemoTasks) store.clearDemoTasks();
  }
  function guard() { if (cancelFlag) throw new Error("cancelled"); }

  /* ---------- 各演示 ---------- */
  // 模拟在输入框里逐字打字，然后发送
  async function typeAndSend(text, speed) {
    var input = ui.$("#convoText");
    if (!input) return;
    input.focus();
    input.value = "";
    for (var i = 0; i < text.length; i++) {
      input.value += text[i];
      await sleep(speed || DEMO_PACE.typeChar);
      if (cancelFlag) return;
    }
    await sleep(DEMO_PACE.typeSettle);
    var send = ui.$("#convoSend"); if (send) send.click();
  }

  async function demoDecision() {
    App.nav.goScene("court"); await sleep(DEMO_PACE.scene); guard();
    if (App.conversation) App.conversation.expand(); await sleep(DEMO_PACE.window); guard();
    // 输入一个真实职场情景 → 触发追问 → 给决策 → 同意生成任务
    await typeAndSend("下周部门周会邀请我做一次行业分享，我有点犹豫"); await sleep(DEMO_PACE.readMedium); guard();
    // 命中追问：点第一个选项
    var opt = document.querySelector("#replyZone .opt-btn");
    if (opt) { flash(opt); await sleep(DEMO_PACE.focus); opt.click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    // 决策奏折出现 → 底部主按钮变「同意」印章
    flash(".decision-sheet"); await sleep(DEMO_PACE.readLong); guard();
    var send = ui.$("#convoSend");
    if (send && send.getAttribute("data-mode") === "stamp") { flash(send); await sleep(DEMO_PACE.focus); send.click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    // 前往朝堂看看生成的任务卡
    App.nav.goScene("court"); await sleep(DEMO_PACE.scene);
  }

  async function demoEnergy() {
    // 校准精力
    App.topbar.openCalibrate(); await sleep(DEMO_PACE.window); guard();
    var range = ui.$("#calibRange");
    if (range) { range.value = 40; range.dispatchEvent(new Event("input")); }
    await sleep(DEMO_PACE.readShort); guard();
    var ok = ui.$("#calibOk"); if (ok) ok.click();
    await sleep(DEMO_PACE.window); guard();
    // 通过对话生成一个「恢复精力」任务，投放钦天监
    if (App.conversation) App.conversation.expand(); await sleep(DEMO_PACE.window); guard();
    await typeAndSend("最近连着加班，实在有点累，快撑不住了"); await sleep(DEMO_PACE.readMedium); guard();
    flash(".decision-sheet"); await sleep(DEMO_PACE.readLong); guard();
    var send = ui.$("#convoSend");
    if (send && send.getAttribute("data-mode") === "stamp") { flash(send); await sleep(DEMO_PACE.focus); send.click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    // 去钦天监完成它
    App.nav.goScene("observatory"); await sleep(DEMO_PACE.scene); guard();
    var card = document.querySelector("#taskField .task-card:not(.done)");
    if (card) { flash(card); await sleep(DEMO_PACE.focus); card.click(); }
    await sleep(DEMO_PACE.window); guard();
    var tcfOk = ui.$("#tcfOk"); if (tcfOk) tcfOk.click();
    await sleep(DEMO_PACE.readMedium);
  }

  async function demoFlow() {
    App.modes.setDemoSpeed(true);
    App.modes.switchTo("flow"); App.topbar.render();
    await sleep(DEMO_PACE.scene); guard();
    flash("#flowStart");
    var start = ui.$("#flowStart"); if (start) start.click();
    // 加速跑完（demoSpeed 下约数秒）
    await sleep(6500); guard();
    App.modes.setDemoSpeed(false);
    var done = ui.$("#flowDone"); if (done) done.click();
    await sleep(DEMO_PACE.window);
  }

  async function demoProphecy() {
    // 确保有一份决策奏折
    App.modes.switchTo("prophecy"); App.topbar.render();
    await sleep(DEMO_PACE.readLong); guard();
    var exit = ui.$("#prophExit"); if (exit) exit.click();
    await sleep(DEMO_PACE.window);
  }

  async function demoLibrary() {
    App.nav.goScene("library"); await sleep(DEMO_PACE.scene); guard();
    // 切到起居注
    var tabs = document.querySelectorAll("#libTabs .lib-tab");
    if (tabs[1]) { flash(tabs[1]); tabs[1].click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    // 切到治国之策并上传
    tabs = document.querySelectorAll("#libTabs .lib-tab");
    if (tabs[2]) { flash(tabs[2]); tabs[2].click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    var up = ui.$("#bookUpload"); if (up) { flash(up); up.click(); }
    await sleep(DEMO_PACE.window); guard();
    if (ui.$("#upTitle")) ui.$("#upTitle").value = "御批复盘·首季";
    if (ui.$("#upAuthor")) ui.$("#upAuthor").value = "陛下亲撰";
    if (ui.$("#upNote")) ui.$("#upNote").value = "总结登基以来三月之政，得失皆记，以为后鉴。";
    await sleep(DEMO_PACE.readMedium); guard();
    var ok = ui.$("#upOk"); if (ok) ok.click();
    await sleep(DEMO_PACE.readShort);
    // 演示不应因本地 API 不可用或上传失败而把用户留在弹窗中。
    ui.closeModal();
  }

  async function demoTreasury() {
    // 先解锁一些成就以充实展示
    ["first-vermilion-brush", "first-task-kiln-fire", "jade-first-restore-hundred", "first-gold", "garden-stroll", "prophecy-first"].forEach(function (id) {
      store.unlock(id);
    });
    await sleep(DEMO_PACE.window); guard();
    App.nav.goScene("treasury"); await sleep(DEMO_PACE.scene); guard();
    // 切换筛选
    var chips = document.querySelectorAll(".tr-chip");
    if (chips[1]) { flash(chips[1]); chips[1].click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    if (chips[0]) chips[0].click();
    await sleep(DEMO_PACE.window); guard();
    // 打开一个成就详情
    App.treasury.showDetail("jade-full-cap-150");
    await sleep(DEMO_PACE.readLong); guard();
    ui.closeModal();
    await sleep(DEMO_PACE.window);
  }

  async function demoTour() {
    await demoDecision(); guard(); await sleep(DEMO_PACE.chapter);
    // 再演示一个「探索」情景：3999 课程 → 试听备选
    if (App.conversation) App.conversation.expand(); await sleep(DEMO_PACE.window); guard();
    await typeAndSend("看到一门 3999 的职业课程，想买又怕浪费钱"); await sleep(DEMO_PACE.readMedium); guard();
    var opt = document.querySelector("#replyZone .opt-btn"); if (opt) { flash(opt); await sleep(DEMO_PACE.focus); opt.click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    var send = ui.$("#convoSend");
    if (send && send.getAttribute("data-mode") === "stamp") { flash(send); await sleep(DEMO_PACE.focus); send.click(); }
    await sleep(DEMO_PACE.readMedium); guard();
    await demoFlow(); guard(); await sleep(DEMO_PACE.chapter);
    await demoLibrary(); guard(); await sleep(DEMO_PACE.chapter);
    await demoTreasury();
  }

  function init() { setBadge(false); }

  App.demo = { active: false, init: init, openMenu: openMenu, run: run, stop: stopDemo, isRunning: function () { return running; } };
})();
