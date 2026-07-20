/* =============================================================
   drawer.js —— 奏折匣抽屉：待办奏折（未完成任务）/ 起居注
   window.App.drawer
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var drawer, body, tab = "petition";

  function syncTabs(which) {
    Array.prototype.forEach.call(ui.$("#drawerTabs").querySelectorAll(".dt"), function (x) {
      var selected = x.getAttribute("data-dt") === which;
      x.classList.toggle("active", selected);
      x.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function open(which) {
    if (which) {
      tab = which;
      syncTabs(which);
    }
    drawer.classList.add("open");
    render();
  }
  function close() { drawer.classList.remove("open"); }
  function toggle() { drawer.classList.contains("open") ? close() : open(); }

  function render() {
    if (tab === "petition") renderPetitions();
    else renderJournals();
  }

  function renderPetitions() {
    var st = store.get();
    // 待办奏折 = 已投放但未办结的地图任务
    var pending = st.mapTasks.filter(function (t) { return !t.done && !t.expired; });
    if (!pending.length) {
      body.innerHTML = '<div class="empty-hint">奏折已尽批阅<br/>陛下与大臣商讨国事后，任务将投放至此。</div>';
      return;
    }
    body.innerHTML = pending.map(function (t) {
      var sc = data.sceneById(t.scene);
      var cat = data.CATEGORIES[t.cat];
      return '<div class="petition-item">' +
        '<h5>' + (t.isDailyMystic ? '<span class="mystic-inline-label">天象·' + ui.esc(t.mysticName || "微探索") + '</span>' : '') + ui.esc(t.title) + '</h5>' +
        (t.isDailyMystic && t.mysticSign ? '<div class="muted" style="font-size:12px">「' + ui.esc(t.mysticSign) + '」</div>' : '') +
        '<div class="meta">' + (t.isDailyMystic ? "微探索" : (cat ? cat.label : "")) + ' · ' + ui.esc(sc ? sc.name : "") +
          ' · ' + (t.restore ? '恢复精力 +' + t.restore : '耗精力 ' + Math.abs(t.energy)) +
          ' · 约 ' + (t.durationMinutes || 30) + ' 分钟 · ' +
          (t.restore ? '无金币奖励' : '赏 ' + (t.gold || 0) + ' 金') + '</div>' +
        (t.from && !t.isDailyMystic ? '<div class="muted" style="font-size:12px">源自决策「' + ui.esc(t.from) + '」</div>' : '') +
        (t.knowledgeRefs && t.knowledgeRefs.length ? '<div class="muted" style="font-size:12px">参考「' + t.knowledgeRefs.map(ui.esc).join('、') + '」</div>' : '') +
        '<div class="pi-btns" style="margin-top:8px;display:flex;gap:8px">' +
          '<button class="btn go" data-scene="' + t.scene + '" style="padding:6px 12px">前往场景 ▸</button>' +
          '<button class="btn btn-jade done" data-task="' + t.id + '" style="padding:6px 12px">呈报办结 ✓</button>' +
        '</div></div>';
    }).join("");
    Array.prototype.forEach.call(body.querySelectorAll(".go"), function (b) {
      b.addEventListener("click", function () {
        close();
        App.nav.goScene(b.getAttribute("data-scene"));
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll(".done"), function (b) {
      b.addEventListener("click", function () {
        store.completeMapTask(b.getAttribute("data-task"));
        render();
      });
    });
  }

  function renderJournals() {
    var st = store.get();
    if (!st.journals.length) {
      body.innerHTML = '<div class="empty-hint">起居注尚白<br/>陛下的功业将从此写起。</div>';
      return;
    }
    body.innerHTML = st.journals.map(function (j) {
      return '<div class="journal-item">' +
        '<h5>' + ui.esc(j.title) + '</h5>' +
        '<div class="meta">登基第 ' + j.day + ' 天</div>' +
        '<p>' + ui.esc(j.text) + '</p></div>';
    }).join("");
  }

  function init() {
    drawer = ui.$("#drawer");
    body = ui.$("#drawerBody");
    ui.$("#drawerTab").addEventListener("click", toggle);
    ui.$("#drawerClose").addEventListener("click", close);
    Array.prototype.forEach.call(ui.$("#drawerTabs").querySelectorAll(".dt"), function (d) {
      d.addEventListener("click", function () {
        tab = d.getAttribute("data-dt");
        syncTabs(tab);
        render();
      });
    });
    store.on("task", function () { if (drawer.classList.contains("open")) render(); });
    store.on("journal", function () { if (drawer.classList.contains("open") && tab === "journal") render(); });
  }

  App.drawer = { init: init, open: open, close: close, toggle: toggle };
})();
