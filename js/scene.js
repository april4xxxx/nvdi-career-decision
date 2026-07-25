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
    if (!tasks.length) { renderTaskTemplate(sc, st); return; }
    var cat = data.catByScene(sc.id) || { color: "var(--gold)", label: "" };
    fieldEl.innerHTML = tasks.map(function (t, i) {
      var isDailyMystic = !!t.isDailyMystic;
      var canReroll = isDailyMystic && !t.done && st.dailyMystic && st.dailyMystic.taskId === t.id && st.dailyMystic.rerollsUsed < 1;
      // 结算行（v5 定稿）：金币胶囊独立在前，精力/时长成组在后
      var stats =
        (t.restore ? '' : '<span class="tc-reward"><svg class="tc-ic"><use href="#ic-coin"/></svg>' + t.gold + '</span>') +
        '<div class="tc-stats">' +
        (t.restore
          ? '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-energy-rest"/></svg>+' + t.restore + '</span>'
          : '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-energy"/></svg>' + Math.abs(t.energy) + '</span>') +
        '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-time"/></svg>' + (t.durationMinutes || 30) + '<span class="u">分</span></span>' +
        '</div>';
      // 竖向操作钮
      var action = t.done
        ? '<span class="tc-cta" aria-hidden="true">已办</span>'
        : (canReroll
            ? '<span class="tc-reroll" role="button" tabindex="0" aria-label="免费换一签">换一签</span>'
            : '<span class="tc-cta">呈报</span>');
      return '<button class="task-card' + (t.done ? " done" : "") + (isDailyMystic ? " mystic-daily" : "") + '" data-task="' + t.id + '"' +
        ' style="--c:' + cat.color + ';animation-delay:' + (i * 70) + 'ms">' +
        '<span class="tc-img"><img src="' + ui.esc(t.bg) + '" alt="" onerror="this.style.display=\'none\'" /></span>' +
        '<span class="tc-body">' +
          '<span class="tc-titrow">' +
            (isDailyMystic
              ? '<span class="tc-mystic-name">' + ui.esc(t.mysticName || "今日天象") + '</span>'
              : '<span class="tc-dot"></span>') +
            '<span class="tc-title">' + ui.esc(t.title) + '</span>' +
          '</span>' +
          (isDailyMystic && t.mysticSign ? '<span class="tc-sign">「' + ui.esc(t.mysticSign) + '」</span>' : '') +
          '<span class="tc-foot">' + stats + '</span>' +
        '</span>' +
        action +
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
  var MYSTIC_PREVIEW_COUNT = 3;

  function mysticPreviewCards(st) {
    var cards = (data.MYSTIC_CARDS || []).slice();
    var recent = (st.mysticRecentCards || []).slice(-3);
    var fresh = cards.filter(function (card) { return recent.indexOf(card.id) < 0; });
    if (fresh.length >= MYSTIC_PREVIEW_COUNT) cards = fresh;
    var seedText = String(st.dayKey || st.day || "today");
    var seed = 0;
    for (var i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    var start = cards.length ? seed % cards.length : 0;
    return cards.slice(start).concat(cards.slice(0, start)).slice(0, MYSTIC_PREVIEW_COUNT);
  }

  function renderMysticPreviews(sc, st) {
    var cat = data.catByScene(sc.id);
    var cards = mysticPreviewCards(st);
    var canClaim = st.energy < st.energyCap && (!st.dailyMystic || st.dailyMystic.status === "idle");
    fieldEl.innerHTML = cards.map(function (card, index) {
      return '<button class="task-template-card task-example-case mystic-preview" type="button"' +
        ' data-mystic-preview="' + ui.esc(card.id) + '" style="--c:' + cat.color + '"' +
        (canClaim ? '' : ' disabled aria-disabled="true"') + '>' +
        '<span class="tc-img"><img src="' + ui.esc(data.brain.taskBg(data.CATEGORY_ORDER.indexOf(cat.key) + index)) + '" alt="" onerror="this.style.display=\'none\'" /></span>' +
        '<span class="tc-body">' +
          '<span class="tc-titrow"><span class="tc-mystic-name">' + ui.esc(card.name) + '</span></span>' +
          '<span class="tc-title">' + ui.esc(card.title) + '</span>' +
          '<span class="tc-sign">「' + ui.esc(card.sign) + '」</span>' +
          '<span class="tc-foot"><span class="tc-stats">' +
            '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-energy-rest"/></svg>+10</span>' +
            '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-time"/></svg>' + card.durationMinutes + '<span class="u">分</span></span>' +
          '</span></span>' +
        '</span>' +
        '<span class="tc-cta' + (canClaim ? '' : ' is-disabled') + '">' + (canClaim ? '领取' : '精满') + '</span>' +
      '</button>';
    }).join("");
    if (!canClaim) return;
    Array.prototype.forEach.call(fieldEl.querySelectorAll("[data-mystic-preview]"), function (button) {
      button.addEventListener("click", function () {
        store.offerMysticCard(button.getAttribute("data-mystic-preview"), "observatory-choice");
      });
    });
  }

  function renderTaskTemplate(sc, st) {
    if (sc.id === "observatory" && data.MYSTIC_CARDS && data.MYSTIC_CARDS.length) {
      renderMysticPreviews(sc, st);
      return;
    }
    var template = data.SCENE_TASK_TEMPLATES && data.SCENE_TASK_TEMPLATES[sc.id];
    var cat = data.catByScene(sc.id);
    if (!template || !cat) { fieldEl.innerHTML = ""; return; }
    var bgIndex = data.CATEGORY_ORDER.indexOf(cat.key);
    // 有结构化数值的范例卡（如主线新手卡）按 v5 定稿渲染：金币胶囊 + 精力 + 时长
    var hasStats = template.gold != null || template.energy != null;
    var foot = hasStats
      ? '<span class="tc-foot">' +
          '<span class="tc-reward"><svg class="tc-ic"><use href="#ic-coin"/></svg>' + (template.gold || 0) + '</span>' +
          '<span class="tc-stats">' +
            '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-energy"/></svg>' + Math.abs(template.energy || 0) + '</span>' +
            '<span class="tc-stat"><svg class="tc-ic"><use href="#ic-time"/></svg>' + (template.durationMinutes || 30) + '<span class="u">分</span></span>' +
          '</span>' +
        '</span>'
      : '<span class="tc-meta">' + ui.esc(template.hint + '。AI 会根据你的实际内容分类并投放。') + '</span>';
    fieldEl.innerHTML =
      '<button class="task-template-card' + (template.featured ? ' task-example-case' : '') + '" type="button" style="--c:' + cat.color + '"' +
        ' aria-label="与大臣商议：' + ui.esc(template.title) + '">' +
        '<span class="tc-img"><img src="' + ui.esc(data.brain.taskBg(bgIndex)) + '" alt="" onerror="this.style.display=\'none\'" /></span>' +
        '<span class="tc-body">' +
          '<span class="tc-titrow"><span class="tc-dot"></span><span class="tc-title">' + ui.esc(template.title) + '</span></span>' +
          foot +
        '</span>' +
        '<span class="tc-cta">' + ui.esc(template.cta || "呈报") + '</span>' +
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
        '<button class="btn btn-gold" id="tcfOk">呈报办结</button>' +
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
  function goScene(id, options) {
    if (App.modes) App.modes.exitToNormal();

    // 藏书阁 / 珍宝阁 / 凌烟阁 为独立面板
    // 先让目标面板就位，再更新底层状态，避免切换时短暂露出场景层。
    var overlay = id === "library" ? App.library : id === "treasury" ? App.treasury : id === "lingyan" ? App.lingyan : null;
    if (overlay) {
      overlay.open();
      if (App.library && overlay !== App.library) App.library.close();
      if (App.treasury && overlay !== App.treasury) App.treasury.close();
      if (App.lingyan && overlay !== App.lingyan) App.lingyan.close();
      store.moveScene(id, options);
      return;
    }

    store.moveScene(id, options);
    if (App.library) App.library.close();
    if (App.treasury) App.treasury.close();
    if (App.lingyan) App.lingyan.close();
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
