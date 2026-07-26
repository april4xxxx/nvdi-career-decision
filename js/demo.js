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

  // 点击推进：亮出「点击继续」提示条，等用户点击（或点提示条本身）再 resolve。
  // 取消演示时立即 resolve，交由 guard() 抛出中断。
  var advanceEl;
  function waitClick(label) {
    return new Promise(function (resolve) {
      if (cancelFlag) return resolve();
      if (!advanceEl) advanceEl = ui.$("#demoAdvance");
      var textEl = advanceEl && advanceEl.querySelector(".dtext");
      if (textEl) textEl.textContent = label || "点击继续";
      var done = false;
      function finish() {
        if (done) return; done = true;
        if (advanceEl) { advanceEl.classList.remove("show"); advanceEl.onclick = null; }
        document.removeEventListener("click", onDoc, true);
        clearInterval(poll);
        resolve();
      }
      function onDoc() { finish(); }
      // 稍作延迟再挂监听，避免把触发本步的那次点击也算进来
      setTimeout(function () {
        if (cancelFlag) return finish();
        if (advanceEl) { advanceEl.classList.add("show"); advanceEl.onclick = finish; }
        document.addEventListener("click", onDoc, true);
      }, 260);
      // 若演示被从别处停止，及时收尾
      var poll = setInterval(function () { if (cancelFlag) finish(); }, 200);
    });
  }

  // 退出推进：只挂「退出」按钮自身的点击，不监听全局点击。
  // 用户点画面里的成就卡时不会误触退出，只有点这枚按钮（或演示被停止）才 resolve。
  function waitExit(label) {
    return new Promise(function (resolve) {
      if (cancelFlag) return resolve();
      if (!advanceEl) advanceEl = ui.$("#demoAdvance");
      var textEl = advanceEl && advanceEl.querySelector(".dtext");
      if (textEl) textEl.textContent = label || "退出演示";
      var done = false;
      function finish() {
        if (done) return; done = true;
        if (advanceEl) { advanceEl.classList.remove("show"); advanceEl.onclick = null; }
        clearInterval(poll);
        resolve();
      }
      if (advanceEl) { advanceEl.classList.add("show"); advanceEl.onclick = finish; }
      var poll = setInterval(function () { if (cancelFlag) finish(); }, 200);
    });
  }

  /* ---------- 演示条目 ---------- */
  var ITEMS = [
    { key: "guide", label: "新手引导", desc: "重新体验：认识辅臣→提出问题→看懂奏折→朱批→生成行动" },
    { key: "tour", label: "全流程巡览", desc: "自动走一遍：朝堂决策→模式→藏书→珍宝，一气呵成" },
    { key: "decision", label: "决策与朱批", desc: "在朝堂发布奏折，演示同意/再议/大胆三种朱批" },
    { key: "energy", label: "精力与金币", desc: "校准精力、赴钦天监恢复精力、金币入库" },
    { key: "flow", label: "心流专注", desc: "进入心流模式并加速跑完一次 25 分钟专注" },
    { key: "prophecy", label: "预言推演", desc: "查看未来七天天象与长期功绩史卷" },
    { key: "library", label: "藏书阁", desc: "浏览主线里程碑、起居注，并上传一卷典籍" },
    { key: "treasury", label: "珍宝阁成就", desc: "看看你的每一次决策与坚持，如何化作一件件可收藏的珍宝" },
    { key: "lingyan", label: "凌烟阁人物", desc: "决策生成人物入阁→民间偶遇银叶菊仙并招募→听夸赞→采纳闲谈入藏书阁" }
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
      '<p class="muted" style="margin-bottom:16px;font-size:13px">选择一段自动演示，系统将替你操作；演示操作不计入成就进度。随时可点右上角或底部停止。</p>' +
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
    if (!advanceEl) advanceEl = ui.$("#demoAdvance");
    if (advanceEl) { advanceEl.classList.remove("show"); advanceEl.onclick = null; }
    if (store.finalizeDemoTasks) store.finalizeDemoTasks();
  }

  async function run(key) {
    if (key === "guide") {
      if (running) stopDemo();
      if (App.guide) App.guide.start(true);
      return;
    }
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
      else if (key === "lingyan") await demoLingyan();
    } catch (e) { console.warn("[demo] interrupted", e); }
    running = false; App.demo.active = false; setBadge(false); App.modes.setDemoSpeed(false);
    if (!advanceEl) advanceEl = ui.$("#demoAdvance");
    if (advanceEl) { advanceEl.classList.remove("show"); advanceEl.onclick = null; }
    if (store.finalizeDemoTasks) store.finalizeDemoTasks();
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
    App.nav.goScene("court", { recordVisit: false }); await sleep(DEMO_PACE.scene); guard();
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
    App.nav.goScene("court", { recordVisit: false }); await sleep(DEMO_PACE.scene);
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
    App.nav.goScene("observatory", { recordVisit: false }); await sleep(DEMO_PACE.scene); guard();
    var card = document.querySelector("#taskField .task-card:not(.done)");
    if (card) { flash(card); await sleep(DEMO_PACE.focus); card.click(); }
    await sleep(DEMO_PACE.window); guard();
    var tcfOk = ui.$("#tcfOk"); if (tcfOk) tcfOk.click();
    await sleep(DEMO_PACE.readMedium);
  }

  async function demoFlow() {
    App.modes.setDemoSpeed(true);
    App.modes.switchTo("flow"); App.topbar.render();
    await sleep(DEMO_PACE.window); guard();
    // 茶席态：先在此处点「开始专注」起表（demoSpeed 下加速）
    flash("#flowStart");
    var start = ui.$("#flowStart"); if (start) start.click();
    // 让观众看清茶席上的计时读秒
    await sleep(DEMO_PACE.readMedium); guard();
    // 再点茶盏入席，进入全屏沉浸态，计时继续走
    flash("#flowTea");
    var tea = ui.$("#flowTea"); if (tea) tea.click();
    // 沉浸态看水流铺满与漩涡中心的计时
    await sleep(DEMO_PACE.readLong); guard();
    App.modes.setDemoSpeed(false);
    var done = ui.$("#flowDone");
    if (done) { done.click(); await sleep(DEMO_PACE.window); }
    else { App.modes._stopTimer(); }
  }

  async function demoProphecy() {
    // 依次带读七日任务、星轨冲突与长期功绩史卷。
    App.modes.switchTo("prophecy"); App.topbar.render();
    await sleep(DEMO_PACE.scene); guard();
    var cards = Array.prototype.slice.call(document.querySelectorAll(".prophecy-day-card"), 0, 3);
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card) flash(card);
      await sleep(DEMO_PACE.readShort); guard();
    }
    var chronicleTab = ui.$('[data-prophecy-view="chronicle"]');
    if (chronicleTab) { flash(chronicleTab); chronicleTab.click(); }
    await sleep(DEMO_PACE.readLong); guard();
    var scroll = ui.$(".prophecy-scroll-sheet"); if (scroll) flash(scroll);
    await sleep(DEMO_PACE.readMedium); guard();
    var exit = ui.$("#prophExit"); if (exit) exit.click();
    await sleep(DEMO_PACE.window);
  }

  async function demoLibrary() {
    App.nav.goScene("library", { recordVisit: false });
    // 藏书阁会记住用户上次停留的页签；演示必须始终从主线任务开始。
    var tabs = document.querySelectorAll("#libTabs .lib-tab");
    if (tabs[0]) tabs[0].click();
    await sleep(DEMO_PACE.scene); guard();
    tabs = document.querySelectorAll("#libTabs .lib-tab");
    if (tabs[0]) flash(tabs[0]);
    await sleep(DEMO_PACE.readMedium); guard();
    // 切到起居注
    tabs = document.querySelectorAll("#libTabs .lib-tab");
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

  // 演示点亮的成就同样需保护：非 URL 演示会落盘，先快照 achievements、结束（含中途取消）时还原。
  function snapshotAchievements() {
    return JSON.parse(JSON.stringify(store.get().achievements || {}));
  }
  function restoreAchievements(snap) {
    if (!snap) return;
    store.get().achievements = snap;
    store.save();
    store.emit("achievement");
  }

  async function demoTreasury() {
    var snap = window.APP_DEMO ? null : snapshotAchievements();
    try {
      await demoTreasuryBody();
    } finally {
      if (snap) restoreAchievements(snap);
    }
  }

  async function demoTreasuryBody() {
    await sleep(DEMO_PACE.window); guard();
    App.nav.goScene("treasury", { recordVisit: false }); await sleep(DEMO_PACE.scene); guard();
    // 不自动推进：停在珍宝阁，用户点哪件成就哪件就点亮（treasury 演示态点击即解锁），
    // 不点、不退，画面保持不动。只有点「退出演示」按钮才收尾。
    await waitExit("点亮想看的珍宝 · 退出演示");
  }

  // 侧栏菜单触发的演示仍会落盘（仅 URL ?demo= 免落盘），故凌烟阁演示改动的字段先快照、结束时还原，绝不污染真实存档
  function snapshotLingyanState() {
    var st = store.get();
    var ft = store.folkTalk();
    return {
      npcs: JSON.parse(JSON.stringify(st.npcs || [])),
      npcInteractions: JSON.parse(JSON.stringify(st.npcInteractions || [])),
      npcTaskCardLinks: JSON.parse(JSON.stringify(st.npcTaskCardLinks || [])),
      books: JSON.parse(JSON.stringify(st.books || [])),
      journals: JSON.parse(JSON.stringify(st.journals || [])),
      recruitedLegends: JSON.parse(JSON.stringify(ft.recruitedLegends || {})),
      activeBuffs: JSON.parse(JSON.stringify(ft.activeBuffs || {})),
      actionLedger: JSON.parse(JSON.stringify(ft.actionLedger || {})),
      unlockedCommoners: JSON.parse(JSON.stringify(ft.unlockedCommoners || {})),
      seenContentIds: JSON.parse(JSON.stringify(ft.seenContentIds || [])),
      recentContentIds: JSON.parse(JSON.stringify(ft.recentContentIds || [])),
      activeEncounter: null
    };
  }
  function restoreLingyanState(snap) {
    if (!snap) return;
    var st = store.get();
    var ft = store.folkTalk();
    st.npcs = snap.npcs; st.npcInteractions = snap.npcInteractions; st.npcTaskCardLinks = snap.npcTaskCardLinks;
    st.books = snap.books; st.journals = snap.journals;
    ft.recruitedLegends = snap.recruitedLegends; ft.activeBuffs = snap.activeBuffs; ft.actionLedger = snap.actionLedger;
    ft.unlockedCommoners = snap.unlockedCommoners; ft.seenContentIds = snap.seenContentIds; ft.recentContentIds = snap.recentContentIds;
    ft.activeEncounter = null;
    store.save();
    store.emit("npc"); store.emit("folk"); store.emit("book");
  }

  // 硬编码一位「决策中新生成」的朝中同僚，令凌烟阁「朝中同僚」区有真实人物（幂等）
  function seedDecisionNpc() {
    var st = store.get();
    st.npcs = Array.isArray(st.npcs) ? st.npcs : [];
    if (st.npcs.some(function (n) { return n.id === "demo-npc-manager"; })) return;
    var now = new Date().toISOString();
    st.npcs.push({
      id: "demo-npc-manager", cat: "work",
      displayName: "林主管", title: "部门主管", aliases: ["直属上级"],
      role: "manager", identityStatus: "confirmed", confidence: 0.9,
      relationship: { stance: "neutral", stanceConfidence: 0.8 }, portrait: null,
      createdAt: now, updatedAt: now
    });
    st.npcInteractions = Array.isArray(st.npcInteractions) ? st.npcInteractions : [];
    st.npcTaskCardLinks = Array.isArray(st.npcTaskCardLinks) ? st.npcTaskCardLinks : [];
    st.npcInteractions.push({ id: "demo-interaction-1", npcId: "demo-npc-manager", title: "与林主管敲定行业分享的排期", relation: "owner", createdAt: now });
    st.npcTaskCardLinks.push({ id: "demo-link-1", npcId: "demo-npc-manager", interactionId: "demo-interaction-1", taskCardId: "demo-task-share", relation: "owner", createdAt: now });
    store.emit("npc");
  }

  // 硬编码一场市井偶遇：直接写 activeEncounter，绕过随机抽取，再就地渲染
  var demoEncSeq = 0;
  function stageFolkEncounter(enc) {
    if (store.get().scene !== "folk") App.nav.goScene("folk", { recordVisit: false });
    var ft = store.folkTalk();
    demoEncSeq++;
    ft.activeEncounter = Object.assign({
      encounterId: "demo-enc-" + demoEncSeq,
      navigationToken: "demo-" + demoEncSeq,
      fromScene: "court", status: "generated",
      bookCollected: false, recruited: false,
      isFirstMeetCommoner: true,
      createdAt: new Date().toISOString()
    }, enc);
    if (App.folkEncounter) App.folkEncounter.render();
  }

  async function demoLingyan() {
    // 非 URL 演示也会落盘，故先快照、结束（含中途取消）时还原，绝不污染真实存档
    var snap = window.APP_DEMO ? null : snapshotLingyanState();
    try {
      await demoLingyanBody();
    } finally {
      if (snap) restoreLingyanState(snap);
    }
  }

  async function demoLingyanBody() {
    // ① 决策中新生成的人物：先埋入一位朝中同僚，再入凌烟阁看「朝中同僚」区
    seedDecisionNpc();
    App.nav.goScene("lingyan", { recordVisit: false });
    await sleep(DEMO_PACE.window); guard();
    var mgr = Array.prototype.filter.call(document.querySelectorAll("#lingyanPanel .pc"), function (el) {
      return el.textContent.indexOf("林主管") >= 0;
    })[0];
    if (mgr) mgr.scrollIntoView({ block: "center", behavior: "smooth" });
    await waitClick("决策生成的同僚已入阁 · 点击继续"); guard();

    // ② 民间抽到名臣（写死银叶菊仙）→ 收入麾下（每步单独等点击）
    stageFolkEncounter({ actorType: "legend", legendId: "legend_silver_chrysanthemum", actorId: "legend_silver_chrysanthemum", contentId: "legend_silver_praise_01" });
    await sleep(DEMO_PACE.window); guard();
    await waitClick("民间偶遇名臣 · 点击收入麾下"); guard();
    var recruit = ui.$("#feRecruit");
    if (recruit) recruit.click();
    await sleep(DEMO_PACE.window); guard();
    await waitClick("已入麾下 · 点击继续逛逛"); guard();
    var keepWalking = ui.$("#feKeepWalking"); if (keepWalking) keepWalking.click();
    await sleep(DEMO_PACE.window); guard();

    // ③ 民间收到夸赞（source:null，只听不成书）
    stageFolkEncounter({ actorType: "commoner", actorId: "commoner_002", contentId: "folk_praise_01" });
    await sleep(DEMO_PACE.window); guard();
    await waitClick("市井夸赞 · 只听不成书 · 点击继续"); guard();

    // ④ 民间采纳闲谈 → 进入藏书阁（带 source 的 knowledge，可成书）
    stageFolkEncounter({ actorType: "commoner", actorId: "commoner_003", contentId: "folk_knowledge_01" });
    await sleep(DEMO_PACE.window); guard();
    await waitClick("市井闲谈 · 点击收入藏书阁"); guard();
    var collect = ui.$("#feCollect");
    if (collect) collect.click();
    await sleep(DEMO_PACE.readShort); guard();
    await waitClick("已成书 · 点击前往藏书阁"); guard();
    var goLib = ui.$("#feGoLibrary");
    if (goLib) goLib.click();
    await sleep(DEMO_PACE.window); guard();
    ui.closeModal();

    // ⑤ 回凌烟阁：银叶菊仙已入「名臣异士」，市井之人已解锁
    await waitClick("点击回凌烟阁查看战果"); guard();
    App.nav.goScene("lingyan", { recordVisit: false });
    await sleep(DEMO_PACE.window); guard();
    var silver = Array.prototype.filter.call(document.querySelectorAll("#lingyanPanel .pc:not(.locked)"), function (el) {
      return el.textContent.indexOf("银叶菊仙") >= 0;
    })[0];
    if (silver) silver.scrollIntoView({ block: "center", behavior: "smooth" });
    await waitClick("演示结束 · 点击收尾"); guard();
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
    await demoProphecy(); guard(); await sleep(DEMO_PACE.chapter);
    await demoFlow(); guard(); await sleep(DEMO_PACE.chapter);
    await demoLibrary(); guard(); await sleep(DEMO_PACE.chapter);
    await demoTreasury();
  }

  function init() { setBadge(false); }

  App.demo = { active: false, init: init, openMenu: openMenu, run: run, stop: stopDemo, isRunning: function () { return running; } };
})();
