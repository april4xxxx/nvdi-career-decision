/* =============================================================
   scene.js —— 场景舞台：背景 / 场景信息条 / 任务珠串 / NPC 立绘
   同时提供 App.nav.goScene（切换场景 + 关闭覆盖面板 + 开场白）
   window.App.scene
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var bgEl, headEl, fieldEl, npcEl;

  function render() {
    var st = store.get();
    var sc = data.sceneById(st.scene);
    if (!sc) return;

    // 背景（淡入切换）
    bgEl.style.opacity = "0";
    setTimeout(function () {
      bgEl.style.backgroundImage = "url('" + sc.bg + "')";
      bgEl.style.opacity = "1";
    }, 60);

    // 信息条
    var cat = data.catByScene(sc.id);
    headEl.innerHTML =
      '<img src="' + ui.esc(sc.icon) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div><div class="sn">' + ui.esc(sc.name) + '</div>' +
      '<div class="sr">' + ui.esc(sc.role) + (cat ? ' · ' + cat.label + '任务归处' : '') + '</div></div>';

    // NPC 立绘
    if (sc.portrait) {
      npcEl.src = sc.portrait;
      npcEl.style.display = "";
      npcEl.onerror = function () { npcEl.style.display = "none"; };
    } else npcEl.style.display = "none";

    renderTasks(sc, st);
  }

  // 场景内的地图任务：每桩一张卡，铺任务底图（模块 03 需求）
  function renderTasks(sc, st) {
    if (!fieldEl) return;
    var tasks = store.tasksForScene(sc.id);
    if (!tasks.length) { fieldEl.innerHTML = ""; return; }
    var cat = data.catByScene(sc.id) || { color: "var(--gold)", label: "" };
    fieldEl.innerHTML = tasks.map(function (t, i) {
      return '<button class="task-card' + (t.done ? " done" : "") + '" data-task="' + t.id + '"' +
        ' style="--c:' + cat.color + ';background-image:url(\'' + ui.esc(t.bg) + '\');animation-delay:' + (i * 70) + 'ms">' +
        '<span class="tc-scrim"></span>' +
        '<span class="tc-top"><span class="tc-cat">' + ui.esc(cat.label) + '</span>' +
          (t.done ? '<span class="tc-done">已办 ✓</span>' : '<span class="tc-flag">待办</span>') + '</span>' +
        '<span class="tc-title">' + ui.esc(t.title) + '</span>' +
        '<span class="tc-meta">耗精力 ' + Math.abs(t.energy) + ' · 赏 ' + t.gold + ' 金' +
          (t.from ? ' · 出自「' + ui.esc(t.from) + '」' : '') + '</span>' +
        (t.done ? '' : '<span class="tc-cta">呈报完成 ▸</span>') +
      '</button>';
    }).join("");
    Array.prototype.forEach.call(fieldEl.querySelectorAll(".task-card"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-task");
        var task = store.tasksForScene(sc.id).filter(function (x) { return x.id === id; })[0];
        if (!task || task.done) return;
        confirmComplete(task);
      });
    });
  }

  // 呈报完成：轻确认 → 结算
  function confirmComplete(task) {
    ui.openModal(
      '<div class="task-confirm">' +
      '<h3>呈报此任务已办结？</h3>' +
      '<p class="tcf-title">' + ui.esc(task.title) + '</p>' +
      '<p class="muted">办结后将结算：' +
        (task.restore ? '恢复精力 +' + task.restore : '消耗精力 ' + Math.abs(task.energy)) +
        ' · 赏 ' + task.gold + ' 金</p>' +
      '<div class="tcf-btns">' +
        '<button class="btn" id="tcfCancel">再想想</button>' +
        '<button class="btn btn-jade" id="tcfOk">呈报办结</button>' +
      '</div></div>'
    );
    ui.$("#tcfCancel").onclick = ui.closeModal;
    ui.$("#tcfOk").onclick = function () {
      store.completeMapTask(task.id);
      ui.closeModal();
    };
  }

  /* ---------- 导航 ---------- */
  function goScene(id) {
    // 关闭覆盖面板
    if (App.library) App.library.close();
    if (App.treasury) App.treasury.close();
    if (App.modes) App.modes.exitOverlays();

    // 藏书阁 / 珍宝阁 为独立面板
    store.moveScene(id);
    if (id === "library") { if (App.library) App.library.open(); return; }
    if (id === "treasury") { if (App.treasury) App.treasury.open(); return; }

    render();
    if (App.conversation) App.conversation.openingFor(id);
  }

  function init() {
    bgEl = ui.$("#sceneBg");
    headEl = ui.$("#sceneHead");
    fieldEl = ui.$("#taskField");
    npcEl = ui.$("#npcPortrait");
    render();
    // 任务投放/完成 → 刷新当前场景任务卡
    store.on("task", function () {
      var st = store.get();
      renderTasks(data.sceneById(st.scene), st);
    });
    store.on("scene", render);
  }

  App.scene = { init: init, render: render };
  App.nav = App.nav || {};
  App.nav.goScene = goScene;
})();
