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
    if (!tasks.length) { renderTaskTemplate(sc); return; }
    var cat = data.catByScene(sc.id) || { color: "var(--gold)", label: "" };
    fieldEl.innerHTML = tasks.map(function (t, i) {
      var isDailyMystic = !!t.isDailyMystic;
      var canReroll = isDailyMystic && !t.done && st.dailyMystic && st.dailyMystic.taskId === t.id && st.dailyMystic.rerollsUsed < 1;
      return '<button class="task-card' + (t.done ? " done" : "") + (isDailyMystic ? " mystic-daily" : "") + '" data-task="' + t.id + '"' +
        ' style="--c:' + cat.color + ';background-image:url(\'' + ui.esc(t.bg) + '\');animation-delay:' + (i * 70) + 'ms">' +
        '<span class="tc-scrim"></span>' +
        '<span class="tc-top"><span class="tc-cat">' + ui.esc(isDailyMystic ? "天象·微探索" : cat.label) + '</span>' +
          (t.done ? '<span class="tc-done">已办 ✓</span>' : '<span class="tc-flag">待办</span>') + '</span>' +
        (isDailyMystic ? '<span class="tc-mystic-name">' + ui.esc(t.mysticName || "今日天象") + '</span>' : '') +
        '<span class="tc-title">' + ui.esc(t.title) + '</span>' +
        (isDailyMystic && t.mysticSign ? '<span class="tc-sign">「' + ui.esc(t.mysticSign) + '」</span>' : '') +
        '<span class="tc-meta">' +
          (t.restore ? '恢复精力 +' + t.restore : '耗精力 ' + Math.abs(t.energy)) +
          ' · 约 ' + (t.durationMinutes || 30) + ' 分钟 · ' +
          (t.restore ? '无金币奖励' : '赏 ' + t.gold + ' 金') +
          (t.from && !isDailyMystic ? ' · 源自决策「' + ui.esc(t.from) + '」' : '') +
          (t.knowledgeRefs && t.knowledgeRefs.length ? ' · 参考「' + t.knowledgeRefs.map(ui.esc).join('、') + '」' : '') + '</span>' +
        (t.done ? '' : '<span class="tc-actions"><span class="tc-cta">呈报完成 ▸</span>' +
          (canReroll ? '<span class="tc-reroll" role="button" tabindex="0" aria-label="免费换一签">换一签</span>' : '') + '</span>') +
      '</button>';
    }).join("");
    Array.prototype.forEach.call(fieldEl.querySelectorAll(".tc-reroll"), function (control) {
      function reroll(event) {
        event.preventDefault();
        event.stopPropagation();
        store.rerollDailyMystic();
      }
      control.addEventListener("click", reroll);
      control.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") reroll(event);
      });
    });
    Array.prototype.forEach.call(fieldEl.querySelectorAll(".task-card"), function (btn) {
      btn.addEventListener("click", function (event) {
        if (event.target.closest(".tc-reroll")) return;
        var id = btn.getAttribute("data-task");
        var task = store.tasksForScene(sc.id).filter(function (x) { return x.id === id; })[0];
        if (!task || task.done) return;
        confirmComplete(task);
      });
    });
  }

  // 空场景仍给出任务范例；该卡不是真实待办，点击只展开 AI 议事。
  function renderTaskTemplate(sc) {
    var template = data.SCENE_TASK_TEMPLATES && data.SCENE_TASK_TEMPLATES[sc.id];
    var cat = data.catByScene(sc.id);
    if (!template || !cat) { fieldEl.innerHTML = ""; return; }
    var bgIndex = data.CATEGORY_ORDER.indexOf(cat.key);
    fieldEl.innerHTML =
      '<button class="task-template-card' + (template.featured ? ' task-example-case' : '') + '" type="button" style="--c:' + cat.color +
        ';background-image:url(\'' + ui.esc(data.brain.taskBg(bgIndex)) + '\')"' +
        ' aria-label="与大臣商议：' + ui.esc(template.title) + '">' +
        '<span class="tc-scrim"></span>' +
        '<span class="tc-top"><span class="tc-cat">' + ui.esc(template.label || "任务范例") + '</span><span class="tc-flag">' + ui.esc(template.flag || "尚未生成") + '</span></span>' +
        '<span class="tc-title">' + ui.esc(template.title) + '</span>' +
        '<span class="tc-meta">' + ui.esc(template.meta || (template.hint + '。AI 会根据你的实际内容分类并投放。')) + '</span>' +
        '<span class="tc-cta">' + ui.esc(template.cta || "与大臣商议") + ' ▸</span>' +
      '</button>';
    fieldEl.querySelector(".task-template-card").addEventListener("click", function () {
      if (App.conversation) App.conversation.expand();
    });
  }

  // 呈报完成：轻确认 → 结算
  function confirmComplete(task) {
    var settlement = task.restore
      ? '<div class="tcf-stat"><span>恢复精力</span><strong>+' + task.restore + '</strong></div>' +
        '<span class="tcf-divider" aria-hidden="true"></span>' +
        '<div class="tcf-stat"><span>金币赏赐</span><strong>—</strong></div>'
      : '<div class="tcf-stat"><span>消耗精力</span><strong>−' + Math.abs(task.energy) + '</strong></div>' +
        '<span class="tcf-divider" aria-hidden="true"></span>' +
        '<div class="tcf-stat"><span>金币赏赐</span><strong>+' + task.gold + '</strong></div>';
    ui.openModal(
      '<div class="task-confirm" role="alertdialog" aria-labelledby="taskConfirmTitle" aria-describedby="taskConfirmNote">' +
      '<div class="tcf-kicker">' + (task.isDailyMystic ? '天 象 奏 报' : '任 务 奏 报') + '</div>' +
      '<h3 id="taskConfirmTitle">呈报此任务已办结？</h3>' +
      '<div class="tcf-task"><span>' + (task.isDailyMystic ? '微探索' : '待办') + '</span><strong>' + ui.esc(task.title) + '</strong></div>' +
      '<div class="tcf-settlement" aria-label="办结结算">' + settlement + '</div>' +
      '<p class="tcf-note" id="taskConfirmNote">确认后将立即结算，并将任务标记为已办。</p>' +
      '<div class="tcf-btns">' +
        '<button class="btn btn-ghost" id="tcfCancel">稍后再报</button>' +
        '<button class="btn btn-jade" id="tcfOk">呈报办结</button>' +
      '</div></div>'
    , "task-confirm-modal");
    ui.$("#tcfCancel").onclick = ui.closeModal;
    ui.$("#tcfOk").onclick = function () {
      store.completeMapTask(task.id);
      ui.closeModal();
    };
    ui.$("#tcfCancel").focus();
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
    // conversation 通过 store 的 scene 事件保存旧场景会话并恢复新场景，不在此重置。
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
